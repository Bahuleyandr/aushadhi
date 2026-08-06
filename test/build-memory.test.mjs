import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('nightly build heap stays aligned with the tracked cgroup envelope', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.build, /--max-old-space-size=6144\b/);

  const unit = fs.readFileSync(
    path.join(
      ROOT,
      'deploy',
      'dalekdefender',
      'aushadhi-build.service',
    ),
    'utf8',
  );
  assert.match(unit, /^Environment=NODE_OPTIONS=--max-old-space-size=6144$/m);
  assert.match(unit, /^MemoryHigh=7G$/m);
  assert.match(unit, /^MemoryMax=8G$/m);
});
