import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NOT_FOUND_REVALIDATE_MS,
  ParserAnomalyError,
  ProductOutcomeLedger,
  VariantPriorityScheduler,
  expandIndexedVariants,
  runVariantAwareIndex,
  variantFamilyKey,
  variantSiblings,
} from '../src/lib/variant-priority.mjs';

const pharm = [
  '/online-medicine-order/sacurise-50mg-strip-of-14-tablets-3933480',
  '/online-medicine-order/unrelated-10mg-tablet-1111111',
  '/online-medicine-order/sacurise-100mg-strip-of-14-tablets-3933486',
  '/online-medicine-order/sacurise-200mg-strip-of-7-tablets-3933476',
];
const id = (productPath) => productPath.match(/-(\d+)$/)?.[1] ?? productPath;
const callbacks = (overrides = {}) => ({
  fetchProduct: async (productPath) => ({ status: 'fetched', html: productPath }),
  parseProduct: (html) => ({ brand_name: html, ingredients: [{ molecule: 'x' }] }),
  writeProduct: async () => {},
  persist: async () => {},
  parserFingerprint: 'parser-v1',
  ...overrides,
});

test('conservative family keys group dose siblings without collapsing brand suffixes', () => {
  assert.equal(variantFamilyKey(pharm[0]), 'sacurise');
  assert.equal(variantFamilyKey('Sacurise 100 Tablet'), 'sacurise');
  assert.equal(variantFamilyKey('AKT-4 Tablet'), 'akt 4');
  assert.notEqual(variantFamilyKey('Pan 40 Tablet'), variantFamilyKey('Pan-D Capsule'));
  assert.notEqual(variantFamilyKey('Ascoril LS Syrup'), variantFamilyKey('Ascoril LS Junior Syrup'));
  assert.deepEqual(variantSiblings(pharm[0], pharm), [pharm[2], pharm[3]]);
});

test('1mg expansion returns unfinished source-indexed variants only', () => {
  const indexedPaths = [
    '/drugs/sacurise-50-tablet-834574',
    '/drugs/sacurise-100-tablet-834584',
    '/drugs/sacurise-200-tablet-834590',
    '/drugs/pan-40-tablet-111111',
    '/drugs/pan-d-capsule-222222',
  ];
  assert.deepEqual(expandIndexedVariants({
    indexedPaths,
    seedNames: ['Sacurise 50Mg Strip Of 14 Tablets', 'Pan-D Capsule'],
    doneIds: new Set(['834574', '222222']),
    idFromPath: id,
  }), ['/drugs/sacurise-100-tablet-834584', '/drugs/sacurise-200-tablet-834590']);
});

test('404 outcome is timestamped, deferred, and becomes retryable only when policy is due', async () => {
  const checkedAt = Date.parse('2026-08-06T00:00:00.000Z');
  let now = checkedAt;
  const state = { cursor: 0 };
  const fetched = [];
  let response = { status: 'not_found', html: null, checkedAt: new Date(checkedAt).toISOString() };
  const options = {
    products: [pharm[0]],
    state,
    doneIds: new Set(),
    idFromPath: id,
    now: () => now,
    ...callbacks({
      fetchProduct: async (productPath) => { fetched.push(productPath); return response; },
    }),
  };

  const first = await runVariantAwareIndex(options);
  assert.equal(first.status, 'completed');
  assert.equal(first.notFound, 1);
  assert.deepEqual(state.pathOutcomes, [{
    productId: id(pharm[0]),
    path: pharm[0],
    status: 'not_found',
    checkedAt: '2026-08-06T00:00:00.000Z',
    retryAt: new Date(checkedAt + DEFAULT_NOT_FOUND_REVALIDATE_MS).toISOString(),
  }]);

  fetched.length = 0;
  now = checkedAt + DEFAULT_NOT_FOUND_REVALIDATE_MS - 1;
  const deferred = await runVariantAwareIndex({ ...options, doneIds: new Set() });
  assert.equal(deferred.status, 'no_work');
  assert.equal(deferred.attempted, 0);
  assert.deepEqual(fetched, []);

  now = checkedAt + DEFAULT_NOT_FOUND_REVALIDATE_MS;
  response = { status: 'fetched', html: pharm[0] };
  const writes = [];
  const retried = await runVariantAwareIndex({
    ...options,
    doneIds: new Set(),
    writeProduct: async ({ productPath }) => writes.push(productPath),
  });
  assert.deepEqual(fetched, [pharm[0]]);
  assert.deepEqual(writes, [pharm[0]]);
  assert.equal(retried.added, 1);
  assert.deepEqual(state.pathOutcomes, []);
});

