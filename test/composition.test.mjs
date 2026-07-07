import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredient, parseComposition, splitCompositionString } from '../src/lib/composition.mjs';

test('simple strength', () => {
  assert.deepEqual(parseIngredient('Amoxycillin  (500mg)'), {
    molecule: 'amoxycillin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg',
  });
});

test('per-volume, IU, mcg, percent', () => {
  assert.equal(parseIngredient('Ambroxol (30mg/5ml)').strength_unit, 'mg/5ml');
  assert.equal(parseIngredient('Cholecalciferol (60000IU)').strength_value, 60000);
  assert.equal(parseIngredient('Mecobalamin (1500mcg)').strength_unit, 'mcg');
  assert.equal(parseIngredient('Ketoconazole (2% w/v)').strength_unit, '%w/v');
});

test('no strength / NA / empty', () => {
  assert.deepEqual(parseIngredient('Silicon Dioxide'), {
    molecule: 'silicon dioxide', strength_value: null, strength_unit: null, strength_raw: null,
  });
  assert.equal(parseIngredient('NA'), null);
  assert.equal(parseIngredient(''), null);
  assert.equal(parseIngredient(undefined), null);
});

test('parseComposition from 2-slot arrays, sorted, status', () => {
  const c = parseComposition(['Clavulanic Acid (125mg)', 'Amoxycillin (500mg)']);
  assert.deepEqual(c.ingredients.map((i) => i.molecule), ['amoxycillin', 'clavulanic acid']);
  assert.equal(c.status, 'complete');
  assert.equal(parseComposition(['NA', '']).status, 'missing');
});

test('parseComposition from a full + joined string', () => {
  const c = parseComposition('Paracetamol (325mg) + Phenylephrine (5mg) + Chlorpheniramine Maleate (2mg)');
  assert.equal(c.ingredients.length, 3);
  assert.equal(c.status, 'complete');
});

test('splitCompositionString on +', () => {
  assert.equal(splitCompositionString('Paracetamol (325mg) + Phenylephrine (5mg) + Chlorpheniramine (2mg)').length, 3);
  assert.deepEqual(splitCompositionString(''), []);
  assert.deepEqual(splitCompositionString(null), []);
});
