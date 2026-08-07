import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseApolloComposition, parseApolloProduct, parseApolloSaltPage,
  parseApolloSaltDirectory, readApolloNormalized,
} from '../../src/adapters/apollo.mjs';
import {
  ApolloParserAnomalyError,
  refreshSaltIndex,
  runApolloIndex,
} from '../../src/cli/apollo.mjs';
import { BlockedError, HttpStatusError } from '../../src/lib/politeness.mjs';

const medHtml = fs.readFileSync('test/fixtures/apollo/medicine_elmox.html', 'utf8');
const saltHtml = fs.readFileSync('test/fixtures/apollo/salt_amox_clav.html', 'utf8');
const APOLLO_ORIGIN = 'https://www.apollopharmacy.in';
const FIXTURE_PRODUCT_PATH = '/medicine/elmox-cv-625mg-tablet';

function productHtmlFor(requestPath) {
  return medHtml.replaceAll(FIXTURE_PRODUCT_PATH, requestPath);
}

function withProductResponseMetadata(fetcher) {
  return {
    ...fetcher,
    getWithMetadata: async (requestPath, options) => ({
      body: (await fetcher.get(requestPath, options)).replaceAll(FIXTURE_PRODUCT_PATH, requestPath),
      responseUrl: `${APOLLO_ORIGIN}${requestPath}`,
    }),
  };
}

test('parseApolloComposition: MOLECULE-STRENGTH+MOLECULE-STRENGTH form', () => {
  const ings = parseApolloComposition('AMOXICILLIN-500MG+CLAVULANIC ACID-125MG');
  assert.deepEqual(ings.map((i) => i.molecule), ['amoxycillin', 'clavulanic acid']); // alias amoxicillin->amoxycillin
  const clav = ings.find((i) => i.molecule === 'clavulanic acid');
  assert.equal(clav.strength_value, 125);
  assert.equal(clav.strength_unit, 'mg');
});

test('parseApolloComposition: single molecule + no-strength tolerated', () => {
  assert.deepEqual(parseApolloComposition('PARACETAMOL-650MG').map((i) => i.molecule), ['paracetamol']);
  const none = parseApolloComposition('SILICON DIOXIDE');
  assert.equal(none.length, 1);
  assert.equal(none[0].strength_value, null);
});

test('parseApolloProduct: extracts brand, manufacturer, composition from the Drug ld+json', () => {
  const r = parseApolloProduct(medHtml);
  assert.match(r.brand_name, /Elmox CV 625/i);
  assert.match(r.manufacturer, /Elder Pharmaceuticals/i);
  assert.deepEqual(r.ingredients.map((i) => i.molecule), ['amoxycillin', 'clavulanic acid']);
  assert.equal(r.composition_status, 'complete');
  assert.equal(r.source, 'apollo');
  // schema.org Drug is not specific to a system of medicine
  assert.equal(r.type, null);
});

test('parseApolloProduct: generic Drug and category labels never infer allopathy', () => {
  const drugBlock = {
    '@type': 'Drug',
    name: 'Liv.52 Tablet',
    nonProprietaryName: 'HIMSRA-500MG',
  };
  const breadcrumb = (categoryName) => ({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.apollopharmacy.in/' },
      { '@type': 'ListItem', position: 2, name: categoryName, item: 'https://www.apollopharmacy.in/shop-by-category/x' },
    ],
  });
  const pageFor = (categoryName) => `<script type="application/ld+json">${JSON.stringify(drugBlock)}</script>`
    + `<script type="application/ld+json">${JSON.stringify(breadcrumb(categoryName))}</script>`;
  for (const category of ['LIVER CARE', 'Antibiotics', 'Ayurvedic Products', 'Ayurveda', 'Homeopathy', 'Homoeopathic Remedies', 'Unani', 'Siddha']) {
    const row = parseApolloProduct(pageFor(category));
    assert.notEqual(row, null, `${category}: row is still emitted`);
    assert.equal(row.type, null, `${category}: category is not exclusive evidence`);
  }
  const ayushDrug = `<script type="application/ld+json">${JSON.stringify({
    ...drugBlock, description: 'An Ayurvedic proprietary medicine.',
  })}</script>`;
  assert.equal(parseApolloProduct(ayushDrug).type, null);
  assert.match(medHtml, /Ayurvedic Products/);
  assert.equal(parseApolloProduct(medHtml).type, null);
});

