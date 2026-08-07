import {
  assertNoKeyRecursively,
  fail,
  immutableValidatedSnapshot,
  requireExactKeys,
  requireExactObject,
  requireFalse,
  requireNull,
  requireObject,
  requireStringArray,
} from './interaction-approval-draft/validation-primitives.mjs';
import {
  assertClinicianReviewRendering,
} from './interaction-approval-draft/clinician-review-rendering.mjs';
import {
  assertDraftGovernancePolicy,
} from './interaction-approval-draft/governance-policy.mjs';
import {
  assertDraftClinicalRuleSubject,
} from './interaction-approval-draft/clinical-rule-subject.mjs';

export { parseDraftApprovalJson } from './interaction-approval-draft/raw-json.mjs';
export { assertClinicianReviewRendering };
export { assertDraftGovernancePolicy };
export { assertDraftClinicalRuleSubject };

const EVENT_TEMPLATE_KEYS = new Set([
  'schema_id',
  'schema_version',
  'template_only',
  'event_body_template',
  'detached_signature_envelope_template',
  'approval_record_template',
  'append_only_store_receipt_template',
  'signed_checkpoint_template',
]);

const STATUS_KEYS = new Set([
  'schema_id',
  'schema_version',
  'package_id',
  'prepared_at',
  'package_status',
  'clinician_review_sha256_profile',
  'clinician_review_sha256',
  'policy_signoff_ready',
  'rule_signoff_ready',
  'promotion_ready',
  'authority',
  'implemented_controls',
  'required_before_policy_signoff',
  'required_before_rule_signoff',
  'required_before_promotion',
  'required_before_production',
]);

const EVENT_BODY_KEYS = new Set([
  'schema_id',
  'schema_version',
  'event_id',
  'event_type',
  'decision',
  'subject_kind',
  'subject_id',
  'subject_version',
  'subject_jcs_sha256',
  'governance_policy_jcs_sha256',
  'approval_statement',
  'approval_statement_sha256',
  'authority_granted',
  'reviewer_id',
  'reviewer_role',
  'reviewed_at_utc',
  'approval_artifact_commit',
  'supersedes_event_id',
  'supersedes_event_record_jcs_sha256',
  'review_due_at_utc',
  'authority_not_after_utc',
]);
const SIGNATURE_ENVELOPE_KEYS = new Set([
  'schema_id',
  'schema_version',
  'event_body_jcs_sha256',
  'signature_profile_id',
  'signature_input_domain',
  'signer_principal_id',
  'signer_key_id',
  'authentication_assertion_id',
  'authentication_assertion_issuer',
  'authentication_assertion_sha256',
  'authorization_assertion_sha256',
  'signature_algorithm',
  'signature_base64',
]);
const STORE_RECEIPT_TEMPLATE_KEYS = new Set([
  'receipt_body_template',
  'detached_store_signature_template',
]);
const STORE_RECEIPT_BODY_KEYS = new Set([
  'schema_id',
  'schema_version',
  'receipt_id',
  'event_store_id',
  'event_store_configuration_sha256',
  'stream_id',
  'sequence',
  'approval_record_jcs_sha256',
  'accepted_at_utc',
  'previous_record_jcs_sha256',
  'verification',
]);
const STORE_RECEIPT_SIGNATURE_KEYS = new Set([
  'receipt_body_jcs_sha256',
  'signature_algorithm',
  'store_key_id',
  'signature_base64',
]);
const STORE_CHECKPOINT_TEMPLATE_KEYS = new Set([
  'checkpoint_body_template',
  'detached_store_signature_template',
]);
const STORE_CHECKPOINT_BODY_KEYS = new Set([
  'schema_id',
  'schema_version',
  'stream_id',
  'through_sequence',
  'head_record_jcs_sha256',
  'record_count',
  'checkpointed_at_utc',
  'previous_checkpoint_jcs_sha256',
]);
const STORE_CHECKPOINT_SIGNATURE_KEYS = new Set([
  'checkpoint_body_jcs_sha256',
  'signature_algorithm',
  'store_key_id',
  'signature_base64',
]);
const PACKAGE_AUTHORITY_KEYS = new Set([
  'clinical_use',
  'production',
  'deployment',
]);

