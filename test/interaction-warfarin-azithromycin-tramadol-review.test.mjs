import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  mapResolvedProducts,
} from '../src/lib/interaction-mapping.mjs';
import {
  checkResolvedProducts,
  validateRulePack,
} from '../src/lib/interaction-checker.mjs';
import {
  assertCommittedProductionOpenPack,
} from './helpers/production-open-pack.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

const packet = readJson(
  'docs/interaction-review/2026-07-27-warfarin-azithromycin-tramadol-review.json',
);
const approvalRecord = fs.readFileSync(
  path.join(
    root,
    'docs',
    'interaction-review',
    '2026-07-27-warfarin-azithromycin-tramadol-clinician-approval.md',
  ),
  'utf8',
);
const ingredientMappings = readJson('data-static/ingredient-mapping-overrides.json');
const presentationMappings = readJson('data-static/product-presentation-overrides.json');
const promotions = readJson(
  'data-static/interaction-promotions.internal-evaluation.json',
);
const internalPack = readJson(
  'data-static/interaction-rules.internal-evaluation.json',
);
const technicalHoldPack = readJson(
  'data-static/interaction-promotion-holds.runtime.internal-evaluation.json',
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
  ['azithromycin', { rxcui: '18631', unii: 'F94OW58Y8V' }],
  ['tramadol', { rxcui: '10689', unii: '39J1LGJ30J' }],
]);
const expectedPresentations = new Map([
  [
    'janaushadhi:18',
    {
      productId: 'sha256:5968b93a6bd3e19bbefacbaffed16ef902dc74d50f9f0ac4fd4b636f417b44c6',
      assertionSha256: '8857d75b73ec7f1e2600928d0d601e8c283dbd177ea8081ec83f7d93f996286d',
      rxcui: '308460',
    },
  ],
  [
    'janaushadhi:28',
    {
      productId: 'sha256:40082328dece8bd9ede7401e76d42cd84d76c63823ebc505783ce7d0d55d44ab',
      assertionSha256: '4e2bfd35afcc31cdb65fadf293c6d5a39e2ecbf5ecf58b428889132cb6816630',
      rxcui: '835603',
    },
  ],
  [
    'janaushadhi:72',
    {
      productId: 'sha256:e935455d6e58eef7d1cb40cf68e4e4ab02cbe768405adf38278f37d4c3664d25',
      assertionSha256: '486892da381243eee3d79a37e4708e2b74e38d9c35ed0fe0fb409f5455fe5db3',
      rxcui: '248656',
    },
  ],
  [
    'janaushadhi:521',
    {
      productId: 'sha256:d1e2560cc1b427cfc8b6f8edcc41d3861ac6235aaefd313ea9f0df3dff5635f4',
      assertionSha256: 'ebb760346acbcc1945168a642a25ecb265326476fbd6a723aeb5edba3629b829',
      rxcui: '833709',
    },
  ],
]);
const expectedRuleScopes = new Map([
  [
    'warfarin__azithromycin_oral',
    { drug: 'azithromycin', severity: 'moderate', products: 2, pairs: 6 },
  ],
  [
    'warfarin__tramadol',
    { drug: 'tramadol', severity: 'major', products: 2, pairs: 6 },
  ],
]);

