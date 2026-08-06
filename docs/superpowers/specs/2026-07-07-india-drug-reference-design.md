# aushadhi — India Drug Reference Builder (Design)

- **Date:** 2026-07-07
- **Status:** Approved (brainstorm session, user-approved design + 3 amendments)
- **Repo:** private GitHub `Bahuleyandr/aushadhi` (this repo)
- **Primary consumer:** VH Health composition drug search (`drug_compositions` + catalog brand-matching, coverage acceptance gate ≥90% rows / ≥95% usage-weighted)

## 1. Purpose

A repeatable pipeline that produces a comprehensive **brand → composition** reference of drugs available in the Indian market (~254k+ brand SKUs), built from openly licensed datasets + official government sources + a polite, capped 1mg live gap-filler. The artifact is a versioned set of flat files. A separate importer script in the VH Health platform repo loads it into the existing `drug_compositions` table and matches hospital catalogs against it.

## 2. Approved decisions

1. **Architecture:** thin builder / smart importer. The builder emits structured but VH-Health-agnostic data. It never computes `composition_key` / `strength_key` / `form_key` — all canonicalization happens at import time via VH Health's existing `compositionParser.js` (single source of truth; the code that already gates prescribing safety).
2. **Destination:** standalone tool (this repo) + `import-drug-reference.mjs` in the VH Health platform repo. No new VH Health tables, no migrations.
3. **Sources:** open data + official sources + polite 1mg gap-filler from day one. **MIMS is excluded** (paywalled, copyrighted editorial content).
4. **Repo:** private GitHub under `Bahuleyandr`.
5. **Scraper contact:** User-Agent identifies the tool and carries contact email `safari-oil-shelve@duck.com`. No other email is used anywhere in the tool.
6. **Substitutes harvesting (user amendment):** 1mg drug pages list other brands with the same composition ("substitutes"). The gap-filler captures these for (a) discovery of brands missing from our set, (b) cross-validation of parsed composition grouping. A 1mg-substitute pair landing in two different parsed composition groups is a parse-error signal → flagged, never silently trusted.

## 3. Stack & repo layout

Node 22, ESM, built-in `node:test`. Dependencies kept minimal: `cheerio` (HTML), `csv-parse` / `csv-stringify`. Global `fetch` (no HTTP lib).

```
aushadhi/
  src/
    adapters/            # one module per source: github-jr.mjs, kaggle-2025.mjs,
                         #   janaushadhi.mjs, cdsco-fdc.mjs, onemg.mjs
    lib/
      composition.mjs    # composition-string parser -> [{molecule, strength_value, strength_unit}]
      normalize.mjs      # name/manufacturer/pack normalizers, molecule alias map
      merge.mjs          # identity key, field precedence, conflict detection
      politeness.mjs     # rate limiter, robots.txt check, backoff, daily cap, resume state
    cli/                 # fetch.mjs, build.mjs, gapfill.mjs, stats.mjs
  test/                  # unit + fixture tests (node:test)
  test/fixtures/         # saved 1mg HTML pages, Jan Aushadhi samples, messy composition strings
  data/                  # gitignored: raw/<source>/<date>/ snapshots + gapfill cache/state
  dist/                  # gitignored: dist/<date>/ artifacts
  docs/superpowers/      # specs + plans
```

CLI surface:

```
npm run fetch            # download source snapshots (idempotent, cached, checksummed)
npm run build            # normalize -> merge -> emit dist/<date>/
npm run gapfill -- --limit N [--discover]   # polite 1mg fetcher (see §6)
npm run stats            # coverage/quality summary of latest dist
```

## 4. Sources & adapters

