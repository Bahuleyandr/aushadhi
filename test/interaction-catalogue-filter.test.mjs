import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInteractionCatalogueFromFiles } from '../src/lib/interaction-catalogue-filter.mjs';

function product(name, sources) {
  return {
    brand_name: name,
    ingredients: [{ molecule: name.toLowerCase() }],
    sources: sources.map((source) => ({ source, source_id: `${source}:${name}` })),
  };
}

async function writeFixture(dir, rows, sources) {
  const artifactPath = path.join(dir, 'drugs.jsonl');
  const summaryPath = path.join(dir, 'summary.json');
  await fs.writeFile(
    artifactPath,
    rows.map((row) => JSON.stringify(row)).join('\n').concat('\n'),
  );
  await fs.writeFile(
    summaryPath,
    `${JSON.stringify({ total_rows: rows.length, sources }, null, 2)}\n`,
  );
  return { artifactPath, summaryPath };
}

async function runFilter(dir, profile, fixture) {
  const outputDir = path.join(dir, 'output');
  return buildInteractionCatalogueFromFiles({
    profile,
    artifactPath: fixture.artifactPath,
    artifactStoragePath: 'dist/latest/drugs.jsonl',
    artifactSummaryPath: fixture.summaryPath,
    artifactSummaryStoragePath: 'dist/latest/summary.json',
    outputPath: path.join(outputDir, 'drugs.jsonl'),
    outputStoragePath: `data/interaction/${profile}/product-catalogue/drugs.jsonl`,
    outputSummaryPath: path.join(outputDir, 'summary.json'),
    outputSummaryStoragePath: `data/interaction/${profile}/product-catalogue/summary.json`,
  });
}

test('internal catalogue filter excludes an unknown source and any mixed row containing it', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'interaction-catalogue-'));
  const rows = [
    product('Open', ['github-jr']),
    product('Restricted', ['onemg-live']),
    product('Unknown', ['apollo']),
    product('Mixed', ['github-jr', 'apollo']),
  ];
  const fixture = await writeFixture(dir, rows, {
    'github-jr': 2,
    'onemg-live': 1,
    apollo: 2,
  });
  const result = await runFilter(dir, 'internal-evaluation', fixture);
  assert.equal(result.summary.total_rows, 2);
  assert.equal(result.summary.exclusions.row_count, 2);
  assert.deepEqual(result.summary.sources, { 'github-jr': 1, 'onemg-live': 1 });
  assert.deepEqual(result.summary.exclusions.source_counts, { apollo: 2 });
  assert.match(result.summary.exclusions.reasons.apollo, /unknown interaction source/);
  const output = (await fs.readFile(result.output_path, 'utf8'))
    .trim()
    .split('\n')
    .map(JSON.parse);
  assert.deepEqual(output.map((row) => row.brand_name), ['Open', 'Restricted']);
});

test('production-open filter excludes restricted sources', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'interaction-catalogue-'));
  const rows = [
    product('Open', ['github-jr']),
    product('Restricted', ['onemg-live']),
  ];
  const fixture = await writeFixture(dir, rows, {
    'github-jr': 1,
    'onemg-live': 1,
  });
  const result = await runFilter(dir, 'production-open', fixture);
  assert.equal(result.summary.total_rows, 1);
  assert.equal(result.summary.exclusions.row_count, 1);
  assert.deepEqual(result.summary.sources, { 'github-jr': 1 });
  assert.match(result.summary.exclusions.reasons['onemg-live'], /not allowed in profile/);
});

test('catalogue filter rejects stale summaries without replacing prior outputs', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'interaction-catalogue-'));
  const fixture = await writeFixture(dir, [product('Open', ['github-jr'])], {
    'github-jr': 1,
  });
  await fs.writeFile(
    fixture.summaryPath,
    `${JSON.stringify({ total_rows: 2, sources: { 'github-jr': 1 } })}\n`,
  );
  const outputDir = path.join(dir, 'output');
  await fs.mkdir(outputDir);
  await fs.writeFile(path.join(outputDir, 'drugs.jsonl'), 'sentinel\n');
  await fs.writeFile(path.join(outputDir, 'summary.json'), '{"sentinel":true}\n');
  await assert.rejects(
    () => runFilter(dir, 'internal-evaluation', fixture),
    /row count does not match/,
  );
  assert.equal(await fs.readFile(path.join(outputDir, 'drugs.jsonl'), 'utf8'), 'sentinel\n');
  assert.equal(
    await fs.readFile(path.join(outputDir, 'summary.json'), 'utf8'),
    '{"sentinel":true}\n',
  );
});
