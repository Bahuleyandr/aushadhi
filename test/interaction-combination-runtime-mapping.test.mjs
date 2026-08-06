import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  compileCombinationIdentityManifest,
} from '../src/lib/interaction-combination-identity.mjs';
import {
  verifyCombinationManifestEvidence,
} from '../src/lib/combination-rxnorm-evidence.mjs';
import {
  verifyPmbjpCombinationEvidenceFiles,
} from '../src/lib/pmbjp-combination-evidence.mjs';
import {
  checkResolvedProducts,
} from '../src/lib/interaction-checker.mjs';
import {
  mapResolvedProducts,
  summarizeInteractionMappings,
} from '../src/lib/interaction-mapping.mjs';
import {
  productAssertionForRow,
  productAssertionHashForRow,
  productIdForRow,
} from '../src/lib/product-resolver.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PMBJP_SOURCE = {
  restrictedRoot: path.join(ROOT, 'data/interaction/internal-evaluation'),
  pdfPath: path.join(
    ROOT,
    'data/interaction/internal-evaluation/pmbjp-product-list/pmbjp-product-list.pdf',
  ),
  tableTextPath: path.join(
    ROOT,
    'data/interaction/internal-evaluation/pmbjp-product-list/pmbjp-product-list.table.txt',
  ),
};
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
);

const EMPTY_INGREDIENT_MANIFEST = {
  schema_version: 1,
  identity_namespace: 'aushadhi:ingredient-identity:v1',
  notices: ['Empty test fixture.'],
  mappings: [],
};
const EMPTY_PRESENTATION_MANIFEST = {
  schema_version: 1,
  product_id_namespace: 'aushadhi:product:v1',
  product_assertion_namespace: 'aushadhi:product-assertion:v1',
  mappings: [],
};

const pmbjpRow = (brand, ingredients, code) => ({
  brand_name: brand,
  manufacturer: 'PMBJP (Jan Aushadhi)',
  pack_label: "10's",
  form_raw: null,
  ingredients: ingredients.map(([molecule, strengthRaw, value]) => ({
    molecule,
    strength_raw: strengthRaw,
    strength_value: value,
    strength_unit: 'mg',
  })),
  sources: [{ source: 'janaushadhi', source_id: code, seen_at: '2026-07-07' }],
});

const PMBJP_89 = pmbjpRow(
  'Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg) Tablets IP',
  [
    ['co-trimoxazole sulphamethoxazole', '800mg', 800],
    ['trimethoprim', '160mg', 160],
  ],
  '89',
);
const PMBJP_88 = {
  ...pmbjpRow(
    'Co-trimoxazole (Sulphamethoxazole 200mg and Trimethoprim 40mg per 5ml) Oral Suspension IP',
    [
      ['co-trimoxazole sulphamethoxazole', '200mg', 200],
      ['trimethoprim', '40mg', 40],
    ],
    '88',
  ),
  pack_label: '50 ml',
};
const UNREVIEWED = pmbjpRow(
  'Co-trimoxazole (Sulphamethoxazole 400mg and Trimethoprim 80mg) Tablets IP',
  [
    ['co-trimoxazole sulphamethoxazole', '400mg', 400],
    ['trimethoprim', '80mg', 80],
  ],
  '9999',
);

const resolved = (row) => ({
  input: row.brand_name,
  status: 'resolved',
  product: {
    ...structuredClone(row),
    product_id: productIdForRow(row),
  },
});

function loadCommittedManifestAndBundles() {
  const manifest = readJson('data-static/combination-identity-overrides.json');
  const bundles = Object.fromEntries(manifest.combinations.map((combination) => {
    const filename = `${combination.combination_id.replaceAll(/[^a-zA-Z0-9._-]/gu, '_')}.json`;
    return [
      combination.combination_id,
      readJson(path.join('data-static', 'combination-rxnorm-evidence', filename)),
    ];
  }));
  return { manifest, bundles };
}

