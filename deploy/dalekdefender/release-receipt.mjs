#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  lstat,
  link,
  open,
  readFile,
  readlink,
  readdir,
  realpath,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const SYSTEMD_SOURCE_PREFIX = 'deploy/dalekdefender/';
const SYSTEMD_FILE_PATTERN = /^aushadhi-[a-z0-9-]+\.(?:service|timer)$/u;
const RECEIPT_SCHEMA_VERSION = 1;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const RUNTIME_MANIFEST_RELATIVE_PATH = 'deploy/dalekdefender/runtime-manifest.json';
const LIVE_ROOTS = Object.freeze({
  installedRoot: path.resolve('/opt/aushadhi'),
  systemdRoot: path.resolve('/etc/systemd/system'),
  privilegedRoot: path.resolve('/'),
  exportRoots: Object.freeze([path.resolve('/var/lib/aushadhi-export')]),
  receiptPath: path.resolve('/opt/aushadhi/DEPLOYED-RELEASE.json'),
});
const REQUIRED_RECEIPT_FIELDS = [
  'repository_commit',
  'repository_tree_sha256',
  'installed_at_utc',
  'installed_files_sha256',
  'systemd_files_sha256',
  'dependency_tree_sha256',
  'privileged_files_sha256',
  'installed_tree_metadata_sha256',
  'inspection_profile',
  'inspected_roots',
  'filesystem_policy',
  'runtime_manifest_sha256',
  'artifact_policy',
];

class ReceiptError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReceiptError';
  }
}

function fail(message) {
  throw new ReceiptError(message);
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function normalizedRelativePath(value, label = 'path') {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    fail(`${label} is invalid`);
  }
  const withSlashes = value.replaceAll('\\', '/');
  if (path.posix.isAbsolute(withSlashes)) fail(`${label} must be relative: ${value}`);
  const normalized = path.posix.normalize(withSlashes);
  if (
    normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized !== withSlashes
  ) {
    fail(`${label} escapes its root or is not normalized: ${value}`);
  }
  return normalized;
}

function safeJoin(root, relativePath, label = 'path') {
  const normalized = normalizedRelativePath(relativePath, label);
  const target = path.resolve(root, ...normalized.split('/'));
  if (!isPathInside(root, target)) fail(`${label} escapes its root: ${relativePath}`);
  return target;
}

function isPathInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function samePath(left, right) {
  return path.resolve(left) === path.resolve(right);
}

function inspectionProfile(options) {
  return options.stagingTestMode === true ? 'staging-test' : 'live';
}

function selectedInspectedRoots(options) {
  const exportRoots = options.exportRoots.map((entry) => path.resolve(entry)).sort();
  if (new Set(exportRoots).size !== exportRoots.length) fail('duplicate export root is forbidden');
  return {
    source_root: path.resolve(options.sourceRoot),
    installed_root: path.resolve(options.installedRoot),
    systemd_root: path.resolve(options.systemdRoot),
    privileged_root: path.resolve(options.privilegedRoot),
    export_roots: exportRoots,
    runtime_manifest: path.resolve(options.runtimeManifest),
  };
}

function assertInspectionBoundary(options) {
  const profile = inspectionProfile(options);
  const roots = selectedInspectedRoots(options);
  const expectedRuntimeManifest = path.resolve(roots.source_root, RUNTIME_MANIFEST_RELATIVE_PATH);
  if (!samePath(roots.runtime_manifest, expectedRuntimeManifest)) {
    fail(`runtime manifest must be ${RUNTIME_MANIFEST_RELATIVE_PATH} in the selected source root`);
  }
  if (profile === 'staging-test') return { profile, roots };

  for (const [label, actual, expected] of [
    ['installed root', roots.installed_root, LIVE_ROOTS.installedRoot],
    ['systemd root', roots.systemd_root, LIVE_ROOTS.systemdRoot],
    ['privileged root', roots.privileged_root, LIVE_ROOTS.privilegedRoot],
  ]) {
    if (!samePath(actual, expected)) {
      fail(`live inspection ${label} must be ${expected}, found ${actual}`);
    }
  }
  if (!isDeepStrictEqual(roots.export_roots, [...LIVE_ROOTS.exportRoots])) {
    fail(`live inspection export roots must be exactly ${LIVE_ROOTS.exportRoots.join(', ')}`);
  }
  if (!samePath(options.receiptPath, LIVE_ROOTS.receiptPath)) {
    fail(`live inspection receipt path must be ${LIVE_ROOTS.receiptPath}`);
  }
  return { profile, roots };
}

async function requireDirectory(directory, label) {
  let information;
  try {
    information = await lstat(directory);
  } catch (error) {
    if (error?.code === 'ENOENT') fail(`${label} does not exist: ${directory}`);
    throw error;
  }
  if (information.isSymbolicLink()) fail(`${label} must not be a symlink: ${directory}`);
  if (!information.isDirectory()) fail(`${label} is not a directory: ${directory}`);
}

async function requireUnsymlinkedDirectory(directory, label) {
  await requireDirectory(directory, label);
  const resolved = await realpath(directory);
  if (path.relative(path.resolve(directory), path.resolve(resolved)) !== '') {
    fail(`${label} must not resolve through a symlink: ${directory}`);
  }
}

async function requireRegularFileWithin(root, relativePath, label) {
  const normalized = normalizedRelativePath(relativePath, label);
  let current = path.resolve(root);
  await requireDirectory(current, `${label} root`);
  const segments = normalized.split('/');
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let information;
    try {
      information = await lstat(current);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
    if (information.isSymbolicLink()) fail(`symlink is forbidden for ${label}: ${normalized}`);
    if (index < segments.length - 1 && !information.isDirectory()) {
      fail(`${label} parent is not a directory: ${normalized}`);
    }
    if (index === segments.length - 1 && !information.isFile()) {
      fail(`${label} is not a regular file: ${normalized}`);
    }
  }
  return current;
}

