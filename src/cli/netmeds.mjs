import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BlockedError, CapReachedError, HttpStatusError } from '../lib/politeness.mjs';
import { makeEcomFetcher } from '../lib/ecom-fetcher.mjs';
import { parseNetmedsProduct, parseSitemapLocs, isLikelyDrugSlug } from '../adapters/netmeds.mjs';
import { readJsonlSync } from '../lib/jsonl.mjs';
import { ctx } from '../lib/context.mjs';
import { fetchIndexedProduct } from '../lib/product-failure-policy.mjs';
import { runVariantAwareIndex } from '../lib/variant-priority.mjs';

const ROOT_SITEMAPS = ['/sitemap.xml'];
export const SITEMAP_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const isRobotsFailure = (error) => /robots/i.test(error?.message ?? '');
const isHttpBlock = (error) => error instanceof HttpStatusError
  && (error.status === 403 || error.status === 429);
const isSourceBlock = (error) => error instanceof BlockedError
  || isHttpBlock(error) || isRobotsFailure(error);
const isStop = (error) => isSourceBlock(error) || error instanceof CapReachedError;
const toPath = (url) => {
  try {
    const parsed = new URL(url, 'https://www.netmeds.com');
    return parsed.hostname === 'www.netmeds.com' ? parsed.pathname : null;
  } catch {
    return null;
  }
};
const isProduct = (requestPath) => /^\/product\/[a-z0-9-]+$/i.test(requestPath ?? '');
const isProductSitemap = (requestPath) => /\/sitemap\/products\/.*\.xml$/i.test(requestPath ?? '');

export class NetmedsDiscoveryAnomalyError extends Error {
  constructor(sitemapPath, message = 'yielded no sitemap locations') {
    super(`netmeds: sitemap ${sitemapPath} ${message}; refusing to advance discovery`);
    this.name = 'NetmedsDiscoveryAnomalyError';
    this.code = 'DISCOVERY_ANOMALY';
    this.sitemapPath = sitemapPath;
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

function nowValue(now) {
  const value = typeof now === 'function' ? now() : now;
  const millis = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(millis)) throw new TypeError('now must be a Date, timestamp, or clock function');
  return millis;
}

function normalizeRefreshState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('Netmeds refresh state must be an object');
  }
  const refresh = state.indexRefresh && typeof state.indexRefresh === 'object'
    && !Array.isArray(state.indexRefresh) ? state.indexRefresh : {};
  refresh.completedAt = typeof refresh.completedAt === 'string' ? refresh.completedAt : null;
  refresh.startedAt = typeof refresh.startedAt === 'string' ? refresh.startedAt : null;
  refresh.queue = Array.isArray(refresh.queue)
    ? refresh.queue.filter((entry) => typeof entry === 'string'
      && (ROOT_SITEMAPS.includes(entry) || isProductSitemap(entry))) : [];
  refresh.seenSitemaps = Array.isArray(refresh.seenSitemaps)
    ? [...new Set(refresh.seenSitemaps.filter((entry) => typeof entry === 'string'
      && (ROOT_SITEMAPS.includes(entry) || isProductSitemap(entry))))] : [];
  state.indexRefresh = refresh;
  return refresh;
}

export async function refreshNetmedsIndex({
  pf,
  indexFile,
  state,
  now = Date.now,
  refreshIntervalMs = SITEMAP_REFRESH_INTERVAL_MS,
  log = console.log,
}) {
  if (!pf?.get || !pf?.persist || typeof indexFile !== 'string' || !indexFile
    || !Number.isFinite(refreshIntervalMs) || refreshIntervalMs <= 0) {
    throw new TypeError('invalid Netmeds index refresh arguments');
  }
  const clock = nowValue(now);
  const checkedAt = new Date(clock).toISOString();
  const refresh = normalizeRefreshState(state);
  const inProgress = refresh.startedAt !== null && refresh.queue.length > 0;
  const completedAt = refresh.completedAt === null ? Number.NaN : Date.parse(refresh.completedAt);
  if (!inProgress && fs.existsSync(indexFile) && Number.isFinite(completedAt)
    && clock - completedAt < refreshIntervalMs) {
    return {
      status: 'not_due', added: 0, prefiltered: 0, completedAt: refresh.completedAt,
    };
  }

  if (!inProgress) {
    refresh.startedAt = checkedAt;
    refresh.queue = [...ROOT_SITEMAPS];
    refresh.seenSitemaps = [...ROOT_SITEMAPS];
    await pf.persist();
  }

  const indexed = new Set(fs.existsSync(indexFile)
    ? readJsonlSync(indexFile).map((entry) => entry.path).filter((entry) => typeof entry === 'string')
    : []);
  let added = 0;
  let prefiltered = 0;
  while (refresh.queue.length) {
    const sitemapPath = refresh.queue[0];
    let xml;
    try {
      xml = await pf.get(sitemapPath, { fresh: true });
    } catch (error) {
      if (isStop(error)) throw error;
      throw new Error(`netmeds: sitemap ${sitemapPath} refresh failed: ${error.message}`, { cause: error });
    }
    const locations = parseSitemapLocs(xml);
    if (!locations.length) throw new NetmedsDiscoveryAnomalyError(sitemapPath);

    const freshProducts = [];
    let recognized = 0;
    for (const location of locations) {
      const requestPath = toPath(location);
      if (!requestPath) continue;
      if (isProduct(requestPath)) {
        recognized++;
        if (!isLikelyDrugSlug(requestPath)) {
          prefiltered++;
        } else if (!indexed.has(requestPath)) {
          indexed.add(requestPath);
          freshProducts.push(requestPath);
        }
      } else if (isProductSitemap(requestPath) && !refresh.seenSitemaps.includes(requestPath)) {
        recognized++;
        refresh.seenSitemaps.push(requestPath);
        refresh.queue.push(requestPath);
      } else if (isProductSitemap(requestPath)) {
        recognized++;
      }
    }
    if (!recognized) {
      throw new NetmedsDiscoveryAnomalyError(sitemapPath, 'yielded no recognized product or sitemap paths');
    }
    if (freshProducts.length) {
      await fsp.appendFile(
        indexFile,
        `${freshProducts.map((requestPath) => JSON.stringify({ path: requestPath })).join('\n')}\n`,
      );
      added += freshProducts.length;
    }
    refresh.queue.shift();
    await pf.persist();
  }

  if (!indexed.size) {
    throw new NetmedsDiscoveryAnomalyError(ROOT_SITEMAPS.join(','), 'completed without any product paths');
  }
  refresh.completedAt = checkedAt;
  refresh.startedAt = null;
  refresh.queue = [];
  refresh.seenSitemaps = [];
  await pf.persist();
  log(
    `netmeds: sitemap refresh completed, +${added} indexed products `
    + `(${prefiltered} non-drug SKUs pre-filtered)`,
  );
  return {
    status: 'refreshed', added, prefiltered, completedAt: checkedAt,
  };
}

