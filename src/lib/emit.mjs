import fsp from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'csv-stringify/sync';
import { moleculeSetKey, moleculeNameKey } from './merge.mjs';

const ingredientsToString = (ings) =>
  ings.map((i) => (i.strength_raw ? `${i.molecule} (${i.strength_raw})` : i.molecule)).join(' + ');

export async function emitArtifact({ distRoot, date, rows, conflicts, errors, meta, fdcKeys = new Set() }) {
  const dir = path.join(distRoot, date);
  await fsp.mkdir(dir, { recursive: true });

  const flat = rows.map((r) => ({
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
  }));
  await fsp.writeFile(path.join(dir, 'drugs.csv'), stringify(flat, { header: true, bom: true }));
  await fsp.writeFile(path.join(dir, 'drugs.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

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
  await fsp.writeFile(
    path.join(dir, 'compositions.csv'),
    stringify([...comps.values()].sort((a, b) => b.brand_count - a.brand_count), { header: true, bom: true }),
  );

  const edges = rows.flatMap((r) => {
    const onemg = (r.sources ?? []).find((s) => s.source === 'onemg-live');
    return (r.substitutes_raw ?? []).map((s) => ({
      brand_name: r.brand_name,
      manufacturer: r.manufacturer,
      substitute_name: s.name,
      substitute_manufacturer: s.manufacturer ?? '',
      source_id: onemg?.source_id ?? '',
      seen_at: onemg?.seen_at ?? r.last_seen,
    }));
  });
  await fsp.writeFile(path.join(dir, 'substitute_edges.csv'), stringify(edges, { header: true, columns: ['brand_name', 'manufacturer', 'substitute_name', 'substitute_manufacturer', 'source_id', 'seen_at'] }));
  await fsp.writeFile(
    path.join(dir, 'conflicts.csv'),
    stringify(conflicts.map((c) => ({ ...c, a: JSON.stringify(c.a), b: JSON.stringify(c.b) })), { header: true, columns: ['kind', 'identity_key', 'a', 'b'] }),
  );
  // machine-readable twin — gapfill consumes this, never the CSV
  await fsp.writeFile(path.join(dir, 'conflicts.jsonl'), conflicts.map((c) => JSON.stringify(c)).join('\n') + (conflicts.length ? '\n' : ''));
  await fsp.writeFile(path.join(dir, 'errors.csv'), stringify(errors, { header: true, columns: ['source', 'reason', 'detail'] }));

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

  const latest = path.join(distRoot, 'latest');
  await fsp.rm(latest, { recursive: true, force: true });
  await fsp.cp(dir, latest, { recursive: true });
  return { dir };
}
