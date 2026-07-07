import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseCsvSync } from 'csv-parse/sync';
import { BlockedError, CapReachedError } from '../lib/politeness.mjs';
import { makeOnemgFetcher } from '../lib/onemg-fetcher.mjs';
import { parseDrugPage, parseBrowsePage } from '../adapters/onemg.mjs';
import { buildQueue } from '../lib/gapfill-queue.mjs';
import { buildKnownCombos, likelyTruncated } from '../lib/known-combos.mjs';
import { normBrandName } from '../lib/normalize.mjs';
import { readJsonl, readJsonlSync } from '../lib/jsonl.mjs';
import { ctx } from '../lib/context.mjs';

const LABELS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function loadSlugIndex(indexFile) {
  const index = new Map();
  for (const e of readJsonlSync(indexFile)) index.set(e.norm, e.path);
  return index;
}

// Walks /drugs-all-medicines?label=X&page=N from a persisted per-label cursor.
export async function runDiscover({ pf, maxPages, indexFile, log = console.log }) {
  const index = loadSlugIndex(indexFile);
  pf.state.discover ??= { label: 0, page: 1 };
  const cur = pf.state.discover;
  let fetched = 0;
  let added = 0;
  while (fetched < maxPages && cur.label < LABELS.length) {
    const label = LABELS[cur.label];
    const pageNum = cur.page;
    // page 1 must be the bare label URL — 1mg serves an empty listing for &page=1
    const p = `/drugs-all-medicines?label=${label}${pageNum > 1 ? `&page=${pageNum}` : ''}`;
    let html;
    try {
      html = await pf.get(p);
    } catch (e) {
      // cap/block/robots problems are RUN problems, not label problems —
      // advancing the persisted cursor on them would permanently skip labels
      if (e instanceof BlockedError || e instanceof CapReachedError || /robots/i.test(e.message)) throw e;
      log(`discover: ${p} failed (${e.message}); moving to next label`);
      cur.label++; cur.page = 1;
      continue;
    }
    fetched++;
    const entries = parseBrowsePage(html);
    if (entries.length === 0 && pageNum === 1) {
      // every label has drugs; an empty page 1 means the parser broke, not the catalog
      throw new Error(`discover: label=${label} page 1 yielded 0 entries — parser/markup drift, refusing to advance cursor`);
    }
    const lines = [];
    for (const e of entries) {
      const norm = normBrandName(e.name);
      if (index.has(norm)) continue;
      index.set(norm, e.path);
      lines.push(JSON.stringify({ norm, name: e.name, path: e.path, seen_at: new Date().toISOString().slice(0, 10) }));
      added++;
    }
    if (lines.length) await fsp.appendFile(indexFile, lines.join('\n') + '\n');
    if (entries.length === 0) { cur.label++; cur.page = 1; } else cur.page++;
    log(`discover: label=${label} page=${pageNum} links=${entries.length} new=${lines.length}`);
    await pf.persist();
  }
  return { fetched, added, index };
}

export async function runTargeted({ pf, queue, outFile, discoveryFile, knownNorms, date, log = console.log }) {
  let ok = 0;
  let failed = 0;
  for (const entry of queue) {
    let html;
    try {
      html = await pf.get(entry.path);
    } catch (e) {
      if (e instanceof BlockedError || e instanceof CapReachedError) throw e;
      failed++;
      log(`gapfill: ${entry.path} failed: ${e.message}`);
      continue;
    }
    const page = parseDrugPage(html);
    const row = {
      source: 'onemg-live',
      source_id: entry.path.match(/-(\d+)$/)?.[1] ?? entry.path,
      seen_at: date,
      // identity comes from the TARGET row so merge lands on the same identity key
      brand_name: entry.brand_name ?? page.brand_name,
      manufacturer: entry.manufacturer ?? page.manufacturer ?? '',
      pack_label: entry.pack_label ?? '',
      form_raw: page.form_raw,
      price_inr: null,
      is_discontinued: page.is_discontinued,
      ingredients: page.ingredients,
      composition_raw: page.composition_raw,
      composition_status: page.composition_status,
      substitutes_raw: page.substitutes_raw,
      type: null, // never fabricate a category the page did not state
    };
    const discoveries = page.substitutes_raw
      .filter((s) => !knownNorms.has(normBrandName(s.name)))
      .map((s) => JSON.stringify({ name: s.name, seen_from: entry.path, seen_at: date }));
    await fsp.appendFile(outFile, JSON.stringify(row) + '\n');
    if (discoveries.length) await fsp.appendFile(discoveryFile, discoveries.join('\n') + '\n');
    ok++;
  }
  return { ok, failed };
}

