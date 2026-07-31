import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseApolloComposition, parseApolloProduct, parseApolloSaltPage,
  parseApolloSaltDirectory, readApolloNormalized,
} from '../../src/adapters/apollo.mjs';
import { refreshSaltIndex, runApolloIndex } from '../../src/cli/apollo.mjs';
import { BlockedError, HttpStatusError } from '../../src/lib/politeness.mjs';

const medHtml = fs.readFileSync('test/fixtures/apollo/medicine_elmox.html', 'utf8');
const saltHtml = fs.readFileSync('test/fixtures/apollo/salt_amox_clav.html', 'utf8');

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

test('readApolloNormalized: reads normalized rows, last write per identity wins', () => {
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
  const rows = readApolloNormalized(root);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ingredients[0].molecule, 'new'); // later date wins
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: parser anomaly is quarantined while later products and salts continue', async () => {
  const root = 'test/.tmp-apollo-quarantine';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const outFile = `${root}/normalized.jsonl`;
  const pf = {
    state: { apollo: { saltCursor: 0 } },
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
    cachePath: (requestPath) => `${root}/${requestPath.split('/').pop()}.html`,
    persist: async () => {},
  };

  const result = await runApolloIndex({
    pf,
    salts: ['/salt/first', '/salt/second'],
    outFile,
    date: '2026-07-31',
    parserFingerprint: 'parser-v1',
    log: () => {},
  });

  assert.equal(result.products, 2);
  assert.equal(result.saltCursor, 2);
  assert.equal(result.quarantined, 1);
  assert.deepEqual(pf.state.apollo.quarantine, [{
    kind: 'product',
    path: '/medicine/bad-product',
    saltPath: '/salt/first',
    saltIndex: 0,
    reason: 'parser_anomaly',
    parser: 'parser-v1',
  }]);
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
      saltCursor: 1,
      quarantine: [{
        kind: 'product',
        path: '/medicine/recovered-product',
        saltPath: '/salt/first',
        saltIndex: 0,
        reason: 'parser_anomaly',
        parser: 'parser-v1',
      }],
    },
  };
  const calls = [];
  const pf = {
    state,
    get: async (requestPath) => {
      calls.push(requestPath);
      if (requestPath === '/salt/first') {
        return '<a href="/medicine/already-seen">Seen</a><a href="/medicine/recovered-product">Recovered</a>';
      }
      return medHtml;
    },
    cachePath: (requestPath) => `${root}/${requestPath.split('/').pop()}.html`,
    persist: async () => {},
  };

  const result = await runApolloIndex({
    pf,
    salts: ['/salt/first'],
    outFile,
    date: '2026-08-01',
    seen: new Set(['already-seen']),
    parserFingerprint: 'parser-v2',
    log: () => {},
  });

  assert.equal(result.products, 1);
  assert.equal(result.quarantined, 0);
  assert.equal(state.apollo.saltCursor, 1);
  assert.deepEqual(calls, ['/salt/first', '/medicine/recovered-product']);
  assert.equal(JSON.parse(fs.readFileSync(outFile, 'utf8').trim()).source_id, 'recovered-product');
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: isolated fetch failure is quarantined without blocking later products', async () => {
  const root = 'test/.tmp-apollo-fetch-quarantine';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const outFile = `${root}/normalized.jsonl`;
  const pf = {
    state: { apollo: { saltCursor: 0 } },
    get: async (requestPath) => {
      if (requestPath === '/salt/first') {
        return '<a href="/medicine/fetch-failure">Bad</a><a href="/medicine/good-product">Good</a>';
      }
      if (requestPath === '/medicine/fetch-failure') throw new TypeError('fetch failed');
      return medHtml;
    },
    cachePath: (requestPath) => `${root}/${requestPath.split('/').pop()}.html`,
    persist: async () => {},
  };

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
  const pf = {
    state: { apollo: { saltCursor: 0 } },
    get: async (requestPath) => requestPath === '/salt/empty'
      ? '<html>changed layout</html>'
      : requestPath === '/salt/good'
        ? '<a href="/medicine/good-product">Good</a>'
        : medHtml,
    cachePath: (requestPath) => `${root}/${requestPath.split('/').pop()}.html`,
    persist: async () => {},
  };

  const result = await runApolloIndex({
    pf,
    salts: ['/salt/empty', '/salt/good'],
    outFile,
    date: '2026-07-31',
    parserFingerprint: 'parser-v1',
    log: () => {},
  });

  assert.equal(result.products, 1);
  assert.equal(result.saltCursor, 2);
  assert.deepEqual(pf.state.apollo.quarantine.map(({ kind, path, reason }) => ({ kind, path, reason })), [{
    kind: 'salt',
    path: '/salt/empty',
    reason: 'parser_anomaly',
  }]);
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: block signal aborts immediately and is never quarantined', async () => {
  const pf = {
    state: { apollo: { saltCursor: 0 } },
    get: async () => { throw new BlockedError('aborting after 3 consecutive 429 responses'); },
    cachePath: () => 'unused',
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
  assert.equal(pf.state.apollo.saltCursor, 0);
});

test('runApolloIndex: typed permanent product absence is tombstoned rather than quarantined', async () => {
  const root = 'test/.tmp-apollo-tombstone';
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const pf = {
    state: { apollo: { saltCursor: 0 } },
    get: async (requestPath) => {
      if (requestPath === '/salt/example') return '<a href="/medicine/gone">Gone</a>';
      throw new HttpStatusError(404, requestPath);
    },
    cachePath: () => 'unused',
    persist: async () => {},
  };

  const result = await runApolloIndex({
    pf,
    salts: ['/salt/example'],
    outFile: `${root}/normalized.jsonl`,
    date: '2026-07-31',
    parserFingerprint: 'parser-v1',
    log: () => {},
  });

  assert.equal(result.products, 0);
  assert.equal(result.quarantined, 0);
  assert.deepEqual(pf.state.apollo.tombstones, ['product:/medicine/gone']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('runApolloIndex: repeated fetch failures stop after a bounded source probe', async () => {
  const pf = {
    state: { apollo: { saltCursor: 0 } },
    get: async (requestPath) => requestPath === '/salt/example'
      ? [
        '<a href="/medicine/failure-1">1</a>',
        '<a href="/medicine/failure-2">2</a>',
        '<a href="/medicine/failure-3">3</a>',
        '<a href="/medicine/failure-4">4</a>',
      ].join('')
      : Promise.reject(new TypeError('fetch failed')),
    cachePath: () => 'unused',
    persist: async () => {},
  };

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
  assert.equal(pf.state.apollo.saltCursor, 0);
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
