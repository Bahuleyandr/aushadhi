import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKaggleRows } from '../../src/adapters/kaggle-2025.mjs';

test('maps 1mg-style headers to common schema', () => {
  const records = [{
    name: 'Dolo 650 Tablet', 'price(₹)': '30.27', Is_discontinued: 'FALSE',
    manufacturer_name: 'Micro Labs Ltd', type: 'allopathy', pack_size_label: 'strip of 15 tablets',
    short_composition1: 'Paracetamol (650mg)', short_composition2: '', id: '77'
  }];
  const rows = normalizeKaggleRows(records, '2026-07-07');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'kaggle-2025');
  assert.equal(rows[0].brand_name, 'Dolo 650 Tablet');
  assert.equal(rows[0].ingredients[0].molecule, 'paracetamol');
  assert.equal(rows[0].price_inr, 30.27);
});

test('maps alternate header names (medicine_name / salt_composition / marketer)', () => {
  const records = [{
    medicine_name: 'Calpol 500mg Tablet', marketer: 'GSK', packaging: 'strip of 15 tablets',
    salt_composition: 'Paracetamol (500mg)', mrp: '20', category: 'allopathy'
  }];
  const rows = normalizeKaggleRows(records, '2026-07-07');
  assert.equal(rows[0].brand_name, 'Calpol 500mg Tablet');
  assert.equal(rows[0].manufacturer, 'GSK');
  assert.equal(rows[0].ingredients.length, 1);
  assert.equal(rows[0].price_inr, 20);
});

test('throws listing actual headers when unmappable', () => {
  assert.throws(() => normalizeKaggleRows([{ foo: 1, bar: 2 }], '2026-07-07'), /kaggle-2025.*headers.*foo/is);
});
