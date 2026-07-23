# Batch 1 v2 — Section G reconciled packet

Section G is frozen as a draft, source-bounded CYP3A4/P-gp interaction
slice. Every row remains runtime-disabled and `promotion_eligible:false`;
pair-executable rows are available only as diagnostic draft findings.

- Source: `docs/interaction-review/batch-01-v2/sections/G.verified.jsonl`
- JSONL SHA-256: `8398ebb73c022924c0d8bb91a77278c48e0327010241e82b09f671c55191d2eb`
- Inventory: 28 rules, 29 evidence records, 51 exact hashed fragments.
- Draft runtime status: 0 enabled rows and 28 diagnostic-only rows.
- Pair matcher: 23 executable selectors and 5 deliberately non-executable
  selectors.
- Clinical context: 0 complete rows.
- Evidence boundary: openFDA `openfda-labels` / `interaction-evidence` /
  `CC0-1.0`; no restricted machine evidence.

## Schema reconciliation

- `validateDraftRules` passes the complete Section G slice.
- `pimozide__cyp3a4_inhibitor` remains pair-matcher-executable for diagnostic
  review but records `clinical_context_complete:false`: its
  `newly_added_agent` action cannot be resolved without
  medication-initiation direction.
- The formerly complete triazolam row is also marked context-incomplete and
  runtime-disabled because its perpetrator selector lacks a non-empty concrete
  formulation. No formulation was inferred from evidence.
- `tadalafil_pah__ritonavir_sequence` retains the exact `ritonavir` drug
  selector and no longer carries a redundant CYP3A4-inhibitor class identity.
  Its sequence-dependent strength, route, evidence, and member metadata are
  unchanged.
- Indication-bearing PAH rows remain fail-closed in draft review. Free-text
  indication values are not a reviewed terminology mapping, so an unmatched
  value yields an unresolved applicability finding rather than excluding the
  source-bounded rule or exposing its action.
- The two evidence-empty rows remain non-executable:
  `dihydropyridine_ccb__strong_cyp3a4_inhibitor` and
  `apixaban__pgp_moderate_cyp3a4_inhibitor`.

## Validation

- Per-slice draft validation: pass, 28/28 rules.
- Focused Section A/B/G/H/J suite: pass.
- Pair-executable G rules retain source-bounded canonical diagnostic probes;
  none can emit a runtime-enabled finding.
- Disabled and matcher-incomplete rows emit no pharmacist-facing finding.
- Evidence, fragments, member allowlists, severities, management claims, and
  jurisdiction scope were not widened by this schema pass.

Clinician review and promotion remain separate required gates.
