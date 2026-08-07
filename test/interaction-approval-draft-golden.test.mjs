// Golden characterization tests for src/lib/interaction-approval-draft.mjs.
//
// These tests pin the module's CURRENT observable behavior verbatim — exact
// error classes and messages (including parser offsets), exact success
// results, snapshot/freezing semantics, and the byte-exact governance and
// checklist strings — so that a structural decomposition of the module can be
// verified to introduce zero behavior change. They read the committed review
// package under docs/interaction-review/ but never write there.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertApprovalEventTemplate,
  assertClinicianReviewRendering,
  assertDraftClinicalRuleSubject,
  assertDraftGovernancePolicy,
  parseDraftApprovalJson,
  validateDraftApprovalPackage,
} from '../src/lib/interaction-approval-draft.mjs';
import * as validatorModule from '../src/lib/interaction-approval-draft.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_DIR = path.join(
  ROOT,
  'docs',
  'interaction-review',
  '2026-07-29-warfarin-cotrimoxazole-vnext',
);
const PACKAGE_FILES = [
  'CLINICIAN-REVIEW.md',
  'approval-event.template.draft.json',
  'governance-policy.internal-evaluation.v1.draft.json',
  'package-status.json',
  'warfarin-cotrimoxazole.rule-subject.v1.draft.json',
];
const PACKAGE_PRESENT = PACKAGE_FILES.every(
  (name) => fs.existsSync(path.join(PACKAGE_DIR, name)),
);

function readJson(name) {
  return parseDraftApprovalJson(
    fs.readFileSync(path.join(PACKAGE_DIR, name), 'utf8'),
    name,
  );
}

function fixtures() {
  return {
    policy: readJson('governance-policy.internal-evaluation.v1.draft.json'),
    subject: readJson('warfarin-cotrimoxazole.rule-subject.v1.draft.json'),
    template: readJson('approval-event.template.draft.json'),
    status: readJson('package-status.json'),
    review: fs.readFileSync(path.join(PACKAGE_DIR, 'CLINICIAN-REVIEW.md'), 'utf8'),
  };
}

