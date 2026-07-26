# Aushadhi Interaction Evidence-Coverage Layer — Design Spec (v2)

- **Date:** 2026-07-22 (v2 — revised after independent cross-review)
- **Status:** Design — awaiting re-review
- **Branch:** `feat/interaction-evidence-coverage` (off `feat/interaction-evidence`)
- **Extends:** [`docs/plans/2026-07-10-aushadhi-interaction-evidence-layer.md`](../../plans/2026-07-10-aushadhi-interaction-evidence-layer.md)

## 0. What the cross-review changed (v1 → v2)

An adversarial review (reproduced against the code + live sources) refuted several v1 decisions. All accepted:

1. **No auto-inferred pairwise packs.** v1 materialized inhibitor×substrate *pairs* as candidates — which violates the parent plan's explicit rule that FDA tables yield *mechanism/class* candidates only, "never inferred pairwise rules." **v2: roles are the canonical artifact; pair-level output exists only as `review_candidate` *hypotheses*, labelled class-inference, generated at query time / into a review queue — never a shipped production pair pack.**
2. **FDA table is machine-fetchable.** v1 said "HTML-only, bot-blocked → hand-transcribe." It returns **302→200** and is an 11-column structured HTML table with an export hook; v1 also used the *wrong* (narrow "drug development") page. **v2: mechanically parse the broad "healthcare professionals" table, pin + hash it.**
3. **Reviewed identity is required first.** The current ingredient index is 100% normalized-fallback identity (with junk canonicals like `b`, `water`, `hydrochloride`); a live ketoconazole/simvastatin query resolved both products but checked **zero** pairs (both needed review). Exact-name + salt-strip + a few synonyms is insufficient (prodrugs, active moieties, stereoisomers, regimens). **v2: a reviewed RxNorm/UNII identity map with typed relationships precedes matching.**
4. **openFDA cannot originate candidates.** Free-text labels carry negations, combination-product text, animal findings, duplicate SPL bodies; naive token matching makes `e`→"e.g." **v2: openFDA only *corroborates* a reviewed pair or emits an `unclassified_label_mention` review item.**
5. **Coverage must be computed, not pack-declared.** The kernel copies `rulePack.declared_coverage`, so a non-matching *partial* pack returns `partial`, not `unknown`. **v2: compute scoped `assessed`/`not_assessed` coverage and surface it in CLI output.**
6. **Contracts must be closed.** `validateReviewCandidate` has no top-level key allowlist, so `display_severity`/`advice` pass through, and output echoes them. **v2: closed candidate schema + output projection allowlist + directive-language ban + evidence↔manifest licence reconciliation + route/dose/population applicability enforced.**

## 1. Goal

Move the checker from an empty pack to **role-grounded, honestly-scoped** coverage **without inferring pairwise rules**. Ship a pinned FDA role inventory, a reviewed identity map, computed scoped coverage, and closed contracts. Surface mechanistic pair hypotheses only as `review_candidate`s (never advice). Missing evidence is never "safe"; unassessed scopes are named, not hidden.

## 2. Contracts to implement against (verified in code — do not drift)

- `checkResolvedProducts({ resolvedInputs, rulePack, reviewCandidates = [] })`. **The CLI (`src/cli/interactions.mjs`) does not yet pass `reviewCandidates` — wire it.**
- `validateReviewCandidate`: `review_status` = `'review_candidate'`; `severity` ∈ `{undefined,'unknown'}`; **`mechanism` must be `null`**; **`management` must be `null`**; **`evidence` must be a non-empty ARRAY**; requires `pair` or `pair_key`. **It has no top-level key allowlist today — add one (`additionalProperties:false`-equivalent).**
- Evidence item required fields: `{source, document_id, document_version, retrieved_at, jurisdiction, excerpt, licence, review_status}` (+ optional `source_url` must be `https://`, `source_identifier`).
- Coverage: `combineCoverage` = unknown ≻ partial ≻ complete. Replace the pack-declared value with a computed scope set.
- Source manifest (`data-static/interaction-sources.json`): licence classes `{open, open-sharealike, public-domain, restricted, non-commercial, user-supplied}`; `production-open` allows `{open, open-sharealike, public-domain}`. **Reuse the existing source IDs `fda-cyp-transporter` and `openfda-labels` (licence class `public-domain`) — do not invent new ones.**

## 3. Sources (grounded + cross-verified)

