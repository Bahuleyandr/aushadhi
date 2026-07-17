import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { normMolecule } from '../lib/normalize.mjs';

// Molecule -> ATC classification codes. Reads the bundled factual seed
// (data-static/atc-seed.csv, common Indian-market molecules) PLUS any
// operator-provided openly-licensed reference dropped in data/raw/atc/*.csv
// (e.g. SIDER drug_atc.tsv, tatonetti-lab ATC_MAPPING.csv). The WHO ATC/DDD
// index itself is copyrighted, so the full reference is operator-supplied.
// Accepts columns molecule/atc_code (or name/code, or first two columns).
export function loadAtcMap(rawRoot = 'data/raw', staticDir = 'data-static') {
  const map = new Map();
  const addCsv = (file, delimiter) => {
    if (!fs.existsSync(file)) return;
    let records;
    try {
      records = parse(fs.readFileSync(file), { columns: true, bom: true, delimiter, relax_column_count: true, skip_empty_lines: true });
    } catch { return; }
    for (const r of records) {
      const vals = Object.values(r);
      // `atc_name`/`substance` cover the common WHO-scrape CSVs (fabkury/atcd,
      // WHOCC exports) where the substance name sits in a column literally called
      // atc_name — without these it would fall through to vals[0] (the code).
      const mol = normMolecule(r.molecule ?? r.name ?? r.molecule_name ?? r.drug ?? r.atc_name ?? r.substance ?? vals[0] ?? '');
      const code = (r.atc_code ?? r.atc ?? r.code ?? vals[1] ?? '').toString().trim().toUpperCase();
      if (mol && /^[A-Z]\d[A-Z0-9]*$/.test(code)) {
        if (!map.has(mol)) map.set(mol, new Set());
        map.get(mol).add(code);
      }
    }
  };
  addCsv(path.join(staticDir, 'atc-seed.csv'), ',');
  const dir = path.join(rawRoot, 'atc');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (/\.(csv|tsv)$/i.test(f)) addCsv(path.join(dir, f), f.toLowerCase().endsWith('.tsv') ? '\t' : ',');
    }
  }
  return map;
}

// ATC codes for a set of molecule names (union across the composition, sorted).
export function atcForMolecules(molecules, atcMap) {
  const codes = new Set();
  for (const m of molecules) {
    const s = atcMap.get(m);
    if (s) for (const c of s) codes.add(c);
  }
  return [...codes].sort();
}
