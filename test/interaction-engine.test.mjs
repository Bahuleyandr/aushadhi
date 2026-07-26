import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveRule } from '../src/lib/interaction-engine.mjs';

test('contraindicated severity always forces withhold_and_clarify (invariant, computed post-resolution)', () => {
  const rule = {
    rule_id: 'x__y',
    severity: 'contraindicated',
    management: { dispense_action: 'confirm_and_monitor', prescriber_action: 'p' },
    context_modifiers: [],
  };
  const r = resolveRule(rule, {});
  assert.equal(r.severity, 'contraindicated');
  assert.equal(r.dispense_action, 'withhold_and_clarify');
});

const COLCHICINE = {
  rule_id: 'colchicine__inhibitor',
  severity: 'major',
  management: { dispense_action: 'withhold_and_clarify', prescriber_action: 'Withhold and clarify (neutral base).' },
  context_modifiers: [
    { factor: 'renal', when: 'egfr_lt_30', severity: 'contraindicated', dispense_action: 'withhold_and_clarify',
      management_override: { dispense_action: 'withhold_and_clarify', prescriber_action: 'Contraindicated in renal impairment.' },
      on_unknown: 'escalate' },
  ],
};

test('absent factor with an escalate modifier drives a restrictive OPERATIONAL action + data_required WITHOUT falsifying clinical severity', () => {
  const r = resolveRule(COLCHICINE, {}); // no renal value
  assert.equal(r.severity, 'major'); // clinical severity stays at the confirmed-state (base) tier
  assert.equal(r.dispense_action, 'withhold_and_clarify'); // operational: restrictive because data is missing
  const renal = r.data_required.find((d) => d.factor === 'renal');
  assert.ok(renal, 'data_required must name the missing factor');
  assert.equal(renal.would_be_severity, 'contraindicated'); // "would be contraindicated if confirmed"
  assert.equal(r.management.prescriber_action, 'Withhold and clarify (neutral base).'); // neutral base still shown
});

test('CrCl band predicates crcl_30_to_50 and crcl_lt_50 gate the exact dabigatran renal bands', () => {
  const rule = {
    rule_id: 'd', severity: 'moderate', management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [
      { factor: 'renal', when: 'crcl_lt_30', severity: 'contraindicated', dispense_action: 'withhold_and_clarify', on_unknown: 'escalate', management_override: { prescriber_action: 'avoid' } },
      { factor: 'renal', when: 'crcl_30_to_50', severity: 'major', dispense_action: 'confirm_and_monitor', on_unknown: 'base', management_override: { prescriber_action: 'reduce to 75 mg BID' } },
    ],
  };
  assert.equal(resolveRule(rule, { renal: { crcl: 40 } }).severity, 'major');
  assert.equal(resolveRule(rule, { renal: { crcl: 40 } }).management.prescriber_action, 'reduce to 75 mg BID');
  assert.equal(resolveRule(rule, { renal: { crcl: 20 } }).severity, 'contraindicated');
  assert.equal(resolveRule(rule, { renal: { crcl: 70 } }).severity, 'moderate'); // base, no band matches
});

test('crcl_lt_50 gates a VTE/prophylaxis-style avoid threshold', () => {
  const rule = {
    rule_id: 'v', severity: 'moderate', management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [{ factor: 'renal', when: 'crcl_lt_50', severity: 'contraindicated', dispense_action: 'withhold_and_clarify', on_unknown: 'escalate' }],
  };
  assert.equal(resolveRule(rule, { renal: { crcl: 40 } }).severity, 'contraindicated');
  assert.equal(resolveRule(rule, { renal: { crcl: 60 } }).severity, 'moderate');
});

test('action_target and do_not_interrupt are surfaced from the winning management', () => {
  const rule = {
    rule_id: 'x', severity: 'major',
    management: { dispense_action: 'withhold_and_clarify', action_target: 'newly_added_perpetrator', do_not_interrupt: ['object_drug'] },
    context_modifiers: [],
  };
  const r = resolveRule(rule, {});
  assert.equal(r.action_target, 'newly_added_perpetrator');
  assert.deepEqual(r.do_not_interrupt, ['object_drug']);
});

test('missing data never yields a contraindicated CLINICAL severity — only a restrictive operational action', () => {
  const rule = {
    rule_id: 'x', severity: 'moderate',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [
      { factor: 'renal', when: 'crcl_lt_30', severity: 'contraindicated', dispense_action: 'withhold_and_clarify', on_unknown: 'escalate' },
    ],
  };
  const unknown = resolveRule(rule, {});
  assert.equal(unknown.severity, 'moderate'); // NOT contraindicated
  assert.equal(unknown.dispense_action, 'withhold_and_clarify'); // restrictive because CrCl unknown
  assert.equal(unknown.data_required[0].factor, 'renal');
  assert.equal(unknown.data_required[0].metric, 'CrCl');
  const confirmed = resolveRule(rule, { renal: { crcl: 20 } });
  assert.equal(confirmed.severity, 'contraindicated'); // confirmed state => real contraindication
  assert.equal(confirmed.dispense_action, 'withhold_and_clarify');
  assert.equal(confirmed.data_required.length, 0);
});

test('factor PRESENT and predicate matches applies the impairment-specific override', () => {
  const r = resolveRule(COLCHICINE, { renal: { egfr: 20 } });
  assert.equal(r.severity, 'contraindicated');
  assert.equal(r.management.prescriber_action, 'Contraindicated in renal impairment.');
});

test('factor PRESENT but predicate does NOT match falls back to base severity', () => {
  const r = resolveRule(COLCHICINE, { renal: { egfr: 80 } });
  assert.equal(r.severity, 'major');
  assert.equal(r.management.prescriber_action, 'Withhold and clarify (neutral base).');
});

test('within a factor, the most-specific matching renal predicate wins (precedence #5)', () => {
  const rule = {
    rule_id: 'r', severity: 'moderate',
    management: { dispense_action: 'confirm_and_monitor', prescriber_action: 'base' },
    context_modifiers: [
      { factor: 'renal', when: 'egfr_lt_60', severity: 'major', dispense_action: 'confirm_and_monitor',
        management_override: { prescriber_action: 'lt60' }, on_unknown: 'base' },
      { factor: 'renal', when: 'egfr_lt_30', severity: 'contraindicated', dispense_action: 'withhold_and_clarify',
        management_override: { prescriber_action: 'lt30' }, on_unknown: 'base' },
    ],
  };
  const r = resolveRule(rule, { renal: { egfr: 20 } }); // both predicates match
  assert.equal(r.severity, 'contraindicated');
  assert.equal(r.management.prescriber_action, 'lt30');
});

import { checkPair } from '../src/lib/interaction-engine.mjs';
const MEMBERS = { cyp3a4_pgp_inhibitor: { strong: ['clarithromycin', 'ketoconazole'] } };
const generic = {
  rule_id: 'colchicine__strong', object: { drug: 'colchicine' },
  perpetrator: { class: 'cyp3a4_pgp_inhibitor', strength: ['strong'] },
  severity: 'major', management: { dispense_action: 'withhold_and_clarify' }, context_modifiers: [],
};

test('a class-ref rule matches a member of the class (#4)', () => {
  const f = checkPair({ subjects: ['colchicine', 'clarithromycin'], rules: [generic], memberSets: MEMBERS });
  assert.equal(f.length, 1);
  assert.equal(f[0].rule_id, 'colchicine__strong');
});

test('drug-name synonyms are normalized before matching (meperidine==pethidine, cyclosporine==ciclosporin, epinephrine==adrenaline)', () => {
  const pethidineRule = { rule_id: 'p', object: { drug: 'pethidine' }, perpetrator: { drug: 'phenelzine' }, severity: 'contraindicated', management: { dispense_action: 'withhold_and_clarify' }, context_modifiers: [] };
  const cicloRule = { rule_id: 'c', object: { drug: 'simvastatin' }, perpetrator: { drug: 'ciclosporin' }, severity: 'contraindicated', management: { dispense_action: 'withhold_and_clarify' }, context_modifiers: [] };
  assert.equal(checkInteractions({ subjects: ['meperidine', 'phenelzine'], rules: [pethidineRule] }).findings.length, 1);
  assert.equal(checkInteractions({ subjects: ['cyclosporine', 'simvastatin'], rules: [cicloRule] }).findings.length, 1);
  // class-member synonym: epinephrine resolves to adrenaline in a class member set
  const catRule = { rule_id: 'cat', object: { drug: 'phenelzine' }, perpetrator: { class: 'cat', members: ['adrenaline'] }, severity: 'major', management: { dispense_action: 'confirm_and_monitor' }, context_modifiers: [] };
  assert.equal(checkInteractions({ subjects: ['phenelzine', 'epinephrine'], rules: [catRule], memberSets: { cat: { any: ['adrenaline'] } } }).findings.length, 1);
});

