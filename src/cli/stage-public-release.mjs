#!/usr/bin/env node

// Stages a public (production-open) release of drugs.jsonl behind the
// fail-closed licensing gate, or verifies a candidate artifact with --check.
//
//   node src/cli/stage-public-release.mjs --input dist/<gen>/drugs.jsonl --output dist/public-release
//   node src/cli/stage-public-release.mjs --check <path to drugs.jsonl>
//
// Only rows whose every source is cleared for production-open by
// data-static/interaction-sources.json are written; everything excluded is
// tallied per source with a reason in public-release-manifest.json.
// See docs/PUBLIC_RELEASE_GATE.md.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_RELEASE_PROFILE,
  UNLISTED_SOURCE_REASON,
  classifyPublicReleaseSources,
  evaluateRowSources,
  loadSourceManifest,
} from '../lib/public-release-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_MANIFEST_PATH = path.join(ROOT, 'data-static', 'interaction-sources.json');
const RELEASE_MANIFEST_NAME = 'public-release-manifest.json';
const STAGE_KIND = 'aushadhi-public-release';

function fail(message) {
  throw new Error(`public release gate: ${message}`);
}

function parseArgs(argv) {
  const options = { input: null, output: null, manifest: null, check: null };
  const takesValue = new Set(['--input', '--output', '--manifest', '--check']);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equals = argument.indexOf('=');
    const flag = argument.startsWith('--') && equals > 0 ? argument.slice(0, equals) : argument;
    if (!takesValue.has(flag)) fail(`unknown argument ${argument}`);
    const key = flag.slice(2);
    let value;
    if (equals > 0) {
      value = argument.slice(equals + 1);
    } else {
      value = argv[index + 1];
      index += 1;
    }
    if (options[key] !== null) fail(`${flag} may only be provided once`);
    if (!value || value.startsWith('--')) fail(`${flag} requires a path`);
    options[key] = value;
  }

  if (options.check !== null) {
    if (options.input !== null || options.output !== null) {
      fail('--check verifies an existing artifact; omit --input and --output');
    }
  } else {
    if (options.input === null) fail('--input is required to stage a release');
    if (options.output === null) fail('--output is required to stage a release');
  }
  return options;
}

function requireReadableFile(file, label) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    fail(`${label} ${file} does not exist`);
  }
  if (!stat.isFile()) fail(`${label} ${file} is not a regular file`);
}

function loadGate(manifestPath) {
  const resolved = path.resolve(manifestPath);
  requireReadableFile(resolved, 'source manifest');
  const manifest = loadSourceManifest(resolved);
  const { cleared, excluded } = classifyPublicReleaseSources(manifest);
  const sha256 = createHash('sha256').update(fs.readFileSync(resolved)).digest('hex');
  return {
    manifestPath: resolved,
    policyReviewedAt: manifest.policy_reviewed_at,
    manifestSha256: sha256,
    cleared,
    excluded,
  };
}

// Streams the input line-by-line (never buffers the artifact) and evaluates
// every row against the cleared-source set. Corrupt lines are hard failures.
async function scanInput(inputPath, cleared, onIncludedLine) {
  const stats = {
    rowsRead: 0,
    rowsIncluded: 0,
    rowsExcluded: 0,
    includedSourceRows: new Map(),
    excludedSourceRows: new Map(),
  };
  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath),
    crlfDelay: Infinity,
  });
  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      fail(`input line ${lineNumber} is not valid JSON; the export is corrupt`);
    }
    let verdict;
    try {
      verdict = evaluateRowSources(row, cleared);
    } catch (error) {
      throw new Error(`${error.message} (input line ${lineNumber})`);
    }
    stats.rowsRead += 1;
    if (verdict.include) {
      stats.rowsIncluded += 1;
      const seen = new Set();
      for (const entry of row.sources) seen.add(entry.source);
      for (const sourceId of seen) {
        stats.includedSourceRows.set(sourceId, (stats.includedSourceRows.get(sourceId) ?? 0) + 1);
      }
      if (onIncludedLine) await onIncludedLine(line);
    } else {
      stats.rowsExcluded += 1;
      for (const sourceId of verdict.excluded_source_ids) {
        stats.excludedSourceRows.set(sourceId, (stats.excludedSourceRows.get(sourceId) ?? 0) + 1);
      }
    }
  }
  return stats;
}

function createLineWriter(file) {
  const stream = fs.createWriteStream(file, { flags: 'wx' });
  const hash = createHash('sha256');
  let bytes = 0;
  return {
    async write(line) {
      const chunk = Buffer.from(`${line}\n`, 'utf8');
      hash.update(chunk);
      bytes += chunk.length;
      if (!stream.write(chunk)) await once(stream, 'drain');
    },
    async close() {
      stream.end();
      await finished(stream);
      return { sha256: hash.digest('hex'), size_bytes: bytes };
    },
  };
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative.length > 0
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function prospectiveRealPath(target) {
  const suffix = [];
  let existing = target;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) fail(`cannot resolve output path ${target}`);
    suffix.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(fs.realpathSync(existing), ...suffix);
}

function assertSafeOutputPath(output) {
  const repository = fs.realpathSync(ROOT);
  const dist = path.join(repository, 'dist');
  for (const candidate of [output, prospectiveRealPath(output)]) {
    const resolved = path.resolve(candidate);
    if ((resolved === repository || isInside(repository, resolved)) && !isInside(dist, resolved)) {
      fail(`repository output must be a child of ${dist}`);
    }
  }
}

