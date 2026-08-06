import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  compileInteractionRuntimePack,
  validatePromotionHoldManifest,
} from '../src/lib/interaction-promotion.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function inputs() {
  return {
    promotionManifest: readJson(
      'data-static/interaction-promotions.internal-evaluation.json',
    ),
    promotionHoldManifest: readJson(
      'data-static/interaction-promotion-holds.internal-evaluation.json',
    ),
    sourcePolicyBytes: fs.readFileSync(
      path.join(ROOT, 'data-static/interaction-sources.json'),
    ),
    draftPackBytes: fs.readFileSync(
      path.join(ROOT, 'docs/interaction-review/batch-01-v2/batch-01-v2.jsonl'),
    ),
    attestation: readJson(
      'docs/interaction-review/batch-01-v2/batch-01-v2.provenance.json',
    ),
    memberSetsBytes: fs.readFileSync(
      path.join(ROOT, 'data-static/interaction-member-sets.json'),
    ),
    ingredientManifest: readJson('data-static/ingredient-mapping-overrides.json'),
    presentationManifest: readJson(
      'data-static/product-presentation-overrides.json',
    ),
  };
}

function useSyntheticPack(source) {
  source.promotionManifest.output_pack.pack_id = 'aushadhi-test-interactions';
  source.promotionHoldManifest.pack_id = 'aushadhi-test-interactions';
  return source;
}

test('committed provenance holds exclude only the two drifted promotions', () => {
  const source = inputs();
  assert.equal(validatePromotionHoldManifest(source.promotionHoldManifest), true);
  const compiled = compileInteractionRuntimePack(source);
  assert.deepEqual(
    compiled.rules.map((rule) => rule.rule_id),
    [
      'warfarin__amiodarone',
      'warfarin__clarithromycin_oral',
      'warfarin__fluconazole',
      'warfarin__ketoconazole_oral',
      'warfarin__metronidazole',
      'warfarin__voriconazole',
    ],
  );
  assert.deepEqual(readJson('data-static/interaction-rules.json').rules, []);
});

test('promotion compilation requires a hold manifest and exact draft-evidence binding', () => {
  const missing = inputs();
  delete missing.promotionHoldManifest;
  assert.throws(
    () => compileInteractionRuntimePack(missing),
    /promotion hold manifest must be an object/iu,
  );

  const wrongSource = useSyntheticPack(inputs());
  wrongSource.promotionHoldManifest.holds[0].evidence_source_id = 'invented-source';
  assert.throws(
    () => compileInteractionRuntimePack(wrongSource),
    /does not identify exact draft evidence/iu,
  );

  const wrongApprovedHash = useSyntheticPack(inputs());
  wrongApprovedHash.promotionHoldManifest.holds[0].approved_payload_sha256 = '0'.repeat(64);
  assert.throws(
    () => compileInteractionRuntimePack(wrongApprovedHash),
    /approved payload SHA-256 does not match/iu,
  );

  const noDrift = useSyntheticPack(inputs());
  noDrift.promotionHoldManifest.holds[0].observed_source_version =
    noDrift.promotionHoldManifest.holds[0].approved_source_version;
  noDrift.promotionHoldManifest.holds[0].observed_payload_sha256 =
    noDrift.promotionHoldManifest.holds[0].approved_payload_sha256;
  assert.throws(
    () => compileInteractionRuntimePack(noDrift),
    /does not record source-version or payload drift/iu,
  );

  const wrongDraftPack = inputs();
  wrongDraftPack.promotionHoldManifest.draft_pack_sha256 = '0'.repeat(64);
  assert.throws(
    () => compileInteractionRuntimePack(wrongDraftPack),
    /draft pack SHA-256 does not match/iu,
  );

  const wrongEvidenceDigest = inputs();
  wrongEvidenceDigest.promotionHoldManifest.evidence_digest_sha256 = '0'.repeat(64);
  assert.throws(
    () => compileInteractionRuntimePack(wrongEvidenceDigest),
    /evidence digest SHA-256 does not match/iu,
  );

  const wrongSourcePolicy = inputs();
  wrongSourcePolicy.promotionHoldManifest.source_policy_sha256 = '0'.repeat(64);
  assert.throws(
    () => compileInteractionRuntimePack(wrongSourcePolicy),
    /source policy SHA-256 does not match/iu,
  );
});

test('promotion holds are strict, unique, and deterministically ordered', () => {
  const unknown = inputs();
  unknown.promotionHoldManifest.holds[0].extra = true;
  assert.throws(
    () => validatePromotionHoldManifest(unknown.promotionHoldManifest),
    /unknown property extra/iu,
  );

  const duplicate = inputs();
  duplicate.promotionHoldManifest.holds.push(
    structuredClone(duplicate.promotionHoldManifest.holds[0]),
  );
  assert.throws(
    () => validatePromotionHoldManifest(duplicate.promotionHoldManifest),
    /duplicate rule_id/iu,
  );

  const unsorted = inputs();
  unsorted.promotionHoldManifest.holds.reverse();
  assert.throws(
    () => validatePromotionHoldManifest(unsorted.promotionHoldManifest),
    /sorted by rule_id/iu,
  );
});
