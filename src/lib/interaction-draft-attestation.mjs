import { createHash } from 'node:crypto';

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const ATTESTATION_FIELDS = [
  'schema_version',
  'pack_sha256',
  'member_sets_sha256',
  'member_sets_byte_count',
  'verified_at',
  'verification_profile',
  'payload_binding',
  'rule_count',
  'evidence_record_count',
  'evidence_document_count',
  'evidence_digest_sha256',
  'trust_boundary',
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function fail(message) {
  throw new Error(`invalid draft-pack provenance attestation: ${message}`);
}

function requireCount(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(`${field} must be a non-negative safe integer`);
  }
}

function requireBytes(value, label) {
  if (!ArrayBuffer.isView(value)) {
    throw new TypeError(`${label} must be a Uint8Array`);
  }
  if (value.byteLength === 0) {
    throw new TypeError(`${label} must not be empty`);
  }
}

function assertVerifiedAt(value) {
  if (typeof value !== 'string') fail('verified_at must be an ISO timestamp');
  let canonical;
  try {
    canonical = new Date(value).toISOString();
  } catch {
    fail('verified_at must be an ISO timestamp');
  }
  if (canonical !== value) fail('verified_at must be a canonical ISO timestamp');
}

function evidenceEntries(rules) {
  if (!Array.isArray(rules)) throw new TypeError('draft rules must be an array');
  const entries = [];
  for (const rule of rules) {
    const evidenceRecords = rule?.evidence ?? [];
    if (!Array.isArray(evidenceRecords)) {
      throw new TypeError(`draft rule ${JSON.stringify(rule?.rule_id)} evidence must be an array`);
    }
    for (const [evidenceIndex, evidence] of evidenceRecords.entries()) {
      entries.push({
        section: rule._section,
        rule_id: rule.rule_id,
        evidence_index: evidenceIndex,
        evidence,
      });
    }
  }
  return entries;
}

export function summarizeDraftEvidence(rules) {
  const entries = evidenceEntries(rules);
  const documents = new Set(entries.map(({ evidence }) => [
    evidence?.source_policy_id,
    evidence?.document_id,
    evidence?.document_version,
  ].map((value) => String(value ?? '')).join('\u0000')));
  return {
    evidenceRecordCount: entries.length,
    evidenceDocumentCount: documents.size,
    evidenceDigestSha256: sha256(JSON.stringify(canonicalize(entries))),
  };
}

export function createDraftPackAttestation({
  packBytes,
  memberSetsBytes,
  rules,
  verifiedAt,
}) {
  requireBytes(packBytes, 'draft pack bytes');
  requireBytes(memberSetsBytes, 'interaction member-set bytes');
  assertVerifiedAt(verifiedAt);
  const evidence = summarizeDraftEvidence(rules);
  return {
    schema_version: 2,
    pack_sha256: sha256(packBytes),
    member_sets_sha256: sha256(memberSetsBytes),
    member_sets_byte_count: memberSetsBytes.byteLength,
    verified_at: verifiedAt,
    verification_profile: 'production-open',
    payload_binding: 'verified',
    rule_count: rules.length,
    evidence_record_count: evidence.evidenceRecordCount,
    evidence_document_count: evidence.evidenceDocumentCount,
    evidence_digest_sha256: evidence.evidenceDigestSha256,
    trust_boundary: 'unsigned_local_drift_detection_not_authentication',
  };
}

export function serializeDraftPackAttestation(attestation) {
  assertDraftPackAttestationShape(attestation);
  return `${JSON.stringify(attestation, null, 2)}\n`;
}

export function parseDraftPackAttestation(text) {
  let attestation;
  try {
    attestation = JSON.parse(text);
  } catch (error) {
    fail(`file is not valid JSON: ${error.message}`);
  }
  assertDraftPackAttestationShape(attestation);
  return attestation;
}

export function assertDraftPackAttestationShape(attestation) {
  if (attestation === null
    || typeof attestation !== 'object'
    || Array.isArray(attestation)) {
    fail('record must be an object');
  }
  const fields = Object.keys(attestation);
  if (fields.length !== ATTESTATION_FIELDS.length
    || ATTESTATION_FIELDS.some((field) => !Object.hasOwn(attestation, field))) {
    fail(`record must contain exactly ${ATTESTATION_FIELDS.join(', ')}`);
  }
  if (attestation.schema_version !== 2) fail('schema_version must equal 2');
  if (!SHA256_PATTERN.test(attestation.pack_sha256 ?? '')) {
    fail('pack_sha256 must be a lowercase SHA-256');
  }
  if (!SHA256_PATTERN.test(attestation.member_sets_sha256 ?? '')) {
    fail('member_sets_sha256 must be a lowercase SHA-256');
  }
  requireCount(attestation.member_sets_byte_count, 'member_sets_byte_count');
  if (attestation.member_sets_byte_count === 0) {
    fail('member_sets_byte_count must be greater than zero');
  }
  assertVerifiedAt(attestation.verified_at);
  if (attestation.verification_profile !== 'production-open') {
    fail('verification_profile must equal production-open');
  }
  if (attestation.payload_binding !== 'verified') {
    fail('payload_binding must equal verified');
  }
  for (const field of [
    'rule_count',
    'evidence_record_count',
    'evidence_document_count',
  ]) {
    requireCount(attestation[field], field);
  }
  if (attestation.evidence_document_count > attestation.evidence_record_count) {
    fail('evidence_document_count cannot exceed evidence_record_count');
  }
  if (!SHA256_PATTERN.test(attestation.evidence_digest_sha256 ?? '')) {
    fail('evidence_digest_sha256 must be a lowercase SHA-256');
  }
  if (attestation.trust_boundary !== 'unsigned_local_drift_detection_not_authentication') {
    fail('trust_boundary must disclose unsigned local drift detection');
  }
  return attestation;
}

export function assertDraftPackAttestation(
  attestation,
  { packBytes, memberSetsBytes, rules },
) {
  assertDraftPackAttestationShape(attestation);
  const expected = createDraftPackAttestation({
    packBytes,
    memberSetsBytes,
    rules,
    verifiedAt: attestation.verified_at,
  });
  for (const field of ATTESTATION_FIELDS) {
    if (attestation[field] !== expected[field]) {
      const target = field.startsWith('member_sets_')
        ? 'interaction member sets'
        : 'draft pack';
      fail(`${field} does not match the ${target}`);
    }
  }
  return attestation;
}
