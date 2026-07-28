# Batch 1 v2 — Section J reconciled packet

Section J is frozen as a source-bounded draft interaction slice. Every row
remains `promotion_eligible:false`; local severity and management remain
clinician-governance decisions.

- Source: `docs/interaction-review/batch-01-v2/sections/J.verified.jsonl`
- JSONL SHA-256: `8a00848ed4985907a350042861f3933a8fdbe352a4460ed1dc7929d7723e628f`
- Inventory: 12 rules, 21 evidence records, 41 exact hashed fragments.
- Draft runtime status: 0 enabled rows and 12 diagnostic-only rows.
- Pair matcher: 10 executable selectors and 2 deliberately non-executable
  rows.
- Clinical context: 0 complete rows.
- Evidence boundary: openFDA `openfda-labels` /
  `interaction-evidence` / `CC0-1.0`; no restricted machine evidence.

## Schema reconciliation

- `validateDraftRules` passes the complete Section J slice.
- Fourteen exact-drug references no longer carry a second, redundant class
  identity. Exact drugs, strength/route/formulation constraints, evidence,
  source-backed members, and frozen allowlists remain unchanged.
- `metformin__iodinated_contrast_media` now expresses its applicability as the
  required singleton array:
  `["peri-procedural imaging with iodinated contrast"]`.
- The 2026-07-26 live recheck confirmed the same metformin SPL
  version/effective time and clinical boundaries. Its canonical openFDA
  payload changed, and the exact qualifying-eGFR fragment was repinned to the
  current unit rendering; the rule remains runtime-disabled.
- The 2026-07-28 `J-US02` recheck retained its SPL version, effective time,
  exact fragment, proposition, clinical scope, and runtime status; only the
  current canonical payload hash and retrieval dates were refreshed.
- The miconazole row remains an evidence-empty, non-executable backlog
  candidate. No action, jurisdiction, or product scope was inferred.
- The co-trimoxazole row is now pair-matcher-incomplete because the current
  matcher cannot prove a same-product combination occurrence from separate
  ingredient tokens. Its exact aliases and evidence remain review metadata.
- Every row remains `clinical_context_complete:false` and
  `runtime_enabled:false`; none can enter the production runtime path without
  completing concrete route/formulation context, review, and promotion.

## Frozen clinical and evidence boundaries

- Fluconazole remains limited to the three sulfonylureas directly supported by
  the retained U.S. evidence.
- Co-trimoxazole retains its exact combination aliases and does not expand to
  either component alone.
- Gemfibrozil, alcohol, metformin/contrast, thiopurine/allopurinol,
  theophylline, and solid-oral potassium chloride retain their exact
  source-bounded member and formulation limits.
- Evidence records, exact fragments, payload provenance, severities,
  management claims, and member allowlists were not changed by this schema
  pass.

## Validation

- Per-slice draft validation: pass, 12/12 rules.
- Focused Section A/B/G/H/J suite: pass.
- Canonical unordered pairs, non-pair negatives, evidence-fragment coverage,
  and route/formulation quarantine probes pass.

Clinician review and promotion remain separate required gates.