const EXPECTED_EVENT_BODY_TEMPLATE = {
  schema_id: 'aushadhi.interaction-approval-event',
  schema_version: '1.0.0',
  event_id: null,
  event_type: null,
  decision: null,
  subject_kind: null,
  subject_id: null,
  subject_version: null,
  subject_jcs_sha256: null,
  governance_policy_jcs_sha256: null,
  approval_statement: null,
  approval_statement_sha256: null,
  approval_statement_sha256_profile: 'UTF-8-NFC-LF-no-trailing-LF',
  authority_granted: null,
  reviewer_id: null,
  reviewer_role: null,
  reviewed_at_utc: null,
  approval_artifact_commit: null,
  supersedes_event_id: null,
  supersedes_approval_record_jcs_sha256: null,
  review_due_at_utc: null,
  authority_not_after_utc: null,
};

const EXPECTED_SIGNATURE_ENVELOPE_TEMPLATE = {
  schema_id: 'aushadhi.interaction-approval-signature-envelope',
  schema_version: '1.0.0',
  event_body_jcs_sha256: null,
  signature_profile_id: null,
  signature_input_domain: 'aushadhi.approval-event.v1\u0000',
  signer_principal_id: null,
  signer_key_id: null,
  authentication_assertion_id: null,
  authentication_assertion_issuer: null,
  authentication_assertion_sha256: null,
  authorization_assertion_sha256: null,
  signature_algorithm: null,
  signature_base64: null,
};

const EXPECTED_APPROVAL_RECORD_TEMPLATE = {
  schema_id: 'aushadhi.interaction-approval-record',
  schema_version: '1.0.0',
  canonicalization: 'RFC8785-JCS',
  digest_algorithm: 'SHA-256',
  event_body: null,
  detached_signature_envelope: null,
  excluded_members: [
    'append_only_store_receipt',
    'signed_checkpoint',
  ],
};

const EXPECTED_STORE_RECEIPT_TEMPLATE = {
  receipt_body_template: {
    schema_id: 'aushadhi.interaction-approval-store-receipt',
    schema_version: '1.0.0',
    receipt_id: null,
    event_store_id: null,
    event_store_configuration_sha256: null,
    stream_id: null,
    sequence: null,
    approval_record_jcs_sha256: null,
    accepted_at_utc: null,
    previous_approval_record_jcs_sha256: null,
    verification: null,
  },
  detached_store_signature_template: {
    receipt_body_jcs_sha256: null,
    signature_algorithm: null,
    store_key_id: null,
    signature_base64: null,
  },
};

const EXPECTED_STORE_CHECKPOINT_TEMPLATE = {
  checkpoint_body_template: {
    schema_id: 'aushadhi.interaction-approval-store-checkpoint',
    schema_version: '1.0.0',
    stream_id: null,
    through_sequence: null,
    head_approval_record_jcs_sha256: null,
    record_count: null,
    checkpointed_at_utc: null,
    previous_checkpoint_jcs_sha256: null,
  },
  detached_store_signature_template: {
    checkpoint_body_jcs_sha256: null,
    signature_algorithm: null,
    store_key_id: null,
    signature_base64: null,
  },
};

