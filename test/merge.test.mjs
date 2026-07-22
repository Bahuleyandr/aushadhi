import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSubstituteMismatches, identityKey, moleculeNameKey, moleculeSetKey, mergeRows,
} from '../src/lib/merge.mjs';

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

test('exact same drug and dose coalesces across pack-label drift and duplicate source refreshes', () => {
  const base = {
    brand_name: 'Opsutan Tablet', manufacturer: 'Cipla Ltd', form_raw: 'Tablet',
    ingredients: [{ molecule: 'macitentan', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }],
    composition_raw: 'Macitentan (10mg)', composition_status: 'complete', substitutes_raw: [],
    price_inr: null, is_discontinued: null, type: null,
  };
  const inputs = [
    { ...base, source: 'onemg-live', source_id: '413182', seen_at: '2026-07-15', pack_label: 'strip of 10 tablets', price_inr: 3395 },
    { ...base, source: 'github-jr', source_id: '162082', seen_at: '2026-07-07', pack_label: 'strip of 10 tablets' },
    { ...base, source: 'onemg-live', source_id: '413182', seen_at: '2026-07-18', pack_label: '', price_inr: 3000 },
    { ...base, source: 'apollo', source_id: 'opsutan-10mg-tablet-10s', seen_at: '2026-07-18', pack_label: '', price_inr: 3100 },
  ];
  const { rows, conflicts } = mergeRows(inputs);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pack_label, 'strip of 10 tablets');
  assert.equal(rows[0].price_inr, 3395, 'blank-pack observations must not donate pack-specific price');
  assert.equal(rows[0].source_count, 3);
  assert.equal(rows[0].confidence, 'multi_source');
  assert.deepEqual(rows[0].sources.map((s) => s.source).sort(), ['apollo', 'github-jr', 'onemg-live']);
  assert.equal(rows[0].sources.find((s) => s.source === 'onemg-live').seen_at, '2026-07-18');
  assert.equal(conflicts.length, 0);
});

test('different nonblank packs remain separate and never mix pack-specific price', () => {
  const pack10 = gj({ source: 'onemg-live', source_id: 'p10', pack_label: 'strip of 10 tablets', price_inr: null });
  const pack15 = gj({ source: 'apollo', source_id: 'p15', pack_label: 'strip of 15 tablets', price_inr: 150 });
  const { rows, conflicts } = mergeRows([pack10, pack15]);
  assert.equal(rows.length, 2);
  assert.equal(conflicts.length, 0);
  const byPack = new Map(rows.map((row) => [row.pack_label, row]));
  assert.equal(byPack.get('strip of 10 tablets').price_inr, null);
  assert.equal(byPack.get('strip of 15 tablets').price_inr, 150);
});

test('blank-pack attachment requires known brand, manufacturer, and form', () => {
  for (const field of ['brand_name', 'manufacturer', 'form_raw']) {
    const overrides = { [field]: null };
    if (field === 'form_raw') overrides.brand_name = 'Ambiguous Product';
    const knownPack = gj({ source: 'onemg-live', source_id: `${field}-known`, pack_label: 'strip of 10', ...overrides });
    const blankPack = gj({ source: 'apollo', source_id: `${field}-blank`, pack_label: '', ...overrides });
    assert.equal(mergeRows([knownPack, blankPack]).rows.length, 2, `${field} must be known before attachment`);
  }
});

test('an explicit terminal dosage form in the source brand can authorize blank-pack attachment', () => {
  const ingredients = [{ molecule: 'macitentan', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }];
  const packed = gj({
    source: 'github-jr', source_id: '162082', brand_name: 'Opsutan Tablet', manufacturer: 'Cipla Ltd',
    form_raw: null, pack_label: 'strip of 10 tablets', ingredients,
  });
  const blank = gj({
    source: 'onemg-live', source_id: '413182', brand_name: 'Opsutan Tablet', manufacturer: 'Cipla Ltd',
    form_raw: 'Tablet', pack_label: '', ingredients,
  });
  const merged = mergeRows([packed, blank]).rows;
  assert.equal(merged.length, 1);
  assert.equal(merged[0].pack_label, 'strip of 10 tablets');
  assert.deepEqual(merged[0].sources.map((source) => source.source).sort(), ['github-jr', 'onemg-live']);

  const ambiguousPacked = { ...packed, source_id: 'ambiguous-packed', brand_name: 'Opsutan Product' };
  const ambiguousBlank = { ...blank, source_id: 'ambiguous-blank', brand_name: 'Opsutan Product' };
  assert.equal(mergeRows([ambiguousPacked, ambiguousBlank]).rows.length, 2);
});

