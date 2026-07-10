import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import {
  INGREDIENT_IDENTITY_NAMESPACE,
  createIngredientIdentity,
  normalizeObservedIngredientName,
} from './ingredient-identity.mjs';

export const INGREDIENT_INDEX_SCHEMA_VERSION = '1.0.0';

const WARNING_DEFINITIONS = {
  catalogue_normalized_ingredient_fallback:
    'Ingredient identity fell back to molecule, which may already be catalogue-normalized.',
};

export function compareByCodePoint(left, right) {
  const leftPoints = [...left].map((character) => character.codePointAt(0));
  const rightPoints = [...right].map((character) => character.codePointAt(0));
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index++) {
    if (leftPoints[index] < rightPoints[index]) return -1;
    if (leftPoints[index] > rightPoints[index]) return 1;
  }
  return leftPoints.length - rightPoints.length;
}

function sorted(values) {
  return [...values].sort(compareByCodePoint);
}

function sortedCountObject(counts) {
  return Object.fromEntries(sorted(counts.keys()).map((key) => [key, counts.get(key)]));
}

function sourceAssertionsForProduct(product) {
  const assertions = new Set();
  const sources = Array.isArray(product.sources) ? product.sources : [];
  for (const item of sources) {
    const value = typeof item === 'string' ? item : item?.source;
    const normalized = normalizeObservedIngredientName(value);
    if (normalized) assertions.add(normalized);
  }
  const directSource = normalizeObservedIngredientName(product.source);
  if (directSource) assertions.add(directSource);
  return assertions;
}

function preciseSubstancesForIngredient(ingredient) {
  const values = [];
  if (Array.isArray(ingredient.precise_substances)) values.push(...ingredient.precise_substances);
  values.push(ingredient.precise_substance, ingredient.precise_substance_name);
  return new Set(values.map(normalizeObservedIngredientName).filter(Boolean));
}

function increment(counts, key, amount = 1) {
  counts.set(key, (counts.get(key) ?? 0) + amount);
}

export function createIngredientAggregation() {
  return {
    entries: new Map(),
    row_counts: {
      input_products: 0,
      products_with_ingredients: 0,
      ingredient_assertions: 0,
      unique_product_ingredients: 0,
    },
    source_counts: new Map(),
    warning_counts: new Map(),
  };
}

export function addProductToIngredientAggregation(aggregation, product) {
  if (!product || typeof product !== 'object' || Array.isArray(product)) {
    throw new TypeError('Each product row must be a JSON object.');
  }

  aggregation.row_counts.input_products++;
  const sourceAssertions = sourceAssertionsForProduct(product);
  for (const source of sourceAssertions) increment(aggregation.source_counts, source);

  const ingredients = Array.isArray(product.ingredients) ? product.ingredients : [];
  aggregation.row_counts.ingredient_assertions += ingredients.length;
  const productIngredients = new Map();

  for (let index = 0; index < ingredients.length; index++) {
    let identity;
    try {
      identity = createIngredientIdentity(ingredients[index]);
    } catch (cause) {
      const productLabel = normalizeObservedIngredientName(product.brand_name) || '<unnamed product>';
      throw new TypeError(`Invalid ingredient at index ${index} for ${productLabel}: ${cause.message}`, { cause });
    }
    if (identity.precision === 'catalogue_normalized_fallback') {
      increment(aggregation.warning_counts, 'catalogue_normalized_ingredient_fallback');
    }

    let assertion = productIngredients.get(identity.ingredient_id);
    if (!assertion) {
      assertion = {
        ingredient_id: identity.ingredient_id,
        canonical_name: identity.canonical_name,
        observed_names: new Set(),
        precise_substances: new Set(),
      };
      productIngredients.set(identity.ingredient_id, assertion);
    } else if (assertion.canonical_name !== identity.canonical_name) {
      throw new Error(`Ingredient identifier collision for ${identity.canonical_name}.`);
    }
    assertion.observed_names.add(identity.observed_name);
    for (const precise of preciseSubstancesForIngredient(ingredients[index])) {
      assertion.precise_substances.add(precise);
    }
  }

  if (productIngredients.size === 0) return aggregation;
  aggregation.row_counts.products_with_ingredients++;
  aggregation.row_counts.unique_product_ingredients += productIngredients.size;
  const isCombination = productIngredients.size > 1;

  for (const assertion of productIngredients.values()) {
    let entry = aggregation.entries.get(assertion.ingredient_id);
    if (!entry) {
      entry = {
        ingredient_id: assertion.ingredient_id,
        canonical_name: assertion.canonical_name,
        observed_names: new Set(),
        precise_substances: new Set(),
        product_count: 0,
        single_ingredient_product_count: 0,
        combination_product_count: 0,
        source_assertions: new Set(),
      };
      aggregation.entries.set(assertion.ingredient_id, entry);
    } else if (entry.canonical_name !== assertion.canonical_name) {
      throw new Error(`Ingredient identifier collision for ${assertion.canonical_name}.`);
    }

    for (const name of assertion.observed_names) entry.observed_names.add(name);
    for (const precise of assertion.precise_substances) entry.precise_substances.add(precise);
    for (const source of sourceAssertions) entry.source_assertions.add(source);
    entry.product_count++;
    if (isCombination) entry.combination_product_count++;
    else entry.single_ingredient_product_count++;
  }
  return aggregation;
}