function assertThrowsExact(fn, constructor, message) {
  assert.throws(fn, (error) => {
    assert.equal(error.constructor, constructor);
    assert.equal(error.message, message);
    return true;
  });
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

test('golden: module exports exactly the six public validator functions', () => {
  assert.deepEqual(Object.keys(validatorModule).sort(), [
    'assertApprovalEventTemplate',
    'assertClinicianReviewRendering',
    'assertDraftClinicalRuleSubject',
    'assertDraftGovernancePolicy',
    'parseDraftApprovalJson',
    'validateDraftApprovalPackage',
  ]);
});

test('golden: parseDraftApprovalJson accepts valid JSON with exact values', () => {
  assert.deepEqual(
    parseDraftApprovalJson(
      ' {"a": [1, -2.5, 1.5e2, true, false, null], "b": {"c": "d\\ne\\u00e9"}, "e": []} ',
    ),
    { a: [1, -2.5, 150, true, false, null], b: { c: 'd\neé' }, e: [] },
  );
  assert.deepEqual(parseDraftApprovalJson('{}'), {});
  assert.deepEqual(parseDraftApprovalJson('[]'), []);
  assert.equal(parseDraftApprovalJson('null'), null);
  assert.equal(parseDraftApprovalJson('true'), true);
  assert.equal(parseDraftApprovalJson('false'), false);
  assert.equal(parseDraftApprovalJson('"x"'), 'x');
  assert.equal(parseDraftApprovalJson('-0.25'), -0.25);
  assert.equal(parseDraftApprovalJson('\t\r\n 7 \t\r\n'), 7);
});

test('golden: parseDraftApprovalJson keeps hostile keys as plain own properties', () => {
  const parsed = parseDraftApprovalJson(
    '{"__proto__": {"polluted": true}, "constructor": 1}',
  );
  assert.equal(Object.hasOwn(parsed, '__proto__'), true);
  assert.equal(Object.hasOwn(parsed, 'constructor'), true);
  assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
  assert.equal({}.polluted, undefined);
});

test('golden: parseDraftApprovalJson rejects invalid input with exact messages', () => {
  assertThrowsExact(
    () => parseDraftApprovalJson(42),
    TypeError,
    'draft approval JSON: JSON source must be a string',
  );
  assertThrowsExact(
    () => parseDraftApprovalJson(null, 'custom label'),
    TypeError,
    'custom label: JSON source must be a string',
  );
  const syntaxCases = [
    ['{"a":1,"a":2}', 'L: duplicate JSON member "a" at offset 10'],
    ['{"\\u0061":1,"a":2}', 'L: duplicate JSON member "a" at offset 15'],
    ['"\\x"', 'L: invalid string escape at offset 2'],
    ['"\\uZZZZ"', 'L: invalid Unicode escape at offset 2'],
    ['"abc', 'L: unterminated JSON string at offset 4'],
    ['"a\tb"', 'L: unescaped control character in string at offset 2'],
    ['-', 'L: invalid JSON number at offset 0'],
    ['01', 'L: unexpected trailing JSON content at offset 1'],
    ['1e999', 'L: non-finite JSON number at offset 5'],
    ['undefined', 'L: unexpected JSON token at offset 0'],
    ['', 'L: unexpected JSON token at offset 0'],
    ['{"a" 1}', 'L: expected colon after JSON member at offset 5'],
    ['{"a":1 "b":2}', 'L: expected comma or closing brace at offset 7'],
    ['[1 2]', 'L: expected comma or closing bracket at offset 3'],
    ['{} {}', 'L: unexpected trailing JSON content at offset 3'],
  ];
  for (const [source, message] of syntaxCases) {
    assertThrowsExact(() => parseDraftApprovalJson(source, 'L'), SyntaxError, message);
  }
});

test('golden: clinician review rendering hash-binds the exact reviewed bytes', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { review } = fixtures();
  const result = assertClinicianReviewRendering(review);
  assert.deepEqual(result, {
    sha256_profile: 'UTF-8-NFC-LF-no-trailing-LF',
    sha256: '58e83f86cfd16a633f4ba7f4fd72f9e6e7a75f0fca8031b24471ff4b9f332a9b',
  });
  assert.equal(Object.isFrozen(result), true);
  // The declared normalization profile is part of the interface: CRLF and
  // trailing-newline variants of the same rendering hash identically.
  assert.deepEqual(assertClinicianReviewRendering(review.replace(/\n/gu, '\r\n')), result);
  assert.deepEqual(assertClinicianReviewRendering(`${review}\n\n\n`), result);
  assertThrowsExact(
    () => assertClinicianReviewRendering(`${review}\nextra line`),
    TypeError,
    'clinician review rendering: normalized whole-document SHA-256 does not match the reviewed rendering',
  );
  assertThrowsExact(
    () => assertClinicianReviewRendering(12),
    TypeError,
    'clinician review rendering: source must be a string',
  );
});

test('golden: governance policy validator returns a deep-frozen equal snapshot', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { policy } = fixtures();
  const validated = assertDraftGovernancePolicy(policy);
  assert.notEqual(validated, policy);
  assert.deepEqual(validated, policy);
  assertDeepFrozen(validated);
  assert.equal(Object.isFrozen(policy), false);
});

