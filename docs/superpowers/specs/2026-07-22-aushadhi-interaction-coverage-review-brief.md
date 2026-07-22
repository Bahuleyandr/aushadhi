# Cross-Verification Brief — Aushadhi Interaction Evidence-Coverage Design

> ## v2 RE-REVIEW FOCUS (read first)
> The **v2 spec** already incorporated the first review: roles are now the canonical artifact (no committed inferred-pair pack); FDA table is machine-parsed (302→200, broad HCP page); a reviewed RxNorm/UNII identity map precedes matching; openFDA only corroborates; coverage is computed/scoped and surfaced; candidate + output contracts are closed. Corrected numbers are folded in (FDA CYP3A ~57–59%, DGIdb 60/45, ~2,155 pairs). **Do not re-litigate those.** Probe v2's *new* risks:
> 1. **Strategic value.** Given ~57% single-enzyme CYP3A coverage, CYP-only PK scope, and hypothesis-only output gated behind a reviewed identity map — is this worth building for the India dispensing use case, or is the juice worth the squeeze? Answer explicitly.
> 2. **Reviewed identity map (§5.2) feasibility.** Is a hand-authored typed RxNorm/UNII map maintainable? How many entries are really needed to reach useful coverage? Is there a machine-assisted build that stays reviewed?
> 3. **Hypothesis output (§5.4).** Even as `review_candidate` with `mechanism:null`, is surfacing strong-inhibitor×sensitive-substrate to a pharmacist clinically appropriate, or over-trusted noise? Where is the line?
> 4. **Review workflow.** §5.4's internal review queue assumes a clinician triage loop (parent plan Task 10). Is that realistic here, or does it become an un-actioned backlog?
> 5. **Scoped-coverage efficacy (§5.6).** Does naming `not_assessed_scopes` actually prevent over-trust, or get ignored? Is the not-assessed list complete?
> 6. **Contract closure (§5.7).** Verify the proposed key allowlist includes every field §5.4 emits (`pair`, `evidence`, `review_status`, `severity`, `mechanism`, `management`, the inference-class note) and nothing more.
> 7. **Parser durability (§5.1).** Fail-closed-on-column-drift + monthly human-reviewed diff — realistic, or a maintenance trap?
>
> The §3–§4 material below is the *original* v1 brief, retained for the reproduction commands (still valid) and context.

---

**For an independent reviewing agent.** You are being asked to critically verify a design before it becomes an implementation plan. Assume nothing is correct until you have checked it. Reproduce the key claims yourself with the commands provided. Your job is to find what is wrong, thin, unsafe, or over-scoped — not to rubber-stamp.

Environment: Windows, Git Bash available. Aushadhi repo at `D:\Dev\Projects\aushadhi`. PostgreSQL 17 at `127.0.0.1:55432` (superuser `postgres`, passwordless local). Python + `psql` on PATH via `/c/Program Files/PostgreSQL/17/bin`.

---

## 1. What is being built

Fill the **empty** interaction rule pack of the existing checker (branch `feat/interaction-evidence`) with real, provenance-carrying drug–drug interaction **candidates**, from two public-domain sources, without changing the checker's safety contract (missing evidence is never "safe"; candidates are never presented as clinician advice until human review).

- **The design spec (read this):** `docs/superpowers/specs/2026-07-22-aushadhi-interaction-evidence-coverage-design.md`
- **The parent plan:** `docs/plans/2026-07-10-aushadhi-interaction-evidence-layer.md`

## 2. Existing code to inspect (branch `feat/interaction-evidence`; use `git show feat/interaction-evidence:<path>`, do not check it out)

- `src/lib/interaction-checker.mjs` — kernel. Confirm it exports `checkResolvedProducts({ resolvedInputs, rulePack, reviewCandidates = [] })` and that `reviewCandidates` is a real, separate input (the design depends on this).
- `data-static/interaction-rules.schema.json` — the per-rule + evidence schema the candidates must satisfy. Confirm `severity` is a required non-empty string (design uses `"unknown"`), `review_status ∈ {clinician_reviewed, review_candidate}`, and the evidence required fields.
- `src/lib/interaction-source-policy.mjs` + `data-static/interaction-sources.json` — confirm the `production-open` vs `internal-evaluation` gate and the manifest entry shape.
- `data/interaction/internal-evaluation/ingredient-index.jsonl` — 2,292 ingredients; fields `canonical_name`, `observed_names[]`. This is the match target.

## 3. Grounding claims to REPRODUCE (do not trust; verify)

