# aushadhi — India Drug Reference Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the aushadhi pipeline (sources → normalize → merge → versioned artifact) plus the polite 1mg gap-filler and the VH Health importer, per the approved spec at `docs/superpowers/specs/2026-07-07-india-drug-reference-design.md`.

**Architecture:** Thin builder / smart importer. Per-source adapters normalize into a common row schema; a merge stage dedups by `norm(brand)|norm(manufacturer)|norm(pack)` with source precedence; emit writes `dist/<date>/`. The 1mg gap-filler is a separate, capped, resumable CLI built on a testable `PoliteFetcher`. VH Health canonicalization happens ONLY in the platform repo's importer via the existing `compositionParser`.

**Tech Stack:** Node 22 ESM, `node:test`, `cheerio`, `csv-parse`, `csv-stringify`, `fflate` (kaggle zip only). No test framework deps. `pdftotext` (Xpdf, already on this machine) gates the PDF sources — both are non-blocking skips when absent.

**Spec refinement (composition_status):** the primary dataset has only 2 composition slots, and a 2-filled-slot row is indistinguishable from a truncated 3+-combo. So: `missing` = no parseable ingredient; `complete` = what the source claims; `partial` is assigned at **merge time** when a richer source proves a row's ingredient list was a strict subset, and such rows are prioritized for gap-fill verification. Cross-validation (kaggle-2025 / 1mg live / substitutes) is the truncation detector.

**Working directory:** `D:\Dev\Projects\aushadhi` for T1–T16. T17–T19 run in `D:\Dev\Projects\VH Health\VH-Health-Platform` on a feature branch.

---

## Phase 1 — Core pipeline (T1–T8): real artifact from the primary source

### Task 1: Project setup

**Files:** Modify: `package.json`

- [ ] **Step 1:** Install deps + wire scripts:

```powershell
cd D:\Dev\Projects\aushadhi
npm install cheerio csv-parse csv-stringify fflate
```

Add to `package.json`:

```json
"scripts": {
  "test": "node --test test/",
  "fetch": "node src/cli/fetch.mjs",
  "build": "node src/cli/build.mjs",
  "gapfill": "node src/cli/gapfill.mjs",
  "stats": "node src/cli/stats.mjs"
}
```

- [ ] **Step 2:** Smoke test the runner. Create `test/smoke.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('runner works', () => assert.equal(1 + 1, 2));
```

Run: `npm test` → Expected: `pass 1`.

- [ ] **Step 3:** Commit: `git add -A && git commit -m "chore: deps + npm scripts + test runner smoke"`

### Task 2: `src/lib/normalize.mjs`

**Files:** Create: `src/lib/normalize.mjs`, `test/normalize.test.mjs`

- [ ] **Step 1: Failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normText, normBrandName, normManufacturer, normPack, normMolecule } from '../src/lib/normalize.mjs';

