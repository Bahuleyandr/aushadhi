import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseProfile, formulationKey, assignSubstituteGroups, substitutesFor, formulationGroupRows } from '../src/lib/formulation.mjs';

// ---------- releaseProfile ----------
test('releaseProfile: defaults to IR when no modifier present', () => {
  assert.equal(releaseProfile('Glyciphage 500 Tablet', 'Tablet', '10'), 'IR');
  assert.equal(releaseProfile('Crocin'), 'IR');
  assert.equal(releaseProfile(), 'IR');
});

test('releaseProfile: detects the common modified-release families', () => {
  assert.equal(releaseProfile('Glycomet SR 500'), 'SR');
  assert.equal(releaseProfile('Dilzem CR 90'), 'CR');
  assert.equal(releaseProfile('Metolar XR 50'), 'ER');
  assert.equal(releaseProfile('Met XL 25'), 'ER');
  assert.equal(releaseProfile('Depakote', 'Extended Release Tablet'), 'ER');
  assert.equal(releaseProfile('Pantop', 'Delayed Release Capsule'), 'DR');
  assert.equal(releaseProfile('Rablet', 'Enteric Coated Tablet'), 'DR');
  assert.equal(releaseProfile('Cardace', 'Sustained Release Tablet'), 'SR');
  assert.equal(releaseProfile('Nicardia Retard 20'), 'RETARD');
  assert.equal(releaseProfile('Something', 'Modified Release Tablet'), 'MR');
});

test('releaseProfile: case-insensitive and word-bounded (no false positives on plain names)', () => {
  assert.equal(releaseProfile('glycomet sr 500'), 'SR');
  // "Israel"/"Doctor"/"Preston" must NOT trip sr/dr/pr detectors
  assert.equal(releaseProfile('Israel Pharma Preston 500 Tablet'), 'IR');
  assert.equal(releaseProfile('Laser Eye Drops'), 'IR');   // "la"/"ser" not long-acting
});

// ---------- formulationKey ----------
const mol = (molecule, v, u) => ({ molecule, strength_value: v, strength_unit: u });

test('formulationKey: null unless every molecule has a finite strength', () => {
  assert.equal(formulationKey([mol('paracetamol', null, null)], 'Tablet', 'IR'), null);
  assert.equal(formulationKey([mol('paracetamol', 500, 'mg'), mol('caffeine', null, null)], 'Tablet', 'IR'), null);
  assert.equal(formulationKey([], 'Tablet', 'IR'), null);
  assert.equal(formulationKey([mol('', 500, 'mg')], 'Tablet', 'IR'), null);
  assert.ok(formulationKey([mol('paracetamol', 500, 'mg')], 'Tablet', 'IR'));
});

test('formulationKey: order-independent, 12-hex, sensitive to strength/form/release', () => {
  const a = formulationKey([mol('levocetirizine', 5, 'mg'), mol('montelukast', 10, 'mg')], 'Tablet', 'IR');
  const b = formulationKey([mol('montelukast', 10, 'mg'), mol('levocetirizine', 5, 'mg')], 'Tablet', 'IR');
  assert.equal(a, b);                       // molecule order irrelevant
  assert.match(a, /^[0-9a-f]{12}$/);
  // different strength / form / release => different key
  assert.notEqual(a, formulationKey([mol('levocetirizine', 10, 'mg'), mol('montelukast', 5, 'mg')], 'Tablet', 'IR')); // the swap!
  assert.notEqual(a, formulationKey([mol('levocetirizine', 5, 'mg'), mol('montelukast', 10, 'mg')], 'Oral Liquid', 'IR'));
  assert.notEqual(a, formulationKey([mol('levocetirizine', 5, 'mg'), mol('montelukast', 10, 'mg')], 'Tablet', 'SR'));
});

// ---------- assignSubstituteGroups ----------
function rec(med_id, molecules, form, release_profile, extra = {}) {
  return { med_id, molecules, form, release_profile, strength_verified: true, strength_conflict: false, ...extra };
}

test('assignSubstituteGroups: groups same-formulation across brands, excludes self', () => {
  const recs = [
    rec('a', [mol('amlodipine', 5, 'mg')], 'Tablet', 'IR'),
    rec('b', [mol('amlodipine', 5, 'mg')], 'Tablet', 'IR'),
    rec('c', [mol('amlodipine', 5, 'mg')], 'Tablet', 'IR'),
  ];
  const groups = assignSubstituteGroups(recs);
  assert.equal(recs[0].substitute_count, 2);
  assert.deepEqual(substitutesFor(recs[0], groups), ['b', 'c']);
  assert.equal(recs[0].formulation_key, recs[1].formulation_key);
});

test('assignSubstituteGroups: IR never groups with SR; tablet never with syrup', () => {
  const recs = [
    rec('ir', [mol('metformin', 500, 'mg')], 'Tablet', 'IR'),
    rec('sr', [mol('metformin', 500, 'mg')], 'Tablet', 'SR'),
    rec('syr', [mol('metformin', 500, 'mg')], 'Oral Liquid', 'IR'),
  ];
  const groups = assignSubstituteGroups(recs);
  assert.equal(recs[0].substitute_count, 0);          // IR tablet: no same-formulation peer
  assert.deepEqual(substitutesFor(recs[0], groups), []);
  assert.notEqual(recs[0].formulation_key, recs[1].formulation_key);
  assert.notEqual(recs[0].formulation_key, recs[2].formulation_key);
});

test('assignSubstituteGroups: unverified / conflicted / no-strength records get no group', () => {
  const recs = [
    rec('ok1', [mol('atorvastatin', 10, 'mg')], 'Tablet', 'IR'),
    rec('ok2', [mol('atorvastatin', 10, 'mg')], 'Tablet', 'IR'),
    rec('unv', [mol('atorvastatin', null, null)], 'Tablet', 'IR', { strength_verified: false }),
    rec('cfl', [mol('atorvastatin', 10, 'mg')], 'Tablet', 'IR', { strength_conflict: true }),
  ];
  const groups = assignSubstituteGroups(recs);
  assert.equal(recs[0].substitute_count, 1);            // ok1 <-> ok2 only
  assert.deepEqual(substitutesFor(recs[0], groups), ['ok2']);
  assert.equal(recs[2].formulation_key, null);          // unverified excluded
  assert.equal(recs[2].substitute_count, 0);
  assert.equal(recs[3].formulation_key, null);          // conflicted excluded
  assert.equal(recs[3].substitute_count, 0);
});

test('formulationGroupRows: one row per group, members sorted, count correct', () => {
  const recs = [
    rec('b', [mol('amlodipine', 5, 'mg')], 'Tablet', 'IR'),
    rec('a', [mol('amlodipine', 5, 'mg')], 'Tablet', 'IR'),
    rec('z', [mol('telmisartan', 40, 'mg')], 'Tablet', 'IR'),
  ];
  const groups = assignSubstituteGroups(recs);
  const rows = formulationGroupRows(recs, groups);
  const amlo = rows.find((r) => r.member_count === 2);
  assert.deepEqual(amlo.member_med_ids, ['a', 'b']);
  assert.equal(amlo.form, 'Tablet');
  assert.equal(amlo.release_profile, 'IR');
  assert.equal(amlo.molecules[0].molecule, 'amlodipine');
});