function verifyWithPmbjpSource(manifest, bundles) {
  const pmbjpSourceReport = verifyPmbjpCombinationEvidenceFiles(manifest, PMBJP_SOURCE);
  return {
    pmbjpSourceReport,
    report: verifyCombinationManifestEvidence(
      manifest,
      bundles,
      { pmbjpSourceReport },
    ),
  };
}

function compileCommittedManifest() {
  const { manifest, bundles } = loadCommittedManifestAndBundles();
  const { report: verificationReport } = verifyWithPmbjpSource(manifest, bundles);
  return {
    manifest,
    compiled: compileCombinationIdentityManifest(manifest, {
      kind: 'verified_manifest',
      verificationReport,
    }),
  };
}

const map = (row, combinationManifest, profile = 'internal-evaluation') => (
  mapResolvedProducts({
    records: [resolved(row)],
    ingredientManifest: EMPTY_INGREDIENT_MANIFEST,
    presentationManifest: EMPTY_PRESENTATION_MANIFEST,
    combinationManifest,
    profile,
  })[0].product
);

const runtimeIngredient = (ingredientId) => ({
  ingredient_id: ingredientId,
  mapping_status: 'exact',
  runtime_drug: ingredientId,
  runtime_subject: {
    drug: ingredientId,
    route: 'oral',
    formulation: 'tablet',
  },
});

function reviewedRule(ruleId, pair, productIds, relationship = null) {
  return {
    rule_id: ruleId,
    pair: [...pair].sort(),
    product_pairs: [[...productIds].sort()],
    applicability: {
      routes: [],
      dose_conditions: [],
      population_conditions: [],
    },
    severity: 'major',
    dispense_action: 'confirm_and_monitor',
    mechanism: 'Clinician-reviewed test mechanism.',
    management: 'Clinician-reviewed test management.',
    evidence: [{
      source: 'test-evidence',
      source_url: 'https://example.test/evidence',
      document_id: 'test-document',
      document_version: '1',
      retrieved_at: '2026-07-28',
      jurisdiction: 'US',
      excerpt: 'Source-grounded test evidence.',
      licence: 'CC0-1.0',
      review_status: 'clinician_reviewed',
    }],
    review: {
      status: 'clinician_reviewed',
      reviewer_id: 'clinician:test-reviewer',
      reviewed_at: '2026-07-28',
      source_versions: ['test-evidence:test-document:1'],
    },
    ...(relationship === null ? {} : {
      interaction_family_id: relationship.interaction_family_id,
      subject_specificity: relationship.subject_specificity,
      subject_roles: relationship.subject_roles,
      supersedes_rule_ids: relationship.supersedes_rule_ids,
    }),
  };
}

test('a verified reviewed combination maps its exact product and both product-scoped components', () => {
  const { manifest, compiled } = compileCommittedManifest();
  assert.equal(manifest.combinations.length, 1);

  const product = map(PMBJP_89, compiled);
  assert.equal(product.combination.status, 'reviewed_override');
  assert.deepEqual(product.combination.runtime_subject, {
    drug: 'co-trimoxazole',
    route: 'oral',
    formulation: 'tablet',
  });
  assert.equal(product.presentation.status, 'reviewed_override');
  assert.equal(product.presentation.mapping_scope, 'reviewed_combination_product');
  assert.equal(product.presentation.route, 'oral');
  assert.equal(product.presentation.formulation, 'tablet');

  const expectedIds = new Set(
    manifest.combinations[0].components.map((component) => component.runtime_ingredient_id),
  );
  assert.deepEqual(
    new Set(product.ingredients.map((ingredient) => ingredient.ingredient_id)),
    expectedIds,
  );
  for (const ingredient of product.ingredients) {
    assert.equal(ingredient.mapping_status, 'reviewed_override');
    assert.equal(ingredient.mapping_scope, 'reviewed_combination_product');
    assert.deepEqual(ingredient.runtime_subject, {
      drug: ingredient.runtime_drug,
      route: 'oral',
      formulation: 'tablet',
    });
  }
  assert.equal(summarizeInteractionMappings([{
    status: 'resolved',
    product,
  }]).runtime_subjects, 3);
});