test('golden: governance policy validator rejects drift with exact messages', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { policy } = fixtures();
  const kind = 'draft governance policy';
  const cases = [
    [() => assertDraftGovernancePolicy('nope'), `${kind}: policy must be an object`],
    [
      () => assertDraftGovernancePolicy({ ...policy, evil: true }),
      `${kind}: policy contains unknown evil`,
    ],
    [
      () => assertDraftGovernancePolicy({ ...policy, policy_jcs_sha256: null }),
      `${kind}: policy contains unknown policy_jcs_sha256`,
    ],
    [
      () => {
        const mutated = { ...policy };
        delete mutated.gate_policy;
        assertDraftGovernancePolicy(mutated);
      },
      `${kind}: policy is missing gate_policy`,
    ],
    [
      () => assertDraftGovernancePolicy({ ...policy, schema_id: 'x' }),
      `${kind}: schema_id is not the pinned draft schema`,
    ],
    [
      () => assertDraftGovernancePolicy({ ...policy, schema_version: '9.9.9' }),
      `${kind}: schema_version is not 1.0.0`,
    ],
    [
      () => assertDraftGovernancePolicy({ ...policy, policy_id: 'x' }),
      `${kind}: policy_id is not the internal-evaluation governance policy`,
    ],
    [
      () => assertDraftGovernancePolicy({ ...policy, policy_version: 'x' }),
      `${kind}: policy_version is not the reviewed draft version`,
    ],
    [
      () => assertDraftGovernancePolicy({ ...policy, supersedes_policy_jcs_sha256: 'abc' }),
      `${kind}: the first draft policy must not claim a superseded policy`,
    ],
    [
      () => assertDraftGovernancePolicy({ ...policy, operational_profile: 'production' }),
      `${kind}: operational_profile must be internal-evaluation`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        authority_ceiling: { ...policy.authority_ceiling, clinical_use: true },
      }),
      `${kind}: clinical-use authority must be false`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        authority_ceiling: { ...policy.authority_ceiling, production: true },
      }),
      `${kind}: production authority must be false`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        authority_ceiling: { ...policy.authority_ceiling, deployment: true },
      }),
      `${kind}: deployment authority must be false`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        authority_ceiling: { ...policy.authority_ceiling, shadow: true },
      }),
      `${kind}: authority_ceiling contains unknown shadow`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        canonicalization_profile: { ...policy.canonicalization_profile, method: 'none' },
      }),
      `${kind}: canonicalization_profile.method does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        profile_requirements: {
          ...policy.profile_requirements,
          evaluation_watermark: 'x',
        },
      }),
      `${kind}: profile_requirements.evaluation_watermark does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        status_model: {
          ...policy.status_model,
          independent_dimensions: policy.status_model.independent_dimensions.slice(0, 2),
        },
      }),
      `${kind}: status_model.independent_dimensions.length does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        workflow_contract: {
          ...policy.workflow_contract,
          pending_states: [...policy.workflow_contract.pending_states, 'extra'],
        },
      }),
      `${kind}: workflow_contract.pending_states.length does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        gate_policy: {
          ...policy.gate_policy,
          passing_gates_create_clinical_authority: true,
        },
      }),
      `${kind}: gate_policy.passing_gates_create_clinical_authority does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        trust_profile_bindings: {
          ...policy.trust_profile_bindings,
          signature_profile_id: 'self',
        },
      }),
      `${kind}: trust_profile_bindings.signature_profile_id does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftGovernancePolicy({
        ...policy,
        review_policy: { ...policy.review_policy, signature_profile_resolved: true },
      }),
      `${kind}: review_policy.signature_profile_resolved does not match the fixed draft boundary`,
    ],
  ];
  for (const [mutation, message] of cases) {
    assertThrowsExact(mutation, TypeError, message);
  }
});

test('golden: clinical rule subject validator returns a deep-frozen equal snapshot', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { subject } = fixtures();
  const validated = assertDraftClinicalRuleSubject(subject);
  assert.notEqual(validated, subject);
  assert.deepEqual(validated, subject);
  assertDeepFrozen(validated);
  assert.equal(Object.isFrozen(subject), false);
});

