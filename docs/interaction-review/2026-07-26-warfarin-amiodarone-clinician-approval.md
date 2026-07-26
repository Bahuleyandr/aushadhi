# Warfarin-amiodarone internal rule approval

Date: 2026-07-26

Reviewer: `clinician:subas`

Release profile: `internal-evaluation` only

Production-open status: disabled

## Approval statement

> I approve the warfarin-amiodarone clinical rule for internal evaluation only,
> limited to the five reviewed PMBJP oral-tablet assertions (six cross-product
> combinations), as major severity with confirm-and-monitor management. The
> alert must require prescriber/anticoagulation-service warfarin dose review and
> PT/INR monitoring; it must not direct the pharmacy to change a dose or stop
> either medicine independently. Include bleeding-symptom counselling and
> persistence for weeks to months after amiodarone discontinuation; remove the
> unsupported Child-Pugh B modifier; treat the evidence as U.S.-label support
> rather than an Indian regulatory-label claim; and keep production-open
> disabled.

## Approved scope

The clinician approved one major-severity warfarin-amiodarone rule for the six
cross-product combinations formed by these five exact reviewed PMBJP oral-tablet
assertions:

- Amiodarone Tablets IP 100 mg (`janaushadhi:1502`)
- Amiodarone Tablets IP 200 mg (`janaushadhi:430`)
- Warfarin Tablets IP 1mg (`janaushadhi:2141`)
- Warfarin Tablets IP 2mg (`janaushadhi:2142`)
- Warfarin Tablets IP 5 mg (`janaushadhi:452`)

The runtime rule is not an ingredient-wide approval. Both exact product
assertions must retain their reviewed oral-tablet presentation mappings before
the rule can enter clinical matching.

## Approved management

The typed dispensing action is `confirm_and_monitor`. The alert requires
confirmation that the prescriber or anticoagulation service has reviewed the
warfarin dose and arranged PT/INR monitoring when amiodarone is started,
stopped, or changed.

The pharmacy is not instructed to change the warfarin dose or stop either
established medicine independently. The alert includes counselling for unusual
bleeding or bruising, prolonged bleeding, blood in urine, and red or
tarry-black stools. It also states that prescriber-directed monitoring can
remain necessary for weeks to months after amiodarone discontinuation.

## Evidence boundary

The evidence is U.S.-label support, not an Indian regulatory-label claim:

- Amiodarone hydrochloride tablets, set ID
  `f49d011f-5ca6-4f75-ba16-2099fe42f5aa`, version 2, canonical openFDA
  payload SHA-256
  `efe97f77331c76897a077b62d15a776986b6f1b2315bf2354850e4fafc2ef2b4`.
- Warfarin sodium tablets, set ID
  `51e98fb6-ba76-497e-95d8-fe895ef0b7ed`, version 7, canonical openFDA
  payload SHA-256
  `bcb1e61f908c62018e95b8c58b214f517e5730dbd3feecbf6bafcb0d4da0ec1d`.

The previously drafted Child-Pugh B modifier was not supported for this
pair-specific rule and is absent from the approved runtime rule.

## Runtime safeguards

- `data-static/interaction-rules.internal-evaluation.json` contains the
  approved rule and all six canonical product pairs.
- `data-static/interaction-rules.json` remains empty with unknown coverage.
- The CLI selects the internal pack only for an explicit
  `--profile internal-evaluation` run.
- A missing, stale, or operationally failed product-presentation mapping
  prevents that product from entering clinical pair generation.
- A different product with the same mapped clinical ingredient does not match
  this approval.
