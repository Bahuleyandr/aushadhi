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

function restrictedFixtureSource() {
  return fixtureSource({
    name: 'Fixture restricted source',
    licence: {
      id: 'PROPRIETARY',
      class: 'restricted',
      verification_status: 'verified',
      verified_at: '2026-08-06',
      terms_url: 'https://example.org/restricted/terms',
    },
    redistributable: false,
    artifact_pack: 'internal-restricted',
    allowed_profiles: ['internal-evaluation'],
    required_storage_zones: {
      'internal-evaluation': ['data/interaction/internal-evaluation'],
    },
  });
}

function fixtureManifest(sources) {
  return {
    schema_version: 1,
    policy_reviewed_at: '2026-08-06',
    uses: ['catalogue'],
    profiles: {
      'production-open': {
        redistributable: true,
        allowed_licence_classes: ['open', 'open-sharealike', 'public-domain'],
        allowed_uses: ['catalogue'],
        default_storage_zone: 'data/interaction/production-open',
      },
      'internal-evaluation': {
        redistributable: false,
        allowed_licence_classes: [
          'open', 'open-sharealike', 'public-domain', 'restricted', 'non-commercial', 'user-supplied',
        ],
        allowed_uses: ['catalogue'],
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

test('committed manifest clears nppa and github-jr and excludes restricted sources with reasons', () => {
  const { cleared, excluded } = classifyPublicReleaseSources(loadSourceManifest());

  for (const sourceId of ['nppa', 'github-jr']) {
    assert.equal(cleared.has(sourceId), true, `${sourceId} must be cleared`);
    assert.equal(excluded.has(sourceId), false);
  }
  assert.equal(cleared.get('nppa').licence_id, 'INDIA-GAZETTE-MATTER');
  assert.equal(cleared.get('nppa').licence_class, 'open');
  assert.match(cleared.get('nppa').attribution, /National Pharmaceutical Pricing Authority/u);
  assert.equal(cleared.get('github-jr').licence_id, 'MIT');

  for (const sourceId of [
    'onemg-live', 'pharmeasy', 'netmeds', 'apollo', 'janaushadhi',
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
  const manifestPath = path.join(scratch, 'sources.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(fixtureManifest({
    'fixture-open': fixtureSource(),
    'fixture-restricted': restrictedFixtureSource(),
  }), null, 2)}\n`);
  loadSourceManifest(manifestPath);

  const inputPath = path.join(scratch, 'drugs.jsonl');
  writeJsonl(inputPath, [
    row('cleared-1', 'fixture-open'),
    row('restricted-only', 'fixture-restricted'),
    row('unlisted-only', 'fixture-unlisted'),
    row('mixed', 'fixture-open', 'fixture-restricted'),
    row('cleared-2', 'fixture-open'),
  ]);

  const output = path.join(scratch, 'staged');
  const result = run(['--input', inputPath, '--output', output, '--manifest', manifestPath]);
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
  assert.equal(manifest.rows_read, 5);
  assert.equal(manifest.rows_included, 2);
  assert.equal(manifest.rows_excluded, 3);
  assert.equal(manifest.source_manifest.policy_reviewed_at, '2026-08-06');
  assert.match(manifest.source_manifest.sha256, /^[0-9a-f]{64}$/u);

  assert.deepEqual(Object.keys(manifest.included_sources), ['fixture-open']);
  assert.equal(manifest.included_sources['fixture-open'].rows, 2);
  assert.equal(manifest.included_sources['fixture-open'].licence_id, 'MIT');
  assert.equal(manifest.included_sources['fixture-open'].licence_class, 'open');

  assert.deepEqual(
    Object.keys(manifest.excluded_sources).sort(),
    ['fixture-restricted', 'fixture-unlisted'],
  );
  assert.equal(manifest.excluded_sources['fixture-restricted'].rows_excluded, 2);
  assert.match(
    manifest.excluded_sources['fixture-restricted'].reason,
    /licence class "restricted" is not allowed in profile "production-open"/u,
  );
  assert.equal(manifest.excluded_sources['fixture-restricted'].licence_id, 'PROPRIETARY');
  assert.equal(manifest.excluded_sources['fixture-unlisted'].rows_excluded, 1);
  assert.equal(manifest.excluded_sources['fixture-unlisted'].reason, UNLISTED_SOURCE_REASON);

  const staged = fs.readFileSync(path.join(output, 'drugs.jsonl'));
  assert.equal(manifest.artifact_source.record_count, 2);
  assert.equal(manifest.artifact_source.size_bytes, staged.length);
  assert.match(manifest.artifact_source.sha256, /^[0-9a-f]{64}$/u);
});

test('check mode fails on violating artifacts naming the sources and passes on clean ones', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-check-');
  const manifestPath = path.join(scratch, 'sources.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(fixtureManifest({
    'fixture-open': fixtureSource(),
    'fixture-restricted': restrictedFixtureSource(),
  }), null, 2)}\n`);

  const violating = path.join(scratch, 'violating.jsonl');
  writeJsonl(violating, [
    row('ok', 'fixture-open'),
    row('bad', 'fixture-restricted'),
    row('bad-unlisted', 'fixture-unlisted'),
  ]);
  const failed = run(['--check', violating, '--manifest', manifestPath]);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /non-cleared source "fixture-restricted"/u);
  assert.match(failed.stderr, /non-cleared source "fixture-unlisted"/u);
  assert.match(failed.stderr, /public release check failed: 2 of 3 rows/u);

  const clean = path.join(scratch, 'clean.jsonl');
  writeJsonl(clean, [row('ok-1', 'fixture-open'), row('ok-2', 'fixture-open')]);
  const passed = run(['--check', clean, '--manifest', manifestPath]);
  assert.equal(passed.status, 0, passed.stderr || passed.stdout);
  assert.match(passed.stdout, /public release check passed: 2 rows/u);
});

test('check mode rejects a zero-row artifact instead of passing vacuously', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-check-empty-');
  const manifestPath = path.join(scratch, 'sources.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(fixtureManifest({
    'fixture-open': fixtureSource(),
  }), null, 2)}\n`);

  const empty = path.join(scratch, 'empty.jsonl');
  fs.writeFileSync(empty, '');
  const failed = run(['--check', empty, '--manifest', manifestPath]);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /contains no rows; an empty public release is never valid/u);

  const blankLines = path.join(scratch, 'blank.jsonl');
  fs.writeFileSync(blankLines, '\n\n\n');
  const alsoFailed = run(['--check', blankLines, '--manifest', manifestPath]);
  assert.notEqual(alsoFailed.status, 0);
  assert.match(alsoFailed.stderr, /contains no rows; an empty public release is never valid/u);
});

test('staging hard-fails on a corrupt row and leaves the output absent', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-corrupt-');
  const manifestPath = path.join(scratch, 'sources.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(fixtureManifest({
    'fixture-open': fixtureSource(),
  }), null, 2)}\n`);

  const inputPath = path.join(scratch, 'drugs.jsonl');
  writeJsonl(inputPath, [
    row('ok', 'fixture-open'),
    { brand_name: 'no-sources' },
  ]);

  const output = path.join(scratch, 'staged');
  const result = run(['--input', inputPath, '--output', output, '--manifest', manifestPath]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing or empty sources array; the export is corrupt/u);
  assert.match(result.stderr, /input line 2/u);
  assert.equal(fs.existsSync(output), false);
});

