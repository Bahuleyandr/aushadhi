# Batch 1 v2 — Section F (hyperkalaemia / renal / nephrotoxicity) reconciled packet

- Source JSONL SHA-256: `c8d3ace2dc86768aba5509423e3df84a59fc7e86985189b0e05723ce6fc7d7a8`
- Rules: 16
- Evidence records: 17
- Exact fragments: 42
- Pair matcher executable: 10
- Pair matcher quarantined: 6
- Clinical context complete: 0
- Runtime enabled: 0
- Diagnostic-only: 16
- Promotion eligible: 0

Every rule is fail-closed. A diagnostic matcher may support engineering review, but it is not a pharmacist-facing action and is not clinician-approved.

## Independent adversarial corrections

1. **Every runtime path now fails closed.** All 16 rules retain incomplete clinical context and are runtime-disabled.
2. **Amiloride is indication-bound but non-executable.** The demonstrated-hypokalaemia condition is explicit and cannot be inferred from the medication pair.
3. **Potassium-product evidence is narrowed to lisinopril.** The legacy rule ID no longer transfers one lisinopril label to every ACE inhibitor or ARB.
4. **The triple-whammy row is a non-action review hypothesis.** It cannot emit or suppress findings and does not claim incremental n-ary risk from evidence that supports only lisinopril plus NSAID with diuretic therapy as patient context.
5. **Co-trimoxazole same-product identity fails closed.** All three affected rules are matcher-quarantined until product-bound ingredient occurrences exist.
6. **Methotrexate plus NSAID is split by source qualifier.** The high-dose outcome record has no label action; the lower-dose record retains only the caution and animal-model statement. Both are non-executable.
7. **Defensible catalog identities were added conservatively.** Seven catalog-backed NSAIDs and metolazone were added to the relevant review rosters; affected rules remain runtime-disabled.

## Rule matrix

| Rule | Identity scope | Matcher | Stored action | Jurisdiction |
|---|---|---|---|---|
| `acei_arb__mra_spironolactone_eplerenone` | acei_arb + mineralocorticoid_receptor_antagonist | diagnostic matcher | `confirm_and_monitor` | US |
| `acei_arb__amiloride` | acei_arb + epithelial_sodium_channel_blocker | diagnostic matcher | `confirm_and_monitor` | US |
| `acei_arb__potassium_supplement_salt_substitute` | lisinopril + potassium_supplement_or_salt_substitute | diagnostic matcher | `confirm_and_monitor` | US |
| `acei_arb__nsaid_systemic` | acei_arb + nsaid | diagnostic matcher | `confirm_and_monitor` | US |
| `acei_arb_diuretic__nsaid_triple_whammy` | acei_arb + diuretic + nsaid | quarantined | `confirm_and_monitor` | none accepted |
| `acei__arb_dual_raas_blockade` | acei + arb | diagnostic matcher | `withhold_and_clarify` | US |
| `cotrimoxazole__ace_inhibitor` | trimethoprim_or_cotrimoxazole + acei | quarantined | `withhold_and_clarify` | US |
| `cotrimoxazole__other_potassium_raising_agent` | trimethoprim_or_cotrimoxazole + potassium_raising_agent | quarantined | `confirm_and_monitor` | US |
| `lithium__nsaid_systemic` | lithium + nsaid | diagnostic matcher | `confirm_and_monitor` | US |
| `lithium__acei_arb` | lithium + acei_arb | diagnostic matcher | `confirm_and_monitor` | US |
| `lithium__thiazide_diuretic` | lithium + thiazide_diuretic | diagnostic matcher | `confirm_and_monitor` | US |
| `gentamicin__furosemide` | gentamicin + furosemide | diagnostic matcher | `withhold_and_clarify` | US |
| `methotrexate_high_dose__nsaid_systemic` | methotrexate + nsaid | quarantined | `confirm_and_monitor` | none accepted |
| `methotrexate_lower_dose__nsaid_systemic` | methotrexate + nsaid | quarantined | `confirm_and_monitor` | US |
| `methotrexate__cotrimoxazole` | methotrexate + trimethoprim_or_cotrimoxazole | quarantined | `confirm_and_monitor` | none accepted |
| `methotrexate_high_dose__ppi` | methotrexate + proton_pump_inhibitor | diagnostic matcher | `confirm_and_monitor` | US |

## Verification boundary

- Every retained evidence item uses an exact openFDA set-ID query and full payload binding under the production-open policy.
- Every rule remains `clinical_context_complete:false`, `runtime_enabled:false`, and `promotion_eligible:false`.
- Quarantined rows cannot emit findings, even in diagnostic mode.
- Route, formulation, product occurrence, regimen, dose, indication, and patient-state limitations remain explicit rather than inferred.
- Clinician review and a separately assembled attested pack remain required.
