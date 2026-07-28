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
} from '../src/lib/interaction-draft-attestation.mjs';
import {
  verifyCombinationManifestEvidence,
} from '../src/lib/combination-rxnorm-evidence.mjs';
import {
  productAssertionForRow,
  productAssertionHashForRow,
  productIdForRow,
} from '../src/lib/product-resolver.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMBINATION_ID = 'combination:co-trimoxazole:rxnorm-10831';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function baseInputs() {
  return {
    promotionManifest: readJson(
      'data-static/interaction-promotions.internal-evaluation.json',
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
    ingredientManifest: readJson(
      'data-static/ingredient-mapping-overrides.json',
    ),
    presentationManifest: readJson(
      'data-static/product-presentation-overrides.json',
    ),
  };
}

function evidenceBundles(manifest) {
  return Object.fromEntries(manifest.combinations.map((combination) => {
    const filename = `${
      combination.combination_id.replaceAll(/[^a-zA-Z0-9._-]/gu, '_')
    }.json`;
    return [
      combination.combination_id,
      readJson(path.join('data-static', 'combination-rxnorm-evidence', filename)),
    ];
  }));
}

function attachAuthenticReport(source) {
  source.combinationEvidenceReport = verifyCombinationManifestEvidence(
    source.combinationManifest,
    evidenceBundles(source.combinationManifest),
  );
  assert.equal(source.combinationEvidenceReport.verified, true);
  return source;
}

function combinationInputs() {
  const source = baseInputs();
  const rules = Buffer.from(source.draftPackBytes)
    .toString('utf8')
    .trimEnd()
    .split('\n')
    .map(JSON.parse);
  const draft = rules.find((rule) => rule.rule_id === 'warfarin__cotrimoxazole');

  draft.object.formulation = ['tablet'];
  draft.perpetrator.route = ['oral'];
  draft.perpetrator.formulation = ['tablet'];
  draft.applicability.routes = ['oral'];
  draft.applicability.formulations = ['tablet'];

  const draftLines = rules.map((rule) => JSON.stringify(rule));
  source.draftPackBytes = Buffer.from(`${draftLines.join('\n')}\n`);
  source.attestation = createDraftPackAttestation({
    packBytes: source.draftPackBytes,
    memberSetsBytes: source.memberSetsBytes,
    rules,
    verifiedAt: source.attestation.verified_at,
  });

  source.combinationManifest = readJson(
    'data-static/combination-identity-overrides.json',
  );
  const combination = source.combinationManifest.combinations.find(
    (entry) => entry.combination_id === COMBINATION_ID,
  );
  assert.ok(combination, 'the reviewed co-trimoxazole combination fixture must exist');

  const legacyObjectSide = structuredClone(
    source.promotionManifest.promotions.find(
      (promotion) => promotion.rule_id === 'warfarin__amiodarone',
    ).scope.sides[0],
  );
  const draftLine = draftLines.find(
    (line) => JSON.parse(line).rule_id === draft.rule_id,
  );
  source.promotionManifest = {
    schema_version: 2,
    profile: 'internal-evaluation',
    output_pack: {
      ...structuredClone(source.promotionManifest.output_pack),
      schema_version: '1.1.0',
    },
    promotions: [{
      rule_id: draft.rule_id,
      draft_rule_sha256: createHash('sha256').update(draftLine).digest('hex'),
      approval: {
        status: 'clinician_reviewed',
        reviewer_id: 'clinician:test-fixture',
        reviewed_at: '2026-07-28',
        approval_text: 'Synthetic compiler fixture; not a committed clinical promotion.',
        source_versions: draft.evidence.map((evidence) => (
          `${evidence.source_policy_id}:`
          + `${evidence.provenance.set_id}:${evidence.provenance.version}`
        )),
      },
      supersession: {
        interaction_family_id: 'warfarin-anticoagulation-potentiation',
        subject_specificity: 'exact_fixed_dose_combination',
        supersedes_rule_ids: [],
      },
      scope: {
        route: 'oral',
        formulation: 'tablet',
        expected_product_pair_count: 6,
        sides: [
          legacyObjectSide,
          {
            draft_role: 'perpetrator',
            binding_kind: 'combination_identity',
            combination_id: combination.combination_id,
            presentation_product_ids: combination.presentations.map(
              (presentation) => presentation.product_id,
            ),
          },
        ],
      },
    }],
  };
  return attachAuthenticReport(source);
}

