import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  crawlerExitCode as apolloExitCode,
  refreshSaltIndex,
  runApolloIndex,
  selectApolloMembershipRefresh,
} from '../src/cli/apollo.mjs';
import {
  crawlerExitCode as pharmeasyExitCode,
  refreshPharmeasyIndex,
} from '../src/cli/pharmeasy.mjs';
import {
  crawlerExitCode as netmedsExitCode,
  refreshNetmedsIndex,
} from '../src/cli/netmeds.mjs';
import { BlockedError, CapReachedError, HttpStatusError } from '../src/lib/politeness.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const APOLLO_ORIGIN = 'https://www.apollopharmacy.in';
const APOLLO_FIXTURE_PATH = '/medicine/elmox-cv-625mg-tablet';

function withApolloProductResponseMetadata(fetcher) {
  return {
    ...fetcher,
    getWithMetadata: async (requestPath, options) => ({
      body: (await fetcher.get(requestPath, options)).replaceAll(APOLLO_FIXTURE_PATH, requestPath),
      responseUrl: `${APOLLO_ORIGIN}${requestPath}`,
    }),
  };
}

function resetDirectory(root) {
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
}

for (const [source, exitCode] of [
  ['apollo', apolloExitCode],
  ['pharmeasy', pharmeasyExitCode],
  ['netmeds', netmedsExitCode],
]) {
  test(`${source}: exit contract distinguishes daily cap, source block/robots, and anomalies`, () => {
    assert.equal(exitCode(new CapReachedError('daily cap reached'), true), 2);
    assert.equal(exitCode(new BlockedError('source blocked'), true), 3);
    assert.equal(exitCode(new HttpStatusError(403, '/blocked'), true), 3);
    assert.equal(exitCode(new HttpStatusError(429, '/rate-limited'), true), 3);
    assert.equal(exitCode(new HttpStatusError(500, '/transient'), true), 1);
    assert.equal(exitCode(new Error('robots.txt disallows this path'), true), 3);
    assert.equal(exitCode(Object.assign(new Error('parser drift'), { code: 'DISCOVERY_ANOMALY' }), true), 4);
    assert.equal(exitCode(new BlockedError('legacy wrapper compatibility'), false), 2);
    assert.equal(exitCode(new Error('ordinary failure'), true), 1);
  });
}

test('PharmEasy sitemap refresh appends stable paths once and observes the bounded cadence', async () => {
  const root = 'test/.tmp-pharmeasy-index-refresh';
  resetDirectory(root);
  const indexFile = `${root}/product-index.jsonl`;
  const existing = '/online-medicine-order/existing-tablet-101';
  const discovered = '/online-medicine-order/new-tablet-202';
  fs.writeFileSync(indexFile, `${JSON.stringify({ path: existing })}\n`);
  const state = {};
  const calls = [];
  const pf = {
    get: async (requestPath, options) => {
      calls.push([requestPath, options]);
      return requestPath.includes('prescription')
        ? `<urlset><url><loc>https://pharmeasy.in${existing}</loc></url></urlset>`
        : `<urlset><url><loc>https://pharmeasy.in${discovered}</loc></url></urlset>`;
    },
    persist: async () => {},
  };
  const now = new Date('2026-08-06T00:00:00.000Z');

  const refreshed = await refreshPharmeasyIndex({ pf, indexFile, state, now, log: () => {} });
  assert.equal(refreshed.status, 'refreshed');
  assert.equal(refreshed.added, 1);
  assert.equal(state.indexRefresh.completedAt, now.toISOString());
  assert.deepEqual(
    fs.readFileSync(indexFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line).path),
    [existing, discovered],
  );
  assert.equal(calls.length, 2);

  const notDue = await refreshPharmeasyIndex({
    pf,
    indexFile,
    state,
    now: new Date(now.getTime() + DAY_MS - 1),
    log: () => {},
  });
  assert.equal(notDue.status, 'not_due');
  assert.equal(calls.length, 2, 'not-due refresh still fetched a sitemap');
  fs.rmSync(root, { recursive: true, force: true });
});

