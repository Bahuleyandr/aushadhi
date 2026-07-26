# Warfarin-metronidazole, ketoconazole, and voriconazole PMBJP review packet

Date: 2026-07-26

Status: review candidate only

Release profile: proposed for `internal-evaluation` only

Production-open status: disabled

This packet prepares, but does not approve, three exact ingredient identities,
four PMBJP oral-tablet presentations, and three separate clinical rules. The
machine-readable bindings are in
`docs/interaction-review/2026-07-26-warfarin-metronidazole-ketoconazole-voriconazole-review.json`.

## Ingredient identity candidates

| Observed ingredient | RxCUI | Term type | UNII | Local ingredient ID |
|---|---:|---|---|---|
| metronidazole | `6922` | `IN` | `140QMO216E` | `sha256:2cfce43b6ba7f9dc5199dddfb775a891d05ef3b1843760d3b1a1a7661c507d00` |
| ketoconazole | `6135` | `IN` | `R9400W927I` | `sha256:0a5ac69ba4a0e934d85bbe7089ec9bf3ecad050f2744e65cb78bed9225b5c755` |
| voriconazole | `121243` | `IN` | `JFU09I87TR` | `sha256:1b256adbbd2342e39f3e1b78d36313735db6cdc065eb0f3c82ff0f99f183a20a` |

All three exact searches returned one active RxNorm ingredient concept in
release `06-Jul-2026`, API `3.1.354`. The mappings remain absent from the
committed override manifest until separately approved.

## Product-presentation candidates

| PMBJP code | Exact product assertion | Pack | Product assertion SHA-256 | Proposed presentation |
|---|---|---:|---|---|
| `201` | Metronidazole Tablets IP 200mg | 10's | `a8eac64a6ca3075081d44dc926af5bc576aee0d9296f205c5a929fb675c687a4` | oral tablet |
| `202` | Metronidazole Tablets IP 400mg | 10's | `95687430cb6c58fc92dbfe8110609e9a04a1cec682cfd192ee8d09d5bc36349e` | oral tablet |
| `400` | Ketoconazole Tablets IP 200 mg | 10's | `5c73e9a7a1d2276384ee1227a95aad0ec2ff42c1fbd7a337282b7e0e05b11536` | oral tablet |
| `2034` | Voriconazole Tablets IP 200mg | 4's | `4b9aee41bdec150b53809270617f07be94403edead77f2a21885b1f0fcc4c7ea` | oral tablet |

PMBI tenders `RC-222/2025`, `RC-166/2021`, and `RC-211/2023`
independently identify the four exact codes, strengths, film/uncoated tablet
forms, and packs. Exact RxNorm searches independently returned active SCD
concepts `199326`, `199327`, `197853`, and `349434`, each explicitly
named as an Oral Tablet.

The packet explicitly excludes:

- ketoconazole soap code `1672`;
- metronidazole-povidone iodine ointment code `2441`;
- ofloxacin-metronidazole oral suspension code `2616`; and
- every tinidazole product.

## Clinical candidates

| Rule | Interacting tablets | Warfarin tablets | Exact pairs | Proposed severity/action |
|---|---:|---:|---:|---|
| `warfarin__metronidazole` | 2 | 3 | 6 | major / confirm-and-monitor |
| `warfarin__ketoconazole_oral` | 1 | 3 | 3 | major / confirm-and-monitor |
| `warfarin__voriconazole` | 1 | 3 | 3 | major / confirm-and-monitor |

The old nitroimidazole class selector has been replaced with an exact
metronidazole selector; tinidazole is no longer present. All three candidates
are limited to exact reviewed oral-tablet assertions. They require
prescriber/anticoagulation-service warfarin dose review and PT/INR monitoring
when the interacting medicine is started or stopped. They do not authorize
the pharmacy to change a dose or stop either medicine independently.

The unsupported Child-Pugh B pair modifiers were removed. Voriconazole no
longer carries an unsupported instruction to substitute another antifungal.
No candidate invents a universal PT/INR schedule or fixed monitoring interval
after discontinuation.

## Evidence and adversarial findings

- Metronidazole U.S. label: set ID
  `a2883ca1-5a9a-4259-9d80-46ab67274384`, version 25, effective
  `20260522`.