test('cross-jurisdiction aliases collapse to one subject and cannot duplicate a finding', () => {
  const contraceptiveRule = {
    rule_id: 'rifampicin__contraceptive',
    object: { class: 'contraceptive', members: ['norethisterone'] },
    perpetrator: { drug: 'rifampicin' },
    severity: 'major',
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
  };
  const contraceptive = checkInteractions({
    subjects: ['rifampin', 'norethindrone', 'norethisterone'],
    rules: [contraceptiveRule],
  });
  assert.equal(contraceptive.pairs_checked, 1);
  assert.equal(contraceptive.findings.length, 1);
  assert.deepEqual(contraceptive.findings[0].subjects, ['rifampicin', 'norethisterone']);

  const antiseizureRule = {
    rule_id: 'contraceptive__antiepileptic',
    object: { drug: 'ethinylestradiol' },
    perpetrator: { class: 'antiepileptic', members: ['phenobarbital'] },
    severity: 'major',
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
  };
  const antiseizure = checkInteractions({
    subjects: ['ethinylestradiol', 'phenobarbital', 'phenobarbitone'],
    rules: [antiseizureRule],
  });
  assert.equal(antiseizure.pairs_checked, 1);
  assert.equal(antiseizure.findings.length, 1);

  const qtRule = {
    rule_id: 'ziprasidone__dolasetron',
    object: { drug: 'ziprasidone' },
    perpetrator: { class: 'qt_agent', members: ['dolasetron'] },
    severity: 'contraindicated',
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
  };
  const qt = checkInteractions({
    subjects: ['ziprasidone', 'dolasetron', 'dolasetron mesylate'],
    rules: [qtRule],
  });
  assert.equal(qt.pairs_checked, 1);
  assert.equal(qt.findings.length, 1);
});

test('an inline members[] allowlist on a class ref pins matching to exactly those members', () => {
  const rule = {
    rule_id: 'r', object: { drug: 'dabigatran' },
    perpetrator: { class: 'pgp_inhibitor', members: ['dronedarone', 'ketoconazole'], strength: [] },
    severity: 'major', management: { dispense_action: 'confirm_and_monitor' }, context_modifiers: [],
  };
  const ms = { pgp_inhibitor: { strong: ['dronedarone', 'ketoconazole', 'verapamil', 'amiodarone'] } };
  assert.equal(checkInteractions({ subjects: ['dabigatran', 'ketoconazole'], rules: [rule], memberSets: ms }).findings.length, 1);
  assert.equal(checkInteractions({ subjects: ['dabigatran', 'verapamil'], rules: [rule], memberSets: ms }).findings.length, 0);
});

test('a named member exception is NOT matched (#4)', () => {
  const rule = { ...generic, perpetrator: { ...generic.perpetrator, member_exceptions: ['clarithromycin'] } };
  const f = checkPair({ subjects: ['colchicine', 'clarithromycin'], rules: [rule], memberSets: MEMBERS });
  assert.equal(f.length, 0);
});

test('member-specific rule suppresses the generic class rule for the same pair (#6)', () => {
  const specific = {
    rule_id: 'colchicine__clarithromycin', object: { drug: 'colchicine' }, perpetrator: { drug: 'clarithromycin' },
    severity: 'contraindicated', management: { dispense_action: 'withhold_and_clarify' }, context_modifiers: [],
    suppresses: ['colchicine__strong'],
  };
  const f = checkPair({ subjects: ['colchicine', 'clarithromycin'], rules: [generic, specific], memberSets: MEMBERS });
  assert.equal(f.length, 1);
  assert.equal(f[0].rule_id, 'colchicine__clarithromycin');
  assert.equal(f[0].severity, 'contraindicated');
});

test('identity specificity cannot hide a distinct, more severe class finding', () => {
  const classContraindication = {
    rule_id: 'class_contraindication',
    object: { class: 'victim', members: ['x'] },
    perpetrator: { class: 'perpetrator', members: ['y'] },
    severity: 'contraindicated',
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
  };
  const exactMinor = {
    rule_id: 'exact_minor',
    object: { drug: 'x' },
    perpetrator: { drug: 'y' },
    severity: 'minor',
    management: { dispense_action: 'supply_with_counselling' },
    context_modifiers: [],
  };
  const findings = checkPair({
    subjects: ['x', 'y'],
    rules: [classContraindication, exactMinor],
  });
  assert.deepEqual(
    findings.map((finding) => finding.rule_id).sort(),
    ['class_contraindication', 'exact_minor'],
  );
});

test('a more-specific diagnostic rule does not suppress a distinct enabled rule', () => {
  const enabled = {
    rule_id: 'aspirin__nsaid_bleeding',
    object: { drug: 'aspirin' },
    perpetrator: { class: 'nsaid' },
    severity: 'moderate',
    management: { dispense_action: 'supply_with_counselling' },
    context_modifiers: [],
    runtime_enabled: true,
  };
  const diagnostic = {
    rule_id: 'aspirin__ibuprofen_timing',
    object: { drug: 'aspirin' },
    perpetrator: { drug: 'ibuprofen' },
    severity: 'moderate',
    management: { dispense_action: 'space_doses' },
    context_modifiers: [],
    runtime_enabled: false,
  };
  const f = checkPair({
    subjects: ['aspirin', 'ibuprofen'],
    rules: [enabled, diagnostic],
    memberSets: { nsaid: { any: ['ibuprofen'] } },
  });
  assert.deepEqual(f.map((finding) => finding.rule_id).sort(), [
    'aspirin__ibuprofen_timing',
    'aspirin__nsaid_bleeding',
  ]);
});

import {
  checkInteractions,
  checkRuntimeInteractions,
} from '../src/lib/interaction-engine.mjs';

test('checkInteractions evaluates every unordered pair and returns findings', () => {
  const rule = { rule_id: 'a__b', object: { drug: 'a' }, perpetrator: { drug: 'b' },
    severity: 'major', management: { dispense_action: 'confirm_and_monitor' }, context_modifiers: [] };
  const res = checkInteractions({ subjects: ['a', 'x', 'b'], rules: [rule] });
  assert.equal(res.pairs_checked, 3);
  assert.equal(res.findings.length, 1);
  assert.equal(res.findings[0].rule_id, 'a__b');
});

test('checkInteractions reports classes referenced by rules but missing member data (honest coverage)', () => {
  const rule = { rule_id: 'a__c', object: { drug: 'a' }, perpetrator: { class: 'some_class', strength: ['strong'] },
    severity: 'major', management: {}, context_modifiers: [] };
  const res = checkInteractions({ subjects: ['a', 'y'], rules: [rule], memberSets: {} });
  assert.ok(res.coverage.classes_missing_members.includes('some_class'));
});

test('each finding is tagged with the actual drug pair that matched it', () => {
  const rule = { rule_id: 'a__b', object: { drug: 'a' }, perpetrator: { drug: 'b' },
    severity: 'major', management: { dispense_action: 'confirm_and_monitor' }, context_modifiers: [] };
  const res = checkInteractions({ subjects: ['x', 'a', 'b'], rules: [rule] });
  assert.equal(res.findings.length, 1);
  assert.deepEqual(res.findings[0].subjects, ['a', 'b']);
});

