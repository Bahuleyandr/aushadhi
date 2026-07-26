import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildInteractionMappingPilotFromFiles } from '../lib/interaction-mapping-pilot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function requireValue(args, index, flag) {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function storagePath(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function pilotSlug(ruleIds, sourceOnly) {
  const rules = [...new Set(ruleIds)].sort().join('--');
  const source = sourceOnly === null ? '' : `--source-${sourceOnly}`;
  const slug = `${rules}${source}`.replaceAll(/[^a-zA-Z0-9_-]+/g, '-');
  if (!slug || slug === '-') throw new Error('rule IDs cannot produce an empty pilot name');
  return slug;
}

export function parseArgs(args) {
  const options = {
    profile: null,
    backlogDir: null,
    outputDir: null,
    ruleIds: [],
    sourceOnly: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--profile') {
      options.profile = requireValue(args, index, flag);
      index += 1;
    } else if (flag === '--backlog-dir') {
      options.backlogDir = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--output-dir') {
      options.outputDir = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--rule-id') {
      options.ruleIds.push(requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--source-only') {
      if (options.sourceOnly !== null) {
        throw new Error('--source-only can be provided only once');
      }
      options.sourceOnly = requireValue(args, index, flag);
      index += 1;
    } else {
      throw new Error(`unknown argument ${flag}`);
    }
  }

  if (!options.profile) throw new Error('--profile is required');
  if (!['production-open', 'internal-evaluation'].includes(options.profile)) {
    throw new Error(`unsupported --profile ${options.profile}`);
  }
  if (options.ruleIds.length === 0) throw new Error('--rule-id is required');
  options.backlogDir ??= path.join(
    ROOT,
    'data',
    'interaction',
    options.profile,
    'mapping-backlog',
  );
  options.outputDir ??= path.join(
    ROOT,
    'data',
    'interaction',
    options.profile,
    'mapping-pilots',
    pilotSlug(options.ruleIds, options.sourceOnly),
  );
  return options;
}

export async function buildMappingPilot(options) {
  return buildInteractionMappingPilotFromFiles({
    profile: options.profile,
    ingredientInputPath: path.join(options.backlogDir, 'ingredient-assertions.jsonl'),
    productInputPath: path.join(options.backlogDir, 'product-presentations.jsonl'),
    summaryInputPath: path.join(options.backlogDir, 'summary.json'),
    inputStoragePath: storagePath(options.backlogDir),
    outputDir: options.outputDir,
    outputStoragePath: storagePath(options.outputDir),
    ruleIds: options.ruleIds,
    sourceOnly: options.sourceOnly,
  });
}

export async function main(args = process.argv.slice(2)) {
  const result = await buildMappingPilot(parseArgs(args));
  const counts = result.summary.counts;
  process.stderr.write(
    [
      `Wrote ${counts.ingredient_assertion_count} ingredient assertion candidate(s)`,
      `${counts.product_assertion_candidate_count} product presentation candidate(s)`,
      'accepted mappings: 0',
      result.summary_output_path,
    ].join('; ').concat('\n'),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
