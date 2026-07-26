import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  INGREDIENT_IDENTITY_NAMESPACE,
  canonicalIngredientKey,
  createIngredientIdentity,
  ingredientIdForName,
  normalizeObservedIngredientName,
} from '../src/lib/ingredient-identity.mjs';
import {
  aggregateIngredientProducts,
  buildIngredientIndex,
  readStrictJsonl,
} from '../src/lib/ingredient-index.mjs';

const tempRoots = new Set();

async function makeTempDir() {
  const root = await fs.mkdtemp(path.join('test', '.tmp-ingredient-index-'));
  tempRoots.add(root);
  return root;
}

test.after(async () => {
  await Promise.all([...tempRoots].map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('clinical ingredient identity uses conservative Unicode normalization and stable namespaced IDs', () => {
  assert.match(INGREDIENT_IDENTITY_NAMESPACE, /v1/);
  assert.equal(normalizeObservedIngredientName('  Metformin\u00a0 Hydrochloride  '), 'Metformin Hydrochloride');
  assert.equal(canonicalIngredientKey('ＭＥＴＦＯＲＭＩＮ   Hydrochloride'), 'metformin hydrochloride');

  const precise = createIngredientIdentity({
    observed_name: '  Amoxicillin   Trihydrate ',
    molecule_raw: 'must not win',
    molecule: 'amoxycillin',
  });
  assert.deepEqual(precise, {
    ingredient_id: ingredientIdForName('amoxicillin trihydrate'),
    canonical_name: 'amoxicillin trihydrate',
    observed_name: 'Amoxicillin Trihydrate',
    precision: 'observed',
    source_field: 'observed_name',
  });

  assert.equal(ingredientIdForName(' Metformin Hydrochloride '), ingredientIdForName('metformin hydrochloride'));
  assert.notEqual(ingredientIdForName('metformin hydrochloride'), ingredientIdForName('metformin'));
  assert.notEqual(ingredientIdForName('acetaminophen'), ingredientIdForName('paracetamol'));
});

test('identity prefers molecule_raw and explicitly marks catalogue molecule fallback', () => {
  assert.equal(createIngredientIdentity({ molecule_raw: 'Cefuroxime Axetil', molecule: 'cefuroxime' }).source_field, 'molecule_raw');
  assert.equal(createIngredientIdentity({ molecule_raw: 'Cefuroxime Axetil', molecule: 'cefuroxime' }).precision, 'observed');
  assert.deepEqual(createIngredientIdentity({ molecule: 'cefuroxime' }), {
    ingredient_id: ingredientIdForName('cefuroxime'),
    canonical_name: 'cefuroxime',
    observed_name: 'cefuroxime',
    precision: 'catalogue_normalized_fallback',
    source_field: 'molecule',
  });
  assert.throws(() => createIngredientIdentity({ molecule: '   ' }), /ingredient name/i);
});

test('aggregation expands FDCs, deduplicates within a product, and is order-independent', () => {
  const products = [
    {
      brand_name: 'Combination A',
      ingredients: [
        { observed_name: 'Metformin Hydrochloride' },
        { observed_name: ' metformin   hydrochloride ' },
        { molecule_raw: 'Sitagliptin Phosphate' },
      ],
      sources: [{ source: 'z-source' }, { source: 'a-source' }, { source: 'z-source' }],
    },
    {
      brand_name: 'Single B',
      ingredients: [{ molecule_raw: 'Metformin Hydrochloride' }],
      sources: [{ source: 'b-source' }],
    },
    {
      brand_name: 'Fallback C',
      ingredients: [{ molecule: 'paracetamol' }],
      sources: [{ source: 'a-source' }],
    },
  ];

  const forward = aggregateIngredientProducts(products);
  const reverse = aggregateIngredientProducts([...products].reverse());
  assert.deepEqual(reverse, forward);
  assert.deepEqual(forward.rows.map((row) => row.canonical_name), [
    'metformin hydrochloride',
    'paracetamol',
    'sitagliptin phosphate',
  ]);

  const metformin = forward.rows[0];
  assert.deepEqual(metformin.observed_names, ['Metformin Hydrochloride', 'metformin hydrochloride']);
  assert.deepEqual(metformin.precise_substances, []);
  assert.equal(metformin.product_count, 2);
  assert.equal(metformin.single_ingredient_product_count, 1);
  assert.equal(metformin.combination_product_count, 1);
  assert.deepEqual(metformin.source_assertions, ['a-source', 'b-source', 'z-source']);

  assert.deepEqual(forward.row_counts, {
    input_products: 3,
    products_with_ingredients: 3,
    ingredient_assertions: 5,
    unique_product_ingredients: 4,
  });
  assert.deepEqual(forward.source_counts, {
    'a-source': 2,
    'b-source': 1,
    'z-source': 1,
  });
  assert.deepEqual(forward.warnings, [{
    code: 'catalogue_normalized_ingredient_fallback',
    count: 1,
    message: 'Ingredient identity fell back to molecule, which may already be catalogue-normalized.',
  }]);
});

test('aggregation retains only explicitly asserted precise substances', () => {
  const result = aggregateIngredientProducts([{
    ingredients: [
      { observed_name: 'Insulin Glargine', precise_substance: 'Insulin glargine [biosynthetic]' },
      { observed_name: 'INSULIN GLARGINE', precise_substance: ' Insulin  glargine [biosynthetic] ' },
    ],
    sources: ['source-b', { source: 'source-a' }],
  }]);

  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.rows[0].precise_substances, ['Insulin glargine [biosynthetic]']);
  assert.deepEqual(result.rows[0].source_assertions, ['source-a', 'source-b']);
  assert.equal(result.rows[0].product_count, 1);
  assert.equal(result.rows[0].single_ingredient_product_count, 1);
});

test('strict JSONL reader reports malformed input with the physical line number', async () => {
  const root = await makeTempDir();
  const input = path.join(root, 'bad.jsonl');
  await fs.writeFile(input, '{"ingredients":[]}\n\n{"ingredients":\n', 'utf8');

  const rows = [];
  await assert.rejects(async () => {
    for await (const row of readStrictJsonl(input)) rows.push(row);
  }, (error) => {
    assert.match(error.message, /bad\.jsonl/);
    assert.match(error.message, /line 3/);
    return true;
  });
  assert.equal(rows.length, 1);
});

test('streaming builder atomically replaces deterministic JSONL and writes metadata', async () => {
  const root = await makeTempDir();
  const inputA = path.join(root, 'a.jsonl');
  const inputB = path.join(root, 'b.jsonl');
  const outputA = path.join(root, 'out-a', 'ingredient-index.jsonl');
  const outputB = path.join(root, 'out-b', 'ingredient-index.jsonl');
  const metadataA = path.join(root, 'out-a', 'ingredient-index.meta.json');
  const metadataB = path.join(root, 'out-b', 'ingredient-index.meta.json');
  const products = [
    { ingredients: [{ molecule_raw: 'Zinc Sulfate Monohydrate' }], sources: [{ source: 'open-b' }] },
    { ingredients: [{ observed_name: 'Ácido Fólico' }, { molecule: 'Iron' }], sources: [{ source: 'open-a' }] },
  ];
  await fs.writeFile(inputA, `${products.map(JSON.stringify).join('\n')}\n`, 'utf8');
  await fs.writeFile(inputB, `${[...products].reverse().map(JSON.stringify).join('\n')}\n`, 'utf8');
  await fs.mkdir(path.dirname(outputA), { recursive: true });
  await fs.writeFile(outputA, 'stale\n', 'utf8');

  const builtA = await buildIngredientIndex({
    inputPath: inputA,
    outputPath: outputA,
    metadataPath: metadataA,
    profile: 'internal-evaluation',
  });
  await buildIngredientIndex({
    inputPath: inputB,
    outputPath: outputB,
    metadataPath: metadataB,
    profile: 'internal-evaluation',
  });

  const [jsonlA, jsonlB, metadata] = await Promise.all([
    fs.readFile(outputA, 'utf8'),
    fs.readFile(outputB, 'utf8'),
    fs.readFile(metadataA, 'utf8').then(JSON.parse),
  ]);
  assert.equal(jsonlA, jsonlB);
  assert.ok(jsonlA.endsWith('\n'));
  assert.doesNotMatch(jsonlA, /created|generated|timestamp/i);
  assert.equal(builtA.ingredient_count, 3);
  assert.equal(metadata.schema_version, '1.0.0');
  assert.equal(metadata.identity_namespace, INGREDIENT_IDENTITY_NAMESPACE);
  assert.equal(metadata.profile, 'internal-evaluation');
  assert.equal(metadata.source_artifact_path, path.resolve(inputA));
  assert.deepEqual(metadata.source_counts, { 'open-a': 1, 'open-b': 1 });
  assert.deepEqual(metadata.row_counts, {
    input_products: 2,
    products_with_ingredients: 2,
    ingredient_assertions: 3,
    unique_product_ingredients: 3,
  });
  assert.equal(metadata.ingredient_count, 3);
  assert.equal(metadata.warnings[0].code, 'catalogue_normalized_ingredient_fallback');
  assert.equal(metadata.warnings[0].count, 1);

  const leftovers = (await fs.readdir(path.dirname(outputA))).filter((name) => name.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});
