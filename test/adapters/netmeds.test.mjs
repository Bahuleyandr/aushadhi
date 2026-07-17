import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseNetmedsComposition, parseNetmedsProduct, parseSitemapLocs, readNetmedsNormalized,
  isLikelyDrugSlug,
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

test('isLikelyDrugSlug: keeps dosage-form and strength slugs', () => {
  const keep = [
    '/product/aciformin-500-tablet-10s-m9pl5y-10230093',
    '/product/naten-eye-drops-10ml-m9sdd0-10238867',
    '/product/azithromycin-250mg-tablet-6s',
    '/product/umiflow-plus-100-respicap-15s-mhocxs-12930348', // inhalation cap
    '/product/betamethasone-injection-2ml',
    'amoxycillin-clavulanic-acid-625-tablet', // bare slug, no /product/ prefix
  ];
  for (const s of keep) assert.equal(isLikelyDrugSlug(s), true, `should keep ${s}`);
});

test('isLikelyDrugSlug: drops cosmetics and devices', () => {
  const drop = [
    '/product/alex-surgical-3-ply-mask-with-elastic-m90zcj-10047427',
    '/product/elie-saab-le-parfum-bridal-eau-de-parfum-30-ml-m98cnm-10075052',
    '/product/tester-by-terry-rouge-opulent-lipstick-n12-midnight-truffle-35-gm-maxmzn-10706758',
    '/product/moxie-beauty-ultra-hydrating-conditioner-50-ml-mf6w5n-11920967',
    '/product/renee-cosmetics-tinted-moisturizer-ivory-lustre-50-ml-mgp0vv-12764057',
    '/product/flamingo-wrist-brace-black-oc2027-uni-1s-mbkqv0-11035351',
    '/product/thiklok-hair-fiber-brown-35-gm-mbtadh-11154605',
    '/product/ketzi-soap-75gm-luftqe-7500926',
    'accu-chek-instant-glucometer', // bare slug
  ];
  for (const s of drop) assert.equal(isLikelyDrugSlug(s), false, `should drop ${s}`);
});

test('isLikelyDrugSlug: no false-negatives on drug-overlapping words', () => {
  // injectable in a prefilled SYRINGE — "iu" strength wins, syringe is not a non-drug marker
  assert.equal(isLikelyDrugSlug('/product/renemia-2000iu-prefilled-syringepfs-1s-m20zln-8550160'), true);
  // medicated gel/lotion carry no form-word and no cosmetic marker -> kept (not a recognized non-drug)
  assert.equal(isLikelyDrugSlug('/product/clearzit-a-gel-15gm-lufulh-7518739'), true);
  assert.equal(isLikelyDrugSlug('/product/siracilt-itch-lotion-100ml-mc07yf-11209164'), true);
  // Rx dermatological actives rescue medicated shampoo/soap that a cosmetic word would otherwise drop
  assert.equal(isLikelyDrugSlug('/product/scalpe-plus-ketoconazole-anti-dandruff-shampoo-100ml'), true);
  assert.equal(isLikelyDrugSlug('/product/permethrin-medicated-soap-75gm'), true);
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
