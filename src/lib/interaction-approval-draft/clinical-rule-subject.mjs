// Draft clinical rule subject validation for the reviewed
// warfarin__cotrimoxazole subject. Encodes the clinically reviewed identity
// scope, product pairs, clinical text, audience bindings, workflow
// requirements, and fail-closed exclusions as exhaustive expected-shape
// constants and validates a candidate subject against that fixed boundary.
import { isDeepStrictEqual } from 'node:util';

import {
  assertNoKeyRecursively,
  fail,
  immutableValidatedSnapshot,
  requireExactKeys,
  requireExactObject,
  requireNonEmptyString,
  requireObject,
} from './validation-primitives.mjs';
import { assertAuthorityCeiling } from './authority-ceiling.mjs';

const SUBJECT_KEYS = new Set([
  'schema_id',
  'schema_version',
  'rule_family_id',
  'subject_version',
  'supersedes_subject_jcs_sha256',
  'governance_policy_binding',
  'requested_profile',
  'authority_ceiling',
  'repository_provenance',
  'clinical_classification',
  'temporal_scope',
  'population_scope',
  'identity_scope',
  'product_pairs',
  'clinical_text',
  'audience_bindings',
  'workflow_requirements',
  'evidence_boundary',
  'identity_evidence_bindings',
  'supersession',
  'exclusions',
  'change_control',
]);

const SUBJECT_POLICY_BINDING_KEYS = new Set([
  'policy_id',
  'policy_version',
  'policy_jcs_sha256',
]);
const SUBJECT_REPOSITORY_PROVENANCE_KEYS = new Set([
  'original_review_base',
  'verified_source_repository_base',
  'current_non_authorizing_draft_row_sha256',
]);
const SUBJECT_CLASSIFICATION_KEYS = new Set([
  'severity',
  'severity_meaning',
  'dispense_action',
  'classification_authority',
]);
const SUBJECT_IDENTITY_SCOPE_KEYS = new Set([
  'expected_exact_product_pair_count',
  'object',
  'perpetrator',
  'route',
  'formulation',
]);
const SUBJECT_OBJECT_IDENTITY_KEYS = new Set([
  'binding_kind',
  'ingredient_mapping_id',
  'ingredient_id',
  'presentation_mapping_ids',
  'product_assertions',
]);
const SUBJECT_OBJECT_PRODUCT_KEYS = new Set([
  'pmbjp_code',
  'mapping_id',
  'product_id',
  'product_assertion_sha256',
]);
const SUBJECT_PERPETRATOR_IDENTITY_KEYS = new Set([
  'binding_kind',
  'combination_id',
  'rxnorm_min_rxcui',
  'match_mode',
  'product_assertions',
]);
const SUBJECT_PERPETRATOR_PRODUCT_KEYS = new Set([
  'pmbjp_code',
  'product_id',
  'product_assertion_sha256',
  'rxnorm_scd_rxcui',
  'evidence_alignment',
  'direct_strength_and_dose_form_alignment',
  'direct_pmbjp_product_label_evidence',
  'requires_strength_extrapolation_approval',
  'requires_explicit_clinician_approval',
]);
const SUBJECT_PRODUCT_PAIR_KEYS = new Set([
  'perpetrator_pmbjp_code',
  'perpetrator_product_id',
  'object_pmbjp_code',
  'object_product_id',
]);
const SUBJECT_WORKFLOW_KEYS = new Set([
  'resolution_model',
  'pending_states',
  'terminal_states',
  'terminal_state_requirements',
  'optional_audit_fields',
  'free_text_only_resolution_allowed',
  'urgent_supply_pathway',
]);
const SUBJECT_URGENT_PATHWAY_KEYS = new Set([
  'authority',
  'pathway_id',
  'can_resolve_clinical_review',
  'meaning',
]);
const SUBJECT_IDENTITY_BINDING_KEYS = new Set([
  'rxnorm_combination_bundle',
  'combination_identity_manifest',
  'pmbjp_product_source',
]);
const SUBJECT_RXNORM_BUNDLE_KEYS = new Set([
  'path',
  'committed_blob_content_sha256',
  'git_blob_oid_sha1',
  'rxnorm_release',
  'rxnorm_api_version',
  'authority',
]);
const SUBJECT_COMBINATION_MANIFEST_KEYS = new Set([
  'path',
  'committed_blob_content_sha256',
  'git_blob_oid_sha1',
]);
const SUBJECT_PMBJP_SOURCE_KEYS = new Set([
  'pdf_sha256',
  'xpdf_table_extract_sha256',
  'parsed_ledger_sha256',
  'parsed_row_count',
]);
const SUBJECT_SUPERSESSION_KEYS = new Set([
  'interaction_family_id',
  'subject_specificity',
  'supplements_component_subjects',
  'supersedes_rule_ids',
]);
const SUBJECT_CHANGE_CONTROL_KEYS = new Set([
  'new_approval_required_for',
  'source_or_identity_drift_blocks_promotion',
  'draft_row_reconciliation_required_before_promotion',
]);