test('parseApolloProduct: binds the Drug JSON-LD identity to the requested product path', () => {
  assert.ok(parseApolloProduct(medHtml, { expectedPath: FIXTURE_PRODUCT_PATH }));
  assert.equal(
    parseApolloProduct(medHtml, { expectedPath: '/medicine/a-different-product' }),
    null,
  );
  const htmlForUrl = (url, { includeUrl = true } = {}) => `<script type="application/ld+json">${JSON.stringify({
    '@type': 'Drug',
    name: 'Bound product',
    nonProprietaryName: 'PARACETAMOL-500MG',
    ...(includeUrl ? { url } : {}),
  })}</script>`;
  for (const html of [
    htmlForUrl(null, { includeUrl: false }),
    htmlForUrl(FIXTURE_PRODUCT_PATH),
    htmlForUrl(`https://example.invalid${FIXTURE_PRODUCT_PATH}`),
    htmlForUrl(`${APOLLO_ORIGIN}${FIXTURE_PRODUCT_PATH}/`),
    htmlForUrl(`${APOLLO_ORIGIN}/medicine/a-different-product`),
  ]) {
    assert.equal(parseApolloProduct(html, { expectedPath: FIXTURE_PRODUCT_PATH }), null);
  }
});

test('parseApolloSaltPage: extracts the /medicine/ product paths listed', () => {
  const paths = parseApolloSaltPage(saltHtml);
  assert.ok(paths.length >= 3, `got ${paths.length}`);
  assert.ok(paths.includes('/medicine/elmox-cv-625mg-tablet'));
  assert.ok(paths.every((p) => /^\/medicine\/[a-z0-9-]+$/.test(p)));
});

test('parseApolloSaltDirectory: extracts unique /salt/ paths, ignores non-salt links', () => {
  const html = '<a href="/salt/amoxicillin">A</a><a href="/salt/amoxicillin-clavulanic-acid">B</a>'
    + '<a href="/salt/amoxicillin?x=1">dup</a><a href="/shop-by-category/foo">skip</a>';
  const paths = parseApolloSaltDirectory(html);
  assert.deepEqual(paths.sort(), ['/salt/amoxicillin', '/salt/amoxicillin-clavulanic-acid']);
});

