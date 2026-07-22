import fs from 'node:fs';
import path from 'node:path';
import { ctx } from '../lib/context.mjs';
import { normalizeGithubJr } from '../adapters/github-jr.mjs';
import { parseJanAushadhiText } from '../adapters/janaushadhi.mjs';
import { loadCdscoFdcCombos } from '../adapters/cdsco-fdc.mjs';
import { readOnemgNormalized } from '../adapters/onemg.mjs';
import { readApolloNormalized } from '../adapters/apollo.mjs';
import { readPharmeasyNormalized } from '../adapters/pharmeasy.mjs';
import { readNetmedsNormalized } from '../adapters/netmeds.mjs';
import { readKaggleRows } from '../adapters/kaggle-2025.mjs';
import { mergeRows, detectSubstituteMismatches } from '../lib/merge.mjs';
import { buildStrengthModel } from '../lib/plausibility.mjs';
import { buildKnownCombos, likelyTruncated } from '../lib/known-combos.mjs';
import { loadAtcMap, atcForMolecules } from '../adapters/atc.mjs';
import { loadNppaRows } from '../adapters/nppa.mjs';
import { normMolecule } from '../lib/normalize.mjs';
import { emitArtifact } from '../lib/emit.mjs';

export function latestSnapshot(rawRoot, source) {
  const dir = path.join(rawRoot, source);
  if (!fs.existsSync(dir)) return null;
  const dates = fs.readdirSync(dir).sort();
  return dates.length ? path.join(dir, dates.at(-1)) : null;
}

const c = ctx();
const all = [];
const errors = [];
const meta = { sources: {} };

const gjDir = latestSnapshot(c.rawRoot, 'github-jr');
if (gjDir) {
  const file = path.join(gjDir, 'indian_medicine_data.csv');
  const date = path.basename(gjDir);
  let n = 0;
  try {
    for await (const row of normalizeGithubJr(file, date)) {
      if (!row.brand_name) {
        errors.push({ source: 'github-jr', reason: 'empty brand_name', detail: JSON.stringify(row).slice(0, 200) });
        continue;
      }
      all.push(row);
      n++;
    }
  } catch (e) {
    errors.push({ source: 'github-jr', reason: 'adapter failure', detail: e.message });
  }
  meta.sources['github-jr'] = n;
}

// use the newest snapshot that actually HAS the converted text — a fetch that
// downloaded the PDF but skipped pdftotext must not silently drop the source
const jaRoot = path.join(c.rawRoot, 'janaushadhi');
const jaDirs = fs.existsSync(jaRoot) ? fs.readdirSync(jaRoot).sort().reverse() : [];
const jaDir = jaDirs.map((d) => path.join(jaRoot, d)).find((d) => fs.existsSync(path.join(d, 'pmbjp.txt')));
if (jaDir) {
  try {
    const jaRows = parseJanAushadhiText(fs.readFileSync(path.join(jaDir, 'pmbjp.txt'), 'utf8'), path.basename(jaDir));
    for (const row of jaRows) {
      if (!row.brand_name) {
        errors.push({ source: 'janaushadhi', reason: 'empty brand_name', detail: JSON.stringify(row).slice(0, 200) });
        continue;
      }
      all.push(row);
    }
    meta.sources.janaushadhi = jaRows.length;
  } catch (e) {
    errors.push({ source: 'janaushadhi', reason: 'adapter failure', detail: e.message });
  }
} else if (jaDirs.length) {
  errors.push({ source: 'janaushadhi', reason: 'snapshot without pmbjp.txt', detail: `dirs=${jaDirs.join(',')} (pdftotext missing?)` });
}

const kgDir = latestSnapshot(c.rawRoot, 'kaggle-2025');
if (kgDir) {
  try {
    let kgN = 0;
    for (const row of readKaggleRows(kgDir, path.basename(kgDir))) {
      if (!row.brand_name) {
        errors.push({ source: 'kaggle-2025', reason: 'empty brand_name', detail: JSON.stringify(row).slice(0, 200) });
        continue;
      }
      all.push(row);
      kgN++;
    }
    meta.sources['kaggle-2025'] = kgN;
  } catch (e) {
    errors.push({ source: 'kaggle-2025', reason: 'adapter failure', detail: e.message });
  }
}

