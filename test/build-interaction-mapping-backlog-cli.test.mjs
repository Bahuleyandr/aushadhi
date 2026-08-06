import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../src/cli/build-interaction-mapping-backlog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('mapping backlog CLI requires an explicit supported profile', () => {
  assert.throws(() => parseArgs([]), /--profile is required/i);
  assert.throws(
    () => parseArgs(['--profile', 'clinical-production']),
    /unsupported --profile/i,
  );
});

test('mapping backlog CLI derives profile-scoped outputs and a sibling artifact summary', () => {
  const options = parseArgs([
    '--profile', 'internal-evaluation',
    '--artifact', 'dist/fixture/drugs.jsonl',
  ]);
  assert.equal(options.profile, 'internal-evaluation');
  assert.equal(options.artifactPath, path.join(ROOT, 'dist', 'fixture', 'drugs.jsonl'));
  assert.equal(options.artifactSummaryPath, path.join(ROOT, 'dist', 'fixture', 'summary.json'));
  assert.equal(options.outputDir, path.join(
    ROOT,
    'data',
    'interaction',
    'internal-evaluation',
    'mapping-backlog',
  ));
});

test('mapping backlog CLI accepts explicit review inputs and rejects unknown flags', () => {
  const options = parseArgs([
    '--profile', 'production-open',
    '--artifact', 'dist/open/drugs.jsonl',
    '--artifact-summary', 'dist/open/catalog-summary.json',
    '--rules', 'docs/rules.jsonl',
    '--member-sets', 'data-static/member-sets.json',
    '--output-dir', 'data/interaction/production-open/custom-backlog',
  ]);
  assert.equal(
    options.artifactSummaryPath,
    path.join(ROOT, 'dist', 'open', 'catalog-summary.json'),
  );
  assert.equal(options.rulesPath, path.join(ROOT, 'docs', 'rules.jsonl'));
  assert.equal(options.memberSetsPath, path.join(ROOT, 'data-static', 'member-sets.json'));
  assert.equal(options.outputDir, path.join(
    ROOT,
    'data',
    'interaction',
    'production-open',
    'custom-backlog',
  ));
  assert.throws(
    () => parseArgs(['--profile', 'internal-evaluation', '--accept']),
    /unknown argument --accept/i,
  );
  assert.throws(
    () => parseArgs([
      '--profile', 'internal-evaluation',
      '--artifact-summary', 'dist/open/summary.json',
    ]),
    /--artifact-summary requires --artifact/i,
  );
});
