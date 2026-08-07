import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import {
  parseRobots, isAllowed, PoliteFetcher, BlockedError, CacheCorruptionError,
  CapReachedError, HttpStatusError, StateCorruptionError, StateLockError,
} from '../src/lib/politeness.mjs';

const TMP = `test/.tmp-cache-${process.pid}`;

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
  const requestOptions = [];
  const sleeps = [];
  let now = 1_000_000;
  const pf = new PoliteFetcher({
    baseUrl: 'https://example.test',
    cacheDir: TMP,
    stateFile: `${TMP}/state.json`,
    minDelayMs: 2500,
    jitterMs: 0,
    dailyCap: 5000,
    userAgent: 'aushadhi-test',
    fetchImpl: async (url, options) => {
      calls.push(url);
      requestOptions.push(options);
      const r = responses.shift() ?? { status: 500 };
      if (r.waitForAbort) {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
      }
      if (r.error) throw r.error;
      return {
        ok: r.status === 200,
        status: r.status,
        url: r.url ?? url,
        headers: { get: (name) => r.headers?.[name.toLowerCase()] ?? null },
        text: async () => r.body ?? '',
      };
    },
    now: () => now,
    sleep: async (ms) => { sleeps.push(ms); now += ms; },
    ...over,
  });
  return { pf, calls, requestOptions, sleeps };
}

