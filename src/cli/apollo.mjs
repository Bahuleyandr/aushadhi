import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BlockedError, CapReachedError, HttpStatusError } from '../lib/politeness.mjs';
import { makeEcomFetcher } from '../lib/ecom-fetcher.mjs';
import {
  apolloProductUrlMatches,
  parseApolloSaltDirectory,
  parseApolloSaltPage,
  parseApolloProduct,
} from '../adapters/apollo.mjs';
import { readJsonlSync } from '../lib/jsonl.mjs';
import { fetchIndexedProduct } from '../lib/product-failure-policy.mjs';
import {
  DEFAULT_NOT_FOUND_REVALIDATE_MS,
  ProductOutcomeLedger,
} from '../lib/variant-priority.mjs';
import { ctx } from '../lib/context.mjs';

const SALTS_URL = '/salts';
export const APOLLO_MEMBERSHIP_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const APOLLO_MEMBERSHIP_BATCH_SIZE = 250;
const isRobotsFailure = (error) => /robots/i.test(error?.message ?? '');
const isHttpBlock = (error) => error instanceof HttpStatusError
  && (error.status === 403 || error.status === 429);
const isSourceBlock = (error) => error instanceof BlockedError
  || isHttpBlock(error) || isRobotsFailure(error);
const isStop = (error) => isSourceBlock(error) || error instanceof CapReachedError;

export class ApolloParserAnomalyError extends Error {
  constructor(requestPath) {
    super(`parser anomaly for indexed Apollo page ${requestPath}`);
    this.name = 'ApolloParserAnomalyError';
    this.code = 'DISCOVERY_ANOMALY';
    this.requestPath = requestPath;
  }
}

export function crawlerExitCode(
  error,
  distinctBlockExit = process.env.AUSHADHI_DISTINCT_EXIT_CODES === '1',
) {
  if (error instanceof CapReachedError) return 2;
  if (error?.code === 'DISCOVERY_ANOMALY') return 4;
  if (isSourceBlock(error)) return distinctBlockExit ? 3 : 2;
  return 1;
}

function stopKind(error) {
  if (error instanceof CapReachedError) return 'daily-cap';
  if (isSourceBlock(error)) return 'source-block';
  if (error?.code === 'DISCOVERY_ANOMALY') return 'parser-anomaly';
  return 'error';
}

function clockValue(now) {
  const value = typeof now === 'function' ? now() : now;
  const millis = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(millis)) throw new TypeError('now must be a Date, timestamp, or clock function');
  return millis;
}