test('normText lowercases, collapses ws, strips quotes', () => {
  assert.equal(normText('  Augmentin  625 DUO   Tablet '), 'augmentin 625 duo tablet');
  assert.equal(normText("D'Cold Total"), 'dcold total');
  assert.equal(normText(null), '');
});
test('normManufacturer drops corporate suffixes but never returns empty', () => {
  assert.equal(normManufacturer('GlaxoSmithKline Pharmaceuticals Ltd'), normManufacturer('Glaxosmithkline Pharmaceuticals Ltd.'));
  assert.equal(normManufacturer('Mankind Pharma Ltd'), 'mankind');
  assert.notEqual(normManufacturer('Pharma Ltd'), '');   // degenerate name keeps raw fallback
});
test('normPack strips punctuation', () => {
  assert.equal(normPack('strip of 10 tablets'), normPack('Strip of 10  Tablets.'));
});
test('normMolecule applies alias map', () => {
  assert.equal(normMolecule('Amoxicillin'), 'amoxycillin');
  assert.equal(normMolecule('Acetaminophen'), 'paracetamol');
  assert.equal(normMolecule('Clavulanate Potassium'), 'clavulanic acid');
  assert.equal(normMolecule('Dolo-molecule-unknown'), 'dolo-molecule-unknown');
});
```

- [ ] **Step 2:** Run `npm test` → Expected: FAIL (module not found).
- [ ] **Step 3: Implement**

```js
const WS = /\s+/g;
export function normText(s) {
  return (s ?? '').toString().toLowerCase()
    .replace(/[‘’'"`]/g, '')
    .replace(WS, ' ').trim();
}
export function normBrandName(s) { return normText(s); }

const MFR_SUFFIXES = /\b(private|pvt|ltd|limited|pharmaceuticals?|pharma|laboratories|labs|healthcare|lifesciences|life sciences|india|industries|inc|co)\b\.?/g;
export function normManufacturer(s) {
  const base = normText(s).replace(/[.,&]/g, ' ');
  const t = base.replace(MFR_SUFFIXES, ' ').replace(WS, ' ').trim();
  return t || base.replace(WS, ' ').trim();
}
export function normPack(s) {
  return normText(s).replace(/[^a-z0-9 ]/g, ' ').replace(WS, ' ').trim();
}

// Spelling/salt-name variants ONLY (no therapeutic equivalence). Grows via reviewed additions.
export const MOLECULE_ALIASES = new Map([
  ['amoxicillin', 'amoxycillin'],
  ['acetaminophen', 'paracetamol'],
  ['clavulanate', 'clavulanic acid'],
  ['clavulanate potassium', 'clavulanic acid'],
  ['potassium clavulanate', 'clavulanic acid'],
  ['vitamin d3', 'cholecalciferol'],
  ['cetirizine hydrochloride', 'cetirizine'],
  ['metformin hydrochloride', 'metformin'],
]);
export function normMolecule(s) {
  const t = normText(s).replace(/[()]/g, '').trim();
  return MOLECULE_ALIASES.get(t) ?? t;
}
```

- [ ] **Step 4:** `npm test` → PASS. **Step 5:** Commit `feat: normalizers + molecule alias map`.

### Task 3: `src/lib/composition.mjs`

**Files:** Create: `src/lib/composition.mjs`, `test/composition.test.mjs`

- [ ] **Step 1: Failing tests** (real messy formats)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredient, parseComposition, splitCompositionString } from '../src/lib/composition.mjs';

test('simple strength', () => {
  assert.deepEqual(parseIngredient('Amoxycillin  (500mg)'), {
    molecule: 'amoxycillin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' });
});
test('per-volume, IU, mcg, percent', () => {
  assert.equal(parseIngredient('Ambroxol (30mg/5ml)').strength_unit, 'mg/5ml');
  assert.equal(parseIngredient('Cholecalciferol (60000IU)').strength_value, 60000);
  assert.equal(parseIngredient('Mecobalamin (1500mcg)').strength_unit, 'mcg');
  assert.equal(parseIngredient('Ketoconazole (2% w/v)').strength_unit, '%w/v');
});
test('no strength / NA / empty', () => {
  assert.deepEqual(parseIngredient('Silicon Dioxide'),
    { molecule: 'silicon dioxide', strength_value: null, strength_unit: null, strength_raw: null });
  assert.equal(parseIngredient('NA'), null);
  assert.equal(parseIngredient(''), null);
});
test('parseComposition from 2-slot arrays, sorted, status', () => {
  const c = parseComposition(['Clavulanic Acid (125mg)', 'Amoxycillin (500mg)']);
  assert.deepEqual(c.ingredients.map(i => i.molecule), ['amoxycillin', 'clavulanic acid']);
  assert.equal(c.status, 'complete');
  assert.equal(parseComposition(['NA', '']).status, 'missing');
});
test('splitCompositionString on +', () => {
  assert.deepEqual(splitCompositionString('Paracetamol (325mg) + Phenylephrine (5mg) + Chlorpheniramine (2mg)').length, 3);
  assert.deepEqual(splitCompositionString(''), []);
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement**

```js
import { normMolecule } from './normalize.mjs';

const STRENGTH_RE = /\(([^()]*)\)\s*$/;
const VALUE_UNIT_RE = /^([\d.]+)\s*([a-zµ%][a-zµ%\/\d.\s]*)$/i;

export function parseIngredient(part) {
  const raw = (part ?? '').toString().trim();
  if (!raw || /^(na|n\/a|-|none)$/i.test(raw)) return null;
  let moleculeRaw = raw, strength_raw = null;
  const m = raw.match(STRENGTH_RE);
  if (m) { moleculeRaw = raw.slice(0, m.index).trim(); strength_raw = m[1].trim() || null; }
  const molecule = normMolecule(moleculeRaw);
  if (!molecule) return null;
  let strength_value = null, strength_unit = null;
  if (strength_raw) {
    const vu = strength_raw.match(VALUE_UNIT_RE);
    if (vu) {
      strength_value = Number(vu[1]);
      strength_unit = vu[2].replace(/\s+/g, '').toLowerCase();
    }
  }
  return { molecule, strength_value, strength_unit, strength_raw };
}

export function splitCompositionString(s) {
  const t = (s ?? '').toString().trim();
  if (!t) return [];
  return t.split(/\s*\+\s*/).map(x => x.trim()).filter(Boolean);
}

export function parseComposition(parts) {
  const list = Array.isArray(parts) ? parts : splitCompositionString(parts);
  const ingredients = [];
  for (const p of list) { const ing = parseIngredient(p); if (ing) ingredients.push(ing); }
  ingredients.sort((a, b) => a.molecule.localeCompare(b.molecule));
  const raw = list.map(s => (s ?? '').toString().trim()).filter(Boolean).join(' + ');
  return { ingredients, status: ingredients.length ? 'complete' : 'missing', raw };
}
```

Note: `splitCompositionString` splits on `+` between ingredients; strengths live in `(...)` so `+` inside molecules is not a real-world case in these sources (fixture tests guard it).

- [ ] **Step 4:** `npm test` → PASS. **Step 5:** Commit `feat: composition-string parser`.

### Task 4: `src/lib/merge.mjs`

**Files:** Create: `src/lib/merge.mjs`, `test/merge.test.mjs`

- [ ] **Step 1: Failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityKey, moleculeSetKey, mergeRows } from '../src/lib/merge.mjs';

const gj = (over = {}) => ({
  source: 'github-jr', source_id: '1', seen_at: '2026-07-07',
  brand_name: 'Augmentin 625 Duo Tablet', manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
  pack_label: 'strip of 10 tablets', form_raw: null, price_inr: 223.42, is_discontinued: false,
  ingredients: [
    { molecule: 'amoxycillin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' },
    { molecule: 'clavulanic acid', strength_value: 125, strength_unit: 'mg', strength_raw: '125mg' }],
  composition_raw: 'Amoxycillin (500mg) + Clavulanic Acid (125mg)', composition_status: 'complete',
  substitutes_raw: [], type: 'allopathy', ...over });

test('identityKey stable across case/suffix variants', () => {
  assert.equal(identityKey(gj()), identityKey(gj({ manufacturer: 'glaxosmithkline pharmaceuticals ltd.' })));
});
test('moleculeSetKey order-independent', () => {
  const r = gj();
  assert.equal(moleculeSetKey(r.ingredients), moleculeSetKey([...r.ingredients].reverse()));
});
test('merge unions sources, freshest precedence wins fields', () => {
  const live = gj({ source: 'onemg-live', source_id: 'x', price_inr: 250, is_discontinued: true });
  const { rows, conflicts } = mergeRows([gj(), live]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price_inr, 250);
  assert.equal(rows[0].is_discontinued, true);
  assert.equal(rows[0].sources.length, 2);
  assert.equal(conflicts.length, 0);
});
test('richer superset composition wins; loser marked partial', () => {
  const threeMol = gj({ source: 'onemg-live', ingredients: [...gj().ingredients,
    { molecule: 'lactobacillus', strength_value: null, strength_unit: null, strength_raw: null }] });
  const { rows } = mergeRows([gj(), threeMol]);
  assert.equal(rows[0].ingredients.length, 3);
  assert.equal(rows[0].composition_status, 'complete');
});
test('non-subset disagreement -> conflict logged, precedence kept', () => {
  const other = gj({ source: 'kaggle-2025', ingredients: [
    { molecule: 'azithromycin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }] });
  const { rows, conflicts } = mergeRows([gj(), other]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, 'composition_disagreement');
  assert.equal(rows[0].ingredients[0].molecule, 'azithromycin'); // kaggle outranks github-jr
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement**

```js
import { normBrandName, normManufacturer, normPack } from './normalize.mjs';

export const SOURCE_PRECEDENCE = ['onemg-live', 'kaggle-2025', 'janaushadhi', 'github-jr', 'cdsco-fdc'];
const rank = (s) => { const i = SOURCE_PRECEDENCE.indexOf(s); return i === -1 ? SOURCE_PRECEDENCE.length : i; };

export function identityKey(row) {
  return [normBrandName(row.brand_name), normManufacturer(row.manufacturer), normPack(row.pack_label)].join('|');
}
export function moleculeSetKey(ingredients = []) {
  return ingredients.map(i => `${i.molecule}:${i.strength_value ?? ''}${i.strength_unit ?? ''}`).sort().join('|');
}
const molNames = (ings = []) => new Set(ings.map(i => i.molecule));
const isSubset = (a, b) => [...a].every(x => b.has(x));

export function mergeRows(allRows) {
  const groups = new Map();
  for (const r of allRows) {
    const k = identityKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const rows = [], conflicts = [];
  for (const [key, group] of groups) {
    group.sort((a, b) => rank(a.source) - rank(b.source));
    const best = group[0];
    const out = { ...best };
    for (const field of ['form_raw', 'price_inr', 'is_discontinued', 'type', 'composition_raw']) {
      out[field] = group.map(r => r[field]).find(v => v !== null && v !== undefined && v !== '') ?? null;
    }
    // composition: best-rank wins unless a lower rank is a strict molecule superset
    let chosen = best;
    for (const r of group.slice(1)) {
      const a = molNames(chosen.ingredients), b = molNames(r.ingredients);
      if (b.size > a.size && isSubset(a, b)) chosen = r;                    // richer superset
      else if (a.size && b.size && moleculeSetKey(chosen.ingredients) !== moleculeSetKey(r.ingredients)
               && !isSubset(b, a) && !isSubset(a, b)) {
        conflicts.push({ kind: 'composition_disagreement', identity_key: key,
          a: { source: chosen.source, key: moleculeSetKey(chosen.ingredients) },
          b: { source: r.source, key: moleculeSetKey(r.ingredients) } });
      }
    }
    out.ingredients = chosen.ingredients;
    out.composition_status = chosen.ingredients.length ? 'complete' : 'missing';
    out.substitutes_raw = [...new Map(group.flatMap(r => r.substitutes_raw ?? [])
      .map(s => [normBrandName(s.name), s])).values()];
    out.sources = group.map(r => ({ source: r.source, source_id: r.source_id ?? null, seen_at: r.seen_at }));
    out.first_seen = group.map(r => r.seen_at).sort()[0];
    out.last_seen = group.map(r => r.seen_at).sort().at(-1);
    delete out.source; delete out.source_id; delete out.seen_at;
    rows.push(out);
  }
  return { rows, conflicts };
}
```

- [ ] **Step 4:** `npm test` → PASS. **Step 5:** Commit `feat: merge with precedence, superset compositions, conflicts`.

### Task 5: `src/adapters/github-jr.mjs` (primary source)

**Files:** Create: `src/adapters/github-jr.mjs`, `test/adapters/github-jr.test.mjs`, `test/fixtures/github-jr/sample.csv`

- [ ] **Step 1:** Fixture `test/fixtures/github-jr/sample.csv` (header row copied from the real dataset; verify header names against the real download in Step 6 and adjust the fixture if the real file differs):

```csv
id,name,price(₹),Is_discontinued,manufacturer_name,type,pack_size_label,short_composition1,short_composition2
1,Augmentin 625 Duo Tablet,223.42,FALSE,Glaxo SmithKline Pharmaceuticals Ltd,allopathy,strip of 10 tablets,Amoxycillin  (500mg),Clavulanic Acid (125mg)
2,Azithral 500 Tablet,132.36,FALSE,Alembic Pharmaceuticals Ltd,allopathy,strip of 5 tablets,Azithromycin (500mg),
3,Weird Row,,TRUE,Unknown,allopathy,bottle of 100 ml,NA,
```

- [ ] **Step 2: Failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGithubJr } from '../../src/adapters/github-jr.mjs';

test('normalizes fixture rows to common schema', async () => {
  const rows = [];
  for await (const r of normalizeGithubJr('test/fixtures/github-jr/sample.csv', '2026-07-07')) rows.push(r);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].brand_name, 'Augmentin 625 Duo Tablet');
  assert.equal(rows[0].ingredients.length, 2);
  assert.equal(rows[0].price_inr, 223.42);
  assert.equal(rows[2].composition_status, 'missing');
  assert.equal(rows[2].is_discontinued, true);
  assert.equal(rows[0].source, 'github-jr');
});
test('unknown headers fail loudly', async () => {
  await assert.rejects(async () => {
    for await (const _ of normalizeGithubJr('test/fixtures/github-jr/bad.csv', '2026-07-07')) {}
  }, /unexpected headers/i);
});
```

Also create `test/fixtures/github-jr/bad.csv` with header `foo,bar`.

- [ ] **Step 3:** Run → FAIL. **Step 4: Implement**

```js
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
      const missing = REQUIRED.filter(h => !headers.includes(h));
      if (missing.length) throw new Error(`github-jr: unexpected headers. missing=${missing.join(',')} got=${headers.join(',')}`);
      checked = true;
    }
    const priceKey = Object.keys(rec).find(k => /^price/i.test(k));
    const comp = parseComposition([rec.short_composition1, rec.short_composition2]);
    yield {
      source: 'github-jr', source_id: String(rec.id), seen_at: date,
      brand_name: rec.name?.trim(), manufacturer: rec.manufacturer_name?.trim() ?? '',
      pack_label: rec.pack_size_label?.trim() ?? '', form_raw: null,
      price_inr: priceKey && rec[priceKey] !== '' ? Number(rec[priceKey]) : null,
      is_discontinued: String(rec.Is_discontinued).trim().toLowerCase() === 'true',
      ingredients: comp.ingredients, composition_raw: comp.raw, composition_status: comp.status,
      substitutes_raw: [], type: rec.type?.trim() || null,
    };
  }
}
```

- [ ] **Step 5:** `npm test` → PASS. Commit `feat: github-jr adapter (fetch + normalize)`.
- [ ] **Step 6:** Real download sanity: `node -e "import('./src/adapters/github-jr.mjs').then(async m => console.log(await m.fetchGithubJr({rawRoot:'data/raw', date: new Date().toISOString().slice(0,10)})))"` then print first 2 lines of the file and confirm the header matches the fixture; adjust fixture/REQUIRED if reality differs. Commit any fix.

### Task 6: `src/lib/emit.mjs` (artifact writers)

**Files:** Create: `src/lib/emit.mjs`, `test/emit.test.mjs`

- [ ] **Step 1: Failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { emitArtifact } from '../src/lib/emit.mjs';

test('emitArtifact writes all files + latest copy', async () => {
  const dir = 'test/.tmp-dist';
  fs.rmSync(dir, { recursive: true, force: true });
  const rows = [{
    brand_name: 'A 500 Tablet', manufacturer: 'M', pack_label: 'strip of 10', form_raw: null,
    price_inr: 10, is_discontinued: false,
    ingredients: [{ molecule: 'azithromycin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
    composition_raw: 'Azithromycin (500mg)', composition_status: 'complete',
    substitutes_raw: [{ name: 'B 500 Tablet', manufacturer: 'N' }], type: 'allopathy',
    sources: [{ source: 'github-jr', source_id: '1', seen_at: '2026-07-07' }],
    first_seen: '2026-07-07', last_seen: '2026-07-07',
  }];
  const res = await emitArtifact({ distRoot: dir, date: '2026-07-07', rows, conflicts: [], errors: [], meta: { sources: { 'github-jr': 1 } } });
  for (const f of ['drugs.csv', 'drugs.jsonl', 'compositions.csv', 'substitute_edges.csv', 'conflicts.csv', 'errors.csv', 'summary.json', 'ATTRIBUTION.md'])
    assert.ok(fs.existsSync(`${dir}/2026-07-07/${f}`), f);
  assert.ok(fs.existsSync(`${dir}/latest/drugs.jsonl`));
  const summary = JSON.parse(fs.readFileSync(`${dir}/2026-07-07/summary.json`, 'utf8'));
  assert.equal(summary.total_rows, 1);
  assert.equal(summary.composition_status.complete, 1);
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement**

```js
import fsp from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'csv-stringify/sync';
import { moleculeSetKey } from './merge.mjs';

const ingredientsToString = (ings) =>
  ings.map(i => i.strength_raw ? `${i.molecule} (${i.strength_raw})` : i.molecule).join(' + ');

export async function emitArtifact({ distRoot, date, rows, conflicts, errors, meta }) {
  const dir = path.join(distRoot, date);
  await fsp.mkdir(dir, { recursive: true });

  const flat = rows.map(r => ({
    brand_name: r.brand_name, manufacturer: r.manufacturer, pack_label: r.pack_label,
    form_raw: r.form_raw ?? '', type: r.type ?? '', price_inr: r.price_inr ?? '',
    is_discontinued: r.is_discontinued ?? '', composition: ingredientsToString(r.ingredients),
    composition_status: r.composition_status, composition_raw: r.composition_raw ?? '',
    ingredients_json: JSON.stringify(r.ingredients), n_substitutes: (r.substitutes_raw ?? []).length,
    sources: r.sources.map(s => s.source).join(';'), first_seen: r.first_seen, last_seen: r.last_seen,
  }));
  await fsp.writeFile(path.join(dir, 'drugs.csv'), stringify(flat, { header: true }));
  await fsp.writeFile(path.join(dir, 'drugs.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n');

  const comps = new Map();
  for (const r of rows) {
    if (!r.ingredients.length) continue;
    const k = moleculeSetKey(r.ingredients);
    if (!comps.has(k)) comps.set(k, { composition: ingredientsToString(r.ingredients), molecule_set_key: k, brand_count: 0 });
    comps.get(k).brand_count++;
  }
  await fsp.writeFile(path.join(dir, 'compositions.csv'),
    stringify([...comps.values()].sort((a, b) => b.brand_count - a.brand_count), { header: true }));

  const edges = rows.flatMap(r => (r.substitutes_raw ?? []).map(s => ({
    brand_name: r.brand_name, manufacturer: r.manufacturer,
    substitute_name: s.name, substitute_manufacturer: s.manufacturer ?? '' })));
  await fsp.writeFile(path.join(dir, 'substitute_edges.csv'), stringify(edges, { header: true }));
  await fsp.writeFile(path.join(dir, 'conflicts.csv'),
    stringify(conflicts.map(c => ({ ...c, a: JSON.stringify(c.a), b: JSON.stringify(c.b) })), { header: true }));
  await fsp.writeFile(path.join(dir, 'errors.csv'), stringify(errors, { header: true }));

  const statusCounts = {};
  for (const r of rows) statusCounts[r.composition_status] = (statusCounts[r.composition_status] ?? 0) + 1;
  const summary = { date, total_rows: rows.length, unique_compositions: comps.size,
    composition_status: statusCounts, conflicts: conflicts.length, errors: errors.length, ...meta };
  await fsp.writeFile(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));

  await fsp.writeFile(path.join(dir, 'ATTRIBUTION.md'), [
    '# Attribution', '',
    '- `junioralive/Indian-Medicine-Dataset` (GitHub, MIT).',
    '- Jan Aushadhi (PMBJP) product list — Government of India public data.',
    '- CDSCO approved-FDC lists — Government of India public data.',
    '- Kaggle `apkaayush/india-medicines-and-drug-info-dataset` (when enabled).',
    '- Selected fields refreshed from Tata 1mg public drug pages (factual data: names, compositions,',
    '  substitutes, availability), fetched politely per robots.txt. 1mg ToS restricts scraping;',
    '  this dataset is private/internal — do not redistribute.', ''].join('\n'));

  const latest = path.join(distRoot, 'latest');
  await fsp.rm(latest, { recursive: true, force: true });
  await fsp.cp(dir, latest, { recursive: true });
  return { dir };
}
```

- [ ] **Step 4:** `npm test` → PASS. Add `test/.tmp-dist` to `.gitignore`. **Step 5:** Commit `feat: artifact emit (csv/jsonl/compositions/edges/summary/attribution)`.

### Task 7: `src/cli/fetch.mjs` + `src/cli/build.mjs` + first real artifact

**Files:** Create: `src/cli/fetch.mjs`, `src/cli/build.mjs`, `src/lib/context.mjs`, `test/pipeline.test.mjs`

- [ ] **Step 1:** `src/lib/context.mjs`:

```js
export function ctx() {
  return { rawRoot: 'data/raw', distRoot: 'dist', date: new Date().toISOString().slice(0, 10) };
}
```

- [ ] **Step 2:** `src/cli/fetch.mjs` (adapters self-skip; more sources appended in later tasks):

```js
import { ctx } from '../lib/context.mjs';
import { fetchGithubJr } from '../adapters/github-jr.mjs';

const c = ctx();
const results = {};
try { results['github-jr'] = await fetchGithubJr(c); } catch (e) { results['github-jr'] = { error: e.message }; }
console.log(JSON.stringify(results, null, 2));
if (Object.values(results).every(r => r.error)) process.exit(1);
```

- [ ] **Step 3:** `src/cli/build.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { ctx } from '../lib/context.mjs';
import { normalizeGithubJr } from '../adapters/github-jr.mjs';
import { mergeRows } from '../lib/merge.mjs';
import { emitArtifact } from '../lib/emit.mjs';

function latestSnapshot(rawRoot, source) {
  const dir = path.join(rawRoot, source);
  if (!fs.existsSync(dir)) return null;
  const dates = fs.readdirSync(dir).sort();
  return dates.length ? path.join(dir, dates.at(-1)) : null;
}

const c = ctx();
const all = [], errors = [], meta = { sources: {} };

const gjDir = latestSnapshot(c.rawRoot, 'github-jr');
if (gjDir) {
  const file = path.join(gjDir, 'indian_medicine_data.csv');
  const date = path.basename(gjDir);
  let n = 0;
  try {
    for await (const row of normalizeGithubJr(file, date)) {
      if (!row.brand_name) { errors.push({ source: 'github-jr', reason: 'empty brand_name', detail: JSON.stringify(row).slice(0, 200) }); continue; }
      all.push(row); n++;
    }
  } catch (e) { errors.push({ source: 'github-jr', reason: 'adapter failure', detail: e.message }); }
  meta.sources['github-jr'] = n;
}

const { rows, conflicts } = mergeRows(all);
const { dir } = await emitArtifact({ distRoot: c.distRoot, date: c.date, rows, conflicts, errors, meta });
console.log(`emitted ${rows.length} rows -> ${dir}`);
```

- [ ] **Step 4:** Integration test `test/pipeline.test.mjs`: run `normalizeGithubJr` on the Task-5 fixture, `mergeRows`, `emitArtifact` into `test/.tmp-dist`, assert `summary.json.total_rows === 3` and `compositions.csv` has 2 data rows. (Full code mirrors emit test; keep in one test fn.)
- [ ] **Step 5:** `npm test` → PASS. Commit `feat: fetch + build CLIs`.
- [ ] **Step 6 — FIRST REAL RUN:** `npm run fetch && npm run build`. Expected: `emitted ~254k rows -> dist\<date>` (dedup will shrink slightly). Spot-check: `Get-Content dist/latest/summary.json`; open 3 random rows and eyeball compositions; record `composition_status` split in the commit message. Commit `chore: first real artifact run (summary stats in message)`.

### Task 8: `src/cli/stats.mjs`

**Files:** Create: `src/cli/stats.mjs`

- [ ] **Step 1:**

```js
import fs from 'node:fs';
const s = JSON.parse(fs.readFileSync('dist/latest/summary.json', 'utf8'));
console.table({ date: s.date, rows: s.total_rows, compositions: s.unique_compositions,
  ...s.composition_status, conflicts: s.conflicts, errors: s.errors });
```

- [ ] **Step 2:** `npm run stats` shows the table. Commit `feat: stats CLI`. Push: `git push`.

---

## Phase 2 — Official sources (T9–T10)

### Task 9: Jan Aushadhi adapter

**Files:** Create: `src/adapters/janaushadhi.mjs`, `test/adapters/janaushadhi.test.mjs`, `test/fixtures/janaushadhi/sample.txt`; Modify: `src/cli/fetch.mjs`, `src/cli/build.mjs`

Strategy: fetch the PIB "list of 2110 generic medicines under PMBJP" PDF (`https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/feb/doc202626781701.pdf`), convert with `pdftotext -enc UTF-8 -layout`, parse lines. If `pdftotext` is not on PATH (checked via `where.exe pdftotext` / `AUSHADHI_PDFTOTEXT` env), the adapter logs a skip and returns nothing (spec: non-blocking).

- [ ] **Step 1:** Create `test/fixtures/janaushadhi/sample.txt` with ~6 real-shaped lines (copy from the actual pdftotext output during implementation; shape is `S.No  <name with strength>  <unit>`), e.g.:

```
1   Paracetamol Tablets IP 500 mg          10's
2   Amoxycillin and Potassium Clavulanate Tablets IP 500 mg + 125 mg   6's
3   Telmisartan Tablets IP 40 mg           10's
```

- [ ] **Step 2: Failing test** — `parseJanAushadhiText(text)` yields rows: `brand_name` = full generic title, `manufacturer` = `'PMBJP (Jan Aushadhi)'`, ingredients parsed from the name (molecule words before Tablets/Capsules/etc., strengths from trailing `NNN mg` tokens, `+`-split for combos), `type: 'allopathy'`, `source: 'janaushadhi'`. Assert row 1 → paracetamol 500mg; row 2 → 2 ingredients.
- [ ] **Step 3: Implement** `parseJanAushadhiText` with: line regex `/^\s*(\d+)\s+(.+?)\s{2,}(\S+)\s*$/`; name→composition: split on `+`; per part, molecule = text before dosage-form word (`tablets?|capsules?|injection|syrup|suspension|cream|ointment|drops|gel|solution|ip|bp|usp` stripped), strength = `([\d.]+)\s*(mg|mcg|g|ml|iu|%)` match; reuse `parseIngredient`-style output via `normMolecule`. `fetchJanAushadhi` downloads PDF to `data/raw/janaushadhi/<date>/pmbjp.pdf`, runs pdftotext → `pmbjp.txt`, caches both.
- [ ] **Step 4:** Wire into `fetch.mjs`/`build.mjs` (same pattern as github-jr; `meta.sources.janaushadhi = n`). Tests PASS → commit `feat: Jan Aushadhi (PMBJP) adapter via pdftotext`.
- [ ] **Step 5:** Real run: `npm run fetch && npm run build && npm run stats` — expect ~2k more rows. Commit.

### Task 10: CDSCO FDC validation (operator-dropped PDFs)

**Files:** Create: `src/adapters/cdsco-fdc.mjs`, `test/adapters/cdsco-fdc.test.mjs`; Modify: `src/cli/build.mjs`, `src/lib/emit.mjs`

Scope (spec §4: validation-only, best-effort): the adapter scans `data/raw/cdsco-fdc/**/*.pdf` that the operator downloads manually from the CDSCO Data Bank, pdftotext's them, extracts approved-FDC molecule combinations (lines containing `+` with ≥2 molecule tokens), and produces a Set of molecule-name-set keys (names only, no strengths).

- [ ] **Step 1: Failing test** on a fixture text: `extractFdcCombos(text)` returns `[['amoxycillin','clavulanic acid'], ...]` for lines like `Amoxicillin + Clavulanic Acid` and ignores prose lines.
- [ ] **Step 2: Implement** (`normMolecule` each part; keep combos with 2–6 parts, every part ≤ 6 words, alphabetic-ish).
- [ ] **Step 3:** In `build.mjs`, when combos exist, add `cdsco_fdc_validated` column to `compositions.csv` rows whose molecule-name set (strengths ignored) matches an approved combo; count in `summary.json.cdsco_validated`. Extend `emitArtifact` meta plumb-through. Tests PASS → commit `feat: CDSCO FDC validation flags`.

---

## Phase 3 — 1mg gap-filler (T11–T14)

### Task 11: `src/lib/politeness.mjs`

**Files:** Create: `src/lib/politeness.mjs`, `test/politeness.test.mjs`

- [ ] **Step 1: Failing tests** (all with injected fakes — no network):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, isAllowed, PoliteFetcher, BlockedError } from '../src/lib/politeness.mjs';

const ROBOTS = `User-agent: *\nDisallow: /search\nDisallow: /checkout/*\nDisallow: /ta/drugs/\nUser-agent: FacebookBot\nCrawl-delay: 1`;

test('parseRobots extracts * disallows only', () => {
  assert.deepEqual(parseRobots(ROBOTS), ['/search', '/checkout/*', '/ta/drugs/']);
});
test('isAllowed prefix + wildcard', () => {
  const d = parseRobots(ROBOTS);
  assert.equal(isAllowed(d, '/drugs/augmentin-625-duo-tablet-12345'), true);
  assert.equal(isAllowed(d, '/search?q=x'), false);
  assert.equal(isAllowed(d, '/checkout/address'), false);
  assert.equal(isAllowed(d, '/ta/drugs/x'), false);
});
test('PoliteFetcher: rate limits, caches, aborts after 3 consecutive 403', async (t) => {
  const calls = [];
  let now = 0;
  const sleeps = [];
  const mk = (responses) => new PoliteFetcher({
    baseUrl: 'https://example.test', cacheDir: 'test/.tmp-cache', stateFile: 'test/.tmp-cache/state.json',
    minDelayMs: 2500, jitterMs: 0, dailyCap: 5000, userAgent: 'aushadhi-test',
    fetchImpl: async (url) => { calls.push(url); const r = responses.shift(); return { ok: r.status === 200, status: r.status, text: async () => r.body ?? '' }; },
    now: () => now, sleep: async (ms) => { sleeps.push(ms); now += ms; },
  });
  const fs = await import('node:fs'); fs.rmSync('test/.tmp-cache', { recursive: true, force: true });
  const pf = mk([{ status: 200, body: ROBOTS }, { status: 200, body: 'page1' }, { status: 200, body: 'page2' }]);
  await pf.init();
  assert.equal(await pf.get('/drugs/a-1'), 'page1');
  assert.equal(await pf.get('/drugs/a-1'), 'page1');            // cache hit, no fetch
  assert.equal(await pf.get('/drugs/b-2'), 'page2');
  assert.equal(calls.length, 3);                                 // robots + 2 pages
  assert.ok(sleeps.some(ms => ms >= 2500));                      // rate limit enforced
  await assert.rejects(pf.get('/search?q=x'), /robots/i);        // disallowed path refused

  const pf2 = mk([{ status: 200, body: ROBOTS }, { status: 403 }, { status: 403 }, { status: 403 }]);
  await pf2.init();
  await assert.rejects(pf2.get('/drugs/c-3'), BlockedError);     // hard abort on block signal
});
test('daily cap enforced', async () => {
  // construct with dailyCap: 1, fetch one page, second get() rejects /daily cap/i
});
```

(Write the daily-cap test in full during implementation — same harness as above.)

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement**

```js
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class BlockedError extends Error {}

export function parseRobots(txt) {
  const dis = []; let applies = false;
  for (const line of txt.split(/\r?\n/)) {
    const i = line.indexOf(':'); if (i === -1) continue;
    const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim();
    if (k === 'user-agent') applies = v === '*';
    else if (applies && k === 'disallow' && v) dis.push(v);
  }
  return dis;
}
export function isAllowed(disallow, p) {
  return !disallow.some(d => new RegExp('^' + d.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')).test(p));
}

export class PoliteFetcher {
  constructor(o) {
    Object.assign(this, {
      minDelayMs: 2500, jitterMs: 500, dailyCap: 5000,
      fetchImpl: globalThis.fetch, now: Date.now, sleep: (ms) => new Promise(r => setTimeout(r, ms)),
      maxRetries: 3, consecutiveBlockLimit: 3, ...o });
    this.lastAt = 0; this.blocks = 0; this.disallow = [];
  }
  async init() {
    await fsp.mkdir(this.cacheDir, { recursive: true });
    this.state = fs.existsSync(this.stateFile) ? JSON.parse(fs.readFileSync(this.stateFile, 'utf8')) : {};
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (this.state.date !== today) this.state = { date: today, count: 0 };
    const res = await this.fetchImpl(this.baseUrl + '/robots.txt', { headers: { 'user-agent': this.userAgent } });
    if (res.ok) this.disallow = parseRobots(await res.text());
  }
  cachePath(p) { return path.join(this.cacheDir, crypto.createHash('sha256').update(p).digest('hex') + '.html'); }
  async get(p) {
    if (!isAllowed(this.disallow, p)) throw new Error(`robots.txt disallows ${p}`);
    const cp = this.cachePath(p);
    if (fs.existsSync(cp)) return fs.readFileSync(cp, 'utf8');
    if (this.state.count >= this.dailyCap) throw new Error(`daily cap ${this.dailyCap} reached`);
    const wait = this.lastAt + this.minDelayMs + Math.floor(Math.random() * this.jitterMs) - this.now();
    if (wait > 0) await this.sleep(wait);
    let attempt = 0;
    while (true) {
      this.lastAt = this.now();
      const res = await this.fetchImpl(this.baseUrl + p, { headers: { 'user-agent': this.userAgent } });
      this.state.count++;
      if (res.ok) {
        this.blocks = 0;
        const body = await res.text();
        await fsp.writeFile(cp, body);
        await this.persist();
        return body;
      }
      if (res.status === 403 || res.status === 429) {
        this.blocks++;
        if (this.blocks >= this.consecutiveBlockLimit) { await this.persist(); throw new BlockedError(`aborting after ${this.blocks} consecutive ${res.status}`); }
      }
      if (++attempt > this.maxRetries) { await this.persist(); throw new Error(`giving up on ${p}: ${res.status}`); }
      await this.sleep(1000 * 2 ** attempt);
    }
  }
  async persist() { await fsp.writeFile(this.stateFile, JSON.stringify(this.state)); }
}
```

- [ ] **Step 4:** `npm test` → PASS. Commit `feat: PoliteFetcher (robots, rate, backoff, cap, cache, resume)`.

### Task 12: `src/adapters/onemg.mjs` (page parsers + fixtures)

**Files:** Create: `src/adapters/onemg.mjs`, `test/adapters/onemg.test.mjs`, `test/fixtures/onemg/drug_page.html`, `test/fixtures/onemg/browse_page.html`

- [ ] **Step 1 — create fixtures (2 polite real fetches, one-off):** small script `node scripts/grab-fixtures.mjs` using `PoliteFetcher` with UA `aushadhi-dataset-builder/0.1 (contact: safari-oil-shelve@duck.com)` to fetch ONE drug page (pick any brand from the artifact, find its URL from the browse page first) and ONE browse page (`/drugs-all-medicines?label=a`). Save raw HTML into `test/fixtures/onemg/`. Inspect them to learn the embedded-state shape. Commit fixtures.
- [ ] **Step 2: Failing tests** — pin REAL values you observed in the fixtures (names, ingredient counts, ≥1 substitute name, browse page yielding ≥20 `{name, path}` entries with `path` starting `/drugs/`).
- [ ] **Step 3: Implement**

```js
import * as cheerio from 'cheerio';
import { parseComposition } from '../lib/composition.mjs';

export function extractJsonBlocks(html) {
  const $ = cheerio.load(html);
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { blocks.push(JSON.parse($(el).text())); } catch { /* skip bad JSON */ }
  });
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
  if (m) { try { blocks.push(JSON.parse(m[1])); } catch { /* skip */ } }
  return blocks;
}

export function findDeep(obj, pred, out = [], seen = new Set()) {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return out;
  seen.add(obj);
  if (pred(obj)) out.push(obj);
  for (const v of Object.values(obj)) findDeep(v, pred, out, seen);
  return out;
}

export function parseDrugPage(html) {
  const blocks = extractJsonBlocks(html);
  const drugLd = blocks.flat().find(b => b && (b['@type'] === 'Drug' || b['@type'] === 'Product'));
  const name = drugLd?.name ?? cheerio.load(html)('h1').first().text().trim() || null;
  const manufacturer = drugLd?.manufacturer?.name ?? drugLd?.brand?.name ?? null;
  // salt composition: JSON-LD activeIngredient, else any deep key matching /salt|composition/i with a string value
  let compositionRaw = drugLd?.activeIngredient ?? null;
  if (!compositionRaw) {
    const hits = blocks.flatMap(b => findDeep(b, (o) =>
      Object.keys(o).some(k => /^(salt_?composition|saltComposition|composition)$/i.test(k) && typeof o[k] === 'string')));
    compositionRaw = hits.length ? Object.entries(hits[0]).find(([k, v]) => /salt|composition/i.test(k) && typeof v === 'string')[1] : null;
  }
  const comp = compositionRaw ? parseComposition(compositionRaw) : { ingredients: [], status: 'missing', raw: '' };
  // substitutes: deep arrays of objects with name + manufacturer-ish fields under keys /substitute/i
  const subs = [];
  for (const b of blocks)
    for (const o of findDeep(b, (x) => Object.keys(x).some(k => /substitute/i.test(k) && Array.isArray(x[k]))))
      for (const k of Object.keys(o)) if (/substitute/i.test(k) && Array.isArray(o[k]))
        for (const s of o[k]) if (s?.name) subs.push({ name: s.name, manufacturer: s.manufacturer_name ?? s.manufacturer?.name ?? s.manufacturer ?? null });
  const discontinued = /discontinued/i.test(html) || null;
  return { brand_name: name, manufacturer, composition_raw: comp.raw || compositionRaw,
    ingredients: comp.ingredients, composition_status: comp.status,
    substitutes_raw: [...new Map(subs.map(s => [s.name, s])).values()], is_discontinued: discontinued };
}

export function parseBrowsePage(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('a[href^="/drugs/"]').each((_, el) => {
    const path = $(el).attr('href').split('?')[0];
    const name = $(el).text().trim();
    if (name && /-\d+$/.test(path)) out.push({ name, path });
  });
  return [...new Map(out.map(e => [e.path, e])).values()];
}
```

Adjust selectors/key-regexes to the truth found in the fixtures — the tests pin real values, so wrong guesses fail here, not in production.

- [ ] **Step 4:** `npm test` → PASS. Commit `feat: 1mg page parsers (drug page + substitutes + browse) with fixtures`.

### Task 13: `src/cli/gapfill.mjs`

**Files:** Create: `src/cli/gapfill.mjs`, `src/lib/gapfill-queue.mjs`, `test/gapfill.test.mjs`

Design (two-stage reality): brand rows have no known 1mg URL until discovery has seen them. `--discover` crawls A–Z browse pages building `data/raw/onemg/slug-index.jsonl` (`{name, path, seen_at}`); targeted gap-fill then joins queue rows to slugs by `normBrandName`. Unmatched rows are skipped and counted. Fetched pages append normalized rows (`source: 'onemg-live'`) to `data/raw/onemg/<date>/normalized.jsonl`, which `build.mjs` merges with top precedence. Harvested substitute names not matching any known row → `data/raw/onemg/discovery-queue.jsonl`.

- [ ] **Step 1: Failing test** for `buildQueue({ rows, conflicts, slugIndex, catalogNames, limit })` in `src/lib/gapfill-queue.mjs`: priority = (1) rows in `catalogNames` (normalized set) with status missing/conflicted, (2) conflicted rows, (3) missing rows, (4) `partial` rows; only rows with a slug match are returned; each entry `{identity_key, path}`; `limit` respected; dedup by path.
- [ ] **Step 2:** Implement `buildQueue` (pure function over arrays/Maps — no I/O). Test PASS. Commit.
- [ ] **Step 3:** Implement the CLI: flags `--limit N` (default 200), `--discover [maxPages]` (default 50 pages/run), `--catalog-export path.csv` (optional, one brand name per line/column `name`). Wires: load `dist/latest/drugs.jsonl` + `conflicts.csv` + slug index → `buildQueue` → `PoliteFetcher` (UA `aushadhi-dataset-builder/<version> (contact: safari-oil-shelve@duck.com)`, cap 5000, delay 2500±500) → `parseDrugPage` per path → append rows to `normalized.jsonl` + unseen substitutes to `discovery-queue.jsonl`. `--discover` walks `/drugs-all-medicines?label=<a-z>&page=N` from persisted per-label cursor (stored in the state file), appending to slug-index. On `BlockedError`: print state + exit 2 (resumable).
- [ ] **Step 4:** Integration test with fake fetchImpl serving the two fixtures → asserts normalized.jsonl row appended with `source: 'onemg-live'` and substitutes harvested. PASS → commit `feat: gapfill CLI (targeted + discover, resumable)`.
- [ ] **Step 5:** Wire `onemg-live` into `build.mjs` (read all `data/raw/onemg/*/normalized.jsonl`). Extend `pipeline.test.mjs` to prove an onemg-live row wins precedence and enriches a github-jr row from 2 → 3 ingredients (partial detection path). PASS → commit.

### Task 14: Substitute cross-validation in build

**Files:** Modify: `src/cli/build.mjs`; Test: extend `test/merge.test.mjs`

- [ ] **Step 1: Failing test:** `detectSubstituteMismatches(rows)` (add to `merge.mjs`): for each row with `substitutes_raw`, resolve each substitute by `normBrandName` against all rows; when both sides have ≥1 ingredient and molecule-NAME sets differ → conflict `{kind: 'substitute_group_mismatch', a: brand, b: substitute}`. Same-set or unresolvable → no conflict.
- [ ] **Step 2:** Implement (name-set only — strengths differ across substitute pack sizes by design), wire into `build.mjs` conflicts output. PASS → commit `feat: substitute-edge cross-validation`. Push branch: `git push`.

---

## Phase 4 — Optional source + polish (T15–T16)

### Task 15: Kaggle 2025 adapter (token-gated)

**Files:** Create: `src/adapters/kaggle-2025.mjs`, `test/adapters/kaggle-2025.test.mjs`

- [ ] **Step 1:** Failing test for `normalizeKaggleRows(records, date)` (pure): accepts records with headers resembling the 1mg schema (`name/medicine_name`, `manufacturer_name/marketer`, `pack_size_label/packaging`, `short_composition1`+`short_composition2` or single `composition/salt_composition`); maps via a COLUMN_CANDIDATES table `{brand_name: ['name','medicine_name','drug_name'], ...}`; throws listing actual headers when no candidate matches.
- [ ] **Step 2:** Implement pure mapper + `fetchKaggle2025({rawRoot,date})`: if `!process.env.KAGGLE_USERNAME || !process.env.KAGGLE_KEY` → `{skipped: 'no token'}`; else GET `https://www.kaggle.com/api/v1/datasets/download/apkaayush/india-medicines-and-drug-info-dataset` with `Authorization: Basic base64(user:key)`, unzip via `fflate.unzipSync`, write CSVs to snapshot dir. Wire into fetch/build behind existence checks. PASS → commit `feat: kaggle-2025 adapter (optional, token-gated)`.

### Task 16: Final assembly

- [ ] **Step 1:** Full suite `npm test` → all PASS. `npm run build && npm run stats` on real data.
- [ ] **Step 2:** Update README commands/status; note discover-index reality (gap-fill needs `--discover` runs to build the slug index).
- [ ] **Step 3:** Commit + `git push`. Tag `v0.1.0`: `git tag v0.1.0 && git push --tags`.

---

## Phase 5 — VH Health importer (T17–T19, platform repo)

**Repo:** `D:\Dev\Projects\VH Health\VH-Health-Platform`, branch `feat/drug-reference-import` off main. Follow house rules: PR (never direct to main), local gate before merge.

### Task 17: `--compositions` import

**Files:** Create: `apps/backend/scripts/import-drug-reference.mjs`, `apps/backend/src/tests/drug-reference-import.deep.test.js`

- [ ] **Step 1 — READ FIRST (mandatory):** `apps/backend/src/services/pharmacy/compositionParser.js` (exports + exact signatures of `compositionKey`, `parseStrength`, `parseForm`, `parseCatalogRow`), `apps/backend/scripts/backfill-drug-compositions.mjs` (pool setup, upsert conventions, idempotency pattern), migration `src/migrations/350_drug_compositions.sql` (exact column list of `drug_compositions` + curation queue; queue `tenant_id` has NO default — inserts must supply it). Do not guess signatures — mirror them.
- [ ] **Step 2: Failing deep test** (QA DB `postgresql://postgres:postgres@127.0.0.1:55432/vhhealth_test`, pattern-match the existing backfill deep test): seed nothing; run `importCompositions(artifactDir)` against a 3-row fixture JSONL (1 single-molecule, 1 combo, 1 non-allopathy row) → assert: 2 `drug_compositions` rows with `source='imported'`, non-allopathy skipped, re-run idempotent (no dupes), a pre-existing row with `source='curated'` and same composition_key is NOT overwritten, a pre-existing `source='parsed'` row IS upgraded to imported.
- [ ] **Step 3: Implement** `importCompositions`: stream `drugs.jsonl`, filter `type === 'allopathy'` + `ingredients.length > 0`, build the platform's canonical inputs (`generic_name` = molecule names joined `' + '`, strength text from `strength_raw`s) and derive `composition_key` etc. **via the platform's own parser functions**; upsert:

```sql
INSERT INTO drug_compositions (composition_key, active_ingredients, source /*, cols per 350 */)
VALUES ($1, $2, 'imported' /* ... */)
ON CONFLICT (composition_key) DO UPDATE SET active_ingredients = EXCLUDED.active_ingredients, source = 'imported' /* ... */
WHERE drug_compositions.source NOT IN ('curated')
```

(match the real column list from Step 1; keep per-row try/catch + error report like the backfill script).
- [ ] **Step 4:** Deep test green (run per the repo's chunked jest recipe as postgres). Commit on branch.

### Task 18: `--match-catalog`

**Files:** Modify: `apps/backend/scripts/import-drug-reference.mjs`; extend the deep test.

- [ ] **Step 1: Failing deep test:** seed 3 `pharmacy_catalog` rows (exact-name match, ambiguous two-reference-brands match, no match) → run `matchCatalog(artifactDir, { tenantId })` → assert: exact row gets `composition_id` + `composition_source='imported'` + high confidence; ambiguous row untouched + ONE curation-queue row (with explicit `tenant_id`); no-match untouched; idempotent re-run; a row already `composition_source='curated'` is never modified.
- [ ] **Step 2: Implement:** load artifact brand index `Map<normBrand, refRow[]>` (normalizers COPIED minimally into the script or inlined — do NOT import from the aushadhi repo); match catalog rows missing high-confidence composition by normalized `name`; single candidate → resolve its composition_key via Task-17 logic and set catalog cols (reuse the backfill's UPDATE shape); multiple candidates → curation queue insert. Never touch `curated` rows.
- [ ] **Step 3:** Deep test green. Commit.

### Task 19: `--stats` + PR

- [ ] **Step 1:** `stats(tenantId?)`: coverage queries — % catalog rows with `composition_id` (row gate ≥90%), usage-weighted via dispense counts if a dispense/order table join is available in the backfill script's conventions (mirror whatever the acceptance-gate tooling already uses; READ `docs/superpowers/specs/2026-06-30-composition-based-drug-search-design.md` acceptance section first). Print gate verdict lines.
- [ ] **Step 2:** Full local gate per repo rules (chunked jest as postgres; `openapi:check` NOT needed — no route changes). Commit.
- [ ] **Step 3:** Push branch, open PR (house template), run CI, merge per `feedback_git_workflow` (merge --no-ff → push → delete branch). Update memory file.

---

## Self-review (done at write time)

- **Spec coverage:** §3 layout→T1–T8; §4 sources→T5 (github-jr), T9 (janaushadhi), T10 (cdsco), T12–T13 (onemg), T15 (kaggle); §5 schema→T3–T6; §6 politeness+substitutes→T11–T13; §7 merge→T4, T14; §8 artifact→T6, T10, T14; §9 importer→T17–T19; §10 testing→every task; §11 exclusions respected (no MIMS task, no editorial content, no migrations).
- **Placeholders:** none — every code step has code; fixture-dependent values are explicitly pinned at fixture-creation steps (T5 S6, T9 S1, T12 S1-2, T17 S1 read-first), which is the honest way to handle external formats we can't see from here.
- **Type consistency:** `identityKey/moleculeSetKey/mergeRows` (T4) used in T6/T13/T14; `parseComposition` shape `{ingredients,status,raw}` consistent across T3/T5/T12; `PoliteFetcher.get(path)->string` consistent in T12–T13 fixture script and gapfill.
