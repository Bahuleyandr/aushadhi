import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStrengthModel, PLAUSIBLE_MIN_COUNT, PLAUSIBLE_MIN_SHARE } from '../src/lib/plausibility.mjs';

// Build rows from compact [molecule, value, unit, count] observations.
function rowsFrom(observations) {
  const rows = [];
  for (const [molecule, value, unit, count] of observations) {
    for (let i = 0; i < count; i += 1) {
      rows.push({ ingredients: [{ molecule, strength_value: value, strength_unit: unit }] });
    }
  }
  return rows;
}
const ing = (molecule, value, unit) => ({ molecule, strength_value: value, strength_unit: unit });

test('isPlausible: common strength plausible, rare strength implausible', () => {
  const m = buildStrengthModel(rowsFrom([['montelukast', 10, 'mg', 1000], ['montelukast', 500, 'mg', 1]]));
  assert.equal(m.isPlausible('montelukast', 10, 'mg'), true);
  assert.equal(m.isPlausible('montelukast', 500, 'mg'), false); // share 1/1001 < floor
});

test('isPlausible: unknown molecule and unseen value are implausible', () => {
  const m = buildStrengthModel(rowsFrom([['montelukast', 10, 'mg', 100]]));
  assert.equal(m.isPlausible('nonexistent', 10, 'mg'), false);
  assert.equal(m.isPlausible('montelukast', 7, 'mg'), false);
});

test('isPlausible: null/undefined strength is not judged (returns true)', () => {
  const m = buildStrengthModel([]);
  assert.equal(m.isPlausible('x', null, 'mg'), true);
  assert.equal(m.isPlausible('x', undefined, 'mg'), true);
});

test('isPlausible: count floor — needs >= PLAUSIBLE_MIN_COUNT observations', () => {
  assert.equal(PLAUSIBLE_MIN_COUNT, 3);
  const two = buildStrengthModel(rowsFrom([['x', 5, 'mg', 2]])); // share 1.0 but count 2
  assert.equal(two.isPlausible('x', 5, 'mg'), false);
  const three = buildStrengthModel(rowsFrom([['x', 5, 'mg', 3]]));
  assert.equal(three.isPlausible('x', 5, 'mg'), true);
});

test('isPlausible: share floor — high count but tiny share is implausible', () => {
  const m = buildStrengthModel(rowsFrom([['x', 100, 'mg', 1000], ['x', 5, 'mg', 4]]));
  assert.ok(4 / 1004 < PLAUSIBLE_MIN_SHARE);
  assert.equal(m.isPlausible('x', 5, 'mg'), false);
  assert.equal(m.isPlausible('x', 100, 'mg'), true);
});

test('isPlausible: unit is case-insensitive and value rounding distinguishes observations', () => {
  const m = buildStrengthModel(rowsFrom([['x', 10, 'mg', 100], ['x', 10, 'ml', 100]]));
  assert.equal(m.isPlausible('x', 10, 'mg'), true);
  assert.equal(m.isPlausible('x', 10, 'MG'), true);
  assert.equal(m.isPlausible('x', 10, 'iu'), false); // unseen unit
});

test('plausScore: prefers the pharmacologically-correct swap assignment', () => {
  const m = buildStrengthModel(rowsFrom([
    ['levocetirizine', 5, 'mg', 800], ['levocetirizine', 10, 'mg', 30],
    ['montelukast', 10, 'mg', 700], ['montelukast', 5, 'mg', 25],
  ]));
  const correct = [ing('levocetirizine', 5, 'mg'), ing('montelukast', 10, 'mg')];
  const swapped = [ing('levocetirizine', 10, 'mg'), ing('montelukast', 5, 'mg')];
  assert.ok(m.plausScore(correct) > m.plausScore(swapped));
});

test('plausScore: ignores null-strength ingredients', () => {
  const m = buildStrengthModel(rowsFrom([['x', 5, 'mg', 100]]));
  assert.equal(m.plausScore([ing('x', 5, 'mg'), ing('y', null, null)]), m.plausScore([ing('x', 5, 'mg')]));
});

test('assignmentUnambiguous: distinct-range combo is verifiable (swap implausible)', () => {
  const m = buildStrengthModel(rowsFrom([
    ['amoxycillin', 500, 'mg', 500], ['amoxycillin', 250, 'mg', 200],
    ['clavulanic acid', 125, 'mg', 400], ['clavulanic acid', 200, 'mg', 50],
  ]));
  assert.equal(m.assignmentUnambiguous([ing('amoxycillin', 500, 'mg'), ing('clavulanic acid', 125, 'mg')]), true);
});

test('assignmentUnambiguous: overlapping-range combo is ambiguous (swap also plausible)', () => {
  const m = buildStrengthModel(rowsFrom([
    ['levocetirizine', 5, 'mg', 500], ['levocetirizine', 10, 'mg', 500],
    ['montelukast', 5, 'mg', 500], ['montelukast', 10, 'mg', 500],
  ]));
  assert.equal(m.assignmentUnambiguous([ing('levocetirizine', 5, 'mg'), ing('montelukast', 10, 'mg')]), false);
});

test('assignmentUnambiguous: implausible current assignment is not verifiable', () => {
  const m = buildStrengthModel(rowsFrom([['a', 100, 'mg', 100], ['b', 50, 'mg', 100]]));
  assert.equal(m.assignmentUnambiguous([ing('a', 999, 'mg'), ing('b', 50, 'mg')]), false);
});

