# Batch 1 v2 — Review Index (context-aware, post-QA)

165 rules (from 100 originals; splits/enumerations expanded). Full objects: `batch-01-v2/batch-01-v2.jsonl`. Mark A/E/R per row.

Cols: id · object ↔ other · risk_basis · base sev · context_modifiers(factor:when→sev(on_unknown)) · dispense · prescriber(brief) · conf


## A. Anticoagulant/antiplatelet

| id | ↔ | basis | sev | context | dispense | prescriber | conf | ☐ |
|--|--|--|--|--|--|--|--|--|
| `warfarin__nsaid_systemic` | warfarin ↔ nsaid | additive_pd | major | renal:egfr_lt_30→major(base); hepatic:child_pugh_b→major(base) | supply_with_counselling | Prefer paracetamol. If a systemic NSAID is intended, use the lowest do | H | ☐ |
| `warfarin__aspirin_analgesic_antiplatelet` | warfarin ↔ aspirin | additive_pd | major | hepatic:child_pugh_b→major(base) | confirm_and_monitor | Combined use is appropriate only for a specific documented cardiac/vas | H | ☐ |
| `warfarin__fluconazole` | warfarin ↔ fluconazole | pk_perpetrator | major | hepatic:child_pugh_b→major(base) | confirm_and_monitor | Prefer an antifungal without the interaction where clinically appropri | H | ☐ |
| `warfarin__miconazole_oromucosal_gel` | warfarin ↔ miconazole | pk_perpetrator | major | hepatic:child_pugh_b→major(base) | withhold_and_clarify | Avoid combination; UK labelling treats this as contraindicated / near- | H | ☐ |
| `warfarin__ketoconazole_systemic` | warfarin ↔ ketoconazole | pk_perpetrator | major | hepatic:child_pugh_b→major(base) | confirm_and_monitor | Prefer an antifungal without the interaction where appropriate; otherw | H | ☐ |
| `warfarin__voriconazole` | warfarin ↔ voriconazole | pk_perpetrator | major | hepatic:child_pugh_b→major(base) | confirm_and_monitor | Prefer an antifungal without the interaction where appropriate; otherw | H | ☐ |
| `warfarin__macrolide_cyp_inhibitor` | warfarin ↔ macrolide_cyp3a_inhibitor [moderate/strong] | pk_perpetrator | major | hepatic:child_pugh_b→major(base) | confirm_and_monitor | Prefer an antibiotic without the relevant interaction where clinically | H | ☐ |
| `warfarin__metronidazole_tinidazole` | warfarin ↔ nitroimidazole | pk_perpetrator | major | hepatic:child_pugh_b→major(base) | confirm_and_monitor | Avoid where an alternative antibiotic is appropriate; otherwise prescr | H | ☐ |
| `warfarin__cotrimoxazole` | warfarin ↔ co-trimoxazole | pk_perpetrator | major | hepatic:child_pugh_b→major(base) | confirm_and_monitor | Choose an alternative antibiotic where appropriate; otherwise intensiv | H | ☐ |
| `warfarin__amiodarone` | warfarin ↔ amiodarone | pk_perpetrator | major | hepatic:child_pugh_b→major(base) | confirm_and_monitor | On starting amiodarone the prescriber empirically lowers warfarin by ~ | H | ☐ |
| `warfarin__fluoroquinolone` | warfarin ↔ fluoroquinolone | pk_perpetrator | moderate | — | supply_with_counselling | Monitor INR during and after the course; consider an INR check if the  | H | ☐ |
| `warfarin__ssri_snri` | warfarin ↔ ssri_snri | additive_pd | moderate | — | supply_with_counselling | Prescriber vigilance for bleeding; consider gastroprotection if other  | H | ☐ |
| `warfarin__tramadol` | warfarin ↔ tramadol | pk_perpetrator | major | hepatic:child_pugh_b→major(base) | confirm_and_monitor | Prefer an alternative analgesic where feasible; if tramadol is used, a | M | ☐ |
| `warfarin__rifampicin` | warfarin ↔ rifampicin | pk_perpetrator | major | — | confirm_and_monitor | Avoid where possible; if rifampicin is needed the prescriber increases | H | ☐ |
| `warfarin__azithromycin_oral` | warfarin ↔ azithromycin | pk_perpetrator | moderate | — | supply_with_counselling | Monitor INR during the course; azithromycin is a lower-risk macrolide  | M | ☐ |
| `apixaban__strong_cyp3a4_pgp_inhibitor` | apixaban ↔ cyp3a4_pgp_inhibitor [strong] | pk_perpetrator | major | renal:crcl_lt_30→major(escalate); hepatic:child_pugh_c→major(escalate) | withhold_and_clarify | Per US apixaban label: on 5 mg or 10 mg BID, reduce dose by 50% with a | H | ☐ |
| `rivaroxaban__strong_cyp3a4_pgp_inhibitor` | rivaroxaban ↔ cyp3a4_pgp_inhibitor [strong] | pk_perpetrator | major | renal:crcl_lt_30→contraindicated(escalate); hepatic:child_pugh_b→contraindicated(escalate) | withhold_and_clarify | Per rivaroxaban label: avoid concomitant use with combined strong CYP3 | H | ☐ |
| `apixaban__strong_cyp3a4_pgp_inducer` | apixaban ↔ cyp3a4_pgp_inducer [strong] | pk_perpetrator | major | — | withhold_and_clarify | Per label: avoid concomitant use of apixaban with combined strong CYP3 | H | ☐ |
| `rivaroxaban__strong_cyp3a4_pgp_inducer` | rivaroxaban ↔ cyp3a4_pgp_inducer [strong] | pk_perpetrator | major | — | withhold_and_clarify | Per label: avoid concomitant use of rivaroxaban with combined strong C | H | ☐ |
| `dabigatran__pgp_inducer` | dabigatran ↔ pgp_inducer [strong] | pk_perpetrator | major | — | withhold_and_clarify | Per label: avoid co-administration of dabigatran with rifampicin (P-gp | H | ☐ |
| `edoxaban__pgp_inducer` | edoxaban ↔ pgp_inducer [strong] | pk_perpetrator | major | — | withhold_and_clarify | Per label: avoid concomitant rifampicin with edoxaban. Handling differ | M | ☐ |
| `dabigatran__pgp_inhibitor` | dabigatran ↔ pgp_inhibitor [strong] | pk_perpetrator | major | renal:crcl_lt_30→contraindicated(escalate) | confirm_and_monitor | Action is conditional on the specific P-gp inhibitor, indication (NVAF | H | ☐ |
| `clopidogrel__cyp2c19_inhibiting_ppi` | clopidogrel ↔ cyp2c19_inhibiting_ppi | pk_perpetrator | moderate | — | confirm_and_monitor | Prefer an acid suppressant with little or no CYP2C19 inhibition (e.g.  | H | ☐ |
| `aspirin_ld_ir__ibuprofen_timing` | aspirin ↔ ibuprofen | additive_pd | moderate | — | space_doses | Where regular ibuprofen is needed with cardioprotective aspirin, consi | H | ☐ |
| `aspirin__nsaid_additive_gi_bleeding` | aspirin ↔ nsaid | additive_pd | moderate | renal:egfr_lt_30→moderate(base) | supply_with_counselling | Avoid routine concurrent NSAID with aspirin; if needed, lowest dose/sh | H | ☐ |
| `dual_antiplatelet__oral_anticoagulant_triple_therapy` | {"combination": [{"drug": "aspirin"}, {" ↔ anticoagulant | additive_pd | major | renal:egfr_lt_30→major(base); hepatic:child_pugh_b→major(base) | confirm_and_monitor | Confirm the indication and planned duration of triple therapy (often i | H | ☐ |
| `ssri_snri__nsaid_additive_gi_bleeding` | ssri_snri ↔ nsaid | additive_pd | moderate | renal:egfr_lt_30→moderate(base) | supply_with_counselling | Suggest a gastroprotection review; consider paracetamol or non-NSAID a | H | ☐ |
| `heparin_lmwh__nsaid_or_antiplatelet_bleeding` | heparin_lmwh ↔ nsaid_or_antiplatelet | additive_pd | major | renal:crcl_lt_30→major(base) | confirm_and_monitor | Prescriber assessment of combined bleeding risk; avoid non-essential N | H | ☐ |

## B. Statins

| id | ↔ | basis | sev | context | dispense | prescriber | conf | ☐ |
|--|--|--|--|--|--|--|--|--|
| `simvastatin_lovastatin__strong_cyp3a4_inhibitor` | cyp3a4_metabolized_statin ↔ cyp3a4_inhibitor [strong] | contraindication | contraindicated | — | withhold_and_clarify | Combination is contraindicated. Hold the statin for the duration of a  | H | ☐ |
| `simvastatin_lovastatin__gemfibrozil` | cyp3a4_metabolized_statin ↔ gemfibrozil | contraindication | contraindicated | — | withhold_and_clarify | Gemfibrozil is contraindicated with simvastatin and lovastatin; do not | H | ☐ |
| `statin__fenofibrate` | statin ↔ fenofibrate | additive_pd | moderate | renal:egfr_lt_30→major(base); hepatic:hepatic_impaired→major(base) | supply_with_counselling | Combination may be appropriate; use the lowest effective statin dose a | H | ☐ |
| `simvastatin__amiodarone` | simvastatin ↔ amiodarone | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Do not exceed simvastatin 20 mg/day with amiodarone (per label); consi | H | ☐ |
| `simvastatin__verapamil_diltiazem` | simvastatin ↔ non_dhp_ccb [moderate] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | US label: do not exceed simvastatin 10 mg/day with verapamil or diltia | H | ☐ |
| `simvastatin__amlodipine` | simvastatin ↔ amlodipine | pk_perpetrator | moderate | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Do not exceed simvastatin 20 mg/day with amlodipine (per label). If pr | H | ☐ |
| `atorvastatin__strong_cyp3a4_inhibitor` | atorvastatin ↔ cyp3a4_inhibitor [strong] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Atorvastatin limit is perpetrator-specific: with strong CYP3A4 inhibit | M | ☐ |
| `simvastatin__ciclosporin` | simvastatin ↔ ciclosporin | contraindication | contraindicated | — | withhold_and_clarify | Simvastatin is contraindicated with ciclosporin; do not co-supply. Do  | H | ☐ |
| `lovastatin__ciclosporin` | lovastatin ↔ ciclosporin | pk_perpetrator | major | renal:egfr_lt_30→major(base) | confirm_and_monitor | Avoid lovastatin with ciclosporin per label - the lovastatin label lis | M | ☐ |
| `atorvastatin__ciclosporin` | atorvastatin ↔ ciclosporin | pk_perpetrator | major | renal:egfr_lt_30→major(base) | confirm_and_monitor | Avoid atorvastatin with ciclosporin where possible; if unavoidable use | M | ☐ |
| `pitavastatin__ciclosporin` | pitavastatin ↔ ciclosporin | contraindication | contraindicated | — | withhold_and_clarify | Pitavastatin is contraindicated with ciclosporin; do not co-supply. Do | H | ☐ |
| `pravastatin__ciclosporin` | pravastatin ↔ ciclosporin | pk_perpetrator | major | renal:egfr_lt_30→major(base) | confirm_and_monitor | Limit pravastatin dose with ciclosporin per label (e.g. start low, cap | M | ☐ |
| `fluvastatin__ciclosporin` | fluvastatin ↔ ciclosporin | pk_perpetrator | major | renal:egfr_lt_30→major(base) | confirm_and_monitor | Limit fluvastatin dose with ciclosporin per label (do not exceed the l | M | ☐ |
| `rosuvastatin__ciclosporin` | rosuvastatin ↔ ciclosporin | pk_perpetrator | major | renal:egfr_lt_30→major(base) | confirm_and_monitor | Do not exceed rosuvastatin 5 mg/day with ciclosporin (per label). If p | H | ☐ |
| `simvastatin_lovastatin__hiv_pi_cobicistat` | cyp3a4_metabolized_statin ↔ hiv_protease_inhibitor_or_pk_booster [strong] | contraindication | contraindicated | — | withhold_and_clarify | Simvastatin and lovastatin are contraindicated with boosted HIV protea | H | ☐ |
| `atorvastatin__hiv_pi_cobicistat` | atorvastatin ↔ hiv_protease_inhibitor_or_pk_booster [strong/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Atorvastatin cap is regimen-specific: start low, titrate cautiously an | M | ☐ |
| `rosuvastatin__hiv_pi_cobicistat` | rosuvastatin ↔ hiv_protease_inhibitor_or_pk_booster [strong/moderate] | pk_perpetrator | major | renal:egfr_lt_30→major(base) | confirm_and_monitor | Rosuvastatin cap is regimen-specific (e.g. some regimens cap around 10 | M | ☐ |
| `pravastatin__hiv_pi_cobicistat` | pravastatin ↔ hiv_protease_inhibitor_or_pk_booster [moderate] | pk_perpetrator | moderate | hepatic:hepatic_impaired→major(base) | supply_with_counselling | Pravastatin is often a preferred statin with antiretrovirals, but some | M | ☐ |
| `pitavastatin__hiv_pi_cobicistat` | pitavastatin ↔ hiv_protease_inhibitor_or_pk_booster [moderate] | pk_perpetrator | moderate | hepatic:hepatic_impaired→major(base) | supply_with_counselling | Pitavastatin often has limited interaction with antiretrovirals, but t | M | ☐ |

## C. Serotonin/CNS

| id | ↔ | basis | sev | context | dispense | prescriber | conf | ☐ |
|--|--|--|--|--|--|--|--|--|
| `ssri_snri__maoi_nonselective` | ssri_or_snri ↔ maoi_nonselective | contraindication | contraindicated | — | withhold_and_clarify | Do not co-prescribe. Observe agent-specific washout: >=14 days between | H | ☐ |
| `ssri_snri__methylene_blue_iv` | ssri_or_snri ↔ methylene_blue | contraindication | contraindicated | — | withhold_and_clarify | Avoid concomitant use. Methylene blue is typically given perioperative | M | ☐ |
| `tramadol__serotonergic_antidepressant` | tramadol ↔ serotonergic_antidepressant_ssri_snri_tca | additive_pd | major | renal:egfr_lt_30→major(base); hepatic:child_pugh_c→major(base) | confirm_and_monitor | Prefer a non-serotonergic analgesic where feasible. Before a new combi | H | ☐ |
| `pethidine_tramadol__maoi_nonselective` | serotonergic_opioid_pethidine_tramadol ↔ maoi_nonselective | contraindication | contraindicated | — | withhold_and_clarify | Do not use pethidine or tramadol during or within 14 days of a non-sel | H | ☐ |
| `linezolid__serotonergic_agent` | linezolid ↔ serotonergic_agent_ssri_snri_tca_triptan | additive_pd | major | — | confirm_and_monitor | If linezolid is not urgent, avoid the combination or choose an alterna | H | ☐ |
| `triptan_mao_metabolized__maoi_mao_a` | triptan_mao_a_metabolized ↔ maoi_mao_a_inhibitor | contraindication | contraindicated | — | withhold_and_clarify | For MAO-metabolized triptans, avoid use during and within 2 weeks of a | M | ☐ |
| `ssri_snri__triptan` | ssri_or_snri ↔ triptan | additive_pd | moderate | — | supply_with_counselling | Combination is generally acceptable with awareness; use lowest effecti | M | ☐ |
| `dextromethorphan__maoi_nonselective` | dextromethorphan ↔ maoi_nonselective | contraindication | contraindicated | — | withhold_and_clarify | Avoid dextromethorphan during and within 14 days of a non-selective MA | H | ☐ |
| `dextromethorphan__ssri_snri` | dextromethorphan ↔ ssri_or_snri | additive_pd | moderate | — | supply_with_counselling | Short-course single-agent dextromethorphan at antitussive dose is usua | M | ☐ |
| `opioid__benzodiazepine_cns_depressant` | opioid ↔ benzodiazepine_or_other_cns_depressant | additive_pd | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Reserve concomitant use for patients with inadequate alternatives; pre | H | ☐ |
| `opioid__gabapentinoid` | opioid ↔ gabapentinoid | additive_pd | major | renal:egfr_lt_30→major(base) | confirm_and_monitor | Use the lowest effective gabapentinoid dose; assess age, respiratory d | H | ☐ |
| `benzodiazepine_zdrug__alcohol` | benzodiazepine_or_z_drug ↔ {"substance": "alcohol", "route": ["oral | additive_pd | major | hepatic:hepatic_impaired→major(base) | supply_with_counselling | Advise avoidance of alcohol while taking the sedative-hypnotic. | H | ☐ |
| `maoi_nonselective__sympathomimetic` | maoi_nonselective ↔ sympathomimetic_direct_and_indirect | contraindication | contraindicated | — | withhold_and_clarify | Avoid systemic and decongestant sympathomimetics (pseudoephedrine, phe | H | ☐ |
| `lithium__ssri_snri` | lithium ↔ ssri_or_snri | additive_pd | moderate | renal:egfr_lt_60→moderate(base); renal:egfr_lt_30→major(base) | supply_with_counselling | Combination may be intentional; use lowest effective doses and review  | M | ☐ |
| `bupropion__maoi_nonselective` | bupropion ↔ maoi_nonselective | contraindication | contraindicated | — | withhold_and_clarify | Do not co-prescribe; allow >=14 days between stopping a non-selective  | H | ☐ |
| `sedating_antihistamine__cns_depressant` | sedating_antihistamine ↔ cns_depressant | additive_pd | moderate | — | supply_with_counselling | Prefer a non-sedating antihistamine where appropriate; avoid stacking  | H | ☐ |

## D. QT/arrhythmia

| id | ↔ | basis | sev | context | dispense | prescriber | conf | ☐ |
|--|--|--|--|--|--|--|--|--|
| `multiple_qt_prolonging_drugs` | qt_prolonging_drug ↔ qt_prolonging_drug | additive_pd | major | renal:egfr_lt_30→major(base); hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Weigh whether all QT-prolonging agents are needed; substitute a non-QT | M | ☐ |
| `qt_macrolide__qt_prolonging_drug` | macrolide_qt ↔ qt_prolonging_drug | additive_pd | major | — | confirm_and_monitor | Prefer a non-QT-prolonging antibiotic where clinically appropriate; do | H | ☐ |
| `citalopram__qt_prolonging_drug` | citalopram ↔ qt_prolonging_drug | additive_pd | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Generally avoid combining citalopram with other QT-prolonging drugs. R | H | ☐ |
| `escitalopram__qt_prolonging_drug` | escitalopram ↔ qt_prolonging_drug | additive_pd | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Generally avoid combining escitalopram with other QT-prolonging drugs; | H | ☐ |
| `domperidone__potent_cyp3a4_inhibitor` | domperidone ↔ cyp3a4_inhibitor [potent] | contraindication | contraindicated | hepatic:hepatic_impaired→contraindicated(base) | withhold_and_clarify | Do not co-supply — the combination is contraindicated. Clarify with th | H | ☐ |
| `domperidone__qt_prolonging_drug` | domperidone ↔ qt_prolonging_drug | contraindication | contraindicated | hepatic:hepatic_impaired→contraindicated(base) | withhold_and_clarify | Do not co-supply — contraindicated. Clarify with the prescriber and ch | H | ☐ |
| `ondansetron__apomorphine` | ondansetron ↔ apomorphine | contraindication | contraindicated | — | withhold_and_clarify | Do not co-supply — contraindicated. For a patient on apomorphine, choo | H | ☐ |
| `ondansetron__qt_prolonging_drug` | ondansetron ↔ qt_prolonging_drug | additive_pd | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Use the lowest effective ondansetron dose; avoid the 32 mg single IV d | H | ☐ |
| `haloperidol_parenteral_or_high_dose__qt_prolonging_drug` | haloperidol ↔ qt_prolonging_drug | additive_pd | major | — | confirm_and_monitor | IV haloperidol is not an FDA-approved route and requires continuous EC | H | ☐ |
| `haloperidol_oral__qt_prolonging_drug` | haloperidol ↔ qt_prolonging_drug | additive_pd | major | — | confirm_and_monitor | Avoid adding another QT-prolonging drug where clinically appropriate;  | M | ☐ |
| `ziprasidone__qt_prolonging_drug` | ziprasidone ↔ qt_prolonging_drug | additive_pd | major | — | confirm_and_monitor | Generally avoid combining ziprasidone with other QT-prolonging drugs;  | H | ☐ |
| `methadone__qt_prolonging_drug` | methadone ↔ qt_prolonging_drug | additive_pd | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Do not withhold established methadone (opioid substitution therapy or  | H | ☐ |
| `methadone__cyp_inhibitor` | methadone ↔ methadone_relevant_cyp_inhibitor [potent/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Do not withhold established methadone; assess the specific inhibitor ( | H | ☐ |
| `hydroxychloroquine__qt_prolonging_drug` | hydroxychloroquine ↔ qt_prolonging_drug | additive_pd | moderate | renal:egfr_lt_30→major(base); hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Assess overall QT risk rather than applying blanket avoidance; correct | M | ☐ |

## E. Bradycardia/AV

| id | ↔ | basis | sev | context | dispense | prescriber | conf | ☐ |
|--|--|--|--|--|--|--|--|--|
| `beta_blocker__non_dihydropyridine_ccb` | beta_blocker ↔ non_dihydropyridine_ccb | additive_pd | major | hepatic:hepatic_impaired→major(base); renal:egfr_lt_30→major(base) | confirm_and_monitor | Verify the combination is intended and specialist-directed; assess hea | H | ☐ |
| `beta_blocker__clonidine` | beta_blocker ↔ clonidine | additive_pd | major | renal:egfr_lt_30→major(base) | confirm_and_monitor | During coadministration monitor for bradycardia/hypotension. If therap | H | ☐ |
| `digoxin__verapamil` | digoxin ↔ verapamil | pk_perpetrator | major | renal:egfr_lt_30→major(escalate) | confirm_and_monitor | Obtain a baseline digoxin level; prescriber reduces the digoxin dose ( | H | ☐ |
| `digoxin__amiodarone` | digoxin ↔ amiodarone | pk_perpetrator | major | renal:egfr_lt_30→major(escalate) | confirm_and_monitor | Obtain a baseline digoxin level; prescriber reduces the digoxin dose ( | H | ☐ |
| `digoxin__dronedarone` | digoxin ↔ dronedarone | pk_perpetrator | major | renal:egfr_lt_30→major(escalate) | confirm_and_monitor | Obtain a baseline digoxin level; prescriber halves or discontinues dig | H | ☐ |
| `digoxin__clarithromycin` | digoxin ↔ clarithromycin | pk_perpetrator | major | renal:egfr_lt_30→major(escalate) | confirm_and_monitor | Consider an antibiotic without this interaction where clinically appro | H | ☐ |
| `digoxin__potassium_wasting_diuretic` | digoxin ↔ potassium_wasting_diuretic | additive_pd | major | renal:egfr_lt_30→major(escalate) | confirm_and_monitor | Use recent/actual serum potassium and magnesium to gauge risk; correct | H | ☐ |
| `ivabradine__strong_cyp3a4_inhibitor` | ivabradine ↔ cyp3a4_inhibitor [strong] | contraindication | contraindicated | hepatic:child_pugh_c→contraindicated(base) | withhold_and_clarify | Do not co-supply; select a non-interacting alternative for either drug | M | ☐ |
| `ivabradine__qt_or_bradycardic_drug` | ivabradine ↔ qt_prolonging_or_bradycardic_drug | additive_pd | major | hepatic:child_pugh_c→contraindicated(base) | confirm_and_monitor | Assess baseline heart rate, QTc, electrolytes and the specific TdP ris | M | ☐ |
| `adenosine__dipyridamole` | adenosine ↔ dipyridamole | pk_perpetrator | major | — | confirm_and_monitor | Notify the team administering adenosine that the patient is on dipyrid | M | ☐ |

## F. Hyperkalaemia/renal

| id | ↔ | basis | sev | context | dispense | prescriber | conf | ☐ |
|--|--|--|--|--|--|--|--|--|
| `acei_arb__mra_spironolactone_eplerenone` | acei_arb ↔ mineralocorticoid_receptor_antagonist | additive_pd | major | renal:egfr_lt_30→contraindicated(base) | confirm_and_monitor | If intended (e.g. HFrEF), continue per specialist plan with baseline a | H | ☐ |
| `acei_arb__amiloride_triamterene` | acei_arb ↔ epithelial_sodium_channel_blocker | additive_pd | major | renal:egfr_lt_30→contraindicated(base) | confirm_and_monitor | Confirm the combination is intended; check baseline and follow-up pota | H | ☐ |
| `acei_arb__potassium_supplement_salt_substitute` | acei_arb ↔ potassium_supplement_or_salt_substitute | additive_pd | major | renal:egfr_lt_30→contraindicated(base) | supply_with_counselling | For UNprescribed potassium supplements or potassium-based salt substit | H | ☐ |
| `acei_arb__nsaid_systemic` | acei_arb ↔ nsaid | additive_pd | moderate | renal:egfr_lt_60→major(base); renal:egfr_lt_30→contraindicated(base) | confirm_and_monitor | Prefer paracetamol for short-term analgesia; if an NSAID is intended,  | H | ☐ |
| `acei_arb_diuretic__nsaid_triple_whammy` | acei_arb ↔ nsaid | additive_pd | major | renal:egfr_lt_30→contraindicated(base) | withhold_and_clarify | Do not hand over the added systemic NSAID (usually the new or OTC item | H | ☐ |
| `acei__arb_dual_raas_blockade` | acei ↔ arb | additive_pd | major | renal:egfr_lt_30→contraindicated(base) | confirm_and_monitor | Query whether dual ACEi+ARB is intended; guidelines discourage it for  | H | ☐ |
| `trimethoprim_cotrimoxazole__potassium_raising_agents` | trimethoprim_or_cotrimoxazole ↔ potassium_raising_agent | additive_pd | major | renal:egfr_lt_30→contraindicated(base) | confirm_and_monitor | Prefer an antibiotic without the potassium effect where clinically app | H | ☐ |
| `lithium__nsaid_systemic` | lithium ↔ nsaid | pk_perpetrator | major | renal:egfr_lt_60→major(base) | withhold_and_clarify | Prefer paracetamol; if an NSAID is genuinely required alongside lithiu | H | ☐ |
| `lithium__acei_arb` | lithium ↔ acei_arb | pk_perpetrator | major | renal:egfr_lt_60→major(base) | confirm_and_monitor | Both drugs are often intentionally co-prescribed; do not stop either a | H | ☐ |
| `lithium__thiazide_diuretic` | lithium ↔ thiazide_diuretic | pk_perpetrator | major | renal:egfr_lt_60→major(base) | confirm_and_monitor | If co-prescription is intended, prescriber to reduce lithium dose and  | H | ☐ |
| `aminoglycoside__loop_diuretic` | aminoglycoside ↔ loop_diuretic | additive_pd | major | renal:egfr_lt_60→major(base) | confirm_and_monitor | Usually specialist/inpatient; ensure hydration, use lowest effective a | H | ☐ |
| `cumulative_nephrotoxin_burden__placeholder` | nephrotoxic_agent ↔ nephrotoxic_agent | additive_pd | major | renal:egfr_lt_60→major(escalate) | confirm_and_monitor | PLACEHOLDER — defer to a dedicated cumulative-AKI context engine that  | M | ☐ |
| `methotrexate__nsaid_systemic` | methotrexate ↔ nsaid | pk_perpetrator | moderate | renal:egfr_lt_60→major(escalate); renal:egfr_lt_30→contraindicated(base); hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Low-dose weekly MTX with a stable, supervised NSAID may continue with  | H | ☐ |
| `methotrexate__trimethoprim_cotrimoxazole` | methotrexate ↔ trimethoprim_or_cotrimoxazole | additive_pd | major | renal:egfr_lt_30→contraindicated(escalate); hepatic:hepatic_impaired→major(base) | withhold_and_clarify | Generally avoid; prefer an alternative antibiotic. The withheld/clarif | H | ☐ |
| `methotrexate_high_dose__ppi` | methotrexate ↔ proton_pump_inhibitor | pk_perpetrator | major | renal:egfr_lt_30→contraindicated(escalate); hepatic:hepatic_impaired→major(base) | confirm_and_monitor | In high-dose MTX protocols, oncology may hold/switch the PPI (e.g. to  | M | ☐ |

## G. CYP3A4/P-gp

| id | ↔ | basis | sev | context | dispense | prescriber | conf | ☐ |
|--|--|--|--|--|--|--|--|--|
| `colchicine__strong_cyp3a4_pgp_inhibitor` | colchicine ↔ cyp3a4_pgp_inhibitor [strong] | pk_perpetrator | major | renal:egfr_lt_30→contraindicated(escalate); hepatic:hepatic_impaired→contraindicated(escalate) | withhold_and_clarify | With normal renal and hepatic function the prescriber must interrupt c | H | ☐ |
| `ergot_alkaloid__strong_cyp3a4_inhibitor` | ergot_alkaloid ↔ cyp3a4_inhibitor [strong] | contraindication | contraindicated | — | withhold_and_clarify | Combination is contraindicated: do not co-supply. Prescriber to select | H | ☐ |
| `pimozide__cyp3a4_inhibitor` | pimozide ↔ cyp3a4_inhibitor [strong] | contraindication | contraindicated | — | withhold_and_clarify | Label-contraindicated with strong CYP3A4 inhibitors (and CYP2D6 inhibi | H | ☐ |
| `tacrolimus__cyp3a4_inhibitor` | tacrolimus ↔ cyp3a4_inhibitor [strong/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Do not stop tacrolimus. The transplant team should reduce the dose and | H | ☐ |
| `ciclosporin__cyp3a4_inhibitor` | ciclosporin ↔ cyp3a4_inhibitor [strong/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Do not stop ciclosporin. Specialist to dose-adjust guided by trough le | H | ☐ |
| `sirolimus__strong_cyp3a4_pgp_inhibitor` | sirolimus ↔ cyp3a4_pgp_inhibitor [strong/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | withhold_and_clarify | Concomitant strong CYP3A4/P-gp inhibitors (for example ketoconazole, v | H | ☐ |
| `calcineurin_inhibitor__strong_cyp3a4_inducer` | calcineurin_inhibitor ↔ cyp3a4_inducer [strong] | pk_perpetrator | major | — | confirm_and_monitor | Do not stop the immunosuppressant. Transplant team to increase the dos | H | ☐ |
| `sildenafil_pah__strong_cyp3a4_inhibitor` | sildenafil ↔ cyp3a4_inhibitor [strong] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | withhold_and_clarify | Concomitant potent CYP3A4 inhibitors (for example ritonavir, ketoconaz | H | ☐ |
| `tadalafil_pah__strong_cyp3a4_inhibitor` | tadalafil ↔ cyp3a4_inhibitor [strong] | pk_perpetrator | major | renal:crcl_lt_30→major(base); hepatic:hepatic_impaired→major(base) | withhold_and_clarify | For tadalafil in PAH with a strong CYP3A4 inhibitor, follow label-spec | H | ☐ |
| `oral_midazolam_triazolam__potent_cyp3a4_inhibitor` | oral_midazolam_or_triazolam ↔ cyp3a4_inhibitor [strong] | contraindication | contraindicated | — | withhold_and_clarify | Combination is contraindicated (triazolam label; oral midazolam per Sm | H | ☐ |
| `parenteral_midazolam__potent_cyp3a4_inhibitor` | midazolam ↔ cyp3a4_inhibitor [strong] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Administering or anaesthetic team to reduce the midazolam dose and tit | H | ☐ |
| `dihydropyridine_ccb__strong_cyp3a4_inhibitor` | dihydropyridine_ccb ↔ cyp3a4_inhibitor [strong] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Prescriber to reduce the CCB dose and monitor blood pressure and oedem | M | ☐ |
| `apixaban__pgp_moderate_cyp3a4_inhibitor` | apixaban ↔ pgp_and_moderate_cyp3a4_inhibitor [moderate] | pk_perpetrator | moderate | renal:crcl_lt_30→major(base) | confirm_and_monitor | Assess bleeding risk. For a single combined moderate P-gp/CYP3A4 inhib | M | ☐ |
| `rivaroxaban__pgp_moderate_cyp3a4_inhibitor` | rivaroxaban ↔ pgp_and_moderate_cyp3a4_inhibitor [moderate] | pk_perpetrator | moderate | renal:crcl_lt_60→major(escalate) | confirm_and_monitor | Rivaroxaban with a combined P-gp/moderate CYP3A4 inhibitor should be a | M | ☐ |
| `grapefruit__sensitive_cyp3a4_substrate` | grapefruit_sensitive_cyp3a4_substrate ↔ grapefruit [gut_cyp3a4_inhibitor] | pk_perpetrator | moderate | — | supply_with_counselling | For high-sensitivity substrates (for example simvastatin, lovastatin,  | H | ☐ |
| `ivabradine__strong_cyp3a4_inhibitor` | ivabradine ↔ cyp3a4_inhibitor [strong] | contraindication | contraindicated | — | withhold_and_clarify | Strong CYP3A4 inhibitors (for example ketoconazole, itraconazole, clar | M | ☐ |
| `ivabradine__moderate_cyp3a4_inhibitor` | ivabradine ↔ cyp3a4_inhibitor [moderate] | pk_perpetrator | major | — | confirm_and_monitor | Moderate CYP3A4 inhibitors (for example diltiazem, verapamil) are not  | M | ☐ |
| `ranolazine__strong_cyp3a4_inhibitor` | ranolazine ↔ cyp3a4_inhibitor [strong] | contraindication | contraindicated | — | withhold_and_clarify | Strong CYP3A4 inhibitors (for example ketoconazole, itraconazole, clar | M | ☐ |
| `ranolazine__moderate_cyp3a4_inhibitor` | ranolazine ↔ cyp3a4_inhibitor [moderate] | pk_perpetrator | major | — | confirm_and_monitor | Moderate CYP3A4 inhibitors (for example diltiazem, verapamil, erythrom | M | ☐ |

## H. Enzyme induction

| id | ↔ | basis | sev | context | dispense | prescriber | conf | ☐ |
|--|--|--|--|--|--|--|--|--|
| `rifampicin__hormonal_contraceptive` | hormonal_contraceptive_induction_sensitive ↔ rifamycin_enzyme_inducer [potent_inducer] | pk_perpetrator | major | — | supply_with_counselling | Recommend a contraceptive method unaffected by enzyme induction (coppe | H | ☐ |
| `enzyme_inducing_antiepileptic__hormonal_contraceptive` | hormonal_contraceptive_induction_sensitive ↔ enzyme_inducing_antiepileptic [strong_inducer] | pk_perpetrator | major | — | supply_with_counselling | For ongoing enzyme-inducing antiepileptic therapy, recommend a contrac | H | ☐ |
| `rifampicin__calcineurin_inhibitor` | calcineurin_inhibitor ↔ rifampicin | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Transplant/specialist team must anticipate large immunosuppressant dos | H | ☐ |
| `rifampicin__warfarin` | warfarin ↔ rifampicin | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Anticipate a substantial warfarin dose increase with frequent INR duri | H | ☐ |
| `rifampicin__verapamil` | verapamil ↔ rifampicin | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Oral verapamil may become ineffective; consider an alternative agent l | H | ☐ |
| `rifampicin__systemic_corticosteroid` | systemic_corticosteroid ↔ rifampicin | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Corticosteroid dose commonly needs roughly doubling during rifamycin t | H | ☐ |
| `rifampicin__sulfonylurea` | sulfonylurea ↔ rifampicin | pk_perpetrator | moderate | hepatic:hepatic_impaired→moderate(base) | supply_with_counselling | Anticipate loss of glycaemic control; monitor glucose and adjust antid | M | ☐ |
| `rifampicin__antiretroviral` | antiretroviral ↔ rifampicin | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | withhold_and_clarify | HIV and TB specialists must select a compatible regimen, often substit | H | ☐ |
| `carbamazepine__calcineurin_inhibitor` | calcineurin_inhibitor ↔ carbamazepine | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Anticipate higher immunosuppressant doses with frequent therapeutic dr | H | ☐ |
| `carbamazepine__warfarin` | warfarin ↔ carbamazepine | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Anticipate a higher warfarin requirement with frequent INR, and a dose | H | ☐ |
| `carbamazepine__verapamil` | verapamil ↔ carbamazepine | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | If verapamil is added to carbamazepine, monitor for carbamazepine toxi | M | ☐ |
| `carbamazepine__systemic_corticosteroid` | systemic_corticosteroid ↔ carbamazepine | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Corticosteroid dose may need increasing during carbamazepine therapy;  | H | ☐ |
| `carbamazepine__sulfonylurea` | sulfonylurea ↔ carbamazepine | pk_perpetrator | moderate | hepatic:hepatic_impaired→moderate(base) | supply_with_counselling | Anticipate reduced glycaemic control; monitor glucose and adjust antid | M | ☐ |
| `carbamazepine__antiretroviral` | antiretroviral ↔ carbamazepine | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | withhold_and_clarify | HIV and neurology specialists must reconcile; prefer a non-enzyme-indu | H | ☐ |
| `carbamazepine__direct_oral_anticoagulant` | direct_oral_anticoagulant ↔ carbamazepine | pk_perpetrator | major | renal:crcl_lt_30→major(escalate); hepatic:hepatic_impaired→major(base) | confirm_and_monitor | A DOAC with a strong dual inducer is generally to be avoided per label | H | ☐ |
| `carbamazepine__autoinduction` | carbamazepine ↔ carbamazepine | pk_perpetrator | moderate | hepatic:hepatic_impaired→moderate(base) | supply_with_counselling | Titrate carbamazepine gradually and recheck levels about 2-4 weeks aft | H | ☐ |
| `carbamazepine__valproate` | valproate ↔ carbamazepine | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Neurology to monitor both agents; be aware epoxide toxicity is not ref | H | ☐ |
| `carbamazepine__lamotrigine` | lamotrigine ↔ carbamazepine | pk_perpetrator | moderate | hepatic:hepatic_impaired→moderate(base) | confirm_and_monitor | Lamotrigine often needs a higher maintenance dose with carbamazepine;  | M | ☐ |
| `st_johns_wort__cyp3a4_pgp_substrate` | narrow_ti_cyp3a4_pgp_substrate ↔ st_johns_wort | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | supply_with_counselling | Advise against St John's Wort with these agents and refer; if already  | H | ☐ |

## I. Absorption/GI

| id | ↔ | basis | sev | context | dispense | prescriber | conf | ☐ |
|--|--|--|--|--|--|--|--|--|
| `ciprofloxacin__polyvalent_cation` | ciprofloxacin ↔ polyvalent_cation | pk_perpetrator | moderate | — | space_doses |  | H | ☐ |
| `levofloxacin__polyvalent_cation` | levofloxacin ↔ polyvalent_cation | pk_perpetrator | moderate | — | space_doses |  | H | ☐ |
| `moxifloxacin__polyvalent_cation` | moxifloxacin ↔ polyvalent_cation | pk_perpetrator | moderate | — | space_doses |  | H | ☐ |
| `doxycycline__polyvalent_cation` | doxycycline ↔ polyvalent_cation | pk_perpetrator | moderate | — | space_doses |  | H | ☐ |
| `levothyroxine__oral_cation_binder` | levothyroxine ↔ oral_cation_binder | pk_perpetrator | moderate | — | space_doses |  | H | ☐ |
| `levothyroxine__acid_suppressant` | levothyroxine ↔ acid_suppressant | pk_perpetrator | moderate | — | supply_with_counselling | Recheck TSH after starting, stopping or changing acid-suppressant ther | H | ☐ |
| `alendronate__oral_cation_food` | alendronate ↔ oral_polyvalent_cation_or_food | pk_perpetrator | moderate | — | space_doses |  | H | ☐ |
| `risedronate__oral_cation_food` | risedronate ↔ oral_polyvalent_cation_or_food | pk_perpetrator | moderate | — | space_doses |  | H | ☐ |
| `ibandronate__oral_cation_food` | ibandronate ↔ oral_polyvalent_cation_or_food | pk_perpetrator | moderate | — | space_doses |  | H | ☐ |
| `atazanavir__acid_suppressant` | atazanavir ↔ acid_suppressant | pk_perpetrator | major | — | withhold_and_clarify | Confirm the regimen with the HIV prescriber before supplying the acid  | H | ☐ |
| `rilpivirine__proton_pump_inhibitor` | rilpivirine ↔ proton_pump_inhibitor | contraindication | contraindicated | — | withhold_and_clarify | PPIs are contraindicated with rilpivirine — do not supply the PPI alon | H | ☐ |
| `erlotinib__acid_suppressant` | erlotinib ↔ acid_suppressant | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | withhold_and_clarify | Avoid PPIs where possible; clarify the acid-reducing plan with oncolog | H | ☐ |
| `dasatinib__acid_suppressant` | dasatinib ↔ acid_suppressant | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | withhold_and_clarify | PPIs and H2-antagonists are not recommended with dasatinib; if acid re | H | ☐ |
| `ketoconazole_oral__acid_suppressant` | ketoconazole ↔ acid_suppressant | pk_perpetrator | moderate | hepatic:hepatic_impaired→moderate(base) | withhold_and_clarify | If acid reduction is unavoidable, the ketoconazole tablet should be ta | M | ☐ |
| `itraconazole_capsule__acid_suppressant` | itraconazole ↔ acid_suppressant | pk_perpetrator | moderate | hepatic:hepatic_impaired→moderate(base) | withhold_and_clarify | If acid reduction is unavoidable, itraconazole capsules should be take | M | ☐ |
| `itraconazole_oral_solution__acid_suppressant` | itraconazole ↔ acid_suppressant | pk_perpetrator | moderate | hepatic:hepatic_impaired→moderate(base) | supply_with_counselling |  | M | ☐ |

## J. Endocrine/misc

| id | ↔ | basis | sev | context | dispense | prescriber | conf | ☐ |
|--|--|--|--|--|--|--|--|--|
| `sulfonylurea__fluconazole` | sulfonylurea ↔ fluconazole | pk_perpetrator | major | renal:egfr_lt_30→major(base); hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Confirm the antifungal is intended alongside the sulfonylurea; conside | H | ☐ |
| `sulfonylurea__co_trimoxazole` | sulfonylurea ↔ co-trimoxazole | pk_perpetrator | major | renal:egfr_lt_30→major(base); hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Confirm the antibiotic is intended alongside the sulfonylurea; conside | H | ☐ |
| `sulfonylurea__gemfibrozil` | sulfonylurea ↔ gemfibrozil | pk_perpetrator | moderate | renal:egfr_lt_30→major(base); hepatic:hepatic_impaired→major(base) | confirm_and_monitor | Where a fibrate is needed, review whether a non-gemfibrozil fibrate is | M | ☐ |
| `sulfonylurea__alcohol` | sulfonylurea ↔ alcohol (ethanol) | additive_pd | major | hepatic:hepatic_impaired→major(base) | supply_with_counselling | No routine dose change; reinforce alcohol-and-hypoglycaemia counsellin | M | ☐ |
| `sulfonylurea__miconazole_oromucosal_gel` | sulfonylurea ↔ miconazole | contraindication | contraindicated | renal:egfr_lt_30→contraindicated(base); hepatic:hepatic_impaired→contraindicated(base) | withhold_and_clarify | Under UK/EU labelling this pairing is contraindicated for selected sul | M | ☐ |
| `metformin__iodinated_contrast_media` | metformin ↔ iodinated_contrast_media | additive_pd | major | renal:egfr_lt_30→contraindicated(base); renal:egfr_lt_60→major(escalate); renal:egfr_ge_60→moderate(escalate) | supply_with_counselling | Metformin need not be stopped for all contrast. Follow imaging protoco | H | ☐ |
| `thiopurine__allopurinol` | thiopurine ↔ allopurinol | pk_perpetrator | major | renal:egfr_lt_30→major(base); hepatic:hepatic_impaired→major(base) | withhold_and_clarify | Do not add the second agent without a plan: reduce the thiopurine to a | H | ☐ |
| `theophylline__cyp1a2_inhibitor` | xanthine_bronchodilator ↔ cyp1a2_inhibitor [strong/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired→major(base) | withhold_and_clarify | Prefer a non-interacting alternative (e.g. an antibiotic that does not | H | ☐ |
| `potassium_chloride_solid_oral__gi_transit_slowing` | potassium chloride ↔ gi_transit_slowing_agent | contraindication | contraindicated | — | withhold_and_clarify | For solid modified-release/wax-matrix KCl plus an agent that markedly  | M | ☐ |
