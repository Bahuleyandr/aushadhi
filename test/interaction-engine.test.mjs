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

test('a named member exception is NOT matched (#4)', () => {
  const rule = { ...generic, perpetrator: { ...generic.perpetrator, member_exceptions: ['clarithromycin'] } };
  const f = checkPair({ subjects: ['colchicine', 'clarithromycin'], rules: [rule], memberSets: MEMBERS });
  assert.equal(f.length, 0);
});

test('member-specific rule suppresses the generic class rule for the same pair (#6)', () => {
  const specific = {
    rule_id: 'colchicine__clarithromycin', object: { drug: 'colchicine' }, perpetrator: { drug: 'clarithromycin' },
    severity: 'contraindicated', management: { dispense_action: 'withhold_and_clarify' }, context_modifiers: [],
  };
  const f = checkPair({ subjects: ['colchicine', 'clarithromycin'], rules: [generic, specific], memberSets: MEMBERS });
  assert.equal(f.length, 1);
  assert.equal(f[0].rule_id, 'colchicine__clarithromycin');
  assert.equal(f[0].severity, 'contraindicated');
});

import { checkInteractions } from '../src/lib/interaction-engine.mjs';

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

test('coverage scan sees classes nested inside a combination object', () => {
  const rule = {
    rule_id: 'triple3', object: { combination: [{ drug: 'aspirin' }, { class: 'p2y12_inhibitor' }], match_semantics: 'all_of_present' },
    perpetrator: { class: 'oral_anticoagulant' }, severity: 'major', management: {}, context_modifiers: [],
  };
  const res = checkInteractions({ subjects: ['aspirin'], rules: [rule], memberSets: {} });
  assert.ok(res.coverage.classes_missing_members.includes('p2y12_inhibitor'));
  assert.ok(res.coverage.classes_missing_members.includes('oral_anticoagulant'));
});
