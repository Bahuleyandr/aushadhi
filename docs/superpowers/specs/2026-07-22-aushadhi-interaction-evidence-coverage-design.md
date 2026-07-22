# Aushadhi Interaction Evidence-Coverage Layer — Design Spec

- **Date:** 2026-07-22
- **Status:** Design — awaiting review
- **Branch:** `feat/interaction-evidence-coverage` (off `feat/interaction-evidence`)
- **Extends:** [`docs/plans/2026-07-10-aushadhi-interaction-evidence-layer.md`](../../plans/2026-07-10-aushadhi-interaction-evidence-layer.md) — realises Tasks 3–6 with concrete, grounded sources.

## 1. Goal

The interaction checker on `feat/interaction-evidence` is structurally complete (ingredient resolver, pairwise kernel, source-policy, CLI, tests) but ships an **empty rule pack**, so every query returns "coverage unknown." This increment fills that pack with real, provenance-carrying interaction **candidates** from two verified public-domain sources, moving the checker from `declared_coverage: unknown` to `partial` — **without changing its safety contract** (missing evidence is never "safe"; nothing is presented as clinician-reviewed advice until a human signs it off).

## 2. What already exists (build on, do not rebuild)

From `feat/interaction-evidence` (verified against source):

- **Kernel** `src/lib/interaction-checker.mjs` — exports `checkResolvedProducts({ resolvedInputs, rulePack, reviewCandidates = [] })`, `validateRulePack`, `generateCrossDrugPairs`, `pairKey`, `DISCLAIMER`. **Crucially, it already accepts `reviewCandidates` separately from clinician-reviewed `rulePack`** — this is exactly where our derived output plugs in.
- **Enums** (kernel-internal, authoritative): `REVIEW_STATUSES = {clinician_reviewed, review_candidate}`; `COVERAGE_VALUES = {complete, partial, unknown}`; `MAPPED_STATUSES = {exact, reviewed_override}`.
- **Rule/candidate schema** `data-static/interaction-rules.schema.json` — pack: `{schema_version, pack_id, pack_version, profile, licence, source_ids, declared_coverage, rules[]}`; each rule carries `severity`, `mechanism` (nullable), the ingredient pair, `applicability`, and an **evidence** object requiring `{source, document_id, document_version, retrieved_at, jurisdiction, excerpt, licence, review_status}` (+ optional `source_url` which must be `https://`, `source_identifier`).
- **Source policy** `src/lib/interaction-source-policy.mjs` + `data-static/interaction-sources.json` — `assertSourceAllowed(source, {profile})`; a manifest entry is `{id, name, homepage, license, commercial_use, redistribution, role, retrieved_at}`; profiles are `production-open` (rejects non-commercial/unknown-licence) and `internal-evaluation`.
- **Ingredient index** — `{ingredient_id, canonical_name, observed_names[], precise_substances[], product_count, ...}`, 2,292 ingredients over 255,894 products.

## 3. Sources — grounded 2026-07-22 (evidence, not assumption)

- **DGIdb — REJECTED.** Both the flat TSV and the *full relational dump* (122,786 attributes, 37,143 typed claims) were mined. CYP/transporter genes carry **only `inhibitor` typing (42 claims / 26 drugs); zero `substrate`, zero `inducer`** anywhere; the 118 free-text "substrate" attributes that survive a gene join are all on IUPHAR *receptors*/transporters, none on CYPs. DGIdb is a drug-**target** database; it cannot seed a metabolic-interaction layer. Set aside.
- **FDA "Table of Substrates, Inhibitors and Inducers" — mechanism backbone.** Per-enzyme role×strength grid: substrates (sensitive, moderate), inhibitors (strong/moderate/weak), inducers (strong/moderate), across CYP1A2/2B6/2C8/2C9/2C19/2D6/3A + P-gp/BCRP/OATP1B1/1B3/OAT/OCT/MATE. **US public domain** (17 U.S.C. §105). ~few hundred drugs. **Caveats:** HTML-only and bot-blocked (no API/CSV → ingest as a curated snapshot); needs a US↔INN name normalizer (`rifampin`→`rifampicin`, `phenobarbital`→`phenobarbitone`). Aushadhi coverage measured at **~72% of CYP3A drugs raw, ~76% after trivial spelling fixes**; residual misses are genuinely not on the Indian market.
- **openFDA drug-label API — evidence/citation layer.** **CC0**; `https://api.fda.gov/drug/label.json`, keyed by `openfda.rxcui`/`unii`/`generic_name`/`substance_name`. `drug_interactions` is **free-text prose** (not structured), so it is used for citation evidence and *deterministic* "another known ingredient is explicitly named" extraction — never for NLP-inferred severity. Rate limits 240/min, 1,000/day (120,000/day with a free key).

