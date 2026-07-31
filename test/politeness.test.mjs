import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseRobots, isAllowed, PoliteFetcher, BlockedError, CapReachedError, HttpStatusError,
} from '../src/lib/politeness.mjs';

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

test('PoliteFetcher: fresh get bypasses a cached page and refreshes it', async () => {
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
  const { pf, calls } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 200, body: 'stale-page' },
    { status: 200, body: 'fresh-page' },
  ]);
  await pf.init();
  assert.equal(await pf.get('/drugs/fresh-1'), 'stale-page');
  assert.equal(await pf.get('/drugs/fresh-1', { fresh: true }), 'fresh-page');
  assert.equal(await pf.get('/drugs/fresh-1'), 'fresh-page');
  assert.equal(calls.length, 3); // robots + stale page + explicitly fresh page
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

test('PoliteFetcher: exhausted HTTP response retains typed status evidence', async () => {
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
  const { pf } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 404 },
  ], { maxRetries: 0 });
  await pf.init();
  await assert.rejects(
    pf.get('/drugs/gone'),
    (error) => error instanceof HttpStatusError
      && error.status === 404
      && error.requestPath === '/drugs/gone',
  );
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
});

test('parseRobots: consecutive User-agent lines form one group', () => {
  const grouped = 'User-agent: *\nUser-agent: SomeBot\nDisallow: /private\n\nUser-agent: OtherBot\nDisallow: /other';
  assert.deepEqual(parseRobots(grouped), ['/private']);
});

test('init fails CLOSED when robots.txt is unreachable', async () => {
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
  const { pf } = makeFetcher([{ status: 503 }]);
  await assert.rejects(pf.init(), /refusing to crawl/i);
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
});

test('day rollover preserves discover cursor, resets only count', async () => {
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
  fs.mkdirSync('test/.tmp-cache', { recursive: true });
  fs.writeFileSync('test/.tmp-cache/state.json', JSON.stringify({ date: '1969-12-01', count: 4999, discover: { label: 3, page: 7 } }));
  const { pf } = makeFetcher([{ status: 200, body: ROBOTS }]);
  await pf.init();
  assert.equal(pf.state.count, 0);
  assert.deepEqual(pf.state.discover, { label: 3, page: 7 });
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
});

test('retries respect the min-delay gate and never overshoot the daily cap', async () => {
  fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
  const { pf, sleeps } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 503 },
    { status: 200, body: 'ok' },
  ]);
  await pf.init();
  assert.equal(await pf.get('/drugs/retry-1'), 'ok');
  // backoff (2000) + min-delay top-up (500) must total >= minDelayMs between attempts
  const total = sleeps.reduce((a, b) => a + b, 0);
  assert.ok(total >= 2500, `expected >=2500ms total spacing between attempts, got ${JSON.stringify(sleeps)}`);

  fs.rmSync('test/.tmp-cache', { recursive: true, force: true }); // fresh state for the cap scenario
  const capped = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 503 }, { status: 503 }, { status: 503 }, { status: 503 },
  ], { dailyCap: 1 });
  await capped.pf.init();
  await assert.rejects(capped.pf.get('/drugs/cap-1'), CapReachedError);
  assert.equal(capped.pf.state.count, 1); // retries did not increment past the cap
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
