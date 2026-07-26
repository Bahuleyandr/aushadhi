import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ingredientIdForName,
} from '../src/lib/ingredient-identity.mjs';
import {
  createIngredientMappingCandidate,
  createProductPresentationCandidate,
  ingredientOccurrenceId,
  mapResolvedProducts,
  summarizeInteractionMappings,
  validateIngredientMappingManifest,
  validateProductPresentationManifest,
} from '../src/lib/interaction-mapping.mjs';
import {
  productAssertionHashForRow,
  productIdForRow,
} from '../src/lib/product-resolver.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');

function product(overrides = {}) {
  return {
    brand_name: 'Mapped Duo Tablet',
    manufacturer: 'Example Pharma Ltd',
    pack_label: 'strip of 10 tablets',
    form_raw: null,
    ingredients: [
      {
        molecule_raw: 'Ingredient One',
        molecule: 'ingredient one',
        strength_raw: '10 mg',
        strength_value: 10,
        strength_unit: 'mg',
      },
      {
        molecule_raw: 'Ingredient Two Hydrochloride',
        molecule: 'ingredient two',
        strength_raw: '5 mg',
        strength_value: 5,
        strength_unit: 'mg',
      },
    ],
    sources: [{ source: 'github-jr', source_id: 'example' }],
    ...overrides,
  };
}

function review(sourceId = 'rxnorm') {
  return {
    status: 'reviewed',
    reviewer_id: 'reviewer:test',
    reviewed_at: '2026-07-26',
    evidence: [{
      source_id: sourceId,
      identifier: `${sourceId}:fixture`,
      source_url: 'https://example.test/identity/fixture',
      retrieved_at: '2026-07-26',
      evidence_sha256: digest(`${sourceId}:fixture`),
    }],
  };
}

function ingredientMapping({
  mappingId,
  assertionName,
  clinicalName = assertionName,
  relationship = 'exact',
  runtimeDrug = clinicalName,
  rxcui = '12345',
}) {
  return {
    mapping_id: mappingId,
    assertion: {
      ingredient_id: ingredientIdForName(assertionName),
      canonical_name: assertionName,
    },
    identity: {
      clinical_ingredient_id: ingredientIdForName(clinicalName),
      canonical_name: clinicalName,
      runtime_drug: runtimeDrug,
      relationship,
      rxnorm: {
        rxcui,
        name: clinicalName,
        tty: 'IN',
        version: '06-Jul-2026',
        api_version: '3.1.353',
        response_sha256: digest(`${rxcui}:${clinicalName}`),
      },
      unii: null,
    },
    review: review(),
  };
}

function ingredientManifest(mappings = []) {
  return {
    schema_version: 1,
    identity_namespace: 'aushadhi:ingredient-identity:v1',
    notices: ['Fixture mappings require review.'],
    mappings,
  };
}

function presentationMapping(row, overrides = {}) {
  return {
    mapping_id: 'presentation:mapped-duo',
    product_id: productIdForRow(row),
    product_assertion_sha256: productAssertionHashForRow(row),
    allowed_profiles: ['production-open', 'internal-evaluation'],
    presentation: {
      route: 'oral',
      formulation: 'tablet',
    },
    review: review('product-label'),
    ...overrides,
  };
}

function presentationManifest(mappings = []) {
  return {
    schema_version: 1,
    product_id_namespace: 'aushadhi:product:v1',
    product_assertion_namespace: 'aushadhi:product-assertion:v1',
    mappings,
  };
}

function resolvedRecord(row) {
  return {
    input: { brand_name: row.brand_name },
    status: 'resolved',
    product: {
      ...structuredClone(row),
      product_id: productIdForRow(row),
    },
  };
}

test('empty committed-style mapping manifests validate without implying coverage', () => {
  assert.equal(validateIngredientMappingManifest(ingredientManifest()), true);
  assert.equal(validateProductPresentationManifest(presentationManifest()), true);
});

