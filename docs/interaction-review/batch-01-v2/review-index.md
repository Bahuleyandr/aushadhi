# Batch 1 v2 - Review Index (post index-review fixes)

158 rules (7 R removed; contraindication->withhold enforced). context = factor:when->sev/action(on_unknown).

## A. Anticoagulant/antiplatelet

| id | <-> | basis | sev | context | dispense | conf |
|--|--|--|--|--|--|--|
| `warfarin__nsaid_systemic` | warfarin <-> nsaid | additive_pd | major | renal:egfr_lt_30->major/-(base); hepatic:child_pugh_b->major/-(base) | supply_with_counselling | H |
| `warfarin__aspirin_analgesic_antiplatelet` | warfarin <-> aspirin | additive_pd | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | H |
| `warfarin__fluconazole` | warfarin <-> fluconazole | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | H |
| `warfarin__miconazole_oromucosal_gel` | warfarin <-> miconazole | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | withhold_and_clarify | H |
| `warfarin__ketoconazole_systemic` | warfarin <-> ketoconazole | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | H |
| `warfarin__voriconazole` | warfarin <-> voriconazole | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | H |
| `warfarin__macrolide_cyp_inhibitor` | warfarin <-> macrolide_cyp3a_inhibitor [moderate/strong] | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | H |
| `warfarin__metronidazole_tinidazole` | warfarin <-> nitroimidazole | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | H |
| `warfarin__cotrimoxazole` | warfarin <-> co-trimoxazole | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | H |
| `warfarin__amiodarone` | warfarin <-> amiodarone | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | H |
| `warfarin__fluoroquinolone` | warfarin <-> fluoroquinolone | pk_perpetrator | moderate | - | supply_with_counselling | H |
| `warfarin__ssri_snri` | warfarin <-> ssri_snri | additive_pd | moderate | - | supply_with_counselling | H |
| `warfarin__tramadol` | warfarin <-> tramadol | pk_perpetrator | major | hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | M |
| `warfarin__rifampicin` | warfarin <-> rifampicin | pk_perpetrator | major | - | confirm_and_monitor | H |
| `warfarin__azithromycin_oral` | warfarin <-> azithromycin | pk_perpetrator | moderate | - | supply_with_counselling | M |
| `apixaban__strong_cyp3a4_pgp_inhibitor` | apixaban <-> cyp3a4_pgp_inhibitor [strong] | pk_perpetrator | major | renal:crcl_lt_30->major/withhold_and_clarify(escalate); hepatic:child_pugh_c->major/withhold_and_clarify(escalate) | withhold_and_clarify | H |
| `rivaroxaban__strong_cyp3a4_pgp_inhibitor` | rivaroxaban <-> cyp3a4_pgp_inhibitor [strong] | pk_perpetrator | major | renal:crcl_lt_30->contraindicated/withhold_and_clarify(escalate); hepatic:child_pugh_b->contraindicated/withhold_and_clarify(escalate) | withhold_and_clarify | H |
| `apixaban__strong_cyp3a4_pgp_inducer` | apixaban <-> cyp3a4_pgp_inducer [strong] | pk_perpetrator | major | - | withhold_and_clarify | H |
| `rivaroxaban__strong_cyp3a4_pgp_inducer` | rivaroxaban <-> cyp3a4_pgp_inducer [strong] | pk_perpetrator | major | - | withhold_and_clarify | H |
| `dabigatran__pgp_inducer` | dabigatran <-> pgp_inducer [strong] | pk_perpetrator | major | - | withhold_and_clarify | H |
| `edoxaban__pgp_inducer` | edoxaban <-> pgp_inducer [strong] | pk_perpetrator | major | - | withhold_and_clarify | M |
| `dabigatran__pgp_inhibitor` | dabigatran <-> pgp_inhibitor [strong] | pk_perpetrator | major | renal:crcl_lt_30->contraindicated/withhold_and_clarify(escalate) | confirm_and_monitor | H |
| `clopidogrel__cyp2c19_inhibiting_ppi` | clopidogrel <-> cyp2c19_inhibiting_ppi | pk_perpetrator | moderate | - | confirm_and_monitor | H |
| `aspirin_ld_ir__ibuprofen_timing` | aspirin <-> ibuprofen | additive_pd | moderate | - | space_doses | H |
| `aspirin__nsaid_additive_gi_bleeding` | aspirin <-> nsaid | additive_pd | moderate | renal:egfr_lt_30->moderate/-(base) | supply_with_counselling | H |
| `dual_antiplatelet__oral_anticoagulant_triple_therapy` | aspirin+clopidogrel <-> anticoagulant | additive_pd | major | renal:egfr_lt_30->major/-(base); hepatic:child_pugh_b->major/-(base) | confirm_and_monitor | H |
| `ssri_snri__nsaid_additive_gi_bleeding` | ssri_snri <-> nsaid | additive_pd | moderate | renal:egfr_lt_30->moderate/-(base) | supply_with_counselling | H |
| `heparin_lmwh__nsaid_or_antiplatelet_bleeding` | heparin_lmwh <-> nsaid_or_antiplatelet | additive_pd | major | renal:crcl_lt_30->major/-(base) | confirm_and_monitor | H |

