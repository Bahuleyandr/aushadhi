import fs from 'node:fs';
import path from 'node:path';
import { parseComposition } from '../lib/composition.mjs';
import { pdfToText } from '../lib/pdftotext.mjs';

// NPPA (National Pharmaceutical Pricing Authority) NLEM ceiling-price list —
// official formulation→composition→strength→PRICE. The direct PDF is WAF-gated
// (403 to non-browsers), so this is operator-drop like CDSCO: put the browser-
// downloaded PDF(s) in data/raw/nppa/ and they are pdftotext -layout'd at build.
//
// Real column layout (verified 2026 "All Drugs Ceiling Prices" export):
//   SL No | NLEM Version | Formulation | Dosage & Strength | SO Number | SO Date | Ceiling Price
//   1  2011  Acetylsalicylic acid  Tablet 300 mg  1582(E)  25-Mar-2026  ₹ 0.28(1 Tablet)
// pdftotext renders ₹ as a stray glyph; the ceiling price is the decimal right
// before the "(unit)". A minority of rows wrap across lines, but the SL-No line
// carries formulation+strength+price for the large majority — so we parse per
// SL-No line and let continuations / repeated headers / device rows return null.
const FORM_WORDS = /\b(powder for injection|prolonged release|modified release|sustained release|enteric coated|effervescent|dispersible|nasal spray|metered dose|dry powder|eye drops?|ear drops?|tablets?|capsules?|injections?|inhalation|infusion|respules?|syrups?|suspensions?|oral solution|solutions?|creams?|ointments?|gels?|lotions?|drops?|spray|vials?|pessary|suppository|ip|bp|usp)\b/gi;
const STRENGTH_RE = /([\d.]+\s*(?:mg\/ml|mcg\/ml|iu\/ml|mg|mcg|g|ml|iu|%)(?:\s*[+/]\s*[\d.]+\s*(?:mg|mcg|g|ml|iu|%))*)/i;
const SO_RE = /\d+\s*\(E\)/;                    // SO Number, e.g. 1582(E)
const PRICE_RE = /([\d,]+\.\d{1,2})\s*\(/g;     // ceiling price = decimal before (unit)
const NON_DRUG = /\b(device|condom|stent|dressing|catheter|cannula|glucometer)\b/i;

export function parseNppaLine(line) {
  const m = String(line ?? '').match(/^\s*(\d+)\s+(20\d{2})\s+(.+\S)\s*$/); // SL No + NLEM year + rest
  if (!m) return null;
  const rest = m[3].replace(/\s+/g, ' ').trim();
  let ceiling_price = null;
  for (const pm of rest.matchAll(PRICE_RE)) ceiling_price = Number(pm[1].replace(/,/g, '')); // rightmost = price
  const soIdx = rest.search(SO_RE);
  const head = (soIdx >= 0 ? rest.slice(0, soIdx) : rest).replace(/\([AB]\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!head || NON_DRUG.test(head)) return null; // skip devices / non-drug entries
  const strM = head.match(STRENGTH_RE);
  const strength = strM ? strM[1].replace(/\s+/g, '') : null;
  const formulation = head
    .replace(strM ? strM[0] : '', ' ')
    .replace(FORM_WORDS, ' ')
    .replace(/(^|\s)\d+(?:\.\d+)?(?=\s|$)/g, ' ') // stray strength digits left by combos
    .replace(/\s+/g, ' ')
    .replace(/^[\s+/-]+|[\s+/-]+$/g, '')          // trailing/leading joiners from wrapped forms/combos
    .trim();
  if (!formulation || formulation.length < 3) return null;
  return { formulation, strength, ceiling_price };
}

// Turn "Amoxycillin + Clavulanic Acid Tablets" + "500mg+125mg" into a common row.
function nppaRow(entry, date) {
  const molText = entry.formulation.replace(FORM_WORDS, ' ').replace(/\s+/g, ' ').trim();
  // pair molecules with strengths positionally when both are '+'-separated
  const mols = molText.split(/\s*\+\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  const strengths = (entry.strength ?? '').split('+').map((s) => s.trim());
  const compStr = mols.map((m, i) => (strengths[i] ? `${m} (${strengths[i]})` : m)).join(' + ');
  const comp = parseComposition(compStr);
  if (!comp.ingredients.length) return null;
  return {
    source: 'nppa',
    brand_name: entry.formulation,
    manufacturer: 'NPPA (ceiling price)',
    pack_label: '',
    form_raw: null,
    price_inr: entry.ceiling_price,
    is_discontinued: null,
    ingredients: comp.ingredients,
    composition_raw: comp.raw,
    composition_status: comp.status,
    substitutes_raw: [],
    type: 'allopathy',
    seen_at: date,
  };
}

export async function parseNppaText(text, date) {
  const rows = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const entry = parseNppaLine(line);
    if (entry) { const r = nppaRow(entry, date); if (r) rows.push(r); }
  }
  return rows;
}

// Scan operator-dropped NPPA files (data/raw/nppa/**.pdf|.txt) -> rows.
export async function loadNppaRows(rawRoot, date = new Date().toISOString().slice(0, 10)) {
  const root = path.join(rawRoot, 'nppa');
  if (!fs.existsSync(root)) return [];
  const out = [];
  const files = fs.readdirSync(root).map((f) => path.join(root, f));
  for (const f of files) {
    let text = null;
    if (/\.txt$/i.test(f)) text = fs.readFileSync(f, 'utf8');
    else if (/\.pdf$/i.test(f)) {
      const txt = f.replace(/\.pdf$/i, '.txt');
      try { if (!fs.existsSync(txt)) { const r = await pdfToText(f, txt); if (r.skipped) continue; } text = fs.readFileSync(txt, 'utf8'); } catch { continue; }
    }
    if (text) for (const row of await parseNppaText(text, date)) out.push(row);
  }
  return out;
}
