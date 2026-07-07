import fsp from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'csv-stringify/sync';
import { moleculeSetKey } from './merge.mjs';

const ingredientsToString = (ings) =>
  ings.map((i) => (i.strength_raw ? `${i.molecule} (${i.strength_raw})` : i.molecule)).join(' + ');

export async function emitArtifact({ distRoot, date, rows, conflicts, errors, meta }) {
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
    first_seen: r.first_seen,
    last_seen: r.last_seen,
  }));
  await fsp.writeFile(path.join(dir, 'drugs.csv'), stringify(flat, { header: true, bom: true }));
  await fsp.writeFile(path.join(dir, 'drugs.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

  const comps = new Map();
  for (const r of rows) {
    if (!r.ingredients.length) continue;
    const k = moleculeSetKey(r.ingredients);
    if (!comps.has(k)) comps.set(k, { composition: ingredientsToString(r.ingredients), molecule_set_key: k, brand_count: 0 });
    comps.get(k).brand_count++;
  }
  await fsp.writeFile(
    path.join(dir, 'compositions.csv'),
    stringify([...comps.values()].sort((a, b) => b.brand_count - a.brand_count), { header: true, bom: true }),
  );

  const edges = rows.flatMap((r) => (r.substitutes_raw ?? []).map((s) => ({
    brand_name: r.brand_name,
    manufacturer: r.manufacturer,
    substitute_name: s.name,
    substitute_manufacturer: s.manufacturer ?? '',
  })));
  await fsp.writeFile(path.join(dir, 'substitute_edges.csv'), stringify(edges, { header: true, columns: ['brand_name', 'manufacturer', 'substitute_name', 'substitute_manufacturer'] }));
  await fsp.writeFile(
    path.join(dir, 'conflicts.csv'),
    stringify(conflicts.map((c) => ({ ...c, a: JSON.stringify(c.a), b: JSON.stringify(c.b) })), { header: true, columns: ['kind', 'identity_key', 'a', 'b'] }),
  );
  await fsp.writeFile(path.join(dir, 'errors.csv'), stringify(errors, { header: true, columns: ['source', 'reason', 'detail'] }));

  const statusCounts = {};
  for (const r of rows) statusCounts[r.composition_status] = (statusCounts[r.composition_status] ?? 0) + 1;
  const summary = {
    date,
    total_rows: rows.length,
    unique_compositions: comps.size,
    composition_status: statusCounts,
    conflicts: conflicts.length,
    errors: errors.length,
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