export function netmedsParserFingerprint() {
  return createHash('sha256')
    .update(fs.readFileSync(new URL('../adapters/netmeds.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('../adapters/onemg.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('../lib/normalize.mjs', import.meta.url)))
    .digest('hex');
}

// Resumable Netmeds crawl: refresh product sitemaps -> indexed pages -> rows.
export async function main(log = console.log) {
  const c = ctx();
  const root = path.join(c.rawRoot, 'netmeds');
  await fsp.mkdir(path.join(root, c.date), { recursive: true });
  const indexFile = path.join(root, 'product-index.jsonl');
  const outFile = path.join(root, c.date, 'normalized.jsonl');
  const pf = makeEcomFetcher(c.rawRoot, 'netmeds', 'https://www.netmeds.com');

  let initialized = false;
  let primaryError = null;
  try {
    await pf.init();
    initialized = true;
    pf.state.netmeds ??= {};
    const refresh = await refreshNetmedsIndex({
      pf,
      indexFile,
      state: pf.state.netmeds,
      log,
    });
    let products = readJsonlSync(indexFile).map((entry) => entry.path);
    const drugLike = products.filter(isLikelyDrugSlug);
    if (drugLike.length < products.length) {
      await fsp.writeFile(
        indexFile,
        drugLike.map((requestPath) => JSON.stringify({ path: requestPath })).join('\n') + '\n',
      );
      log(
        `netmeds: pre-filtered index ${products.length} -> ${drugLike.length} `
        + `(dropped ${products.length - drugLike.length} non-drug SKUs)`,
      );
      products = drugLike;
    }

    const done = new Set();
    for (const directory of fs.readdirSync(root)) {
      const file = path.join(root, directory, 'normalized.jsonl');
      if (fs.existsSync(file)) {
        for (const row of readJsonlSync(file)) done.add(String(row.source_id));
      }
    }

    const idFromPath = (productPath) => productPath.match(/-(\d+)$/)?.[1] ?? productPath;
    const result = await runVariantAwareIndex({
      products,
      state: pf.state.netmeds,
      doneIds: done,
      idFromPath,
      fetchProduct: async (productPath) => await fetchIndexedProduct(pf, productPath),
      parseProduct: (html, productPath) => parseNetmedsProduct(
        html,
        idFromPath(productPath),
        productPath,
      ),
      isExcluded: (parsed) => parsed?.outcome === 'excluded',
      onExcluded: (productPath, parsed) => log(
        `netmeds: ${productPath} terminal exclusion (${parsed.reason}); skipping`,
      ),
      isParsed: (parsed) => Boolean(parsed?.brand_name && parsed.ingredients?.length),
      writeProduct: async ({ parsed, productId }) => {
        await fsp.appendFile(outFile, `${JSON.stringify({
          ...parsed,
          source_id: String(productId),
          seen_at: c.date,
          pack_label: parsed.pack_label ?? '',
          price_inr: null,
          type: parsed.type ?? null,
        })}\n`);
      },
      persist: async () => await pf.persist(),
      onParserAnomaly: async (productPath) => await pf.invalidate(productPath),
      onQuarantined: (productPath) => log(
        `netmeds: ${productPath} quarantined (parser anomaly); continuing`,
      ),
      parserFingerprint: netmedsParserFingerprint(),
      onNotFound: (productPath) => log(
        `netmeds: ${productPath} not found (HTTP 404); scheduled for revalidation`,
      ),
      onGone: (productPath) => log(
        `netmeds: ${productPath} permanently gone (HTTP 410); skipping`,
      ),
      onProgress: ({ cursor, total, added, priority }) => log(
        `netmeds: ${cursor}/${total}, +${added} drugs, priority=${priority}`,
      ),
    });
    log(
      `netmeds done: status=${result.status}, added=${result.added}, total=${done.size}, `
      + `priority=${result.priority}, quarantined=${result.quarantined}, `
      + `not_found=${result.notFound}, gone=${result.gone}, excluded=${result.excluded}, `
      + `index_refresh=${refresh.status}`,
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
        console.error(`netmeds: fetcher close failed after primary error: ${closeError.message}`);
      }
    }
  }
}

const invokedDirectly = process.argv[1]
  && import.meta.url.toLowerCase() === pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase();
if (invokedDirectly) await main();
