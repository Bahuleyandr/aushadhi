import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs as parseCatalogueArgs } from '../src/cli/build-interaction-catalogue.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = (value) => createHash('sha256').update(value).digest('hex');

function createPublishedFixture(t) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-published-readers-'));
  const outputRoot = fs.mkdtempSync(path.join(
    ROOT,
    'data',
    'interaction',
    'internal-evaluation',
    '.tmp-published-readers-',
  ));
  t.after(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.rmSync(outputRoot, { recursive: true, force: true });
  });
  const distRoot = path.join(fixtureRoot, 'external-dist');
  const generationId = 'external-generation';
  const date = '2026-08-06';
  const generationDir = path.join(distRoot, '.generations', generationId);
  fs.mkdirSync(generationDir, { recursive: true });
  const row = {
    brand_name: 'Warfarin Test',
    manufacturer: 'Fixture Manufacturer',
    pack_label: 'strip of 10 tablets',
    form_raw: 'tablet',
    ingredients: [{
      molecule: 'warfarin',
      observed_name: 'Warfarin',
      strength_raw: '5 mg',
      strength_value: 5,
      strength_unit: 'mg',
    }],
    sources: [{ source: 'github-jr', source_id: 'fixture-1', seen_at: date }],
  };
  const drugsContents = `${JSON.stringify(row)}\n`;
  const summaryContents = `${JSON.stringify({
    date,
    total_rows: 1,
    sources: { 'github-jr': 1 },
  })}\n`;
  const drugsPath = path.join(generationDir, 'drugs.jsonl');
  const summaryPath = path.join(generationDir, 'summary.json');
  fs.writeFileSync(drugsPath, drugsContents);
  fs.writeFileSync(summaryPath, summaryContents);
  const manifestContents = `${JSON.stringify({
    schema_version: 1,
    generation_id: generationId,
    date,
    counts: { drugs: 1 },
    files: {
      'drugs.jsonl': {
        sha256: digest(drugsContents),
        size_bytes: Buffer.byteLength(drugsContents),
        record_count: 1,
      },
      'summary.json': {
        sha256: digest(summaryContents),
        size_bytes: Buffer.byteLength(summaryContents),
      },
    },
  })}\n`;
  fs.writeFileSync(path.join(generationDir, 'cohort-manifest.json'), manifestContents);
  fs.writeFileSync(path.join(distRoot, 'cohort-index.json'), `${JSON.stringify({
    schema_version: 1,
    updated_at: '2026-08-06T00:00:00.000Z',
    latest: { date, generation_id: generationId },
    dates: { [date]: generationId },
    generations: {
      [generationId]: {
        date,
        manifest_sha256: digest(manifestContents),
        published_at: '2026-08-06T00:00:00.000Z',
      },
    },
  }, null, 2)}\n`);
  return { distRoot, drugsContents, drugsPath, outputRoot };
}

function runCli(script, args, distRoot) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, AUSHADHI_DIST_ROOT: distRoot },
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
}

test('catalogue rejects a detached summary override without an explicit artifact', () => {
  assert.throws(
    () => parseCatalogueArgs([
      '--profile', 'internal-evaluation',
      '--artifact-summary', 'dist/open/summary.json',
    ]),
    /--artifact-summary requires --artifact/i,
  );
});

test('catalogue and backlog bind an external published cohort to logical dist paths', (t) => {
  const fixture = createPublishedFixture(t);
  const catalogueOutput = path.join(fixture.outputRoot, 'catalogue');
  const backlogOutput = path.join(fixture.outputRoot, 'backlog');
  const catalogue = runCli('src/cli/build-interaction-catalogue.mjs', [
    '--profile', 'internal-evaluation',
    '--output-dir', catalogueOutput,
  ], fixture.distRoot);
  assert.equal(catalogue.status, 0, catalogue.stderr);
  const catalogueSummary = JSON.parse(fs.readFileSync(
    path.join(catalogueOutput, 'summary.json'),
    'utf8',
  ));
  assert.equal(
    catalogueSummary.input.artifact_storage_path,
    'dist/.generations/external-generation/drugs.jsonl',
  );
  assert.equal(
    catalogueSummary.input.summary_storage_path,
    'dist/.generations/external-generation/summary.json',
  );

  const backlog = runCli('src/cli/build-interaction-mapping-backlog.mjs', [
    '--profile', 'internal-evaluation',
    '--output-dir', backlogOutput,
  ], fixture.distRoot);
  assert.equal(backlog.status, 0, backlog.stderr);
  const backlogSummary = JSON.parse(fs.readFileSync(
    path.join(backlogOutput, 'summary.json'),
    'utf8',
  ));
  assert.equal(
    backlogSummary.inputs.product_artifact.storage_path,
    'dist/.generations/external-generation/drugs.jsonl',
  );
  assert.equal(
    backlogSummary.inputs.product_artifact.summary_storage_path,
    'dist/.generations/external-generation/summary.json',
  );
});

test('catalogue and backlog reject same-size same-mtime published artifact tampering', (t) => {
  const fixture = createPublishedFixture(t);
  const preservedTime = new Date('2026-08-06T01:02:03.000Z');
  fs.utimesSync(fixture.drugsPath, preservedTime, preservedTime);
  const before = fs.statSync(fixture.drugsPath);
  fs.writeFileSync(
    fixture.drugsPath,
    fixture.drugsContents.replace('Warfarin Test', 'Xarfarin Test'),
  );
  fs.utimesSync(fixture.drugsPath, preservedTime, preservedTime);
  const after = fs.statSync(fixture.drugsPath);
  assert.equal(after.size, before.size);
  assert.equal(after.mtimeMs, before.mtimeMs);

  for (const [script, name] of [
    ['src/cli/build-interaction-catalogue.mjs', 'catalogue'],
    ['src/cli/build-interaction-mapping-backlog.mjs', 'backlog'],
  ]) {
    const result = runCli(script, [
      '--profile', 'internal-evaluation',
      '--output-dir', path.join(fixture.outputRoot, name),
    ], fixture.distRoot);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /drugs\.jsonl hash mismatch/i);
  }
});
