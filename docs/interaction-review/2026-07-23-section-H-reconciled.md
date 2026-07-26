# Batch 1 v2 — Section H reconciled packet

Section H is frozen as a draft enzyme-induction slice. The current packet
contains the reconciled rifampicin, rifabutin, enzyme-inducing antiepileptic,
carbamazepine, and St John's Wort rows. Every row remains
`promotion_eligible:false`.

- Source: `docs/interaction-review/batch-01-v2/sections/H.verified.jsonl`
- JSONL SHA-256: `0daf3e31f9fbb296266f47662f0351e08c2b0aa74af86e46a1fec443e02c49b6`
- Inventory: 19 rules, 24 evidence records, 54 exact hashed fragments.
- Draft runtime status: 0 enabled rows and 19 diagnostic-only rows.
- Pair matcher: 9 executable selectors and 10 deliberately non-executable
  selectors.
- Clinical context: 0 complete rows.
- Evidence boundary: licence-cleared openFDA
  `openfda-labels` / `interaction-evidence` / `CC0-1.0`.

## Schema reconciliation

- `validateDraftRules` passes the complete Section H slice.
- Fifteen exact-drug perpetrator references no longer carry a second,
  redundant class identity. The exact drug, strength, route, formulation,
  evidence, and frozen member allowlists remain unchanged.
- St John's Wort remains quarantined. The evidence-empty umbrella is
  non-executable, and the ciclosporin child is also matcher-incomplete because
  raw identity cannot distinguish oral from ophthalmic ciclosporin.
- The matcher-incomplete St John's Wort/ciclosporin child no longer carries a
  dangling suppression target owned by Section G. An independently validated
  H slice therefore contains no cross-section suppression edge and cannot
  emit or suppress that diagnostic pair.
- The four composite/same-product rows for hormonal contraceptives and
  etonogestrel implants are now pair-matcher-incomplete. The current matcher
  cannot prove that separately supplied ingredient tokens belong to the same
  product occurrence.
- Every row remains `clinical_context_complete:false` and
  `runtime_enabled:false`; route, formulation, product binding, therapy phase,
  regimen, level, or initiation-direction inputs remain outside the current
  executable context.

## Frozen clinical and evidence boundaries

- Evidence records, exact fragments, payload provenance, source jurisdictions,
  member allowlists, severities, and management claims were not changed.
- Rifampicin/sulfonylurea remains limited to its retained source-backed
  members.
- Carbamazepine directions, products, and formulations remain source-bounded.
- The St John's Wort evidence gap and product/route limitations remain
  explicit.

## Validation

- Per-slice draft validation: pass, 19/19 rules.
- Focused Section A/B/G/H/J suite: pass.
- Draft-review positive, negative, jurisdiction, composite-product, and
  quarantine probes pass.

Clinician review and promotion remain separate required gates.