test('a present, matched modifier surfaces its override text even when severity+action tie the base', () => {
  // engine fix: a present, matched context factor is strictly more specific than base,
  // so on a severity+action tie it must win and show its impairment-specific management.
  const rule = {
    rule_id: 'r', severity: 'major',
    management: { dispense_action: 'confirm_and_monitor', prescriber_action: 'base text' },
    context_modifiers: [
      { factor: 'renal', when: 'crcl_lt_60', severity: 'major', dispense_action: 'confirm_and_monitor',
        management_override: { prescriber_action: 'renal-band text' }, on_unknown: 'base' },
    ],
  };
  const r = resolveRule(rule, { renal: { crcl: 40 } });
  assert.equal(r.severity, 'major');
  assert.equal(r.dispense_action, 'confirm_and_monitor');
  assert.equal(r.management.prescriber_action, 'renal-band text');
  // when the factor is absent (on_unknown:base), the base text still shows.
  assert.equal(resolveRule(rule, {}).management.prescriber_action, 'base text');
});

test('an all_of_present combination rule fires only when EVERY combination member AND the perpetrator are present', () => {
  const rule = {
    rule_id: 'triple', object: { combination: [{ drug: 'aspirin' }, { drug: 'clopidogrel' }], match_semantics: 'all_of_present' },
    perpetrator: { drug: 'warfarin' }, severity: 'major', management: { dispense_action: 'confirm_and_monitor' }, context_modifiers: [],
  };
  const fire = checkInteractions({ subjects: ['aspirin', 'clopidogrel', 'warfarin'], rules: [rule] });
  assert.equal(fire.findings.length, 1);
  assert.equal(fire.findings[0].rule_id, 'triple');
  assert.deepEqual([...fire.findings[0].subjects].sort(), ['aspirin', 'clopidogrel', 'warfarin']);
  // missing the P2Y12 member => must NOT fire
  const noFire = checkInteractions({ subjects: ['aspirin', 'warfarin'], rules: [rule] });
  assert.equal(noFire.findings.length, 0);
});

test('all_of_present combination members and perpetrator can be class refs resolved via member sets', () => {
  const rule = {
    rule_id: 'triple2', object: { combination: [{ drug: 'aspirin' }, { class: 'p2y12_inhibitor' }], match_semantics: 'all_of_present' },
    perpetrator: { class: 'oral_anticoagulant' }, severity: 'major', management: { dispense_action: 'confirm_and_monitor' }, context_modifiers: [],
  };
  const ms = { p2y12_inhibitor: { any: ['clopidogrel', 'ticagrelor', 'prasugrel'] }, oral_anticoagulant: { any: ['warfarin', 'apixaban'] } };
  const res = checkInteractions({ subjects: ['aspirin', 'ticagrelor', 'apixaban'], rules: [rule], memberSets: ms });
  assert.equal(res.findings.length, 1);
  // one drug cannot satisfy two distinct required roles: aspirin alone can't stand in for the P2Y12
  const short = checkInteractions({ subjects: ['aspirin', 'apixaban'], rules: [rule], memberSets: ms });
  assert.equal(short.findings.length, 0);
});

test('free-text indication input cannot definitively exclude an indication-scoped rule', () => {
  const nvaf = {
    rule_id: 'nvaf', object: { drug: 'dabigatran' }, perpetrator: { drug: 'ketoconazole' },
    applicability: { indication: ['non_valvular_atrial_fibrillation'] },
    severity: 'major', management: { dispense_action: 'confirm_and_monitor' }, context_modifiers: [],
  };
  const hit = checkInteractions({ subjects: ['dabigatran', 'ketoconazole'], rules: [nvaf], patientContext: { indication: 'non_valvular_atrial_fibrillation' } });
  assert.equal(hit.findings.length, 1);
  assert.deepEqual(hit.findings[0].indication_scope, ['non_valvular_atrial_fibrillation']);
  assert.equal(hit.findings[0].clinical_action_status, 'unresolved_pending_indication');
  const unmapped = checkInteractions({ subjects: ['dabigatran', 'ketoconazole'], rules: [nvaf], patientContext: { indication: 'venous_thromboembolism_typo' } });
  assert.equal(unmapped.findings.length, 1);
  assert.equal(unmapped.findings[0].clinical_action_status, 'unresolved_pending_indication');
  const unknown = checkInteractions({ subjects: ['dabigatran', 'ketoconazole'], rules: [nvaf], patientContext: {} });
  assert.equal(unknown.findings.length, 1);
});

test('unknown indication yields a clarify-indication finding (data_required) instead of asserting an indication-specific action', () => {
  const nvaf = {
    rule_id: 'nvaf', object: { drug: 'dabigatran' }, perpetrator: { drug: 'verapamil' },
    applicability: { indication: ['non_valvular_atrial_fibrillation'] },
    severity: 'minor',
    management: {
      dispense_action: 'supply_with_counselling',
      prescriber_action: 'indication-specific instruction',
      action_target: 'perpetrator',
      do_not_interrupt: ['object_drug'],
    },
    context_modifiers: [],
  };
  const unknown = checkInteractions({ subjects: ['dabigatran', 'verapamil'], rules: [nvaf], patientContext: {} }).findings[0];
  assert.equal(unknown.dispense_action, 'withhold_and_clarify'); // NOT supply_with_counselling
  assert.ok(unknown.data_required.some((d) => d.factor === 'indication'));
  assert.equal(unknown.clinical_action_status, 'unresolved_pending_indication');
  assert.deepEqual(unknown.management, {});
  assert.equal(unknown.action_target, null);
  assert.deepEqual(unknown.do_not_interrupt, []);
  // A free-text value is still unmapped and cannot authorize the scoped action.
  const unmapped = checkInteractions({ subjects: ['dabigatran', 'verapamil'], rules: [nvaf], patientContext: { indication: 'non_valvular_atrial_fibrillation' } }).findings[0];
  assert.equal(unmapped.dispense_action, 'withhold_and_clarify');
  assert.equal(unmapped.clinical_action_status, 'unresolved_pending_indication');
});

test('findings carry runtime_enabled so a pharmacist-facing layer can exclude diagnostic-only rules', () => {
  const on = { rule_id: 'on', object: { drug: 'a' }, perpetrator: { drug: 'b' }, severity: 'major', management: { dispense_action: 'confirm_and_monitor' }, context_modifiers: [], runtime_enabled: true };
  const off = { rule_id: 'off', object: { drug: 'a' }, perpetrator: { drug: 'b' }, severity: 'major', management: { dispense_action: 'confirm_and_monitor' }, context_modifiers: [], runtime_enabled: false };
  const omitted = { rule_id: 'omitted', object: { drug: 'a' }, perpetrator: { drug: 'b' }, severity: 'major', management: { dispense_action: 'confirm_and_monitor' }, context_modifiers: [] };
  const f = checkInteractions({ subjects: ['a', 'b'], rules: [on, off, omitted] }).findings;
  assert.equal(f.find((x) => x.rule_id === 'on').runtime_enabled, true);
  assert.equal(f.find((x) => x.rule_id === 'off').runtime_enabled, false);
  assert.equal(f.find((x) => x.rule_id === 'omitted').runtime_enabled, false);
});

test('coverage scan sees classes nested inside a combination object', () => {
  const rule = {
    rule_id: 'triple3', object: { combination: [{ drug: 'aspirin' }, { class: 'p2y12_inhibitor' }], match_semantics: 'all_of_present' },
    perpetrator: { class: 'oral_anticoagulant' }, severity: 'major', management: {}, context_modifiers: [],
  };
  const res = checkInteractions({ subjects: ['aspirin'], rules: [rule], memberSets: {} });
  assert.ok(res.coverage.classes_missing_members.includes('p2y12_inhibitor'));
  assert.ok(res.coverage.classes_missing_members.includes('oral_anticoagulant'));
});