const EXPECTED_TEMPORAL_SCOPE = {
  mode: 'current_check_only',
  recent_exposure_trigger_enabled: false,
  lookback_days: 0,
  course_end_inference: 'prohibited',
  operational_definition:
    'both exact products are represented in the same current interaction check',
  missing_or_conflicting_status: 'unresolved',
};

const EXPECTED_POPULATION_SCOPE = {
  mode: 'not_parameterized',
  age_filter: null,
  age_inference: 'prohibited',
  meaning:
    'this subject authorizes no adult-only, paediatric-only, or age-derived branch',
};

const EXPECTED_EVIDENCE_BOUNDARY = {
  evidence_jurisdiction: 'US',
  product_catalogue: 'PMBJP',
  product_market: 'India',
  deployment_jurisdiction: 'none',
  source_policy_id: 'openfda-labels',
  set_id: '7f82e5e0-b627-a3f3-e053-2991aa0abaa5',
  spl_version: 6,
  effective_time: '20260209',
  source_version: 'openfda-labels:7f82e5e0-b627-a3f3-e053-2991aa0abaa5:6',
  payload_sha256: '63dfc42563d6fb406df816f4d801878e9a33bae39cdae3abb01ffe0e0dbb706e',
  fragment_sha256: [
    'c0fb47f494a1a43f71d48d9298a92854e3e9c0de8ec40cd99e032dd3e23b3d02',
    'ab592d24f03eaccf6fcc91f344da320fa27b38226884ae501853bbcd07b62a25',
  ],
};

const EXPECTED_OBJECT_PRODUCTS = new Map([
  ['2141', {
    mapping_id: 'presentation:pmbjp:2141:oral-tablet',
    product_id: 'sha256:d5c2e164ff5144544a122908b964b144e2132b9ff216a66bb3a57b80b944ffca',
    product_assertion_sha256:
      'ed9ac49f1fe53f1f4c720641ad5e1bee54ed362e69e4357f36ffeab9022e76cb',
  }],
  ['2142', {
    mapping_id: 'presentation:pmbjp:2142:oral-tablet',
    product_id: 'sha256:9570b79daed31dd5271ec2021558be191fddfe4e3d1002e66a3383dc1a309548',
    product_assertion_sha256:
      '13e88c7899c9974b4fd1378a47b2b09fa3045199460a02f7b7df6a7cb787e6a5',
  }],
  ['452', {
    mapping_id: 'presentation:pmbjp:452:oral-tablet',
    product_id: 'sha256:a543d303907ce3804debf1784653e97b30ef00f4eebb040d8e89fbfbbfbf4141',
    product_assertion_sha256:
      '7aaa9f346fd2bb665c97551bcfd57bc6c088b5dcb91019769360364014f48b01',
  }],
]);

