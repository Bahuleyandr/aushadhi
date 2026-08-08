# warfarin × ketoconazole oral — clinician approval record

Package status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

Approval status: **PENDING — no authenticated approval event exists**

Reviewer identity: `clinician:subas`

Approval subject JCS SHA-256: `1cd31c8f9d658db48bcee9d9ff2ddf98166d126d5b7dfeb1fc468240f743f193`

The canonical authority subject is the adjacent `warfarin-ketoconazole-oral.approval-subject.json`. This Markdown is its human-readable review record. A signature applies only to the exact canonical subject hash above.

## Exact approval statement

I approve the warfarin-ketoconazole clinical rule content and exact product scope for production-open review, limited to the four enumerated open-catalogue oral-tablet assertions and 3 exact product pairs (Kenz 200 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. For current or intended concurrent exposure, the alert must require prescriber or anticoagulation-service warfarin dose review and PT/INR monitoring; it must not direct the pharmacy to change a dose or stop either medicine independently. This interaction approval does not endorse oral ketoconazole, override its boxed warning, relax its restricted-use conditions, or supersede its contraindications, hepatic-monitoring requirements, or other drug-interaction restrictions. Include bleeding-symptom counselling; exclude ketoconazole soap, lotion, shampoo, cream, and every other topical or unreviewed presentation; keep the unsupported Child-Pugh modifier removed; and do not invent a universal PT/INR schedule or fixed post-discontinuation interval. Treat the evidence as U.S.-label support rather than an Indian regulatory-label claim, and keep declared coverage partial. The current checker evaluates only current or intended concurrent exposure; it does not automatically detect discontinuation, dose-change, or recent-exposure events, so medication-lifecycle follow-up remains with the prescriber or anticoagulation service outside this checker. This approval expires 180 days after the authenticated reviewed_at_utc timestamp and may invalidate earlier under the listed conditions. This clinical signature does not clear the pending github-jr source-rights gate and grants no runtime, publication, production, deployment, or clinical-use authority. Reviewer ID: clinician:subas

## Exact product scope

Route: `oral`

Formulation: `tablet`

Exact product assertions: `4`

Exact product pairs: `3`

Catalogue artifact: `data/interaction/production-open/product-catalogue/drugs.jsonl`

Catalogue artifact SHA-256: `b2186efe0c7483a7b10e57f02ec9d555a012bed40d8a26e3ed72c1249a1454e2`

Committed source-binding capture: `docs/interaction-review/2026-08-08-warfarin-six-production-open-signoff/product-catalogue-binding-evidence.jsonl`

Source-binding capture SHA-256: `b329903e8c3b65b6b39868b58e8ddd54678f948657695b33fa707a1c4abad822`

| Role | Product | Normalized ingredient | Strength | Route | Formulation | Release profile | Manufacturer | Pack | Source identity | Product ID | Assertion SHA-256 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Object | Warf 1 Tablet | warfarin | 1 mg | oral | tablet | not asserted | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241490` | `sha256:75ff289ed3f39da43c77f97e8ff24ebc8f36636bad7879c25bad180cca8bd3e5` | `8085504e2d8f147581025560310a71b943a33f792ed8d56dac1f71043326f34c` |
| Object | Warf 2 Tablet | warfarin | 2 mg | oral | tablet | not asserted | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241458` | `sha256:2c013c09d6880da492e3faefa06db996f9fc7bf9920751009b261f95c9ad3445` | `c1dcadfbfabb21f57e8deface7a90323f15b0e7946fe2265de245f7efdab0469` |
| Object | Warf 5 Tablet | warfarin | 5 mg | oral | tablet | not asserted | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241434` | `sha256:47bd772d5427882a321df9cc9f1cb5187c4b7e5476ea8cd6b4267bdc5f9d2c61` | `a8877c57f2158b4c40fa19a69aeab393bb4fb3d0cb9b699a83d70454d0820d26` |
| Perpetrator | Kenz Tablet | ketoconazole | 200 mg | oral | tablet | not asserted | KLM Laboratories Pvt Ltd | strip of 10 tablets | `presentation:github-jr:115796` | `sha256:71be56f2af9d66533522960676a5f6a49ddcce720ef97885a069d5657a479ff7` | `12068c30186fb59b795b2e198952466c4031a15dfe08636866460421d889453d` |

Every pair is explicitly enumerated in the canonical JSON. No ingredient-wide, fuzzy, brand-derived, component-only, suspension, injection, topical, combination, or other unlisted product match is approved.

Excluded, missing, ambiguous, stale, drifted, or otherwise unlisted products remain `not_evaluated_or_unresolved`; they must never be rendered as safe or no interaction.

## Clinical content

Severity: `major` — clinically important and requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe.

Mechanism: Oral ketoconazole may enhance warfarin anticoagulant effect; the current warfarin label lists ketoconazole as a CYP3A4 inhibitor with potential to increase warfarin effect.

Dispensing action: `confirm_and_monitor`

Prescriber action: For current or intended concurrent oral ketoconazole exposure, confirm that the prescriber or anticoagulation service has reviewed the warfarin dose and established the PT/INR plan. Do not independently stop either medicine or autonomously change the warfarin dose.

Monitoring: Use prescriber-directed PT/INR monitoring during coadministration. Follow-up after discontinuation is clinician-managed outside the current checker.

Patient counselling: Counsel the patient to seek urgent clinical advice for unusual bleeding or bruising, prolonged bleeding, blood in urine, or red or tarry-black stools.

Exclusions and exceptions: This interaction review does not endorse oral ketoconazole, override its boxed warning, relax its restricted-use conditions, or supersede its contraindications, hepatic-monitoring requirements, or other drug-interaction restrictions. Scope is limited to the exact oral-tablet product assertion. Ketoconazole soap, lotion, shampoo, cream, and every other topical or unreviewed presentation are excluded.

## Evidence boundary

| Jurisdiction | Document | Version | Payload SHA-256 |
|---|---|---|---|
| US | `openfda-labels:bc189ce2-3f10-260d-e053-2a95a90ae808` | `2` | `a0872968d6e697c71b32e13b40b74dceb7730b7158aae2100888551e44f7f985` |
| US | `openfda-labels:51e98fb6-ba76-497e-95d8-fe895ef0b7ed` | `7` | `bcb1e6db5ac6619c0c93ede9f0c689dfd8ffdff4f187067335c243046b5d3e04` |

Evidence jurisdiction: `US`

Product catalogue: `github-jr`

Product market: `India`

Deployment jurisdiction: `none`

Scope note: The evidence supports an interaction boundary for the exact systemic-oral ketoconazole tablet assertion only. It does not endorse use of oral ketoconazole or override its U.S. boxed warning and restricted-use conditions.

The evidence jurisdiction is the United States. It is not an Indian regulatory-label claim. Run the rule-scoped live verification command in the sign-off checklist immediately before signing; drift in a cited document blocks that subject.

## Workflow and validity boundary

The current checker supports only current or intended concurrent exposure. It does not automatically detect discontinuation, dose change, or recent exposure. Medication-lifecycle follow-up remains with the prescriber or anticoagulation service outside this checker.

An authenticated approval expires exactly 180 days after its `reviewed_at_utc` timestamp and may invalidate earlier under the canonical conditions. Expiry requires a new reviewed subject and authenticated approval event; it never extends automatically.

## Authority boundary

This pending record grants no runtime, publication, production, deployment, or clinical-use authority. The catalogue source-rights status remains `pending_separate_owner_legal_release_decision`; clinical signature does not clear it. Production-open remains empty until separate post-signature mapping, promotion, source-rights, compiler, and release gates pass.

## How to sign

Do not edit the canonical subject or this statement. Create a new immutable event from the adjacent template, record `APPROVED` or `REJECTED`, the UTC review time, the repository HEAD reviewed, and authenticated event evidence, then sign that new event through the authorized workflow. Never turn the template itself into an event.