export function finalizeIngredientAggregation(aggregation) {
  const rows = [...aggregation.entries.values()]
    .sort((left, right) => compareByCodePoint(left.canonical_name, right.canonical_name)
      || compareByCodePoint(left.ingredient_id, right.ingredient_id))
    .map((entry) => ({
      ingredient_id: entry.ingredient_id,
      canonical_name: entry.canonical_name,
      observed_names: sorted(entry.observed_names),
      precise_substances: sorted(entry.precise_substances),
      product_count: entry.product_count,
      single_ingredient_product_count: entry.single_ingredient_product_count,
      combination_product_count: entry.combination_product_count,
      source_assertions: sorted(entry.source_assertions),
    }));
  const warnings = sorted(aggregation.warning_counts.keys()).map((code) => ({
    code,
    count: aggregation.warning_counts.get(code),
    message: WARNING_DEFINITIONS[code],
  }));
  return {
    rows,
    row_counts: { ...aggregation.row_counts },
    source_counts: sortedCountObject(aggregation.source_counts),
    warnings,
  };
}

export function aggregateIngredientProducts(products) {
  const aggregation = createIngredientAggregation();
  for (const product of products) addProductToIngredientAggregation(aggregation, product);
  return finalizeIngredientAggregation(aggregation);
}

export async function* readStrictJsonl(filePath) {
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (let line of lines) {
      lineNumber++;
      if (lineNumber === 1) line = line.replace(/^\uFEFF/u, '');
      if (!line.trim()) continue;
      let value;
      try {
        value = JSON.parse(line);
      } catch (cause) {
        throw new SyntaxError(`Invalid JSONL in ${filePath} at line ${lineNumber}: ${cause.message}`, { cause });
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new SyntaxError(`Invalid JSONL in ${filePath} at line ${lineNumber}: expected a JSON object.`);
      }
      yield value;
    }
  } finally {
    lines.close();
    input.destroy();
  }
}

async function atomicWrite(filePath, write) {
  const directory = path.dirname(filePath);
  await fsp.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.tmp-${process.pid}-${randomUUID()}`,
  );
  let handle;
  try {
    handle = await fsp.open(temporaryPath, 'wx');
    await write(handle);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fsp.rename(temporaryPath, filePath);
  } catch (error) {
    await handle?.close().catch(() => {});
    await fsp.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function writeJsonlAtomically(filePath, rows) {
  await atomicWrite(filePath, async (handle) => {
    for (const row of rows) await handle.write(`${JSON.stringify(row)}\n`, null, 'utf8');
  });
}

async function writeJsonAtomically(filePath, value) {
  await atomicWrite(filePath, (handle) => handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8'));
}

export async function buildIngredientIndex({
  inputPath,
  outputPath,
  metadataPath = outputPath?.replace(/\.jsonl$/u, '.meta.json'),
  profile,
}) {
  if (!inputPath || !outputPath || !metadataPath) {
    throw new TypeError('inputPath, outputPath, and metadataPath are required.');
  }
  if (!normalizeObservedIngredientName(profile)) throw new TypeError('A non-empty profile is required.');
  if (path.resolve(outputPath) === path.resolve(metadataPath)) {
    throw new TypeError('outputPath and metadataPath must be different files.');
  }

  const aggregation = createIngredientAggregation();
  for await (const product of readStrictJsonl(inputPath)) {
    addProductToIngredientAggregation(aggregation, product);
  }
  const result = finalizeIngredientAggregation(aggregation);
  const metadata = {
    schema_version: INGREDIENT_INDEX_SCHEMA_VERSION,
    identity_namespace: INGREDIENT_IDENTITY_NAMESPACE,
    profile: normalizeObservedIngredientName(profile),
    source_artifact_path: path.resolve(inputPath),
    source_counts: result.source_counts,
    row_counts: result.row_counts,
    ingredient_count: result.rows.length,
    warnings: result.warnings,
  };

  await writeJsonlAtomically(outputPath, result.rows);
  await writeJsonAtomically(metadataPath, metadata);
  return metadata;
}
