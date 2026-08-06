import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  copyFile,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const receiptCli = path.join(repositoryRoot, 'deploy', 'dalekdefender', 'release-receipt.mjs');
const installedAt = '2026-08-06T01:02:03.000Z';

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
}

function mustRun(command, args, options = {}) {
  const result = run(command, args, options);
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

async function writeFixtureFile(root, relativePath, contents) {
  const target = path.join(root, ...relativePath.split('/'));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

async function writeExportSnapshot(fixture, {
  date = '2026-08-06',
  sourceList = [
    { source_id: 'janaushadhi', record_count: 1 },
    { source_id: 'onemg-live', record_count: 1 },
  ],
} = {}) {
  const snapshot = path.join(fixture.exported, date);
  await rm(snapshot, { recursive: true, force: true });
  await mkdir(snapshot, { recursive: true });
  const generation = 'generation-1';
  const sourceBytes = Buffer.from('{"id":1}\n');
  const prescribableBytes = Buffer.from('{"id":1}\n');
  const summaryBytes = Buffer.from('{"date":"2026-08-06","total_rows":1}\n');
  const artifacts = {
    'drugs.jsonl.zst': Buffer.from('compressed drugs\n'),
    'prescribable.jsonl.zst': Buffer.from('compressed prescribable\n'),
    'state.tar.zst': Buffer.from('compressed state\n'),
  };
  for (const [name, contents] of Object.entries(artifacts)) {
    await writeFile(path.join(snapshot, name), contents);
  }
  const cohortFiles = {
    'drugs.jsonl': {
      sha256: sha256(sourceBytes),
      size_bytes: sourceBytes.length,
      record_count: 1,
    },
    'prescribable.jsonl': {
      sha256: sha256(prescribableBytes),
      size_bytes: prescribableBytes.length,
      record_count: 1,
    },
    'summary.json': {
      sha256: sha256(summaryBytes),
      size_bytes: summaryBytes.length,
    },
  };
  const artifactEntry = (filename) => ({
    filename,
    size_bytes: artifacts[filename].length,
    sha256: sha256(artifacts[filename]),
  });
  const manifest = {
    schema_version: 4,
    stage_kind: 'aushadhi-export-snapshot',
    release_date: date,
    generation_id: generation,
    cohort: {
      schema_version: 1,
      manifest_sha256: '1'.repeat(64),
      files: cohortFiles,
    },
    source: {
      path: `.generations/${generation}/drugs.jsonl`,
      ...cohortFiles['drugs.jsonl'],
    },
    artifact: artifactEntry('drugs.jsonl.zst'),
    prescribable: {
      ...artifactEntry('prescribable.jsonl.zst'),
      uncompressed_sha256: cohortFiles['prescribable.jsonl'].sha256,
      uncompressed_size_bytes: cohortFiles['prescribable.jsonl'].size_bytes,
      record_count: cohortFiles['prescribable.jsonl'].record_count,
    },
    code_release: {
      repository_commit: 'a'.repeat(40),
      repository_tree_sha256: '2'.repeat(64),
      runtime_manifest_sha256: '3'.repeat(64),
      dependency_tree_sha256: '4'.repeat(64),
      release_receipt_sha256: '5'.repeat(64),
      installed_files_sha256: { 'src/app.mjs': '6'.repeat(64) },
      systemd_files_sha256: { 'aushadhi-app.service': '7'.repeat(64) },
      privileged_files_sha256: { 'usr/local/libexec/aushadhi-helper': '8'.repeat(64) },
    },
    artifact_policy: {
      profile: 'internal-evaluation',
      redistributable: false,
      production_authority: 'none',
    },
    source_list: sourceList,
    recovery_policy: {
      critical_state_required: true,
      sqlite_backup_method: 'sqlite-online-backup',
      restricted_cdci_exported: false,
      licensed_recovery_boundary: 'internal-recovery-only',
      generic_archive_excludes: ['pages', 'restricted', 'SQLite', 'WAL', 'SHM'],
      ephemeral_state_excludes: [
        'state.json.crawler-state.lock',
        '.build.lock',
        '.export.lock',
        '.state.json.tmp-*',
      ],
    },
    state_note: 'ok',
    state_snapshot: {
      ...artifactEntry('state.tar.zst'),
      verification: 'required',
    },
    databases: [],
  };
  await writeFile(path.join(snapshot, 'stage-manifest.json'), `${JSON.stringify(manifest)}\n`);
  return { snapshot, artifacts, manifest };
}

function statMode(information) {
  return (information.mode & 0o7777).toString(8).padStart(4, '0');
}

async function createFixture({ installedOwnershipOffset = 0, privilegedOwnershipOffset = 0 } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'aushadhi-release-receipt-'));
  const source = path.join(root, 'source');
  const installed = path.join(root, 'installed');
  const systemd = path.join(root, 'systemd');
  const privileged = path.join(root, 'privileged');
  const exported = path.join(root, 'export');
  await Promise.all([
    mkdir(source, { recursive: true }),
    mkdir(installed, { recursive: true }),
    mkdir(systemd, { recursive: true }),
    mkdir(privileged, { recursive: true }),
    mkdir(exported, { recursive: true }),
  ]);

  const artifactPolicy = {
    profile: 'internal-evaluation',
    redistributable: false,
    production_authority: 'none',
    deployment_authority: 'separate-explicit-approval-required',
    restricted_sources: ['janaushadhi', 'onemg-live'],
  };
  const fixtureUid = process.getuid?.() ?? 0;
  const fixtureGid = process.getgid?.() ?? 0;
  await writeFixtureFile(source, 'package.json', '{"private":true,"type":"module"}\n');
  await writeFixtureFile(source, 'package-lock.json', '{"lockfileVersion":3,"packages":{}}\n');
  await writeFixtureFile(source, 'src/app.mjs', 'export const answer = 42;\n');
  await writeFixtureFile(source, 'deploy/dalekdefender/helper.sh', '#!/usr/bin/env bash\nexit 0\n');
  const stagingFileMode = statMode(await stat(path.join(source, 'package.json')));
  const stagingDirectoryMode = statMode(await stat(installed));
  await chmod(path.join(source, 'deploy', 'dalekdefender', 'helper.sh'), 0o755);
  const helperMode = `0${((await stat(path.join(source, 'deploy', 'dalekdefender', 'helper.sh'))).mode & 0o777).toString(8).padStart(3, '0')}`;

  const manifest = {
    schema_version: 1,
    install_root: '/opt/aushadhi',
    export_root: '/var/lib/aushadhi-export',
    release_receipt: {
      required: true,
      path: '/opt/aushadhi/DEPLOYED-RELEASE.json',
      required_fields: [
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
      ],
      dependency_tree: {
        path: 'node_modules',
        required: true,
        lockfiles: ['package.json', 'package-lock.json'],
        allow_internal_relative_symlinks: true,
      },
      systemd_files: {
        uid: fixtureUid,
        gid: fixtureGid,
        mode: stagingFileMode,
      },
      installed_tree: {
        uid: fixtureUid + installedOwnershipOffset,
        gid: fixtureGid + installedOwnershipOffset,
        root_mode: stagingDirectoryMode,
        directory_mode: stagingDirectoryMode,
        receipt_mode: stagingFileMode,
        tracked_file_modes_from_git: process.platform !== 'win32',
        disallow_group_or_other_write: process.platform !== 'win32',
      },
      privileged_files: [
        {
          source: 'deploy/dalekdefender/helper.sh',
          target: 'usr/local/libexec/aushadhi-helper',
          mode: helperMode,
          uid: fixtureUid + privilegedOwnershipOffset,
          gid: fixtureGid + privilegedOwnershipOffset,
        },
      ],
    },
    artifact_policy: artifactPolicy,
    restricted_cdci: {
      deployed: false,
      exported: false,
      storage_path: 'data/restricted/cdci',
      profile: 'internal-evaluation',
    },
  };

  await writeFixtureFile(
    source,
    'deploy/dalekdefender/runtime-manifest.json',
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFixtureFile(
    source,
    'deploy/dalekdefender/aushadhi-app.service',
    '[Service]\nExecStart=/usr/bin/true\n',
  );
  await writeFixtureFile(
    source,
    'deploy/dalekdefender/aushadhi-build.timer',
    '[Timer]\nOnCalendar=daily\n',
  );

  mustRun('git', ['init', '--quiet'], { cwd: source });
  mustRun('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: source });
  mustRun('git', ['config', 'user.name', 'Release Fixture'], { cwd: source });
  mustRun('git', ['add', '--all'], { cwd: source });
  mustRun('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: source });

  const tracked = mustRun('git', ['ls-files'], { cwd: source }).split(/\r?\n/u);
  for (const relativePath of tracked) {
    const target = path.join(installed, ...relativePath.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(source, ...relativePath.split('/')), target);
  }
  for (const name of ['aushadhi-app.service', 'aushadhi-build.timer']) {
    await copyFile(path.join(source, 'deploy', 'dalekdefender', name), path.join(systemd, name));
  }
  await writeFixtureFile(installed, 'node_modules/fixture-package/index.mjs', 'export default true;\n');
  const privilegedHelper = path.join(privileged, 'usr', 'local', 'libexec', 'aushadhi-helper');
  await mkdir(path.dirname(privilegedHelper), { recursive: true });
  await copyFile(path.join(source, 'deploy', 'dalekdefender', 'helper.sh'), privilegedHelper);
  await chmod(privilegedHelper, Number.parseInt(helperMode, 8));

  return {
    root,
    source,
    installed,
    systemd,
    privileged,
    exported,
    manifest: path.join(source, 'deploy', 'dalekdefender', 'runtime-manifest.json'),
    artifactPolicy,
  };
}

function generateArgs(fixture, output, extra = []) {
  return [
    receiptCli,
    'generate',
    '--source-root', fixture.source,
    '--installed-root', fixture.installed,
    '--systemd-root', fixture.systemd,
    '--privileged-root', fixture.privileged,
    '--export-root', fixture.exported,
    '--runtime-manifest', fixture.manifest,
    '--output', output,
    '--installed-at-utc', installedAt,
    '--staging-test-mode',
    ...extra,
  ];
}

function verifyArgs(fixture, receipt, extra = []) {
  return [
    receiptCli,
    'verify',
    '--source-root', fixture.source,
    '--installed-root', fixture.installed,
    '--systemd-root', fixture.systemd,
    '--privileged-root', fixture.privileged,
    '--export-root', fixture.exported,
    '--runtime-manifest', fixture.manifest,
    '--receipt', receipt,
    '--staging-test-mode',
    ...extra,
  ];
}

async function removeFixture(fixture) {
  await rm(fixture.root, { recursive: true, force: true });
}

async function listTree(root) {
  const result = [];
  async function walk(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      result.push(`${entry.isDirectory() ? 'd' : entry.isSymbolicLink() ? 'l' : 'f'}:${relativePath}`);
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relativePath);
    }
  }
  await walk(root);
  return result;
}

test('generates a deterministic receipt for the exact clean checkout and verifies it read-only', async () => {
  const fixture = await createFixture();
  try {
    const first = path.join(fixture.root, 'DEPLOYED-RELEASE.first.json');
    const second = path.join(fixture.root, 'DEPLOYED-RELEASE.second.json');
    const firstResult = run(process.execPath, generateArgs(fixture, first));
    assert.equal(firstResult.status, 0, `${firstResult.stdout}\n${firstResult.stderr}`);
    const secondResult = run(process.execPath, generateArgs(fixture, second));
    assert.equal(secondResult.status, 0, `${secondResult.stdout}\n${secondResult.stderr}`);
    assert.equal(await readFile(first, 'utf8'), await readFile(second, 'utf8'));

    const receipt = JSON.parse(await readFile(first, 'utf8'));
    assert.equal(receipt.schema_version, 1);
    assert.equal(receipt.repository_commit, mustRun('git', ['rev-parse', 'HEAD'], { cwd: fixture.source }));
    assert.match(receipt.repository_tree_sha256, /^[a-f0-9]{64}$/u);
    assert.match(receipt.dependency_tree_sha256, /^[a-f0-9]{64}$/u);
    assert.match(receipt.installed_tree_metadata_sha256, /^[a-f0-9]{64}$/u);
    assert.equal(receipt.installed_at_utc, installedAt);
    assert.equal(receipt.inspection_profile, 'staging-test');
    assert.deepEqual(receipt.inspected_roots, {
      source_root: path.resolve(fixture.source),
      installed_root: path.resolve(fixture.installed),
      systemd_root: path.resolve(fixture.systemd),
      privileged_root: path.resolve(fixture.privileged),
      export_roots: [path.resolve(fixture.exported)],
      runtime_manifest: path.resolve(fixture.manifest),
    });
    const [privilegedPolicy] = receipt.filesystem_policy.privileged_files;
    assert.deepEqual(Object.keys(privilegedPolicy), ['target', 'mode', 'uid', 'gid']);
    assert.equal(privilegedPolicy.target, 'usr/local/libexec/aushadhi-helper');
    assert.match(privilegedPolicy.mode, /^0[0-7]{3}$/u);
    assert.equal(privilegedPolicy.uid, process.getuid?.() ?? 0);
    assert.equal(privilegedPolicy.gid, process.getgid?.() ?? 0);
    assert.deepEqual(receipt.artifact_policy, fixture.artifactPolicy);
    assert.deepEqual(Object.keys(receipt.installed_files_sha256), [
      'deploy/dalekdefender/aushadhi-app.service',
      'deploy/dalekdefender/aushadhi-build.timer',
      'deploy/dalekdefender/helper.sh',
      'deploy/dalekdefender/runtime-manifest.json',
      'package-lock.json',
      'package.json',
      'src/app.mjs',
    ]);
    assert.deepEqual(Object.keys(receipt.systemd_files_sha256), [
      'aushadhi-app.service',
      'aushadhi-build.timer',
    ]);
    assert.deepEqual(Object.keys(receipt.privileged_files_sha256), [
      'usr/local/libexec/aushadhi-helper',
    ]);
    for (const digest of Object.values(receipt.installed_files_sha256)) {
      assert.match(digest, /^[a-f0-9]{64}$/u);
    }

    const before = await listTree(fixture.root);
    const receiptMtime = (await stat(first)).mtimeMs;
    const verified = run(process.execPath, verifyArgs(fixture, first));
    assert.equal(verified.status, 0, `${verified.stdout}\n${verified.stderr}`);
    assert.match(verified.stdout, /release receipt verified/u);
    assert.deepEqual(await listTree(fixture.root), before);
    assert.equal((await stat(first)).mtimeMs, receiptMtime);
  } finally {
    await removeFixture(fixture);
  }
});

test('requires an explicit staging profile for non-live roots and always rejects receipt output inside source', async () => {
  const fixture = await createFixture();
  try {
    let result = run(process.execPath, generateArgs(
      fixture,
      path.join(fixture.root, 'live.json'),
    ).filter((argument) => argument !== '--staging-test-mode'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /live inspection.*installed root/iu);

    const inside = path.join(fixture.source, 'DEPLOYED-RELEASE.json');
    result = run(process.execPath, generateArgs(fixture, inside));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /output.*inside.*source/iu);

    await writeFile(path.join(fixture.source, 'untracked.txt'), 'dirty\n');
    result = run(process.execPath, generateArgs(fixture, path.join(fixture.root, 'dirty.json')));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /checkout.*dirty/iu);
  } finally {
    await removeFixture(fixture);
  }
});

