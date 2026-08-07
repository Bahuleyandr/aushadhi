// Draft governance policy validation. Encodes the reviewed
// internal-evaluation governance policy as exhaustive expected-shape
// constants and validates a candidate policy against that fixed boundary.
import {
  assertNoOwn,
  fail,
  immutableValidatedSnapshot,
  requireExactKeys,
  requireExactObject,
  requireFalse,
} from './validation-primitives.mjs';
import { assertAuthorityCeiling } from './authority-ceiling.mjs';

const POLICY_KEYS = new Set([
  'schema_id',
  'schema_version',
  'policy_id',
  'policy_version',
  'supersedes_policy_jcs_sha256',
  'operational_profile',
  'authority_ceiling',
  'canonicalization_profile',
  'trust_profile_bindings',
  'status_model',
  'failure_semantics',
  'runtime_safety',
  'applicability_model',
  'workflow_contract',
  'gate_policy',
  'profile_requirements',
  'change_control',
  'review_policy',
]);

const POLICY_CANONICALIZATION_KEYS = new Set([
  'method',
  'encoding',
  'digest_algorithm',
  'implementation_profile_id',
  'conformance_vectors_sha256',
]);
const POLICY_TRUST_BINDING_KEYS = new Set([
  'bootstrap_governance_policy_jcs_sha256',
  'signature_profile_id',
  'event_store_profile_id',
  'signer_registry_id',
  'authorization_registry_id',
]);
const POLICY_STATUS_MODEL_KEYS = new Set([
  'independent_dimensions',
  'historical_event_authenticity_is_immutable',
  'current_authority_is_derived_from_lifecycle_events',
  'promotion_eligibility_is_derived_from_current_gates',
]);
const POLICY_FAILURE_KEYS = new Set([
  'technical_gate_failure',
  'source_or_identity_drift',
  'invalid_signature_or_subject_binding',
  'historical_event_mutation',
  'missing_or_conflicting_applicability',
]);
const POLICY_RUNTIME_SAFETY_KEYS = new Set([
  'missing_stale_ambiguous_or_drifted_identity',
  'unreviewed_clinical_content_hidden',
  'fuzzy_identity_acceptance',
  'brand_to_systemic_route_inference',
  'blank_result_means_safe',
  'therapeutic_duplication_is_interaction',
]);
const POLICY_APPLICABILITY_KEYS = new Set([
  'initial_temporal_mode',
  'recent_exposure_supported',
  'episode_state_supported',
  'age_derived_branch_supported',
  'current_check_meaning',
]);
const POLICY_WORKFLOW_KEYS = new Set([
  'pending_states',
  'terminal_states',
  'urgent_supply_escalated_is_terminal',
  'free_text_only_resolution_allowed',
  'pharmacy_can_change_or_stop_medicine_independently',
]);
const POLICY_GATE_KEYS = new Set([
  'required_before_promotion',
  'passing_gates_create_clinical_authority',
  'failed_or_stale_gate_invalidates_historical_approval',
]);
const POLICY_PROFILE_KEYS = new Set([
  'evaluation_watermark',
  'production_open_required_empty',
  'output_on_missing_stale_ambiguous_or_drifted_scope',
  'prohibited_output_on_unreviewed_scope',
]);
const POLICY_CHANGE_CONTROL_KEYS = new Set([
  'material_subject_change_requires_new_approval_event',
  'policy_replacement_does_not_migrate_existing_subjects',
  'completed_event_mutation',
  'correction_model',
]);
const POLICY_REVIEW_KEYS = new Set([
  'governance_policy_approval_required',
  'rule_subject_approval_required',
  'policy_approver_requirements_resolved',
  'rule_approver_requirements_resolved',
  'signature_profile_resolved',
  'event_store_profile_resolved',
]);

const EXPECTED_POLICY_CANONICALIZATION = {
  method: 'RFC8785-JCS',
  encoding: 'UTF-8',
  digest_algorithm: 'SHA-256',
  implementation_profile_id: null,
  conformance_vectors_sha256: null,
};

const EXPECTED_POLICY_TRUST_BINDINGS = {
  bootstrap_governance_policy_jcs_sha256: null,
  signature_profile_id: null,
  event_store_profile_id: null,
  signer_registry_id: null,
  authorization_registry_id: null,
};

