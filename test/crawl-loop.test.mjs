import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

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

test('crawl loop leaves cohort publication to the dedicated build service and treats exit 5 as idle', () => {
  const script = fs.readFileSync('scripts/crawl-loop.sh', 'utf8');
  assert.doesNotMatch(script, /build-cohort|npm run (?:build|prescribable|report)/);

  const noWorkBranch = script.indexOf('if [ "$dc" -eq 5 ]');
  const gapfillInvocation = script.indexOf('node src/cli/gapfill.mjs --all --limit 500000');
  assert.notEqual(noWorkBranch, -1, 'expected a dedicated exit-code-5 branch');
  assert.ok(noWorkBranch < gapfillInvocation, 'no-work branch must run before gapfill');
  const branchEnd = script.indexOf('\n  fi', noWorkBranch) + '\n  fi'.length;
  const branch = script.slice(noWorkBranch, branchEnd);
  assert.match(branch, /sleep/);
  assert.match(branch, /continue/);
  assert.match(branch, /NO_WORK:/);
  assert.doesNotMatch(branch, /ERROR:/);
});

test('crawl loop waits once for the UTC cap reset instead of hourly retrying', () => {
  const script = fs.readFileSync('scripts/crawl-loop.sh', 'utf8');
  assert.match(script, /sleep_until_utc_reset\(\)/);
  assert.equal((script.match(/sleep_until_utc_reset\n/g) ?? []).length, 2);
  assert.doesNotMatch(script, /daily cap[^\n]*sleeping 1h/);
});

test('nightly build fails loudly and delegates the whole cohort to one pipeline', () => {
  const script = fs.readFileSync('scripts/nightly-build.sh', 'utf8');
  assert.match(script, /set -Eeuo pipefail/);
  assert.match(script, /trap .* ERR/);
  assert.match(script, /nightly-build ERROR:/);
  assert.match(script, /node src\/cli\/build-cohort\.mjs/);
  assert.match(script, /AUSHADHI_NIGHTLY_BUILD_MAX_AGE_SECONDS:-604800/);
  assert.match(script, /max_age_seconds" -ge 3600/);
  assert.match(script, /max_age_seconds" -le 2678400/);
  assert.match(script, /build-cohort\.mjs --if-needed --max-age-seconds "\$max_age_seconds" --reason nightly/);
  assert.doesNotMatch(script, /npm run (build|prescribable|report)/);
});

test('nightly build refuses an out-of-bounds freshness age before invoking the coordinator', () => {
  const result = spawnSync('bash', ['scripts/nightly-build.sh'], {
    cwd: '.',
    encoding: 'utf8',
    env: {
      ...process.env,
      WSLENV: [
        process.env.WSLENV,
        'AUSHADHI_NIGHTLY_BUILD_MAX_AGE_SECONDS',
      ].filter(Boolean).join(':'),
      AUSHADHI_NIGHTLY_BUILD_MAX_AGE_SECONDS: '2678401',
    },
  });
  assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /must be between 3600 and 2678400/u);
  assert.doesNotMatch(result.stdout, /nightly-build start/u);
});

test('public npm build entrypoint cannot bypass the cohort coordinator', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts.build, /src\/cli\/build-cohort\.mjs --reason npm-build/);
  assert.doesNotMatch(pkg.scripts.build, /src\/cli\/build\.mjs/);
  assert.match(pkg.scripts.prescribable, /src\/cli\/build-cohort\.mjs --reason npm-prescribable/);
  assert.doesNotMatch(pkg.scripts.prescribable, /src\/cli\/prescribable\.mjs/);
});