| # | Source | Role | Access | Notes |
|---|--------|------|--------|-------|
| 1 | `junioralive/Indian-Medicine-Dataset` (GitHub) | Primary bulk: ~253,973 brands — name, manufacturer, pack, price, discontinued, `short_composition1/2` | MIT, direct CSV | Vintage unclear; only 2 ingredient slots → 3+-molecule combos are truncated → `composition_status='partial'` |
| 2 | Kaggle `apkaayush/india-medicines-and-drug-info-dataset` (2025) | Fresher cross-check + extension | **Optional** — requires user's Kaggle API token; adapter skips gracefully if absent | |
| 3 | Jan Aushadhi (PMBJP) product list | ~2,110 official generics; adds rows + validates | Public gov data; web product list primary, PDF fallback via local `pdftotext` (Xpdf, present on this machine) | Best-effort parse; non-blocking |
| 4 | CDSCO approved-FDC lists | Validation of combination drugs | Public PDFs, best-effort | Non-blocking; validation-only role |
| 5 | 1mg live gap-filler | Fill `partial`/`missing` compositions, harvest substitutes, discover new launches, refresh discontinued flags | Polite scraper (§6) | Never a bulk crawl |

Adapter contract: `fetch(ctx) -> raw files under data/raw/<source>/<date>/` and `normalize(rawDir) -> AsyncIterable<Row>` of the common schema (§5). A source failing does not abort the run — it's reported in `summary.json`.

## 5. Common row schema (artifact)

```jsonc
{
  "brand_name": "Augmentin 625 Duo Tablet",
  "manufacturer": "GlaxoSmithKline Pharmaceuticals Ltd",
  "pack_label": "strip of 10 tablets",
  "form_raw": "tablet",              // as stated by source; NOT canonicalized
  "price_inr": 223.42,               // nullable
  "is_discontinued": false,          // nullable
  "ingredients": [                   // parsed, structured, order-normalized
    {"molecule": "amoxycillin", "strength_value": 500, "strength_unit": "mg"},
    {"molecule": "clavulanic acid", "strength_value": 125, "strength_unit": "mg"}
  ],
  "composition_raw": "Amoxycillin (500mg) + Clavulanic Acid (125mg)",
  "composition_status": "complete",  // complete | partial | missing
  "substitutes_raw": [               // only when a 1mg page was fetched
    {"name": "Moxikind-CV 625 Tablet", "manufacturer": "Mankind Pharma Ltd"}
  ],
  "type": "allopathy",               // evidence-derived category (see below); artifact keeps all, VH Health imports allopathy
  "sources": [{"source": "github-jr", "source_id": "12345", "seen_at": "2026-07-07"}],
  "first_seen": "2026-07-07",
  "last_seen": "2026-07-07"
}
```

Molecule strings are lower-cased, whitespace-collapsed, and passed through a **small, test-pinned alias map** (spelling variants only, e.g. `amoxicillin→amoxycillin`; grows only via reviewed additions). No therapeutic-equivalence logic — that stays in VH Health.

### `type` semantics

`type` is never a blanket constant per crawler: it is set to `'allopathy'` only
when a **named, fixture-pinned signal in the parsed page/payload** supports it,
and stays `null` otherwise.

- **`null` means "the source provided no category evidence for this row."** It
  does **not** mean "not allopathy". Consumers must not assume a type for null
  rows; filters like `type === 'allopathy'` deliberately exclude them (fail
  closed), and any consumer that wants those rows must derive its own evidence.
- Sources with a stated category pass it through (`github-jr`, `kaggle-2025`
  column values) or are allopathic by definition of the list itself
  (`janaushadhi` PMBJP generics, `nppa` NLEM ceiling prices).
- E-pharmacy crawls derive `type` per source from page evidence:

| Source | `type: 'allopathy'` iff | Rows left `null` |
|---|---|---|
| `onemg-live` | the product page carries a schema.org `Drug` JSON-LD block or `"pageType":"drug"` in its embedded router state | pages with neither marker |
| `apollo` | always on a parsed row — the parser hard-requires the schema.org `Drug` block, which is itself the page's category statement | n/a (pages without the block never produce a row) |
| `netmeds` | payload states drug schedule `G`/`H`/`H1`/`X` (never `E1`, the ayurvedic/unani poisons schedule), or `mstar-rxrequired` = "Rx required", or a CIMS taxonomy category | rows with none of those explicit fields — passing the composition digit-filter alone is not category evidence |
| `pharmeasy` | product node states `isRxRequired: true` (Rx-only sale under the D&C Rules schedules) | OTC rows; `productType` (unlabelled enum) and `therapy` (unverified vocabulary) are not trusted |

