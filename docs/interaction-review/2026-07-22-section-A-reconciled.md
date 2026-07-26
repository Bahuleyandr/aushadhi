# Batch 1 v2 - Section A reconciliation

Section A is reconciled to the v2 runtime-status and strict citation model. Rules remain draft-only and require clinician approval before promotion.

- Source: `docs/interaction-review/batch-01-v2/sections/A.verified.jsonl`
- JSONL SHA-256: `614b34c8c47b0476338aa8f8d5851ec7530bf756bb3bb4fdda7b2ed32d2aa739`
- Generated: `2026-07-26`
- Inventory: 33 rules; 36 retained evidence records; 64 machine-text-verified exact hashed fragments; 2 fail-closed rules with no retained evidence.
- Runtime: 0 enabled; 27 pair-executable diagnostics; 6 matcher-inert review
  rows; 0 clinical-context-complete; 0 promotion-eligible.
- Citation status: `{"machine_confirmed_openfda_reconciled_pending_clinician":32,"machine_confirmed_govuk_ogl_bound_pending_clinician":2,"machine_confirmed_openfda_reconciled_clinician_approved_for_internal_product_scope":2}`
- Schema freeze: `validateDraftRules` passes. Every row is runtime-disabled
  and promotion-ineligible within the draft pack. The
  `warfarin__amiodarone` row now carries its approved oral/tablet scope and
  `warfarin__fluconazole` carries a proposed oral/tablet review scope, but
  exact product-pair binding and clinician authorization belong to the
  independent internal-evaluation promotion manifest; the draft cannot
  self-authorize. Every other row lacks a complete, non-empty concrete route
  and formulation scope for both runtime subjects. The `warfarin__tramadol`,
  `edoxaban__pgp_inducer`, and `clopidogrel__cyp2c19_inhibiting_ppi` rows also
  have `clinical_context_complete:false` because their `newly_added` action
  target requires medication-initiation direction that the matcher does not
  carry. Pair-executable rows remain available only as diagnostic draft
  findings.
- Applicability metadata is normalized without widening claims: apixaban is
  indication-unscoped while its dose limitation remains, the aspirin timing
  row uses `["cardioprotective"]`, and the n-ary triple-therapy wrapper no
  longer duplicates route/formulation fields outside its member selectors.

## Verification outcome

- Phase 2 provenance validation: 25 exact source documents are retained. Thirty-four openFDA evidence records, covering 23 selected SPL payloads and 59 fragments, reconcile exactly to one current result, pinned version/effective time, canonical payload hash, and source path. Both GOV.UK records additionally pin the exact Content API payload, `details.body` fragment paths, canonical payload hash, matching `base_path`/`drug_safety_update` type, and a separately fetched page carrying the OGL v3.0 footer with no page-specific reuse exception.
- Exact unmatched gap: `aspirin__nsaid_additive_gi_bleeding` evidence `fda-label-nsaid-class`, set_id `8bff5df5-d856-4237-b6a8-ae445b454844`. The exact current openFDA result is SPL version 13, effective `20250922`, payload SHA-256 `d6cdff491ee0ac6c0a9e7fa707dea2c2856bcbf0ac835c7402279f2592d5f0e2`; it does not contain the stored aspirin-specific GI-risk fragment under `openfda-spl-text-v1`. The evidence was removed without substitution or fuzzy matching, applicability jurisdiction was cleared, and the rule was made non-executable.
- Source-policy gap: live fetches of the official FDA URL `https://www.fda.gov/media/76636/download` on 2026-07-24 were inconsistent, returning both `Not found` and a valid 157,619-byte PDF (SHA-256 `9dc0a23061fcf9a1e27f58d664331d674d37a5a02300d01bc344149c4935fa89`). The exact timing sentence was machine-extracted from the PDF, but `fda-authored-web-content` remains disabled and has no enabled licence/payload-extraction contract. No mirror was substituted, and `aspirin_ld_ir__ibuprofen_timing` remains fail-closed with no evidence, jurisdiction, timing action, or executable matcher.
- Structural validation passes. Ticagrelor remains pinned inline for the named dabigatran rule rather than present in the broad curated P-gp-inhibitor set. The two evidence-gap aspirin rules, the analgesic-dose CALDOLOR child, the standalone hepatic restriction, the cotrimoxazole same-product selector, and the triple-therapy review reference do not fire because the hardened engine enforces their declared `pair_matcher_executable:false` quarantine.
- Applicability jurisdiction is bounded to retained evidence: 29 rules are US-only, 2 are UK-only, 2 fail-closed rules have no jurisdiction, and no rule asserts unsupported Indian applicability. Runtime checks require an explicit matching jurisdiction before action details are exposed.
- Restricted/manual-reference eMC and ACR sources in machine evidence: 0. Miconazole uses GOV.UK OGL evidence. The 34 openFDA records comprise 33 positive `interaction-evidence` records and one typed `interaction-counterevidence` record for rivaroxaban plus clarithromycin; all use `CC0-1.0`, the openFDA API as machine origin, and DailyMed as reference-only. The two current warfarin-amiodarone records support the separate clinician-approved internal product scope as U.S.-label evidence only. The two warfarin-fluconazole records remain clinician-pending, have no Child-Pugh modifier, and support the proposed oral-tablet review scope plus the label-stated 4-to-5-day persistence boundary. None asserts an Indian regulatory-label claim.
- The corrected macrolide selector fires for clarithromycin and erythromycin as diagnostic output.
- The retained aspirin/ibuprofen CALDOLOR evidence is review material only. Because analgesic-dose aspirin is not a pair-matcher input, the child is matcher-inert and no bare aspirin/ibuprofen finding is emitted. The policy-disabled timing rule and the unreconciled generic GI rule also do not surface.

