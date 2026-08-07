// Draft approval-event template validation. The committed template can
// never be mistaken for an authenticated approval event: every decision,
// signature, receipt, and checkpoint slot must remain null, and forged
// signature or store-evidence members are rejected.
import {
  assertNoKeyRecursively,
  fail,
  immutableValidatedSnapshot,
  requireExactKeys,
  requireExactObject,
  requireNull,
  requireObject,
} from './validation-primitives.mjs';

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

// The per-section key sets above hand-encode the frozen template shape.
// Several are documentation of that shape and are not (yet) referenced by an
// assertion (requireExactObject derives its key set from the expected value);
// they are exported as policy-encoding data so deleting one is a visible
// interface change rather than a silent cleanup.
export {
  EVENT_TEMPLATE_KEYS,
  EVENT_BODY_KEYS,
  SIGNATURE_ENVELOPE_KEYS,
  STORE_RECEIPT_TEMPLATE_KEYS,
  STORE_RECEIPT_BODY_KEYS,
  STORE_RECEIPT_SIGNATURE_KEYS,
  STORE_CHECKPOINT_TEMPLATE_KEYS,
  STORE_CHECKPOINT_BODY_KEYS,
  STORE_CHECKPOINT_SIGNATURE_KEYS,
};
