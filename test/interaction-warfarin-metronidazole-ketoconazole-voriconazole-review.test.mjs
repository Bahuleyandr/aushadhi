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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

const packet = readJson(
  'docs/interaction-review/2026-07-26-warfarin-metronidazole-ketoconazole-voriconazole-review.json',
);
const approvalRecord = fs.readFileSync(
  path.join(
    root,
    'docs',
    'interaction-review',
    '2026-07-26-warfarin-metronidazole-ketoconazole-voriconazole-clinician-approval.md',
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
  assert.equal(packet.review_status, 'clinician_reviewed');
  assert.equal(packet.release_profile, 'internal-evaluation');
  assert.equal(packet.production_open_enabled, false);
  assert.equal(packet.ingredient_identity_candidates.length, 3);
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
    assert.equal(candidate.approval.status, 'reviewed', candidate.mapping_id);
    assert.equal(
      candidate.approval.reviewer_id,
      'clinician:subas',
      candidate.mapping_id,
    );
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

test('each approved clinical scope is the complete exact product cross product', () => {
  assert.equal(packet.proposed_rules.length, 3);

  for (const proposed of packet.proposed_rules) {
    const expected = expectedRuleScopes.get(proposed.rule_id);
    assert.ok(expected, proposed.rule_id);
    assert.equal(proposed.approval.status, 'clinician_reviewed', proposed.rule_id);
    assert.equal(
      proposed.approval.reviewer_id,
      'clinician:subas',
      proposed.rule_id,
    );
    assert.equal(proposed.review_status, 'clinician_reviewed', proposed.rule_id);
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
    JSON.stringify(packet.product_presentation_candidates.map((candidate) => ({
      product_assertion: candidate.product_assertion,
      proposed_presentation: candidate.proposed_presentation,
      evidence: candidate.evidence,
    }))),
    /soap|ointment|suspension|tinidazole/iu,
  );
});

test('approved candidates map and promote only their exact internal-evaluation scopes', () => {
  for (const name of expectedIdentities.keys()) {
    const mapping = ingredientMappings.mappings.find(
      (entry) => entry.identity.runtime_drug === name,
    );
    assert.ok(mapping, name);
    assert.equal(mapping.review.status, 'reviewed', name);
    assert.equal(mapping.review.reviewer_id, 'clinician:subas', name);
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

    const runtimeRule = internalPack.rules.find((rule) => rule.rule_id === ruleId);
    assert.ok(runtimeRule, ruleId);
    assert.equal(runtimeRule.product_pairs.length, expected.pairs, ruleId);
    assert.equal(runtimeRule.review.reviewer_id, 'clinician:subas', ruleId);
    assert.deepEqual(runtimeRule.product_pairs, packetRule.scope.product_pairs, ruleId);
    assert.match(runtimeRule.management, /prescriber or anticoagulation service/iu);
    assert.match(runtimeRule.management, /PT\/INR monitoring/iu);
    assert.match(runtimeRule.management, /started or stopped/iu);
    assert.match(runtimeRule.management, /bleeding or bruising/iu);
    assert.doesNotMatch(
      JSON.stringify(runtimeRule),
      /Child-Pugh|Indian regulatory-label claim/iu,
    );
    assert.ok(
      runtimeRule.evidence.every((evidence) => evidence.jurisdiction === 'US'),
      ruleId,
    );
  }
  assert.match(
    internalPack.rules.find(
      (rule) => rule.rule_id === 'warfarin__metronidazole',
    ).management,
    /Tinidazole, topical metronidazole.*combination suspensions/iu,
  );
  assert.match(
    internalPack.rules.find(
      (rule) => rule.rule_id === 'warfarin__ketoconazole_oral',
    ).management,
    /Ketoconazole soap.*topical products are excluded/iu,
  );
  const voriconazoleRuntime = internalPack.rules.find(
    (rule) => rule.rule_id === 'warfarin__voriconazole',
  );
  assert.match(voriconazoleRuntime.management, /Intravenous.*outside/iu);
  assert.doesNotMatch(voriconazoleRuntime.management, /substitut/iu);
  assert.equal(productionPack.rules.length, 0);
  assert.equal(productionPack.declared_coverage, 'unknown');
});

const runtimeProductIds = new Map([
  ['2141', 'sha256:d5c2e164ff5144544a122908b964b144e2132b9ff216a66bb3a57b80b944ffca'],
  ['2142', 'sha256:9570b79daed31dd5271ec2021558be191fddfe4e3d1002e66a3383dc1a309548'],
  ['452', 'sha256:a543d303907ce3804debf1784653e97b30ef00f4eebb040d8e89fbfbbfbf4141'],
  ['201', 'sha256:80ca56ce18156f053a97dbd7dbe969bc537e7eba9e8722ddb34147387c42910d'],
  ['202', 'sha256:8bff49d5c03a2d12ea18972a6fc617dac8d096d67ab011bdc5261950c1d2555e'],
  ['400', 'sha256:1ce7e99945760bf965229ddd3017bc76bb830d8ee7ae1d098cec3991d2b36b67'],
  ['2034', 'sha256:4383af48fd1aba0c81ec7d4cff6d5eb1620998607fd578f5b7bf6a4696b9952f'],
]);

const runtimeProducts = [
  ['2141', 'Warfarin Tablets IP 1mg', "10's", 'warfarin', '1mg', 1],
  ['2142', 'Warfarin Tablets IP 2mg', "10's", 'warfarin', '2mg', 2],
  ['452', 'Warfarin Tablets IP 5 mg', "10's", 'warfarin', '5 mg', 5],
  ['201', 'Metronidazole Tablets IP 200mg', "10's", 'metronidazole', '200mg', 200],
  ['202', 'Metronidazole Tablets IP 400mg', "10's", 'metronidazole', '400mg', 400],
  ['400', 'Ketoconazole Tablets IP 200 mg', "10's", 'ketoconazole', '200 mg', 200],
  ['2034', 'Voriconazole Tablets IP 200mg', "4's", 'voriconazole', '200mg', 200],
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

test('all 12 approved combinations fire and unapproved product identities remain excluded', () => {
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
    const observed = [];
    for (const first of interacting) {
      for (const second of warfarin) {
        const result = checkResolvedProducts({
          resolvedInputs: [first, second],
          rulePack: internalPack,
          technicalHoldPack,
        });
        assert.equal(result.reviewed_findings.length, 1, ruleId);
        assert.equal(result.reviewed_findings[0].rule_id, ruleId);
        assert.equal(
          result.reviewed_findings[0].dispense_action,
          'confirm_and_monitor',
        );
        assert.equal(result.unresolved_inputs.length, 0);
        observed.push(result.checked_pairs[0].product_pairs[0]);

        const reversed = checkResolvedProducts({
          resolvedInputs: [second, first],
          rulePack: internalPack,
          technicalHoldPack,
        });
        assert.deepEqual(reversed.checked_pairs, result.checked_pairs);
        assert.deepEqual(reversed.reviewed_findings, result.reviewed_findings);
      }
    }
    const runtimeRule = internalPack.rules.find((rule) => rule.rule_id === ruleId);
    assert.deepEqual(observed.sort(), runtimeRule.product_pairs);
  }

  for (const drug of ['metronidazole', 'ketoconazole', 'voriconazole']) {
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
  }

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
