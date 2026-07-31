import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDirectInvocation, parseArgs } from '../src/cli/build-cdci-index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('CDCI index CLI requires the internal-evaluation profile', () => {
  assert.equal(
    isDirectInvocation(path.join(ROOT, 'src', 'cli', 'build-cdci-index.mjs')),
    true,
  );
  assert.throws(() => parseArgs([]), /--profile is required/i);
  assert.throws(
    () => parseArgs(['--profile', 'production-open']),
    /only internal-evaluation/i,
  );
  assert.throws(
    () => parseArgs(['--profile', 'internal-evaluation', '--profile', 'internal-evaluation']),
    /only once/i,
  );
});

test('CDCI index CLI defaults to the committed pinned release config', () => {
  assert.deepEqual(parseArgs(['--profile', 'internal-evaluation']), {
    profile: 'internal-evaluation',
    configPath: path.join(ROOT, 'data-static', 'cdci-release.internal-evaluation.json'),
  });
});

test('CDCI index CLI permits an in-repository config and rejects traversal or unknown flags', () => {
  assert.deepEqual(
    parseArgs([
      '--profile', 'internal-evaluation',
      '--config', 'test/fixtures/cdci-release.json',
    ]),
    {
      profile: 'internal-evaluation',
      configPath: path.join(ROOT, 'test', 'fixtures', 'cdci-release.json'),
    },
  );
  assert.throws(
    () => parseArgs([
      '--profile', 'internal-evaluation',
      '--config', '../../outside.json',
    ]),
    /inside the repository/i,
  );
  assert.throws(
    () => parseArgs(['--profile', 'internal-evaluation', '--output-dir', 'dist/cdci']),
    /unknown argument/i,
  );
});

test('CDCI index CLI invoked through a junction fails loudly instead of silently doing nothing', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-cdci-cli-link-'));
  const linkedSource = path.join(scratch, 'linked-src');
  fs.symlinkSync(
    path.join(ROOT, 'src'),
    linkedSource,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  try {
    const result = spawnSync(
      process.execPath,
      [path.join(linkedSource, 'cli', 'build-cdci-index.mjs')],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--profile is required/i);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