test('PoliteFetcher: rate limits, caches, refuses disallowed', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
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
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('PoliteFetcher: fresh get bypasses a cached page and refreshes it', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
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
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('PoliteFetcher: metadata fetch exposes the final response URL without changing get return type', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const finalUrl = 'https://example.test/drugs/redirect-target';
  const { pf, calls } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 200, body: 'ordinary page' },
    { status: 200, body: 'redirected page', url: finalUrl },
  ], { minDelayMs: 0 });
  await pf.init();
  assert.equal(await pf.get('/drugs/requested'), 'ordinary page');
  assert.deepEqual(await pf.getWithMetadata('/drugs/requested'), {
    body: 'redirected page',
    responseUrl: finalUrl,
  });
  assert.equal(calls.length, 3, 'metadata fetch must not reuse an unbound body-only cache entry');
  await assert.rejects(
    pf.getWithMetadata('/drugs/requested', { fresh: false }),
    /cannot be served from an unbound page cache/i,
  );
  await pf.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('PoliteFetcher: 403 is not retried but three consecutive block responses still hard-abort', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 403 }, { status: 403 }, { status: 403 },
  ]);
  await pf.init();
  await assert.rejects(pf.get('/drugs/c-1'), (error) => error instanceof HttpStatusError && error.status === 403);
  await assert.rejects(pf.get('/drugs/c-2'), (error) => error instanceof HttpStatusError && error.status === 403);
  await assert.rejects(pf.get('/drugs/c-3'), BlockedError);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('PoliteFetcher: backoff retries 5xx then succeeds', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf, sleeps } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 503 },
    { status: 200, body: 'recovered' },
  ]);
  await pf.init();
  assert.equal(await pf.get('/drugs/d-4'), 'recovered');
  assert.ok(sleeps.some((ms) => ms >= 2000), 'exponential backoff sleep');
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('PoliteFetcher: terminal 404 and 410 responses are never retried', async () => {
  for (const status of [404, 410]) {
    fs.rmSync(TMP, { recursive: true, force: true });
    const { pf, calls, sleeps } = makeFetcher([
      { status: 200, body: ROBOTS },
      { status },
      { status: 200, body: 'must not be reached' },
    ], { minDelayMs: 0 });
    await pf.init();
    await assert.rejects(
      pf.get(`/drugs/status-${status}`),
      (error) => error instanceof HttpStatusError
        && error.status === status
        && error.requestPath === `/drugs/status-${status}`,
    );
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, []);
  }
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('parseRobots: consecutive User-agent lines form one group', () => {
  const grouped = 'User-agent: *\nUser-agent: SomeBot\nDisallow: /private\n\nUser-agent: OtherBot\nDisallow: /other';
  assert.deepEqual(parseRobots(grouped), ['/private']);
});

test('init fails CLOSED when robots.txt is unreachable', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf } = makeFetcher([{ status: 503 }]);
  await assert.rejects(pf.init(), /refusing to crawl/i);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('init bounds a hung robots request and remains fail closed', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf, requestOptions } = makeFetcher([{ waitForAbort: true }], { requestTimeoutMs: 5 });
  await assert.rejects(pf.init(), /robots\.txt.*refusing to crawl/i);
  assert.equal(requestOptions.length, 1);
  assert.equal(requestOptions[0].signal.aborted, true);
  assert.equal(fs.existsSync(`${TMP}/state.json.crawler-state.lock`), false);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('content timeouts are bounded, retried with fresh signals, and count against the cap', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf, requestOptions } = makeFetcher([
    { status: 200, body: ROBOTS },
    { waitForAbort: true },
    { status: 200, body: 'recovered after timeout' },
  ], { minDelayMs: 0, requestTimeoutMs: 5, retryBaseMs: 0 });
  await pf.init();
  assert.equal(await pf.get('/drugs/timeout-retry'), 'recovered after timeout');
  assert.equal(pf.state.count, 3);
  assert.equal(requestOptions.length, 3);
  assert.notEqual(requestOptions[1].signal, requestOptions[2].signal);
  assert.equal(requestOptions[1].signal.aborted, true);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('only evidenced transport TypeErrors retry; deterministic TypeErrors stop after one attempt', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const deterministic = makeFetcher([
    { status: 200, body: ROBOTS },
    { error: new TypeError('custom fetch contract is invalid') },
    { status: 200, body: 'must not be reached' },
  ], { minDelayMs: 0 });
  await deterministic.pf.init();
  await assert.rejects(deterministic.pf.get('/drugs/programmer-error'), /custom fetch contract/);
  assert.equal(deterministic.calls.length, 2);

  fs.rmSync(TMP, { recursive: true, force: true });
  const cause = Object.assign(new Error('socket reset'), { code: 'ECONNRESET' });
  const transport = makeFetcher([
    { status: 200, body: ROBOTS },
    { error: new TypeError('fetch failed', { cause }) },
    { status: 200, body: 'transport recovered' },
  ], { minDelayMs: 0, retryBaseMs: 0 });
  await transport.pf.init();
  assert.equal(await transport.pf.get('/drugs/network-error'), 'transport recovered');
  assert.equal(transport.calls.length, 3);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('an exhausted transport timeout is persisted and remains retryable on a later run', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf } = makeFetcher([
    { status: 200, body: ROBOTS },
    { waitForAbort: true },
  ], { minDelayMs: 0, requestTimeoutMs: 5, maxRetries: 0 });
  await pf.init();
  await assert.rejects(pf.get('/drugs/timeout-terminal'), (error) => error.name === 'TimeoutError');
  assert.equal(JSON.parse(fs.readFileSync(`${TMP}/state.json`, 'utf8')).count, 2);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('429 Retry-After beyond the operational ceiling surfaces a typed hold signal without an early retry', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf, sleeps, calls } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 429, headers: { 'retry-after': '120' } },
    { status: 200, body: 'after bounded wait' },
  ], { minDelayMs: 0, maxRetryDelayMs: 10_000, consecutiveBlockLimit: 10 });
  await pf.init();
  await assert.rejects(
    pf.get('/drugs/retry-after'),
    (error) => error instanceof HttpStatusError && error.status === 429,
  );
  assert.deepEqual(sleeps, []);
  assert.equal(calls.length, 2);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('429 Retry-After within the ceiling is honored in full before retry', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf, sleeps } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 429, headers: { 'retry-after': '7' } },
    { status: 200, body: 'after full wait' },
  ], { minDelayMs: 0, maxRetryDelayMs: 10_000, consecutiveBlockLimit: 10 });
  await pf.init();
  assert.equal(await pf.get('/drugs/retry-after-within-ceiling'), 'after full wait');
  assert.deepEqual(sleeps, [7000]);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('robots and content requests share persisted spacing across process lifetimes', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const first = makeFetcher([{ status: 200, body: ROBOTS }]);
  await first.pf.init();
  assert.equal(first.pf.state.count, 1);
  assert.equal(first.pf.state.lastRequestAt, '1970-01-01T00:16:40.000Z');
  await first.pf.close();

  const second = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 200, body: 'content' },
  ]);
  await second.pf.init();
  assert.deepEqual(second.sleeps, [2500]);
  assert.equal(await second.pf.get('/drugs/persisted-spacing'), 'content');
  assert.deepEqual(second.sleeps, [2500, 2500]);
  assert.equal(second.pf.state.count, 3);
  await second.pf.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('robots requests participate in the same persisted daily cap', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf, calls } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 200, body: 'must not dispatch' },
  ], { dailyCap: 1 });
  await pf.init();
  assert.equal(pf.state.count, 1);
  await assert.rejects(pf.get('/drugs/capped-after-robots'), CapReachedError);
  assert.equal(calls.length, 1);
  await pf.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('day rollover preserves discover cursor, resets only count', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(`${TMP}/state.json`, JSON.stringify({ date: '1969-12-01', count: 4999, discover: { label: 3, page: 7 } }));
  const { pf } = makeFetcher([{ status: 200, body: ROBOTS }]);
  await pf.init();
  assert.equal(pf.state.count, 1);
  assert.deepEqual(pf.state.discover, { label: 3, page: 7 });
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('invalid primary state recovers from the validated last-known-good copy', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const lastKnownGood = { date: '1970-01-01', count: 7, discover: { label: 4, page: 2 } };
  fs.writeFileSync(`${TMP}/state.json`, '{"count":');
  fs.writeFileSync(`${TMP}/state.json.lkg`, JSON.stringify(lastKnownGood));
  const { pf } = makeFetcher([{ status: 200, body: ROBOTS }]);
  await pf.init();
  const recovered = {
    ...lastKnownGood,
    count: 8,
    lastRequestAt: '1970-01-01T00:16:40.000Z',
  };
  assert.deepEqual(pf.state, recovered);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${TMP}/state.json`, 'utf8')), recovered);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('a backup-refresh failure cannot roll committed request count or cursor state backward', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const first = makeFetcher([{ status: 200, body: ROBOTS }]).pf;
  await first.init();
  first.state.count = 9;
  first.state.discover = { label: 8, page: 3 };
  fs.unlinkSync(`${TMP}/state.json.lkg`);
  fs.mkdirSync(`${TMP}/state.json.lkg`);
  await assert.rejects(first.persist());
  assert.deepEqual(JSON.parse(fs.readFileSync(`${TMP}/state.json`, 'utf8')), first.state);
  await assert.rejects(first.close());

  fs.rmSync(`${TMP}/state.json.lkg`, { recursive: true, force: true });
  const second = makeFetcher([{ status: 200, body: ROBOTS }]).pf;
  await second.init();
  assert.equal(second.state.count, 10);
  assert.deepEqual(second.state.discover, { label: 8, page: 3 });
  await second.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('invalid state with no valid recovery copy fails closed', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(`${TMP}/state.json`, '[]');
  const { pf, calls } = makeFetcher([{ status: 200, body: ROBOTS }]);
  await assert.rejects(pf.init(), StateCorruptionError);
  assert.equal(calls.length, 0);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('retries respect the min-delay gate and never overshoot the daily cap', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
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

  fs.rmSync(TMP, { recursive: true, force: true }); // fresh state for the cap scenario
  const capped = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 503 }, { status: 503 }, { status: 503 }, { status: 503 },
  ], { dailyCap: 2 });
  await capped.pf.init();
  await assert.rejects(capped.pf.get('/drugs/cap-1'), CapReachedError);
  assert.equal(capped.pf.state.count, 2); // robots + one content attempt did not overshoot the cap
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('PoliteFetcher: daily cap enforced and persisted', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 200, body: 'only page' },
  ], { dailyCap: 2 });
  await pf.init();
  assert.equal(await pf.get('/drugs/e-5'), 'only page');
  await assert.rejects(pf.get('/drugs/f-6'), /daily cap/i);
  const state = JSON.parse(fs.readFileSync(`${TMP}/state.json`, 'utf8'));
  assert.equal(state.count, 2);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('state keeps a recovery copy and cache refresh preserves the old file until replacement is valid', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 200, body: 'old complete page' },
    { status: 200, body: '' },
    { status: 200, body: 'new complete page' },
  ], { minDelayMs: 0 });
  await pf.init();
  assert.equal(await pf.get('/drugs/atomic'), 'old complete page');
  await assert.rejects(pf.get('/drugs/atomic', { fresh: true }), /must not be empty/);
  assert.equal(pf.cached('/drugs/atomic'), 'old complete page');
  assert.equal(await pf.get('/drugs/atomic', { fresh: true }), 'new complete page');

  assert.equal(fs.existsSync(`${TMP}/state.json.lkg`), true);
  assert.deepEqual(fs.readdirSync(TMP).filter((name) => name.includes('.tmp-')), []);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('verified gzip cache entries are read transparently and corrupt archives are rejected', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const { pf } = makeFetcher([]);
  const requestPath = '/drugs/archived';
  const archivePath = `${pf.cachePath(requestPath)}.gz`;
  fs.writeFileSync(archivePath, gzipSync('archived page'));
  assert.equal(pf.cached(requestPath), 'archived page');
  fs.writeFileSync(archivePath, Buffer.from('not gzip'));
  assert.throws(() => pf.cached(requestPath), CacheCorruptionError);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('a cache entry removed between discovery and read is a cache miss, not corruption', () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const { pf } = makeFetcher([]);
  const requestPath = '/drugs/compression-race';
  const cachePath = pf.cachePath(requestPath);
  fs.writeFileSync(cachePath, 'about to be compressed');

  const originalReadFileSync = fs.readFileSync;
  let intercepted = false;
  fs.readFileSync = function readFileSyncWithCompressionRace(file, ...args) {
    if (!intercepted && file === cachePath) {
      intercepted = true;
      fs.unlinkSync(cachePath);
    }
    return originalReadFileSync.call(this, file, ...args);
  };
  try {
    assert.equal(pf.cached(requestPath), null);
    assert.equal(intercepted, true);
  } finally {
    fs.readFileSync = originalReadFileSync;
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('cache invalidation removes both plain and archive representations', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { pf } = makeFetcher([
    { status: 200, body: ROBOTS },
    { status: 200, body: 'cached page' },
    { status: 200, body: 'validated replacement' },
  ], { minDelayMs: 0 });
  await pf.init();
  await pf.get('/drugs/invalidate');
  const cachePath = pf.cachePath('/drugs/invalidate');
  fs.writeFileSync(`${cachePath}.gz`, gzipSync('older archive'));
  await pf.invalidate('/drugs/invalidate');
  assert.equal(pf.cached('/drugs/invalidate'), null);
  assert.equal(fs.existsSync(`${cachePath}.invalid`), true);
  fs.writeFileSync(`${cachePath}.gz`, gzipSync('late compression result'));
  assert.equal(pf.cached('/drugs/invalidate'), null);
  assert.equal(await pf.get('/drugs/invalidate', { fresh: true }), 'validated replacement');
  assert.equal(fs.existsSync(`${cachePath}.invalid`), false);
  assert.equal(fs.existsSync(`${cachePath}.gz`), false);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('same-source state lock is nonblocking, diagnostic, and releasable', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const first = makeFetcher([{ status: 200, body: ROBOTS }]).pf;
  const second = makeFetcher([{ status: 200, body: ROBOTS }]).pf;
  await first.init();
  await assert.rejects(
    second.init(),
    (error) => error instanceof StateLockError
      && error.lockPath === `${TMP}/state.json.crawler-state.lock`
      && error.message.includes(String(process.pid)),
  );
  await first.close();
  await second.init();
  await second.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('a dead local state owner is reclaimed without operator deletion', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(`${TMP}/state.json.crawler-state.lock`, JSON.stringify({
    pid: 2_147_483_647,
    hostname: (await import('node:os')).hostname(),
    startedAt: '2026-08-01T00:00:00.000Z',
    token: 'stale-owner',
  }));
  const { pf } = makeFetcher([{ status: 200, body: ROBOTS }]);
  await pf.init();
  const owner = JSON.parse(fs.readFileSync(`${TMP}/state.json.crawler-state.lock`, 'utf8'));
  assert.equal(owner.pid, process.pid);
  assert.notEqual(owner.token, 'stale-owner');
  await pf.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('concurrent dead-local lock reclaim leaves exactly one live owner intact', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(`${TMP}/state.json.crawler-state.lock`, JSON.stringify({
    pid: 2_147_483_647,
    hostname: (await import('node:os')).hostname(),
    startedAt: '2026-08-01T00:00:00.000Z',
    token: 'stale-owner',
  }));
  const first = makeFetcher([{ status: 200, body: ROBOTS }]).pf;
  const second = makeFetcher([{ status: 200, body: ROBOTS }]).pf;
  const settled = await Promise.allSettled([first.init(), second.init()]);
  const winners = [first, second].filter((_, index) => settled[index].status === 'fulfilled');
  const losers = settled.filter((entry) => entry.status === 'rejected');

  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.ok(losers[0].reason instanceof StateLockError);
  assert.equal(
    JSON.parse(fs.readFileSync(`${TMP}/state.json.crawler-state.lock`, 'utf8')).token,
    winners[0].lockToken,
  );
  await winners[0].close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('a dead PID from another host is never reclaimed', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(`${TMP}/state.json.crawler-state.lock`, JSON.stringify({
    pid: 2_147_483_647,
    hostname: 'another-host.example',
    startedAt: '2026-08-01T00:00:00.000Z',
    token: 'foreign-owner',
  }));
  const { pf } = makeFetcher([]);
  await assert.rejects(pf.acquireStateLock(), StateLockError);
  assert.equal(
    JSON.parse(fs.readFileSync(`${TMP}/state.json.crawler-state.lock`, 'utf8')).token,
    'foreign-owner',
  );
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('invalid boundedness configuration is rejected before crawling', () => {
  const invalid = [
    { dailyCap: Number.NaN },
    { dailyCap: Number.POSITIVE_INFINITY },
    { maxRetries: Number.NaN },
    { maxRetries: -1 },
    { consecutiveBlockLimit: 0 },
    { minDelayMs: Number.NaN },
    { jitterMs: -1 },
    { retryBaseMs: Number.POSITIVE_INFINITY },
  ];
  for (const override of invalid) {
    assert.throws(() => makeFetcher([], override), /must be/);
  }
});