test('golden: clinical rule subject validator rejects drift with exact messages', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { subject } = fixtures();
  const kind = 'draft clinical rule subject';
  const cases = [
    [
      () => assertDraftClinicalRuleSubject({ ...subject, evil: 1 }),
      `${kind}: subject contains unknown evil`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        workflow_requirements: {
          ...subject.workflow_requirements,
          urgent_supply_pathway: {
            ...subject.workflow_requirements.urgent_supply_pathway,
            signature: 'x',
          },
        },
      }),
      `${kind}: subject.workflow_requirements.urgent_supply_pathway must not contain signature`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        clinical_text: {
          ...subject.clinical_text,
          mechanism: `${subject.clinical_text.mechanism} clinician_authorized`,
        },
      }),
      `${kind}: draft subject must not claim clinician_authorized status`,
    ],
    [
      () => assertDraftClinicalRuleSubject({ ...subject, schema_id: 'x' }),
      `${kind}: schema_id is not the pinned clinical-rule subject schema`,
    ],
    [
      () => assertDraftClinicalRuleSubject({ ...subject, schema_version: '2.0.0' }),
      `${kind}: schema_version is not 1.0.0`,
    ],
    [
      () => assertDraftClinicalRuleSubject({ ...subject, rule_family_id: 'x__y' }),
      `${kind}: rule family or subject version is not the reviewed draft`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        supersedes_subject_jcs_sha256: 'abc',
      }),
      `${kind}: draft subject must not claim a superseded subject`,
    ],
    [
      () => assertDraftClinicalRuleSubject({ ...subject, requested_profile: 'production' }),
      `${kind}: requested_profile must be internal-evaluation`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        governance_policy_binding: {
          ...subject.governance_policy_binding,
          policy_jcs_sha256: '0'.repeat(64),
        },
      }),
      `${kind}: governance_policy_binding.policy_jcs_sha256 does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        repository_provenance: {
          ...subject.repository_provenance,
          current_non_authorizing_draft_row_sha256: '0'.repeat(64),
        },
      }),
      `${kind}: repository_provenance.current_non_authorizing_draft_row_sha256 does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        clinical_classification: {
          ...subject.clinical_classification,
          severity: 'contraindicated',
        },
      }),
      `${kind}: clinical_classification.severity does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        temporal_scope: { ...subject.temporal_scope, lookback_days: 14 },
      }),
      `${kind}: lookback_days must remain zero`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        temporal_scope: { ...subject.temporal_scope, mode: 'window' },
      }),
      `${kind}: temporal_scope.mode does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        population_scope: { ...subject.population_scope, age_filter: 'adult' },
      }),
      `${kind}: population_scope.age_filter does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        identity_scope: { ...subject.identity_scope, expected_exact_product_pair_count: 5 },
      }),
      `${kind}: identity scope must require six exact product pairs`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        identity_scope: { ...subject.identity_scope, route: 'intravenous' },
      }),
      `${kind}: identity scope must remain oral tablet only`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        identity_scope: {
          ...subject.identity_scope,
          object: { ...subject.identity_scope.object, ingredient_mapping_id: 'x' },
        },
      }),
      `${kind}: object ingredient mapping is not the reviewed warfarin mapping`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        identity_scope: {
          ...subject.identity_scope,
          object: { ...subject.identity_scope.object, ingredient_id: 'sha256:00' },
        },
      }),
      `${kind}: object identity is not the reviewed exact warfarin identity`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        identity_scope: {
          ...subject.identity_scope,
          object: { ...subject.identity_scope.object, presentation_mapping_ids: [] },
        },
      }),
      `${kind}: object presentation mappings are not the three reviewed warfarin tablets`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        identity_scope: {
          ...subject.identity_scope,
          object: {
            ...subject.identity_scope.object,
            product_assertions: subject.identity_scope.object.product_assertions.slice(0, 2),
          },
        },
      }),
      `${kind}: identity_scope.object.product_assertions must contain exactly 3 entries`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        identity_scope: {
          ...subject.identity_scope,
          object: {
            ...subject.identity_scope.object,
            product_assertions: [...subject.identity_scope.object.product_assertions].reverse(),
          },
        },
      }),
      `${kind}: identity_scope.object.product_assertions order must be deterministic`,
    ],
    [
      () => {
        const assertions = structuredClone(subject.identity_scope.object.product_assertions);
        assertions[0].product_assertion_sha256 = '0'.repeat(64);
        assertDraftClinicalRuleSubject({
          ...subject,
          identity_scope: {
            ...subject.identity_scope,
            object: { ...subject.identity_scope.object, product_assertions: assertions },
          },
        });
      },
      `${kind}: identity_scope.object.product_assertions PMBJP 2141 has invalid product_assertion_sha256`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        identity_scope: {
          ...subject.identity_scope,
          perpetrator: { ...subject.identity_scope.perpetrator, combination_id: 'x' },
        },
      }),
      `${kind}: perpetrator must use the reviewed exact-active-set combination`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        identity_scope: {
          ...subject.identity_scope,
          perpetrator: { ...subject.identity_scope.perpetrator, rxnorm_min_rxcui: '99999' },
        },
      }),
      `${kind}: perpetrator is not the reviewed RxNorm MIN combination identity`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        identity_scope: {
          ...subject.identity_scope,
          perpetrator: {
            ...subject.identity_scope.perpetrator,
            product_assertions:
              [...subject.identity_scope.perpetrator.product_assertions].reverse(),
          },
        },
      }),
      `${kind}: identity_scope.perpetrator.product_assertions order must be deterministic`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        product_pairs: subject.product_pairs.slice(0, 5),
      }),
      `${kind}: subject must enumerate six exact product pairs`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        product_pairs: [...subject.product_pairs].reverse(),
      }),
      `${kind}: product_pairs order must be deterministic`,
    ],
    [
      () => {
        const pairs = structuredClone(subject.product_pairs);
        pairs[0].object_product_id = 'sha256:00';
        assertDraftClinicalRuleSubject({ ...subject, product_pairs: pairs });
      },
      `${kind}: product pair 2141__89 does not bind the reviewed product IDs`,
    ],
    [
      () => {
        const pairs = structuredClone(subject.product_pairs);
        pairs[0].note = 'x';
        assertDraftClinicalRuleSubject({ ...subject, product_pairs: pairs });
      },
      `${kind}: product_pairs entry contains unknown note`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        clinical_text: { ...subject.clinical_text, mechanism: 'Some other mechanism claim.' },
      }),
      `${kind}: clinical_text is missing sulfamethoxazole inhibits CYP2C9`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        clinical_text: {
          ...subject.clinical_text,
          patient_counselling:
            `${subject.clinical_text.patient_counselling} This raises warfarin exposure.`,
        },
      }),
      `${kind}: clinical_text contains an unsupported or unapproved claim`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        clinical_text: { ...subject.clinical_text, mechanism: '  ' },
      }),
      `${kind}: clinical_text.mechanism must be a non-empty string`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        clinical_text: {
          ...subject.clinical_text,
          patient_counselling: `${subject.clinical_text.patient_counselling} Also rest.`,
        },
      }),
      `${kind}: clinical_text.patient_counselling does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        audience_bindings: {
          ...subject.audience_bindings,
          fields_not_in_audience_allowlist: 'allowed',
        },
      }),
      `${kind}: audience_bindings.fields_not_in_audience_allowlist does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        workflow_requirements: {
          ...subject.workflow_requirements,
          free_text_only_resolution_allowed: true,
        },
      }),
      `${kind}: workflow_requirements.free_text_only_resolution_allowed does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        evidence_boundary: { ...subject.evidence_boundary, payload_sha256: '0'.repeat(64) },
      }),
      `${kind}: evidence_boundary.payload_sha256 does not match the fixed draft boundary`,
    ],
    [
      () => {
        const bindings = structuredClone(subject.identity_evidence_bindings);
        bindings.rxnorm_combination_bundle.git_blob_sha256 = 'x';
        assertDraftClinicalRuleSubject({ ...subject, identity_evidence_bindings: bindings });
      },
      `${kind}: identity_evidence_bindings.rxnorm_combination_bundle.git_blob_sha256 does not match the fixed draft boundary`,
    ],
    [
      () => {
        const bindings = structuredClone(subject.identity_evidence_bindings);
        bindings.rxnorm_combination_bundle.committed_blob_content_sha256 = '0'.repeat(64);
        assertDraftClinicalRuleSubject({ ...subject, identity_evidence_bindings: bindings });
      },
      `${kind}: identity_evidence_bindings.rxnorm_combination_bundle.committed_blob_content_sha256 does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        supersession: { ...subject.supersession, supersedes_rule_ids: ['a__b'] },
      }),
      `${kind}: supersession.supersedes_rule_ids.length does not match the fixed draft boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({ ...subject, exclusions: ['nothing'] }),
      `${kind}: exclusions do not match the reviewed fail-closed boundary`,
    ],
    [
      () => assertDraftClinicalRuleSubject({
        ...subject,
        change_control: {
          ...subject.change_control,
          source_or_identity_drift_blocks_promotion: false,
        },
      }),
      `${kind}: change_control.source_or_identity_drift_blocks_promotion does not match the fixed draft boundary`,
    ],
  ];
  for (const [mutation, message] of cases) {
    assertThrowsExact(mutation, TypeError, message);
  }
});

