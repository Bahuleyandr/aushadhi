# warfarin × metronidazole — clinician approval record

Package status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

Approval status: **PENDING — no authenticated approval event exists**

Reviewer identity: `clinician:subas`

Approval subject JCS SHA-256: `510b333396b09d12ead2af307494f1e818a8b3c95a066a7ac04fcf20d49665fd`

The canonical authority subject is the adjacent `warfarin-metronidazole.approval-subject.json`. This Markdown is its human-readable review record. A signature applies only to the exact canonical subject hash above.

## Exact approval statement

I approve the warfarin-metronidazole clinical rule content and exact product scope for production-open review, limited to the five enumerated open-catalogue oral-tablet assertions and 6 exact product pairs (Flagyl 200 mg and 400 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. The alert must require prescriber or anticoagulation-service warfarin dose review and PT/INR monitoring when oral metronidazole is started or stopped; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling; exclude tinidazole, topical metronidazole, combination suspensions, and every other unreviewed presentation; keep the unsupported Child-Pugh modifier removed; and do not invent a universal PT/INR schedule or fixed post-discontinuation interval. Treat the evidence as U.S.-label support rather than an Indian regulatory-label claim, and keep declared coverage partial. This clinical signature does not clear the pending github-jr source-rights gate and grants no runtime, publication, production, deployment, or clinical-use authority. Reviewer ID: clinician:subas

## Exact product scope

Route: `oral`

Formulation: `tablet`

Exact product assertions: `5`

Exact product pairs: `6`

| Role | Product | Manufacturer | Pack | Source identity | Product ID | Assertion SHA-256 |
|---|---|---|---|---|---|---|
| Object | Warf 1 Tablet | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241490` | `sha256:75ff289ed3f39da43c77f97e8ff24ebc8f36636bad7879c25bad180cca8bd3e5` | `8085504e2d8f147581025560310a71b943a33f792ed8d56dac1f71043326f34c` |
| Object | Warf 2 Tablet | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241458` | `sha256:2c013c09d6880da492e3faefa06db996f9fc7bf9920751009b261f95c9ad3445` | `c1dcadfbfabb21f57e8deface7a90323f15b0e7946fe2265de245f7efdab0469` |
| Object | Warf 5 Tablet | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241434` | `sha256:47bd772d5427882a321df9cc9f1cb5187c4b7e5476ea8cd6b4267bdc5f9d2c61` | `a8877c57f2158b4c40fa19a69aeab393bb4fb3d0cb9b699a83d70454d0820d26` |
| Perpetrator | Flagyl 200 Tablet | Abbott | strip of 15 tablets | `presentation:github-jr:84136` | `sha256:de1e08a2d44ccaa84c91a694d3c6b3cc87de519b06023855b6a20ff3b0618735` | `834194c3b239c39f41c7f82ccc540bce874a07e0936595acb1f5f3d95daefdce` |
| Perpetrator | Flagyl 400 Tablet | Abbott | strip of 15 tablets | `presentation:github-jr:84039` | `sha256:471be4a70c9c0f503d78816031b1b8c4e71c0fe15a28d320dbc8375e557ee259` | `43877d54c0d5d5838bdc9154ac9e7e8cd9ed1f210aa0a8900be218e6cc2ff1f9` |

Every pair is explicitly enumerated in the canonical JSON. No ingredient-wide, fuzzy, brand-derived, component-only, suspension, injection, topical, combination, or other unlisted product match is approved.

## Clinical content

Severity: `major` — clinically important and requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe.

Mechanism: Metronidazole can potentiate warfarin anticoagulant effect and prolong prothrombin time; the current warfarin label also lists metronidazole as a CYP2C9 inhibitor.

Dispensing action: `confirm_and_monitor`

Prescriber action: Confirm that the prescriber or anticoagulation service has reviewed the warfarin dose and arranged PT/INR monitoring when oral metronidazole is started or stopped. Do not independently stop either medicine or autonomously change the warfarin dose.

Monitoring: Use prescriber-directed PT/INR monitoring during coadministration and when the interacting medicine is started or stopped.

Patient counselling: Counsel the patient to seek urgent clinical advice for unusual bleeding or bruising, prolonged bleeding, blood in urine, or red or tarry-black stools.

Exclusions and exceptions: This review scope is limited to exact oral-tablet product assertions. Tinidazole, topical metronidazole, and metronidazole combination suspensions are outside the proposed scope.

## Evidence boundary

| Jurisdiction | Document | Version | Payload SHA-256 |
|---|---|---|---|
| US | `openfda-labels:a2883ca1-5a9a-4259-9d80-46ab67274384` | `25` | `4baf60bc4b057156c7bd085554287e2c69e557fce0d266d35980ec69b9926417` |
| US | `openfda-labels:51e98fb6-ba76-497e-95d8-fe895ef0b7ed` | `7` | `bcb1e6db5ac6619c0c93ede9f0c689dfd8ffdff4f187067335c243046b5d3e04` |

The evidence jurisdiction is the United States. It is not an Indian regulatory-label claim. Run the rule-scoped live verification command in the sign-off checklist immediately before signing; drift in a cited document blocks that subject.

## Authority boundary

This pending record grants no runtime, publication, production, deployment, or clinical-use authority. The catalogue source-rights status remains `pending_separate_owner_legal_release_decision`; clinical signature does not clear it. Production-open remains empty until separate post-signature mapping, promotion, source-rights, compiler, and release gates pass.

## How to sign

Do not edit the canonical subject or this statement. Create a new immutable event from the adjacent template, record `APPROVED` or `REJECTED`, the UTC review time, the repository HEAD reviewed, and authenticated event evidence, then sign that new event through the authorized workflow. Never turn the template itself into an event.
