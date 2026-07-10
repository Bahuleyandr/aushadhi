import fs from 'node:fs';
import readline from 'node:readline';
import { createHash } from 'node:crypto';
import {
  normBrandName,
  normManufacturer,
  normPack,
  normText,
} from './normalize.mjs';

const compareCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const PRODUCT_ID_NAMESPACE = 'aushadhi:product:v1';
const QUERY_KEYS = new Set(['brand_name', 'manufacturer', 'pack_label', 'form_raw', 'strengths']);

function optionalString(value, field) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`);
  const trimmed = value.trim();
  return trimmed || null;
}

function optionalStringArray(value, field) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty array of strings`);
  }
  return value.map((entry, index) => {
    const normalized = optionalString(entry, `${field}[${index}]`);
    if (!normalized) throw new TypeError(`${field}[${index}] must be a non-empty string`);
    return normalized;
  });
}

function normalizeStrength(value) {
  return normText(value).replace(/\s+/gu, '');
}

function ingredientStrengths(row) {
  if (!Array.isArray(row.ingredients) || row.ingredients.length === 0) return null;
  const strengths = row.ingredients.map((ingredient) => normalizeStrength(ingredient?.strength_raw));
  if (strengths.some((strength) => !strength)) return null;
  return strengths.sort(compareCodePoint);
}

function ingredientSignature(row) {
  if (!Array.isArray(row.ingredients)) return '';
  return row.ingredients.map((ingredient) => [
    normText(ingredient?.observed_name ?? ingredient?.molecule_raw ?? ingredient?.molecule),
    normalizeStrength(ingredient?.strength_raw),
  ].join('\u0001')).sort(compareCodePoint).join('\u0002');
}

export function normalizeProductQuery(query) {
  const value = typeof query === 'string' ? { brand_name: query } : query;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('product query must be a brand string or object');
  }
  for (const key of Object.keys(value)) {
    if (!QUERY_KEYS.has(key)) throw new TypeError(`product query contains unknown property ${key}`);
  }
  const brandName = optionalString(value.brand_name, 'brand_name');
  if (!brandName) throw new TypeError('product query requires brand_name');
  return {
    brand_name: brandName,
    manufacturer: optionalString(value.manufacturer, 'manufacturer'),
    pack_label: optionalString(value.pack_label, 'pack_label'),
    form_raw: optionalString(value.form_raw, 'form_raw'),
    strengths: optionalStringArray(value.strengths, 'strengths'),
  };
}

function queryMatcher(query) {
  return {
    brand_name: normBrandName(query.brand_name),
    manufacturer: query.manufacturer ? normManufacturer(query.manufacturer) : null,
    pack_label: query.pack_label ? normPack(query.pack_label) : null,
    form_raw: query.form_raw ? normText(query.form_raw) : null,
    strengths: query.strengths
      ? query.strengths.map(normalizeStrength).sort(compareCodePoint)
      : null,
  };
}

function matches(row, matcher) {
  if (normBrandName(row.brand_name) !== matcher.brand_name) return false;
  if (matcher.manufacturer !== null
      && normManufacturer(row.manufacturer) !== matcher.manufacturer) return false;
  if (matcher.pack_label !== null && normPack(row.pack_label) !== matcher.pack_label) return false;
  if (matcher.form_raw !== null && normText(row.form_raw) !== matcher.form_raw) return false;
  if (matcher.strengths !== null) {
    const rowStrengths = ingredientStrengths(row);
    if (rowStrengths === null
      || rowStrengths.length !== matcher.strengths.length
      || rowStrengths.some((strength, index) => strength !== matcher.strengths[index])) return false;
  }
  return true;
}

export function productIdForRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new TypeError('product row must be an object');
  }
  const identity = [
    normBrandName(row.brand_name),
    normManufacturer(row.manufacturer),
    normPack(row.pack_label),
    normText(row.form_raw),
    ingredientSignature(row),
  ].join('\u0000');
  if (!normBrandName(row.brand_name)) throw new TypeError('product row requires brand_name');
  const digest = createHash('sha256')
    .update(PRODUCT_ID_NAMESPACE, 'utf8')
    .update('\u0000', 'utf8')
    .update(identity, 'utf8')
    .digest('hex');
  return `sha256:${digest}`;
}

function candidateSummary(row) {
  return {
    product_id: productIdForRow(row),
    brand_name: row.brand_name ?? null,
    manufacturer: row.manufacturer ?? null,
    pack_label: row.pack_label ?? null,
    form_raw: row.form_raw ?? null,
    ingredients: row.ingredients ?? [],
    sources: row.sources ?? [],
  };
}

function candidateSortKey(row) {
  return [
    normBrandName(row.brand_name),
    normManufacturer(row.manufacturer),
    normPack(row.pack_label),
    normText(row.form_raw),
    ingredientSignature(row),
  ].join('\u0000');
}

function addProductProvenance(sourceCounts, row, lineNumber) {
  if (!Array.isArray(row.sources) || row.sources.length === 0) {
    throw new TypeError(`product record at line ${lineNumber} requires source provenance`);
  }
  const rowSources = new Set();
  for (const assertion of row.sources) {
    const sourceId = typeof assertion === 'string' ? assertion : assertion?.source;
    if (typeof sourceId !== 'string' || sourceId.trim() === '') {
      throw new TypeError(`invalid source provenance at line ${lineNumber}`);
    }
    rowSources.add(sourceId);
  }
  for (const sourceId of rowSources) {
    sourceCounts.set(sourceId, (sourceCounts.get(sourceId) ?? 0) + 1);
  }
}

export async function scanProductQueries({ artifactPath, queries }) {
  if (!artifactPath || typeof artifactPath !== 'string') {
    throw new TypeError('artifactPath is required');
  }
  if (!Array.isArray(queries) || queries.length === 0) {
    throw new TypeError('at least one product query is required');
  }

  const inputs = queries.map(normalizeProductQuery);
  const matchers = inputs.map(queryMatcher);
  const found = inputs.map(() => []);
  const stream = fs.createReadStream(artifactPath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  let rowCount = 0;
  const sourceCounts = new Map();

  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch (error) {
      throw new SyntaxError(`invalid product JSON at line ${lineNumber}: ${error.message}`);
    }
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new TypeError(`invalid product record at line ${lineNumber}`);
    }
    rowCount += 1;
    addProductProvenance(sourceCounts, row, lineNumber);
    for (let index = 0; index < matchers.length; index += 1) {
      if (matches(row, matchers[index])) found[index].push(row);
    }
  }

  const results = inputs.map((input, index) => {
    const candidates = found[index].sort((a, b) => (
      compareCodePoint(candidateSortKey(a), candidateSortKey(b))
    ));
    if (candidates.length === 1) {
      return {
        input,
        status: 'resolved',
        product: { ...candidates[0], product_id: productIdForRow(candidates[0]) },
      };
    }
    if (candidates.length === 0) {
      return { input, status: 'unresolved', reason: 'no_exact_product_match' };
    }
    return {
      input,
      status: 'ambiguous',
      reason: 'multiple_exact_product_matches',
      candidates: candidates.map(candidateSummary),
    };
  });
  return {
    results,
    provenance: {
      row_count: rowCount,
      source_counts: Object.fromEntries(
        [...sourceCounts.entries()].sort(([left], [right]) => compareCodePoint(left, right)),
      ),
    },
  };
}

export async function resolveProductQueries(options) {
  return (await scanProductQueries(options)).results;
}