test('golden: approval-event template validator returns a deep-frozen equal snapshot', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { template } = fixtures();
  const validated = assertApprovalEventTemplate(template);
  assert.notEqual(validated, template);
  assert.deepEqual(validated, template);
  assertDeepFrozen(validated);
  assert.equal(Object.isFrozen(template), false);
});

test('golden: approval-event template validator rejects drift with exact messages', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { template } = fixtures();
  const kind = 'draft approval-event template';
  const cases = [
    [
      () => assertApprovalEventTemplate({ ...template, evil: 1 }),
      `${kind}: template contains unknown evil`,
    ],
    [
      () => assertApprovalEventTemplate({ ...template, schema_id: 'x' }),
      `${kind}: schema_id is not the pinned approval-event template schema`,
    ],
    [
      () => assertApprovalEventTemplate({ ...template, schema_version: null }),
      `${kind}: schema_version is not 1.0.0`,
    ],
    [
      () => assertApprovalEventTemplate({ ...template, template_only: false }),
      `${kind}: template_only must be true`,
    ],
    [
      () => assertApprovalEventTemplate({ ...template, event_body_template: 'x' }),
      `${kind}: event_body_template must be an object`,
    ],
    [
      () => assertApprovalEventTemplate({
        ...template,
        event_body_template: { ...template.event_body_template, decision: 'APPROVED' },
      }),
      `${kind}: template decision must remain null`,
    ],
    [
      () => assertApprovalEventTemplate({
        ...template,
        event_body_template: { ...template.event_body_template, event_id: 'evt-1' },
      }),
      `${kind}: event_body_template.event_id does not match the fixed draft boundary`,
    ],
    [
      () => assertApprovalEventTemplate({
        ...template,
        event_body_template: { ...template.event_body_template, promotion_eligible: true },
      }),
      `${kind}: event_body_template contains unknown promotion_eligible`,
    ],
    [
      () => assertApprovalEventTemplate({
        ...template,
        detached_signature_envelope_template: {
          ...template.detached_signature_envelope_template,
          key_status_at_signing: 'valid',
        },
      }),
      `${kind}: detached_signature_envelope_template contains unknown key_status_at_signing`,
    ],
    [
      () => assertApprovalEventTemplate({
        ...template,
        detached_signature_envelope_template: {
          ...template.detached_signature_envelope_template,
          signature_base64: 'forged',
        },
      }),
      `${kind}: detached_signature_envelope_template.signature_base64 does not match the fixed draft boundary`,
    ],
    [
      () => assertApprovalEventTemplate({
        ...template,
        approval_record_template: {
          ...template.approval_record_template,
          canonicalization: 'none',
        },
      }),
      `${kind}: approval_record_template.canonicalization does not match the fixed draft boundary`,
    ],
    [
      () => assertApprovalEventTemplate({
        ...template,
        append_only_store_receipt_template: {
          ...template.append_only_store_receipt_template,
          receipt_body_template: {
            ...template.append_only_store_receipt_template.receipt_body_template,
            sequence: 1,
          },
        },
      }),
      `${kind}: append_only_store_receipt_template.receipt_body_template.sequence does not match the fixed draft boundary`,
    ],
    [
      () => assertApprovalEventTemplate({
        ...template,
        signed_checkpoint_template: {
          ...template.signed_checkpoint_template,
          checkpoint_body_template: {
            ...template.signed_checkpoint_template.checkpoint_body_template,
            through_sequence: 7,
          },
        },
      }),
      `${kind}: signed_checkpoint_template.checkpoint_body_template.through_sequence does not match the fixed draft boundary`,
    ],
  ];
  for (const [mutation, message] of cases) {
    assertThrowsExact(mutation, TypeError, message);
  }
});

