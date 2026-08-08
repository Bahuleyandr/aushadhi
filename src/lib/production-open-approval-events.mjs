import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { canonicalizeApprovalSubject } from './production-open-signoff-package.mjs';

export const APPROVAL_SIGNATURE_NAMESPACE = 'aushadhi-approval-event';
const AUTHENTICATION_METHOD = 'ssh-ed25519-detached';
const EVENT_KEYS = [
  'event_id',
  'decision',
  'reviewer_id',
  'reviewed_at_utc',
  'repository_head',
  'approval_subject_jcs_sha256',
  'approval_statement_sha256',
  'authentication_method',
  'authenticated_event_id',
  'supersedes_event_id',
];

function fail(message) {
  throw new TypeError(`production-open approval event: ${message}`);
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
}

function assertExactKeys(value, expected, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length
      || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} must contain exactly ${wanted.join(', ')}`);
  }
}

function assertSha256(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    fail(`${label} must be a lowercase SHA-256 digest`);
  }
}

function assertRepositoryHead(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) {
    fail('repository_head must be a full Git commit ID');
  }
}

function assertTimestamp(value) {
  if (typeof value !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)
      || Number.isNaN(Date.parse(value))) {
    fail('reviewed_at_utc must be an exact UTC timestamp such as 2026-08-08T12:34:56Z');
  }
}

function ruleSlug(ruleId) {
  if (typeof ruleId !== 'string' || !/^[a-z0-9]+(?:__[a-z0-9_]+)$/u.test(ruleId)) {
    fail('rule_id is invalid');
  }
  return ruleId.replaceAll('__', '-').replaceAll('_', '-');
}

function compactTimestamp(reviewedAtUtc) {
  return reviewedAtUtc.replaceAll('-', '').replaceAll(':', '');
}

function publicKeyIdentity(value) {
  if (typeof value !== 'string') fail('expected public key must be a string');
  const fields = value.trim().split(/\s+/u);
  if (fields.length < 2 || fields[0] !== 'ssh-ed25519') {
    fail('expected public key must be an ssh-ed25519 key');
  }
  return fields.slice(0, 2).join(' ');
}

export function validateProductionOpenApprovalEvent(event) {
  assertExactKeys(event, EVENT_KEYS, 'event');
  if (typeof event.event_id !== 'string'
      || !/^approval-[a-z0-9-]+-\d{8}T\d{6}Z$/u.test(event.event_id)) {
    fail('event_id is invalid');
  }
  if (!['APPROVED', 'REJECTED'].includes(event.decision)) {
    fail('decision must be APPROVED or REJECTED');
  }
  if (event.reviewer_id !== 'clinician:subas') fail('reviewer_id must be clinician:subas');
  assertTimestamp(event.reviewed_at_utc);
  assertRepositoryHead(event.repository_head);
  assertSha256(event.approval_subject_jcs_sha256, 'approval_subject_jcs_sha256');
  assertSha256(event.approval_statement_sha256, 'approval_statement_sha256');
  if (event.authentication_method !== AUTHENTICATION_METHOD) {
    fail(`authentication_method must be ${AUTHENTICATION_METHOD}`);
  }
  if (event.authenticated_event_id !== event.event_id) {
    fail('authenticated_event_id must equal event_id');
  }
  if (event.supersedes_event_id !== null
      && (typeof event.supersedes_event_id !== 'string'
        || !/^approval-[a-z0-9-]+-\d{8}T\d{6}Z$/u.test(event.supersedes_event_id))) {
    fail('supersedes_event_id must be null or a valid prior event ID');
  }
  return event;
}

export function buildProductionOpenApprovalEvent({
  template,
  ruleId,
  decision,
  reviewedAtUtc,
  repositoryHead,
  supersedesEventId = null,
}) {
  assertExactKeys(template, EVENT_KEYS, 'event template');
  if (template.event_id !== null
      || template.decision !== null
      || template.reviewed_at_utc !== null
      || template.repository_head !== null
      || template.authentication_method !== null
      || template.authenticated_event_id !== null) {
    fail('event template has already been populated');
  }
  if (template.reviewer_id !== 'clinician:subas') fail('template reviewer_id must be clinician:subas');
  assertSha256(template.approval_subject_jcs_sha256, 'template approval_subject_jcs_sha256');
  assertSha256(template.approval_statement_sha256, 'template approval_statement_sha256');
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    fail('decision must be APPROVED or REJECTED');
  }
  assertTimestamp(reviewedAtUtc);
  assertRepositoryHead(repositoryHead);
  const eventId = `approval-${ruleSlug(ruleId)}-${compactTimestamp(reviewedAtUtc)}`;
  return validateProductionOpenApprovalEvent({
    event_id: eventId,
    decision,
    reviewer_id: template.reviewer_id,
    reviewed_at_utc: reviewedAtUtc,
    repository_head: repositoryHead,
    approval_subject_jcs_sha256: template.approval_subject_jcs_sha256,
    approval_statement_sha256: template.approval_statement_sha256,
    authentication_method: AUTHENTICATION_METHOD,
    authenticated_event_id: eventId,
    supersedes_event_id: supersedesEventId,
  });
}

function runSshKeygen(arguments_, options) {
  const result = spawnSync('ssh-keygen', arguments_, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

export function signProductionOpenApprovalEvent({
  event,
  privateKeyPath,
  expectedPublicKey,
}) {
  validateProductionOpenApprovalEvent(event);
  if (typeof privateKeyPath !== 'string' || privateKeyPath.trim() === '') {
    fail('private key path is required');
  }
  const derived = runSshKeygen(['-y', '-f', privateKeyPath]);
  if (derived.status !== 0) {
    fail(`unable to read SSH signing key: ${derived.stderr.trim()}`);
  }
  if (publicKeyIdentity(derived.stdout) !== publicKeyIdentity(expectedPublicKey)) {
    fail('private key does not match the pinned clinician public key');
  }
  const canonicalEvent = canonicalizeApprovalSubject(event);
  const signed = runSshKeygen([
    '-Y',
    'sign',
    '-f',
    privateKeyPath,
    '-n',
    APPROVAL_SIGNATURE_NAMESPACE,
    '-',
  ], { input: canonicalEvent });
  if (signed.status !== 0 || !signed.stdout.includes('BEGIN SSH SIGNATURE')) {
    fail(`SSH signing failed: ${signed.stderr.trim()}`);
  }
  return signed.stdout.trim();
}

export function verifyProductionOpenApprovalEventSignature({
  event,
  signature,
  allowedSignersPath,
  reviewerId,
}) {
  validateProductionOpenApprovalEvent(event);
  if (reviewerId !== event.reviewer_id) fail('signature reviewer does not match event reviewer');
  if (typeof signature !== 'string' || !signature.includes('BEGIN SSH SIGNATURE')) {
    fail('signature is not an armored SSH signature');
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-approval-verify-'));
  const signaturePath = path.join(tempDir, 'event.sig');
  try {
    fs.writeFileSync(signaturePath, `${signature.trim()}\n`, 'utf8');
    const verified = runSshKeygen([
      '-Y',
      'verify',
      '-f',
      allowedSignersPath,
      '-I',
      reviewerId,
      '-n',
      APPROVAL_SIGNATURE_NAMESPACE,
      '-s',
      signaturePath,
    ], { input: canonicalizeApprovalSubject(event) });
    if (verified.status !== 0) {
      fail(`SSH signature verification failed: ${verified.stderr.trim()}`);
    }
    return true;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function writeProductionOpenApprovalEvent({
  outputDir,
  ruleId,
  event,
  signature,
}) {
  validateProductionOpenApprovalEvent(event);
  if (typeof signature !== 'string' || !signature.includes('BEGIN SSH SIGNATURE')) {
    fail('signature is not an armored SSH signature');
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const prefix = `${ruleSlug(ruleId)}.${event.event_id}`;
  const eventPath = path.join(outputDir, `${prefix}.approval-event.json`);
  const signaturePath = `${eventPath}.sig`;
  if (fs.existsSync(eventPath) || fs.existsSync(signaturePath)) {
    fail(`approval event already exists: ${event.event_id}`);
  }
  let eventWritten = false;
  try {
    fs.writeFileSync(eventPath, canonicalizeApprovalSubject(event), {
      encoding: 'utf8',
      flag: 'wx',
    });
    eventWritten = true;
    fs.writeFileSync(signaturePath, `${signature.trim()}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    if (eventWritten && !fs.existsSync(signaturePath)) fs.rmSync(eventPath, { force: true });
    if (error.code === 'EEXIST') fail(`approval event already exists: ${event.event_id}`);
    throw error;
  }
  return { eventPath, signaturePath };
}