const onemgRows = readOnemgNormalized(c.rawRoot);
if (onemgRows.length) {
  // NOT all.push(...onemgRows): the spread passes every element as a function
  // arg and blows the ~125k argument limit once the crawl grows large (RangeError).
  for (const row of onemgRows) all.push(row);
  meta.sources['onemg-live'] = onemgRows.length;
}

const apolloRows = readApolloNormalized(c.rawRoot);
if (apolloRows.length) {
  for (const row of apolloRows) all.push(row);
  meta.sources.apollo = apolloRows.length;
}

const pharmeasyRows = readPharmeasyNormalized(c.rawRoot);
if (pharmeasyRows.length) {
  for (const row of pharmeasyRows) all.push(row);
  meta.sources.pharmeasy = pharmeasyRows.length;
}

const netmedsRows = readNetmedsNormalized(c.rawRoot);
if (netmedsRows.length) {
  for (const row of netmedsRows) all.push(row);
  meta.sources.netmeds = netmedsRows.length;
}

const nppaRows = await loadNppaRows(c.rawRoot);
if (nppaRows.length) {
  for (const row of nppaRows) all.push(row);
  meta.sources.nppa = nppaRows.length;
}

const fdc = await loadCdscoFdcCombos(c.rawRoot);
if (fdc.files) meta.cdsco_fdc_files = fdc.files;

// Re-run every molecule through the CURRENT normalizer before merge. Rows in the
// per-source snapshots were normalized whenever they were crawled, so alias-map
// and punctuation improvements would otherwise only reach freshly-fetched data.
// normMolecule is idempotent, so this canonicalizes retroactively without a
// re-crawl (fixes fragmented identities like guaiphenesin/guaifenesin and lifts
// the ATC join), and drops molecules that normalize to empty ("-" artifacts).
let renormalized = 0;
for (const r of all) {
  if (!r.ingredients?.length) continue;
  const before = r.ingredients.map((i) => i.molecule).join('|');
  r.ingredients = r.ingredients
    .map((i) => ({ ...i, molecule: normMolecule(i.molecule) }))
    .filter((i) => i.molecule);
  if (r.ingredients.map((i) => i.molecule).join('|') !== before) renormalized++;
}
meta.renormalized_rows = renormalized;

// Learn per-molecule strength distributions from the (re-normalized) source rows,
// then let merge annotate each output row with a plausibility-based strength trust
// signal (resolution-free — strengths are not altered here).
const strengthModel = buildStrengthModel(all);
const { rows, conflicts } = mergeRows(all, { model: strengthModel });
for (const m of detectSubstituteMismatches(rows)) conflicts.push(m); // loop, not spread (dataset-scale)
meta.strength_verified_rows = rows.filter((r) => r.strength_verified).length;
meta.strength_unverified_rows = rows.filter((r) => r.strength_status === 'unverified').length;
meta.strength_conflict_rows = rows.filter((r) => r.strength_conflict).length;
meta.strength_no_strength_rows = rows.filter((r) => r.strength_status === 'no_strength').length;

// visibility: how many 2-slot rows sit inside a KNOWN 3+ molecule combo
const kb = buildKnownCombos(rows);
meta.known_combos = kb.combos;
meta.likely_truncated = rows.filter((r) => likelyTruncated(r, kb)).length;

// ATC enrichment: attach classification codes to every row (molecule-level join)
const atcMap = loadAtcMap(c.rawRoot);
let atcCovered = 0;
for (const r of rows) {
  r.atc_codes = atcForMolecules(r.ingredients.map((i) => i.molecule), atcMap);
  if (r.atc_codes.length) atcCovered++;
}
meta.atc_molecules = atcMap.size;
meta.atc_coverage_rows = atcCovered;

const { dir } = await emitArtifact({ distRoot: c.distRoot, date: c.date, rows, conflicts, errors, meta, fdcKeys: fdc.keys });
console.log(`emitted ${rows.length} rows (${all.length} source rows, ${conflicts.length} conflicts, ${errors.length} errors) -> ${dir}`);