test('binds the selected inspection roots and refuses verification through another root set or profile', async () => {
  const fixture = await createFixture();
  try {
    const receipt = path.join(fixture.root, 'receipt.json');
    let result = run(process.execPath, generateArgs(fixture, receipt));
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const otherExport = path.join(fixture.root, 'other-export');
    await mkdir(otherExport);
    result = run(process.execPath, verifyArgs(fixture, receipt).map((argument, index, all) => (
      index > 0 && all[index - 1] === '--export-root' ? otherExport : argument
    )));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /inspected_roots mismatch/iu);

    result = run(process.execPath, verifyArgs(fixture, receipt).filter(
      (argument) => argument !== '--staging-test-mode',
    ));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /inspection_profile mismatch.*expected live/iu);
  } finally {
    await removeFixture(fixture);
  }
});

test('fails closed for missing or mismatched installed and systemd files', async () => {
  const cases = [
    {
      mutate: async (fixture) => rm(path.join(fixture.installed, 'src', 'app.mjs')),
      error: /missing required installed file.*src\/app\.mjs/iu,
    },
    {
      mutate: async (fixture) => writeFile(path.join(fixture.installed, 'src', 'app.mjs'), 'tampered\n'),
      error: /installed file hash mismatch.*src\/app\.mjs/iu,
    },
    {
      mutate: async (fixture) => rm(path.join(fixture.systemd, 'aushadhi-app.service')),
      error: /missing required systemd file.*aushadhi-app\.service/iu,
    },
    {
      mutate: async (fixture) => writeFile(path.join(fixture.systemd, 'aushadhi-app.service'), 'tampered\n'),
      error: /systemd file hash mismatch.*aushadhi-app\.service/iu,
    },
  ];

  for (const fixtureCase of cases) {
    const fixture = await createFixture();
    try {
      await fixtureCase.mutate(fixture);
      const result = run(process.execPath, generateArgs(fixture, path.join(fixture.root, 'receipt.json')));
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, fixtureCase.error);
    } finally {
      await removeFixture(fixture);
    }
  }
});