test('a matched rule with suppresses[] removes the suppressed rule finding (triple-whammy suppresses the pairwise ACEi+NSAID subset alert)', () => {
  const pairwise = {
    rule_id: 'acei__nsaid',
    severity: 'moderate',
    object: { class: 'acei', members: ['ramipril', 'lisinopril'] },
    perpetrator: { class: 'nsaid', members: ['ibuprofen', 'naproxen'] },
    management: { dispense_action: 'confirm_and_monitor', prescriber_action: 'p' },
    context_modifiers: [],
  };
  const triple = {
    rule_id: 'acei_diuretic__nsaid_triple',
    severity: 'major',
    object: {
      combination: [
        { class: 'acei', members: ['ramipril'] },
        { class: 'diuretic', members: ['furosemide'] },
        { class: 'nsaid', members: ['ibuprofen'] },
      ],
    },
    suppresses: ['acei__nsaid'],
    management: { dispense_action: 'withhold_and_clarify', prescriber_action: 'p' },
    context_modifiers: [],
  };
  const rules = [pairwise, triple];
  const two = checkInteractions({ subjects: ['ramipril', 'ibuprofen'], rules }).findings.map((f) => f.rule_id);
  assert.ok(two.includes('acei__nsaid'), 'pairwise fires when the diuretic is absent');
  const three = checkInteractions({ subjects: ['ramipril', 'furosemide', 'ibuprofen'], rules }).findings.map((f) => f.rule_id);
  assert.ok(three.includes('acei_diuretic__nsaid_triple'), 'triple-whammy fires when all three present');
  assert.ok(!three.includes('acei__nsaid'), 'the pairwise subset alert is suppressed by the triple-whammy');

  const multi = checkInteractions({
    subjects: ['ramipril', 'furosemide', 'ibuprofen', 'lisinopril', 'naproxen'],
    rules,
  }).findings;
  const pairwiseFindings = multi.filter((f) => f.rule_id === 'acei__nsaid');
  assert.equal(pairwiseFindings.length, 3);
  assert.ok(pairwiseFindings.some((f) => f.subjects.includes('lisinopril') && f.subjects.includes('naproxen')),
    'the triple-whammy must not suppress an independent occurrence of the same rule ID');
  assert.ok(!pairwiseFindings.some((f) => f.subjects.includes('ramipril') && f.subjects.includes('ibuprofen')),
    'only the pairwise subset covered by the triple-whammy is suppressed');
});

test('pairwise suppresses[] applies to the same pair without hiding a disjoint pair', () => {
  const generic = {
    rule_id: 'victim__inducer',
    severity: 'major',
    object: { drug: 'apixaban' },
    perpetrator: { class: 'inducer', members: ['st john\'s wort', 'carbamazepine'] },
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
  };
  const specific = {
    rule_id: 'st_johns_wort__victim',
    severity: 'major',
    object: { class: 'victim', members: ['apixaban'] },
    perpetrator: { drug: 'st john\'s wort' },
    suppresses: ['victim__inducer'],
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
  };
  const rules = [generic, specific];
  const samePair = checkInteractions({
    subjects: ['apixaban', 'st john\'s wort'],
    rules,
  }).findings.map((f) => f.rule_id);
  assert.deepEqual(samePair, ['st_johns_wort__victim']);

  const disjoint = checkInteractions({
    subjects: ['apixaban', 'st john\'s wort', 'carbamazepine'],
    rules,
  }).findings;
  assert.ok(disjoint.some((f) => f.rule_id === 'victim__inducer'
    && f.subjects.includes('apixaban') && f.subjects.includes('carbamazepine')));
});

test('eGFR cannot satisfy a CrCl predicate, and CrCl cannot satisfy an eGFR predicate', () => {
  const crclRule = {
    rule_id: 'crcl',
    severity: 'moderate',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [{
      factor: 'renal',
      when: 'crcl_lt_30',
      severity: 'contraindicated',
      dispense_action: 'withhold_and_clarify',
      on_unknown: 'escalate',
    }],
  };
  const egfrRule = {
    ...crclRule,
    rule_id: 'egfr',
    context_modifiers: [{
      ...crclRule.context_modifiers[0],
      when: 'egfr_lt_30',
    }],
  };

  const crclMissing = resolveRule(crclRule, { renal: { egfr: 20 } });
  assert.equal(crclMissing.severity, 'moderate');
  assert.deepEqual(crclMissing.data_required.map((item) => item.metric), ['CrCl']);

  const egfrMissing = resolveRule(egfrRule, { renal: { crcl: 20 } });
  assert.equal(egfrMissing.severity, 'moderate');
  assert.deepEqual(egfrMissing.data_required.map((item) => item.metric), ['eGFR']);
});

test('modifier resolution is deterministic when multiple metric-specific branches tie', () => {
  const modifiers = [
    {
      factor: 'renal',
      when: 'egfr_lt_30',
      severity: 'major',
      dispense_action: 'confirm_and_monitor',
      management_override: { prescriber_action: 'eGFR branch' },
      on_unknown: 'base',
    },
    {
      factor: 'renal',
      when: 'crcl_lt_30',
      severity: 'major',
      dispense_action: 'confirm_and_monitor',
      management_override: { prescriber_action: 'CrCl branch' },
      on_unknown: 'base',
    },
  ];
  const rule = {
    rule_id: 'deterministic',
    severity: 'moderate',
    management: { dispense_action: 'supply_with_counselling' },
    context_modifiers: modifiers,
  };
  const context = { renal: { egfr: 20, crcl: 20 } };
  const forward = resolveRule(rule, context);
  const reverse = resolveRule({ ...rule, context_modifiers: [...modifiers].reverse() }, context);
  assert.equal(forward.basis, reverse.basis);
  assert.equal(forward.management.prescriber_action, reverse.management.prescriber_action);
});

test('independent renal metrics cannot let a more-specific eGFR major hide a CrCl contraindication', () => {
  const modifiers = [
    {
      factor: 'renal',
      when: 'egfr_lt_15',
      severity: 'major',
      dispense_action: 'confirm_and_monitor',
      management_override: { prescriber_action: 'eGFR major branch' },
      on_unknown: 'base',
    },
    {
      factor: 'renal',
      when: 'crcl_lt_30',
      severity: 'contraindicated',
      dispense_action: 'withhold_and_clarify',
      management_override: { prescriber_action: 'CrCl contraindication branch' },
      on_unknown: 'escalate',
    },
  ];
  const rule = {
    rule_id: 'mixed-renal-metrics',
    severity: 'moderate',
    management: { dispense_action: 'supply_with_counselling' },
    context_modifiers: modifiers,
  };
  const patientContext = { renal: { egfr: 10, crcl: 20 } };

  for (const context_modifiers of [modifiers, [...modifiers].reverse()]) {
    const result = resolveRule({ ...rule, context_modifiers }, patientContext);
    assert.equal(result.severity, 'contraindicated');
    assert.equal(result.dispense_action, 'withhold_and_clarify');
    assert.equal(result.basis, 'present:crcl_lt_30');
    assert.equal(result.management.prescriber_action, 'CrCl contraindication branch');
  }
});

test('rule evaluation rejects invalid clinical enums, factors, and predicates', () => {
  const base = {
    rule_id: 'invalid',
    severity: 'moderate',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
  };
  assert.throws(() => resolveRule({ ...base, severity: 'critical' }), /invalid severity/i);
  assert.throws(
    () => resolveRule({ ...base, management: { dispense_action: 'continue' } }),
    /invalid dispense_action/i,
  );
  assert.throws(
    () => resolveRule({
      ...base,
      context_modifiers: [{
        factor: 'cardiac',
        when: 'egfr_lt_30',
        severity: 'major',
        on_unknown: 'base',
      }],
    }),
    /invalid context factor/i,
  );
  assert.throws(
    () => resolveRule({
      ...base,
      context_modifiers: [{
        factor: 'renal',
        when: 'egfr_near_30',
        severity: 'major',
        on_unknown: 'base',
      }],
    }),
    /invalid context predicate/i,
  );
});

