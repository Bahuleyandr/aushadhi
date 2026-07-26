# Warfarin-fluconazole PMBJP review packet

Date: 2026-07-26

Status: clinician reviewed

Release profile: approved for `internal-evaluation` only

Production-open status: disabled

This packet records approval of one exact fluconazole ingredient identity, four
PMBJP oral-tablet presentations, and a warfarin-fluconazole clinical rule
limited to 12 cross-product combinations. The machine-readable bindings are in
`docs/interaction-review/2026-07-26-warfarin-fluconazole-review.json`.

## Ingredient identity

The observed ingredient `fluconazole` has one exact active RxNorm ingredient
candidate:

- RxCUI `4450`, name `fluconazole`, term type `IN`
- UNII `8VZV102JFY`
- RxNorm release `06-Jul-2026`, API `3.1.354`
- local ingredient ID
  `sha256:37cc87b734ee49f5f3ad5773f44aa5089c4bc93ab4fb50bc53048e2b69416bd0`

The exact relationship is approved and committed to the reviewed override
manifest for `internal-evaluation`.

## Product presentations

| PMBJP code | Exact product assertion | Pack | Product assertion SHA-256 | Proposed presentation |
|---|---|---:|---|---|
| `1246` | Fluconazole Tablets IP 150 mg | 1's | `db7af4f8f150ecd174e7e444529d0e3ea166025134b6e68eff7436f4a305296f` | oral tablet |
| `2771` | Fluconazole Tablets IP 50 mg | 4's | `94ecc3673fd6332ae543ff268685b14e847447ddbe2678bc7692e5c11a0f07a0` | oral tablet |
| `2772` | Fluconazole Tablets IP 200 mg | 4's | `7b9fffd9797b6a11c0ec0802a288c32ac95f9b4c854b6d62e0ec470a61fbc793` | oral tablet |
| `2773` | Fluconazole Tablets IP 400 mg | 1's | `b43f0509aebac0bc0021079be2e8375735e69feffbd59c76131447bd8f1dad9c` | oral tablet |

PMBI tender `RC-222/2025` identifies code `1246` as an uncoated
fluconazole 150 mg tablet. PMBI tender `RC-213/2024`, page 95, independently
identifies codes `2771`, `2772`, and `2773` as uncoated 50 mg, 200 mg, and
400 mg tablets.

RxNorm independently returns active Semantic Clinical Drug concepts for the
50 mg, 150 mg, and 200 mg oral tablets. The exact 400 mg RxNorm search returns
no active concept. That is recorded as a transparent corroboration gap, not
silently normalized; the direct PMBI tender is the presentation evidence for
code `2773`.

## Clinical approval

The reconciled draft row is
`warfarin__fluconazole`, exact row SHA-256
`088bd06e472723bce36527b67d1c2b0d7c24694842c5929c25c1c4e693952f84`.
The draft remains runtime-disabled and promotion-ineligible so it cannot
self-authorize. A separate deterministic promotion binds this exact row to the
reviewed mappings and clinician approval.

The approved scope combines the three reviewed PMBJP warfarin tablets (1 mg,
2 mg, and 5 mg) with the four reviewed fluconazole tablets above, producing
12 exact product pairs. It is not an ingredient-wide approval.

The approved severity is `major` and the approved dispensing action is
`confirm_and_monitor`. The alert requires confirmation that the
prescriber or anticoagulation service reviewed the warfarin dose and arranged
PT/INR monitoring when fluconazole is started or stopped. It does not direct
the pharmacy to change a dose or stop either medicine independently.

Counselling covers unusual bleeding or bruising, prolonged bleeding, blood in
urine, and red or tarry-black stools. The current fluconazole label says its
enzyme-inhibiting effect persists 4 to 5 days after discontinuation. The
approved rule does not invent a universal INR schedule for that interval or a
single-dose exception.

## Evidence and adversarial findings

- Current DIFLUCAN U.S. label: set ID
  `f694c617-3383-416c-91b6-b94fda371204`, version 57, effective
  `20260402`, canonical openFDA payload SHA-256
  `ff8cbc0726257ccfd11021bb489b0cf0bb417351b66ab35dcb6fb44a4290690c`.
- Current warfarin sodium U.S. label: set ID
  `51e98fb6-ba76-497e-95d8-fe895ef0b7ed`, version 7, effective
  `20260629`, canonical openFDA payload SHA-256
  `bcb1e6db5ac6619c0c93ede9f0c689dfd8ffdff4f187067335c243046b5d3e04`.
- Both current payloads and every retained fragment were reverified live on
  2026-07-26.
- The unsupported Child-Pugh B pair modifier was removed.
- These are U.S.-label evidence sources, not Indian regulatory-label claims.
- PMBI evidence establishes the exact Indian product presentations, not the
  clinical interaction or its severity.
- Production-open remains disabled.

## Approval statements

These deliberately separate decisions were approved by `clinician:subas` on
2026-07-26. The response and scope interpretation are recorded in
`2026-07-26-warfarin-fluconazole-clinician-approval.md`.

### Ingredient identity

> I approve the fluconazole ingredient identity mapping as exact: observed
> `fluconazole` to RxNorm ingredient RxCUI `4450`, UNII `8VZV102JFY`.
> Reviewer ID: clinician:subas

### Product presentations

> I approve all four product-presentation mappings as oral tablet for the exact
> PMBJP assertions in the 2026-07-26 warfarin-fluconazole review packet:
> codes `1246`, `2771`, `2772`, and `2773`.
> Reviewer ID: clinician:subas

### Clinical rule

> I approve the warfarin-fluconazole clinical rule for internal evaluation
> only, limited to the seven reviewed PMBJP oral-tablet assertions (12
> cross-product combinations), as major severity with confirm-and-monitor
> management. The alert must require prescriber/anticoagulation-service
> warfarin dose review and PT/INR monitoring when fluconazole is started or
> stopped; it must not direct the pharmacy to change a dose or stop either
> medicine independently. Include bleeding-symptom counselling and state that
> fluconazole enzyme inhibition can persist 4 to 5 days after discontinuation
> without inventing a universal PT/INR schedule or a single-dose exception.
> Keep the unsupported Child-Pugh modifier removed; treat the clinical
> evidence as U.S.-label support rather than an Indian regulatory-label claim;
> and keep production-open disabled. Reviewer ID: clinician:subas