function expectedProductPairs(source) {
  const objectSide = source.promotionManifest.promotions[0].scope.sides[0];
  const objectProductIds = objectSide.presentation_mapping_ids.map((mappingId) => (
    source.presentationManifest.mappings.find(
      (mapping) => mapping.mapping_id === mappingId,
    ).product_id
  ));
  const combinationProductIds = source.promotionManifest.promotions[0]
    .scope.sides[1].presentation_product_ids;
  return objectProductIds.flatMap((objectProductId) => (
    combinationProductIds.map((combinationProductId) => (
      [objectProductId, combinationProductId].sort()
    ))
  )).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

test('schema v2 binds an authenticated combination side to its exact reviewed products', () => {
  const source = combinationInputs();
  assert.equal(validatePromotionManifest(source.promotionManifest), true);

  const compiled = compileInteractionRuntimePack(source);
  assert.equal(compiled.rules.length, 1);
  const [rule] = compiled.rules;
  const objectMapping = source.ingredientManifest.mappings.find(
    (mapping) => (
      mapping.mapping_id
      === source.promotionManifest.promotions[0].scope.sides[0].ingredient_mapping_id
    ),
  );
  assert.deepEqual(
    rule.pair,
    [objectMapping.identity.clinical_ingredient_id, COMBINATION_ID].sort(),
  );
  assert.deepEqual(rule.product_pairs, expectedProductPairs(source));
});

test('schema v2 compiles clinician-approved D1 metadata with derived subject roles', () => {
  const source = combinationInputs();

  assert.equal(validatePromotionManifest(source.promotionManifest), true);
  const compiled = compileInteractionRuntimePack(source);
  const [rule] = compiled.rules;
  const objectMapping = source.ingredientManifest.mappings.find(
    (mapping) => (
      mapping.mapping_id
      === source.promotionManifest.promotions[0].scope.sides[0].ingredient_mapping_id
    ),
  );

  assert.equal(
    rule.interaction_family_id,
    'warfarin-anticoagulation-potentiation',
  );
  assert.equal(rule.subject_specificity, 'exact_fixed_dose_combination');
  assert.deepEqual(rule.subject_roles, {
    object: objectMapping.identity.clinical_ingredient_id,
    perpetrator: COMBINATION_ID,
  });
  assert.deepEqual(rule.supersedes_rule_ids, []);
});

test('schema v2 retains the exact legacy side shape and byte-identical eight-rule output', () => {
  const source = baseInputs();
  source.promotionManifest.schema_version = 2;
  assert.equal(validatePromotionManifest(source.promotionManifest), true);
  const compiled = compileInteractionRuntimePack(source);
  const checkedIn = fs.readFileSync(
    path.join(ROOT, 'data-static/interaction-rules.internal-evaluation.json'),
    'utf8',
  );
  assert.equal(compiled.rules.length, 8);
  assert.equal(serializeInteractionRuntimePack(compiled), checkedIn);
});

test('schema versions 1 and 2 enforce their exact side variants', () => {
  const v1 = baseInputs().promotionManifest;
  v1.promotions[0].scope.sides[1] = {
    draft_role: 'perpetrator',
    binding_kind: 'combination_identity',
    combination_id: COMBINATION_ID,
    presentation_product_ids: ['sha256:reviewed-product'],
  };
  assert.throws(
    () => validatePromotionManifest(v1),
    /contains unknown property binding_kind/u,
  );

  const v2 = combinationInputs().promotionManifest;
  v2.promotions[0].scope.sides[1].presentation_mapping_ids = [];
  assert.throws(
    () => validatePromotionManifest(v2),
    /contains unknown property presentation_mapping_ids/u,
  );
});

test('D1 promotion metadata is exact, deterministic and schema-version gated', () => {
  const supersession = {
    interaction_family_id: 'warfarin-anticoagulation-potentiation',
    subject_specificity: 'exact_member',
    supersedes_rule_ids: [],
  };

  const v1 = baseInputs().promotionManifest;
  v1.promotions[0].supersession = structuredClone(supersession);
  assert.throws(
    () => validatePromotionManifest(v1),
    /contains unknown property supersession/u,
  );

  const wrongOutputVersion = baseInputs().promotionManifest;
  wrongOutputVersion.schema_version = 2;
  wrongOutputVersion.promotions[0].supersession = structuredClone(supersession);
  assert.throws(
    () => validatePromotionManifest(wrongOutputVersion),
    /output_pack\.schema_version must be 1\.1\.0/u,
  );

  const unsorted = baseInputs().promotionManifest;
  unsorted.schema_version = 2;
  unsorted.output_pack.schema_version = '1.1.0';
  unsorted.promotions[0].supersession = {
    ...structuredClone(supersession),
    supersedes_rule_ids: ['ddi:test:z', 'ddi:test:a'],
  };
  assert.throws(
    () => validatePromotionManifest(unsorted),
    /supersedes_rule_ids must use deterministic sorted order/u,
  );

  const duplicate = baseInputs().promotionManifest;
  duplicate.schema_version = 2;
  duplicate.output_pack.schema_version = '1.1.0';
  duplicate.promotions[0].supersession = {
    ...structuredClone(supersession),
    supersedes_rule_ids: ['ddi:test:a', 'ddi:test:a'],
  };
  assert.throws(
    () => validatePromotionManifest(duplicate),
    /supersedes_rule_ids must contain unique values/u,
  );

  const unknown = baseInputs().promotionManifest;
  unknown.schema_version = 2;
  unknown.output_pack.schema_version = '1.1.0';
  unknown.promotions[0].supersession = {
    ...structuredClone(supersession),
    subject_roles: {
      object: 'warfarin',
      perpetrator: COMBINATION_ID,
    },
  };
  assert.throws(
    () => validatePromotionManifest(unknown),
    /supersession contains unknown property subject_roles/u,
  );

  const emptyFamily = baseInputs().promotionManifest;
  emptyFamily.schema_version = 2;
  emptyFamily.output_pack.schema_version = '1.1.0';
  emptyFamily.promotions[0].supersession = {
    ...structuredClone(supersession),
    interaction_family_id: ' ',
  };
  assert.throws(
    () => validatePromotionManifest(emptyFamily),
    /interaction_family_id must be a non-empty string/u,
  );

  const invalidSpecificity = baseInputs().promotionManifest;
  invalidSpecificity.schema_version = 2;
  invalidSpecificity.output_pack.schema_version = '1.1.0';
  invalidSpecificity.promotions[0].supersession = {
    ...structuredClone(supersession),
    subject_specificity: 'brand_name_guess',
  };
  assert.throws(
    () => validatePromotionManifest(invalidSpecificity),
    /subject_specificity must be exact_member or exact_fixed_dose_combination/u,
  );

  const ingredientClaimingCombination = baseInputs().promotionManifest;
  ingredientClaimingCombination.schema_version = 2;
  ingredientClaimingCombination.output_pack.schema_version = '1.1.0';
  ingredientClaimingCombination.promotions[0].supersession = {
    ...structuredClone(supersession),
    subject_specificity: 'exact_fixed_dose_combination',
  };
  assert.throws(
    () => validatePromotionManifest(ingredientClaimingCombination),
    /subject_specificity must be exact_member for its bound subject type/u,
  );

  const combinationClaimingMember = combinationInputs().promotionManifest;
  combinationClaimingMember.promotions[0].supersession.subject_specificity = 'exact_member';
  assert.throws(
    () => validatePromotionManifest(combinationClaimingMember),
    /subject_specificity must be exact_fixed_dose_combination for its bound subject type/u,
  );

  const combinationWithoutD1 = combinationInputs().promotionManifest;
  delete combinationWithoutD1.promotions[0].supersession;
  assert.throws(
    () => validatePromotionManifest(combinationWithoutD1),
    /combination-bound promotion requires supersession metadata/u,
  );
});

test('promotion accessors cannot change D1 authority after validation', () => {
  const source = combinationInputs();
  const approved = structuredClone(
    source.promotionManifest.promotions[0].supersession,
  );
  delete source.promotionManifest.promotions[0].supersession;
  Object.defineProperty(source.promotionManifest.promotions[0], 'supersession', {
    enumerable: true,
    get() {
      return approved;
    },
  });

  assert.throws(
    () => validatePromotionManifest(source.promotionManifest),
    /accessors and custom serialization are forbidden/u,
  );
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /accessors and custom serialization are forbidden/u,
  );
});

