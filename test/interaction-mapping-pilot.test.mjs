import { test } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  buildInteractionMappingPilotFromFiles,
  selectInteractionMappingPilot,
} from '../src/lib/interaction-mapping-pilot.mjs';

function ingredientRow({ id, name, requirements, proposedIdentity = null }) {
  return {
    schema_version: 1,
    review_status: 'review_candidate',
    assertion: {
      ingredient_id: id,
      canonical_name: name,
      observed_name: name,
    },
    proposed_identity: proposedIdentity,
    selector_requirements: requirements.map(([requirementId, ruleId]) => ({
      requirement_id: requirementId,
      rule_id: ruleId,
    })),
    catalog_match: { matched: true },
  };
}

function productRow({
  id,
  sourceCounts,
  matchedIngredients,
  route = null,
  formulation = null,
}) {
  return {
    schema_version: 1,
    review_status: 'review_candidate',
    product_id: id,
    product_assertion_sha256: id.padEnd(64, '0'),
    product_assertion: {},
    catalog: { row_count: 1, source_counts: sourceCounts },
    matched_ingredients: matchedIngredients.map(([ingredientId, requirementIds]) => ({
      ingredient_id: ingredientId,
      requirement_ids: requirementIds,
    })),
    proposed_presentation: { route, formulation },
  };
}

const ingredients = [
  ingredientRow({
    id: 'ingredient-amiodarone',
    name: 'amiodarone',
    requirements: [
      ['requirement-amiodarone', 'warfarin__amiodarone'],
      ['requirement-other', 'digoxin__amiodarone'],
    ],
  }),
  ingredientRow({
    id: 'ingredient-warfarin',
    name: 'warfarin',
    requirements: [['requirement-warfarin', 'warfarin__amiodarone']],
  }),
  ingredientRow({
    id: 'ingredient-digoxin',
    name: 'digoxin',
    requirements: [['requirement-digoxin', 'digoxin__amiodarone']],
  }),
];

const products = [
  productRow({
    id: 'product-amiodarone',
    sourceCounts: { janaushadhi: 1 },
    matchedIngredients: [[
      'ingredient-amiodarone',
      ['requirement-amiodarone', 'requirement-other'],
    ]],
  }),
  productRow({
    id: 'product-warfarin',
    sourceCounts: { 'github-jr': 1 },
    matchedIngredients: [['ingredient-warfarin', ['requirement-warfarin']]],
  }),
  productRow({
    id: 'product-mixed',
    sourceCounts: { janaushadhi: 1, 'github-jr': 1 },
    matchedIngredients: [['ingredient-warfarin', ['requirement-warfarin']]],
  }),
  productRow({
    id: 'product-digoxin',
    sourceCounts: { janaushadhi: 1 },
    matchedIngredients: [['ingredient-digoxin', ['requirement-digoxin']]],
  }),
];

test('mapping pilot selects only the requested rule and exclusive source', () => {
  const pilot = selectInteractionMappingPilot({
    ingredientRows: ingredients,
    productRows: products,
    ruleIds: ['warfarin__amiodarone'],
    sourceOnly: 'janaushadhi',
  });

  assert.equal(pilot.ingredient_rows.length, 2);
  assert.equal(pilot.product_rows.length, 1);
  assert.equal(pilot.product_rows[0].product_id, 'product-amiodarone');
  assert.deepEqual(
    pilot.ingredient_rows
      .find((row) => row.assertion.ingredient_id === 'ingredient-amiodarone')
      .selector_requirements
      .map((requirement) => requirement.requirement_id),
    ['requirement-amiodarone'],
  );
  assert.deepEqual(
    pilot.product_rows[0].matched_ingredients[0].requirement_ids,
    ['requirement-amiodarone'],
  );
  assert.equal(pilot.counts.accepted_ingredient_mapping_count, 0);
  assert.equal(pilot.counts.accepted_product_presentation_count, 0);
  assert.deepEqual(pilot.source_counts, { janaushadhi: 1 });
});