const EXPECTED_PERPETRATOR_PRODUCTS = new Map([
  ['89', {
    product_id: 'sha256:f3835b624129e57ede72edc56a6106782aa9df2e6f5491ebd09bd0ac9656e03a',
    product_assertion_sha256:
      '91dea78c9c4194164d7dcd131472f801478c0a2268557aae03662fcbb64b7446',
    rxnorm_scd_rxcui: '198335',
    evidence_alignment: 'direct_strength_and_dose_form_alignment',
    direct_strength_and_dose_form_alignment: true,
    direct_pmbjp_product_label_evidence: false,
    requires_strength_extrapolation_approval: false,
    requires_explicit_clinician_approval: true,
  }],
  ['90', {
    product_id: 'sha256:1b8857c5423094122e608d865db146fa2ffc7e434df540a2b0cf8bd821d33521',
    product_assertion_sha256:
      '9f5eb20bf581a8e78decb7adcaa66e532e2098748ba8bc27a63a3483f90b0547',
    rxnorm_scd_rxcui: '142118',
    evidence_alignment: 'strength_extrapolation',
    direct_strength_and_dose_form_alignment: false,
    direct_pmbjp_product_label_evidence: false,
    requires_strength_extrapolation_approval: true,
    requires_explicit_clinician_approval: true,
  }],
]);

const EXPECTED_SUBJECT_POLICY_BINDING = {
  policy_id: 'aushadhi-interaction-governance-internal-evaluation',
  policy_version: '1.0.0-draft',
  policy_jcs_sha256: null,
};

const EXPECTED_SUBJECT_REPOSITORY_PROVENANCE = {
  original_review_base: '80d06815f222e739ca055239c9f92b7b57ebd502',
  verified_source_repository_base: 'a2cdb1dd8291aba73423c220f9e4976459802fdc',
  current_non_authorizing_draft_row_sha256:
    'cfc5c958f5cb939353716b324669906fd5043a1a605ff1d776549299d018004e',
};

const EXPECTED_CLINICAL_CLASSIFICATION = {
  severity: 'major',
  severity_meaning:
    'a potentially clinically important consequence requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe',
  dispense_action: 'confirm_and_monitor',
  classification_authority:
    'proposed_local_clinical_workflow_mapping_requiring_explicit_approval',
};

const EXPECTED_CLINICAL_TEXT = {
  mechanism:
    'Sulfamethoxazole inhibits CYP2C9. The cited U.S. sulfamethoxazole/trimethoprim label reports that the combination may prolong prothrombin time in patients receiving warfarin and directs that coagulation time be reassessed.',
  pharmacy_management_current_check:
    'Verify whether the two selected exact products represent current or intended concurrent use. If current or intended overlap is confirmed, confirm that the prescriber or anticoagulation service has reviewed the combination and arranged a patient-specific PT/INR monitoring plan. The pharmacy must not change a dose or stop either medicine independently.',
  pharmacy_escalation_context:
    'If current or intended overlap is confirmed or cannot be resolved from available information, escalate the finding to the responsible prescriber or anticoagulation service. This context does not authorize the pharmacy to select alternative therapy or independently direct warfarin management.',
  prescriber_information:
    'If current or intended overlap is confirmed, the prescriber or anticoagulation service directs any warfarin review or adjustment and determines patient-specific PT/INR follow-up. No universal monitoring schedule or fixed post-discontinuation interval is asserted.',
  patient_counselling:
    'If current or intended overlap is confirmed, counsel the patient to seek prompt clinical advice for bleeding symptoms and not to stop warfarin without clinical advice.',
};

const EXPECTED_AUDIENCE_BINDINGS = {
  render_allowlist: {
    pharmacy: [
      'mechanism',
      'pharmacy_management_current_check',
      'pharmacy_escalation_context',
      'patient_counselling',
    ],
    prescriber_or_anticoagulation_service: [
      'mechanism',
      'prescriber_information',
      'patient_counselling',
    ],
    patient: [
      'patient_counselling',
    ],
  },
  fields_not_in_audience_allowlist: 'prohibited',
  conditional_render_allowlist: {
    unreviewed_subject_or_identity_unresolved: {
      pharmacy: [],
      prescriber_or_anticoagulation_service: [],
      patient: [],
    },
    reviewed_subject_with_resolved_identity_and_unresolved_exposure: {
      pharmacy: [
        'pharmacy_escalation_context',
      ],
      prescriber_or_anticoagulation_service: [],
      patient: [],
    },
  },
  render_composition: {
    condition_precedence: [
      'unreviewed_subject_or_identity_unresolved',
      'reviewed_subject_with_resolved_identity_and_unresolved_exposure',
      'reviewed_subject_with_resolved_identity_and_resolved_exposure',
    ],
    conditional_with_general_operator: 'intersection',
    general_allowlist_fallback_condition:
      'reviewed_subject_with_resolved_identity_and_resolved_exposure',
    unknown_or_conflicting_condition: 'render_no_clinical_content',
    union_allowed: false,
  },
};