## 4. Architecture

Two phases, both emitting `review_candidate`s into the existing kernel's `reviewCandidates` path. Both sources are public-domain, so both packs are **`production-open` eligible** (an upgrade over DGIdb's internal-only posture).

```
FDA table (curated snapshot) ──► normalize (US↔INN + salt-strip) ──► match to ingredient index
   └► per-ingredient enzyme-role profile ──► materialize inhibitor/inducer × substrate candidates ──┐
openFDA labels (fetch+cache) ──► deterministic "named ingredient" extraction ──► label candidates ──┤
                                                                                                     ▼
                                                        existing checker  checkResolvedProducts({ reviewCandidates })
                                                                     └► candidates: severity unknown, full provenance, DISCLAIMER
```

## 5. Phase 1 — FDA CYP/transporter mechanism backbone (primary, shippable increment)

### 5.1 Curated snapshot — `data-static/fda-dds-table.json`
A transcribed, versioned snapshot of the FDA table (the page is not machine-fetchable, and the data is small and stable, so a human-auditable snapshot is the correct ingestion — not a fragile scraper). Shape:
```json
{ "source_url": "https://www.fda.gov/.../table-substrates-inhibitors-and-inducers",
  "table_version": "2023-current", "retrieved_at": "2026-07-22", "licence": "public-domain-usgov",
  "enzymes": { "CYP3A": { "inhibitor": { "strong": ["ketoconazole", ...], "moderate": [...], "weak": [...] },
                          "inducer":   { "strong": ["rifampin", ...], "moderate": [...] },
                          "substrate": { "sensitive": ["simvastatin", ...], "moderate": [...] } }, ... },
  "transporters": { "P-gp": { ... } }, "non_drug_entities": ["grapefruit juice", "st. john's wort"] }
```

### 5.2 Name normalization — `data-static/drug-name-synonyms.json`
An explicit, auditable US↔INN/BAN map (`{"rifampin":"rifampicin", "phenobarbital":"phenobarbitone", ...}`), applied together with the index's existing salt-strip. **No silent fuzzy matching** — a name either matches exactly, via a declared synonym, or is logged unmatched.

### 5.3 Ingestion + matcher — `src/lib/fda-cyp-roles.mjs` + `src/cli/build-fda-cyp-roles.mjs`
Load snapshot → normalize each `(enzyme, role, strength, drug)` → match to the ingredient index (`canonical_name` + `observed_names`) → emit **per-ingredient enzyme-role profile** `data/interaction/<profile>/fda-cyp-roles.jsonl`:
```json
{ "ingredient_id": "...", "canonical_name": "ketoconazole",
  "roles": [ { "enzyme": "CYP3A", "role": "inhibitor", "strength": "strong", "evidence_ref": "fda-dds:CYP3A:inhibitor:strong" } ] }
```
Plus a coverage report of matched / synonym-matched / unmatched FDA drugs, and the `non_drug_entities` recorded as special DDI entities (not force-matched to ingredients).

### 5.4 Candidate materializer — `src/lib/fda-cyp-candidates.mjs`
From the role profile, for each enzyme pair every `{inhibitor|inducer}` ingredient A with every `{substrate}` ingredient B (A≠B, deduped unordered) → a `review_candidate` conforming to the rule schema:
```json
{ "pair": ["<A_id>", "<B_id>"], "severity": "unknown", "review_status": "review_candidate",
  "mechanism": "CYP3A: ketoconazole (strong inhibitor) + simvastatin (sensitive substrate)",
  "evidence": { "source": "fda-dds-table", "document_id": "fda-dds", "document_version": "<table_version>",
                "retrieved_at": "2026-07-22", "jurisdiction": "US",
                "excerpt": "FDA classifies ketoconazole as a strong CYP3A inhibitor and simvastatin as a sensitive CYP3A substrate.",
                "licence": "public-domain-usgov", "review_status": "review_candidate" },
  "applicability": { ... } }
```
Emitted as `data-static/interaction-candidates.fda-cyp.json` (`profile: production-open`, `declared_coverage: partial`, `source_ids: ["fda-dds-table"]`). Strength (strong inhibitor × sensitive substrate) is carried as a **priority hint only**; severity stays `unknown` until clinician review promotes it (Task 10).

