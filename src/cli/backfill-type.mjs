import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
// each source's cache and re-derives candidate `type` values with the same
// adapter code the live crawl uses. Dry-run is the default. An explicit apply
// writes an immutable, generation-scoped review candidate under
// data/raw/.type-backfill; it never mutates or shadows normalized runtime input.

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

const GENERATION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function assertGeneration(generation) {
  if (generation === null || generation === undefined || generation === '') {
    throw new TypeError('generation is required when apply is enabled');
  }
  if (!GENERATION_RE.test(String(generation))) {
    throw new TypeError(`invalid generation: ${generation}`);
  }
  return String(generation);
}

function withBackfillLock(rawRoot, work) {
  const lockDir = path.join(rawRoot, '.type-backfill.lock');
  fs.mkdirSync(rawRoot, { recursive: true });
  try {
    fs.mkdirSync(lockDir);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`backfill lock already exists: ${lockDir}`);
    throw error;
  }
  const ownerPath = path.join(lockDir, 'owner.json');
  try {
    fs.writeFileSync(ownerPath, `${JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() })}\n`, { flag: 'wx' });
    return work();
  } finally {
    if (fs.existsSync(ownerPath)) fs.unlinkSync(ownerPath);
    fs.rmdirSync(lockDir);
  }
}

function writeCandidate({ rawRoot, source, generation, patched, result }) {
  const candidateRoot = path.join(rawRoot, '.type-backfill');
  const generationRoot = path.join(candidateRoot, generation);
  const output = path.join(generationRoot, source);
  const staging = path.join(generationRoot, `.${source}.staging-${process.pid}`);
  fs.mkdirSync(generationRoot, { recursive: true });
  if (fs.existsSync(output)) throw new Error(`backfill candidate already exists: ${output}`);
  fs.mkdirSync(staging);
  const rowsText = `${patched.map((row) => JSON.stringify(row)).join('\n')}\n`;
  const rowsPath = path.join(staging, 'normalized.jsonl');
  const manifestPath = path.join(staging, 'manifest.json');
  try {
    fs.writeFileSync(rowsPath, rowsText, { flag: 'wx' });
    const manifest = {
      schema_version: 1,
      kind: 'type_backfill_review_candidate',
      generation_id: generation,
      source,
      promotion_authority: 'none',
      deployment_authority: 'none',
      rows_scanned: result.rows,
      cached_matches: result.cached,
      candidate_rows: result.patched,
      normalized_jsonl_sha256: createHash('sha256').update(rowsText).digest('hex'),
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(staging, output);
  } catch (error) {
    if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
    if (fs.existsSync(rowsPath)) fs.unlinkSync(rowsPath);
    if (fs.existsSync(staging)) fs.rmdirSync(staging);
    throw error;
  }
  return output;
}

export function backfillSource({
  rawRoot, source, apply = false, generation = null, log = console.log,
}) {
  const spec = SOURCES[source];
  if (!spec) throw new TypeError(`unknown backfill source: ${source}`);
  const generationId = apply ? assertGeneration(generation) : null;
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
  const result = {
    source, cached: typeById.size, rows: rows.length, patched: patched.length,
    mode: apply ? 'candidate' : 'dry-run', output: null,
  };
  if (apply && patched.length) {
    result.output = withBackfillLock(rawRoot, () => writeCandidate({
      rawRoot, source, generation: generationId, patched, result,
    }));
  }
  log(`backfill-type ${source}: mode=${result.mode}, cached=${result.cached}, rows=${result.rows}, patched=${result.patched}${result.output ? `, output=${result.output}` : ''}`);
  return result;
}

export function parseBackfillArgs(args) {
  let apply = false;
  let generation = null;
  const sources = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') {
      if (apply) throw new TypeError('duplicate --apply');
      apply = true;
    } else if (arg === '--generation') {
      if (generation !== null) throw new TypeError('duplicate --generation');
      generation = args[++i] ?? null;
      if (generation === null) throw new TypeError('--generation requires a value');
    } else if (arg.startsWith('-')) {
      throw new TypeError(`unknown option: ${arg}`);
    } else {
      sources.push(arg);
    }
  }
  if (apply && generation === null) throw new TypeError('--apply requires --generation <id>');
  if (!apply && generation !== null) throw new TypeError('--generation requires --apply');
  const selected = sources.length ? sources : Object.keys(SOURCES);
  for (const source of selected) {
    if (!SOURCES[source]) {
      throw new TypeError(`unknown source ${source}; expected one of: ${Object.keys(SOURCES).join(', ')}`);
    }
  }
  return { apply, generation, sources: selected };
}

export async function main() {
  const c = ctx();
  const options = parseBackfillArgs(process.argv.slice(2));
  for (const source of options.sources) {
    backfillSource({ rawRoot: c.rawRoot, source, ...options });
  }
}

const invokedDirectly = process.argv[1]
  && import.meta.url.toLowerCase() === pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase();
if (invokedDirectly) await main();
