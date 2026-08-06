import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HttpStatusError, PoliteFetcher } from '../src/lib/politeness.mjs';
import {
  crawlerExitCode,
  loadSlugIndex,
  runAuditSample,
  runDiscover,
  runTargeted,
} from '../src/cli/gapfill.mjs';
import { DEFAULT_NOT_FOUND_REVALIDATE_MS } from '../src/lib/variant-priority.mjs';

const augmentinHtml = fs.readFileSync('test/fixtures/onemg/drug_page_tablet.html', 'utf8');
const browseHtml = fs.readFileSync('test/fixtures/onemg/browse_page.html', 'utf8');
const TMP = 'test/.tmp-gapfill';

function fakeFetcher(routes, robots = 'User-agent: *\nDisallow: /nothing') {
  return new PoliteFetcher({
    baseUrl: 'https://fake.test',
    cacheDir: `${TMP}/pages`,
    stateFile: `${TMP}/state.json`,
    jitterMs: 0,
    userAgent: 'aushadhi-test',
    fetchImpl: async (url) => {
      const p = url.replace('https://fake.test', '');
      const body = p === '/robots.txt' ? robots : routes(p);
      return { ok: body !== null, status: body !== null ? 200 : 404, text: async () => body ?? '' };
    },
    now: (() => { let t = 1_000_000; return () => (t += 5000); })(),
    sleep: async () => {},
  });
}

