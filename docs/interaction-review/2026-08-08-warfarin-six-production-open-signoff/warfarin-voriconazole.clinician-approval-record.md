# warfarin × voriconazole — clinician approval record

Package status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

Approval status: **PENDING — no authenticated approval event exists**

Reviewer identity: `clinician:subas`

Approval subject JCS SHA-256: `f923218ff498b0079761c88a41a1401fbfc409f253c91644f1a01142d36066e9`

The canonical authority subject is the adjacent `warfarin-voriconazole.approval-subject.json`. This Markdown is its human-readable review record. A signature applies only to the exact canonical subject hash above.

## Exact approval statement

I approve the warfarin-voriconazole clinical rule content and exact product scope for production-open review, limited to the four enumerated open-catalogue oral-tablet assertions and 3 exact product pairs (Voritek 200 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. For current or intended concurrent exposure, the alert must require prescriber or anticoagulation-service warfarin dose review and prescriber-directed close-interval PT/INR monitoring; the specific timing and duration are individualized. It must not direct the pharmacy to change a dose, stop either medicine independently, or mandate substitution to another antifungal. Include bleeding-symptom counselling; exclude intravenous and every other unreviewed presentation; keep the unsupported Child-Pugh modifier removed; and do not invent a universal PT/INR schedule or fixed post-discontinuation interval. Treat the evidence as U.S.-label support rather than an Indian regulatory-label claim, and keep declared coverage partial. The current checker evaluates only current or intended concurrent exposure; it does not automatically detect discontinuation, dose-change, or recent-exposure events, so medication-lifecycle follow-up remains with the prescriber or anticoagulation service outside this checker. This approval expires 180 days after the authenticated reviewed_at_utc timestamp and may invalidate earlier under the listed conditions. This clinical signature does not clear the pending github-jr source-rights gate and grants no runtime, publication, production, deployment, or clinical-use authority. Reviewer ID: clinician:subas

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
| Perpetrator | Voritek 200 Tablet | voriconazole | 200 mg | oral | tablet | not asserted | Cipla Ltd | strip of 4 tablets | `presentation:github-jr:233405` | `sha256:78f18feac48fff42940859159f17552a27e53129ab8e853206d8ae8bdb5fb808` | `d6c903e8c531bf2b3b6e0ef39a2b1c436bed6aa5c21db056bc6f1f82bedace45` |

Every pair is explicitly enumerated in the canonical JSON. No ingredient-wide, fuzzy, brand-derived, component-only, suspension, injection, topical, combination, or other unlisted product match is approved.

Excluded, missing, ambiguous, stale, drifted, or otherwise unlisted products remain `not_evaluated_or_unresolved`; they must never be rendered as safe or no interaction.

## Clinical content

Severity: `major` — clinically important and requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe.

Mechanism: Voriconazole inhibits CYP2C9 and can significantly increase prothrombin time and warfarin anticoagulant effect.

Dispensing action: `confirm_and_monitor`

Prescriber action: For current or intended concurrent oral voriconazole exposure, confirm that the prescriber or anticoagulation service has reviewed the warfarin dose and established the PT/INR plan. Do not independently stop either medicine, autonomously change the warfarin dose, or mandate substitution to another antifungal.

Monitoring: Use prescriber-directed close-interval PT/INR monitoring during coadministration. The specific timing and duration are individualized; follow-up after discontinuation is clinician-managed outside the current checker.

Patient counselling: Counsel the patient to seek urgent clinical advice for unusual bleeding or bruising, prolonged bleeding, blood in urine, or red or tarry-black stools.

Exclusions and exceptions: This review scope is limited to the exact oral-tablet product assertion. Intravenous and other voriconazole presentations are outside the proposed product scope.

## Evidence boundary

| Jurisdiction | Document | Version | Payload SHA-256 |
|---|---|---|---|
| US | `openfda-labels:67c174da-41b8-4738-8a22-dd814b8e96b8` | `27` | `482ea96d744a36285c329e6ed88a69bbe8fcc9460b2f23921f3476f4969f02ae` |
| US | `openfda-labels:51e98fb6-ba76-497e-95d8-fe895ef0b7ed` | `7` | `bcb1e6db5ac6619c0c93ede9f0c689dfd8ffdff4f187067335c243046b5d3e04` |

Evidence jurisdiction: `US`

Product catalogue: `github-jr`

Product market: `India`

Deployment jurisdiction: `none`

Scope note: The evidence supports the active-ingredient interaction during systemic exposure; the approved product scope is limited to the exact enumerated oral-tablet assertion and excludes intravenous and other presentations.

The evidence jurisdiction is the United States. It is not an Indian regulatory-label claim. Run the rule-scoped live verification command in the sign-off checklist immediately before signing; drift in a cited document blocks that subject.

## Workflow and validity boundary

The current checker supports only current or intended concurrent exposure. It does not automatically detect discontinuation, dose change, or recent exposure. Medication-lifecycle follow-up remains with the prescriber or anticoagulation service outside this checker.

An authenticated approval expires exactly 180 days after its `reviewed_at_utc` timestamp and may invalidate earlier under the canonical conditions. Expiry requires a new reviewed subject and authenticated approval event; it never extends automatically.

## Authority boundary

This pending record grants no runtime, publication, production, deployment, or clinical-use authority. The catalogue source-rights status remains `pending_separate_owner_legal_release_decision`; clinical signature does not clear it. Production-open remains empty until separate post-signature mapping, promotion, source-rights, compiler, and release gates pass.

## How to sign

Do not edit the canonical subject or this statement. Create a new immutable event from the adjacent template, record `APPROVED` or `REJECTED`, the UTC review time, the repository HEAD reviewed, and authenticated event evidence, then sign that new event through the authorized workflow. Never turn the template itself into an event.
