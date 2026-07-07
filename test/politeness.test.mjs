import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRobots, isAllowed, PoliteFetcher, BlockedError } from '../src/lib/politeness.mjs';

const ROBOTS = [
  'User-agent: *',
  'Disallow: /search',
  'Disallow: /checkout/*',
  'Disallow: /ta/drugs/',
  'User-agent: FacebookBot',
  'Crawl-delay: 1',
].join('\n');

test('parseRobots extracts * disallows only', () => {
  assert.deepEqual(parseRobots(ROBOTS), ['/search', '/checkout/*', '/ta/drugs/']);
});

test('isAllowed prefix + wildcard', () => {
  const d = parseRobots(ROBOTS);
  assert.equal(isAllowed(d, '/drugs/augmentin-625-duo-tablet-12345'), true);
  assert.equal(isAllowed(d, '/search?q=x'), false);
  assert.equal(isAllowed(d, '/checkout/address'), false);
  assert.equal(isAllowed(d, '/ta/drugs/x'), false);
});

function makeFetcher(responses, over = {}) {
  const calls = [];
  const sleeps = [];
  let now = 1_000_000;
  const pf = new PoliteFetcher({
    baseUrl: 'https://example.test',
    cacheDir: 'test/.tmp-cache',
    stateFile: 'test/.tmp-cache/state.json',
    minDelayMs: 2500,
    jitterMs: 0,
    dailyCap: 5000,
    userAgent: 'aushadhi-test',
    fetchImpl: async (url) => {
      calls.push(url);
      const r = responses.shift() ?? { status: 500 };
      return { ok: r.status === 200, status: r.status, text: async () => r.body ?? '' };
    },
    now: () => now,
    sleep: async (ms) => { sleeps.push(ms); now += ms; },
    ...over,
  });
  return { pf, calls, sleeps };
}

test('PoliteFetcher: rate limits, caches, refuses disallowed', async () => {
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
  const { pf, calls, sleeps } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 200, body: 'page1' },
    { status: 200, body: 'page2' },
  ]);
  await pf.init();
  assert.equal(await pf.get('/drugs/a-1'), 'page1');
  assert.equal(await pf.get('/drugs/a-1'), 'page1'); // cache hit, no fetch
  assert.equal(await pf.get('/drugs/b-2'), 'page2');
  assert.equal(calls.length, 3); // robots + 2 pages
  assert.ok(sleeps.some((ms) => ms >= 2500), 'rate limit sleep happened');
  await assert.rejects(pf.get('/search?q=x'), /robots/i);
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
});

test('PoliteFetcher: hard abort after 3 consecutive 403', async () => {
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
  const { pf } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 403 }, { status: 403 }, { status: 403 },
  ]);
  await pf.init();
  await assert.rejects(pf.get('/drugs/c-3'), BlockedError);
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
});

test('PoliteFetcher: backoff retries 5xx then succeeds', async () => {
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
  const { pf, sleeps } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 503 },
    { status: 200, body: 'recovered' },
  ]);
  await pf.init();
  assert.equal(await pf.get('/drugs/d-4'), 'recovered');
  assert.ok(sleeps.some((ms) => ms >= 2000), 'exponential backoff sleep');
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
});

test('PoliteFetcher: daily cap enforced and persisted', async () => {
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
  const { pf } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 200, body: 'only page' },
  ], { dailyCap: 1 });
  await pf.init();
  assert.equal(await pf.get('/drugs/e-5'), 'only page');
  await assert.rejects(pf.get('/drugs/f-6'), /daily cap/i);
  const state = JSON.parse(fs.readFileSync('test/.tmp-cache/state.json', 'utf8'));
  assert.equal(state.count, 1);
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
});
