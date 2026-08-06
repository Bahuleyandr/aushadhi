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
  const productPath = '/product/aciformin-500-tablet-10s-m9pl5y-10230093';
  const r = parseNetmedsProduct(productHtml, '10230093', productPath);
  assert.match(r.brand_name, /ACIFORMIN 500/i);
  assert.match(r.manufacturer, /ACIDUS OJAS/i);
  assert.deepEqual(r.ingredients.map((i) => i.molecule), ['metformin']);
  assert.equal(r.source, 'netmeds');
  assert.equal(r.source_id, '10230093');
  assert.equal(r.type, 'allopathy'); // fixture carries schedule "H" + "Rx required" + CIMS
  assert.equal(parseNetmedsProduct(productHtml, '10230094', productPath), null);
  assert.equal(parseNetmedsProduct(productHtml, '10230093', `${productPath}-wrong`), null);
});

test('parseNetmedsProduct: non-drug SKU -> null (device filter, no dosage digit)', () => {
  const mask = '<html><script>window.__INITIAL_STATE__ = {"productDetailsPage":{"product":{"attributes":{"mstar-displaynamewops":"Surgical Mask","manufacturername":"X"}}}};</script></html>';
  assert.equal(parseNetmedsProduct(mask), null);
  // herbal: generic is category text with no dosage -> skipped
  const herbal = '<html><script>window.__INITIAL_STATE__ = {"productDetailsPage":{"product":{"attributes":{"mstar-displaynamewops":"Septilin Syrup","genericnamewithdosage":"Ayurvedic Medicine","manufacturername":"Himalaya"}}}};</script></html>';
  assert.equal(parseNetmedsProduct(herbal), null);
});

test('parseNetmedsProduct: type only from explicit schedule/Rx/CIMS evidence', () => {
  const page = (attributes) => `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({
    productDetailsPage: { product: { attributes } },
  })};</script></html>`;
  const base = {
    'mstar-displaynamewops': 'Aciformin 500', manufacturername: 'Acidus',
    genericnamewithdosage: 'Metformin 500 mg',
  };
  // passing the composition digit-filter is NOT category evidence -> null
  assert.equal(parseNetmedsProduct(page(base)).type, null);
  assert.equal(parseNetmedsProduct(page({ ...base, schedule: 'H' })).type, 'allopathy');
  assert.equal(parseNetmedsProduct(page({ ...base, schedule: 'H1' })).type, 'allopathy');
  // E1 is the ayurvedic/unani poisons schedule -> not accepted
  assert.equal(parseNetmedsProduct(page({ ...base, schedule: 'E1' })).type, null);
  assert.equal(parseNetmedsProduct(page({ ...base, 'mstar-rxrequired': 'Rx required' })).type, 'allopathy');
  assert.equal(parseNetmedsProduct(page({ ...base, 'mstar-rxrequired': 'Not required' })).type, null);
  assert.equal(
    parseNetmedsProduct(page({ ...base, cimscategoryname: 'Endocrine & Metabolic System' })).type,
    'allopathy',
  );
});

test('parseNetmedsProduct: ASU schedule E/E1 is an unconditional veto, never overridden', () => {
  const page = (attributes) => `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({
    productDetailsPage: { product: { attributes } },
  })};</script></html>`;
  const base = {
    'mstar-displaynamewops': 'Kamini Vidrawan Ras', manufacturername: 'X',
    // standardized-extract listing passes the digit filter
    genericnamewithdosage: 'Ashwagandha 500 mg',
  };
  // Schedule E1 ASU preparations are exactly what e-pharmacies mark Rx-required
  // — the Rx flag must NOT reach 'allopathy' through the OR
  assert.equal(parseNetmedsProduct(page({
    ...base, schedule: 'E1', 'mstar-rxrequired': 'Rx required',
  })).type, null);
  // nor may a CIMS category entry override the veto
  assert.equal(parseNetmedsProduct(page({
    ...base, schedule: 'E1', cimscategoryname: 'Endocrine & Metabolic System',
  })).type, null);
  // all signals at once still lose to the veto; legacy 'E' vetoes the same way
  assert.equal(parseNetmedsProduct(page({
    ...base,
    schedule: 'E1',
    'mstar-rxrequired': 'Rx required',
    cimscategoryname: 'Endocrine & Metabolic System',
  })).type, null);
  assert.equal(parseNetmedsProduct(page({
    ...base, schedule: 'E', 'mstar-rxrequired': 'Rx required',
  })).type, null);
});

