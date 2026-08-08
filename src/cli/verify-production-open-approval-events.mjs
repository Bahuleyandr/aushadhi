import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDraftApprovalJson } from '../lib/interaction-approval-draft.mjs';
import {
  validateProductionOpenApprovalEvent,
  verifyProductionOpenApprovalEventSignature,
} from '../lib/production-open-approval-events.mjs';
import {
  canonicalizeApprovalSubject,
  validateProductionOpenSignoffPackage,
} from '../lib/production-open-signoff-package.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE_DIR = path.join(
  ROOT,
  'docs',
  'interaction-review',
  '2026-08-08-warfarin-six-production-open-signoff',
);
const EVENT_DIR = path.join(PACKAGE_DIR, 'approval-events');

function readJson(filePath) {
  return parseDraftApprovalJson(fs.readFileSync(filePath, 'utf8'), path.basename(filePath));
}

function slugForRule(ruleId) {
  return ruleId.replaceAll('__', '-').replaceAll('_', '-');
}

try {
  validateProductionOpenSignoffPackage({
    packageDir: PACKAGE_DIR,
    productionRulesPath: path.join(ROOT, 'data-static', 'interaction-rules.json'),
  });
  const status = readJson(path.join(PACKAGE_DIR, 'package-status.json'));
  const signingProfile = readJson(path.join(PACKAGE_DIR, 'SIGNING-PROFILE.json'));
  const allowedSignersPath = path.join(PACKAGE_DIR, signingProfile.allowed_signers_file);
  const subjectByHash = new Map(
    Object.entries(status.subject_hashes).map(([ruleId, subjectHash]) => [subjectHash, ruleId]),
  );
  const templateByRule = new Map([...subjectByHash.values()].map((ruleId) => {
    const template = readJson(path.join(
      PACKAGE_DIR,
      `${slugForRule(ruleId)}.approval-event.template.json`,
    ));
    return [ruleId, template.event_body_template];
  }));
  const files = fs.existsSync(EVENT_DIR) ? fs.readdirSync(EVENT_DIR).sort() : [];
  const eventFiles = files.filter((fileName) => fileName.endsWith('.approval-event.json'));
  const expectedFiles = new Set(eventFiles.flatMap((fileName) => [fileName, `${fileName}.sig`]));
  const unexpected = files.filter((fileName) => !expectedFiles.has(fileName));
  if (unexpected.length > 0) throw new Error(`unexpected approval-event files: ${unexpected.join(', ')}`);

  const byRule = new Map();
  const seenEventIds = new Set();
  for (const fileName of eventFiles) {
    const eventPath = path.join(EVENT_DIR, fileName);
    const raw = fs.readFileSync(eventPath, 'utf8');
    const event = validateProductionOpenApprovalEvent(
      parseDraftApprovalJson(raw, fileName),
    );
    if (raw !== canonicalizeApprovalSubject(event)) {
      throw new Error(`${fileName} is not stored as exact RFC 8785 canonical JSON`);
    }
    if (seenEventIds.has(event.event_id)) throw new Error(`duplicate event_id ${event.event_id}`);
    seenEventIds.add(event.event_id);
    const ruleId = subjectByHash.get(event.approval_subject_jcs_sha256);
    if (!ruleId) throw new Error(`${fileName} references an unknown approval subject`);
    if (!fileName.startsWith(`${slugForRule(ruleId)}.`)) {
      throw new Error(`${fileName} does not match its approval subject rule`);
    }
    const template = templateByRule.get(ruleId);
    if (event.approval_statement_sha256 !== template.approval_statement_sha256) {
      throw new Error(`${fileName} approval statement hash does not match its subject`);
    }
    const signaturePath = `${eventPath}.sig`;
    if (!fs.existsSync(signaturePath)) throw new Error(`${fileName} is missing its detached signature`);
    verifyProductionOpenApprovalEventSignature({
      event,
      signature: fs.readFileSync(signaturePath, 'utf8'),
      allowedSignersPath,
      reviewerId: signingProfile.reviewer_id,
    });
    const events = byRule.get(ruleId) ?? [];
    events.push(event);
    byRule.set(ruleId, events);
  }

  let approved = 0;
  let rejected = 0;
  let expired = 0;
  for (const [ruleId, events] of byRule) {
    events.sort((left, right) => left.reviewed_at_utc.localeCompare(right.reviewed_at_utc));
    for (let index = 0; index < events.length; index += 1) {
      const expectedSuperseded = index === 0 ? null : events[index - 1].event_id;
      if (events[index].supersedes_event_id !== expectedSuperseded) {
        throw new Error(`${ruleId} event chain is not append-only and contiguous`);
      }
    }
    const latest = events.at(-1);
    if (latest.decision === 'APPROVED' && Date.parse(latest.valid_until_utc) <= Date.now()) {
      expired += 1;
    } else if (latest.decision === 'APPROVED') approved += 1;
    else rejected += 1;
  }
  process.stdout.write(`${JSON.stringify({
    signature_profile: signingProfile.profile_id,
    authenticated_event_count: eventFiles.length,
    approved_subject_count: approved,
    rejected_subject_count: rejected,
    expired_subject_count: expired,
    pending_subject_count: subjectByHash.size - approved - rejected - expired,
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
