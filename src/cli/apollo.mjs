import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BlockedError, CapReachedError } from '../lib/politeness.mjs';
import { makeEcomFetcher } from '../lib/ecom-fetcher.mjs';
import { parseApolloSaltDirectory, parseApolloSaltPage, parseApolloProduct } from '../adapters/apollo.mjs';
import { readJsonlSync } from '../lib/jsonl.mjs';
import { ctx } from '../lib/context.mjs';

const SALTS_URL = '/salts';
const isStop = (e) => e instanceof BlockedError || e instanceof CapReachedError || /robots/i.test(e?.message ?? '');

// Resumable Apollo crawl: /salts -> salt pages -> product pages -> normalized rows.
// One salt page yields the brands sharing that composition; each product page's
// Drug ld+json gives the authoritative per-brand composition + strengths.
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
      await fsp.writeFile(saltIndexFile, salts.map((p) => JSON.stringify({ path: p })).join('\n') + '\n');
      log(`apollo: discovered ${salts.length} salts`);
    }
    const salts = readJsonlSync(saltIndexFile).map((e) => e.path);

    // resume: products already captured in any prior normalized.jsonl
    const seen = new Set();
    for (const d of fs.readdirSync(root)) {
      const f = path.join(root, d, 'normalized.jsonl');
      if (fs.existsSync(f)) for (const r of readJsonlSync(f)) seen.add(r.source_id);
    }

    pf.state.apollo ??= { saltCursor: 0 };
    let products = 0;
    for (; pf.state.apollo.saltCursor < salts.length; pf.state.apollo.saltCursor++) {
      const saltPath = salts[pf.state.apollo.saltCursor];
      let saltHtml;
      try { saltHtml = await pf.get(saltPath); } catch (e) {
        if (isStop(e)) throw e;
        log(`apollo: salt ${saltPath} failed: ${e.message}`); continue;
      }
      for (const prodPath of parseApolloSaltPage(saltHtml)) {
        const id = prodPath.replace('/medicine/', '');
        if (seen.has(id)) continue;
        seen.add(id);
        let prodHtml;
        try { prodHtml = await pf.get(prodPath); } catch (e) {
          if (isStop(e)) throw e;
          log(`apollo: product ${prodPath} failed: ${e.message}`); continue;
        }
        const parsed = parseApolloProduct(prodHtml);
        if (!parsed?.brand_name) continue;
        await fsp.appendFile(outFile, JSON.stringify({
          ...parsed, source_id: id, seen_at: c.date, pack_label: '', price_inr: null, type: null,
        }) + '\n');
        products++;
      }
      await pf.persist();
      if (pf.state.apollo.saltCursor % 25 === 0) {
        log(`apollo: salt ${pf.state.apollo.saltCursor}/${salts.length}, +${products} products this run`);
      }
    }
    log(`apollo done: ${products} products this run, ${seen.size} total`);
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