const EXPECTED_PACKAGE_STATUS = {
  schema_id: 'aushadhi.interaction-approval-draft-package-status',
  schema_version: '1.0.0',
  package_id: 'warfarin-cotrimoxazole-vnext-2026-07-29',
  prepared_at: '2026-07-29',
  package_status: 'draft_non_authorizing',
  clinician_review_sha256_profile: 'UTF-8-NFC-LF-no-trailing-LF',
  clinician_review_sha256:
    '58e83f86cfd16a633f4ba7f4fd72f9e6e7a75f0fca8031b24471ff4b9f332a9b',
  policy_signoff_ready: false,
  rule_signoff_ready: false,
  promotion_ready: false,
  authority: {
    clinical_use: 'none',
    production: 'none',
    deployment: 'none',
  },
  implemented_controls: [
    'repository-native draft artifacts with exact non-authorizing value validation',
    'exact current-check-only temporal scope',
    'no age-derived population branch',
    'six explicitly enumerated PMBJP oral-tablet product pairs',
    'rehashed committed RxNorm and combination-identity objects plus current-manifest product and assertion bindings, draft-row hash, and repository-base relationship',
    'default-deny audience allowlists with explicit intersection-only composition and precedence, distinct unreviewed or identity-unresolved and exposure-unresolved rendering, per-state evidence plus exposure and confirmation-method compatibility, and trusted order-event and authorized-actor correction-path and terminal evidence requirements',
    'complete clinician-rendering equivalence checks plus a normalized whole-document SHA-256 binding for canonical clinical text, all workflow mappings, optional audit fields, change control, and all requested sign-off items',
    'duplicate-member-rejecting raw JSON parsing, exact schema discriminators, and deeply immutable validated snapshots',
    'detached event, signature-envelope, receipt, and checkpoint templates',
    'implemented-versus-required status separation',
    'production-open remains empty',
  ],
  required_before_policy_signoff: [
    'approve a bootstrap governance policy and governance approver quorum',
    'pin a conformant RFC 8785 implementation and conformance vectors',
    'pin signature, signer-registry, authorization-registry, and event-store trust profiles',
    'approve the exact approval-record container and approval-statement hash-normalization profile',
    'define reviewer credential validity, revocation, replay, and trusted-time controls',
    'define append-only retention and externally retained signed checkpoints',
  ],
  required_before_rule_signoff: [
    'complete and approve the governance policy',
    'replace the draft policy binding with the final policy JCS SHA-256',
    'clinically approve or reject PMBJP 90 strength extrapolation explicitly',
    'clinically approve the exact classification, scope, text, and workflow boundary',
    'finalize the exact approval statement without placeholders',
    'commit the final policy and subject before creating any approval event',
    'reverify the captured openFDA payload and fragment hashes against the retained source objects',
  ],
  required_before_promotion: [
    'create a new immutable authenticated approval event; do not mutate this template',
    'verify the detached signature against pinned trust and authorization records',
    'append the record to the approved store and retain a valid signed checkpoint',
    'reconcile the non-authorizing JSONL row and pin its new hash',
    'implement a medication-status or intended-use input contract before claiming temporal enforcement',
    'implement structured audience rendering with distinct unreviewed or identity-unresolved and exposure-unresolved behavior without flattening clinical authority',
    'implement per-state exposure and confirmation-method compatibility plus trusted order-event and authorized-actor validation for cancellation or correction terminal states',
    'implement the evaluation watermark and exact draft-package gate runner',
    'run source, identity, six-pair, negative-case, supersession, and full regression gates',
    'confirm data-static/interaction-rules.json remains empty',
  ],
  required_before_production: [
    'obtain separate India-specific clinical, regulatory, pharmacy, antimicrobial-stewardship, privacy, and security governance review',
    'complete shadow-mode, human-factors, alert-burden, rollback, kill-switch, and drift-monitoring validation',
    'define numerical production acceptance criteria and accountable owners',
    'obtain separate production and deployment authorization',
  ],
};

