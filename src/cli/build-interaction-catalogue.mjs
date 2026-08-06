import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildInteractionCatalogueFromFiles } from '../lib/interaction-catalogue-filter.mjs';
import { resolvePublishedCohort } from '../lib/build-cohort.mjs';

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

function publishedStoragePath(distRoot, file) {
  const relative = path.relative(distRoot, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`published cohort artifact is outside its dist root: ${file}`);
  }
  return path.posix.join('dist', relative.replaceAll(path.sep, '/'));
}

export function parseArgs(args) {
  const options = {
    profile: null,
    artifactPath: null,
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
  if (artifactSummaryExplicit && options.artifactPath === null) {
    throw new Error('--artifact-summary requires --artifact');
  }
  if (!artifactSummaryExplicit && options.artifactPath !== null) {
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
  let artifactStoragePath;
  let artifactSummaryStoragePath;
  if (options.artifactPath === null) {
    const distRoot = path.resolve(process.env.AUSHADHI_DIST_ROOT ?? path.join(ROOT, 'dist'));
    const published = await resolvePublishedCohort({
      distRoot,
      verifyFiles: ['drugs.jsonl', 'summary.json'],
    });
    options.artifactPath = path.join(published.dir, 'drugs.jsonl');
    options.artifactSummaryPath ??= path.join(published.dir, 'summary.json');
    artifactStoragePath = publishedStoragePath(distRoot, options.artifactPath);
    artifactSummaryStoragePath = publishedStoragePath(distRoot, options.artifactSummaryPath);
  } else {
    artifactStoragePath = storagePath(options.artifactPath);
    artifactSummaryStoragePath = storagePath(options.artifactSummaryPath);
  }
  const outputPath = path.join(options.outputDir, 'drugs.jsonl');
  const outputSummaryPath = path.join(options.outputDir, 'summary.json');
  const result = await buildInteractionCatalogueFromFiles({
    profile: options.profile,
    artifactPath: options.artifactPath,
    artifactStoragePath,
    artifactSummaryPath: options.artifactSummaryPath,
    artifactSummaryStoragePath,
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
