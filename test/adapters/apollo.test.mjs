import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseApolloComposition, parseApolloProduct, parseApolloSaltPage } from '../../src/adapters/apollo.mjs';

const medHtml = fs.readFileSync('test/fixtures/apollo/medicine_elmox.html', 'utf8');
const saltHtml = fs.readFileSync('test/fixtures/apollo/salt_amox_clav.html', 'utf8');

test('parseApolloComposition: MOLECULE-STRENGTH+MOLECULE-STRENGTH form', () => {
  const ings = parseApolloComposition('AMOXICILLIN-500MG+CLAVULANIC ACID-125MG');
  assert.deepEqual(ings.map((i) => i.molecule), ['amoxycillin', 'clavulanic acid']); // alias amoxicillin->amoxycillin
  const clav = ings.find((i) => i.molecule === 'clavulanic acid');
  assert.equal(clav.strength_value, 125);
  assert.equal(clav.strength_unit, 'mg');
});

test('parseApolloComposition: single molecule + no-strength tolerated', () => {
  assert.deepEqual(parseApolloComposition('PARACETAMOL-650MG').map((i) => i.molecule), ['paracetamol']);
  const none = parseApolloComposition('SILICON DIOXIDE');
  assert.equal(none.length, 1);
  assert.equal(none[0].strength_value, null);
});

test('parseApolloProduct: extracts brand, manufacturer, composition from the Drug ld+json', () => {
  const r = parseApolloProduct(medHtml);
  assert.match(r.brand_name, /Elmox CV 625/i);
  assert.match(r.manufacturer, /Elder Pharmaceuticals/i);
  assert.deepEqual(r.ingredients.map((i) => i.molecule), ['amoxycillin', 'clavulanic acid']);
  assert.equal(r.composition_status, 'complete');
  assert.equal(r.source, 'apollo');
});

test('parseApolloSaltPage: extracts the /medicine/ product paths listed', () => {
  const paths = parseApolloSaltPage(saltHtml);
  assert.ok(paths.length >= 3, `got ${paths.length}`);
  assert.ok(paths.includes('/medicine/elmox-cv-625mg-tablet'));
  assert.ok(paths.every((p) => /^\/medicine\/[a-z0-9-]+$/.test(p)));
});
