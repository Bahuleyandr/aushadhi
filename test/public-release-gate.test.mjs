import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNLISTED_SOURCE_REASON,
  classifyPublicReleaseSources,
  evaluateRowSources,
  loadSourceManifest,
} from '../src/lib/public-release-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE_CLI = path.join(ROOT, 'src', 'cli', 'stage-public-release.mjs');

function run(args, cwd = ROOT) {
  return spawnSync('node', [GATE_CLI, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
  });
}

function fixtureSource(overrides = {}) {
  return {
    name: 'Fixture cleared source',
    homepage: 'https://example.org/fixture',
    licence: {
      id: 'MIT',
      class: 'open',
      verification_status: 'verified',
      verified_at: '2026-08-06',
      terms_url: 'https://example.org/fixture/licence',
    },
    enabled: true,
    ingestion_forbidden: false,
    redistributable: true,
    artifact_pack: 'open-core',
    allowed_profiles: ['production-open', 'internal-evaluation'],
    allowed_uses: ['catalogue'],
    required_storage_zones: {
      'production-open': ['data/interaction/production-open'],
      'internal-evaluation': ['data/interaction/internal-evaluation'],
    },
    disabled_reasons: [],
    ...overrides,
  };
}

function fixtureManifest(sources) {
  return {
    schema_version: 1,
    policy_reviewed_at: '2026-08-06',
    uses: ['catalogue', 'ingredient-index'],
    profiles: {
      'production-open': {
        redistributable: true,
        allowed_licence_classes: ['open', 'open-sharealike', 'public-domain'],
        allowed_uses: ['catalogue', 'ingredient-index'],
        default_storage_zone: 'data/interaction/production-open',
      },
      'internal-evaluation': {
        redistributable: false,
        allowed_licence_classes: [
          'open', 'open-sharealike', 'public-domain', 'restricted', 'non-commercial', 'user-supplied',
        ],
        allowed_uses: ['catalogue', 'ingredient-index'],
        default_storage_zone: 'data/interaction/internal-evaluation',
      },
    },
    sources,
  };
}

function row(brand, ...sourceIds) {
  return {
    brand_name: brand,
    sources: sourceIds.map((source, index) => ({
      source,
      source_id: `${source}-${index}`,
      seen_at: '2026-08-01',
    })),
  };
}

function writeJsonl(file, rows) {
  fs.writeFileSync(file, rows.map((entry) => JSON.stringify(entry)).join('\n') + '\n', 'utf8');
}

function scratchDir(t, prefix) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  return scratch;
}

test('committed manifest clears github-jr while unknown and restricted catalogue sources fail closed', () => {
  const { cleared, excluded } = classifyPublicReleaseSources(loadSourceManifest());

  assert.equal(cleared.has('github-jr'), true);
  assert.equal(excluded.has('github-jr'), false);
  assert.equal(cleared.get('github-jr').licence_id, 'MIT');
  assert.equal(cleared.get('github-jr').artifact_pack, 'open-core');

  for (const sourceId of [
    'onemg-live', 'janaushadhi',
    'cdsco-fdc', 'kaggle-2025', 'cdci-snomed-ct', 'ddinter-2',
  ]) {
    assert.equal(cleared.has(sourceId), false, `${sourceId} must not be cleared`);
    const entry = excluded.get(sourceId);
    assert.ok(entry, `${sourceId} must be excluded`);
    assert.equal(typeof entry.reason, 'string');
    assert.ok(entry.reason.length > 0, `${sourceId} needs a non-empty reason`);
  }
  assert.match(excluded.get('onemg-live').reason, /not marked redistributable/u);
  assert.match(
    excluded.get('janaushadhi').reason,
    /licence class "restricted" is not allowed in profile "production-open"/u,
  );
  assert.match(excluded.get('kaggle-2025').reason, /licence verification status is "unknown"/u);
  for (const sourceId of ['pharmeasy', 'netmeds', 'apollo', 'nppa']) {
    assert.equal(cleared.has(sourceId), false);
    assert.equal(excluded.has(sourceId), false, `${sourceId} remains unlisted and fail-closed`);
    assert.deepEqual(evaluateRowSources(row('unlisted', sourceId), cleared), {
      include: false,
      excluded_source_ids: [sourceId],
    });
  }
});

