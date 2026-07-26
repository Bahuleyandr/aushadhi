import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildInteractionCatalogueFromFiles } from '../lib/interaction-catalogue-filter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_ARTIFACT = path.join(ROOT, 'dist', 'latest', 'drugs.jsonl');

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
    'product-catalogue',
  );
  return options;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const outputPath = path.join(options.outputDir, 'drugs.jsonl');
  const outputSummaryPath = path.join(options.outputDir, 'summary.json');
  const result = await buildInteractionCatalogueFromFiles({
    profile: options.profile,
    artifactPath: options.artifactPath,
    artifactStoragePath: storagePath(options.artifactPath),
    artifactSummaryPath: options.artifactSummaryPath,
    artifactSummaryStoragePath: storagePath(options.artifactSummaryPath),
    outputPath,
    outputStoragePath: storagePath(outputPath),
    outputSummaryPath,
    outputSummaryStoragePath: storagePath(outputSummaryPath),
  });
  process.stderr.write(
    [
      `Wrote ${result.summary.total_rows} policy-compatible product row(s)`,
      `${result.summary.exclusions.row_count} excluded row(s)`,
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
