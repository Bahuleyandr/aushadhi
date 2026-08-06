import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { brandCore, normForm, sigOf, packNum, buildPrescribable, main } from '../src/cli/prescribable.mjs';
import { buildStrengthModel } from '../src/lib/plausibility.mjs';

test('brandCore strips pack/unit/form tokens so cross-source variants collapse', () => {
  assert.equal(brandCore('Almont LC 5mg/10mg Tablet'), brandCore('Almont Lc Strip Of 10 Tablets'));
  assert.equal(brandCore('Almont LC 5mg/10mg Tablet'), 'almontlc');
  assert.notEqual(brandCore('Clavix Tablet'), brandCore('Clavix Gold Tablet')); // distinct products stay distinct
});

test('normForm derives dosage form and ignores release-type form_raw', () => {
  assert.equal(normForm('Foo Injection', null, 'vial of 1 injection'), 'Injection');
  assert.equal(normForm('Foo Syrup', null, null), 'Oral Liquid');
  assert.equal(normForm('Foo Tablet', 'Immediate Release', null), 'Tablet'); // release-type ignored -> brand
  assert.equal(normForm('Foo', null, null), 'Other');
});

test('packNum extracts the leading integer', () => {
  assert.equal(packNum('strip of 10 tablets'), 10);
  assert.equal(packNum('10 Tablet(s) in Strip'), 10);
  assert.equal(packNum(null), null);
});

test('sigOf lowercases, rounds, sorts, and represents null strengths', () => {
  assert.deepEqual(
    sigOf([{ molecule: 'B', strength_value: 10, strength_unit: 'MG' }, { molecule: 'a', strength_value: null, strength_unit: null }]),
    [['a', null, ''], ['b', 10, 'mg']],
  );
});

// ---------- integration scenarios ----------
const bulk = (m, v, u, n) => Array.from({ length: n }, () => ({ ingredients: [{ molecule: m, strength_value: v, strength_unit: u }] }));
const drug = (over) => ({
  brand_name: 'X', manufacturer: 'M', form_raw: null, pack_label: 'strip of 10 tablets',
  price_inr: null, is_discontinued: false, type: 'allopathy', atc_codes: [],
  first_seen: '2026-07-01', last_seen: '2026-07-01', ingredients: [],
  sources: [{ source: 'github-jr', source_id: '1', seen_at: '2026-07-01' }], ...over,
});