function runGit(sourceRoot, arguments_) {
  const result = spawnSync('git', ['-C', sourceRoot, ...arguments_], {
    encoding: null,
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) fail(`cannot execute git: ${result.error.message}`);
  if (result.status !== 0) {
    const message = Buffer.from(result.stderr ?? '').toString('utf8').trim();
    fail(`git ${arguments_.join(' ')} failed${message ? `: ${message}` : ''}`);
  }
  return Buffer.from(result.stdout ?? '');
}

function readGitBlobs(sourceRoot, trackedFiles) {
  const objectIds = [...new Set(trackedFiles.map(({ objectId }) => objectId))];
  const result = spawnSync('git', ['-C', sourceRoot, 'cat-file', '--batch'], {
    encoding: null,
    input: Buffer.from(`${objectIds.join('\n')}\n`, 'utf8'),
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) fail(`cannot execute git cat-file --batch: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`git cat-file --batch failed: ${Buffer.from(result.stderr ?? '').toString('utf8').trim()}`);
  }
  const output = Buffer.from(result.stdout ?? '');
  const blobs = new Map();
  let offset = 0;
  for (const requestedObjectId of objectIds) {
    const newline = output.indexOf(0x0a, offset);
    if (newline === -1) fail('git cat-file --batch returned a truncated header');
    const header = output.subarray(offset, newline).toString('utf8');
    const match = /^([a-f0-9]+) blob (\d+)$/u.exec(header);
    if (!match || match[1] !== requestedObjectId) {
      fail(`git cat-file --batch returned an invalid object header: ${header}`);
    }
    const size = Number.parseInt(match[2], 10);
    const contentStart = newline + 1;
    const contentEnd = contentStart + size;
    if (!Number.isSafeInteger(size) || contentEnd >= output.length || output[contentEnd] !== 0x0a) {
      fail(`git cat-file --batch returned truncated content for ${requestedObjectId}`);
    }
    blobs.set(requestedObjectId, output.subarray(contentStart, contentEnd));
    offset = contentEnd + 1;
  }
  if (offset !== output.length) fail('git cat-file --batch returned unexpected trailing output');
  return blobs;
}

async function inspectCleanRepository(sourceRoot) {
  await requireDirectory(sourceRoot, 'source root');
  const sourceRealPath = await realpath(sourceRoot);
  if (path.resolve(sourceRealPath) !== path.resolve(sourceRoot)) {
    fail(`source root must not resolve through a symlink: ${sourceRoot}`);
  }
  const topLevel = runGit(sourceRoot, ['rev-parse', '--show-toplevel']).toString('utf8').trim();
  const topLevelRealPath = await realpath(topLevel);
  if (path.resolve(topLevelRealPath) !== path.resolve(sourceRealPath)) {
    fail(`source root must be the Git checkout root: ${sourceRoot}`);
  }
  const dirty = runGit(sourceRoot, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--ignore-submodules=none',
  ]);
  if (dirty.length > 0) fail('source Git checkout is dirty; release receipt generation is refused');

  const repositoryCommit = runGit(sourceRoot, ['rev-parse', '--verify', 'HEAD'])
    .toString('utf8')
    .trim();
  if (!COMMIT_PATTERN.test(repositoryCommit)) fail(`Git returned an invalid repository commit: ${repositoryCommit}`);

  const staged = runGit(sourceRoot, ['ls-files', '--stage', '-z']);
  const trackedFiles = [];
  for (const record of staged.toString('utf8').split('\0')) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    const metadata = tab === -1 ? '' : record.slice(0, tab);
    const relativePath = tab === -1 ? '' : record.slice(tab + 1);
    const match = /^(\d{6}) ([a-f0-9]+) (\d)$/u.exec(metadata);
    if (!match || !relativePath) fail('git ls-files returned an invalid tracked-file record');
    const [, mode, objectId, stage] = match;
    if (stage !== '0') fail(`source Git checkout contains an unresolved index entry: ${relativePath}`);
    if (mode === '120000') fail(`tracked symlink is forbidden: ${relativePath}`);
    if (mode === '160000') fail(`tracked submodule is forbidden: ${relativePath}`);
    if (mode !== '100644' && mode !== '100755') fail(`unsupported tracked mode ${mode}: ${relativePath}`);
    trackedFiles.push({
      mode,
      objectId,
      relativePath: normalizedRelativePath(relativePath, 'tracked path'),
    });
  }
  trackedFiles.sort((left, right) => left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0);
  if (trackedFiles.length === 0) fail('source Git checkout has no tracked files');

  const installedFilesSha256 = Object.create(null);
  const treeHasher = createHash('sha256');
  const repositoryBlobs = readGitBlobs(sourceRoot, trackedFiles);
  treeHasher.update('aushadhi-release-tree-v1\0');
  for (const tracked of trackedFiles) {
    const sourceFile = await requireRegularFileWithin(
      sourceRoot,
      tracked.relativePath,
      `tracked source file ${tracked.relativePath}`,
    );
    if (!sourceFile) fail(`missing required tracked source file: ${tracked.relativePath}`);
    const contents = await readFile(sourceFile);
    installedFilesSha256[tracked.relativePath] = sha256(contents);
    const repositoryContents = repositoryBlobs.get(tracked.objectId);
    const repositoryDigest = sha256(repositoryContents);
    treeHasher.update(tracked.mode);
    treeHasher.update('\0');
    treeHasher.update(tracked.relativePath, 'utf8');
    treeHasher.update('\0');
    treeHasher.update(String(repositoryContents.length));
    treeHasher.update('\0');
    treeHasher.update(repositoryDigest);
    treeHasher.update('\0');
  }

  return {
    repositoryCommit,
    repositoryTreeSha256: treeHasher.digest('hex'),
    trackedFiles,
    sourceFilesSha256: Object.fromEntries(Object.entries(installedFilesSha256)),
  };
}

async function readRuntimeManifest(manifestPath, sourceRoot, repository, profile) {
  const absoluteManifestPath = path.resolve(manifestPath);
  if (!isPathInside(sourceRoot, absoluteManifestPath)) {
    fail('runtime manifest must be a tracked file inside the source checkout');
  }
  const relativePath = path.relative(sourceRoot, absoluteManifestPath).replaceAll('\\', '/');
  const expectedHash = repository.sourceFilesSha256[relativePath];
  if (!expectedHash) fail(`runtime manifest is not tracked by the source checkout: ${relativePath}`);
  const manifestFile = await requireRegularFileWithin(sourceRoot, relativePath, 'runtime manifest');
  if (!manifestFile) fail(`runtime manifest is missing: ${relativePath}`);
  const contents = await readFile(manifestFile);
  if (sha256(contents) !== expectedHash) fail('runtime manifest hash does not match the clean checkout');

  let manifest;
  try {
    manifest = JSON.parse(contents.toString('utf8'));
  } catch (error) {
    fail(`runtime manifest is invalid JSON: ${error.message}`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('runtime manifest must be an object');
  if (manifest.release_receipt?.required !== true) fail('runtime manifest must require a release receipt');
  if (!Array.isArray(manifest.release_receipt.required_fields)) {
    fail('runtime manifest release_receipt.required_fields must be an array');
  }
  for (const field of REQUIRED_RECEIPT_FIELDS) {
    if (!manifest.release_receipt.required_fields.includes(field)) {
      fail(`runtime manifest omits required receipt field: ${field}`);
    }
  }
  if (!manifest.artifact_policy || typeof manifest.artifact_policy !== 'object' || Array.isArray(manifest.artifact_policy)) {
    fail('runtime manifest artifact_policy must be an object');
  }
  if (manifest.artifact_policy.redistributable !== false) {
    fail('runtime manifest artifact_policy.redistributable must remain false');
  }
  if (manifest.artifact_policy.production_authority !== 'none') {
    fail('runtime manifest artifact_policy.production_authority must remain none');
  }
  if (manifest.artifact_policy.profile !== 'internal-evaluation') {
    fail('runtime manifest artifact_policy.profile must remain internal-evaluation');
  }
  if (manifest.artifact_policy.deployment_authority !== 'separate-explicit-approval-required') {
    fail('runtime manifest deployment authority must require separate explicit approval');
  }
  if (
    !Array.isArray(manifest.artifact_policy.restricted_sources)
    || !manifest.artifact_policy.restricted_sources.includes('janaushadhi')
    || !manifest.artifact_policy.restricted_sources.includes('onemg-live')
  ) {
    fail('runtime manifest must retain the restricted Janaushadhi and onemg-live sources');
  }
  if (manifest.restricted_cdci?.deployed !== false || manifest.restricted_cdci?.exported !== false) {
    fail('runtime manifest must explicitly forbid CDCI deployment and export');
  }
  if (manifest.restricted_cdci.profile !== 'internal-evaluation') {
    fail('runtime manifest restricted CDCI profile must remain internal-evaluation');
  }
  const restrictedCdciPath = normalizedRelativePath(
    manifest.restricted_cdci.storage_path,
    'restricted_cdci.storage_path',
  );
  const dependency = manifest.release_receipt.dependency_tree;
  if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)) {
    fail('runtime manifest must define release_receipt.dependency_tree');
  }
  const dependencyPath = normalizedRelativePath(dependency.path, 'dependency_tree.path');
  if (dependencyPath !== 'node_modules' || dependency.required !== true) {
    fail('runtime manifest dependency tree must require exactly node_modules');
  }
  if (dependency.allow_internal_relative_symlinks !== true) {
    fail('runtime manifest dependency tree must explicitly allow only internal relative symlinks');
  }
  if (!Array.isArray(dependency.lockfiles) || dependency.lockfiles.length === 0) {
    fail('runtime manifest dependency tree must name its tracked lockfiles');
  }
  const dependencyLockfiles = dependency.lockfiles.map((entry) => (
    normalizedRelativePath(entry, 'dependency_tree.lockfiles entry')
  ));
  if (
    new Set(dependencyLockfiles).size !== dependencyLockfiles.length
    || !dependencyLockfiles.includes('package.json')
    || !dependencyLockfiles.includes('package-lock.json')
  ) {
    fail('runtime manifest dependency lockfiles must uniquely include package.json and package-lock.json');
  }
  for (const lockfile of dependencyLockfiles) {
    if (!repository.sourceFilesSha256[lockfile]) fail(`dependency lockfile is not tracked: ${lockfile}`);
  }
  if (repository.trackedFiles.some(({ relativePath: trackedPath }) => (
    trackedPath === dependencyPath || trackedPath.startsWith(`${dependencyPath}/`)
  ))) {
    fail('tracked files are forbidden inside the dependency tree');
  }

  const systemdFiles = manifest.release_receipt.systemd_files;
  if (!systemdFiles || typeof systemdFiles !== 'object' || Array.isArray(systemdFiles)) {
    fail('runtime manifest must define release_receipt.systemd_files');
  }
  if (!isDeepStrictEqual(Object.keys(systemdFiles).sort(), ['gid', 'mode', 'uid'])) {
    fail('runtime manifest systemd_files policy has unexpected fields');
  }
  for (const field of ['uid', 'gid']) {
    if (!Number.isSafeInteger(systemdFiles[field]) || systemdFiles[field] < 0) {
      fail(`runtime manifest systemd_files.${field} must be a non-negative integer`);
    }
  }
  if (!/^0[0-7]{3}$/u.test(systemdFiles.mode)) {
    fail('runtime manifest systemd_files.mode must be a four-digit octal mode');
  }
  if (
    profile === 'live'
    && (systemdFiles.uid !== 0 || systemdFiles.gid !== 0 || systemdFiles.mode !== '0644')
  ) {
    fail('live runtime manifest must require root:root 0644 systemd files');
  }

  const installedTree = manifest.release_receipt.installed_tree;
  if (!installedTree || typeof installedTree !== 'object' || Array.isArray(installedTree)) {
    fail('runtime manifest must define release_receipt.installed_tree');
  }
  if (!isDeepStrictEqual(Object.keys(installedTree).sort(), [
    'directory_mode',
    'disallow_group_or_other_write',
    'gid',
    'receipt_mode',
    'root_mode',
    'tracked_file_modes_from_git',
    'uid',
  ])) {
    fail('runtime manifest installed_tree policy has unexpected fields');
  }
  for (const field of ['uid', 'gid']) {
    if (!Number.isSafeInteger(installedTree[field]) || installedTree[field] < 0) {
      fail(`runtime manifest installed_tree.${field} must be a non-negative integer`);
    }
  }
  for (const field of ['root_mode', 'directory_mode', 'receipt_mode']) {
    if (!/^0[0-7]{3}$/u.test(installedTree[field])) {
      fail(`runtime manifest installed_tree.${field} must be a four-digit octal mode`);
    }
  }
  for (const field of ['tracked_file_modes_from_git', 'disallow_group_or_other_write']) {
    if (typeof installedTree[field] !== 'boolean') {
      fail(`runtime manifest installed_tree.${field} must be boolean`);
    }
  }
  if (
    profile === 'live'
    && !isDeepStrictEqual(installedTree, {
      uid: 0,
      gid: 0,
      root_mode: '0755',
      directory_mode: '0755',
      receipt_mode: '0644',
      tracked_file_modes_from_git: true,
      disallow_group_or_other_write: true,
    })
  ) {
    fail('live runtime manifest must require a root-owned, non-runtime-writable installed tree and root:root 0644 receipt');
  }

  if (!Array.isArray(manifest.release_receipt.privileged_files) || manifest.release_receipt.privileged_files.length === 0) {
    fail('runtime manifest must define release_receipt.privileged_files');
  }
  const seenSources = new Set();
  const seenTargets = new Set();
  const privilegedFiles = manifest.release_receipt.privileged_files.map((mapping) => {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
      fail('runtime manifest privileged file mapping must be an object');
    }
    if (!isDeepStrictEqual(Object.keys(mapping).sort(), ['gid', 'mode', 'source', 'target', 'uid'])) {
      fail('runtime manifest privileged file mapping has unexpected fields');
    }
    const source = normalizedRelativePath(mapping.source, 'privileged file source');
    const target = normalizedRelativePath(mapping.target, 'privileged file target');
    if (!/^0[0-7]{3}$/u.test(mapping.mode)) fail(`privileged file mode is invalid: ${mapping.mode}`);
    for (const field of ['uid', 'gid']) {
      if (!Number.isSafeInteger(mapping[field]) || mapping[field] < 0) {
        fail(`privileged file ${field} is invalid: ${mapping.target}`);
      }
    }
    if (profile === 'live' && (mapping.uid !== 0 || mapping.gid !== 0)) {
      fail(`live privileged file must be root:root: ${target}`);
    }
    if (!repository.sourceFilesSha256[source]) fail(`privileged file source is not tracked: ${source}`);
    if (seenSources.has(source)) fail(`duplicate privileged file source: ${source}`);
    if (seenTargets.has(target)) fail(`duplicate privileged file target: ${target}`);
    seenSources.add(source);
    seenTargets.add(target);
    return { source, target, mode: mapping.mode, uid: mapping.uid, gid: mapping.gid };
  });
  privilegedFiles.sort((left, right) => left.target < right.target ? -1 : left.target > right.target ? 1 : 0);
  return {
    manifest,
    manifestSha256: sha256(contents),
    restrictedCdciPath,
    dependency: {
      path: dependencyPath,
      lockfiles: [...dependencyLockfiles].sort(),
    },
    systemdFiles: structuredClone(systemdFiles),
    installedTree: structuredClone(installedTree),
    privilegedFiles,
  };
}

function isRestrictedInstalledPath(relativePath, restrictedCdciPath) {
  const normalized = relativePath.toLowerCase();
  const segments = normalized.split('/');
  const restricted = restrictedCdciPath.toLowerCase();
  if (normalized === restricted || normalized.startsWith(`${restricted}/`)) return true;
  if (segments.includes('restricted') || segments[0] === 'data-drops') return true;
  if (
    ['data', 'dist', 'export', 'exports'].includes(segments[0])
    && segments.some((segment) => /(?:^|[-_.])cdci(?:[-_.]|$)/u.test(segment))
  ) return true;
  return /snomedct[_-]indiadrugextension/iu.test(relativePath);
}

function isRestrictedExportPath(relativePath) {
  const segments = relativePath.toLowerCase().split('/');
  return segments.some((segment) => (
    segment === 'restricted'
    || /(?:^|[-_.])cdci(?:[-_.]|$)/u.test(segment)
    || /snomedct[_-]indiadrugextension/iu.test(segment)
  ));
}

function isRestrictedSourceIdentity(value) {
  if (typeof value !== 'string') return false;
  const compact = value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/gu, '');
  return compact.includes('cdci')
    || compact.includes('commondrugcodesforindia')
    || compact.includes('indiadrugextension')
    || compact.includes('in1000189')
    || (compact.includes('snomed') && compact.includes('india') && compact.includes('drug'));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireExportSha(value, label) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    fail(`${label} is not a SHA-256 identity`);
  }
}

function requireExportHashMap(value, label) {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    fail(`${label} is not a non-empty SHA-256 hash map`);
  }
  for (const [relativePath, digest] of Object.entries(value)) {
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
      fail(`${label} contains an invalid path`);
    }
    requireExportSha(digest, `${label} entry ${relativePath}`);
  }
}

function requireExportCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} is invalid`);
}

function validateManagedExportManifest(manifest, relativePath, snapshotDate) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail(`managed export manifest must be an object: ${relativePath}`);
  }
  if (manifest.schema_version !== 4 || manifest.stage_kind !== 'aushadhi-export-snapshot') {
    fail(`managed export manifest has an unsupported schema or stage kind: ${relativePath}`);
  }
  if (manifest.release_date !== snapshotDate) {
    fail(`managed export manifest release_date mismatch: ${relativePath}`);
  }
  if (typeof manifest.generation_id !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(manifest.generation_id)
    || isRestrictedSourceIdentity(manifest.generation_id)) {
    fail(`managed export manifest generation_id is invalid: ${relativePath}`);
  }

  const cohort = manifest.cohort;
  if (!isRecord(cohort) || cohort.schema_version !== 1 || !isRecord(cohort.files)) {
    fail(`managed export manifest cohort identity is invalid: ${relativePath}`);
  }
  requireExportSha(cohort.manifest_sha256, `managed export ${snapshotDate} cohort manifest hash`);
  for (const name of ['drugs.jsonl', 'prescribable.jsonl', 'summary.json']) {
    const entry = cohort.files[name];
    if (!isRecord(entry)) fail(`managed export ${snapshotDate} cohort does not bind ${name}`);
    requireExportSha(entry.sha256, `managed export ${snapshotDate} ${name} hash`);
    requireExportCount(entry.size_bytes, `managed export ${snapshotDate} ${name} size`);
  }
  for (const name of ['drugs.jsonl', 'prescribable.jsonl']) {
    requireExportCount(
      cohort.files[name].record_count,
      `managed export ${snapshotDate} ${name} record count`,
    );
  }

  const source = manifest.source;
  const expectedSource = cohort.files['drugs.jsonl'];
  if (!isRecord(source)
    || source.path !== `.generations/${manifest.generation_id}/drugs.jsonl`
    || source.sha256 !== expectedSource.sha256
    || source.size_bytes !== expectedSource.size_bytes
    || source.record_count !== expectedSource.record_count) {
    fail(`managed export ${snapshotDate} source is not bound to its cohort`);
  }
  const prescribable = manifest.prescribable;
  const expectedPrescribable = cohort.files['prescribable.jsonl'];
  if (!isRecord(prescribable)
    || prescribable.uncompressed_sha256 !== expectedPrescribable.sha256
    || prescribable.uncompressed_size_bytes !== expectedPrescribable.size_bytes
    || prescribable.record_count !== expectedPrescribable.record_count) {
    fail(`managed export ${snapshotDate} prescribable artifact is not bound to its cohort`);
  }

  const codeRelease = manifest.code_release;
  if (!isRecord(codeRelease) || !COMMIT_PATTERN.test(codeRelease.repository_commit ?? '')) {
    fail(`managed export ${snapshotDate} release identity is invalid`);
  }
  for (const field of [
    'repository_tree_sha256',
    'runtime_manifest_sha256',
    'dependency_tree_sha256',
    'release_receipt_sha256',
  ]) {
    requireExportSha(codeRelease[field], `managed export ${snapshotDate} ${field}`);
  }
  for (const field of [
    'installed_files_sha256',
    'systemd_files_sha256',
    'privileged_files_sha256',
  ]) {
    requireExportHashMap(codeRelease[field], `managed export ${snapshotDate} ${field}`);
  }

  if (!isDeepStrictEqual(manifest.artifact_policy, {
    profile: 'internal-evaluation',
    redistributable: false,
    production_authority: 'none',
  })) {
    fail(`managed export manifest has an unsafe artifact policy: ${relativePath}`);
  }
  if (!Array.isArray(manifest.source_list) || manifest.source_list.length === 0) {
    fail(`managed export manifest source_list is missing: ${relativePath}`);
  }
  const seen = new Set();
  for (const source of manifest.source_list) {
    if (
      !source
      || typeof source !== 'object'
      || Array.isArray(source)
      || !isDeepStrictEqual(Object.keys(source).sort(), ['record_count', 'source_id'])
      || typeof source.source_id !== 'string'
      || source.source_id.length === 0
      || typeof source.record_count !== 'number'
      || !Number.isSafeInteger(source.record_count)
      || source.record_count < 0
      || seen.has(source.source_id)
    ) {
      fail(`managed export manifest source_list is invalid: ${relativePath}`);
    }
    if (isRestrictedSourceIdentity(source.source_id)) {
      fail(`restricted export CDCI/SNOMED India Drug source_list identity is forbidden: ${relativePath}`);
    }
    seen.add(source.source_id);
  }

  const recovery = manifest.recovery_policy;
  if (!isRecord(recovery)
    || recovery.critical_state_required !== true
    || recovery.sqlite_backup_method !== 'sqlite-online-backup'
    || recovery.restricted_cdci_exported !== false
    || recovery.licensed_recovery_boundary !== 'internal-recovery-only') {
    fail(`managed export ${snapshotDate} recovery policy is incomplete`);
  }
  if (!Array.isArray(recovery.generic_archive_excludes)
    || !['restricted', 'SQLite', 'WAL', 'SHM'].every((entry) => (
      recovery.generic_archive_excludes.includes(entry)
    ))) {
    fail(`managed export ${snapshotDate} recovery exclusions are incomplete`);
  }
  if (!Array.isArray(recovery.ephemeral_state_excludes)
    || ![
      'state.json.crawler-state.lock',
      '.build.lock',
      '.export.lock',
      '.state.json.tmp-*',
    ].every((entry) => recovery.ephemeral_state_excludes.includes(entry))) {
    fail(`managed export ${snapshotDate} ephemeral state exclusions are incomplete`);
  }
  if (manifest.state_note !== 'ok') fail(`managed export ${snapshotDate} critical state is not verified`);
  if (!Array.isArray(manifest.databases)) {
    fail(`managed export ${snapshotDate} database backup list is invalid`);
  }
  return { cohortFiles: cohort.files, generationId: manifest.generation_id };
}