test('non-finite, non-positive, and unrecognized strengths never authorize blank-pack attachment', () => {
  const cases = [
    { value: Number.NaN, unit: 'mg' },
    { value: Number.POSITIVE_INFINITY, unit: 'mg' },
    { value: Number.NEGATIVE_INFINITY, unit: 'mg' },
    { value: 0, unit: 'mg' },
    { value: -10, unit: 'mg' },
    { value: 10, unit: 'bananas' },
  ];
  for (const { value, unit } of cases) {
    const ingredients = [{ molecule: 'examplemol', strength_value: value, strength_unit: unit, strength_raw: `${value}${unit}` }];
    const token = `${value}-${unit}`;
    const knownPack = gj({ source: 'onemg-live', source_id: `known-${token}`, form_raw: 'Tablet', pack_label: 'strip of 10', ingredients });
    const blankPack = gj({ source: 'apollo', source_id: `blank-${token}`, form_raw: 'Tablet', pack_label: '', ingredients });
    assert.equal(mergeRows([knownPack, blankPack]).rows.length, 2, `${value} ${unit} must remain unresolved`);
  }
});

test('exact duplicate coalescer preserves true strength, form, manufacturer, and unknown-composition distinctions', () => {
  const base = {
    source: 'github-jr', source_id: 'x', seen_at: '2026-07-18',
    brand_name: 'Example Tablet', manufacturer: 'Example Labs', form_raw: 'Tablet', pack_label: 'strip of 10',
    ingredients: [{ molecule: 'examplemol', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }],
    composition_raw: 'Examplemol (10mg)', composition_status: 'complete', substitutes_raw: [],
  };
  const rows = [
    base,
    { ...base, source: 'apollo', source_id: 'strength', pack_label: '', ingredients: [{ ...base.ingredients[0], strength_value: 20, strength_raw: '20mg' }] },
    { ...base, source: 'apollo', source_id: 'form', pack_label: '', form_raw: 'Injection' },
    { ...base, source: 'apollo', source_id: 'manufacturer', pack_label: '', manufacturer: 'Other Labs' },
    { ...base, source: 'apollo', source_id: 'missing', pack_label: '', ingredients: [], composition_status: 'missing' },
  ];
  assert.equal(mergeRows(rows).rows.length, 5);
});

test('subset and superset compositions remain separate without explicit truncation evidence', () => {
  const threeMol = gj({
    source: 'onemg-live',
    ingredients: [...gj().ingredients,
      { molecule: 'lactobacillus', strength_value: null, strength_unit: null, strength_raw: null }],
  });
  const { rows, conflicts } = mergeRows([gj(), threeMol]);
  assert.equal(rows.length, 2);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, 'composition_disagreement');
  assert.deepEqual(rows.map((row) => row.ingredients.length).sort(), [2, 3]);
});