Because the signals live in the raw page cache (`data/raw/<source>/pages/`),
already-crawled products can be re-derived offline with
`node src/cli/backfill-type.mjs` — no re-crawl needed for cached pages.

## 6. 1mg gap-filler

**Scope discipline:** this is a *gap-filler and refresher*, never a bulk crawl. Work queue priority:

1. Rows with `composition_status='partial'` (truncated combos) that matter most — capped by priority score (rows matching a VH Health hospital catalog export, if provided, rank first)
2. Rows with `composition_status='missing'`
3. `--discover`: A–Z browse listing pages (`/drugs-all-medicines`, robots.txt-permitted) diffed against known set → new launches
4. Substitute names harvested from fetched pages that don't match any known row → appended to discovery queue

**Politeness (hard requirements, all test-covered):**

- Re-fetch and honor `robots.txt` at every startup; refuse to fetch disallowed paths (e.g. `/search` is disallowed → we never use search; language-variant drug pages disallowed → English pages only)
- User-Agent: `aushadhi-dataset-builder/<version> (contact: safari-oil-shelve@duck.com)`
- 1 request per 2.5s ± 0.5s jitter, single-threaded
- Exponential backoff on 429/5xx; **hard abort** after 3 consecutive 403/429 (block signal — never push through)
- Daily cap: 5,000 pages (configurable down, not up, without editing code)
- Every fetched page cached raw under `data/raw/onemg/pages/`; re-parses never re-fetch
- Resumable state file (`data/raw/onemg/state.json`) — interrupt-safe

**Parsing:** prefer the page's embedded structured JSON (JSON-LD / framework state) over CSS selectors; cheerio fallback. Extracts: composition (full ingredient list — fixes 2-slot truncation), substitutes list (names + manufacturers), discontinued/availability flag. Pinned by saved-HTML fixture tests so a 1mg redesign breaks tests, not production data.

## 7. Merge rules

- **Identity key:** `norm(brand_name) + norm(manufacturer) + norm(pack_label)`. Manufacturer is part of identity — same brand name from different companies stays distinct.
- **Field precedence (freshest wins):** `onemg-live` → `kaggle-2025` → `github-jr`. Jan Aushadhi/CDSCO join as their own rows and as validation flags.
- **Conflicts** (e.g. two sources disagree on composition; substitute-pair lands in different parsed groups → `substitute_group_mismatch`) go to `conflicts.csv` with both values + provenance. Conflicts never silently resolved.
- **Per-row failures** (unparseable composition, malformed row) go to `errors.csv`; the run never aborts on row errors.

## 8. Artifact (`dist/<date>/`)

| File | Contents |
|------|----------|
| `drugs.csv` / `drugs.jsonl` | one row per brand SKU (full schema above; CSV flattens ingredients to a canonical string + JSON column) |
| `compositions.csv` | unique molecule-set + strength combos with brand counts |
| `substitute_edges.csv` | harvested same-composition brand pairs (from 1mg substitutes) with provenance |
| `conflicts.csv`, `errors.csv` | see §7 |
| `summary.json` | per-source counts, parse-failure rates, composition_status breakdown, gapfill stats |
| `ATTRIBUTION.md` | source credits: MIT dataset, gov open data, 1mg-fetched factual fields + ToS-gray note |

`dist/latest` is a copy of the newest dated dir for stable consumer paths. Artifacts are **not** committed (repo is code only).

## 9. VH Health integration (platform repo, separate branch + PR)

One script: `apps/backend/scripts/import-drug-reference.mjs`. No migrations, no new tables.

