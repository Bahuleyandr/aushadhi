import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { StringDecoder } from 'node:string_decoder';
import { stringify as createCsvStringifier } from 'csv-stringify';

export const COHORT_MANIFEST = 'cohort-manifest.json';
export const COHORT_INDEX = 'cohort-index.json';
export const COHORT_GENERATIONS_DIR = '.generations';
export const REQUIRED_COHORT_FILES = Object.freeze([
  'drugs.csv',
  'drugs.jsonl',
  'compositions.csv',
  'substitute_edges.csv',
  'conflicts.csv',
  'conflicts.jsonl',
  'errors.csv',
  'summary.json',
  'ATTRIBUTION.md',
  'prescribable.jsonl',
  'formulation_groups.jsonl',
  'REPORT.md',
]);
export const OPTIONAL_COHORT_FILES = Object.freeze([
  'strength-review-shortlist.csv',
  'strength-conflicts.csv',
]);

const JSONL_FILES = new Set([
  'drugs.jsonl',
  'conflicts.jsonl',
  'prescribable.jsonl',
  'formulation_groups.jsonl',
]);
const ALLOWED_COHORT_FILES = new Set([...REQUIRED_COHORT_FILES, ...OPTIONAL_COHORT_FILES]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const JSONL_COUNT_KEYS = new Map([
  ['drugs.jsonl', 'drugs'],
  ['conflicts.jsonl', 'conflicts'],
  ['prescribable.jsonl', 'prescribable'],
  ['formulation_groups.jsonl', 'formulation_groups'],
]);

function safeGenerationId(value) {
  const generationId = String(value ?? '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u.test(generationId)) {
    throw new Error(`invalid generation id: ${generationId}`);
  }
  return generationId;
}

export function newGenerationId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:.]/gu, '').replace('T', 'T').replace('Z', 'Z');
  return `${stamp}-p${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
}

export async function createGenerationStage({ distRoot, generationId }) {
  const safeId = safeGenerationId(generationId);
  const stagingRoot = path.join(distRoot, '.staging');
  const dir = path.join(stagingRoot, safeId);
  await fsp.mkdir(stagingRoot, { recursive: true });
  try {
    await fsp.mkdir(dir);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`generation stage already exists: ${dir}`);
    throw error;
  }
  return dir;
}

export async function removeGenerationStage({ distRoot, generationId, stageDir }) {
  const safeId = safeGenerationId(generationId);
  const stagingRoot = path.resolve(distRoot, '.staging');
  const expectedStage = path.join(stagingRoot, safeId);
  if (path.resolve(stageDir) !== expectedStage) {
    throw new Error(`refusing to remove non-matching generation stage: ${stageDir}`);
  }

  let stageInformation;
  try {
    stageInformation = await fsp.lstat(expectedStage);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  const stagingInformation = await fsp.lstat(stagingRoot);
  if (!stagingInformation.isDirectory() || stagingInformation.isSymbolicLink()) {
    throw new Error(`cohort staging root must be a regular directory: ${stagingRoot}`);
  }
  if (!stageInformation.isDirectory() || stageInformation.isSymbolicLink()) {
    throw new Error(`cohort stage must be a regular directory: ${expectedStage}`);
  }
  const [realStagingRoot, realStage] = await Promise.all([
    fsp.realpath(stagingRoot),
    fsp.realpath(expectedStage),
  ]);
  if (path.dirname(realStage) !== realStagingRoot || path.basename(realStage) !== safeId) {
    throw new Error(`cohort stage resolves outside ${realStagingRoot}`);
  }
  await fsp.rm(expectedStage, { recursive: true, force: false });
  return true;
}

async function finishWritable(stream) {
  stream.end();
  await once(stream, 'finish');
}

export async function writeJsonlStream(file, rows) {
  const out = fs.createWriteStream(file, { encoding: 'utf8', flags: 'w' });
  try {
    for (const row of rows) {
      if (!out.write(`${JSON.stringify(row)}\n`)) await once(out, 'drain');
    }
    await finishWritable(out);
  } catch (error) {
    out.destroy();
    throw error;
  }
}

export async function writeCsvStream(file, rows, options = {}) {
  const csv = createCsvStringifier(options);
  const out = fs.createWriteStream(file, { flags: 'w' });
  const failure = new Promise((_, reject) => {
    csv.once('error', reject);
    out.once('error', reject);
  });
  csv.pipe(out);
  const write = async () => {
    for (const row of rows) {
      if (!csv.write(row)) await once(csv, 'drain');
    }
    csv.end();
    await once(out, 'finish');
  };
  await Promise.race([write(), failure]);
}

async function inspectFile(file, countRecords) {
  const hash = crypto.createHash('sha256');
  const stat = await fsp.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`cohort artifact must be a regular file: ${path.basename(file)}`);
  }
  const input = fs.createReadStream(file);
  const decoder = countRecords ? new StringDecoder('utf8') : null;
  let recordCount = 0;
  let pending = '';
  for await (const chunk of input) {
    hash.update(chunk);
    if (decoder) {
      pending += decoder.write(chunk);
      let newline;
      while ((newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (!line) continue;
        JSON.parse(line);
        recordCount += 1;
      }
    }
  }
  if (decoder) {
    pending += decoder.end();
    if (pending.trim()) {
      JSON.parse(pending);
      recordCount += 1;
    }
  }
  return {
    sha256: hash.digest('hex'),
    size_bytes: stat.size,
    ...(countRecords ? { record_count: recordCount } : {}),
  };
}

function selectedVerificationFiles(verifyFiles) {
  if (verifyFiles === false || verifyFiles === undefined) return [];
  if (!Array.isArray(verifyFiles)) {
    throw new TypeError('verifyFiles must be true, false, or an array of cohort artifact names');
  }
  if (verifyFiles.length === 0) {
    throw new TypeError('verifyFiles must name at least one cohort artifact');
  }
  if (verifyFiles.length > ALLOWED_COHORT_FILES.size) {
    throw new TypeError('verifyFiles exceeds the bounded cohort artifact set');
  }
  const selected = [];
  const seen = new Set();
  for (const name of verifyFiles) {
    if (typeof name !== 'string' || !ALLOWED_COHORT_FILES.has(name)) {
      throw new TypeError(`unsupported cohort artifact requested for verification: ${name}`);
    }
    if (seen.has(name)) throw new TypeError(`duplicate cohort artifact requested for verification: ${name}`);
    seen.add(name);
    selected.push(name);
  }
  return selected;
}

function validateManifestFileEntry(manifest, name) {
  if (!isRecord(manifest.files)) throw new Error('published cohort manifest files must be an object');
  const expected = manifest.files[name];
  if (!isRecord(expected)) throw new Error(`published cohort manifest does not bind ${name}`);
  const countRecords = JSONL_FILES.has(name);
  assertExactKeys(
    expected,
    countRecords ? ['sha256', 'size_bytes', 'record_count'] : ['sha256', 'size_bytes'],
    `published cohort manifest file ${name}`,
  );
  if (!SHA256_PATTERN.test(expected.sha256)) {
    throw new Error(`published cohort manifest ${name} sha256 is invalid`);
  }
  if (!Number.isSafeInteger(expected.size_bytes) || expected.size_bytes < 0) {
    throw new Error(`published cohort manifest ${name} size_bytes is invalid`);
  }
  if (countRecords && (!Number.isSafeInteger(expected.record_count) || expected.record_count < 0)) {
    throw new Error(`published cohort manifest ${name} record_count is invalid`);
  }
  return expected;
}

async function verifySelectedCohortFiles({ dir, manifest, names }) {
  for (const name of names) {
    const expected = validateManifestFileEntry(manifest, name);
    const actual = await inspectFile(path.join(dir, name), JSONL_FILES.has(name));
    if (actual.sha256 !== expected.sha256) throw new Error(`${name} hash mismatch`);
    if (actual.size_bytes !== expected.size_bytes) throw new Error(`${name} size mismatch`);
    if (actual.record_count !== expected.record_count) throw new Error(`${name} record count mismatch`);
    const countKey = JSONL_COUNT_KEYS.get(name);
    if (countKey !== undefined) {
      if (!isRecord(manifest.counts) || !Number.isSafeInteger(manifest.counts[countKey])) {
        throw new Error(`published cohort manifest count ${countKey} is invalid`);
      }
      if (manifest.counts[countKey] !== actual.record_count) {
        throw new Error(`${name} record count does not match cohort count ${countKey}`);
      }
    }
  }
}

async function inspectCohort(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const actual = entries.map((entry) => entry.name).filter((name) => name !== COHORT_MANIFEST);
  for (const entry of entries) {
    if (entry.name === COHORT_MANIFEST) continue;
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`cohort entry must be a regular file: ${entry.name}`);
    if (!ALLOWED_COHORT_FILES.has(entry.name)) throw new Error(`unexpected cohort artifact: ${entry.name}`);
  }
  for (const name of REQUIRED_COHORT_FILES) {
    if (!actual.includes(name)) throw new Error(`required cohort artifact is missing: ${name}`);
    const stat = await fsp.lstat(path.join(dir, name));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`cohort artifact must be a regular file: ${name}`);
  }

  const files = {};
  for (const name of actual.sort()) {
    files[name] = await inspectFile(path.join(dir, name), JSONL_FILES.has(name));
  }
  const summary = JSON.parse(await fsp.readFile(path.join(dir, 'summary.json'), 'utf8'));
  const counts = {
    drugs: files['drugs.jsonl'].record_count,
    conflicts: files['conflicts.jsonl'].record_count,
    prescribable: files['prescribable.jsonl'].record_count,
    formulation_groups: files['formulation_groups.jsonl'].record_count,
  };
  if (summary.total_rows !== counts.drugs) {
    throw new Error(`drugs.jsonl count ${counts.drugs} does not match summary total_rows ${summary.total_rows}`);
  }
  if (summary.conflicts !== counts.conflicts) {
    throw new Error(`conflicts.jsonl count ${counts.conflicts} does not match summary conflicts ${summary.conflicts}`);
  }
  if (!(await fsp.readFile(path.join(dir, 'REPORT.md'), 'utf8')).trim()) {
    throw new Error('REPORT.md is empty');
  }

  return { summary, counts, files };
}

export async function writeCohortManifest({ dir, date, generationId, inputFingerprint, now = new Date() }) {
  const safeId = safeGenerationId(generationId);
  const inspected = await inspectCohort(dir);
  if (inspected.summary.date !== date) {
    throw new Error(`summary date ${inspected.summary.date} does not match cohort date ${date}`);
  }
  const manifest = {
    schema_version: 1,
    generation_id: safeId,
    date,
    generated_at: now.toISOString(),
    input_fingerprint: inputFingerprint,
    counts: inspected.counts,
    files: inspected.files,
  };
  const target = path.join(dir, COHORT_MANIFEST);
  const temporary = `${target}.tmp-${process.pid}`;
  await fsp.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await fsp.rename(temporary, target);
  return manifest;
}

export async function verifyCohort({ dir, expectedDate, expectedGenerationId }) {
  const manifestFile = path.join(dir, COHORT_MANIFEST);
  const manifest = JSON.parse(await fsp.readFile(manifestFile, 'utf8'));
  if (manifest.schema_version !== 1) throw new Error(`unsupported cohort manifest schema: ${manifest.schema_version}`);
  if (expectedDate && manifest.date !== expectedDate) throw new Error(`cohort date mismatch: ${manifest.date}`);
  if (expectedGenerationId && manifest.generation_id !== expectedGenerationId) {
    throw new Error(`cohort generation mismatch: ${manifest.generation_id}`);
  }
  const inspected = await inspectCohort(dir);
  assertSameKeys(manifest.files, inspected.files, 'manifest files');
  for (const [name, expected] of Object.entries(manifest.files)) {
    const actual = inspected.files[name];
    if (expected.sha256 !== actual.sha256) throw new Error(`${name} hash mismatch`);
    if (expected.size_bytes !== actual.size_bytes) throw new Error(`${name} size mismatch`);
    if (expected.record_count !== actual.record_count) throw new Error(`${name} record count mismatch`);
  }
  assertSameKeys(manifest.counts, inspected.counts, 'manifest counts');
  for (const [name, expected] of Object.entries(manifest.counts)) {
    if (inspected.counts[name] !== expected) throw new Error(`${name} cohort count mismatch`);
  }
  if (inspected.summary.date !== manifest.date) throw new Error('summary date does not match cohort manifest');
  return manifest;
}

function assertSameKeys(expected, actual, label) {
  const a = Object.keys(expected ?? {}).sort();
  const b = Object.keys(actual ?? {}).sort();
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${label} do not match published artifacts`);
}

