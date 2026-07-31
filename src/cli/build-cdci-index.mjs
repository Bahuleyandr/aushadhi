import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_CONFIG = path.join(ROOT, 'data-static', 'cdci-release.internal-evaluation.json');

function requireValue(args, index, flag) {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function resolveInsideRepository(value, flag) {
  const resolved = path.resolve(ROOT, value);
  const relative = path.relative(ROOT, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${flag} must stay inside the repository`);
  }
  return resolved;
}

export function parseArgs(args) {
  let profile = null;
  let configPath = DEFAULT_CONFIG;
  let configSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--profile') {
      if (profile !== null) throw new Error('--profile can be provided only once');
      profile = requireValue(args, index, flag);
      index += 1;
    } else if (flag === '--config') {
      if (configSeen) throw new Error('--config can be provided only once');
      configPath = resolveInsideRepository(requireValue(args, index, flag), flag);
      configSeen = true;
      index += 1;
    } else {
      throw new Error(`unknown argument ${flag}`);
    }
  }

  if (profile === null) throw new Error('--profile is required');
  if (profile !== 'internal-evaluation') {
    throw new Error('CDCI indexing supports only internal-evaluation');
  }
  return { profile, configPath };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const { buildCdciIdentityIndex } = await import('../lib/cdci-index.mjs');
  const result = await buildCdciIdentityIndex({
    root: ROOT,
    configPath: options.configPath,
    expectedProfile: options.profile,
  });
  process.stderr.write([
    `Wrote ${result.summary.counts.identity_count} CDCI identity candidate(s)`,
    `${result.summary.counts.quarantined_count} quarantined concept(s)`,
    result.summary_output_path,
  ].join('; ').concat('\n'));
  return result;
}

export function isDirectInvocation(scriptPath = process.argv[1]) {
  if (typeof scriptPath !== 'string' || scriptPath.length === 0) return false;
  try {
    return fs.realpathSync(scriptPath) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
