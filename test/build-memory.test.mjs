import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('nightly build heap stays aligned with the deployed cgroup envelope', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.build, /--max-old-space-size=6144\b/);

  const dropIn = fs.readFileSync(
    path.join(
      ROOT,
      'deploy',
      'dalekdefender',
      'aushadhi-build.service.d',
      'memory.conf',
    ),
    'utf8',
  );
  assert.match(dropIn, /^Environment=NODE_OPTIONS=--max-old-space-size=6144$/m);
  assert.match(dropIn, /^MemoryHigh=7G$/m);
  assert.match(dropIn, /^MemoryMax=8G$/m);
});
