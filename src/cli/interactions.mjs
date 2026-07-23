import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkResolvedProducts, validateRulePack } from '../lib/interaction-checker.mjs';
import { createIngredientIdentity } from '../lib/ingredient-identity.mjs';
import {
  assertArtifactProvenance,
  loadSourceManifest,
} from '../lib/interaction-source-policy.mjs';
import { scanProductQueries } from '../lib/product-resolver.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_ARTIFACT = path.join(ROOT, 'dist', 'latest', 'drugs.jsonl');
const DEFAULT_RULES = path.join(ROOT, 'data-static', 'interaction-rules.json');

function requireValue(args, index, flag) {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseArgs(args) {
  const options = {
    profile: null,
    artifactPath: DEFAULT_ARTIFACT,
    rulesPath: DEFAULT_RULES,
    queries: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--profile') {
      options.profile = requireValue(args, index, flag);
      index += 1;
    } else if (flag === '--artifact') {
      options.artifactPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--rules') {
      options.rulesPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--drug') {
      options.queries.push(parseDrugQuery(requireValue(args, index, flag)));
      index += 1;
    } else {
      throw new Error(`unknown argument ${flag}`);
    }
  }

  if (!options.profile) throw new Error('--profile is required');
  if (!['production-open', 'internal-evaluation'].includes(options.profile)) {
    throw new Error(`unsupported --profile ${options.profile}`);
  }
  if (options.queries.length < 2) throw new Error('at least two --drug inputs are required');
  return options;
}

function parseDrugQuery(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`invalid --drug JSON: ${error.message}`);
  }
}

function storagePath(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

async function readJson(file, label) {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${label} at ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid ${label} JSON at ${file}: ${error.message}`);
  }
}

function artifactSummaryProvenance(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    throw new Error('artifact summary must be an object');
  }
  if (!summary.sources || typeof summary.sources !== 'object' || Array.isArray(summary.sources)) {
    throw new Error('artifact summary requires source provenance');
  }
  if (!Number.isSafeInteger(summary.total_rows) || summary.total_rows < 0) {
    throw new Error('artifact summary total_rows must be a non-negative integer');
  }
  const sourceCounts = {};
  for (const [sourceId, count] of Object.entries(summary.sources)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`artifact summary source count for ${sourceId} must be a non-negative integer`);
    }
    if (count > 0) sourceCounts[sourceId] = count;
  }
  const sourceIds = Object.keys(sourceCounts).sort();
  if (sourceIds.length === 0) throw new Error('artifact summary has no non-empty sources');
  return { rowCount: summary.total_rows, sourceCounts, sourceIds };
}

function assertSummaryMatchesRows(summaryProvenance, observedProvenance) {
  if (summaryProvenance.rowCount !== observedProvenance.row_count) {
    throw new Error(
      `artifact row count does not match summary total_rows: expected ${summaryProvenance.rowCount}, observed ${observedProvenance.row_count}`,
    );
  }
  const observedIds = Object.keys(observedProvenance.source_counts).sort();
  for (const sourceId of observedIds) {
    const declaredCount = summaryProvenance.sourceCounts[sourceId];
    if (declaredCount === undefined) {
      throw new Error(`artifact row provenance source ${sourceId} is absent from summary`);
    }
    if (observedProvenance.source_counts[sourceId] > declaredCount) {
      throw new Error(`artifact row provenance count for ${sourceId} exceeds summary count`);
    }
  }
  for (const sourceId of summaryProvenance.sourceIds) {
    if (observedProvenance.source_counts[sourceId] === undefined) {
      throw new Error(`artifact summary source ${sourceId} is absent from row provenance`);
    }
  }
  return observedIds;
}

function mappedIngredient(ingredient) {
  const identity = createIngredientIdentity(ingredient);
  if (identity.precision === 'observed') {
    return { ...ingredient, ...identity, mapping_status: 'exact' };
  }
  return {
    ...ingredient,
    ...identity,
    mapping_status: 'unmapped',
    error: 'catalogue_normalized_fallback_requires_review',
  };
}

function attachIngredientMappings(records) {
  return records.map((record) => {
    if (record.status !== 'resolved') return record;
    if (!Array.isArray(record.product.ingredients)) {
      throw new Error(`resolved product ${record.product.product_id} has no ingredient array`);
    }
    return {
      ...record,
      product: {
        ...record.product,
        ingredients: record.product.ingredients.map(mappedIngredient),
      },
    };
  });
}

function assertRulePackProfile(runtimeProfile, rulePack) {
  if (runtimeProfile === 'production-open' && rulePack.profile !== 'production-open') {
    throw new Error('production-open cannot load an internal-evaluation rule pack');
  }
}

export async function runInteractionCheck(options) {
  const manifest = loadSourceManifest();
  const summaryPath = path.join(path.dirname(options.artifactPath), 'summary.json');
  const summary = await readJson(summaryPath, 'artifact summary');
  const summaryProvenance = artifactSummaryProvenance(summary);
  assertArtifactProvenance(manifest, {
    sourceIds: summaryProvenance.sourceIds,
    profile: options.profile,
    use: 'product-resolution',
    storagePath: storagePath(options.artifactPath),
  });

  const rulePack = await readJson(options.rulesPath, 'interaction rule pack');
  validateRulePack(rulePack);
  assertRulePackProfile(options.profile, rulePack);
  assertArtifactProvenance(manifest, {
    sourceIds: rulePack.source_ids,
    profile: rulePack.profile,
    use: 'interaction-rules',
    storagePath: storagePath(options.rulesPath),
    licenceNotices: rulePack.licence_notices ?? {},
  });

  const scan = await scanProductQueries({
    artifactPath: options.artifactPath,
    queries: options.queries,
  });
  const observedSourceIds = assertSummaryMatchesRows(summaryProvenance, scan.provenance);
  assertArtifactProvenance(manifest, {
    sourceIds: observedSourceIds,
    profile: options.profile,
    use: 'product-resolution',
    storagePath: storagePath(options.artifactPath),
  });
  return checkResolvedProducts({
    resolvedInputs: attachIngredientMappings(scan.results),
    rulePack,
  });
}

export async function main(args = process.argv.slice(2)) {
  const result = await runInteractionCheck(parseArgs(args));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
