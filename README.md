# aushadhi

India drug reference builder: produces a versioned **brand → composition** dataset of drugs in the Indian market from openly licensed datasets, official government sources (Jan Aushadhi, CDSCO), and a polite, capped Tata 1mg gap-filler.

Primary consumer: VH Health composition drug search (`drug_compositions` import + hospital catalog brand-matching).

- Design spec: [docs/superpowers/specs/2026-07-07-india-drug-reference-design.md](docs/superpowers/specs/2026-07-07-india-drug-reference-design.md)
- Complete artifacts land in immutable `dist/.generations/<generation-id>/`
  directories and are selected through the atomically replaced
  `dist/cohort-index.json` (all gitignored — this repo is code only)
- MIMS is deliberately excluded (paywalled, copyrighted editorial content)

## Commands

```
npm run fetch     # download source snapshots (idempotent, cached)
npm run build     # normalize -> merge -> atomically publish one immutable cohort
npm run stats     # summary of latest dist
npm test          # node:test suite

# validate the separately generated production-open data package
npm run package:production-open:check

# stage that data-only package under dist/ (never changes canonical sources)
npm run package:production-open

# local interaction check against the production-open rule pack
node src/cli/interactions.mjs --profile production-open --drug "Example A" --drug "Example B"

# gap-filler: call node directly (PowerShell eats `--` before npm flags)
node src/cli/gapfill.mjs --discover 50            # build/extend the slug index (A-Z browse)
node src/cli/gapfill.mjs --limit 200              # targeted fetches, priority: catalog > likely-truncated > conflicts > missing
node src/cli/gapfill.mjs --limit 200 --catalog-export names.csv   # prioritize hospital-catalog brands
node src/cli/gapfill.mjs --audit-sample 50        # measure the 2-slot truncation rate (and fix the sample)
```

Never run two gapfill/discover processes against the same source state. The
persistent state lock, shared request-spacing record, and operator hold are
deliberately fail-closed.

## Distribution boundary

The root project is a private development repository. Its npm package is
deliberately metadata-only and is not a data or runtime distribution.

The separately generated `@aushadhi/production-open-interactions` package
contains only the canonical production-open rules file and a schema projection
whose profile is narrowed to `production-open`. The canonical rules are empty
and declare coverage as `unknown`. A blank result does not mean safety and must
never be presented as proof that no interaction exists.

## Interaction checker

The interaction checker resolves exact products, expands fixed-dose
combinations, and checks every unique cross-product ingredient pair against a
versioned clinician-reviewed rule pack. It never treats a missing rule as proof
of safety: the committed open rule pack currently declares coverage as
`unknown` and contains no invented clinical rules. Private review packs,
identity mappings, evidence captures, and operational controls are not loaded
by `production-open` and are never included in the public data package.

Every run requires an explicit release profile. `production-open` accepts only
sources whose licences and storage zones are approved for redistribution.
Other profiles may read private data and must not be redistributed. Ambiguous
products and lossy legacy ingredient names are reported as unresolved instead
of being auto-selected or silently mapped.
Observed ingredient strings require a human-reviewed typed RxNorm/UNII
mapping, and a runtime subject requires a separately reviewed concrete product
route and formulation. Brand and pack text never infer either.
Clinical matching also requires that reviewed runtime subject at check time and
an exact product pair listed by the reviewed rule.

The internal pack is generated, not hand-edited. Its promotion manifest binds
the exact attested draft row, clinician approval, source versions, reviewed
ingredient identities, reviewed product presentations, and allowed product
pairs. Verify deterministic regeneration with:

```powershell
npm run interactions:promote:check
```

Results distinguish reviewed clinical findings, source-grounded review
candidates, unresolved input gaps, therapeutic duplication, and checks that
were not performed. `clinical_interaction_status`, `outcome_code`,
`checks_performed`, and `capability_limitations` make those states explicit.
Review candidates always expose `severity: "unknown"` with null mechanism and
management until a clinician-reviewed promotion authorizes them.

The root package manifest uses an empty npm `files` allowlist. This excludes all
source code, datasets, review material, runtime state, credentials, logs, and
archives by construction. It does not make private runtime outputs
redistributable.

Structured disambiguation is accepted as JSON, for example:

```
--drug '{"brand_name":"Example","manufacturer":"Maker","strengths":["10 mg"],"form_raw":"tablet","pack_label":"strip of 10 tablets"}'
```

See [the interaction evidence plan](docs/plans/2026-07-10-aushadhi-interaction-evidence-layer.md),
the [reviewed mapping workflow](docs/interaction-mapping.md), and the
[source/licence manifest](data-static/interaction-sources.json).

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
| github-jr | 253,973 | MIT dataset; primary bulk. MIT covers the uploader's compilation only and does **not** clear underlying (likely scraped) rights — provenance risk. See [licensing report](docs/LICENSING_REPORT.md) |
| janaushadhi | 2,111 | official list; internal/restricted until reuse permission is cleared |
| kaggle-2025 | optional | disabled for interaction artifacts while its dataset licence is unknown |
| cdsco-fdc | validation | internal/restricted until reuse permission is cleared |
| onemg-live | gap-fill | private/internal only; non-redistributable |
| pharmeasy | gap-fill | private/internal only; non-redistributable — site ToS bars scraping + reproduction |
| netmeds | gap-fill | private/internal only; non-redistributable — site ToS bars scraping + reproduction |
| apollo | gap-fill | private/internal only; non-redistributable — site ToS bars reproduction (scraping clause unverified) |
| nppa | 732 | ceiling prices; **cleared as Official Gazette matter** under Copyright Act s.52(1)(q)(i), attribution to NPPA recommended (manifest flag kept fail-safe pending an open-government licence token) |

See [`docs/LICENSING_REPORT.md`](docs/LICENSING_REPORT.md) for the full per-source
licensing verdicts, the legal backdrop, and recommended actions, and
[`docs/PERMISSION_REQUEST_DRAFTS.md`](docs/PERMISSION_REQUEST_DRAFTS.md) for the
permission-request drafts.

Artifact counts are runtime state and are not hard-coded here. `npm run stats`
reads the currently indexed immutable cohort and reports its bound totals.

The gap-filler is two-stage: `--discover` builds a brand→URL slug index from the A–Z
browse pages (both server-rendering variants handled: anchors + JSON-LD ItemList);
targeted runs then fetch only rows needing work, harvest same-composition
**substitutes** for cross-validation + discovery, and feed `onemg-live` rows into the
next `build` at top merge precedence.
