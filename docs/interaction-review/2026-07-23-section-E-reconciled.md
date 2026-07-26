# Batch 1 v2 — Section E (bradycardia / AV block) reconciled packet

- Source JSONL SHA-256: `1512733e6e36c6d6cbc54f68488a2e5639621b9332df45b92a98802be0e4a52c`
- Rules: 12
- Evidence records: 13
- Exact fragments: 27
- Pair matcher executable: 10
- Pair matcher quarantined: 2
- Clinical context complete: 0
- Runtime enabled: 0
- Diagnostic-only: 12
- Promotion eligible: 0

Every rule is fail-closed. A diagnostic matcher may support engineering review, but it is not a pharmacist-facing action and is not clinician-approved.

## Independent adversarial corrections

1. **Every runtime path now fails closed.** All 12 rules retain incomplete clinical context and are runtime-disabled.
2. **Unsupported cardiovascular prose was removed.** Mechanisms and monitoring now track the exact retained fragments rather than inferring hypotension, heart failure, AV-node effects, renal or electrolyte plans, or patient symptom lists.
3. **The clonidine withdrawal quote is contiguous.** The retained fragment now includes the antecedent describing withdrawal symptoms and rapid blood-pressure rise before the beta-blocker likelihood sentence.
4. **Digoxin plus verapamil, amiodarone, dronedarone, clarithromycin, and diltiazem now retain only source-supported exposure, concentration, dose, and toxicity statements.**
5. **Digoxin renal impairment is condition-only.** It has no second subject and its pair matcher is disabled.
6. **The ivabradine QT tier is a non-action record.** Its source supplies no label action, so the matcher is quarantined and no local withhold can surface.
7. **Defensible catalog identities were added conservatively.** Metolazone joins the potassium-wasting roster, and betaxolol, celiprolol, esmolol, and pindolol join the beta-blocker review roster; affected rules remain runtime-disabled.
8. **Adenosine plus dipyridamole remains procedural and diagnostic.** Monitoring and counselling are explicitly local-protocol matters because the fragment supplies no such instructions.

## Rule matrix

| Rule | Identity scope | Matcher | Stored action | Jurisdiction |
|---|---|---|---|---|
| `beta_blocker__non_dihydropyridine_ccb` | beta_blocker + non_dihydropyridine_ccb | diagnostic matcher | `confirm_and_monitor` | US |
| `beta_blocker__clonidine` | beta_blocker + clonidine | diagnostic matcher | `confirm_and_monitor` | US |
| `digoxin__verapamil` | digoxin + verapamil | diagnostic matcher | `confirm_and_monitor` | US |
| `digoxin__amiodarone` | digoxin + amiodarone | diagnostic matcher | `confirm_and_monitor` | US |
| `digoxin__dronedarone` | digoxin + dronedarone | diagnostic matcher | `confirm_and_monitor` | US |
| `digoxin__clarithromycin` | digoxin + clarithromycin | diagnostic matcher | `confirm_and_monitor` | US |
| `digoxin__diltiazem` | digoxin + diltiazem | diagnostic matcher | `confirm_and_monitor` | US |
| `digoxin__renal_impairment_accumulation` | digoxin + condition only | quarantined | `confirm_and_monitor` | US |
| `digoxin__potassium_wasting_diuretic` | digoxin + potassium_wasting_diuretic | diagnostic matcher | `confirm_and_monitor` | US |
| `ivabradine__ordinary_negative_chronotrope` | ivabradine + ordinary_negative_chronotrope | diagnostic matcher | `confirm_and_monitor` | US |
| `ivabradine__qt_active_antiarrhythmic` | ivabradine + qt_active_antiarrhythmic | quarantined | `confirm_and_monitor` | none accepted |
| `adenosine__dipyridamole` | adenosine + dipyridamole | diagnostic matcher | `confirm_and_monitor` | US |

## Verification boundary

- Every retained evidence item uses an exact openFDA set-ID query and full payload binding under the production-open policy.
- Every rule remains `clinical_context_complete:false`, `runtime_enabled:false`, and `promotion_eligible:false`.
- Quarantined rows cannot emit findings, even in diagnostic mode.
- Route, formulation, product occurrence, regimen, dose, indication, and patient-state limitations remain explicit rather than inferred.
- Clinician review and a separately assembled attested pack remain required.
