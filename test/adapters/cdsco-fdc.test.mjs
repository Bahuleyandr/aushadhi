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
