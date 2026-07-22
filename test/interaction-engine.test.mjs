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

test('escalate modifier on ABSENT factor lifts severity+action but shows NEUTRAL base management', () => {
  const r = resolveRule(COLCHICINE, {}); // no renal value
  assert.equal(r.severity, 'contraindicated');
  assert.equal(r.dispense_action, 'withhold_and_clarify');
  assert.equal(r.management.prescriber_action, 'Withhold and clarify (neutral base).');
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
