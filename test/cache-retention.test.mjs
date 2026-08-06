import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { spawn, spawnSync } from 'node:child_process';

const TMP = 'test/.tmp-cache-retention';
let bashWorkingDirectory;

// scripts/compress-page-cache.sh requires pigz. It is an optional external
// dependency, absent on some development machines, so these tests skip
// explicitly rather than failing: an unexpected failure must never be waived
// inside an approval packet, and a silent absence must never look like a pass.
const pigzProbe = spawnSync('bash', ['-c', 'command -v pigz'], { encoding: 'utf8' });
const pigzAvailable = pigzProbe.status === 0 && Boolean(pigzProbe.stdout.trim());
const requiresPigz = pigzAvailable
  ? {}
  : { skip: 'pigz is not installed; page-cache compression cannot be exercised here' };

function bashPath(value) {
  if (bashWorkingDirectory === undefined) {
    const bashCwd = spawnSync('bash', ['-c', 'pwd -P'], {
      cwd: '.',
      encoding: 'utf8',
    });
    if (bashCwd.status !== 0 || !bashCwd.stdout.trim()) {
      throw new Error(`cannot resolve the Bash working directory: ${bashCwd.stderr}`);
    }
    bashWorkingDirectory = bashCwd.stdout.trim();
  }
  const relative = path.relative('.', path.resolve(value)).replaceAll('\\', '/');
  return `${bashWorkingDirectory}/${relative}`;
}

