import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDraftApprovalJson } from '../lib/interaction-approval-draft.mjs';
import {
  buildProductionOpenApprovalEvent,
  signProductionOpenApprovalEvent,
  verifyProductionOpenApprovalEventSignature,
  writeProductionOpenApprovalEvent,
} from '../lib/production-open-approval-events.mjs';
import { validateProductionOpenSignoffPackage } from '../lib/production-open-signoff-package.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE_DIR = path.join(
  ROOT,
  'docs',
  'interaction-review',
  '2026-08-08-warfarin-six-production-open-signoff',
);

function parseArgs(argv) {
  const options = {
    ruleId: null,
    decision: null,
    keyPath: null,
    reviewedAtUtc: null,
    supersedesEventId: null,
  };
  const names = new Map([
    ['--rule-id', 'ruleId'],
    ['--decision', 'decision'],
    ['--key-path', 'keyPath'],
    ['--reviewed-at-utc', 'reviewedAtUtc'],
    ['--supersedes-event-id', 'supersedesEventId'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const separator = argument.indexOf('=');
    const name = separator === -1 ? argument : argument.slice(0, separator);
    const property = names.get(name);
    if (!property) throw new Error(`unknown argument ${argument}`);
    const value = separator === -1 ? argv[index + 1] : argument.slice(separator + 1);
    if (separator === -1) index += 1;
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    if (options[property] !== null) throw new Error(`${name} may be specified only once`);
    options[property] = value;
  }
  for (const [property, name] of [
    ['ruleId', '--rule-id'],
    ['decision', '--decision'],
    ['keyPath', '--key-path'],
  ]) {
    if (!options[property]) throw new Error(`${name} is required`);
  }
  return options;
}

function git(...arguments_) {
  const result = spawnSync('git', arguments_, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${arguments_.join(' ')} failed`);
  return result.stdout.trim();
}

function slugForRule(ruleId) {
  return ruleId.replaceAll('__', '-').replaceAll('_', '-');
}

function readJson(filePath) {
  return parseDraftApprovalJson(fs.readFileSync(filePath, 'utf8'), path.basename(filePath));
}

function currentUtcSecond() {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, 'Z');
}

try {
  const options = parseArgs(process.argv.slice(2));
  validateProductionOpenSignoffPackage({
    packageDir: PACKAGE_DIR,
    productionRulesPath: path.join(ROOT, 'data-static', 'interaction-rules.json'),
  });
  const status = git('status', '--porcelain=v1', '--untracked-files=all');
  if (status !== '') {
    throw new Error('working tree must be clean before recording a clinician approval event');
  }
  const repositoryHead = git('rev-parse', 'HEAD');
  const slug = slugForRule(options.ruleId);
  const templatePath = path.join(PACKAGE_DIR, `${slug}.approval-event.template.json`);
  if (!fs.existsSync(templatePath)) throw new Error(`unknown sign-off rule_id ${options.ruleId}`);
  const template = readJson(templatePath);
  const signingProfile = readJson(path.join(PACKAGE_DIR, 'SIGNING-PROFILE.json'));
  const allowedSignersPath = path.join(PACKAGE_DIR, signingProfile.allowed_signers_file);
  const event = buildProductionOpenApprovalEvent({
    template: template.event_body_template,
    ruleId: options.ruleId,
    decision: options.decision.toUpperCase(),
    reviewedAtUtc: options.reviewedAtUtc ?? currentUtcSecond(),
    repositoryHead,
    supersedesEventId: options.supersedesEventId,
  });
  const signature = signProductionOpenApprovalEvent({
    event,
    privateKeyPath: path.resolve(options.keyPath),
    expectedPublicKey: signingProfile.public_key,
  });
  verifyProductionOpenApprovalEventSignature({
    event,
    signature,
    allowedSignersPath,
    reviewerId: signingProfile.reviewer_id,
  });
  const written = writeProductionOpenApprovalEvent({
    outputDir: path.join(PACKAGE_DIR, 'approval-events'),
    ruleId: options.ruleId,
    event,
    signature,
  });
  process.stdout.write(`${JSON.stringify({
    status: 'authenticated_event_recorded_not_committed',
    rule_id: options.ruleId,
    decision: event.decision,
    event_id: event.event_id,
    repository_head: repositoryHead,
    event_path: path.relative(ROOT, written.eventPath).replaceAll('\\', '/'),
    signature_path: path.relative(ROOT, written.signaturePath).replaceAll('\\', '/'),
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