test('assignmentUnambiguous: null strength, empty, and >3 molecules are not verifiable', () => {
  const m = buildStrengthModel(rowsFrom([['a', 1, 'mg', 100]]));
  assert.equal(m.assignmentUnambiguous([ing('a', null, 'mg'), ing('b', 1, 'mg')]), false);
  assert.equal(m.assignmentUnambiguous([]), false);
  assert.equal(m.assignmentUnambiguous([ing('a', 1, 'mg'), ing('b', 1, 'mg'), ing('c', 1, 'mg'), ing('d', 1, 'mg')]), false);
});

test('assignmentUnambiguous: identical strengths across molecules is verifiable (no real swap)', () => {
  const m = buildStrengthModel(rowsFrom([['a', 5, 'mg', 100], ['b', 5, 'mg', 100]]));
  assert.equal(m.assignmentUnambiguous([ing('a', 5, 'mg'), ing('b', 5, 'mg')]), true);
});

test('assignmentUnambiguous: single plausible molecule verifiable, implausible not', () => {
  const m = buildStrengthModel(rowsFrom([['a', 5, 'mg', 100]]));
  assert.equal(m.assignmentUnambiguous([ing('a', 5, 'mg')]), true);
  assert.equal(m.assignmentUnambiguous([ing('a', 999, 'mg')]), false);
});

test('resolves the real Alviroz-style case that source-trust got wrong', () => {
  const m = buildStrengthModel(rowsFrom([
    ['aspirin', 75, 'mg', 900], ['aspirin', 150, 'mg', 200], ['aspirin', 10, 'mg', 3],
    ['rosuvastatin', 10, 'mg', 800], ['rosuvastatin', 20, 'mg', 400], ['rosuvastatin', 75, 'mg', 1],
  ]));
  const correct = [ing('aspirin', 75, 'mg'), ing('rosuvastatin', 10, 'mg')];
  const swapped = [ing('aspirin', 10, 'mg'), ing('rosuvastatin', 75, 'mg')];
  assert.ok(m.plausScore(correct) > m.plausScore(swapped));
  assert.equal(m.assignmentUnambiguous(correct), true); // swap implausible -> verifiable
});

test('buildStrengthModel: tolerates missing/empty/malformed ingredients', () => {
  const m = buildStrengthModel([{}, { ingredients: null }, { ingredients: [{ molecule: 'x' }] },
    { ingredients: [{ molecule: 'x', strength_value: 5, strength_unit: 'mg' }] }]);
  assert.equal(m.total('x'), 1);
  assert.equal(m.isPlausible('x', 5, 'mg'), false); // only 1 observation -> count < floor
});

// --- regression: adversarial-verification findings (workflow wgbvr8wxp) ---

test('isPlausible: NaN / Infinity / non-numeric strength are implausible, not "unjudged"', () => {
  const m = buildStrengthModel(rowsFrom([['x', 5, 'mg', 100]]));
  assert.equal(m.isPlausible('x', NaN, 'mg'), false);
  assert.equal(m.isPlausible('x', Infinity, 'mg'), false);
  assert.equal(m.isPlausible('x', -Infinity, 'mg'), false);
  assert.equal(m.isPlausible('x', '5', 'mg'), false); // a string is not a number
  assert.equal(m.isPlausible('x', null, 'mg'), true); // null/undefined stay "nothing to judge"
  assert.equal(m.isPlausible('x', undefined, 'mg'), true);
});

test('assignmentUnambiguous: sub-3rd-decimal strengths that round equal are treated consistently', () => {
  // 2.5001 and 2.5004 both round to 2.5 -> observed at the same bucket -> swap is identity -> verifiable
  const m = buildStrengthModel(rowsFrom([['a', 2.5001, 'mg', 500], ['b', 2.5004, 'mg', 500]]));
  assert.equal(m.assignmentUnambiguous([ing('a', 2.5001, 'mg'), ing('b', 2.5004, 'mg')]), true);
});

test('valKey rounding: values within 3-decimal precision share a bucket', () => {
  const m = buildStrengthModel(rowsFrom([['x', 2.5, 'mg', 100]]));
  assert.equal(m.observed('x', 2.5004, 'mg'), 100); // rounds to 2.5
  assert.equal(m.observed('x', 2.5, 'mg'), 100);
  assert.equal(m.observed('x', 2.6, 'mg'), 0);
});

test('share floor is inclusive: exactly 0.005 share (with count >= floor) is plausible', () => {
  const m = buildStrengthModel([...rowsFrom([['x', 5, 'mg', 5]]), ...rowsFrom([['x', 9, 'mg', 995]])]);
  assert.equal(m.total('x'), 1000);
  assert.equal(m.observed('x', 5, 'mg'), 5);
  assert.equal(m.isPlausible('x', 5, 'mg'), true); // 5 >= 3 && 5/1000 = 0.005 >= 0.005
});

test('buildStrengthModel + plausScore: multi-ingredient rows count and sum per ingredient', () => {
  const m = buildStrengthModel([{ ingredients: [ing('a', 5, 'mg'), ing('b', 10, 'mg')] }]);
  assert.equal(m.total('a'), 1);
  assert.equal(m.total('b'), 1);
  assert.equal(m.observed('b', 10, 'mg'), 1);
  const full = buildStrengthModel(rowsFrom([['a', 5, 'mg', 100], ['b', 10, 'mg', 100], ['c', 20, 'mg', 100]]));
  assert.equal(full.plausScore([ing('a', 5, 'mg'), ing('b', 10, 'mg'), ing('c', 20, 'mg')]), 3); // 3 × share 1.0
});