test('runTargeted: writes normalized row with target identity + harvests unknown substitutes', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const pf = fakeFetcher((p) => (p === '/drugs/augmentin-625-duo-tablet-138629' ? augmentinHtml : null));
  await pf.init();
  const queue = [{
    identity_key: 'k', brand_name: 'Augmentin 625 Duo Tablet',
    manufacturer: 'Glaxo SmithKline Pharmaceuticals Ltd', pack_label: 'strip of 10 tablets',
    path: '/drugs/augmentin-625-duo-tablet-138629',
  }];
  const r = await runTargeted({
    pf, queue,
    outFile: `${TMP}/normalized.jsonl`,
    discoveryFile: `${TMP}/discovery-queue.jsonl`,
    knownNorms: new Set(['augmentin 625 duo tablet']),
    date: '2026-07-07',
    log: () => {},
  });
  assert.equal(r.ok, 1);
  const row = JSON.parse(fs.readFileSync(`${TMP}/normalized.jsonl`, 'utf8').trim());
  assert.equal(row.source, 'onemg-live');
  assert.equal(row.brand_name, 'Augmentin 625 Duo Tablet');
  assert.equal(row.manufacturer, 'Glaxo SmithKline Pharmaceuticals Ltd');
  assert.equal(row.pack_label, 'strip of 10 tablets');
  assert.equal(row.ingredients.length, 2);
  assert.ok(row.substitutes_raw.some((s) => s.name === 'Novaclav 625 Tablet'));
  const disc = fs.readFileSync(`${TMP}/discovery-queue.jsonl`, 'utf8');
  assert.match(disc, /Novaclav 625 Tablet/);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('runTargeted: robots refusal aborts the phase instead of being counted as a page failure', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const pf = fakeFetcher(() => augmentinHtml, 'User-agent: *\nDisallow: /drugs/');
  await pf.init();
  const queue = [{
    identity_key: 'k', brand_name: 'Blocked Tablet', manufacturer: 'M Pharma',
    pack_label: 'strip of 10', path: '/drugs/blocked-tablet-123',
  }];
  await assert.rejects(runTargeted({
    pf, queue,
    outFile: `${TMP}/normalized.jsonl`,
    discoveryFile: `${TMP}/discovery-queue.jsonl`,
    knownNorms: new Set(),
    date: '2026-07-10',
    log: () => {},
  }), /robots/i);
  assert.equal(fs.existsSync(`${TMP}/normalized.jsonl`), false);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('runDiscover: explicit null next pointer completes a label without guessing from an empty page', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const terminalHtml = browseHtml.replaceAll('"next":"/drugs-all-medicines?page=2"', '"next":null');
  const pf = fakeFetcher((p) => {
    if (p === '/drugs-all-medicines?label=a') return terminalHtml;
    return null;
  });
  await pf.init();
  const r = await runDiscover({ pf, maxPages: 1, indexFile: `${TMP}/slug-index.jsonl`, log: () => {} });
  assert.ok(r.added >= 20, `added ${r.added}`);
  const index = loadSlugIndex(`${TMP}/slug-index.jsonl`);
  assert.ok(index.size >= 20);
  assert.ok([...index.values()].every((p) => p.startsWith('/drugs/')));
  assert.equal(pf.state.discover.label, 1);
  assert.equal(pf.state.discover.page, 1);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('1mg maps the first typed HTTP 403/429 to a source hold and aborts targeted work', async () => {
  const queue = [{
    identity_key: 'k', brand_name: 'Blocked Tablet', manufacturer: 'M Pharma',
    pack_label: 'strip of 10', path: '/drugs/blocked-tablet-123',
  }];
  for (const status of [403, 429]) {
    const signal = new HttpStatusError(status, queue[0].path);
    assert.equal(crawlerExitCode(signal, true), 3);
    await assert.rejects(runTargeted({
      pf: {},
      queue,
      outFile: `${TMP}/normalized.jsonl`,
      discoveryFile: `${TMP}/discovery-queue.jsonl`,
      knownNorms: new Set(),
      date: '2026-08-06',
      log: () => {},
      fetchProduct: async () => { throw signal; },
    }), (error) => error === signal);
  }
});

test('runTargeted aborts after a bounded run of consecutive systemic fetch failures', async () => {
  const queue = [1, 2, 3, 4].map((number) => ({
    brand_name: `Failure ${number}`,
    path: `/drugs/failure-${number}-${number}`,
  }));
  let attempts = 0;
  await assert.rejects(runTargeted({
    pf: {},
    queue,
    outFile: `${TMP}/normalized.jsonl`,
    discoveryFile: `${TMP}/discovery-queue.jsonl`,
    knownNorms: new Set(),
    date: '2026-08-06',
    log: () => {},
    maxConsecutiveFetchFailures: 3,
    fetchProduct: async () => {
      attempts++;
      throw new Error('systemic transport failure');
    },
  }), /systemic transport failure/);
  assert.equal(attempts, 3);
});

test('runAuditSample aborts after a bounded run of consecutive systemic fetch failures', async () => {
  const rows = [1, 2, 3, 4].map((number) => ({
    brand_name: `Audit Failure ${number}`,
    manufacturer: 'Example',
    pack_label: 'strip of 10',
    ingredients: [{ molecule: 'a' }, { molecule: 'b' }],
    two_slot_maxed: true,
    sources: [{ source: 'github-jr' }],
  }));
  const slugIndex = new Map(rows.map((row, index) => [
    row.brand_name.toLowerCase(), `/drugs/audit-failure-${index + 1}-${index + 1}`,
  ]));
  slugIndex.allPaths = [...slugIndex.values()];
  let attempts = 0;
  await assert.rejects(runAuditSample({
    pf: {},
    rows,
    slugIndex,
    n: rows.length,
    outFile: `${TMP}/normalized.jsonl`,
    discoveryFile: `${TMP}/discovery-queue.jsonl`,
    knownNorms: new Set(),
    date: '2026-08-06',
    log: () => {},
    maxConsecutiveFetchFailures: 3,
    fetchProduct: async () => {
      attempts++;
      throw new Error('systemic audit failure');
    },
  }), /systemic audit failure/);
  assert.equal(attempts, 3);
});

test('runTargeted: 404 is durably deferred, 410 is terminal, and neither repeats prematurely', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const notFoundPath = '/drugs/augmentin-625-duo-tablet-138629';
  const gonePath = '/drugs/retired-tablet-999999';
  const state = {};
  const requested = [];
  let now = Date.parse('2026-08-06T00:00:00.000Z');
  let phase = 'dead';
  const fetchProduct = async (productPath) => {
    requested.push(productPath);
    if (productPath === gonePath) {
      return { status: 'gone', html: null, checkedAt: new Date(now).toISOString() };
    }
    if (phase === 'dead') {
      return { status: 'not_found', html: null, checkedAt: new Date(now).toISOString() };
    }
    return { status: 'fetched', html: augmentinHtml };
  };
  const options = {
    pf: {},
    queue: [
      { mode: 'family_sibling', path: notFoundPath },
      { mode: 'family_sibling', path: gonePath },
    ],
    outFile: `${TMP}/normalized.jsonl`,
    discoveryFile: `${TMP}/discovery-queue.jsonl`,
    knownNorms: new Set(),
    date: '2026-08-06',
    state,
    persist: async () => {},
    fetchProduct,
    now: () => now,
    log: () => {},
  };

  const first = await runTargeted(options);
  assert.equal(first.attempted, 2);
  assert.equal(first.notFound, 1);
  assert.equal(first.gone, 1);
  assert.deepEqual(requested, [notFoundPath, gonePath]);
  assert.deepEqual(state.pathOutcomes, [
    {
      productId: '138629', path: notFoundPath, status: 'not_found',
      checkedAt: '2026-08-06T00:00:00.000Z',
      retryAt: new Date(now + DEFAULT_NOT_FOUND_REVALIDATE_MS).toISOString(),
    },
    {
      productId: '999999', path: gonePath, status: 'gone',
      checkedAt: '2026-08-06T00:00:00.000Z',
    },
  ]);

  requested.length = 0;
  now += DEFAULT_NOT_FOUND_REVALIDATE_MS - 1;
  const deferred = await runTargeted(options);
  assert.equal(deferred.status, 'no_work');
  assert.equal(deferred.attempted, 0);
  assert.deepEqual(requested, []);

  requested.length = 0;
  now += 1;
  phase = 'fetched';
  const retried = await runTargeted(options);
  assert.equal(retried.ok, 1);
  assert.deepEqual(requested, [notFoundPath]);
  assert.deepEqual(state.pathOutcomes, [{
    productId: '999999', path: gonePath, status: 'gone', checkedAt: '2026-08-06T00:00:00.000Z',
  }]);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('runDiscover: terminal Z schedules the next sweep and never wraps inside one invocation', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const now = Date.parse('2026-08-06T00:00:00.000Z');
  const terminalHtml = browseHtml.replaceAll('"next":"/drugs-all-medicines?page=2"', '"next":null');
  const requests = [];
  const pf = {
    state: { discover: { label: 25, page: 1 } },
    get: async (requestPath, options) => {
      requests.push({ requestPath, options });
      return terminalHtml;
    },
    persist: async () => {},
  };

  const result = await runDiscover({
    pf,
    maxPages: 50,
    indexFile: `${TMP}/slug-index.jsonl`,
    now: () => now,
    refreshMs: 24 * 60 * 60 * 1000,
    log: () => {},
  });

  assert.deepEqual(requests, [{ requestPath: '/drugs-all-medicines?label=z', options: { fresh: true } }]);
  assert.equal(result.status, 'sweep_complete');
  assert.equal(result.fetched, 1);
  assert.deepEqual(pf.state.discover, {
    label: 26,
    page: 1,
    completed_at: '2026-08-06T00:00:00.000Z',
    next_refresh_at: '2026-08-07T00:00:00.000Z',
  });
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('runDiscover: completed sweep performs no network work before its refresh window', async () => {
  const pf = {
    state: { discover: {
      label: 26,
      page: 1,
      completed_at: '2026-08-06T00:00:00.000Z',
      next_refresh_at: '2026-08-07T00:00:00.000Z',
    } },
    get: async () => assert.fail('refresh-deferred discovery must not fetch'),
    persist: async () => {},
  };
  const result = await runDiscover({
    pf,
    maxPages: 50,
    indexFile: `${TMP}/slug-index.jsonl`,
    now: () => Date.parse('2026-08-06T12:00:00.000Z'),
    log: () => {},
  });
  assert.deepEqual(result, {
    status: 'refresh_deferred',
    fetched: 0,
    added: 0,
    index: loadSlugIndex(`${TMP}/slug-index.jsonl`),
    nextRefreshAt: '2026-08-07T00:00:00.000Z',
  });
});

test('runDiscover: due completed sweep restarts at A on the next invocation', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const terminalHtml = browseHtml.replaceAll('"next":"/drugs-all-medicines?page=2"', '"next":null');
  const requests = [];
  const pf = {
    state: { discover: {
      label: 26,
      page: 1,
      completed_at: '2026-08-05T00:00:00.000Z',
      next_refresh_at: '2026-08-06T00:00:00.000Z',
    } },
    get: async (requestPath) => { requests.push(requestPath); return terminalHtml; },
    persist: async () => {},
  };
  const result = await runDiscover({
    pf,
    maxPages: 1,
    indexFile: `${TMP}/slug-index.jsonl`,
    now: () => Date.parse('2026-08-06T00:00:00.000Z'),
    log: () => {},
  });
  assert.deepEqual(requests, ['/drugs-all-medicines?label=a']);
  assert.equal(result.status, 'progress');
  assert.equal(pf.state.discover.label, 1);
  assert.equal(pf.state.discover.page, 1);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('runDiscover: a duplicate-only page is progress, not a zero-yield no-work signal', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const first = await runDiscover({
    pf: {
      state: {},
      get: async () => browseHtml,
      persist: async () => {},
    },
    maxPages: 1,
    indexFile: `${TMP}/slug-index.jsonl`,
    log: () => {},
  });
  assert.ok(first.added > 0);

  const second = await runDiscover({
    pf: {
      state: {},
      get: async () => browseHtml,
      persist: async () => {},
    },
    maxPages: 1,
    indexFile: `${TMP}/slug-index.jsonl`,
    log: () => {},
  });
  assert.equal(second.status, 'progress');
  assert.equal(second.fetched, 1);
  assert.equal(second.added, 0);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('runDiscover: requests browse pages fresh to avoid stale cached listings', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  let request;
  const pf = {
    state: { discover: { label: 22, page: 1 } }, // w, first page
    get: async (p, options) => {
      request = { p, options };
      return browseHtml;
    },
    persist: async () => {},
  };

  try {
    const r = await runDiscover({ pf, maxPages: 1, indexFile: `${TMP}/slug-index.jsonl`, log: () => {} });
    assert.ok(r.added >= 20, `added ${r.added}`);
    assert.equal(request.p, '/drugs-all-medicines?label=w');
    assert.deepEqual(request.options, { fresh: true });
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('runDiscover: empty first browse page preserves cursor as a classified source anomaly', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const pf = fakeFetcher((p) => {
    if (p === '/drugs-all-medicines?label=w') return '<html><body>temporary empty response</body></html>';
    return null;
  });
  await pf.init();
  pf.state.discover = { label: 22, page: 1 }; // w, first page

  try {
    await assert.rejects(
      runDiscover({ pf, maxPages: 1, indexFile: `${TMP}/slug-index.jsonl`, log: () => {} }),
      (error) => {
        assert.equal(error.name, 'DiscoveryAnomalyError');
        assert.equal(error.code, 'DISCOVERY_PAGE_EMPTY');
        assert.match(error.message, /label=w page 1 yielded 0 entries/i);
        return true;
      },
    );
    assert.deepEqual(pf.state.discover, { label: 22, page: 1 });
    assert.equal(fs.existsSync(`${TMP}/slug-index.jsonl`), false);
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
