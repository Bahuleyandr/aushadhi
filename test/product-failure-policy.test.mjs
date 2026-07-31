import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchIndexedProduct, skipIfPermanentlyMissing } from '../src/lib/product-failure-policy.mjs';
import { HttpStatusError } from '../src/lib/politeness.mjs';

test('transient product fetch failure remains retryable', () => {
  const error = new TypeError('fetch failed');
  assert.throws(() => skipIfPermanentlyMissing(error), (thrown) => thrown === error);
});

test('error text alone cannot authorize a permanent tombstone', () => {
  const error = new TypeError('upstream wrapper mentioned HTTP 404 but the fetch itself failed');
  assert.throws(() => skipIfPermanentlyMissing(error), (thrown) => thrown === error);
});

test('typed HTTP 404 and 410 responses are permanently missing', () => {
  assert.equal(skipIfPermanentlyMissing(new HttpStatusError(404, '/product/gone')), true);
  assert.equal(skipIfPermanentlyMissing(new HttpStatusError(410, '/product/retired')), true);
});

test('indexed fetch returns an explicit permanent-missing outcome', async () => {
  const fetcher = { get: async () => { throw new HttpStatusError(404, '/product/gone'); } };
  assert.deepEqual(await fetchIndexedProduct(fetcher, '/product/gone'), {
    status: 'permanently_missing',
    html: null,
  });
});