test('combination promotion rejects forged, wrong-object and mutation-stale evidence reports', () => {
  const forged = combinationInputs();
  forged.combinationEvidenceReport = {
    verified: true,
    combinations_checked: 1,
    reports: [],
  };
  assert.throws(
    () => compileInteractionRuntimePack(forged),
    /not an authentic verifier result/u,
  );

  const wrongObject = combinationInputs();
  const otherManifest = structuredClone(wrongObject.combinationManifest);
  wrongObject.combinationEvidenceReport = verifyCombinationManifestEvidence(
    otherManifest,
    evidenceBundles(otherManifest),
  );
  assert.throws(
    () => compileInteractionRuntimePack(wrongObject),
    /not bound to this exact manifest object/u,
  );

  const stale = combinationInputs();
  stale.combinationManifest.notices[0] = `${stale.combinationManifest.notices[0]} Changed.`;
  assert.throws(
    () => compileInteractionRuntimePack(stale),
    /manifest changed since evidence verification/u,
  );
});

test('combination promotion rejects unreviewed identity and profile widening', () => {
  const unreviewed = combinationInputs();
  unreviewed.combinationManifest.combinations[0].review.status = 'review_candidate';
  attachAuthenticReport(unreviewed);
  assert.throws(
    () => compileInteractionRuntimePack(unreviewed),
    /review\.status must be reviewed/u,
  );

  const wrongProfile = combinationInputs();
  wrongProfile.combinationManifest.combinations[0].allowed_profiles = ['production-open'];
  attachAuthenticReport(wrongProfile);
  assert.throws(
    () => compileInteractionRuntimePack(wrongProfile),
    /allowed_profiles.*internal-evaluation/u,
  );
});