## Runtime decisions

| Rule | Runtime | Pair matcher | Evidence | Decision |
|---|---:|---:|---:|---|
| `warfarin__nsaid_systemic` | diagnostic | yes | 1 | Diagnostic only: route and therapy-status constraints are not matcher-gateable. |
| `warfarin__aspirin_analgesic_antiplatelet` | diagnostic | yes | 1 | Diagnostic only: exact named pair, but runtime scope lacks a concrete formulation on both subjects. |
| `warfarin__fluconazole` | diagnostic | yes | 2 | Diagnostic only: exact oral-tablet review scope and current bilateral U.S.-label evidence are present, but ingredient/product mapping and clinician promotion remain separately required. |
| `warfarin__miconazole_oromucosal_gel` | diagnostic | yes | 1 | Diagnostic only: oral-gel formulation and UK supply-status branch are not matcher-gateable. |
| `warfarin__ketoconazole_systemic` | diagnostic | yes | 1 | Diagnostic only: systemic/oral formulation is not matcher-gateable. |
| `warfarin__voriconazole` | diagnostic | yes | 1 | Diagnostic only: exact named pair, but runtime scope lacks a concrete formulation on both subjects. |
| `warfarin__macrolide_cyp_inhibitor` | diagnostic | yes | 1 | Diagnostic only: the selector now fires, but the source supports clarithromycin rather than the full two-member class. |
| `warfarin__metronidazole_tinidazole` | diagnostic | yes | 1 | Diagnostic only: the source supports metronidazole, not the full nitroimidazole selector. |
| `warfarin__cotrimoxazole` | diagnostic | no | 1 | Fail closed: the current matcher cannot prove the same-product trimethoprim/sulfamethoxazole combination occurrence, and runtime scope lacks concrete formulation. |
| `warfarin__amiodarone` | diagnostic | yes | 2 | Draft remains disabled. The approved internal runtime scope is bound separately to five exact reviewed oral-tablet presentations and six cross-product combinations; it cannot widen to other products. |
| `warfarin__fluoroquinolone` | diagnostic | yes | 2 | Diagnostic only: class, route, and jurisdiction scope exceed the member-level evidence. |
| `warfarin__ssri_snri` | diagnostic | yes | 1 | Diagnostic only: the selector is pinned to the seven-member evidence-declared roster and excludes fluvoxamine; clinician class mapping remains pending. |
| `warfarin__tramadol` | diagnostic | yes | 1 | Diagnostic only: initiation direction and concrete formulation scope are incomplete. |
| `warfarin__rifampicin` | diagnostic | yes | 1 | Diagnostic only: exact named pair and executable synonym normalization, but runtime scope lacks a concrete formulation on both subjects. |
| `warfarin__azithromycin_oral` | diagnostic | yes | 1 | Diagnostic only: oral/systemic route is not matcher-gateable. |
| `apixaban__strong_cyp3a4_pgp_inhibitor` | diagnostic | yes | 2 | Diagnostic only: dose-dependent reduce-versus-avoid action is not matcher-gateable; matching is pinned to label-named members. |
| `rivaroxaban__strong_cyp3a4_pgp_inhibitor` | diagnostic | yes | 2 | Diagnostic only: clarithromycin is typed product-specific counterevidence and is excluded from the avoid path without asserting increased bleeding risk; the remaining systemic/oral route constraint is not matcher-gateable. |
| `rivaroxaban__hepatic_impairment_child_pugh_b_c` | diagnostic | no | 1 | Diagnostic only: standalone drug-condition restriction is not a pairwise interaction. |
| `apixaban__strong_cyp3a4_pgp_inducer` | diagnostic | yes | 1 | Diagnostic only: explicit combined-strong class statement and label-named roster, but runtime scope lacks a concrete formulation on both subjects. |
| `rivaroxaban__strong_cyp3a4_pgp_inducer` | diagnostic | yes | 1 | Diagnostic only: explicit combined-strong class statement and label-named roster, but runtime scope lacks a concrete formulation on both subjects. |
| `dabigatran__pgp_inducer` | diagnostic | yes | 1 | Diagnostic only: explicit P-gp-inducer class statement, but runtime scope lacks a concrete formulation on both subjects. |
| `edoxaban__pgp_inducer` | diagnostic | yes | 1 | Diagnostic only: initiation direction and concrete formulation scope are incomplete. |
| `dabigatran_nvaf__dronedarone_or_ketoconazole` | diagnostic | yes | 1 | Diagnostic only: the source action distinguishes systemic ketoconazole, but route and formulation are not matcher-gateable. Label `avoid` maps conservatively to local `major`, not `contraindicated`. |
| `dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor` | diagnostic | yes | 1 | Diagnostic only: the five-member no-adjustment roster is pinned, but the retained fragments do not establish the removed severe-renal action and runtime scope lacks concrete formulation. |
| `dabigatran_vte__pgp_inhibitor` | diagnostic | yes | 1 | Diagnostic only: the systemic/oral P-gp-inhibitor constraint is not matcher-gateable, so topical or ophthalmic name matches cannot be excluded. Label `avoid` maps conservatively to local `major`. |
| `dabigatran_hip_prophylaxis__pgp_inhibitor` | diagnostic | yes | 1 | Diagnostic only: the systemic/oral P-gp-inhibitor constraint is not matcher-gateable, so topical or ophthalmic name matches cannot be excluded. Label `avoid` maps conservatively to local `major`. |
| `clopidogrel__cyp2c19_inhibiting_ppi` | diagnostic | yes | 1 | Selector is pinned to omeprazole and esomeprazole; initiation direction and concrete formulation scope remain incomplete. |
| `aspirin_ld_ir__ibuprofen_timing` | diagnostic | no | 0 | Fail closed: official-document fetches were inconsistent and the source policy remains disabled; no timing action or diagnostic finding is authorized. |
| `aspirin__ibuprofen_additive_gi_bleeding` | diagnostic | no | 1 | Fail closed: the cited action is scoped to intravenous CALDOLOR plus analgesic-dose aspirin, but aspirin dose is not a pair-matcher input. The evidence remains clinician-review material and no bare pair finding is authorized. |
| `aspirin__nsaid_additive_gi_bleeding` | diagnostic | no | 0 | Fail closed: the current exact openFDA SPL no longer contains the previously cited aspirin-specific fragment; no runtime or diagnostic action is authorized. |
| `dual_antiplatelet__oral_anticoagulant_triple_therapy` | diagnostic | no | 1 | Diagnostic only: runtime class scope exceeds the apixaban-aspirin-clopidogrel source population. |
| `ssri_snri__nsaid_additive_gi_bleeding` | diagnostic | yes | 1 | Diagnostic only: the source supports SSRIs, not the full SSRI/SNRI selector. |
| `heparin_lmwh__nsaid_or_antiplatelet_bleeding` | diagnostic | yes | 1 | Diagnostic only: the heparin/LMWH selector is pinned to the evidence-declared roster and excludes nadroparin; only enoxaparin is directly supported and clinician extrapolation remains pending. |

## Promotion boundary

All draft rules have `promotion_eligible:false`. Thirty-four positive
machine-confirmed evidence records and one typed counterevidence record
establish exact source text and declared scope only. The warfarin-amiodarone
clinician approval is represented outside the draft in a deterministic
promotion manifest that binds the exact draft bytes, source versions,
reviewed ingredient identities, and five reviewed product presentations. All
other rules remain unapproved for runtime promotion. The removed
naproxen-label and policy-disabled FDA timing fragments are recorded only as
explicit evidence gaps; neither is copied into the retained slice or used to
authorize a finding.

The detailed evidence, source effects, source-label actions, scope boundaries, jurisdiction, currentness, and record-level limitations are in `2026-07-22-section-A-citations.md`.
