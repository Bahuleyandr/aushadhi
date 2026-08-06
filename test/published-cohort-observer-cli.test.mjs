import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const digest = (value) => createHash('sha256').update(value).digest('hex');

function createFixture(t) {
  const distRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-observer-dist-'));
  t.after(() => fs.rmSync(distRoot, { recursive: true, force: true }));
  const generationId = 'observer-generation';
  const date = '2026-08-06';
  const generationDir = path.join(distRoot, '.generations', generationId);
  fs.mkdirSync(generationDir, { recursive: true });
  const contents = {
    'drugs.jsonl': '{"brand_name":"Medicine A","sources":[{"source":"github-jr"}]}\n',
    'summary.json': `${JSON.stringify({
      date,
      total_rows: 1,
      unique_compositions: 1,
      composition_status: { complete: 1 },
      conflicts: 0,
      errors: 0,
      sources: { 'github-jr': 1 },
    })}\n`,
    'REPORT.md': '# Bound report\n',
  };
  for (const [name, value] of Object.entries(contents)) {
    fs.writeFileSync(path.join(generationDir, name), value);
  }
  const manifestContents = `${JSON.stringify({
    schema_version: 1,
    generation_id: generationId,
    date,
    counts: { drugs: 1 },
    files: {
      'drugs.jsonl': {
        sha256: digest(contents['drugs.jsonl']),
        size_bytes: Buffer.byteLength(contents['drugs.jsonl']),
        record_count: 1,
      },
      'summary.json': {
        sha256: digest(contents['summary.json']),
        size_bytes: Buffer.byteLength(contents['summary.json']),
      },
      'REPORT.md': {
        sha256: digest(contents['REPORT.md']),
        size_bytes: Buffer.byteLength(contents['REPORT.md']),
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
  return { contents, distRoot, generationDir };
}

function run(script, distRoot, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, AUSHADHI_DIST_ROOT: distRoot },
    windowsHide: true,
  });
}

function rewriteWithPreservedMetadata(file, contents, replacement) {
  const preservedTime = new Date('2026-08-06T01:02:03.000Z');
  fs.writeFileSync(file, contents);
  fs.utimesSync(file, preservedTime, preservedTime);
  const before = fs.statSync(file);
  fs.writeFileSync(file, replacement);
  fs.utimesSync(file, preservedTime, preservedTime);
  const after = fs.statSync(file);
  assert.equal(after.size, before.size);
  assert.equal(after.mtimeMs, before.mtimeMs);
}

test('report and stats verify exactly the published artifacts they consume', (t) => {
  const fixture = createFixture(t);
  const report = run('src/cli/report.mjs', fixture.distRoot);
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /Bound report/);
  const stats = run('src/cli/stats.mjs', fixture.distRoot);
  assert.equal(stats.status, 0, stats.stderr);
  assert.match(stats.stdout, /2026-08-06/);

  const reportPath = path.join(fixture.generationDir, 'REPORT.md');
  rewriteWithPreservedMetadata(
    reportPath,
    fixture.contents['REPORT.md'],
    '# Tound report\n',
  );
  const tamperedReport = run('src/cli/report.mjs', fixture.distRoot);
  assert.equal(tamperedReport.status, 1);
  assert.match(tamperedReport.stderr, /REPORT\.md hash mismatch/i);
  fs.writeFileSync(reportPath, fixture.contents['REPORT.md']);

  const summaryPath = path.join(fixture.generationDir, 'summary.json');
  rewriteWithPreservedMetadata(
    summaryPath,
    fixture.contents['summary.json'],
    fixture.contents['summary.json'].replace('2026-08-06', '2026-08-07'),
  );
  const tamperedStats = run('src/cli/stats.mjs', fixture.distRoot);
  assert.equal(tamperedStats.status, 1);
  assert.match(tamperedStats.stderr, /summary\.json hash mismatch/i);
});

test('PMBJP verifier checks the published catalogue before consuming it', (t) => {
  const fixture = createFixture(t);
  const drugsPath = path.join(fixture.generationDir, 'drugs.jsonl');
  rewriteWithPreservedMetadata(
    drugsPath,
    fixture.contents['drugs.jsonl'],
    fixture.contents['drugs.jsonl'].replace('Medicine A', 'Medicine B'),
  );
  const listPath = path.join(path.dirname(fixture.distRoot), `${path.basename(fixture.distRoot)}.txt`);
  fs.writeFileSync(listPath, '1 1 Medicine A 1mg\n');
  t.after(() => fs.rmSync(listPath, { force: true }));
  const result = run('src/cli/verify-pmbjp-mapping-codes.mjs', fixture.distRoot, [
    `--list=${listPath}`,
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /drugs\.jsonl hash mismatch/i);
});