test('a truncated subset cannot bridge two incompatible richer compositions', () => {
  const base = gj({ ingredients: [{ molecule: 'amoxycillin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }] });
  const clav = gj({ source: 'onemg-live', ingredients: [
    ...base.ingredients,
    { molecule: 'clavulanic acid', strength_value: 125, strength_unit: 'mg', strength_raw: '125mg' },
  ] });
  const azith = gj({ source: 'kaggle-2025', ingredients: [
    ...base.ingredients,
    { molecule: 'azithromycin', strength_value: 250, strength_unit: 'mg', strength_raw: '250mg' },
  ] });
  const { rows, conflicts } = mergeRows([base, clav, azith]);
  assert.equal(rows.length, 3);
  assert.ok(conflicts.length >= 1);
  assert.deepEqual(rows.map((row) => moleculeNameKey(row.ingredients)).sort(), [
    'amoxycillin', 'amoxycillin|azithromycin', 'amoxycillin|clavulanic acid',
  ]);
});

test('non-subset disagreement -> separate rows and conflict logged', () => {
  const other = gj({
    source: 'kaggle-2025',
    ingredients: [{ molecule: 'azithromycin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
  });
  const { rows, conflicts } = mergeRows([gj(), other]);
  assert.equal(rows.length, 2);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, 'composition_disagreement');
  assert.deepEqual(rows.map((row) => row.ingredients[0].molecule).sort(), ['amoxycillin', 'azithromycin']);
  assert.ok(rows.every((row) => row.confidence === 'conflict'));
});

test('substitutes union dedups by name', () => {
  const a = gj({ substitutes_raw: [{ name: 'Moxikind-CV 625 Tablet', manufacturer: 'Mankind' }] });
  const b = gj({ source: 'onemg-live', substitutes_raw: [{ name: 'Moxikind-CV 625 Tablet', manufacturer: 'Mankind Pharma Ltd' }, { name: 'Clavam 625', manufacturer: 'Alkem' }] });
  const { rows } = mergeRows([a, b]);
  assert.equal(rows[0].substitutes_raw.length, 2);
});

test('strength disagreement (same molecules) is flagged and variants remain separate', async () => {
  const { moleculeNameKey } = await import('../src/lib/merge.mjs');
  const p500 = gj({ ingredients: [{ molecule: 'paracetamol', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }] });
  const p650 = gj({ source: 'kaggle-2025', ingredients: [{ molecule: 'paracetamol', strength_value: 650, strength_unit: 'mg', strength_raw: '650mg' }] });
  const { rows, conflicts } = mergeRows([p500, p650]);
  assert.equal(rows.length, 2);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, 'strength_disagreement');
  assert.deepEqual(rows.map((row) => row.ingredients[0].strength_value).sort((a, b) => a - b), [500, 650]);
  assert.equal(moleculeNameKey(p500.ingredients), 'paracetamol');
});

test('composition_raw remains attached to its own unmerged ingredient set', () => {
  const truncated = gj({
    source: 'onemg-live',
    ingredients: [{ molecule: 'amoxycillin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
    composition_raw: 'Amoxycillin (500mg)',
  });
  const richer = gj({ source: 'kaggle-2025' });
  const { rows } = mergeRows([truncated, richer]);
  assert.equal(rows.length, 2);
  const rawByCount = new Map(rows.map((row) => [row.ingredients.length, row.composition_raw]));
  assert.equal(rawByCount.get(1), 'Amoxycillin (500mg)');
  assert.equal(rawByCount.get(2), 'Amoxycillin (500mg) + Clavulanic Acid (125mg)');
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

test('confidence tier: subset composition is a conflict without explicit truncation evidence', () => {
  const threeMol = gj({
    source: 'onemg-live',
    ingredients: [...gj().ingredients,
      { molecule: 'lactobacillus', strength_value: null, strength_unit: null, strength_raw: null }],
  });
  const { rows, conflicts } = mergeRows([gj(), threeMol]);
  assert.equal(rows.length, 2);
  assert.equal(conflicts.length, 1);
  assert.ok(rows.every((row) => row.confidence === 'conflict'));
});

test('confidence tier: molecule-set disagreement -> separate conflict rows', () => {
  const other = gj({
    source: 'kaggle-2025',
    ingredients: [{ molecule: 'azithromycin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
  });
  const { rows } = mergeRows([gj(), other]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.confidence === 'conflict'));
});

test('conflict flag follows the affected composition across pack-label coalescence', () => {
  const base = {
    brand_name: 'Pack Drift Tablet', manufacturer: 'Example Labs', form_raw: 'Tablet',
    composition_raw: null, composition_status: 'complete', substitutes_raw: [],
  };
  const ten = [{ molecule: 'examplemol', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }];
  const twenty = [{ molecule: 'examplemol', strength_value: 20, strength_unit: 'mg', strength_raw: '20mg' }];
  const { rows, conflicts } = mergeRows([
    { ...base, source: 'onemg-live', source_id: 'a', seen_at: '2026-07-18', pack_label: 'strip A', ingredients: ten },
    { ...base, source: 'github-jr', source_id: 'b', seen_at: '2026-07-18', pack_label: 'strip B', ingredients: ten },
    { ...base, source: 'apollo', source_id: 'c', seen_at: '2026-07-18', pack_label: 'strip C', ingredients: twenty },
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.confidence === 'conflict'));
  assert.deepEqual(new Set(conflicts[0].affected_identity_keys), new Set([
    'pack drift tablet|example|strip a',
    'pack drift tablet|example|strip b',
    'pack drift tablet|example|strip c',
  ]));
});

test('strength disagreement across different pack labels is still a conflict', () => {
  const base = {
    brand_name: 'Cross Pack Tablet', manufacturer: 'Example Labs', form_raw: 'Tablet',
    composition_raw: null, composition_status: 'complete', substitutes_raw: [],
  };
  const { rows, conflicts } = mergeRows([
    { ...base, source: 'onemg-live', source_id: 'a', seen_at: '2026-07-18', pack_label: 'strip A',
      ingredients: [{ molecule: 'examplemol', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }] },
    { ...base, source: 'apollo', source_id: 'b', seen_at: '2026-07-18', pack_label: 'strip B',
      ingredients: [{ molecule: 'examplemol', strength_value: 20, strength_unit: 'mg', strength_raw: '20mg' }] },
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, 'strength_disagreement');
  assert.ok(rows.every((row) => row.confidence === 'conflict'));
});

test('first_seen/last_seen span sources', () => {
  const older = gj({ seen_at: '2026-01-01' });
  const newer = gj({ source: 'onemg-live', seen_at: '2026-07-07' });
  const { rows } = mergeRows([older, newer]);
  assert.equal(rows[0].first_seen, '2026-01-01');
  assert.equal(rows[0].last_seen, '2026-07-07');
});

test('first_seen survives deduplication of refreshed observations from the same source ID', () => {
  const older = gj({ source: 'onemg-live', source_id: 'same', seen_at: '2026-01-01' });
  const newer = gj({ source: 'onemg-live', source_id: 'same', seen_at: '2026-07-18' });
  const { rows } = mergeRows([older, newer]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sources.length, 1);
  assert.equal(rows[0].sources[0].seen_at, '2026-07-18');
  assert.equal(rows[0].first_seen, '2026-01-01');
  assert.equal(rows[0].last_seen, '2026-07-18');
});

test('unresolved strengths never act as equality or subset wildcards', () => {
  const unknown10 = gj({
    source: 'onemg-live', source_id: 'u10',
    ingredients: [{ molecule: 'examplemol', strength_value: null, strength_unit: null, strength_raw: '10mg unparsed' }],
    composition_raw: 'Examplemol 10mg unparsed',
  });
  const unknown20 = gj({
    source: 'apollo', source_id: 'u20',
    ingredients: [{ molecule: 'examplemol', strength_value: null, strength_unit: null, strength_raw: '20mg unparsed' }],
    composition_raw: 'Examplemol 20mg unparsed',
  });
  const knownPlusUnknown = gj({
    source: 'pharmeasy', source_id: 'combo',
    ingredients: [
      { molecule: 'amoxycillin', strength_value: null, strength_unit: null, strength_raw: null },
      { molecule: 'clavulanic acid', strength_value: 125, strength_unit: 'mg', strength_raw: '125mg' },
    ],
  });
  const unresolved = mergeRows([unknown10, unknown20]);
  assert.equal(unresolved.rows.length, 2);
  assert.equal(unresolved.conflicts.length, 1);
  const mixed = mergeRows([gj(), knownPlusUnknown]);
  assert.equal(mixed.rows.length, 2);
  assert.equal(mixed.conflicts.length, 1);
});

test('conflicts retain source IDs, observation dates, and pack labels', () => {
  const a = gj({ source: 'onemg-live', source_id: 'a10', seen_at: '2026-01-01', pack_label: 'strip A' });
  const b = gj({ source: 'apollo', source_id: 'b20', seen_at: '2026-07-18', pack_label: 'strip B',
    ingredients: [{ molecule: 'amoxycillin', strength_value: 650, strength_unit: 'mg', strength_raw: '650mg' }] });
  const { conflicts } = mergeRows([a, b]);
  assert.equal(conflicts.length, 1);
  assert.deepEqual(
    [conflicts[0].a, conflicts[0].b].map((side) => [side.source_id, side.seen_at, side.pack_label]).sort(),
    [['a10', '2026-01-01', 'strip A'], ['b20', '2026-07-18', 'strip B']],
  );
});

test('composition conflicts retain every observation on both sides', () => {
  const ten = [{ molecule: 'amoxycillin', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }];
  const twenty = [{ molecule: 'amoxycillin', strength_value: 20, strength_unit: 'mg', strength_raw: '20mg' }];
  const rows = [
    gj({ source: 'onemg-live', source_id: 'ten-a', seen_at: '2026-01-01', pack_label: 'pack A', ingredients: ten }),
    gj({ source: 'github-jr', source_id: 'ten-b', seen_at: '2026-02-01', pack_label: 'pack B', ingredients: ten }),
    gj({ source: 'apollo', source_id: 'twenty-c', seen_at: '2026-03-01', pack_label: 'pack C', ingredients: twenty }),
    gj({ source: 'pharmeasy', source_id: 'twenty-d', seen_at: '2026-04-01', pack_label: 'pack D', ingredients: twenty }),
  ];
  const { conflicts } = mergeRows(rows);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].affected_identity_keys.length, 4);
  const evidence = [...conflicts[0].a.evidence, ...conflicts[0].b.evidence];
  assert.deepEqual(evidence.map((item) => item.source_id).sort(), ['ten-a', 'ten-b', 'twenty-c', 'twenty-d']);
  assert.deepEqual(evidence.map((item) => item.pack_label).sort(), ['pack A', 'pack B', 'pack C', 'pack D']);
});

test('substitute mismatch retains both identities and complete provenance', () => {
  const alpha = gj({
    source: 'onemg-live', source_id: 'alpha-1', seen_at: '2026-01-01',
    brand_name: 'Alpha Tablet', manufacturer: 'Alpha Labs', form_raw: 'Tablet', pack_label: 'pack A',
    ingredients: [{ molecule: 'x', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }],
    substitutes_raw: [{ name: 'Beta Tablet' }],
  });
  const beta = gj({
    source: 'apollo', source_id: 'beta-1', seen_at: '2026-02-01',
    brand_name: 'Beta Tablet', manufacturer: 'Beta Labs', form_raw: 'Tablet', pack_label: 'pack B',
    ingredients: [{ molecule: 'y', strength_value: 20, strength_unit: 'mg', strength_raw: '20mg' }],
  });
  const conflicts = detectSubstituteMismatches([alpha, beta]);
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].affected_identity_keys.sort(), [identityKey(alpha), identityKey(beta)].sort());
  const evidence = [...conflicts[0].a.evidence, ...conflicts[0].b.evidence];
  assert.deepEqual(evidence.map((item) => item.source_id).sort(), ['alpha-1', 'beta-1']);
  assert.deepEqual(evidence.map((item) => item.seen_at).sort(), ['2026-01-01', '2026-02-01']);
});

test('ambiguous multi-variant substitute target is explicit and order-independent', () => {
  const alpha = gj({
    brand_name: 'Alpha Tablet', manufacturer: 'Alpha Labs', form_raw: 'Tablet', pack_label: 'pack A',
    substitutes_raw: [{ name: 'Beta Tablet' }],
  });
  const beta10 = gj({
    source_id: 'beta-10', brand_name: 'Beta Tablet', manufacturer: 'Beta Labs', form_raw: 'Tablet', pack_label: 'same pack',
    ingredients: [{ molecule: 'x', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }],
  });
  const beta20 = gj({
    source_id: 'beta-20', brand_name: 'Beta Tablet', manufacturer: 'Beta Labs', form_raw: 'Tablet', pack_label: 'same pack',
    ingredients: [{ molecule: 'y', strength_value: 20, strength_unit: 'mg', strength_raw: '20mg' }],
  });
  for (const candidates of [[alpha, beta10, beta20], [alpha, beta20, beta10]]) {
    const conflicts = detectSubstituteMismatches(candidates);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].kind, 'substitute_target_ambiguous');
    assert.equal(conflicts[0].affected_identity_keys.length, 2, 'queue keys coalesce same-pack composition variants');
    assert.equal(conflicts[0].affected_entity_keys.length, 3, 'audit keys retain both composition entities');
    assert.deepEqual(conflicts[0].b.evidence.map((item) => item.source_id).sort(), ['beta-10', 'beta-20']);
  }
});