test('mapping rejects a stateful product accessor before it can transplant catalogue content', () => {
  const { compiled } = compileCommittedManifest();
  const authenticProduct = resolved(PMBJP_89).product;
  const suspensionProduct = {
    ...resolved(PMBJP_88).product,
    product_id: authenticProduct.product_id,
  };
  let productReads = 0;
  const statefulRecord = {
    input: PMBJP_89.brand_name,
    status: 'resolved',
  };
  Object.defineProperty(statefulRecord, 'product', {
    enumerable: true,
    get() {
      productReads += 1;
      return productReads === 9 ? suspensionProduct : authenticProduct;
    },
  });

  assert.throws(
    () => mapResolvedProducts({
      records: [statefulRecord],
      ingredientManifest: EMPTY_INGREDIENT_MANIFEST,
      presentationManifest: EMPTY_PRESENTATION_MANIFEST,
      combinationManifest: compiled,
      profile: 'internal-evaluation',
    }),
    /product must be an enumerable data property|accessors/u,
  );
  assert.equal(productReads, 0);
});

test('an authentic mapped combination supplements its component subjects in the checker', () => {
  const { manifest, compiled } = compileCommittedManifest();
  const combinationProduct = map(PMBJP_89, compiled);
  const trimethoprimId = manifest.combinations[0].components.find(
    (component) => component.name === 'trimethoprim',
  ).runtime_ingredient_id;
  const otherProductId = 'product:warfarin-methotrexate-test';
  const otherProduct = {
    product_id: otherProductId,
    presentation: {
      status: 'reviewed_override',
      route: 'oral',
      formulation: 'tablet',
    },
    ingredients: [
      runtimeIngredient('ingredient:warfarin'),
      runtimeIngredient('ingredient:methotrexate'),
    ],
  };
  const productIds = [otherProductId, combinationProduct.product_id];
  const combinationId = combinationProduct.combination.combination_id;
  const sulfamethoxazoleId = manifest.combinations[0].components.find(
    (component) => component.name === 'sulfamethoxazole',
  ).runtime_ingredient_id;
  const family = 'warfarin-anticoagulation-potentiation';
  const rulePack = {
    schema_version: '1.1.0',
    pack_id: 'aushadhi-internal-combination-test',
    pack_version: '0.0.0-test',
    profile: 'internal-evaluation',
    licence: 'CC-BY-4.0',
    source_ids: ['test-evidence'],
    licence_notices: {
      'test-evidence': {
        attribution: 'Aushadhi test contributors',
        licence_notice: 'Creative Commons Attribution 4.0 International',
        licence_id: 'CC-BY-4.0',
        licence_url: 'https://creativecommons.org/licenses/by/4.0/legalcode',
        source_url: 'https://example.test/aushadhi',
        changes: 'Synthetic combination checker fixture.',
      },
    },
    declared_coverage: 'unknown',
    rules: [
      reviewedRule(
        'ddi:test:warfarin:co-trimoxazole',
        [combinationId, 'ingredient:warfarin'],
        productIds,
        {
          interaction_family_id: family,
          subject_specificity: 'exact_fixed_dose_combination',
          subject_roles: {
            object: 'ingredient:warfarin',
            perpetrator: combinationId,
          },
          supersedes_rule_ids: ['ddi:test:warfarin:sulfamethoxazole'],
        },
      ),
      reviewedRule(
        'ddi:test:methotrexate:trimethoprim',
        ['ingredient:methotrexate', trimethoprimId],
        productIds,
      ),
      reviewedRule(
        'ddi:test:warfarin:sulfamethoxazole',
        ['ingredient:warfarin', sulfamethoxazoleId],
        productIds,
        {
          interaction_family_id: family,
          subject_specificity: 'exact_member',
          subject_roles: {
            object: 'ingredient:warfarin',
            perpetrator: sulfamethoxazoleId,
          },
          supersedes_rule_ids: [],
        },
      ),
    ],
  };

  const result = checkResolvedProducts({
    resolvedInputs: [
      { input: 'Warfarin plus methotrexate fixture', status: 'resolved', product: otherProduct },
      { input: PMBJP_89.brand_name, status: 'resolved', product: combinationProduct },
    ],
    rulePack,
  });

  assert.deepEqual(
    result.reviewed_findings.map((finding) => finding.rule_id),
    ['ddi:test:methotrexate:trimethoprim', 'ddi:test:warfarin:co-trimoxazole'],
  );
  assert.deepEqual(
    result.superseded_findings.map((finding) => ({
      rule_id: finding.rule_id,
      superseded_by: finding.superseded_by,
    })),
    [{
      rule_id: 'ddi:test:warfarin:sulfamethoxazole',
      superseded_by: 'ddi:test:warfarin:co-trimoxazole',
    }],
  );
  assert.deepEqual(result.checks_performed.reviewed_rule_matching, {
    status: 'performed',
    matched_reviewed_finding_count: 3,
    reviewed_finding_count: 2,
    surviving_reviewed_finding_count: 2,
    superseded_finding_count: 1,
    review_candidate_count: 0,
    technical_hold_match_count: 0,
  });

  const reversedOrder = checkResolvedProducts({
    resolvedInputs: [
      { input: PMBJP_89.brand_name, status: 'resolved', product: combinationProduct },
      { input: 'Warfarin plus methotrexate fixture', status: 'resolved', product: otherProduct },
    ],
    rulePack: {
      ...rulePack,
      rules: [...rulePack.rules].reverse(),
    },
  });
  assert.deepEqual(reversedOrder.reviewed_findings, result.reviewed_findings);
  assert.deepEqual(reversedOrder.superseded_findings, result.superseded_findings);

  const withoutDeclarationPack = {
    ...rulePack,
    rules: rulePack.rules.map((entry) => {
      const copy = structuredClone(entry);
      delete copy.interaction_family_id;
      delete copy.subject_specificity;
      delete copy.subject_roles;
      delete copy.supersedes_rule_ids;
      return copy;
    }),
  };
  const withoutDeclaration = checkResolvedProducts({
    resolvedInputs: [
      { input: 'Warfarin plus methotrexate fixture', status: 'resolved', product: otherProduct },
      { input: PMBJP_89.brand_name, status: 'resolved', product: combinationProduct },
    ],
    rulePack: withoutDeclarationPack,
  });
  assert.deepEqual(
    withoutDeclaration.reviewed_findings.map((finding) => finding.rule_id),
    [
      'ddi:test:methotrexate:trimethoprim',
      'ddi:test:warfarin:co-trimoxazole',
      'ddi:test:warfarin:sulfamethoxazole',
    ],
  );
  assert.deepEqual(withoutDeclaration.superseded_findings, []);

  const standaloneProductId = 'product:standalone-sulfamethoxazole-test';
  const targetWithAdditionalProduct = {
    ...rulePack,
    rules: rulePack.rules.map((entry) => (
      entry.rule_id !== 'ddi:test:warfarin:sulfamethoxazole'
        ? entry
        : {
            ...entry,
            product_pairs: [
              ...entry.product_pairs,
              [otherProductId, standaloneProductId].sort(),
            ].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
          }
    )),
  };
  const additionalMatch = checkResolvedProducts({
    resolvedInputs: [
      { input: 'Warfarin plus methotrexate fixture', status: 'resolved', product: otherProduct },
      { input: PMBJP_89.brand_name, status: 'resolved', product: combinationProduct },
      {
        input: 'Standalone sulfamethoxazole fixture',
        status: 'resolved',
        product: {
          product_id: standaloneProductId,
          presentation: {
            status: 'reviewed_override',
            route: 'oral',
            formulation: 'tablet',
          },
          ingredients: [runtimeIngredient(sulfamethoxazoleId)],
        },
      },
    ],
    rulePack: targetWithAdditionalProduct,
  });
  assert.ok(additionalMatch.reviewed_findings.some(
    (finding) => finding.rule_id === 'ddi:test:warfarin:sulfamethoxazole',
  ));
  assert.deepEqual(additionalMatch.superseded_findings, []);

  const combinationOnlyPack = {
    ...rulePack,
    rules: [{
      ...rulePack.rules[0],
      supersedes_rule_ids: [],
    }],
  };
  const productionReplay = checkResolvedProducts({
    resolvedInputs: [
      { input: 'Warfarin fixture', status: 'resolved', product: otherProduct },
      { input: PMBJP_89.brand_name, status: 'resolved', product: combinationProduct },
    ],
    rulePack: { ...combinationOnlyPack, profile: 'production-open' },
  });
  assert.deepEqual(productionReplay.reviewed_findings, []);
  assert.ok(!productionReplay.checked_pairs.some(
    (entry) => entry.pair.includes(combinationProduct.combination.combination_id),
  ));

  const withExtraActive = {
    ...combinationProduct,
    ingredients: [
      ...combinationProduct.ingredients,
      {
        observed_name: 'unexpected active ingredient',
        assertion_ingredient_id: 'sha256:'.concat('f'.repeat(64)),
        mapping_status: 'unmapped',
        runtime_subject: null,
      },
    ],
  };
  const extraActiveResult = checkResolvedProducts({
    resolvedInputs: [
      { input: 'Warfarin fixture', status: 'resolved', product: otherProduct },
      { input: 'Tampered combination fixture', status: 'resolved', product: withExtraActive },
    ],
    rulePack: combinationOnlyPack,
  });
  assert.deepEqual(extraActiveResult.reviewed_findings, []);
  assert.ok(!extraActiveResult.checked_pairs.some(
    (entry) => entry.pair.includes(combinationProduct.combination.combination_id),
  ));

  const transplantedProductId = 'product:forged-transplant';
  const transplanted = {
    ...combinationProduct,
    product_id: transplantedProductId,
  };
  const transplantPack = {
    ...combinationOnlyPack,
    rules: [reviewedRule(
      'ddi:test:transplanted-combination',
      [combinationProduct.combination.combination_id, 'ingredient:warfarin'],
      [otherProductId, transplantedProductId],
    )],
  };
  const transplantResult = checkResolvedProducts({
    resolvedInputs: [
      { input: 'Warfarin fixture', status: 'resolved', product: otherProduct },
      { input: 'Transplanted combination fixture', status: 'resolved', product: transplanted },
    ],
    rulePack: transplantPack,
  });
  assert.deepEqual(transplantResult.reviewed_findings, []);

  let productReads = 0;
  const statefulRecord = {
    input: 'Stateful combination fixture',
    status: 'resolved',
  };
  Object.defineProperty(statefulRecord, 'product', {
    enumerable: true,
    get() {
      productReads += 1;
      return productReads === 1
        ? combinationProduct
        : { ...combinationProduct, product_id: transplantedProductId };
    },
  });
  assert.throws(
    () => checkResolvedProducts({
      resolvedInputs: [
        { input: 'Warfarin fixture', status: 'resolved', product: otherProduct },
        statefulRecord,
      ],
      rulePack: transplantPack,
    }),
    /product must be an enumerable data property|accessors/u,
  );
  assert.equal(productReads, 0);
});

