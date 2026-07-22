import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRows } from '../src/lib/merge.mjs';
import { buildStrengthModel } from '../src/lib/plausibility.mjs';

// A source-row factory (pre-merge shape).
const row = (over = {}) => ({
  source: 'github-jr', source_id: '1', seen_at: '2026-07-07',
  brand_name: 'Xyz 500 Tablet', manufacturer: 'Acme Ltd', pack_label: 'strip of 10 tablets',
  form_raw: null, price_inr: 10, is_discontinued: false,
  ingredients: [{ molecule: 'paracetamol', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
  composition_raw: 'Paracetamol (500mg)', composition_status: 'complete',
  substitutes_raw: [], type: 'allopathy', ...over,
});
// Distribution: paracetamol common at 500/650; a combo where a/b have DISTINCT ranges
// (so the assignment is unambiguous) and p/q have OVERLAPPING ranges (ambiguous).
const bulk = (molecule, value, unit, n) => Array.from({ length: n }, () => ({ ingredients: [{ molecule, strength_value: value, strength_unit: unit }] }));
const MODEL = buildStrengthModel([
  ...bulk('paracetamol', 500, 'mg', 800), ...bulk('paracetamol', 650, 'mg', 200),
  ...bulk('a', 500, 'mg', 500), ...bulk('a', 250, 'mg', 200),
  ...bulk('b', 125, 'mg', 400), ...bulk('b', 200, 'mg', 50),
  ...bulk('p', 5, 'mg', 500), ...bulk('p', 10, 'mg', 500),
  ...bulk('q', 5, 'mg', 500), ...bulk('q', 10, 'mg', 500),
]);
const ing = (m, v, u) => ({ molecule: m, strength_value: v, strength_unit: u, strength_raw: `${v}${u}` });

test('multi-source agreement on strength -> verified', () => {
  const { rows } = mergeRows([
    row(),
    row({ source: 'onemg-live', source_id: 'x', price_inr: 12 }),
  ], { model: MODEL });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_count, 2);
  assert.equal(rows[0].strength_status, 'verified');
  assert.equal(rows[0].strength_verified, true);
  assert.equal(rows[0].strength_conflict, false);
});

test('single-source single-molecule: plausible -> verified, implausible -> unverified', () => {
  const good = mergeRows([row()], { model: MODEL }).rows[0];
  assert.equal(good.strength_status, 'verified');
  assert.equal(good.strength_verified, true);
  const bad = mergeRows([row({
    brand_name: 'Weird 999 Tablet',
    ingredients: [ing('paracetamol', 999, 'mg')], composition_raw: 'Paracetamol (999mg)',
  })], { model: MODEL }).rows[0];
  assert.equal(bad.strength_status, 'unverified');
  assert.equal(bad.strength_verified, false);
});

test('single-source combo: unambiguous assignment verified, ambiguous unverified', () => {
  const unamb = mergeRows([row({
    brand_name: 'Combo AB Tablet',
    ingredients: [ing('a', 500, 'mg'), ing('b', 125, 'mg')], composition_raw: 'A (500mg) + B (125mg)',
  })], { model: MODEL }).rows[0];
  assert.equal(unamb.strength_verified, true);
  assert.equal(unamb.strength_status, 'verified');
  const amb = mergeRows([row({
    brand_name: 'Combo PQ Tablet',
    ingredients: [ing('p', 5, 'mg'), ing('q', 10, 'mg')], composition_raw: 'P (5mg) + Q (10mg)',
  })], { model: MODEL }).rows[0];
  assert.equal(amb.strength_verified, false);
  assert.equal(amb.strength_status, 'unverified');
});

test('no strength -> no_strength status, not verified', () => {
  const r = mergeRows([row({
    brand_name: 'Empty Cream', form_raw: 'cream',
    ingredients: [], composition_raw: '', composition_status: 'missing',
  })], { model: MODEL }).rows[0];
  assert.equal(r.strength_status, 'no_strength');
  assert.equal(r.strength_verified, false);
  assert.equal(r.strength_conflict, false);
});

test('same-identity strength disagreement -> strength_conflict on both sides', () => {
  // identical brand+mfr+form+pack, same molecule, DIFFERENT strength across sources
  const base = { brand_name: 'Disp 500 Tablet', manufacturer: 'Acme Ltd', pack_label: 'strip of 10 tablets', form_raw: 'tablet' };
  const { rows } = mergeRows([
    row({ ...base, source: 'github-jr', source_id: 'g', ingredients: [ing('paracetamol', 500, 'mg')], composition_raw: 'Paracetamol (500mg)' }),
    row({ ...base, source: 'netmeds', source_id: 'n', ingredients: [ing('paracetamol', 650, 'mg')], composition_raw: 'Paracetamol (650mg)' }),
  ], { model: MODEL });
  const flagged = rows.filter((r) => r.strength_conflict);
  assert.equal(flagged.length, 2, 'both disagreeing rows flagged');
  assert.ok(rows.every((r) => r.confidence === 'conflict'));
});

test('backward compatible: without a model, no strength_* fields are added', () => {
  const { rows } = mergeRows([row()]);
  assert.equal(rows.length, 1);
  assert.equal('strength_status' in rows[0], false);
  assert.equal('strength_verified' in rows[0], false);
});
