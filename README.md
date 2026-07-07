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
node src/cli/gapfill.mjs --limit 200              # targeted fetches for missing/conflicted rows
node src/cli/gapfill.mjs --limit 200 --catalog-export names.csv   # prioritize hospital-catalog brands
```

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
