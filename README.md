# aushadhi

India drug reference builder: produces a versioned **brand → composition** dataset of drugs in the Indian market (~254k+ SKUs) from openly licensed datasets, official government sources (Jan Aushadhi, CDSCO), and a polite, capped Tata 1mg gap-filler.

Primary consumer: VH Health composition drug search (`drug_compositions` import + hospital catalog brand-matching).

- Design spec: [docs/superpowers/specs/2026-07-07-india-drug-reference-design.md](docs/superpowers/specs/2026-07-07-india-drug-reference-design.md)
- Artifacts land in `dist/<date>/` (gitignored — this repo is code only)
- MIMS is deliberately excluded (paywalled, copyrighted editorial content)

## Commands

```
npm run fetch     # download source snapshots (idempotent, cached)
npm run build     # normalize -> merge -> emit dist/<date>/
npm run stats     # summary of latest dist
npm test          # node:test suite (50 tests)

# gap-filler: call node directly (PowerShell eats `--` before npm flags)
node src/cli/gapfill.mjs --discover 50            # build/extend the slug index (A-Z browse)
node src/cli/gapfill.mjs --limit 200              # targeted fetches, priority: catalog > likely-truncated > conflicts > missing
node src/cli/gapfill.mjs --limit 200 --catalog-export names.csv   # prioritize hospital-catalog brands
node src/cli/gapfill.mjs --audit-sample 50        # measure the 2-slot truncation rate (and fix the sample)
```

NEVER run two gapfill/discover processes at once — the politeness rate limiter
and state file are per-process.

## Truncation

The primary dataset's 2-slot composition format truncates 3–4 molecule combos
(TB 4FDC kits, cold trios, quad dermatology creams). Live audit measured ~50%
of 2-slot rows truncated. `src/lib/known-combos.mjs` + `data-static/india-fdc-seeds.json`
build a self-growing knowledge base of real 3+ molecule combos and push
likely-truncated rows (visible pair ⊂ known combo) to the front of the gap-fill
queue; corrections propagate to same-composition brands via substitute-mismatch
conflicts. Verified end-to-end: AKT-4 Kit 2 → 4 molecules (rifampicin +
isoniazid + pyrazinamide + ethambutol).

## Sources (implemented)

| source | rows | notes |
|---|---|---|
| github-jr | 253,973 | MIT dataset; primary bulk |
| janaushadhi | 2,111 | PIB PDF via pdftotext (official generics) |
| kaggle-2025 | optional | needs `KAGGLE_USERNAME`/`KAGGLE_KEY` env |
| cdsco-fdc | validation | drop CDSCO PDFs into `data/raw/cdsco-fdc/` |
| onemg-live | gap-fill | polite fetcher: robots.txt-honoring, 1 req/2.5-3s, daily cap 5000, hard abort on 403/429, resumable |

Current artifact: **255,894 drugs, 12,338 unique compositions** (`dist/latest/`).

The gap-filler is two-stage: `--discover` builds a brand→URL slug index from the A–Z
browse pages (both server-rendering variants handled: anchors + JSON-LD ItemList);
targeted runs then fetch only rows needing work, harvest same-composition
**substitutes** for cross-validation + discovery, and feed `onemg-live` rows into the
next `build` at top merge precedence.
