import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadAtcMap, atcForMolecules } from '../../src/adapters/atc.mjs';

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

test('atcForMolecules: union across a composition, sorted; unknowns absent', () => {
  const m = loadAtcMap('data/raw');
  assert.deepEqual(atcForMolecules(['paracetamol', 'metformin'], m), ['A10BA02', 'N02BE01']);
  assert.deepEqual(atcForMolecules(['made-up-molecule'], m), []);
});
