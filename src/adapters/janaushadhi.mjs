import fs from 'node:fs';
import path from 'node:path';
import { normMolecule } from '../lib/normalize.mjs';
import { downloadToFile } from '../lib/download.mjs';
import { pdfToText } from '../lib/pdftotext.mjs';

// PIB attachment URLs rot — override via env when a newer PMBJP list ships,
// or drop a pmbjp.pdf into the snapshot dir manually (operator-drop wins).
const PDF_URL = process.env.AUSHADHI_PMBJP_URL
  ?? 'https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/feb/doc202626781701.pdf';

const ROW_RE = /^\s*(\d+)\s+(\S+)\s{2,}(.+)$/;
const TRAILING_UNIT_RE = /^(.*\S)\s{2,}(\S.*)$/;
const FORM_WORDS = /\b(tablets?|capsules?|injections?|inj|syrups?|suspension|oral|solutions?|creams?|ointments?|gels?|drops?|eye|ear|nasal|sprays?|ip|bp|usp|gastro-?resistant|prolonged release|extended release|sustained release|dispersible|chewable|film coated|mouth dissolving|powder|sachets?|respules?|inhalers?|lotions?|shampoos?|soaps?|patch(es)?|granules?|kit|per)\b/gi;
const STRENGTH_TOKEN = /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|gm|g|ml|iu|%[\w\/]*)\b/i;

function parsePart(part) {
  const st = part.match(STRENGTH_TOKEN);
  let molText = st ? part.slice(0, st.index) : part;
  molText = molText.replace(/\([^)]*\)/g, ' ').replace(FORM_WORDS, ' ').replace(/[^a-zA-Z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!molText) return null;
  return {
    molecule: normMolecule(molText),
    strength_value: st ? Number(st[1]) : null,
    strength_unit: st ? st[2].replace(/\s+/g, '').toLowerCase() : null,
    strength_raw: st ? st[0].trim() : null,
  };
}

export function parseGenericName(name) {
  const parts = name.split(/,|\band\b|&|\+/i).map((p) => p.trim()).filter(Boolean);
  const ingredients = [];
  for (const p of parts) {
    const ing = parsePart(p);
    if (ing) ingredients.push(ing);
  }
  ingredients.sort((a, b) => a.molecule.localeCompare(b.molecule));
  return ingredients;
}

const SKIP_RE = /^(annexure|the list|s\.?\s*no\.?|drug$|code$|generic name)/i;

export function parseJanAushadhiText(text, date) {
  const entries = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/\f/g, '');
    if (!clean.trim()) continue;
    if (SKIP_RE.test(clean.trim())) continue;
    if (/^\s*\d+\s*$/.test(clean)) continue; // bare page number
    const m = clean.match(ROW_RE);
    if (m) {
      let name = m[3].trim();
      let unit = null;
      const t = m[3].match(TRAILING_UNIT_RE);
      if (t) { name = t[1].trim(); unit = t[2].trim(); }
      current = { sno: m[1], code: m[2], name, unit };
      entries.push(current);
    } else if (current && /^\s{6,}\S/.test(clean) && /[a-zA-Z]/.test(clean)) {
      current.name = `${current.name} ${clean.trim()}`;
    }
  }
  return entries.map((e) => {
    const ingredients = parseGenericName(e.name);
    return {
      source: 'janaushadhi',
      source_id: e.code,
      seen_at: date,
      brand_name: e.name,
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: e.unit ?? '',
      form_raw: null,
      price_inr: null,
      is_discontinued: null,
      ingredients,
      composition_raw: e.name,
      composition_status: ingredients.length ? 'complete' : 'missing',
      substitutes_raw: [],
      type: 'allopathy',
    };
  });
}

export async function fetchJanAushadhi({ rawRoot, date }) {
  const dir = path.join(rawRoot, 'janaushadhi', date);
  const pdf = path.join(dir, 'pmbjp.pdf');
  const txt = path.join(dir, 'pmbjp.txt');
  if (fs.existsSync(txt)) return { file: txt, cached: true };
  if (!fs.existsSync(pdf)) await downloadToFile(PDF_URL, pdf); // operator-dropped pdf wins
  const r = await pdfToText(pdf, txt);
  if (r.skipped) return r;
  return { file: txt, cached: false };
}