test('ingredient mappings require typed external identity and human review', () => {
  const exact = ingredientMapping({
    mappingId: 'ingredient:one',
    assertionName: 'ingredient one',
  });
  assert.equal(validateIngredientMappingManifest(ingredientManifest([exact])), true);

  assert.throws(
    () => validateIngredientMappingManifest(ingredientManifest([{
      ...exact,
      identity: { ...exact.identity, rxnorm: null },
    }])),
    /requires an RxNorm or UNII/i,
  );
  assert.throws(
    () => validateIngredientMappingManifest(ingredientManifest([{
      ...exact,
      identity: {
        ...exact.identity,
        rxnorm: { ...exact.identity.rxnorm, tty: 'SCD' },
      },
    }])),
    /tty must be IN or PIN/i,
  );
  assert.throws(
    () => validateIngredientMappingManifest(ingredientManifest([{
      ...exact,
      review: { ...exact.review, status: 'review_candidate' },
    }])),
    /status must be reviewed/i,
  );
  assert.throws(
    () => validateIngredientMappingManifest(ingredientManifest([{
      ...exact,
      display_severity: 'major',
    }])),
    /unknown property display_severity/i,
  );
  assert.throws(
    () => validateIngredientMappingManifest(ingredientManifest([{
      ...exact,
      identity: {
        ...exact.identity,
        rxnorm: {
          ...exact.identity.rxnorm,
          response_sha256: exact.identity.rxnorm.response_sha256.toUpperCase(),
        },
      },
    }])),
    /lowercase SHA-256/i,
  );
  assert.throws(
    () => validateIngredientMappingManifest(ingredientManifest([{
      ...exact,
      identity: {
        ...exact.identity,
        rxnorm: null,
        unii: {
          code: 'r9400w927i',
          preferred_name: 'Ingredient One',
          response_sha256: digest('unii:ingredient-one'),
        },
      },
    }])),
    /canonical uppercase.*UNII/i,
  );
});

test('exact mappings cannot silently collapse a salt or synonym', () => {
  assert.throws(
    () => validateIngredientMappingManifest(ingredientManifest([
      ingredientMapping({
        mappingId: 'ingredient:two',
        assertionName: 'ingredient two hydrochloride',
        clinicalName: 'ingredient two',
      }),
    ])),
    /exact relationship requires matching canonical names/i,
  );

  assert.equal(validateIngredientMappingManifest(ingredientManifest([
    ingredientMapping({
      mappingId: 'ingredient:two',
      assertionName: 'ingredient two hydrochloride',
      clinicalName: 'ingredient two',
      relationship: 'salt',
    }),
  ])), true);
});

test('product assertion hashes are order-independent but detect exact assertion drift', () => {
  const row = product();
  assert.equal(
    productAssertionHashForRow(row),
    productAssertionHashForRow({
      ...row,
      ingredients: [...row.ingredients].reverse(),
    }),
  );
  assert.notEqual(
    productAssertionHashForRow(row),
    productAssertionHashForRow({ ...row, brand_name: 'MAPPED DUO TABLET' }),
  );
  assert.notEqual(
    productAssertionHashForRow(row),
    productAssertionHashForRow({
      ...row,
      ingredients: [
        { ...row.ingredients[0], strength_raw: '20 mg', strength_value: 20 },
        row.ingredients[1],
      ],
    }),
  );
});

