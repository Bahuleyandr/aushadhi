import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { parseComposition } from '../lib/composition.mjs';
import { readJsonlSync } from '../lib/jsonl.mjs';
import { identityKey } from '../lib/merge.mjs';

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

export function parseEasyProduct(html) {
  const $ = cheerio.load(html);
  let nd;
  try { nd = JSON.parse($('#__NEXT_DATA__').text()); } catch { return null; }
  const p = findProductNode(nd);
  if (!p) return null;
  const compName = p.compositions.map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean).join(' + ');
  const ingredients = parseEasyComposition(compName);
  const mfr = p.manufacturerName ?? (typeof p.manufacturer === 'string' ? p.manufacturer : p.manufacturer?.name);
  return {
    source: 'pharmeasy',
    brand_name: (p.name ?? '').toString().trim() || null,
    manufacturer: (mfr ?? '').toString().trim() || null,
    pack_label: (p.measurementUnit ?? p.packform ?? '').toString().trim(),
    form_raw: null,
    ingredients,
    composition_raw: compName,
    composition_status: ingredients.length ? 'complete' : 'missing',
    substitutes_raw: [],
    is_discontinued: null,
  };
}

// Extract <loc> entries from a sitemap XML (works for index + url sitemaps).
export function parseSitemapLocs(xml) {
  return [...String(xml ?? '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

export function readPharmeasyNormalized(rawRoot) {
  const root = path.join(rawRoot, 'pharmeasy');
  if (!fs.existsSync(root)) return [];
  const byIdentity = new Map();
  for (const d of fs.readdirSync(root).sort()) {
    const f = path.join(root, d, 'normalized.jsonl');
    if (fs.existsSync(f)) for (const row of readJsonlSync(f)) byIdentity.set(identityKey(row), row);
  }
  return [...byIdentity.values()];
}
