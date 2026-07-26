# Batch 1 v2 — Section B (statins) reconciled packet

Generated from the Section B JSONL after runtime-status and citation-contract reconciliation. Draft for clinician review; no rule is promotion-eligible.

- Section: `B`
- JSONL SHA-256: `d814b28a475020b15aa18f70f9ff5070e3141df01d963d2a546ab4e319a0c5a9`
- Rules: **20**
- Evidence records: **28**
- Hashed verbatim fragments: **35**
- Runtime enabled: **0**
- Pair-executable diagnostics: **15**
- Non-executable regimen templates: **5**
- Promotion eligible: **0**
- Citation currentness checked: **2026-07-24**
- Schema freeze: `validateDraftRules` passes. Every row is runtime-disabled.
  The two exact gemfibrozil rows remain pair-matcher-executable diagnostics,
  but their `clinical_context_complete:false` status records that
  `newly_added_agent` cannot be resolved without initiation direction. Their
  selectors also lack non-empty concrete route and formulation scope required
  by the runtime contract.

## Phase 2 provenance validation

- All 28 legacy DailyMed evidence records reconcile exactly against 13 live official openFDA `set_id` queries.
- Every record pins one current SPL result by document ID, version, effective time, recursively canonicalized payload SHA-256, and one exact source path per fragment under `openfda-spl-text-v1`.
- Every record uses `source_policy_id:openfda-labels`, `source_policy_use:interaction-evidence`, and `licence:CC0-1.0`; the openFDA API is the machine origin and DailyMed is reference-only.
- Result: 28/28 evidence records and 35/35 fragments payload-validated; 0 unmatched or ambiguous results.

## Runtime reconciliation

| Rule | Runtime posture | Reason |
|---|---|---|
| `simvastatin_lovastatin__strong_cyp3a4_inhibitor` | diagnostic only | Systemic route/formulation and exact inhibitor-roster scope are not matcher-gateable. Erythromycin is pinned because retained current simvastatin and lovastatin fragments name it, without widening the shared global class. |
| `simvastatin__gemfibrozil` | diagnostic only | Exact pair is matcher-executable for draft review, but initiation direction and concrete route/formulation scope are incomplete. |
| `lovastatin__gemfibrozil` | diagnostic only | Exact pair is matcher-executable for draft review, but initiation direction and concrete route/formulation scope are incomplete. |
| `statin__fenofibrate` | diagnostic only | Statin choice, dose, product formulation, and renal function materially affect management; the pair matcher cannot gate those inputs. |
| `simvastatin__amiodarone` | diagnostic only | The label action depends on the simvastatin dose, which the pair matcher cannot evaluate. |
| `simvastatin__verapamil_diltiazem` | diagnostic only | The label action depends on the simvastatin dose and jurisdiction; dose is not a matcher input. |
| `simvastatin__amlodipine` | diagnostic only | The label action depends on the simvastatin dose, which the pair matcher cannot evaluate. |
| `atorvastatin__strong_cyp3a4_inhibitor` | diagnostic only | The source names only selected inhibitors and management depends on dose and regimen; systemic route and dose are not matcher inputs. |
| `simvastatin__ciclosporin` | diagnostic only | The interaction applies to systemic cyclosporine; topical/ophthalmic versus systemic route is not matcher-gateable. |
| `lovastatin__ciclosporin` | diagnostic only | The interaction applies to systemic cyclosporine; topical/ophthalmic versus systemic route is not matcher-gateable. |
| `atorvastatin__ciclosporin` | diagnostic only | The interaction applies to systemic cyclosporine; topical/ophthalmic versus systemic route is not matcher-gateable. |
| `pitavastatin__ciclosporin` | diagnostic only | The interaction applies to systemic cyclosporine; topical/ophthalmic versus systemic route is not matcher-gateable. |
| `pravastatin__ciclosporin` | diagnostic only | The label action depends on systemic route and pravastatin dose; neither is fully matcher-gateable. |
| `fluvastatin__ciclosporin` | diagnostic only | The label action is capsule-formulation and dose specific, and systemic cyclosporine route is not matcher-gateable. |
| `rosuvastatin__ciclosporin` | diagnostic only | The label action depends on rosuvastatin dose and systemic cyclosporine route; neither is fully matcher-gateable. |
| `simvastatin_lovastatin__hiv_pi_cobicistat` | non-executable | Complete regimen identity is not a matcher input; bare atazanavir, darunavir, ritonavir, cobicistat, or lopinavir cannot execute this row. |
| `atorvastatin__hiv_pi_cobicistat` | non-executable | Current actions differ by complete antiretroviral regimen and atorvastatin dose; bare ingredient matching is quarantined. |
| `rosuvastatin__hiv_pi_cobicistat` | non-executable | The source supports named complete regimens and a dose cap; bare ingredient and dose inputs cannot execute this row. |
| `pravastatin__hiv_pi_cobicistat` | non-executable | Only regimen-specific pharmacokinetic observations are supported; no uniform bare-member finding is authorized. |
| `pitavastatin__hiv_pi_cobicistat` | non-executable | Directionally different regimen-specific pharmacokinetic effects preclude a uniform bare-member finding. |

No Section B row is runtime-enabled. The two exact gemfibrozil pairs retain
their diagnostic pair matchers, but their unordered action target is
`newly_added_agent`, with both rule sides protected from unilateral
interruption. Because the matcher cannot determine which medicine is new and
the selectors do not provide concrete route/formulation scope, both rows
remain fail-closed. All cyclosporine/ciclosporin rules are diagnostic-only
because the current matcher cannot distinguish systemic exposure from topical
or ophthalmic products. Dose-cap,
formulation-dependent and broad-class rules are also diagnostic-only. The five
antiretroviral-regimen templates are matcher-inert because complete regimen
identity is unmodeled.

Focused current-slice Section B tests: 12/12 pass with the optional live-payload fixture gate enabled. The A/B integration assertions load `A.verified.jsonl` and `B.verified.jsonl` directly rather than the unreconciled aggregate.

## Antiretroviral-regimen quarantine

- Simvastatin/lovastatin is not flattened across bare antiretroviral or booster ingredients: cited class statements and named boosted examples cannot be reduced to one bare-member action.
- Atorvastatin is not flattened across protease-inhibitor/booster members: the cited label uses avoidance, lowest-dose, and 20 mg-cap branches for different complete regimens.
- Rosuvastatin is supported only for named complete regimens with a 5 mg starting dose and 10 mg maximum.
- Pravastatin has regimen-specific pharmacokinetic observations but no uniform class-wide label action in the cited evidence.
- Pitavastatin has directionally different pharmacokinetic effects: atazanavir increased exposure, while darunavir/ritonavir and lopinavir/ritonavir decreased exposure in the cited label table.

All five templates remain visible for clinician review, but `pair_matcher_executable:false` prevents bare antiretroviral or booster ingredients from producing a diagnostic or pharmacist-facing decision.

## Evidence and jurisdiction boundaries

- Every evidence record uses the current exact openFDA SPL result as machine source, with the corresponding DailyMed page retained only as a reference URL. Each exact fragment, source path, canonical payload hash, source effect, source-label action, scope, currentness, jurisdiction, and limitation is retained.
- Restricted/manual-reference sources such as emc and ACR are not used as machine evidence in Section B.
- No Indian regulator or India-specific product-label source was established in this pass. Jurisdiction claims were narrowed to the U.S.
- Runtime severity and dispense actions remain local mappings pending clinician review.
- `review.author` and `review.approver` remain null and every rule has `runtime_status.promotion_eligible:false`.