test('reviewed ingredient and presentation mappings create occurrence-bound runtime subjects', () => {
  const row = product();
  const mappings = [
    ingredientMapping({
      mappingId: 'ingredient:one',
      assertionName: 'ingredient one',
      rxcui: '111',
    }),
    ingredientMapping({
      mappingId: 'ingredient:two',
      assertionName: 'ingredient two hydrochloride',
      clinicalName: 'ingredient two',
      relationship: 'salt',
      rxcui: '222',
    }),
  ];
  const [mapped] = mapResolvedProducts({
    records: [resolvedRecord(row)],
    ingredientManifest: ingredientManifest(mappings),
    presentationManifest: presentationManifest([presentationMapping(row)]),
  });

  assert.equal(mapped.product.presentation.status, 'reviewed_override');
  assert.deepEqual(mapped.product.ingredients.map((entry) => entry.mapping_status), [
    'reviewed_override',
    'reviewed_override',
  ]);
  assert.deepEqual(mapped.product.ingredients.map((entry) => entry.runtime_subject), [
    { drug: 'ingredient one', route: 'oral', formulation: 'tablet' },
    { drug: 'ingredient two', route: 'oral', formulation: 'tablet' },
  ]);
  assert.deepEqual(mapped.product.ingredients.map((entry) => entry.identity_relationship), [
    'exact',
    'salt',
  ]);
  assert.ok(mapped.product.ingredients.every((entry) => (
    entry.ingredient_occurrence_id.startsWith('sha256:')
  )));
  assert.notEqual(
    mapped.product.ingredients[0].ingredient_occurrence_id,
    mapped.product.ingredients[1].ingredient_occurrence_id,
  );
  assert.equal(
    mapped.product.ingredients[0].ingredient_occurrence_id,
    ingredientOccurrenceId(mapped.product.product_id, row.ingredients[0]),
  );
  assert.deepEqual(summarizeInteractionMappings([mapped]), {
    resolved_products: 1,
    mapped_ingredients: 2,
    unmapped_ingredients: 0,
    mapped_presentations: 1,
    unmapped_presentations: 0,
    runtime_subjects: 2,
  });
});

test('missing mappings remain explicit and cannot create runtime subjects', () => {
  const row = product();
  const [mapped] = mapResolvedProducts({
    records: [resolvedRecord(row)],
    ingredientManifest: ingredientManifest(),
    presentationManifest: presentationManifest(),
  });

  assert.equal(mapped.product.presentation.status, 'unmapped');
  assert.equal(
    mapped.product.presentation.error,
    'reviewed_product_presentation_mapping_required',
  );
  assert.ok(mapped.product.ingredients.every((entry) => (
    entry.mapping_status === 'unmapped'
    && entry.error === 'reviewed_identity_mapping_required'
    && entry.runtime_subject === null
  )));
  assert.deepEqual(summarizeInteractionMappings([mapped]), {
    resolved_products: 1,
    mapped_ingredients: 0,
    unmapped_ingredients: 2,
    mapped_presentations: 0,
    unmapped_presentations: 1,
    runtime_subjects: 0,
  });
});

test('identity mapping does not manufacture presentation when the product review is absent', () => {
  const row = product();
  const [mapped] = mapResolvedProducts({
    records: [resolvedRecord(row)],
    ingredientManifest: ingredientManifest([
      ingredientMapping({
        mappingId: 'ingredient:one',
        assertionName: 'ingredient one',
      }),
    ]),
    presentationManifest: presentationManifest(),
  });

  assert.equal(mapped.product.ingredients[0].mapping_status, 'reviewed_override');
  assert.equal(mapped.product.ingredients[0].runtime_subject, null);
  assert.equal(
    mapped.product.ingredients[0].presentation_error,
    'reviewed_product_presentation_mapping_required',
  );
});

test('presentation mappings fail closed when the exact product assertion drifts', () => {
  const reviewed = product();
  const changed = product({ brand_name: 'MAPPED DUO TABLET' });
  assert.equal(productIdForRow(reviewed), productIdForRow(changed));

  const [mapped] = mapResolvedProducts({
    records: [resolvedRecord(changed)],
    ingredientManifest: ingredientManifest([
      ingredientMapping({
        mappingId: 'ingredient:one',
        assertionName: 'ingredient one',
      }),
    ]),
    presentationManifest: presentationManifest([presentationMapping(reviewed)]),
  });
  assert.equal(mapped.product.presentation.status, 'stale');
  assert.equal(
    mapped.product.presentation.error,
    'product_assertion_changed_since_review',
  );
  assert.equal(mapped.product.ingredients[0].runtime_subject, null);
});

