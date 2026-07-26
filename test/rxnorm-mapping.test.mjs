import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createRxNormClient,
  proposeRxNormIngredientMapping,
} from '../src/lib/rxnorm-mapping.mjs';

const tempRoots = new Set();

async function tempDir() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aushadhi-rxnorm-'));
  tempRoots.add(root);
  return root;
}

test.after(async () => {
  await Promise.all([...tempRoots].map((root) => fs.rm(root, { recursive: true, force: true })));
});

function response(url, payload, { status = 200, finalUrl = url } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: finalUrl,
    async text() {
      return JSON.stringify(payload);
    },
  };
}

function fixtureFetch({ exact = [], normalized = [], properties = {}, unii = {} } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const parsed = new URL(url);
    if (parsed.pathname === '/REST/version.json') {
      return response(url, { version: '06-Jul-2026', apiVersion: '3.1.353' });
    }
    if (parsed.pathname === '/REST/rxcui.json') {
      const ids = parsed.searchParams.get('search') === '0' ? exact : normalized;
      return response(url, { idGroup: { rxnormId: ids } });
    }
    const propertiesMatch = parsed.pathname.match(/^\/REST\/rxcui\/([0-9]+)\/properties\.json$/u);
    if (propertiesMatch) {
      return response(url, { properties: properties[propertiesMatch[1]] });
    }
    const uniiMatch = parsed.pathname.match(
      /^\/REST\/Prescribe\/rxcui\/([0-9]+)\/property\.json$/u,
    );
    if (uniiMatch) {
      return response(url, {
        propConceptGroup: {
          propConcept: (unii[uniiMatch[1]] ?? []).map((code) => ({
            propName: 'UNII_CODE',
            propValue: code,
          })),
        },
      });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  return { calls, fetchImpl };
}

test('an exact single IN result remains an unaccepted reviewed mapping candidate', async () => {
  const fixture = fixtureFetch({
    exact: ['123'],
    properties: {
      123: {
        rxcui: '123',
        name: 'Ketoconazole',
        synonym: '',
        tty: 'IN',
      },
    },
    unii: { 123: ['R9400W927I'] },
  });
  const client = createRxNormClient({
    fetchImpl: fixture.fetchImpl,
    maxRetries: 0,
  });
  const candidate = await proposeRxNormIngredientMapping({
    ingredient: { observed_name: 'Ketoconazole' },
    client,
    retrievedAt: '2026-07-26',
  });

  assert.equal(candidate.review_status, 'review_candidate');
  assert.equal(candidate.search.match_type, 'exact');
  assert.equal(candidate.search.status, 'exact_single_candidate');
  assert.equal(candidate.search.rxnorm_version, '06-Jul-2026');
  assert.equal(candidate.search.rxnorm_api_version, '3.1.353');
  assert.equal(candidate.candidates.length, 1);
  assert.deepEqual(candidate.candidates[0], {
    rxcui: '123',
    name: 'Ketoconazole',
    tty: 'IN',
    synonym: null,
    response_sha256: candidate.candidates[0].response_sha256,
    source_url: candidate.candidates[0].source_url,
  });
  assert.deepEqual(candidate.unii.codes, ['R9400W927I']);
  assert.equal(candidate.accepted_mapping, null);
  assert.equal(fixture.calls.length, 4);
  assert.ok(fixture.calls[1].includes('search=0'));
});

test('normalized matches are candidates only and never trigger UNII acceptance lookup', async () => {
  const fixture = fixtureFetch({
    exact: [],
    normalized: ['456'],
    properties: {
      456: {
        rxcui: '456',
        name: 'Metformin',
        synonym: 'Metformin hydrochloride',
        tty: 'IN',
      },
    },
  });
  const candidate = await proposeRxNormIngredientMapping({
    ingredient: { observed_name: 'Metformin Hydrochloride' },
    client: createRxNormClient({ fetchImpl: fixture.fetchImpl, maxRetries: 0 }),
    retrievedAt: '2026-07-26',
  });

  assert.equal(candidate.search.match_type, 'normalized');
  assert.equal(candidate.search.status, 'normalized_review_candidate');
  assert.equal(candidate.unii, null);
  assert.equal(candidate.accepted_mapping, null);
  assert.equal(fixture.calls.length, 4);
  assert.ok(fixture.calls.every((url) => !url.includes('/Prescribe/')));
});

test('non-ingredient RxNorm term types fail closed', async () => {
  const fixture = fixtureFetch({
    exact: ['789'],
    properties: {
      789: {
        rxcui: '789',
        name: 'Example 10 MG Oral Tablet',
        synonym: '',
        tty: 'SCD',
      },
    },
  });
  const candidate = await proposeRxNormIngredientMapping({
    ingredient: { observed_name: 'Example 10 MG Oral Tablet' },
    client: createRxNormClient({ fetchImpl: fixture.fetchImpl, maxRetries: 0 }),
    retrievedAt: '2026-07-26',
  });

  assert.equal(candidate.search.status, 'unexpected_term_type');
  assert.equal(candidate.accepted_mapping, null);
  assert.equal(candidate.unii, null);
});

test('ambiguous exact results are preserved for review and not auto-selected', async () => {
  const fixture = fixtureFetch({
    exact: ['100', '200'],
    properties: {
      100: { rxcui: '100', name: 'Example A', synonym: '', tty: 'IN' },
      200: { rxcui: '200', name: 'Example B', synonym: '', tty: 'PIN' },
    },
  });
  const candidate = await proposeRxNormIngredientMapping({
    ingredient: { observed_name: 'Example' },
    client: createRxNormClient({ fetchImpl: fixture.fetchImpl, maxRetries: 0 }),
    retrievedAt: '2026-07-26',
  });

  assert.equal(candidate.search.status, 'ambiguous');
  assert.deepEqual(candidate.candidates.map((entry) => entry.rxcui), ['100', '200']);
  assert.equal(candidate.accepted_mapping, null);
  assert.equal(candidate.unii, null);
});

test('successful responses are persistently cached with exact byte binding', async () => {
  const root = await tempDir();
  const fixture = fixtureFetch({
    exact: ['321'],
    properties: {
      321: { rxcui: '321', name: 'Warfarin', synonym: '', tty: 'IN' },
    },
    unii: { 321: ['5Q7ZVV76EI'] },
  });
  const firstClient = createRxNormClient({
    fetchImpl: fixture.fetchImpl,
    cacheDir: root,
    maxRetries: 0,
  });
  await proposeRxNormIngredientMapping({
    ingredient: { observed_name: 'Warfarin' },
    client: firstClient,
    retrievedAt: '2026-07-26',
  });
  assert.equal(fixture.calls.length, 4);

  const secondClient = createRxNormClient({
    fetchImpl: async () => {
      throw new Error('network must not be called on a cache hit');
    },
    cacheDir: root,
    maxRetries: 0,
  });
  const cached = await proposeRxNormIngredientMapping({
    ingredient: { observed_name: 'Warfarin' },
    client: secondClient,
    retrievedAt: '2026-07-26',
  });
  assert.equal(cached.search.status, 'exact_single_candidate');
  assert.equal((await fs.readdir(root)).length, 4);
});

test('operational failures are retried but never cached as unmapped', async () => {
  const root = await tempDir();
  let attempts = 0;
  const failing = createRxNormClient({
    cacheDir: root,
    maxRetries: 1,
    retryDelayMs: 1,
    sleep: async () => {},
    fetchImpl: async (url) => {
      attempts += 1;
      return response(url, { error: 'temporary' }, { status: 503 });
    },
  });
  await assert.rejects(
    failing.requestJson('https://rxnav.nlm.nih.gov/REST/rxcui.json?name=warfarin&search=0'),
    /HTTP 503/i,
  );
  assert.equal(attempts, 2);
  assert.deepEqual(await fs.readdir(root), []);

  const success = createRxNormClient({
    cacheDir: root,
    maxRetries: 0,
    fetchImpl: async (url) => response(url, { idGroup: { rxnormId: [] } }),
  });
  const result = await success.requestJson(
    'https://rxnav.nlm.nih.gov/REST/rxcui.json?name=warfarin&search=0',
  );
  assert.equal(result.cache_status, 'miss');
  assert.equal((await fs.readdir(root)).length, 1);
});

test('the client rejects non-RxNorm origins and foreign redirects', async () => {
  let redirectMode;
  const client = createRxNormClient({
    maxRetries: 0,
    fetchImpl: async (url, options) => {
      redirectMode = options.redirect;
      return response(
        url,
        { idGroup: {} },
        { finalUrl: 'https://example.test/REST/rxcui.json' },
      );
    },
  });
  await assert.rejects(
    client.requestJson('https://example.test/REST/rxcui.json'),
    /non-allowlisted URL/i,
  );
  await assert.rejects(
    client.requestJson('https://rxnav.nlm.nih.gov/REST/rxcui.json'),
    /redirected outside/i,
  );
  assert.equal(redirectMode, 'manual');
});