test('staging refuses unrecognized output directories and zero-row releases', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-safety-');
  const manifestPath = path.join(scratch, 'sources.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(fixtureManifest({
    'fixture-open': fixtureSource(),
    'fixture-restricted': restrictedFixtureSource(),
  }), null, 2)}\n`);

  const inputPath = path.join(scratch, 'drugs.jsonl');
  writeJsonl(inputPath, [row('ok', 'fixture-open')]);

  const occupied = path.join(scratch, 'occupied');
  fs.mkdirSync(occupied);
  fs.writeFileSync(path.join(occupied, 'do-not-delete.txt'), 'owner data\n');
  const refused = run(['--input', inputPath, '--output', occupied, '--manifest', manifestPath]);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /refusing to replace unrecognized output directory/u);
  assert.equal(fs.readFileSync(path.join(occupied, 'do-not-delete.txt'), 'utf8'), 'owner data\n');

  const restrictedOnly = path.join(scratch, 'restricted.jsonl');
  writeJsonl(restrictedOnly, [row('bad', 'fixture-restricted')]);
  const empty = run([
    '--input', restrictedOnly,
    '--output', path.join(scratch, 'empty-release'),
    '--manifest', manifestPath,
  ]);
  assert.notEqual(empty.status, 0);
  assert.match(empty.stderr, /no rows from cleared sources/u);
  assert.equal(fs.existsSync(path.join(scratch, 'empty-release')), false);

  const inRepo = run([
    '--input', inputPath,
    '--output', path.join(ROOT, 'data-static', '__public-release-test__'),
    '--manifest', manifestPath,
  ]);
  assert.notEqual(inRepo.status, 0);
  assert.match(inRepo.stderr, /repository output must be a child of/u);
  assert.equal(fs.existsSync(path.join(ROOT, 'data-static', '__public-release-test__')), false);
});

test('staging replaces an output directory it recognizes as its own', (t) => {
  const scratch = scratchDir(t, 'aushadhi-public-replace-');
  const manifestPath = path.join(scratch, 'sources.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(fixtureManifest({
    'fixture-open': fixtureSource(),
  }), null, 2)}\n`);

  const inputPath = path.join(scratch, 'drugs.jsonl');
  writeJsonl(inputPath, [row('first', 'fixture-open')]);
  const output = path.join(scratch, 'staged');
  const first = run(['--input', inputPath, '--output', output, '--manifest', manifestPath]);
  assert.equal(first.status, 0, first.stderr || first.stdout);

  writeJsonl(inputPath, [row('second', 'fixture-open')]);
  const second = run(['--input', inputPath, '--output', output, '--manifest', manifestPath]);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const stagedRows = fs.readFileSync(path.join(output, 'drugs.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(stagedRows.map((entry) => entry.brand_name), ['second']);
});

