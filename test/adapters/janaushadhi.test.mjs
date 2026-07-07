import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseJanAushadhiText } from '../../src/adapters/janaushadhi.mjs';

const text = fs.readFileSync('test/fixtures/janaushadhi/sample.txt', 'utf8');

test('parses simple single-molecule row (strength after form words)', () => {
  const rows = parseJanAushadhiText(text, '2026-07-07');
  const acec = rows.find((r) => r.brand_name === 'Aceclofenac Tablets IP 100 mg');
  assert.ok(acec);
  assert.equal(acec.source, 'janaushadhi');
  assert.equal(acec.manufacturer, 'PMBJP (Jan Aushadhi)');
  assert.equal(acec.pack_label, "10's");
  assert.deepEqual(acec.ingredients.map((i) => i.molecule), ['aceclofenac']);
  assert.equal(acec.ingredients[0].strength_value, 100);
  assert.equal(acec.ingredients[0].strength_unit, 'mg');
});

test('parses inline multi-ingredient row', () => {
  const rows = parseJanAushadhiText(text, '2026-07-07');
  const combo = rows.find((r) => r.brand_name.startsWith('Aceclofenac 100mg and Paracetamol'));
  assert.ok(combo);
  assert.deepEqual(combo.ingredients.map((i) => i.molecule).sort(), ['aceclofenac', 'paracetamol']);
});

test('joins wrapped continuation lines (3-molecule combo)', () => {
  const rows = parseJanAushadhiText(text, '2026-07-07');
  const triple = rows.find((r) => r.brand_name.startsWith('Chlorzoxazone'));
  assert.ok(triple);
  assert.equal(triple.brand_name, 'Chlorzoxazone 500mg, Diclofenac 50mg and Paracetamol 325mg Tablets');
  assert.deepEqual(triple.ingredients.map((i) => i.molecule).sort(), ['chlorzoxazone', 'diclofenac', 'paracetamol']);
  const para = triple.ingredients.find((i) => i.molecule === 'paracetamol');
  assert.equal(para.strength_value, 325);
});

test('percent strength + parenthetical salt note', () => {
  const rows = parseJanAushadhiText(text, '2026-07-07');
  const gel = rows.find((r) => r.brand_name.startsWith('Diclofenac Gel'));
  assert.ok(gel);
  assert.equal(gel.ingredients.length, 1);
  assert.equal(gel.ingredients[0].molecule, 'diclofenac');
  assert.equal(gel.ingredients[0].strength_unit, '%w/w');
});

test('skips headers, page numbers, and blank lines', () => {
  const rows = parseJanAushadhiText(text, '2026-07-07');
  assert.equal(rows.length, 7);
  assert.ok(rows.every((r) => r.composition_status === 'complete'));
  assert.ok(rows.every((r) => r.type === 'allopathy'));
});