const EXPECTED_WORKFLOW_REQUIREMENTS = {
  resolution_model: 'structured',
  pending_states: [
    'manual_review_required',
    'clinician_confirmation_pending',
    'urgent_supply_escalated',
    'correction_recheck_pending',
  ],
  terminal_states: [
    'review_confirmed',
    'no_concurrent_exposure_verified',
    'order_cancelled',
    'order_corrected_pair_absent_after_recheck',
  ],
  pending_state_requirements: {
    manual_review_required: [
      'concomitant_exposure_status',
    ],
    clinician_confirmation_pending: [
      'confirmation_method',
      'concomitant_exposure_status',
    ],
    urgent_supply_escalated: [
      'concomitant_exposure_status',
      'escalation_reference',
    ],
    correction_recheck_pending: [
      'confirmation_method',
      'concomitant_exposure_status',
      'authorized_order_actor_id',
      'authorized_order_actor_role',
      'trusted_order_event_id',
      'trusted_order_event_store_id',
      'order_correction_reference',
    ],
  },
  terminal_state_requirements: {
    review_confirmed: [
      'responsible_clinician_or_service',
      'confirmation_method',
      'concomitant_exposure_status',
      'monitoring_plan_summary',
    ],
    no_concurrent_exposure_verified: [
      'confirmation_method',
      'concomitant_exposure_status',
      'disposition_rationale',
    ],
    order_cancelled: [
      'confirmation_method',
      'concomitant_exposure_status',
      'authorized_order_actor_id',
      'authorized_order_actor_role',
      'trusted_order_event_id',
      'trusted_order_event_store_id',
      'order_cancellation_reference',
    ],
    order_corrected_pair_absent_after_recheck: [
      'confirmation_method',
      'concomitant_exposure_status',
      'authorized_order_actor_id',
      'authorized_order_actor_role',
      'trusted_order_event_id',
      'trusted_order_event_store_id',
      'order_correction_reference',
      'post_correction_recheck_result',
    ],
  },
  confirmation_method_allowed_values: [
    'responsible_clinician_or_service_confirmation',
    'verified_current_order_or_medication_record',
    'trusted_order_cancellation_event',
    'trusted_order_correction_event',
  ],
  concomitant_exposure_status_allowed_values: [
    'current_or_intended_overlap_confirmed',
    'no_current_or_intended_overlap_verified',
    'order_cancelled_before_overlap',
    'corrected_order_pair_absent_after_recheck',
    'unresolved',
  ],
  state_exposure_status_compatibility: {
    manual_review_required: [
      'unresolved',
    ],
    clinician_confirmation_pending: [
      'current_or_intended_overlap_confirmed',
    ],
    urgent_supply_escalated: [
      'current_or_intended_overlap_confirmed',
      'unresolved',
    ],
    correction_recheck_pending: [
      'unresolved',
    ],
    review_confirmed: [
      'current_or_intended_overlap_confirmed',
    ],
    no_concurrent_exposure_verified: [
      'no_current_or_intended_overlap_verified',
    ],
    order_cancelled: [
      'order_cancelled_before_overlap',
    ],
    order_corrected_pair_absent_after_recheck: [
      'corrected_order_pair_absent_after_recheck',
    ],
  },
  state_confirmation_method_compatibility: {
    manual_review_required: [],
    clinician_confirmation_pending: [
      'verified_current_order_or_medication_record',
    ],
    urgent_supply_escalated: [
      'responsible_clinician_or_service_confirmation',
      'verified_current_order_or_medication_record',
    ],
    correction_recheck_pending: [
      'trusted_order_correction_event',
    ],
    review_confirmed: [
      'responsible_clinician_or_service_confirmation',
    ],
    no_concurrent_exposure_verified: [
      'responsible_clinician_or_service_confirmation',
      'verified_current_order_or_medication_record',
    ],
    order_cancelled: [
      'trusted_order_cancellation_event',
    ],
    order_corrected_pair_absent_after_recheck: [
      'trusted_order_correction_event',
    ],
  },
  order_event_authorization: {
    actor_authorization_source: 'trusted_authorization_registry_required',
    event_source: 'trusted_order_system_required',
    pharmacy_self_attestation_satisfies_terminal_state: false,
  },
  optional_audit_fields: [
    'latest_inr_value_when_available',
    'latest_inr_at_when_available',
    'next_planned_assessment_or_documented_rationale_when_available',
  ],
  free_text_only_resolution_allowed: false,
  urgent_supply_pathway: {
    authority: 'none',
    pathway_id: null,
    can_resolve_clinical_review: false,
    meaning: 'urgent-supply handling is not authorized by this subject',
  },
};