## B. Statins

| id | <-> | basis | sev | context | dispense | conf |
|--|--|--|--|--|--|--|
| `simvastatin_lovastatin__strong_cyp3a4_inhibitor` | cyp3a4_metabolized_statin <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | H |
| `simvastatin_lovastatin__gemfibrozil` | cyp3a4_metabolized_statin <-> gemfibrozil | contraindication | contraindicated | - | withhold_and_clarify | H |
| `statin__fenofibrate` | statin <-> fenofibrate | additive_pd | moderate | renal:egfr_lt_30->major/-(base); hepatic:hepatic_impaired->major/-(base) | supply_with_counselling | H |
| `simvastatin__amiodarone` | simvastatin <-> amiodarone | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `simvastatin__verapamil_diltiazem` | simvastatin <-> non_dhp_ccb [moderate] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `simvastatin__amlodipine` | simvastatin <-> amlodipine | pk_perpetrator | moderate | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `atorvastatin__strong_cyp3a4_inhibitor` | atorvastatin <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | M |
| `simvastatin__ciclosporin` | simvastatin <-> ciclosporin | contraindication | contraindicated | - | withhold_and_clarify | H |
| `lovastatin__ciclosporin` | lovastatin <-> ciclosporin | pk_perpetrator | major | renal:egfr_lt_30->major/-(base) | confirm_and_monitor | M |
| `atorvastatin__ciclosporin` | atorvastatin <-> ciclosporin | pk_perpetrator | major | renal:egfr_lt_30->major/-(base) | confirm_and_monitor | M |
| `pitavastatin__ciclosporin` | pitavastatin <-> ciclosporin | contraindication | contraindicated | - | withhold_and_clarify | H |
| `pravastatin__ciclosporin` | pravastatin <-> ciclosporin | pk_perpetrator | major | - | confirm_and_monitor | M |
| `fluvastatin__ciclosporin` | fluvastatin <-> ciclosporin | pk_perpetrator | major | - | confirm_and_monitor | M |
| `rosuvastatin__ciclosporin` | rosuvastatin <-> ciclosporin | pk_perpetrator | major | renal:egfr_lt_30->major/-(base) | confirm_and_monitor | H |
| `simvastatin_lovastatin__hiv_pi_cobicistat` | cyp3a4_metabolized_statin <-> hiv_protease_inhibitor_or_pk_booster [strong] | contraindication | contraindicated | - | withhold_and_clarify | H |
| `atorvastatin__hiv_pi_cobicistat` | atorvastatin <-> hiv_protease_inhibitor_or_pk_booster [strong/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | M |
| `rosuvastatin__hiv_pi_cobicistat` | rosuvastatin <-> hiv_protease_inhibitor_or_pk_booster [strong/moderate] | pk_perpetrator | major | - | confirm_and_monitor | M |
| `pravastatin__hiv_pi_cobicistat` | pravastatin <-> hiv_protease_inhibitor_or_pk_booster [moderate] | pk_perpetrator | moderate | hepatic:hepatic_impaired->major/-(base) | supply_with_counselling | M |
| `pitavastatin__hiv_pi_cobicistat` | pitavastatin <-> hiv_protease_inhibitor_or_pk_booster [moderate] | pk_perpetrator | moderate | hepatic:hepatic_impaired->major/-(base) | supply_with_counselling | M |

## C. Serotonin/CNS

| id | <-> | basis | sev | context | dispense | conf |
|--|--|--|--|--|--|--|
| `ssri_snri__maoi_nonselective` | ssri_or_snri <-> maoi_nonselective | contraindication | contraindicated | - | withhold_and_clarify | H |
| `ssri_snri__methylene_blue_iv` | ssri_or_snri <-> methylene_blue | contraindication | contraindicated | - | withhold_and_clarify | M |
| `tramadol__serotonergic_antidepressant` | tramadol <-> serotonergic_antidepressant_ssri_snri_tca | additive_pd | major | renal:egfr_lt_30->major/-(base); hepatic:child_pugh_c->major/-(base) | confirm_and_monitor | H |
| `pethidine_tramadol__maoi_nonselective` | serotonergic_opioid_pethidine_tramadol <-> maoi_nonselective | contraindication | contraindicated | - | withhold_and_clarify | H |
| `linezolid__serotonergic_agent` | linezolid <-> serotonergic_agent_ssri_snri_tca_triptan | additive_pd | major | - | confirm_and_monitor | H |
| `triptan_mao_metabolized__maoi_mao_a` | triptan_mao_a_metabolized <-> maoi_mao_a_inhibitor | contraindication | contraindicated | - | withhold_and_clarify | M |
| `ssri_snri__triptan` | ssri_or_snri <-> triptan | additive_pd | moderate | - | supply_with_counselling | M |
| `dextromethorphan__maoi_nonselective` | dextromethorphan <-> maoi_nonselective | contraindication | contraindicated | - | withhold_and_clarify | H |
| `dextromethorphan__ssri_snri` | dextromethorphan <-> ssri_or_snri | additive_pd | moderate | - | supply_with_counselling | M |
| `opioid__benzodiazepine_cns_depressant` | opioid <-> benzodiazepine_or_other_cns_depressant | additive_pd | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `opioid__gabapentinoid` | opioid <-> gabapentinoid | additive_pd | major | renal:egfr_lt_30->major/-(base) | confirm_and_monitor | H |
| `benzodiazepine_zdrug__alcohol` | benzodiazepine_or_z_drug <-> alcohol | additive_pd | major | hepatic:hepatic_impaired->major/-(base) | supply_with_counselling | H |
| `maoi_nonselective__sympathomimetic` | maoi_nonselective <-> sympathomimetic_direct_and_indirect | contraindication | contraindicated | - | withhold_and_clarify | H |
| `lithium__ssri_snri` | lithium <-> ssri_or_snri | additive_pd | moderate | renal:egfr_lt_60->moderate/-(base); renal:egfr_lt_30->major/-(base) | supply_with_counselling | M |
| `bupropion__maoi_nonselective` | bupropion <-> maoi_nonselective | contraindication | contraindicated | - | withhold_and_clarify | H |
| `sedating_antihistamine__cns_depressant` | sedating_antihistamine <-> cns_depressant | additive_pd | moderate | - | supply_with_counselling | H |

## D. QT/arrhythmia

| id | <-> | basis | sev | context | dispense | conf |
|--|--|--|--|--|--|--|
| `qt_macrolide__qt_prolonging_drug` | macrolide_qt <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | H |
| `citalopram__qt_prolonging_drug` | citalopram <-> qt_prolonging_drug | additive_pd | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `escitalopram__qt_prolonging_drug` | escitalopram <-> qt_prolonging_drug | additive_pd | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `domperidone__potent_cyp3a4_inhibitor` | domperidone <-> cyp3a4_inhibitor [potent] | contraindication | contraindicated | hepatic:hepatic_impaired->contraindicated/withhold_and_clarify(base) | withhold_and_clarify | H |
| `domperidone__qt_prolonging_drug` | domperidone <-> qt_prolonging_drug | contraindication | contraindicated | hepatic:hepatic_impaired->contraindicated/withhold_and_clarify(base) | withhold_and_clarify | H |
| `ondansetron__apomorphine` | ondansetron <-> apomorphine | contraindication | contraindicated | - | withhold_and_clarify | H |
| `ondansetron__qt_prolonging_drug` | ondansetron <-> qt_prolonging_drug | additive_pd | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `haloperidol_parenteral_or_high_dose__qt_prolonging_drug` | haloperidol <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | H |
| `haloperidol_oral__qt_prolonging_drug` | haloperidol <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | M |
| `ziprasidone__qt_prolonging_drug` | ziprasidone <-> qt_prolonging_drug | additive_pd | major | - | confirm_and_monitor | H |
| `methadone__qt_prolonging_drug` | methadone <-> qt_prolonging_drug | additive_pd | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `methadone__cyp_inhibitor` | methadone <-> methadone_relevant_cyp_inhibitor [potent/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `hydroxychloroquine__qt_prolonging_drug` | hydroxychloroquine <-> qt_prolonging_drug | additive_pd | moderate | renal:egfr_lt_30->major/-(base); hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | M |

## E. Bradycardia/AV

| id | <-> | basis | sev | context | dispense | conf |
|--|--|--|--|--|--|--|
| `beta_blocker__non_dihydropyridine_ccb` | beta_blocker <-> non_dihydropyridine_ccb | additive_pd | major | hepatic:hepatic_impaired->major/-(base); renal:egfr_lt_30->major/-(base) | confirm_and_monitor | H |
| `beta_blocker__clonidine` | beta_blocker <-> clonidine | additive_pd | major | renal:egfr_lt_30->major/-(base) | confirm_and_monitor | H |
| `digoxin__verapamil` | digoxin <-> verapamil | pk_perpetrator | major | renal:egfr_lt_30->major/withhold_and_clarify(escalate) | confirm_and_monitor | H |
| `digoxin__amiodarone` | digoxin <-> amiodarone | pk_perpetrator | major | renal:egfr_lt_30->major/withhold_and_clarify(escalate) | confirm_and_monitor | H |
| `digoxin__dronedarone` | digoxin <-> dronedarone | pk_perpetrator | major | renal:egfr_lt_30->major/withhold_and_clarify(escalate) | confirm_and_monitor | H |
| `digoxin__clarithromycin` | digoxin <-> clarithromycin | pk_perpetrator | major | renal:egfr_lt_30->major/withhold_and_clarify(escalate) | confirm_and_monitor | H |
| `digoxin__potassium_wasting_diuretic` | digoxin <-> potassium_wasting_diuretic | additive_pd | major | renal:egfr_lt_30->major/withhold_and_clarify(escalate) | confirm_and_monitor | H |
| `ivabradine__qt_or_bradycardic_drug` | ivabradine <-> qt_prolonging_or_bradycardic_drug | additive_pd | major | hepatic:child_pugh_c->contraindicated/withhold_and_clarify(base) | confirm_and_monitor | M |
| `adenosine__dipyridamole` | adenosine <-> dipyridamole | pk_perpetrator | major | - | confirm_and_monitor | M |

## F. Hyperkalaemia/renal

| id | <-> | basis | sev | context | dispense | conf |
|--|--|--|--|--|--|--|
| `acei_arb__mra_spironolactone_eplerenone` | acei_arb <-> mineralocorticoid_receptor_antagonist | additive_pd | major | renal:egfr_lt_30->contraindicated/withhold_and_clarify(base) | confirm_and_monitor | H |
| `acei_arb__amiloride_triamterene` | acei_arb <-> epithelial_sodium_channel_blocker | additive_pd | major | renal:egfr_lt_30->contraindicated/withhold_and_clarify(base) | confirm_and_monitor | H |
| `acei_arb__potassium_supplement_salt_substitute` | acei_arb <-> potassium_supplement_or_salt_substitute | additive_pd | major | renal:egfr_lt_30->contraindicated/withhold_and_clarify(base) | supply_with_counselling | H |
| `acei_arb__nsaid_systemic` | acei_arb <-> nsaid | additive_pd | moderate | renal:egfr_lt_60->major/-(base); renal:egfr_lt_30->contraindicated/withhold_and_clarify(base) | confirm_and_monitor | H |
| `acei_arb_diuretic__nsaid_triple_whammy` | acei_arb <-> nsaid | additive_pd | major | renal:egfr_lt_30->contraindicated/withhold_and_clarify(base) | withhold_and_clarify | H |
| `acei__arb_dual_raas_blockade` | acei <-> arb | additive_pd | major | renal:egfr_lt_30->contraindicated/withhold_and_clarify(base) | confirm_and_monitor | H |
| `trimethoprim_cotrimoxazole__potassium_raising_agents` | trimethoprim_or_cotrimoxazole <-> potassium_raising_agent | additive_pd | major | renal:egfr_lt_30->contraindicated/withhold_and_clarify(base) | confirm_and_monitor | H |
| `lithium__nsaid_systemic` | lithium <-> nsaid | pk_perpetrator | major | renal:egfr_lt_60->major/-(base) | withhold_and_clarify | H |
| `lithium__acei_arb` | lithium <-> acei_arb | pk_perpetrator | major | renal:egfr_lt_60->major/-(base) | confirm_and_monitor | H |
| `lithium__thiazide_diuretic` | lithium <-> thiazide_diuretic | pk_perpetrator | major | renal:egfr_lt_60->major/-(base) | confirm_and_monitor | H |
| `aminoglycoside__loop_diuretic` | aminoglycoside <-> loop_diuretic | additive_pd | major | renal:egfr_lt_60->major/-(base) | confirm_and_monitor | H |
| `methotrexate__nsaid_systemic` | methotrexate <-> nsaid | pk_perpetrator | moderate | renal:egfr_lt_60->major/withhold_and_clarify(escalate); renal:egfr_lt_30->contraindicated/withhold_and_clarify(base); hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `methotrexate__trimethoprim_cotrimoxazole` | methotrexate <-> trimethoprim_or_cotrimoxazole | additive_pd | major | renal:egfr_lt_30->contraindicated/withhold_and_clarify(escalate) | withhold_and_clarify | H |
| `methotrexate_high_dose__ppi` | methotrexate <-> proton_pump_inhibitor | pk_perpetrator | major | renal:egfr_lt_30->contraindicated/withhold_and_clarify(escalate) | confirm_and_monitor | M |

## G. CYP3A4/P-gp

| id | <-> | basis | sev | context | dispense | conf |
|--|--|--|--|--|--|--|
| `colchicine__strong_cyp3a4_pgp_inhibitor` | colchicine <-> cyp3a4_pgp_inhibitor [strong] | pk_perpetrator | major | renal:egfr_lt_30->contraindicated/withhold_and_clarify(escalate); hepatic:hepatic_impaired->contraindicated/withhold_and_clarify(escalate) | withhold_and_clarify | H |
| `ergot_alkaloid__strong_cyp3a4_inhibitor` | ergot_alkaloid <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | H |
| `pimozide__cyp3a4_inhibitor` | pimozide <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | H |
| `tacrolimus__cyp3a4_inhibitor` | tacrolimus <-> cyp3a4_inhibitor [strong/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `ciclosporin__cyp3a4_inhibitor` | ciclosporin <-> cyp3a4_inhibitor [strong/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `sirolimus__strong_cyp3a4_pgp_inhibitor` | sirolimus <-> cyp3a4_pgp_inhibitor [strong/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | withhold_and_clarify | H |
| `calcineurin_inhibitor__strong_cyp3a4_inducer` | calcineurin_inhibitor <-> cyp3a4_inducer [strong] | pk_perpetrator | major | - | confirm_and_monitor | H |
| `sildenafil_pah__strong_cyp3a4_inhibitor` | sildenafil <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | withhold_and_clarify | H |
| `tadalafil_pah__strong_cyp3a4_inhibitor` | tadalafil <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | renal:crcl_lt_30->major/-(base); hepatic:hepatic_impaired->major/-(base) | withhold_and_clarify | H |
| `oral_midazolam_triazolam__potent_cyp3a4_inhibitor` | oral_midazolam_or_triazolam <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | H |
| `parenteral_midazolam__potent_cyp3a4_inhibitor` | midazolam <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | H |
| `dihydropyridine_ccb__strong_cyp3a4_inhibitor` | dihydropyridine_ccb <-> cyp3a4_inhibitor [strong] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | M |
| `apixaban__pgp_moderate_cyp3a4_inhibitor` | apixaban <-> pgp_and_moderate_cyp3a4_inhibitor [moderate] | pk_perpetrator | moderate | renal:crcl_lt_30->major/-(base) | confirm_and_monitor | M |
| `rivaroxaban__pgp_moderate_cyp3a4_inhibitor` | rivaroxaban <-> pgp_and_moderate_cyp3a4_inhibitor [moderate] | pk_perpetrator | moderate | renal:crcl_lt_60->major/withhold_and_clarify(escalate) | confirm_and_monitor | M |
| `grapefruit__sensitive_cyp3a4_substrate` | grapefruit_sensitive_cyp3a4_substrate <-> grapefruit [gut_cyp3a4_inhibitor] | pk_perpetrator | moderate | - | supply_with_counselling | H |
| `ivabradine__strong_cyp3a4_inhibitor` | ivabradine <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | M |
| `ivabradine__moderate_cyp3a4_inhibitor` | ivabradine <-> cyp3a4_inhibitor [moderate] | pk_perpetrator | major | - | confirm_and_monitor | M |
| `ranolazine__strong_cyp3a4_inhibitor` | ranolazine <-> cyp3a4_inhibitor [strong] | contraindication | contraindicated | - | withhold_and_clarify | M |
| `ranolazine__moderate_cyp3a4_inhibitor` | ranolazine <-> cyp3a4_inhibitor [moderate] | pk_perpetrator | major | - | confirm_and_monitor | M |

## H. Enzyme induction

| id | <-> | basis | sev | context | dispense | conf |
|--|--|--|--|--|--|--|
| `rifampicin__hormonal_contraceptive` | hormonal_contraceptive_induction_sensitive <-> rifamycin_enzyme_inducer [potent_inducer] | pk_perpetrator | major | - | supply_with_counselling | H |
| `enzyme_inducing_antiepileptic__hormonal_contraceptive` | hormonal_contraceptive_induction_sensitive <-> enzyme_inducing_antiepileptic [strong_inducer] | pk_perpetrator | major | - | supply_with_counselling | H |
| `rifampicin__calcineurin_inhibitor` | calcineurin_inhibitor <-> rifampicin | pk_perpetrator | major | - | confirm_and_monitor | H |
| `rifampicin__verapamil` | verapamil <-> rifampicin | pk_perpetrator | major | - | confirm_and_monitor | H |
| `rifampicin__systemic_corticosteroid` | systemic_corticosteroid <-> rifampicin | pk_perpetrator | major | - | confirm_and_monitor | H |
| `rifampicin__sulfonylurea` | sulfonylurea <-> rifampicin | pk_perpetrator | moderate | - | supply_with_counselling | M |
| `rifampicin__antiretroviral` | antiretroviral <-> rifampicin | pk_perpetrator | major | - | withhold_and_clarify | H |
| `carbamazepine__calcineurin_inhibitor` | calcineurin_inhibitor <-> carbamazepine | pk_perpetrator | major | - | confirm_and_monitor | H |
| `carbamazepine__warfarin` | warfarin <-> carbamazepine | pk_perpetrator | major | - | confirm_and_monitor | H |
| `carbamazepine__verapamil` | verapamil <-> carbamazepine | pk_perpetrator | major | - | confirm_and_monitor | M |
| `carbamazepine__systemic_corticosteroid` | systemic_corticosteroid <-> carbamazepine | pk_perpetrator | major | - | confirm_and_monitor | H |
| `carbamazepine__sulfonylurea` | sulfonylurea <-> carbamazepine | pk_perpetrator | moderate | - | supply_with_counselling | M |
| `carbamazepine__antiretroviral` | antiretroviral <-> carbamazepine | pk_perpetrator | major | - | withhold_and_clarify | H |
| `carbamazepine__valproate` | valproate <-> carbamazepine | pk_perpetrator | major | - | confirm_and_monitor | H |
| `carbamazepine__lamotrigine` | lamotrigine <-> carbamazepine | pk_perpetrator | moderate | - | confirm_and_monitor | M |
| `st_johns_wort__cyp3a4_pgp_substrate` | narrow_ti_cyp3a4_pgp_substrate <-> st_johns_wort | pk_perpetrator | major | - | supply_with_counselling | H |

## I. Absorption/GI

| id | <-> | basis | sev | context | dispense | conf |
|--|--|--|--|--|--|--|
| `ciprofloxacin__polyvalent_cation` | ciprofloxacin <-> polyvalent_cation | pk_perpetrator | moderate | - | space_doses | H |
| `levofloxacin__polyvalent_cation` | levofloxacin <-> polyvalent_cation | pk_perpetrator | moderate | - | space_doses | H |
| `moxifloxacin__polyvalent_cation` | moxifloxacin <-> polyvalent_cation | pk_perpetrator | moderate | - | space_doses | H |
| `doxycycline__polyvalent_cation` | doxycycline <-> polyvalent_cation | pk_perpetrator | moderate | - | space_doses | H |
| `levothyroxine__oral_cation_binder` | levothyroxine <-> oral_cation_binder | pk_perpetrator | moderate | - | space_doses | H |
| `levothyroxine__acid_suppressant` | levothyroxine <-> acid_suppressant | pk_perpetrator | moderate | - | supply_with_counselling | H |
| `alendronate__oral_cation_food` | alendronate <-> oral_polyvalent_cation_or_food | pk_perpetrator | moderate | - | space_doses | H |
| `risedronate__oral_cation_food` | risedronate <-> oral_polyvalent_cation_or_food | pk_perpetrator | moderate | - | space_doses | H |
| `ibandronate__oral_cation_food` | ibandronate <-> oral_polyvalent_cation_or_food | pk_perpetrator | moderate | - | space_doses | H |
| `atazanavir__acid_suppressant` | atazanavir <-> acid_suppressant | pk_perpetrator | major | - | withhold_and_clarify | H |
| `rilpivirine__proton_pump_inhibitor` | rilpivirine <-> proton_pump_inhibitor | contraindication | contraindicated | - | withhold_and_clarify | H |
| `erlotinib__acid_suppressant` | erlotinib <-> acid_suppressant | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | withhold_and_clarify | H |
| `dasatinib__acid_suppressant` | dasatinib <-> acid_suppressant | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | withhold_and_clarify | H |
| `ketoconazole_oral__acid_suppressant` | ketoconazole <-> acid_suppressant | pk_perpetrator | moderate | hepatic:hepatic_impaired->moderate/-(base) | withhold_and_clarify | M |
| `itraconazole_capsule__acid_suppressant` | itraconazole <-> acid_suppressant | pk_perpetrator | moderate | hepatic:hepatic_impaired->moderate/-(base) | withhold_and_clarify | M |

## J. Endocrine/misc

| id | <-> | basis | sev | context | dispense | conf |
|--|--|--|--|--|--|--|
| `sulfonylurea__fluconazole` | sulfonylurea <-> fluconazole | pk_perpetrator | major | renal:egfr_lt_30->major/-(base) | confirm_and_monitor | H |
| `sulfonylurea__co_trimoxazole` | sulfonylurea <-> co-trimoxazole | pk_perpetrator | major | renal:egfr_lt_30->major/-(base) | confirm_and_monitor | H |
| `sulfonylurea__gemfibrozil` | sulfonylurea <-> gemfibrozil | pk_perpetrator | moderate | renal:egfr_lt_30->major/-(base); hepatic:hepatic_impaired->major/-(base) | confirm_and_monitor | M |
| `sulfonylurea__alcohol` | sulfonylurea <-> alcohol (ethanol) | additive_pd | major | - | supply_with_counselling | M |
| `sulfonylurea__miconazole_oromucosal_gel` | sulfonylurea <-> miconazole | contraindication | contraindicated | - | withhold_and_clarify | M |
| `metformin__iodinated_contrast_media` | metformin <-> iodinated_contrast_media | additive_pd | major | renal:egfr_lt_30->contraindicated/withhold_and_clarify(base); renal:egfr_lt_60->major/supply_with_counselling(base); renal:egfr_ge_60->moderate/supply_with_counselling(base) | supply_with_counselling | H |
| `thiopurine__allopurinol` | thiopurine <-> allopurinol | pk_perpetrator | major | renal:egfr_lt_30->major/-(base) | withhold_and_clarify | H |
| `theophylline__cyp1a2_inhibitor` | xanthine_bronchodilator <-> cyp1a2_inhibitor [strong/moderate] | pk_perpetrator | major | hepatic:hepatic_impaired->major/-(base) | withhold_and_clarify | H |
| `potassium_chloride_solid_oral__gi_transit_slowing` | potassium chloride <-> gi_transit_slowing_agent | contraindication | contraindicated | - | withhold_and_clarify | M |
