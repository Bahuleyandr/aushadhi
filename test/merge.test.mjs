import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityKey, moleculeSetKey, mergeRows } from '../src/lib/merge.mjs';

const gj = (over = {}) => ({
  source: 'github-jr', source_id: '1', seen_at: '2026-07-07',
  brand_name: 'Augmentin 625 Duo Tablet', manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
  pack_label: 'strip of 10 tablets', form_raw: null, price_inr: 223.42, is_discontinued: false,
  ingredients: [
    { molecule: 'amoxycillin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' },
    { molecule: 'clavulanic acid', strength_value: 125, strength_unit: 'mg', strength_raw: '125mg' },
  ],
  composition_raw: 'Amoxycillin (500mg) + Clavulanic Acid (125mg)', composition_status: 'complete',
  substitutes_raw: [], type: 'allopathy', ...over,
});

test('identityKey stable across case/suffix variants', () => {
  assert.equal(identityKey(gj()), identityKey(gj({ manufacturer: 'glaxosmithkline pharmaceuticals ltd.' })));
});

test('moleculeSetKey order-independent', () => {
  const r = gj();
  assert.equal(moleculeSetKey(r.ingredients), moleculeSetKey([...r.ingredients].reverse()));
});

test('merge unions sources, freshest precedence wins fields', () => {
  const live = gj({ source: 'onemg-live', source_id: 'x', price_inr: 250, is_discontinued: true });
  const { rows, conflicts } = mergeRows([gj(), live]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price_inr, 250);
  assert.equal(rows[0].is_discontinued, true);
  assert.equal(rows[0].sources.length, 2);
  assert.equal(conflicts.length, 0);
});

test('richer superset composition wins', () => {
  const threeMol = gj({
    source: 'onemg-live',
    ingredients: [...gj().ingredients,
      { molecule: 'lactobacillus', strength_value: null, strength_unit: null, strength_raw: null }],
  });
  const { rows } = mergeRows([gj(), threeMol]);
  assert.equal(rows[0].ingredients.length, 3);
  assert.equal(rows[0].composition_status, 'complete');
});

test('non-subset disagreement -> conflict logged, precedence kept', () => {
  const other = gj({
    source: 'kaggle-2025',
    ingredients: [{ molecule: 'azithromycin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
  });
  const { rows, conflicts } = mergeRows([gj(), other]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, 'composition_disagreement');
  assert.equal(rows[0].ingredients[0].molecule, 'azithromycin');
});

test('substitutes union dedups by name', () => {
  const a = gj({ substitutes_raw: [{ name: 'Moxikind-CV 625 Tablet', manufacturer: 'Mankind' }] });
  const b = gj({ source: 'onemg-live', substitutes_raw: [{ name: 'Moxikind-CV 625 Tablet', manufacturer: 'Mankind Pharma Ltd' }, { name: 'Clavam 625', manufacturer: 'Alkem' }] });
  const { rows } = mergeRows([a, b]);
  assert.equal(rows[0].substitutes_raw.length, 2);
});

test('strength disagreement (same molecules) is flagged, never silent', async () => {
  const { moleculeNameKey } = await import('../src/lib/merge.mjs');
  const p500 = gj({ ingredients: [{ molecule: 'paracetamol', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }] });
  const p650 = gj({ source: 'kaggle-2025', ingredients: [{ molecule: 'paracetamol', strength_value: 650, strength_unit: 'mg', strength_raw: '650mg' }] });
  const { rows, conflicts } = mergeRows([p500, p650]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, 'strength_disagreement');
  assert.equal(rows[0].ingredients[0].strength_value, 650); // precedence winner kept
  assert.equal(moleculeNameKey(p500.ingredients), 'paracetamol');
});

test('composition_raw travels with the chosen ingredients', () => {
  const truncated = gj({
    source: 'onemg-live',
    ingredients: [{ molecule: 'amoxycillin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
    composition_raw: 'Amoxycillin (500mg)',
  });
  const richer = gj({ source: 'kaggle-2025' }); // 2-molecule superset with its own raw
  const { rows } = mergeRows([truncated, richer]);
  assert.equal(rows[0].ingredients.length, 2);
  assert.equal(rows[0].composition_raw, 'Amoxycillin (500mg) + Clavulanic Acid (125mg)');
});

test('detectSubstituteMismatches flags cross-group substitute pairs only', async () => {
  const { detectSubstituteMismatches } = await import('../src/lib/merge.mjs');
  const augmentin = gj({ substitutes_raw: [{ name: 'Moxikind-CV 625 Tablet' }, { name: 'Wrongsub Tablet' }, { name: 'Unknown Brand' }] });
  const moxikind = gj({ brand_name: 'Moxikind-CV 625 Tablet', manufacturer: 'Mankind' }); // same molecules
  const wrongsub = gj({
    brand_name: 'Wrongsub Tablet', manufacturer: 'X',
    ingredients: [{ molecule: 'azithromycin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
  });
  const { rows } = mergeRows([augmentin, moxikind, wrongsub]);
  const mismatches = detectSubstituteMismatches(rows);
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].kind, 'substitute_group_mismatch');
  assert.match(mismatches[0].b.brand, /Wrongsub/);
});

test('confidence tier: single source -> single_source', () => {
  const { rows } = mergeRows([gj()]);
  assert.equal(rows[0].confidence, 'single_source');
  assert.equal(rows[0].source_count, 1);
});

test('confidence tier: two sources agreeing on molecules -> multi_source', () => {
  const live = gj({ source: 'onemg-live', source_id: 'x' });
  const { rows } = mergeRows([gj(), live]);
  assert.equal(rows[0].confidence, 'multi_source');
  assert.equal(rows[0].source_count, 2);
});

test('confidence tier: superset composition counts as agreement, not conflict', () => {
  const threeMol = gj({
    source: 'onemg-live',
    ingredients: [...gj().ingredients,
      { molecule: 'lactobacillus', strength_value: null, strength_unit: null, strength_raw: null }],
  });
  const { rows } = mergeRows([gj(), threeMol]);
  assert.equal(rows[0].confidence, 'multi_source');
});

test('confidence tier: molecule-set disagreement -> conflict', () => {
  const other = gj({
    source: 'kaggle-2025',
    ingredients: [{ molecule: 'azithromycin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
  });
  const { rows } = mergeRows([gj(), other]);
  assert.equal(rows[0].confidence, 'conflict');
  assert.equal(rows[0].source_count, 2);
});

test('first_seen/last_seen span sources', () => {
  const older = gj({ seen_at: '2026-01-01' });
  const newer = gj({ source: 'onemg-live', seen_at: '2026-07-07' });
  const { rows } = mergeRows([older, newer]);
  assert.equal(rows[0].first_seen, '2026-01-01');
  assert.equal(rows[0].last_seen, '2026-07-07');
});
