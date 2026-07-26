# Warfarin with metronidazole, ketoconazole, and voriconazole approvals

Date: 2026-07-26

Reviewer: `clinician:subas`

Review packet:
`docs/interaction-review/2026-07-26-warfarin-metronidazole-ketoconazole-voriconazole-review.json`

Release profile: `internal-evaluation` only

Production-open status: disabled

The reviewer approved five separately enumerated decisions. These approvals
apply only to the exact assertions and product cross-products in the review
packet.

## Ingredient identity approval

> I approve all three ingredient identity mappings as exact: observed
> metronidazole to RxNorm ingredient RxCUI 6922, UNII 140QMO216E; observed
> ketoconazole to RxNorm ingredient RxCUI 6135, UNII R9400W927I; and observed
> voriconazole to RxNorm ingredient RxCUI 121243, UNII JFU09I87TR. Reviewer ID:
> clinician:subas

## Product-presentation approval

> I approve all four product-presentation mappings as oral tablet for the exact
> PMBJP assertions in the 2026-07-26
> warfarin-metronidazole-ketoconazole-voriconazole review packet: codes 201,
> 202, 400, and 2034. This approval excludes ketoconazole soap code 1672,
> metronidazole ointment code 2441, metronidazole combination suspension code
> 2616, and all tinidazole products. Reviewer ID: clinician:subas

## Warfarin-metronidazole clinical approval

> I approve the warfarin-metronidazole clinical rule for internal evaluation
> only, limited to the five reviewed PMBJP oral-tablet assertions (six
> cross-product combinations), as major severity with confirm-and-monitor
> management. The alert must require prescriber/anticoagulation-service
> warfarin dose review and PT/INR monitoring when metronidazole is started or
> stopped; it must not direct the pharmacy to change a dose or stop either
> medicine independently. Include bleeding-symptom counselling; exclude
> tinidazole, topical metronidazole, combination suspensions, and other
> non-tablet presentations; remove the unsupported Child-Pugh B modifier; do
> not invent a universal PT/INR schedule or fixed post-discontinuation
> interval; treat the evidence as U.S.-label support rather than an Indian
> regulatory-label claim; and keep production-open disabled. Reviewer ID:
> clinician:subas

## Warfarin-ketoconazole clinical approval

> I approve the warfarin-ketoconazole clinical rule for internal evaluation
> only, limited to the four reviewed PMBJP oral-tablet assertions (three
> cross-product combinations), as major severity with confirm-and-monitor
> management. The alert must require prescriber/anticoagulation-service
> warfarin dose review and PT/INR monitoring when oral ketoconazole is started
> or stopped; it must not direct the pharmacy to change a dose or stop either
> medicine independently. Include bleeding-symptom counselling; exclude
> ketoconazole soap and every other topical or non-tablet presentation; remove
> the unsupported Child-Pugh B modifier; do not invent a universal PT/INR
> schedule or fixed post-discontinuation interval; treat the evidence as
> U.S.-label support rather than an Indian regulatory-label claim; and keep
> production-open disabled. Reviewer ID: clinician:subas

## Warfarin-voriconazole clinical approval

> I approve the warfarin-voriconazole clinical rule for internal evaluation
> only, limited to the four reviewed PMBJP oral-tablet assertions (three
> cross-product combinations), as major severity with confirm-and-monitor
> management. The alert must require prescriber/anticoagulation-service
> warfarin dose review and prescriber-directed PT/INR monitoring when
> voriconazole is started or stopped; it must not direct the pharmacy to change
> a dose, stop either medicine independently, or mandate substitution to
> another antifungal. Include bleeding-symptom counselling; exclude
> intravenous and other non-tablet voriconazole presentations; remove the
> unsupported Child-Pugh B modifier; do not invent a universal PT/INR schedule
> or fixed post-discontinuation interval; treat the evidence as U.S.-label
> support rather than an Indian regulatory-label claim; and keep
> production-open disabled. Reviewer ID: clinician:subas

## Approved scope

- `warfarin__metronidazole`: PMBJP codes `201` and `202` crossed with warfarin
  codes `2141`, `2142`, and `452`, producing six exact product pairs.
- `warfarin__ketoconazole_oral`: PMBJP code `400` crossed with the three
  approved warfarin tablets, producing three exact product pairs.
- `warfarin__voriconazole`: PMBJP code `2034` crossed with the three approved
  warfarin tablets, producing three exact product pairs.

The approvals are not ingredient-wide. A product must retain both its reviewed
exact ingredient identity and reviewed oral-tablet presentation before it can
enter internal clinical matching.

## Safety and evidence boundaries

All three rules use `confirm_and_monitor`. They require confirmation of
prescriber or anticoagulation-service warfarin review and prescriber-directed
PT/INR monitoring when the interacting drug is started or stopped. They do not
authorize an independent pharmacy dose change or interruption of either
medicine.

The clinical evidence is U.S.-label support and is not represented as an
Indian regulatory-label claim. The rules contain no Child-Pugh B modifier,
universal PT/INR schedule, or fixed post-discontinuation interval.

`production-open` remains an independent empty pack and cannot inherit these
approvals.
