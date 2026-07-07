import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PoliteFetcher, BlockedError } from '../lib/politeness.mjs';
import { parseDrugPage, parseBrowsePage } from '../adapters/onemg.mjs';
import { buildQueue } from '../lib/gapfill-queue.mjs';
import { normBrandName } from '../lib/normalize.mjs';
import { ctx } from '../lib/context.mjs';

const LABELS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function loadSlugIndex(indexFile) {
  const index = new Map();
  if (!fs.existsSync(indexFile)) return index;
  for (const line of fs.readFileSync(indexFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      index.set(e.norm, e.path);
    } catch { /* skip corrupt line */ }
  }
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
      if (e instanceof BlockedError) throw e;
      log(`discover: ${p} failed (${e.message}); moving to next label`);
      cur.label++; cur.page = 1;
      continue;
    }
    fetched++;
    const entries = parseBrowsePage(html);
    let newHere = 0;
    for (const e of entries) {
      const norm = normBrandName(e.name);
      if (index.has(norm)) continue;
      index.set(norm, e.path);
      await fsp.appendFile(indexFile, JSON.stringify({ norm, name: e.name, path: e.path, seen_at: new Date().toISOString().slice(0, 10) }) + '\n');
      newHere++;
      added++;
    }
    if (entries.length === 0) { cur.label++; cur.page = 1; } else cur.page++;
    log(`discover: label=${label} page=${pageNum} links=${entries.length} new=${newHere}`);
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
      if (e instanceof BlockedError) throw e;
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
      type: 'allopathy',
    };
    await fsp.appendFile(outFile, JSON.stringify(row) + '\n');
    ok++;
    for (const s of page.substitutes_raw) {
      if (!knownNorms.has(normBrandName(s.name))) {
        await fsp.appendFile(discoveryFile, JSON.stringify({ name: s.name, seen_from: entry.path, seen_at: date }) + '\n');
      }
    }
  }
  return { ok, failed };
}

async function main() {
  const c = ctx();
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? null : (args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? true : args[i + 1]);
  };
  const limit = Number(flag('limit') ?? 200);
  const discover = flag('discover');
  const catalogExport = flag('catalog-export');

  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const onemgRoot = path.join(c.rawRoot, 'onemg');
  await fsp.mkdir(path.join(onemgRoot, c.date), { recursive: true });
  const pf = new PoliteFetcher({
    baseUrl: 'https://www.1mg.com',
    cacheDir: path.join(onemgRoot, 'pages'),
    stateFile: path.join(onemgRoot, 'state.json'),
    userAgent: `aushadhi-dataset-builder/${pkg.version} (contact: safari-oil-shelve@duck.com)`,
  });
  await pf.init();

  const indexFile = path.join(onemgRoot, 'slug-index.jsonl');
  try {
    if (discover) {
      const maxPages = discover === true ? 50 : Number(discover);
      const r = await runDiscover({ pf, maxPages, indexFile });
      console.log(`discover done: ${r.fetched} pages fetched, ${r.added} new slugs, index size ${r.index.size}`);
      return;
    }

    const drugsFile = 'dist/latest/drugs.jsonl';
    if (!fs.existsSync(drugsFile)) throw new Error('run `npm run build` first (dist/latest missing)');
    const rows = fs.readFileSync(drugsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const conflictsCsv = 'dist/latest/conflicts.csv';
    const conflicts = fs.existsSync(conflictsCsv)
      ? fs.readFileSync(conflictsCsv, 'utf8').split('\n').slice(1).filter(Boolean)
        .map((l) => ({ identity_key: l.split(',')[1] }))
      : [];
    const catalogNames = new Set();
    if (typeof catalogExport === 'string') {
      for (const line of fs.readFileSync(catalogExport, 'utf8').split('\n').slice(1)) {
        const name = line.split(',')[0]?.trim();
        if (name) catalogNames.add(normBrandName(name));
      }
    }
    const slugIndex = loadSlugIndex(indexFile);
    if (!slugIndex.size) {
      console.log('slug index empty — run `npm run gapfill -- --discover [pages]` first to build it');
      return;
    }
    const { queue, skipped } = buildQueue({ rows, conflicts, slugIndex, catalogNames, limit });
    console.log(`queue: ${queue.length} pages (${skipped} rows skipped, no slug)`);
    const knownNorms = new Set(rows.map((r) => normBrandName(r.brand_name)));
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
    if (e instanceof BlockedError) {
      console.error(`BLOCKED: ${e.message} — state persisted, resume later`);
      process.exit(2);
    }
    throw e;
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