async function pathExists(target) {
  try {
    await fsp.lstat(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value, keys, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort(compareCodePoint);
  const expected = [...keys].sort(compareCodePoint);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} has unexpected fields`);
  }
}

function safeCohortDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`invalid cohort date: ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`invalid cohort date: ${value}`);
  }
  return value;
}

function validateCohortIndex(index) {
  assertExactKeys(index, ['schema_version', 'updated_at', 'latest', 'dates', 'generations'], 'cohort index');
  if (index.schema_version !== 1) throw new Error(`unsupported cohort index schema: ${index.schema_version}`);
  if (!Number.isFinite(Date.parse(index.updated_at))) throw new Error('cohort index updated_at is invalid');
  assertExactKeys(index.latest, ['date', 'generation_id'], 'cohort index latest pointer');
  const latestGenerationId = safeGenerationId(index.latest.generation_id);
  const latestDate = safeCohortDate(index.latest.date);
  if (!isRecord(index.dates)) throw new Error('cohort index dates must be an object');
  if (!isRecord(index.generations)) throw new Error('cohort index generations must be an object');

  for (const [generationId, entry] of Object.entries(index.generations)) {
    safeGenerationId(generationId);
    assertExactKeys(entry, ['date', 'manifest_sha256', 'published_at'], `cohort generation ${generationId}`);
    safeCohortDate(entry.date);
    if (!/^[a-f0-9]{64}$/u.test(entry.manifest_sha256 ?? '')) {
      throw new Error(`cohort generation ${generationId} manifest_sha256 is invalid`);
    }
    if (!Number.isFinite(Date.parse(entry.published_at))) {
      throw new Error(`cohort generation ${generationId} published_at is invalid`);
    }
  }
  for (const [date, generationId] of Object.entries(index.dates)) {
    safeCohortDate(date);
    safeGenerationId(generationId);
    if (index.generations[generationId]?.date !== date) {
      throw new Error(`cohort date pointer ${date} does not match generation ${generationId}`);
    }
  }
  if (index.dates[latestDate] !== latestGenerationId
    || index.generations[latestGenerationId]?.date !== latestDate) {
    throw new Error('cohort latest pointer does not match its date and generation records');
  }
  return index;
}