const EXPECTED_POLICY_STATUS_MODEL = {
  independent_dimensions: [
    'event_authenticity',
    'clinical_approval_authority',
    'subject_binding_status',
    'technical_gate_status',
    'promotion_eligibility',
    'activation_status',
  ],
  historical_event_authenticity_is_immutable: true,
  current_authority_is_derived_from_lifecycle_events: true,
  promotion_eligibility_is_derived_from_current_gates: true,
};

const EXPECTED_POLICY_FAILURE_SEMANTICS = {
  technical_gate_failure: 'block_promotion_only',
  source_or_identity_drift: 'block_current_binding_and_promotion_pending_review',
  invalid_signature_or_subject_binding: 'event_has_no_approval_effect',
  historical_event_mutation: 'prohibited',
  missing_or_conflicting_applicability: 'unresolved',
};

const EXPECTED_POLICY_RUNTIME_SAFETY = {
  missing_stale_ambiguous_or_drifted_identity: 'unresolved',
  unreviewed_clinical_content_hidden: true,
  fuzzy_identity_acceptance: false,
  brand_to_systemic_route_inference: false,
  blank_result_means_safe: false,
  therapeutic_duplication_is_interaction: false,
};

const EXPECTED_POLICY_APPLICABILITY = {
  initial_temporal_mode: 'current_check_only',
  recent_exposure_supported: false,
  episode_state_supported: false,
  age_derived_branch_supported: false,
  current_check_meaning:
    'both exact products are represented in the same current interaction check',
};

const EXPECTED_POLICY_WORKFLOW = {
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
  terminal_state_compatibility_required: true,
  pending_state_requirements_required: true,
  state_specific_exposure_compatibility_required: true,
  state_specific_confirmation_method_compatibility_required: true,
  terminal_order_state_requires_trusted_event_and_authorized_actor: true,
  pharmacy_self_attestation_can_satisfy_terminal_order_state: false,
  urgent_supply_escalated_is_terminal: false,
  free_text_only_resolution_allowed: false,
  pharmacy_can_change_or_stop_medicine_independently: false,
};

const EXPECTED_POLICY_GATES = {
  required_before_promotion: [
    'subject_policy_and_approval_event_integrity',
    'repository_source_identity_and_product_bindings',
    'exact_six_product_pairs',
    'current_check_only_temporal_scope',
    'medication_status_or_intent_input_contract',
    'negative_identity_and_presentation_cases',
    'workflow_and_audience_binding',
    'supersession_and_duplicate_behavior',
    'evaluation_watermark',
    'production_open_empty',
    'full_regression_suite',
  ],
  passing_gates_create_clinical_authority: false,
  failed_or_stale_gate_invalidates_historical_approval: false,
};

const EXPECTED_POLICY_PROFILE_REQUIREMENTS = {
  evaluation_watermark: 'INTERNAL EVALUATION — NOT FOR CLINICAL USE',
  production_open_required_empty: true,
  output_on_missing_stale_ambiguous_or_drifted_scope: [
    'not_evaluated',
    'unresolved',
  ],
  prohibited_output_on_unreviewed_scope: [
    'safe',
    'no_interaction',
  ],
};

const EXPECTED_POLICY_CHANGE_CONTROL = {
  material_subject_change_requires_new_approval_event: true,
  policy_replacement_does_not_migrate_existing_subjects: true,
  completed_event_mutation: 'prohibited',
  correction_model: 'new_superseding_event',
};

const EXPECTED_POLICY_REVIEW = {
  governance_policy_approval_required: true,
  rule_subject_approval_required: true,
  policy_approver_requirements_resolved: false,
  rule_approver_requirements_resolved: false,
  signature_profile_resolved: false,
  event_store_profile_resolved: false,
};

