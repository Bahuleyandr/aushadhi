import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseNppaLine, parseNppaText } from '../../src/adapters/nppa.mjs';

const sample = fs.readFileSync('test/fixtures/nppa/sample.txt', 'utf8');

test('parseNppaLine: SL No + NLEM version + formulation + strength + ceiling price', () => {
  const r = parseNppaLine('1  2011  Acetylsalicylic acid  Tablet 300 mg  1582(E)  25-Mar-2026  ¹ 0.28(1 Tablet)');
  assert.match(r.formulation, /Acetylsalicylic acid/i);
  assert.equal(r.strength, '300mg');
  assert.equal(r.ceiling_price, 0.28);
});

test('parseNppaLine: injection in mcg, price with thousands + wrapped unit', () => {
  const r = parseNppaLine('14  2015  Anti-D Immunoglobulin  Injection 300 mcg  1581(E)  25-Mar-2026  ¹ 2721.28(Each Pack)');
  assert.match(r.formulation, /Anti-D Immunoglobulin/i);
  assert.equal(r.strength, '300mcg');
  assert.equal(r.ceiling_price, 2721.28);
});

test('parseNppaLine: header, continuation, device/condom lines -> null', () => {
  assert.equal(parseNppaLine('SL No   NLEM Version          Formulation'), null);
  assert.equal(parseNppaLine('                       te'), null); // wrapped continuation
  assert.equal(parseNppaLine('20  2015  Bare Metal Stents  DEVICE --  1587(E)  25-Mar-2026  ¹ 10762.15(1 Unit)'), null);
  assert.equal(parseNppaLine('3  2011  Condom  CONDOM  1582(E)  25-Mar-2026  ¹ 11.65(1 Condom)'), null);
});

test('parseNppaText: drug rows carry composition + price; devices skipped', async () => {
  const rows = await parseNppaText(sample, '2026-03-25');
  // 7 SL-No rows in the fixture, minus Condom + Bare Metal Stents = 5 drug rows
  assert.equal(rows.length, 5);
  const cefixime = rows.find((r) => r.ingredients.some((i) => i.molecule === 'cefixime'));
  assert.ok(cefixime, 'cefixime row present');
  assert.equal(cefixime.ingredients[0].strength_value, 400);
  assert.equal(cefixime.price_inr, 37.28);
  assert.equal(cefixime.source, 'nppa');
  assert.equal(cefixime.manufacturer, 'NPPA (ceiling price)');
  assert.ok(!rows.some((r) => /condom|stent/i.test(r.brand_name)), 'no device/condom rows');
});
