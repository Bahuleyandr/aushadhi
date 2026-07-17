import fs from 'node:fs';
import path from 'node:path';
import { normMolecule } from '../lib/normalize.mjs';
import { extractBalancedJson } from './onemg.mjs';
import { readJsonlSync } from '../lib/jsonl.mjs';
import { identityKey } from '../lib/merge.mjs';

// Netmeds composition is "Metformin 500 mg" (space-separated MOL STRENGTH UNIT),
// "+"-joined for combos ("Amoxicillin 500 mg+Clavulanic Acid 125 mg").
const PART_RE = /^(.+?)\s+([\d.]+)\s*(mg|mcg|g|ml|iu|kiu|%|units?)\b/i;

export function parseNetmedsComposition(generic) {
  const parts = String(generic ?? '').split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean);
  const ingredients = [];
  for (const p of parts) {
    const m = p.match(PART_RE);
    if (m) {
      const molecule = normMolecule(m[1]);
      if (molecule) ingredients.push({ molecule, strength_value: Number(m[2]), strength_unit: m[3].toLowerCase(), strength_raw: `${m[2]}${m[3]}`.toLowerCase() });
    } else {
      const molecule = normMolecule(p);
      if (molecule) ingredients.push({ molecule, strength_value: null, strength_unit: null, strength_raw: null });
    }
  }
  ingredients.sort((a, b) => a.molecule.localeCompare(b.molecule));
  return ingredients;
}

function extractInitialState(html) {
  const s = String(html ?? '').indexOf('__INITIAL_STATE__');
  if (s < 0) return null;
  const b = html.indexOf('{', s);
  if (b < 0) return null;
  const raw = extractBalancedJson(html, b);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Parse a Netmeds /product/<slug> page. Returns null for non-drug SKUs (devices,
// herbal, anything with no generic composition) — the automatic device filter.
export function parseNetmedsProduct(html) {
  const st = extractInitialState(html);
  const a = st?.productDetailsPage?.product?.attributes;
  if (!a) return null;
  const generic = (a.genericnamewithdosage ?? a.genericname ?? '').toString();
  // device/herbal filter: a real allopathic composition carries a dosage number
  // ("Metformin 500 mg"); category text ("Ayurvedic Medicine") has no digit.
  if (!/\d/.test(generic)) return null;
  const ingredients = parseNetmedsComposition(generic);
  if (!ingredients.length) return null; // device / herbal / no composition -> skip
  return {
    source: 'netmeds',
    brand_name: (a['mstar-displaynamewops'] ?? a.brand_name ?? '').toString().trim() || null,
    manufacturer: (a.manufacturername ?? a.marketername ?? '').toString().trim() || null,
    form_raw: (a.releasetypename ?? '').toString().trim() || null,
    ingredients,
    composition_raw: generic,
    composition_status: 'complete',
    substitutes_raw: [],
    is_discontinued: null,
  };
}

export function parseSitemapLocs(xml) {
  return [...String(xml ?? '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

export function readNetmedsNormalized(rawRoot) {
  const root = path.join(rawRoot, 'netmeds');
  if (!fs.existsSync(root)) return [];
  const byIdentity = new Map();
  for (const d of fs.readdirSync(root).sort()) {
    const f = path.join(root, d, 'normalized.jsonl');
    if (fs.existsSync(f)) for (const row of readJsonlSync(f)) byIdentity.set(identityKey(row), row);
  }
  return [...byIdentity.values()];
}
