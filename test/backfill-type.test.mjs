import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { backfillSource, scanCachedTypes } from '../src/cli/backfill-type.mjs';
import { readNetmedsNormalized } from '../src/adapters/netmeds.mjs';
import { readOnemgNormalized } from '../src/adapters/onemg.mjs';
import { readApolloNormalized } from '../src/adapters/apollo.mjs';

const netmedsHtml = fs.readFileSync('test/fixtures/netmeds/product.html', 'utf8');
const pharmeasyHtml = fs.readFileSync('test/fixtures/pharmeasy/product.html', 'utf8');
const onemgHtml = fs.readFileSync('test/fixtures/onemg/drug_page_tablet.html', 'utf8');
const apolloHtml = fs.readFileSync('test/fixtures/apollo/medicine_elmox.html', 'utf8');

function writeRows(root, source, date, rows) {
  fs.mkdirSync(`${root}/${source}/${date}`, { recursive: true });
  fs.writeFileSync(
    `${root}/${source}/${date}/normalized.jsonl`,
    `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
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

test('backfillSource: patches null-type netmeds rows from the cached page evidence', () => {
  const root = 'test/.tmp-backfill-netmeds';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(`${root}/netmeds/pages`, { recursive: true });
  fs.writeFileSync(`${root}/netmeds/pages/aaaa.html`, netmedsHtml); // uid 10230093, schedule H
  writeRows(root, 'netmeds', '2026-07-01', [
    row('netmeds', '10230093'),
    row('netmeds', '999'), // no cached page -> must stay null
    row('netmeds', '888', { type: 'allopathy' }), // already typed -> not re-emitted
  ]);

  const result = backfillSource({ rawRoot: root, source: 'netmeds', date: '2026-08-06', log: () => {} });
  assert.deepEqual(result, { source: 'netmeds', cached: 1, rows: 3, patched: 1 });

  const patchedLines = fs.readFileSync(`${root}/netmeds/2026-08-06/normalized.jsonl`, 'utf8')
    .trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(patchedLines.length, 1);
  assert.equal(patchedLines[0].source_id, '10230093');
  assert.equal(patchedLines[0].type, 'allopathy');
  // re-parsing a cached page is not a new observation: seen_at is untouched
  assert.equal(patchedLines[0].seen_at, '2026-07-01');

  const merged = readNetmedsNormalized(root);
  assert.equal(merged.find((r) => r.source_id === '10230093').type, 'allopathy');
  assert.equal(merged.find((r) => r.source_id === '999').type, null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('backfillSource: onemg source_id comes from the cached page canonical link', () => {
  const root = 'test/.tmp-backfill-onemg';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(`${root}/onemg/pages`, { recursive: true });
  fs.writeFileSync(`${root}/onemg/pages/bbbb.html`, onemgHtml); // canonical .../augmentin-625-duo-tablet-138629
  writeRows(root, 'onemg', '2026-07-01', [
    row('onemg-live', '138629', { brand_name: 'Augmentin 625 Duo Tablet' }),
  ]);

  const result = backfillSource({ rawRoot: root, source: 'onemg', date: '2026-08-06', log: () => {} });
  assert.deepEqual(result, { source: 'onemg', cached: 1, rows: 1, patched: 1 });
  assert.equal(readOnemgNormalized(root)[0].type, 'allopathy');
  assert.equal(readOnemgNormalized(root)[0].seen_at, '2026-07-01');
  fs.rmSync(root, { recursive: true, force: true });
});

test('backfillSource: apollo binds the JSON-LD identity to the cached canonical path', () => {
  const root = 'test/.tmp-backfill-apollo';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(`${root}/apollo/pages`, { recursive: true });
  fs.writeFileSync(`${root}/apollo/pages/cccc.html`, apolloHtml);
  writeRows(root, 'apollo', '2026-07-01', [row('apollo', 'elmox-cv-625mg-tablet')]);

  const result = backfillSource({ rawRoot: root, source: 'apollo', date: '2026-08-06', log: () => {} });
  assert.deepEqual(result, { source: 'apollo', cached: 1, rows: 1, patched: 1 });
  assert.equal(readApolloNormalized(root)[0].type, 'allopathy');
  fs.rmSync(root, { recursive: true, force: true });
});

test('backfillSource: reads retention-compressed .html.gz entries', () => {
  const root = 'test/.tmp-backfill-gz';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(`${root}/pharmeasy/pages`, { recursive: true });
  fs.writeFileSync(`${root}/pharmeasy/pages/dddd.html.gz`, gzipSync(pharmeasyHtml));
  writeRows(root, 'pharmeasy', '2026-07-01', [row('pharmeasy', '108')]);

  const result = backfillSource({ rawRoot: root, source: 'pharmeasy', date: '2026-08-06', log: () => {} });
  assert.deepEqual(result, { source: 'pharmeasy', cached: 1, rows: 1, patched: 1 });
  fs.rmSync(root, { recursive: true, force: true });
});

test('scanCachedTypes: honors .invalid markers and pages without category evidence', () => {
  const root = 'test/.tmp-backfill-invalid';
  fs.rmSync(root, { recursive: true, force: true });
  const pages = `${root}/pharmeasy/pages`;
  fs.mkdirSync(pages, { recursive: true });
  // invalidated entry: parser rejected this capture; it must never be trusted
  fs.writeFileSync(`${pages}/eeee.html`, pharmeasyHtml);
  fs.writeFileSync(`${pages}/eeee.html.invalid`, '2026-08-06T00:00:00.000Z\n');
  // evidence-free page: parses but carries no category signal
  fs.writeFileSync(
    `${pages}/ffff.html`,
    pharmeasyHtml.replaceAll('"isRxRequired":true', '"isRxRequired":false'),
  );
  writeRows(root, 'pharmeasy', '2026-07-01', [row('pharmeasy', '108')]);

  const result = backfillSource({ rawRoot: root, source: 'pharmeasy', date: '2026-08-06', log: () => {} });
  assert.deepEqual(result, { source: 'pharmeasy', cached: 0, rows: 1, patched: 0 });
  assert.equal(fs.existsSync(`${root}/pharmeasy/2026-08-06`), false);
  fs.rmSync(root, { recursive: true, force: true });
});