test('410 outcome is terminal by stable product ID and never requeues after a path rename', async () => {
  let now = Date.parse('2026-08-06T00:00:00.000Z');
  const state = { cursor: 0 };
  const fetched = [];
  const firstPath = '/product/example-10mg-tablet-900001';
  await runVariantAwareIndex({
    products: [firstPath], state, doneIds: new Set(), idFromPath: id, now: () => now,
    ...callbacks({
      fetchProduct: async (productPath) => {
        fetched.push(productPath);
        return { status: 'gone', html: null, checkedAt: new Date(now).toISOString() };
      },
    }),
  });
  assert.deepEqual(state.pathOutcomes, [{
    productId: '900001',
    path: firstPath,
    status: 'gone',
    checkedAt: '2026-08-06T00:00:00.000Z',
  }]);

  const renamed = '/product/example-renamed-10mg-tablet-900001';
  fetched.length = 0;
  now += DEFAULT_NOT_FOUND_REVALIDATE_MS * 10;
  state.cursor = 0;
  state.cursorPath = renamed;
  const result = await runVariantAwareIndex({
    products: [renamed], state, doneIds: new Set(), idFromPath: id, now: () => now,
    ...callbacks({ fetchProduct: async (productPath) => { fetched.push(productPath); return null; } }),
  });
  assert.equal(result.status, 'no_work');
  assert.deepEqual(fetched, []);
  assert.equal(state.pathOutcomes[0].path, renamed);
});

test('terminal paths cannot be reintroduced through the sibling priority queue', () => {
  const state = {
    cursor: 0,
    pathOutcomes: [{
      productId: id(pharm[2]),
      path: pharm[2],
      status: 'gone',
      checkedAt: '2026-08-06T00:00:00.000Z',
    }],
  };
  const done = new Set([id(pharm[0])]);
  const scheduler = new VariantPriorityScheduler({ paths: pharm, state, doneIds: done, idFromPath: id });
  scheduler.complete(pharm[0]);
  assert.deepEqual(scheduler.enqueueSiblings(pharm[0]), [pharm[3]]);
  assert.equal(state.priority.includes(pharm[2]), false);
});

test('index mutation resets the checkpoint so products inserted before the old cursor are found by stable ID', () => {
  const state = { cursor: 2 };
  const done = new Set([id(pharm[0]), id(pharm[1])]);
  new VariantPriorityScheduler({ paths: pharm, state, doneIds: done, idFromPath: id });
  assert.equal(state.cursor, 2);

  const inserted = '/online-medicine-order/newly-indexed-25mg-tablet-7777777';
  const scheduler = new VariantPriorityScheduler({
    paths: [inserted, ...pharm], state, doneIds: done, idFromPath: id,
  });
  assert.equal(state.cursor, 0);
  assert.deepEqual(scheduler.peek(), { path: inserted, priority: false });
});

test('a valid cursor rewinds to the earliest stable product ID missing from durable completion state', () => {
  const state = { cursor: 3 };
  const done = new Set([id(pharm[0]), id(pharm[2])]);
  const scheduler = new VariantPriorityScheduler({ paths: pharm, state, doneIds: done, idFromPath: id });

  assert.equal(state.cursor, 1);
  assert.equal(state.cursorPath, pharm[1]);
  assert.deepEqual(scheduler.peek(), { path: pharm[1], priority: false });
});

test('cursor reconciliation treats a terminal outcome as durable completion', () => {
  const state = {
    cursor: 3,
    pathOutcomes: [{
      productId: id(pharm[0]),
      path: pharm[0],
      status: 'gone',
      checkedAt: '2026-08-06T00:00:00.000Z',
    }],
  };
  const scheduler = new VariantPriorityScheduler({
    paths: pharm,
    state,
    doneIds: new Set(),
    idFromPath: id,
  });

  assert.equal(state.cursor, 1);
  assert.deepEqual(scheduler.peek(), { path: pharm[1], priority: false });
});

test('parser anomalies are quarantined per parser fingerprint and retried after an upgrade', async () => {
  const state = { cursor: 0 };
  const path = pharm[0];
  let fetches = 0;
  const first = await runVariantAwareIndex({
    products: [path], state, doneIds: new Set(), idFromPath: id,
    ...callbacks({
      fetchProduct: async () => { fetches++; return { status: 'fetched', html: path }; },
      parseProduct: async () => null,
    }),
  });
  assert.equal(first.quarantined, 1);
  assert.deepEqual(state.quarantine, [{ productId: id(path), path, parser: 'parser-v1' }]);

  const unchanged = await runVariantAwareIndex({
    products: [path], state, doneIds: new Set(), idFromPath: id,
    ...callbacks({ fetchProduct: async () => { fetches++; return null; } }),
  });
  assert.equal(unchanged.status, 'no_work');
  assert.equal(fetches, 1);

  const upgraded = await runVariantAwareIndex({
    products: [path], state, doneIds: new Set(), idFromPath: id,
    ...callbacks({ parserFingerprint: 'parser-v2' }),
  });
  assert.equal(upgraded.added, 1);
  assert.deepEqual(state.quarantine, []);
});