// Fetches a random sample of unverified 2-slot rows and measures how many were
// actually truncated (page shows MORE molecules than the dataset). Sampled rows
// are written to normalized.jsonl like any targeted fetch — auditing also fixes.
export async function runAuditSample({ pf, rows, slugIndex, n, outFile, discoveryFile, knownNorms, date, kb, log = console.log }) {
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
  let fetched = 0;
  let truncated = 0;
  let likelyHits = 0;
  const examples = [];
  for (const entry of queue) {
    let html;
    try {
      html = await pf.get(entry.path);
    } catch (e) {
      if (e instanceof BlockedError || e instanceof CapReachedError) throw e;
      log(`audit: ${entry.path} failed: ${e.message}`);
      continue;
    }
    const page = parseDrugPage(html);
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
      type: null,
    };
    await fsp.appendFile(outFile, JSON.stringify(row) + '\n');
    const discoveries = page.substitutes_raw
      .filter((s) => !knownNorms.has(normBrandName(s.name)))
      .map((s) => JSON.stringify({ name: s.name, seen_from: entry.path, seen_at: date }));
    if (discoveries.length) await fsp.appendFile(discoveryFile, discoveries.join('\n') + '\n');
  }
  return {
    candidates: candidates.length, sampled: sample.length, fetched, truncated,
    rate: fetched ? Number(((100 * truncated) / fetched).toFixed(1)) : null,
    likelyHits, examples,
  };
}

async function main() {
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

  const onemgRoot = path.join(c.rawRoot, 'onemg');
  await fsp.mkdir(path.join(onemgRoot, c.date), { recursive: true });
  const pf = makeOnemgFetcher(c.rawRoot);
  await pf.init();

  const indexFile = path.join(onemgRoot, 'slug-index.jsonl');
  try {
    if (discover) {
      const maxPages = discover === true ? 50 : Number(discover);
      if (!Number.isFinite(maxPages) || maxPages <= 0) throw new Error(`invalid --discover page count: ${discover}`);
      const r = await runDiscover({ pf, maxPages, indexFile });
      console.log(`discover done: ${r.fetched} pages fetched, ${r.added} new slugs, index size ${r.index.size}`);
      return;
    }

    const drugsFile = 'dist/latest/drugs.jsonl';
    if (!fs.existsSync(drugsFile)) throw new Error('run `npm run build` first (dist/latest missing)');
    const rows = [];
    for await (const row of readJsonl(drugsFile)) rows.push(row);
    const conflicts = readJsonlSync('dist/latest/conflicts.jsonl');
    const catalogNames = new Set();
    if (typeof catalogExport === 'string') {
      const records = parseCsvSync(fs.readFileSync(catalogExport), { columns: true, bom: true, relax_column_count: true });
      for (const rec of records) {
        const name = (rec.name ?? Object.values(rec)[0] ?? '').toString().trim();
        if (name) catalogNames.add(normBrandName(name));
      }
    }
    const slugIndex = loadSlugIndex(indexFile);
    if (!slugIndex.size) {
      console.log('slug index empty — run `node src/cli/gapfill.mjs --discover [pages]` first to build it');
      return;
    }
    const kb = buildKnownCombos(rows);
    const knownNorms = new Set(rows.map((r) => normBrandName(r.brand_name)));

    if (auditSample) {
      const n = auditSample === true ? 50 : Number(auditSample);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`invalid --audit-sample count: ${auditSample}`);
      const report = await runAuditSample({
        pf, rows, slugIndex, n, kb,
        outFile: path.join(onemgRoot, c.date, 'normalized.jsonl'),
        discoveryFile: path.join(onemgRoot, 'discovery-queue.jsonl'),
        knownNorms, date: c.date,
      });
      console.log(`audit: ${JSON.stringify(report, null, 2)}`);
      return;
    }

    const { queue, skipped } = buildQueue({ rows, conflicts, slugIndex, catalogNames, limit, knownCombos: kb });
    console.log(`queue: ${queue.length} pages (${skipped} rows skipped, no slug; KB: ${kb.combos} known 3+ combos)`);
    const r = await runTargeted({
      pf,
      queue,
      outFile: path.join(onemgRoot, c.date, 'normalized.jsonl'),
      discoveryFile: path.join(onemgRoot, 'discovery-queue.jsonl'),
      knownNorms,
      date: c.date,
    });
    console.log(`gapfill done: ${r.ok} pages parsed, ${r.failed} failed`);
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
if (invokedDirectly) {
  await main();
}
