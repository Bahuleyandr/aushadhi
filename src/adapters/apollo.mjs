import * as cheerio from 'cheerio';
import { normMolecule } from '../lib/normalize.mjs';

// Apollo product Drug ld+json states composition as
//   "AMOXICILLIN-500MG+CLAVULANIC ACID-125MG"
// i.e. molecules joined by '+', each "MOLECULE-STRENGTH" (strength is the
// trailing -<num><unit>). Greedy molecule keeps hyphenated molecule names.
const PART_RE = /^(.+)-([\d.]+)\s*([a-zµ%/]+)$/i;

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

function drugSchema($) {
  let drug = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (drug) return;
    try {
      const j = JSON.parse($(el).text());
      for (const b of Array.isArray(j) ? j : [j]) if (b && b['@type'] === 'Drug') { drug = b; break; }
    } catch { /* skip bad JSON */ }
  });
  return drug;
}

// Parse an Apollo /medicine/<slug> product page -> common row shape (source='apollo').
export function parseApolloProduct(html) {
  const $ = cheerio.load(html);
  const drug = drugSchema($);
  if (!drug) return null;
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