test('the evidence gate binds each reviewed product assertion to its exact SCD and scope', () => {
  for (const mutate of [
    (manifest) => {
      const [first, second] = manifest.combinations[0].presentations;
      [first.rxnorm_scd, second.rxnorm_scd] = [second.rxnorm_scd, first.rxnorm_scd];
    },
    (manifest) => {
      manifest.combinations[0].presentation_scopes[0].formulation = 'capsule';
      for (const presentation of manifest.combinations[0].presentations) {
        presentation.formulation = 'capsule';
      }
    },
    (manifest) => {
      manifest.combinations[0].presentation_scopes[0].route = 'intravenous';
      for (const presentation of manifest.combinations[0].presentations) {
        presentation.route = 'intravenous';
      }
    },
  ]) {
    const { manifest, bundles } = loadCommittedManifestAndBundles();
    mutate(manifest);
    const { report } = verifyWithPmbjpSource(manifest, bundles);
    assert.equal(report.verified, false);
  }
});

test('the evidence gate binds the runtime alias, structural id, and reviewed PMBJP source', () => {
  const cases = [
    ({ manifest }) => {
      manifest.combinations[0].runtime_drug = 'warfarin';
    },
    ({ manifest, bundles }) => {
      const oldId = manifest.combinations[0].combination_id;
      const newId = 'combination:warfarin:rxnorm-10831';
      manifest.combinations[0].runtime_drug = 'warfarin';
      manifest.combinations[0].combination_id = newId;
      bundles[newId] = { ...bundles[oldId], combination_id: newId };
      delete bundles[oldId];
    },
    ({ manifest }) => {
      manifest.combinations[0].presentations[0].source_identity = {
        namespace: 'presentation:onemg-live',
        code: '89',
      };
    },
    ({ manifest }) => {
      const presentation = manifest.combinations[0].presentations[0];
      presentation.source_identity.code = '88';
      presentation.product_id = productIdForRow(PMBJP_88);
      presentation.product_assertion_sha256 = productAssertionHashForRow(PMBJP_88);
      presentation.product_assertion = productAssertionForRow(PMBJP_88);
    },
  ];

  for (const mutate of cases) {
    const inputs = loadCommittedManifestAndBundles();
    mutate(inputs);
    assert.equal(
      verifyWithPmbjpSource(inputs.manifest, inputs.bundles).report.verified,
      false,
    );
  }
});