test('mapping pilot rejects unknown rules and non-candidate inputs', () => {
  assert.throws(
    () => selectInteractionMappingPilot({
      ingredientRows: ingredients,
      productRows: products,
      ruleIds: ['unknown__rule'],
    }),
    /unknown or unmapped rule/i,
  );
  assert.throws(
    () => selectInteractionMappingPilot({
      ingredientRows: [
        ingredientRow({
          id: 'ingredient-warfarin',
          name: 'warfarin',
          requirements: [['requirement-warfarin', 'warfarin__amiodarone']],
          proposedIdentity: { rxcui: '11289' },
        }),
      ],
      productRows: [],
      ruleIds: ['warfarin__amiodarone'],
    }),
    /not candidate-only/i,
  );
  assert.throws(
    () => selectInteractionMappingPilot({
      ingredientRows: ingredients,
      productRows: [
        productRow({
          id: 'product-warfarin',
          sourceCounts: { janaushadhi: 1 },
          matchedIngredients: [['ingredient-warfarin', ['requirement-warfarin']]],
          formulation: 'tablet',
        }),
      ],
      ruleIds: ['warfarin__amiodarone'],
    }),
    /inferred presentation/i,
  );
});

function rowsText(rows) {
  return rows.map((row) => `${JSON.stringify(row)}\n`).join('');
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

test('mapping pilot binds parent hashes before atomically replacing its output', async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aushadhi-mapping-pilot-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const backlogDir = path.join(root, 'mapping-backlog');
  const outputDir = path.join(root, 'pilot');
  await Promise.all([
    fsp.mkdir(backlogDir),
    fsp.mkdir(outputDir),
  ]);

  const ingredientText = rowsText(ingredients);
  const productText = rowsText(products);
  const ingredientPath = path.join(backlogDir, 'ingredient-assertions.jsonl');
  const productPath = path.join(backlogDir, 'product-presentations.jsonl');
  const summaryPath = path.join(backlogDir, 'summary.json');
  const summary = {
    schema_version: 1,
    profile: 'internal-evaluation',
    outputs: {
      ingredient_assertions: { sha256: sha256(ingredientText) },
      product_presentations: { sha256: sha256(productText) },
    },
    review_boundary: {
      review_status: 'review_candidate',
      accepted_mapping_count: 0,
    },
  };
  await Promise.all([
    fsp.writeFile(ingredientPath, ingredientText, 'utf8'),
    fsp.writeFile(productPath, productText, 'utf8'),
    fsp.writeFile(summaryPath, `${JSON.stringify({
      ...summary,
      outputs: {
        ...summary.outputs,
        ingredient_assertions: { sha256: '0'.repeat(64) },
      },
    })}\n`, 'utf8'),
    fsp.writeFile(path.join(outputDir, 'sentinel.txt'), 'preserve me\n', 'utf8'),
  ]);

  const options = {
    profile: 'internal-evaluation',
    ingredientInputPath: ingredientPath,
    productInputPath: productPath,
    summaryInputPath: summaryPath,
    inputStoragePath: 'data/interaction/internal-evaluation/mapping-backlog',
    outputDir,
    outputStoragePath: 'data/interaction/internal-evaluation/mapping-pilot',
    ruleIds: ['warfarin__amiodarone'],
    sourceOnly: 'janaushadhi',
  };
  await assert.rejects(
    () => buildInteractionMappingPilotFromFiles(options),
    /ingredient backlog hash does not match/i,
  );
  assert.equal(
    await fsp.readFile(path.join(outputDir, 'sentinel.txt'), 'utf8'),
    'preserve me\n',
  );

  await fsp.writeFile(summaryPath, `${JSON.stringify(summary)}\n`, 'utf8');
  const result = await buildInteractionMappingPilotFromFiles(options);
  assert.equal(result.summary.counts.ingredient_assertion_count, 2);
  assert.equal(result.summary.counts.product_assertion_candidate_count, 1);
  await assert.rejects(
    () => fsp.access(path.join(outputDir, 'sentinel.txt')),
    /ENOENT/,
  );
});
