import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BlockedError, CapReachedError } from '../lib/politeness.mjs';
import { makeEcomFetcher } from '../lib/ecom-fetcher.mjs';
import { parseNetmedsProduct, parseSitemapLocs, isLikelyDrugSlug } from '../adapters/netmeds.mjs';
import { readJsonlSync } from '../lib/jsonl.mjs';
import { ctx } from '../lib/context.mjs';

const isStop = (e) => e instanceof BlockedError || e instanceof CapReachedError || /robots/i.test(e?.message ?? '');
const toPath = (u) => { try { return new URL(u, 'https://www.netmeds.com').pathname; } catch { return null; } };
const isProduct = (p) => /^\/product\/[a-z0-9-]+$/i.test(p ?? '');
const isProductSitemap = (p) => /\/sitemap\/products\/.*\.xml$/i.test(p ?? '');

// Resumable Netmeds crawl: /sitemap.xml -> product sitemaps -> product pages.
// Non-drug SKUs (devices/herbal, no generic composition) parse to null and are
// skipped automatically.
export async function main(log = console.log) {
  const c = ctx();
  const root = path.join(c.rawRoot, 'netmeds');
  await fsp.mkdir(path.join(root, c.date), { recursive: true });
  const indexFile = path.join(root, 'product-index.jsonl');
  const outFile = path.join(root, c.date, 'normalized.jsonl');
  const pf = makeEcomFetcher(c.rawRoot, 'netmeds', 'https://www.netmeds.com');
  await pf.init();

  try {
    if (!fs.existsSync(indexFile)) {
      const products = new Set();
      let prefiltered = 0;
      const queue = ['/sitemap.xml'];
      const seen = new Set(queue);
      while (queue.length) {
        const sp = queue.shift();
        let xml;
        try { xml = await pf.get(sp); } catch (e) { if (isStop(e)) throw e; log(`netmeds: sitemap ${sp} failed: ${e.message}`); continue; }
        for (const u of parseSitemapLocs(xml)) {
          const p = toPath(u);
          if (!p) continue;
          if (isProduct(p)) { if (isLikelyDrugSlug(p)) products.add(p); else prefiltered++; } // skip cosmetics/devices up front
          else if (isProductSitemap(p) && !seen.has(p)) { seen.add(p); queue.push(p); }
        }
      }
      await fsp.writeFile(indexFile, [...products].map((p) => JSON.stringify({ path: p })).join('\n') + '\n');
      log(`netmeds: discovered ${products.size} drug-like products (${prefiltered} non-drug SKUs pre-filtered)`);
    }
    let products = readJsonlSync(indexFile).map((e) => e.path);
    // migrate an index built before the pre-filter existed: drop the non-drug SKUs
    // in place and restart the cursor (positions shift). `done` (built next from
    // normalized.jsonl) guarantees no already-fetched drug is re-fetched — the
    // re-scan only skips known ids in memory and fetches genuinely new drug pages.
    const drugLike = products.filter(isLikelyDrugSlug);
    if (drugLike.length < products.length) {
      await fsp.writeFile(indexFile, drugLike.map((p) => JSON.stringify({ path: p })).join('\n') + '\n');
      pf.state.netmeds ??= { cursor: 0 };
      pf.state.netmeds.cursor = 0;
      await pf.persist();
      log(`netmeds: pre-filtered index ${products.length} -> ${drugLike.length} (dropped ${products.length - drugLike.length} non-drug SKUs); cursor reset`);
      products = drugLike;
    }

    const done = new Set();
    for (const d of fs.readdirSync(root)) {
      const f = path.join(root, d, 'normalized.jsonl');
      if (fs.existsSync(f)) for (const r of readJsonlSync(f)) done.add(r.source_id);
    }

    pf.state.netmeds ??= { cursor: 0 };
    let ok = 0;
    for (; pf.state.netmeds.cursor < products.length; pf.state.netmeds.cursor++) {
      const prodPath = products[pf.state.netmeds.cursor];
      const id = prodPath.match(/-(\d+)$/)?.[1] ?? prodPath;
      if (done.has(id)) continue;
      let html;
      try { html = await pf.get(prodPath); } catch (e) { if (isStop(e)) throw e; log(`netmeds: ${prodPath} failed: ${e.message}`); continue; }
      const parsed = parseNetmedsProduct(html);
      if (!parsed?.brand_name || !parsed.ingredients.length) continue; // non-drug SKU
      await fsp.appendFile(outFile, JSON.stringify({ ...parsed, source_id: id, seen_at: c.date, pack_label: '', price_inr: null, type: null }) + '\n');
      done.add(id); ok++;
      if (pf.state.netmeds.cursor % 100 === 0) { await pf.persist(); log(`netmeds: ${pf.state.netmeds.cursor}/${products.length}, +${ok} drugs`); }
    }
    await pf.persist();
    log(`netmeds done: ${ok} drugs this run, ${done.size} total`);
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
