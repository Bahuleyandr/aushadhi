import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PoliteFetcher } from '../src/lib/politeness.mjs';
import { runTargeted, runDiscover, loadSlugIndex } from '../src/cli/gapfill.mjs';

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

test('runDiscover: builds slug index from browse pages, advances cursor', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const pf = fakeFetcher((p) => {
    if (p === '/drugs-all-medicines?label=a') return browseHtml; // page 1 = bare label URL
    return '<html><body>no links here</body></html>';
  });
  await pf.init();
  const r = await runDiscover({ pf, maxPages: 2, indexFile: `${TMP}/slug-index.jsonl`, log: () => {} });
  assert.ok(r.added >= 20, `added ${r.added}`);
  const index = loadSlugIndex(`${TMP}/slug-index.jsonl`);
  assert.ok(index.size >= 20);
  assert.ok([...index.values()].every((p) => p.startsWith('/drugs/')));
  // second page had no links -> cursor moved to next label
  assert.equal(pf.state.discover.label, 1);
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
