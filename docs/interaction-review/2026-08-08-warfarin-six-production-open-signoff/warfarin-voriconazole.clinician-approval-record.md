# warfarin × voriconazole — clinician approval record

Package status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

Approval status: **PENDING — no authenticated approval event exists**

Reviewer identity: `clinician:subas`

Approval subject JCS SHA-256: `53d5a45c3c1127f0b9788885e8ef9c8240020ce059a902e4ea25e509c8f409cf`

The canonical authority subject is the adjacent `warfarin-voriconazole.approval-subject.json`. This Markdown is its human-readable review record. A signature applies only to the exact canonical subject hash above.

## Exact approval statement

I approve the warfarin-voriconazole clinical rule content and exact product scope for production-open review, limited to the four enumerated open-catalogue oral-tablet assertions and 3 exact product pairs (Voritek 200 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. The alert must require prescriber or anticoagulation-service warfarin dose review and prescriber-directed PT/INR monitoring when voriconazole is started or stopped; it must not direct the pharmacy to change a dose, stop either medicine independently, or mandate substitution to another antifungal. Include bleeding-symptom counselling; exclude intravenous and every other unreviewed presentation; keep the unsupported Child-Pugh modifier removed; and do not invent a universal PT/INR schedule or fixed post-discontinuation interval. Treat the evidence as U.S.-label support rather than an Indian regulatory-label claim, and keep declared coverage partial. This clinical signature does not clear the pending github-jr source-rights gate and grants no runtime, publication, production, deployment, or clinical-use authority. Reviewer ID: clinician:subas

## Exact product scope

Route: `oral`

Formulation: `tablet`

Exact product assertions: `4`

Exact product pairs: `3`

| Role | Product | Manufacturer | Pack | Source identity | Product ID | Assertion SHA-256 |
|---|---|---|---|---|---|---|
| Object | Warf 1 Tablet | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241490` | `sha256:75ff289ed3f39da43c77f97e8ff24ebc8f36636bad7879c25bad180cca8bd3e5` | `8085504e2d8f147581025560310a71b943a33f792ed8d56dac1f71043326f34c` |
| Object | Warf 2 Tablet | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241458` | `sha256:2c013c09d6880da492e3faefa06db996f9fc7bf9920751009b261f95c9ad3445` | `c1dcadfbfabb21f57e8deface7a90323f15b0e7946fe2265de245f7efdab0469` |
| Object | Warf 5 Tablet | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241434` | `sha256:47bd772d5427882a321df9cc9f1cb5187c4b7e5476ea8cd6b4267bdc5f9d2c61` | `a8877c57f2158b4c40fa19a69aeab393bb4fb3d0cb9b699a83d70454d0820d26` |
| Perpetrator | Voritek 200 Tablet | Cipla Ltd | strip of 4 tablets | `presentation:github-jr:233405` | `sha256:78f18feac48fff42940859159f17552a27e53129ab8e853206d8ae8bdb5fb808` | `d6c903e8c531bf2b3b6e0ef39a2b1c436bed6aa5c21db056bc6f1f82bedace45` |

Every pair is explicitly enumerated in the canonical JSON. No ingredient-wide, fuzzy, brand-derived, component-only, suspension, injection, topical, combination, or other unlisted product match is approved.

## Clinical content

Severity: `major` — clinically important and requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe.

Mechanism: Voriconazole inhibits CYP2C9 and can significantly increase prothrombin time and warfarin anticoagulant effect.

Dispensing action: `confirm_and_monitor`

Prescriber action: Confirm that the prescriber or anticoagulation service has reviewed the warfarin dose and arranged PT/INR monitoring when oral voriconazole is started or stopped. Do not independently stop either medicine or autonomously change the warfarin dose.

Monitoring: Use prescriber-directed PT/INR monitoring during coadministration and when the interacting medicine is started or stopped.

Patient counselling: Counsel the patient to seek urgent clinical advice for unusual bleeding or bruising, prolonged bleeding, blood in urine, or red or tarry-black stools.

Exclusions and exceptions: This review scope is limited to the exact oral-tablet product assertion. Intravenous and other voriconazole presentations are outside the proposed product scope.

## Evidence boundary

| Jurisdiction | Document | Version | Payload SHA-256 |
|---|---|---|---|
| US | `openfda-labels:67c174da-41b8-4738-8a22-dd814b8e96b8` | `27` | `482ea96d744a36285c329e6ed88a69bbe8fcc9460b2f23921f3476f4969f02ae` |
| US | `openfda-labels:51e98fb6-ba76-497e-95d8-fe895ef0b7ed` | `7` | `bcb1e6db5ac6619c0c93ede9f0c689dfd8ffdff4f187067335c243046b5d3e04` |

The evidence jurisdiction is the United States. It is not an Indian regulatory-label claim. Run the rule-scoped live verification command in the sign-off checklist immediately before signing; drift in a cited document blocks that subject.

## Authority boundary

This pending record grants no runtime, publication, production, deployment, or clinical-use authority. The catalogue source-rights status remains `pending_separate_owner_legal_release_decision`; clinical signature does not clear it. Production-open remains empty until separate post-signature mapping, promotion, source-rights, compiler, and release gates pass.

## How to sign

Do not edit the canonical subject or this statement. Create a new immutable event from the adjacent template, record `APPROVED` or `REJECTED`, the UTC review time, the repository HEAD reviewed, and authenticated event evidence, then sign that new event through the authorized workflow. Never turn the template itself into an event.