test('row evaluation fails closed on unlisted sources and hard-fails on corrupt rows', () => {
  const cleared = new Map([['github-jr', { licence_id: 'MIT' }]]);

  assert.deepEqual(evaluateRowSources(row('a', 'github-jr'), cleared), {
    include: true,
    excluded_source_ids: [],
  });
  assert.deepEqual(evaluateRowSources(row('b', 'github-jr', 'never-listed'), cleared), {
    include: false,
    excluded_source_ids: ['never-listed'],
  });
  assert.throws(
    () => evaluateRowSources({ brand_name: 'c' }, cleared),
    /missing or empty sources array; the export is corrupt/u,
  );
  assert.throws(
    () => evaluateRowSources({ brand_name: 'd', sources: [] }, cleared),
    /missing or empty sources array; the export is corrupt/u,
  );
  assert.throws(
    () => evaluateRowSources({ brand_name: 'e', sources: [{ source_id: 'x' }] }, cleared),
    /sources entry without a source id; the export is corrupt/u,
  );
  assert.throws(
    () => evaluateRowSources({ brand_name: 'f', sources: [{ source: '' }] }, cleared),
    /sources entry without a source id; the export is corrupt/u,
  );
});

test('staging includes only fully-cleared rows and records exact per-source tallies', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-release-');
  const inputPath = path.join(scratch, 'drugs.jsonl');
  writeJsonl(inputPath, [
    row('cleared-1', 'github-jr'),
    row('restricted-only', 'onemg-live'),
    row('unlisted-only', 'fixture-unlisted'),
    row('mixed', 'github-jr', 'onemg-live'),
    row('cleared-2', 'github-jr'),
  ]);

  const output = path.join(scratch, 'staged');
  const result = run(['--input', inputPath, '--output', output]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const stagedRows = fs.readFileSync(path.join(output, 'drugs.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(stagedRows.map((entry) => entry.brand_name), ['cleared-1', 'cleared-2']);

  const manifest = JSON.parse(
    fs.readFileSync(path.join(output, 'public-release-manifest.json'), 'utf8'),
  );
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.stage_kind, 'aushadhi-public-release');
  assert.equal(manifest.profile, 'production-open');
  assert.equal(manifest.redistributable, true);
  assert.equal(manifest.release_authority, 'none');
  assert.equal(manifest.deployment_authority, 'none');
  assert.equal(manifest.rows_read, 5);
  assert.equal(manifest.rows_included, 2);
  assert.equal(manifest.rows_excluded, 3);
  assert.equal(manifest.source_manifest.path, 'data-static/interaction-sources.json');
  assert.equal(manifest.source_manifest.policy_reviewed_at, loadSourceManifest().policy_reviewed_at);
  assert.match(manifest.source_manifest.sha256, /^[0-9a-f]{64}$/u);

  assert.deepEqual(Object.keys(manifest.included_sources), ['github-jr']);
  assert.equal(manifest.included_sources['github-jr'].rows, 2);
  assert.equal(manifest.included_sources['github-jr'].licence_id, 'MIT');
  assert.equal(manifest.included_sources['github-jr'].licence_class, 'open');

  assert.deepEqual(
    Object.keys(manifest.excluded_sources).sort(),
    ['fixture-unlisted', 'onemg-live'],
  );
  assert.equal(manifest.excluded_sources['onemg-live'].rows_excluded, 2);
  assert.match(
    manifest.excluded_sources['onemg-live'].reason,
    /licence class "restricted" is not allowed in profile "production-open"/u,
  );
  assert.equal(manifest.excluded_sources['onemg-live'].licence_id, 'PROPRIETARY');
  assert.equal(manifest.excluded_sources['fixture-unlisted'].rows_excluded, 1);
  assert.equal(manifest.excluded_sources['fixture-unlisted'].reason, UNLISTED_SOURCE_REASON);

  const staged = fs.readFileSync(path.join(output, 'drugs.jsonl'));
  assert.equal(manifest.artifact_source.record_count, 2);
  assert.equal(manifest.artifact_source.size_bytes, staged.length);
  assert.match(manifest.artifact_source.sha256, /^[0-9a-f]{64}$/u);
});

test('check mode detects package tampering and passes an intact package', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-check-');
  const input = path.join(scratch, 'input.jsonl');
  writeJsonl(input, [row('ok', 'github-jr')]);
  const output = path.join(scratch, 'release');
  const staged = run(['--input', input, '--output', output]);
  assert.equal(staged.status, 0, staged.stderr || staged.stdout);
  const passed = run(['--check', output]);
  assert.equal(passed.status, 0, passed.stderr || passed.stdout);

  writeJsonl(path.join(output, 'drugs.jsonl'), [
    row('ok', 'github-jr'),
    row('bad', 'onemg-live'),
    row('bad-unlisted', 'fixture-unlisted'),
  ]);
  const failed = run(['--check', output]);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /non-cleared source "onemg-live"/u);
  assert.match(failed.stderr, /non-cleared source "fixture-unlisted"/u);
  assert.match(failed.stderr, /public release check failed: 2 of 3 rows/u);
});