test('the runtime-only API requires promoted, complete, independently approved rules', () => {
  const makeRule = (rule_id, runtime_enabled) => ({
    rule_id,
    object: { drug: 'a', route: ['oral'], formulation: ['tablet'] },
    perpetrator: { drug: 'b', route: ['oral'], formulation: ['tablet'] },
    severity: 'major',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
    applicability: { jurisdiction: ['US'] },
    review: {
      status: 'clinician_reviewed',
      author: 'clinician:author',
      approver: 'clinician:approver',
      reviewed_at: '2026-07-22',
      source_versions: ['openfda-labels:set-id:1'],
    },
    evidence: [{
      source_policy_id: 'openfda-labels',
      document_id: 'set-id',
      document_version: '1',
      retrieved_at: '2026-07-21',
      review_status: 'clinician_reviewed',
    }],
    ...(runtime_enabled === undefined ? {} : {
      runtime_enabled,
      runtime_status: {
        pair_matcher_executable: true,
        clinical_context_complete: true,
        runtime_enabled,
        promotion_eligible: true,
      },
    }),
  });
  const subjects = [
    { drug: 'a', route: 'oral', formulation: 'tablet' },
    { drug: 'b', route: 'oral', formulation: 'tablet' },
  ];
  const result = checkRuntimeInteractions({
    subjects,
    rules: [makeRule('enabled', true), makeRule('diagnostic', false)],
    patientContext: { jurisdiction: 'US' },
  });
  assert.deepEqual(result.findings.map((finding) => finding.rule_id), ['enabled']);
  assert.equal(result.coverage.rules_total, 1);
  assert.equal(result.coverage.interaction_knowledge, 'partial');
  assert.equal(result.coverage.overall, 'partial');

  const diagnosticOnly = checkRuntimeInteractions({
    subjects,
    rules: [makeRule('diagnostic-only', false)],
    patientContext: { jurisdiction: 'US' },
  });
  assert.deepEqual(diagnosticOnly.findings, []);
  assert.equal(diagnosticOnly.coverage.rules_total, 0);
  assert.equal(diagnosticOnly.coverage.interaction_knowledge, 'unknown');
  assert.equal(diagnosticOnly.coverage.overall, 'unknown');

  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [makeRule('omitted')],
      patientContext: { jurisdiction: 'US' },
    }),
    /runtime_enabled must be a boolean/i,
  );
  const malformedTopLevelStatus = makeRule('malformed-top-level-status', false);
  malformedTopLevelStatus.runtime_enabled = 'false';
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [malformedTopLevelStatus],
      patientContext: { jurisdiction: 'US' },
    }),
    /runtime_enabled must be a boolean/i,
  );
  const malformedDiagnosticStatus = makeRule('malformed-diagnostic-status', false);
  malformedDiagnosticStatus.runtime_status.runtime_enabled = 'false';
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [makeRule('enabled-before-malformed', true), malformedDiagnosticStatus],
      patientContext: { jurisdiction: 'US' },
    }),
    /must mirror runtime_status\.runtime_enabled.*boolean/i,
  );
  const mismatchedDiagnosticStatus = makeRule('mismatched-diagnostic-status', false);
  mismatchedDiagnosticStatus.runtime_status.runtime_enabled = true;
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [mismatchedDiagnosticStatus],
      patientContext: { jurisdiction: 'US' },
    }),
    /must mirror runtime_status\.runtime_enabled.*boolean/i,
  );
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [makeRule('enabled', true)],
    }),
    /jurisdiction is required/i,
  );

  const missingStatus = makeRule('missing-status', true);
  delete missingStatus.runtime_status;
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [missingStatus],
      patientContext: { jurisdiction: 'US' },
    }),
    /must mirror runtime_status\.runtime_enabled/i,
  );

  const unscoped = makeRule('unscoped', true);
  delete unscoped.applicability;
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [unscoped],
      patientContext: { jurisdiction: 'US' },
    }),
    /explicit runtime jurisdiction scope/i,
  );

  for (const [label, mutate, pattern] of [
    [
      'context',
      (rule) => { rule.runtime_status.clinical_context_complete = false; },
      /clinical_context_complete=true/i,
    ],
    [
      'promotion',
      (rule) => { rule.runtime_status.promotion_eligible = false; },
      /promotion_eligible=true/i,
    ],
    [
      'draft',
      (rule) => { rule.proposed_status = 'draft_for_review'; },
      /must omit proposed_status after promotion/i,
    ],
    [
      'invented-proposed-status',
      (rule) => { rule.proposed_status = 'banana'; },
      /must omit proposed_status after promotion/i,
    ],
    [
      'review-status',
      (rule) => { rule.review.status = 'review_candidate'; },
      /review\.status=clinician_reviewed/i,
    ],
    [
      'same-reviewer',
      (rule) => { rule.review.approver = rule.review.author.toUpperCase(); },
      /distinct review\.author and review\.approver/i,
    ],
    [
      'review-date',
      (rule) => { rule.review.reviewed_at = '2026-02-30'; },
      /valid ISO review\.reviewed_at/i,
    ],
    [
      'source-versions',
      (rule) => { rule.review.source_versions = []; },
      /non-empty review\.source_versions/i,
    ],
    [
      'future-review-date',
      (rule) => { rule.review.reviewed_at = '2099-01-01'; },
      /must not be in the future/i,
    ],
    [
      'unreviewed-evidence',
      (rule) => { rule.evidence[0].review_status = 'review_candidate'; },
      /evidence\[0\] requires review_status=clinician_reviewed/i,
    ],
    [
      'invented-source-version',
      (rule) => { rule.review.source_versions = ['openfda-labels:invented:999']; },
      /must exactly bind evidence/i,
    ],
    [
      'review-predates-evidence',
      (rule) => { rule.evidence[0].retrieved_at = '2026-07-23'; },
      /review predates evidence/i,
    ],
    [
      'unmodeled-selector-context',
      (rule) => { rule.object.dose = '10 mg'; },
      /unsupported selector context dose/i,
    ],
    [
      'initiation-direction',
      (rule) => { rule.management.action_target = 'newly_added_perpetrator'; },
      /requires medication initiation direction/i,
    ],
  ]) {
    const candidate = makeRule(label, true);
    mutate(candidate);
    assert.throws(
      () => checkRuntimeInteractions({
        subjects,
        rules: [candidate],
        patientContext: { jurisdiction: 'US' },
      }),
      pattern,
      label,
    );
  }

  assert.throws(
    () => checkRuntimeInteractions({
      subjects: ['a', 'b'],
      rules: [makeRule('strings', true)],
      patientContext: { jurisdiction: 'US' },
    }),
    /require structured subjects/i,
  );
  assert.throws(
    () => checkRuntimeInteractions({
      subjects: [
        { drug: 'a', route: 'systemic', formulation: 'tablet' },
        { drug: 'b', route: 'oral', formulation: 'tablet' },
      ],
      rules: [makeRule('abstract-route', true)],
      patientContext: { jurisdiction: 'US' },
    }),
    /route "systemic" is not a concrete administration route/i,
  );
  assert.throws(
    () => checkRuntimeInteractions({
      subjects: [
        { drug: 'a', route: 'oral', formulation: 'immediate_release' },
        { drug: 'b', route: 'oral', formulation: 'tablet' },
      ],
      rules: [makeRule('abstract-form', true)],
      patientContext: { jurisdiction: 'US' },
    }),
    /formulation "immediate_release" is not a concrete dose form/i,
  );
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [makeRule('external-members', true)],
      memberSets: { external_class: { any: ['x'] } },
      patientContext: { jurisdiction: 'US' },
    }),
    /reject external memberSets/i,
  );
  const indicationScoped = makeRule('indication', true);
  indicationScoped.applicability.indication = ['some_free_text_indication'];
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [indicationScoped],
      patientContext: { jurisdiction: 'US' },
    }),
    /without a reviewed terminology mapping/i,
  );
  const overlappingRoles = makeRule('overlapping-roles', true);
  overlappingRoles.object = {
    class: 'left',
    members: ['a', 'b'],
    route: ['oral'],
    formulation: ['tablet'],
  };
  overlappingRoles.perpetrator = {
    class: 'right',
    members: ['a', 'b'],
    route: ['oral'],
    formulation: ['tablet'],
  };
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [overlappingRoles],
      patientContext: { jurisdiction: 'US' },
    }),
    /overlapping runtime role selectors/i,
  );
  const externalClass = makeRule('unpinned-class', true);
  externalClass.perpetrator = {
    class: 'external',
    route: ['oral'],
    formulation: ['tablet'],
  };
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [externalClass],
      patientContext: { jurisdiction: 'US' },
    }),
    /requires an inline pinned members roster/i,
  );
  const emptyEffectiveClass = makeRule('empty-effective-class', true);
  emptyEffectiveClass.perpetrator = {
    class: 'pinned',
    members: ['ciclosporin'],
    member_exceptions: ['cyclosporine'],
    route: ['oral'],
    formulation: ['tablet'],
  };
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [emptyEffectiveClass],
      patientContext: { jurisdiction: 'US' },
    }),
    /empty effective canonical roster after member_exceptions/i,
  );

  const cartesianPresentation = makeRule('cartesian-presentation', true);
  cartesianPresentation.object = {
    drug: 'a',
    route: ['intravenous', 'oral'],
    formulation: ['oral_tablet'],
  };
  assert.throws(
    () => checkRuntimeInteractions({
      subjects: [
        { drug: 'a', route: 'intravenous', formulation: 'tablet' },
        subjects[1],
      ],
      rules: [cartesianPresentation],
      patientContext: { jurisdiction: 'US' },
    }),
    /route must select exactly one concrete route/i,
  );
  const multipleFormulations = makeRule('multiple-formulations', true);
  multipleFormulations.object.formulation = ['tablet', 'capsule'];
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [multipleFormulations],
      patientContext: { jurisdiction: 'US' },
    }),
    /formulation must select exactly one concrete formulation/i,
  );

  const missingOwnership = makeRule('missing-ownership', true);
  missingOwnership.severity = 'contraindicated';
  missingOwnership.management.dispense_action = 'withhold_and_clarify';
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [missingOwnership],
      patientContext: { jurisdiction: 'US' },
    }),
    /management\.action_target must be object_drug or perpetrator_drug/i,
  );
  const invalidOwnership = structuredClone(missingOwnership);
  invalidOwnership.rule_id = 'invalid-ownership';
  invalidOwnership.management.action_target = 'perpetrator';
  invalidOwnership.management.do_not_interrupt = ['object_drug'];
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [invalidOwnership],
      patientContext: { jurisdiction: 'US' },
    }),
    /management\.action_target must be object_drug or perpetrator_drug/i,
  );
  const unprotectedOwnership = structuredClone(missingOwnership);
  unprotectedOwnership.rule_id = 'unprotected-ownership';
  unprotectedOwnership.management.action_target = 'perpetrator_drug';
  unprotectedOwnership.management.do_not_interrupt = [];
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [unprotectedOwnership],
      patientContext: { jurisdiction: 'US' },
    }),
    /management\.do_not_interrupt must contain exactly one role-bound/i,
  );
  const contradictoryOwnership = structuredClone(missingOwnership);
  contradictoryOwnership.rule_id = 'contradictory-ownership';
  contradictoryOwnership.management.action_target = 'perpetrator_drug';
  contradictoryOwnership.management.do_not_interrupt = ['perpetrator_drug'];
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [contradictoryOwnership],
      patientContext: { jurisdiction: 'US' },
    }),
    /cannot both target and protect perpetrator_drug/i,
  );
  const validOwnership = structuredClone(missingOwnership);
  validOwnership.rule_id = 'valid-ownership';
  validOwnership.management.action_target = 'perpetrator_drug';
  validOwnership.management.do_not_interrupt = ['object_drug'];
  const ownedFinding = checkRuntimeInteractions({
    subjects,
    rules: [validOwnership],
    patientContext: { jurisdiction: 'US' },
  }).findings[0];
  assert.equal(ownedFinding.action_target, 'perpetrator_drug');
  assert.deepEqual(ownedFinding.do_not_interrupt, ['object_drug']);

  const modifierWithhold = makeRule('modifier-withhold', true);
  modifierWithhold.context_modifiers = [{
    factor: 'renal',
    when: 'crcl_lt_30',
    severity: 'contraindicated',
    dispense_action: 'withhold_and_clarify',
    on_unknown: 'escalate',
  }];
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [modifierWithhold],
      patientContext: { jurisdiction: 'US', renal: { crcl: 20 } },
    }),
    /management\.action_target must be object_drug or perpetrator_drug/i,
  );
  const unsafeModifierOwnership = structuredClone(modifierWithhold);
  unsafeModifierOwnership.rule_id = 'unsafe-modifier-ownership';
  unsafeModifierOwnership.management.action_target = 'perpetrator_drug';
  unsafeModifierOwnership.management.do_not_interrupt = ['object_drug'];
  unsafeModifierOwnership.context_modifiers[0].management_override = {
    action_target: 'object_drug',
  };
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [unsafeModifierOwnership],
      patientContext: { jurisdiction: 'US', renal: { crcl: 20 } },
    }),
    /context modifier crcl_lt_30 cannot both target and protect object_drug/i,
  );
  const combination = makeRule('combination', true);
  combination.object = {
    combination: [
      { drug: 'a' },
      { drug: 'c' },
    ],
    route: ['oral'],
    formulation: ['tablet'],
    match_semantics: 'all_of_present',
  };
  assert.throws(
    () => checkRuntimeInteractions({
      subjects,
      rules: [combination],
      patientContext: { jurisdiction: 'US' },
    }),
    /manual-review only and cannot be runtime promoted/i,
  );
});

