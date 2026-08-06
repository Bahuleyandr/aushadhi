import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkResolvedProducts,
  validateRulePack,
  validateTechnicalHoldPack,
} from '../src/lib/interaction-checker.mjs';
import {
  compileInteractionRuntimeArtifacts,
  serializeInteractionRuntimePack,
  serializeInteractionTechnicalHoldPack,
} from '../src/lib/interaction-promotion.mjs';
import {
  createDraftPackAttestation,
} from '../src/lib/interaction-draft-attestation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function bytes(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath));
}

function json(relativePath) {
  return JSON.parse(bytes(relativePath).toString('utf8'));
}

function inputs() {
  const promotionHoldManifestBytes = bytes(
    'data-static/interaction-promotion-holds.internal-evaluation.json',
  );
  return {
    promotionManifest: json('data-static/interaction-promotions.internal-evaluation.json'),
    promotionHoldManifest: JSON.parse(promotionHoldManifestBytes.toString('utf8')),
    promotionHoldManifestBytes,
    sourcePolicyBytes: bytes('data-static/interaction-sources.json'),
    draftPackBytes: bytes('docs/interaction-review/batch-01-v2/batch-01-v2.jsonl'),
    attestation: json('docs/interaction-review/batch-01-v2/batch-01-v2.provenance.json'),
    memberSetsBytes: bytes('data-static/interaction-member-sets.json'),
    ingredientManifest: json('data-static/ingredient-mapping-overrides.json'),
    presentationManifest: json('data-static/product-presentation-overrides.json'),
  };
}

function resolved(productId, ingredientId) {
  return {
    input: { product_id: productId },
    status: 'resolved',
    product: {
      product_id: productId,
      presentation: {
        status: 'reviewed_override',
        route: 'oral',
        formulation: 'tablet',
      },
      ingredients: [{
        ingredient_id: ingredientId,
        mapping_status: 'exact',
        runtime_drug: ingredientId,
        runtime_subject: {
          drug: ingredientId,
          route: 'oral',
          formulation: 'tablet',
        },
      }],
    },
  };
}

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalJsonValue(value[key])]),
    );
  }
  return value;
}

function holdsSha256(holds) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJsonValue(holds)))
    .digest('hex');
}

function aliasHeldRulesWithoutHolds(source) {
  const aliases = new Map([
    ['warfarin__azithromycin_oral', 'warfarin__azithromycin_oral_alias'],
    ['warfarin__tramadol', 'warfarin__tramadol_alias'],
  ]);
  const rules = Buffer.from(source.draftPackBytes)
    .toString('utf8')
    .trimEnd()
    .split('\n')
    .map(JSON.parse);
  for (const rule of rules) {
    const alias = aliases.get(rule.rule_id);
    if (alias) rule.rule_id = alias;
  }
  const lines = rules.map((rule) => JSON.stringify(rule));
  const draftPackBytes = Buffer.from(`${lines.join('\n')}\n`);
  const attestation = createDraftPackAttestation({
    packBytes: draftPackBytes,
    memberSetsBytes: source.memberSetsBytes,
    rules,
    verifiedAt: source.attestation.verified_at,
  });
  for (const promotion of source.promotionManifest.promotions) {
    const alias = aliases.get(promotion.rule_id);
    if (!alias) continue;
    promotion.rule_id = alias;
    const line = lines.find((entry) => JSON.parse(entry).rule_id === alias);
    promotion.draft_rule_sha256 = createHash('sha256').update(line).digest('hex');
  }
  return {
    ...source,
    draftPackBytes,
    attestation,
    promotionHoldManifest: {
      ...source.promotionHoldManifest,
      draft_pack_sha256: attestation.pack_sha256,
      evidence_digest_sha256: attestation.evidence_digest_sha256,
      runtime_hold_scope_sha256: holdsSha256([]),
      holds: [],
    },
  };
}