test('readApolloNormalized: refreshes by source product ID without collapsing distinct products', () => {
  const root = 'test/.tmp-apollo';
  fs.rmSync(root, { recursive: true, force: true });
  const mk = (date, molecule) => {
    fs.mkdirSync(`${root}/apollo/${date}`, { recursive: true });
    fs.writeFileSync(`${root}/apollo/${date}/normalized.jsonl`, JSON.stringify({
      source: 'apollo', source_id: 'x', seen_at: date, brand_name: 'Elmox CV', manufacturer: 'Elder',
      pack_label: '', ingredients: [{ molecule, strength_value: 1, strength_unit: 'mg', strength_raw: '1mg' }],
      composition_status: 'complete', substitutes_raw: [],
    }) + '\n');
  };
  mk('2026-07-01', 'old');
  mk('2026-07-17', 'new');
  fs.appendFileSync(`${root}/apollo/2026-07-17/normalized.jsonl`, JSON.stringify({
    source: 'apollo', source_id: 'y', seen_at: '2026-07-17', brand_name: 'Elmox CV', manufacturer: 'Elder',
    pack_label: '', ingredients: [{ molecule: 'other', strength_value: 1, strength_unit: 'mg', strength_raw: '1mg' }],
    composition_status: 'complete', substitutes_raw: [],
  }) + '\n');
  const rows = readApolloNormalized(root);
  assert.equal(rows.length, 2);
  const refreshed = rows.find((row) => row.source_id === 'x');
  assert.equal(refreshed.ingredients[0].molecule, 'new');
  assert.equal(refreshed.first_seen, '2026-07-01');
  assert.equal(rows.find((row) => row.source_id === 'y').ingredients[0].molecule, 'other');
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: parser anomaly is quarantined while later products and salts continue', async () => {
  const root = 'test/.tmp-apollo-quarantine';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const outFile = `${root}/normalized.jsonl`;
  const invalidated = [];
  const pf = withProductResponseMetadata({
    state: { apollo: {} },
    get: async (requestPath) => {
      if (requestPath === '/salt/first') {
        return '<a href="/medicine/bad-product">Bad</a><a href="/medicine/first-good">Good</a>';
      }
      if (requestPath === '/salt/second') {
        return '<a href="/medicine/second-good">Good</a>';
      }
      if (requestPath === '/medicine/bad-product') return '<html>parser drift</html>';
      return medHtml;
    },
    invalidate: async (requestPath) => invalidated.push(requestPath),
    persist: async () => {},
  });

  const result = await runApolloIndex({
    pf,
    salts: ['/salt/first', '/salt/second'],
    outFile,
    date: '2026-07-31',
    parserFingerprint: 'parser-v1',
    log: () => {},
  });

  assert.equal(result.products, 2);
  assert.equal(result.checkedSalts, 2);
  assert.equal(result.quarantined, 1);
  assert.deepEqual(pf.state.apollo.quarantine.map((entry) => ({
    kind: entry.kind,
    path: entry.path,
    productId: entry.productId,
    reason: entry.reason,
    parser: entry.parser,
  })), [{
    kind: 'product',
    path: '/medicine/bad-product',
    productId: 'bad-product',
    reason: 'parser_anomaly',
    parser: 'parser-v1',
  }]);
  assert.deepEqual(invalidated, ['/medicine/bad-product']);
  assert.deepEqual(
    fs.readFileSync(outFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line).source_id),
    ['first-good', 'second-good'],
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: parser upgrade retries quarantined products without duplicating completed rows', async () => {
  const root = 'test/.tmp-apollo-quarantine-retry';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const outFile = `${root}/normalized.jsonl`;
  const state = {
    apollo: {
      quarantine: [{
        kind: 'product',
        path: '/medicine/recovered-product',
        saltPath: '/salt/first',
        reason: 'parser_anomaly',
        parser: 'parser-v1',
      }],
    },
  };
  const calls = [];
  const pf = withProductResponseMetadata({
    state,
    get: async (requestPath) => {
      calls.push(requestPath);
      if (requestPath === '/salt/first') {
        return '<a href="/medicine/already-seen">Seen</a><a href="/medicine/recovered-product">Recovered</a>';
      }
      return medHtml;
    },
    invalidate: async () => {},
    persist: async () => {},
  });

  const result = await runApolloIndex({
    pf,
    salts: ['/salt/first'],
    outFile,
    date: '2026-08-01',
    seen: new Set(['already-seen']),
    parserFingerprint: 'parser-v2',
    now: () => Date.parse('2026-08-01T00:00:00.000Z'),
    log: () => {},
  });

  assert.equal(result.products, 1);
  assert.equal(result.quarantined, 0);
  assert.equal(state.apollo.saltChecks['/salt/first'], '2026-08-01T00:00:00.000Z');
  assert.deepEqual(calls, ['/salt/first', '/medicine/recovered-product']);
  assert.equal(JSON.parse(fs.readFileSync(outFile, 'utf8').trim()).source_id, 'recovered-product');
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: isolated fetch failure is quarantined without blocking later products', async () => {
  const root = 'test/.tmp-apollo-fetch-quarantine';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const outFile = `${root}/normalized.jsonl`;
  const pf = withProductResponseMetadata({
    state: { apollo: {} },
    get: async (requestPath) => {
      if (requestPath === '/salt/first') {
        return '<a href="/medicine/fetch-failure">Bad</a><a href="/medicine/good-product">Good</a>';
      }
      if (requestPath === '/medicine/fetch-failure') throw new TypeError('fetch failed');
      return medHtml;
    },
    invalidate: async () => {},
    persist: async () => {},
  });

  const result = await runApolloIndex({
    pf,
    salts: ['/salt/first'],
    outFile,
    date: '2026-07-31',
    parserFingerprint: 'parser-v1',
    log: () => {},
  });

  assert.equal(result.products, 1);
  assert.equal(result.quarantined, 1);
  assert.equal(pf.state.apollo.quarantine[0].reason, 'fetch_error');
  assert.equal(JSON.parse(fs.readFileSync(outFile, 'utf8').trim()).source_id, 'good-product');
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: empty salt page is quarantined while the next salt proceeds', async () => {
  const root = 'test/.tmp-apollo-salt-quarantine';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const outFile = `${root}/normalized.jsonl`;
  const invalidated = [];
  const pf = withProductResponseMetadata({
    state: { apollo: {} },
    get: async (requestPath) => requestPath === '/salt/empty'
      ? '<html>changed layout</html>'
      : requestPath === '/salt/good'
        ? '<a href="/medicine/good-product">Good</a>'
        : medHtml,
    invalidate: async (requestPath) => invalidated.push(requestPath),
    persist: async () => {},
  });

  const result = await runApolloIndex({
    pf,
    salts: ['/salt/empty', '/salt/good'],
    outFile,
    date: '2026-07-31',
    parserFingerprint: 'parser-v1',
    log: () => {},
  });

  assert.equal(result.products, 1);
  assert.equal(result.checkedSalts, 1);
  assert.deepEqual(pf.state.apollo.quarantine.map(({ kind, path, reason }) => ({ kind, path, reason })), [{
    kind: 'salt',
    path: '/salt/empty',
    reason: 'parser_anomaly',
  }]);
  assert.deepEqual(invalidated, ['/salt/empty']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: block signal aborts immediately and is never quarantined', async () => {
  const pf = {
    state: { apollo: {} },
    get: async () => { throw new BlockedError('aborting after 3 consecutive 429 responses'); },
    invalidate: async () => {},
    persist: async () => {},
  };

  await assert.rejects(runApolloIndex({
    pf,
    salts: ['/salt/blocked'],
    outFile: 'unused',
    date: '2026-07-31',
    parserFingerprint: 'parser-v1',
    log: () => {},
  }), BlockedError);
  assert.deepEqual(pf.state.apollo.quarantine, []);
  assert.deepEqual(pf.state.apollo.saltChecks, {});
});

test('runApolloIndex: typed 404 is timestamped and withheld until revalidation is due', async () => {
  const root = 'test/.tmp-apollo-not-found';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const calls = [];
  const pf = withProductResponseMetadata({
    state: { apollo: {} },
    get: async (requestPath) => {
      calls.push(requestPath);
      if (requestPath === '/salt/example') return '<a href="/medicine/gone">Gone</a>';
      throw new HttpStatusError(404, requestPath);
    },
    invalidate: async () => {},
    persist: async () => {},
  });
  const checkedAt = Date.parse('2026-07-31T00:00:00.000Z');

  const result = await runApolloIndex({
    pf,
    salts: ['/salt/example'],
    outFile: `${root}/normalized.jsonl`,
    date: '2026-07-31',
    parserFingerprint: 'parser-v1',
    now: () => checkedAt,
    log: () => {},
  });

  assert.equal(result.products, 0);
  assert.equal(result.quarantined, 0);
  assert.equal(result.notFound, 1);
  assert.deepEqual(pf.state.apollo.tombstones, []);
  assert.deepEqual(pf.state.apollo.products.pathOutcomes, [{
    productId: 'gone',
    path: '/medicine/gone',
    status: 'not_found',
    checkedAt: '2026-07-31T00:00:00.000Z',
    retryAt: '2026-08-30T00:00:00.000Z',
  }]);

  await runApolloIndex({
    pf,
    salts: ['/salt/example'],
    outFile: `${root}/normalized.jsonl`,
    date: '2026-08-01',
    parserFingerprint: 'parser-v1',
    now: () => Date.parse('2026-08-01T00:00:00.000Z'),
    log: () => {},
  });
  assert.equal(calls.filter((requestPath) => requestPath === '/medicine/gone').length, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: typed 410 is permanently gone and never fetched again', async () => {
  const root = 'test/.tmp-apollo-gone';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const calls = [];
  const pf = withProductResponseMetadata({
    state: { apollo: {} },
    get: async (requestPath) => {
      calls.push(requestPath);
      if (requestPath === '/salt/example') return '<a href="/medicine/gone">Gone</a>';
      throw new HttpStatusError(410, requestPath);
    },
    invalidate: async () => {},
    persist: async () => {},
  });
  await runApolloIndex({
    pf,
    salts: ['/salt/example'],
    outFile: `${root}/normalized.jsonl`,
    date: '2026-07-31',
    parserFingerprint: 'parser-v1',
    now: () => Date.parse('2026-07-31T00:00:00.000Z'),
    log: () => {},
  });
  assert.deepEqual(pf.state.apollo.tombstones, ['product:/medicine/gone']);
  assert.equal(pf.state.apollo.products.pathOutcomes[0].status, 'gone');

  await runApolloIndex({
    pf,
    salts: ['/salt/example'],
    outFile: `${root}/normalized.jsonl`,
    date: '2026-09-01',
    parserFingerprint: 'parser-v1',
    now: () => Date.parse('2026-09-01T00:00:00.000Z'),
    log: () => {},
  });
  assert.equal(calls.filter((requestPath) => requestPath === '/medicine/gone').length, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: repeated fetch failures stop after a bounded source probe', async () => {
  const pf = withProductResponseMetadata({
    state: { apollo: {} },
    get: async (requestPath) => requestPath === '/salt/example'
      ? [
        '<a href="/medicine/failure-1">1</a>',
        '<a href="/medicine/failure-2">2</a>',
        '<a href="/medicine/failure-3">3</a>',
        '<a href="/medicine/failure-4">4</a>',
      ].join('')
      : Promise.reject(new TypeError('fetch failed')),
    invalidate: async () => {},
    persist: async () => {},
  });

  await assert.rejects(runApolloIndex({
    pf,
    salts: ['/salt/example'],
    outFile: 'unused',
    date: '2026-07-31',
    parserFingerprint: 'parser-v1',
    maxConsecutiveFetchFailures: 3,
    log: () => {},
  }), /fetch failed/);
  assert.equal(pf.state.apollo.quarantine.length, 3);
  assert.equal(pf.state.apollo.saltChecks['/salt/example'] !== undefined, true);
});

test('runApolloIndex: three consecutive product parser anomalies exit 4 and remain retryable', async () => {
  const root = 'test/.tmp-apollo-systemic-parser';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const productPaths = [
    '/medicine/invalid-product-one',
    '/medicine/invalid-product-two',
    FIXTURE_PRODUCT_PATH,
  ];
  const calls = [];
  let recovered = false;
  const pf = {
    state: { apollo: { productPaths } },
    get: async () => assert.fail('product identity fetches must request response metadata'),
    getWithMetadata: async (requestPath, options) => {
      calls.push([requestPath, options]);
      return {
        body: recovered ? productHtmlFor(requestPath) : '<html>systemic parser drift</html>',
        responseUrl: `${APOLLO_ORIGIN}${requestPath}`,
      };
    },
    invalidate: async () => {},
    persist: async () => {},
  };
  const run = () => runApolloIndex({
    pf,
    salts: [],
    allSalts: [],
    outFile: `${root}/normalized.jsonl`,
    date: '2026-08-06',
    parserFingerprint: 'parser-v1',
    maxConsecutiveParserAnomalies: 3,
    log: () => {},
  });

  await assert.rejects(
    run(),
    (error) => error instanceof ApolloParserAnomalyError
      && error.code === 'DISCOVERY_ANOMALY'
      && error.requestPath === FIXTURE_PRODUCT_PATH,
  );
  assert.deepEqual(calls.map(([requestPath]) => requestPath), productPaths);
  assert.ok(calls.every(([, options]) => options?.fresh === true));
  assert.deepEqual(pf.state.apollo.quarantine.map((entry) => entry.path), productPaths.slice(0, 2));

  calls.length = 0;
  await assert.rejects(run(), ApolloParserAnomalyError);
  assert.deepEqual(
    calls.map(([requestPath]) => requestPath),
    [FIXTURE_PRODUCT_PATH],
    'the threshold product must remain fetchable on the next run',
  );

  calls.length = 0;
  recovered = true;
  const result = await run();
  assert.equal(result.status, 'completed');
  assert.equal(result.products, 1);
  assert.deepEqual(calls.map(([requestPath]) => requestPath), [FIXTURE_PRODUCT_PATH]);
  assert.equal(JSON.parse(fs.readFileSync(`${root}/normalized.jsonl`, 'utf8')).source_id, 'elmox-cv-625mg-tablet');
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: redirected and wrong JSON-LD products are quarantined without binding source_id', async () => {
  const cases = [
    {
      label: 'redirected response',
      responseUrl: `${APOLLO_ORIGIN}/medicine/a-different-product`,
      html: medHtml,
    },
    {
      label: 'wrong JSON-LD identity',
      responseUrl: `${APOLLO_ORIGIN}${FIXTURE_PRODUCT_PATH}`,
      html: productHtmlFor('/medicine/a-different-product'),
    },
    {
      label: 'foreign response host',
      responseUrl: `https://example.invalid${FIXTURE_PRODUCT_PATH}`,
      html: medHtml,
    },
  ];
  for (const scenario of cases) {
    const root = `test/.tmp-apollo-identity-${scenario.label.replaceAll(' ', '-')}`;
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    const invalidated = [];
    const pf = {
      state: { apollo: { productPaths: [FIXTURE_PRODUCT_PATH] } },
      get: async () => assert.fail('product identity fetches must request response metadata'),
      getWithMetadata: async (_requestPath, options) => {
        assert.equal(options?.fresh, true);
        return { body: scenario.html, responseUrl: scenario.responseUrl };
      },
      invalidate: async (requestPath) => invalidated.push(requestPath),
      persist: async () => {},
    };

    const result = await runApolloIndex({
      pf,
      salts: [],
      allSalts: [],
      outFile: `${root}/normalized.jsonl`,
      date: '2026-08-06',
      parserFingerprint: 'parser-v1',
      log: () => {},
    });
    assert.equal(result.status, 'no_work');
    assert.equal(result.products, 0);
    assert.deepEqual(pf.state.apollo.quarantine.map((entry) => entry.path), [FIXTURE_PRODUCT_PATH]);
    assert.deepEqual(invalidated, [FIXTURE_PRODUCT_PATH]);
    assert.equal(fs.existsSync(`${root}/normalized.jsonl`), false);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('refreshSaltIndex: appends only newly discovered salts', async () => {
  const root = 'test/.tmp-apollo-refresh';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const saltIndexFile = `${root}/salt-index.jsonl`;
  fs.writeFileSync(saltIndexFile, JSON.stringify({ path: '/salt/existing' }) + '\n');
  const calls = [];
  const pf = {
    get: async (requestPath, options) => {
      calls.push([requestPath, options]);
      return '<a href="/salt/existing">Existing</a><a href="/salt/new">New</a>';
    },
  };

  assert.equal(await refreshSaltIndex({ pf, saltIndexFile, log: () => {} }), 1);
  assert.deepEqual(calls, [[
    '/salts',
    { fresh: true },
  ]]);
  assert.deepEqual(
    fs.readFileSync(saltIndexFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line).path),
    ['/salt/existing', '/salt/new'],
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('refreshSaltIndex: transient directory failure preserves the existing index', async () => {
  const root = 'test/.tmp-apollo-refresh-failure';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const saltIndexFile = `${root}/salt-index.jsonl`;
  const original = JSON.stringify({ path: '/salt/existing' }) + '\n';
  fs.writeFileSync(saltIndexFile, original);

  assert.equal(await refreshSaltIndex({
    pf: { get: async () => { throw new TypeError('fetch failed'); } },
    saltIndexFile,
    log: () => {},
  }), 0);
  assert.equal(fs.readFileSync(saltIndexFile, 'utf8'), original);
  fs.rmSync(root, { recursive: true, force: true });
});