test('fails closed when installed systemd mode differs from the manifest policy', async () => {
  const fixture = await createFixture();
  const unit = path.join(fixture.systemd, 'aushadhi-app.service');
  try {
    await chmod(unit, process.platform === 'win32' ? 0o444 : 0o600);
    const result = run(
      process.execPath,
      generateArgs(fixture, path.join(fixture.root, 'receipt.json')),
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /systemd file mode mismatch.*aushadhi-app\.service/iu);
  } finally {
    await chmod(unit, 0o666).catch(() => {});
    await removeFixture(fixture);
  }
});

test('attests installed file and directory metadata and verifies the completed receipt mode', async (t) => {
  const fixture = await createFixture();
  try {
    const receiptPath = path.join(fixture.root, 'receipt.json');
    let result = run(process.execPath, generateArgs(fixture, receiptPath));
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /release receipt generated and verified/iu);

    if (process.platform === 'win32') {
      t.diagnostic('Windows does not expose POSIX ownership/mode semantics; staging metadata binding remains exercised');
      return;
    }

    const receiptInformation = await stat(receiptPath);
    assert.equal(receiptInformation.uid, process.getuid());
    assert.equal(receiptInformation.gid, process.getgid());
    assert.equal(receiptInformation.mode & 0o7777, 0o644);

    await chmod(receiptPath, 0o600);
    result = run(process.execPath, verifyArgs(fixture, receiptPath));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release receipt mode mismatch.*0644.*0600/iu);
    await chmod(receiptPath, 0o644);

    const trackedFile = path.join(fixture.installed, 'src', 'app.mjs');
    await chmod(trackedFile, 0o600);
    result = run(process.execPath, verifyArgs(fixture, receiptPath));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /installed tracked file.*src\/app\.mjs.*mode mismatch.*0644.*0600/iu);
    await chmod(trackedFile, 0o644);

    await chmod(path.join(fixture.installed, 'node_modules', 'fixture-package'), 0o700);
    result = run(process.execPath, verifyArgs(fixture, receiptPath));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /installed directory.*node_modules\/fixture-package.*mode mismatch/iu);
  } finally {
    await removeFixture(fixture);
  }
});