test('route and formulation scope is exact, tri-state, and fail-closed', () => {
  const rule = {
    rule_id: 'oral_tablet',
    object: { drug: 'a', route: ['oral'], formulation: ['tablet'] },
    perpetrator: { drug: 'b', route: ['oral'], formulation: ['tablet'] },
    severity: 'major',
    management: {
      dispense_action: 'confirm_and_monitor',
      action_target: 'perpetrator',
      prescriber_action: 'Scoped action.',
    },
    context_modifiers: [],
    applicability: { jurisdiction: ['US'] },
    runtime_enabled: true,
  };

  const stringFinding = checkInteractions({
    subjects: ['a', 'b'],
    rules: [rule],
    patientContext: { jurisdiction: 'US' },
  }).findings[0];
  assert.equal(stringFinding.clinical_action_status, 'unresolved_pending_route_or_formulation');
  assert.equal(stringFinding.dispense_action, 'withhold_and_clarify');
  assert.deepEqual(stringFinding.management, {});
  assert.deepEqual(
    stringFinding.data_required.map((entry) => entry.factor),
    ['route', 'formulation', 'route', 'formulation'],
  );

  const exact = checkInteractions({
    subjects: [
      { drug: 'a', route: 'oral', formulation: 'tablet' },
      { drug: 'b', route: 'oral', formulation: 'tablet' },
    ],
    rules: [rule],
    patientContext: { jurisdiction: 'US' },
  }).findings[0];
  assert.equal(exact.dispense_action, 'confirm_and_monitor');
  assert.equal(exact.management.prescriber_action, 'Scoped action.');
  assert.deepEqual(exact.subject_roles, {
    object: { drug: 'a', route: 'oral', formulation: 'tablet' },
    perpetrator: { drug: 'b', route: 'oral', formulation: 'tablet' },
  });

  const wrongRoute = checkInteractions({
    subjects: [
      { drug: 'a', route: 'intravenous', formulation: 'tablet' },
      { drug: 'b', route: 'oral', formulation: 'tablet' },
    ],
    rules: [rule],
    patientContext: { jurisdiction: 'US' },
  });
  assert.deepEqual(wrongRoute.findings, []);

  const ambiguousForm = checkInteractions({
    subjects: [
      { drug: 'a', route: 'oral', formulation: 'immediate_release_tablet' },
      { drug: 'b', route: 'oral', formulation: 'tablet' },
    ],
    rules: [rule],
    patientContext: { jurisdiction: 'US' },
  }).findings[0];
  assert.equal(
    ambiguousForm.clinical_action_status,
    'unresolved_pending_route_or_formulation',
  );
  assert.deepEqual(
    ambiguousForm.data_required.filter((entry) => entry.factor === 'formulation')
      .map((entry) => entry.metric),
    ['formulation for a'],
  );

  const broadRoute = {
    ...rule,
    rule_id: 'systemic',
    object: { ...rule.object, route: ['systemic'] },
  };
  const broadUnknown = checkInteractions({
    subjects: [
      { drug: 'a', route: 'oral', formulation: 'tablet' },
      { drug: 'b', route: 'oral', formulation: 'tablet' },
    ],
    rules: [broadRoute],
    patientContext: { jurisdiction: 'US' },
  }).findings[0];
  assert.equal(broadUnknown.clinical_action_status, 'unresolved_pending_route_or_formulation');
});