function productId(productPath) {
  return String(productPath).replace(/^\/medicine\//, '');
}

function quarantineKey(kind, requestPath) {
  return `${kind}:${kind === 'product' ? productId(requestPath) : requestPath}`;
}

function normalizeApolloState(state, allSalts, now) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('Apollo state must be an object');
  }
  const saltSet = new Set(allSalts);
  const rawChecks = state.saltChecks && typeof state.saltChecks === 'object'
    && !Array.isArray(state.saltChecks) ? state.saltChecks : {};
  state.saltChecks = {};
  for (const [saltPath, checkedAt] of Object.entries(rawChecks)) {
    if (saltSet.has(saltPath) && Number.isFinite(Date.parse(checkedAt))) {
      state.saltChecks[saltPath] = new Date(Date.parse(checkedAt)).toISOString();
    }
  }

  const pathsById = new Map();
  for (const requestPath of Array.isArray(state.productPaths) ? state.productPaths : []) {
    if (typeof requestPath === 'string' && /^\/medicine\/[a-z0-9-]+$/i.test(requestPath)) {
      pathsById.set(productId(requestPath), requestPath);
    }
  }

  const quarantine = [];
  const quarantineSeen = new Set();
  for (const entry of Array.isArray(state.quarantine) ? state.quarantine : []) {
    if (!entry || typeof entry !== 'object' || !['product', 'salt'].includes(entry.kind)
      || typeof entry.path !== 'string' || !['parser_anomaly', 'fetch_error'].includes(entry.reason)) continue;
    if (entry.kind === 'salt' && !saltSet.has(entry.path)) continue;
    if (entry.kind === 'product') pathsById.set(productId(entry.path), entry.path);
    const key = quarantineKey(entry.kind, entry.path);
    if (quarantineSeen.has(key)) continue;
    quarantineSeen.add(key);
    quarantine.push({
      kind: entry.kind,
      path: entry.path,
      ...(entry.kind === 'product' ? { productId: productId(entry.path) } : {}),
      ...(typeof entry.saltPath === 'string' ? { saltPath: entry.saltPath } : {}),
      reason: entry.reason,
      parser: entry.reason === 'parser_anomaly' && typeof entry.parser === 'string'
        ? entry.parser : null,
      checkedAt: Number.isFinite(Date.parse(entry.checkedAt))
        ? new Date(Date.parse(entry.checkedAt)).toISOString() : new Date(clockValue(now)).toISOString(),
    });
  }
  state.quarantine = quarantine;

  state.products = state.products && typeof state.products === 'object'
    && !Array.isArray(state.products) ? state.products : {};
  state.salts = state.salts && typeof state.salts === 'object'
    && !Array.isArray(state.salts) ? state.salts : {};

  // The reviewed live state conflated HTTP 404 and 410 in `tombstones`. Migrate
  // conservatively as immediately-due 404s so no legacy product becomes
  // permanently absent without typed evidence.
  const migratedAt = new Date(0).toISOString();
  for (const tombstone of Array.isArray(state.tombstones) ? state.tombstones : []) {
    if (typeof tombstone !== 'string') continue;
    const separator = tombstone.indexOf(':');
    if (separator < 0) continue;
    const kind = tombstone.slice(0, separator);
    const requestPath = tombstone.slice(separator + 1);
    if (kind === 'product' && /^\/medicine\/[a-z0-9-]+$/i.test(requestPath)) {
      pathsById.set(productId(requestPath), requestPath);
      state.products.pathOutcomes ??= [];
      if (!state.products.pathOutcomes.some((entry) => entry?.productId === productId(requestPath))) {
        state.products.pathOutcomes.push({
          productId: productId(requestPath),
          path: requestPath,
          status: 'not_found',
          checkedAt: migratedAt,
          retryAt: migratedAt,
        });
      }
    } else if (kind === 'salt' && saltSet.has(requestPath)) {
      state.salts.pathOutcomes ??= [];
      if (!state.salts.pathOutcomes.some((entry) => entry?.productId === requestPath)) {
        state.salts.pathOutcomes.push({
          productId: requestPath,
          path: requestPath,
          status: 'not_found',
          checkedAt: migratedAt,
          retryAt: migratedAt,
        });
      }
    }
  }
  state.productPaths = [...pathsById.values()];
  delete state.saltCursor;
  delete state.tombstones;
}

function releaseQuarantine(state, kind, requestPath) {
  const key = quarantineKey(kind, requestPath);
  const before = state.quarantine.length;
  state.quarantine = state.quarantine.filter(
    (entry) => quarantineKey(entry.kind, entry.path) !== key,
  );
  return state.quarantine.length !== before;
}

function recordQuarantine(state, {
  kind,
  requestPath,
  saltPath,
  reason,
  parserFingerprint,
  checkedAt,
}) {
  const entry = {
    kind,
    path: requestPath,
    ...(kind === 'product' ? { productId: productId(requestPath) } : {}),
    ...(typeof saltPath === 'string' ? { saltPath } : {}),
    reason,
    parser: reason === 'parser_anomaly' ? parserFingerprint : null,
    checkedAt,
  };
  releaseQuarantine(state, kind, requestPath);
  state.quarantine.push(entry);
  return entry;
}

function heldQuarantine(state, kind, requestPath, parserFingerprint) {
  const entry = state.quarantine.find(
    (candidate) => quarantineKey(candidate.kind, candidate.path) === quarantineKey(kind, requestPath),
  );
  if (!entry) return null;
  if (entry.reason === 'parser_anomaly' && entry.parser === parserFingerprint) return entry;
  releaseQuarantine(state, kind, requestPath);
  return null;
}

function syncTombstoneCompatibility(state) {
  const gone = [];
  for (const entry of state.products.pathOutcomes ?? []) {
    if (entry.status === 'gone') gone.push(`product:${entry.path}`);
  }
  for (const entry of state.salts.pathOutcomes ?? []) {
    if (entry.status === 'gone') gone.push(`salt:${entry.path}`);
  }
  state.tombstones = gone;
}