test('INDIA-GAZETTE-MATTER validates as class open and is rejected with other classes', (t) => {
  const scratch = scratchDir(t, 'aushadhi-gazette-enum-');
  const gazetteSource = (licenceClass) => fixtureSource({
    licence: {
      id: 'INDIA-GAZETTE-MATTER',
      class: licenceClass,
      verification_status: 'verified',
      verified_at: '2026-08-06',
      terms_url: 'https://example.org/gazette',
    },
  });

  const validPath = path.join(scratch, 'valid.json');
  fs.writeFileSync(validPath, `${JSON.stringify(fixtureManifest({
    'fixture-gazette': gazetteSource('open'),
  }), null, 2)}\n`);
  const manifest = loadSourceManifest(validPath);
  assert.equal(manifest.sources['fixture-gazette'].licence.id, 'INDIA-GAZETTE-MATTER');
  const { cleared } = classifyPublicReleaseSources(manifest);
  assert.equal(cleared.has('fixture-gazette'), true);

  const invalidPath = path.join(scratch, 'invalid.json');
  fs.writeFileSync(invalidPath, `${JSON.stringify(fixtureManifest({
    'fixture-gazette': gazetteSource('restricted'),
  }), null, 2)}\n`);
  assert.throws(
    () => loadSourceManifest(invalidPath),
    /licence id "INDIA-GAZETTE-MATTER" is incompatible with class "restricted"/u,
  );
});