test('golden: full package validation returns the exact frozen non-authorizing result', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { policy, subject, template, status, review } = fixtures();
  const result = validateDraftApprovalPackage({
    policy,
    subject,
    eventTemplate: template,
    status,
    clinicianReviewText: review,
  });
  assert.deepEqual(result, {
    package_status: 'draft_non_authorizing',
    structurally_valid: true,
    policy_signoff_ready: false,
    rule_signoff_ready: false,
    promotion_ready: false,
    clinical_use_authority: 'none',
    production_authority: 'none',
    deployment_authority: 'none',
  });
  assert.equal(Object.isFrozen(result), true);
});

test('golden: full package validation rejects drifted inputs with exact messages', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { policy, subject, template, status, review } = fixtures();
  const validate = (overrides) => validateDraftApprovalPackage({
    policy,
    subject,
    eventTemplate: template,
    status,
    clinicianReviewText: review,
    ...overrides,
  });
  assertThrowsExact(
    () => validate({ status: { ...status, promotion_ready: true } }),
    TypeError,
    'draft approval package status: status.promotion_ready does not match the fixed draft boundary',
  );
  assertThrowsExact(
    () => validate({ status: { ...status, clinician_review_sha256: '0'.repeat(64) } }),
    TypeError,
    'draft approval package status: status.clinician_review_sha256 does not match the fixed draft boundary',
  );
  assertThrowsExact(
    () => validate({
      status: {
        ...status,
        required_before_promotion: status.required_before_promotion.slice(0, -1),
      },
    }),
    TypeError,
    'draft approval package status: status.required_before_promotion.length does not match the fixed draft boundary',
  );
  assertThrowsExact(
    () => validate({ clinicianReviewText: `${review}\nThe pharmacy may act alone.` }),
    TypeError,
    'clinician review rendering: normalized whole-document SHA-256 does not match the reviewed rendering',
  );
  assertThrowsExact(
    () => validateDraftApprovalPackage({}),
    TypeError,
    'draft governance policy: policy must be an object',
  );
});

