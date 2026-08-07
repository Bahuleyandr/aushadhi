import { createHash } from 'node:crypto';
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
import {
  assertCommittedProductionOpenPack,
} from './helpers/production-open-pack.mjs';

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

function mutateDraft(source, mutateRule, ruleId = 'warfarin__amiodarone') {
  const text = Buffer.from(source.draftPackBytes).toString('utf8');
  const rules = text.trimEnd().split('\n').map(JSON.parse);
  mutateRule(rules.find((rule) => rule.rule_id === ruleId));
  const draftPackBytes = Buffer.from(
    `${rules.map((rule) => JSON.stringify(rule)).join('\n')}\n`,
  );
  const attestation = createDraftPackAttestation({
    packBytes: draftPackBytes,
    memberSetsBytes: source.memberSetsBytes,
    rules,
    verifiedAt: source.attestation.verified_at,
  });
  return {
    ...source,
    draftPackBytes,
    attestation,
    promotionHoldManifest: {
      ...source.promotionHoldManifest,
      draft_pack_sha256: attestation.pack_sha256,
      evidence_digest_sha256: attestation.evidence_digest_sha256,
    },
  };
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
  assert.equal(compiled.rules.length, 6);
  const amiodarone = compiled.rules.find(
    (rule) => rule.rule_id === 'warfarin__amiodarone',
  );
  const fluconazole = compiled.rules.find(
    (rule) => rule.rule_id === 'warfarin__fluconazole',
  );
  const metronidazole = compiled.rules.find(
    (rule) => rule.rule_id === 'warfarin__metronidazole',
  );
  const ketoconazole = compiled.rules.find(
    (rule) => rule.rule_id === 'warfarin__ketoconazole_oral',
  );
  const voriconazole = compiled.rules.find(
    (rule) => rule.rule_id === 'warfarin__voriconazole',
  );
  assert.equal(amiodarone.product_pairs.length, 6);
  assert.equal(amiodarone.review.reviewer_id, 'clinician:subas');
  assert.match(amiodarone.management, /prescriber or anticoagulation service/iu);
  assert.match(amiodarone.management, /PT\/INR monitoring/iu);
  assert.match(amiodarone.management, /weeks to months/iu);
  assert.match(amiodarone.management, /bleeding or bruising/iu);
  assert.match(amiodarone.management, /not an autonomous pharmacy action/iu);
  assert.equal(fluconazole.product_pairs.length, 12);
  assert.equal(fluconazole.review.reviewer_id, 'clinician:subas');
  assert.match(fluconazole.management, /prescriber or anticoagulation service/iu);
  assert.match(fluconazole.management, /PT\/INR monitoring/iu);
  assert.match(fluconazole.management, /4 to 5 days/iu);
  assert.equal(metronidazole.product_pairs.length, 6);
  assert.equal(ketoconazole.product_pairs.length, 3);
  assert.equal(voriconazole.product_pairs.length, 3);
  for (const rule of [metronidazole, ketoconazole, voriconazole]) {
    assert.equal(rule.review.reviewer_id, 'clinician:subas');
    assert.match(rule.management, /prescriber or anticoagulation service/iu);
    assert.match(rule.management, /PT\/INR monitoring/iu);
    assert.match(rule.management, /started or stopped/iu);
    assert.match(rule.management, /bleeding or bruising/iu);
    assert.doesNotMatch(
      JSON.stringify(rule),
      /Child-Pugh|Indian regulatory-label claim/iu,
    );
  }
  assert.equal(
    compiled.rules.some((rule) => rule.rule_id === 'warfarin__azithromycin_oral'),
    false,
  );
  assert.equal(
    compiled.rules.some((rule) => rule.rule_id === 'warfarin__tramadol'),
    false,
  );
  assert.match(fluconazole.management, /bleeding or bruising/iu);
  assert.match(fluconazole.management, /do not independently stop/iu);
  assert.match(fluconazole.management, /autonomously change/iu);
  assert.match(fluconazole.management, /do not establish a single-dose exception/iu);
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

  const secondSource = mutateDraft(inputs(), (rule) => {
    rule.management.monitoring = `${rule.management.monitoring} Changed without renewed approval.`;
  }, 'warfarin__fluconazole');
  assert.throws(
    () => compileInteractionRuntimePack(secondSource),
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

test('promotion accepts only explicit machine-confirmed citation states', () => {
  const source = mutateDraft(inputs(), (rule) => {
    rule.evidence[0].citation_status = 'machine_confirmed_but_not_promotable';
  }, 'warfarin__fluconazole');
  const line = Buffer.from(source.draftPackBytes)
    .toString('utf8')
    .trimEnd()
    .split('\n')
    .find((entry) => JSON.parse(entry).rule_id === 'warfarin__fluconazole');
  source.promotionManifest.promotions.find(
    (promotion) => promotion.rule_id === 'warfarin__fluconazole',
  ).draft_rule_sha256 = createHash('sha256').update(line, 'utf8').digest('hex');

  assert.throws(
    () => compileInteractionRuntimePack(source),
    /evidence is not eligible for clinician-gated internal promotion/iu,
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

test('production-open promotion requires approval explicitly bound to that profile', () => {
  const source = inputs();
  source.promotionManifest.profile = 'production-open';
  source.promotionHoldManifest.profile = 'production-open';
  for (const mapping of source.presentationManifest.mappings) {
    mapping.allowed_profiles = ['production-open'];
  }

  assert.throws(
    () => compileInteractionRuntimePack(source),
    /production-open approval must explicitly authorize the production-open profile/iu,
  );
});

test('production-open promotion rejects approval text that preserves an internal-only ceiling', () => {
  const source = inputs();
  source.promotionManifest.profile = 'production-open';
  source.promotionHoldManifest.profile = 'production-open';
  for (const promotion of source.promotionManifest.promotions) {
    promotion.approval.authorized_profile = 'production-open';
  }
  for (const mapping of source.presentationManifest.mappings) {
    mapping.allowed_profiles = ['production-open'];
  }

  assert.throws(
    () => compileInteractionRuntimePack(source),
    /production-open approval text contradicts its authorized profile/iu,
  );
});

test('production-open approval text must explicitly name its authorized profile', () => {
  const manifest = inputs().promotionManifest;
  manifest.profile = 'production-open';
  for (const promotion of manifest.promotions) {
    promotion.approval.authorized_profile = 'production-open';
    promotion.approval.approval_text = 'I approve this exact rule for public evaluation.';
  }

  assert.throws(
    () => validatePromotionManifest(manifest),
    /production-open approval text must explicitly name the production-open profile/iu,
  );

  for (const promotion of manifest.promotions) {
    promotion.approval.approval_text = 'I approve this exact rule for production-open.';
  }
  assert.equal(validatePromotionManifest(manifest), true);
});

test('production-open equals its owner-approved recompilation and stays independent of internal promotion', () => {
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
  const production = assertCommittedProductionOpenPack();
  assert.equal(production.profile, 'production-open');
});
