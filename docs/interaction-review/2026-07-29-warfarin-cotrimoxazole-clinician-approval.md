# Warfarin–co-trimoxazole — clinician approval record (DRAFT FOR SIGN-OFF)

**Prepared:** 2026-07-29<br>
**Requested reviewer:** `clinician:subas`<br>
**Decision:** **PENDING — NOT APPROVED**<br>
**Release profile:** `internal-evaluation` only<br>
**Production-open:** disabled; 0 rules<br>
**Clinical promotion authority:** none until explicit sign-off<br>
**Deployment authority:** none<br>
**Repository base:** `80d06815f222e739ca055239c9f92b7b57ebd502`

> Creating, committing, or merging this draft does not approve the clinical rule.
> The rule and its promotion must remain absent until `clinician:subas` explicitly
> approves the exact scope, clinical text, and workflow boundary below.

## 1 · Decision requested

The remaining decision is whether to approve one internal-evaluation clinical rule:

```text
rule_id          warfarin__cotrimoxazole
severity         major
dispense_action  confirm_and_monitor
scope            6 exact oral-tablet product pairs
jurisdiction     US evidence
production-open  disabled
```

If every statement in this packet is acceptable, the requested exact approval response is:

> I approve the warfarin–co-trimoxazole clinical rule for internal evaluation only,
> limited to the six exact PMBJP oral-tablet product pairs recorded in the
> 2026-07-29 approval packet, as major severity with confirm-and-monitor management.
> I approve the exact proposed mechanism and management text in section 3.
> The prescriber or anticoagulation service must direct warfarin review and arrange
> patient-specific PT/INR monitoring; the pharmacy must not change a dose or stop
> either medicine independently. No universal monitoring schedule or fixed
> post-discontinuation interval is approved. Remove the unsupported Child-Pugh B
> modifier and the existing draft's unsupported exposure, INR, elderly-risk,
> alternative-antibiotic, and fixed-timing claims. Treat the evidence as support
> from a U.S. sulfamethoxazole/trimethoprim label, not as an Indian regulatory-label
> claim. The fixed-dose-combination subject supplements component subjects, no
> current rule is superseded, and production-open remains empty.
> Reviewer ID: clinician:subas

Approval applies only to the reconciled rule specified in this packet. It does **not**
approve the current batch-01-v2 row verbatim.

## 2 · Exact scope — six product pairs

Only these six cross-product pairs are proposed:

| Co-trimoxazole oral tablet | Warfarin oral tablet |
|---|---|
| PMBJP **89** — sulfamethoxazole 800 mg / trimethoprim 160 mg | PMBJP **2141** — warfarin 1 mg |
| PMBJP **89** — sulfamethoxazole 800 mg / trimethoprim 160 mg | PMBJP **2142** — warfarin 2 mg |
| PMBJP **89** — sulfamethoxazole 800 mg / trimethoprim 160 mg | PMBJP **452** — warfarin 5 mg |
| PMBJP **90** — sulfamethoxazole 100 mg / trimethoprim 20 mg | PMBJP **2141** — warfarin 1 mg |
| PMBJP **90** — sulfamethoxazole 100 mg / trimethoprim 20 mg | PMBJP **2142** — warfarin 2 mg |
| PMBJP **90** — sulfamethoxazole 100 mg / trimethoprim 20 mg | PMBJP **452** — warfarin 5 mg |

This is not an ingredient-wide, brand-wide, route-wide, or formulation-inferred
approval. Both products must resolve through their exact reviewed product assertions.

## 3 · Proposed clinical text

The proposed runtime mechanism text is:

> Sulfamethoxazole inhibits CYP2C9. The cited U.S.
> sulfamethoxazole/trimethoprim label reports that the combination may prolong
> prothrombin time in patients receiving warfarin and directs that coagulation time
> be reassessed.

The proposed runtime management text is:

> Before dispensing, confirm that the prescriber or anticoagulation service has
> reviewed the concomitant oral co-trimoxazole course and arranged a patient-specific
> PT/INR monitoring plan. That clinician directs any warfarin review or adjustment
> and decides whether follow-up is needed when the antibiotic course ends. The
> pharmacy must not change a dose or stop either medicine independently. Counsel the
> patient to seek prompt clinical advice for bleeding symptoms and not to stop
> warfarin without clinical advice. No universal monitoring schedule or fixed
> post-discontinuation interval is asserted.