const EXPECTED_IDENTITY_EVIDENCE_BINDINGS = {
  rxnorm_combination_bundle: {
    path:
      'data-static/combination-rxnorm-evidence/combination_co-trimoxazole_rxnorm-10831.json',
    committed_blob_content_sha256:
      'be734f07cceffad4f8309008a9d4df994f8141cef24b842b8d3797dea0758cbb',
    git_blob_oid_sha1: '85fc2e2b66c93c85f4f9651e10e8270c0d23dfcc',
    rxnorm_release: '06-Jul-2026',
    rxnorm_api_version: '3.1.354',
    authority: 'identity_only',
  },
  combination_identity_manifest: {
    path: 'data-static/combination-identity-overrides.json',
    committed_blob_content_sha256:
      'a0813b2a4d80198c6793d6e576b41847da31415f51a68ee75c744a8656223466',
    git_blob_oid_sha1: 'd4ed178993ffdb5891845fa7dbf077d6ec2252bb',
  },
  pmbjp_product_source: {
    pdf_sha256:
      'f54a140d9dc82880dcbb7672c18942417e8c9fe904376c742b6319665cdf9a08',
    xpdf_table_extract_sha256:
      'bb5a5eabbda1802313b546c6b3605315c8bf4f113825ca1794724dab84e1f299',
    parsed_ledger_sha256:
      '336b9ea72d2a249edac467bc9ec2c2c052520878ea13d7fdb4c8a4d7f8281688',
    parsed_row_count: 2111,
  },
};

const EXPECTED_SUPERSESSION = {
  interaction_family_id: 'warfarin-anticoagulation-potentiation',
  subject_specificity: 'exact_fixed_dose_combination',
  supplements_component_subjects: true,
  supersedes_rule_ids: [],
};

const EXPECTED_EXCLUSIONS = [
  'PMBJP 88 co-trimoxazole oral suspension',
  'intravenous co-trimoxazole',
  'single-ingredient trimethoprim',
  'single-ingredient sulfamethoxazole',
  'every unreviewed product or presentation',
  'fuzzy or component-only inheritance',
  'independently inferred systemic presentation',
  'recent or completed exposure',
  'post-course or fixed lookback trigger',
  'adult-only, paediatric-only, or age-derived branch',
];

const EXPECTED_SUBJECT_CHANGE_CONTROL = {
  new_approval_required_for: [
    'clinical classification',
    'clinical text',
    'temporal or population scope',
    'product or identity scope',
    'PMBJP 90 strength extrapolation',
    'evidence source or jurisdiction',
    'workflow or audience boundaries',
    'supersession semantics',
  ],
  source_or_identity_drift_blocks_promotion: true,
  draft_row_reconciliation_required_before_promotion: true,
};

function assertExactProductAssertions(actual, expected, allowedKeys, kind, label) {
  if (!Array.isArray(actual) || actual.length !== expected.size) {
    fail(kind, `${label} must contain exactly ${expected.size} entries`);
  }
  const expectedCodes = [...expected.keys()];
  for (let index = 0; index < expectedCodes.length; index += 1) {
    if (actual[index]?.pmbjp_code !== expectedCodes[index]) {
      fail(kind, `${label} order must be deterministic`);
    }
  }
  const seen = new Set();
  for (const product of actual) {
    requireExactKeys(product, allowedKeys, kind, `${label} entry`);
    const code = product.pmbjp_code;
    const expectedProduct = expected.get(code);
    if (!expectedProduct || seen.has(code)) {
      fail(kind, `${label} contains an unexpected or duplicate PMBJP code`);
    }
    seen.add(code);
    for (const [key, expectedValue] of Object.entries(expectedProduct)) {
      if (product[key] !== expectedValue) {
        fail(kind, `${label} PMBJP ${code} has invalid ${key}`);
      }
    }
  }
}