export function selectApolloMembershipRefresh({
  salts,
  state,
  now = Date.now,
  refreshIntervalMs = APOLLO_MEMBERSHIP_REFRESH_INTERVAL_MS,
  maxSalts = APOLLO_MEMBERSHIP_BATCH_SIZE,
}) {
  if (!Array.isArray(salts) || !state || !Number.isFinite(refreshIntervalMs)
    || refreshIntervalMs <= 0 || !Number.isInteger(maxSalts) || maxSalts <= 0) {
    throw new TypeError('invalid Apollo membership refresh arguments');
  }
  const clock = clockValue(now);
  const checks = state.saltChecks && typeof state.saltChecks === 'object'
    && !Array.isArray(state.saltChecks) ? state.saltChecks : {};
  const unavailable = new Map((state.salts?.pathOutcomes ?? []).map((entry) => [entry.path, entry]));
  return [...new Set(salts)].filter((saltPath) => {
    const outcome = unavailable.get(saltPath);
    if (outcome?.status === 'gone') return false;
    if (outcome?.status === 'not_found' && clock < Date.parse(outcome.retryAt)) return false;
    const checked = Date.parse(checks[saltPath]);
    return !Number.isFinite(checked) || clock - checked >= refreshIntervalMs;
  }).sort((left, right) => {
    const leftAt = Date.parse(checks[left]);
    const rightAt = Date.parse(checks[right]);
    const leftNew = !Number.isFinite(leftAt);
    const rightNew = !Number.isFinite(rightAt);
    if (leftNew !== rightNew) return leftNew ? -1 : 1;
    if (!leftNew && leftAt !== rightAt) return leftAt - rightAt;
    return left.localeCompare(right);
  }).slice(0, maxSalts);
}