test('fails closed on installed-tree and privileged-file ownership mismatch', async () => {
  const installedMismatch = await createFixture({ installedOwnershipOffset: 1 });
  try {
    const result = run(
      process.execPath,
      generateArgs(installedMismatch, path.join(installedMismatch.root, 'receipt.json')),
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /installed root ownership mismatch/iu);
  } finally {
    await removeFixture(installedMismatch);
  }

  const privilegedMismatch = await createFixture({ privilegedOwnershipOffset: 1 });
  try {
    const result = run(
      process.execPath,
      generateArgs(privilegedMismatch, path.join(privilegedMismatch.root, 'receipt.json')),
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /privileged file ownership mismatch.*aushadhi-helper/iu);
  } finally {
    await removeFixture(privilegedMismatch);
  }
});

test('pins the complete node_modules tree and rejects other extras or escaping dependency symlinks', async (t) => {
  const accepted = await createFixture();
  try {
    const binDirectory = path.join(accepted.installed, 'node_modules', '.bin');
    await mkdir(binDirectory, { recursive: true });
    try {
      await symlink('../fixture-package/index.mjs', path.join(binDirectory, 'fixture'), 'file');
    } catch (error) {
      if (error?.code === 'EPERM') {
        t.diagnostic('Windows did not permit creating the internal dependency symlink fixture');
      } else {
        throw error;
      }
    }
    const receipt = path.join(accepted.root, 'receipt.json');
    let result = run(process.execPath, generateArgs(accepted, receipt));
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    await writeFixtureFile(accepted.installed, 'node_modules/fixture-package/added-after-receipt.mjs', 'drift\n');
    result = run(process.execPath, verifyArgs(accepted, receipt));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /installed_tree_metadata_sha256 mismatch/iu);
  } finally {
    await removeFixture(accepted);
  }

  const extra = await createFixture();
  try {
    await writeFixtureFile(extra.installed, 'backup/app.mjs.bak', 'unexpected\n');
    const result = run(process.execPath, generateArgs(extra, path.join(extra.root, 'receipt.json')));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unexpected installed file.*backup\/app\.mjs\.bak/iu);
  } finally {
    await removeFixture(extra);
  }

  const escaping = await createFixture();
  try {
    const outside = path.join(escaping.root, 'outside.mjs');
    await writeFile(outside, 'outside dependency tree\n');
    const link = path.join(escaping.installed, 'node_modules', 'fixture-package', 'escape.mjs');
    let symlinkCreated = true;
    try {
      await symlink('../../../outside.mjs', link, 'file');
    } catch (error) {
      if (error?.code === 'EPERM') {
        symlinkCreated = false;
        t.diagnostic('Windows did not permit creating the dependency symlink fixture');
      } else {
        throw error;
      }
    }
    if (symlinkCreated) {
      const result = run(process.execPath, generateArgs(escaping, path.join(escaping.root, 'receipt.json')));
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /dependency symlink.*escapes.*node_modules/iu);
    }
  } finally {
    await removeFixture(escaping);
  }
});