test('compiler emits a separately bound nonclinical runtime artifact for exact held scopes', () => {
  const source = inputs();
  const { rulePack, technicalHoldPack } = compileInteractionRuntimeArtifacts(source);

  assert.equal(rulePack.pack_version, '0.5.0');
  assert.equal(technicalHoldPack.profile, 'internal-evaluation');
  assert.equal(technicalHoldPack.holds_sha256, holdsSha256(technicalHoldPack.holds));
  assert.equal(
    source.promotionHoldManifest.runtime_hold_scope_sha256,
    technicalHoldPack.holds_sha256,
  );
  assert.deepEqual(
    technicalHoldPack.holds.map((hold) => hold.rule_id),
    ['warfarin__azithromycin_oral', 'warfarin__tramadol'],
  );
  assert.equal(validateTechnicalHoldPack(technicalHoldPack, { rulePack }), true);
  assert.equal(
    technicalHoldPack.rule_pack_sha256,
    technicalHoldPackSha256(serializeInteractionRuntimePack(rulePack)),
  );
  for (const hold of technicalHoldPack.holds) {
    assert.ok(hold.product_pairs.length > 0);
    assert.equal(hold.status, 'held');
    assert.equal(hold.reason, 'live_provenance_drift');
    for (const forbidden of ['severity', 'dispense_action', 'mechanism', 'management', 'evidence']) {
      assert.equal(Object.hasOwn(hold, forbidden), false, `${hold.rule_id}.${forbidden}`);
    }
  }
  assert.doesNotThrow(() => JSON.parse(serializeInteractionTechnicalHoldPack(technicalHoldPack)));
});

test('the full runtime hold scope is hash-bound and the committed scope cannot be rewritten', () => {
  const { rulePack, technicalHoldPack } = compileInteractionRuntimeArtifacts(inputs());
  const mutated = structuredClone(technicalHoldPack);
  mutated.holds[0].product_pairs[0][0] = `sha256:5${'0'.repeat(63)}`;
  assert.throws(
    () => validateTechnicalHoldPack(mutated, { rulePack }),
    /holds SHA-256 does not match/iu,
  );

  mutated.holds_sha256 = holdsSha256(mutated.holds);
  assert.throws(
    () => validateTechnicalHoldPack(mutated, { rulePack }),
    /required held scope|committed held scope/iu,
  );
});

test('compiler rejects a source manifest whose independent runtime-scope digest drifts', () => {
  const source = inputs();
  source.promotionHoldManifest.runtime_hold_scope_sha256 = '0'.repeat(64);
  assert.throws(
    () => compileInteractionRuntimeArtifacts(source),
    /runtime hold scope SHA-256 does not match/iu,
  );
});

test('a renamed active rule cannot inherit a historically held exact scope', () => {
  const { rulePack, technicalHoldPack } = compileInteractionRuntimeArtifacts(inputs());
  const aliasPack = structuredClone(rulePack);
  const heldScope = technicalHoldPack.holds[0];
  aliasPack.rules.push({
    ...structuredClone(aliasPack.rules[0]),
    rule_id: 'renamed__held_scope_alias',
    pair: structuredClone(heldScope.pair),
    product_pairs: structuredClone(heldScope.product_pairs),
  });
  aliasPack.rules.sort((left, right) => left.rule_id.localeCompare(right.rule_id));

  assert.throws(
    () => validateRulePack(aliasPack),
    /historically held scope|active rule overlaps/iu,
  );
});

test('renaming the canonical internal pack does not make its hold artifact optional', () => {
  const { rulePack } = compileInteractionRuntimeArtifacts(inputs());
  const aliasPack = { ...rulePack, pack_id: 'renamed-internal-pack' };
  assert.throws(
    () => checkResolvedProducts({ resolvedInputs: [], rulePack: aliasPack }),
    /technical hold pack is required/iu,
  );
});

test('compiler rejects aliased held scopes even when every ID and hold record is removed', () => {
  const source = aliasHeldRulesWithoutHolds(inputs());
  assert.throws(
    () => compileInteractionRuntimeArtifacts(source),
    /historically held scope|active rule overlaps/iu,
  );
});

test('an exact held product pair is not evaluated and requires manual review without clinical text', () => {
  const { rulePack, technicalHoldPack } = compileInteractionRuntimeArtifacts(inputs());
  const hold = technicalHoldPack.holds[0];
  const result = checkResolvedProducts({
    resolvedInputs: [
      resolved(hold.product_pairs[0][0], hold.pair[0]),
      resolved(hold.product_pairs[0][1], hold.pair[1]),
    ],
    rulePack,
    technicalHoldPack,
  });

  assert.equal(result.clinical_interaction_status, 'not_evaluated');
  assert.equal(result.outcome_code, 'manual_review_required');
  assert.deepEqual(result.reviewed_findings, []);
  assert.deepEqual(result.review_candidates, []);
  const entry = result.not_evaluated.find(
    (value) => value.code === 'PROMOTION_HELD_LIVE_PROVENANCE_DRIFT',
  );
  assert.ok(entry);
  assert.equal(entry.rule_id, hold.rule_id);
  assert.deepEqual(entry.matched_product_pairs, [hold.product_pairs[0]]);
  for (const forbidden of ['severity', 'dispense_action', 'mechanism', 'management', 'evidence']) {
    assert.equal(Object.hasOwn(entry, forbidden), false, forbidden);
  }

  const widened = checkResolvedProducts({
    resolvedInputs: [
      resolved(`sha256:${'f'.repeat(64)}`, hold.pair[0]),
      resolved(hold.product_pairs[0][1], hold.pair[1]),
    ],
    rulePack,
    technicalHoldPack,
  });
  assert.equal(widened.outcome_code, 'no_reviewed_finding');
  assert.ok(!widened.not_evaluated.some(
    (value) => value.code === 'PROMOTION_HELD_LIVE_PROVENANCE_DRIFT',
  ));
});