function collectChild(child) {
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function waitForPath(file, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!fs.existsSync(file)) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${file}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test('cache retention compresses only old HTML page-cache entries', requiresPigz, () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const pages = `${TMP}/raw/netmeds/pages`;
  fs.mkdirSync(pages, { recursive: true });
  const oldPage = `${pages}/old.html`;
  const recentPage = `${pages}/recent.html`;
  const normalized = `${TMP}/raw/netmeds/2026-07-26/normalized.jsonl`;
  fs.mkdirSync(path.dirname(normalized), { recursive: true });
  fs.writeFileSync(oldPage, '<html>old evidence</html>');
  fs.writeFileSync(recentPage, '<html>recent evidence</html>');
  fs.writeFileSync(normalized, '{"source_id":"retained"}\n');
  const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
  fs.utimesSync(oldPage, oldTime, oldTime);

  try {
    const importedVariables = [
      'AUSHADHI_RAW_ROOT',
      'AUSHADHI_CACHE_MIN_AGE_MINUTES',
      'AUSHADHI_CACHE_COMPRESS_JOBS',
      'AUSHADHI_CACHE_COMPRESS_BATCH_SIZE',
    ];
    const result = spawnSync('bash', ['scripts/compress-page-cache.sh'], {
      cwd: '.',
      encoding: 'utf8',
      env: {
        ...process.env,
        WSLENV: [
          process.env.WSLENV,
          ...importedVariables,
        ].filter(Boolean).join(':'),
        AUSHADHI_RAW_ROOT: bashPath(`${TMP}/raw`),
        AUSHADHI_CACHE_MIN_AGE_MINUTES: '60',
        AUSHADHI_CACHE_COMPRESS_JOBS: '1',
        AUSHADHI_CACHE_COMPRESS_BATCH_SIZE: '1',
      },
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /compressed_and_verified=1/);
    assert.equal(fs.existsSync(oldPage), false);
    assert.equal(gunzipSync(fs.readFileSync(`${oldPage}.gz`)).toString(), '<html>old evidence</html>');
    assert.equal(fs.readFileSync(recentPage, 'utf8'), '<html>recent evidence</html>');
    assert.equal(fs.readFileSync(normalized, 'utf8'), '{"source_id":"retained"}\n');
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('cache retention refuses a broad filesystem root', requiresPigz, () => {
  const result = spawnSync('bash', ['scripts/compress-page-cache.sh'], {
    cwd: '.',
    encoding: 'utf8',
    env: {
      ...process.env,
      WSLENV: [process.env.WSLENV, 'AUSHADHI_RAW_ROOT'].filter(Boolean).join(':'),
      AUSHADHI_RAW_ROOT: '/',
    },
  });
  assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /refusing unsafe raw root/);
});

test('cache retention preserves a primary atomically refreshed during compression', {
  ...requiresPigz,
  timeout: 20_000,
}, async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const pages = `${TMP}/raw/netmeds/pages`;
  const wrapperDir = `${TMP}/bin`;
  const oldPage = `${pages}/race.html`;
  const ready = `${TMP}/pigz-ready`;
  const release = `${TMP}/pigz-release`;
  fs.mkdirSync(pages, { recursive: true });
  fs.mkdirSync(wrapperDir, { recursive: true });
  fs.writeFileSync(oldPage, '<html>old selected cache</html>');
  const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
  fs.utimesSync(oldPage, oldTime, oldTime);
  const wrapper = `${wrapperDir}/pigz`;
  fs.writeFileSync(wrapper, [
    '#!/bin/bash',
    'for arg in "$@"; do',
    '  if [ "$arg" = "-c" ]; then',
    '    : >"$AUSHADHI_TEST_PIGZ_READY"',
    '    while [ ! -e "$AUSHADHI_TEST_PIGZ_RELEASE" ]; do sleep 0.02; done',
    '    break',
    '  fi',
    'done',
    'exec "$AUSHADHI_REAL_PIGZ" "$@"',
    '',
  ].join('\n'));
  fs.chmodSync(wrapper, 0o755);

  const importedVariables = [
    'AUSHADHI_RAW_ROOT',
    'AUSHADHI_CACHE_MIN_AGE_MINUTES',
    'AUSHADHI_CACHE_COMPRESS_JOBS',
    'AUSHADHI_CACHE_COMPRESS_BATCH_SIZE',
    'AUSHADHI_TEST_WRAPPER_DIR',
    'AUSHADHI_TEST_PIGZ_READY',
    'AUSHADHI_TEST_PIGZ_RELEASE',
    'AUSHADHI_REAL_PIGZ',
  ];
  const child = spawn('bash', ['-c', [
    'export PATH="$AUSHADHI_TEST_WRAPPER_DIR:$PATH"',
    'exec bash scripts/compress-page-cache.sh',
  ].join('\n')], {
    cwd: '.',
    env: {
      ...process.env,
      WSLENV: [process.env.WSLENV, ...importedVariables].filter(Boolean).join(':'),
      AUSHADHI_RAW_ROOT: bashPath(`${TMP}/raw`),
      AUSHADHI_CACHE_MIN_AGE_MINUTES: '60',
      AUSHADHI_CACHE_COMPRESS_JOBS: '1',
      AUSHADHI_CACHE_COMPRESS_BATCH_SIZE: '1',
      AUSHADHI_TEST_WRAPPER_DIR: bashPath(wrapperDir),
      AUSHADHI_TEST_PIGZ_READY: bashPath(ready),
      AUSHADHI_TEST_PIGZ_RELEASE: bashPath(release),
      AUSHADHI_REAL_PIGZ: pigzProbe.stdout.trim(),
    },
  });
  const completion = collectChild(child);
  try {
    await waitForPath(ready);
    fs.writeFileSync(oldPage, '<html>fresh concurrent cache</html>');
  } finally {
    fs.writeFileSync(release, 'continue');
  }
  const result = await completion;
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(fs.readFileSync(oldPage, 'utf8'), '<html>fresh concurrent cache</html>');
  assert.equal(fs.existsSync(`${oldPage}.gz`), false);
  assert.deepEqual(fs.readdirSync(pages).filter((name) => /compressing|\.gz\.tmp/u.test(name)), []);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('cache retention completes an interrupted staged compression on the next run', requiresPigz, () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const pages = `${TMP}/raw/netmeds/pages`;
  const target = `${pages}/interrupted.html`;
  const staged = `${target}.compressing-crashed-owner`;
  fs.mkdirSync(pages, { recursive: true });
  fs.writeFileSync(staged, '<html>recoverable staged cache</html>');
  const importedVariables = [
    'AUSHADHI_RAW_ROOT',
    'AUSHADHI_CACHE_MIN_AGE_MINUTES',
    'AUSHADHI_CACHE_COMPRESS_JOBS',
    'AUSHADHI_CACHE_COMPRESS_BATCH_SIZE',
  ];
  const result = spawnSync('bash', ['scripts/compress-page-cache.sh'], {
    cwd: '.',
    encoding: 'utf8',
    env: {
      ...process.env,
      WSLENV: [process.env.WSLENV, ...importedVariables].filter(Boolean).join(':'),
      AUSHADHI_RAW_ROOT: bashPath(`${TMP}/raw`),
      AUSHADHI_CACHE_MIN_AGE_MINUTES: '0',
      AUSHADHI_CACHE_COMPRESS_JOBS: '1',
      AUSHADHI_CACHE_COMPRESS_BATCH_SIZE: '1',
    },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /interrupted=1/);
  assert.match(result.stdout, /compressed_and_verified=1/);
  assert.equal(fs.existsSync(staged), false);
  assert.equal(gunzipSync(fs.readFileSync(`${target}.gz`)).toString(), '<html>recoverable staged cache</html>');
  fs.rmSync(TMP, { recursive: true, force: true });
});