### 3a. DGIdb was rejected — verify it genuinely lacks CYP substrate/inducer data
Files: `C:\Users\subas\Downloads\Drugs\{interactions.tsv, dgidb_2026_06b.sql.gz}` (DGIdb v5.0.11, data-only SQL dump).
Flat file — interaction_type (col 12) for CYP/transporter genes:
```bash
cd "/c/Users/subas/Downloads/Drugs"
awk -F'\t' 'NR>3 && $3 ~ /^(CYP3A4|CYP2D6|CYP1A2|CYP2C19|CYP2C9|CYP2B6|CYP3A5|ABCB1|ABCG2|SLCO1B1)$/ {print $12}' interactions.tsv | sort | uniq -c
# expected: ~3726 empty, ~60 "inhibitor", zero substrate/inducer
```
Full dump (load the 6 relevant tables as text columns and query — the design claims 42 CYP inhibitor claims / 26 drugs, zero substrate/inducer anywhere, and the 118 free-text "substrate" attributes are all on IUPHAR *receptors* not CYPs). Reproduce by loading `interaction_claim_types`, `interaction_claim_types_interaction_claims`, `interaction_claims`, `gene_claims`, `drug_claims`, `interaction_claim_attributes` into a throwaway DB (columns are in the `COPY public.<t> (...)` headers) and joining. **Challenge the rejection:** is there any re-typing of the 3,726 untyped CYP rows (e.g., by source, or by drug_claim name patterns) that could recover substrate/victim information? If DGIdb truly can't, confirm; if it can, that changes the design.

### 3b. FDA table coverage — verify ~72% for CYP3A, and MEASURE the enzymes the design did NOT
The design only measured CYP3A (~53/74 drugs, ~76% after `rifampin→rifampicin`, `phenobarbital→phenobarbitone`). It did **not** measure CYP2D6/2C9/2C19/1A2/2B6 or the transporters. Independently transcribe (or find) the FDA "Table of Substrates, Inhibitors and Inducers" lists for the other enzymes and measure their Aushadhi overlap the same way (lowercase + salt-strip against `ingredient-index.jsonl`). **This is a known gap — quantify it.**

### 3c. openFDA — confirm the interaction content is free-text (needs extraction), CC0, and the identifier fields
```bash
curl -s 'https://api.fda.gov/drug/label.json?search=openfda.generic_name:"warfarin"&limit=1' | python -c "import sys,json;r=json.load(sys.stdin)['results'][0];print('has drug_interactions:', 'drug_interactions' in r);print('openfda keys:', list(r.get('openfda',{}).keys()))"
```

## 4. Design decisions to challenge

1. **Candidate combinatorics / pack size — UNMEASURED (biggest open risk).** The design materializes every inhibitor/inducer × substrate pair per enzyme. DGIdb's estimate was 0; the **FDA-derived pack size was never computed**. Estimate it: with the FDA CYP3A lists (~19 strong + ~15 moderate + ~10 weak inhibitors, ~10 inducers, ~34 sensitive substrates), the CYP3A pack alone is on the order of (inhibitors+inducers)×substrates ≈ 50×34 ≈ 1,700 pairs *before* other enzymes and *before* restricting to Aushadhi-matched drugs. Is the full pack tens of thousands? Is that the right unit, or should candidates be derived at query-time only (the design offers both)?
2. **Clinical noise.** Should a *weak* inhibitor × *moderate* substrate generate a candidate at all, or only strong/moderate × sensitive? Generating all pairs may bury real signals. The design carries strength as a "priority hint" but still emits everything — challenge that.
3. **Curated FDA snapshot.** The FDA page is HTML-only/bot-blocked, so the design transcribes it into `fda-dds-table.json` by hand. Is that auditable and maintainable? Is there a better machine-readable equivalent (e.g., an archived structured mirror, or a published dataset with equivalent tiers)? What is the staleness/refresh story?
4. **openFDA deterministic extraction.** "Emit a candidate only when another known Aushadhi ingredient is explicitly named in the label text" — will this yield meaningful coverage, or be too sparse/noisy (US brand vs INN naming, negations like "no interaction with X")? Probe the false-positive/negation risk.
5. **US↔INN naming.** Coverage depends on a hand-maintained synonym map. How many synonyms are really needed across all enzymes? Is exact+salt-strip+synonym enough, or is RxNorm identity mapping actually required for the first cut (the design defers it)?
6. **Pharmacodynamic gap.** The layer covers only CYP/transporter PK interactions + label-stated ones; it misses QT prolongation, serotonin syndrome, additive bleeding, etc. Is presenting a "coverage: partial" checker that silently omits major PD interaction classes safe, given a clinician might over-trust an empty result? Is the disclaimer + `unknown`-not-`safe` contract sufficient mitigation, or does the first cut need an explicit PD-not-covered warning surfaced in the CLI output?
7. **Safety contract.** Verify in `interaction-checker.mjs` that a `review_candidate` can never be rendered with a severity or as anything a user could mistake for reviewed advice, and that a no-match genuinely returns "coverage unknown," not "no interaction."

## 5. What a good review returns

For each of §3–§4: confirmed / refuted (with the evidence or command output), and any design change it implies. Flag anything the spec states as fact that you could not reproduce. Rank the risks. Explicitly answer: **is Phase 1 (FDA backbone) the right first shippable increment, or should scope change?**
