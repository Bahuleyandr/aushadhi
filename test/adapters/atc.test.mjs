import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadAtcMap, atcForMolecules } from '../../src/adapters/atc.mjs';
import { normMolecule } from '../../src/lib/normalize.mjs';

test('loadAtcMap: bundled seed maps common molecules', () => {
  const m = loadAtcMap('data/raw');
  assert.deepEqual([...(m.get('paracetamol') ?? [])], ['N02BE01']);
  assert.deepEqual([...(m.get('metformin') ?? [])], ['A10BA02']);
  assert.ok(m.size >= 40);
});

test('loadAtcMap: operator-dropped reference merges (csv + tsv, aliased columns)', () => {
  const root = 'test/.tmp-atc';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(`${root}/atc`, { recursive: true });
  fs.writeFileSync(`${root}/atc/extra.csv`, 'molecule,atc_code\nMysteryMol,X99ZZ99\n');
  fs.writeFileSync(`${root}/atc/more.tsv`, 'name\tcode\nParacetamol\tN02BE01\n');
  const m = loadAtcMap(root);
  assert.deepEqual([...(m.get('mysterymol') ?? [])], ['X99ZZ99']);
  assert.ok((m.get('paracetamol') ?? new Set()).has('N02BE01')); // seed + tsv, deduped
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadAtcMap: WHO ATC CSV (atc_code,atc_name) drops in — name maps to code', () => {
  const root = 'test/.tmp-atc-who';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(`${root}/atc`, { recursive: true });
  // fabkury/atcd and similar WHO scrapes use atc_code,atc_name column order.
  // Use a molecule absent from the bundled seed so this tests the CSV, not the seed.
  fs.writeFileSync(`${root}/atc/who.csv`, 'atc_code,atc_name,ddd,uom,adm_r,note\nZ99ZZ99,madeupzumab,2,g,O,\n');
  const m = loadAtcMap(root);
  assert.ok((m.get('madeupzumab') ?? new Set()).has('Z99ZZ99'), 'atc_name column should map to atc_code');
  fs.rmSync(root, { recursive: true, force: true });
});

test('atcForMolecules: union across a composition, sorted; unknowns absent', () => {
  const m = loadAtcMap('data/raw');
  assert.deepEqual(atcForMolecules(['paracetamol', 'metformin'], m), ['A10BA02', 'N02BE01']);
  assert.deepEqual(atcForMolecules(['made-up-molecule'], m), []);
});

test('expanded seed covers high-frequency Indian-market molecules', () => {
  const m = loadAtcMap('data/raw');
  assert.deepEqual([...(m.get('domperidone') ?? [])], ['A03FA03']);
  assert.deepEqual([...(m.get('ceftriaxone') ?? [])], ['J01DD04']);
  assert.deepEqual([...(m.get('ondansetron') ?? [])], ['A04AA01']);
  assert.ok(m.size >= 90, `seed grew (got ${m.size})`);
});

test('canonicalized variant molecules resolve to ATC via the seed', () => {
  const m = loadAtcMap('data/raw');
  // a brand listing "Guaiphenesin" normalizes to guaifenesin -> R05CA03
  assert.deepEqual(atcForMolecules([normMolecule('Guaiphenesin')], m), ['R05CA03']);
  // "Vitamin B6 (Pyridoxine)" -> pyridoxine -> A11HA02
  assert.deepEqual(atcForMolecules([normMolecule('Vitamin B6 Pyridoxine')], m), ['A11HA02']);
});
