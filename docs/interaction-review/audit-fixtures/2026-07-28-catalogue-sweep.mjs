// AUDIT FIXTURE SWEEP -- carries no promotion authority.
//
// The fixture compiles as `audit_fixture`, so the RUNTIME resolver refuses it by
// type; this sweep necessarily goes through the audit path and every result is an
// `audit_match` that assertRuntimeCombinationResult rejects. That is the point:
// synthetic evidence cannot produce a runtime-acceptable result.
//
//   node docs/interaction-review/audit-fixtures/2026-07-28-catalogue-sweep.mjs \
//     docs/interaction-review/audit-fixtures/2026-07-28-cotrimoxazole-audit-fixture-manifest.json
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  assertRuntimeCombinationResult,
  auditCombinationIdentityAcrossProfiles,
  compileCombinationIdentityManifest,
  resolveCombinationIdentity,
} from '../../../src/lib/interaction-combination-identity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ARTIFACT = path.join(ROOT, 'dist', 'latest', 'drugs.jsonl');
const manifest = compileCombinationIdentityManifest(
  JSON.parse(fs.readFileSync(process.argv[2], 'utf8')),
  { kind: 'audit_fixture' },
);

const out = {
  classification: 'audit_fixture_sweep',
  promotion_authority: 'none',
  compiled_kind: manifest.compiled_kind,
  total: 0,
  by_status: {},
  reasons: {},
  matches: [],
  runtime_resolver_refuses_fixture: null,
  runtime_assertion_refused_matches: 0,
};

// the runtime resolver must refuse this manifest outright
try {
  resolveCombinationIdentity({
    product: { ingredients: [] }, manifest, profile: 'internal-evaluation',
  });
  out.runtime_resolver_refuses_fixture = false;
} catch (error) {
  out.runtime_resolver_refuses_fixture = /audit_fixture manifest may not be used here/u
    .test(error.message);
}

const rl = readline.createInterface({
  input: fs.createReadStream(ARTIFACT, 'utf8'),
  crlfDelay: Infinity,
});
for await (const line of rl) {
  if (!line.trim()) continue;
  out.total += 1;
  const result = auditCombinationIdentityAcrossProfiles({ product: JSON.parse(line), manifest });
  out.by_status[result.status] = (out.by_status[result.status] ?? 0) + 1;
  if (result.reason) out.reasons[result.reason] = (out.reasons[result.reason] ?? 0) + 1;
  if (result.status !== 'audit_match') continue;
  out.matches.push({
    code: result.source_identity.code,
    scd: result.rxnorm_scd.rxcui,
    authored_profiles: result.authored_profiles,
    candidate_subject: result.candidate_subject,
    runtime_subject: result.runtime_subject,
  });
  try {
    assertRuntimeCombinationResult(result);
  } catch {
    out.runtime_assertion_refused_matches += 1;
  }
}

process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