async function readCohortIndex(distRoot, { allowMissing = false } = {}) {
  const indexFile = path.join(distRoot, COHORT_INDEX);
  let information;
  try {
    information = await fsp.lstat(indexFile);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    if (await pathExists(path.join(distRoot, 'latest'))) {
      throw new Error(`legacy dist/latest exists without ${COHORT_INDEX}; refusing non-atomic cohort read`);
    }
    if (allowMissing) return null;
    throw new Error(`no published cohort index at ${indexFile}`);
  }
  if (!information.isFile() || information.isSymbolicLink()) {
    throw new Error(`cohort index must be a regular file: ${indexFile}`);
  }
  let index;
  try {
    index = JSON.parse(await fsp.readFile(indexFile, 'utf8'));
  } catch (error) {
    throw new Error(`invalid cohort index at ${indexFile}: ${error.message}`);
  }
  return validateCohortIndex(index);
}

function generationDirectory(distRoot, generationId) {
  return path.join(distRoot, COHORT_GENERATIONS_DIR, safeGenerationId(generationId));
}

async function ensureDirectory(target, label) {
  try {
    await fsp.mkdir(target);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
  const information = await fsp.lstat(target);
  if (!information.isDirectory() || information.isSymbolicLink()) {
    throw new Error(`${label} must be a regular directory: ${target}`);
  }
}

async function writeIndexAtomic(distRoot, index, beforePointerSwap) {
  validateCohortIndex(index);
  const target = path.join(distRoot, COHORT_INDEX);
  const temporary = path.join(
    distRoot,
    `.${COHORT_INDEX}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`,
  );
  const existing = await pathExists(target) ? await fsp.lstat(target) : null;
  if (existing && (!existing.isFile() || existing.isSymbolicLink())) {
    throw new Error(`cohort index must be a regular file: ${target}`);
  }
  let handle;
  try {
    handle = await fsp.open(temporary, 'wx');
    await handle.writeFile(`${JSON.stringify(index, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await beforePointerSwap?.();
    await fsp.rename(temporary, target);
  } finally {
    await handle?.close().catch(() => {});
    await fsp.rm(temporary, { force: true }).catch(() => {});
  }
}

function assertStageInsideDist(distRoot, stageDir) {
  const stagingRoot = path.resolve(distRoot, '.staging');
  const resolvedStage = path.resolve(stageDir);
  const relative = path.relative(stagingRoot, resolvedStage);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`cohort stage is outside ${stagingRoot}`);
  }
}

function cohortPromotionVolume(summary, label) {
  if (!isRecord(summary)) throw new Error(`${label} summary must be an object`);
  if (!Number.isSafeInteger(summary.total_rows) || summary.total_rows <= 0) {
    throw new Error(`${label} summary total_rows must be a positive integer`);
  }
  if (!isRecord(summary.sources)) throw new Error(`${label} summary sources must be an object`);
  const positiveSources = new Map();
  for (const [source, count] of Object.entries(summary.sources)) {
    if (!source || !Number.isSafeInteger(count) || count < 0) {
      throw new Error(`${label} summary source ${source || '<empty>'} count is invalid`);
    }
    if (count > 0) positiveSources.set(source, count);
  }
  if (positiveSources.size === 0) {
    throw new Error(`${label} summary must contain a positive source count`);
  }
  return { totalRows: summary.total_rows, positiveSources };
}

function cohortPromotionCounts(manifest, label) {
  if (!isRecord(manifest) || !isRecord(manifest.counts)) {
    throw new Error(`${label} manifest counts must be an object`);
  }
  const drugs = manifest.counts.drugs;
  const prescribable = manifest.counts.prescribable;
  if (!Number.isSafeInteger(drugs) || drugs <= 0) {
    throw new Error(`${label} manifest drugs count must be a positive integer`);
  }
  if (!Number.isSafeInteger(prescribable) || prescribable <= 0) {
    throw new Error(`${label} manifest prescribable count must be a positive integer`);
  }
  return { drugs, prescribable };
}

export function assertCohortPromotionVolume({
  candidateSummary,
  candidateManifest,
  priorSummary = null,
  priorManifest = null,
}) {
  const candidate = cohortPromotionVolume(candidateSummary, 'candidate cohort');
  const candidateCounts = cohortPromotionCounts(candidateManifest, 'candidate cohort');
  if (candidateCounts.drugs !== candidate.totalRows) {
    throw new Error('candidate cohort manifest drugs count does not match summary total_rows');
  }
  if (priorSummary === null && priorManifest === null) return { ...candidate, ...candidateCounts };
  if (priorSummary === null || priorManifest === null) {
    throw new Error('prior cohort promotion baseline is incomplete');
  }
  const prior = cohortPromotionVolume(priorSummary, 'prior cohort');
  const priorCounts = cohortPromotionCounts(priorManifest, 'prior cohort');
  if (priorCounts.drugs !== prior.totalRows) {
    throw new Error('prior cohort manifest drugs count does not match summary total_rows');
  }
  if (candidate.totalRows < prior.totalRows) {
    throw new Error(
      `candidate cohort total_rows ${candidate.totalRows} is below prior cohort ${prior.totalRows}`,
    );
  }
  if (candidateCounts.prescribable < priorCounts.prescribable) {
    throw new Error(
      `candidate cohort prescribable count ${candidateCounts.prescribable} `
      + `is below prior cohort ${priorCounts.prescribable}`,
    );
  }
  for (const [source, priorCount] of prior.positiveSources) {
    if (!candidate.positiveSources.has(source)) {
      throw new Error(`candidate cohort dropped previously positive source: ${source}`);
    }
    const candidateCount = candidate.positiveSources.get(source);
    if (candidateCount < priorCount) {
      throw new Error(
        `candidate cohort source ${source} count ${candidateCount} `
        + `is below prior cohort ${priorCount}`,
      );
    }
  }
  return { ...candidate, ...candidateCounts };
}

async function readVerifiedSummary(dir, label) {
  const summaryFile = path.join(dir, 'summary.json');
  const information = await fsp.lstat(summaryFile);
  if (!information.isFile() || information.isSymbolicLink()) {
    throw new Error(`${label} summary must be a regular file: ${summaryFile}`);
  }
  try {
    return JSON.parse(await fsp.readFile(summaryFile, 'utf8'));
  } catch (error) {
    throw new Error(`${label} summary is invalid: ${error.message}`);
  }
}

export async function resolvePublishedCohort({ distRoot, date, verifyFiles = false }) {
  const selectedFiles = verifyFiles === true ? null : selectedVerificationFiles(verifyFiles);
  const absoluteDistRoot = path.resolve(distRoot);
  const index = await readCohortIndex(absoluteDistRoot);
  const selectedDate = date === undefined ? index.latest.date : safeCohortDate(date);
  const generationId = date === undefined
    ? index.latest.generation_id
    : index.dates[selectedDate];
  if (!generationId) throw new Error(`no published cohort for date ${selectedDate}`);
  const entry = index.generations[generationId];
  const dir = generationDirectory(absoluteDistRoot, generationId);
  const information = await fsp.lstat(dir);
  if (!information.isDirectory() || information.isSymbolicLink()) {
    throw new Error(`published cohort generation must be a regular directory: ${dir}`);
  }
  const generationsRoot = path.join(absoluteDistRoot, COHORT_GENERATIONS_DIR);
  const [realGenerationsRoot, realDir] = await Promise.all([
    fsp.realpath(generationsRoot),
    fsp.realpath(dir),
  ]);
  const relative = path.relative(realGenerationsRoot, realDir);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`published cohort generation resolves outside ${realGenerationsRoot}`);
  }
  const manifestFile = path.join(dir, COHORT_MANIFEST);
  const manifestInformation = await fsp.lstat(manifestFile);
  if (!manifestInformation.isFile() || manifestInformation.isSymbolicLink()) {
    throw new Error(`published cohort manifest must be a regular file: ${manifestFile}`);
  }
  if (manifestInformation.size > 16 * 1024 * 1024) {
    throw new Error(`published cohort manifest is too large: ${manifestFile}`);
  }
  const manifestBytes = await fsp.readFile(manifestFile);
  const manifestSha256 = crypto.createHash('sha256').update(manifestBytes).digest('hex');
  if (manifestSha256 !== entry.manifest_sha256) {
    throw new Error(`published cohort manifest hash mismatch for generation ${generationId}`);
  }
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.schema_version !== 1
    || manifest.generation_id !== generationId
    || manifest.date !== selectedDate) {
    throw new Error(`published cohort manifest identity mismatch for generation ${generationId}`);
  }
  if (verifyFiles === true) {
    await verifyCohort({ dir, expectedDate: selectedDate, expectedGenerationId: generationId });
  } else if (selectedFiles.length > 0) {
    await verifySelectedCohortFiles({ dir, manifest, names: selectedFiles });
  }
  return {
    dir,
    date: selectedDate,
    generationId,
    manifest,
    manifestSha256,
    publishedAt: entry.published_at,
    index,
  };
}

export async function promoteCohort({
  distRoot,
  date,
  generationId,
  stageDir,
  verifiedManifest,
  now = new Date(),
  beforePointerSwap,
}) {
  const safeId = safeGenerationId(generationId);
  const safeDate = safeCohortDate(date);
  assertStageInsideDist(distRoot, stageDir);
  if (verifiedManifest) {
    if (verifiedManifest.date !== safeDate || verifiedManifest.generation_id !== safeId) {
      throw new Error('verified manifest does not identify the staged cohort');
    }
  }
  const candidateManifest = await verifyCohort({
    dir: stageDir,
    expectedDate: safeDate,
    expectedGenerationId: safeId,
  });

  const current = await readCohortIndex(distRoot, { allowMissing: true });
  const candidateSummary = await readVerifiedSummary(stageDir, 'candidate cohort');
  let priorSummary = null;
  let priorManifest = null;
  if (current !== null) {
    const prior = await resolvePublishedCohort({ distRoot, verifyFiles: true });
    if (JSON.stringify(prior.index) !== JSON.stringify(current)) {
      throw new Error('cohort index changed while verifying the prior promotion baseline');
    }
    priorSummary = await readVerifiedSummary(prior.dir, 'prior cohort');
    priorManifest = prior.manifest;
  }
  assertCohortPromotionVolume({
    candidateSummary,
    candidateManifest,
    priorSummary,
    priorManifest,
  });

  const generationsRoot = path.join(distRoot, COHORT_GENERATIONS_DIR);
  await ensureDirectory(generationsRoot, 'cohort generations root');
  const generationDir = generationDirectory(distRoot, safeId);
  if (await pathExists(generationDir)) throw new Error(`cohort generation already exists: ${generationDir}`);
  await fsp.rename(stageDir, generationDir);
  const promotedManifest = await verifyCohort({
    dir: generationDir,
    expectedDate: safeDate,
    expectedGenerationId: safeId,
  });
  const promotedSummary = await readVerifiedSummary(generationDir, 'promoted cohort');
  assertCohortPromotionVolume({
    candidateSummary: promotedSummary,
    candidateManifest: promotedManifest,
    priorSummary,
    priorManifest,
  });
  const manifestSha256 = await sha256File(path.join(generationDir, COHORT_MANIFEST));
  const publishedAt = now.toISOString();
  const generations = {
    ...(current?.generations ?? {}),
    [safeId]: { date: safeDate, manifest_sha256: manifestSha256, published_at: publishedAt },
  };
  const dates = { ...(current?.dates ?? {}), [safeDate]: safeId };
  const index = {
    schema_version: 1,
    updated_at: publishedAt,
    latest: { date: safeDate, generation_id: safeId },
    dates: Object.fromEntries(Object.entries(dates).sort(([left], [right]) => compareCodePoint(left, right))),
    generations: Object.fromEntries(
      Object.entries(generations).sort(([left], [right]) => compareCodePoint(left, right)),
    ),
  };
  await writeIndexAtomic(distRoot, index, async () => {
    await beforePointerSwap?.();
    const finalManifest = await verifyCohort({
      dir: generationDir,
      expectedDate: safeDate,
      expectedGenerationId: safeId,
    });
    const finalSummary = await readVerifiedSummary(generationDir, 'final promoted cohort');
    assertCohortPromotionVolume({
      candidateSummary: finalSummary,
      candidateManifest: finalManifest,
      priorSummary,
      priorManifest,
    });
    const finalManifestSha256 = await sha256File(path.join(generationDir, COHORT_MANIFEST));
    if (finalManifestSha256 !== manifestSha256) {
      throw new Error('promoted cohort manifest changed before the atomic pointer swap');
    }
    const beforeSwap = await readCohortIndex(distRoot, { allowMissing: true });
    if (JSON.stringify(beforeSwap) !== JSON.stringify(current)) {
      throw new Error('cohort index changed before the atomic pointer swap');
    }
  });
  return {
    datedDir: generationDir,
    latestDir: generationDir,
    generationDir,
    indexFile: path.join(distRoot, COHORT_INDEX),
    publishedAt,
  };
}

export async function acquireBuildLock({ distRoot, generationId, lockPath }) {
  const safeId = safeGenerationId(generationId);
  await fsp.mkdir(distRoot, { recursive: true });
  const lockDir = path.resolve(lockPath ?? path.join(distRoot, '.build.lock'));
  await fsp.mkdir(path.dirname(lockDir), { recursive: true });
  for (;;) {
    try {
      await fsp.mkdir(lockDir);
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      let owner = null;
      let ownerText = 'unknown owner';
      try {
        ownerText = (await fsp.readFile(path.join(lockDir, 'owner.json'), 'utf8')).trim();
        owner = JSON.parse(ownerText);
      } catch { /* diagnostic only */ }
      if (owner?.hostname === os.hostname() && Number.isInteger(owner.pid) && !processIsAlive(owner.pid)) {
        const stale = `${lockDir}.stale-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
        try {
          await fsp.rename(lockDir, stale);
          await fsp.rm(stale, { recursive: true, force: true });
          continue;
        } catch (reclaimError) {
          if (reclaimError?.code === 'ENOENT') continue;
          throw reclaimError;
        }
      }
      throw new Error(`build lock is held at ${lockDir}: ${ownerText}`);
    }
  }
  const token = crypto.randomUUID();
  try {
    await fsp.writeFile(path.join(lockDir, 'owner.json'), `${JSON.stringify({
      generation_id: safeId,
      pid: process.pid,
      hostname: os.hostname(),
      started_at: new Date().toISOString(),
      token,
    })}\n`, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    await fsp.rm(lockDir, { recursive: true, force: true });
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    const owner = JSON.parse(await fsp.readFile(path.join(lockDir, 'owner.json'), 'utf8'));
    if (owner.token !== token) throw new Error(`build lock ownership changed at ${lockDir}`);
    await fsp.rm(lockDir, { recursive: true, force: true });
    released = true;
  };
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

const EXCLUDED_FINGERPRINT_DIRECTORIES = new Set([
  '.cache',
  '.staging',
  '.tmp',
  'cache',
  'logs',
  'node_modules',
  'pages',
  'restricted',
  'tmp',
]);

function isMissingPath(error) {
  return error?.code === 'ENOENT';
}

async function fingerprintPath(hash, target, label, include) {
  let stat;
  try {
    stat = await fsp.lstat(target);
  } catch (error) {
    if (isMissingPath(error)) return;
    throw error;
  }
  if (stat.isSymbolicLink()) {
    if (include(target)) throw new Error(`input fingerprint candidate must not be a symbolic link: ${target}`);
    return;
  }
  if (stat.isDirectory()) {
    if (EXCLUDED_FINGERPRINT_DIRECTORIES.has(path.basename(target).toLowerCase()) && !include(target)) return;
    let entries;
    try {
      entries = await fsp.readdir(target, { withFileTypes: true });
    } catch (error) {
      if (isMissingPath(error)) return;
      throw error;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) await fingerprintPath(hash, path.join(target, entry.name), `${label}/${entry.name}`, include);
    return;
  }
  if (!stat.isFile() || !include(target)) return;
  let contentSha256;
  try {
    contentSha256 = await sha256File(target);
  } catch (error) {
    if (isMissingPath(error)) return;
    throw error;
  }
  hash.update(`file\0${label}\0${stat.size}\0${Math.trunc(stat.mtimeMs)}\0${contentSha256}\0`);
}

export async function computeInputFingerprint(paths, { include = () => true } = {}) {
  const hash = crypto.createHash('sha256');
  for (let index = 0; index < paths.length; index += 1) {
    await fingerprintPath(hash, path.resolve(paths[index]), `root-${index}`, include);
  }
  return hash.digest('hex');
}

export function shouldBuildCohort({ state, inputFingerprint, now = new Date(), maxAgeMs }) {
  if (!state || state.input_fingerprint !== inputFingerprint) return true;
  const completedAt = Date.parse(state.completed_at);
  if (!Number.isFinite(completedAt)) return true;
  const age = now.getTime() - completedAt;
  return age < 0 || age >= maxAgeMs;
}

export async function hasPublishedCohort({ dir, distRoot, state }) {
  if (!state?.generation_id) return false;
  try {
    if (distRoot) {
      const published = await resolvePublishedCohort({ distRoot, verifyFiles: true });
      if (published.date !== state.date || published.generationId !== state.generation_id) return false;
    } else {
      await verifyCohort({
        dir,
        expectedDate: state.date,
        expectedGenerationId: state.generation_id,
      });
    }
    return true;
  } catch {
    return false;
  }
}