async function stableDigestExportFile(exportRoot, relativePath, label, {
  capture = false,
  maxCaptureBytes,
} = {}) {
  const file = await requireRegularFileWithin(exportRoot, relativePath, label);
  if (!file) fail(`${label} is missing: ${relativePath}`);
  const handle = await open(file, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile()) fail(`${label} is not a regular file: ${relativePath}`);
    if (capture && Number.isSafeInteger(maxCaptureBytes) && before.size > maxCaptureBytes) {
      fail(`${label} exceeds ${maxCaptureBytes} bytes: ${relativePath}`);
    }
    const hash = createHash('sha256');
    const chunks = capture ? [] : null;
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;
      const chunk = buffer.subarray(0, bytesRead);
      hash.update(chunk);
      if (chunks) chunks.push(Buffer.from(chunk));
      position += bytesRead;
    }
    const after = await handle.stat();
    for (const field of ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs']) {
      if (before[field] !== after[field]) fail(`${label} changed while verifying: ${relativePath}`);
    }
    const current = await lstat(file);
    if (!current.isFile() || current.isSymbolicLink()
      || current.dev !== before.dev || current.ino !== before.ino) {
      fail(`${label} changed path identity while verifying: ${relativePath}`);
    }
    return {
      contents: chunks ? Buffer.concat(chunks) : null,
      sha256: hash.digest('hex'),
      size: position,
    };
  } finally {
    await handle.close();
  }
}

