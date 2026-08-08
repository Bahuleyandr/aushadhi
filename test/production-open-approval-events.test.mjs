import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildProductionOpenApprovalEvent,
  signProductionOpenApprovalEvent,
  verifyProductionOpenApprovalEventSignature,
  writeProductionOpenApprovalEvent,
} from '../src/lib/production-open-approval-events.mjs';

function makeSigningFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-approval-signing-'));
  const keyPath = path.join(dir, 'key');
  const generated = spawnSync('ssh-keygen', [
    '-q', '-t', 'ed25519', '-N', '', '-C', 'clinician-test', '-f', keyPath,
  ], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  const publicKey = fs.readFileSync(`${keyPath}.pub`, 'utf8').trim();
  const allowedSignersPath = path.join(dir, 'allowed_signers');
  fs.writeFileSync(allowedSignersPath, `clinician:subas ${publicKey}\n`, 'utf8');
  return { dir, keyPath, publicKey, allowedSignersPath };
}

const template = {
  event_id: null,
  decision: null,
  reviewer_id: 'clinician:subas',
  reviewed_at_utc: null,
  repository_head: null,
  approval_subject_jcs_sha256: '1'.repeat(64),
  approval_statement_sha256: '2'.repeat(64),
  authentication_method: null,
  authenticated_event_id: null,
  supersedes_event_id: null,
};

test('an exact approval event can be signed and verified with the pinned SSH identity', () => {
  const fixture = makeSigningFixture();
  const event = buildProductionOpenApprovalEvent({
    template,
    ruleId: 'warfarin__amiodarone',
    decision: 'APPROVED',
    reviewedAtUtc: '2026-08-08T12:34:56Z',
    repositoryHead: 'a'.repeat(40),
  });
  assert.equal(event.event_id, 'approval-warfarin-amiodarone-20260808T123456Z');
  assert.equal(event.authentication_method, 'ssh-ed25519-detached');
  assert.equal(event.authenticated_event_id, event.event_id);

  const signature = signProductionOpenApprovalEvent({
    event,
    privateKeyPath: fixture.keyPath,
    expectedPublicKey: fixture.publicKey,
  });
  assert.match(signature, /BEGIN SSH SIGNATURE/u);
  assert.doesNotThrow(() => verifyProductionOpenApprovalEventSignature({
    event,
    signature,
    allowedSignersPath: fixture.allowedSignersPath,
    reviewerId: 'clinician:subas',
  }));

  const drifted = { ...event, decision: 'REJECTED' };
  assert.throws(
    () => verifyProductionOpenApprovalEventSignature({
      event: drifted,
      signature,
      allowedSignersPath: fixture.allowedSignersPath,
      reviewerId: 'clinician:subas',
    }),
    /SSH signature verification failed/u,
  );
});

test('event construction rejects ambiguous decisions, timestamps, and repository bindings', () => {
  const base = {
    template,
    ruleId: 'warfarin__amiodarone',
    decision: 'APPROVED',
    reviewedAtUtc: '2026-08-08T12:34:56Z',
    repositoryHead: 'a'.repeat(40),
  };
  assert.throws(
    () => buildProductionOpenApprovalEvent({ ...base, decision: 'PENDING' }),
    /decision must be APPROVED or REJECTED/u,
  );
  assert.throws(
    () => buildProductionOpenApprovalEvent({
      ...base,
      reviewedAtUtc: '2026-08-08T18:04:56+05:30',
    }),
    /reviewed_at_utc must be an exact UTC timestamp/u,
  );
  assert.throws(
    () => buildProductionOpenApprovalEvent({ ...base, repositoryHead: 'main' }),
    /repository_head must be a full Git commit ID/u,
  );
});

test('event files are append-only and are never overwritten', () => {
  const fixture = makeSigningFixture();
  const event = buildProductionOpenApprovalEvent({
    template,
    ruleId: 'warfarin__amiodarone',
    decision: 'REJECTED',
    reviewedAtUtc: '2026-08-08T12:34:56Z',
    repositoryHead: 'b'.repeat(40),
  });
  const signature = signProductionOpenApprovalEvent({
    event,
    privateKeyPath: fixture.keyPath,
    expectedPublicKey: fixture.publicKey,
  });
  const paths = writeProductionOpenApprovalEvent({
    outputDir: fixture.dir,
    ruleId: 'warfarin__amiodarone',
    event,
    signature,
  });
  assert.equal(fs.existsSync(paths.eventPath), true);
  assert.equal(fs.existsSync(paths.signaturePath), true);
  assert.throws(
    () => writeProductionOpenApprovalEvent({
      outputDir: fixture.dir,
      ruleId: 'warfarin__amiodarone',
      event,
      signature,
    }),
    /approval event already exists/u,
  );
});