test('component names and brand fragments cannot be promoted as a combination runtime alias', () => {
  for (const alias of [
    'trimethoprim',
    'sulphamethoxazole',
    'co',
    'tablets',
    'ip',
    'co-trimoxazole sulphamethoxazole',
  ]) {
    const { manifest, bundles } = loadCommittedManifestAndBundles();
    const combination = manifest.combinations[0];
    const oldId = combination.combination_id;
    const newId = `combination:${alias.replaceAll(' ', '-')}:rxnorm-10831`;
    combination.runtime_drug = alias;
    combination.combination_id = newId;
    bundles[newId] = { ...bundles[oldId], combination_id: newId };
    delete bundles[oldId];
    assert.equal(
      verifyWithPmbjpSource(manifest, bundles).report.verified,
      false,
      `${alias} must not identify the whole fixed-dose combination`,
    );
  }
});

test('explicit product form and strength basis must agree with the reviewed tablet SCD', () => {
  const mutations = [
    (row) => {
      row.form_raw = 'oral suspension';
      row.pack_label = '100 ml';
    },
    (row) => {
      row.ingredients[0].strength_raw = '800mg per 5ml';
      row.ingredients[1].strength_raw = '160mg per 5ml';
    },
  ];

  for (const mutate of mutations) {
    const { manifest, bundles } = loadCommittedManifestAndBundles();
    const row = structuredClone(PMBJP_89);
    mutate(row);
    const presentation = manifest.combinations[0].presentations[0];
    presentation.product_id = productIdForRow(row);
    presentation.product_assertion_sha256 = productAssertionHashForRow(row);
    presentation.product_assertion = productAssertionForRow(row);
    assert.equal(
      verifyWithPmbjpSource(manifest, bundles).report.verified,
      false,
    );
  }
});

