import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGithubJr } from '../../src/adapters/github-jr.mjs';

test('normalizes fixture rows to common schema', async () => {
  const rows = [];
  for await (const r of normalizeGithubJr('test/fixtures/github-jr/sample.csv', '2026-07-07')) rows.push(r);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].brand_name, 'Augmentin 625 Duo Tablet');
  assert.equal(rows[0].ingredients.length, 2);
  assert.equal(rows[0].price_inr, 223.42);
  assert.equal(rows[0].source, 'github-jr');
  assert.equal(rows[1].ingredients.length, 1);
  assert.equal(rows[2].composition_status, 'missing');
  assert.equal(rows[2].is_discontinued, true);
  assert.equal(rows[2].price_inr, null);
  assert.equal(rows[0].two_slot_maxed, true);  // both slots occupied -> verify candidate
  assert.equal(rows[1].two_slot_maxed, false); // single molecule, nothing truncated
});

test('unknown headers fail loudly', async () => {
  await assert.rejects(async () => {
    // eslint-disable-next-line no-empty
    for await (const _ of normalizeGithubJr('test/fixtures/github-jr/bad.csv', '2026-07-07')) {}
  }, /unexpected headers/i);
});
