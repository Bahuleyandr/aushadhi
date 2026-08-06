import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { normMolecule } from '../lib/normalize.mjs';
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

// Apollo product Drug ld+json states composition as
//   "AMOXICILLIN-500MG+CLAVULANIC ACID-125MG"
// i.e. molecules joined by '+', each "MOLECULE-STRENGTH" (strength is the
// trailing -<num><unit>). Greedy molecule keeps hyphenated molecule names.
const PART_RE = /^(.+)-([\d.]+)\s*([a-zµ%/]+)$/i;
const APOLLO_PRODUCT_ORIGIN = 'https://www.apollopharmacy.in';
const APOLLO_PRODUCT_PATH = /^\/medicine\/[a-z0-9-]+$/;

export function parseApolloComposition(nonProprietaryName) {
  const parts = String(nonProprietaryName ?? '').split('+').map((s) => s.trim()).filter(Boolean);
  const ingredients = [];
  for (const p of parts) {
    const m = p.match(PART_RE);
    if (m) {
      const molecule = normMolecule(m[1]);
      if (molecule) {
        ingredients.push({
          molecule,
          strength_value: Number(m[2]),
          strength_unit: m[3].toLowerCase(),
          strength_raw: `${m[2]}${m[3]}`.toLowerCase(),
        });
      }
    } else {
      const molecule = normMolecule(p);
      if (molecule) ingredients.push({ molecule, strength_value: null, strength_unit: null, strength_raw: null });
    }
  }
  ingredients.sort((a, b) => a.molecule.localeCompare(b.molecule));
  return ingredients;
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

// Fail-safe negative signal: schema.org `Drug` is not allopathy-specific, and
// a template catalog can stamp it on any product page — so if the page's OWN
// structured data (any JSON-LD block: the Drug block, breadcrumb trail, FAQ)
// names an AYUSH system, the allopathy claim is withheld and the row keeps
// type null. Untrusted fields may only ever WITHHOLD a claim, never make one.
// The scan is confined to parsed JSON-LD — the site-wide nav names "Ayurveda"
// on every page, so a raw-HTML grep would false-positive universally.
const AYUSH_TERM_RE = /ayurved|homoeopath|homeopath|unani|siddha/i;

export function apolloProductUrlMatches(value, expectedPath) {
  if (typeof value !== 'string' || !APOLLO_PRODUCT_PATH.test(String(expectedPath))) return false;
  try {
    const url = new URL(value);
    return url.origin === APOLLO_PRODUCT_ORIGIN
      && !url.username && !url.password
      && url.pathname === expectedPath;
  } catch {
    return false;
  }
}

function drugIdentityMatches(drug, expectedPath) {
  const mainEntity = typeof drug.mainEntityOfPage === 'string'
    ? drug.mainEntityOfPage
    : (drug.mainEntityOfPage?.['@id'] ?? drug.mainEntityOfPage?.url);
  const identities = [drug.url, drug['@id'], mainEntity, drug.offers?.url]
    .filter((value) => value !== null && value !== undefined && value !== '');
  return typeof drug.url === 'string' && identities.length > 0
    && identities.every((value) => apolloProductUrlMatches(value, expectedPath));
}

// Parse an Apollo /medicine/<slug> product page -> common row shape (source='apollo').
export function parseApolloProduct(html, { expectedPath = null } = {}) {
  const $ = cheerio.load(html);
  const blocks = ldBlocks($);
  const drug = blocks.find((b) => b && b['@type'] === 'Drug') ?? null;
  if (!drug) return null;
  if (expectedPath !== null && !drugIdentityMatches(drug, expectedPath)) return null;
  const comp = typeof drug.nonProprietaryName === 'string' ? drug.nonProprietaryName : '';
  const ingredients = parseApolloComposition(comp);
  const manufacturer = drug.manufacturer?.legalName ?? drug.manufacturer?.name
    ?? (typeof drug.manufacturer === 'string' ? drug.manufacturer : null);
  return {
    source: 'apollo',
    brand_name: (drug.name ?? '').toString().trim() || null,
    manufacturer: manufacturer || null,
    form_raw: (drug.dosageForm ?? '').toString().trim() || null,
    ingredients,
    composition_raw: comp,
    composition_status: ingredients.length ? 'complete' : 'missing',
    substitutes_raw: [],
    is_discontinued: null,
    // Reaching this return means the page carried a schema.org `Drug` block —
    // a per-page category statement, not a crawl-scope inference; listings
    // without it never produce a row at all. But the claim is withheld when
    // the page's own JSON-LD names an AYUSH system (see AYUSH_TERM_RE): a
    // Drug-templated ayurvedic/homoeopathic proprietary keeps type null.
    type: blocks.some((b) => AYUSH_TERM_RE.test(JSON.stringify(b))) ? null : 'allopathy',
  };
}

// Parse an Apollo /salt/<slug> page -> the /medicine/ product paths it lists
// (used as a crawl seed: all products on a salt page share that composition).
export function parseApolloSaltPage(html) {
  const $ = cheerio.load(html);
  const paths = new Set();
  $('a[href^="/medicine/"]').each((_, el) => {
    const p = ($(el).attr('href') ?? '').split('?')[0];
    if (/^\/medicine\/[a-z0-9-]+$/.test(p)) paths.add(p);
  });
  return [...paths];
}

// Parse the /salts directory page -> every /salt/<slug> path (crawl seed).
export function parseApolloSaltDirectory(html) {
  const $ = cheerio.load(html);
  const paths = new Set();
  $('a[href^="/salt/"]').each((_, el) => {
    const p = ($(el).attr('href') ?? '').split('?')[0];
    if (/^\/salt\/[a-z0-9-]+$/.test(p)) paths.add(p);
  });
  return [...paths];
}

// Read all apollo crawl outputs (data/raw/apollo/<date>/normalized.jsonl) for
// the build merge; latest observation per stable source product ID wins.
export function readApolloNormalized(rawRoot) {
  const root = path.join(rawRoot, 'apollo');
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