test('editing PMBJP identifier text cannot relabel a reviewed tablet as drug code 88', () => {
  const { manifest, bundles } = loadCommittedManifestAndBundles();
  const combination = manifest.combinations[0];
  combination.presentations[0].source_identity.code = '88';
  combination.review.evidence.find(
    (entry) => entry.evidence_ref === 'pmbjp-product-list',
  ).identifier = 'pmbjp-product-list:88,90';
  const sourceReport = verifyPmbjpCombinationEvidenceFiles(manifest, PMBJP_SOURCE);
  assert.equal(sourceReport.verified, false);
  const combined = verifyCombinationManifestEvidence(
    manifest,
    bundles,
    { pmbjpSourceReport: sourceReport },
  );
  assert.equal(combined.verified, false);
  assert.ok(sourceReport.findings.some(
    (finding) => finding.code === 'pmbjp_source_product_mismatch'
      || finding.code === 'pmbjp_review_identifier_mismatch',
  ));
});

test('custom serialization cannot hide manifest mutation from the evidence capability', () => {
  const { manifest, bundles } = loadCommittedManifestAndBundles();
  const stable = structuredClone(manifest);
  Object.defineProperty(manifest, 'toJSON', {
    enumerable: false,
    value() {
      return stable;
    },
  });

  assert.throws(() => {
    const verificationReport = verifyCombinationManifestEvidence(manifest, bundles);
    const scd = manifest.combinations[0].presentations[0].rxnorm_scd;
    Object.assign(scd, {
      name: 'forged unverified SCD',
      dose_form: 'forged dose form',
      properties_response_sha256: '1'.repeat(64),
      historystatus_response_sha256: '2'.repeat(64),
      min_relation_response_sha256: '3'.repeat(64),
    });
    scd.ingredients_and_strengths[0].numerator_value = '999';
    scd.ingredients_and_strengths[0].denominator_value = '99';
    compileCombinationIdentityManifest(manifest, { verificationReport });
  }, /plain data|changed since evidence verification|custom serialization/u);
});