The first paragraph is a bounded summary of the cited U.S. label. The severity
`major`, dispensing action `confirm_and_monitor`, PT/INR workflow, pharmacy boundary,
and patient counselling are proposed local clinical-workflow mappings. The source
does not assign those local runtime values by itself.

## 4 · Required reconciliation of the attested draft

The current non-authorizing row in
`docs/interaction-review/batch-01-v2/batch-01-v2.jsonl` has SHA-256
`cfc5c958f5cb939353716b324669906fd5043a1a605ff1d776549299d018004e`.
It must be replaced before promotion because it is broader than the proposed
approval.

The implementation after sign-off must:

- restrict both sides and applicability to the exact reviewed oral tablets;
- remove the broad `systemic` route and empty formulation scope;
- exclude suspension, intravenous, and every other unreviewed presentation;
- replace the unsupported claim that exposure and INR rise, including the
  elderly-risk wording, with the exact mechanism text in section 3;
- remove the instruction to choose an alternative antibiotic;
- remove `intensive` monitoring and the fixed `after start and after stop` timing;
- remove the unsupported Child-Pugh B modifier and its management override;
- preserve the prescriber/anticoagulation-service and pharmacy boundaries in
  section 3; and
- retain U.S. jurisdiction without presenting the evidence as an Indian
  regulatory-label claim.

The reconciled JSONL row will receive a new SHA-256. The promotion manifest must pin
that new hash; it must not pin the current row hash above.

## 5 · Exact identity and presentation bindings

### Fixed-dose combination

```text
combination_id    combination:co-trimoxazole:rxnorm-10831
RxNorm identity   10831, MIN, sulfamethoxazole / trimethoprim
components        10180 sulfamethoxazole, IN
                  10829 trimethoprim, IN
component match   exact_active_set
route/formulation oral tablet
profile           internal-evaluation only
```

`MIN` remains prohibited in the single-ingredient IN/PIN mapping manifest. This rule
uses the separately reviewed product-level fixed-dose-combination path.

| PMBJP code | RxNorm SCD | Product ID | Product assertion SHA-256 |
|---|---:|---|---|
| 89 | 198335 | `sha256:f3835b624129e57ede72edc56a6106782aa9df2e6f5491ebd09bd0ac9656e03a` | `91dea78c9c4194164d7dcd131472f801478c0a2268557aae03662fcbb64b7446` |
| 90 | 142118 | `sha256:1b8857c5423094122e608d865db146fa2ffc7e434df540a2b0cf8bd821d33521` | `9f5eb20bf581a8e78decb7adcaa66e532e2098748ba8bc27a63a3483f90b0547` |

### Warfarin

Ingredient mapping: `ingredient:warfarin:rxnorm-11289`.

| PMBJP code | Presentation mapping | Product ID | Product assertion SHA-256 |
|---|---|---|---|
| 2141 | `presentation:pmbjp:2141:oral-tablet` | `sha256:d5c2e164ff5144544a122908b964b144e2132b9ff216a66bb3a57b80b944ffca` | `ed9ac49f1fe53f1f4c720641ad5e1bee54ed362e69e4357f36ffeab9022e76cb` |
| 2142 | `presentation:pmbjp:2142:oral-tablet` | `sha256:9570b79daed31dd5271ec2021558be191fddfe4e3d1002e66a3383dc1a309548` | `13e88c7899c9974b4fd1378a47b2b09fa3045199460a02f7b7df6a7cb787e6a5` |
| 452 | `presentation:pmbjp:452:oral-tablet` | `sha256:a543d303907ce3804debf1784653e97b30ef00f4eebb040d8e89fbfbbfbf4141` | `7aaa9f346fd2bb665c97551bcfd57bc6c088b5dcb91019769360364014f48b01` |

## 6 · Evidence boundary

### Clinical interaction evidence

