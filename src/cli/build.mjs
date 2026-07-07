import fs from 'node:fs';
import path from 'node:path';
import { ctx } from '../lib/context.mjs';
import { normalizeGithubJr } from '../adapters/github-jr.mjs';
import { parseJanAushadhiText } from '../adapters/janaushadhi.mjs';
import { loadCdscoFdcCombos } from '../adapters/cdsco-fdc.mjs';
import { mergeRows } from '../lib/merge.mjs';
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

const jaDir = latestSnapshot(c.rawRoot, 'janaushadhi');
if (jaDir) {
  const file = path.join(jaDir, 'pmbjp.txt');
  if (fs.existsSync(file)) {
    try {
      const jaRows = parseJanAushadhiText(fs.readFileSync(file, 'utf8'), path.basename(jaDir));
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
  }
}

const fdc = await loadCdscoFdcCombos(c.rawRoot);
if (fdc.files) meta.cdsco_fdc_files = fdc.files;

const { rows, conflicts } = mergeRows(all);
const { dir } = await emitArtifact({ distRoot: c.distRoot, date: c.date, rows, conflicts, errors, meta, fdcKeys: fdc.keys });
console.log(`emitted ${rows.length} rows (${all.length} source rows, ${conflicts.length} conflicts, ${errors.length} errors) -> ${dir}`);