test('pins privileged helper bytes and modes from the strict manifest mapping', async () => {
  const cases = [
    {
      mutate: async (fixture) => rm(path.join(fixture.privileged, 'usr', 'local', 'libexec', 'aushadhi-helper')),
      error: /missing required privileged file.*aushadhi-helper/iu,
    },
    {
      mutate: async (fixture) => writeFile(
        path.join(fixture.privileged, 'usr', 'local', 'libexec', 'aushadhi-helper'),
        'tampered\n',
      ),
      error: /privileged file hash mismatch.*aushadhi-helper/iu,
    },
  ];
  for (const fixtureCase of cases) {
    const fixture = await createFixture();
    try {
      await fixtureCase.mutate(fixture);
      const result = run(process.execPath, generateArgs(fixture, path.join(fixture.root, 'receipt.json')));
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, fixtureCase.error);
    } finally {
      await removeFixture(fixture);
    }
  }

  const staleFixture = await createFixture();
  try {
    await writeFixtureFile(
      staleFixture.privileged,
      'usr/local/sbin/aushadhi-export-snapshot',
      'stale privileged helper\n',
    );
    const result = run(
      process.execPath,
      generateArgs(staleFixture, path.join(staleFixture.root, 'receipt.json')),
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unexpected Aushadhi privileged file.*usr\/local\/sbin\/aushadhi-export-snapshot/iu);
  } finally {
    await removeFixture(staleFixture);
  }

  if (process.platform !== 'win32') {
    const modeFixture = await createFixture();
    try {
      await chmod(
        path.join(modeFixture.privileged, 'usr', 'local', 'libexec', 'aushadhi-helper'),
        0o644,
      );
      const result = run(
        process.execPath,
        generateArgs(modeFixture, path.join(modeFixture.root, 'receipt.json')),
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /privileged file mode mismatch.*aushadhi-helper/iu);
    } finally {
      await removeFixture(modeFixture);
    }
  }
});