test('structured subject aliases are exact and distinct route/form instances survive deduplication', () => {
  const rule = {
    rule_id: 'iv_combo',
    object: { drug: 'a', route: ['iv'], formulation: ['fixed_combination'] },
    perpetrator: { drug: 'b', route: ['oral'], formulation: ['tablet'] },
    severity: 'major',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
  };
  const result = checkInteractions({
    subjects: [
      { drug: 'a', route: 'intravenous', formulation: 'fixed_dose_combination' },
      { drug: 'a', route: 'oral', formulation: 'fixed_dose_combination' },
      { drug: 'b', route: 'oral', formulation: 'tablet' },
    ],
    rules: [rule],
  });
  assert.equal(result.pairs_checked, 3);
  assert.equal(result.findings.length, 1);
  assert.deepEqual(result.findings[0].subject_roles.object, {
    drug: 'a',
    route: 'intravenous',
    formulation: 'fixed_dose_combination',
  });

  assert.throws(
    () => checkInteractions({
      subjects: [
        { drug: 'a', route: 'intraocular_typo', formulation: 'tablet' },
        { drug: 'b', route: 'oral', formulation: 'tablet' },
      ],
      rules: [rule],
    }),
    /unsupported route "intraocular_typo"/i,
  );
  assert.throws(
    () => checkInteractions({
      subjects: [
        { drug: 'a', route: 'oral', formulation: 'tablet', dose: '10 mg' },
        { drug: 'b', route: 'oral', formulation: 'tablet' },
      ],
      rules: [rule],
    }),
    /unknown property dose/i,
  );
});

test('composite formulation tokens are canonicalized and route/drug coherence is enforced', () => {
  const rule = {
    rule_id: 'oral_solution',
    object: { drug: 'a', route: ['oral'], formulation: ['solution'] },
    perpetrator: { drug: 'b', route: ['oral'], formulation: ['tablet'] },
    severity: 'major',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
  };
  const finding = checkInteractions({
    subjects: [
      { drug: 'a', route: 'oral', formulation: 'oral_solution' },
      { drug: 'b', route: 'oral', formulation: 'tablet' },
    ],
    rules: [rule],
  }).findings[0];
  assert.equal(finding.rule_id, 'oral_solution');
  assert.equal(finding.subject_roles.object.formulation, 'solution');

  assert.throws(
    () => checkInteractions({
      subjects: [
        { drug: 'a', route: 'intravenous', formulation: 'oral_tablet' },
        { drug: 'b', route: 'oral', formulation: 'tablet' },
      ],
      rules: [rule],
    }),
    /formulation "oral_tablet" requires route "oral"/i,
  );
  assert.throws(
    () => checkInteractions({
      subjects: [
        { drug: 'naproxen', route: 'intravenous', formulation: 'ibuprofen_injection' },
        { drug: 'b', route: 'oral', formulation: 'tablet' },
      ],
      rules: [rule],
    }),
    /formulation "ibuprofen_injection" requires drug "ibuprofen"/i,
  );
});

test('ambiguous object/perpetrator role orientation is unresolved and deterministic', () => {
  const rule = {
    rule_id: 'overlap',
    object: { class: 'left', members: ['x', 'y'] },
    perpetrator: { class: 'right', members: ['x', 'y'] },
    severity: 'major',
    management: {
      dispense_action: 'withhold_and_clarify',
      action_target: 'object_drug',
    },
    context_modifiers: [],
  };
  const forward = checkInteractions({ subjects: ['x', 'y'], rules: [rule] }).findings[0];
  const reversed = checkInteractions({ subjects: ['y', 'x'], rules: [rule] }).findings[0];
  for (const finding of [forward, reversed]) {
    assert.equal(finding.clinical_action_status, 'unresolved_pending_subject_role');
    assert.equal(finding.action_target, null);
    assert.deepEqual(finding.management, {});
  }
  assert.deepEqual(forward.subject_roles, reversed.subject_roles);
});

test('a concrete local route remains unresolved against abstract systemic scope', () => {
  const systemic = {
    rule_id: 'beta_blocker__verapamil',
    object: { class: 'beta_blocker', members: ['timolol'], route: ['systemic'] },
    perpetrator: { drug: 'verapamil', route: ['oral'] },
    severity: 'major',
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
  };
  const oral = {
    rule_id: 'domperidone__inhibitor',
    object: { drug: 'domperidone', route: ['oral'] },
    perpetrator: { drug: 'ketoconazole', route: ['systemic'] },
    severity: 'contraindicated',
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
  };
  const abstractScope = checkInteractions({
    subjects: [
      { drug: 'timolol', route: 'ophthalmic', formulation: 'solution' },
      { drug: 'verapamil', route: 'oral', formulation: 'tablet' },
    ],
    rules: [systemic],
  }).findings[0];
  assert.equal(
    abstractScope.clinical_action_status,
    'unresolved_pending_route_or_formulation',
  );
  assert.deepEqual(abstractScope.management, {});
  assert.deepEqual(checkInteractions({
    subjects: [
      { drug: 'domperidone', route: 'rectal', formulation: 'suppository' },
      { drug: 'ketoconazole', route: 'oral', formulation: 'tablet' },
    ],
    rules: [oral],
  }).findings, []);
});

test('unresolved scoped rules neither displace nor suppress fully applicable findings', () => {
  const genericRule = {
    rule_id: 'generic',
    object: { class: 'victim', members: ['a'] },
    perpetrator: { drug: 'b' },
    severity: 'moderate',
    management: { dispense_action: 'supply_with_counselling' },
    context_modifiers: [],
    runtime_enabled: true,
  };
  const scopedRule = {
    ...genericRule,
    rule_id: 'specific',
    object: { drug: 'a', route: ['oral'] },
    severity: 'major',
    management: { dispense_action: 'withhold_and_clarify' },
    suppresses: ['generic'],
  };
  const findings = checkInteractions({
    subjects: ['a', 'b'],
    rules: [genericRule, scopedRule],
  }).findings;
  assert.deepEqual(
    findings.map((finding) => finding.rule_id).sort(),
    ['generic', 'specific'],
  );
  assert.equal(
    findings.find((finding) => finding.rule_id === 'specific').clinical_action_status,
    'unresolved_pending_route_or_formulation',
  );
  assert.equal(
    findings.find((finding) => finding.rule_id === 'generic').dispense_action,
    'supply_with_counselling',
  );
});

test('mutually exclusive unresolved route branches remain individually visible', () => {
  const base = {
    object: { drug: 'haloperidol' },
    perpetrator: { class: 'qt_agent', members: ['amiodarone'] },
    severity: 'major',
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
    runtime_enabled: false,
  };
  const findings = checkInteractions({
    subjects: ['haloperidol', 'amiodarone'],
    rules: [
      {
        ...base,
        rule_id: 'haloperidol_iv',
        object: {
          drug: 'haloperidol',
          route: ['intravenous'],
          formulation: ['injection'],
        },
      },
      {
        ...base,
        rule_id: 'haloperidol_oral',
        object: {
          drug: 'haloperidol',
          route: ['oral'],
          formulation: ['tablet'],
        },
      },
    ],
  }).findings;
  assert.equal(findings.length, 2);
  assert.deepEqual(
    findings.map((finding) => finding.rule_id).sort(),
    ['haloperidol_iv', 'haloperidol_oral'],
  );
  for (const finding of findings) {
    assert.equal(finding.clinical_action_status, 'unresolved_pending_route_or_formulation');
    assert.deepEqual(finding.management, {});
    assert.equal(finding.action_target, null);
  }
});

test('n-ary outer route and formulation scopes are enforced', () => {
  const rule = {
    rule_id: 'scoped_combo',
    object: {
      combination: [{ drug: 'aspirin' }, { drug: 'clopidogrel' }],
      route: ['oral'],
      formulation: ['tablet'],
    },
    perpetrator: { drug: 'warfarin', route: ['oral'], formulation: ['tablet'] },
    severity: 'major',
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
  };
  assert.deepEqual(checkInteractions({
    subjects: [
      { drug: 'aspirin', route: 'intravenous', formulation: 'injection' },
      { drug: 'clopidogrel', route: 'oral', formulation: 'tablet' },
      { drug: 'warfarin', route: 'oral', formulation: 'tablet' },
    ],
    rules: [rule],
  }).findings, []);
  assert.equal(checkInteractions({
    subjects: [
      { drug: 'aspirin', route: 'oral', formulation: 'tablet' },
      { drug: 'clopidogrel', route: 'oral', formulation: 'tablet' },
      { drug: 'warfarin', route: 'oral', formulation: 'tablet' },
    ],
    rules: [rule],
  }).findings.length, 1);
});

