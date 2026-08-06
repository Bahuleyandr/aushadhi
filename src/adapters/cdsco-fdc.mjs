import fs from 'node:fs';
import path from 'node:path';
import { normMolecule } from '../lib/normalize.mjs';
import { resolvePdfText } from '../lib/derived-pdf-text.mjs';

export function comboNameKey(molecules) {
  return [...molecules].map((m) => m.toLowerCase().trim()).sort().join('|');
}

// Lines like "Amoxicillin + Clavulanic Acid" -> approved combo of normalized molecule names.
// Guards: 2-6 parts, each part <= 6 words, alphabetic-ish (no long prose).
export function extractFdcCombos(text) {
  const combos = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('+')) continue;
    const cleaned = line.replace(/^\s*\d+[.)]?\s*/, '').trim();
    const parts = cleaned.split(/\+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2 || parts.length > 6) continue;
    const molecules = [];
    let ok = true;
    for (const p of parts) {
      const words = p.split(/\s+/);
      if (words.length > 6 || !/^[a-zA-Z][a-zA-Z\s().,%\d-]*$/.test(p)) { ok = false; break; }
      const mol = normMolecule(p.replace(/\([^)]*\)/g, ' ').replace(/[\d.]+\s*(mg|mcg|g|ml|iu|%)\S*/gi, ' ').replace(/\s+/g, ' ').trim());
      if (!mol || mol.split(' ').length > 5) { ok = false; break; }
      molecules.push(mol);
    }
    if (ok && molecules.length >= 2) combos.push(molecules);
  }
  return combos;
}

// Scans operator-dropped PDFs under data/raw/cdsco-fdc/**; returns Set of comboNameKeys.
export async function loadCdscoFdcCombos(rawRoot, {
  derivedRoot,
  pdfToTextImpl,
} = {}) {
  const root = path.join(rawRoot, 'cdsco-fdc');
  if (!fs.existsSync(root)) return { keys: new Set(), files: 0 };
  const pdfs = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.pdf$/i.test(e.name)) pdfs.push(p);
    }
  };
  walk(root);
  const keys = new Set();
  // This source has no per-row identifier to count against, so there is no honest
  // equivalent of the PMBJP row-completeness assertion. What it did have was a
  // silent failure path: a PDF that failed to convert, or that yielded no combos at
  // all, was indistinguishable from one that legitimately contributed nothing. Both
  // are now reported so a broken extraction is visible instead of merely quiet.
  const perFile = [];
  for (const pdf of pdfs) {
    try {
      const resolved = await resolvePdfText({
        pdf,
        rawRoot,
        source: 'cdsco-fdc',
        mode: 'layout',
        derivedRoot,
        convert: pdfToTextImpl,
      });
      if (resolved.skipped) {
        return { keys, files: pdfs.length, perFile, skipped: resolved.skipped };
      }
      const txt = resolved.file;
      const combos = extractFdcCombos(fs.readFileSync(txt, 'utf8'));
      for (const combo of combos) keys.add(comboNameKey(combo));
      perFile.push({ file: pdf, combos: combos.length, error: null });
    } catch (error) {
      perFile.push({ file: pdf, combos: 0, error: error.message });
    }
  }
  return {
    keys,
    files: pdfs.length,
    perFile,
    emptyFiles: perFile.filter((entry) => entry.combos === 0).map((entry) => entry.file),
    failedFiles: perFile.filter((entry) => entry.error !== null),
  };
}
