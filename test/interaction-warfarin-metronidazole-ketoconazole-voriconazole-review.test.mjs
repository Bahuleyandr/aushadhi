import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

const packet = readJson(
  'docs/interaction-review/2026-07-26-warfarin-metronidazole-ketoconazole-voriconazole-review.json',
);
const ingredientMappings = readJson('data-static/ingredient-mapping-overrides.json');
const presentationMappings = readJson('data-static/product-presentation-overrides.json');
const promotions = readJson(
  'data-static/interaction-promotions.internal-evaluation.json',
);
const internalPack = readJson(
  'data-static/interaction-rules.internal-evaluation.json',
);
const productionPack = readJson('data-static/interaction-rules.json');
const sectionLines = fs.readFileSync(
  path.join(
    root,
    'docs',
    'interaction-review',
    'batch-01-v2',
    'sections',
    'A.verified.jsonl',
  ),
  'utf8',
).trim().split(/\r?\n/u);
const draftLines = new Map(sectionLines.map((line) => {
  const rule = JSON.parse(line);
  return [rule.rule_id, { line, rule }];
}));

const expectedIdentities = new Map([
  ['ketoconazole', { rxcui: '6135', unii: 'R9400W927I' }],
  ['metronidazole', { rxcui: '6922', unii: '140QMO216E' }],
  ['voriconazole', { rxcui: '121243', unii: 'JFU09I87TR' }],
]);
const expectedPresentations = new Map([
  ['janaushadhi:201', 'sha256:80ca56ce18156f053a97dbd7dbe969bc537e7eba9e8722ddb34147387c42910d'],
  ['janaushadhi:202', 'sha256:8bff49d5c03a2d12ea18972a6fc617dac8d096d67ab011bdc5261950c1d2555e'],
  ['janaushadhi:400', 'sha256:1ce7e99945760bf965229ddd3017bc76bb830d8ee7ae1d098cec3991d2b36b67'],
  ['janaushadhi:2034', 'sha256:4383af48fd1aba0c81ec7d4cff6d5eb1620998607fd578f5b7bf6a4696b9952f'],
]);
const expectedRuleScopes = new Map([
  ['warfarin__metronidazole', { drug: 'metronidazole', pairs: 6, products: 2 }],
  ['warfarin__ketoconazole_oral', { drug: 'ketoconazole', pairs: 3, products: 1 }],
  ['warfarin__voriconazole', { drug: 'voriconazole', pairs: 3, products: 1 }],
]);

test('review packet binds three exact ingredients and four exact PMBJP oral tablets', () => {
  assert.equal(packet.review_status, 'review_candidate');
  assert.equal(packet.release_profile, 'internal-evaluation');
  assert.equal(packet.production_open_enabled, false);
  assert.equal(packet.ingredient_identity_candidates.length, 3);
  assert.equal(packet.product_presentation_candidates.length, 4);

  for (const candidate of packet.ingredient_identity_candidates) {
    const name = candidate.proposed_identity.canonical_name;
    const expected = expectedIdentities.get(name);
    assert.ok(expected, name);
    assert.equal(candidate.approval, null, name);
    assert.equal(candidate.proposed_identity.relationship, 'exact', name);
    assert.equal(candidate.proposed_identity.runtime_drug, name);
    assert.equal(candidate.proposed_identity.rxnorm.rxcui, expected.rxcui, name);
    assert.equal(candidate.proposed_identity.rxnorm.tty, 'IN', name);
    assert.equal(candidate.proposed_identity.unii.code, expected.unii, name);
  }

  for (const candidate of packet.product_presentation_candidates) {
    assert.equal(
      candidate.product_id,
      expectedPresentations.get(candidate.source_product_id),
      candidate.source_product_id,
    );
    assert.equal(candidate.approval, null, candidate.mapping_id);
    assert.deepEqual(
      candidate.proposed_presentation,
      { route: 'oral', formulation: 'tablet' },
      candidate.mapping_id,
    );
    assert.match(candidate.product_assertion_sha256, /^[0-9a-f]{64}$/u);
    assert.ok(
      candidate.evidence.some((evidence) => evidence.source_id === 'janaushadhi'),
      candidate.mapping_id,
    );
    assert.ok(
      candidate.evidence.some((evidence) => evidence.source_id === 'rxnorm'),
      candidate.mapping_id,
    );
  }
});

test('each clinical candidate is the complete exact product cross product', () => {
  assert.equal(packet.proposed_rules.length, 3);

  for (const proposed of packet.proposed_rules) {
    const expected = expectedRuleScopes.get(proposed.rule_id);
    assert.ok(expected, proposed.rule_id);
    assert.equal(proposed.approval, null, proposed.rule_id);
    assert.equal(proposed.review_status, 'review_candidate', proposed.rule_id);
    assert.equal(proposed.proposed_severity, 'major', proposed.rule_id);
    assert.equal(
      proposed.proposed_dispense_action,
      'confirm_and_monitor',
      proposed.rule_id,
    );
    assert.equal(
      proposed.scope.interacting_product_ids.length,
      expected.products,
      proposed.rule_id,
    );
    assert.equal(
      proposed.scope.expected_product_pair_count,
      expected.pairs,
      proposed.rule_id,
    );
    assert.equal(proposed.scope.product_pairs.length, expected.pairs, proposed.rule_id);

    const actual = new Set(
      proposed.scope.product_pairs.map((pair) => JSON.stringify(pair)),
    );
    assert.equal(actual.size, expected.pairs, proposed.rule_id);
    for (const interactingId of proposed.scope.interacting_product_ids) {
      for (const warfarinId of proposed.scope.warfarin_product_ids) {
        assert.equal(
          actual.has(JSON.stringify([interactingId, warfarinId].sort())),
          true,
          `${proposed.rule_id}/${interactingId}/${warfarinId}`,
        );
      }
    }

    assert.equal(
      proposed.management_boundary.requires_prescriber_or_anticoagulation_service_review,
      true,
      proposed.rule_id,
    );
    assert.equal(
      proposed.management_boundary.requires_pt_inr_monitoring_when_started_or_stopped,
      true,
      proposed.rule_id,
    );
    assert.equal(
      proposed.management_boundary.autonomous_pharmacy_dose_change,
      false,
      proposed.rule_id,
    );
    assert.equal(
      proposed.management_boundary.autonomous_stop_either_medicine,
      false,
      proposed.rule_id,
    );
    assert.equal(
      proposed.management_boundary.universal_pt_inr_schedule_asserted,
      false,
      proposed.rule_id,
    );
    assert.equal(
      proposed.management_boundary.fixed_post_discontinuation_interval_asserted,
      false,
      proposed.rule_id,
    );
  }
});

