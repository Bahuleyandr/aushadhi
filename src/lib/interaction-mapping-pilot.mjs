import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readStrictJsonl } from './ingredient-index.mjs';

export const INTERACTION_MAPPING_PILOT_SCHEMA_VERSION = 1;

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values) {
  return [...new Set(values)].sort(compareCodePoint);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256Rows(rows) {
  const hash = createHash('sha256');
  for (const row of rows) hash.update(`${JSON.stringify(row)}\n`, 'utf8');
  return hash.digest('hex');
}

async function sha256File(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(file);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('error', reject);
    input.on('end', resolve);
  });
  return hash.digest('hex');
}

async function readJson(file, label) {
  let text;
  try {
    text = await fsp.readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${label} at ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid ${label} JSON at ${file}: ${error.message}`);
  }
}

function validateBacklogSummary(summary) {
  if (!isObject(summary) || summary.schema_version !== 1) {
    throw new Error('mapping backlog summary must use schema_version 1');
  }
  const ingredientHash = summary.outputs?.ingredient_assertions?.sha256;
  const productHash = summary.outputs?.product_presentations?.sha256;
  if (!/^[a-f0-9]{64}$/.test(ingredientHash ?? '')) {
    throw new Error('mapping backlog summary is missing the ingredient output hash');
  }
  if (!/^[a-f0-9]{64}$/.test(productHash ?? '')) {
    throw new Error('mapping backlog summary is missing the product output hash');
  }
  if (
    summary.review_boundary?.review_status !== 'review_candidate'
    || summary.review_boundary?.accepted_mapping_count !== 0
  ) {
    throw new Error('mapping backlog summary does not preserve the candidate-only boundary');
  }
}

function assertCandidateIngredient(row) {
  if (
    !isObject(row)
    || row.schema_version !== 1
    || row.review_status !== 'review_candidate'
    || !isObject(row.assertion)
    || !Array.isArray(row.selector_requirements)
  ) {
    throw new Error('invalid ingredient mapping backlog row');
  }
  if (row.proposed_identity !== null) {
    throw new Error(
      `ingredient backlog row ${row.assertion.ingredient_id ?? '<unknown>'} is not candidate-only`,
    );
  }
}

function assertCandidateProduct(row) {
  if (
    !isObject(row)
    || row.schema_version !== 1
    || row.review_status !== 'review_candidate'
    || !Array.isArray(row.matched_ingredients)
  ) {
    throw new Error('invalid product mapping backlog row');
  }
  if (
    row.proposed_presentation?.route !== null
    || row.proposed_presentation?.formulation !== null
  ) {
    throw new Error(
      `product backlog row ${row.product_id ?? '<unknown>'} contains an inferred presentation`,
    );
  }
}

function hasExclusiveSource(row, sourceOnly) {
  if (sourceOnly === null) return true;
  const sourceIds = Object.keys(row.catalog?.source_counts ?? {}).sort(compareCodePoint);
  return sourceIds.length === 1 && sourceIds[0] === sourceOnly;
}

export function selectInteractionMappingPilot({
  ingredientRows,
  productRows,
  ruleIds,
  sourceOnly = null,
}) {
  if (!Array.isArray(ingredientRows) || !Array.isArray(productRows)) {
    throw new TypeError('ingredientRows and productRows must be arrays');
  }
  const selectedRuleIds = sortedUnique(ruleIds ?? []);
  if (selectedRuleIds.length === 0) {
    throw new TypeError('at least one rule ID is required');
  }
  if (
    sourceOnly !== null
    && (typeof sourceOnly !== 'string' || sourceOnly.trim() === '')
  ) {
    throw new TypeError('sourceOnly must be a non-empty source ID or null');
  }

  const requestedRules = new Set(selectedRuleIds);
  const observedRules = new Set();
  const requirementIdsByIngredient = new Map();
  const selectedIngredients = [];

  for (const row of ingredientRows) {
    assertCandidateIngredient(row);
    const requirements = row.selector_requirements.filter((requirement) => {
      const selected = requestedRules.has(requirement.rule_id);
      if (selected) observedRules.add(requirement.rule_id);
      return selected;
    });
    if (requirements.length === 0) continue;

    const ingredientId = row.assertion.ingredient_id;
    requirementIdsByIngredient.set(
      ingredientId,
      new Set(requirements.map((requirement) => requirement.requirement_id)),
    );
    selectedIngredients.push({
      ...row,
      selector_requirements: requirements,
    });
  }

  const missingRules = selectedRuleIds.filter((ruleId) => !observedRules.has(ruleId));
  if (missingRules.length > 0) {
    throw new Error(`unknown or unmapped rule ID(s): ${missingRules.join(', ')}`);
  }

  const selectedProducts = [];
  for (const row of productRows) {
    assertCandidateProduct(row);
    if (!hasExclusiveSource(row, sourceOnly)) continue;

    const matchedIngredients = [];
    for (const matched of row.matched_ingredients) {
      const selectedRequirementIds = requirementIdsByIngredient.get(matched.ingredient_id);
      if (!selectedRequirementIds) continue;
      const requirementIds = matched.requirement_ids.filter(
        (requirementId) => selectedRequirementIds.has(requirementId),
      );
      if (requirementIds.length === 0) continue;
      matchedIngredients.push({
        ...matched,
        requirement_ids: requirementIds,
      });
    }
    if (matchedIngredients.length === 0) continue;
    selectedProducts.push({
      ...row,
      matched_ingredients: matchedIngredients,
    });
  }

  const sourceCounts = new Map();
  for (const row of selectedProducts) {
    for (const [sourceId, count] of Object.entries(row.catalog?.source_counts ?? {})) {
      sourceCounts.set(sourceId, (sourceCounts.get(sourceId) ?? 0) + count);
    }
  }

  selectedIngredients.sort((left, right) => compareCodePoint(
    left.assertion.ingredient_id,
    right.assertion.ingredient_id,
  ));
  selectedProducts.sort((left, right) => {
    const productOrder = compareCodePoint(left.product_id, right.product_id);
    return productOrder || compareCodePoint(
      left.product_assertion_sha256,
      right.product_assertion_sha256,
    );
  });

  return {
    ingredient_rows: selectedIngredients,
    product_rows: selectedProducts,
    selection: {
      rule_ids: selectedRuleIds,
      source_only: sourceOnly,
    },
    counts: {
      rule_count: selectedRuleIds.length,
      ingredient_assertion_count: selectedIngredients.length,
      selector_requirement_count: selectedIngredients.reduce(
        (total, row) => total + row.selector_requirements.length,
        0,
      ),
      product_assertion_candidate_count: selectedProducts.length,
      accepted_ingredient_mapping_count: 0,
      accepted_product_presentation_count: 0,
    },
    source_counts: Object.fromEntries(
      [...sourceCounts.entries()].sort(([left], [right]) => compareCodePoint(left, right)),
    ),
  };
}

async function stagePilotDirectory({
  outputDir,
  ingredientRows,
  productRows,
  summary,
}) {
  const parent = path.dirname(outputDir);
  await fsp.mkdir(parent, { recursive: true });
  const temporary = path.join(
    parent,
    `.${path.basename(outputDir)}.tmp-${process.pid}-${randomUUID()}`,
  );
  const backup = path.join(
    parent,
    `.${path.basename(outputDir)}.backup-${process.pid}-${randomUUID()}`,
  );
  await fsp.mkdir(temporary);
  try {
    await Promise.all([
      fsp.writeFile(
        path.join(temporary, 'ingredient-assertions.jsonl'),
        ingredientRows.map((row) => `${JSON.stringify(row)}\n`).join(''),
        'utf8',
      ),
      fsp.writeFile(
        path.join(temporary, 'product-presentations.jsonl'),
        productRows.map((row) => `${JSON.stringify(row)}\n`).join(''),
        'utf8',
      ),
      fsp.writeFile(
        path.join(temporary, 'summary.json'),
        `${JSON.stringify(summary, null, 2)}\n`,
        'utf8',
      ),
    ]);

    const outputExists = await fsp.stat(outputDir).then(() => true, () => false);
    if (outputExists) await fsp.rename(outputDir, backup);
    try {
      await fsp.rename(temporary, outputDir);
    } catch (error) {
      if (outputExists) await fsp.rename(backup, outputDir).catch(() => {});
      throw error;
    }
    if (outputExists) await fsp.rm(backup, { recursive: true, force: true });
  } finally {
    await Promise.all([
      fsp.rm(temporary, { recursive: true, force: true }).catch(() => {}),
      fsp.rm(backup, { recursive: true, force: true }).catch(() => {}),
    ]);
  }
}

export async function buildInteractionMappingPilotFromFiles({
  profile,
  ingredientInputPath,
  productInputPath,
  summaryInputPath,
  inputStoragePath,
  outputDir,
  outputStoragePath,
  ruleIds,
  sourceOnly = null,
}) {
  if (!['production-open', 'internal-evaluation'].includes(profile)) {
    throw new TypeError('profile must be production-open or internal-evaluation');
  }
  for (const [label, value] of Object.entries({
    ingredientInputPath,
    productInputPath,
    summaryInputPath,
    inputStoragePath,
    outputDir,
    outputStoragePath,
  })) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new TypeError(`${label} is required`);
    }
  }
  if (path.resolve(outputDir) === path.resolve(path.dirname(ingredientInputPath))) {
    throw new TypeError('pilot output directory must differ from the mapping backlog');
  }

  const [backlogSummary, ingredientRows, productRows, inputHashes] = await Promise.all([
    readJson(summaryInputPath, 'mapping backlog summary'),
    (async () => {
      const rows = [];
      for await (const row of readStrictJsonl(ingredientInputPath)) rows.push(row);
      return rows;
    })(),
    (async () => {
      const rows = [];
      for await (const row of readStrictJsonl(productInputPath)) rows.push(row);
      return rows;
    })(),
    Promise.all([
      sha256File(ingredientInputPath),
      sha256File(productInputPath),
      sha256File(summaryInputPath),
    ]),
  ]);
  validateBacklogSummary(backlogSummary);
  if (backlogSummary.profile !== profile) {
    throw new Error(
      `mapping backlog profile ${backlogSummary.profile ?? '<missing>'} does not match ${profile}`,
    );
  }
  if (inputHashes[0] !== backlogSummary.outputs.ingredient_assertions.sha256) {
    throw new Error('ingredient backlog hash does not match its summary');
  }
  if (inputHashes[1] !== backlogSummary.outputs.product_presentations.sha256) {
    throw new Error('product backlog hash does not match its summary');
  }

  const pilot = selectInteractionMappingPilot({
    ingredientRows,
    productRows,
    ruleIds,
    sourceOnly,
  });
  const ingredientHash = sha256Rows(pilot.ingredient_rows);
  const productHash = sha256Rows(pilot.product_rows);
  const summary = {
    schema_version: INTERACTION_MAPPING_PILOT_SCHEMA_VERSION,
    profile,
    selection: pilot.selection,
    parent_backlog: {
      storage_path: inputStoragePath,
      summary_sha256: inputHashes[2],
      ingredient_assertions_sha256: inputHashes[0],
      product_presentations_sha256: inputHashes[1],
    },
    outputs: {
      ingredient_assertions: {
        storage_path: path.posix.join(
          outputStoragePath,
          'ingredient-assertions.jsonl',
        ),
        sha256: ingredientHash,
      },
      product_presentations: {
        storage_path: path.posix.join(
          outputStoragePath,
          'product-presentations.jsonl',
        ),
        sha256: productHash,
      },
    },
    counts: pilot.counts,
    source_counts: pilot.source_counts,
    review_boundary: {
      review_status: 'review_candidate',
      accepted_mapping_count: 0,
      route_or_formulation_inference_permitted: false,
      runtime_promotion_permitted: false,
    },
  };

  await stagePilotDirectory({
    outputDir,
    ingredientRows: pilot.ingredient_rows,
    productRows: pilot.product_rows,
    summary,
  });
  return {
    summary,
    ingredient_output_path: path.join(outputDir, 'ingredient-assertions.jsonl'),
    product_output_path: path.join(outputDir, 'product-presentations.jsonl'),
    summary_output_path: path.join(outputDir, 'summary.json'),
  };
}
