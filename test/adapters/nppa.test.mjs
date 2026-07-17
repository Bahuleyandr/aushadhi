import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseNppaLine, parseNppaText } from '../../src/adapters/nppa.mjs';

const sample = fs.readFileSync('test/fixtures/nppa/sample.txt', 'utf8');

test('parseNppaLine: Sl.No + formulation + strength + ceiling price', () => {
  const r = parseNppaLine('2   Amoxycillin + Clavulanic Acid Tablets   500mg+125mg   6\'s   78.45');
  assert.match(r.formulation, /Amoxycillin \+ Clavulanic Acid/);
  assert.equal(r.strength, '500mg+125mg');
  assert.equal(r.ceiling_price, 78.45);
});

test('parseNppaLine: prose / non-data lines -> null', () => {
  assert.equal(parseNppaLine('This is a prose footnote line and should be ignored.'), null);
  assert.equal(parseNppaLine('Sl. No.  Name of the Formulation  Strength'), null);
});

test('parseNppaText: rows carry composition + price', async () => {
  const rows = await parseNppaText(sample, '2026-07-17');
  assert.equal(rows.length, 3);
  const amox = rows.find((r) => r.brand_name.includes('Amoxycillin'));
  assert.deepEqual(amox.ingredients.map((i) => i.molecule), ['amoxycillin', 'clavulanic acid']);
  assert.equal(amox.price_inr, 78.45);
  assert.equal(amox.source, 'nppa');
  const met = rows.find((r) => r.brand_name.includes('Metformin'));
  assert.equal(met.ingredients[0].molecule, 'metformin');
  assert.equal(met.ingredients[0].strength_value, 500);
});