```text
source policy      openfda-labels
set_id             7f82e5e0-b627-a3f3-e053-2991aa0abaa5
SPL version        6
effective_time     20260209
jurisdiction       US
source version     openfda-labels:7f82e5e0-b627-a3f3-e053-2991aa0abaa5:6
payload SHA-256    63dfc42563d6fb406df816f4d801878e9a33bae39cdae3abb01ffe0e0dbb706e
```

Two exact source fragments are already captured and hash-stable:

- `c0fb47f494a1a43f71d48d9298a92854e3e9c0de8ec40cd99e032dd3e23b3d02`
  — sulfamethoxazole is identified as a CYP2C9 inhibitor;
- `ab592d24f03eaccf6fcc91f344da320fa27b38226884ae501853bbcd07b62a25`
  — the label reports possible prothrombin-time prolongation with warfarin and
  directs reassessment of coagulation time.

This evidence supports the existence and bounded description of the interaction in
the U.S. label. It does not independently authorize local severity, dispensing
workflow, monitoring cadence, a post-discontinuation interval, or promotion.

### Identity evidence

```text
RxNorm evidence bundle
  path             data-static/combination-rxnorm-evidence/
                   combination_co-trimoxazole_rxnorm-10831.json
  Git-blob SHA-256 be734f07cceffad4f8309008a9d4df994f8141cef24b842b8d3797dea0758cbb
  release          06-Jul-2026
  API version      3.1.354
  authority        identity_only

Combination identity manifest
  path             data-static/combination-identity-overrides.json
  Git-blob SHA-256 a0813b2a4d80198c6793d6e576b41847da31415f51a68ee75c744a8656223466

Official PMBJP product list
  PDF SHA-256      f54a140d9dc82880dcbb7672c18942417e8c9fe904376c742b6319665cdf9a08
```

The Git-blob label is deliberate: it identifies the committed LF-normalized bytes
and avoids a false mismatch caused by Windows working-tree line-ending conversion.

## 7 · Explicit exclusions and non-claims

The proposed approval excludes:

- PMBJP **88** co-trimoxazole oral suspension;
- intravenous co-trimoxazole;
- every non-tablet, non-oral, ambiguous, stale, drifted, or unreviewed presentation;
- every co-trimoxazole product other than the exact PMBJP 89 and 90 assertions above;
- fuzzy or component-only inheritance of the combination rule;
- an independently inferred `systemic` presentation;
- the unsupported Child-Pugh B modifier;
- an instruction for the pharmacy to choose a different antibiotic, change a dose,
  or stop either medicine;
- a universal PT/INR schedule or fixed follow-up interval; and
- any claim that U.S. evidence is an Indian regulatory-label statement.

A blank checker result does not establish safety. Missing, stale, ambiguous, or
drifted mappings must continue to fail closed.

## 8 · Proposed promotion and supersession contract

After explicit approval and draft-row reconciliation, the proposed promotion must use
promotion-manifest schema version 2, compile an output pack at schema version 1.1.0,
and preserve this exact boundary:

```text
promotion manifest schema   2
output pack schema           1.1.0
profile                      internal-evaluation
object binding              ingredient:warfarin:rxnorm-11289
object presentations        PMBJP 2141, 2142, 452
perpetrator binding kind    combination_identity
combination                 combination:co-trimoxazole:rxnorm-10831
combination presentations   PMBJP 89, 90 product IDs
route                       oral
formulation                 tablet
expected product pairs      6
interaction family          warfarin-anticoagulation-potentiation
subject specificity         exact_fixed_dose_combination
supersedes_rule_ids         []
```

The combination subject supplements component subjects. No current clinical rule is
declared superseded, so no component or unrelated finding may be hidden by this
promotion.

The attested draft pack cannot self-authorize. Runtime authority may be added only
through a promotion entry that records the explicit clinician decision and pins the
reconciled row hash. `data-static/interaction-rules.json` must remain empty.

## 9 · Sign-off

```text
Decision       PENDING
Reviewer       clinician:subas (requested; no decision recorded)
Reviewed at    pending
Approval text  pending
```

To approve, `clinician:subas` must explicitly provide the approval response in
section 1. After that response, a separate implementation may reconcile the draft
row, record its new hash and the approval verbatim in the internal-evaluation
promotion manifest, compile the runtime pack, and run the full gates. Deployment
remains a separate decision.
