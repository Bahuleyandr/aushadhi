import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { parseComposition } from '../lib/composition.mjs';
import { readJsonlSync } from '../lib/jsonl.mjs';
import { identityKey } from '../lib/merge.mjs';

// Reads all gapfill outputs (data/raw/onemg/<date>/normalized.jsonl) for build
// merging. Last write per identity wins — files are date-sorted and lines are
// append-ordered, so a Map overwrite keeps only the freshest re-fetch (merge's
// stable rank-sort would otherwise let the OLDEST equal-rank row win forever).
export function readOnemgNormalized(rawRoot) {
  const root = path.join(rawRoot, 'onemg');
  if (!fs.existsSync(root)) return [];
  const byIdentity = new Map();
  for (const d of fs.readdirSync(root).sort()) {
    const f = path.join(root, d, 'normalized.jsonl');
    for (const row of readJsonlSync(f)) byIdentity.set(identityKey(row), row);
  }
  return [...byIdentity.values()];
}

// Balanced-extracts a JSON object or array starting at text[startIdx] ('{' or '[').
// Needed because 1mg inlines `window.__X__ = {...}; more js...` in one script tag.
export function extractBalancedJson(text, startIdx) {
  const open = text[startIdx];
  if (open !== '{' && open !== '[') return null;
  const close = open === '{' ? '}' : ']';
  const altOpen = open === '{' ? '[' : '{';
  const altClose = open === '{' ? ']' : '}';
  let depth = 0;
  let alt = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0 && alt === 0) return text.slice(startIdx, i + 1);
    } else if (c === altOpen) alt++;
    else if (c === altClose) alt--;
  }
  return null;
}

function jsonAtMarker(html, marker, brace) {
  const out = [];
  let from = 0;
  while (true) {
    const idx = html.indexOf(marker, from);
    if (idx === -1) break;
    const start = html.indexOf(brace, idx + marker.length - 1);
    if (start !== -1) {
      const raw = extractBalancedJson(html, start);
      if (raw) {
        try { out.push(JSON.parse(raw)); } catch { /* skip unparseable */ }
      }
    }
    from = idx + marker.length;
  }
  return out;
}

function ldBlocks($) {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).text());
      blocks.push(...(Array.isArray(j) ? j : [j]));
    } catch { /* skip bad JSON */ }
  });
  return blocks;
}

const stripTags = (s) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

export function parseDrugPage(html) {
  const $ = cheerio.load(html);
  const ld = ldBlocks($);
  const drug = ld.find((b) => b && b['@type'] === 'Drug') ?? null;

  let name = drug?.name ?? null;
  if (!name) {
    const og = html.match(/<meta property="og:title" content="([^"]+)"/);
    name = og ? og[1].replace(/\s*-\s*1mg.*$/i, '').trim() : null;
  }
  const manufacturer = drug?.marketer?.legalName ?? drug?.manufacturer?.name ?? null;

  // Composition: salt_composition.display_text (has strengths) > LD activeIngredient (names only)
  let compositionRaw = null;
  for (const sc of jsonAtMarker(html, '"salt_composition"', '{')) {
    if (sc && typeof sc.display_text === 'string' && sc.display_text) {
      compositionRaw = stripTags(sc.display_text);
      break;
    }
  }
  if (!compositionRaw && typeof drug?.activeIngredient === 'string') compositionRaw = drug.activeIngredient;
  const comp = compositionRaw ? parseComposition(compositionRaw) : { ingredients: [], status: 'missing', raw: '' };

  let packLabel = null;
  for (const priceData of jsonAtMarker(html, '"priceData"', '{')) {
    if (priceData && typeof priceData.packSizes === 'string' && priceData.packSizes.trim()) {
      packLabel = priceData.packSizes.trim();
      break;
    }
  }

  // Substitutes: every "substitutes":[...] array; entries carry entity_name (formulary widget)
  const subs = [];
  for (const arr of jsonAtMarker(html, '"substitutes"', '[')) {
    if (!Array.isArray(arr)) continue;
    for (const s of arr) {
      const n = s?.entity_name ?? s?.name ?? null;
      if (n) subs.push({ name: n, manufacturer: s.manufacturer_name ?? s.manufacturer?.name ?? null });
    }
  }

  return {
    brand_name: name,
    manufacturer,
    pack_label: packLabel,
    form_raw: drug?.dosageForm ?? null,
    ingredients: comp.ingredients,
    composition_raw: comp.raw || compositionRaw || '',
    composition_status: comp.status,
    substitutes_raw: [...new Map(subs.map((s) => [s.name, s])).values()],
    // a whole-page discontinued regex false-positives on embedded substitute
    // SKUs — leave unknown; merge falls back to the dataset sources' value
    is_discontinued: null,
  };
}

export function parseBrowsePage(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('a[href^="/drugs/"]').each((_, el) => {
    const path = ($(el).attr('href') ?? '').split('?')[0];
    if (!/-\d+$/.test(path)) return;
    const name = $(el).text().replace(/\s+/g, ' ').trim();
    out.push({ name: name || path.split('/').pop(), path });
  });
  // Paginated variants render the list only as schema.org ItemList JSON-LD (no anchors)
  const listItems = [];
  const collect = (node) => {
    if (Array.isArray(node)) { node.forEach(collect); return; }
    if (!node || typeof node !== 'object') return;
    if (node['@type'] === 'ListItem' && typeof node.url === 'string') listItems.push(node);
    for (const v of Object.values(node)) if (v && typeof v === 'object') collect(v);
  };
  collect(ldBlocks($));
  for (const li of listItems) {
    let p;
    try { p = new URL(li.url, 'https://www.1mg.com').pathname; } catch { continue; }
    if (!p.startsWith('/drugs/') || !/-\d+$/.test(p)) continue;
    out.push({ name: (li.name ?? p.split('/').pop()).toString().trim(), path: p });
  }
  return [...new Map(out.map((e) => [e.path, e])).values()];
}

export function parseBrowsePageInfo(html) {
  const entries = parseBrowsePage(html);
  const source = String(html ?? '');
  const marker = 'window.__ROUTER_INITIAL_DATA__';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return { entries, paginationKnown: false, next: null };
  const start = source.indexOf('{', markerIndex + marker.length);
  const raw = start >= 0 ? extractBalancedJson(source, start) : null;
  if (!raw) return { entries, paginationKnown: false, next: null };
  try {
    const router = JSON.parse(raw);
    const route = Object.values(router).find((candidate) => candidate?.data
      && Object.hasOwn(candidate.data, 'next'));
    if (!route || (route.data.next !== null && typeof route.data.next !== 'string')) {
      return { entries, paginationKnown: false, next: null };
    }
    return { entries, paginationKnown: true, next: route.data.next };
  } catch {
    return { entries, paginationKnown: false, next: null };
  }
}
