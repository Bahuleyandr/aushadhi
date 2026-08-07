import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
const STRENGTH_TOKEN = /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|gm|g|ml|iu|%[\w/]*)\b/i;

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

// Every product row in the PMBJP list opens with "<serial> <drug code>". Counting
// those serials is an in-document ground truth that is independent of how well the
// extractor paired names to codes, so it detects a lossy extraction that would
// otherwise pass silently. Xpdf -layout on this document yields 1466 parsed rows
// against 2111 serials; -table yields 2111 against 2111.
const SERIAL_RE = /^[^\S\n]*(\d{1,4})[^\S\n]+\d{1,4}\b/gmu;

export function countJanAushadhiSerials(text) {
  return new Set([...String(text).matchAll(SERIAL_RE)].map((match) => match[1])).size;
}

export function janAushadhiParseIntegrity(text, rows) {
  const serials = countJanAushadhiSerials(text);
  return { parsed_rows: rows.length, serials_in_document: serials, complete: rows.length === serials };
}

// Fail closed: a silently truncated catalogue is worse than a failed build, because
// every downstream product_id and drug code is derived from these rows.
export function assertJanAushadhiParseComplete(text, rows) {
  const integrity = janAushadhiParseIntegrity(text, rows);
  if (!integrity.complete) {
    throw new Error(
      `janaushadhi extraction is lossy: parsed ${integrity.parsed_rows} rows but the document `
      + `contains ${integrity.serials_in_document} serial-numbered products. The PDF text extraction `
      + 'mode is wrong for this table (use pdfToText mode "table") or the document layout changed.',
    );
  }
  return integrity;
}

export const PMBJP_PROVENANCE_FILENAME = 'pmbjp.provenance.json';
export const PMBJP_PROVENANCE_SCHEMA_VERSION = 1;

// A catalogue row's drug code is only interpretable alongside the exact document it
// was parsed from: PMBJP reissues the product list, and a `pmbjp:<code>` citation
// downstream cannot be re-checked without knowing which issue produced it. Record the
// document identity so that check is possible rather than assumed.
export function writeJanAushadhiProvenance(dir, { origin, sourceUrl, pdfPath }) {
  const hasPdf = pdfPath !== null && fs.existsSync(pdfPath);
  const bytes = hasPdf ? fs.readFileSync(pdfPath) : null;
  const provenance = {
    schema_version: PMBJP_PROVENANCE_SCHEMA_VERSION,
    source: 'janaushadhi',
    document: 'pmbjp-product-list',
    origin,
    source_url: sourceUrl,
    retrieved_at: new Date().toISOString().slice(0, 10),
    pdf_sha256: hasPdf ? createHash('sha256').update(bytes).digest('hex') : null,
    pdf_byte_count: hasPdf ? bytes.length : null,
    code_space_verifiable: hasPdf,
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, PMBJP_PROVENANCE_FILENAME),
    `${JSON.stringify(provenance, null, 2)}\n`,
  );
  return provenance;
}

export function readJanAushadhiProvenance(dir) {
  const file = path.join(dir, PMBJP_PROVENANCE_FILENAME);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function fetchJanAushadhi({ rawRoot, date }) {
  const dir = path.join(rawRoot, 'janaushadhi', date);
  const pdf = path.join(dir, 'pmbjp.pdf');
  const txt = path.join(dir, 'pmbjp.txt');
  if (fs.existsSync(txt)) {
    // A pre-existing text extract may have no recoverable source document. Record
    // that honestly instead of leaving the code space silently unattributed.
    const provenance = readJanAushadhiProvenance(dir) ?? writeJanAushadhiProvenance(dir, {
      origin: fs.existsSync(pdf) ? 'cached-pdf' : 'cached-text-only',
      sourceUrl: fs.existsSync(pdf) ? null : null,
      pdfPath: fs.existsSync(pdf) ? pdf : null,
    });
    return { file: txt, cached: true, provenance };
  }
  const operatorDrop = fs.existsSync(pdf);
  if (!operatorDrop) await downloadToFile(PDF_URL, pdf); // operator-dropped pdf wins
  const provenance = writeJanAushadhiProvenance(dir, {
    origin: operatorDrop ? 'operator-drop' : 'download',
    sourceUrl: operatorDrop ? null : PDF_URL,
    pdfPath: pdf,
  });
  const r = await pdfToText(pdf, txt, { mode: 'table' }); // ruled table: -layout orphans name cells
  if (r.skipped) return { ...r, provenance };
  return { file: txt, cached: false, provenance };
}
