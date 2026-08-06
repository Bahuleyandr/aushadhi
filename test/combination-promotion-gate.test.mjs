// The RxNorm evidence gate must be UNAVOIDABLE, not an optional command.
//
// Independent review (2026-07-28) held that documenting
// `npm run verify:combination-rxnorm-evidence` does not make it mandatory, because a
// developer can simply not run it. The promotion gate therefore invokes the verifier
// itself whenever the combination manifest is non-empty, and this suite proves a
// non-empty manifest with missing or unverified evidence fails the gate.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCombinationEvidenceVerified,
  buildCommittedRuntimePack,
} from '../src/cli/build-interaction-runtime-pack.mjs';
import {
  assertVerifiedCombinationManifestEvidence,
} from '../src/lib/combination-rxnorm-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// a fixture combination whose evidence bundle we control
const FIXTURE = readJson(
  'data-static/combination-identity-overrides.json',
);

// The committed gate hashes the operator-provisioned PMBJP source files in the
// gitignored restricted zone; without them the authenticity chain cannot be
// exercised, so dependent tests skip with an explicit reason (repo convention
// for operator-provisioned material, e.g. AUSHADHI_OPENFDA_PAYLOAD_DIR).
const PMBJP_SOURCE_DIR = path.join(
  ROOT, 'data', 'interaction', 'internal-evaluation', 'pmbjp-product-list',
);
const PMBJP_SOURCE_SKIP = ['pmbjp-product-list.pdf', 'pmbjp-product-list.table.txt']
  .every((name) => fs.existsSync(path.join(PMBJP_SOURCE_DIR, name)))
  ? false
  : 'operator-provisioned PMBJP restricted source files are absent '
    + '(data/interaction/internal-evaluation/pmbjp-product-list/)';

function scratchRoot(manifest, bundles = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-gate-'));
  fs.mkdirSync(path.join(dir, 'data-static', 'combination-rxnorm-evidence'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'data-static', 'combination-identity-overrides.json'),
    JSON.stringify(manifest, null, 2),
  );
  for (const [combinationId, bundle] of Object.entries(bundles)) {
    fs.writeFileSync(
      path.join(
        dir, 'data-static', 'combination-rxnorm-evidence',
        `${combinationId.replaceAll(/[^a-zA-Z0-9._-]/gu, '_')}.json`,
      ),
      JSON.stringify(bundle, null, 2),
    );
  }
  return dir;
}

test('the committed manifest returns an authentic report bound to its frozen manifest', { skip: PMBJP_SOURCE_SKIP }, () => {
  const result = assertCombinationEvidenceVerified(ROOT);
  assert.equal(
    result.report.combinations_checked,
    result.manifest.combinations.length,
  );
  assert.equal(result.report.verified, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.manifest), true);
  assert.equal(Object.isFrozen(result.manifest.combinations), true);
  assert.strictEqual(
    assertVerifiedCombinationManifestEvidence(result.report, result.manifest),
    result.report,
  );
});

test('the committed runtime build consumes the verified manifest handoff', { skip: PMBJP_SOURCE_SKIP }, () => {
  const pack = buildCommittedRuntimePack();
  assert.equal(pack.rules.length, 6);
  assert.equal(pack.profile, 'internal-evaluation');
});

test('a missing combination manifest fails closed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-gate-missing-'));
  fs.mkdirSync(path.join(dir, 'data-static'), { recursive: true });
  assert.throws(
    () => assertCombinationEvidenceVerified(dir),
    /combination identity manifest is missing/u,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a non-empty manifest with NO evidence bundle fails the promotion gate', () => {
  const dir = scratchRoot(FIXTURE);
  assert.throws(
    () => assertCombinationEvidenceVerified(dir),
    /combination RxNorm evidence is unverified, so the runtime pack may not be built or checked/u,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a non-empty manifest with synthetic fixture hashes fails the promotion gate', () => {
  // the audit fixture's hashes are placeholders; supplying a bundle does not help
  const dir = scratchRoot(FIXTURE, {
    'combination:co-trimoxazole:rxnorm-10831': {
      schema_version: 1,
      rxnorm_release: '06-Jul-2026',
      api_version: '3.1.354',
      responses: {},
      response_hashes: {},
    },
  });
  let message = '';
  try {
    assertCombinationEvidenceVerified(dir);
  } catch (error) {
    message = error.message;
  }
  assert.match(message, /unverified/u);
  assert.match(message, /fixture_hash_in_production_path|missing_raw_evidence/u);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the gate reports which combination failed and why', () => {
  const dir = scratchRoot(FIXTURE);
  try {
    assertCombinationEvidenceVerified(dir);
    assert.fail('expected the gate to throw');
  } catch (error) {
    assert.match(error.message, /combination:co-trimoxazole:rxnorm-10831/u);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
