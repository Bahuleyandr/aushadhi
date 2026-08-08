# warfarin × amiodarone — clinician approval record

Package status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

Approval status: **PENDING — no authenticated approval event exists**

Reviewer identity: `clinician:subas`

Approval subject JCS SHA-256: `7d09dd9e4c16518720ff782659bca39ec60caa49959f00ed97a6c3b6bb367a19`

The canonical authority subject is the adjacent `warfarin-amiodarone.approval-subject.json`. This Markdown is its human-readable review record. A signature applies only to the exact canonical subject hash above.

## Exact approval statement

I approve the warfarin-amiodarone clinical rule content and exact product scope for production-open review, limited to the five enumerated open-catalogue oral-tablet assertions and 6 exact product pairs (Warf 1 mg, 2 mg, and 5 mg crossed with Tachyra 100 mg and 200 mg), as major severity with confirm-and-monitor management. For current or intended concurrent exposure, the alert must require prescriber or anticoagulation-service warfarin dose review and PT/INR monitoring; it must not direct the pharmacy to change a dose or stop either medicine independently and must not encode a universal dose reduction. The cited U.S. label's numerical dose-reduction recommendation is prescriber-facing evidence only. Include bleeding-symptom counselling and exclude intravenous amiodarone and every other unreviewed presentation. State only that general amiodarone-related drug-interaction effects may persist for weeks to months after discontinuation; do not assert a fixed warfarin-specific duration or universal PT/INR schedule. Keep the unsupported Child-Pugh modifier removed, treat the evidence as U.S.-label support rather than an Indian regulatory-label claim, and keep declared coverage partial. The current checker evaluates only current or intended concurrent exposure; it does not automatically detect discontinuation, dose-change, or recent-exposure events, so medication-lifecycle follow-up remains with the prescriber or anticoagulation service outside this checker. This approval expires 180 days after the authenticated reviewed_at_utc timestamp and may invalidate earlier under the listed conditions. This clinical signature does not clear the pending github-jr source-rights gate and grants no runtime, publication, production, deployment, or clinical-use authority. Reviewer ID: clinician:subas

## Exact product scope

Route: `oral`

Formulation: `tablet`

Exact product assertions: `5`

Exact product pairs: `6`

Catalogue artifact: `data/interaction/production-open/product-catalogue/drugs.jsonl`

Catalogue artifact SHA-256: `b2186efe0c7483a7b10e57f02ec9d555a012bed40d8a26e3ed72c1249a1454e2`

Committed source-binding capture: `docs/interaction-review/2026-08-08-warfarin-six-production-open-signoff/product-catalogue-binding-evidence.jsonl`

Source-binding capture SHA-256: `b329903e8c3b65b6b39868b58e8ddd54678f948657695b33fa707a1c4abad822`

