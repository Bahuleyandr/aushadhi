import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const TMP = 'test/.tmp-cache-retention';
let bashWorkingDirectory;

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

test('cache retention compresses only old HTML page-cache entries', () => {
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

test('cache retention refuses a broad filesystem root', () => {
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