async function verifyManagedExportArtifact(exportRoot, snapshotDate, entry, label) {
  if (!isRecord(entry)) fail(`${label} metadata is missing`);
  const name = entry.filename;
  if (typeof name !== 'string'
    || name.length === 0
    || name === '.'
    || name === '..'
    || path.posix.basename(name) !== name) {
    fail(`${label} has an unsafe filename`);
  }
  if (isRestrictedSourceIdentity(name) || isRestrictedExportPath(name)) {
    fail(`${label} crosses the CDCI exclusion boundary`);
  }
  requireExportCount(entry.size_bytes, `${label} size`);
  requireExportSha(entry.sha256, `${label} hash`);
  const relativePath = `${snapshotDate}/${name}`;
  const actual = await stableDigestExportFile(exportRoot, relativePath, label);
  if (actual.size !== entry.size_bytes) fail(`${label}: ${name} size mismatch`);
  if (actual.sha256 !== entry.sha256) fail(`${label}: ${name} hash mismatch`);
  return name;
}

async function enumerateFiles(root, label, { skipDirectory = null } = {}) {
  await requireUnsymlinkedDirectory(root, label);
  const files = [];
  async function walk(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) fail(`symlink is forbidden in ${label}: ${relativePath}`);
      const absolutePath = safeJoin(root, relativePath, `${label} path`);
      if (entry.isDirectory()) {
        if (relativePath === skipDirectory) continue;
        await walk(absolutePath, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      } else {
        fail(`non-regular entry is forbidden in ${label}: ${relativePath}`);
      }
    }
  }
  await walk(path.resolve(root), '');
  return files;
}

