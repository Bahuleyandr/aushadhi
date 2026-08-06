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

test('indexed fetch keeps 404 revalidation distinct from a terminal 410 tombstone', async () => {
  const now = () => Date.parse('2026-08-06T12:34:56.000Z');
  const notFound = { get: async () => { throw new HttpStatusError(404, '/product/missing'); } };
  const gone = { get: async () => { throw new HttpStatusError(410, '/product/gone'); } };
  assert.deepEqual(await fetchIndexedProduct(notFound, '/product/missing', { now }), {
    status: 'not_found',
    html: null,
    checkedAt: '2026-08-06T12:34:56.000Z',
  });
  assert.deepEqual(await fetchIndexedProduct(gone, '/product/gone', { now }), {
    status: 'gone',
    html: null,
    checkedAt: '2026-08-06T12:34:56.000Z',
  });
});

test('indexed fetch preserves the fetched HTML contract', async () => {
  const fetcher = { get: async () => '<html>product</html>' };
  assert.deepEqual(await fetchIndexedProduct(fetcher, '/product/live'), {
    status: 'fetched',
    html: '<html>product</html>',
  });
});

test('indexed fetch opts into final-response metadata without changing the legacy contract', async () => {
  const calls = [];
  const fetcher = {
    get: async () => '<html>legacy</html>',
    getWithMetadata: async (requestPath, options) => {
      calls.push([requestPath, options]);
      return {
        body: '<html>bound</html>',
        responseUrl: 'https://www.apollopharmacy.in/medicine/bound-product',
      };
    },
  };
  assert.deepEqual(
    await fetchIndexedProduct(fetcher, '/medicine/bound-product', { responseMetadata: true }),
    {
      status: 'fetched',
      html: '<html>bound</html>',
      responseUrl: 'https://www.apollopharmacy.in/medicine/bound-product',
    },
  );
  assert.deepEqual(calls, [['/medicine/bound-product', { fresh: true }]]);
  assert.deepEqual(await fetchIndexedProduct(fetcher, '/medicine/legacy'), {
    status: 'fetched',
    html: '<html>legacy</html>',
  });
});
