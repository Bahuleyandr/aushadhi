import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseCsvSync } from 'csv-parse/sync';
import { BlockedError, CapReachedError, HttpStatusError } from '../lib/politeness.mjs';
import { makeOnemgFetcher } from '../lib/onemg-fetcher.mjs';
import { parseDrugPage, parseBrowsePageInfo } from '../adapters/onemg.mjs';
import { buildQueue } from '../lib/gapfill-queue.mjs';
import { buildKnownCombos, likelyTruncated } from '../lib/known-combos.mjs';
import { normBrandName } from '../lib/normalize.mjs';
import { readJsonl, readJsonlSync } from '../lib/jsonl.mjs';
import { ctx } from '../lib/context.mjs';
import { resolvePublishedCohort } from '../lib/build-cohort.mjs';
import { fetchIndexedProduct } from '../lib/product-failure-policy.mjs';
import {
  DEFAULT_NOT_FOUND_REVALIDATE_MS,
  ParserAnomalyError,
  ProductOutcomeLedger,
  expandIndexedVariants,
} from '../lib/variant-priority.mjs';

const LABELS = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const DEFAULT_DISCOVERY_REFRESH_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_CONSECUTIVE_FETCH_FAILURES = 3;

export function isRobotsFailure(error) {
  return /robots/i.test(error?.message ?? '');
}

function isSourceBlock(error) {
  return error instanceof BlockedError
    || (error instanceof HttpStatusError && (error.status === 403 || error.status === 429))
    || isRobotsFailure(error);
}

export class DiscoveryAnomalyError extends Error {
  constructor(label, page, reason = 'yielded 0 entries') {
    super(`discover: label=${label} page ${page} ${reason} — parser/markup drift, refusing to advance cursor`);
    this.name = 'DiscoveryAnomalyError';
    this.code = 'DISCOVERY_PAGE_EMPTY';
    this.label = label;
    this.page = page;
  }
}

export class NoWorkError extends Error {
  constructor(message = 'no retryable 1mg product paths remain') {
    super(message);
    this.name = 'NoWorkError';
    this.code = 'NO_RETRYABLE_WORK';
  }
}

export function crawlerExitCode(error, distinctBlockExit = process.env.AUSHADHI_DISTINCT_EXIT_CODES === '1') {
  if (error instanceof CapReachedError) return 2;
  if (error instanceof DiscoveryAnomalyError || error?.code === 'DISCOVERY_ANOMALY') return 4;
  if (error instanceof NoWorkError) return 5;
  if (isSourceBlock(error)) return distinctBlockExit ? 3 : 2;
  return 1;
}

export function loadSlugIndex(indexFile) {
  const index = new Map();
  index.allPaths = [];
  index.ambiguousNorms = new Set();
  const paths = new Set();
  for (const entry of readJsonlSync(indexFile)) {
    const norm = String(entry.norm ?? '').trim();
    const productPath = String(entry.path ?? '').trim();
    if (!norm || !productPath) continue;
    if (!paths.has(productPath)) {
      paths.add(productPath);
      index.allPaths.push(productPath);
    }
    if (index.ambiguousNorms.has(norm)) continue;
    if (!index.has(norm)) index.set(norm, productPath);
    else if (index.get(norm) !== productPath) {
      index.delete(norm);
      index.ambiguousNorms.add(norm);
    }
  }
  return index;
}

export function collectOnemgDoneIds(compiledRows, rawRows = []) {
  const done = new Set(compiledRows.flatMap((row) => row.sources ?? [])
    .filter((source) => source.source === 'onemg-live'
      && source.source_id !== null && source.source_id !== undefined)
    .map((source) => String(source.source_id)));
  for (const row of rawRows) {
    if (row.source === 'onemg-live' && row.source_id !== null && row.source_id !== undefined) {
      done.add(String(row.source_id));
    }
  }
  return done;
}

