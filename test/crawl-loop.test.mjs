import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('crawl loop retries a classified discovery anomaly without draining gapfill', () => {
  const script = fs.readFileSync('scripts/crawl-loop.sh', 'utf8');
  const anomalyBranch = script.indexOf('if [ "$dc" -eq 4 ]');
  const gapfillInvocation = script.indexOf('node src/cli/gapfill.mjs --all --limit 500000');

  assert.notEqual(anomalyBranch, -1, 'expected a dedicated exit-code-4 branch');
  assert.ok(anomalyBranch < gapfillInvocation, 'anomaly branch must run before gapfill');
  const branch = script.slice(anomalyBranch, gapfillInvocation);
  assert.match(branch, /sleep 3600/);
  assert.match(branch, /continue/);
  assert.doesNotMatch(branch, /--all --limit 500000/);
});