export function assertApprovalEventTemplate(template) {
  const kind = 'draft approval-event template';
  template = immutableValidatedSnapshot(template);
  requireExactKeys(template, EVENT_TEMPLATE_KEYS, kind, 'template');
  if (template.schema_id !== 'aushadhi.interaction-approval-event-template') {
    fail(kind, 'schema_id is not the pinned approval-event template schema');
  }
  if (template.schema_version !== '1.0.0') {
    fail(kind, 'schema_version is not 1.0.0');
  }
  if (template.template_only !== true) fail(kind, 'template_only must be true');
  const body = template.event_body_template;
  requireObject(body, kind, 'event_body_template');
  if (body.decision !== null) {
    fail(kind, 'template decision must remain null');
  }
  requireExactObject(body, EXPECTED_EVENT_BODY_TEMPLATE, kind, 'event_body_template');
  assertNoKeyRecursively(
    body,
    new Set([
      'signature',
      'authentication_method',
      'key_status_at_signing',
      'previous_event_hash',
      'promotion_eligible',
    ]),
    kind,
    'event_body_template',
  );
  const signature = template.detached_signature_envelope_template;
  requireExactObject(
    signature,
    EXPECTED_SIGNATURE_ENVELOPE_TEMPLATE,
    kind,
    'detached_signature_envelope_template',
  );
  assertNoKeyRecursively(
    signature,
    new Set(['authentication_method', 'key_status_at_signing']),
    kind,
    'detached_signature_envelope_template',
  );
  requireExactObject(
    template.approval_record_template,
    EXPECTED_APPROVAL_RECORD_TEMPLATE,
    kind,
    'approval_record_template',
  );
  const receipt = template.append_only_store_receipt_template;
  requireExactObject(
    receipt,
    EXPECTED_STORE_RECEIPT_TEMPLATE,
    kind,
    'append_only_store_receipt_template',
  );
  const receiptBody = receipt.receipt_body_template;
  requireNull(
    receiptBody.sequence,
    kind,
    'append_only_store_receipt_template.receipt_body_template.sequence',
  );
  const checkpoint = template.signed_checkpoint_template;
  requireExactObject(
    checkpoint,
    EXPECTED_STORE_CHECKPOINT_TEMPLATE,
    kind,
    'signed_checkpoint_template',
  );
  const checkpointBody = checkpoint.checkpoint_body_template;
  requireNull(
    checkpointBody.through_sequence,
    kind,
    'signed_checkpoint_template.checkpoint_body_template.through_sequence',
  );
  return template;
}

function assertPackageStatus(status) {
  const kind = 'draft approval package status';
  status = immutableValidatedSnapshot(status);
  requireExactObject(status, EXPECTED_PACKAGE_STATUS, kind, 'status');
  if (status.package_status !== 'draft_non_authorizing') {
    fail(kind, 'package_status must be draft_non_authorizing');
  }
  for (const key of ['policy_signoff_ready', 'rule_signoff_ready', 'promotion_ready']) {
    requireFalse(status[key], kind, key);
  }
  requireExactKeys(status.authority, PACKAGE_AUTHORITY_KEYS, kind, 'authority');
  for (const key of ['clinical_use', 'production', 'deployment']) {
    if (status.authority[key] !== 'none') {
      fail(kind, `${key} authority must be none`);
    }
  }
  for (const key of [
    'implemented_controls',
    'required_before_policy_signoff',
    'required_before_rule_signoff',
    'required_before_promotion',
    'required_before_production',
  ]) {
    requireStringArray(status[key], kind, key);
  }
  return status;
}

export function validateDraftApprovalPackage({
  policy,
  subject,
  eventTemplate,
  status,
  clinicianReviewText,
}) {
  assertDraftGovernancePolicy(policy);
  assertDraftClinicalRuleSubject(subject);
  assertApprovalEventTemplate(eventTemplate);
  const validatedStatus = assertPackageStatus(status);
  const validatedRendering = assertClinicianReviewRendering(clinicianReviewText);
  if (
    validatedStatus.clinician_review_sha256_profile
      !== validatedRendering.sha256_profile
    || validatedStatus.clinician_review_sha256 !== validatedRendering.sha256
  ) {
    fail(
      'draft approval package',
      'clinician review rendering binding does not match package status',
    );
  }
  return Object.freeze({
    package_status: validatedStatus.package_status,
    structurally_valid: true,
    policy_signoff_ready: false,
    rule_signoff_ready: false,
    promotion_ready: false,
    clinical_use_authority: 'none',
    production_authority: 'none',
    deployment_authority: 'none',
  });
}