test('rejects tracked restricted CDCI payloads and restricted export inputs', async () => {
  const trackedFixture = await createFixture();
  try {
    await writeFixtureFile(trackedFixture.source, 'data/restricted/cdci/payload.txt', 'licensed payload\n');
    mustRun('git', ['add', '--all'], { cwd: trackedFixture.source });
    mustRun('git', ['commit', '--quiet', '-m', 'restricted payload'], { cwd: trackedFixture.source });
    await writeFixtureFile(trackedFixture.installed, 'data/restricted/cdci/payload.txt', 'licensed payload\n');
    const result = run(
      process.execPath,
      generateArgs(trackedFixture, path.join(trackedFixture.root, 'receipt.json')),
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /restricted.*data\/restricted\/cdci\/payload\.txt/iu);
  } finally {
    await removeFixture(trackedFixture);
  }

  const exportFixture = await createFixture();
  try {
    await writeFixtureFile(exportFixture.exported, '2026-08-06/cdci-source.zip', 'licensed payload\n');
    const result = run(
      process.execPath,
      generateArgs(exportFixture, path.join(exportFixture.root, 'receipt.json')),
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /restricted export material.*cdci/iu);
  } finally {
    await removeFixture(exportFixture);
  }
});

test('rejects CDCI and SNOMED India Drug identities inside otherwise generic dated exports', async () => {
  const fixture = await createFixture();
  try {
    for (const sourceId of [
      'cdci-snomed-ct',
      'SnomedCT_IndiaDrugExtensionRF2_PRODUCTION_IN1000189',
    ]) {
      await writeExportSnapshot(fixture, {
        sourceList: [{ source_id: sourceId, record_count: 1 }],
      });
      const result = run(
        process.execPath,
        generateArgs(fixture, path.join(fixture.root, 'receipt.json')),
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /restricted export.*CDCI\/SNOMED India Drug.*source_list/iu);
    }

    await writeExportSnapshot(fixture);
    const allowed = run(
      process.execPath,
      generateArgs(fixture, path.join(fixture.root, 'receipt.json')),
    );
    assert.equal(allowed.status, 0, `${allowed.stdout}\n${allowed.stderr}`);
  } finally {
    await removeFixture(fixture);
  }
});

