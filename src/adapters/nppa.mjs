import fs from 'node:fs';
import path from 'node:path';
import { parseComposition } from '../lib/composition.mjs';
import { pdfToText } from '../lib/pdftotext.mjs';

// NPPA (National Pharmaceutical Pricing Authority) ceiling-price / formulation
// lists — official brand→composition→strength→PRICE. The direct PDF is WAF-gated
// (403 to non-browsers), so this is operator-drop like CDSCO: put the browser-
// downloaded PDF(s) in data/raw/nppa/ and they get parsed at build time.
//
// pdftotext -layout row shape (verify against the real notification — columns
// drift between NPPA notifications):
//   <Sl.No>  <Formulation / Brand Name>  <Strength>  <Unit/Pack>  <Ceiling Price>
const PRICE_RE = /(\d+(?:\.\d{1,2}))\s*$/;
const STRENGTH_RE = /([\d.]+\s*(?:mg|mcg|g|ml|iu|%)(?:\s*[+/]\s*[\d.]+\s*(?:mg|mcg|g|ml|iu|%))*)/i;
const FORM_WORDS = /\b(tablets?|capsules?|injections?|syrups?|suspensions?|oral solution|creams?|gels?|drops?|ip|bp|usp)\b/gi;

export function parseNppaLine(line) {
  const t = (line ?? '').replace(/\s+/g, ' ').trim();
  const sl = t.match(/^(\d+)\s+(.+)$/);
  if (!sl) return null;
  let rest = sl[2];
  const priceM = rest.match(PRICE_RE);
  const ceiling_price = priceM ? Number(priceM[1]) : null;
  if (priceM) rest = rest.slice(0, priceM.index).trim();
  const strM = rest.match(STRENGTH_RE);
  const strength = strM ? strM[1].replace(/\s+/g, '') : null;
  const formulation = (strM ? rest.slice(0, strM.index) : rest).replace(/\s+/g, ' ').trim();
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
