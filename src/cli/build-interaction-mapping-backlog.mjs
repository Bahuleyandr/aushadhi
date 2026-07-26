import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildInteractionMappingBacklogFromFiles } from '../lib/interaction-mapping-backlog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_ARTIFACT = path.join(ROOT, 'dist', 'latest', 'drugs.jsonl');
const DEFAULT_RULES = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'batch-01-v2.jsonl',
);
const DEFAULT_MEMBER_SETS = path.join(ROOT, 'data-static', 'interaction-member-sets.json');

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

export function parseArgs(args) {
  const options = {
    profile: null,
    artifactPath: DEFAULT_ARTIFACT,
    artifactSummaryPath: null,
    rulesPath: DEFAULT_RULES,
    memberSetsPath: DEFAULT_MEMBER_SETS,
    outputDir: null,
  };
  let artifactSummaryExplicit = false;

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--profile') {
      options.profile = requireValue(args, index, flag);
      index += 1;
    } else if (flag === '--artifact') {
      options.artifactPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--artifact-summary') {
      options.artifactSummaryPath = path.resolve(ROOT, requireValue(args, index, flag));
      artifactSummaryExplicit = true;
      index += 1;
    } else if (flag === '--rules') {
      options.rulesPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--member-sets') {
      options.memberSetsPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--output-dir') {
      options.outputDir = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else {
      throw new Error(`unknown argument ${flag}`);
    }
  }

  if (!options.profile) throw new Error('--profile is required');
  if (!['production-open', 'internal-evaluation'].includes(options.profile)) {
    throw new Error(`unsupported --profile ${options.profile}`);
  }
  if (!artifactSummaryExplicit) {
    options.artifactSummaryPath = path.join(path.dirname(options.artifactPath), 'summary.json');
  }
  options.outputDir ??= path.join(
    ROOT,
    'data',
    'interaction',
    options.profile,
    'mapping-backlog',
  );
  return options;
}

export async function buildMappingBacklog(options) {
  const ingredientOutputPath = path.join(options.outputDir, 'ingredient-assertions.jsonl');
  const productOutputPath = path.join(options.outputDir, 'product-presentations.jsonl');
  const summaryOutputPath = path.join(options.outputDir, 'summary.json');
  return buildInteractionMappingBacklogFromFiles({
    profile: options.profile,
    rulesPath: options.rulesPath,
    rulesStoragePath: storagePath(options.rulesPath),
    memberSetsPath: options.memberSetsPath,
    memberSetsStoragePath: storagePath(options.memberSetsPath),
    artifactPath: options.artifactPath,
    artifactSummaryPath: options.artifactSummaryPath,
    artifactSummaryStoragePath: storagePath(options.artifactSummaryPath),
    artifactStoragePath: storagePath(options.artifactPath),
    ingredientOutputPath,
    productOutputPath,
    summaryOutputPath,
    outputStoragePath: storagePath(options.outputDir),
  });
}

export async function main(args = process.argv.slice(2)) {
  const result = await buildMappingBacklog(parseArgs(args));
  const counts = result.summary.counts;
  process.stderr.write(
    [
      `Wrote ${counts.rule_ingredient_assertion_count} ingredient assertion candidate(s)`,
      `${counts.product_assertion_candidate_count} product presentation candidate(s)`,
      `${counts.catalog_unmatched_ingredient_assertion_count} unmatched ingredient assertion(s)`,
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