async function inspectInstalledTree({
  installedRoot,
  receiptPath,
  repository,
  restrictedCdciPath,
  dependencyPath,
}) {
  const excludedReceipt = isPathInside(installedRoot, receiptPath)
    ? path.relative(installedRoot, receiptPath).replaceAll('\\', '/')
    : null;
  const actualFiles = await enumerateFiles(installedRoot, 'installed root', {
    skipDirectory: dependencyPath,
  });
  const actualSet = new Set(actualFiles.filter((relativePath) => relativePath !== excludedReceipt));
  const expectedSet = new Set(repository.trackedFiles.map((entry) => entry.relativePath));

  for (const relativePath of actualSet) {
    if (isRestrictedInstalledPath(relativePath, restrictedCdciPath)) {
      fail(`restricted installed material is forbidden: ${relativePath}`);
    }
    if (!expectedSet.has(relativePath)) fail(`unexpected installed file is not tracked: ${relativePath}`);
  }

  const installedFilesSha256 = Object.create(null);
  for (const tracked of repository.trackedFiles) {
    const relativePath = tracked.relativePath;
    if (isRestrictedInstalledPath(relativePath, restrictedCdciPath)) {
      fail(`restricted tracked material cannot be installed: ${relativePath}`);
    }
    if (!actualSet.has(relativePath)) fail(`missing required installed file: ${relativePath}`);
    const installedFile = await requireRegularFileWithin(
      installedRoot,
      relativePath,
      `installed file ${relativePath}`,
    );
    if (!installedFile) fail(`missing required installed file: ${relativePath}`);
    const digest = sha256(await readFile(installedFile));
    const expected = repository.sourceFilesSha256[relativePath];
    if (digest !== expected) fail(`installed file hash mismatch: ${relativePath}`);
    installedFilesSha256[relativePath] = digest;
  }
  return Object.fromEntries(Object.entries(installedFilesSha256));
}

function expectedSystemdSources(repository) {
  const sources = new Map();
  for (const tracked of repository.trackedFiles) {
    if (!tracked.relativePath.startsWith(SYSTEMD_SOURCE_PREFIX)) continue;
    const remainder = tracked.relativePath.slice(SYSTEMD_SOURCE_PREFIX.length);
    if (remainder.includes('/') || !SYSTEMD_FILE_PATTERN.test(remainder)) continue;
    if (sources.has(remainder)) fail(`duplicate systemd source name: ${remainder}`);
    sources.set(remainder, tracked.relativePath);
  }
  if (sources.size === 0) fail('source checkout has no tracked Aushadhi systemd files');
  return [...sources.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
}

async function inspectSystemdTree(systemdRoot, repository, policy) {
  await requireUnsymlinkedDirectory(systemdRoot, 'systemd root');
  const expected = expectedSystemdSources(repository);
  const directEntries = await readdir(systemdRoot, { withFileTypes: true });
  const expectedNames = new Set(expected.map(([name]) => name));
  for (const entry of directEntries) {
    if (entry.isSymbolicLink() && expectedNames.has(entry.name)) {
      fail(`symlink is forbidden for systemd file: ${entry.name}`);
    }
    if (SYSTEMD_FILE_PATTERN.test(entry.name) && !expectedNames.has(entry.name)) {
      fail(`unexpected Aushadhi systemd file: ${entry.name}`);
    }
    if (/^aushadhi-[a-z0-9-]+\.(?:service|timer)\.d$/u.test(entry.name)) {
      fail(`unexpected legacy Aushadhi systemd drop-in directory: ${entry.name}`);
    }
  }

  const systemdFilesSha256 = Object.create(null);
  for (const [name, sourceRelativePath] of expected) {
    const systemdFile = await requireRegularFileWithin(systemdRoot, name, `systemd file ${name}`);
    if (!systemdFile) fail(`missing required systemd file: ${name}`);
    const information = await lstat(systemdFile);
    const actualMode = modeString(information);
    if (actualMode !== policy.mode) {
      fail(`systemd file mode mismatch: ${name} expected ${policy.mode}, found ${actualMode}`);
    }
    if (information.uid !== policy.uid || information.gid !== policy.gid) {
      fail(
        `systemd file ownership mismatch: ${name} expected ${policy.uid}:${policy.gid}, `
          + `found ${information.uid}:${information.gid}`,
      );
    }
    const digest = sha256(await readFile(systemdFile));
    if (digest !== repository.sourceFilesSha256[sourceRelativePath]) {
      fail(`systemd file hash mismatch: ${name}`);
    }
    systemdFilesSha256[name] = digest;
  }
  return Object.fromEntries(Object.entries(systemdFilesSha256));
}

async function inspectExportRoots(exportRoots) {
  for (const exportRoot of exportRoots) {
    await requireUnsymlinkedDirectory(exportRoot, `export root ${exportRoot}`);
    const rootEntries = await readdir(exportRoot, { withFileTypes: true });
    rootEntries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    const initialRootNames = rootEntries.map((entry) => entry.name);
    const snapshots = [];
    for (const entry of rootEntries) {
      if (entry.isSymbolicLink()) fail(`symlink is forbidden in export root ${exportRoot}: ${entry.name}`);
      if (entry.name === '.export.lock') {
        if (!entry.isFile()) fail(`export root lock must be a regular file: ${entry.name}`);
        continue;
      }
      const parsedDate = /^\d{4}-\d{2}-\d{2}$/u.test(entry.name)
        ? new Date(`${entry.name}T00:00:00.000Z`)
        : null;
      if (!parsedDate
        || !Number.isFinite(parsedDate.getTime())
        || parsedDate.toISOString().slice(0, 10) !== entry.name) {
        fail(`unexpected export-root entry is not a managed snapshot date: ${entry.name}`);
      }
      if (!entry.isDirectory()) fail(`managed export snapshot must be a physical directory: ${entry.name}`);
      snapshots.push(entry.name);
    }

    for (const snapshotDate of snapshots) {
      const snapshotRoot = safeJoin(exportRoot, snapshotDate, 'managed export snapshot path');
      const snapshotEntries = await readdir(snapshotRoot, { withFileTypes: true });
      snapshotEntries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
      const actualNames = snapshotEntries.map((entry) => entry.name);
      for (const entry of snapshotEntries) {
        if (entry.isSymbolicLink() || !entry.isFile()) {
          fail(`managed export snapshot contains a non-regular entry: ${snapshotDate}/${entry.name}`);
        }
        if (isRestrictedExportPath(entry.name)) {
          fail(`restricted export material is forbidden: ${snapshotDate}/${entry.name}`);
        }
      }

      const manifestRelativePath = `${snapshotDate}/stage-manifest.json`;
      const manifestDigest = await stableDigestExportFile(
        exportRoot,
        manifestRelativePath,
        `managed export manifest ${manifestRelativePath}`,
        { capture: true, maxCaptureBytes: 4 * 1024 * 1024 },
      );
      let manifest;
      try {
        manifest = JSON.parse(manifestDigest.contents.toString('utf8'));
      } catch (error) {
        fail(`managed export manifest is invalid JSON: ${manifestRelativePath}: ${error.message}`);
      }
      validateManagedExportManifest(manifest, manifestRelativePath, snapshotDate);

      const expectedNames = new Set(['stage-manifest.json']);
      const addExpected = async (entry, label) => {
        const name = await verifyManagedExportArtifact(exportRoot, snapshotDate, entry, label);
        if (expectedNames.has(name)) fail(`managed export ${snapshotDate} repeats artifact filename: ${name}`);
        expectedNames.add(name);
      };
      await addExpected(manifest.artifact, `managed export ${snapshotDate} drugs artifact`);
      await addExpected(manifest.prescribable, `managed export ${snapshotDate} prescribable artifact`);
      if (!isRecord(manifest.state_snapshot) || manifest.state_snapshot.verification !== 'required') {
        fail(`managed export ${snapshotDate} state snapshot is not required`);
      }
      await addExpected(manifest.state_snapshot, `managed export ${snapshotDate} state snapshot`);
      if (manifest.review_shortlist !== null && manifest.review_shortlist !== undefined) {
        await addExpected(manifest.review_shortlist, `managed export ${snapshotDate} review shortlist`);
      }
      for (let index = 0; index < manifest.databases.length; index += 1) {
        const database = manifest.databases[index];
        if (!isRecord(database) || database.verification !== 'verified-online-backup') {
          fail(`managed export ${snapshotDate} SQLite backup ${index} is not verified`);
        }
        const sourceRelativePath = normalizedRelativePath(
          database.source_relative_path,
          `managed export ${snapshotDate} SQLite backup ${index} source path`,
        );
        if (isRestrictedSourceIdentity(sourceRelativePath)) {
          fail(`managed export ${snapshotDate} SQLite backup ${index} crosses the CDCI exclusion boundary`);
        }
        await addExpected({
          filename: database.snapshot,
          size_bytes: database.snapshot_size_bytes,
          sha256: database.snapshot_sha256,
        }, `managed export ${snapshotDate} SQLite backup ${index}`);
      }
      const expectedSorted = [...expectedNames].sort();
      if (!isDeepStrictEqual(actualNames, expectedSorted)) {
        fail(`managed export ${snapshotDate} has missing or unexpected export artifacts`);
      }
      const finalSnapshotNames = (await readdir(snapshotRoot)).sort();
      if (!isDeepStrictEqual(finalSnapshotNames, actualNames)) {
        fail(`managed export ${snapshotDate} changed while verifying`);
      }
    }

    const finalRootNames = (await readdir(exportRoot)).sort();
    if (!isDeepStrictEqual(finalRootNames, initialRootNames)) {
      fail(`export root changed while verifying: ${exportRoot}`);
    }
  }
}

function modeString(information) {
  return (information.mode & 0o7777).toString(8).padStart(4, '0');
}

function requireOwnership(information, policy, label) {
  if (information.uid !== policy.uid || information.gid !== policy.gid) {
    fail(
      `${label} ownership mismatch: expected ${policy.uid}:${policy.gid}, `
        + `found ${information.uid}:${information.gid}`,
    );
  }
}

function requireMode(information, expected, label) {
  const actual = modeString(information);
  if (actual !== expected) fail(`${label} mode mismatch: expected ${expected}, found ${actual}`);
  return actual;
}

function requireNonRuntimeWritable(information, policy, label) {
  if (policy.disallow_group_or_other_write && (information.mode & 0o022) !== 0) {
    fail(`${label} is group/other writable: ${modeString(information)}`);
  }
}

async function inspectInstalledTreeMetadata({
  installedRoot,
  receiptPath,
  repository,
  policy,
}) {
  await requireUnsymlinkedDirectory(installedRoot, 'installed root');
  const excludedReceipt = isPathInside(installedRoot, receiptPath)
    ? path.relative(installedRoot, receiptPath).replaceAll('\\', '/')
    : null;
  const trackedModes = new Map(repository.trackedFiles.map(({ mode, relativePath }) => [
    relativePath,
    mode === '100755' ? '0755' : '0644',
  ]));
  const hasher = createHash('sha256');
  hasher.update('aushadhi-installed-tree-metadata-v1\0');

  const rootInformation = await lstat(installedRoot);
  requireOwnership(rootInformation, policy, 'installed root');
  const rootMode = requireMode(rootInformation, policy.root_mode, 'installed root');
  requireNonRuntimeWritable(rootInformation, policy, 'installed root');
  hasher.update(`d\0.\0${rootMode}\0${rootInformation.uid}\0${rootInformation.gid}\0`);

  async function walk(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (relativePath === excludedReceipt) continue;
      const absolutePath = safeJoin(installedRoot, relativePath, 'installed metadata entry');
      const information = await lstat(absolutePath);
      requireOwnership(information, policy, `installed ${entry.isDirectory() ? 'directory' : 'entry'} ${relativePath}`);
      const actualMode = modeString(information);
      let kind;
      if (information.isDirectory()) {
        kind = 'd';
        requireMode(information, policy.directory_mode, `installed directory ${relativePath}`);
        requireNonRuntimeWritable(information, policy, `installed directory ${relativePath}`);
      } else if (information.isFile()) {
        kind = 'f';
        const trackedMode = trackedModes.get(relativePath);
        if (trackedMode && policy.tracked_file_modes_from_git) {
          requireMode(information, trackedMode, `installed tracked file ${relativePath}`);
        }
        requireNonRuntimeWritable(information, policy, `installed file ${relativePath}`);
      } else if (information.isSymbolicLink()) {
        kind = 'l';
      } else {
        fail(`non-regular installed metadata entry is forbidden: ${relativePath}`);
      }
      hasher.update(`${kind}\0${relativePath}\0${actualMode}\0${information.uid}\0${information.gid}\0`);
      if (information.isDirectory()) await walk(absolutePath, relativePath);
    }
  }

  await walk(path.resolve(installedRoot), '');
  return hasher.digest('hex');
}

