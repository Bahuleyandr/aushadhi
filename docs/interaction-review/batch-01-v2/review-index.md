# Batch 1 v2 - Review Index

199 draft rules; 0 runtime-enabled; 39 matcher-inert. Every rule remains promotion-ineligible.

Runtime `off` rows are diagnostic-only. A `pair matcher` value of `no` means the rule cannot emit even in draft review.

## A. Anticoagulant/antiplatelet

| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |
|--|--|--|--|--|--|--|--|--|--|
| `warfarin__nsaid_systemic` | warfarin <-> nsaid | additive_pd | major | hepatic:hepatic_impaired->major/-(base) | withhold_and_clarify | off | yes | US | H |
| `warfarin__aspirin_analgesic_antiplatelet` | warfarin <-> aspirin | additive_pd | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | off | yes | US | H |
| `warfarin__fluconazole` | warfarin <-> fluconazole | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `warfarin__miconazole_oromucosal_gel` | warfarin <-> miconazole | pk_perpetrator | major | - | withhold_and_clarify | off | yes | UK | H |
| `warfarin__ketoconazole_oral` | warfarin <-> ketoconazole | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `warfarin__voriconazole` | warfarin <-> voriconazole | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `warfarin__macrolide_cyp_inhibitor` | warfarin <-> macrolide_cyp3a_inhibitor [moderate/strong] | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | off | yes | US | H |
| `warfarin__metronidazole` | warfarin <-> metronidazole | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `warfarin__cotrimoxazole` | warfarin <-> co-trimoxazole | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | off | no | US | H |
| `warfarin__amiodarone` | warfarin <-> amiodarone | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `warfarin__fluoroquinolone` | warfarin <-> fluoroquinolone | observed_clinical_multifactorial | moderate | - | supply_with_counselling | off | yes | US | H |
| `warfarin__ssri_snri` | warfarin <-> ssri_snri | additive_pd | moderate | - | supply_with_counselling | off | yes | US | H |
| `warfarin__tramadol` | warfarin <-> tramadol | observed_clinical_multifactorial | major | - | confirm_and_monitor | off | yes | UK | M |
| `warfarin__rifampicin` | warfarin <-> rifampicin | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `warfarin__azithromycin_oral` | warfarin <-> azithromycin | observed_clinical_multifactorial | moderate | - | supply_with_counselling | off | yes | US | M |
| `apixaban__strong_cyp3a4_pgp_inhibitor` | apixaban <-> cyp3a4_pgp_inhibitor [strong] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | M |
| `rivaroxaban__strong_cyp3a4_pgp_inhibitor` | rivaroxaban <-> cyp3a4_pgp_inhibitor [strong] | pk_perpetrator | major | hepatic:child_pugh_b->major/withhold_and_clarify(base); hepatic:child_pugh_c->major/withhold_and_clarify(base) | withhold_and_clarify | off | yes | US | H |
| `rivaroxaban__hepatic_impairment_child_pugh_b_c` | rivaroxaban <-> condition only | contraindication | major | hepatic:child_pugh_b->major/withhold_and_clarify(base); hepatic:child_pugh_c->major/withhold_and_clarify(base) | withhold_and_clarify | off | no | US | H |
| `apixaban__strong_cyp3a4_pgp_inducer` | apixaban <-> cyp3a4_pgp_inducer [strong] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `rivaroxaban__strong_cyp3a4_pgp_inducer` | rivaroxaban <-> cyp3a4_pgp_inducer [strong] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `dabigatran__pgp_inducer` | dabigatran <-> pgp_inducer [strong] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `edoxaban__pgp_inducer` | edoxaban <-> rifampicin | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | M |
| `dabigatran_nvaf__dronedarone_or_ketoconazole` | dabigatran <-> pgp_inhibitor | pk_perpetrator | moderate | renal:crcl_30_to_50->major/confirm_and_monitor(escalate); renal:crcl_lt_30->major/withhold_and_clarify(escalate) | confirm_and_monitor | off | yes | US | M |
| `dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor` | dabigatran <-> pgp_inhibitor | pk_perpetrator | minor | - | supply_with_counselling | off | yes | US | M |
| `dabigatran_vte__pgp_inhibitor` | dabigatran <-> pgp_inhibitor | pk_perpetrator | moderate | renal:crcl_lt_50->major/withhold_and_clarify(escalate) | confirm_and_monitor | off | yes | US | M |
| `dabigatran_hip_prophylaxis__pgp_inhibitor` | dabigatran <-> pgp_inhibitor | pk_perpetrator | moderate | renal:crcl_lt_50->major/withhold_and_clarify(escalate) | confirm_and_monitor | off | yes | US | M |
| `clopidogrel__cyp2c19_inhibiting_ppi` | clopidogrel <-> cyp2c19_inhibiting_ppi | pk_perpetrator | moderate | - | withhold_and_clarify | off | yes | US | H |
| `aspirin_ld_ir__ibuprofen_timing` | aspirin <-> ibuprofen | additive_pd | minor | - | space_doses | off | no | unresolved | H |
| `aspirin__ibuprofen_additive_gi_bleeding` | aspirin <-> ibuprofen | additive_pd | moderate | - | withhold_and_clarify | off | no | US | H |
| `aspirin__nsaid_additive_gi_bleeding` | aspirin <-> nsaid | additive_pd | minor | - | supply_with_counselling | off | no | unresolved | H |
| `dual_antiplatelet__oral_anticoagulant_triple_therapy` | aspirin + p2y12_inhibitor <-> oral_anticoagulant | additive_pd | major | renal:crcl_lt_30->major/-(base); hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | off | no | US | M |
| `ssri_snri__nsaid_additive_gi_bleeding` | ssri_snri <-> nsaid | additive_pd | moderate | renal:egfr_lt_30->moderate/-(base) | supply_with_counselling | off | yes | US | H |
| `heparin_lmwh__nsaid_or_antiplatelet_bleeding` | heparin_lmwh <-> nsaid_or_antiplatelet | additive_pd | major | renal:crcl_lt_30->major/-(base) | confirm_and_monitor | off | yes | US | H |