test('golden: governance and checklist strings are pinned byte-for-byte', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { policy, subject, template, status } = fixtures();
  // Deep-strict acceptance of the unchanged committed fixtures already pins
  // every governance string; these direct assertions additionally record the
  // safety-critical wording verbatim so any byte-level drift in either the
  // module or the fixtures names the exact string that moved.
  assert.equal(
    policy.profile_requirements.evaluation_watermark,
    'INTERNAL EVALUATION — NOT FOR CLINICAL USE',
  );
  assert.equal(
    status.required_before_promotion[status.required_before_promotion.length - 1],
    'confirm data-static/interaction-rules.json remains empty',
  );
  assert.deepEqual(status.required_before_promotion.slice(0, 4), [
    'create a new immutable authenticated approval event; do not mutate this template',
    'verify the detached signature against pinned trust and authorization records',
    'append the record to the approved store and retain a valid signed checkpoint',
    'reconcile the non-authorizing JSONL row and pin its new hash',
  ]);
  assert.equal(status.clinician_review_sha256_profile, 'UTF-8-NFC-LF-no-trailing-LF');
  assert.equal(
    template.event_body_template.approval_statement_sha256_profile,
    'UTF-8-NFC-LF-no-trailing-LF',
  );
  assert.equal(
    template.detached_signature_envelope_template.signature_input_domain,
    'aushadhi.approval-event.v1\u0000',
  );
  assert.equal(
    subject.clinical_classification.severity_meaning,
    'a potentially clinically important consequence requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe',
  );
  assert.equal(
    subject.temporal_scope.operational_definition,
    'both exact products are represented in the same current interaction check',
  );
  assert.equal(
    subject.population_scope.meaning,
    'this subject authorizes no adult-only, paediatric-only, or age-derived branch',
  );
  assert.equal(
    subject.workflow_requirements.urgent_supply_pathway.meaning,
    'urgent-supply handling is not authorized by this subject',
  );
  // Each fixture must round-trip through its validator unchanged — the
  // module's expected-value constants therefore byte-match the fixtures.
  assertDraftGovernancePolicy(policy);
  assertDraftClinicalRuleSubject(subject);
  assertApprovalEventTemplate(template);
});

test('golden: validator snapshots read hostile getters exactly once', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const { policy } = fixtures();
  const stateful = structuredClone(policy);
  let reads = 0;
  Object.defineProperty(stateful.authority_ceiling, 'production', {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      return reads === 1 ? false : true;
    },
  });
  const validated = assertDraftGovernancePolicy(stateful);
  assert.equal(validated.authority_ceiling.production, false);
  assert.equal(reads, 1);
  assertDeepFrozen(validated);
});