async function inspectReceiptFile(receiptPath, policy) {
  await requireUnsymlinkedDirectory(path.dirname(path.resolve(receiptPath)), 'receipt directory');
  const information = await lstat(receiptPath).catch((error) => {
    if (error?.code === 'ENOENT') fail(`release receipt does not exist: ${receiptPath}`);
    throw error;
  });
  if (information.isSymbolicLink()) fail('release receipt must not be a symlink');
  if (!information.isFile()) fail('release receipt must be a regular file');
  requireOwnership(information, policy, 'release receipt');
  requireMode(information, policy.receipt_mode, 'release receipt');
  requireNonRuntimeWritable(information, policy, 'release receipt');
  return information;
}

async function inspectDependencyTree(installedRoot, dependency, restrictedCdciPath) {
  const dependencyRoot = safeJoin(installedRoot, dependency.path, 'dependency tree path');
  await requireUnsymlinkedDirectory(dependencyRoot, 'dependency tree');
  const dependencyRealRoot = await realpath(dependencyRoot);
  const hasher = createHash('sha256');
  hasher.update('aushadhi-dependency-tree-v1\0');
  const rootInformation = await lstat(dependencyRoot);
  hasher.update(`d\0.\0${modeString(rootInformation)}\0`);
  let fileCount = 0;

  async function walk(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = safeJoin(dependencyRoot, relativePath, 'dependency entry');
      const information = await lstat(absolutePath);
      if (isRestrictedInstalledPath(`${dependency.path}/${relativePath}`, restrictedCdciPath)) {
        fail(`restricted installed material is forbidden in dependency tree: ${relativePath}`);
      }
      if (information.isSymbolicLink()) {
        const target = await readlink(absolutePath);
        if (path.isAbsolute(target) || path.win32.isAbsolute(target)) {
          fail(`dependency symlink must be relative: ${relativePath}`);
        }
        const resolvedTarget = path.resolve(path.dirname(absolutePath), target);
        if (!isPathInside(dependencyRoot, resolvedTarget)) {
          fail(`dependency symlink escapes node_modules: ${relativePath}`);
        }
        let realTarget;
        try {
          realTarget = await realpath(resolvedTarget);
        } catch (error) {
          if (error?.code === 'ENOENT') fail(`dependency symlink is dangling: ${relativePath}`);
          throw error;
        }
        if (!isPathInside(dependencyRealRoot, realTarget)) {
          fail(`dependency symlink resolves outside node_modules: ${relativePath}`);
        }
        hasher.update(`l\0${relativePath}\0${target.replaceAll('\\', '/')}\0`);
      } else if (information.isDirectory()) {
        hasher.update(`d\0${relativePath}\0${modeString(information)}\0`);
        await walk(absolutePath, relativePath);
      } else if (information.isFile()) {
        const contents = await readFile(absolutePath);
        hasher.update(`f\0${relativePath}\0${modeString(information)}\0${contents.length}\0${sha256(contents)}\0`);
        fileCount += 1;
      } else {
        fail(`non-regular dependency entry is forbidden: ${relativePath}`);
      }
    }
  }

  await walk(dependencyRoot, '');
  if (fileCount === 0) fail('required dependency tree contains no regular files');
  return hasher.digest('hex');
}