## B. Statins

| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |
|--|--|--|--|--|--|--|--|--|--|
| `simvastatin_lovastatin__strong_cyp3a4_inhibitor` | cyp3a4_metabolized_statin <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `simvastatin__gemfibrozil` | simvastatin <-> gemfibrozil | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | M |
| `lovastatin__gemfibrozil` | lovastatin <-> gemfibrozil | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `statin__fenofibrate` | statin <-> fenofibrate | additive_pd | major | renal:egfr_lt_30->major/withhold_and_clarify(base) | confirm_and_monitor | off | yes | US | M |
| `simvastatin__amiodarone` | simvastatin <-> amiodarone [moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `simvastatin__verapamil_diltiazem` | simvastatin <-> non_dhp_ccb [moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `simvastatin__amlodipine` | simvastatin <-> amlodipine | pk_perpetrator | moderate | - | confirm_and_monitor | off | yes | US | H |
| `atorvastatin__strong_cyp3a4_inhibitor` | atorvastatin <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | M |
| `simvastatin__ciclosporin` | simvastatin <-> ciclosporin | pk_perpetrator | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `lovastatin__ciclosporin` | lovastatin <-> ciclosporin | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | M |
| `atorvastatin__ciclosporin` | atorvastatin <-> ciclosporin | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | M |
| `pitavastatin__ciclosporin` | pitavastatin <-> ciclosporin | pk_perpetrator | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `pravastatin__ciclosporin` | pravastatin <-> ciclosporin | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | M |
| `fluvastatin__ciclosporin` | fluvastatin <-> ciclosporin | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | M |
| `rosuvastatin__ciclosporin` | rosuvastatin <-> ciclosporin | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `simvastatin_lovastatin__hiv_pi_cobicistat` | cyp3a4_metabolized_statin <-> hiv_protease_inhibitor_or_pk_booster | contraindication | contraindicated | - | withhold_and_clarify | off | no | US | H |
| `atorvastatin__hiv_pi_cobicistat` | atorvastatin <-> hiv_protease_inhibitor_or_pk_booster [strong/moderate] | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | M |
| `rosuvastatin__hiv_pi_cobicistat` | rosuvastatin <-> hiv_protease_inhibitor_or_pk_booster [strong/moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | no | US | M |
| `pravastatin__hiv_pi_cobicistat` | pravastatin <-> hiv_protease_inhibitor_or_pk_booster [strong/moderate] | pk_perpetrator | moderate | - | supply_with_counselling | off | no | US | M |
| `pitavastatin__hiv_pi_cobicistat` | pitavastatin <-> hiv_protease_inhibitor_or_pk_booster [strong/moderate] | pk_perpetrator | moderate | - | supply_with_counselling | off | no | US | M |

## C. Serotonin/CNS

| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |
|--|--|--|--|--|--|--|--|--|--|
| `ssri_snri__maoi_nonselective` | ssri_or_snri <-> maoi_nonselective | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `ssri_snri__methylene_blue_iv` | ssri_or_snri <-> methylene_blue | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | M |
| `tramadol__serotonergic_antidepressant` | tramadol <-> serotonergic_antidepressant_ssri_snri_tca | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `tramadol__ssri_tca_seizure_risk` | tramadol <-> ssri_or_tca_seizure_risk | observed_clinical_multifactorial | major | - | confirm_and_monitor | off | yes | US | H |
| `pethidine_tramadol__maoi_nonselective` | serotonergic_opioid_pethidine_tramadol <-> maoi_nonselective | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `linezolid__serotonergic_agent` | linezolid <-> linezolid_serotonergic_agent | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `tramadol__linezolid` | tramadol <-> linezolid | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `pethidine__linezolid` | pethidine <-> linezolid | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `bupropion__linezolid_directional` | bupropion <-> linezolid | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `triptan_mao_metabolized__maoi_mao_a` | triptan_mao_a_metabolized <-> maoi_mao_a_inhibitor | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | M |
| `ssri_snri__triptan` | ssri_or_snri <-> triptan | additive_pd | moderate | - | supply_with_counselling | off | yes | US | M |
| `dextromethorphan__maoi_nonselective` | dextromethorphan <-> maoi_nonselective | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `dextromethorphan__ssri_snri` | dextromethorphan <-> ssri_or_snri | additive_pd | moderate | - | supply_with_counselling | off | yes | US | M |
| `opioid__benzodiazepine_cns_depressant` | opioid <-> benzodiazepine_or_z_drug | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `opioid__gabapentinoid` | opioid <-> gabapentinoid | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `benzodiazepine_zdrug__alcohol` | benzodiazepine_or_z_drug <-> alcohol | additive_pd | major | - | supply_with_counselling | off | yes | US | H |
| `maoi_nonselective__sympathomimetic` | maoi_nonselective <-> sympathomimetic_indirect_otc_decongestant | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `maoi_nonselective__direct_sympathomimetic` | maoi_nonselective <-> sympathomimetic_direct_and_indirect | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | M |
| `lithium__ssri_snri` | lithium <-> ssri_or_snri | additive_pd | moderate | - | confirm_and_monitor | off | yes | US | M |
| `bupropion__maoi_nonselective` | bupropion <-> maoi_nonselective | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `sedating_antihistamine__cns_depressant` | sedating_antihistamine <-> cns_depressant | additive_pd | moderate | - | supply_with_counselling | off | yes | US | H |

## D. QT/arrhythmia

| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |
|--|--|--|--|--|--|--|--|--|--|
| `qt_macrolide__qt_prolonging_drug` | macrolide_qt <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `citalopram__qt_prolonging_drug` | citalopram <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `escitalopram__qt_prolonging_drug` | escitalopram <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `domperidone__potent_cyp3a4_inhibitor` | domperidone <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | off | yes | UK | H |
| `domperidone__moderate_cyp3a4_inhibitor` | domperidone <-> cyp3a4_inhibitor [moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | UK | H |
| `domperidone__qt_prolonging_drug` | domperidone <-> qt_prolonging_drug | contraindication | contraindicated | - | withhold_and_clarify | off | yes | UK | H |
| `ondansetron__apomorphine` | ondansetron <-> apomorphine | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `ondansetron__qt_prolonging_drug` | ondansetron <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `haloperidol_iv_or_above_recommended_dose__qt_prolonging_drug` | haloperidol <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `haloperidol_oral__qt_prolonging_drug` | haloperidol <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | off | yes | US | M |
| `ziprasidone__qt_prolonging_drug` | ziprasidone <-> qt_prolonging_drug | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `methadone__qt_prolonging_drug` | methadone <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `methadone__cyp_inhibitor` | methadone <-> methadone_relevant_cyp_inhibitor [potent/moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `hydroxychloroquine__qt_prolonging_drug` | hydroxychloroquine <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | off | yes | US | M |

## E. Bradycardia/AV

| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |
|--|--|--|--|--|--|--|--|--|--|
| `beta_blocker__non_dihydropyridine_ccb` | beta_blocker <-> non_dihydropyridine_ccb | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `beta_blocker__clonidine` | beta_blocker <-> clonidine | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `digoxin__verapamil` | digoxin <-> verapamil | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `digoxin__amiodarone` | digoxin <-> amiodarone | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `digoxin__dronedarone` | digoxin <-> dronedarone | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `digoxin__clarithromycin` | digoxin <-> clarithromycin | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `digoxin__diltiazem` | digoxin <-> diltiazem | pk_perpetrator | moderate | - | confirm_and_monitor | off | yes | US | H |
| `digoxin__renal_impairment_accumulation` | digoxin <-> condition only | condition_only | major | - | confirm_and_monitor | off | no | US | H |
| `digoxin__potassium_wasting_diuretic` | digoxin <-> potassium_wasting_diuretic | additive_pd | moderate | - | confirm_and_monitor | off | yes | US | H |
| `ivabradine__ordinary_negative_chronotrope` | ivabradine <-> ordinary_negative_chronotrope | additive_pd | moderate | - | confirm_and_monitor | off | yes | US | M |
| `ivabradine__qt_active_antiarrhythmic` | ivabradine <-> qt_active_antiarrhythmic | additive_pd | major | - | confirm_and_monitor | off | no | unresolved | M |
| `adenosine__dipyridamole` | adenosine <-> dipyridamole | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | M |

## F. Hyperkalaemia/renal

| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |
|--|--|--|--|--|--|--|--|--|--|
| `acei_arb__mra_spironolactone_eplerenone` | acei_arb <-> mineralocorticoid_receptor_antagonist | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `acei_arb__amiloride` | acei_arb <-> epithelial_sodium_channel_blocker | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `acei_arb__potassium_supplement_salt_substitute` | lisinopril <-> potassium_supplement_or_salt_substitute | additive_pd | major | - | confirm_and_monitor | off | yes | US | H |
| `acei_arb__nsaid_systemic` | acei_arb <-> nsaid | additive_pd | moderate | - | confirm_and_monitor | off | yes | US | H |
| `acei_arb_diuretic__nsaid_triple_whammy` | acei_arb + diuretic <-> nsaid | contextual_review_hypothesis | major | - | confirm_and_monitor | off | no | unresolved | H |
| `acei__arb_dual_raas_blockade` | acei <-> arb | additive_pd | major | - | withhold_and_clarify | off | yes | US | H |
| `cotrimoxazole__ace_inhibitor` | trimethoprim_or_cotrimoxazole <-> acei | additive_pd | major | - | withhold_and_clarify | off | no | US | H |
| `cotrimoxazole__other_potassium_raising_agent` | trimethoprim_or_cotrimoxazole <-> potassium_raising_agent | additive_pd | major | - | confirm_and_monitor | off | no | US | H |
| `lithium__nsaid_systemic` | lithium <-> nsaid | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `lithium__acei_arb` | lithium <-> acei_arb | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `lithium__thiazide_diuretic` | lithium <-> thiazide_diuretic | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `gentamicin__furosemide` | gentamicin <-> furosemide | additive_pd | major | - | withhold_and_clarify | off | yes | US | H |
| `methotrexate_high_dose__nsaid_systemic` | methotrexate <-> nsaid | pk_perpetrator | major | - | confirm_and_monitor | off | no | unresolved | H |
| `methotrexate_lower_dose__nsaid_systemic` | methotrexate <-> nsaid | pk_perpetrator | moderate | - | confirm_and_monitor | off | no | US | H |
| `methotrexate__cotrimoxazole` | methotrexate <-> trimethoprim_or_cotrimoxazole | additive_pd | major | - | confirm_and_monitor | off | no | unresolved | H |
| `methotrexate_high_dose__ppi` | methotrexate <-> proton_pump_inhibitor | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | M |

## G. CYP3A4/P-gp

| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |
|--|--|--|--|--|--|--|--|--|--|
| `colchicine__strong_cyp3a4_pgp_inhibitor` | colchicine <-> dual_cyp3a4_pgp_inhibitor [strong] | pk_perpetrator | major | hepatic:hepatic_impaired->contraindicated/withhold_and_clarify(escalate) | withhold_and_clarify | off | no | US | H |
| `ergotamine_dihydroergotamine__strong_cyp3a4_inhibitor` | ergotamine_or_dihydroergotamine <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `ergotamine__label_contraindicated_cyp3a4_inhibitor` | ergotamine <-> ergotamine_label_contraindicated_cyp3a4_inhibitor [label_contraindicated] | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `methylergonovine__strong_cyp3a4_inhibitor` | methylergonovine <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | M |
| `methylergonovine__moderate_cyp3a4_inhibitor` | methylergonovine <-> cyp3a4_inhibitor [moderate] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `pimozide__cyp3a4_inhibitor` | pimozide <-> pimozide_label_contraindicated_inhibitor [label_named_contraindicated] | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `pimozide__label_avoid_inhibitor` | pimozide <-> pimozide_label_avoid_inhibitor [label_named_avoid] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | M |
| `tacrolimus__cyp3a4_inhibitor` | tacrolimus <-> cyp3a4_inhibitor [strong/moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | no | US | H |
| `ciclosporin__cyp3a4_inhibitor` | ciclosporin <-> cyp3a4_inhibitor [strong/moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | no | US | H |
| `sirolimus__strong_cyp3a4_pgp_inhibitor` | sirolimus <-> dual_cyp3a4_pgp_inhibitor [strong] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `sirolimus__label_avoid_cyp3a4_pgp_inhibitor` | sirolimus <-> sirolimus_label_avoid_cyp3a4_pgp_inhibitor [label_avoid] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `sirolimus__erythromycin` | sirolimus <-> erythromycin [victim_label_strong_example] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `sirolimus__moderate_cyp3a4_pgp_inhibitor` | sirolimus <-> dual_cyp3a4_pgp_inhibitor [moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `calcineurin_inhibitor__other_cyp3a4_inducer` | calcineurin_inhibitor <-> cyp3a4_inducer [strong/moderate/victim_label_named] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `sildenafil_pah__strong_cyp3a4_inhibitor` | sildenafil <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `tadalafil_pah__strong_cyp3a4_inhibitor` | tadalafil <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `tadalafil_pah__ritonavir_sequence` | tadalafil <-> ritonavir [sequence_dependent] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `triazolam__potent_cyp3a4_inhibitor` | triazolam <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `oral_midazolam__potent_cyp3a4_inhibitor` | midazolam <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `parenteral_midazolam__potent_cyp3a4_inhibitor` | midazolam <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `dihydropyridine_ccb__strong_cyp3a4_inhibitor` | dihydropyridine_ccb <-> cyp3a4_inhibitor [strong] | unresolved_no_licence_cleared_evidence | minor | - | withhold_and_clarify | off | no | unresolved | M |
| `apixaban__pgp_moderate_cyp3a4_inhibitor` | apixaban <-> cyp3a4_inhibitor [moderate] | unresolved_no_licence_cleared_evidence | minor | - | withhold_and_clarify | off | no | unresolved | M |
| `rivaroxaban__pgp_moderate_cyp3a4_inhibitor` | rivaroxaban <-> rivaroxaban_reviewed_moderate_interacting_agent [member_specific] | pk_perpetrator | moderate | - | confirm_and_monitor | off | yes | US | M |
| `grapefruit__sensitive_cyp3a4_substrate` | grapefruit_sensitive_cyp3a4_substrate <-> grapefruit [gut_cyp3a4_inhibitor] | pk_perpetrator | moderate | - | supply_with_counselling | off | yes | US | H |
| `ivabradine__strong_cyp3a4_inhibitor` | ivabradine <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | M |
| `ivabradine__moderate_cyp3a4_inhibitor` | ivabradine <-> cyp3a4_inhibitor [moderate] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | M |
| `ranolazine__strong_cyp3a4_inhibitor` | ranolazine <-> ranolazine_label_strong_cyp3a4_inhibitor [label_named_strong] | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | M |
| `ranolazine__moderate_cyp3a4_inhibitor` | ranolazine <-> cyp3a4_inhibitor [moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | M |

## H. Enzyme induction

| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |
|--|--|--|--|--|--|--|--|--|--|
| `rifampicin__hormonal_contraceptive` | hormonal_contraceptive_induction_sensitive <-> rifamycin_enzyme_inducer [potent_inducer] | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | H |
| `rifabutin__etonogestrel_implant` | etonogestrel implant <-> rifabutin | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | H |
| `enzyme_inducing_antiepileptic__hormonal_contraceptive` | hormonal_contraceptive_induction_sensitive <-> enzyme_inducing_antiepileptic [strong_inducer] | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | H |
| `phenytoin__etonogestrel_implant` | etonogestrel implant <-> phenytoin | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | H |
| `rifampicin__calcineurin_inhibitor` | calcineurin_inhibitor <-> rifampicin [potent_inducer] | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | H |
| `rifampicin__verapamil` | verapamil <-> rifampicin [potent_inducer] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `rifampicin__systemic_corticosteroid` | systemic_corticosteroid <-> rifampicin [potent_inducer] | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | H |
| `rifampicin__sulfonylurea` | sulfonylurea <-> rifampicin [potent_inducer] | pk_perpetrator | moderate | - | confirm_and_monitor | off | yes | US | M |
| `rifampicin__antiretroviral` | antiretroviral <-> rifampicin [potent_inducer] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `carbamazepine__calcineurin_inhibitor` | calcineurin_inhibitor <-> carbamazepine [strong_inducer] | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | H |
| `carbamazepine__warfarin` | warfarin <-> carbamazepine [strong_inducer] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `carbamazepine__verapamil` | carbamazepine <-> verapamil | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | M |
| `carbamazepine__systemic_corticosteroid` | systemic_corticosteroid <-> carbamazepine [strong_inducer] | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | H |
| `carbamazepine__sulfonylurea` | sulfonylurea <-> carbamazepine [strong_inducer] | pk_perpetrator | moderate | - | confirm_and_monitor | off | yes | US | M |
| `carbamazepine__antiretroviral` | antiretroviral <-> carbamazepine [strong_inducer] | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `carbamazepine__valproate` | valproate_product <-> carbamazepine [strong_inducer] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `carbamazepine__lamotrigine` | lamotrigine <-> carbamazepine [strong_inducer] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | M |
| `st_johns_wort__cyp3a4_pgp_substrate` | st_johns_wort_high_consequence_victim <-> st john's wort [inducer_variable_hyperforin] | unresolved_no_licence_cleared_evidence | minor | - | withhold_and_clarify | off | no | unresolved | H |
| `st_johns_wort__calcineurin_inhibitor` | calcineurin_inhibitor <-> st john's wort [inducer_variable_hyperforin] | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | H |

## I. Absorption/GI

| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |
|--|--|--|--|--|--|--|--|--|--|
| `ciprofloxacin__polyvalent_cation` | ciprofloxacin <-> polyvalent_cation | pk_perpetrator | moderate | - | space_doses | off | yes | US | H |
| `levofloxacin__polyvalent_cation` | levofloxacin <-> polyvalent_cation | pk_perpetrator | moderate | - | space_doses | off | yes | US | H |
| `moxifloxacin__polyvalent_cation` | moxifloxacin <-> polyvalent_cation | pk_perpetrator | moderate | - | space_doses | off | yes | US | H |
| `doxycycline__polyvalent_cation` | doxycycline <-> polyvalent_cation | pk_perpetrator | moderate | - | confirm_and_monitor | off | yes | unresolved | H |
| `levothyroxine__oral_cation_binder` | levothyroxine <-> oral_cation_binder | pk_perpetrator | moderate | - | space_doses | off | yes | US | H |
| `levothyroxine__acid_suppressant` | levothyroxine <-> proton_pump_inhibitor | pk_perpetrator | moderate | - | supply_with_counselling | off | yes | US | H |
| `alendronate__oral_cation_food` | alendronate <-> oral_polyvalent_cation_or_food | pk_perpetrator | moderate | - | space_doses | off | yes | US | H |
| `risedronate_immediate_release__oral_cation_food` | risedronate <-> oral_polyvalent_cation_or_food | pk_perpetrator | moderate | - | space_doses | off | yes | US | H |
| `risedronate_delayed_release__oral_cation_food` | risedronate <-> oral_polyvalent_cation_or_food | pk_perpetrator | moderate | - | space_doses | off | yes | US | H |
| `ibandronate__oral_cation_food` | ibandronate <-> oral_polyvalent_cation_or_food | pk_perpetrator | moderate | - | space_doses | off | yes | US | H |
| `atazanavir__proton_pump_inhibitor` | atazanavir <-> proton_pump_inhibitor | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `atazanavir__h2_receptor_antagonist` | atazanavir <-> acid_suppressant | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `atazanavir__antacid_buffered_product` | atazanavir <-> acid_suppressant | pk_perpetrator | major | - | space_doses | off | yes | US | H |
| `rilpivirine__proton_pump_inhibitor` | rilpivirine <-> proton_pump_inhibitor | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | H |
| `erlotinib__proton_pump_inhibitor` | erlotinib <-> proton_pump_inhibitor | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `erlotinib__h2_receptor_antagonist` | erlotinib <-> acid_suppressant | pk_perpetrator | major | - | space_doses | off | yes | US | H |
| `erlotinib__antacid` | erlotinib <-> acid_suppressant | pk_perpetrator | major | - | space_doses | off | yes | US | H |
| `dasatinib__proton_pump_inhibitor` | dasatinib <-> proton_pump_inhibitor | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `dasatinib__h2_receptor_antagonist` | dasatinib <-> acid_suppressant | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `dasatinib_sprycel__antacid` | dasatinib <-> acid_suppressant | pk_perpetrator | major | - | space_doses | off | no | US | H |
| `dasatinib_phyrago__antacid` | dasatinib <-> acid_suppressant | pk_perpetrator | major | - | withhold_and_clarify | off | no | US | H |
| `ketoconazole_oral__acid_suppressant` | ketoconazole <-> acid_suppressant | pk_perpetrator | moderate | - | withhold_and_clarify | off | yes | US | M |
| `itraconazole_capsule__acid_suppressant` | itraconazole <-> acid_suppressant | pk_perpetrator | moderate | - | withhold_and_clarify | off | yes | US | M |
| `itraconazole_tolsura__acid_reducer` | itraconazole <-> acid_suppressant | pk_perpetrator | moderate | - | confirm_and_monitor | off | no | US | H |

## J. Endocrine/misc

| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |
|--|--|--|--|--|--|--|--|--|--|
| `sulfonylurea__fluconazole` | sulfonylurea <-> fluconazole [moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `sulfonylurea__co_trimoxazole` | sulfonylurea <-> trimethoprim_or_cotrimoxazole [moderate] | pk_perpetrator | major | - | confirm_and_monitor | off | no | US | H |
| `sulfonylurea__gemfibrozil` | sulfonylurea <-> gemfibrozil [moderate] | pk_perpetrator | moderate | - | confirm_and_monitor | off | yes | US | M |
| `sulfonylurea__alcohol` | sulfonylurea <-> alcohol | additive_pd | major | - | supply_with_counselling | off | yes | US | M |
| `sulfonylurea__miconazole_candidate` | sulfonylurea <-> miconazole [strong] | unresolved_no_licence_cleared_evidence | minor | - | withhold_and_clarify | off | no | unresolved | M |
| `metformin__iodinated_contrast_media` | metformin <-> iodinated_contrast_media | observed_clinical_multifactorial | moderate | renal:egfr_lt_30->contraindicated/withhold_and_clarify(base); renal:egfr_lt_60->major/withhold_and_clarify(base); hepatic:hepatic_impaired->major/withhold_and_clarify(base) | supply_with_counselling | off | yes | US | H |
| `thiopurine__allopurinol` | thiopurine <-> allopurinol | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `theophylline__ciprofloxacin` | theophylline <-> ciprofloxacin | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `theophylline__fluvoxamine` | theophylline <-> fluvoxamine | pk_perpetrator | major | - | withhold_and_clarify | off | yes | US | H |
| `theophylline__cimetidine` | theophylline <-> cimetidine | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `theophylline__mexiletine` | theophylline <-> mexiletine | pk_perpetrator | major | - | confirm_and_monitor | off | yes | US | H |
| `potassium_chloride_solid_oral__gi_transit_slowing` | potassium chloride <-> gi_transit_slowing_agent | contraindication | contraindicated | - | withhold_and_clarify | off | yes | US | M |