function pairKey(pair) {
  return `${pair.object_pmbjp_code}__${pair.perpetrator_pmbjp_code}`;
}

function assertExactProductPairs(subject) {
  const kind = 'draft clinical rule subject';
  if (!Array.isArray(subject.product_pairs) || subject.product_pairs.length !== 6) {
    fail(kind, 'subject must enumerate six exact product pairs');
  }
  const expectedOrder = [];
  for (const perpetratorCode of EXPECTED_PERPETRATOR_PRODUCTS.keys()) {
    for (const objectCode of EXPECTED_OBJECT_PRODUCTS.keys()) {
      expectedOrder.push(`${objectCode}__${perpetratorCode}`);
    }
  }
  const expected = new Set(expectedOrder);
  const seen = new Set();
  for (let index = 0; index < subject.product_pairs.length; index += 1) {
    const pair = subject.product_pairs[index];
    requireExactKeys(pair, SUBJECT_PRODUCT_PAIR_KEYS, kind, 'product_pairs entry');
    const key = pairKey(pair);
    if (key !== expectedOrder[index]) {
      fail(kind, 'product_pairs order must be deterministic');
    }
    if (!expected.has(key) || seen.has(key)) {
      fail(kind, 'subject must enumerate six exact product pairs without extras or duplicates');
    }
    const object = EXPECTED_OBJECT_PRODUCTS.get(pair.object_pmbjp_code);
    const perpetrator = EXPECTED_PERPETRATOR_PRODUCTS.get(pair.perpetrator_pmbjp_code);
    if (pair.object_product_id !== object.product_id
      || pair.perpetrator_product_id !== perpetrator.product_id) {
      fail(kind, `product pair ${key} does not bind the reviewed product IDs`);
    }
    seen.add(key);
  }
}

function assertClinicalText(clinicalText) {
  const kind = 'draft clinical rule subject';
  const keys = new Set([
    'mechanism',
    'pharmacy_management_current_check',
    'pharmacy_escalation_context',
    'prescriber_information',
    'patient_counselling',
  ]);
  requireExactKeys(clinicalText, keys, kind, 'clinical_text');
  for (const [key, value] of Object.entries(clinicalText)) {
    requireNonEmptyString(value, kind, `clinical_text.${key}`);
  }
  const text = Object.values(clinicalText).join('\n');
  const required = [
    /sulfamethoxazole inhibits CYP2C9/iu,
    /may prolong prothrombin time/iu,
    /coagulation time.*reassessed/iu,
    /prescriber or anticoagulation service/iu,
    /patient-specific PT\/INR/iu,
    /pharmacy must not change a dose or stop either medicine independently/iu,
    /not to stop warfarin without clinical advice/iu,
    /no universal monitoring schedule/iu,
  ];
  for (const pattern of required) {
    if (!pattern.test(text)) fail(kind, `clinical_text is missing ${pattern.source}`);
  }
  const unsupported =
    /raises? warfarin exposure|high bleeding risk especially|choose an alternative|intensive INR|after start and after stop|Child-Pugh|14[- ]day/iu;
  if (unsupported.test(text)) {
    fail(kind, 'clinical_text contains an unsupported or unapproved claim');
  }
}