test('draft rows exactly match packet hashes and stay oral-tablet review candidates', () => {
  for (const proposed of packet.proposed_rules) {
    const draft = draftLines.get(proposed.rule_id);
    const expected = expectedRuleScopes.get(proposed.rule_id);
    assert.ok(draft, proposed.rule_id);
    assert.equal(
      createHash('sha256').update(draft.line, 'utf8').digest('hex'),
      proposed.draft_rule_sha256,
      proposed.rule_id,
    );
    assert.deepEqual(draft.rule.object.route, ['oral'], proposed.rule_id);
    assert.deepEqual(draft.rule.object.formulation, ['tablet'], proposed.rule_id);
    assert.equal(draft.rule.perpetrator.drug, expected.drug, proposed.rule_id);
    assert.deepEqual(draft.rule.perpetrator.route, ['oral'], proposed.rule_id);
    assert.deepEqual(
      draft.rule.perpetrator.formulation,
      ['tablet'],
      proposed.rule_id,
    );
    assert.deepEqual(draft.rule.context_modifiers, [], proposed.rule_id);
    assert.equal(draft.rule.runtime_enabled, false, proposed.rule_id);
    assert.deepEqual(
      draft.rule.runtime_status,
      {
        pair_matcher_executable: true,
        clinical_context_complete: false,
        runtime_enabled: false,
        promotion_eligible: false,
      },
      proposed.rule_id,
    );
    assert.equal(draft.rule.evidence.length, 2, proposed.rule_id);
    assert.match(
      draft.rule.management.prescriber_action,
      /prescriber or anticoagulation service/iu,
      proposed.rule_id,
    );
    assert.match(
      draft.rule.management.prescriber_action,
      /do not independently stop/iu,
      proposed.rule_id,
    );
    assert.equal(draft.rule.management.duration, null, proposed.rule_id);
  }
});

test('tinidazole and non-tablet product assertions remain explicitly outside scope', () => {
  const metronidazole = draftLines.get('warfarin__metronidazole').rule;
  const ketoconazole = draftLines.get('warfarin__ketoconazole_oral').rule;
  const voriconazole = draftLines.get('warfarin__voriconazole').rule;
  assert.equal(metronidazole.perpetrator.class, undefined);
  assert.doesNotMatch(JSON.stringify(metronidazole.perpetrator), /tinidazole/iu);
  assert.match(metronidazole.management.exceptions, /tinidazole/iu);
  assert.match(metronidazole.management.exceptions, /topical/iu);
  assert.match(metronidazole.management.exceptions, /suspensions/iu);
  assert.match(ketoconazole.management.exceptions, /soap/iu);
  assert.match(ketoconazole.management.exceptions, /topical/iu);
  assert.match(voriconazole.management.exceptions, /intravenous/iu);

  assert.deepEqual(
    packet.excluded_catalogue_assertions.map((entry) => entry.source_product_id),
    ['janaushadhi:1672', 'janaushadhi:2441', 'janaushadhi:2616'],
  );
  assert.doesNotMatch(
    JSON.stringify(packet.ingredient_identity_candidates),
    /tinidazole/iu,
  );
  assert.doesNotMatch(
    JSON.stringify(packet.product_presentation_candidates),
    /soap|ointment|suspension|tinidazole/iu,
  );
});

test('unapproved candidates cannot leak into mappings, promotion, or either runtime pack', () => {
  for (const name of expectedIdentities.keys()) {
    assert.equal(
      ingredientMappings.mappings.some(
        (mapping) => mapping.identity.runtime_drug === name,
      ),
      false,
      name,
    );
  }

  const candidateMappingIds = new Set(
    packet.product_presentation_candidates.map((candidate) => candidate.mapping_id),
  );
  assert.equal(
    presentationMappings.mappings.some(
      (mapping) => candidateMappingIds.has(mapping.mapping_id),
    ),
    false,
  );

  for (const ruleId of expectedRuleScopes.keys()) {
    assert.equal(
      promotions.promotions.some((entry) => entry.rule_id === ruleId),
      false,
      ruleId,
    );
    assert.equal(
      internalPack.rules.some((rule) => rule.rule_id === ruleId),
      false,
      ruleId,
    );
    assert.equal(
      productionPack.rules.some((rule) => rule.rule_id === ruleId),
      false,
      ruleId,
    );
  }
  assert.equal(productionPack.rules.length, 0);
});
