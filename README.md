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
npm test          # node:test suite

# local, read-only interaction check (current dist is private/internal)
# call Node directly on PowerShell because npm 11 consumes repeated --drug flags
node src/cli/interactions.mjs --profile internal-evaluation --drug "Augmentin 625 Duo Tablet" --drug "Azithral 500 Tablet"

# generate RxNorm/UNII mapping proposals; output remains review_candidate
node src/cli/propose-interaction-mappings.mjs --profile internal-evaluation --ingredient "warfarin"

# gap-filler: call node directly (PowerShell eats `--` before npm flags)
node src/cli/gapfill.mjs --discover 50            # build/extend the slug index (A-Z browse)
node src/cli/gapfill.mjs --limit 200              # targeted fetches, priority: catalog > likely-truncated > conflicts > missing
node src/cli/gapfill.mjs --limit 200 --catalog-export names.csv   # prioritize hospital-catalog brands
node src/cli/gapfill.mjs --audit-sample 50        # measure the 2-slot truncation rate (and fix the sample)
```

NEVER run two gapfill/discover processes at once — the politeness rate limiter
and state file are per-process.

## Interaction checker

The interaction checker resolves exact products, expands fixed-dose
combinations, and checks every unique cross-product ingredient pair against a
versioned clinician-reviewed rule pack. It never treats a missing rule as proof
of safety: the committed open rule pack currently declares coverage as
`unknown` and contains no invented clinical rules. The internal-evaluation pack
contains two clinician-approved rules: warfarin-amiodarone is restricted to six
combinations of five exact reviewed PMBJP oral-tablet assertions, and
warfarin-fluconazole is restricted to 12 combinations of seven exact reviewed
PMBJP oral-tablet assertions. Neither is loaded by `production-open`.

Every run requires an explicit release profile. `production-open` accepts only
sources whose licences and storage zones are approved for redistribution.
`internal-evaluation` may read the existing `dist/latest` artifact, which
contains restricted Jan Aushadhi and Tata 1mg provenance and must not be
redistributed. Ambiguous products and lossy legacy ingredient names are
reported as unresolved instead of being auto-selected or silently mapped.
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
| github-jr | 253,973 | MIT dataset; primary bulk |
| janaushadhi | 2,111 | official list; internal/restricted until reuse permission is cleared |
| kaggle-2025 | optional | disabled for interaction artifacts while its dataset licence is unknown |
| cdsco-fdc | validation | internal/restricted until reuse permission is cleared |
| onemg-live | gap-fill | private/internal only; non-redistributable |

Current artifact: **255,894 drugs, 12,148 unique compositions** (`dist/latest/`).

The gap-filler is two-stage: `--discover` builds a brand→URL slug index from the A–Z
browse pages (both server-rendering variants handled: anchors + JSON-LD ItemList);
targeted runs then fetch only rows needing work, harvest same-composition
**substitutes** for cross-validation + discovery, and feed `onemg-live` rows into the
next `build` at top merge precedence.
