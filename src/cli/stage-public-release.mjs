#!/usr/bin/env node

// Stages a production-open catalogue candidate behind the fail-closed source
// policy gate, or verifies a complete candidate directory with --check.
//
//   node src/cli/stage-public-release.mjs --input dist/<gen>/drugs.jsonl --output dist/public-release/<candidate-id>
//   node src/cli/stage-public-release.mjs --check dist/public-release/<candidate-id>
//
// Only rows whose every source is technically eligible for production-open by
// data-static/interaction-sources.json are written; everything excluded is
// tallied per source with a reason in public-release-manifest.json.
// This is not publication or deployment authority. See docs/PUBLIC_RELEASE_GATE.md.

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
  const options = { input: null, output: null, check: null };
  const takesValue = new Set(['--input', '--output', '--check']);
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

function loadGate() {
  const resolved = path.resolve(DEFAULT_MANIFEST_PATH);
  requireReadableFile(resolved, 'source manifest');
  const manifest = loadSourceManifest(resolved);
  const { cleared, excluded } = classifyPublicReleaseSources(manifest);
  const sha256 = createHash('sha256').update(fs.readFileSync(resolved)).digest('hex');
  return {
    manifestPath: resolved,
    manifestRelativePath: path.relative(ROOT, resolved).replaceAll(path.sep, '/'),
    policyReviewedAt: manifest.policy_reviewed_at,
    manifestSha256: sha256,
    cleared,
    excluded,
  };
}

async function hashFile(file) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of fs.createReadStream(file)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: hash.digest('hex'), size_bytes: bytes };
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

function assertOutputAbsent(output) {
  if (fs.existsSync(output)) {
    fail(`refusing to replace existing output ${output}; public release stages are immutable`);
  }
}

function publishStage(staging, output) {
  assertOutputAbsent(output);
  fs.renameSync(staging, output);
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
    release_authority: 'none',
    deployment_authority: 'none',
    source_manifest: {
      path: gate.manifestRelativePath,
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
  assertOutputAbsent(resolvedOutput);

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

function requireExactKeys(value, expectedKeys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} has unexpected keys`);
  }
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} must be a non-negative integer`);
}

function readReleaseManifest(directory) {
  const file = path.join(directory, RELEASE_MANIFEST_NAME);
  requireReadableFile(file, 'release manifest');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    fail('release manifest is not valid JSON');
  }
  requireExactKeys(manifest, [
    'schema_version', 'stage_kind', 'generated_at_utc', 'profile', 'redistributable',
    'release_authority', 'deployment_authority', 'source_manifest', 'rows_read',
    'rows_included', 'rows_excluded', 'included_sources', 'excluded_sources',
    'artifact_source',
  ], 'release manifest');
  requireExactKeys(
    manifest.source_manifest,
    ['path', 'policy_reviewed_at', 'sha256'],
    'release manifest source_manifest',
  );
  requireExactKeys(
    manifest.artifact_source,
    ['path', 'format', 'record_count', 'size_bytes', 'sha256'],
    'release manifest artifact_source',
  );
  return manifest;
}

function requireReleaseDirectory(directory) {
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch {
    fail(`release directory ${directory} does not exist`);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail(`release directory ${directory} is not a regular directory`);
  }
  const expected = new Set(['drugs.jsonl', RELEASE_MANIFEST_NAME]);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!expected.has(entry.name)) fail(`unexpected package file ${entry.name}`);
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail(`package entry ${entry.name} is not a regular file`);
    }
    expected.delete(entry.name);
  }
  if (expected.size > 0) fail(`package is missing ${[...expected].join(', ')}`);
}

function expectedIncludedSources(gate, stats) {
  const includedSources = new Map();
  for (const [sourceId, rows] of stats.includedSourceRows) {
    includedSources.set(sourceId, { rows, ...gate.cleared.get(sourceId) });
  }
  return sortedObject(includedSources);
}

async function checkRelease(gate, releaseDirectory) {
  const resolvedDirectory = path.resolve(releaseDirectory);
  requireReleaseDirectory(resolvedDirectory);
  const manifest = readReleaseManifest(resolvedDirectory);
  if (manifest.schema_version !== 1
    || manifest.stage_kind !== STAGE_KIND
    || manifest.profile !== PUBLIC_RELEASE_PROFILE
    || manifest.redistributable !== true
    || manifest.release_authority !== 'none'
    || manifest.deployment_authority !== 'none') {
    fail('release manifest does not declare the required public-release profile');
  }
  if (typeof manifest.generated_at_utc !== 'string'
    || !Number.isFinite(Date.parse(manifest.generated_at_utc))) {
    fail('release manifest generated_at_utc is invalid');
  }
  if (manifest.source_manifest.path !== gate.manifestRelativePath
    || manifest.source_manifest.policy_reviewed_at !== gate.policyReviewedAt
    || manifest.source_manifest.sha256 !== gate.manifestSha256) {
    fail('release manifest is not bound to the committed source policy');
  }
  for (const field of ['rows_read', 'rows_included', 'rows_excluded']) {
    requireNonNegativeInteger(manifest[field], `release manifest ${field}`);
  }
  if (manifest.rows_read !== manifest.rows_included + manifest.rows_excluded) {
    fail('release manifest row totals are inconsistent');
  }
  if (manifest.artifact_source.path !== 'drugs.jsonl'
    || manifest.artifact_source.format !== 'jsonl') {
    fail('release manifest artifact identity is invalid');
  }
  for (const field of ['record_count', 'size_bytes']) {
    requireNonNegativeInteger(manifest.artifact_source[field], `artifact_source ${field}`);
  }
  if (typeof manifest.artifact_source.sha256 !== 'string'
    || !/^[0-9a-f]{64}$/u.test(manifest.artifact_source.sha256)) {
    fail('artifact_source sha256 is invalid');
  }

  const inputPath = path.join(resolvedDirectory, 'drugs.jsonl');
  const [stats, artifact] = await Promise.all([
    scanInput(inputPath, gate.cleared),
    hashFile(inputPath),
  ]);
  if (stats.rowsRead === 0) {
    fail('candidate artifact contains no rows; an empty public release is never valid');
  }
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
  if (manifest.rows_included !== stats.rowsRead
    || manifest.artifact_source.record_count !== stats.rowsRead
    || manifest.artifact_source.size_bytes !== artifact.size_bytes
    || manifest.artifact_source.sha256 !== artifact.sha256) {
    fail('release artifact does not match its manifest');
  }
  if (JSON.stringify(manifest.included_sources) !== JSON.stringify(expectedIncludedSources(gate, stats))) {
    fail('release included_sources do not match artifact provenance');
  }
  if (manifest.excluded_sources === null
    || typeof manifest.excluded_sources !== 'object'
    || Array.isArray(manifest.excluded_sources)) {
    fail('release excluded_sources must be an object');
  }
  process.stdout.write(
    `public release package check passed: ${stats.rowsRead} rows, every source cleared for ${PUBLIC_RELEASE_PROFILE} (${resolvedDirectory})\n`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const gate = loadGate();
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
