import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BlockedError, CapReachedError } from '../lib/politeness.mjs';
import { makeEcomFetcher } from '../lib/ecom-fetcher.mjs';
import { parseEasyProduct, parseSitemapLocs } from '../adapters/pharmeasy.mjs';
import { readJsonlSync } from '../lib/jsonl.mjs';
import { ctx } from '../lib/context.mjs';

const INDEX_SITEMAPS = ['/sitemaps/sitemap-prescription-medicines.xml', '/sitemaps/sitemap-otc-products.xml'];
const isStop = (e) => e instanceof BlockedError || e instanceof CapReachedError || /robots/i.test(e?.message ?? '');
const toPath = (u) => { try { return new URL(u, 'https://pharmeasy.in').pathname; } catch { return null; } };
const isProduct = (p) => /^\/online-medicine-order\/[a-z0-9-]+$/i.test(p ?? '');
const isSitemap = (p) => /\.xml$/i.test(p ?? '');

// Resumable PharmEasy crawl: walk product sitemaps -> product pages -> rows.
export async function main(log = console.log) {
  const c = ctx();
  const root = path.join(c.rawRoot, 'pharmeasy');
  await fsp.mkdir(path.join(root, c.date), { recursive: true });
  const indexFile = path.join(root, 'product-index.jsonl');
  const outFile = path.join(root, c.date, 'normalized.jsonl');
  const pf = makeEcomFetcher(c.rawRoot, 'pharmeasy', 'https://pharmeasy.in');
  await pf.init();

  try {
    if (!fs.existsSync(indexFile)) {
      const products = new Set();
      const queue = [...INDEX_SITEMAPS];
      const seen = new Set(queue);
      while (queue.length) {
        const sp = queue.shift();
        let xml;
        try { xml = await pf.get(sp); } catch (e) { if (isStop(e)) throw e; log(`pharmeasy: sitemap ${sp} failed: ${e.message}`); continue; }
        for (const u of parseSitemapLocs(xml)) {
          const p = toPath(u);
          if (!p) continue;
          if (isProduct(p)) products.add(p);
          else if (isSitemap(p) && !seen.has(p)) { seen.add(p); queue.push(p); }
        }
      }
      await fsp.writeFile(indexFile, [...products].map((p) => JSON.stringify({ path: p })).join('\n') + '\n');
      log(`pharmeasy: discovered ${products.size} products`);
    }
    const products = readJsonlSync(indexFile).map((e) => e.path);

    const done = new Set();
    for (const d of fs.readdirSync(root)) {
      const f = path.join(root, d, 'normalized.jsonl');
      if (fs.existsSync(f)) for (const r of readJsonlSync(f)) done.add(r.source_id);
    }

    pf.state.pharmeasy ??= { cursor: 0 };
    let ok = 0;
    for (; pf.state.pharmeasy.cursor < products.length; pf.state.pharmeasy.cursor++) {
      const prodPath = products[pf.state.pharmeasy.cursor];
      const id = prodPath.match(/-(\d+)$/)?.[1] ?? prodPath;
      if (done.has(id)) continue;
      let html;
      try { html = await pf.get(prodPath); } catch (e) { if (isStop(e)) throw e; log(`pharmeasy: ${prodPath} failed: ${e.message}`); continue; }
      const parsed = parseEasyProduct(html);
      if (!parsed?.brand_name || !parsed.ingredients.length) continue; // out-of-stock / no composition
      await fsp.appendFile(outFile, JSON.stringify({ ...parsed, source_id: id, seen_at: c.date, price_inr: null, type: null }) + '\n');
      done.add(id); ok++;
      if (pf.state.pharmeasy.cursor % 100 === 0) { await pf.persist(); log(`pharmeasy: ${pf.state.pharmeasy.cursor}/${products.length}, +${ok} products`); }
    }
    await pf.persist();
    log(`pharmeasy done: ${ok} products this run, ${done.size} total`);
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
