# Warfarin–clarithromycin — clinician approval record

**Reviewer:** `clinician:subas` · **Date:** 2026-07-27
**Profile:** internal-evaluation only · **Production-open:** disabled (0 rules)
**Audit packet:** `2026-07-27-warfarin-clarithromycin-candidate-audit.{json,md}`

---

## Approved

| Item | What was approved |
|---|---|
| **A1** | Ingredient identity `clarithromycin` = RxNorm **21212** (`tty IN`), UNII **H1250JIK0A**, relationship `exact` |
| **A2** | Presentation `presentation:pmbjp:740:oral-tablet` — Clarithromycin Tablets IP 250 mg, pack 10's |
| **A3** | Exact draft rule `warfarin__clarithromycin_oral` (executed earlier) |
| **A4** | Retire the unevidenced `warfarin__macrolide_cyp_inhibitor` class row (executed earlier) |
| **A5** | Clinical rule `warfarin__clarithromycin_oral` — **major / confirm_and_monitor**, 3 exact pairs |
| **A6** | PMBJP code 380 (500 mg) stays excluded |

## Scope — exactly three product pairs

Clarithromycin 250 mg (PMBJP **740**) crossed with the three already-reviewed warfarin oral tablets:

| clarithromycin | warfarin |
|---|---|
| 740 — Clarithromycin Tablets IP 250 mg | 2141 — Warfarin Tablets IP 1mg |
| 740 | 2142 — Warfarin Tablets IP 2mg |
| 740 | 452 — Warfarin Tablets IP 5 mg |

Bindings: ingredient `sha256:5bf88d10…0710` · product `sha256:7a9b5161…f29f4` ·
assertion `153530a9…fa52` · draft row `33a01de9…3499` · evidence
`openfda-labels:b98b02bb-2609-49a0-b29f-e5911aa0cbc1:23`.

## Evidence, re-verified before recording

| Source | Result |
|---|---|
| openFDA clarithromycin label | set_id `b98b02bb…`, **SPL version 23**, effective_time 20230530; fragment verbatim, hash stable |
| RxNorm ingredient | exact single candidate **21212**, `tty IN`, API version 06-Jul-2026 |
| UNII | **H1250JIK0A** |
| RxNorm presentation | exact single SCD **197516** — `clarithromycin 250 MG Oral Tablet` |
| Official PMBJP product list | drug code **740** = "Clarithromycin Tablets IP 250 mg", 10's (PDF `f54a140d…`) |
| PMBI tender RC-222/2025 | **page 64, item 122, code 740**, composition "Clarithromycin IP 250mg" (PDF `47670d2b…`) |

All three independent sources — catalogue, official product list and tender — agree on code 740.

> **Note on the earlier retraction.** The tender binding was retracted mid-investigation after an
> extraction artifact (F5) made every PMBJP code look wrong. F5 was resolved as a false alarm caused
> by reading a ruled table with `pdftotext -layout`; re-read in `table` mode, the original binding is
> confirmed. Both PDFs above were re-extracted in table mode with row-completeness asserted before
> this approval was recorded.

## Clinical workflow constraints (carried into the compiled rule)

- The **prescriber or anticoagulation service** directs whether warfarin dose adjustment is needed and
  arranges PT/INR monitoring during concomitant oral clarithromycin use, with a clinician-directed
  follow-up decision when the course ends.
- The pharmacy must **not** change a dose or stop either medicine independently.
- Bleeding-symptom counselling included; advice not to stop warfarin without consulting a healthcare
  professional.
- **No** universal PT/INR schedule and **no** fixed post-discontinuation interval is asserted.
- Evidence is a **US label** statement and is not presented as an Indian regulatory claim.

## Explicitly excluded

erythromycin · azithromycin (own rule) · PMBJP **2097** H. pylori combipack (distinct ingredient
identity) · PMBJP **380** 500 mg (RxNorm exposes both immediate-release and 24 HR extended-release
500 mg oral tablets) · oral suspensions · injections · every other unreviewed or non-tablet
presentation.

## Resulting state

- ingredient mappings **8 → 9** · presentation mappings **17 → 18** · promotions **7 → 8**
- exact product pairs **42 → 45**
- internal-evaluation pack `0.4.0`, `declared_coverage: partial`
- **production-open unchanged: 0 rules, `declared_coverage: unknown`**
- `npm run verify:pmbjp-mapping-codes` → **18/18 confirmed**, exit 0
