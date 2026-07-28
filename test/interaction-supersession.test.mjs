// D1 — combination subjects SUPPLEMENT component subjects.
//
// Recorded decision (2026-07-28):
//
//   Combination subjects supplement component subjects. Duplicate clinical alerts
//   are removed only through explicit rule-family specificity and supersession
//   metadata. No component subject is globally replaced or suppressed merely
//   because a fixed-dose combination subject resolved.
//
// So a co-trimoxazole product may raise a co-trimoxazole subject AND its component
// subjects. Trimethoprim and sulfamethoxazole have their own interactions unrelated
// to the co-trimoxazole rule -- methotrexate + trimethoprim is the standing example --
// and globally replacing components would silently suppress them.
//
// Deduplication therefore happens at the RULE level, not the subject level, and only
// where a reviewer has explicitly declared the overlap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkInteractions } from '../src/lib/interaction-engine.mjs';

const rule = (ruleId, object, perpetrator, extra = {}) => ({
  rule_id: ruleId,
  object: { drug: object, route: ['oral'], formulation: ['tablet'] },
  perpetrator: { drug: perpetrator, route: ['oral'], formulation: ['tablet'] },
  severity: 'major',
  management: { dispense_action: 'confirm_and_monitor' },
  context_modifiers: [],
  applicability: { jurisdiction: ['US'] },
  review: {
    status: 'clinician_reviewed',
    author: 'clinician:author',
    approver: 'clinician:approver',
    reviewed_at: '2026-07-28',
    source_versions: ['openfda-labels:set-id:1'],
  },
  evidence: [{
    source_policy_id: 'openfda-labels',
    document_id: 'set-id',
    document_version: '1',
    retrieved_at: '2026-07-28',
    review_status: 'clinician_reviewed',
  }],
  runtime_enabled: true,
  ...extra,
});

const subject = (drug) => ({ drug, route: 'oral', formulation: 'tablet' });
// the rules are US-scoped, so the jurisdiction must be known. Without it every
// finding is unresolved_pending_jurisdiction, and supersession refuses to hide an
// unresolved finding -- see the last test in this file.
const CONTEXT = { jurisdiction: 'US' };
const ids = (findings) => findings.map((finding) => finding.rule_id).sort();

const ANTICOAG = 'warfarin-anticoagulation-potentiation';

// the combination rule, declared to supersede the component rule it duplicates
const COMBINATION = rule('warfarin__cotrimoxazole', 'warfarin', 'co-trimoxazole', {
  interaction_family_id: ANTICOAG,
  subject_specificity: 'exact_fixed_dose_combination',
  supersedes_rule_ids: ['warfarin__sulfamethoxazole'],
});
const COMPONENT = rule('warfarin__sulfamethoxazole', 'warfarin', 'sulfamethoxazole', {
  interaction_family_id: ANTICOAG,
  subject_specificity: 'exact_member',
});
// an unrelated interaction of the OTHER component, which must survive
const METHOTREXATE = rule('methotrexate__trimethoprim', 'methotrexate', 'trimethoprim', {
  interaction_family_id: 'methotrexate-antifolate-toxicity',
  subject_specificity: 'exact_member',
});

test('a combination subject supplements its component subjects', () => {
  const result = checkInteractions({
    subjects: [
      subject('warfarin'), subject('co-trimoxazole'),
      subject('sulfamethoxazole'), subject('trimethoprim'),
    ],
    rules: [COMBINATION, COMPONENT, METHOTREXATE],
    patientContext: CONTEXT,
  });
  // both the combination and component subjects were evaluated; nothing was dropped
  // at the subject level
  assert.ok(result.pairs_checked > 0);
});

test('the combination rule wins, leaving ONE anticoagulation alert', () => {
  const result = checkInteractions({
    subjects: [subject('warfarin'), subject('co-trimoxazole'), subject('sulfamethoxazole')],
    rules: [COMBINATION, COMPONENT],
    patientContext: CONTEXT,
  });
  assert.deepEqual(ids(result.findings), ['warfarin__cotrimoxazole']);
  const family = result.findings.filter((f) => f.interaction_family_id === ANTICOAG);
  assert.equal(family.length, 1);
});

test('the superseded alert stays visible in the audit trace', () => {
  const result = checkInteractions({
    subjects: [subject('warfarin'), subject('co-trimoxazole'), subject('sulfamethoxazole')],
    rules: [COMBINATION, COMPONENT],
    patientContext: CONTEXT,
  });
  assert.deepEqual(
    result.superseded_findings.map((entry) => ({
      rule_id: entry.rule_id, by: entry.superseded_by,
    })),
    [{ rule_id: 'warfarin__sulfamethoxazole', by: 'warfarin__cotrimoxazole' }],
  );
});