test('review packet binds two exact ingredients and four exact PMBJP oral tablets', () => {
  assert.equal(packet.review_status, 'clinician_reviewed');
  assert.equal(packet.release_profile, 'internal-evaluation');
  assert.equal(packet.production_open_enabled, false);
  assert.equal(packet.ingredient_identity_candidates.length, 2);
  assert.equal(packet.product_presentation_candidates.length, 4);
  assert.match(approvalRecord, /Reviewer: `clinician:subas`/u);
  assert.match(approvalRecord, /## Ingredient identity approval/u);
  assert.match(approvalRecord, /## Product-presentation approval/u);

  for (const candidate of packet.ingredient_identity_candidates) {
    const name = candidate.proposed_identity.canonical_name;
    const expected = expectedIdentities.get(name);
    assert.ok(expected, name);
    assert.equal(candidate.approval.status, 'reviewed', name);
    assert.equal(candidate.approval.reviewer_id, 'clinician:subas', name);
    assert.equal(candidate.approval.reviewed_at, '2026-07-27', name);
    assert.ok(approvalRecord.includes(candidate.approval.approval_text), name);
    assert.equal(candidate.proposed_identity.relationship, 'exact', name);
    assert.equal(candidate.proposed_identity.runtime_drug, name);
    assert.equal(candidate.proposed_identity.rxnorm.rxcui, expected.rxcui, name);
    assert.equal(candidate.proposed_identity.rxnorm.tty, 'IN', name);
    assert.equal(candidate.proposed_identity.unii.code, expected.unii, name);
    assert.equal(candidate.proposed_identity.rxnorm.version, '06-Jul-2026', name);
    assert.equal(candidate.proposed_identity.rxnorm.api_version, '3.1.354', name);
  }

  for (const candidate of packet.product_presentation_candidates) {
    const expected = expectedPresentations.get(candidate.source_product_id);
    assert.ok(expected, candidate.source_product_id);
    assert.equal(candidate.product_id, expected.productId, candidate.mapping_id);
    assert.equal(
      candidate.product_assertion_sha256,
      expected.assertionSha256,
      candidate.mapping_id,
    );
    assert.equal(candidate.approval.status, 'reviewed', candidate.mapping_id);
    assert.equal(
      candidate.approval.reviewer_id,
      'clinician:subas',
      candidate.mapping_id,
    );
    assert.equal(candidate.approval.reviewed_at, '2026-07-27', candidate.mapping_id);
    assert.ok(
      approvalRecord.includes(candidate.approval.approval_text),
      candidate.mapping_id,
    );
    assert.deepEqual(
      candidate.proposed_presentation,
      { route: 'oral', formulation: 'tablet' },
      candidate.mapping_id,
    );
    const pmbjp = candidate.evidence.find((entry) => entry.source_id === 'janaushadhi');
    const rxnorm = candidate.evidence.find((entry) => entry.source_id === 'rxnorm');
    assert.ok(pmbjp, candidate.mapping_id);
    assert.ok(rxnorm, candidate.mapping_id);
    assert.match(pmbjp.source_url, /^https:\/\/www\.pmbi\.co\.in\/tender\//u);
    assert.match(pmbjp.document_sha256, /^[0-9a-f]{64}$/u);
    assert.equal(rxnorm.identifier, `rxcui:${expected.rxcui}`, candidate.mapping_id);
    assert.equal(rxnorm.tty, 'SCD', candidate.mapping_id);
    assert.match(rxnorm.name, /Oral Tablet/iu, candidate.mapping_id);
  }
});

test('both approved clinical scopes contain the complete exact product cross product', () => {
  assert.equal(packet.proposed_rules.length, 2);

  for (const proposed of packet.proposed_rules) {
    const expected = expectedRuleScopes.get(proposed.rule_id);
    assert.ok(expected, proposed.rule_id);
    assert.equal(proposed.approval.status, 'clinician_reviewed', proposed.rule_id);
    assert.equal(
      proposed.approval.reviewer_id,
      'clinician:subas',
      proposed.rule_id,
    );
    assert.equal(proposed.approval.reviewed_at, '2026-07-27', proposed.rule_id);
    assert.ok(
      approvalRecord.includes(proposed.approval.approval_text),
      proposed.rule_id,
    );
    assert.equal(proposed.review_status, 'clinician_reviewed', proposed.rule_id);
    assert.equal(proposed.proposed_severity, expected.severity, proposed.rule_id);
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
      proposed.management_boundary.bleeding_symptom_counselling,
      true,
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
    assert.equal(draft.rule.management.action_target, null, proposed.rule_id);
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
    assert.match(
      draft.rule.management.prescriber_action,
      /prescriber or anticoagulation service/iu,
      proposed.rule_id,
    );
    assert.match(
      draft.rule.management.prescriber_action,
      /Do not independently/iu,
      proposed.rule_id,
    );
    assert.doesNotMatch(
      draft.rule.management.prescriber_action,
      /prefer (?:another|an antibiotic|a non-interacting)/iu,
      proposed.rule_id,
    );
    assert.equal(draft.rule.management.duration, null, proposed.rule_id);
    assert.equal(draft.rule.risk_factors.length, 2, proposed.rule_id);
  }
});

test('the azithromycin approval preserves uncertainty and does not invent follow-up timing', () => {
  const proposed = packet.proposed_rules.find(
    (entry) => entry.rule_id === 'warfarin__azithromycin_oral',
  );
  const rule = draftLines.get(proposed.rule_id).rule;
  assert.equal(
    proposed.management_boundary.pt_inr_monitoring_during_concomitant_use,
    true,
  );
  assert.equal(
    proposed.management_boundary.prescriber_directed_follow_up_decision_when_course_ends,
    true,
  );
  assert.equal(
    proposed.management_boundary.dedicated_study_no_pt_effect_disclosed,
    true,
  );
  assert.match(rule.mechanism, /dedicated.+did not change prothrombin time/iu);
  assert.match(rule.management.exceptions, /postmarketing/iu);
  assert.match(rule.management.exceptions, /did not affect prothrombin time/iu);
  assert.match(rule.management.monitoring, /during concomitant use/iu);
  assert.doesNotMatch(rule.management.monitoring, /day|week|month/iu);
  assert.deepEqual(proposed.source_versions, [
    'openfda-labels:db52b91e-79f7-4cc1-9564-f2eee8e31c45:48',
  ]);
});

test('the tramadol approval stays within MHRA advice and exact PMBJP products', () => {
  const proposed = packet.proposed_rules.find(
    (entry) => entry.rule_id === 'warfarin__tramadol',
  );
  const rule = draftLines.get(proposed.rule_id).rule;
  assert.equal(
    proposed.management_boundary.additional_pt_inr_monitoring_when_started,
    true,
  );
  assert.equal(
    proposed.management_boundary.prescriber_directed_follow_up_decision_when_stopped,
    true,
  );
  assert.deepEqual(rule.applicability.jurisdiction, ['UK']);
  assert.match(rule.management.patient_counselling, /not to stop warfarin/iu);
  assert.match(rule.management.exceptions, /injections/iu);
  assert.match(rule.management.exceptions, /combination products/iu);
  assert.doesNotMatch(rule.management.monitoring, /day|week|month/iu);
  assert.deepEqual(proposed.source_versions, [
    'mhra-govuk-drug-safety-updates:warfarin-be-alert-to-the-risk-of-drug-interactions-with-tramadol:2024-06-20T11:11:09+01:00',
  ]);
});

test('all other catalogue assertions are explicitly excluded, including stale code 48', () => {
  assert.deepEqual(
    packet.excluded_catalogue_assertions.map((entry) => entry.source_product_id),
    [
      'janaushadhi:26',
      'janaushadhi:27',
      'janaushadhi:47',
      'janaushadhi:48',
      'janaushadhi:510',
      'janaushadhi:1521',
      'janaushadhi:1747',
      'janaushadhi:2649',
    ],
  );
  assert.equal(packet.catalogue_snapshot.matching_pmbjp_assertion_count, 12);
  const stale = packet.excluded_catalogue_assertions.find(
    (entry) => entry.source_product_id === 'janaushadhi:48',
  );
  assert.equal(stale.local_pack_label, "10's");
  assert.equal(stale.current_official_unit_size, "3's");
  assert.match(stale.reason, /stale product assertion/iu);
  assert.match(stale.evidence.document_sha256, /^[0-9a-f]{64}$/u);
  assert.match(stale.evidence.identifier, /amendment-2:48:page-2/u);

  const included = new Set(
    packet.product_presentation_candidates.map((entry) => entry.source_product_id),
  );
  for (const excluded of packet.excluded_catalogue_assertions) {
    assert.equal(included.has(excluded.source_product_id), false);
  }
});

test('live evidence verification and explicit clinician authorization are both recorded', () => {
  assert.deepEqual(packet.evidence_reverification.section_a_live_verifier, {
    records_verified: 39,
    openfda_records_verified: 37,
    govuk_records_verified: 2,
    unique_openfda_set_ids: 23,
    unique_govuk_pages: 2,
  });
  assert.equal(
    packet.approval_required.promotion_remains_blocked_until_explicit_clinician_review,
    false,
  );
  assert.deepEqual(packet.approval_required, {
    ingredient_identity_approvals: 0,
    product_presentation_approvals: 0,
    clinical_rule_approvals: 0,
    promotion_remains_blocked_until_explicit_clinician_review: false,
  });
  assert.ok(packet.ingredient_identity_candidates.every(
    (entry) => entry.approval.reviewer_id === 'clinician:subas',
  ));
  assert.ok(packet.product_presentation_candidates.every(
    (entry) => entry.approval.reviewer_id === 'clinician:subas',
  ));
  assert.ok(packet.proposed_rules.every(
    (entry) => entry.approval.reviewer_id === 'clinician:subas',
  ));
});

test('approved candidates map and promote only their exact internal-evaluation scopes', () => {
  for (const name of expectedIdentities.keys()) {
    const mapping = ingredientMappings.mappings.find(
      (entry) => entry.identity.runtime_drug === name,
    );
    assert.ok(mapping, name);
    assert.equal(mapping.review.status, 'reviewed', name);
    assert.equal(mapping.review.reviewer_id, 'clinician:subas', name);
    assert.equal(mapping.review.reviewed_at, '2026-07-27', name);
  }

  const candidateMappingIds = new Set(
    packet.product_presentation_candidates.map((candidate) => candidate.mapping_id),
  );
  const reviewedPresentations = presentationMappings.mappings.filter(
    (mapping) => candidateMappingIds.has(mapping.mapping_id),
  );
  assert.equal(reviewedPresentations.length, 4);
  assert.ok(reviewedPresentations.every((mapping) => (
    mapping.review.status === 'reviewed'
    && mapping.review.reviewer_id === 'clinician:subas'
    && mapping.review.reviewed_at === '2026-07-27'
    && mapping.allowed_profiles.length === 1
    && mapping.allowed_profiles[0] === 'internal-evaluation'
  )));

  for (const ruleId of expectedRuleScopes.keys()) {
    const expected = expectedRuleScopes.get(ruleId);
    const packetRule = packet.proposed_rules.find((rule) => rule.rule_id === ruleId);
    const promotion = promotions.promotions.find((entry) => entry.rule_id === ruleId);
    assert.ok(promotion, ruleId);
    assert.equal(promotion.draft_rule_sha256, packetRule.draft_rule_sha256, ruleId);
    assert.equal(
      promotion.scope.expected_product_pair_count,
      expected.pairs,
      ruleId,
    );
    assert.equal(promotion.approval.status, 'clinician_reviewed', ruleId);
    assert.equal(promotion.approval.reviewer_id, 'clinician:subas', ruleId);
    assert.deepEqual(
      promotion.approval.source_versions,
      packetRule.source_versions,
      ruleId,
    );
    assert.equal(
      promotion.approval.approval_text,
      packetRule.approval.approval_text,
      ruleId,
    );

    assert.equal(
      internalPack.rules.some((rule) => rule.rule_id === ruleId),
      false,
      `${ruleId} must remain technically held after live provenance drift`,
    );
  }
  assertCommittedProductionOpenPack();
});

const runtimeProductIds = new Map([
  ['2141', 'sha256:d5c2e164ff5144544a122908b964b144e2132b9ff216a66bb3a57b80b944ffca'],
  ['2142', 'sha256:9570b79daed31dd5271ec2021558be191fddfe4e3d1002e66a3383dc1a309548'],
  ['452', 'sha256:a543d303907ce3804debf1784653e97b30ef00f4eebb040d8e89fbfbbfbf4141'],
  ['18', 'sha256:5968b93a6bd3e19bbefacbaffed16ef902dc74d50f9f0ac4fd4b636f417b44c6'],
  ['72', 'sha256:e935455d6e58eef7d1cb40cf68e4e4ab02cbe768405adf38278f37d4c3664d25'],
  ['28', 'sha256:40082328dece8bd9ede7401e76d42cd84d76c63823ebc505783ce7d0d55d44ab'],
  ['521', 'sha256:d1e2560cc1b427cfc8b6f8edcc41d3861ac6235aaefd313ea9f0df3dff5635f4'],
]);

const runtimeProducts = [
  ['2141', 'Warfarin Tablets IP 1mg', "10's", 'warfarin', '1mg', 1],
  ['2142', 'Warfarin Tablets IP 2mg', "10's", 'warfarin', '2mg', 2],
  ['452', 'Warfarin Tablets IP 5 mg', "10's", 'warfarin', '5 mg', 5],
  ['18', 'Azithromycin Tablets IP 250 mg', "6's", 'azithromycin', '250 mg', 250],
  ['72', 'Azithromycin Tablets IP 500 mg', "3's", 'azithromycin', '500 mg', 500],
  ['28', 'Tramadol Tablets 50mg', "10's", 'tramadol', '50mg', 50],
  [
    '521',
    'Tramadol Prolonged Release Tablets IP 100 mg',
    "10's",
    'tramadol',
    '100 mg',
    100,
  ],
].map(([sourceId, brandName, packLabel, molecule, strengthRaw, strengthValue]) => ({
  input: { brand_name: brandName },
  status: 'resolved',
  product: {
    product_id: runtimeProductIds.get(sourceId),
    brand_name: brandName,
    manufacturer: 'PMBJP (Jan Aushadhi)',
    pack_label: packLabel,
    form_raw: null,
    ingredients: [{
      molecule,
      strength_raw: strengthRaw,
      strength_value: strengthValue,
      strength_unit: 'mg',
    }],
    sources: [{ source: 'janaushadhi', source_id: sourceId }],
  },
}));

test('all 12 exact held combinations require manual review without clinical details', () => {
  assert.equal(validateRulePack(internalPack), true);
  assert.equal(validateRulePack(productionPack), true);
  const mapped = mapResolvedProducts({
    records: runtimeProducts,
    ingredientManifest: ingredientMappings,
    presentationManifest: presentationMappings,
    profile: 'internal-evaluation',
  });
  const warfarin = mapped.filter((record) => (
    record.product.ingredients[0].runtime_subject.drug === 'warfarin'
  ));

  for (const [ruleId, expected] of expectedRuleScopes) {
    const interacting = mapped.filter((record) => (
      record.product.ingredients[0].runtime_subject.drug === expected.drug
    ));
    let checked = 0;
    for (const first of interacting) {
      for (const second of warfarin) {
        const result = checkResolvedProducts({
          resolvedInputs: [first, second],
          rulePack: internalPack,
          technicalHoldPack,
        });
        assert.deepEqual(result.reviewed_findings, [], ruleId);
        assert.deepEqual(result.review_candidates, [], ruleId);
        assert.equal(result.clinical_interaction_status, 'not_evaluated', ruleId);
        assert.equal(result.outcome_code, 'manual_review_required', ruleId);
        const held = result.not_evaluated.filter(
          (entry) => entry.code === 'PROMOTION_HELD_LIVE_PROVENANCE_DRIFT',
        );
        assert.equal(held.length, 1, ruleId);
        assert.equal(held[0].rule_id, ruleId);
        for (const forbidden of ['severity', 'dispense_action', 'mechanism', 'management', 'evidence']) {
          assert.equal(Object.hasOwn(held[0], forbidden), false, `${ruleId}.${forbidden}`);
        }
        assert.equal(result.unresolved_inputs.length, 0);
        assert.equal(result.checked_pairs.length, 1);
        checked += 1;

        const reversed = checkResolvedProducts({
          resolvedInputs: [second, first],
          rulePack: internalPack,
          technicalHoldPack,
        });
        assert.deepEqual(reversed.checked_pairs, result.checked_pairs);
        assert.deepEqual(reversed.reviewed_findings, result.reviewed_findings);
        assert.deepEqual(reversed.not_evaluated, result.not_evaluated);
      }
    }
    assert.equal(checked, expected.pairs, ruleId);
  }

  for (const drug of ['azithromycin', 'tramadol']) {
    const approved = mapped.find(
      (record) => record.product.ingredients[0].runtime_subject.drug === drug,
    );
    const unapproved = structuredClone(approved);
    unapproved.product.product_id = `sha256:unapproved-${drug}-product`;
    const result = checkResolvedProducts({
      resolvedInputs: [unapproved, warfarin[0]],
      rulePack: internalPack,
      technicalHoldPack,
    });
    assert.deepEqual(result.reviewed_findings, [], drug);
    assert.equal(result.outcome_code, 'no_reviewed_finding', drug);
    assert.ok(!result.not_evaluated.some(
      (entry) => entry.code === 'PROMOTION_HELD_LIVE_PROVENANCE_DRIFT',
    ), drug);
  }

  const forbiddenSourceIds = new Set(['26', '27', '47', '48', '510', '1521', '1747', '2649']);
  assert.ok(presentationMappings.mappings.every((mapping) => {
    const sourceId = mapping.mapping_id.split(':')[2];
    return !forbiddenSourceIds.has(sourceId);
  }));

  const mappedProduction = mapResolvedProducts({
    records: runtimeProducts,
    ingredientManifest: ingredientMappings,
    presentationManifest: presentationMappings,
    profile: 'production-open',
  });
  const productionAttempt = checkResolvedProducts({
    resolvedInputs: [mappedProduction[0], mappedProduction[3]],
    rulePack: internalPack,
    technicalHoldPack,
  });
  assert.deepEqual(productionAttempt.checked_pairs, []);
  assert.deepEqual(productionAttempt.reviewed_findings, []);
});
