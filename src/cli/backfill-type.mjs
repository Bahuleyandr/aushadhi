import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import * as cheerio from 'cheerio';
import { ctx } from '../lib/context.mjs';
import { parseDrugPage, readOnemgNormalized } from '../adapters/onemg.mjs';
import { parseApolloProduct, readApolloNormalized } from '../adapters/apollo.mjs';
import { parseNetmedsProduct, readNetmedsNormalized } from '../adapters/netmeds.mjs';
import { parseEasyProduct, readPharmeasyNormalized } from '../adapters/pharmeasy.mjs';

// Offline `type` backfill: the crawlers wrote `type: null` before the adapters
// learned to derive the category from per-page evidence. That evidence still
// lives in the raw page cache (data/raw/<source>/pages/), so already-crawled
// products can be re-parsed without a single network request. This tool walks
// each source's cache, re-derives `type` with the same adapter code the live
// crawl uses, and appends type-patched copies of the affected normalized rows
// under today's date dir — the read*Normalized latest-wins refresh then picks
// them up on the next build. Every other field, including seen_at, is kept
// verbatim: re-parsing a cached page is not a new observation.

function canonicalPath($, base) {
  const href = $('link[rel="canonical"]').attr('href');
  if (!href) return null;
  try { return new URL(href, base).pathname; } catch { return null; }
}

// Each identifier re-parses one cached page and must self-identify the product
// from the page's own canonical/embedded identity (the cache is keyed by a
// hash of the request path, so the path cannot be recovered from the file
// name). Pages that fail the adapter's validity gates, carry no category
// evidence, or cannot be identified are skipped — never guessed at.
function identifyOnemg(html) {
  const page = parseDrugPage(html);
  if (!page?.brand_name || !page.ingredients?.length || page.type !== 'allopathy') return null;
  const p = canonicalPath(cheerio.load(html), 'https://www.1mg.com');
  if (!p || !p.startsWith('/drugs/') || !/-\d+$/.test(p)) return null;
  return { sourceId: p.match(/-(\d+)$/)[1], type: page.type };
}

function identifyApollo(html) {
  const p = canonicalPath(cheerio.load(html), 'https://www.apollopharmacy.in');
  if (!p || !/^\/medicine\/[a-z0-9-]+$/.test(p)) return null;
  // expectedPath applies the adapter's full JSON-LD identity binding
  const parsed = parseApolloProduct(html, { expectedPath: p });
  if (!parsed?.brand_name || !parsed.ingredients?.length || parsed.type !== 'allopathy') return null;
  return { sourceId: p.replace(/^\/medicine\//, ''), type: parsed.type };
}

function identifyNetmeds(html) {
  const parsed = parseNetmedsProduct(html);
  if (!parsed?.brand_name || !parsed.ingredients?.length || parsed.type !== 'allopathy') return null;
  if (!parsed.source_id) return null;
  return { sourceId: String(parsed.source_id), type: parsed.type };
}

function identifyPharmeasy(html) {
  const parsed = parseEasyProduct(html);
  if (!parsed?.brand_name || !parsed.ingredients?.length || parsed.type !== 'allopathy') return null;
  if (!parsed.source_id) return null;
  return { sourceId: String(parsed.source_id), type: parsed.type };
}

const SOURCES = {
  onemg: { read: readOnemgNormalized, identify: identifyOnemg },
  apollo: { read: readApolloNormalized, identify: identifyApollo },
  netmeds: { read: readNetmedsNormalized, identify: identifyNetmeds },
  pharmeasy: { read: readPharmeasyNormalized, identify: identifyPharmeasy },
};

// Walk a source's page cache -> Map(source_id -> derived type). Honors the
// crawler's own cache contract: `.invalid` markers exclude an entry, and the
// retention-compressed `.html.gz` form is read like the primary.
export function scanCachedTypes(pagesDir, identify) {
  const byId = new Map();
  if (!fs.existsSync(pagesDir)) return byId;
  for (const name of fs.readdirSync(pagesDir).sort()) {
    if (!name.endsWith('.html') && !name.endsWith('.html.gz')) continue;
    if (fs.existsSync(path.join(pagesDir, `${name.replace(/\.gz$/, '')}.invalid`))) continue;
    let body;
    try {
      const bytes = fs.readFileSync(path.join(pagesDir, name));
      body = (name.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8');
    } catch {
      continue; // unreadable/corrupt entry: skip, never guess
    }
    const hit = identify(body);
    if (hit) byId.set(hit.sourceId, hit.type);
  }
  return byId;
}

export function backfillSource({ rawRoot, source, date, log = console.log }) {
  const spec = SOURCES[source];
  if (!spec) throw new TypeError(`unknown backfill source: ${source}`);
  const typeById = scanCachedTypes(path.join(rawRoot, source, 'pages'), spec.identify);
  const rows = spec.read(rawRoot);
  const patched = [];
  for (const row of rows) {
    if (row.type !== null && row.type !== undefined) continue;
    const type = row.source_id === null || row.source_id === undefined
      ? undefined : typeById.get(String(row.source_id));
    if (!type) continue;
    patched.push({ ...row, type });
  }
  if (patched.length) {
    const outDir = path.join(rawRoot, source, date);
    fs.mkdirSync(outDir, { recursive: true });
    fs.appendFileSync(
      path.join(outDir, 'normalized.jsonl'),
      `${patched.map((row) => JSON.stringify(row)).join('\n')}\n`,
    );
  }
  const result = { source, cached: typeById.size, rows: rows.length, patched: patched.length };
  log(`backfill-type ${source}: cached=${result.cached}, rows=${result.rows}, patched=${result.patched}`);
  return result;
}

export async function main() {
  const c = ctx();
  const sources = process.argv.slice(2);
  for (const source of sources) {
    if (!SOURCES[source]) {
      throw new TypeError(`unknown source ${source}; expected one of: ${Object.keys(SOURCES).join(', ')}`);
    }
  }
  for (const source of sources.length ? sources : Object.keys(SOURCES)) {
    backfillSource({ rawRoot: c.rawRoot, source, date: c.date });
  }
}

const invokedDirectly = process.argv[1]
  && import.meta.url.toLowerCase() === pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase();
if (invokedDirectly) await main();