### 5.5 Checker integration
The role profile also enables **runtime derivation** — the checker can compute a candidate for an entered pair directly from roles (so coverage isn't limited to the pre-materialized pack). The materialized pack is loaded via the kernel's existing `reviewCandidates` argument.

### 5.6 Source policy
Add `fda-dds-table` to `interaction-sources.json`: `{license: "public-domain-usgov", commercial_use: true, redistribution: true, role: "mechanism-classification", ...}` — passes `assertSourceAllowed` under `production-open`.

## 6. Phase 2 — openFDA label evidence layer

### 6.1 Fetch + cache — `src/lib/openfda-fetch.mjs` + `src/cli/fetch-openfda-labels.mjs`
For matched ingredients, query by `openfda.generic_name`/`substance_name`; cache raw label JSON under `data/interaction/<profile>/openfda-cache/` with `set_id` + `retrieved_at`; dedup per `generic_name`/`rxcui` (one record per SPL). Rate-limit aware (240/min; optional `OPENFDA_API_KEY`).

### 6.2 Deterministic extraction — `src/lib/openfda-extract.mjs`
From `drug_interactions` text, emit a `review_candidate` **only** when another **known Aushadhi ingredient** (canonical/observed name or declared synonym) is *explicitly named* in the text (exact token match; no NLP, no inferred severity). Evidence = the naming sentence excerpt + `set_id` + `retrieved_at` + `CC0-1.0`.

### 6.3 Corroboration
Where an openFDA excerpt corroborates an FDA-mechanism candidate pair, attach it as additional evidence on that candidate (stronger provenance, still `review_candidate`).

### 6.4 Source policy
Add `openfda-label`: `{license: "CC0-1.0", commercial_use: true, redistribution: true, role: "label-evidence", ...}` — `production-open` eligible.

## 7. Safety & honesty (contract preserved)

- Every output is `review_status: review_candidate`, `severity: unknown`, with complete provenance and the existing `DISCLAIMER`. Never presented as clinician advice.
- **Empty result = "coverage unknown," never "safe / no interaction."**
- Normalization is explicit and auditable; unmatched drugs are logged, not silently dropped or fuzzily coerced.
- Non-drug DDI entities (grapefruit juice, St John's wort) are flagged as special entities, not forced into the ingredient index.
- Clinician review (plan Task 10) is the only path that promotes a `review_candidate` to a `clinician_reviewed` rule with a real severity.

## 8. Testing

- **`fda-cyp-roles`**: fixtures for exact / synonym / salt-strip / unmatched matching; a golden CYP3A enzyme block; coverage-report correctness.
- **`fda-cyp-candidates`**: inhibitor×substrate ⇒ candidate; substrate×substrate ⇒ none; inducer×substrate ⇒ candidate; schema conformance; provenance completeness; A≠B and dedupe.
- **`openfda-extract`**: label text naming a known ingredient ⇒ candidate with the naming excerpt; text naming no known ingredient ⇒ none; fetch/cache is mocked (no live network in tests).
- **`source-policy`**: `fda-dds-table` + `openfda-label` allowed under `production-open`; manifest-schema conformance.
- **Clinical golden case**: `ketoconazole` (strong CYP3A inhibitor) + `simvastatin` (sensitive CYP3A substrate) ⇒ a candidate with FDA evidence — a real, well-known contraindication surfaced end-to-end through the CLI.

## 9. Build sequence & scope

1. **Phase 1 (FDA backbone)** — deterministic and offline after the one-time snapshot transcription; the higher-value, shippable first cut.
2. **Phase 2 (openFDA)** — network fetch + deterministic extraction; layered on top for citation depth and label-stated coverage.

**Explicitly out of scope (this increment):** pharmacodynamic interactions (QT prolongation, serotonin syndrome, additive bleeding) — a documented gap this mechanism/label layer does *not* cover; clinician severity assignment (the human gate, Task 10); DGIdb; RxNorm identity mapping (not required — `generic_name` + salt-strip + the synonym map suffice for the first cut); any web/API/patient-facing surface (the plan mandates a local, read-only checker until clinical validation).

## 10. Decisions to confirm at planning time

- Severity encoding for unreviewed candidates: use the literal string `"unknown"` (schema requires a non-empty `severity`; kernel treats display of severity as gated on `clinician_reviewed`). Confirm against `validateRule`.
- Snapshot transcription method: a curated first-pass JSON authored from the FDA lists (feasible at a few-hundred-drug scale) with the source URL + retrieval date embedded, versioned in `data-static/`.
