import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFdcCombos, comboNameKey } from '../../src/adapters/cdsco-fdc.mjs';

const SAMPLE = `
Fixed Dose Combinations approved by CDSCO

1. Amoxicillin + Clavulanic Acid
2. Paracetamol + Phenylephrine Hydrochloride + Chlorpheniramine Maleate
3. This is a long prose sentence about the committee that met in Delhi and decided things + more prose.
4. Telmisartan + Amlodipine
Some unrelated line without any plus sign.
`;

test('extracts approved FDC molecule combos, ignores prose', () => {
  const combos = extractFdcCombos(SAMPLE);
  const keys = combos.map(comboNameKey);
  assert.ok(keys.includes(comboNameKey(['amoxycillin', 'clavulanic acid'])));
  assert.ok(keys.includes(comboNameKey(['amlodipine', 'telmisartan'])));
  // salt suffixes are stripped by normMolecule on BOTH sides (combo + artifact ingredients)
  assert.ok(keys.includes(comboNameKey(['chlorpheniramine', 'paracetamol', 'phenylephrine'])));
  assert.equal(combos.length, 3); // prose line rejected
});

test('comboNameKey is order-independent', () => {
  assert.equal(comboNameKey(['b', 'a']), comboNameKey(['a', 'b']));
});

// ── silent-failure surfacing ──────────────────────────────────────────────
//
// This source has no per-row identifier, so there is no honest equivalent of the
// PMBJP row-completeness assertion. What it did have was a silent failure path: a
// PDF that failed to convert, or produced no combos at all, looked exactly like one
// that legitimately contributed nothing. Both are now reported.
import fsp from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import { loadCdscoFdcCombos } from '../../src/adapters/cdsco-fdc.mjs';

test('a pre-extracted file that yields no combos is reported, not silently ignored', async () => {
  const root = fsp.mkdtempSync(nodePath.join(os.tmpdir(), 'cdsco-fdc-'));
  const dir = nodePath.join(root, 'cdsco-fdc');
  fsp.mkdirSync(dir, { recursive: true });
  // .txt already present so no pdftotext binary is needed
  fsp.writeFileSync(nodePath.join(dir, 'empty.pdf'), 'not really a pdf');
  fsp.writeFileSync(nodePath.join(dir, 'empty.txt'), 'This page intentionally contains no combinations.\n');
  fsp.writeFileSync(nodePath.join(dir, 'good.pdf'), 'not really a pdf');
  fsp.writeFileSync(nodePath.join(dir, 'good.txt'), 'Amoxicillin + Clavulanic Acid\n');

  const result = await loadCdscoFdcCombos(root);
  assert.equal(result.files, 2);
  assert.equal(result.keys.size, 1);
  assert.equal(result.emptyFiles.length, 1);
  assert.match(result.emptyFiles[0], /empty\.pdf$/u);
  assert.deepEqual(result.failedFiles, []);

  const byFile = new Map(result.perFile.map((entry) => [nodePath.basename(entry.file), entry.combos]));
  assert.equal(byFile.get('good.pdf'), 1);
  assert.equal(byFile.get('empty.pdf'), 0);
  fsp.rmSync(root, { recursive: true, force: true });
});

test('an absent cdsco-fdc directory stays a clean no-op', async () => {
  const root = fsp.mkdtempSync(nodePath.join(os.tmpdir(), 'cdsco-fdc-none-'));
  const result = await loadCdscoFdcCombos(root);
  assert.equal(result.keys.size, 0);
  assert.equal(result.files, 0);
  fsp.rmSync(root, { recursive: true, force: true });
});

test('a missing sibling extraction is written only to the derived cache', async () => {
  const root = fsp.mkdtempSync(nodePath.join(os.tmpdir(), 'cdsco-fdc-derived-'));
  const dir = nodePath.join(root, 'cdsco-fdc');
  const derivedRoot = nodePath.join(root, '..', `${nodePath.basename(root)}-derived`);
  fsp.mkdirSync(dir, { recursive: true });
  const pdf = nodePath.join(dir, 'official.pdf');
  fsp.writeFileSync(pdf, 'stable fake PDF bytes');

  const result = await loadCdscoFdcCombos(root, {
    derivedRoot,
    pdfToTextImpl: async (_source, target, options) => {
      assert.equal(options.mode, 'layout');
      fsp.writeFileSync(target, 'Amoxicillin + Clavulanic Acid\n');
      return { file: target, mode: options.mode };
    },
  });

  assert.equal(result.keys.size, 1);
  assert.equal(fsp.existsSync(nodePath.join(dir, 'official.txt')), false);
  assert.equal(
    fsp.readdirSync(nodePath.join(derivedRoot, 'cdsco-fdc')).filter((name) => name.endsWith('.txt')).length,
    1,
  );
  fsp.rmSync(root, { recursive: true, force: true });
  fsp.rmSync(derivedRoot, { recursive: true, force: true });
});