test('an unrelated component interaction is NOT suppressed', () => {
  const result = checkInteractions({
    subjects: [
      subject('warfarin'), subject('co-trimoxazole'),
      subject('sulfamethoxazole'), subject('methotrexate'), subject('trimethoprim'),
    ],
    rules: [COMBINATION, COMPONENT, METHOTREXATE],
    patientContext: CONTEXT,
  });
  assert.ok(ids(result.findings).includes('methotrexate__trimethoprim'));
  assert.deepEqual(ids(result.findings), [
    'methotrexate__trimethoprim', 'warfarin__cotrimoxazole',
  ]);
});

test('supersession requires the SAME victim', () => {
  // same family and an explicit supersedes entry, but the victims differ, so the
  // alerts are not duplicates of one another
  const crossVictim = rule('methotrexate__cotrimoxazole', 'methotrexate', 'co-trimoxazole', {
    interaction_family_id: ANTICOAG,
    subject_specificity: 'exact_fixed_dose_combination',
    supersedes_rule_ids: ['warfarin__sulfamethoxazole'],
  });
  const result = checkInteractions({
    subjects: [
      subject('warfarin'), subject('sulfamethoxazole'),
      subject('methotrexate'), subject('co-trimoxazole'),
    ],
    rules: [crossVictim, COMPONENT],
    patientContext: CONTEXT,
  });
  assert.ok(ids(result.findings).includes('warfarin__sulfamethoxazole'));
  assert.equal(result.superseded_findings.length, 0);
});

test('supersession requires the same interaction family', () => {
  const wrongFamily = rule('warfarin__cotrimoxazole', 'warfarin', 'co-trimoxazole', {
    interaction_family_id: 'some-other-family',
    subject_specificity: 'exact_fixed_dose_combination',
    supersedes_rule_ids: ['warfarin__sulfamethoxazole'],
  });
  const result = checkInteractions({
    subjects: [subject('warfarin'), subject('co-trimoxazole'), subject('sulfamethoxazole')],
    rules: [wrongFamily, COMPONENT],
    patientContext: CONTEXT,
  });
  assert.ok(ids(result.findings).includes('warfarin__sulfamethoxazole'));
  assert.equal(result.superseded_findings.length, 0);
});

test('supersession is never inferred: it must be declared explicitly', () => {
  // identical family, identical victim, higher specificity -- but no
  // supersedes_rule_ids entry, so both alerts stand
  const undeclared = rule('warfarin__cotrimoxazole', 'warfarin', 'co-trimoxazole', {
    interaction_family_id: ANTICOAG,
    subject_specificity: 'exact_fixed_dose_combination',
  });
  const result = checkInteractions({
    subjects: [subject('warfarin'), subject('co-trimoxazole'), subject('sulfamethoxazole')],
    rules: [undeclared, COMPONENT],
    patientContext: CONTEXT,
  });
  assert.deepEqual(ids(result.findings), [
    'warfarin__cotrimoxazole', 'warfarin__sulfamethoxazole',
  ]);
  assert.equal(result.superseded_findings.length, 0);
});

test('a less specific rule may not supersede a more specific one', () => {
  const classRule = rule('warfarin__sulfonamide_class', 'warfarin', 'co-trimoxazole', {
    interaction_family_id: ANTICOAG,
    subject_specificity: 'class',
    supersedes_rule_ids: ['warfarin__sulfamethoxazole'],
  });
  const exact = rule('warfarin__sulfamethoxazole', 'warfarin', 'sulfamethoxazole', {
    interaction_family_id: ANTICOAG,
    subject_specificity: 'exact_member',
  });
  const result = checkInteractions({
    subjects: [subject('warfarin'), subject('co-trimoxazole'), subject('sulfamethoxazole')],
    rules: [classRule, exact],
    patientContext: CONTEXT,
  });
  assert.ok(ids(result.findings).includes('warfarin__sulfamethoxazole'));
  assert.equal(result.superseded_findings.length, 0);
});

test('rules carrying no supersession metadata behave exactly as before', () => {
  const plainA = rule('warfarin__drug_a', 'warfarin', 'drug-a');
  const plainB = rule('warfarin__drug_b', 'warfarin', 'drug-b');
  const result = checkInteractions({
    subjects: [subject('warfarin'), subject('drug-a'), subject('drug-b')],
    rules: [plainA, plainB],
    patientContext: CONTEXT,
  });
  assert.deepEqual(ids(result.findings), ['warfarin__drug_a', 'warfarin__drug_b']);
  assert.deepEqual(result.superseded_findings, []);
});

test('an unresolved finding is never superseded', () => {
  // Without a jurisdiction these US-scoped rules resolve to
  // unresolved_pending_jurisdiction. Hiding an alert whose applicability could not be
  // established would be exactly the wrong failure direction, so both stand.
  const result = checkInteractions({
    subjects: [subject('warfarin'), subject('co-trimoxazole'), subject('sulfamethoxazole')],
    rules: [COMBINATION, COMPONENT],
  });
  assert.ok(result.findings.every((f) => f.clinical_action_status === 'unresolved_pending_jurisdiction'));
  assert.deepEqual(ids(result.findings), [
    'warfarin__cotrimoxazole', 'warfarin__sulfamethoxazole',
  ]);
  assert.equal(result.superseded_findings.length, 0);
});
