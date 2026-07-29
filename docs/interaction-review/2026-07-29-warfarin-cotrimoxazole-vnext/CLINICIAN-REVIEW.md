# Warfarin–co-trimoxazole vNext — clinician review rendering

**Decision:** no decision recorded
**Requested reviewer:** `clinician:subas` after governance prerequisites are complete
**Requested profile:** `internal-evaluation` only
**Clinical-use, production, and deployment authority:** none

This Markdown file is a human-readable rendering of
`warfarin-cotrimoxazole.rule-subject.v1.draft.json`. The JSON subject, once finalized,
is the object that a later authenticated event must bind. Editing or acknowledging
this Markdown does not grant authority.

## Proposed classification

```text
rule family      warfarin__cotrimoxazole
severity         major
dispense action  confirm_and_monitor
temporal scope   current interaction check only
population       not age-parameterized
product scope    six exact PMBJP oral-tablet pairs
profile          internal-evaluation only
```

For this draft, `major` means a potentially clinically important consequence
requiring timely clinician review. It does not mean contraindicated, never
co-prescribe, automatically stop either medicine, automatically refuse dispensing,
or automatically reduce warfarin.

The clinical classification is a proposed local workflow mapping. The cited source
does not independently assign that local severity or dispensing action.

## Proposed exact scope

Only these six product pairs are in scope:

| Co-trimoxazole oral tablet | Warfarin oral tablet |
|---|---|
| PMBJP 89 — sulfamethoxazole 800 mg / trimethoprim 160 mg | PMBJP 2141 — warfarin 1 mg |
| PMBJP 89 — sulfamethoxazole 800 mg / trimethoprim 160 mg | PMBJP 2142 — warfarin 2 mg |
| PMBJP 89 — sulfamethoxazole 800 mg / trimethoprim 160 mg | PMBJP 452 — warfarin 5 mg |
| PMBJP 90 — sulfamethoxazole 100 mg / trimethoprim 20 mg | PMBJP 2141 — warfarin 1 mg |
| PMBJP 90 — sulfamethoxazole 100 mg / trimethoprim 20 mg | PMBJP 2142 — warfarin 2 mg |
| PMBJP 90 — sulfamethoxazole 100 mg / trimethoprim 20 mg | PMBJP 452 — warfarin 5 mg |

PMBJP 89 has direct strength-and-dose-form alignment to the captured U.S. label, but
the U.S. label is not a product-specific PMBJP 89 label. Both products still require
explicit clinician approval for inclusion. PMBJP 90 does not have direct
strength-aligned evidence for its 100 mg/20 mg strength. Including PMBJP 90 is a
proposed strength extrapolation that requires a separate explicit clinician
decision. Neither product may be presented as having direct PMBJP product-label
evidence, and PMBJP 90 must not be used to infer a paediatric population.

Both sides must resolve through the exact reviewed product assertions. The six-pair
boundary is technical and clinical scope for this proposed subject; it is not a claim
that excluded products are safe.

## Proposed temporal and population meaning

`current_check_only` means both exact products are represented in the same current
interaction check. It does not establish that a patient took either product, that
administration overlapped, or that adherence occurred.

No recent-exposure trigger, lookback window, course-end inference, post-course
interval, interaction-episode identifier, adult-only branch, paediatric-only branch,
or age-derived branch is proposed. Missing or conflicting applicability remains
`unresolved`.

## Proposed exact clinical text

<!-- canonical-clinical-text:start -->
### Mechanism

> Sulfamethoxazole inhibits CYP2C9. The cited U.S.
> sulfamethoxazole/trimethoprim label reports that the combination may prolong
> prothrombin time in patients receiving warfarin and directs that coagulation time
> be reassessed.

### Pharmacy management for the current check

> Verify whether the two selected exact products represent current or intended
> concurrent use. If current or intended overlap is confirmed, confirm that the
> prescriber or anticoagulation service has reviewed the combination and arranged a
> patient-specific PT/INR monitoring plan. The pharmacy must not change a dose or
> stop either medicine independently.

### Pharmacy escalation context

> If current or intended overlap is confirmed or cannot be resolved from available
> information, escalate the finding to the responsible prescriber or anticoagulation
> service. This context does not authorize the pharmacy to select alternative therapy
> or independently direct warfarin management.

### Prescriber information

> If current or intended overlap is confirmed, the prescriber or anticoagulation
> service directs any warfarin review or adjustment and determines patient-specific
> PT/INR follow-up. No universal monitoring schedule or fixed post-discontinuation
> interval is asserted.

### Patient counselling

> If current or intended overlap is confirmed, counsel the patient to seek prompt
> clinical advice for bleeding symptoms and not to stop warfarin without clinical
> advice.
<!-- canonical-clinical-text:end -->