async function inspectPrivilegedFiles(privilegedRoot, mappings, repository) {
  await requireUnsymlinkedDirectory(privilegedRoot, 'privileged root');
  const allowedTargets = new Set(mappings.map(({ target }) => target));
  for (const directoryPath of [
    'usr/local/libexec',
    'usr/local/sbin',
    'etc/sudoers.d',
    'etc/logrotate.d',
  ]) {
    const absoluteDirectory = safeJoin(privilegedRoot, directoryPath, 'privileged topology directory');
    let information;
    try {
      information = await lstat(absoluteDirectory);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    if (information.isSymbolicLink()) fail(`symlink is forbidden in privileged topology: ${directoryPath}`);
    if (!information.isDirectory()) fail(`privileged topology path is not a directory: ${directoryPath}`);
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const target = `${directoryPath}/${entry.name}`;
      if (/^\.?aushadhi/iu.test(entry.name) && !allowedTargets.has(target)) {
        fail(`unexpected Aushadhi privileged file: ${target}`);
      }
    }
  }
  const hashes = Object.create(null);
  for (const mapping of mappings) {
    const targetFile = await requireRegularFileWithin(
      privilegedRoot,
      mapping.target,
      `privileged file ${mapping.target}`,
    );
    if (!targetFile) fail(`missing required privileged file: ${mapping.target}`);
    const information = await lstat(targetFile);
    const actualMode = modeString(information);
    if (actualMode !== mapping.mode) {
      fail(`privileged file mode mismatch: ${mapping.target} expected ${mapping.mode}, found ${actualMode}`);
    }
    if (information.uid !== mapping.uid || information.gid !== mapping.gid) {
      fail(
        `privileged file ownership mismatch: ${mapping.target} expected ${mapping.uid}:${mapping.gid}, `
          + `found ${information.uid}:${information.gid}`,
      );
    }
    const digest = sha256(await readFile(targetFile));
    if (digest !== repository.sourceFilesSha256[mapping.source]) {
      fail(`privileged file hash mismatch: ${mapping.target}`);
    }
    hashes[mapping.target] = digest;
  }
  return Object.fromEntries(Object.entries(hashes));
}

function assertRepositoryStillClean(sourceRoot, repositoryCommit) {
  const dirty = runGit(sourceRoot, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--ignore-submodules=none',
  ]);
  if (dirty.length > 0) fail('source Git checkout changed while the release receipt was being calculated');
  const currentCommit = runGit(sourceRoot, ['rev-parse', '--verify', 'HEAD']).toString('utf8').trim();
  if (currentCommit !== repositoryCommit) fail('source Git commit changed while the release receipt was being calculated');
}

function validateInstalledAt(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    fail('installed_at_utc must be a canonical UTC timestamp such as 2026-08-06T01:02:03.000Z');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    fail(`installed_at_utc is invalid: ${value}`);
  }
}

async function computeExpectedReceipt(options, installedAtUtc) {
  const sourceRoot = path.resolve(options.sourceRoot);
  const installedRoot = path.resolve(options.installedRoot);
  const systemdRoot = path.resolve(options.systemdRoot);
  const privilegedRoot = path.resolve(options.privilegedRoot);
  const receiptPath = path.resolve(options.receiptPath);
  const inspection = assertInspectionBoundary({ ...options, receiptPath });
  const repository = await inspectCleanRepository(sourceRoot);
  const runtime = await readRuntimeManifest(
    options.runtimeManifest,
    sourceRoot,
    repository,
    inspection.profile,
  );
  const dependencyRoot = safeJoin(installedRoot, runtime.dependency.path, 'dependency tree path');
  if (isPathInside(dependencyRoot, receiptPath)) {
    fail('release receipt path must not be inside node_modules');
  }
  const installedFilesSha256 = await inspectInstalledTree({
    installedRoot,
    receiptPath,
    repository,
    restrictedCdciPath: runtime.restrictedCdciPath,
    dependencyPath: runtime.dependency.path,
  });
  const installedTreeMetadataSha256 = await inspectInstalledTreeMetadata({
    installedRoot,
    receiptPath,
    repository,
    policy: runtime.installedTree,
  });
  const dependencyTreeSha256 = await inspectDependencyTree(
    installedRoot,
    runtime.dependency,
    runtime.restrictedCdciPath,
  );
  const systemdFilesSha256 = await inspectSystemdTree(
    systemdRoot,
    repository,
    runtime.systemdFiles,
  );
  const privilegedFilesSha256 = await inspectPrivilegedFiles(
    privilegedRoot,
    runtime.privilegedFiles,
    repository,
  );
  await inspectExportRoots(options.exportRoots);
  assertRepositoryStillClean(sourceRoot, repository.repositoryCommit);

  const receipt = {
    schema_version: RECEIPT_SCHEMA_VERSION,
    repository_commit: repository.repositoryCommit,
    repository_tree_sha256: repository.repositoryTreeSha256,
    installed_at_utc: installedAtUtc,
    installed_files_sha256: installedFilesSha256,
    installed_tree_metadata_sha256: installedTreeMetadataSha256,
    systemd_files_sha256: systemdFilesSha256,
    dependency_tree_sha256: dependencyTreeSha256,
    privileged_files_sha256: privilegedFilesSha256,
    runtime_manifest_sha256: runtime.manifestSha256,
    inspection_profile: inspection.profile,
    inspected_roots: inspection.roots,
    filesystem_policy: {
      installed_tree: structuredClone(runtime.installedTree),
      systemd_files: structuredClone(runtime.systemdFiles),
      privileged_files: runtime.privilegedFiles.map(({ target, mode, uid, gid }) => ({
        target,
        mode,
        uid,
        gid,
      })),
    },
    artifact_policy: structuredClone(runtime.manifest.artifact_policy),
  };
  for (const field of runtime.manifest.release_receipt.required_fields) {
    if (!Object.hasOwn(receipt, field)) fail(`generated receipt does not implement manifest-required field: ${field}`);
  }
  return receipt;
}

