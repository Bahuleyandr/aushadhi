import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { parse } from 'csv-parse/sync';
import { parseComposition, splitCompositionString } from '../lib/composition.mjs';

const DATASET = 'apkaayush/india-medicines-and-drug-info-dataset';

const COLUMN_CANDIDATES = {
  brand_name: ['name', 'medicine_name', 'drug_name', 'product_name'],
  manufacturer: ['manufacturer_name', 'manufacturer', 'marketer', 'marketer_name', 'company'],
  pack_label: ['pack_size_label', 'packaging', 'pack_size', 'pack'],
  composition1: ['short_composition1', 'salt_composition', 'composition', 'salts'],
  composition2: ['short_composition2'],
  price: ['price(₹)', 'price', 'mrp', 'price_inr'],
  discontinued: ['Is_discontinued', 'is_discontinued', 'discontinued'],
  type: ['type', 'category'],
  id: ['id', 'sku_id', 'product_id'],
};

function pickColumns(headers) {
  const map = {};
  for (const [field, candidates] of Object.entries(COLUMN_CANDIDATES)) {
    map[field] = candidates.find((c) => headers.includes(c)) ?? null;
  }
  if (!map.brand_name || !map.composition1) {
    throw new Error(`kaggle-2025: unmappable headers. need brand_name+composition. got=${headers.join(',')}`);
  }
  return map;
}

export function normalizeKaggleRows(records, date) {
  if (!records.length) return [];
  const cols = pickColumns(Object.keys(records[0]));
  const rows = [];
  for (const rec of records) {
    const compParts = [rec[cols.composition1], cols.composition2 ? rec[cols.composition2] : null]
      .filter((x) => x !== null && x !== undefined);
    // every column may itself carry a '+'-joined combo — split uniformly
    const comp = parseComposition(compParts.flatMap((p) => splitCompositionString(p)));
    const twoSlotMaxed = Boolean(cols.composition2) && comp.ingredients.length >= 2;
    const priceRaw = cols.price ? rec[cols.price] : '';
    rows.push({
      source: 'kaggle-2025',
      source_id: cols.id ? String(rec[cols.id]) : null,
      seen_at: date,
      brand_name: (rec[cols.brand_name] ?? '').toString().trim(),
      manufacturer: cols.manufacturer ? (rec[cols.manufacturer] ?? '').toString().trim() : '',
      pack_label: cols.pack_label ? (rec[cols.pack_label] ?? '').toString().trim() : '',
      form_raw: null,
      price_inr: priceRaw !== '' && priceRaw !== null && priceRaw !== undefined ? Number(priceRaw) : null,
      is_discontinued: cols.discontinued ? String(rec[cols.discontinued]).trim().toLowerCase() === 'true' : null,
      ingredients: comp.ingredients,
      composition_raw: comp.raw,
      composition_status: comp.status,
      two_slot_maxed: twoSlotMaxed,
      substitutes_raw: [],
      type: cols.type ? (rec[cols.type] ?? '').toString().trim() || null : null,
    });
  }
  return rows;
}

export async function fetchKaggle2025({ rawRoot, date }) {
  const user = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;
  if (!user || !key) return { skipped: 'no KAGGLE_USERNAME/KAGGLE_KEY in env' };
  const dir = path.join(rawRoot, 'kaggle-2025', date);
  if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.csv'))) return { dir, cached: true };
  await fsp.mkdir(dir, { recursive: true });
  const res = await fetch(`https://www.kaggle.com/api/v1/datasets/download/${DATASET}`, {
    headers: { authorization: `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}` },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`kaggle download failed: ${res.status}`);
  const zip = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(zip);
  let csvs = 0;
  for (const [name, data] of Object.entries(files)) {
    if (!name.endsWith('.csv')) continue;
    await fsp.writeFile(path.join(dir, path.basename(name)), data);
    csvs++;
  }
  if (!csvs) throw new Error('kaggle zip contained no CSV');
  return { dir, cached: false };
}

export function readKaggleRows(dir, date) {
  const rows = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
    const records = parse(fs.readFileSync(path.join(dir, f)), { columns: true, bom: true, relax_column_count: true });
    rows.push(...normalizeKaggleRows(records, date));
  }
  return rows;
}