test('combination promotion binds runtime drug, presentation scope and explicit products', () => {
  const wrongDrug = combinationInputs();
  wrongDrug.combinationManifest.combinations[0].runtime_drug = 'sulfamethoxazole';
  wrongDrug.combinationEvidenceReport = verifyCombinationManifestEvidence(
    wrongDrug.combinationManifest,
    evidenceBundles(wrongDrug.combinationManifest),
  );
  assert.equal(wrongDrug.combinationEvidenceReport.verified, false);

  const wrongScope = combinationInputs();
  const [combination] = wrongScope.combinationManifest.combinations;
  combination.presentation_scopes = [{ route: 'oral', formulation: 'capsule' }];
  for (const presentation of combination.presentations) {
    presentation.formulation = 'capsule';
  }
  wrongScope.combinationEvidenceReport = verifyCombinationManifestEvidence(
    wrongScope.combinationManifest,
    evidenceBundles(wrongScope.combinationManifest),
  );
  assert.equal(wrongScope.combinationEvidenceReport.verified, false);

  const widened = combinationInputs();
  widened.promotionManifest.promotions[0].scope.sides[1]
    .presentation_product_ids.push('sha256:unreviewed-combination-product');
  assert.throws(
    () => compileInteractionRuntimePack(widened),
    /missing reviewed combination presentation/u,
  );
});

test('a later reviewed combination presentation cannot widen an existing approval', () => {
  const source = combinationInputs();
  const combination = source.combinationManifest.combinations[0];
  const additional = structuredClone(combination.presentations[0]);
  const additionalRow = {
    brand_name: 'Co-trimoxazole 800mg/160mg Alternate Tablets IP',
    manufacturer: 'PMBJP (Jan Aushadhi)',
    pack_label: "20's",
    form_raw: null,
    ingredients: [
      {
        molecule: 'co-trimoxazole sulphamethoxazole',
        strength_raw: '800mg',
        strength_value: 800,
        strength_unit: 'mg',
      },
      {
        molecule: 'trimethoprim',
        strength_raw: '160mg',
        strength_value: 160,
        strength_unit: 'mg',
      },
    ],
  };
  additional.source_identity.code = '9999';
  additional.product_id = productIdForRow(additionalRow);
  additional.product_assertion_sha256 = productAssertionHashForRow(additionalRow);
  additional.product_assertion = productAssertionForRow(additionalRow);
  combination.presentations.push(additional);
  combination.review.evidence.find(
    (evidence) => evidence.evidence_ref === 'pmbjp-product-list',
  ).identifier = 'pmbjp-product-list:89,90,9999';
  attachAuthenticReport(source);

  const compiled = compileInteractionRuntimePack(source);
  assert.deepEqual(compiled.rules[0].product_pairs, expectedProductPairs(source));
  assert.equal(compiled.rules[0].product_pairs.length, 6);
  assert.ok(compiled.rules[0].product_pairs.every(
    (pair) => !pair.includes(additional.product_id),
  ));
});

test('combination promotion rejects a Cartesian product count mismatch', () => {
  const source = combinationInputs();
  source.promotionManifest.promotions[0].scope.expected_product_pair_count = 7;
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /expected 7 product pairs but derived 6/u,
  );
});
