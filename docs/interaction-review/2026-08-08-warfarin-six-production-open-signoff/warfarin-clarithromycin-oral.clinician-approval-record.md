# warfarin × clarithromycin oral — clinician approval record

Package status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

Approval status: **PENDING — no authenticated approval event exists**

Reviewer identity: `clinician:subas`

Approval subject JCS SHA-256: `c923a892b79246cb022f47fdbaa78312b6bf0c0985a97cdeb232b0604becee60`

The canonical authority subject is the adjacent `warfarin-clarithromycin-oral.approval-subject.json`. This Markdown is its human-readable review record. A signature applies only to the exact canonical subject hash above.

## Exact approval statement

I approve the warfarin-clarithromycin clinical rule content and exact product scope for production-open review, limited to the four enumerated open-catalogue oral-tablet assertions and 3 exact product pairs (Claribid 250 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. The prescriber or anticoagulation service must direct whether warfarin dose adjustment is needed and arrange PT/INR monitoring during concomitant use, with a clinician-directed follow-up decision when the course ends; the pharmacy must not change a dose or stop either medicine independently. Include bleeding-symptom counselling. Exclude 500 mg clarithromycin, erythromycin and other macrolides, combipacks, suspensions, injections, and all unreviewed presentations. Do not invent a universal monitoring schedule or fixed post-discontinuation interval. Treat the evidence as a U.S.-label statement rather than an Indian regulatory claim, and keep declared coverage partial. This clinical signature does not clear the pending github-jr source-rights gate and grants no runtime, publication, production, deployment, or clinical-use authority. Reviewer ID: clinician:subas

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
| Perpetrator | Claribid 250 Tablet | Abbott | strip of 10 tablets | `presentation:github-jr:34020` | `sha256:7946bbb13a9d266e6e49ab1f14ecbeb729c27a460a213abc5d63fd6e4c0e1215` | `3959539d3d591878278179c26c673333a98d56c7cf64b3d9d447254bd5705994` |

Every pair is explicitly enumerated in the canonical JSON. No ingredient-wide, fuzzy, brand-derived, component-only, suspension, injection, topical, combination, or other unlisted product match is approved.

## Clinical content

Severity: `major` — clinically important and requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe.

Mechanism: Clarithromycin inhibits CYP3A and the US clarithromycin label reports postmarketing potentiation of oral anticoagulant effects, so concomitant use can raise anticoagulant effect and bleeding risk. The magnitude and time course in an individual patient are not established by this source.

Dispensing action: `confirm_and_monitor`

Prescriber action: Confirm that the prescriber or anticoagulation service has arranged a PT/INR monitoring plan during concomitant oral clarithromycin use and will decide whether follow-up is needed when the course ends. Do not independently change a dose or stop either medicine.

Monitoring: Use prescriber-directed PT/INR monitoring during concomitant use; no universal schedule or fixed post-discontinuation interval is asserted.

Patient counselling: Counsel the patient to seek urgent clinical advice for unusual bleeding or bruising, prolonged bleeding, blood in urine, or red or tarry-black stools.

Exclusions and exceptions: This review scope is limited to exact reviewed PMBJP oral-tablet assertions. Erythromycin and every other macrolide are excluded; azithromycin is handled by the separate rule warfarin__azithromycin_oral. The H. pylori combipack (PMBJP code 2097) resolves to a distinct catalogue ingredient identity and is excluded. The 500 mg assertion (PMBJP code 380) is excluded pending official tender evidence and immediate-release disambiguation, because RxNorm exposes both an immediate-release and a 24 HR extended-release 500 mg oral tablet concept. Oral suspensions, injections and every other unreviewed or non-tablet presentation are excluded.

## Evidence boundary

| Jurisdiction | Document | Version | Payload SHA-256 |
|---|---|---|---|
| US | `openfda-labels:b98b02bb-2609-49a0-b29f-e5911aa0cbc1` | `23` | `5268af02e66c314a67f9f9037d996024e4dbddedbdf1e378b964f834eef5dfea` |

The evidence jurisdiction is the United States. It is not an Indian regulatory-label claim. Run the rule-scoped live verification command in the sign-off checklist immediately before signing; drift in a cited document blocks that subject.

## Authority boundary

This pending record grants no runtime, publication, production, deployment, or clinical-use authority. The catalogue source-rights status remains `pending_separate_owner_legal_release_decision`; clinical signature does not clear it. Production-open remains empty until separate post-signature mapping, promotion, source-rights, compiler, and release gates pass.

## How to sign

Do not edit the canonical subject or this statement. Create a new immutable event from the adjacent template, record `APPROVED` or `REJECTED`, the UTC review time, the repository HEAD reviewed, and authenticated event evidence, then sign that new event through the authorized workflow. Never turn the template itself into an event.