test('export-root inspection allows bootstrap emptiness but rejects every unmanaged top-level entry', async () => {
  const fixture = await createFixture();
  try {
    const empty = run(
      process.execPath,
      generateArgs(fixture, path.join(fixture.root, 'empty-receipt.json')),
    );
    assert.equal(empty.status, 0, `${empty.stdout}\n${empty.stderr}`);

    await writeFixtureFile(fixture.exported, 'payload.bin', 'unmanaged payload\n');
    const unmanagedFile = run(
      process.execPath,
      generateArgs(fixture, path.join(fixture.root, 'file-receipt.json')),
    );
    assert.notEqual(unmanagedFile.status, 0);
    assert.match(unmanagedFile.stderr, /unexpected export-root entry.*payload\.bin/iu);
    await rm(path.join(fixture.exported, 'payload.bin'));

    await mkdir(path.join(fixture.exported, 'snapshots', 'generic-release'), { recursive: true });
    const unmanagedDirectory = run(
      process.execPath,
      generateArgs(fixture, path.join(fixture.root, 'directory-receipt.json')),
    );
    assert.notEqual(unmanagedDirectory.status, 0);
    assert.match(unmanagedDirectory.stderr, /unexpected export-root entry.*snapshots/iu);
  } finally {
    await removeFixture(fixture);
  }
});

