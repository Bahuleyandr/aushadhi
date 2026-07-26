import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../src/cli/build-interaction-mapping-pilot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('mapping pilot CLI requires a profile and at least one rule', () => {
  assert.throws(() => parseArgs([]), /--profile is required/i);
  assert.throws(
    () => parseArgs(['--profile', 'internal-evaluation']),
    /--rule-id is required/i,
  );
  assert.throws(
    () => parseArgs([
      '--profile', 'clinical-production',
      '--rule-id', 'warfarin__amiodarone',
    ]),
    /unsupported --profile/i,
  );
});

test('mapping pilot CLI derives a profile-scoped, source-labelled output', () => {
  const options = parseArgs([
    '--profile', 'internal-evaluation',
    '--rule-id', 'warfarin__amiodarone',
    '--source-only', 'janaushadhi',
  ]);
  assert.equal(options.backlogDir, path.join(
    ROOT,
    'data',
    'interaction',
    'internal-evaluation',
    'mapping-backlog',
  ));
  assert.equal(options.outputDir, path.join(
    ROOT,
    'data',
    'interaction',
    'internal-evaluation',
    'mapping-pilots',
    'warfarin__amiodarone--source-janaushadhi',
  ));
});

test('mapping pilot CLI rejects acceptance flags and repeated source filters', () => {
  const base = [
    '--profile', 'internal-evaluation',
    '--rule-id', 'warfarin__amiodarone',
  ];
  assert.throws(() => parseArgs([...base, '--accept']), /unknown argument --accept/i);
  assert.throws(
    () => parseArgs([
      ...base,
      '--source-only', 'janaushadhi',
      '--source-only', 'github-jr',
    ]),
    /only once/i,
  );
});