async function writeReceiptAtomically(outputPath, receipt) {
  const output = path.resolve(outputPath);
  const parent = path.dirname(output);
  const policy = receipt.filesystem_policy?.installed_tree;
  if (!policy) fail('generated receipt omits installed-tree filesystem policy');
  await requireUnsymlinkedDirectory(parent, 'receipt output directory');
  try {
    await lstat(output);
    fail(`receipt output already exists: ${output}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const temporary = path.join(parent, `.${path.basename(output)}.${process.pid}.${Date.now()}.tmp`);
  let handle;
  let linked = false;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    await handle.chmod(Number.parseInt(policy.receipt_mode, 8));
    await handle.sync();
    await handle.close();
    handle = null;
    try {
      await link(temporary, output);
      linked = true;
    } catch (error) {
      if (error?.code === 'EEXIST') fail(`receipt output already exists: ${output}`);
      throw error;
    }
    await inspectReceiptFile(output, policy);
  } catch (error) {
    if (linked) await rm(output, { force: true }).catch(() => {});
    throw error;
  } finally {
    if (handle) await handle.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
  }
}

function requireHashMap(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object`);
  for (const [relativePath, digest] of Object.entries(value)) {
    normalizedRelativePath(relativePath, `${field} key`);
    if (!HASH_PATTERN.test(digest)) fail(`${field} contains an invalid hash: ${relativePath}`);
  }
}

async function verifyReceipt(options) {
  await requireUnsymlinkedDirectory(path.dirname(path.resolve(options.receiptPath)), 'receipt directory');
  const receiptInformation = await lstat(options.receiptPath).catch((error) => {
    if (error?.code === 'ENOENT') fail(`release receipt does not exist: ${options.receiptPath}`);
    throw error;
  });
  if (receiptInformation.isSymbolicLink()) fail('release receipt must not be a symlink');
  if (!receiptInformation.isFile()) fail('release receipt must be a regular file');
  let supplied;
  try {
    supplied = JSON.parse(await readFile(options.receiptPath, 'utf8'));
  } catch (error) {
    fail(`cannot read release receipt: ${error.message}`);
  }
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) fail('release receipt must be an object');
  if (supplied.schema_version !== RECEIPT_SCHEMA_VERSION) fail('release receipt schema_version mismatch');
  if (!COMMIT_PATTERN.test(supplied.repository_commit ?? '')) fail('release receipt repository_commit is invalid');
  if (!HASH_PATTERN.test(supplied.repository_tree_sha256 ?? '')) fail('release receipt repository_tree_sha256 is invalid');
  validateInstalledAt(supplied.installed_at_utc);
  requireHashMap(supplied.installed_files_sha256, 'installed_files_sha256');
  requireHashMap(supplied.systemd_files_sha256, 'systemd_files_sha256');
  if (!HASH_PATTERN.test(supplied.dependency_tree_sha256 ?? '')) {
    fail('release receipt dependency_tree_sha256 is invalid');
  }
  if (!HASH_PATTERN.test(supplied.installed_tree_metadata_sha256 ?? '')) {
    fail('release receipt installed_tree_metadata_sha256 is invalid');
  }
  requireHashMap(supplied.privileged_files_sha256, 'privileged_files_sha256');
  if (!HASH_PATTERN.test(supplied.runtime_manifest_sha256 ?? '')) fail('release receipt runtime_manifest_sha256 is invalid');
  const selectedProfile = inspectionProfile(options);
  if (supplied.inspection_profile !== selectedProfile) {
    fail(`release receipt inspection_profile mismatch: expected ${selectedProfile}`);
  }

  const expected = await computeExpectedReceipt(options, supplied.installed_at_utc);
  await inspectReceiptFile(options.receiptPath, expected.filesystem_policy.installed_tree);
  if (!isDeepStrictEqual(supplied.artifact_policy, expected.artifact_policy)) {
    fail('release receipt artifact_policy mismatch');
  }
  if (supplied.repository_commit !== expected.repository_commit) fail('release receipt repository_commit mismatch');
  if (supplied.repository_tree_sha256 !== expected.repository_tree_sha256) {
    fail('release receipt repository_tree_sha256 mismatch');
  }
  if (!isDeepStrictEqual(supplied.installed_files_sha256, expected.installed_files_sha256)) {
    fail('release receipt installed_files_sha256 mismatch');
  }
  if (supplied.installed_tree_metadata_sha256 !== expected.installed_tree_metadata_sha256) {
    fail('release receipt installed_tree_metadata_sha256 mismatch');
  }
  if (!isDeepStrictEqual(supplied.systemd_files_sha256, expected.systemd_files_sha256)) {
    fail('release receipt systemd_files_sha256 mismatch');
  }
  if (supplied.dependency_tree_sha256 !== expected.dependency_tree_sha256) {
    fail('release receipt dependency_tree_sha256 mismatch');
  }
  if (!isDeepStrictEqual(supplied.privileged_files_sha256, expected.privileged_files_sha256)) {
    fail('release receipt privileged_files_sha256 mismatch');
  }
  if (supplied.runtime_manifest_sha256 !== expected.runtime_manifest_sha256) {
    fail('release receipt runtime_manifest_sha256 mismatch');
  }
  if (!isDeepStrictEqual(supplied.inspected_roots, expected.inspected_roots)) {
    fail('release receipt inspected_roots mismatch');
  }
  if (!isDeepStrictEqual(supplied.filesystem_policy, expected.filesystem_policy)) {
    fail('release receipt filesystem_policy mismatch');
  }
  if (!isDeepStrictEqual(supplied, expected)) fail('release receipt contains unexpected or changed fields');
  return expected;
}

function parseArguments(argv) {
  const command = argv[0];
  if (command !== 'generate' && command !== 'verify') {
    fail('usage: release-receipt.mjs <generate|verify> --source-root PATH --installed-root PATH --systemd-root PATH --privileged-root PATH --export-root PATH --runtime-manifest PATH ...');
  }
  const values = Object.create(null);
  const exportRoots = [];
  let stagingTestMode = false;
  const valueOptions = new Map([
    ['--source-root', 'sourceRoot'],
    ['--installed-root', 'installedRoot'],
    ['--systemd-root', 'systemdRoot'],
    ['--privileged-root', 'privilegedRoot'],
    ['--runtime-manifest', 'runtimeManifest'],
    ['--output', 'output'],
    ['--receipt', 'receipt'],
    ['--installed-at-utc', 'installedAtUtc'],
  ]);
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--staging-test-mode') {
      if (stagingTestMode) fail(`duplicate option: ${argument}`);
      stagingTestMode = true;
      continue;
    }
    if (argument === '--export-root') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail('--export-root requires a value');
      exportRoots.push(path.resolve(value));
      index += 1;
      continue;
    }
    const key = valueOptions.get(argument);
    if (!key) fail(`unknown option: ${argument}`);
    if (Object.hasOwn(values, key)) fail(`duplicate option: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`${argument} requires a value`);
    values[key] = value;
    index += 1;
  }
  for (const key of ['sourceRoot', 'installedRoot', 'systemdRoot', 'privilegedRoot', 'runtimeManifest']) {
    if (!values[key]) fail(`missing required option: --${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  if (exportRoots.length === 0) fail('missing required option: --export-root');
  if (command === 'generate') {
    if (!values.output) fail('missing required option: --output');
    if (!values.installedAtUtc) fail('missing required option: --installed-at-utc');
    if (values.receipt) fail('--receipt is only valid with verify');
  } else {
    if (!values.receipt) fail('missing required option: --receipt');
    if (values.output || values.installedAtUtc) {
      fail('--output and --installed-at-utc are only valid with generate');
    }
  }
  return {
    command,
    ...values,
    sourceRoot: path.resolve(values.sourceRoot),
    installedRoot: path.resolve(values.installedRoot),
    systemdRoot: path.resolve(values.systemdRoot),
    privilegedRoot: path.resolve(values.privilegedRoot),
    runtimeManifest: path.resolve(values.runtimeManifest),
    exportRoots,
    stagingTestMode,
  };
}

async function main(argv) {
  const options = parseArguments(argv);
  if (options.command === 'generate') {
    const output = path.resolve(options.output);
    if (isPathInside(options.sourceRoot, output)) {
      fail('receipt output must not be inside the source checkout');
    }
    validateInstalledAt(options.installedAtUtc);
    const receipt = await computeExpectedReceipt(
      { ...options, receiptPath: output },
      options.installedAtUtc,
    );
    await writeReceiptAtomically(output, receipt);
    try {
      await verifyReceipt({ ...options, receiptPath: output });
    } catch (error) {
      await rm(output, { force: true }).catch(() => {});
      throw error;
    }
    process.stdout.write(`release receipt generated and verified: ${output}\n`);
    return;
  }
  await verifyReceipt({ ...options, receiptPath: path.resolve(options.receipt) });
  process.stdout.write(`release receipt verified: ${path.resolve(options.receipt)}\n`);
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((error) => {
    const message = error instanceof ReceiptError ? error.message : `unexpected error: ${error.stack ?? error.message}`;
    process.stderr.write(`release receipt error: ${message}\n`);
    process.exitCode = 2;
  });
}

export { computeExpectedReceipt, verifyReceipt };
