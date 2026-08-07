import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseEasyComposition, parseEasyProduct, parseSitemapLocs, readPharmeasyNormalized,
} from '../../src/adapters/pharmeasy.mjs';

const productHtml = fs.readFileSync('test/fixtures/pharmeasy/product.html', 'utf8');
const sitemapXml = fs.readFileSync('test/fixtures/pharmeasy/sitemap-sample.xml', 'utf8');

test('parseEasyComposition: MOL(strength)+MOL(strength), drops " / alt spelling"', () => {
  const ings = parseEasyComposition('Telmisartan(80.0 Mg)+Chlorthalidone / Chlortalidone(12.5 Mg)');
  assert.deepEqual(ings.map((i) => i.molecule), ['chlorthalidone', 'telmisartan']);
  const tel = ings.find((i) => i.molecule === 'telmisartan');
  assert.equal(tel.strength_value, 80);
  assert.equal(tel.strength_unit, 'mg');
});

test('parseEasyProduct: brand + manufacturer + composition from __NEXT_DATA__', () => {
  const r = parseEasyProduct(productHtml, '108');
  assert.match(r.brand_name, /Zytel Ch/i);
  assert.match(r.manufacturer, /AAGAM/i);
  assert.deepEqual(r.ingredients.map((i) => i.molecule), ['chlorthalidone', 'telmisartan']);
  assert.equal(r.composition_status, 'complete');
  assert.equal(r.source, 'pharmeasy');
  assert.equal(r.source_id, '108');
  assert.equal(r.type, null); // prescription status is not a system-of-medicine claim
  assert.equal(parseEasyProduct(productHtml, '109'), null);
});

test('parseEasyProduct: Rx-required and OTC rows both stay unclassified', () => {
  assert.equal(parseEasyProduct(productHtml, '108').type, null);
  const otc = productHtml.replaceAll('"isRxRequired":true', '"isRxRequired":false');
  assert.equal(parseEasyProduct(otc, '108').type, null);
});

test('parseSitemapLocs: extracts every <loc>', () => {
  const locs = parseSitemapLocs(sitemapXml);
  assert.equal(locs.length, 2);
  assert.ok(locs[0].includes('/online-medicine-order/zytel-ch-80mg-tablet-108'));
});

test('readPharmeasyNormalized: refreshes by source product ID without collapsing distinct products', () => {
  const root = 'test/.tmp-pe';
  fs.rmSync(root, { recursive: true, force: true });
  const mk = (date, molecule) => {
    fs.mkdirSync(`${root}/pharmeasy/${date}`, { recursive: true });
    fs.writeFileSync(`${root}/pharmeasy/${date}/normalized.jsonl`, JSON.stringify({
      source: 'pharmeasy', source_id: '108', seen_at: date, brand_name: 'Zytel', manufacturer: 'Aagam',
      pack_label: 'strip', ingredients: [{ molecule, strength_value: 1, strength_unit: 'mg', strength_raw: '1mg' }],
      composition_status: 'complete', substitutes_raw: [],
    }) + '\n');
  };
  mk('2026-07-01', 'old');
  mk('2026-07-17', 'new');
  fs.appendFileSync(`${root}/pharmeasy/2026-07-17/normalized.jsonl`, JSON.stringify({
    source: 'pharmeasy', source_id: '109', seen_at: '2026-07-17', brand_name: 'Zytel', manufacturer: 'Aagam',
    pack_label: 'strip', ingredients: [{ molecule: 'other', strength_value: 1, strength_unit: 'mg', strength_raw: '1mg' }],
    composition_status: 'complete', substitutes_raw: [],
  }) + '\n');
  const rows = readPharmeasyNormalized(root);
  assert.equal(rows.length, 2);
  const refreshed = rows.find((row) => row.source_id === '108');
  assert.equal(refreshed.ingredients[0].molecule, 'new');
  assert.equal(refreshed.first_seen, '2026-07-01');
  assert.equal(rows.find((row) => row.source_id === '109').ingredients[0].molecule, 'other');
  fs.rmSync(root, { recursive: true, force: true });
});