test('presentation mappings require concrete canonical route and formulation values', () => {
  const row = product();
  const valid = presentationMapping(row);
  assert.equal(validateProductPresentationManifest(presentationManifest([valid])), true);
  assert.throws(
    () => validateProductPresentationManifest(presentationManifest([{
      ...valid,
      presentation: { route: 'systemic', formulation: 'tablet' },
    }])),
    /not a concrete administration route/i,
  );
  assert.throws(
    () => validateProductPresentationManifest(presentationManifest([{
      ...valid,
      presentation: { route: 'oral', formulation: 'oral_tablet' },
    }])),
    /canonical route and formulation/i,
  );
  assert.throws(
    () => validateProductPresentationManifest(presentationManifest([{
      ...valid,
      presentation: { route: 'IV', formulation: 'injection' },
    }])),
    /canonical route and formulation/i,
  );
  assert.throws(
    () => validateProductPresentationManifest(presentationManifest([{
      ...valid,
      allowed_profiles: ['internal-evaluation', 'internal-evaluation'],
    }])),
    /duplicate profile/i,
  );
  assert.throws(
    () => validateProductPresentationManifest(presentationManifest([{
      ...valid,
      allowed_profiles: ['unknown-profile'],
    }])),
    /unsupported profile/i,
  );
});

test('profile-scoped presentation mappings stay unavailable outside their review profile', () => {
  const row = product();
  const internalOnly = presentationMapping(row, {
    allowed_profiles: ['internal-evaluation'],
  });
  const ingredients = ingredientManifest([
    ingredientMapping({
      mappingId: 'ingredient:one',
      assertionName: 'ingredient one',
    }),
  ]);
  const presentations = presentationManifest([internalOnly]);

  const [internal] = mapResolvedProducts({
    records: [resolvedRecord(row)],
    ingredientManifest: ingredients,
    presentationManifest: presentations,
    profile: 'internal-evaluation',
  });
  assert.equal(internal.product.presentation.status, 'reviewed_override');
  assert.deepEqual(internal.product.ingredients[0].runtime_subject, {
    drug: 'ingredient one',
    route: 'oral',
    formulation: 'tablet',
  });

  const [production] = mapResolvedProducts({
    records: [resolvedRecord(row)],
    ingredientManifest: ingredients,
    presentationManifest: presentations,
    profile: 'production-open',
  });
  assert.equal(production.product.presentation.status, 'unmapped');
  assert.equal(
    production.product.presentation.error,
    'reviewed_product_presentation_mapping_required',
  );
  assert.equal(production.product.ingredients[0].runtime_subject, null);
});

test('candidate helpers preserve assertions but do not propose clinical mappings', () => {
  const row = product();
  const ingredientCandidate = createIngredientMappingCandidate(row.ingredients[0]);
  assert.equal(ingredientCandidate.review_status, 'review_candidate');
  assert.equal(ingredientCandidate.assertion.canonical_name, 'ingredient one');
  assert.equal(ingredientCandidate.proposed_identity, null);

  const presentationCandidate = createProductPresentationCandidate(row);
  assert.equal(presentationCandidate.review_status, 'review_candidate');
  assert.equal(presentationCandidate.product_id, productIdForRow(row));
  assert.equal(
    presentationCandidate.product_assertion_sha256,
    productAssertionHashForRow(row),
  );
  assert.deepEqual(presentationCandidate.proposed_presentation, {
    route: null,
    formulation: null,
  });
});

test('indistinguishable duplicate ingredient occurrences are rejected', () => {
  const duplicate = product({
    ingredients: [
      product().ingredients[0],
      structuredClone(product().ingredients[0]),
    ],
  });
  assert.throws(
    () => mapResolvedProducts({
      records: [resolvedRecord(duplicate)],
      ingredientManifest: ingredientManifest(),
      presentationManifest: presentationManifest(),
    }),
    /indistinguishable duplicate ingredient occurrences/i,
  );
});
