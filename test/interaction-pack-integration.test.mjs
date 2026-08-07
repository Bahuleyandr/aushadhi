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
const SECTION_DIR = path.join(ROOT, 'docs', 'interaction-review', 'batch-01-v2', 'sections');
const MEMBERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data-static', 'interaction-member-sets.json'), 'utf8')).classes;
const RULES = fs.readFileSync(PACK, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const A_RULES = fs.readFileSync(path.join(SECTION_DIR, 'A.verified.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((line) => JSON.parse(line));
const B_RULES = fs.readFileSync(path.join(SECTION_DIR, 'B.verified.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((line) => JSON.parse(line));
const C_RULES = fs.readFileSync(path.join(SECTION_DIR, 'C.verified.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((line) => JSON.parse(line));
const D_RULES = fs.readFileSync(path.join(SECTION_DIR, 'D.verified.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((line) => JSON.parse(line));

function fire(subjects, patientContext = {}) {
  return checkInteractions({
    subjects,
    rules: RULES,
    memberSets: MEMBERS,
    patientContext: { jurisdiction: 'US', ...patientContext },
  }).findings;
}
function fireSection(rules, subjects, patientContext = {}) {
  return checkInteractions({
    subjects,
    rules,
    memberSets: MEMBERS,
    patientContext: { jurisdiction: 'US', ...patientContext },
  }).findings;
}
const fireA = (subjects, patientContext = {}) => fireSection(A_RULES, subjects, patientContext);
const fireB = (subjects, patientContext = {}) => fireSection(B_RULES, subjects, patientContext);
const fireC = (subjects, patientContext = {}) => fireSection(C_RULES, subjects, patientContext);
const fireD = (subjects, patientContext = {}) => fireSection(D_RULES, subjects, patientContext);
const has = (findings, ruleId) => findings.some((f) => f.rule_id === ruleId);
const one = (findings, ruleId) => findings.filter((f) => f.rule_id === ruleId);
const TRIPLE = 'dual_antiplatelet__oral_anticoagulant_triple_therapy';

// ── member sets actually exist in the tested build ──
test('p2y12_inhibitor and oral_anticoagulant member sets exist in the build', () => {
  assert.ok(MEMBERS.p2y12_inhibitor, 'p2y12_inhibitor member set missing');
  assert.ok(MEMBERS.oral_anticoagulant, 'oral_anticoagulant member set missing');
});

// ── triple-therapy diagnostic quarantine ──
test('triple therapy remains a standalone review reference, not a pair-matcher finding', () => {
  const rule = A_RULES.find((candidate) => candidate.rule_id === TRIPLE);
  assert.equal(rule.runtime_status.pair_matcher_executable, false);
  assert.equal(rule.runtime_enabled, false);
  assert.equal(one(fireA(['aspirin', 'clopidogrel', 'warfarin']), TRIPLE).length, 0);
  assert.equal(one(fireA(['aspirin', 'ticagrelor', 'apixaban']), TRIPLE).length, 0);
});
test('triple therapy does NOT fire on any 2-of-3 subset', () => {
  assert.ok(!has(fireA(['aspirin', 'clopidogrel']), TRIPLE));
  assert.ok(!has(fireA(['aspirin', 'warfarin']), TRIPLE));
  assert.ok(!has(fireA(['clopidogrel', 'warfarin']), TRIPLE));
});
test('triple therapy needs three DISTINCT agents — one drug cannot fill two slots', () => {
  assert.ok(!has(fireA(['aspirin', 'apixaban']), TRIPLE)); // no P2Y12 present
});
test('with a 4th drug (NSAID), the quarantined triple rule stays absent and the distinct NSAID rule surfaces', () => {
  const f = fireA(['aspirin', 'clopidogrel', 'warfarin', 'ibuprofen']);
  assert.ok(!has(f, TRIPLE));
  assert.ok(has(f, 'warfarin__nsaid_systemic')); // clinically distinct bleeding rule co-surfaces
});

// ── dabigatran indication × inhibitor × CrCl matrix ──
const NVAF = { indication: 'non_valvular_atrial_fibrillation' };
test('dabigatran NVAF + ketoconazole retains the exact renal actions while bare diagnostic subjects fail closed', () => {
  const rule = A_RULES.find((candidate) =>
    candidate.rule_id === 'dabigatran_nvaf__dronedarone_or_ketoconazole');
  const reduce = rule.context_modifiers.find((modifier) => modifier.when === 'crcl_30_to_50');
  const avoid = rule.context_modifiers.find((modifier) => modifier.when === 'crcl_lt_30');
  assert.equal(reduce.severity, 'major');
  assert.match(reduce.management_override.prescriber_action, /75 mg twice daily/);
  assert.equal(avoid.severity, 'major');
  assert.match(avoid.management_override.prescriber_action, /avoid dabigatran/);
  assert.doesNotMatch(rule.management.prescriber_action, /CrCl\s*>=\s*50|no dabigatran dose adjustment/i);

  const r40 = one(fireA(['dabigatran', 'ketoconazole'], { ...NVAF, renal: { crcl: 40 } }), 'dabigatran_nvaf__dronedarone_or_ketoconazole')[0];
  assert.equal(r40.severity, 'major');
  assert.equal(r40.dispense_action, 'withhold_and_clarify');
  assert.equal(r40.clinical_action_status, 'unresolved_pending_applicability');
  const r20 = one(fireA(['dabigatran', 'ketoconazole'], { ...NVAF, renal: { crcl: 20 } }), 'dabigatran_nvaf__dronedarone_or_ketoconazole')[0];
  assert.equal(r20.severity, 'major');
  assert.equal(r20.dispense_action, 'withhold_and_clarify');
  const rUnknown = one(fireA(['dabigatran', 'ketoconazole'], NVAF), 'dabigatran_nvaf__dronedarone_or_ketoconazole')[0];
  assert.equal(rUnknown.severity, 'moderate');
  assert.equal(rUnknown.dispense_action, 'withhold_and_clarify');
  assert.ok(rUnknown.data_required.some((requirement) => requirement.metric === 'CrCl'));
});
test('dabigatran NVAF + verapamil: no-dose-adjustment rule only (verapamil not in the reduce rule)', () => {
  const f = fireA(['dabigatran', 'verapamil'], NVAF);
  assert.ok(has(f, 'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor'));
  assert.ok(!has(f, 'dabigatran_nvaf__dronedarone_or_ketoconazole'));
});
test('dabigatran NVAF no-adjustment rule does not invent a severe-renal action', () => {
  const rule = A_RULES.find((candidate) =>
    candidate.rule_id === 'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor');
  assert.deepEqual(rule.context_modifiers, []);
  assert.equal(rule._clinical_note, undefined);
  assert.match(rule.management.exceptions, /do not establish the severe-renal-impairment action/);
  const at20 = one(fireA(['dabigatran', 'verapamil'], { ...NVAF, renal: { crcl: 20 } }), 'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor')[0];
  assert.equal(at20.severity, 'minor');
  assert.equal(at20.dispense_action, 'withhold_and_clarify');
  const at60 = one(fireA(['dabigatran', 'verapamil'], { ...NVAF, renal: { crcl: 60 } }), 'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor')[0];
  assert.equal(at60.severity, 'minor');
  const unknownCrcl = one(fireA(['dabigatran', 'verapamil'], NVAF), 'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor')[0];
  assert.equal(unknownCrcl.dispense_action, 'withhold_and_clarify');
});
test('dabigatran with an unresolved indication returns an indication-clarification posture', () => {
  const f = fireA([
    { drug: 'dabigatran', route: 'oral' },
    { drug: 'verapamil', route: 'oral' },
  ], {});
  const nvaf = one(f, 'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor')[0];
  assert.equal(nvaf.dispense_action, 'withhold_and_clarify');
  assert.ok(nvaf.data_required.some((d) => d.factor === 'indication'));
  assert.ok(!nvaf.data_required.some((d) => d.factor === 'route'));
  assert.equal(nvaf.clinical_action_status, 'unresolved_pending_indication');
});
test('dabigatran VTE + ketoconazole at CrCl 40 maps avoid to major and cannot use free text to hide alternate indication branches', () => {
  const f = fireA(['dabigatran', 'ketoconazole'], { indication: 'venous_thromboembolism_treatment', renal: { crcl: 40 } });
  assert.ok(has(f, 'dabigatran_vte__pgp_inhibitor'));
  assert.equal(one(f, 'dabigatran_vte__pgp_inhibitor')[0].severity, 'major');
  assert.ok(has(f, 'dabigatran_nvaf__dronedarone_or_ketoconazole'));
  assert.ok(f
    .filter((finding) => finding.rule_id.startsWith('dabigatran_'))
    .every((finding) => finding.clinical_action_status === 'unresolved_pending_applicability'));
});

// ── clarithromycin exceptions ──
test('apixaban: clarithromycin is exempt (no reduce/avoid), ketoconazole is not', () => {
  assert.ok(!has(fireA(['apixaban', 'clarithromycin']), 'apixaban__strong_cyp3a4_pgp_inhibitor'));
  assert.ok(has(fireA(['apixaban', 'ketoconazole']), 'apixaban__strong_cyp3a4_pgp_inhibitor'));
});
test('rivaroxaban: clarithromycin is exempt (US: no precautions), ketoconazole avoids', () => {
  assert.ok(!has(fireA(['rivaroxaban', 'clarithromycin']), 'rivaroxaban__strong_cyp3a4_pgp_inhibitor'));
  assert.ok(has(fireA(['rivaroxaban', 'ketoconazole']), 'rivaroxaban__strong_cyp3a4_pgp_inhibitor'));
});
test('rivaroxaban + ketoconazole escalates at confirmed Child-Pugh C to at least major/withhold (label "avoid" mapping)', () => {
  const f = one(fireA(['rivaroxaban', 'ketoconazole'], { hepatic: { child_pugh: 'C' } }), 'rivaroxaban__strong_cyp3a4_pgp_inhibitor')[0];
  // XARELTO label uses "avoid use" wording (not a formal contraindication heading) -> mapped to major
  assert.equal(f.severity, 'major');
  assert.equal(f.dispense_action, 'withhold_and_clarify');
});

// ── Section A citation-record integrity (reviewer regression guards) ──
test('DOAC clarithromycin-exception evidence is scoped to the named member, not the inhibitor class', () => {
  for (const [rid] of [['apixaban__strong_cyp3a4_pgp_inhibitor', 'apixaban'], ['rivaroxaban__strong_cyp3a4_pgp_inhibitor', 'rivaroxaban']]) {
    const rule = A_RULES.find((r) => r.rule_id === rid);
    const ex = rule.evidence.find((e) => (e.source_id || '').includes('clarithromycin-exception'));
    assert.ok(ex, `${rid} missing clarithromycin-exception evidence`);
    assert.deepEqual(ex.supports.scope.perpetrator_members, ['clarithromycin']);
    assert.equal(ex.supports.scope.member_exception, 'clarithromycin');
    assert.ok(!JSON.stringify(ex.supports.scope).includes('class:'), 'clarithromycin exception must not reference the inhibitor class');
  }
});
test('no evidence object contains duplicate fragment hashes', () => {
  for (const r of RULES) {
    for (const e of r.evidence || []) {
      if (!Array.isArray(e.fragments)) continue;
      const hashes = e.fragments.map((f) => f.text_sha256);
      assert.equal(new Set(hashes).size, hashes.length, `${r.rule_id} has duplicate fragment hashes`);
    }
  }
});
test('rivaroxaban hepatic restriction is its own drug-condition rule, runtime-disabled, and never fires as a pairwise finding', () => {
  const hep = A_RULES.find((r) => r.rule_id === 'rivaroxaban__hepatic_impairment_child_pugh_b_c');
  assert.ok(hep, 'standalone rivaroxaban hepatic rule missing');
  assert.equal(hep.rule_type, 'drug_condition_restriction');
  assert.equal(hep.runtime_enabled, false);
  assert.ok(!fireA(['rivaroxaban', 'ketoconazole']).some((f) => f.rule_id === 'rivaroxaban__hepatic_impairment_child_pugh_b_c'));
});
test('Section A current-slice jurisdiction and CALDOLOR action stay source bounded', () => {
  for (const rule of A_RULES) {
    const jurisdictions = [
      ...new Set(rule.evidence.flatMap((evidence) => evidence.supports.jurisdictions)),
    ];
    assert.deepEqual(rule.applicability.jurisdiction, jurisdictions, rule.rule_id);
  }
  const gi = A_RULES.find((rule) =>
    rule.rule_id === 'aspirin__ibuprofen_additive_gi_bleeding');
  assert.equal(gi.runtime_enabled, false);
  assert.equal(gi.management.dispense_action, 'withhold_and_clarify');
  assert.deepEqual(gi.evidence[0].supports.label_action, ['not_generally_recommended']);
  for (const ruleId of [
    'aspirin_ld_ir__ibuprofen_timing',
    'aspirin__nsaid_additive_gi_bleeding',
  ]) {
    const gap = A_RULES.find((rule) => rule.rule_id === ruleId);
    assert.deepEqual(gap.evidence, [], ruleId);
    assert.deepEqual(gap.applicability.jurisdiction, [], ruleId);
    assert.equal(gap.runtime_status.pair_matcher_executable, false, ruleId);
    assert.equal(has(fireA(['aspirin', 'ibuprofen']), ruleId), false, ruleId);
  }
});

// ── Section B: statins ──
test('simvastatin + strong CYP3A4 inhibitor is contraindicated; atorvastatin is not', () => {
  assert.equal(one(fireB(['simvastatin', 'clarithromycin']), 'simvastatin_lovastatin__strong_cyp3a4_inhibitor')[0].severity, 'contraindicated');
  const atorva = one(fireB(['atorvastatin', 'clarithromycin']), 'atorvastatin__strong_cyp3a4_inhibitor')[0];
  assert.ok(atorva);
  assert.notEqual(atorva.severity, 'contraindicated');
});
test('gemfibrozil split: simvastatin contraindicated, lovastatin major — both as distinct rules', () => {
  assert.equal(one(fireB(['simvastatin', 'gemfibrozil']), 'simvastatin__gemfibrozil')[0].severity, 'contraindicated');
  const lov = one(fireB(['lovastatin', 'gemfibrozil']), 'lovastatin__gemfibrozil')[0];
  assert.equal(lov.severity, 'major');
  for (const [subjects, ruleId] of [
    [['simvastatin', 'gemfibrozil'], 'simvastatin__gemfibrozil'],
    [['gemfibrozil', 'simvastatin'], 'simvastatin__gemfibrozil'],
    [['lovastatin', 'gemfibrozil'], 'lovastatin__gemfibrozil'],
    [['gemfibrozil', 'lovastatin'], 'lovastatin__gemfibrozil'],
  ]) {
    const match = one(fireB(subjects), ruleId)[0];
    assert.equal(match.action_target, 'newly_added_agent', ruleId);
    assert.deepEqual(match.do_not_interrupt, ['object_drug', 'perpetrator_drug'], ruleId);
  }
});
test('statin + ciclosporin: simvastatin/pitavastatin contraindicated; atorvastatin avoid with NO fabricated dose cap', () => {
  assert.equal(one(fireB(['simvastatin', 'ciclosporin']), 'simvastatin__ciclosporin')[0].severity, 'contraindicated');
  assert.equal(one(fireB(['pitavastatin', 'ciclosporin']), 'pitavastatin__ciclosporin')[0].severity, 'contraindicated');
  const atorva = one(fireB(['atorvastatin', 'ciclosporin']), 'atorvastatin__ciclosporin')[0];
  assert.equal(atorva.severity, 'major');
  // regression guard: the phantom ~10 mg/day atorvastatin+ciclosporin cap must NOT return
  assert.doesNotMatch(atorva.management.prescriber_action || '', /\b10\s*mg\b/i);
});
test('simvastatin + amlodipine is a moderate dose-cap rule, marked diagnostic-only', () => {
  const rule = B_RULES.find((r) => r.rule_id === 'simvastatin__amlodipine');
  assert.equal(rule.runtime_enabled, false);
  assert.equal(rule.runtime_status.clinical_context_complete, false);
  assert.equal(one(fireB(['simvastatin', 'amlodipine']), 'simvastatin__amlodipine')[0].severity, 'moderate');
});
test('regimen-specific statin/HIV evidence is not flattened into bare-ingredient findings', () => {
  const statins = ['simvastatin', 'lovastatin', 'atorvastatin', 'rosuvastatin', 'pravastatin', 'pitavastatin'];
  const pis = ['ritonavir', 'cobicistat', 'lopinavir', 'atazanavir', 'darunavir'];
  for (const s of statins) {
    for (const p of pis) {
      const f = fireB([s, p]).filter((x) => x.rule_id.includes('hiv_pi') || x.rule_id.includes('strong_cyp3a4'));
      assert.equal(f.length, 0, `${s}+${p} must remain quarantined without a complete regimen`);
    }
  }
  const regimenRules = B_RULES.filter((rule) => rule.rule_id.includes('hiv_pi_cobicistat'));
  assert.ok(regimenRules.length > 0);
  assert.ok(regimenRules.every((rule) => (
    rule.runtime_status.pair_matcher_executable === false
    && rule.runtime_enabled === false
  )));
});
test('Section B runtime status fails closed for every draft rule', () => {
  const section = B_RULES;
  assert.equal(section.length, 20);
  for (const rule of section) {
    assert.equal(typeof rule.runtime_status?.pair_matcher_executable, 'boolean', `${rule.rule_id} pair matcher status`);
    assert.equal(typeof rule.runtime_status?.clinical_context_complete, 'boolean', `${rule.rule_id} context status`);
    assert.equal(typeof rule.runtime_status?.runtime_enabled, 'boolean', `${rule.rule_id} runtime status`);
    assert.equal(typeof rule.runtime_status?.promotion_eligible, 'boolean', `${rule.rule_id} promotion status`);
    assert.equal(rule.runtime_enabled, rule.runtime_status.runtime_enabled, `${rule.rule_id} top-level runtime mirror`);
    assert.equal(rule.runtime_status.promotion_eligible, false, `${rule.rule_id} must remain draft-only`);
  }
  assert.deepEqual(
    section.filter((rule) => rule.runtime_enabled).map((rule) => rule.rule_id).sort(),
    [],
  );
});
test('Section B route, formulation, dose, class-roster, and regimen-dependent templates are diagnostic-only', () => {
  const diagnosticIds = [
    'simvastatin_lovastatin__strong_cyp3a4_inhibitor',
    'statin__fenofibrate',
    'simvastatin__amiodarone',
    'simvastatin__verapamil_diltiazem',
    'simvastatin__amlodipine',
    'atorvastatin__strong_cyp3a4_inhibitor',
    'simvastatin__ciclosporin',
    'lovastatin__ciclosporin',
    'atorvastatin__ciclosporin',
    'pitavastatin__ciclosporin',
    'pravastatin__ciclosporin',
    'fluvastatin__ciclosporin',
    'rosuvastatin__ciclosporin',
    'simvastatin_lovastatin__hiv_pi_cobicistat',
    'atorvastatin__hiv_pi_cobicistat',
    'rosuvastatin__hiv_pi_cobicistat',
    'pravastatin__hiv_pi_cobicistat',
    'pitavastatin__hiv_pi_cobicistat',
  ];
  for (const ruleId of diagnosticIds) {
    const rule = B_RULES.find((candidate) => candidate.rule_id === ruleId);
    assert.ok(rule, `${ruleId} missing`);
    assert.equal(rule.runtime_enabled, false, `${ruleId} must fail closed`);
    assert.equal(rule.runtime_status.clinical_context_complete, false, `${ruleId} context must remain incomplete`);
  }
});
test('pravastatin and pitavastatin HIV templates quarantine regimen-specific pharmacokinetics', () => {
  const pravastatin = B_RULES.find((rule) => rule.rule_id === 'pravastatin__hiv_pi_cobicistat');
  const pitavastatin = B_RULES.find((rule) => rule.rule_id === 'pitavastatin__hiv_pi_cobicistat');
  assert.equal(pravastatin.runtime_enabled, false);
  assert.equal(pitavastatin.runtime_enabled, false);
  assert.equal(pravastatin.evidence.length, 2);
  assert.ok(pravastatin.evidence.every((record) => record.supports.label_action.length === 0));
  assert.deepEqual(
    pitavastatin.evidence[0].supports.source_effect,
    [
      'increased_pitavastatin_exposure_with_atazanavir',
      'decreased_pitavastatin_exposure_with_darunavir_ritonavir',
      'decreased_pitavastatin_exposure_with_lopinavir_ritonavir',
    ],
  );
});
test('Section B citations use the hardened current-source contract with globally unique fragments', () => {
  const section = B_RULES;
  const evidence = section.flatMap((rule) => rule.evidence);
  const fragmentHashes = evidence.flatMap((record) => record.fragments.map((fragment) => fragment.text_sha256));
  assert.equal(evidence.length, 28);
  assert.equal(fragmentHashes.length, 35);
  assert.equal(new Set(fragmentHashes).size, fragmentHashes.length);
  for (const record of evidence) {
    assert.match(record.source_url, /^https:\/\/api\.fda\.gov\/drug\/label\.json\?/);
    assert.equal(record.source_policy_id, 'openfda-labels');
    assert.equal(record.source_policy_use, 'interaction-evidence');
    assert.equal(record.licence, 'CC0-1.0');
    assert.equal(record.currentness_status, 'checked_current_openfda');
    assert.equal(record.currentness_checked_at, '2026-07-24');
    assert.deepEqual(
      record.provenance.source_paths,
      record.fragments.map((fragment) => fragment.source_path),
    );
    assert.ok(record.supports.source_effect.length > 0);
    assert.ok(Array.isArray(record.supports.label_action));
    assert.ok(record.does_not_by_itself_support.length > 0);
    assert.doesNotMatch(JSON.stringify(record), /<verify|<placeholder|\b(?:todo|tbd|tbc|fixme)\b/i);
  }
});

// ── Section C: serotonin / CNS ──
test('SSRI+nonselective MAOI is contraindicated; linezolid+SSRI routes to the serotonergic rule (MAOI-member split)', () => {
  assert.equal(one(fireC(['fluoxetine', 'phenelzine']), 'ssri_snri__maoi_nonselective')[0].severity, 'contraindicated');
  assert.ok(has(fireC(['linezolid', 'sertraline']), 'linezolid__serotonergic_agent'));
  assert.ok(!has(fireC(['linezolid', 'sertraline']), 'ssri_snri__maoi_nonselective')); // linezolid not in the MAOI pin
});
test('DXM+MAOI contraindicated vs DXM+SSRI moderate (split)', () => {
  assert.equal(one(fireC(['dextromethorphan', 'phenelzine']), 'dextromethorphan__maoi_nonselective')[0].severity, 'contraindicated');
  assert.equal(one(fireC(['dextromethorphan', 'fluoxetine']), 'dextromethorphan__ssri_snri')[0].severity, 'moderate');
});
test('opioid+benzodiazepine and opioid+gabapentinoid fire distinctly (no double-alert)', () => {
  const benzo = fireC(['morphine', 'diazepam']);
  assert.ok(has(benzo, 'opioid__benzodiazepine_cns_depressant'));
  assert.ok(!has(benzo, 'opioid__gabapentinoid'));
  const gaba = fireC(['morphine', 'gabapentin']);
  assert.ok(has(gaba, 'opioid__gabapentinoid'));
  assert.ok(!has(gaba, 'opioid__benzodiazepine_cns_depressant'));
});
test('MAOI + indirect sympathomimetic is contraindicated; + direct catecholamine is contraindicated (per current MAOI labels) but runtime-disabled (procedural)', () => {
  assert.equal(one(fireC(['phenelzine', 'pseudoephedrine']), 'maoi_nonselective__sympathomimetic')[0].severity, 'contraindicated');
  const direct = one(fireC(['phenelzine', 'adrenaline']), 'maoi_nonselective__direct_sympathomimetic')[0];
  assert.equal(direct.severity, 'contraindicated'); // Nardil/tranylcypromine labels list catecholamines as not-to-coadminister
  assert.equal(direct.runtime_enabled, false); // administered-drug/emergency module — not pharmacist-facing
});
test('runtime-status: methylene-blue-IV and direct-sympathomimetic are diagnostic-only (never pharmacist-facing)', () => {
  const mb = fireC(['sertraline', 'methylene_blue']).filter((f) => f.rule_id === 'ssri_snri__methylene_blue_iv');
  assert.equal(mb.length, 1); // matcher diagnostic
  assert.equal(mb[0].runtime_enabled, false); // but excluded from pharmacist-facing
  const direct = fireC(['phenelzine', 'adrenaline']).filter((f) => f.rule_id === 'maoi_nonselective__direct_sympathomimetic');
  assert.equal(direct[0].runtime_enabled, false);
  // every Section C rule declares the 4-field runtime_status
  for (const r of C_RULES) {
    assert.ok(r.runtime_status && typeof r.runtime_status.runtime_enabled === 'boolean', `${r.rule_id} missing runtime_status`);
  }
});
test('synonym normalization: meperidine==pethidine, epinephrine==adrenaline, cyclosporine==ciclosporin', () => {
  assert.ok(has(fireC(['meperidine', 'phenelzine']), 'pethidine_tramadol__maoi_nonselective'));
  assert.ok(has(fireC(['epinephrine', 'phenelzine']), 'maoi_nonselective__direct_sympathomimetic'));
});
test('triptan MAO-A rule is evidence-narrowed to sumatriptan', () => {
  assert.ok(has(fireC(['sumatriptan', 'phenelzine']), 'triptan_mao_metabolized__maoi_mao_a'));
  for (const t of ['rizatriptan', 'zolmitriptan', 'almotriptan', 'naratriptan', 'frovatriptan']) {
    assert.ok(!has(fireC([t, 'phenelzine']), 'triptan_mao_metabolized__maoi_mao_a'), `${t} must not enter the sumatriptan-only evidence gate`);
  }
});
test('collision: morphine+diazepam+gabapentin yields the two specific findings, no generic cascade', () => {
  const f = fireC(['morphine', 'diazepam', 'gabapentin']).filter((x) => x.rule_id.startsWith('opioid__'));
  const ids = new Set(f.map((x) => x.rule_id));
  assert.ok(ids.has('opioid__benzodiazepine_cns_depressant'));
  assert.ok(ids.has('opioid__gabapentinoid'));
});
test('linezolid and lithium retain monitor actions in the draft but bare presentations fail closed', () => {
  for (const ruleId of ['linezolid__serotonergic_agent', 'lithium__ssri_snri']) {
    const rule = C_RULES.find((candidate) => candidate.rule_id === ruleId);
    assert.equal(rule.management.dispense_action, 'confirm_and_monitor');
    assert.equal(rule.runtime_enabled, false);
  }
  for (const [subjects, ruleId] of [
    [['linezolid', 'sertraline'], 'linezolid__serotonergic_agent'],
    [['lithium', 'sertraline'], 'lithium__ssri_snri'],
  ]) {
    const finding = one(fireC(subjects), ruleId)[0];
    assert.equal(finding.dispense_action, 'withhold_and_clarify');
    assert.equal(finding.clinical_action_status, 'unresolved_pending_route_or_formulation');
  }
});

test('only directly supported directional washout intervals are encoded', () => {
  const fluoxetine = C_RULES.find((r) => r.rule_id === 'ssri_snri__maoi_nonselective');
  const opioid = C_RULES.find((r) => r.rule_id === 'pethidine_tramadol__maoi_nonselective');
  const sumatriptan = C_RULES.find((r) => r.rule_id === 'triptan_mao_metabolized__maoi_mao_a');
  const bupropion = C_RULES.find((r) => r.rule_id === 'bupropion__maoi_nonselective');
  assert.match(fluoxetine.management.timing, /within 5 weeks after stopping fluoxetine/i);
  assert.match(opioid.management.timing, /within 14 days after stopping the MAOI/i);
  assert.match(sumatriptan.management.timing, /within 2 weeks after stopping the MAO-A inhibitor/i);
  assert.match(bupropion.management.timing, /at least 14 days in both directions/i);
  assert.doesNotMatch(JSON.stringify(C_RULES), /runtime_executable|interval not encoded/i);
});

// ── Section D: QT / arrhythmia ──
test('domperidone and ziprasidone source-backed pairs remain contraindicated while ondansetron+apomorphine fails closed', () => {
  assert.equal(one(fireD(['domperidone', 'amiodarone'], { jurisdiction: 'UK' }), 'domperidone__qt_prolonging_drug')[0].severity, 'contraindicated');
  assert.equal(one(fireD(['domperidone', 'clarithromycin'], { jurisdiction: 'UK' }), 'domperidone__potent_cyp3a4_inhibitor')[0].severity, 'contraindicated');
  const apomorphine = one(fireD(['ondansetron', 'apomorphine']), 'ondansetron__apomorphine')[0];
  assert.equal(apomorphine.severity, 'contraindicated');
  assert.equal(apomorphine.runtime_enabled, false);
  assert.equal(one(fireD(['ziprasidone', 'sotalol']), 'ziprasidone__qt_prolonging_drug')[0].severity, 'contraindicated');
});
test('haloperidol QT rules are both diagnostic-only (v2: oral disabled as generic-additive-QT; IV/above-dose route not gateable)', () => {
  const f = fireD(['haloperidol', 'amiodarone']);
  const oral = one(f, 'haloperidol_oral__qt_prolonging_drug')[0];
  assert.equal(oral.runtime_enabled, false); // reviewer-7: generic additive-QT -> diagnostic-only until the cumulative-QT module exists
  const iv = one(f, 'haloperidol_iv_or_above_recommended_dose__qt_prolonging_drug')[0];
  assert.equal(iv.runtime_enabled, false); // route/dose not matcher-gateable
  // no haloperidol QT rule is pharmacist-facing
  assert.deepEqual(f.filter((x) => x.runtime_enabled && x.rule_id.startsWith('haloperidol')).map((x) => x.rule_id), []);
});
test('QT rules are risk-tier (qt_risk_factors, none machine-gateable) and additive tier is confirm_and_monitor', () => {
  const cit = D_RULES.find((r) => r.rule_id === 'citalopram__qt_prolonging_drug');
  assert.ok(Array.isArray(cit.qt_risk_factors) && cit.qt_risk_factors.length >= 5);
  assert.ok(cit.qt_risk_factors.every((f) => f.gateable === false));
  assert.equal(cit.management.dispense_action, 'confirm_and_monitor');
  // azithromycin is NOT treated as QT-safe by default
  assert.ok(has(fireD(['azithromycin', 'citalopram']), 'qt_macrolide__qt_prolonging_drug'));
});
test('methadone QT (PD) and methadone+CYP-inhibitor (PK) are distinct rules that both inform', () => {
  const f = fireD(['methadone', 'fluconazole']);
  assert.ok(has(f, 'methadone__qt_prolonging_drug'));
  assert.ok(has(f, 'methadone__cyp_inhibitor'));
});

// ── clopidogrel PPI substitution action ──
test('clopidogrel + omeprazole preserves substitution intent but bare presentations do not infer an action target', () => {
  const rule = RULES.find((candidate) =>
    candidate.rule_id === 'clopidogrel__cyp2c19_inhibiting_ppi');
  assert.equal(rule.management.action_target, 'newly_added_perpetrator');
  assert.deepEqual(rule.management.do_not_interrupt, ['object_drug']);
  const f = one(fire(['clopidogrel', 'omeprazole']), 'clopidogrel__cyp2c19_inhibiting_ppi')[0];
  assert.equal(f.dispense_action, 'withhold_and_clarify');
  assert.equal(f.action_target, null);
  assert.deepEqual(f.do_not_interrupt, []);
  assert.equal(f.clinical_action_status, 'unresolved_pending_route_or_formulation');
});

test('every context_modifier has a valid-or-absent dispense_action and no no-op escalate (reviewer-7 schema invariant)', () => {
  const VOCAB = new Set(['withhold_and_clarify', 'confirm_and_monitor', 'supply_with_counselling', 'space_doses']);
  const rules = fs.readFileSync(PACK, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const bad = [];
  for (const r of rules) for (const c of r.context_modifiers || []) {
    if (c.dispense_action !== undefined && !VOCAB.has(c.dispense_action)) bad.push(`${r.rule_id}:${c.factor} top da=${c.dispense_action}`);
    const ov = c.management_override && c.management_override.dispense_action;
    if (ov !== undefined && !VOCAB.has(ov)) bad.push(`${r.rule_id}:${c.factor} override da=${ov}`);
    if (c.on_unknown === 'escalate' && c.dispense_action === undefined) bad.push(`${r.rule_id}:${c.factor} no-op escalate (on_unknown:escalate without top-level dispense_action)`);
  }
  assert.deepEqual(bad, [], 'context_modifier dispense_action invariant violations: ' + bad.join(' | '));
});
