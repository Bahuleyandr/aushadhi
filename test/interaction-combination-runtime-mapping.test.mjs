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
  mapResolvedProducts,
  summarizeInteractionMappings,
} from '../src/lib/interaction-mapping.mjs';
import {
  productIdForRow,
} from '../src/lib/product-resolver.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

function compileCommittedManifest() {
  const { manifest, bundles } = loadCommittedManifestAndBundles();
  const verificationReport = verifyCombinationManifestEvidence(manifest, bundles);
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
