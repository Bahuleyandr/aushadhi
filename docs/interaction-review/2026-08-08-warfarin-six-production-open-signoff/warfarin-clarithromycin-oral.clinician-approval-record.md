# warfarin × clarithromycin oral — clinician approval record

Package status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

Approval status: **PENDING — no authenticated approval event exists**

Reviewer identity: `clinician:subas`

Approval subject JCS SHA-256: `138451759519a69975dd4d27d56ea0745d43cdeb322f821cffd984a8f40c3427`

The canonical authority subject is the adjacent `warfarin-clarithromycin-oral.approval-subject.json`. This Markdown is its human-readable review record. A signature applies only to the exact canonical subject hash above.

## Exact approval statement

I approve the warfarin-clarithromycin clinical rule content and exact product scope for production-open review, limited to the four enumerated github-jr oral-tablet assertions and 3 exact product pairs (Claribid 250 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. For current or intended concurrent exposure, the prescriber or anticoagulation service must direct whether warfarin dose adjustment is needed and establish prescriber-directed frequent PT/INR monitoring; the pharmacy must not change a dose or stop either medicine independently. Include bleeding-symptom counselling. Exclude clarithromycin 500 mg, erythromycin and other macrolides, combipacks, suspensions, injections, and all unreviewed presentations. Do not invent a universal monitoring schedule or fixed post-discontinuation interval. Treat the evidence as a U.S.-label statement rather than an Indian regulatory claim, and keep declared coverage partial. The current checker evaluates only current or intended concurrent exposure; it does not automatically detect discontinuation, dose-change, or recent-exposure events, so medication-lifecycle follow-up remains with the prescriber or anticoagulation service outside this checker. This approval expires 180 days after the authenticated reviewed_at_utc timestamp and may invalidate earlier under the listed conditions. This clinical signature does not clear the pending github-jr source-rights gate and grants no runtime, publication, production, deployment, or clinical-use authority. Reviewer ID: clinician:subas

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
| Perpetrator | Claribid 250 Tablet | clarithromycin | 250 mg | oral | tablet | not asserted | Abbott | strip of 10 tablets | `presentation:github-jr:34020` | `sha256:7946bbb13a9d266e6e49ab1f14ecbeb729c27a460a213abc5d63fd6e4c0e1215` | `3959539d3d591878278179c26c673333a98d56c7cf64b3d9d447254bd5705994` |

Every pair is explicitly enumerated in the canonical JSON. No ingredient-wide, fuzzy, brand-derived, component-only, suspension, injection, topical, combination, or other unlisted product match is approved.

Excluded, missing, ambiguous, stale, drifted, or otherwise unlisted products remain `not_evaluated_or_unresolved`; they must never be rendered as safe or no interaction.

## Clinical content

Severity: `major` — clinically important and requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe.

Mechanism: Clarithromycin inhibits CYP3A and the US clarithromycin label reports postmarketing potentiation of oral anticoagulant effects, so concomitant use can raise anticoagulant effect and bleeding risk. The magnitude and time course in an individual patient are not established by this source.

Dispensing action: `confirm_and_monitor`

Prescriber action: For current or intended concurrent oral clarithromycin exposure, confirm that the prescriber or anticoagulation service has established the PT/INR plan and will decide whether warfarin dose adjustment is needed. Do not independently change a dose or stop either medicine.

Monitoring: Use prescriber-directed frequent PT/INR monitoring during concomitant oral clarithromycin use; no universal schedule or fixed post-discontinuation interval is asserted.

Patient counselling: Counsel the patient to seek urgent clinical advice for unusual bleeding or bruising, prolonged bleeding, blood in urine, or red or tarry-black stools.

Exclusions and exceptions: This review scope is limited to the exact enumerated github-jr oral-tablet assertion. Clarithromycin 500 mg, erythromycin and every other macrolide, combipacks, suspensions, injections, and every other unreviewed or non-tablet presentation are excluded. Azithromycin is handled by the separate rule warfarin__azithromycin_oral.

## Evidence boundary

| Jurisdiction | Document | Version | Payload SHA-256 |
|---|---|---|---|
| US | `openfda-labels:b98b02bb-2609-49a0-b29f-e5911aa0cbc1` | `23` | `5268af02e66c314a67f9f9037d996024e4dbddedbdf1e378b964f834eef5dfea` |

Evidence jurisdiction: `US`

Product catalogue: `github-jr`

Product market: `India`

Deployment jurisdiction: `none`

Scope note: The U.S. clarithromycin label supports the active-ingredient interaction during concomitant systemic-oral use. It does not establish an automatic course-end trigger, a universal monitoring schedule, or a fixed post-discontinuation interval.

The evidence jurisdiction is the United States. It is not an Indian regulatory-label claim. Run the rule-scoped live verification command in the sign-off checklist immediately before signing; drift in a cited document blocks that subject.

## Workflow and validity boundary

The current checker supports only current or intended concurrent exposure. It does not automatically detect discontinuation, dose change, or recent exposure. Medication-lifecycle follow-up remains with the prescriber or anticoagulation service outside this checker.

An authenticated approval expires exactly 180 days after its `reviewed_at_utc` timestamp and may invalidate earlier under the canonical conditions. Expiry requires a new reviewed subject and authenticated approval event; it never extends automatically.

## Authority boundary

This pending record grants no runtime, publication, production, deployment, or clinical-use authority. The catalogue source-rights status remains `pending_separate_owner_legal_release_decision`; clinical signature does not clear it. Production-open remains empty until separate post-signature mapping, promotion, source-rights, compiler, and release gates pass.

## How to sign

Do not edit the canonical subject or this statement. Create a new immutable event from the adjacent template, record `APPROVED` or `REJECTED`, the UTC review time, the repository HEAD reviewed, and authenticated event evidence, then sign that new event through the authorized workflow. Never turn the template itself into an event.
