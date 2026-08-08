# warfarin × fluconazole — clinician approval record

Package status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

Approval status: **PENDING — no authenticated approval event exists**

Reviewer identity: `clinician:subas`

Approval subject JCS SHA-256: `76db6061b232779da3a9af1a29619a895a4002c7a4d936a6605b6f3503e04f2b`

The canonical authority subject is the adjacent `warfarin-fluconazole.approval-subject.json`. This Markdown is its human-readable review record. A signature applies only to the exact canonical subject hash above.

## Exact approval statement

I approve the warfarin-fluconazole clinical rule content and exact product scope for production-open review, limited to the seven enumerated open-catalogue oral-tablet assertions and 12 exact product pairs (Faze 50 mg dispersible, 150 mg, 200 mg, and 400 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. The alert must require prescriber or anticoagulation-service warfarin dose review and PT/INR monitoring when fluconazole is started or stopped; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling and state that enzyme inhibition can persist 4 to 5 days after discontinuation without inventing a universal PT/INR schedule or a single-dose exception. Keep the unsupported Child-Pugh modifier removed, treat the evidence as U.S.-label support rather than an Indian regulatory-label claim, and keep declared coverage partial. This clinical signature does not clear the pending github-jr source-rights gate and grants no runtime, publication, production, deployment, or clinical-use authority. Reviewer ID: clinician:subas

## Exact product scope

Route: `oral`

Formulation: `tablet`

Exact product assertions: `7`

Exact product pairs: `12`

| Role | Product | Manufacturer | Pack | Source identity | Product ID | Assertion SHA-256 |
|---|---|---|---|---|---|---|
| Object | Warf 1 Tablet | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241490` | `sha256:75ff289ed3f39da43c77f97e8ff24ebc8f36636bad7879c25bad180cca8bd3e5` | `8085504e2d8f147581025560310a71b943a33f792ed8d56dac1f71043326f34c` |
| Object | Warf 2 Tablet | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241458` | `sha256:2c013c09d6880da492e3faefa06db996f9fc7bf9920751009b261f95c9ad3445` | `c1dcadfbfabb21f57e8deface7a90323f15b0e7946fe2265de245f7efdab0469` |
| Object | Warf 5 Tablet | Cipla Ltd | strip of 30 tablets | `presentation:github-jr:241434` | `sha256:47bd772d5427882a321df9cc9f1cb5187c4b7e5476ea8cd6b4267bdc5f9d2c61` | `a8877c57f2158b4c40fa19a69aeab393bb4fb3d0cb9b699a83d70454d0820d26` |
| Perpetrator | Faze 50mg Tablet DT | Megha Healthcare Pvt Ltd | strip of 10 tablet dt | `presentation:github-jr:85808` | `sha256:2477c63ab7660346267abca33ba26fc4c72957e856fed56c7696193e4f5c6a31` | `e1128e2da73efefb283a21628393ee8802736bfc3af6ba5b1df363be6619eae7` |
| Perpetrator | Faze 150 Tablet | Megha Healthcare Pvt Ltd | strip of 1 Tablet | `presentation:github-jr:84732` | `sha256:7443b4093ef29b4b6f621780c7cd43be46506e5632b6d0ae28fc03fc5bdeae98` | `9f186a8cad46b5dc934f3d9c54dacefcbab5d7e58bf623a2c3484090512e12dc` |
| Perpetrator | Faze 200mg Tablet | Megha Healthcare Pvt Ltd | strip of 1 Tablet | `presentation:github-jr:84894` | `sha256:9a1c4698258e377490593db50e2abecaee7c9f29a4b9645500b182cc336dc9ae` | `0bf426a31998bb880ab162a5c46dc9d5e78af61df615c341ce859f271e7443f1` |
| Perpetrator | Faze 400mg Tablet | Megha Healthcare Pvt Ltd | strip of 1 Tablet | `presentation:github-jr:85708` | `sha256:33820ca70d3fb5c81f60242e3f1c9263400827af9056e394a917e7473046c81a` | `56e8f6931e21ff4b7644916225f54fd54a33fd7590ab9bd4e74a89dcd8367356` |

Every pair is explicitly enumerated in the canonical JSON. No ingredient-wide, fuzzy, brand-derived, component-only, suspension, injection, topical, combination, or other unlisted product match is approved.

## Clinical content

Severity: `major` — clinically important and requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe.

Mechanism: Fluconazole inhibits CYP2C9 and CYP3A4 and can increase warfarin anticoagulant effect, PT/INR, and bleeding risk.

Dispensing action: `confirm_and_monitor`

Prescriber action: Confirm that the prescriber or anticoagulation service has reviewed the warfarin dose and arranged PT/INR monitoring when oral fluconazole is started or stopped. Do not independently stop either medicine or autonomously change the warfarin dose.

Monitoring: Use prescriber-directed PT/INR monitoring during coadministration and after fluconazole discontinuation.

Patient counselling: Counsel the patient to seek urgent clinical advice for unusual bleeding or bruising, prolonged bleeding, blood in urine, or red or tarry-black stools.

Duration boundary: The enzyme-inhibiting effect of fluconazole can persist for 4 to 5 days after discontinuation; the labels do not prescribe a universal PT/INR schedule for that interval.

Exclusions and exceptions: This review scope is limited to exact oral-tablet product assertions. Intravenous fluconazole may be source-relevant but is outside the proposed product scope. The labels do not establish a single-dose exception.

## Evidence boundary

| Jurisdiction | Document | Version | Payload SHA-256 |
|---|---|---|---|
| US | `openfda-labels:f694c617-3383-416c-91b6-b94fda371204` | `57` | `ff8cbc0726257ccfd11021bb489b0cf0bb417351b66ab35dcb6fb44a4290690c` |
| US | `openfda-labels:51e98fb6-ba76-497e-95d8-fe895ef0b7ed` | `7` | `bcb1e6db5ac6619c0c93ede9f0c689dfd8ffdff4f187067335c243046b5d3e04` |

The evidence jurisdiction is the United States. It is not an Indian regulatory-label claim. Run the rule-scoped live verification command in the sign-off checklist immediately before signing; drift in a cited document blocks that subject.

## Authority boundary

This pending record grants no runtime, publication, production, deployment, or clinical-use authority. The catalogue source-rights status remains `pending_separate_owner_legal_release_decision`; clinical signature does not clear it. Production-open remains empty until separate post-signature mapping, promotion, source-rights, compiler, and release gates pass.

## How to sign

Do not edit the canonical subject or this statement. Create a new immutable event from the adjacent template, record `APPROVED` or `REJECTED`, the UTC review time, the repository HEAD reviewed, and authenticated event evidence, then sign that new event through the authorized workflow. Never turn the template itself into an event.