test('check mode rejects a zero-row artifact instead of passing vacuously', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-check-empty-');
  const empty = path.join(scratch, 'empty.jsonl');
  fs.writeFileSync(empty, '');
  const failed = run(['--input', empty, '--output', path.join(scratch, 'empty-release')]);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /no rows from cleared sources/u);

  const blankLines = path.join(scratch, 'blank.jsonl');
  fs.writeFileSync(blankLines, '\n\n\n');
  const alsoFailed = run([
    '--input', blankLines,
    '--output', path.join(scratch, 'blank-release'),
  ]);
  assert.notEqual(alsoFailed.status, 0);
  assert.match(alsoFailed.stderr, /no rows from cleared sources/u);
});

test('staging hard-fails on a corrupt row and leaves the output absent', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-corrupt-');
  const inputPath = path.join(scratch, 'drugs.jsonl');
  writeJsonl(inputPath, [
    row('ok', 'github-jr'),
    { brand_name: 'no-sources' },
  ]);

  const output = path.join(scratch, 'staged');
  const result = run(['--input', inputPath, '--output', output]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing or empty sources array; the export is corrupt/u);
  assert.match(result.stderr, /input line 2/u);
  assert.equal(fs.existsSync(output), false);
});

test('staging refuses unrecognized output directories and zero-row releases', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-safety-');
  const inputPath = path.join(scratch, 'drugs.jsonl');
  writeJsonl(inputPath, [row('ok', 'github-jr')]);

  const occupied = path.join(scratch, 'occupied');
  fs.mkdirSync(occupied);
  fs.writeFileSync(path.join(occupied, 'do-not-delete.txt'), 'owner data\n');
  const refused = run(['--input', inputPath, '--output', occupied]);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /refusing to replace existing output/u);
  assert.equal(fs.readFileSync(path.join(occupied, 'do-not-delete.txt'), 'utf8'), 'owner data\n');

  const restrictedOnly = path.join(scratch, 'restricted.jsonl');
  writeJsonl(restrictedOnly, [row('bad', 'onemg-live')]);
  const empty = run([
    '--input', restrictedOnly,
    '--output', path.join(scratch, 'empty-release'),
  ]);
  assert.notEqual(empty.status, 0);
  assert.match(empty.stderr, /no rows from cleared sources/u);
  assert.equal(fs.existsSync(path.join(scratch, 'empty-release')), false);

  const inRepo = run([
    '--input', inputPath,
    '--output', path.join(ROOT, 'data-static', '__public-release-test__'),
  ]);
  assert.notEqual(inRepo.status, 0);
  assert.match(inRepo.stderr, /repository output must be a child of/u);
  assert.equal(fs.existsSync(path.join(ROOT, 'data-static', '__public-release-test__')), false);
});

