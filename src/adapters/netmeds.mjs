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

// Discovery-time pre-filter. Netmeds lists masses of cosmetics/devices that each
// cost a wasted fetch before parseNetmedsProduct returns null. A drug slug almost
// always names a dosage form or an mg/mcg/iu strength; failing that we keep
// anything that is NOT a recognized cosmetic/device — so medicated creams, gels
// and lotions (which share words with cosmetics) are never pre-dropped. A short
// Rx-dermatology active list rescues medicated shampoos/soaps a cosmetic word
// would otherwise drop. The bias is deliberately toward KEEPING: a false keep
// costs one fetch (the composition check then skips it), a false drop silently
// loses a real drug — fatal for a completeness dataset. `ml` is intentionally NOT
// a strength signal here (cosmetics are dosed in ml too); `kit`/`trio` are NOT
// non-drug markers (drug combi-packs are named "…-kit").
const DRUG_FORM = /(tablets?|caplets?|capsules?|\bcaps?\b|respicaps?|rotacaps?|redicaps?|aerocaps?|rotahaler|revolizer|multihaler|inhalers?|injections?|\binj\b|\bpfs\b|prefilled|syrups?|suspensions?|\bsusp\b|\bdrops?\b|eye-?drops?|ear-?drops?|nasal|respules?|\bspray\b|sachets?|granules?|\bpowder\b|suppositor(?:y|ies)|pessar(?:y|ies)|\benema\b|mouthwash|gargle|lozenges?|\bvials?\b|ampoules?|\bpatch(?:es)?\b|elixir|linctus|ointments?|\d+\s?mg\b|\d+\s?mcg\b|\d+\s?iu\b|\bmg\b|\bmcg\b|\biu\b)/i;
const RX_ACTIVE = /(ketoconazole|ciclopirox|selenium-sulfide|zinc-pyrithione|coal-tar|salicylic|mupirocin|clobetasol|mometasone|betamethasone|permethrin|benzoyl-peroxide|clotrimazole|luliconazole|terbinafine|povidone-iodine|chlorhexidine)/i;
const NON_DRUG = /(\bmask\b|thermometer|glucomet|glucose-monitor|bp-monitor|nebuli[sz]er|oximeter|weighing|test-strips?|\blancets?\b|diapers?|sanitary|\bcondoms?\b|pregnancy-test|ovulation|wheelchair|walker|\bcrutch|gloves?|\bcotton\b|bandage|gauze|wipes?|sanitizer|hand-?wash|shampoo|conditioner|face-?wash|body-?wash|body-?lotion|body-?butter|shower-?gel|\bsoap\b|toothbrush|toothpaste|perfume|parfum|\beau-?de\b|cologne|deodorant|\broll-?on\b|sunscreen|moisturi[sz]er|lipstick|lip-?balm|lip-?gloss|lip-?liner|lip-?tint|\bblush\b|mascara|eye-?liner|eye-?shadow|\bkajal\b|foundation|concealer|\bcompact\b|highlighter|bronzer|\bprimer\b|\bcontour\b|make-?up|\btoner\b|micellar|\bcleanser\b|nail-?polish|nail-?paint|nail-?enamel|hair-?colou?r|hair-?fiber|hair-?serum|hair-?mask|\bmousse\b|face-?serum|face-?mask|sheet-?mask|shaving|\brazor\b|\btrimmer\b|epilator|\bbrace\b|tester|\bgift-?set\b|\bscrub\b|body-?mist|\bpalette\b|talcum|\bwax\b)/i;

export function isLikelyDrugSlug(pathOrSlug) {
  const s = String(pathOrSlug ?? '').toLowerCase().replace(/^\/product\//, '');
  return DRUG_FORM.test(s) || RX_ACTIVE.test(s) || !NON_DRUG.test(s);
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