export function assertDraftGovernancePolicy(policy) {
  const kind = 'draft governance policy';
  policy = immutableValidatedSnapshot(policy);
  requireExactKeys(policy, POLICY_KEYS, kind, 'policy');
  assertNoOwn(
    policy,
    ['policy_jcs_sha256', 'approval_status', 'approval_artifact_commit'],
    kind,
    'policy',
  );
  if (policy.schema_id !== 'aushadhi.interaction-governance-policy') {
    fail(kind, 'schema_id is not the pinned draft schema');
  }
  if (policy.schema_version !== '1.0.0') {
    fail(kind, 'schema_version is not 1.0.0');
  }
  if (policy.policy_id !== 'aushadhi-interaction-governance-internal-evaluation') {
    fail(kind, 'policy_id is not the internal-evaluation governance policy');
  }
  if (policy.policy_version !== '1.0.0-draft') {
    fail(kind, 'policy_version is not the reviewed draft version');
  }
  if (policy.supersedes_policy_jcs_sha256 !== null) {
    fail(kind, 'the first draft policy must not claim a superseded policy');
  }
  if (policy.operational_profile !== 'internal-evaluation') {
    fail(kind, 'operational_profile must be internal-evaluation');
  }
  assertAuthorityCeiling(policy.authority_ceiling, kind);
  requireExactObject(
    policy.canonicalization_profile,
    EXPECTED_POLICY_CANONICALIZATION,
    kind,
    'canonicalization_profile',
  );
  requireExactObject(
    policy.trust_profile_bindings,
    EXPECTED_POLICY_TRUST_BINDINGS,
    kind,
    'trust_profile_bindings',
  );
  requireExactObject(
    policy.status_model,
    EXPECTED_POLICY_STATUS_MODEL,
    kind,
    'status_model',
  );
  requireExactObject(
    policy.failure_semantics,
    EXPECTED_POLICY_FAILURE_SEMANTICS,
    kind,
    'failure_semantics',
  );
  requireExactObject(
    policy.runtime_safety,
    EXPECTED_POLICY_RUNTIME_SAFETY,
    kind,
    'runtime_safety',
  );
  requireExactObject(
    policy.applicability_model,
    EXPECTED_POLICY_APPLICABILITY,
    kind,
    'applicability_model',
  );
  requireExactObject(
    policy.workflow_contract,
    EXPECTED_POLICY_WORKFLOW,
    kind,
    'workflow_contract',
  );
  requireExactObject(policy.gate_policy, EXPECTED_POLICY_GATES, kind, 'gate_policy');
  requireExactObject(
    policy.profile_requirements,
    EXPECTED_POLICY_PROFILE_REQUIREMENTS,
    kind,
    'profile_requirements',
  );
  requireExactObject(
    policy.change_control,
    EXPECTED_POLICY_CHANGE_CONTROL,
    kind,
    'change_control',
  );
  requireExactObject(policy.review_policy, EXPECTED_POLICY_REVIEW, kind, 'review_policy');
  if (policy.failure_semantics.technical_gate_failure !== 'block_promotion_only') {
    fail(kind, 'technical gate failure must block promotion only');
  }
  if (
    policy.failure_semantics.invalid_signature_or_subject_binding
    !== 'event_has_no_approval_effect'
  ) {
    fail(kind, 'an invalid signature or binding must confer no approval effect');
  }
  requireFalse(
    policy.workflow_contract.urgent_supply_escalated_is_terminal,
    kind,
    'urgent_supply_escalated_is_terminal',
  );
  requireFalse(
    policy.workflow_contract.free_text_only_resolution_allowed,
    kind,
    'free_text_only_resolution_allowed',
  );
  if (
    policy.profile_requirements.evaluation_watermark
    !== 'INTERNAL EVALUATION — NOT FOR CLINICAL USE'
  ) {
    fail(kind, 'evaluation watermark is not the fixed internal-evaluation watermark');
  }
  if (policy.profile_requirements.production_open_required_empty !== true) {
    fail(kind, 'production-open must be required to remain empty');
  }
  if (policy.gate_policy.passing_gates_create_clinical_authority !== false) {
    fail(kind, 'passing technical gates must not create clinical authority');
  }
  return policy;
}

// The per-section key sets above hand-encode the frozen policy shape.
// Several are documentation of that shape and are not (yet) referenced by an
// assertion (requireExactObject derives its key set from the expected value);
// they are exported as policy-encoding data so deleting one is a visible
// interface change rather than a silent cleanup.
export {
  POLICY_KEYS,
  POLICY_CANONICALIZATION_KEYS,
  POLICY_TRUST_BINDING_KEYS,
  POLICY_STATUS_MODEL_KEYS,
  POLICY_FAILURE_KEYS,
  POLICY_RUNTIME_SAFETY_KEYS,
  POLICY_APPLICABILITY_KEYS,
  POLICY_WORKFLOW_KEYS,
  POLICY_GATE_KEYS,
  POLICY_PROFILE_KEYS,
  POLICY_CHANGE_CONTROL_KEYS,
  POLICY_REVIEW_KEYS,
};
