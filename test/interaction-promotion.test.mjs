import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  compileInteractionRuntimePack,
  serializeInteractionRuntimePack,
  validatePromotionManifest,
} from '../src/lib/interaction-promotion.mjs';
import {
  createDraftPackAttestation,
  parseDraftPackAttestation,
} from '../src/lib/interaction-draft-attestation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function inputs() {
  return {
    promotionManifest: readJson(
      'data-static/interaction-promotions.internal-evaluation.json',
    ),
    draftPackBytes: fs.readFileSync(
      path.join(
        ROOT,
        'docs/interaction-review/batch-01-v2/batch-01-v2.jsonl',
      ),
    ),
    attestation: readJson(
      'docs/interaction-review/batch-01-v2/batch-01-v2.provenance.json',
    ),
    memberSetsBytes: fs.readFileSync(
      path.join(ROOT, 'data-static/interaction-member-sets.json'),
    ),
    ingredientManifest: readJson(
      'data-static/ingredient-mapping-overrides.json',
    ),
    presentationManifest: readJson(
      'data-static/product-presentation-overrides.json',
    ),
  };
}

function mutateDraft(source, mutateRule) {
  const text = Buffer.from(source.draftPackBytes).toString('utf8');
  const rules = text.trimEnd().split('\n').map(JSON.parse);
  mutateRule(rules.find((rule) => rule.rule_id === 'warfarin__amiodarone'));
  const draftPackBytes = Buffer.from(
    `${rules.map((rule) => JSON.stringify(rule)).join('\n')}\n`,
  );
  const attestation = createDraftPackAttestation({
    packBytes: draftPackBytes,
    memberSetsBytes: source.memberSetsBytes,
    rules,
    verifiedAt: source.attestation.verified_at,
  });
  return { ...source, draftPackBytes, attestation };
}

test('the promotion manifest deterministically compiles the checked-in internal pack', () => {
  const source = inputs();
  assert.equal(validatePromotionManifest(source.promotionManifest), true);
  const compiled = compileInteractionRuntimePack(source);
  const checkedIn = fs.readFileSync(
    path.join(
      ROOT,
      'data-static/interaction-rules.internal-evaluation.json',
    ),
    'utf8',
  );
  assert.equal(serializeInteractionRuntimePack(compiled), checkedIn);
  assert.equal(compiled.rules.length, 1);
  assert.equal(compiled.rules[0].rule_id, 'warfarin__amiodarone');
  assert.equal(compiled.rules[0].product_pairs.length, 6);
  assert.equal(compiled.rules[0].review.reviewer_id, 'clinician:subas');
  assert.match(compiled.rules[0].management, /prescriber or anticoagulation service/iu);
  assert.match(compiled.rules[0].management, /PT\/INR monitoring/iu);
  assert.match(compiled.rules[0].management, /weeks to months/iu);
  assert.match(compiled.rules[0].management, /bleeding or bruising/iu);
  assert.match(compiled.rules[0].management, /not an autonomous pharmacy action/iu);
  assert.doesNotMatch(JSON.stringify(compiled), /Child-Pugh|Indian regulatory-label claim/iu);
});

test('promotion rejects draft hash drift even when the draft attestation is refreshed', () => {
  const source = mutateDraft(inputs(), (rule) => {
    rule.mechanism = `${rule.mechanism} Changed without renewed approval.`;
  });
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /draft rule SHA-256 does not match/iu,
  );
});

test('promotion rejects an attestation that does not bind the exact draft bytes', () => {
  const source = inputs();
  const text = Buffer.from(source.draftPackBytes).toString('utf8');
  source.draftPackBytes = Buffer.from(text.replace(
    'Amiodarone potentiates warfarin',
    'Amiodarone may potentiate warfarin',
  ));
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /pack_sha256 does not match the draft pack/iu,
  );
});

test('the v2 draft cannot self-authorize a promotion', () => {
  const source = mutateDraft(inputs(), (rule) => {
    rule.review.approver = 'clinician:subas';
  });
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /approver|self-authorize/iu,
  );
});

test('promotion requires the exact approved source versions', () => {
  const source = inputs();
  source.promotionManifest.promotions[0].approval.source_versions[0] =
    'openfda-labels:f49d011f-5ca6-4f75-ba16-2099fe42f5aa:1';
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /source_versions does not match/iu,
  );
});

test('promotion fails closed for missing or unreviewed identity mappings', () => {
  const missing = inputs();
  missing.promotionManifest.promotions[0].scope.sides[0].ingredient_mapping_id =
    'ingredient:warfarin:missing';
  assert.throws(
    () => compileInteractionRuntimePack(missing),
    /missing ingredient mapping/iu,
  );

  const unreviewed = inputs();
  unreviewed.ingredientManifest.mappings[0].review.status = 'review_candidate';
  assert.throws(
    () => compileInteractionRuntimePack(unreviewed),
    /status must be reviewed/iu,
  );
});

test('promotion rejects presentation profile drift and pair-count widening', () => {
  const wrongProfile = inputs();
  wrongProfile.presentationManifest.mappings[0].allowed_profiles = [
    'production-open',
  ];
  assert.throws(
    () => compileInteractionRuntimePack(wrongProfile),
    /not allowed for profile internal-evaluation/iu,
  );

  const widened = inputs();
  widened.promotionManifest.promotions[0].scope.expected_product_pair_count = 7;
  assert.throws(
    () => compileInteractionRuntimePack(widened),
    /expected 7 product pairs but derived 6/iu,
  );
});

test('production-open remains empty and independent of internal promotion', () => {
  const production = readJson('data-static/interaction-rules.json');
  const attestation = parseDraftPackAttestation(
    fs.readFileSync(
      path.join(
        ROOT,
        'docs/interaction-review/batch-01-v2/batch-01-v2.provenance.json',
      ),
      'utf8',
    ),
  );
  assert.equal(attestation.payload_binding, 'verified');
  assert.equal(production.profile, 'production-open');
  assert.equal(production.declared_coverage, 'unknown');
  assert.deepEqual(production.rules, []);
});
