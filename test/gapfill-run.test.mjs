import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PoliteFetcher } from '../src/lib/politeness.mjs';
import { runTargeted, runDiscover, loadSlugIndex } from '../src/cli/gapfill.mjs';

const augmentinHtml = fs.readFileSync('test/fixtures/onemg/drug_page_tablet.html', 'utf8');
const browseHtml = fs.readFileSync('test/fixtures/onemg/browse_page.html', 'utf8');
const TMP = 'test/.tmp-gapfill';

function fakeFetcher(routes) {
  return new PoliteFetcher({
    baseUrl: 'https://fake.test',
    cacheDir: `${TMP}/pages`,
    stateFile: `${TMP}/state.json`,
    jitterMs: 0,
    userAgent: 'aushadhi-test',
    fetchImpl: async (url) => {
      const p = url.replace('https://fake.test', '');
      const body = p === '/robots.txt' ? 'User-agent: *\nDisallow: /nothing' : routes(p);
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

test('runDiscover: builds slug index from browse pages, advances cursor', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const pf = fakeFetcher((p) => {
    if (p === '/drugs-all-medicines?label=a&page=1') return browseHtml;
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
