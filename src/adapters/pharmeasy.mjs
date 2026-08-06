import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { parseComposition } from '../lib/composition.mjs';
import { readJsonlSync } from '../lib/jsonl.mjs';

function retainLatestSourceProduct(byProduct, row) {
  const hasSourceId = row.source_id !== null && row.source_id !== undefined
    && String(row.source_id) !== '';
  const key = hasSourceId
    ? `${row.source ?? ''}|${String(row.source_id)}`
    : JSON.stringify([
      row.source ?? '', row.brand_name ?? '', row.manufacturer ?? '', row.form_raw ?? '',
      row.pack_label ?? '', row.ingredients ?? [], row.composition_raw ?? '',
    ]);
  const previous = byProduct.get(key);
  if (!previous) {
    byProduct.set(key, { ...row, first_seen: row.first_seen ?? row.seen_at ?? null });
    return;
  }
  const firstSeen = [previous.first_seen, previous.seen_at, row.first_seen, row.seen_at]
    .filter(Boolean).sort()[0] ?? null;
  const latest = String(row.seen_at ?? '') >= String(previous.seen_at ?? '') ? row : previous;
  byProduct.set(key, { ...latest, first_seen: firstSeen });
}

// PharmEasy composition (from __NEXT_DATA__): "Telmisartan(80.0 Mg)+Chlorthalidone
// / Chlortalidone(12.5 Mg)". The MOL(strength)+MOL(strength) shape matches
// composition.mjs; we only drop " / <alt spelling>" inside each molecule and
// normalize the space before the trailing (strength) so parseComposition parses it.
export function parseEasyComposition(name) {
  const cleaned = String(name ?? '').split(/\s*\+\s*/).map((part) => {
    const m = part.match(/^(.+?)\s*(\([^()]*\))\s*$/);
    if (m) return `${m[1].split('/')[0].trim()} ${m[2]}`;
    return part.split('/')[0].trim();
  }).filter(Boolean).join(' + ');
  return parseComposition(cleaned).ingredients;
}

// The product data is deep in __NEXT_DATA__; find the node that carries a
// non-empty compositions array plus a name.
function findProductNode(root) {
  let found = null;
  const seen = new Set();
  const walk = (o) => {
    if (found || !o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o.compositions) && o.compositions.length && o.name) { found = o; return; }
    for (const v of Object.values(o)) walk(v);
  };
  walk(root);
  return found;
}

export function parseEasyProduct(html, expectedProductId = null) {
  const $ = cheerio.load(html);
  let nd;
  try { nd = JSON.parse($('#__NEXT_DATA__').text()); } catch { return null; }
  const p = findProductNode(nd);
  if (!p) return null;
  const embeddedProductId = p.productId === null || p.productId === undefined
    ? null : String(p.productId);
  const canonical = $('link[rel="canonical"]').attr('href');
  let canonicalProductId = null;
  if (canonical) {
    try {
      const pathname = new URL(canonical, 'https://pharmeasy.in').pathname;
      if (!pathname.startsWith('/online-medicine-order/')) return null;
      canonicalProductId = pathname.match(/-(\d+)$/)?.[1] ?? null;
    } catch {
      return null;
    }
  }
  if (embeddedProductId && canonicalProductId && embeddedProductId !== canonicalProductId) return null;
  if (expectedProductId !== null && expectedProductId !== undefined) {
    const expected = String(expectedProductId);
    if (embeddedProductId !== expected || (canonicalProductId !== null && canonicalProductId !== expected)) {
      return null;
    }
  }
  const sourceId = embeddedProductId ?? canonicalProductId;
  const compName = p.compositions.map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean).join(' + ');
  const ingredients = parseEasyComposition(compName);
  const mfr = p.manufacturerName ?? (typeof p.manufacturer === 'string' ? p.manufacturer : p.manufacturer?.name);
  return {
    source: 'pharmeasy',
    ...(sourceId === null ? {} : { source_id: sourceId }),
    brand_name: (p.name ?? '').toString().trim() || null,
    manufacturer: (mfr ?? '').toString().trim() || null,
    pack_label: (p.measurementUnit ?? p.packform ?? '').toString().trim(),
    form_raw: null,
    ingredients,
    composition_raw: compName,
    composition_status: ingredients.length ? 'complete' : 'missing',
    substitutes_raw: [],
    is_discontinued: null,
    // isRxRequired === true is the one product-node field whose meaning is
    // certain: prescription-only sale under the Drugs & Cosmetics Rules
    // schedules, a modern-medicine classification. productType is an
    // unlabelled numeric enum and the therapy vocabulary is unverified, so
    // neither is trusted as category evidence; rows without the Rx flag
    // (including OTC allopathic products) keep type null (fail closed).
    type: p.isRxRequired === true ? 'allopathy' : null,
  };
}

// Extract <loc> entries from a sitemap XML (works for index + url sitemaps).
export function parseSitemapLocs(xml) {
  return [...String(xml ?? '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

export function readPharmeasyNormalized(rawRoot) {
  const root = path.join(rawRoot, 'pharmeasy');
  if (!fs.existsSync(root)) return [];
  const byProduct = new Map();
  for (const d of fs.readdirSync(root).sort()) {
    const f = path.join(root, d, 'normalized.jsonl');
    if (fs.existsSync(f)) {
      for (const row of readJsonlSync(f)) retainLatestSourceProduct(byProduct, row);
    }
  }
  return [...byProduct.values()];
}