- Oral ketoconazole U.S. label: set ID
  `bc189ce2-3f10-260d-e053-2a95a90ae808`, version 2, effective
  `20250117`.
- Voriconazole U.S. label: set ID
  `67c174da-41b8-4738-8a22-dd814b8e96b8`, version 27, effective
  `20260215`.
- Warfarin U.S. label: set ID
  `51e98fb6-ba76-497e-95d8-fe895ef0b7ed`, version 7, effective
  `20260629`.
- DailyMed current SPL XML for all four documents was fetched live on
  2026-07-26 and retained fragments remained present. After a temporary HTTP
  404 response, openFDA recovered and the repository assembler live-verified
  all 244 evidence records, synchronized the 199-rule aggregate, review
  index, and attestation, and produced pack SHA-256
  `367fe4cba0e6680835fc11ac2c9079a0ff14aaac78598a79c3bc66b7374f7008`.
- The clinical sources are U.S.-label evidence, not Indian
  regulatory-label claims. PMBI evidence establishes presentations only.
- No candidate has entered either runtime pack; production-open remains empty.

## Approval statements

These are deliberately separate decisions.

### Ingredient identities

> I approve all three ingredient identity mappings as exact: observed metronidazole to RxNorm ingredient RxCUI 6922, UNII 140QMO216E; observed ketoconazole to RxNorm ingredient RxCUI 6135, UNII R9400W927I; and observed voriconazole to RxNorm ingredient RxCUI 121243, UNII JFU09I87TR. Reviewer ID: clinician:subas

### Product presentations

> I approve all four product-presentation mappings as oral tablet for the exact PMBJP assertions in the 2026-07-26 warfarin-metronidazole-ketoconazole-voriconazole review packet: codes 201, 202, 400, and 2034. This approval excludes ketoconazole soap code 1672, metronidazole ointment code 2441, metronidazole combination suspension code 2616, and all tinidazole products. Reviewer ID: clinician:subas

### Warfarin-metronidazole clinical rule

> I approve the warfarin-metronidazole clinical rule for internal evaluation only, limited to the five reviewed PMBJP oral-tablet assertions (six cross-product combinations), as major severity with confirm-and-monitor management. The alert must require prescriber/anticoagulation-service warfarin dose review and PT/INR monitoring when metronidazole is started or stopped; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling; exclude tinidazole, topical metronidazole, combination suspensions, and other non-tablet presentations; remove the unsupported Child-Pugh B modifier; do not invent a universal PT/INR schedule or fixed post-discontinuation interval; treat the evidence as U.S.-label support rather than an Indian regulatory-label claim; and keep production-open disabled. Reviewer ID: clinician:subas

### Warfarin-ketoconazole clinical rule

> I approve the warfarin-ketoconazole clinical rule for internal evaluation only, limited to the four reviewed PMBJP oral-tablet assertions (three cross-product combinations), as major severity with confirm-and-monitor management. The alert must require prescriber/anticoagulation-service warfarin dose review and PT/INR monitoring when oral ketoconazole is started or stopped; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling; exclude ketoconazole soap and every other topical or non-tablet presentation; remove the unsupported Child-Pugh B modifier; do not invent a universal PT/INR schedule or fixed post-discontinuation interval; treat the evidence as U.S.-label support rather than an Indian regulatory-label claim; and keep production-open disabled. Reviewer ID: clinician:subas

### Warfarin-voriconazole clinical rule

> I approve the warfarin-voriconazole clinical rule for internal evaluation only, limited to the four reviewed PMBJP oral-tablet assertions (three cross-product combinations), as major severity with confirm-and-monitor management. The alert must require prescriber/anticoagulation-service warfarin dose review and prescriber-directed PT/INR monitoring when voriconazole is started or stopped; it must not direct the pharmacy to change a dose, stop either medicine independently, or mandate substitution to another antifungal. Include bleeding-symptom counselling; exclude intravenous and other non-tablet voriconazole presentations; remove the unsupported Child-Pugh B modifier; do not invent a universal PT/INR schedule or fixed post-discontinuation interval; treat the evidence as U.S.-label support rather than an Indian regulatory-label claim; and keep production-open disabled. Reviewer ID: clinician:subas