test('staging treats completed output directories as immutable', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-replace-');
  const inputPath = path.join(scratch, 'drugs.jsonl');
  writeJsonl(inputPath, [row('first', 'github-jr')]);
  const output = path.join(scratch, 'staged');
  const first = run(['--input', inputPath, '--output', output]);
  assert.equal(first.status, 0, first.stderr || first.stdout);

  writeJsonl(inputPath, [row('second', 'github-jr')]);
  const second = run(['--input', inputPath, '--output', output]);
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /public release stages are immutable/u);
  const stagedRows = fs.readFileSync(path.join(output, 'drugs.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(stagedRows.map((entry) => entry.brand_name), ['first']);
});

test('public catalogue clearance enforces use, storage, artifact-pack, and notice constraints', () => {
  const manifest = fixtureManifest({
    'fixture-open': fixtureSource(),
    'identity-only': fixtureSource({ allowed_uses: ['ingredient-index'] }),
    'wrong-zone': fixtureSource({
      required_storage_zones: {
        'production-open': ['data/interaction/production-open/nested'],
        'internal-evaluation': ['data/interaction/internal-evaluation'],
      },
    }),
    'separate-pack': fixtureSource({ artifact_pack: 'separate-pack' }),
  });

  const { cleared, excluded } = classifyPublicReleaseSources(manifest);
  assert.equal(cleared.has('fixture-open'), true, excluded.get('fixture-open')?.reason);
  assert.equal(cleared.has('identity-only'), false);
  assert.match(excluded.get('identity-only').reason, /does not allow use "catalogue"/u);
  assert.equal(cleared.has('wrong-zone'), false);
  assert.match(excluded.get('wrong-zone').reason, /outside its required storage zone/u);
  assert.equal(cleared.has('separate-pack'), false);
  assert.match(excluded.get('separate-pack').reason, /artifact pack "separate-pack"/u);
});

test('row evaluation reconciles primary and array provenance instead of trusting omission', () => {
  const cleared = new Map([['github-jr', { licence_id: 'MIT' }]]);
  assert.deepEqual(evaluateRowSources({
    ...row('consistent', 'github-jr'),
    source: 'github-jr',
  }, cleared), {
    include: true,
    excluded_source_ids: [],
  });
  assert.throws(
    () => evaluateRowSources({
      ...row('omitted-primary', 'github-jr'),
      source: 'onemg-live',
    }, cleared),
    /primary source "onemg-live" is absent from sources/u,
  );
  assert.throws(
    () => evaluateRowSources({
      brand_name: 'conflicting-entry',
      sources: [{ source: 'github-jr', source_policy_id: 'onemg-live' }],
    }, cleared),
    /conflicting source ids/u,
  );
});

test('CLI policy is fixed to the committed manifest', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-policy-');
  const manifestPath = path.join(scratch, 'forged-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(fixtureManifest({
    forged: fixtureSource(),
  }), null, 2)}\n`);
  const inputPath = path.join(scratch, 'drugs.jsonl');
  writeJsonl(inputPath, [row('forged', 'forged')]);

  const result = run([
    '--input', inputPath,
    '--output', path.join(scratch, 'staged'),
    '--manifest', manifestPath,
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown argument --manifest/u);
});

test('check authenticates the complete staged directory', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-package-');
  const inputPath = path.join(scratch, 'drugs.jsonl');
  writeJsonl(inputPath, [row('open', 'github-jr')]);
  const output = path.join(scratch, 'staged');
  const staged = run(['--input', inputPath, '--output', output]);
  assert.equal(staged.status, 0, staged.stderr || staged.stdout);

  const checked = run(['--check', output]);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  assert.match(checked.stdout, /public release package check passed/u);

  fs.writeFileSync(path.join(output, 'unexpected.txt'), 'not part of the package\n');
  const withExtra = run(['--check', output]);
  assert.notEqual(withExtra.status, 0);
  assert.match(withExtra.stderr, /unexpected package file/u);
});