The mechanism paragraph is a bounded summary of the captured U.S. label. The other
paragraphs are proposed local workflow text requiring explicit clinician approval.
The subject does not claim that U.S. evidence is an Indian regulatory-label
statement.

## Proposed audience bindings

Rendering is default-deny: a field not listed for an audience is prohibited for that
audience. An unreviewed subject or identity-unresolved finding renders no clinical
content. For a reviewed subject with resolved identity but exposure-unresolved
applicability, the pharmacy may receive only `pharmacy_escalation_context`; the
prescriber/service and patient audiences receive no clinical content in that state.
Conditions are evaluated in that fail-closed precedence order. A selected conditional
allowlist is intersected with the general audience allowlist; the renderer must never
union them. The general allowlist is available only when the subject is reviewed and
both identity and exposure are resolved. Any unknown or conflicting condition renders
no clinical content, and no renderer may fall back to the general allowlist.

- Pharmacy may receive `mechanism`, `pharmacy_management_current_check`,
  `pharmacy_escalation_context`, and `patient_counselling`.
- The prescriber or anticoagulation service may receive `mechanism`,
  `prescriber_information`, and `patient_counselling`.
- The patient audience may receive only `patient_counselling`.

In particular, `prescriber_information` is not pharmacy-facing, and the patient
audience cannot receive the mechanism or either professional management field.

## Proposed workflow boundary

Resolution must be structured; unexplained free text cannot clear the finding.
Pending states are `manual_review_required`,
`clinician_confirmation_pending`, `urgent_supply_escalated`, and
`correction_recheck_pending`. Terminal states are `review_confirmed`,
`no_concurrent_exposure_verified`, `order_cancelled`, and
`order_corrected_pair_absent_after_recheck`.

`urgent_supply_escalated` is not terminal. This subject grants no urgent-supply
authority, identifies no local urgent pathway, and cannot use escalation by itself to
resolve clinical review.

The evidence required to close the finding depends on the terminal state.
`review_confirmed` requires the responsible clinician or service, confirmation
method, confirmed exposure status, and monitoring-plan summary.
`no_concurrent_exposure_verified` instead requires the confirmation method, exposure
status, and disposition rationale. `order_cancelled` requires the confirmation
method, exposure status, authorized-order-actor identity and role, trusted-order-event
identity and store identity, and `order_cancellation_reference`.
`order_corrected_pair_absent_after_recheck` requires the confirmation method,
exposure status, the same authorized-actor and trusted-event evidence,
`order_correction_reference`, and `post_correction_recheck_result`. These
compatibility and evidence requirements do not define an exclusive transition graph.
A state is valid only when its own complete requirements and compatibility entries
are satisfied.

A cancellation or correction terminal requires a trusted order event and an
authorized order actor validated through the future trusted order system and
authorization registry. Pharmacy self-attestation cannot satisfy either terminal
state.

Allowed `confirmation_method` values are:

- `responsible_clinician_or_service_confirmation`
- `verified_current_order_or_medication_record`
- `trusted_order_cancellation_event`
- `trusted_order_correction_event`

The complete state compatibility contract is:

<!-- workflow-compatibility-table:start -->
| State | Kind | Allowed exposure statuses | Allowed confirmation methods | Required evidence |
|---|---|---|---|---|
| `manual_review_required` | pending | `unresolved` | none | `concomitant_exposure_status` |
| `clinician_confirmation_pending` | pending | `current_or_intended_overlap_confirmed` | `verified_current_order_or_medication_record` | `confirmation_method`<br>`concomitant_exposure_status` |
| `urgent_supply_escalated` | pending | `current_or_intended_overlap_confirmed`<br>`unresolved` | `responsible_clinician_or_service_confirmation`<br>`verified_current_order_or_medication_record` | `concomitant_exposure_status`<br>`escalation_reference` |
| `correction_recheck_pending` | pending | `unresolved` | `trusted_order_correction_event` | `confirmation_method`<br>`concomitant_exposure_status`<br>`authorized_order_actor_id`<br>`authorized_order_actor_role`<br>`trusted_order_event_id`<br>`trusted_order_event_store_id`<br>`order_correction_reference` |
| `review_confirmed` | terminal | `current_or_intended_overlap_confirmed` | `responsible_clinician_or_service_confirmation` | `responsible_clinician_or_service`<br>`confirmation_method`<br>`concomitant_exposure_status`<br>`monitoring_plan_summary` |
| `no_concurrent_exposure_verified` | terminal | `no_current_or_intended_overlap_verified` | `responsible_clinician_or_service_confirmation`<br>`verified_current_order_or_medication_record` | `confirmation_method`<br>`concomitant_exposure_status`<br>`disposition_rationale` |
| `order_cancelled` | terminal | `order_cancelled_before_overlap` | `trusted_order_cancellation_event` | `confirmation_method`<br>`concomitant_exposure_status`<br>`authorized_order_actor_id`<br>`authorized_order_actor_role`<br>`trusted_order_event_id`<br>`trusted_order_event_store_id`<br>`order_cancellation_reference` |
| `order_corrected_pair_absent_after_recheck` | terminal | `corrected_order_pair_absent_after_recheck` | `trusted_order_correction_event` | `confirmation_method`<br>`concomitant_exposure_status`<br>`authorized_order_actor_id`<br>`authorized_order_actor_role`<br>`trusted_order_event_id`<br>`trusted_order_event_store_id`<br>`order_correction_reference`<br>`post_correction_recheck_result` |
<!-- workflow-compatibility-table:end -->