export function apolloParserFingerprint() {
  return createHash('sha256')
    .update(fs.readFileSync(new URL('./apollo.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('../adapters/apollo.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('../lib/normalize.mjs', import.meta.url)))
    .digest('hex');
}

// Revisit stable salt IDs to discover current membership, then process every
// unfinished stable product ID without making array positions completion state.
export async function runApolloIndex({
  pf,
  salts,
  allSalts = salts,
  outFile,
  date,
  seen = new Set(),
  parserFingerprint,
  now = Date.now,
  notFoundRevalidateMs = DEFAULT_NOT_FOUND_REVALIDATE_MS,
  maxConsecutiveFetchFailures = 3,
  maxConsecutiveParserAnomalies = 3,
  log = console.log,
}) {
  if (!pf?.state || !pf?.get || !pf?.persist || !pf?.invalidate
    || !Array.isArray(salts) || !Array.isArray(allSalts) || !(seen instanceof Set)
    || typeof parserFingerprint !== 'string' || !parserFingerprint
    || !Number.isSafeInteger(maxConsecutiveFetchFailures) || maxConsecutiveFetchFailures <= 0
    || !Number.isSafeInteger(maxConsecutiveParserAnomalies) || maxConsecutiveParserAnomalies <= 0) {
    throw new TypeError('invalid Apollo index arguments');
  }
  pf.state.apollo ??= {};
  const state = pf.state.apollo;
  normalizeApolloState(state, allSalts, now);
  const checkedAt = new Date(clockValue(now)).toISOString();
  const saltOutcomes = new ProductOutcomeLedger({
    paths: allSalts,
    state: state.salts,
    idFromPath: (saltPath) => saltPath,
    now,
    notFoundRevalidateMs,
  });
  let checkedSalts = 0;
  let consecutiveFetchFailures = 0;
  let consecutiveSaltParserAnomalies = 0;
  let consecutiveProductParserAnomalies = 0;

  const knownProducts = new Map(state.productPaths.map((requestPath) => [productId(requestPath), requestPath]));
  for (const saltPath of salts) {
    if (!saltOutcomes.shouldFetch(saltPath)) continue;
    if (heldQuarantine(state, 'salt', saltPath, parserFingerprint)) {
      consecutiveSaltParserAnomalies++;
      if (consecutiveSaltParserAnomalies >= maxConsecutiveParserAnomalies) {
        await pf.persist();
        throw new ApolloParserAnomalyError(saltPath);
      }
      state.saltChecks[saltPath] = checkedAt;
      continue;
    }

    let fetched;
    try {
      fetched = await fetchIndexedProduct(pf, saltPath, { now });
      consecutiveFetchFailures = 0;
    } catch (error) {
      if (isStop(error)) throw error;
      recordQuarantine(state, {
        kind: 'salt', requestPath: saltPath, saltPath, reason: 'fetch_error',
        parserFingerprint, checkedAt,
      });
      await pf.persist();
      log(`apollo: salt ${saltPath} fetch failed and was quarantined: ${error.message}`);
      consecutiveFetchFailures++;
      if (consecutiveFetchFailures >= maxConsecutiveFetchFailures) throw error;
      continue;
    }
    if (fetched.status === 'not_found' || fetched.status === 'gone') {
      saltOutcomes.record(saltPath, fetched.status, { checkedAt: fetched.checkedAt });
      state.saltChecks[saltPath] = fetched.checkedAt;
      await pf.persist();
      log(fetched.status === 'not_found'
        ? `apollo: salt ${saltPath} not found (HTTP 404); scheduled for revalidation`
        : `apollo: salt ${saltPath} permanently gone (HTTP 410); skipping`);
      continue;
    }

    const discovered = parseApolloSaltPage(fetched.html);
    if (!discovered.length) {
      await pf.invalidate(saltPath);
      consecutiveSaltParserAnomalies++;
      if (consecutiveSaltParserAnomalies >= maxConsecutiveParserAnomalies) {
        await pf.persist();
        throw new ApolloParserAnomalyError(saltPath);
      }
      recordQuarantine(state, {
        kind: 'salt', requestPath: saltPath, saltPath, reason: 'parser_anomaly',
        parserFingerprint, checkedAt,
      });
      state.saltChecks[saltPath] = checkedAt;
      await pf.persist();
      log(`apollo: salt ${saltPath} parser anomaly quarantined; continuing`);
      continue;
    }

    consecutiveSaltParserAnomalies = 0;
    saltOutcomes.clear(saltPath);
    releaseQuarantine(state, 'salt', saltPath);
    for (const requestPath of discovered) knownProducts.set(productId(requestPath), requestPath);
    state.productPaths = [...knownProducts.values()];
    state.saltChecks[saltPath] = checkedAt;
    checkedSalts++;
    await pf.persist();
  }

  const productOutcomes = new ProductOutcomeLedger({
    paths: state.productPaths,
    state: state.products,
    idFromPath: productId,
    now,
    notFoundRevalidateMs,
  });
  let products = 0;
  for (const requestPath of state.productPaths) {
    const id = productId(requestPath);
    if (seen.has(id) || !productOutcomes.shouldFetch(requestPath)) continue;
    if (heldQuarantine(state, 'product', requestPath, parserFingerprint)) {
      consecutiveProductParserAnomalies++;
      if (consecutiveProductParserAnomalies >= maxConsecutiveParserAnomalies) {
        await pf.persist();
        throw new ApolloParserAnomalyError(requestPath);
      }
      continue;
    }

    let fetched;
    try {
      fetched = await fetchIndexedProduct(pf, requestPath, { now, responseMetadata: true });
      consecutiveFetchFailures = 0;
    } catch (error) {
      if (isStop(error)) throw error;
      recordQuarantine(state, {
        kind: 'product', requestPath, reason: 'fetch_error', parserFingerprint, checkedAt,
      });
      await pf.persist();
      log(`apollo: product ${requestPath} fetch failed and was quarantined: ${error.message}`);
      consecutiveFetchFailures++;
      if (consecutiveFetchFailures >= maxConsecutiveFetchFailures) throw error;
      continue;
    }
    if (fetched.status === 'not_found' || fetched.status === 'gone') {
      productOutcomes.record(requestPath, fetched.status, { checkedAt: fetched.checkedAt });
      releaseQuarantine(state, 'product', requestPath);
      await pf.persist();
      log(fetched.status === 'not_found'
        ? `apollo: product ${requestPath} not found (HTTP 404); scheduled for revalidation`
        : `apollo: product ${requestPath} permanently gone (HTTP 410); skipping`);
      continue;
    }

    const responseIdentityMatches = apolloProductUrlMatches(fetched.responseUrl, requestPath);
    const parsed = responseIdentityMatches
      ? parseApolloProduct(fetched.html, { expectedPath: requestPath })
      : null;
    if (!parsed?.brand_name || !parsed.ingredients?.length) {
      await pf.invalidate(requestPath);
      consecutiveProductParserAnomalies++;
      if (consecutiveProductParserAnomalies >= maxConsecutiveParserAnomalies) {
        await pf.persist();
        throw new ApolloParserAnomalyError(requestPath);
      }
      recordQuarantine(state, {
        kind: 'product', requestPath, reason: 'parser_anomaly', parserFingerprint, checkedAt,
      });
      await pf.persist();
      log(`apollo: product ${requestPath} parser anomaly quarantined; continuing`);
      continue;
    }

    consecutiveProductParserAnomalies = 0;
    await fsp.appendFile(outFile, `${JSON.stringify({
      ...parsed,
      source_id: id,
      seen_at: date,
      pack_label: parsed.pack_label ?? '',
      price_inr: null,
      type: null,
    })}\n`);
    productOutcomes.clear(requestPath);
    releaseQuarantine(state, 'product', requestPath);
    seen.add(id);
    products++;
    await pf.persist();
  }

  syncTombstoneCompatibility(state);
  await pf.persist();
  const productCounts = productOutcomes.counts();
  const saltCounts = saltOutcomes.counts();
  return {
    status: products === 0 && checkedSalts === 0 ? 'no_work' : 'completed',
    products,
    total: seen.size,
    checkedSalts,
    quarantined: state.quarantine.length,
    notFound: productCounts.notFound + saltCounts.notFound,
    gone: productCounts.gone + saltCounts.gone,
    tombstones: state.tombstones.length,
  };
}

// Re-fetch the directory and append new stable salt paths without overwriting a
// known-good index when source discovery is transiently incomplete.
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
  await fsp.appendFile(
    saltIndexFile,
    `${fresh.map((saltPath) => JSON.stringify({ path: saltPath })).join('\n')}\n`,
  );
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

  let initialized = false;
  let primaryError = null;
  try {
    await pf.init();
    initialized = true;
    pf.state.apollo ??= {};
    if (!fs.existsSync(saltIndexFile)) {
      const salts = parseApolloSaltDirectory(await pf.get(SALTS_URL, { fresh: true }));
      if (!salts.length) throw new ApolloParserAnomalyError(SALTS_URL);
      await fsp.writeFile(
        saltIndexFile,
        `${salts.map((saltPath) => JSON.stringify({ path: saltPath })).join('\n')}\n`,
      );
      log(`apollo: discovered ${salts.length} salts`);
    } else {
      await refreshSaltIndex({ pf, saltIndexFile, log });
    }
    const allSalts = readJsonlSync(saltIndexFile).map((entry) => entry.path);
    normalizeApolloState(pf.state.apollo, allSalts, Date.now);
    const salts = selectApolloMembershipRefresh({
      salts: allSalts,
      state: pf.state.apollo,
    });

    const seen = new Set();
    for (const directory of fs.readdirSync(root)) {
      const file = path.join(root, directory, 'normalized.jsonl');
      if (fs.existsSync(file)) {
        for (const row of readJsonlSync(file)) seen.add(String(row.source_id));
      }
    }

    const result = await runApolloIndex({
      pf,
      salts,
      allSalts,
      outFile,
      date: c.date,
      seen,
      parserFingerprint: apolloParserFingerprint(),
      log,
    });
    log(
      `apollo done: status=${result.status}, added=${result.products}, total=${result.total}, `
      + `salt_checks=${result.checkedSalts}/${salts.length}, quarantined=${result.quarantined}, `
      + `not_found=${result.notFound}, gone=${result.gone}`,
    );
  } catch (error) {
    primaryError = error;
    const code = crawlerExitCode(error);
    if (code !== 1) {
      console.error(`STOPPED [${stopKind(error)}]: ${error.message} — state persisted, resume later`);
      process.exitCode = code;
    } else {
      throw error;
    }
  } finally {
    if (initialized && typeof pf.close === 'function') {
      try {
        await pf.close();
      } catch (closeError) {
        if (!primaryError) throw closeError;
        console.error(`apollo: fetcher close failed after primary error: ${closeError.message}`);
      }
    }
  }
}

const invokedDirectly = process.argv[1]
  && import.meta.url.toLowerCase() === pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase();
if (invokedDirectly) await main();
