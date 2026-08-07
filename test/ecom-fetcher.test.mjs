import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeEcomFetcher } from '../src/lib/ecom-fetcher.mjs';
import { makeOnemgFetcher } from '../src/lib/onemg-fetcher.mjs';
import { PoliteFetcher } from '../src/lib/politeness.mjs';

// Direct unit tests pinning the EXISTING configuration wiring of the fetcher
// factories. Constructing a PoliteFetcher performs no I/O and no network, so
// these tests only assert how the factories compose their configuration.

const PKG_VERSION = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

const CAP_VARS = ['AUSHADHI_APOLLO_CAP', 'AUSHADHI_NETMEDS_CAP', 'AUSHADHI_DAILY_CAP'];

function withEnv(overrides, run) {
  const saved = new Map(CAP_VARS.map((name) => [name, process.env[name]]));
  for (const name of CAP_VARS) delete process.env[name];
  for (const [name, value] of Object.entries(overrides)) process.env[name] = value;
  try {
    return run();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('makeEcomFetcher wires per-source cache, state, base URL, and user agent', () => {
  withEnv({}, () => {
    const pf = makeEcomFetcher('data/raw', 'apollo', 'https://www.apollopharmacy.in');
    assert.ok(pf instanceof PoliteFetcher);
    assert.equal(pf.baseUrl, 'https://www.apollopharmacy.in');
    assert.equal(pf.cacheDir, path.join('data/raw', 'apollo', 'pages'));
    assert.equal(pf.stateFile, path.join('data/raw', 'apollo', 'state.json'));
    assert.equal(pf.userAgent, `aushadhi-dataset-builder/${PKG_VERSION} (contact: safari-oil-shelve@duck.com)`);
    // Politeness spacing is fixed; only the daily cap is env-tunable.
    assert.equal(pf.minDelayMs, 2500);
    assert.equal(pf.dailyCap, 5000);
  });
});

test('sources get independent state roots so crawls cannot collide', () => {
  withEnv({}, () => {
    const apollo = makeEcomFetcher('data/raw', 'apollo', 'https://a.example');
    const netmeds = makeEcomFetcher('data/raw', 'netmeds', 'https://n.example');
    assert.notEqual(apollo.cacheDir, netmeds.cacheDir);
    assert.notEqual(apollo.stateFile, netmeds.stateFile);
  });
});

test('per-source cap env wins and only positive finite values apply', () => {
  withEnv({ AUSHADHI_APOLLO_CAP: '123' }, () => {
    assert.equal(makeEcomFetcher('data/raw', 'apollo', 'https://a.example').dailyCap, 123);
  });
  withEnv({ AUSHADHI_APOLLO_CAP: '123', AUSHADHI_DAILY_CAP: '999' }, () => {
    assert.equal(makeEcomFetcher('data/raw', 'apollo', 'https://a.example').dailyCap, 123);
  });
  withEnv({ AUSHADHI_DAILY_CAP: '777' }, () => {
    assert.equal(makeEcomFetcher('data/raw', 'apollo', 'https://a.example').dailyCap, 777);
  });
  for (const invalid of ['0', '-5', 'abc', '']) {
    withEnv({ AUSHADHI_APOLLO_CAP: invalid }, () => {
      assert.equal(
        makeEcomFetcher('data/raw', 'apollo', 'https://a.example').dailyCap,
        5000,
        `cap ${JSON.stringify(invalid)} must fall back to the default`,
      );
    });
  }
});

test('makeOnemgFetcher pins the 1mg identity and honours the daily cap env', () => {
  withEnv({}, () => {
    const pf = makeOnemgFetcher();
    assert.ok(pf instanceof PoliteFetcher);
    assert.equal(pf.baseUrl, 'https://www.1mg.com');
    assert.equal(pf.cacheDir, path.join('data/raw', 'onemg', 'pages'));
    assert.equal(pf.stateFile, path.join('data/raw', 'onemg', 'state.json'));
    assert.equal(pf.userAgent, `aushadhi-dataset-builder/${PKG_VERSION} (contact: safari-oil-shelve@duck.com)`);
    assert.equal(pf.dailyCap, 5000);
  });
  withEnv({ AUSHADHI_DAILY_CAP: '42' }, () => {
    assert.equal(makeOnemgFetcher().dailyCap, 42);
  });
  withEnv({}, () => {
    const pf = makeOnemgFetcher('/custom/raw');
    assert.equal(pf.cacheDir, path.join('/custom/raw', 'onemg', 'pages'));
    assert.equal(pf.stateFile, path.join('/custom/raw', 'onemg', 'state.json'));
  });
});
