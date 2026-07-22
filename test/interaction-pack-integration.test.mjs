// Integration acceptance tests: run the ACTUAL draft pack + member sets through the
// engine so the JSONL, the engine, and the human-readable review packet cannot drift
// apart. Requested by the Section-A clinician review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkInteractions } from '../src/lib/interaction-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.join(ROOT, 'docs', 'interaction-review', 'batch-01-v2', 'batch-01-v2.jsonl');
const MEMBERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data-static', 'interaction-member-sets.json'), 'utf8')).classes;
const RULES = fs.readFileSync(PACK, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

function fire(subjects, patientContext = {}) {
  return checkInteractions({ subjects, rules: RULES, memberSets: MEMBERS, patientContext }).findings;
}
const has = (findings, ruleId) => findings.some((f) => f.rule_id === ruleId);
const one = (findings, ruleId) => findings.filter((f) => f.rule_id === ruleId);
const TRIPLE = 'dual_antiplatelet__oral_anticoagulant_triple_therapy';

// ── member sets actually exist in the tested build ──
test('p2y12_inhibitor and oral_anticoagulant member sets exist in the build', () => {
  assert.ok(MEMBERS.p2y12_inhibitor, 'p2y12_inhibitor member set missing');
  assert.ok(MEMBERS.oral_anticoagulant, 'oral_anticoagulant member set missing');
});

// ── triple-therapy acceptance matrix ──
test('triple therapy fires once for three distinct antithrombotics', () => {
  assert.equal(one(fire(['aspirin', 'clopidogrel', 'warfarin']), TRIPLE).length, 1);
  assert.equal(one(fire(['aspirin', 'ticagrelor', 'apixaban']), TRIPLE).length, 1);
});
test('triple therapy does NOT fire on any 2-of-3 subset', () => {
  assert.ok(!has(fire(['aspirin', 'clopidogrel']), TRIPLE));
  assert.ok(!has(fire(['aspirin', 'warfarin']), TRIPLE));
  assert.ok(!has(fire(['clopidogrel', 'warfarin']), TRIPLE));
});
test('triple therapy needs three DISTINCT agents — one drug cannot fill two slots', () => {
  assert.ok(!has(fire(['aspirin', 'apixaban']), TRIPLE)); // no P2Y12 present
});
test('with a 4th drug (NSAID), the triple rule and the distinct NSAID bleeding rule both surface', () => {
  const f = fire(['aspirin', 'clopidogrel', 'warfarin', 'ibuprofen']);
  assert.ok(has(f, TRIPLE));
  assert.ok(has(f, 'warfarin__nsaid_systemic')); // clinically distinct bleeding rule co-surfaces
});

// ── dabigatran indication × inhibitor × CrCl matrix ──
const NVAF = { indication: 'non_valvular_atrial_fibrillation' };
test('dabigatran NVAF + ketoconazole: CrCl 30-50 reduces, <30 avoids, unknown is restrictive but not contraindicated', () => {
  const r40 = one(fire(['dabigatran', 'ketoconazole'], { ...NVAF, renal: { crcl: 40 } }), 'dabigatran_nvaf__dronedarone_or_ketoconazole')[0];
  assert.equal(r40.severity, 'major');
  assert.match(r40.management.prescriber_action, /75 mg/);
  const r20 = one(fire(['dabigatran', 'ketoconazole'], { ...NVAF, renal: { crcl: 20 } }), 'dabigatran_nvaf__dronedarone_or_ketoconazole')[0];
  assert.equal(r20.severity, 'contraindicated');
  assert.equal(r20.dispense_action, 'withhold_and_clarify');
  const rUnknown = one(fire(['dabigatran', 'ketoconazole'], NVAF), 'dabigatran_nvaf__dronedarone_or_ketoconazole')[0];
  assert.equal(rUnknown.severity, 'moderate'); // clinical severity NOT falsified by missing data
  assert.equal(rUnknown.dispense_action, 'withhold_and_clarify'); // operationally restrictive
  assert.equal(rUnknown.data_required[0].metric, 'CrCl');
});
test('dabigatran NVAF + verapamil: no-dose-adjustment rule only (verapamil not in the reduce rule)', () => {
  const f = fire(['dabigatran', 'verapamil'], NVAF);
  assert.ok(has(f, 'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor'));
  assert.ok(!has(f, 'dabigatran_nvaf__dronedarone_or_ketoconazole'));
});
test('dabigatran VTE + ketoconazole at CrCl 40 avoids (crcl<50), and NVAF rules do not fire for VTE', () => {
  const f = fire(['dabigatran', 'ketoconazole'], { indication: 'venous_thromboembolism_treatment', renal: { crcl: 40 } });
  assert.ok(has(f, 'dabigatran_vte__pgp_inhibitor'));
  assert.equal(one(f, 'dabigatran_vte__pgp_inhibitor')[0].severity, 'contraindicated');
  assert.ok(!has(f, 'dabigatran_nvaf__dronedarone_or_ketoconazole'));
});

// ── clarithromycin exceptions ──
test('apixaban: clarithromycin is exempt (no reduce/avoid), ketoconazole is not', () => {
  assert.ok(!has(fire(['apixaban', 'clarithromycin']), 'apixaban__strong_cyp3a4_pgp_inhibitor'));
  assert.ok(has(fire(['apixaban', 'ketoconazole']), 'apixaban__strong_cyp3a4_pgp_inhibitor'));
});
test('rivaroxaban: clarithromycin is exempt (US: no precautions), ketoconazole avoids', () => {
  assert.ok(!has(fire(['rivaroxaban', 'clarithromycin']), 'rivaroxaban__strong_cyp3a4_pgp_inhibitor'));
  assert.ok(has(fire(['rivaroxaban', 'ketoconazole']), 'rivaroxaban__strong_cyp3a4_pgp_inhibitor'));
});
test('rivaroxaban + ketoconazole becomes contraindicated at confirmed Child-Pugh C', () => {
  const f = one(fire(['rivaroxaban', 'ketoconazole'], { hepatic: { child_pugh: 'C' } }), 'rivaroxaban__strong_cyp3a4_pgp_inhibitor')[0];
  assert.equal(f.severity, 'contraindicated');
});

// ── clopidogrel PPI substitution action ──
test('clopidogrel + omeprazole withholds/substitutes the PPI and does not interrupt clopidogrel', () => {
  const f = one(fire(['clopidogrel', 'omeprazole']), 'clopidogrel__cyp2c19_inhibiting_ppi')[0];
  assert.equal(f.dispense_action, 'withhold_and_clarify');
  assert.equal(f.action_target, 'newly_added_perpetrator');
  assert.deepEqual(f.do_not_interrupt, ['object_drug']);
});
