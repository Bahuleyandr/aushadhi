// Dry-run reporter for compile-time class-rule expansion (Option B).
//
// Reads the attested draft pack plus the digest-pinned member sets, verifies
// the attestation binding first (unattested inputs never expand), and prints
// a deterministic JSON report of every exact member instantiation each
// selected class-level (or exact) draft rule would compile to, alongside
// every refusal with its precise reason.
//
// This tool has NO authority: it writes nothing, promotes nothing, and signs
// nothing. Every reported expansion candidate still requires its own signed
// clinician approval, reviewed mappings, and promotion-manifest entry before
// it can compile into a runtime artifact.
//
//   node src/cli/expand-interaction-draft-rules.mjs \
//     --rule-id=<draft rule id> [--rule-id=<draft rule id> ...] \
//     [--pack=<jsonl>] [--member-sets=<json>] [--attestation=<json>]

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  assertDraftPackAttestation,
  parseDraftPackAttestation,
} from '../lib/interaction-draft-attestation.mjs';
import {
  parseInteractionMemberSets,
} from '../lib/interaction-member-set-validation.mjs';
import { parseDraftPack } from '../lib/interaction-promotion.mjs';
import {
  expandDraftRuleClassMembers,
} from '../lib/interaction-rule-expansion.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULTS = {
  pack: path.join(
    ROOT, 'docs', 'interaction-review', 'batch-01-v2', 'batch-01-v2.jsonl',
  ),
  memberSets: path.join(ROOT, 'data-static', 'interaction-member-sets.json'),
  attestation: path.join(
    ROOT, 'docs', 'interaction-review', 'batch-01-v2', 'batch-01-v2.provenance.json',
  ),
};

function parseArgs(args) {
  const options = { ...DEFAULTS, ruleIds: [] };
  for (const arg of args) {
    if (arg.startsWith('--rule-id=')) {
      options.ruleIds.push(arg.slice('--rule-id='.length));
    } else if (arg.startsWith('--pack=')) {
      options.pack = path.resolve(ROOT, arg.slice('--pack='.length));
    } else if (arg.startsWith('--member-sets=')) {
      options.memberSets = path.resolve(ROOT, arg.slice('--member-sets='.length));
    } else if (arg.startsWith('--attestation=')) {
      options.attestation = path.resolve(ROOT, arg.slice('--attestation='.length));
    } else {
      throw new TypeError(
        'usage: node src/cli/expand-interaction-draft-rules.mjs '
          + '--rule-id=<id> [--rule-id=<id> ...] [--pack=<jsonl>] '
          + '[--member-sets=<json>] [--attestation=<json>]',
      );
    }
  }
  if (options.ruleIds.length === 0) {
    throw new TypeError('at least one --rule-id=<draft rule id> is required');
  }
  return options;
}

export function expandDraftRulesDryRun({ packPath, memberSetsPath, attestationPath, ruleIds }) {
  const draftPackBytes = fs.readFileSync(packPath);
  const memberSetsBytes = fs.readFileSync(memberSetsPath);
  const attestation = parseDraftPackAttestation(
    fs.readFileSync(attestationPath, 'utf8'),
  );
  const { rules } = parseDraftPack(draftPackBytes);
  // Fail closed before any expansion: the attestation must bind these exact
  // pack bytes AND these exact member-set bytes (member_sets_sha256).
  assertDraftPackAttestation(attestation, {
    packBytes: draftPackBytes,
    memberSetsBytes,
    rules,
  });
  const { classes } = parseInteractionMemberSets(memberSetsBytes);

  const rulesById = new Map(rules.map((rule) => [rule.rule_id, rule]));
  const reports = [];
  for (const ruleId of [...new Set(ruleIds)].sort()) {
    const rule = rulesById.get(ruleId);
    if (!rule) {
      throw new TypeError(`draft rule ${ruleId} does not exist in the attested pack`);
    }
    reports.push(expandDraftRuleClassMembers({ rule, memberSetClasses: classes }));
  }
  return {
    generated_by: 'src/cli/expand-interaction-draft-rules.mjs',
    authority: 'none — dry-run report only; nothing is promoted, approved, or signed',
    pack_sha256: attestation.pack_sha256,
    member_sets_sha256: attestation.member_sets_sha256,
    rules: reports,
    totals: {
      rules: reports.length,
      expansions: reports.reduce((sum, report) => sum + report.expansions.length, 0),
      refusals: reports.reduce((sum, report) => sum + report.refusals.length, 0),
    },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = expandDraftRulesDryRun({
    packPath: options.pack,
    memberSetsPath: options.memberSets,
    attestationPath: options.attestation,
    ruleIds: options.ruleIds,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1]
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