| Role | Product | Normalized ingredient | Strength | Route | Formulation | Release profile | Manufacturer | Pack | Source identity | Product ID | Assertion SHA-256 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Object | Warf 1 Tablet | warfarin | 1 mg | oral | tablet | not asserted | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241490` | `sha256:75ff289ed3f39da43c77f97e8ff24ebc8f36636bad7879c25bad180cca8bd3e5` | `8085504e2d8f147581025560310a71b943a33f792ed8d56dac1f71043326f34c` |
| Object | Warf 2 Tablet | warfarin | 2 mg | oral | tablet | not asserted | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241458` | `sha256:2c013c09d6880da492e3faefa06db996f9fc7bf9920751009b261f95c9ad3445` | `c1dcadfbfabb21f57e8deface7a90323f15b0e7946fe2265de245f7efdab0469` |
| Object | Warf 5 Tablet | warfarin | 5 mg | oral | tablet | not asserted | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241434` | `sha256:47bd772d5427882a321df9cc9f1cb5187c4b7e5476ea8cd6b4267bdc5f9d2c61` | `a8877c57f2158b4c40fa19a69aeab393bb4fb3d0cb9b699a83d70454d0820d26` |
| Perpetrator | Tachyra 100 Tablet | amiodarone | 100 mg | oral | tablet | not asserted | Cipla Ltd | strip of 10 tablets | `presentation:github-jr:215526` | `sha256:996500ee7b3ed804cedc85d6c91add1f32724927c129113b83dcd1b857c7850d` | `e714fd7ca1fa36c08dc1c3b4514a6c9d4f222a5e053766ed71e0c728736f91c9` |
| Perpetrator | Tachyra 200 Tablet | amiodarone | 200 mg | oral | tablet | not asserted | Cipla Ltd | strip of 10 tablets | `presentation:github-jr:215566` | `sha256:4aa0b05104cde787b3fb864b024224e8827df25a6058c50863aaa25ef7270fff` | `7e16ec6ba5a9563f9b0d562fba22debd0f7d8b867f2655a4c9faa74cfd2de9d4` |

Every pair is explicitly enumerated in the canonical JSON. No ingredient-wide, fuzzy, brand-derived, component-only, suspension, injection, topical, combination, or other unlisted product match is approved.

Excluded, missing, ambiguous, stale, drifted, or otherwise unlisted products remain `not_evaluated_or_unresolved`; they must never be rendered as safe or no interaction.

## Clinical content

Severity: `major` — clinically important and requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe.

Mechanism: Amiodarone potentiates warfarin's anticoagulant response, increasing PT/INR and the risk of serious or fatal bleeding.

Dispensing action: `confirm_and_monitor`

Prescriber action: For current or intended concurrent oral amiodarone exposure, confirm that the prescriber or anticoagulation service has reviewed the warfarin dose and established the PT/INR plan. Do not independently stop either medicine or autonomously change the warfarin dose.

Monitoring: Use prescriber-directed PT/INR monitoring during coadministration. Follow-up after discontinuation or dose change is clinician-managed outside the current checker.

Patient counselling: Counsel the patient to seek urgent clinical advice for unusual bleeding or bruising, prolonged bleeding, blood in urine, or red or tarry-black stools.

Duration boundary: General amiodarone-related drug-interaction effects may persist for weeks to months after discontinuation; no fixed warfarin-specific duration or universal PT/INR schedule is asserted.

Exclusions and exceptions: The U.S. amiodarone label's numerical warfarin dose-reduction instruction is prescriber-facing evidence only and is not an autonomous pharmacy action or a universal dose-reduction rule. Intravenous amiodarone and every other unreviewed presentation are outside this oral-tablet subject.

## Evidence boundary

| Jurisdiction | Document | Version | Payload SHA-256 |
|---|---|---|---|
| US | `openfda-labels:f49d011f-5ca6-4f75-ba16-2099fe42f5aa` | `2` | `efe97f1d109d8a6f98ed8d48f98aa024ea7b69057e50534128aa2d4870ee46be` |
| US | `openfda-labels:51e98fb6-ba76-497e-95d8-fe895ef0b7ed` | `7` | `bcb1e6db5ac6619c0c93ede9f0c689dfd8ffdff4f187067335c243046b5d3e04` |

Evidence jurisdiction: `US`

Product catalogue: `github-jr`

Product market: `India`

Deployment jurisdiction: `none`

Scope note: The evidence directly supports the active-ingredient interaction and systemic-oral use represented by the exact enumerated amiodarone tablet products; it does not establish a fixed warfarin-specific persistence interval.

The evidence jurisdiction is the United States. It is not an Indian regulatory-label claim. Run the rule-scoped live verification command in the sign-off checklist immediately before signing; drift in a cited document blocks that subject.

## Workflow and validity boundary

The current checker supports only current or intended concurrent exposure. It does not automatically detect discontinuation, dose change, or recent exposure. Medication-lifecycle follow-up remains with the prescriber or anticoagulation service outside this checker.

An authenticated approval expires exactly 180 days after its `reviewed_at_utc` timestamp and may invalidate earlier under the canonical conditions. Expiry requires a new reviewed subject and authenticated approval event; it never extends automatically.

## Authority boundary

This pending record grants no runtime, publication, production, deployment, or clinical-use authority. The catalogue source-rights status remains `pending_separate_owner_legal_release_decision`; clinical signature does not clear it. Production-open remains empty until separate post-signature mapping, promotion, source-rights, compiler, and release gates pass.

## How to sign

Do not edit the canonical subject or this statement. Create a new immutable event from the adjacent template, record `APPROVED` or `REJECTED`, the UTC review time, the repository HEAD reviewed, and authenticated event evidence, then sign that new event through the authorized workflow. Never turn the template itself into an event.