test('an unreviewed product and its components remain unmapped', () => {
  const { compiled } = compileCommittedManifest();
  const product = map(UNREVIEWED, compiled);

  assert.equal(product.combination.status, 'no_combination');
  assert.equal(product.combination.runtime_subject, null);
  assert.equal(product.presentation.status, 'unmapped');
  assert.ok(product.ingredients.every((ingredient) => (
    ingredient.mapping_status === 'unmapped' && ingredient.runtime_subject === null
  )));
});

test('mapping rejects raw and audit-only combination manifests', () => {
  const { manifest } = loadCommittedManifestAndBundles();
  assert.throws(
    () => map(PMBJP_89, manifest),
    /manifest must be compiled/u,
  );
  const audit = compileCombinationIdentityManifest(manifest, { kind: 'audit_fixture' });
  assert.throws(
    () => map(PMBJP_89, audit),
    /audit_fixture manifest may not be used here/u,
  );
  assert.throws(
    () => map(PMBJP_89, {
      compiled: true,
      compiled_kind: 'verified_manifest',
      combinations: manifest.combinations,
      reviewed_products: { get: () => null },
    }),
    /not an authentic compiled combination identity manifest/u,
  );
});

test('production-open never turns an internal reviewed combination into mapped runtime subjects', () => {
  const { compiled } = compileCommittedManifest();
  const product = map(PMBJP_89, compiled, 'production-open');

  assert.equal(product.combination.status, 'no_combination');
  assert.equal(product.combination.runtime_subject, null);
  assert.equal(product.presentation.status, 'unmapped');
  assert.ok(product.ingredients.every((ingredient) => (
    ingredient.mapping_status === 'unmapped' && ingredient.runtime_subject === null
  )));
});