- **DGIdb — rejected.** CYP/transporter genes: **60 inhibitor claims / 45 canonical drugs; 0 substrate, 0 inducer** (full-dump join; retyping the 3,726 untyped rows yields nothing usable). Drug-*target* DB, not metabolism. (v1's 42/26 was a raw-name-filter artifact.)
- **FDA broad CYP/transporter table** — the "[Healthcare Professionals: FDA's Examples of Drugs that Interact with CYP Enzymes and Transporter Systems](https://www.fda.gov/drugs/drug-interactions-labeling/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems)" page (content-dated 2026-05-29): **machine-fetchable (302→200), 11-column structured HTML + export**, 245 rows / 244 labels / 419 role assertions. Roles: substrate (sensitive), inhibitor (strong/moderate/weak), inducer (strong/moderate/**weak** — retain), plus footnotes, combination/regimen labels, and food/herb entities. **US public domain.** Measured Aushadhi coverage (raw / with 3 reviewed spelling synonyms):

  | CYP3A 57.1%/58.7% · CYP2D6 76.3% · CYP2C9 82.6%/87.0% · CYP2C19 65.0%/70.0% · CYP1A2 67.9%/71.4% · CYP2B6 84.6%/92.3% · CYP2C8 66.7%/72.2% · P-gp 60.7% · BCRP 34.8% · OATP1B1 68.2%/77.3% · OATP1B3 65.0%/75.0% · OAT1 80% · OAT3 78.6% · OCT2/MATE1/MATE2-K 100% |
  |---|

  Only `rifampin/rifampicin`, `phenobarbital/phenobarbitone`, `glyburide/glibenclamide` improved coverage. **Do not silently expand generic "OATP1B" to 1B1/1B3.** Residual misses are *not* all genuinely absent from India (e.g., abiraterone is registered; the index holds `abiraterone acetate`) → an identity, not coverage, problem.
- **openFDA labels** — `https://api.fda.gov/drug/label.json`; `drug_interactions` free-text; the `openfda` harmonization block is **optional** (a live morphine label had empty `openfda`) → cache/dedupe on top-level SPL `set_id` + `version` (+ keep `effective_time`). Rights: CC0/public-domain treatment with a private-party carve-out → provenance must read "company-submitted SPL accessed through openFDA," not "FDA-authored." Rate limits 240/min, 1,000/day (120k/day keyed).

## 4. Architecture (v2)

```
FDA broad table ─(fetch 302→200, parse, PIN+HASH)→ role inventory (CANONICAL, production-open)
                                                        │
reviewed identity map (RxNorm/UNII, typed) ─────────────┼─► per-ingredient role profile (with relationship type)
                                                        │
query time: entered pair + roles ─► class-inference HYPOTHESIS ─► review_candidate (mechanism null, evidence=role facts, applicability-gated)
openFDA labels ─► corroboration / unclassified_label_mention only  (never originates)
output: computed scoped coverage {assessed, not_assessed} + closed candidate/output contracts
```

## 5. Components

### 5.1 FDA parser + pinned role inventory — `src/lib/fda-cyp-parser.mjs`, `src/cli/build-fda-cyp-roles.mjs`
Fetch the broad table (follow the 302), parse the 11-column grid, **retain raw cells, footnote superscripts, weak-inducer column, and entity type** (drug / food / herb / combination / regimen). Pin `{source_url, content_date, raw_html_sha256, normalized_sha256, parser_version, retrieved_at}`. **Fail closed on column drift.** Output `data/interaction/production-open/fda-cyp-roles.jsonl`: `{entity, entity_type, enzyme, role, strength, footnotes, source_ref}`. Monthly refresh = human-reviewed semantic diff of the pinned snapshot.

### 5.2 Reviewed identity map (new — precedes matching) — `data-static/interaction-identity-map.json`
Reviewed, typed relationships between FDA entities and Aushadhi ingredients: `exact | salt | active_moiety | prodrug | metabolite | stereoisomer | regimen | synonym`, keyed via RxNorm/UNII where available. **No fuzzy matching; unmatched logged.** Keeps `abiraterone` ≠ `abiraterone acetate`, `oseltamivir` ≠ `oseltamivir carboxylate`, stereoisomers distinct, unless a reviewed moiety relationship says otherwise. This replaces v1's salt-strip+synonyms and compensates for the fallback-only ingredient index.

### 5.3 Per-ingredient role profile
Join role inventory ↔ identity map ↔ ingredient index → `{ingredient_id, roles:[{enzyme, role, strength, identity_relationship, source_ref}]}`. The `identity_relationship` is carried so a prodrug/metabolite-derived role is visible downstream.

### 5.4 Query-time class-inference hypotheses (NO committed pair pack)
For an entered pair, if A is a `{strong|moderate} {inhibitor|inducer}` of enzyme E **and** B is a `sensitive substrate` of E → emit a `review_candidate`:
- `review_status:'review_candidate'`, `severity:'unknown'`, **`mechanism:null`**, **`management:null`**, `pair:[A_id,B_id]`.
- `evidence:[ {source:'fda-cyp-transporter', document_version:<content_date>, jurisdiction:'US', licence:'public-domain', excerpt:"FDA classifies A as a <strength> <E> inhibitor", review_status:'review_candidate', source_url:'https://...'}, {…"B as a sensitive <E> substrate"…} ]`.
- A schema-allowed `notes`/`inference_class` field records: *"class inference — mechanistic hypothesis from FDA role classifications, not an established pairwise interaction; requires clinician review."*
- **Suppress weak inhibitors. Do NOT cross-product transporter roles** (ICH M12 — transporter DDI prediction needs extra evidence). **Applicability-gated**: route/dose/population honored so a topical-only product is not treated as systemic.
- Optionally write a bounded **internal review queue** (per-mechanism evidence merged; 75 pairs carry multiple mechanisms — merge, don't dedupe-away) for clinician triage. **This is not shipped as production interaction output.**
- Scale is not the issue: full FDA data → ~2,155 unique matched pairs (CYP3A ~1,543); reviewer noise is.

### 5.5 openFDA corroboration only — `src/lib/openfda-fetch.mjs`, `src/lib/openfda-extract.mjs`
Fetch/cache (SPL `set_id`+`version`; content-hash body dedupe). Extraction yields **only** (a) corroborating evidence attached to an already-reviewed pair, or (b) an `unclassified_label_mention` review item. **Never originates a candidate.** Handle negation ("no effect", "did not change"), filter product/route/species (animal-only), and ignore weak index tokens. Provenance = "company-submitted SPL via openFDA."

### 5.6 Scoped coverage (replaces `declared_coverage` passthrough)
Per query compute `assessed_scopes` (the enzymes/transporters actually checked, with the snapshot content-date) and `not_assessed_scopes` (`pharmacodynamic, qt, serotonin, additive-bleeding, chelation, ph-dependent-absorption, protein-binding, non-cyp-metabolism, transporter-inference`). CLI output states, prominently: **"No candidate found in these named sources; these scopes were not assessed; overall interaction status unknown."** — not merely a footer disclaimer.

### 5.7 Closed contracts
Add a top-level key allowlist to `validateReviewCandidate` (reject `display_severity`, `advice`, any unknown key); project output through an explicit allowlist (no field echo); **forbid directive language** in any candidate-authored string; validate each evidence item's `source`/`licence` against the manifest under the active profile. Add the FDA + openFDA source-manifest entries only if missing (they exist as `fda-cyp-transporter`, `openfda-labels`).

## 6. Safety (v2)

- Candidates are structurally hypotheses: `mechanism:null`, `severity:'unknown'`, `review_candidate`, closed schema → cannot render as advice.
- Coverage is computed and scoped; empty ⇒ named unassessed scopes + "status unknown."
- Identity is reviewed and typed; no fuzzy matching; no OATP1B fan-out.
- Applicability (route/dose/population) enforced.
- Weak/transporter cross-products suppressed; class-inference explicitly labelled.

## 7. Testing (v2)

- **Parser**: fixture broad-table → role inventory; column-drift ⇒ fail-closed; footnote + weak-inducer retention; hash pinning stable.
- **Identity**: `abiraterone`≠`abiraterone acetate`, `oseltamivir`≠`oseltamivir carboxylate`, stereoisomers distinct; no OATP1B expansion; unmatched logged not coerced.
- **Hypotheses**: strong inhibitor × sensitive substrate ⇒ candidate (`mechanism:null`, evidence array, inference-class note); weak inhibitor ⇒ suppressed; transporter×transporter ⇒ none; topical-only product ⇒ not systemic; multi-mechanism pair ⇒ merged evidence.
- **Contracts**: probe `{display_severity, advice}` ⇒ rejected on input **and** absent from output.
- **Coverage**: assessed/not-assessed computed correctly; PD/QT present in not-assessed; CLI surfaces the honest statement.
- **openFDA**: negation text ⇒ no candidate; only corroboration / unclassified mention; species/product filtered; duplicate SPL bodies deduped.
- **Golden (depends on §5.2)**: `ketoconazole` + `simvastatin` — only resolvable once reviewed identity maps both; then a class-inference candidate with two FDA evidence items and named not-assessed scopes.

## 8. Build sequence (v2)

1. FDA parser + **pinned role inventory** (canonical).
2. **Reviewed identity map** + role profile.
3. **Scoped coverage + closed contracts + CLI wiring** (`reviewCandidates`, coverage output).
4. Query-time **class-inference hypotheses** (gated), + internal review queue.
5. openFDA **corroboration**.

**Phase 1 (first shippable) = steps 1–3** (a role-grounded, honestly-scoped, contract-closed checker) plus a minimal §5.4. It is explicitly **not** a shipped inferred-pair pack.

## 9. Corrected facts folded in

| Claim | v1 | v2 (verified) |
|---|---|---|
| FDA table access | 404/bot-blocked, hand-transcribe | 302→200, machine-parse (broad HCP page) |
| FDA CYP3A coverage | ~72–76% | 57.1% raw / 58.7% synonyms |
| DGIdb CYP inhibitors | 42 claims / 26 drugs | 60 claims / 45 drugs (still rejected) |
| Pair space | "maybe tens of thousands" (open risk) | ~2,155 matched unique pairs |
| openFDA identity | keyed on generic/rxcui | `openfda` optional → SPL `set_id`+`version` |
| Output of pairs | committed candidate pack | roles canonical; hypotheses at query time only |

## 10. Explicitly not assessed (surfaced, not hidden)

Pharmacodynamic interactions (QT, serotonin, additive bleeding), chelation / pH-dependent absorption, protein-binding, non-CYP metabolism, transporter-pair inference, clinician severity assignment, patient-facing UI. These are emitted as `not_assessed_scopes`.