Optional audit fields do not resolve a state by themselves. They are:

- `latest_inr_value_when_available`
- `latest_inr_at_when_available`
- `next_planned_assessment_or_documented_rationale_when_available`

The prescriber or anticoagulation service directs warfarin review and
patient-specific PT/INR monitoring. The pharmacy cannot change a dose or stop either
medicine independently. No universal PT/INR schedule, automatic dose reduction, or
fixed post-discontinuation interval is proposed.

## Evidence and identity boundary

Clinical evidence is the captured U.S. openFDA label for set ID
`7f82e5e0-b627-a3f3-e053-2991aa0abaa5`, SPL version 6, effective time `20260209`.
The payload SHA-256 is
`63dfc42563d6fb406df816f4d801878e9a33bae39cdae3abb01ffe0e0dbb706e`.

```text
evidence jurisdiction    US
product catalogue        PMBJP
product market           India
deployment jurisdiction  none
```

The fixed-dose combination is
`combination:co-trimoxazole:rxnorm-10831`, RxNorm MIN 10831, with exact-active-set
components sulfamethoxazole 10180 and trimethoprim 10829. MIN remains outside the
single-ingredient IN/PIN mapping path.

The object mapping is `ingredient:warfarin:rxnorm-11289`, restricted to presentation
mappings:

- `presentation:pmbjp:2141:oral-tablet`
- `presentation:pmbjp:2142:oral-tablet`
- `presentation:pmbjp:452:oral-tablet`

Every product ID, product-assertion hash, RxNorm SCD, source payload, source fragment,
and committed identity-evidence hash is recorded in the canonical JSON subject.

## Explicit exclusions

The canonical subject excludes exactly:

- `PMBJP 88 co-trimoxazole oral suspension`
- `intravenous co-trimoxazole`
- `single-ingredient trimethoprim`
- `single-ingredient sulfamethoxazole`
- `every unreviewed product or presentation`
- `fuzzy or component-only inheritance`
- `independently inferred systemic presentation`
- `recent or completed exposure`
- `post-course or fixed lookback trigger`
- `adult-only, paediatric-only, or age-derived branch`

Missing, stale, ambiguous, drifted, or excluded scope must produce `not_evaluated` or
`unresolved`, never `safe` or `no_interaction`. A blank result never establishes
safety.

The interaction family is `warfarin-anticoagulation-potentiation`, and the subject
specificity is `exact_fixed_dose_combination`. The combination subject supplements
component subjects and supersedes no current rule, so it cannot hide an unrelated
component finding.

## Change control

A new clinical approval is required for any change to:

- clinical classification;
- clinical text;
- temporal or population scope;
- product or identity scope;
- PMBJP 90 strength extrapolation;
- evidence source or jurisdiction;
- workflow or audience boundaries; or
- supersession semantics.

Source or identity drift blocks promotion, and reconciliation of the existing
non-authorizing draft row remains mandatory before promotion.

## Decisions that remain for authenticated review

No clinician should sign this subject until the governance policy and trust profiles
are approved. After those prerequisites are complete, the authenticated review must
explicitly approve or reject:

<!-- signoff-decision-list:start -->
1. the exact six-product-pair scope;
2. PMBJP 90 as a strength extrapolation without direct label evidence;
3. `major` and its bounded meaning;
4. `confirm_and_monitor`;
5. the five exact clinical-text fields above;
6. current-check-only temporal scope;
7. no age-derived population branch;
8. structured workflow states, every per-state evidence and compatibility entry, and
   correction recheck;
9. the default-deny pharmacy, prescriber/service, and patient audience bindings,
   including precedence, intersection-only composition, and fail-closed conflicts;
10. no urgent-supply authority;
11. the U.S.-evidence/India-product jurisdiction boundary; and
12. interaction family `warfarin-anticoagulation-potentiation`, subject specificity
    `exact_fixed_dose_combination`, supplementation, and no current supersession; and
13. the complete change-control boundary above.
<!-- signoff-decision-list:end -->

The final approval statement must be completed before hashing. The later event must
be newly created and authenticated; this draft contains no `PENDING` event to edit
into `APPROVED`.
