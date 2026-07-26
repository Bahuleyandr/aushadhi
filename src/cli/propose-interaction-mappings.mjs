import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  readStrictJsonl,
} from '../lib/ingredient-index.mjs';
import {
  assertArtifactProvenance,
  loadSourceManifest,
} from '../lib/interaction-source-policy.mjs';
import {
  createRxNormClient,
  proposeRxNormIngredientMapping,
} from '../lib/rxnorm-mapping.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_INDEX = path.join(
  ROOT,
  'data',
  'interaction',
  'internal-evaluation',
  'ingredient-index.jsonl',
);

function requireValue(args, index, flag) {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function parseLimit(value) {
  if (!/^[1-9][0-9]*$/u.test(value)) throw new Error('--limit must be a positive integer');
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit > 100) {
    throw new Error('--limit must be between 1 and 100');
  }
  return limit;
}

export function parseArgs(args) {
  const options = {
    profile: null,
    ingredientNames: [],
    ingredientIndexPath: null,
    outputPath: null,
    cacheDir: null,
    limit: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--profile') {
      options.profile = requireValue(args, index, flag);
      index += 1;
    } else if (flag === '--ingredient') {
      options.ingredientNames.push(requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--ingredient-index') {
      options.ingredientIndexPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--output') {
      options.outputPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--cache') {
      options.cacheDir = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--limit') {
      options.limit = parseLimit(requireValue(args, index, flag));
      index += 1;
    } else {
      throw new Error(`unknown argument ${flag}`);
    }
  }
  if (!['production-open', 'internal-evaluation'].includes(options.profile)) {
    throw new Error('--profile must be production-open or internal-evaluation');
  }
  if (options.ingredientNames.length > 0 && options.ingredientIndexPath !== null) {
    throw new Error('use either --ingredient inputs or --ingredient-index, not both');
  }
  if (options.ingredientNames.length === 0 && options.ingredientIndexPath === null) {
    throw new Error('at least one --ingredient or --ingredient-index is required');
  }
  if (options.ingredientIndexPath !== null && options.limit === null) {
    throw new Error('--ingredient-index requires an explicit --limit');
  }
  if (options.ingredientIndexPath === null && options.limit !== null) {
    throw new Error('--limit is only valid with --ingredient-index');
  }
  const profileRoot = path.join(ROOT, 'data', 'interaction', options.profile);
  options.outputPath ??= path.join(profileRoot, 'rxnorm-mappings.jsonl');
  options.cacheDir ??= path.join(profileRoot, 'cache', 'rxnorm');
  return options;
}

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function indexMetadataPath(indexPath) {
  if (!indexPath.endsWith('.jsonl')) {
    throw new Error('--ingredient-index must name a .jsonl file');
  }
  return indexPath.replace(/\.jsonl$/u, '.meta.json');
}

async function loadIngredientIndexMetadata(options, sourceManifest) {
  const metadataFile = indexMetadataPath(options.ingredientIndexPath);
  let metadata;
  try {
    metadata = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read ingredient index metadata at ${metadataFile}: ${error.message}`, {
      cause: error,
    });
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('ingredient index metadata must be an object');
  }
  if (metadata.profile !== options.profile) {
    throw new Error(
      `ingredient index profile ${metadata.profile ?? '<missing>'} does not match ${options.profile}`,
    );
  }
  if (!Number.isSafeInteger(metadata.ingredient_count) || metadata.ingredient_count < 1) {
    throw new Error('ingredient index metadata ingredient_count must be a positive integer');
  }
  if (!metadata.source_counts
      || typeof metadata.source_counts !== 'object'
      || Array.isArray(metadata.source_counts)) {
    throw new Error('ingredient index metadata requires source_counts');
  }
  const sourceIds = Object.entries(metadata.source_counts).map(([sourceId, count]) => {
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error(`ingredient index metadata source count for ${sourceId} is invalid`);
    }
    return sourceId;
  });
  if (sourceIds.length === 0) throw new Error('ingredient index metadata has no sources');
  assertArtifactProvenance(sourceManifest, {
    sourceIds,
    profile: options.profile,
    use: 'ingredient-index',
    storagePath: storagePath(options.ingredientIndexPath),
  });
  return metadata;
}

async function loadIngredientInputs(options, sourceManifest) {
  if (options.ingredientNames.length > 0) {
    const inputs = [...new Set(options.ingredientNames.map((value) => value.normalize('NFKC').trim())
      .filter(Boolean))]
      .sort(compareCodePoint)
      .map((observed_name) => ({ observed_name }));
    if (inputs.length === 0) throw new Error('ingredient input is empty');
    return inputs;
  }
  const metadata = await loadIngredientIndexMetadata(options, sourceManifest);
  const inputs = [];
  let rowCount = 0;
  for await (const row of readStrictJsonl(options.ingredientIndexPath ?? DEFAULT_INDEX)) {
    rowCount += 1;
    if (typeof row.canonical_name !== 'string' || row.canonical_name.trim() === '') {
      throw new Error('ingredient index row requires canonical_name');
    }
    if (inputs.length < options.limit) inputs.push({ observed_name: row.canonical_name });
  }
  if (rowCount !== metadata.ingredient_count) {
    throw new Error(
      `ingredient index row count does not match metadata: expected ${metadata.ingredient_count}, observed ${rowCount}`,
    );
  }
  if (inputs.length === 0) throw new Error('ingredient input is empty');
  return inputs;
}

function storagePath(file) {
  const relative = path.relative(ROOT, file).replaceAll(path.sep, '/');
  if (relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('mapping output must stay inside the repository');
  }
  return relative;
}

async function writeJsonlAtomically(file, rows) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.tmp-${process.pid}-${randomUUID()}`,
  );
  try {
    await fs.writeFile(
      temporary,
      rows.map((row) => JSON.stringify(row)).join('\n').concat('\n'),
      { encoding: 'utf8', flag: 'wx' },
    );
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function buildMappingCandidates(options, {
  client = createRxNormClient({ cacheDir: options.cacheDir }),
  retrievedAt = new Date().toISOString().slice(0, 10),
} = {}) {
  const manifest = loadSourceManifest();
  assertArtifactProvenance(manifest, {
    sourceIds: ['rxnorm'],
    profile: options.profile,
    use: 'identity',
    storagePath: storagePath(options.outputPath),
  });
  const inputs = await loadIngredientInputs(options, manifest);
  const candidates = [];
  for (const ingredient of inputs) {
    candidates.push(await proposeRxNormIngredientMapping({
      ingredient,
      client,
      retrievedAt,
    }));
  }
  await writeJsonlAtomically(options.outputPath, candidates);
  return {
    output_path: options.outputPath,
    candidate_count: candidates.length,
    exact_single_candidate_count: candidates.filter(
      (entry) => entry.search.status === 'exact_single_candidate',
    ).length,
    accepted_mapping_count: 0,
  };
}

export async function main(args = process.argv.slice(2)) {
  const result = await buildMappingCandidates(parseArgs(args));
  process.stderr.write(
    `Wrote ${result.candidate_count} review candidate(s); accepted mappings: 0; ${result.output_path}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