export function assertDraftClinicalRuleSubject(subject) {
  const kind = 'draft clinical rule subject';
  subject = immutableValidatedSnapshot(subject);
  requireExactKeys(subject, SUBJECT_KEYS, kind, 'subject');
  assertNoKeyRecursively(
    subject,
    new Set([
      'approval_artifact_commit',
      'subject_jcs_sha256',
      'approval_status',
      'signature',
    ]),
    kind,
    'subject',
  );
  if (/clinician_authorized/iu.test(JSON.stringify(subject))) {
    fail(kind, 'draft subject must not claim clinician_authorized status');
  }
  if (subject.schema_id !== 'aushadhi.interaction-clinical-rule-subject') {
    fail(kind, 'schema_id is not the pinned clinical-rule subject schema');
  }
  if (subject.schema_version !== '1.0.0') {
    fail(kind, 'schema_version is not 1.0.0');
  }
  if (subject.rule_family_id !== 'warfarin__cotrimoxazole'
    || subject.subject_version !== '1.0.0-draft') {
    fail(kind, 'rule family or subject version is not the reviewed draft');
  }
  if (subject.supersedes_subject_jcs_sha256 !== null) {
    fail(kind, 'draft subject must not claim a superseded subject');
  }
  if (subject.requested_profile !== 'internal-evaluation') {
    fail(kind, 'requested_profile must be internal-evaluation');
  }
  assertAuthorityCeiling(subject.authority_ceiling, kind);
  requireExactObject(
    subject.governance_policy_binding,
    EXPECTED_SUBJECT_POLICY_BINDING,
    kind,
    'governance_policy_binding',
  );
  requireExactObject(
    subject.repository_provenance,
    EXPECTED_SUBJECT_REPOSITORY_PROVENANCE,
    kind,
    'repository_provenance',
  );
  requireExactObject(
    subject.clinical_classification,
    EXPECTED_CLINICAL_CLASSIFICATION,
    kind,
    'clinical_classification',
  );
  requireObject(subject.temporal_scope, kind, 'temporal_scope');
  if (subject.temporal_scope.lookback_days !== 0) {
    fail(kind, 'lookback_days must remain zero');
  }
  requireExactObject(subject.temporal_scope, EXPECTED_TEMPORAL_SCOPE, kind, 'temporal_scope');
  requireExactObject(
    subject.population_scope,
    EXPECTED_POPULATION_SCOPE,
    kind,
    'population_scope',
  );
  requireExactKeys(
    subject.identity_scope,
    SUBJECT_IDENTITY_SCOPE_KEYS,
    kind,
    'identity_scope',
  );
  if (subject.identity_scope.expected_exact_product_pair_count !== 6) {
    fail(kind, 'identity scope must require six exact product pairs');
  }
  if (subject.identity_scope.route !== 'oral'
    || subject.identity_scope.formulation !== 'tablet') {
    fail(kind, 'identity scope must remain oral tablet only');
  }
  const object = subject.identity_scope.object;
  requireExactKeys(
    object,
    SUBJECT_OBJECT_IDENTITY_KEYS,
    kind,
    'identity_scope.object',
  );
  if (object.ingredient_mapping_id !== 'ingredient:warfarin:rxnorm-11289') {
    fail(kind, 'object ingredient mapping is not the reviewed warfarin mapping');
  }
  if (object.binding_kind !== 'ingredient_with_exact_presentations'
    || object.ingredient_id
      !== 'sha256:2ec225c652eabf57f4297ab503a1aee5d450c03f721033270bd09c1290a0cd06') {
    fail(kind, 'object identity is not the reviewed exact warfarin identity');
  }
  const expectedMappingIds = [...EXPECTED_OBJECT_PRODUCTS.values()]
    .map((product) => product.mapping_id);
  if (JSON.stringify(object.presentation_mapping_ids) !== JSON.stringify(expectedMappingIds)) {
    fail(kind, 'object presentation mappings are not the three reviewed warfarin tablets');
  }
  assertExactProductAssertions(
    object.product_assertions,
    EXPECTED_OBJECT_PRODUCTS,
    SUBJECT_OBJECT_PRODUCT_KEYS,
    kind,
    'identity_scope.object.product_assertions',
  );
  const perpetrator = subject.identity_scope.perpetrator;
  requireExactKeys(
    perpetrator,
    SUBJECT_PERPETRATOR_IDENTITY_KEYS,
    kind,
    'identity_scope.perpetrator',
  );
  if (perpetrator.combination_id !== 'combination:co-trimoxazole:rxnorm-10831'
    || perpetrator.match_mode !== 'exact_active_set') {
    fail(kind, 'perpetrator must use the reviewed exact-active-set combination');
  }
  if (perpetrator.binding_kind !== 'combination_identity'
    || perpetrator.rxnorm_min_rxcui !== '10831') {
    fail(kind, 'perpetrator is not the reviewed RxNorm MIN combination identity');
  }
  assertExactProductAssertions(
    perpetrator.product_assertions,
    EXPECTED_PERPETRATOR_PRODUCTS,
    SUBJECT_PERPETRATOR_PRODUCT_KEYS,
    kind,
    'identity_scope.perpetrator.product_assertions',
  );
  assertExactProductPairs(subject);
  assertClinicalText(subject.clinical_text);
  requireExactObject(subject.clinical_text, EXPECTED_CLINICAL_TEXT, kind, 'clinical_text');
  requireExactObject(
    subject.audience_bindings,
    EXPECTED_AUDIENCE_BINDINGS,
    kind,
    'audience_bindings',
  );
  requireExactObject(
    subject.workflow_requirements,
    EXPECTED_WORKFLOW_REQUIREMENTS,
    kind,
    'workflow_requirements',
  );
  if (subject.workflow_requirements.urgent_supply_pathway.authority !== 'none'
    || subject.workflow_requirements.urgent_supply_pathway.can_resolve_clinical_review
      !== false) {
    fail(kind, 'urgent-supply pathway must confer no authority');
  }
  requireExactObject(
    subject.evidence_boundary,
    EXPECTED_EVIDENCE_BOUNDARY,
    kind,
    'evidence_boundary',
  );
  const bindings = subject.identity_evidence_bindings;
  requireExactObject(
    bindings,
    EXPECTED_IDENTITY_EVIDENCE_BINDINGS,
    kind,
    'identity_evidence_bindings',
  );
  assertNoKeyRecursively(
    bindings,
    new Set(['git_blob_sha256']),
    kind,
    'identity_evidence_bindings',
  );
  if (
    bindings.rxnorm_combination_bundle?.committed_blob_content_sha256
    !== 'be734f07cceffad4f8309008a9d4df994f8141cef24b842b8d3797dea0758cbb'
  ) {
    fail(kind, 'RxNorm combination bundle content hash does not match the reviewed object');
  }
  if (
    bindings.combination_identity_manifest?.committed_blob_content_sha256
    !== 'a0813b2a4d80198c6793d6e576b41847da31415f51a68ee75c744a8656223466'
  ) {
    fail(kind, 'combination identity manifest content hash does not match the reviewed object');
  }
  requireExactObject(
    subject.supersession,
    EXPECTED_SUPERSESSION,
    kind,
    'supersession',
  );
  if (!isDeepStrictEqual(subject.exclusions, EXPECTED_EXCLUSIONS)) {
    fail(kind, 'exclusions do not match the reviewed fail-closed boundary');
  }
  requireExactObject(
    subject.change_control,
    EXPECTED_SUBJECT_CHANGE_CONTROL,
    kind,
    'change_control',
  );
  return subject;
}

