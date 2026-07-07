import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import { parseComposition } from '../lib/composition.mjs';

const CSV_URL = 'https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/DATA/indian_medicine_data.csv';
const REQUIRED = ['id', 'name', 'Is_discontinued', 'manufacturer_name', 'type', 'pack_size_label', 'short_composition1', 'short_composition2'];

export async function fetchGithubJr({ rawRoot, date }) {
  const dir = path.join(rawRoot, 'github-jr', date);
  const file = path.join(dir, 'indian_medicine_data.csv');
  if (fs.existsSync(file)) return { file, cached: true };
  await fsp.mkdir(dir, { recursive: true });
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`github-jr download failed: ${res.status}`);
  await fsp.writeFile(file, Readable.fromWeb(res.body));
  return { file, cached: false };
}

export async function* normalizeGithubJr(file, date) {
  const parser = fs.createReadStream(file).pipe(parse({ columns: true, bom: true, relax_column_count: true }));
  let checked = false;
  for await (const rec of parser) {
    if (!checked) {
      const headers = Object.keys(rec);
      const missing = REQUIRED.filter((h) => !headers.includes(h));
      if (missing.length) throw new Error(`github-jr: unexpected headers. missing=${missing.join(',')} got=${headers.join(',')}`);
      checked = true;
    }
    const priceKey = Object.keys(rec).find((k) => /^price/i.test(k));
    const comp = parseComposition([rec.short_composition1, rec.short_composition2]);
    yield {
      source: 'github-jr',
      source_id: String(rec.id),
      seen_at: date,
      brand_name: rec.name?.trim(),
      manufacturer: rec.manufacturer_name?.trim() ?? '',
      pack_label: rec.pack_size_label?.trim() ?? '',
      form_raw: null,
      price_inr: priceKey && rec[priceKey] !== '' ? Number(rec[priceKey]) : null,
      is_discontinued: String(rec.Is_discontinued).trim().toLowerCase() === 'true',
      ingredients: comp.ingredients,
      composition_raw: comp.raw,
      composition_status: comp.status,
      substitutes_raw: [],
      type: rec.type?.trim() || null,
    };
  }
}