for (const [source, refreshIndex] of [
  ['PharmEasy', refreshPharmeasyIndex],
  ['Netmeds', refreshNetmedsIndex],
]) {
  test(`${source}: first typed HTTP 403/429 during discovery remains a source-block stop`, async () => {
    const root = `test/.tmp-${source.toLowerCase()}-typed-block`;
    resetDirectory(root);
    const state = {};
    for (const status of [403, 429]) {
      const signal = new HttpStatusError(status, '/sitemap.xml');
      await assert.rejects(
        refreshIndex({
          pf: {
            get: async () => { throw signal; },
            persist: async () => {},
          },
          indexFile: `${root}/product-index.jsonl`,
          state,
          now: new Date('2026-08-06T00:00:00.000Z'),
          log: () => {},
        }),
        (error) => error === signal,
      );
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
}

test('Apollo: first typed HTTP 403/429 during discovery remains a source-block stop', async () => {
  const root = 'test/.tmp-apollo-typed-block';
  resetDirectory(root);
  const saltIndexFile = `${root}/salt-index.jsonl`;
  fs.writeFileSync(saltIndexFile, '');
  for (const status of [403, 429]) {
    const signal = new HttpStatusError(status, '/salts');
    await assert.rejects(
      refreshSaltIndex({
        pf: { get: async () => { throw signal; } },
        saltIndexFile,
        log: () => {},
      }),
      (error) => error === signal,
    );
  }
  fs.rmSync(root, { recursive: true, force: true });
});

for (const [source, file] of [
  ['Apollo', 'src/cli/apollo.mjs'],
  ['PharmEasy', 'src/cli/pharmeasy.mjs'],
  ['Netmeds', 'src/cli/netmeds.mjs'],
]) {
  test(`${source}: fetcher initialization is inside stop classification and close is initialization-guarded`, () => {
    const cli = fs.readFileSync(file, 'utf8');
    const main = cli.slice(cli.indexOf('export async function main'));
    assert.ok(main.indexOf('try {') < main.indexOf('await pf.init()'));
    assert.match(main, /let initialized = false;/);
    assert.match(main, /await pf\.init\(\);\s*initialized = true;/);
    assert.match(main, /if \(initialized && typeof pf\.close === 'function'\)/);
  });
}

test('Netmeds sitemap refresh resumes the same stable sitemap after a daily cap', async () => {
  const root = 'test/.tmp-netmeds-index-refresh';
  resetDirectory(root);
  const indexFile = `${root}/product-index.jsonl`;
  fs.writeFileSync(indexFile, '');
  const state = {};
  const capped = {
    get: async () => { throw new CapReachedError('daily cap reached'); },
    persist: async () => {},
  };
  const now = new Date('2026-08-06T00:00:00.000Z');

  await assert.rejects(
    refreshNetmedsIndex({ pf: capped, indexFile, state, now, log: () => {} }),
    CapReachedError,
  );
  assert.deepEqual(state.indexRefresh.queue, ['/sitemap.xml']);
  assert.equal(state.indexRefresh.completedAt, null);

  const calls = [];
  const resumed = {
    get: async (requestPath, options) => {
      calls.push([requestPath, options]);
      if (requestPath === '/sitemap.xml') {
        return '<sitemapindex><sitemap><loc>https://www.netmeds.com/sitemap/products/drugs.xml</loc></sitemap></sitemapindex>';
      }
      return '<urlset><url><loc>https://www.netmeds.com/product/new-tablet-10s-303</loc></url></urlset>';
    },
    persist: async () => {},
  };
  const result = await refreshNetmedsIndex({ pf: resumed, indexFile, state, now, log: () => {} });
  assert.equal(result.status, 'refreshed');
  assert.equal(result.added, 1);
  assert.deepEqual(calls.map(([requestPath]) => requestPath), [
    '/sitemap.xml',
    '/sitemap/products/drugs.xml',
  ]);
  assert.equal(JSON.parse(fs.readFileSync(indexFile, 'utf8').trim()).path, '/product/new-tablet-10s-303');
  fs.rmSync(root, { recursive: true, force: true });
});

test('sitemap parser anomalies fail closed without completing or advancing discovery', async () => {
  const root = 'test/.tmp-pharmeasy-index-anomaly';
  resetDirectory(root);
  const indexFile = `${root}/product-index.jsonl`;
  fs.writeFileSync(indexFile, '');
  const state = {};

  await assert.rejects(
    refreshPharmeasyIndex({
      pf: {
        get: async () => '<urlset><url><loc>https://example.com/irrelevant.xml</loc></url></urlset>',
        persist: async () => {},
      },
      indexFile,
      state,
      now: new Date('2026-08-06T00:00:00.000Z'),
      log: () => {},
    }),
    (error) => error?.code === 'DISCOVERY_ANOMALY',
  );
  assert.equal(state.indexRefresh.completedAt, null);
  assert.equal(state.indexRefresh.queue[0], '/sitemaps/sitemap-prescription-medicines.xml');
  assert.equal(fs.readFileSync(indexFile, 'utf8'), '');
  fs.rmSync(root, { recursive: true, force: true });
});

test('Apollo selects due salt membership by stable path, independent of index position', () => {
  const state = {
    saltChecks: {
      '/salt/recent': '2026-08-05T12:00:00.000Z',
      '/salt/old': '2026-07-01T00:00:00.000Z',
    },
  };
  const now = new Date('2026-08-06T00:00:00.000Z');
  const options = { state, now, refreshIntervalMs: DAY_MS, maxSalts: 2 };
  assert.deepEqual(
    selectApolloMembershipRefresh({ salts: ['/salt/recent', '/salt/new', '/salt/old'], ...options }),
    ['/salt/new', '/salt/old'],
  );
  assert.deepEqual(
    selectApolloMembershipRefresh({ salts: ['/salt/old', '/salt/recent', '/salt/new'], ...options }),
    ['/salt/new', '/salt/old'],
  );
});

test('Apollo membership revisit invalidates anomalies and records stable salt completion', async () => {
  const root = 'test/.tmp-apollo-membership-refresh';
  resetDirectory(root);
  const outFile = `${root}/normalized.jsonl`;
  const invalidated = [];
  const calls = [];
  const pf = withApolloProductResponseMetadata({
    state: { apollo: {} },
    get: async (requestPath) => {
      calls.push(requestPath);
      if (requestPath === '/salt/existing') {
        return '<a href="/medicine/known-product">Known</a><a href="/medicine/new-product">New</a>';
      }
      if (requestPath === '/medicine/bad-product') return '<html>parser drift</html>';
      return fs.readFileSync('test/fixtures/apollo/medicine_elmox.html', 'utf8');
    },
    invalidate: async (requestPath) => invalidated.push(requestPath),
    persist: async () => {},
  });
  const checkedAt = new Date('2026-08-06T00:00:00.000Z');

  const result = await runApolloIndex({
    pf,
    salts: ['/salt/existing'],
    outFile,
    date: '2026-08-06',
    now: () => checkedAt.getTime(),
    seen: new Set(['known-product']),
    parserFingerprint: 'parser-v1',
    log: () => {},
  });
  assert.equal(result.products, 1);
  assert.equal(pf.state.apollo.saltChecks['/salt/existing'], checkedAt.toISOString());
  assert.equal('saltCursor' in pf.state.apollo, false);
  assert.deepEqual(calls, ['/salt/existing', '/medicine/new-product']);
  assert.deepEqual(invalidated, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('Apollo parser anomalies invalidate every cache representation through the fetcher API', async () => {
  const root = 'test/.tmp-apollo-invalidate';
  resetDirectory(root);
  const invalidated = [];
  const pf = withApolloProductResponseMetadata({
    state: { apollo: {} },
    get: async (requestPath) => requestPath === '/salt/example'
      ? '<a href="/medicine/anomaly">Anomaly</a>'
      : '<html>parser drift</html>',
    invalidate: async (requestPath) => invalidated.push(requestPath),
    persist: async () => {},
  });

  await runApolloIndex({
    pf,
    salts: ['/salt/example'],
    outFile: `${root}/normalized.jsonl`,
    date: '2026-08-06',
    now: () => Date.parse('2026-08-06T00:00:00.000Z'),
    parserFingerprint: 'parser-v1',
    log: () => {},
  });
  assert.deepEqual(invalidated, ['/medicine/anomaly']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('Apollo salt index refresh remains incremental and does not overwrite its source stream', async () => {
  const root = 'test/.tmp-apollo-salt-index-policy';
  resetDirectory(root);
  const saltIndexFile = `${root}/salt-index.jsonl`;
  fs.writeFileSync(saltIndexFile, `${JSON.stringify({ path: '/salt/existing' })}\n`);
  const result = await refreshSaltIndex({
    pf: {
      get: async () => '<a href="/salt/existing">Existing</a><a href="/salt/new">New</a>',
    },
    saltIndexFile,
    log: () => {},
  });
  assert.equal(result, 1);
  assert.deepEqual(
    fs.readFileSync(saltIndexFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line).path),
    ['/salt/existing', '/salt/new'],
  );
  fs.rmSync(root, { recursive: true, force: true });
});