// The per-section key sets above hand-encode the frozen subject shape.
// Several are documentation of that shape and are not (yet) referenced by an
// assertion (requireExactObject derives its key set from the expected value);
// they are exported as policy-encoding data so deleting one is a visible
// interface change rather than a silent cleanup.
export {
  SUBJECT_KEYS,
  SUBJECT_POLICY_BINDING_KEYS,
  SUBJECT_REPOSITORY_PROVENANCE_KEYS,
  SUBJECT_CLASSIFICATION_KEYS,
  SUBJECT_IDENTITY_SCOPE_KEYS,
  SUBJECT_OBJECT_IDENTITY_KEYS,
  SUBJECT_OBJECT_PRODUCT_KEYS,
  SUBJECT_PERPETRATOR_IDENTITY_KEYS,
  SUBJECT_PERPETRATOR_PRODUCT_KEYS,
  SUBJECT_PRODUCT_PAIR_KEYS,
  SUBJECT_WORKFLOW_KEYS,
  SUBJECT_URGENT_PATHWAY_KEYS,
  SUBJECT_IDENTITY_BINDING_KEYS,
  SUBJECT_RXNORM_BUNDLE_KEYS,
  SUBJECT_COMBINATION_MANIFEST_KEYS,
  SUBJECT_PMBJP_SOURCE_KEYS,
  SUBJECT_SUPERSESSION_KEYS,
  SUBJECT_CHANGE_CONTROL_KEYS,
};
