import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BlockedError, CapReachedError } from '../lib/politeness.mjs';
import { makeEcomFetcher } from '../lib/ecom-fetcher.mjs';
import { parseApolloSaltDirectory, parseApolloSaltPage, parseApolloProduct } from '../adapters/apollo.mjs';
import { readJsonlSync } from '../lib/jsonl.mjs';
import { fetchIndexedProduct, skipIfPermanentlyMissing } from '../lib/product-failure-policy.mjs';
import { ctx } from '../lib/context.mjs';

const SALTS_URL = '/salts';
const isStop = (e) => e instanceof BlockedError || e instanceof CapReachedError || /robots/i.test(e?.message ?? '');

export class ApolloParserAnomalyError extends Error {
  constructor(productPath) {
    super(`parser anomaly for indexed Apollo page ${productPath}`);
    this.name = 'ApolloParserAnomalyError';
    this.productPath = productPath;
  }
}

function normalizeProgressState(state, salts) {
  if (!Number.isInteger(state.saltCursor) || state.saltCursor < 0) state.saltCursor = 0;
  if (state.saltCursor > salts.length) state.saltCursor = salts.length;

  const seen = new Set();
  state.quarantine = (Array.isArray(state.quarantine) ? state.quarantine : []).flatMap((entry) => {
    if (!['product', 'salt'].includes(entry?.kind) || typeof entry.path !== 'string') return [];
    if (!['parser_anomaly', 'fetch_error'].includes(entry.reason)) return [];
    const saltPath = entry.kind === 'salt' ? entry.path : entry.saltPath;
    const saltIndex = salts.indexOf(saltPath);
    if (saltIndex < 0) return [];
    const key = `${entry.kind}:${entry.path}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      kind: entry.kind,
      path: entry.path,
      saltPath,
      saltIndex,
      reason: entry.reason,
      parser: entry.reason === 'parser_anomaly' && typeof entry.parser === 'string'
        ? entry.parser : null,
    }];
  });
  state.tombstones = [...new Set((Array.isArray(state.tombstones) ? state.tombstones : [])
    .filter((entry) => typeof entry === 'string'))];
}

function quarantineKey(kind, requestPath) {
  return `${kind}:${requestPath}`;
}

function quarantineMap(state) {
  return new Map(state.quarantine.map((entry) => [quarantineKey(entry.kind, entry.path), entry]));
}

function prepareQuarantineRetries(state, salts, parserFingerprint) {
  const passComplete = state.saltCursor >= salts.length;
  let rewindTo = state.saltCursor;
  state.quarantine = state.quarantine.filter((entry) => {
    const retry = (entry.reason === 'parser_anomaly' && entry.parser !== parserFingerprint)
      || (entry.reason === 'fetch_error' && passComplete);
    if (!retry) return true;
    rewindTo = Math.min(rewindTo, entry.saltIndex);
    return false;
  });
  state.saltCursor = rewindTo;
}

function recordQuarantine(state, entries, {
  kind, requestPath, saltPath, saltIndex, reason, parserFingerprint,
}) {
  const entry = {
    kind,
    path: requestPath,
    saltPath,
    saltIndex,
    reason,
    parser: reason === 'parser_anomaly' ? parserFingerprint : null,
  };
  const key = quarantineKey(kind, requestPath);
  const index = state.quarantine.findIndex((candidate) => quarantineKey(candidate.kind, candidate.path) === key);
  if (index >= 0) state.quarantine[index] = entry;
  else state.quarantine.push(entry);
  entries.set(key, entry);
}

function recordTombstone(state, kind, requestPath) {
  const key = quarantineKey(kind, requestPath);
  if (!state.tombstones.includes(key)) state.tombstones.push(key);
}

function isTombstoned(state, kind, requestPath) {
  return state.tombstones.includes(quarantineKey(kind, requestPath));
}

function isPermanentlyMissing(error) {
  try {
    return skipIfPermanentlyMissing(error);
  } catch {
    return false;
  }
}

export function apolloParserFingerprint() {
  return createHash('sha256')
    .update(fs.readFileSync(new URL('./apollo.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('../adapters/apollo.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('../lib/normalize.mjs', import.meta.url)))
    .digest('hex');
}

// Resumable Apollo crawl: /salts -> salt pages -> product pages -> normalized rows.
// One salt page yields the brands sharing that composition; each product page's
// Drug ld+json gives the authoritative per-brand composition + strengths.
export async function runApolloIndex({
  pf,
  salts,
  outFile,
  date,
  seen = new Set(),
  parserFingerprint,
  maxConsecutiveFetchFailures = 3,
  log = console.log,
}) {
  if (!pf?.state || !Array.isArray(salts) || !(seen instanceof Set)
    || typeof parserFingerprint !== 'string' || !parserFingerprint) {
    throw new TypeError('invalid Apollo index arguments');
  }
  pf.state.apollo ??= { saltCursor: 0 };
  const state = pf.state.apollo;
  normalizeProgressState(state, salts);
  prepareQuarantineRetries(state, salts, parserFingerprint);
  const quarantined = quarantineMap(state);
  let products = 0;
  let consecutiveFetchFailures = 0;

  while (state.saltCursor < salts.length) {
    const saltIndex = state.saltCursor;
    const saltPath = salts[saltIndex];
    if (isTombstoned(state, 'salt', saltPath)
      || quarantined.has(quarantineKey('salt', saltPath))) {
      state.saltCursor++;
      await pf.persist();
      continue;
    }

    let saltHtml;
    try {
      saltHtml = await pf.get(saltPath);
      consecutiveFetchFailures = 0;
    } catch (error) {
      if (isStop(error)) throw error;
      if (isPermanentlyMissing(error)) {
        recordTombstone(state, 'salt', saltPath);
        state.saltCursor++;
        await pf.persist();
        log(`apollo: salt ${saltPath} permanently missing (HTTP 404/410); skipping`);
        continue;
      }
      recordQuarantine(state, quarantined, {
        kind: 'salt',
        requestPath: saltPath,
        saltPath,
        saltIndex,
        reason: 'fetch_error',
        parserFingerprint,
      });
      state.saltCursor++;
      await pf.persist();
      log(`apollo: salt ${saltPath} fetch failed and was quarantined: ${error.message}`);
      consecutiveFetchFailures++;
      if (consecutiveFetchFailures >= maxConsecutiveFetchFailures) throw error;
      continue;
    }

    const productPaths = parseApolloSaltPage(saltHtml);
    if (!productPaths.length) {
      await fsp.unlink(pf.cachePath(saltPath)).catch(() => {});
      recordQuarantine(state, quarantined, {
        kind: 'salt',
        requestPath: saltPath,
        saltPath,
        saltIndex,
        reason: 'parser_anomaly',
        parserFingerprint,
      });
      state.saltCursor++;
      await pf.persist();
      log(`apollo: salt ${saltPath} parser anomaly quarantined; continuing`);
      continue;
    }

    for (const prodPath of productPaths) {
      const id = prodPath.replace('/medicine/', '');
      if (seen.has(id) || isTombstoned(state, 'product', prodPath)
        || quarantined.has(quarantineKey('product', prodPath))) continue;

      let fetched;
      try {
        fetched = await fetchIndexedProduct(pf, prodPath);
        consecutiveFetchFailures = 0;
      } catch (error) {
        if (isStop(error)) throw error;
        recordQuarantine(state, quarantined, {
          kind: 'product',
          requestPath: prodPath,
          saltPath,
          saltIndex,
          reason: 'fetch_error',
          parserFingerprint,
        });
        await pf.persist();
        log(`apollo: product ${prodPath} fetch failed and was quarantined: ${error.message}`);
        consecutiveFetchFailures++;
        if (consecutiveFetchFailures >= maxConsecutiveFetchFailures) throw error;
        continue;
      }

      if (fetched.status === 'permanently_missing') {
        recordTombstone(state, 'product', prodPath);
        await pf.persist();
        log(`apollo: product ${prodPath} permanently missing (HTTP 404/410); skipping`);
        continue;
      }

      const parsed = parseApolloProduct(fetched.html);
      if (!parsed?.brand_name || !parsed.ingredients?.length) {
        await fsp.unlink(pf.cachePath(prodPath)).catch(() => {});
        recordQuarantine(state, quarantined, {
          kind: 'product',
          requestPath: prodPath,
          saltPath,
          saltIndex,
          reason: 'parser_anomaly',
          parserFingerprint,
        });
        await pf.persist();
        log(`apollo: product ${prodPath} parser anomaly quarantined; continuing`);
        continue;
      }

      await fsp.appendFile(outFile, JSON.stringify({
        ...parsed,
        source_id: id,
        seen_at: date,
        pack_label: '',
        price_inr: null,
        type: null,
      }) + '\n');
      seen.add(id);
      products++;
    }

    state.saltCursor++;
    await pf.persist();
    if (state.saltCursor % 25 === 0) {
      log(`apollo: salt ${state.saltCursor}/${salts.length}, +${products} products this run`);
    }
  }

  return {
    products,
    total: seen.size,
    saltCursor: state.saltCursor,
    quarantined: state.quarantine.length,
    tombstones: state.tombstones.length,
  };
}

// Completed passes re-fetch only the directory, append new salt paths, and keep
// the existing index if discovery is transiently incomplete.
export async function refreshSaltIndex({ pf, saltIndexFile, log = console.log }) {
  let directoryHtml;
  try {
    directoryHtml = await pf.get(SALTS_URL, { fresh: true });
  } catch (error) {
    if (isStop(error)) throw error;
    log(`apollo: salt directory refresh failed (${error.message}); continuing with existing index`);
    return 0;
  }
  const discovered = parseApolloSaltDirectory(directoryHtml);
  if (!discovered.length) {
    log('apollo: salt directory refresh yielded no salts; keeping existing index');
    return 0;
  }
  const indexed = new Set(readJsonlSync(saltIndexFile).map((entry) => entry.path));
  const fresh = discovered.filter((saltPath) => !indexed.has(saltPath));
  if (!fresh.length) return 0;
  await fsp.appendFile(saltIndexFile, fresh.map((saltPath) => JSON.stringify({ path: saltPath })).join('\n') + '\n');
  log(`apollo: salt directory refresh found ${fresh.length} new salt${fresh.length === 1 ? '' : 's'}`);
  return fresh.length;
}

export async function main(log = console.log) {
  const c = ctx();
  const root = path.join(c.rawRoot, 'apollo');
  await fsp.mkdir(path.join(root, c.date), { recursive: true });
  const saltIndexFile = path.join(root, 'salt-index.jsonl');
  const outFile = path.join(root, c.date, 'normalized.jsonl');
  const pf = makeEcomFetcher(c.rawRoot, 'apollo', 'https://www.apollopharmacy.in');
  await pf.init();

  try {
    if (!fs.existsSync(saltIndexFile)) {
      const salts = parseApolloSaltDirectory(await pf.get(SALTS_URL, { fresh: true }));
      if (!salts.length) throw new ApolloParserAnomalyError(SALTS_URL);
      await fsp.writeFile(saltIndexFile, salts.map((saltPath) => JSON.stringify({ path: saltPath })).join('\n') + '\n');
      log(`apollo: discovered ${salts.length} salts`);
    } else {
      await refreshSaltIndex({ pf, saltIndexFile, log });
    }
    const salts = readJsonlSync(saltIndexFile).map((entry) => entry.path);

    const seen = new Set();
    for (const directory of fs.readdirSync(root)) {
      const file = path.join(root, directory, 'normalized.jsonl');
      if (fs.existsSync(file)) {
        for (const row of readJsonlSync(file)) seen.add(row.source_id);
      }
    }

    const result = await runApolloIndex({
      pf,
      salts,
      outFile,
      date: c.date,
      seen,
      parserFingerprint: apolloParserFingerprint(),
      log,
    });
    log(
      `apollo done: ${result.products} products this run, ${result.total} total, `
      + `quarantined=${result.quarantined}, tombstones=${result.tombstones}`,
    );
  } catch (e) {
    if (e instanceof BlockedError || e instanceof CapReachedError) {
      console.error(`STOPPED: ${e.message} — state persisted, resume later`);
      process.exit(2);
    }
    throw e;
  }
}

const invokedDirectly = process.argv[1]
  && import.meta.url.toLowerCase() === pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase();
if (invokedDirectly) await main();
