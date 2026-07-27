# Clinician approval: warfarin-azithromycin and tramadol

Date: 2026-07-27

Reviewer: `clinician:subas`

Release profile: `internal-evaluation` only

Production-open status: disabled

## Ingredient identity approval

> I approve both ingredient identity mappings as exact: observed azithromycin to RxNorm ingredient RxCUI 18631, UNII F94OW58Y8V; and observed tramadol to RxNorm ingredient RxCUI 10689, UNII 39J1LGJ30J. Reviewer ID: clinician:subas

## Product-presentation approval

> I approve all four product-presentation mappings as oral tablet for the exact PMBJP assertions in the 2026-07-27 warfarin-azithromycin-tramadol review packet: codes 18, 72, 28, and 521. This approval excludes stale azithromycin dispersible-tablet assertion code 48, azithromycin suspensions codes 47 and 1521, tramadol injections codes 26 and 27, tramadol combination products codes 510, 1747, and 2649, and every other unreviewed presentation. Reviewer ID: clinician:subas

## Warfarin-azithromycin clinical approval

> I approve the warfarin-azithromycin clinical rule for internal evaluation only, limited to the five reviewed PMBJP oral-tablet assertions (six cross-product combinations), as moderate severity with confirm-and-monitor management. The alert must require a prescriber/anticoagulation-service PT/INR monitoring plan during concomitant oral azithromycin use and a clinician-directed decision about follow-up when the course ends; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling; disclose that the U.S. label's signal is based on spontaneous postmarketing reports and that its dedicated azithromycin-warfarin study did not affect prothrombin time; exclude stale code 48, suspensions, dispersible tablets, and every other unreviewed or non-tablet presentation; do not invent a universal PT/INR schedule or fixed post-discontinuation interval; treat the evidence as U.S.-label support rather than an Indian regulatory-label claim; and keep production-open disabled. Reviewer ID: clinician:subas

## Warfarin-tramadol clinical approval

> I approve the warfarin-tramadol clinical rule for internal evaluation only, limited to the five reviewed PMBJP oral-tablet assertions (six cross-product combinations), as major severity with confirm-and-monitor management. The alert must require prescriber/anticoagulation-service review of whether warfarin dose adjustment is needed and additional PT/INR monitoring when oral tramadol is started, with a clinician-directed follow-up decision when tramadol is stopped; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling and advice not to stop warfarin without consulting a healthcare professional; exclude injections, combination products, and every other unreviewed or non-tablet presentation; do not invent a universal PT/INR schedule or fixed post-discontinuation interval; treat the evidence as a UK MHRA safety update rather than a U.S. or Indian regulatory claim; and keep production-open disabled. Reviewer ID: clinician:subas

## Approved scope

- `warfarin__azithromycin_oral`: PMBJP codes `18` and `72` crossed
  with warfarin codes `2141`, `2142`, and `452`, producing six exact
  product pairs.
- `warfarin__tramadol`: PMBJP codes `28` and `521` crossed with the
  same three warfarin tablets, producing six exact product pairs.

The approvals are not ingredient-wide. A product must retain both its reviewed
exact ingredient identity and reviewed oral-tablet presentation before it can
enter internal clinical matching.

## Safety and evidence boundaries

Both rules use `confirm_and_monitor`. They require a
prescriber/anticoagulation-service monitoring or review plan and do not
authorize the pharmacy to change a dose or stop either medicine independently.

The azithromycin rule preserves the U.S. label's postmarketing signal and its
dedicated-study counterpoint. The tramadol rule remains bounded to the UK MHRA
safety update. Neither is represented as an Indian regulatory claim, and no
rule invents a universal PT/INR schedule or fixed post-discontinuation
interval.

Stale azithromycin code `48`, azithromycin suspensions, tramadol injections,
tramadol combination products, and every other unreviewed presentation remain
outside the approved product bindings.

`production-open` remains an independent empty pack and cannot inherit these
approvals.