test('the committed internal pack cannot be checked without its exact hold artifact', () => {
  const { rulePack, technicalHoldPack } = compileInteractionRuntimeArtifacts(inputs());
  assert.throws(
    () => checkResolvedProducts({ resolvedInputs: [], rulePack }),
    /technical hold pack is required/iu,
  );

  const stale = structuredClone(technicalHoldPack);
  stale.rule_pack_sha256 = '0'.repeat(64);
  assert.throws(
    () => checkResolvedProducts({ resolvedInputs: [], rulePack, technicalHoldPack: stale }),
    /rule pack SHA-256 does not match/iu,
  );

  const incomplete = structuredClone(technicalHoldPack);
  incomplete.holds = incomplete.holds.slice(1);
  assert.throws(
    () => validateTechnicalHoldPack(incomplete, { rulePack }),
    /holds SHA-256 does not match|required held scope/iu,
  );
});

test('deleting a known hold cannot reactivate its historical promotion', () => {
  const source = inputs();
  source.promotionHoldManifest.holds = source.promotionHoldManifest.holds.slice(1);
  source.promotionHoldManifestBytes = Buffer.from(
    `${JSON.stringify(source.promotionHoldManifest, null, 2)}\n`,
  );
  assert.throws(
    () => compileInteractionRuntimeArtifacts(source),
    /required promotion hold.*warfarin__azithromycin_oral/iu,
  );
});

test('renaming the internal pack cannot bypass a required historical hold', () => {
  const source = inputs();
  source.promotionManifest.output_pack.pack_id = 'aushadhi-internal-interactions-v2';
  source.promotionHoldManifest.pack_id = 'aushadhi-internal-interactions-v2';
  source.promotionHoldManifest.holds = [];
  assert.throws(
    () => compileInteractionRuntimeArtifacts(source),
    /required promotion hold.*warfarin__azithromycin_oral/iu,
  );
});

test('a mixed active finding and held scope is explicit at the aggregate level', () => {
  const { rulePack, technicalHoldPack } = compileInteractionRuntimeArtifacts(inputs());
  const hold = technicalHoldPack.holds.find(
    (entry) => entry.rule_id === 'warfarin__azithromycin_oral',
  );
  const active = rulePack.rules.find((entry) => entry.rule_id === 'warfarin__amiodarone');
  const heldProductPair = hold.product_pairs.find((heldPair) => (
    active.product_pairs.some((activePair) => activePair.some((id) => heldPair.includes(id)))
  ));
  const activeProductPair = active.product_pairs.find(
    (activePair) => activePair.some((id) => heldProductPair.includes(id)),
  );
  const sharedProductId = heldProductPair.find((id) => activeProductPair.includes(id));
  const heldOnlyProductId = heldProductPair.find((id) => id !== sharedProductId);
  const activeOnlyProductId = activeProductPair.find((id) => id !== sharedProductId);
  const sharedIngredientId = hold.pair.find((id) => active.pair.includes(id));
  const heldOnlyIngredientId = hold.pair.find((id) => id !== sharedIngredientId);
  const activeOnlyIngredientId = active.pair.find((id) => id !== sharedIngredientId);

  const result = checkResolvedProducts({
    resolvedInputs: [
      resolved(sharedProductId, sharedIngredientId),
      resolved(heldOnlyProductId, heldOnlyIngredientId),
      resolved(activeOnlyProductId, activeOnlyIngredientId),
    ],
    rulePack,
    technicalHoldPack,
  });

  assert.equal(
    result.clinical_interaction_status,
    'reviewed_interaction_found_with_unevaluated_scope',
  );
  assert.equal(
    result.outcome_code,
    'reviewed_action_and_manual_review_required',
  );
  assert.deepEqual(
    result.reviewed_findings.map((finding) => finding.rule_id),
    ['warfarin__amiodarone'],
  );
  assert.ok(result.not_evaluated.some(
    (entry) => entry.code === 'PROMOTION_HELD_LIVE_PROVENANCE_DRIFT',
  ));
});

function technicalHoldPackSha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
