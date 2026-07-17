import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseNetmedsComposition, parseNetmedsProduct, parseSitemapLocs, readNetmedsNormalized,
} from '../../src/adapters/netmeds.mjs';

const productHtml = fs.readFileSync('test/fixtures/netmeds/product.html', 'utf8');
const sitemapXml = fs.readFileSync('test/fixtures/netmeds/sitemap-sample.xml', 'utf8');

test('parseNetmedsComposition: "MOL STRENGTH UNIT" single + combo', () => {
  const single = parseNetmedsComposition('Metformin 500 mg');
  assert.deepEqual(single.map((i) => i.molecule), ['metformin']);
  assert.equal(single[0].strength_value, 500);
  assert.equal(single[0].strength_unit, 'mg');
  const combo = parseNetmedsComposition('Amoxicillin 500 mg+Clavulanic Acid 125 mg');
  assert.deepEqual(combo.map((i) => i.molecule), ['amoxycillin', 'clavulanic acid']); // alias applied, sorted
});

test('parseNetmedsProduct: brand + manufacturer + composition from __INITIAL_STATE__', () => {
  const r = parseNetmedsProduct(productHtml);
  assert.match(r.brand_name, /ACIFORMIN 500/i);
  assert.match(r.manufacturer, /ACIDUS OJAS/i);
  assert.deepEqual(r.ingredients.map((i) => i.molecule), ['metformin']);
  assert.equal(r.source, 'netmeds');
});

test('parseNetmedsProduct: non-drug SKU -> null (device filter, no dosage digit)', () => {
  const mask = '<html><script>window.__INITIAL_STATE__ = {"productDetailsPage":{"product":{"attributes":{"mstar-displaynamewops":"Surgical Mask","manufacturername":"X"}}}};</script></html>';
  assert.equal(parseNetmedsProduct(mask), null);
  // herbal: generic is category text with no dosage -> skipped
  const herbal = '<html><script>window.__INITIAL_STATE__ = {"productDetailsPage":{"product":{"attributes":{"mstar-displaynamewops":"Septilin Syrup","genericnamewithdosage":"Ayurvedic Medicine","manufacturername":"Himalaya"}}}};</script></html>';
  assert.equal(parseNetmedsProduct(herbal), null);
});

test('parseSitemapLocs extracts <loc> entries', () => {
  const locs = parseSitemapLocs(sitemapXml);
  assert.equal(locs.length, 2);
  assert.ok(locs[0].includes('/product/aciformin-500-tablet'));
});

test('readNetmedsNormalized: last write per identity wins', () => {
  const root = 'test/.tmp-nm';
  fs.rmSync(root, { recursive: true, force: true });
  const mk = (date, molecule) => {
    fs.mkdirSync(`${root}/netmeds/${date}`, { recursive: true });
    fs.writeFileSync(`${root}/netmeds/${date}/normalized.jsonl`, JSON.stringify({
      source: 'netmeds', source_id: '1', seen_at: date, brand_name: 'Aciformin', manufacturer: 'Acidus',
      pack_label: '', ingredients: [{ molecule, strength_value: 1, strength_unit: 'mg', strength_raw: '1mg' }],
      composition_status: 'complete', substitutes_raw: [],
    }) + '\n');
  };
  mk('2026-07-01', 'old');
  mk('2026-07-17', 'new');
  const rows = readNetmedsNormalized(root);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ingredients[0].molecule, 'new');
  fs.rmSync(root, { recursive: true, force: true });
});