test('three consecutive parser anomalies fail closed and leave the threshold product retryable', async () => {
  const products = pharm.slice(0, 3);
  const state = { cursor: 0 };
  const fetches = [];
  const invalid = callbacks({
    fetchProduct: async (productPath) => {
      fetches.push(productPath);
      return { status: 'fetched', html: productPath };
    },
    parseProduct: async () => null,
  });

  await assert.rejects(
    runVariantAwareIndex({
      products,
      state,
      doneIds: new Set(),
      idFromPath: id,
      maxConsecutiveParserAnomalies: 3,
      ...invalid,
    }),
    (error) => error instanceof ParserAnomalyError
      && error.code === 'DISCOVERY_ANOMALY'
      && error.productPath === products[2],
  );
  assert.deepEqual(fetches, products);
  assert.equal(state.cursor, 2);
  assert.deepEqual(state.quarantine.map((entry) => entry.path), products.slice(0, 2));

  fetches.length = 0;
  await assert.rejects(
    runVariantAwareIndex({
      products,
      state,
      doneIds: new Set(),
      idFromPath: id,
      maxConsecutiveParserAnomalies: 3,
      ...invalid,
    }),
    (error) => error instanceof ParserAnomalyError && error.productPath === products[2],
  );
  assert.deepEqual(fetches, [products[2]], 'the threshold product must be retried on the next run');
  assert.equal(state.cursor, 2);

  fetches.length = 0;
  const recovered = await runVariantAwareIndex({
    products,
    state,
    doneIds: new Set(),
    idFromPath: id,
    maxConsecutiveParserAnomalies: 3,
    ...callbacks({
      fetchProduct: async (productPath) => {
        fetches.push(productPath);
        return { status: 'fetched', html: productPath };
      },
    }),
  });
  assert.equal(recovered.status, 'completed');
  assert.equal(recovered.added, 1);
  assert.deepEqual(fetches, [products[2]]);
  assert.equal(state.cursor, products.length);
});

test('completed IDs cannot mask a systemic parser-anomaly streak', async () => {
  const products = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
    .map((name, index) => `/product/${name}-${index + 1}`);
  const doneIds = new Set([id(products[1]), id(products[3])]);
  const state = { cursor: 0 };

  await assert.rejects(
    runVariantAwareIndex({
      products,
      state,
      doneIds,
      idFromPath: id,
      maxConsecutiveParserAnomalies: 3,
      ...callbacks({ parseProduct: async () => null }),
    }),
    (error) => error instanceof ParserAnomalyError && error.productPath === products[4],
  );
  assert.equal(state.cursor, 4);
  assert.deepEqual(state.quarantine.map((entry) => entry.path), [products[0], products[2]]);
});

test('zero-yield loop reports no_work when every stable product ID is already complete', async () => {
  const state = { cursor: 0 };
  const result = await runVariantAwareIndex({
    products: [pharm[0], pharm[1]],
    state,
    doneIds: new Set([id(pharm[0]), id(pharm[1])]),
    idFromPath: id,
    ...callbacks({ fetchProduct: async () => assert.fail('completed products must not fetch') }),
  });
  assert.equal(result.status, 'no_work');
  assert.equal(result.attempted, 0);
  assert.equal(result.added, 0);
  assert.equal(state.cursor, 2);
});

test('ProductOutcomeLedger rejects ambiguous outcome statuses and malformed timestamps', () => {
  assert.throws(() => new ProductOutcomeLedger({
    paths: pharm,
    state: { pathOutcomes: [{ productId: id(pharm[0]), path: pharm[0], status: 'permanently_missing' }] },
    idFromPath: id,
  }), /invalid product outcome/i);
  assert.throws(() => new ProductOutcomeLedger({
    paths: pharm,
    state: { pathOutcomes: [{
      productId: id(pharm[0]), path: pharm[0], status: 'not_found', checkedAt: 'not-a-date', retryAt: 'also-bad',
    }] },
    idFromPath: id,
  }), /invalid product outcome/i);
});