test('parseNetmedsProduct: unrecognized schedule spellings veto (fail closed)', () => {
  const page = (attributes) => `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({
    productDetailsPage: { product: { attributes } },
  })};</script></html>`;
  const base = {
    'mstar-displaynamewops': 'Aciformin 500', manufacturername: 'Acidus',
    genericnamewithdosage: 'Metformin 500 mg',
  };
  // any non-empty schedule outside the modern allowlist withholds the claim,
  // even when Rx/CIMS signals are present — spelling variants of E1 must not
  // slip past the veto and reach 'allopathy' through the OR
  assert.equal(parseNetmedsProduct(page({
    ...base, schedule: 'Schedule E1', 'mstar-rxrequired': 'Rx required',
  })).type, null);
  assert.equal(parseNetmedsProduct(page({
    ...base, schedule: 'E-1', cimscategoryname: 'Endocrine & Metabolic System',
  })).type, null);
  assert.equal(parseNetmedsProduct(page({ ...base, schedule: 'E1.' })).type, null);
  // empty schedule is NOT a veto — other branches stay available
  assert.equal(parseNetmedsProduct(page({
    ...base, schedule: '', 'mstar-rxrequired': 'Rx required',
  })).type, 'allopathy');
});

test('parseNetmedsProduct: AYUSH-system CIMS category is a full veto', () => {
  const page = (attributes) => `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({
    productDetailsPage: { product: { attributes } },
  })};</script></html>`;
  const base = {
    'mstar-displaynamewops': 'Ashwagandha 500', manufacturername: 'X',
    genericnamewithdosage: 'Ashwagandha 500 mg',
  };
  for (const cims of ['Ayurvedic Medicine', 'Herbals', 'Homoeopathy', 'Unani', 'Siddha Preparation']) {
    assert.equal(
      parseNetmedsProduct(page({ ...base, cimscategoryname: cims })).type,
      null,
      `AYUSH CIMS value ${JSON.stringify(cims)} must not count as evidence`,
    );
  }
  // an explicit AYUSH statement anywhere withholds the claim entirely — the
  // Rx flag must not override it (same principle as the schedule veto)
  assert.equal(parseNetmedsProduct(page({
    ...base, cimscategoryname: 'Ayurvedic Medicine', 'mstar-rxrequired': 'Rx required',
  })).type, null);
  assert.equal(parseNetmedsProduct(page({
    ...base, cimscategoryname: 'Herbal Supplement', schedule: 'H',
  })).type, null);
});

test('parseNetmedsProduct: placeholder CIMS category values are not evidence', () => {
  const page = (attributes) => `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({
    productDetailsPage: { product: { attributes } },
  })};</script></html>`;
  const base = {
    'mstar-displaynamewops': 'Aciformin 500', manufacturername: 'Acidus',
    genericnamewithdosage: 'Metformin 500 mg',
  };
  for (const placeholder of ['NA', 'N.A.', 'n/a', 'n. a.', 'N . A .', '-', '--', 'None', 'null', 'NIL',
    'Misc', 'Miscellaneous', 'Others', 'General', 'Not Available', 'Not  Applicable',
    'Not-Available', '123', '.']) {
    assert.equal(
      parseNetmedsProduct(page({ ...base, cimscategoryname: placeholder })).type,
      null,
      `placeholder ${JSON.stringify(placeholder)} must not qualify as CIMS evidence`,
    );
  }
  // a real therapeutic-class phrase still qualifies
  assert.equal(
    parseNetmedsProduct(page({ ...base, cimscategoryname: 'Cardiovascular System' })).type,
    'allopathy',
  );
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

test('readNetmedsNormalized: refreshes by source product ID without collapsing distinct products', () => {
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
  fs.appendFileSync(`${root}/netmeds/2026-07-17/normalized.jsonl`, JSON.stringify({
    source: 'netmeds', source_id: '2', seen_at: '2026-07-17', brand_name: 'Aciformin', manufacturer: 'Acidus',
    pack_label: '', ingredients: [{ molecule: 'other', strength_value: 1, strength_unit: 'mg', strength_raw: '1mg' }],
    composition_status: 'complete', substitutes_raw: [],
  }) + '\n');
  const rows = readNetmedsNormalized(root);
  assert.equal(rows.length, 2);
  const refreshed = rows.find((row) => row.source_id === '1');
  assert.equal(refreshed.ingredients[0].molecule, 'new');
  assert.equal(refreshed.first_seen, '2026-07-01');
  assert.equal(rows.find((row) => row.source_id === '2').ingredients[0].molecule, 'other');
  fs.rmSync(root, { recursive: true, force: true });
});
