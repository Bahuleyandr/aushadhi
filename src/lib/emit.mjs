import fsp from 'node:fs/promises';
import path from 'node:path';
import { moleculeSetKey, moleculeNameKey } from './merge.mjs';
import {
  COHORT_MANIFEST,
  OPTIONAL_COHORT_FILES,
  writeCsvStream,
  writeJsonlStream,
} from './build-cohort.mjs';

const ingredientsToString = (ings) =>
  ings.map((i) => (i.strength_raw ? `${i.molecule} (${i.strength_raw})` : i.molecule)).join(' + ');

const DRUG_COLUMNS = [
  'brand_name', 'manufacturer', 'pack_label', 'form_raw', 'type', 'price_inr',
  'is_discontinued', 'composition', 'composition_status', 'composition_raw',
  'ingredients_json', 'n_substitutes', 'sources', 'source_count', 'confidence',
  'atc_codes', 'first_seen', 'last_seen',
];

export async function emitArtifact({
  date, rows, conflicts, errors, meta, fdcKeys = new Set(), outputDir,
}) {
  const stagedDir = outputDir ?? process.env.AUSHADHI_COHORT_DIR;
  if (typeof stagedDir !== 'string' || stagedDir.trim() === '') {
    throw new Error('AUSHADHI_COHORT_DIR is required for a mutable cohort stage');
  }
  const dir = path.resolve(stagedDir);
  try {
    await fsp.lstat(path.join(dir, COHORT_MANIFEST));
    throw new Error(`manifest-bound cohort is immutable: ${dir}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await fsp.mkdir(dir, { recursive: true });
  for (const name of [
    'prescribable.jsonl',
    'formulation_groups.jsonl',
    'REPORT.md',
    COHORT_MANIFEST,
    ...OPTIONAL_COHORT_FILES,
  ]) {
    await fsp.rm(path.join(dir, name), { force: true });
  }

  function* flatRows() {
    for (const r of rows) {
      yield {
        brand_name: r.brand_name,
        manufacturer: r.manufacturer,
        pack_label: r.pack_label,
        form_raw: r.form_raw ?? '',
        type: r.type ?? '',
        price_inr: r.price_inr ?? '',
        is_discontinued: r.is_discontinued ?? '',
        composition: ingredientsToString(r.ingredients),
        composition_status: r.composition_status,
        composition_raw: r.composition_raw ?? '',
        ingredients_json: JSON.stringify(r.ingredients),
        n_substitutes: (r.substitutes_raw ?? []).length,
        sources: r.sources.map((s) => s.source).join(';'),
        source_count: r.source_count ?? 1,
        confidence: r.confidence ?? 'single_source',
        atc_codes: (r.atc_codes ?? []).join(';'),
        first_seen: r.first_seen,
        last_seen: r.last_seen,
      };
    }
  }
  await writeCsvStream(path.join(dir, 'drugs.csv'), flatRows(), { header: true, bom: true, columns: DRUG_COLUMNS });
  await writeJsonlStream(path.join(dir, 'drugs.jsonl'), rows);

  const comps = new Map();
  let cdscoValidated = 0;
  for (const r of rows) {
    if (!r.ingredients.length) continue;
    const k = moleculeSetKey(r.ingredients);
    if (!comps.has(k)) {
      const nameKey = moleculeNameKey(r.ingredients);
      const validated = r.ingredients.length >= 2 && fdcKeys.has(nameKey);
      if (validated) cdscoValidated++;
      comps.set(k, { composition: ingredientsToString(r.ingredients), molecule_set_key: k, brand_count: 0, cdsco_fdc_validated: validated });
    }
    comps.get(k).brand_count++;
  }
  await writeCsvStream(
    path.join(dir, 'compositions.csv'),
    [...comps.values()].sort((a, b) => b.brand_count - a.brand_count),
    { header: true, bom: true, columns: ['composition', 'molecule_set_key', 'brand_count', 'cdsco_fdc_validated'] },
  );

  function* substituteEdges() {
    for (const r of rows) {
      const onemg = (r.sources ?? []).find((s) => s.source === 'onemg-live');
      for (const s of r.substitutes_raw ?? []) {
        yield {
          brand_name: r.brand_name,
          manufacturer: r.manufacturer,
          substitute_name: s.name,
          substitute_manufacturer: s.manufacturer ?? '',
          source_id: onemg?.source_id ?? '',
          seen_at: onemg?.seen_at ?? r.last_seen,
        };
      }
    }
  }
  await writeCsvStream(path.join(dir, 'substitute_edges.csv'), substituteEdges(), {
    header: true,
    columns: ['brand_name', 'manufacturer', 'substitute_name', 'substitute_manufacturer', 'source_id', 'seen_at'],
  });
  function* csvConflicts() {
    for (const conflict of conflicts) {
      yield { ...conflict, a: JSON.stringify(conflict.a), b: JSON.stringify(conflict.b) };
    }
  }
  await writeCsvStream(path.join(dir, 'conflicts.csv'), csvConflicts(), {
    header: true,
    columns: ['kind', 'identity_key', 'a', 'b'],
  });
  // machine-readable twin — gapfill consumes this, never the CSV
  await writeJsonlStream(path.join(dir, 'conflicts.jsonl'), conflicts);
  await writeCsvStream(path.join(dir, 'errors.csv'), errors, {
    header: true,
    columns: ['source', 'reason', 'detail'],
  });

  const statusCounts = {};
  const confidenceCounts = {};
  for (const r of rows) {
    statusCounts[r.composition_status] = (statusCounts[r.composition_status] ?? 0) + 1;
    confidenceCounts[r.confidence ?? 'single_source'] = (confidenceCounts[r.confidence ?? 'single_source'] ?? 0) + 1;
  }
  const summary = {
    date,
    total_rows: rows.length,
    unique_compositions: comps.size,
    composition_status: statusCounts,
    confidence: confidenceCounts,
    conflicts: conflicts.length,
    errors: errors.length,
    cdsco_validated: cdscoValidated,
    ...meta,
  };
  await fsp.writeFile(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));

  await fsp.writeFile(path.join(dir, 'ATTRIBUTION.md'), [
    '# Attribution',
    '',
    '- `junioralive/Indian-Medicine-Dataset` (GitHub, MIT).',
    '- Jan Aushadhi (PMBJP) product list — Government of India public data.',
    '- CDSCO approved-FDC lists — Government of India public data.',
    '- Kaggle `apkaayush/india-medicines-and-drug-info-dataset` (when enabled).',
    '- Selected fields refreshed from Tata 1mg public drug pages (factual data: names, compositions,',
    '  substitutes, availability), fetched politely per robots.txt. 1mg ToS restricts scraping;',
    '  this dataset is private/internal — do not redistribute.',
    '',
  ].join('\n'));

  return { dir };
}