test('export-root inspection verifies a dated snapshot exact file and hash closure', async () => {
  const fixture = await createFixture();
  try {
    const { snapshot } = await writeExportSnapshot(fixture);
    const valid = run(
      process.execPath,
      generateArgs(fixture, path.join(fixture.root, 'valid-receipt.json')),
    );
    assert.equal(valid.status, 0, `${valid.stdout}\n${valid.stderr}`);

    await writeFile(path.join(snapshot, 'unmanaged.bin'), 'extra\n');
    const extra = run(
      process.execPath,
      generateArgs(fixture, path.join(fixture.root, 'extra-receipt.json')),
    );
    assert.notEqual(extra.status, 0);
    assert.match(extra.stderr, /missing or unexpected export artifacts/iu);
    await rm(path.join(snapshot, 'unmanaged.bin'));

    await writeFile(path.join(snapshot, 'drugs.jsonl.zst'), 'compressed drugz\n');
    const corrupt = run(
      process.execPath,
      generateArgs(fixture, path.join(fixture.root, 'corrupt-receipt.json')),
    );
    assert.notEqual(corrupt.status, 0);
    assert.match(corrupt.stderr, /drugs artifact.*hash mismatch/iu);
  } finally {
    await removeFixture(fixture);
  }
});

test('rejects symlinks and verifier detects receipt or installed-tree drift', async (t) => {
  const symlinkFixture = await createFixture();
  try {
    const external = path.join(symlinkFixture.root, 'external.mjs');
    await writeFile(external, 'external\n');
    await rm(path.join(symlinkFixture.installed, 'src', 'app.mjs'));
    try {
      await symlink(external, path.join(symlinkFixture.installed, 'src', 'app.mjs'), 'file');
    } catch (error) {
      if (error?.code === 'EPERM') {
        t.diagnostic('Windows did not permit creating the symlink fixture');
      } else {
        throw error;
      }
    }
    const linked = await stat(path.join(symlinkFixture.installed, 'src', 'app.mjs')).catch(() => null);
    if (linked) {
      const result = run(
        process.execPath,
        generateArgs(symlinkFixture, path.join(symlinkFixture.root, 'receipt.json')),
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /symlink.*src\/app\.mjs/iu);
    }
  } finally {
    await removeFixture(symlinkFixture);
  }

  const driftFixture = await createFixture();
  try {
    const receiptPath = path.join(driftFixture.root, 'receipt.json');
    let result = run(process.execPath, generateArgs(driftFixture, receiptPath));
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    receipt.artifact_policy.production_authority = 'production';
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    result = run(process.execPath, verifyArgs(driftFixture, receiptPath));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /artifact_policy.*mismatch/iu);

    result = run(process.execPath, generateArgs(driftFixture, path.join(driftFixture.root, 'fresh.json')));
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    await writeFile(path.join(driftFixture.installed, 'src', 'app.mjs'), 'changed after receipt\n');
    result = run(
      process.execPath,
      verifyArgs(driftFixture, path.join(driftFixture.root, 'fresh.json')),
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /installed file hash mismatch.*src\/app\.mjs/iu);
  } finally {
    await removeFixture(driftFixture);
  }
});
