# Warfarin-fluconazole identity, presentation, and clinical approvals

Date: 2026-07-26

Reviewer: `clinician:subas`

Approval response: `approval given`

Review packet:
`docs/interaction-review/2026-07-26-warfarin-fluconazole-review.json`

Release profile: `internal-evaluation` only

Production-open status: disabled

The reviewer gave approval immediately after being directed to the three
separately enumerated statements in the review packet. The approval is recorded
against those exact statements and does not apply beyond their bounded
assertions.

## Ingredient identity approval

> I approve the fluconazole ingredient identity mapping as exact: observed
> `fluconazole` to RxNorm ingredient RxCUI `4450`, UNII `8VZV102JFY`.
> Reviewer ID: clinician:subas

## Product-presentation approval

> I approve all four product-presentation mappings as oral tablet for the exact
> PMBJP assertions in the 2026-07-26 warfarin-fluconazole review packet:
> codes `1246`, `2771`, `2772`, and `2773`.
> Reviewer ID: clinician:subas

The 400 mg assertion remains transparently bounded to the PMBI tender evidence.
Its exact RxNorm SCD search returned no active concept; the approval does not
claim otherwise.

## Clinical-rule approval

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

## Approved scope

The rule is restricted to the 12 cross-product combinations formed by these
seven exact reviewed PMBJP oral-tablet assertions:

- Warfarin Tablets IP 1 mg (`janaushadhi:2141`)
- Warfarin Tablets IP 2 mg (`janaushadhi:2142`)
- Warfarin Tablets IP 5 mg (`janaushadhi:452`)
- Fluconazole Tablets IP 50 mg (`janaushadhi:2771`)
- Fluconazole Tablets IP 150 mg (`janaushadhi:1246`)
- Fluconazole Tablets IP 200 mg (`janaushadhi:2772`)
- Fluconazole Tablets IP 400 mg (`janaushadhi:2773`)

The promotion is not an ingredient-wide approval. Both exact product assertions
must retain reviewed oral-tablet presentation mappings before the rule can enter
clinical matching.

## Approved management boundary

The typed dispensing action is `confirm_and_monitor`. The alert requires
confirmation that the prescriber or anticoagulation service has reviewed the
warfarin dose and arranged PT/INR monitoring when fluconazole is started or
stopped.

The pharmacy is not instructed to change the warfarin dose or stop either
medicine independently. The rule includes bleeding-symptom counselling and the
label-supported statement that fluconazole enzyme inhibition can persist for 4
to 5 days after discontinuation. It does not assert a universal PT/INR schedule
or a single-dose exception.

## Evidence boundary

The clinical interaction evidence is attributed to the current U.S. fluconazole
and warfarin labels. It is not represented as an Indian regulatory-label claim.
The unsupported Child-Pugh modifier remains removed.

The generated internal runtime artifact remains independent from the draft
review packet. `production-open` stays empty and cannot inherit this approval.