function assertReplaceableOutput(output) {
  if (!fs.existsSync(output)) return;
  const stat = fs.lstatSync(output);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail(`refusing to replace non-directory or symbolic-link output ${output}`);
  }
  let existingManifest;
  try {
    existingManifest = JSON.parse(fs.readFileSync(path.join(output, RELEASE_MANIFEST_NAME), 'utf8'));
  } catch {
    fail(`refusing to replace unrecognized output directory ${output}`);
  }
  if (existingManifest?.stage_kind !== STAGE_KIND) {
    fail(`refusing to replace unrecognized output directory ${output}`);
  }
}

function publishStage(staging, output) {
  assertReplaceableOutput(output);
  if (!fs.existsSync(output)) {
    fs.renameSync(staging, output);
    return;
  }
  const backup = `${output}.replaced-${randomUUID()}`;
  fs.renameSync(output, backup);
  try {
    fs.renameSync(staging, output);
    fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(output) && fs.existsSync(backup)) fs.renameSync(backup, output);
    throw error;
  }
}

function sortedObject(map) {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

function releaseManifest(gate, stats, artifact) {
  const includedSources = new Map();
  for (const [sourceId, rows] of stats.includedSourceRows) {
    includedSources.set(sourceId, { rows, ...gate.cleared.get(sourceId) });
  }
  const excludedSources = new Map();
  for (const [sourceId, rowsExcluded] of stats.excludedSourceRows) {
    const known = gate.excluded.get(sourceId);
    excludedSources.set(sourceId, {
      rows_excluded: rowsExcluded,
      reason: known?.reason ?? UNLISTED_SOURCE_REASON,
      ...(known === undefined
        ? {}
        : { licence_id: known.licence_id, licence_class: known.licence_class }),
    });
  }
  return {
    schema_version: 1,
    stage_kind: STAGE_KIND,
    generated_at_utc: new Date().toISOString(),
    profile: PUBLIC_RELEASE_PROFILE,
    redistributable: true,
    source_manifest: {
      path: gate.manifestPath,
      policy_reviewed_at: gate.policyReviewedAt,
      sha256: gate.manifestSha256,
    },
    rows_read: stats.rowsRead,
    rows_included: stats.rowsIncluded,
    rows_excluded: stats.rowsExcluded,
    included_sources: sortedObject(includedSources),
    excluded_sources: sortedObject(excludedSources),
    artifact_source: {
      path: 'drugs.jsonl',
      format: 'jsonl',
      record_count: stats.rowsIncluded,
      size_bytes: artifact.size_bytes,
      sha256: artifact.sha256,
    },
  };
}

async function stageRelease(gate, inputPath, output) {
  const resolvedInput = path.resolve(inputPath);
  requireReadableFile(resolvedInput, 'input');
  const resolvedOutput = path.resolve(output);
  const protectedPaths = [ROOT, path.join(ROOT, 'data-static'), gate.manifestPath, resolvedInput]
    .map((entry) => path.resolve(entry).toLowerCase());
  if (protectedPaths.includes(resolvedOutput.toLowerCase())) {
    fail(`refusing to stage over protected path ${resolvedOutput}`);
  }
  assertSafeOutputPath(resolvedOutput);
  assertReplaceableOutput(resolvedOutput);

  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  const staging = `${resolvedOutput}.staging-${randomUUID()}`;
  fs.mkdirSync(staging);
  try {
    const writer = createLineWriter(path.join(staging, 'drugs.jsonl'));
    const stats = await scanInput(resolvedInput, gate.cleared, (line) => writer.write(line));
    const artifact = await writer.close();
    if (stats.rowsIncluded === 0) {
      fail('no rows from cleared sources; refusing to stage an empty public release');
    }
    fs.writeFileSync(
      path.join(staging, RELEASE_MANIFEST_NAME),
      `${JSON.stringify(releaseManifest(gate, stats, artifact), null, 2)}\n`,
      'utf8',
    );
    publishStage(staging, resolvedOutput);
    return { output: resolvedOutput, stats };
  } finally {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  }
}

async function checkRelease(gate, inputPath) {
  const resolvedInput = path.resolve(inputPath);
  requireReadableFile(resolvedInput, 'input');
  const stats = await scanInput(resolvedInput, gate.cleared);
  if (stats.rowsExcluded > 0) {
    for (const [sourceId, rows] of [...stats.excludedSourceRows.entries()].sort()) {
      const reason = gate.excluded.get(sourceId)?.reason ?? UNLISTED_SOURCE_REASON;
      process.stderr.write(
        `public release gate: ${rows} row(s) reference non-cleared source "${sourceId}": ${reason}\n`,
      );
    }
    process.stderr.write(
      `public release check failed: ${stats.rowsExcluded} of ${stats.rowsRead} rows reference non-cleared sources\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `public release check passed: ${stats.rowsRead} rows, every source cleared for ${PUBLIC_RELEASE_PROFILE} (${resolvedInput})\n`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const gate = loadGate(options.manifest ?? DEFAULT_MANIFEST_PATH);
  if (options.check !== null) {
    await checkRelease(gate, options.check);
    return;
  }
  const { output, stats } = await stageRelease(gate, options.input, options.output);
  process.stdout.write(
    `staged public release at ${output} `
    + `(${stats.rowsIncluded} of ${stats.rowsRead} rows included, ${stats.rowsExcluded} excluded)\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