export function canonicalBrowseNext(next, label, expectedPage) {
  if (typeof next !== 'string' || !next.trim()) throw new TypeError('1mg structured next must be a nonempty path');
  if (!Number.isInteger(expectedPage) || expectedPage < 2) {
    throw new TypeError('1mg structured next expected page must be an integer >= 2');
  }
  const url = new URL(next, 'https://www.1mg.com');
  if (url.origin !== 'https://www.1mg.com' || url.pathname !== '/drugs-all-medicines'
    || url.username || url.password || url.hash) {
    throw new TypeError(`1mg structured next escaped the browse endpoint: ${next}`);
  }
  const labels = url.searchParams.getAll('label');
  if (labels.length > 1 || labels.some((value) => value !== label)) {
    throw new TypeError(`1mg structured next changed label ${label}: ${next}`);
  }
  for (const key of url.searchParams.keys()) {
    if (key !== 'label' && key !== 'page') {
      throw new TypeError(`1mg structured next has unexpected query parameter ${key}: ${next}`);
    }
  }
  const pages = url.searchParams.getAll('page');
  if (pages.length !== 1) {
    throw new TypeError(`1mg structured next must contain exactly one page: ${next}`);
  }
  if (pages[0] !== String(expectedPage)) {
    throw new TypeError(`1mg structured next expected page ${expectedPage}: ${next}`);
  }
  if (!labels.length) url.searchParams.set('label', label);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

// Walks /drugs-all-medicines?label=X&page=N from a persisted per-label cursor.
export async function runDiscover({
  pf,
  maxPages,
  indexFile,
  log = console.log,
  now = Date.now,
  refreshMs = DEFAULT_DISCOVERY_REFRESH_MS,
}) {
  if (!Number.isFinite(refreshMs) || refreshMs <= 0) {
    throw new TypeError('discovery refreshMs must be a positive finite number');
  }
  const index = loadSlugIndex(indexFile);
  const indexedPaths = new Set(index.allPaths);
  pf.state.discover ??= { label: 0, page: 1 };
  const cur = pf.state.discover;
  if (!Number.isInteger(cur.label) || cur.label < 0 || cur.label > LABELS.length
    || !Number.isInteger(cur.page) || cur.page < 1) {
    throw new TypeError('invalid persisted 1mg discovery cursor');
  }
  const currentTime = () => {
    const value = now();
    const millis = value instanceof Date ? value.getTime() : Number(value);
    if (!Number.isFinite(millis)) throw new TypeError('discovery clock must return a finite timestamp');
    return millis;
  };
  if (cur.label === LABELS.length) {
    const clock = currentTime();
    const nextRefresh = Date.parse(cur.next_refresh_at);
    if (!Number.isFinite(nextRefresh)) {
      cur.completed_at = typeof cur.completed_at === 'string'
        && Number.isFinite(Date.parse(cur.completed_at))
        ? new Date(Date.parse(cur.completed_at)).toISOString()
        : new Date(clock).toISOString();
      cur.next_refresh_at = new Date(clock).toISOString();
      await pf.persist();
    } else if (clock < nextRefresh) {
      return {
        status: 'refresh_deferred',
        fetched: 0,
        added: 0,
        index,
        nextRefreshAt: new Date(nextRefresh).toISOString(),
      };
    }
    cur.label = 0;
    cur.page = 1;
    delete cur.nextPath;
    await pf.persist();
  }
  if (cur.page > 1 && !cur.nextPath) {
    log(`discover: legacy label=${cur.label} page=${cur.page} lacked structured next; rewinding same label to page 1`);
    cur.page = 1;
    await pf.persist();
  }
  let fetched = 0;
  let added = 0;
  while (fetched < maxPages && cur.label < LABELS.length) {
    const label = LABELS[cur.label];
    const pageNum = cur.page;
    // page 1 must be the bare label URL — 1mg serves an empty listing for &page=1
    const p = cur.nextPath
      ? canonicalBrowseNext(cur.nextPath, label, pageNum)
      : `/drugs-all-medicines?label=${label}`;
    let html;
    try {
      html = await pf.get(p, { fresh: true });
    } catch (error) {
      log(`discover: ${p} failed (${error.message}); preserving label/page cursor`);
      throw error;
    }
    fetched++;
    const { entries, paginationKnown, next } = parseBrowsePageInfo(html);
    if (entries.length === 0) throw new DiscoveryAnomalyError(label, pageNum);
    if (!paginationKnown) {
      throw new DiscoveryAnomalyError(label, pageNum, 'lacked structured pagination metadata');
    }
    const lines = [];
    for (const e of entries) {
      const norm = normBrandName(e.name);
      if (indexedPaths.has(e.path)) continue;
      indexedPaths.add(e.path);
      index.allPaths.push(e.path);
      if (!index.ambiguousNorms.has(norm)) {
        if (!index.has(norm)) index.set(norm, e.path);
        else if (index.get(norm) !== e.path) {
          index.delete(norm);
          index.ambiguousNorms.add(norm);
        }
      }
      lines.push(JSON.stringify({ norm, name: e.name, path: e.path, seen_at: new Date().toISOString().slice(0, 10) }));
      added++;
    }
    if (lines.length) await fsp.appendFile(indexFile, lines.join('\n') + '\n');
    if (next === null) {
      cur.label++;
      cur.page = 1;
      delete cur.nextPath;
      if (cur.label === LABELS.length) {
        const completed = currentTime();
        cur.completed_at = new Date(completed).toISOString();
        cur.next_refresh_at = new Date(completed + refreshMs).toISOString();
      }
    } else {
      cur.nextPath = canonicalBrowseNext(next, label, pageNum + 1);
      cur.page++;
    }
    log(`discover: label=${label} page=${pageNum} links=${entries.length} new=${lines.length}`);
    await pf.persist();
  }
  return {
    status: cur.label === LABELS.length ? 'sweep_complete' : 'progress',
    fetched,
    added,
    index,
  };
}

export async function runTargeted({
  pf,
  queue,
  outFile,
  discoveryFile,
  knownNorms,
  date,
  log = console.log,
  state = {},
  indexedPaths = queue.map((entry) => entry.path),
  persist = async () => await pf.persist(),
  now = Date.now,
  fetchProduct = async (productPath) => await fetchIndexedProduct(pf, productPath, { now }),
  notFoundRevalidateMs = DEFAULT_NOT_FOUND_REVALIDATE_MS,
  maxConsecutiveFetchFailures = DEFAULT_MAX_CONSECUTIVE_FETCH_FAILURES,
}) {
  if (!Number.isSafeInteger(maxConsecutiveFetchFailures) || maxConsecutiveFetchFailures <= 0) {
    throw new TypeError('maxConsecutiveFetchFailures must be a positive safe integer');
  }
  const idFromPath = (productPath) => productPath.match(/-(\d+)$/)?.[1] ?? productPath;
  const outcomes = new ProductOutcomeLedger({
    paths: indexedPaths,
    state,
    idFromPath,
    now,
    notFoundRevalidateMs,
  });
  let ok = 0;
  let failed = 0;
  let attempted = 0;
  let notFound = 0;
  let gone = 0;
  let consecutiveFetchFailures = 0;
  for (const entry of queue) {
    if (!outcomes.shouldFetch(entry.path)) continue;
    let fetched;
    try {
      attempted++;
      fetched = await fetchProduct(entry.path);
    } catch (e) {
      if (isSourceBlock(e) || e instanceof CapReachedError) throw e;
      failed++;
      consecutiveFetchFailures++;
      log(`gapfill: ${entry.path} failed: ${e.message}`);
      if (consecutiveFetchFailures >= maxConsecutiveFetchFailures) throw e;
      continue;
    }
    consecutiveFetchFailures = 0;
    if (fetched?.status === 'not_found' || fetched?.status === 'gone') {
      outcomes.record(entry.path, fetched.status, { checkedAt: fetched.checkedAt });
      await persist();
      if (fetched.status === 'not_found') {
        notFound++;
        log(`gapfill: ${entry.path} not found; deferred for policy revalidation`);
      } else {
        gone++;
        log(`gapfill: ${entry.path} gone; recorded terminal outcome`);
      }
      continue;
    }
    if (fetched?.status !== 'fetched') {
      throw new TypeError(`gapfill fetch returned invalid status for ${entry.path}: ${fetched?.status}`);
    }
    const page = parseDrugPage(fetched.html);
    const familySibling = entry.mode === 'family_sibling';
    const parserInvalid = !page?.brand_name || !page.ingredients?.length
      || (familySibling && !page.pack_label)
      || (!familySibling && entry.brand_name
        && normBrandName(entry.brand_name) !== normBrandName(page.brand_name));
    if (parserInvalid) {
      if (typeof pf.invalidate === 'function') await pf.invalidate(entry.path);
      throw new ParserAnomalyError(entry.path);
    }
    const row = {
      source: 'onemg-live',
      source_id: entry.path.match(/-(\d+)$/)?.[1] ?? entry.path,
      seen_at: date,
      // identity comes from the TARGET row so merge lands on the same identity key
      brand_name: familySibling ? page.brand_name : (entry.brand_name ?? page.brand_name),
      manufacturer: familySibling ? (page.manufacturer ?? '') : (entry.manufacturer ?? page.manufacturer ?? ''),
      pack_label: familySibling ? page.pack_label : (entry.pack_label ?? page.pack_label ?? ''),
      form_raw: page.form_raw,
      price_inr: null,
      is_discontinued: page.is_discontinued,
      ingredients: page.ingredients,
      composition_raw: page.composition_raw,
      composition_status: page.composition_status,
      substitutes_raw: page.substitutes_raw,
      // evidence-derived in parseDrugPage; null when the page stated no category
      type: page.type ?? null,
    };
    const discoveries = page.substitutes_raw
      .filter((s) => !knownNorms.has(normBrandName(s.name)))
      .map((s) => JSON.stringify({ name: s.name, seen_from: entry.path, seen_at: date }));
    await fsp.appendFile(outFile, JSON.stringify(row) + '\n');
    if (discoveries.length) await fsp.appendFile(discoveryFile, discoveries.join('\n') + '\n');
    if (outcomes.clear(entry.path)) await persist();
    ok++;
  }
  return {
    status: attempted === 0 ? 'no_work' : 'completed',
    ok,
    failed,
    attempted,
    notFound,
    gone,
  };
}

// Fetches a random sample of unverified 2-slot rows and measures how many were
// actually truncated (page shows MORE molecules than the dataset). Sampled rows
// are written to normalized.jsonl like any targeted fetch — auditing also fixes.
export async function runAuditSample({
  pf,
  rows,
  slugIndex,
  n,
  outFile,
  discoveryFile,
  knownNorms,
  date,
  kb,
  log = console.log,
  state = {},
  persist = async () => await pf.persist(),
  now = Date.now,
  fetchProduct = async (productPath) => await fetchIndexedProduct(pf, productPath, { now }),
  notFoundRevalidateMs = DEFAULT_NOT_FOUND_REVALIDATE_MS,
  maxConsecutiveFetchFailures = DEFAULT_MAX_CONSECUTIVE_FETCH_FAILURES,
}) {
  if (!Number.isSafeInteger(maxConsecutiveFetchFailures) || maxConsecutiveFetchFailures <= 0) {
    throw new TypeError('maxConsecutiveFetchFailures must be a positive safe integer');
  }
  const candidates = rows.filter((r) => r.two_slot_maxed === true
    && (r.sources ?? []).every((s) => s.source === 'github-jr' || s.source === 'kaggle-2025')
    && slugIndex.has(normBrandName(r.brand_name)));
  // shuffle (Fisher-Yates) then take n
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const sample = candidates.slice(0, n);
  const queue = sample.map((r) => ({
    identity_key: null, brand_name: r.brand_name,
    manufacturer: r.manufacturer, pack_label: r.pack_label,
    path: slugIndex.get(normBrandName(r.brand_name)),
    _before: r.ingredients.length,
    _likely: kb ? likelyTruncated(r, kb) : false,
  }));
  const outcomes = new ProductOutcomeLedger({
    paths: slugIndex.allPaths,
    state,
    idFromPath: (productPath) => productPath.match(/-(\d+)$/)?.[1] ?? productPath,
    now,
    notFoundRevalidateMs,
  });
  let fetched = 0;
  let attempted = 0;
  let notFound = 0;
  let gone = 0;
  let truncated = 0;
  let likelyHits = 0;
  let consecutiveFetchFailures = 0;
  const examples = [];
  for (const entry of queue) {
    if (!outcomes.shouldFetch(entry.path)) continue;
    let outcome;
    try {
      attempted++;
      outcome = await fetchProduct(entry.path);
    } catch (e) {
      if (isSourceBlock(e) || e instanceof CapReachedError) throw e;
      log(`audit: ${entry.path} failed: ${e.message}`);
      consecutiveFetchFailures++;
      if (consecutiveFetchFailures >= maxConsecutiveFetchFailures) throw e;
      continue;
    }
    consecutiveFetchFailures = 0;
    if (outcome?.status === 'not_found' || outcome?.status === 'gone') {
      outcomes.record(entry.path, outcome.status, { checkedAt: outcome.checkedAt });
      await persist();
      if (outcome.status === 'not_found') notFound++;
      else gone++;
      continue;
    }
    if (outcome?.status !== 'fetched') {
      throw new TypeError(`audit fetch returned invalid status for ${entry.path}: ${outcome?.status}`);
    }
    const page = parseDrugPage(outcome.html);
    if (!page?.brand_name || !page.ingredients?.length
      || normBrandName(entry.brand_name) !== normBrandName(page.brand_name)) {
      if (typeof pf.invalidate === 'function') await pf.invalidate(entry.path);
      throw new ParserAnomalyError(entry.path);
    }
    fetched++;
    const after = page.ingredients.length;
    if (after > entry._before) {
      truncated++;
      if (entry._likely) likelyHits++;
      if (examples.length < 10) examples.push(`${entry.brand_name}: ${entry._before} -> ${after} molecules`);
    }
    const row = {
      source: 'onemg-live',
      source_id: entry.path.match(/-(\d+)$/)?.[1] ?? entry.path,
      seen_at: date,
      brand_name: entry.brand_name,
      manufacturer: entry.manufacturer,
      pack_label: entry.pack_label,
      form_raw: page.form_raw,
      price_inr: null,
      is_discontinued: page.is_discontinued,
      ingredients: page.ingredients,
      composition_raw: page.composition_raw,
      composition_status: page.composition_status,
      substitutes_raw: page.substitutes_raw,
      type: page.type ?? null,
    };
    await fsp.appendFile(outFile, JSON.stringify(row) + '\n');
    const discoveries = page.substitutes_raw
      .filter((s) => !knownNorms.has(normBrandName(s.name)))
      .map((s) => JSON.stringify({ name: s.name, seen_from: entry.path, seen_at: date }));
    if (discoveries.length) await fsp.appendFile(discoveryFile, discoveries.join('\n') + '\n');
    if (outcomes.clear(entry.path)) await persist();
  }
  return {
    status: attempted === 0 ? 'no_work' : 'completed',
    candidates: candidates.length, sampled: sample.length, fetched, truncated,
    rate: fetched ? Number(((100 * truncated) / fetched).toFixed(1)) : null,
    attempted, notFound, gone, likelyHits, examples,
  };
}

export async function main() {
  const c = ctx();
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? null : (args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? true : args[i + 1]);
  };
  const rawLimit = flag('limit');
  if (rawLimit === true) throw new Error('--limit requires a number');
  const limit = Number(rawLimit ?? 200);
  if (!Number.isFinite(limit) || limit <= 0) throw new Error(`invalid --limit: ${rawLimit}`);
  const discover = flag('discover');
  const catalogExport = flag('catalog-export');
  if (catalogExport === true) throw new Error('--catalog-export requires a file path');
  const auditSample = flag('audit-sample');
  const exhaustive = flag('all') === true; // fetch EVERY slugged drug page, not just needs-work

  const onemgRoot = path.join(c.rawRoot, 'onemg');
  await fsp.mkdir(path.join(onemgRoot, c.date), { recursive: true });
  const pf = makeOnemgFetcher(c.rawRoot);

  const indexFile = path.join(onemgRoot, 'slug-index.jsonl');
  let initialized = false;
  let primaryError = null;
  try {
    await pf.init();
    initialized = true;
    if (discover) {
      const maxPages = discover === true ? 50 : Number(discover);
      if (!Number.isFinite(maxPages) || maxPages <= 0) throw new Error(`invalid --discover page count: ${discover}`);
      const r = await runDiscover({ pf, maxPages, indexFile });
      if (r.status === 'refresh_deferred') {
        console.log(`discover deferred: next A-Z refresh at ${r.nextRefreshAt}; targeted work may still remain`);
      } else {
        console.log(`discover done: status=${r.status}, ${r.fetched} pages fetched, ${r.added} new slugs, index paths ${r.index.allPaths.length}`);
      }
      return r;
    }

    let published;
    try {
      published = await resolvePublishedCohort({
        distRoot: c.distRoot,
        verifyFiles: ['drugs.jsonl', 'conflicts.jsonl'],
      });
    } catch (error) {
      throw new Error(`run \`npm run build\` first (${error.message})`);
    }
    const drugsFile = path.join(published.dir, 'drugs.jsonl');
    const conflictsFile = path.join(published.dir, 'conflicts.jsonl');
    const rows = [];
    for await (const row of readJsonl(drugsFile)) rows.push(row);
    const conflicts = readJsonlSync(conflictsFile);
    const catalogNames = new Set();
    if (typeof catalogExport === 'string') {
      const records = parseCsvSync(fs.readFileSync(catalogExport), { columns: true, bom: true, relax_column_count: true });
      for (const rec of records) {
        const name = (rec.name ?? Object.values(rec)[0] ?? '').toString().trim();
        if (name) catalogNames.add(normBrandName(name));
      }
    }
    const slugIndex = loadSlugIndex(indexFile);
    if (!slugIndex.allPaths.length) {
      console.log('slug index empty — run `node src/cli/gapfill.mjs --discover [pages]` first to build it');
      return { status: 'index_empty' };
    }
    const kb = buildKnownCombos(rows);
    const knownNorms = new Set(rows.map((r) => normBrandName(r.brand_name)));
    pf.state.gapfill ??= {};

    if (auditSample) {
      const n = auditSample === true ? 50 : Number(auditSample);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`invalid --audit-sample count: ${auditSample}`);
      const report = await runAuditSample({
        pf, rows, slugIndex, n, kb,
        outFile: path.join(onemgRoot, c.date, 'normalized.jsonl'),
        discoveryFile: path.join(onemgRoot, 'discovery-queue.jsonl'),
        knownNorms, date: c.date,
        state: pf.state.gapfill,
      });
      console.log(`audit: ${JSON.stringify(report, null, 2)}`);
      return report;
    }

    const rawOnemgRows = [];
    for (const entry of fs.readdirSync(onemgRoot)) {
      const normalized = path.join(onemgRoot, entry, 'normalized.jsonl');
      if (!fs.existsSync(normalized)) continue;
      for await (const row of readJsonl(normalized)) rawOnemgRows.push(row);
    }
    const doneOnemgIds = collectOnemgDoneIds(rows, rawOnemgRows);
    const idFromPath = (productPath) => productPath.match(/-(\d+)$/)?.[1] ?? productPath;
    const outcomes = new ProductOutcomeLedger({
      paths: slugIndex.allPaths,
      state: pf.state.gapfill,
      idFromPath,
    });
    await pf.persist();
    const unavailableIds = outcomes.unavailableIds();
    const doneForQueue = new Set([...doneOnemgIds, ...unavailableIds]);
    const built = buildQueue({
      rows,
      conflicts,
      slugIndex,
      catalogNames,
      limit: Number.MAX_SAFE_INTEGER,
      knownCombos: kb,
      exhaustive,
    });
    const regularQueue = built.queue.filter((entry) => !doneForQueue.has(idFromPath(entry.path))
      && outcomes.shouldFetch(entry.path));
    const regularPaths = new Set(regularQueue.map((entry) => entry.path));
    const variantPaths = expandIndexedVariants({
      indexedPaths: slugIndex.allPaths,
      seedNames: built.queue.map((entry) => entry.brand_name).filter(Boolean),
      doneIds: doneForQueue,
      idFromPath,
    });
    const variantQueue = variantPaths.filter((productPath) => !regularPaths.has(productPath)
      && outcomes.shouldFetch(productPath))
      .map((productPath) => ({ mode: 'family_sibling', path: productPath }));
    const queue = [...regularQueue, ...variantQueue].slice(0, limit);
    console.log(`queue: ${queue.length} retryable pages${exhaustive ? ' [EXHAUSTIVE]' : ''} (${variantQueue.length} source-indexed siblings available; ${built.skipped} rows skipped, no unambiguous slug; KB: ${kb.combos} known 3+ combos)`);
    if (queue.length === 0) throw new NoWorkError();
    const r = await runTargeted({
      pf,
      queue,
      outFile: path.join(onemgRoot, c.date, 'normalized.jsonl'),
      discoveryFile: path.join(onemgRoot, 'discovery-queue.jsonl'),
      knownNorms,
      date: c.date,
      state: pf.state.gapfill,
      indexedPaths: slugIndex.allPaths,
    });
    console.log(`gapfill done: ${r.ok} pages parsed, ${r.notFound} deferred 404, ${r.gone} terminal 410, ${r.failed} transient failures`);
    return r;
  } catch (e) {
    primaryError = e;
    const code = crawlerExitCode(e);
    if (code === 5) {
      console.log(`NO_WORK: ${e.message}`);
      process.exitCode = code;
      return { status: 'no_work', exitCode: code };
    }
    if (code === 2 || code === 3 || code === 4) {
      console.error(`STOPPED: ${e.message} — state persisted, resume later`);
      process.exitCode = code;
      return { status: 'stopped', exitCode: code };
    }
    throw e;
  } finally {
    if (initialized && typeof pf.close === 'function') {
      try {
        await pf.close();
      } catch (closeError) {
        if (!primaryError) throw closeError;
        console.error(`gapfill: source lock close failed after primary error: ${closeError.message}`);
      }
    }
  }
}

const invokedDirectly = process.argv[1]
  && import.meta.url.toLowerCase() === pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase();
if (invokedDirectly) {
  await main();
}