test('jurisdiction scope gates known contexts and strips action details when unknown', () => {
  const rule = {
    rule_id: 'us_only',
    object: { drug: 'a' },
    perpetrator: { drug: 'b' },
    severity: 'moderate',
    management: {
      dispense_action: 'supply_with_counselling',
      action_target: 'newly_added_perpetrator',
      do_not_interrupt: ['object_drug'],
      prescriber_action: 'US-label-specific action',
      monitoring: 'US-label-specific monitoring',
    },
    context_modifiers: [],
    applicability: { jurisdiction: ['US'] },
    runtime_enabled: true,
  };

  const unknown = checkInteractions({
    subjects: ['a', 'b'],
    rules: [rule],
  }).findings[0];
  assert.equal(unknown.clinical_action_status, 'unresolved_pending_jurisdiction');
  assert.equal(unknown.dispense_action, 'withhold_and_clarify');
  assert.deepEqual(unknown.management, {});
  assert.equal(unknown.action_target, null);
  assert.deepEqual(unknown.do_not_interrupt, []);
  assert.deepEqual(unknown.jurisdiction_scope, ['US']);
  assert.deepEqual(
    unknown.data_required.filter((item) => item.factor === 'jurisdiction'),
    [{
      factor: 'jurisdiction',
      metric: 'regulatory jurisdiction',
      reason: 'jurisdiction-specific action requires one of: US',
      options: ['US'],
    }],
  );

  const us = checkInteractions({
    subjects: ['a', 'b'],
    rules: [rule],
    patientContext: { jurisdiction: 'us' },
  }).findings[0];
  assert.equal(us.dispense_action, 'supply_with_counselling');
  assert.equal(us.management.prescriber_action, 'US-label-specific action');

  const india = checkInteractions({
    subjects: ['a', 'b'],
    rules: [rule],
    patientContext: { jurisdiction: 'IN' },
  });
  assert.deepEqual(india.findings, []);

  assert.throws(
    () => checkInteractions({
      subjects: ['a', 'b'],
      rules: [rule],
      patientContext: { jurisdiction: 'CA' },
    }),
    /jurisdiction must be IN, US, UK, or EU/i,
  );

  assert.throws(
    () => checkInteractions({
      subjects: ['a', 'b'],
      rules: [rule],
      patientContext: { jurisdiction: 'US', renal: 'unknown' },
    }),
    /patientContext\.renal must be an object/i,
  );
});

test('an unresolved-jurisdiction finding cannot suppress another review finding', () => {
  const target = {
    rule_id: 'target',
    object: { drug: 'a' },
    perpetrator: { drug: 'b' },
    severity: 'moderate',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
    runtime_enabled: true,
  };
  const scopedSuppressor = {
    ...target,
    rule_id: 'scoped_suppressor',
    applicability: { jurisdiction: ['US'] },
    suppresses: ['target'],
  };

  const unknown = checkInteractions({
    subjects: ['a', 'b'],
    rules: [target, scopedSuppressor],
  }).findings;
  assert.deepEqual(
    unknown.map((finding) => finding.rule_id).sort(),
    ['scoped_suppressor', 'target'],
  );

  const resolved = checkInteractions({
    subjects: ['a', 'b'],
    rules: [target, scopedSuppressor],
    patientContext: { jurisdiction: 'US' },
  }).findings;
  assert.deepEqual(resolved.map((finding) => finding.rule_id), ['scoped_suppressor']);
});

test('pair_matcher_executable=false rules cannot emit or suppress diagnostic findings', () => {
  const executable = {
    rule_id: 'executable',
    object: { drug: 'a' },
    perpetrator: { drug: 'b' },
    severity: 'moderate',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
    runtime_enabled: false,
    runtime_status: {
      pair_matcher_executable: true,
      clinical_context_complete: false,
      runtime_enabled: false,
      promotion_eligible: false,
    },
  };
  const nonExecutableSuppressor = {
    ...executable,
    rule_id: 'non_executable',
    suppresses: ['executable'],
    runtime_status: {
      ...executable.runtime_status,
      pair_matcher_executable: false,
    },
  };

  const result = checkInteractions({
    subjects: ['a', 'b'],
    rules: [executable, nonExecutableSuppressor],
  });
  assert.deepEqual(result.findings.map((finding) => finding.rule_id), ['executable']);
  assert.equal(result.coverage.rules_total, 1);
});

test('duplicate rule IDs are rejected before matching', () => {
  const rule = {
    rule_id: 'duplicate',
    object: { drug: 'a' },
    perpetrator: { drug: 'b' },
    severity: 'major',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
  };
  assert.throws(
    () => checkInteractions({ subjects: ['a', 'b'], rules: [rule, { ...rule }] }),
    /duplicate rule_id/i,
  );
});

test('invalid suppression graphs and weaker suppressors are rejected before matching', () => {
  const base = {
    object: { drug: 'a' },
    perpetrator: { drug: 'b' },
    severity: 'contraindicated',
    management: { dispense_action: 'withhold_and_clarify' },
    context_modifiers: [],
    runtime_enabled: true,
  };
  assert.throws(
    () => checkInteractions({
      subjects: ['a', 'b'],
      rules: [
        { ...base, rule_id: 'left', suppresses: ['right'] },
        { ...base, rule_id: 'right', suppresses: ['left'] },
      ],
    }),
    /suppression cycle/i,
  );
  assert.throws(
    () => checkInteractions({
      subjects: ['a', 'b'],
      rules: [
        {
          ...base,
          rule_id: 'weak',
          severity: 'minor',
          management: { dispense_action: 'supply_with_counselling' },
          suppresses: ['strong'],
        },
        { ...base, rule_id: 'strong' },
      ],
    }),
    /must not suppress stronger rule "strong"/i,
  );
});

test('coverage honors inline members and reports rule-specific strength bucket gaps', () => {
  const inline = {
    rule_id: 'inline',
    object: { drug: 'a' },
    perpetrator: { class: 'inline_class', members: ['b'] },
    severity: 'major',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
  };
  const missingStrength = {
    ...inline,
    rule_id: 'missing_strength',
    perpetrator: { class: 'inhibitor', strength: ['strong'] },
  };
  const emptyStrength = {
    ...inline,
    rule_id: 'empty_strength',
    perpetrator: { class: 'substrate', strength: ['narrow'] },
  };
  const emptyInline = {
    ...inline,
    rule_id: 'empty_inline',
    perpetrator: { class: 'pinned', members: [] },
  };
  const result = checkInteractions({
    subjects: ['a', 'b'],
    rules: [inline, missingStrength, emptyStrength, emptyInline],
    memberSets: {
      inhibitor: { moderate: ['b'] },
      substrate: { narrow: [] },
    },
  });

  assert.ok(!result.coverage.classes_missing_members.includes('inline_class'));
  assert.deepEqual(result.coverage.member_gaps, [
    {
      rule_id: 'missing_strength',
      class: 'inhibitor',
      strength: 'strong',
      reason: 'missing_strength_bucket',
    },
    {
      rule_id: 'empty_strength',
      class: 'substrate',
      strength: 'narrow',
      reason: 'empty_strength_bucket',
    },
    {
      rule_id: 'empty_inline',
      class: 'pinned',
      reason: 'empty_inline_members',
    },
  ]);
});

test('a suppression edge across runtime status is rejected before evaluation', () => {
  const enabled = {
    rule_id: 'enabled',
    object: { drug: 'a' },
    perpetrator: { drug: 'b' },
    severity: 'major',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
    runtime_enabled: true,
  };
  const diagnostic = {
    ...enabled,
    rule_id: 'diagnostic',
    runtime_enabled: false,
    suppresses: ['enabled'],
  };
  assert.throws(
    () => checkInteractions({
      subjects: ['a', 'b'],
      rules: [enabled, diagnostic],
    }),
    /must not suppress "enabled" across runtime status/i,
  );
});