test('buildPrescribable resolves a cross-source swap by pharmacology, not source-trust', () => {
  const dist = [...bulk('levocetirizine', 5, 'mg', 800), ...bulk('levocetirizine', 10, 'mg', 20),
    ...bulk('montelukast', 10, 'mg', 700), ...bulk('montelukast', 5, 'mg', 15)];
  const drugs = [
    drug({ brand_name: 'Zed LC 5mg/10mg Tablet', sources: [{ source: 'github-jr', source_id: 'g', seen_at: '2026-07-01' }],
      ingredients: [{ molecule: 'levocetirizine', strength_value: 5, strength_unit: 'mg', strength_raw: '5mg' },
        { molecule: 'montelukast', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }] }),
    drug({ brand_name: 'Zed Lc Strip Of 10 Tablets', sources: [{ source: 'pharmeasy', source_id: 'p', seen_at: '2026-07-01' }],
      ingredients: [{ molecule: 'levocetirizine', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' },
        { molecule: 'montelukast', strength_value: 5, strength_unit: 'mg', strength_raw: '5mg' }] }),
  ];
  const model = buildStrengthModel([...dist, ...drugs]);
  const { records } = buildPrescribable(drugs, model);
  assert.equal(records.length, 1, 'swap siblings collapse to one medicine');
  const r = records[0];
  assert.equal(r.strength_status, 'resolved_by_plausibility');
  assert.equal(r.strength_verified, true);
  assert.deepEqual(r.molecules.map((m) => [m.molecule, m.strength_value]), [['levocetirizine', 5], ['montelukast', 10]]);
  assert.equal(r.source_count, 2);
  assert.equal(r.pack_count, 2);
});

test('buildPrescribable suppresses an unverifiable single-source combo (option B)', () => {
  const dist = [...bulk('p', 5, 'mg', 500), ...bulk('p', 10, 'mg', 500), ...bulk('q', 5, 'mg', 500), ...bulk('q', 10, 'mg', 500)];
  const drugs = [drug({ brand_name: 'Ambi PQ Tablet',
    ingredients: [{ molecule: 'p', strength_value: 5, strength_unit: 'mg', strength_raw: '5mg' },
      { molecule: 'q', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }] })];
  const model = buildStrengthModel([...dist, ...drugs]);
  const r = buildPrescribable(drugs, model).records[0];
  assert.equal(r.strength_status, 'unverified');
  assert.equal(r.strength_verified, false);
  assert.ok(r.molecules.every((m) => m.strength_value === null), 'strengths suppressed');
  assert.match(r.strength_note, /confirm before clinical use/);
});

test('buildPrescribable verifies a distinct-range single-source combo (keeps strengths)', () => {
  const dist = [...bulk('a', 500, 'mg', 500), ...bulk('b', 125, 'mg', 500)];
  const drugs = [drug({ brand_name: 'Sharp AB Tablet',
    ingredients: [{ molecule: 'a', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' },
      { molecule: 'b', strength_value: 125, strength_unit: 'mg', strength_raw: '125mg' }] })];
  const model = buildStrengthModel([...dist, ...drugs]);
  const r = buildPrescribable(drugs, model).records[0];
  assert.equal(r.strength_status, 'verified');
  assert.ok(r.molecules.every((m) => m.strength_value !== null), 'strengths kept');
});

test('buildPrescribable keeps empty-molecule records as no_strength (not dropped)', () => {
  const drugs = [drug({ brand_name: 'Deviceish Kit', ingredients: [] })];
  const model = buildStrengthModel(drugs);
  const { records } = buildPrescribable(drugs, model);
  assert.equal(records.length, 1);
  assert.equal(records[0].strength_status, 'no_strength');
  assert.equal(records[0].strength_verified, false);
});

test('buildPrescribable: same-formulation brands become mutual substitutes; SR/unverified excluded', () => {
  const dist = [...bulk('metformin', 500, 'mg', 1000), ...bulk('p', 5, 'mg', 400), ...bulk('p', 10, 'mg', 400),
    ...bulk('q', 5, 'mg', 400), ...bulk('q', 10, 'mg', 400)];
  const met = (bn) => drug({ brand_name: bn, ingredients: [{ molecule: 'metformin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }] });
  const drugs = [
    met('Glyciphage 500 Tablet'), met('Gluconorm 500 Tablet'),        // two IR brands, same formulation
    met('Glycomet SR 500 Tablet'),                                     // SR -> distinct formulation
    drug({ brand_name: 'Ambi PQ Tablet',                              // unverified single-source combo
      ingredients: [{ molecule: 'p', strength_value: 5, strength_unit: 'mg', strength_raw: '5mg' },
        { molecule: 'q', strength_value: 10, strength_unit: 'mg', strength_raw: '10mg' }] }),
  ];
  const model = buildStrengthModel([...dist, ...drugs]);
  const { records, groupRows } = buildPrescribable(drugs, model);
  const ir1 = records.find((r) => /glyci/i.test(r.display_name));
  const ir2 = records.find((r) => /gluconorm/i.test(r.display_name));
  const sr = records.find((r) => /glycomet/i.test(r.display_name));
  const unv = records.find((r) => /ambi/i.test(r.display_name));
  assert.equal(ir1.release_profile, 'IR');
  assert.equal(sr.release_profile, 'SR');
  // two IR brands are mutual substitutes
  assert.equal(ir1.formulation_key, ir2.formulation_key);
  assert.equal(ir1.substitute_count, 1);
  // SR is NEVER an IR substitute
  assert.notEqual(sr.formulation_key, ir1.formulation_key);
  assert.equal(sr.substitute_count, 0);
  // unverified (suppressed strengths) gets no substitution key
  assert.equal(unv.strength_status, 'unverified');
  assert.equal(unv.formulation_key, null);
  assert.equal(unv.substitute_count, 0);
  // formulation group export lists both IR members
  const g = groupRows.find((x) => x.formulation_key === ir1.formulation_key);
  assert.equal(g.member_count, 2);
  assert.deepEqual(g.member_med_ids, [ir1.med_id, ir2.med_id].sort());
});

test('prescribable CLI writes into the selected cohort and removes absent optional outputs', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-prescribable-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = drug({ brand_name: 'Deviceish Kit', ingredients: [] });
  fs.writeFileSync(path.join(dir, 'drugs.jsonl'), `${JSON.stringify(input)}\n`);
  fs.writeFileSync(path.join(dir, 'strength-review-shortlist.csv'), 'stale\n');
  fs.writeFileSync(path.join(dir, 'strength-conflicts.csv'), 'stale\n');

  await main(() => {}, { outputDir: dir });

  const records = fs.readFileSync(path.join(dir, 'prescribable.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.length, 1);
  assert.equal(records[0].strength_status, 'no_strength');
  assert.ok(fs.existsSync(path.join(dir, 'formulation_groups.jsonl')));
  assert.equal(fs.existsSync(path.join(dir, 'strength-review-shortlist.csv')), false);
  assert.equal(fs.existsSync(path.join(dir, 'strength-conflicts.csv')), false);
});

test('prescribable CLI refuses to mutate a manifest-bound cohort', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-prescribable-published-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'cohort-manifest.json'), '{"schema_version":1}\n');
  await assert.rejects(main(() => {}, { outputDir: dir }), /manifest-bound cohort.*immutable/i);
});

test('prescribable CLI refuses an implicit dist/date mutable destination', async () => {
  await assert.rejects(
    main(() => {}),
    /AUSHADHI_COHORT_DIR.*required/i,
  );
});