- `--compositions <artifact-dir>`: for each unique composition, run through the **existing** `compositionParser` path → upsert into global `drug_compositions` with `source='imported'`. Existing precedence (curated > imported > parsed) already protects curated rows; imported must also never downgrade an existing imported/curated row's confidence.
- `--match-catalog <artifact-dir> [--tenant <id>]`: match `pharmacy_catalog` rows by exact-after-normalization brand name (strength/form as tie-breaks; reuse `enrichCatalogRowForWrite` conventions) → set `composition_id` + `composition_source='imported'` + high confidence. Ambiguous (multiple candidate brands) or fuzzy-only matches → existing `drug_composition_curation_queue` (**must supply `tenant_id` explicitly** — the queue has no GUC default). Never auto-apply a non-exact match.
- `--stats`: coverage report against the acceptance gate (row-count ≥90%, usage-weighted ≥95% top-dispensed, zero ambiguous injectables).
- Deep test against the QA DB (`postgresql://postgres:postgres@127.0.0.1:55432/vhhealth_test`), following the existing backfill deep-test pattern.
- VH Health imports **allopathy** rows only.

## 10. Testing strategy

TDD throughout (superpowers). `node:test`, zero test-framework deps.

- **Unit:** composition-string parser — real messy formats: `(500mg)`, `(500mg/5ml)`, `(15mcg)`, IU, `%w/v`, `NA`, missing strengths, 3+-ingredient overflow behavior; normalizers; alias map; merge precedence + conflict detection; politeness (rate/backoff/abort/cap logic with fake clock + fake fetch).
- **Fixtures:** saved 1mg drug page + browse page HTML; Jan Aushadhi sample; adapter normalize() golden outputs.
- **Integration:** full pipeline on fixture mini-sources → golden `dist/` snapshot.
- **VH Health importer:** QA-DB deep test (upsert precedence, curation-queue tenant_id, exact-match gating).

## 11. Out of scope (deliberate)

MIMS entirely; editorial content (uses/side-effects/interactions — copyright); price history/tracking; cron automation; new VH Health tables or migrations; autocomplete UI; therapeutic-equivalence logic in the builder.

## 12. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Primary dataset vintage unknown (likely 2022-era scrape) | Kaggle-2025 cross-check + gap-filler refresh; `last_seen` provenance per row |
| 2-slot composition truncation in primary dataset | `composition_status='partial'` + gap-filler priority queue |
| 1mg redesign breaks parser | Structured-JSON-first parsing, fixture-pinned tests, cached raw HTML |
| 1mg blocks us | Hard-abort politeness rules; open datasets already give ~95% coverage — gap-filler is additive, not critical-path |
| Kaggle token absent | Adapter optional, skips gracefully |
| Brand-name collisions across manufacturers | Manufacturer in identity key |
| Alias map wrong merge | Test-pinned, reviewed additions only; conflicts.csv surfaces disagreements |

## 13. Truncation strategy (addendum, approved 2026-07-07)

The primary source's 2-slot format truncates 3–4 molecule combos (TB FDCs, cold trios,
quad creams). Measured by live audit sample: **~50% of 2-slot rows are truncated**
(e.g. AKT-4 Kit: 2 → 4 molecules). Fix machinery:

1. **Known-combos knowledge base** (`src/lib/known-combos.mjs`): every artifact row with
   ≥3 parsed ingredients (janaushadhi + accumulated onemg-live fetches — self-growing)
   plus the curated seed list `data-static/india-fdc-seeds.json` (TB 3/4FDC, cold/cough
   trios, pain trios, cardio/diabetes triples, derm quads). Indexed by unordered molecule
   pairs for O(1) subset checks. Used ONLY to prioritize verification — never to assert.
2. **Queue priority**: catalog-matched → **likely-truncated** (pair ⊂ known combo) →
   conflicted → missing → remaining 2-slot candidates.
3. **`--audit-sample N`**: random-samples unverified 2-slot rows, measures the true
   truncation rate, and fixes the sampled rows as a side effect.
4. **Propagation flywheel**: a corrected combo page records its substitutes; stale
   2-molecule parses of those substitutes become `substitute_group_mismatch` conflicts
   on the next build → priority bucket → fetched → corrected.
