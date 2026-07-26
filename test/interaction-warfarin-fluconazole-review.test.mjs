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
  'docs/interaction-review/2026-07-26-warfarin-fluconazole-review.json',
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
const fluconazoleLine = sectionLines.find(
  (line) => JSON.parse(line).rule_id === 'warfarin__fluconazole',
);
const draftRule = JSON.parse(fluconazoleLine);

test('warfarin-fluconazole packet binds one exact ingredient and four exact PMBJP assertions', () => {
  assert.equal(packet.review_status, 'review_candidate');
  assert.equal(packet.release_profile, 'internal-evaluation');
  assert.equal(packet.production_open_enabled, false);

  const ingredient = packet.ingredient_identity_candidate;
  assert.equal(ingredient.approval, null);
  assert.equal(ingredient.proposed_identity.relationship, 'exact');
  assert.deepEqual(
    {
      rxcui: ingredient.proposed_identity.rxnorm.rxcui,
      name: ingredient.proposed_identity.rxnorm.name,
      tty: ingredient.proposed_identity.rxnorm.tty,
      unii: ingredient.proposed_identity.unii.code,
    },
    {
      rxcui: '4450',
      name: 'fluconazole',
      tty: 'IN',
      unii: '8VZV102JFY',
    },
  );

  assert.deepEqual(
    packet.product_presentation_candidates.map((candidate) => candidate.source_product_id),
    [
      'janaushadhi:1246',
      'janaushadhi:2771',
      'janaushadhi:2772',
      'janaushadhi:2773',
    ],
  );
  for (const candidate of packet.product_presentation_candidates) {
    assert.equal(candidate.approval, null, candidate.mapping_id);
    assert.deepEqual(
      candidate.proposed_presentation,
      { route: 'oral', formulation: 'tablet' },
      candidate.mapping_id,
    );
    assert.match(candidate.product_id, /^sha256:[0-9a-f]{64}$/u);
    assert.match(candidate.product_assertion_sha256, /^[0-9a-f]{64}$/u);
    assert.ok(
      candidate.evidence.some((evidence) => evidence.source_id === 'janaushadhi'),
      candidate.mapping_id,
    );
  }

  const fourHundred = packet.product_presentation_candidates.find(
    (candidate) => candidate.source_product_id === 'janaushadhi:2773',
  );
  assert.match(
    fourHundred.evidence.find((evidence) => evidence.source_id === 'rxnorm').note,
    /no active concept/iu,
  );
});

test('proposed clinical scope is the complete 4 by 3 cross product and remains unapproved', () => {
  const proposed = packet.proposed_rule;
  assert.equal(proposed.approval, null);
  assert.equal(proposed.review_status, 'review_candidate');
  assert.equal(proposed.proposed_severity, 'major');
  assert.equal(proposed.proposed_dispense_action, 'confirm_and_monitor');
  assert.equal(proposed.scope.expected_product_pair_count, 12);
  assert.equal(proposed.scope.product_pairs.length, 12);

  const actual = new Set(proposed.scope.product_pairs.map((pair) => JSON.stringify(pair)));
  assert.equal(actual.size, 12);
  for (const fluconazoleId of proposed.scope.fluconazole_product_ids) {
    for (const warfarinId of proposed.scope.warfarin_product_ids) {
      assert.equal(
        actual.has(JSON.stringify([fluconazoleId, warfarinId].sort())),
        true,
        `${fluconazoleId}/${warfarinId}`,
      );
    }
  }

  assert.deepEqual(proposed.source_versions, [
    'openfda-labels:f694c617-3383-416c-91b6-b94fda371204:57',
    'openfda-labels:51e98fb6-ba76-497e-95d8-fe895ef0b7ed:7',
  ]);
  assert.equal(
    proposed.management_boundary.autonomous_pharmacy_dose_change,
    false,
  );
  assert.equal(
    proposed.management_boundary.autonomous_stop_either_medicine,
    false,
  );
  assert.equal(
    proposed.management_boundary.universal_pt_inr_schedule_asserted,
    false,
  );
});

test('the reconciled draft removes unsupported modifiers and exactly matches the packet binding', () => {
  assert.equal(
    createHash('sha256').update(fluconazoleLine, 'utf8').digest('hex'),
    packet.proposed_rule.draft_rule_sha256,
  );
  assert.deepEqual(draftRule.context_modifiers, []);
  assert.deepEqual(draftRule.object.formulation, ['tablet']);
  assert.deepEqual(draftRule.perpetrator.route, ['oral']);
  assert.deepEqual(draftRule.perpetrator.formulation, ['tablet']);
  assert.match(draftRule.management.duration, /4 to 5 days/iu);
  assert.match(draftRule.management.prescriber_action, /do not independently stop/iu);
  assert.equal(draftRule.runtime_enabled, false);
  assert.deepEqual(draftRule.runtime_status, {
    pair_matcher_executable: true,
    clinical_context_complete: false,
    runtime_enabled: false,
    promotion_eligible: false,
  });
  assert.deepEqual(
    draftRule.evidence.map((evidence) => (
      `${evidence.provenance.set_id}:${evidence.provenance.version}`
    )),
    [
      'f694c617-3383-416c-91b6-b94fda371204:57',
      '51e98fb6-ba76-497e-95d8-fe895ef0b7ed:7',
    ],
  );
  assert.ok(
    draftRule.evidence.every((evidence) =>
      evidence.does_not_by_itself_support.includes(
        'An exact Child-Pugh B interaction modifier.',
      )),
  );
});

test('review packet cannot leak into committed mappings, promotion, or either runtime profile', () => {
  assert.equal(
    ingredientMappings.mappings.some(
      (mapping) => mapping.identity.runtime_drug === 'fluconazole',
    ),
    false,
  );
  const pendingPresentationIds = new Set(
    packet.product_presentation_candidates.map((candidate) => candidate.mapping_id),
  );
  assert.equal(
    presentationMappings.mappings.some(
      (mapping) => pendingPresentationIds.has(mapping.mapping_id),
    ),
    false,
  );
  assert.equal(
    promotions.promotions.some((promotion) => promotion.rule_id === 'warfarin__fluconazole'),
    false,
  );
  assert.equal(
    internalPack.rules.some((rule) => rule.rule_id === 'warfarin__fluconazole'),
    false,
  );
  assert.equal(productionPack.rules.length, 0);
  assert.equal(productionPack.declared_coverage, 'unknown');
});
