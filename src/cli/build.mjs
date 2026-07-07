import fs from 'node:fs';
import path from 'node:path';
import { ctx } from '../lib/context.mjs';
import { normalizeGithubJr } from '../adapters/github-jr.mjs';
import { parseJanAushadhiText } from '../adapters/janaushadhi.mjs';
import { loadCdscoFdcCombos } from '../adapters/cdsco-fdc.mjs';
import { readOnemgNormalized } from '../adapters/onemg.mjs';
import { readKaggleRows } from '../adapters/kaggle-2025.mjs';
import { mergeRows, detectSubstituteMismatches } from '../lib/merge.mjs';
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
  all.push(...onemgRows);
  meta.sources['onemg-live'] = onemgRows.length;
}

const fdc = await loadCdscoFdcCombos(c.rawRoot);
if (fdc.files) meta.cdsco_fdc_files = fdc.files;

const { rows, conflicts } = mergeRows(all);
conflicts.push(...detectSubstituteMismatches(rows));
const { dir } = await emitArtifact({ distRoot: c.distRoot, date: c.date, rows, conflicts, errors, meta, fdcKeys: fdc.keys });
console.log(`emitted ${rows.length} rows (${all.length} source rows, ${conflicts.length} conflicts, ${errors.length} errors) -> ${dir}`);
