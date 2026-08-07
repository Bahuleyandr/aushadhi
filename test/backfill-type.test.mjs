import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  backfillSource, parseBackfillArgs, scanCachedTypes,
} from '../src/cli/backfill-type.mjs';
import { readNetmedsNormalized } from '../src/adapters/netmeds.mjs';

const netmedsHtml = fs.readFileSync('test/fixtures/netmeds/product.html', 'utf8');
const pharmeasyHtml = fs.readFileSync('test/fixtures/pharmeasy/product.html', 'utf8');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-backfill-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeRows(root, source, date, rows) {
  const dir = path.join(root, source, date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'normalized.jsonl'),
    `${rows.map((value) => JSON.stringify(value)).join('\n')}\n`,
  );
}

function row(source, sourceId, over = {}) {
  return {
    source, source_id: sourceId, seen_at: '2026-07-01', brand_name: 'X', manufacturer: 'M',
    pack_label: '', form_raw: null, price_inr: null, is_discontinued: null,
    ingredients: [{ molecule: 'metformin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
    composition_raw: 'Metformin 500 mg', composition_status: 'complete', substitutes_raw: [],
    type: null, ...over,
  };
}

test('backfillSource: defaults to a write-free dry run', (t) => {
  const root = tempRoot(t);
  fs.mkdirSync(path.join(root, 'netmeds', 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'netmeds', 'pages', 'aaaa.html'), netmedsHtml);
  writeRows(root, 'netmeds', '2026-07-01', [
    row('netmeds', '10230093'),
    row('netmeds', '999'),
    row('netmeds', '888', { type: 'allopathy' }),
  ]);

  const result = backfillSource({ rawRoot: root, source: 'netmeds', log: () => {} });
  assert.deepEqual(result, {
    source: 'netmeds', cached: 1, rows: 3, patched: 1, mode: 'dry-run', output: null,
  });
  assert.equal(fs.existsSync(path.join(root, '.type-backfill')), false);
  assert.equal(readNetmedsNormalized(root).find((value) => value.source_id === '10230093').type, null);
});

test('backfillSource: apply writes an immutable generation-scoped candidate outside runtime inputs', (t) => {
  const root = tempRoot(t);
  fs.mkdirSync(path.join(root, 'netmeds', 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'netmeds', 'pages', 'aaaa.html'), netmedsHtml);
  writeRows(root, 'netmeds', '2026-07-01', [row('netmeds', '10230093')]);

  const result = backfillSource({
    rawRoot: root, source: 'netmeds', apply: true, generation: 'review-2026-08-07', log: () => {},
  });
  const output = path.join(root, '.type-backfill', 'review-2026-08-07', 'netmeds');
  assert.equal(result.mode, 'candidate');
  assert.equal(result.output, output);
  const candidate = fs.readFileSync(path.join(output, 'normalized.jsonl'), 'utf8')
    .trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(candidate.length, 1);
  assert.equal(candidate[0].source_id, '10230093');
  assert.equal(candidate[0].type, 'allopathy');
  assert.equal(candidate[0].seen_at, '2026-07-01');
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
  assert.equal(manifest.generation_id, 'review-2026-08-07');
  assert.equal(manifest.promotion_authority, 'none');
  assert.equal(manifest.deployment_authority, 'none');
  assert.equal(manifest.candidate_rows, 1);
  assert.match(manifest.normalized_jsonl_sha256, /^[a-f0-9]{64}$/);
  assert.equal(readNetmedsNormalized(root)[0].type, null);

  assert.throws(() => backfillSource({
    rawRoot: root, source: 'netmeds', apply: true, generation: 'review-2026-08-07', log: () => {},
  }), /already exists/);
});

test('backfillSource: apply requires a safe generation and respects an existing lock', (t) => {
  const root = tempRoot(t);
  assert.throws(
    () => backfillSource({ rawRoot: root, source: 'netmeds', apply: true, log: () => {} }),
    /generation is required/,
  );
  assert.throws(
    () => backfillSource({ rawRoot: root, source: 'netmeds', apply: true, generation: '../escape', log: () => {} }),
    /invalid generation/,
  );
  fs.mkdirSync(path.join(root, 'netmeds', 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'netmeds', 'pages', 'aaaa.html'), netmedsHtml);
  writeRows(root, 'netmeds', '2026-07-01', [row('netmeds', '10230093')]);
  fs.mkdirSync(path.join(root, '.type-backfill.lock'));
  assert.throws(
    () => backfillSource({ rawRoot: root, source: 'netmeds', apply: true, generation: 'locked', log: () => {} }),
    /backfill lock already exists/,
  );
});

test('parseBackfillArgs: dry-run is default and apply requires an explicit generation', () => {
  assert.deepEqual(parseBackfillArgs([]), {
    apply: false, generation: null, sources: ['onemg', 'apollo', 'netmeds', 'pharmeasy'],
  });
  assert.deepEqual(parseBackfillArgs(['netmeds']), {
    apply: false, generation: null, sources: ['netmeds'],
  });
  assert.deepEqual(parseBackfillArgs(['--apply', '--generation', 'g-1', 'netmeds']), {
    apply: true, generation: 'g-1', sources: ['netmeds'],
  });
  assert.throws(() => parseBackfillArgs(['--apply']), /--generation/);
  assert.throws(() => parseBackfillArgs(['--generation', 'g-1']), /requires --apply/);
  assert.throws(() => parseBackfillArgs(['--unknown']), /unknown option/);
});

test('scanCachedTypes: reads compressed cache entries and ignores invalidated pages', (t) => {
  const root = tempRoot(t);
  const pages = path.join(root, 'pharmeasy', 'pages');
  fs.mkdirSync(pages, { recursive: true });
  fs.writeFileSync(path.join(pages, 'valid.html.gz'), gzipSync(pharmeasyHtml));
  fs.writeFileSync(path.join(pages, 'invalid.html'), pharmeasyHtml);
  fs.writeFileSync(path.join(pages, 'invalid.html.invalid'), 'invalid\n');
  const found = scanCachedTypes(pages, () => ({ sourceId: '108', type: 'allopathy' }));
  assert.deepEqual([...found], [['108', 'allopathy']]);
});
