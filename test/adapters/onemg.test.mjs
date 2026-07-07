import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDrugPage, parseBrowsePage, extractBalancedJson, readOnemgNormalized } from '../../src/adapters/onemg.mjs';

const avastin = fs.readFileSync('test/fixtures/onemg/drug_page.html', 'utf8');
const augmentin = fs.readFileSync('test/fixtures/onemg/drug_page_tablet.html', 'utf8');
const browse = fs.readFileSync('test/fixtures/onemg/browse_page.html', 'utf8');

test('extractBalancedJson handles nested + trailing content', () => {
  const s = 'x = {"a":{"b":"}"},"c":[1,{"d":2}]}; window.y = 1;';
  assert.deepEqual(JSON.parse(extractBalancedJson(s, s.indexOf('{'))), { a: { b: '}' }, c: [1, { d: 2 }] });
  const arr = '"subs":[{"n":"}"},2] , tail';
  assert.deepEqual(JSON.parse(extractBalancedJson(arr, arr.indexOf('['))), [{ n: '}' }, 2]);
});

test('parseDrugPage: Avastin (biologic, no substitutes)', () => {
  const d = parseDrugPage(avastin);
  assert.equal(d.brand_name, 'Avastin 100mg Injection');
  assert.equal(d.manufacturer, 'Roche Products India Pvt Ltd');
  assert.deepEqual(d.ingredients.map((i) => i.molecule), ['bevacizumab']);
  assert.equal(d.ingredients[0].strength_value, 100);
  assert.equal(d.composition_status, 'complete');
  assert.deepEqual(d.substitutes_raw, []);
  assert.equal(d.form_raw, 'Injection');
});

test('parseDrugPage: Augmentin (combo + substitutes)', () => {
  const d = parseDrugPage(augmentin);
  assert.equal(d.brand_name, 'Augmentin 625 Duo Tablet');
  assert.match(d.manufacturer, /glaxo/i);
  assert.deepEqual(d.ingredients.map((i) => i.molecule), ['amoxycillin', 'clavulanic acid']);
  assert.equal(d.ingredients.find((i) => i.molecule === 'clavulanic acid').strength_value, 125);
  assert.ok(d.substitutes_raw.some((s) => s.name === 'Novaclav 625 Tablet'));
  assert.equal(d.form_raw, 'Tablet');
});

test('readOnemgNormalized: last fetch per identity wins across dates', () => {
  const root = 'test/.tmp-onemg';
  fs.rmSync(root, { recursive: true, force: true });
  const mk = (date, ingredients) => {
    fs.mkdirSync(`${root}/onemg/${date}`, { recursive: true });
    fs.writeFileSync(`${root}/onemg/${date}/normalized.jsonl`, JSON.stringify({
      source: 'onemg-live', source_id: '1', seen_at: date,
      brand_name: 'X Tablet', manufacturer: 'M', pack_label: 'strip of 10',
      ingredients, composition_status: 'complete', substitutes_raw: [],
    }) + '\n');
  };
  mk('2026-07-01', [{ molecule: 'a', strength_value: 1, strength_unit: 'mg', strength_raw: '1mg' }]);
  mk('2026-07-07', [{ molecule: 'b', strength_value: 2, strength_unit: 'mg', strength_raw: '2mg' }]);
  const rows = readOnemgNormalized(root);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].seen_at, '2026-07-07');
  assert.equal(rows[0].ingredients[0].molecule, 'b');
  fs.rmSync(root, { recursive: true, force: true });
});

test('parseBrowsePage: extracts drug links (anchor-rendered page)', () => {
  const entries = parseBrowsePage(browse);
  assert.ok(entries.length >= 20, `got ${entries.length}`);
  assert.ok(entries.every((e) => /^\/drugs\/.+-\d+$/.test(e.path)));
  assert.ok(entries.some((e) => /augmentin/i.test(e.path)));
});

test('parseBrowsePage: extracts from JSON-LD ItemList (paginated variant, no anchors)', () => {
  const browse2 = fs.readFileSync('test/fixtures/onemg/browse_page2.html', 'utf8');
  const entries = parseBrowsePage(browse2);
  assert.ok(entries.length >= 20, `got ${entries.length}`);
  const alkasol = entries.find((e) => e.path === '/drugs/alkasol-oral-solution-4967');
  assert.ok(alkasol, 'Alkasol entry present');
  assert.equal(alkasol.name, 'Alkasol Oral Solution');
});
