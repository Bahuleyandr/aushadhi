# Section B (statins) — citation sign-off worksheet

**28 retained evidence records** across **20 rules**, containing **35 hashed fragments**.

This worksheet is deterministically generated from the slice. It records evidence provenance and exact source fragments; it does not add or revise clinical claims.

- Section: `B`
- JSONL SHA-256: `d814b28a475020b15aa18f70f9ff5070e3141df01d963d2a546ab4e319a0c5a9`
- openFDA-reconciled evidence: `28`
- citation_status: `{"machine_confirmed_openfda_reconciled_pending_clinician":28}`

For `openfda-labels`, the machine origin is the exact openFDA `set_id` query and the DailyMed URL is reference-only. Payload hashes use recursively sorted object keys with array order preserved (`sorted-json-keys-v1`); fragment containment uses the repository `openfda-spl-text-v1` normalization at each declared `source_path`.

## simvastatin_lovastatin__strong_cyp3a4_inhibitor

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `3`

### evidence[0] — `dailymed-zocor-strong-cyp3a4-contraindication` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — ZOCOR (simvastatin) tablets | regulator="FDA (United States)" | product="ZOCOR (simvastatin) tablets" | section="4 Contraindications"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%228f55d5de-5a4f-4a39-8c84-c53976dd6af9%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8f55d5de-5a4f-4a39-8c84-c53976dd6af9
- document: `8f55d5de-5a4f-4a39-8c84-c53976dd6af9@11`; retrieved_at=`2026-07-24`
- SPL: version=`11`; effective_time=`20250328`; source_date=`2025-03-28`
- payload: sha256=`900e3302851ceb0634ca7d584e1189e1e4ed0ec08e5b5fd963ae9366b145ec4c`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["contraindications[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. ZOCOR label contraindicates concomitant strong CYP3A4 inhibitors.
- source_effect: `["increased_simvastatin_exposure_and_myopathy_risk"]`
- label_action: `["contraindicated_concomitant_use"]`
- scope: `{"scope_type":"source_product_plus_source_inhibitor_class","source_product":"ZOCOR (simvastatin)","source_class":"strong CYP3A4 inhibitors","runtime_class":"cyp3a4_inhibitor","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This U.S. source supports simvastatin, not lovastatin or UK/Indian jurisdiction.
  - It does not establish every member in the local strong-inhibitor roster or distinguish systemic from topical formulations.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [4 Contraindications] (sha256 ee3baa46217f0d767197a387e7ce5e14fefcb1e1d979640cc2185795f1107a3d; path contraindications[0]) "Concomitant use of strong CYP3A4 inhibitors (select azole anti-fungals, macrolide antibiotics, anti-viral medications, and nefazodone) [see Drug Interactions (7.1)]."

### evidence[1] — `dailymed-lovastatin-strong-cyp3a4-contraindication` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — lovastatin tablets | regulator="FDA (United States)" | product="lovastatin tablets" | section="Contraindications"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22df7ddf4f-d569-431e-81f1-9129d7043150%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=df7ddf4f-d569-431e-81f1-9129d7043150
- document: `df7ddf4f-d569-431e-81f1-9129d7043150@17`; retrieved_at=`2026-07-24`
- SPL: version=`17`; effective_time=`20260506`; source_date=`2026-05-06`
- payload: sha256=`9dc33d4c639829a1c2d47bd9505488a7ee51080261849c904f671752caf08bde`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["contraindications[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. lovastatin label contraindicates concomitant strong CYP3A4 inhibitors and lists HIV protease inhibitors and cobicistat-containing products as examples.
- source_effect: `["increased_lovastatin_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["contraindicated_concomitant_use"]`
- scope: `{"scope_type":"source_product_plus_source_inhibitor_class","source_product":"lovastatin tablets","source_class":"strong CYP3A4 inhibitors","source_named_examples":["itraconazole","ketoconazole","posaconazole","voriconazole","HIV protease inhibitors","boceprevir","telaprevir","erythromycin","clarithromycin","telithromycin","nefazodone","cobicistat-containing products"],"runtime_class":"cyp3a4_inhibitor","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This U.S. source supports lovastatin, not simvastatin or UK/Indian jurisdiction.
  - The named examples do not establish every member in the local strong-inhibitor roster or route/formulation eligibility.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [Contraindications] (sha256 bf345e50865734441f186ac8e32fd45e3ed585d313b2ab0d92e7db2a17b7cfca; path contraindications[0]) "Concomitant administration with strong CYP3A4 inhibitors (e.g., itraconazole, ketoconazole, posaconazole, voriconazole, HIV protease inhibitors, boceprevir, telaprevir, erythromycin, clarithromycin, telithromycin, nefazodone, and cobicistat-containing products) (see WARNINGS, Myopathy/Rhabdomyolysis)."

### evidence[2] — `dailymed-simvastatin-strong-cyp3a4-effect` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — simvastatin tablets | regulator="FDA (United States)" | product="simvastatin tablets" | section="7.1 Drug Interactions — Strong CYP3A4 Inhibitors"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%224724dbb4-3613-4e6a-948f-a43d34f97f06%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4724dbb4-3613-4e6a-948f-a43d34f97f06
- document: `4724dbb4-3613-4e6a-948f-a43d34f97f06@29`; retrieved_at=`2026-07-24`
- SPL: version=`29`; effective_time=`20260511`; source_date=`2026-05-11`
- payload: sha256=`dd00af1b26a20abfe40815e7dceb4da0f27cf205cfd6db7e83b01c7b3b95aac6`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. simvastatin label states that strong CYP3A4 inhibitors increase simvastatin exposure and myopathy and rhabdomyolysis risk.
- source_effect: `["increased_simvastatin_exposure_and_myopathy_risk"]`
- label_action: `[]`
- scope: `{"scope_type":"source_product_plus_source_inhibitor_class","source_product":"simvastatin tablets","source_class":"strong CYP3A4 inhibitors","runtime_class":"cyp3a4_inhibitor","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This effect fragment does not by itself state the contraindication action.
  - It supports simvastatin, not lovastatin, and does not establish the entire local member roster or route/formulation eligibility.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [7.1 Drug Interactions — Strong CYP3A4 Inhibitors] (sha256 35bc769dcb3ab4746c691efa7282780753dca0216309329381c97ca9145770c7; path drug_interactions[0]) "Simvastatin is a substrate of CYP3A4. Concomitant use of strong CYP3A4 inhibitors with simvastatin increases simvastatin exposure and increases the risk of myopathy and rhabdomyolysis, particularly with higher simvastatin dosages."

## simvastatin__gemfibrozil

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-simvastatin-gemfibrozil-contraindication` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — simvastatin tablets | regulator="FDA (United States)" | product="simvastatin tablets" | section="7.1 Drug Interactions — Cyclosporine, Danazol, or Gemfibrozil"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%225c1c694c-4b08-469e-b538-08e69df06146%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5c1c694c-4b08-469e-b538-08e69df06146
- document: `5c1c694c-4b08-469e-b538-08e69df06146@90400`; retrieved_at=`2026-07-24`
- SPL: version=`90400`; effective_time=`20230821`; source_date=`2023-08-21`
- payload: sha256=`3510c0399657f1bd931349e85ecd8deea1a11d4ac067b2473968f3716966f207`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. simvastatin label contraindicates concomitant gemfibrozil.
- source_effect: `["increased_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["contraindicated_concomitant_use"]`
- scope: `{"scope_type":"exact_pair","object_members":["simvastatin"],"perpetrator_members":["gemfibrozil"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The cited U.S. label does not establish UK or Indian regulatory wording.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [7.1 Drug Interactions] (sha256 ee2958c9a2b077d1280ccf276a18ae1119d1ed2caa82fe528e68dfc14bd52de1; path drug_interactions[0]) "Concomitant use of cyclosporine, danazol, or gemfibrozil with simvastatin is contraindicated [see Contraindications ( 4)]."

## lovastatin__gemfibrozil

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-lovastatin-gemfibrozil-avoid` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — lovastatin tablets | regulator="FDA (United States)" | product="lovastatin tablets" | section="Warnings — Myopathy/Rhabdomyolysis"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22df7ddf4f-d569-431e-81f1-9129d7043150%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=df7ddf4f-d569-431e-81f1-9129d7043150
- document: `df7ddf4f-d569-431e-81f1-9129d7043150@17`; retrieved_at=`2026-07-24`
- SPL: version=`17`; effective_time=`20260506`; source_date=`2026-05-06`
- payload: sha256=`9dc33d4c639829a1c2d47bd9505488a7ee51080261849c904f671752caf08bde`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["warnings[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. lovastatin label directs that combined lovastatin and gemfibrozil should be avoided.
- source_effect: `["increased_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["avoid_concomitant_use"]`
- scope: `{"scope_type":"exact_pair","object_members":["lovastatin"],"perpetrator_members":["gemfibrozil"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source says avoid and does not call this pair a formal contraindication.
  - The cited U.S. label does not establish UK or Indian regulatory wording.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [Warnings — Myopathy/Rhabdomyolysis] (sha256 e3aa92ef8ad5115887150cec0c581276c5d6c146d034d003d70dc9e76f6b7dd2; path warnings[0]) "The combined use of lovastatin with gemfibrozil should be avoided."

## statin__fenofibrate

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-fenofibrate-statin-myopathy-and-renal` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — fenofibrate tablets 48 mg and 145 mg | regulator="FDA (United States)" | product="fenofibrate tablets 48 mg and 145 mg" | section="5 Warnings and Precautions; 12.3 Clinical Pharmacology — Renal Impairment"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22f04cfe2a-1c06-4a7f-8149-7736a96e8f73%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f04cfe2a-1c06-4a7f-8149-7736a96e8f73
- document: `f04cfe2a-1c06-4a7f-8149-7736a96e8f73@2`; retrieved_at=`2026-07-24`
- SPL: version=`2`; effective_time=`20251024`; source_date=`2025-10-24`
- payload: sha256=`5e25d7e801eb253ef4febf1e151f9b39f99e580770cea2e040939084af59ff62`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["warnings_and_cautions[0]","clinical_pharmacology[0]","clinical_pharmacology[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. fenofibrate label reports increased muscle-toxicity risk with statins and defines severe renal impairment as eGFR below 30 mL/min/1.73 m2, for which fenofibrate should be avoided.
- source_effect: `["increased_myopathy_and_rhabdomyolysis_risk_with_statin_coadministration","increased_fenofibric_acid_exposure_and_accumulation_in_severe_renal_impairment"]`
- label_action: `["avoid_fenofibrate_in_severe_renal_impairment","reduce_fenofibrate_dose_in_mild_to_moderate_renal_impairment"]`
- scope: `{"scope_type":"source_product_plus_source_class_and_renal_threshold","source_product":"fenofibrate tablets 48 mg and 145 mg","source_class":"statins","source_patient_scope":"eGFR below 30 mL/min/1.73 m2","runtime_class":"statin","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The class statement does not assign one uniform severity or action to every statin, dose, or formulation.
  - The source does not establish UK or Indian regulatory wording.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [5 Warnings and Precautions] (sha256 8eb30dbfd84c10e2c0fd5bdcf0e3cf8373bac5fd95865e4692a1def80cf9c9db; path warnings_and_cautions[0]) "The risks for myopathy and rhahdomylosis are increased when fibrates are co-administered with a statin (with a significantly higher rate observed for gemfibrozil), particularly in elderly patients and patients with diabetes, renal failure, or hypothyroidism (5.2)."
  - [12.3 Clinical Pharmacology — Renal Impairment] (sha256 9fd79ca3cecca70f580903a7cd5a06bcc3a8eaca6ef9b4eb1154aebcbe587824; path clinical_pharmacology[0]) "Patients with severe renal impairment (estimated glomerular filtration rate [eGFR] < 30 mL/min/1.73 m2) showed 2.7-fold increase in exposure for fenofibric acid and increased accumulation of fenofibric acid during chronic dosing compared to that of healthy subjects."
  - [12.3 Clinical Pharmacology — Renal Impairment] (sha256 aea20c88ad3d88c901b89a99cd99c2ed9b4df06292f62835c70e505e6465750d; path clinical_pharmacology[0]) "Based on these findings, the use of fenofibrate tablets should be avoided in patients who have severe renal impairment and dose reduction is required in patients having mild to moderate renal impairment [see Dosage and Administration (2.4)]."

## simvastatin__amiodarone

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-zocor-amiodarone-20mg-cap` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — ZOCOR (simvastatin) tablets | regulator="FDA (United States)" | product="ZOCOR (simvastatin) tablets" | section="2.5 Dosage Modifications Due to Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%228f55d5de-5a4f-4a39-8c84-c53976dd6af9%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8f55d5de-5a4f-4a39-8c84-c53976dd6af9
- document: `8f55d5de-5a4f-4a39-8c84-c53976dd6af9@11`; retrieved_at=`2026-07-24`
- SPL: version=`11`; effective_time=`20250328`; source_date=`2025-03-28`
- payload: sha256=`900e3302851ceb0634ca7d584e1189e1e4ed0ec08e5b5fd963ae9366b145ec4c`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. ZOCOR label caps simvastatin at 20 mg once daily with amiodarone.
- source_effect: `["increased_simvastatin_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["limit_simvastatin_to_20_mg_once_daily"]`
- scope: `{"scope_type":"exact_pair_with_dose_cap","object_members":["simvastatin"],"perpetrator_members":["amiodarone"],"source_product":"ZOCOR","source_maximum_daily_dose_mg":20}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The pair matcher cannot determine the prescribed simvastatin dose.
  - The cited U.S. label does not establish UK or Indian dose limits.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [2.5 Dosage Modifications Due to Drug Interactions] (sha256 b1b3287555c39fef5df3f9eaedf763fa991a7164674af65826375a6bca5289f7; path dosage_and_administration[0]) "Patients taking Amiodarone, Amlodipine, or Ranolazine Do not exceed ZOCOR 20 mg once daily."

## simvastatin__verapamil_diltiazem

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-simvastatin-verapamil-diltiazem-10mg-cap` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — simvastatin tablets | regulator="FDA (United States)" | product="simvastatin tablets" | section="2.5 Dosage Modifications Due to Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%224724dbb4-3613-4e6a-948f-a43d34f97f06%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4724dbb4-3613-4e6a-948f-a43d34f97f06
- document: `4724dbb4-3613-4e6a-948f-a43d34f97f06@29`; retrieved_at=`2026-07-24`
- SPL: version=`29`; effective_time=`20260511`; source_date=`2026-05-11`
- payload: sha256=`dd00af1b26a20abfe40815e7dceb4da0f27cf205cfd6db7e83b01c7b3b95aac6`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. simvastatin label caps simvastatin at 10 mg once daily with verapamil or diltiazem.
- source_effect: `["increased_simvastatin_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["limit_simvastatin_to_10_mg_once_daily"]`
- scope: `{"scope_type":"exact_members_with_dose_cap","object_members":["simvastatin"],"perpetrator_members":["verapamil","diltiazem"],"source_maximum_daily_dose_mg":10}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The pair matcher cannot determine the prescribed simvastatin dose.
  - The cited U.S. label does not establish UK or Indian dose limits.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [2.5 Dosage Modifications Due to Drug Interactions] (sha256 8479daef0a2ad5f3a5974d21fc8a7758f8d05db85ec7952b04d3ff5870bf1742; path dosage_and_administration[0]) "Patients taking Verapamil, Diltiazem, or Dronedarone Do not exceed simvastatin tablets 10 mg once daily."

## simvastatin__amlodipine

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-simvastatin-amlodipine-20mg-cap` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — simvastatin tablets | regulator="FDA (United States)" | product="simvastatin tablets" | section="2.5 Dosage Modifications Due to Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%224724dbb4-3613-4e6a-948f-a43d34f97f06%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4724dbb4-3613-4e6a-948f-a43d34f97f06
- document: `4724dbb4-3613-4e6a-948f-a43d34f97f06@29`; retrieved_at=`2026-07-24`
- SPL: version=`29`; effective_time=`20260511`; source_date=`2026-05-11`
- payload: sha256=`dd00af1b26a20abfe40815e7dceb4da0f27cf205cfd6db7e83b01c7b3b95aac6`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. simvastatin label caps simvastatin at 20 mg once daily with amlodipine.
- source_effect: `["increased_simvastatin_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["limit_simvastatin_to_20_mg_once_daily"]`
- scope: `{"scope_type":"exact_pair_with_dose_cap","object_members":["simvastatin"],"perpetrator_members":["amlodipine"],"source_maximum_daily_dose_mg":20}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The pair matcher cannot determine the prescribed simvastatin dose.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [2.5 Dosage Modifications Due to Drug Interactions] (sha256 7376122d7daf08c064583b81ec2201a1fcb85c02e287028cefcc98b1c4dd7d46; path dosage_and_administration[0]) "Patients taking Amiodarone, Amlodipine, or Ranolazine Do not exceed simvastatin tablets 20 mg once daily."

## atorvastatin__strong_cyp3a4_inhibitor

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-atorvastatin-selected-inhibitors-20mg-cap` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — atorvastatin calcium tablets | regulator="FDA (United States)" | product="atorvastatin calcium tablets" | section="2.6 Dosage in Patients Taking Cyclosporine, Clarithromycin, Itraconazole, Letermovir, or Certain Protease Inhibitors"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2240e6b63f-0a20-404a-8915-2f698877a96b%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=40e6b63f-0a20-404a-8915-2f698877a96b
- document: `40e6b63f-0a20-404a-8915-2f698877a96b@35`; retrieved_at=`2026-07-24`
- SPL: version=`35`; effective_time=`20240819`; source_date=`2024-08-19`
- payload: sha256=`604ce6214db052c58d1ca831b8329c6c47e28d4003925cb32b46600c84926a30`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. atorvastatin label limits atorvastatin to 20 mg with clarithromycin, itraconazole, and selected other regimens.
- source_effect: `["increased_atorvastatin_exposure_and_myopathy_risk"]`
- label_action: `["limit_atorvastatin_to_20_mg_for_named_coadministered_drugs"]`
- scope: `{"scope_type":"source_named_members_with_dose_cap","source_named_perpetrators":["clarithromycin","itraconazole"],"source_additional_regimens":["elbasvir plus grazoprevir","saquinavir plus ritonavir","darunavir plus ritonavir","fosamprenavir","fosamprenavir plus ritonavir","letermovir"],"runtime_class":"cyp3a4_inhibitor","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The fragment does not establish a class-wide action for every local strong-CYP3A4-inhibitor member.
  - The pair matcher cannot determine dose, route, or antiretroviral regimen.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [2.6 Dosage in Patients Taking Cyclosporine, Clarithromycin, Itraconazole, Letermovir, or Certain Protease Inhibitors] (sha256 e52c6cdc7e8a89a8c021bb9f8507f107e2ba75eb70d487fe45a86750a20a15c2; path dosage_and_administration[0]) "In patients taking clarithromycin, itraconazole, elbasvir plus grazoprevir, or in patients with HIV taking a combination of saquinavir plus ritonavir, darunavir plus ritonavir, fosamprenavir, fosamprenavir plus ritonavir or letermovir therapy with atorvastatin calcium tablets should be limited to 20 mg, and appropriate clinical assessment is recommended to ensure that the lowest dose necessary of atorvastatin calcium tablets is used."

## simvastatin__ciclosporin

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `3`

### evidence[0] — `dailymed-simvastatin-cyclosporine-contraindication` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — simvastatin tablets | regulator="FDA (United States)" | product="simvastatin tablets" | section="4 Contraindications"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%225c1c694c-4b08-469e-b538-08e69df06146%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5c1c694c-4b08-469e-b538-08e69df06146
- document: `5c1c694c-4b08-469e-b538-08e69df06146@90400`; retrieved_at=`2026-07-24`
- SPL: version=`90400`; effective_time=`20230821`; source_date=`2023-08-21`
- payload: sha256=`3510c0399657f1bd931349e85ecd8deea1a11d4ac067b2473968f3716966f207`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["contraindications[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. simvastatin label lists concomitant cyclosporine as a contraindication.
- source_effect: `["increased_simvastatin_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["contraindicated_concomitant_use"]`
- scope: `{"scope_type":"source_exact_pair_with_runtime_spelling_alias","source_object":"simvastatin","source_perpetrator":"cyclosporine","runtime_perpetrator":"ciclosporin"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source does not distinguish systemic from topical or ophthalmic cyclosporine in the quoted fragment.
  - The source does not establish the runtime spelling normalisation from cyclosporine to ciclosporin.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [4 Contraindications] (sha256 46ccc51318fb177e61da4a0d9b2de6916b0cc6d6b0621c9816ae99bc57617ddc; path contraindications[0]) "Concomitant use of cyclosporine, danazol or gemfibrozil"

### evidence[1] — `dailymed-zocor-cyclosporine-contraindication` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — ZOCOR (simvastatin) tablets | regulator="FDA (United States)" | product="ZOCOR (simvastatin) tablets" | section="4 Contraindications"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%228f55d5de-5a4f-4a39-8c84-c53976dd6af9%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8f55d5de-5a4f-4a39-8c84-c53976dd6af9
- document: `8f55d5de-5a4f-4a39-8c84-c53976dd6af9@11`; retrieved_at=`2026-07-24`
- SPL: version=`11`; effective_time=`20250328`; source_date=`2025-03-28`
- payload: sha256=`900e3302851ceb0634ca7d584e1189e1e4ed0ec08e5b5fd963ae9366b145ec4c`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["contraindications[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. ZOCOR label lists concomitant cyclosporine as a contraindication.
- source_effect: `["increased_simvastatin_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["contraindicated_concomitant_use"]`
- scope: `{"scope_type":"source_exact_pair_with_runtime_spelling_alias","source_object":"simvastatin","source_perpetrator":"cyclosporine","runtime_perpetrator":"ciclosporin"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source does not distinguish systemic from topical or ophthalmic cyclosporine.
  - The source does not establish the runtime spelling normalisation from cyclosporine to ciclosporin.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [4 Contraindications] (sha256 b3d0abd0336e67c6e10d6d39b8f80c561a93397919027a423fb9ebd900f7f5cb; path contraindications[0]) "Concomitant use of cyclosporine, danazol or gemfibrozil [see Drug Interactions (7.1)]."

### evidence[2] — `dailymed-simvastatin-cyclosporine-myopathy-effect` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — simvastatin tablets | regulator="FDA (United States)" | product="simvastatin tablets" | section="7.1 Drug Interactions — Cyclosporine, Danazol, or Gemfibrozil"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%225c1c694c-4b08-469e-b538-08e69df06146%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5c1c694c-4b08-469e-b538-08e69df06146
- document: `5c1c694c-4b08-469e-b538-08e69df06146@90400`; retrieved_at=`2026-07-24`
- SPL: version=`90400`; effective_time=`20230821`; source_date=`2023-08-21`
- payload: sha256=`3510c0399657f1bd931349e85ecd8deea1a11d4ac067b2473968f3716966f207`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. simvastatin label reports increased myopathy and rhabdomyolysis risk with concomitant cyclosporine.
- source_effect: `["increased_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `[]`
- scope: `{"scope_type":"source_exact_pair_with_runtime_spelling_alias","source_object":"simvastatin","source_perpetrator":"cyclosporine","runtime_perpetrator":"ciclosporin"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This effect fragment does not by itself state the contraindication action.
  - The source does not distinguish systemic from topical or ophthalmic cyclosporine.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [7.1 Drug Interactions] (sha256 39545047e0bb1e92a9931a92c177b9b34aacdb18934fc406ed23c5cca8a84dbf; path drug_interactions[0]) "The risk of myopathy and rhabdomyolysis is increased with concomitant use of cyclosporine, danazol, or gemfibrozil with simvastatin."

## lovastatin__ciclosporin

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-lovastatin-cyclosporine-avoid` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — lovastatin tablets | regulator="FDA (United States)" | product="lovastatin tablets" | section="Warnings — Myopathy/Rhabdomyolysis"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22df7ddf4f-d569-431e-81f1-9129d7043150%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=df7ddf4f-d569-431e-81f1-9129d7043150
- document: `df7ddf4f-d569-431e-81f1-9129d7043150@17`; retrieved_at=`2026-07-24`
- SPL: version=`17`; effective_time=`20260506`; source_date=`2026-05-06`
- payload: sha256=`9dc33d4c639829a1c2d47bd9505488a7ee51080261849c904f671752caf08bde`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["warnings[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. lovastatin label directs avoidance with cyclosporine.
- source_effect: `["increased_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["avoid_concomitant_use"]`
- scope: `{"scope_type":"source_exact_pair_with_runtime_spelling_alias","source_object":"lovastatin","source_perpetrator":"cyclosporine","runtime_perpetrator":"ciclosporin"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source says avoid rather than placing the pair in the formal contraindications section.
  - The source does not distinguish systemic from topical or ophthalmic cyclosporine.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [Warnings — Myopathy/Rhabdomyolysis] (sha256 ba6ac4ca2667952ac87d089276a72d7b3a3b0987f725ce65aaf4dcd92e162239; path warnings[0]) "The use of lovastatin with cyclosporine should be avoided."

## atorvastatin__ciclosporin

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-atorvastatin-cyclosporine-avoid` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — atorvastatin calcium tablets | regulator="FDA (United States)" | product="atorvastatin calcium tablets" | section="2.6 Dosage in Patients Taking Cyclosporine, Clarithromycin, Itraconazole, Letermovir, or Certain Protease Inhibitors"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2240e6b63f-0a20-404a-8915-2f698877a96b%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=40e6b63f-0a20-404a-8915-2f698877a96b
- document: `40e6b63f-0a20-404a-8915-2f698877a96b@35`; retrieved_at=`2026-07-24`
- SPL: version=`35`; effective_time=`20240819`; source_date=`2024-08-19`
- payload: sha256=`604ce6214db052c58d1ca831b8329c6c47e28d4003925cb32b46600c84926a30`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. atorvastatin label directs avoidance with cyclosporine and does not provide a permitted dose in the cited instruction.
- source_effect: `["increased_atorvastatin_exposure_and_myopathy_risk"]`
- label_action: `["avoid_atorvastatin_therapy"]`
- scope: `{"scope_type":"source_exact_pair_with_runtime_spelling_alias","source_object":"atorvastatin","source_perpetrator":"cyclosporine","runtime_perpetrator":"ciclosporin"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The fragment does not support a numeric atorvastatin dose cap with cyclosporine.
  - The source does not distinguish systemic from topical or ophthalmic cyclosporine.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [2.6 Dosage in Patients Taking Cyclosporine, Clarithromycin, Itraconazole, Letermovir, or Certain Protease Inhibitors] (sha256 e9e74730b8957ce0a68d0ec49cd602e619620ec9856535a49198f8f7b771d093; path dosage_and_administration[0]) "In patients taking cyclosporine or the HIV protease inhibitor tipranavir plus ritonavir or the hepatitis C virus (HCV) protease inhibitor glecaprevir plus pibrentasvir or letermovir when co-administered with cyclosporine, therapy with atorvastatin calcium tablets should be avoided."

## pitavastatin__ciclosporin

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-pitavastatin-cyclosporine-contraindication` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — pitavastatin tablets | regulator="FDA (United States)" | product="pitavastatin tablets" | section="7 Drug Interactions — Cyclosporine"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%229ad1ecb9-822d-47c1-9f6f-6f771fa0f924%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9ad1ecb9-822d-47c1-9f6f-6f771fa0f924
- document: `9ad1ecb9-822d-47c1-9f6f-6f771fa0f924@8`; retrieved_at=`2026-07-24`
- SPL: version=`8`; effective_time=`20260608`; source_date=`2026-06-08`
- payload: sha256=`be5bfd066f55424ff12d34d97e8acdcc0c4d9889e74cdf7ff812b1ee8cbedfeb`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. pitavastatin label contraindicates concomitant cyclosporine.
- source_effect: `["increased_pitavastatin_exposure_and_myopathy_risk"]`
- label_action: `["contraindicated_concomitant_use"]`
- scope: `{"scope_type":"source_exact_pair_with_runtime_spelling_alias","source_object":"pitavastatin","source_perpetrator":"cyclosporine","runtime_perpetrator":"ciclosporin"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source does not distinguish systemic from topical or ophthalmic cyclosporine.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [7 Drug Interactions — Cyclosporine] (sha256 93b6f48687014d7702ce51af4ffa8d84468fa90d9f7f8c17d89fabf61f9cf05a; path drug_interactions[0]) "Concomitant use of cyclosporine with pitavastatin is contraindicated [see Contraindications (4)] ."

## pravastatin__ciclosporin

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-pravastatin-cyclosporine-20mg-cap` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — pravastatin sodium tablets | regulator="FDA (United States)" | product="pravastatin sodium tablets" | section="2.6 Dosage in Patients Taking Cyclosporine"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22d0641def-425e-4357-a6b6-24ce00424549%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d0641def-425e-4357-a6b6-24ce00424549
- document: `d0641def-425e-4357-a6b6-24ce00424549@108`; retrieved_at=`2026-07-24`
- SPL: version=`108`; effective_time=`20260601`; source_date=`2026-06-01`
- payload: sha256=`f407123c98af254bb344ff7b151bdb6439521c070232adda98365cc2b2b56436`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. pravastatin label limits pravastatin to 20 mg once daily with cyclosporine.
- source_effect: `["increased_pravastatin_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["limit_pravastatin_to_20_mg_once_daily"]`
- scope: `{"scope_type":"source_exact_pair_with_runtime_spelling_alias_and_dose_cap","source_object":"pravastatin","source_perpetrator":"cyclosporine","runtime_perpetrator":"ciclosporin","source_maximum_daily_dose_mg":20}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The pair matcher cannot determine pravastatin dose or cyclosporine route.
  - The cited U.S. label does not establish UK or Indian dose limits.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [2.6 Dosage in Patients Taking Cyclosporine] (sha256 df422a4dcc0ae0b0612b0dfe8c9a2d509c9a53a49bb6647bd9162bc4539c755d; path dosage_and_administration[0]) "In patients taking cyclosporine, therapy should be limited to 20 mg of pravastatin sodium once daily [see Warnings and Precautions (5.1) and Drug Interactions (7.1) ]."

## fluvastatin__ciclosporin

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-fluvastatin-capsules-cyclosporine-20mg-bid-cap` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — fluvastatin capsules | regulator="FDA (United States)" | product="fluvastatin capsules" | section="7.1 Cyclosporine"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22d0a7247c-5d83-4bc1-840f-c58314d14195%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d0a7247c-5d83-4bc1-840f-c58314d14195
- document: `d0a7247c-5d83-4bc1-840f-c58314d14195@13`; retrieved_at=`2026-07-24`
- SPL: version=`13`; effective_time=`20200820`; source_date=`2020-08-20`
- payload: sha256=`53ca19ddf1157a153ae81370d8600abfaf77c884a5164fd745926251a61204b4`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. fluvastatin-capsule label limits capsules to 20 mg twice daily with cyclosporine.
- source_effect: `["increased_fluvastatin_exposure"]`
- label_action: `["limit_fluvastatin_capsules_to_20_mg_twice_daily"]`
- scope: `{"scope_type":"source_exact_product_formulation_pair_with_runtime_spelling_alias","source_object":"fluvastatin capsules","source_formulation":"capsule","source_perpetrator":"cyclosporine","runtime_perpetrator":"ciclosporin","source_maximum_dose":"20 mg twice daily"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source does not establish a dose cap for extended-release fluvastatin tablets.
  - The pair matcher cannot determine fluvastatin formulation, dose, or cyclosporine route.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [7.1 Cyclosporine] (sha256 71f69ebc07ed90cb22703d62100a664141aa5b11dbd0183f6803742314079b4e; path drug_interactions[0]) "Cyclosporine coadministration increases fluvastatin exposure. Therefore, in patients taking cyclosporine, therapy should be limited to fluvastatin capsules 20 mg twice daily [see Warnings and Precautions (5.1) and Clinical Pharmacology (12.3) ]."

## rosuvastatin__ciclosporin

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-rosuvastatin-cyclosporine-5mg-cap` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — rosuvastatin tablets | regulator="FDA (United States)" | product="rosuvastatin tablets" | section="2.4 Use with Concomitant Therapy"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22ac89adcd-3226-4a66-8902-0f0a33be159a%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ac89adcd-3226-4a66-8902-0f0a33be159a
- document: `ac89adcd-3226-4a66-8902-0f0a33be159a@13`; retrieved_at=`2026-07-24`
- SPL: version=`13`; effective_time=`20230315`; source_date=`2023-03-15`
- payload: sha256=`493362e00005ddd7408577896aa30b5b346c8a215f344258dcb181d054796494`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. rosuvastatin label limits rosuvastatin to 5 mg once daily for patients taking cyclosporine.
- source_effect: `["increased_rosuvastatin_exposure_and_myopathy_risk"]`
- label_action: `["limit_rosuvastatin_to_5_mg_once_daily"]`
- scope: `{"scope_type":"source_named_coadministered_drug_with_runtime_spelling_alias_and_dose_cap","source_object":"rosuvastatin","source_perpetrators":["cyclosporine","darolutamide"],"runtime_perpetrator":"ciclosporin","source_maximum_daily_dose_mg":5}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The label heading groups cyclosporine and darolutamide; this runtime rule covers cyclosporine only.
  - The pair matcher cannot determine rosuvastatin dose or cyclosporine route.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [2.4 Use with Concomitant Therapy] (sha256 bf07332dc024c8908b0e60b6df68853d7fbfe12e529b0ee2365b0ddd9d3b6f5c; path dosage_and_administration[0]) "Patients taking cyclosporine and darolutamide The dose of rosuvastatin tablets should not exceed 5 mg once daily"

## simvastatin_lovastatin__hiv_pi_cobicistat

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `4`

### evidence[0] — `dailymed-zocor-hiv-pi-cobicistat-contraindication` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — ZOCOR (simvastatin) tablets | regulator="FDA (United States)" | product="ZOCOR (simvastatin) tablets" | section="7.1 Drug Interactions — Strong CYP3A4 Inhibitors"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%228f55d5de-5a4f-4a39-8c84-c53976dd6af9%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8f55d5de-5a4f-4a39-8c84-c53976dd6af9
- document: `8f55d5de-5a4f-4a39-8c84-c53976dd6af9@11`; retrieved_at=`2026-07-24`
- SPL: version=`11`; effective_time=`20250328`; source_date=`2025-03-28`
- payload: sha256=`900e3302851ceb0634ca7d584e1189e1e4ed0ec08e5b5fd963ae9366b145ec4c`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. ZOCOR label contraindicates strong CYP3A4 inhibitors and names selected HIV protease inhibitors and cobicistat-containing products as examples.
- source_effect: `["increased_simvastatin_exposure_and_myopathy_risk"]`
- label_action: `["contraindicated_concomitant_use"]`
- scope: `{"scope_type":"source_product_plus_source_class_and_named_regimens","source_product":"ZOCOR (simvastatin)","source_class":"strong CYP3A4 inhibitors","source_named_hiv_examples":["nelfinavir","ritonavir","darunavir/ritonavir"],"source_named_boosters":["cobicistat-containing products"],"runtime_class":"hiv_protease_inhibitor_or_pk_booster","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source does not establish one action for bare atazanavir, bare darunavir, lopinavir without ritonavir, or cobicistat without its complete regimen.
  - It supports simvastatin, not lovastatin or every local class member.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [7.1 Drug Interactions — Strong CYP3A4 Inhibitors] (sha256 d44d204c8653ce90b68296b198888dc378b936bb3d574726ee7145e14bb43343; path drug_interactions[0]) "Concomitant use of strong CYP3A4 inhibitors with ZOCOR is contraindicated [see Contraindications (4)]."
  - [7.1 Drug Interactions — Strong CYP3A4 Inhibitors] (sha256 675ba8248ef82900e5d97515e27751a5dfe8fc728b4faf4e9d23de2d51d5d5ba; path drug_interactions[0]) "Examples: Select azole anti-fungals (e.g., itraconazole, ketoconazole, posaconazole, and voriconazole), select macrolide antibiotics (e.g., erythromycin and clarithromycin), select HIV protease inhibitors (e.g., nelfinavir, ritonavir, and darunavir/ritonavir), select HCV protease inhibitors (e.g., boceprevir and telaprevir), cobicistat-containing products, and nefazodone."

### evidence[1] — `dailymed-lovastatin-hiv-pi-cobicistat-contraindication` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — lovastatin tablets | regulator="FDA (United States)" | product="lovastatin tablets" | section="Contraindications"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%220a680e13-0356-4e08-a7fe-78b96ba51b9d%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0a680e13-0356-4e08-a7fe-78b96ba51b9d
- document: `0a680e13-0356-4e08-a7fe-78b96ba51b9d@14`; retrieved_at=`2026-07-24`
- SPL: version=`14`; effective_time=`20250107`; source_date=`2025-01-07`
- payload: sha256=`3642ce135e5a1bc53c3cef72fd96deb80b020ebe3845c5449f0529da5fac51da`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["contraindications[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. lovastatin label contraindicates strong CYP3A4 inhibitors and names HIV protease inhibitors and cobicistat-containing products as examples.
- source_effect: `["increased_lovastatin_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["contraindicated_concomitant_use"]`
- scope: `{"scope_type":"source_product_plus_source_inhibitor_class","source_product":"lovastatin tablets","source_class":"strong CYP3A4 inhibitors","source_named_hiv_class":"HIV protease inhibitors","source_named_boosters":["cobicistat-containing products"],"runtime_class":"hiv_protease_inhibitor_or_pk_booster","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source class statement does not establish one action for every bare ingredient in the local regimen-oriented class.
  - It supports lovastatin, not simvastatin or UK/Indian jurisdiction.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [Contraindications] (sha256 755b6825b4ee24c4482faa9606b28a591b39940032ddc7796466b923b7131da3; path contraindications[0]) "Concomitant administration with strong CYP3A4 inhibitors (e.g., itraconazole, ketoconazole, posaconazole, voriconazole, HIV protease inhibitors, boceprevir, telaprevir, erythromycin, clarithromycin, telithromycin ,nefazodone, and cobicistat-containing products) (see WARNINGS, Myopathy/Rhabdomyolysis) ."

### evidence[2] — `dailymed-simvastatin-hiv-pi-cobicistat-current-label` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — simvastatin tablets | regulator="FDA (United States)" | product="simvastatin tablets" | section="7.1 Drug Interactions — Strong CYP3A4 Inhibitors"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%224724dbb4-3613-4e6a-948f-a43d34f97f06%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4724dbb4-3613-4e6a-948f-a43d34f97f06
- document: `4724dbb4-3613-4e6a-948f-a43d34f97f06@29`; retrieved_at=`2026-07-24`
- SPL: version=`29`; effective_time=`20260511`; source_date=`2026-05-11`
- payload: sha256=`dd00af1b26a20abfe40815e7dceb4da0f27cf205cfd6db7e83b01c7b3b95aac6`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. simvastatin label contraindicates strong CYP3A4 inhibitors and names selected HIV protease inhibitors and cobicistat-containing products as examples.
- source_effect: `["increased_simvastatin_myopathy_and_rhabdomyolysis_risk"]`
- label_action: `["contraindicated_concomitant_use","suspend_simvastatin_during_strong_inhibitor_treatment"]`
- scope: `{"scope_type":"source_product_plus_source_class_and_named_regimens","source_product":"simvastatin tablets","source_class":"strong CYP3A4 inhibitors","source_named_hiv_examples":["nelfinavir","ritonavir","darunavir/ritonavir"],"source_named_boosters":["cobicistat-containing products"],"runtime_class":"hiv_protease_inhibitor_or_pk_booster","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source does not establish one action for every bare ingredient in the local regimen-oriented class.
  - It supports simvastatin, not lovastatin, and does not establish Indian jurisdiction.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [7.1 Drug Interactions — Strong CYP3A4 Inhibitors] (sha256 6e1416907bdd770786e3fb88a97d2ce924f0417b2c27ec9f4ab92eecdae47e10; path drug_interactions[0]) "Intervention: Concomitant use of strong CYP3A4 inhibitors with simvastatin is contraindicated [see Contraindications (4)]. If treatment with a CYP3A4 inhibitor is unavoidable, suspend simvastatin during the course of strong CYP3A4 inhibitor treatment. Examples: Select azole anti-fungals (e.g., itraconazole, ketoconazole, posaconazole, and voriconazole), select macrolide antibiotics (e.g., erythromycin and clarithromycin), select HIV protease inhibitors (e.g., nelfinavir, ritonavir, and darunavir/ritonavir), select HCV protease inhibitors (e.g., boceprevir and telaprevir), cobicistat-containing products, and nefazodone."

### evidence[3] — `dailymed-simvastatin-hiv-pi-examples-and-suspension` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — simvastatin tablets | regulator="FDA (United States)" | product="simvastatin tablets" | section="7.1 Drug Interactions — Strong CYP3A4 Inhibitors"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%225c1c694c-4b08-469e-b538-08e69df06146%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5c1c694c-4b08-469e-b538-08e69df06146
- document: `5c1c694c-4b08-469e-b538-08e69df06146@90400`; retrieved_at=`2026-07-24`
- SPL: version=`90400`; effective_time=`20230821`; source_date=`2023-08-21`
- payload: sha256=`3510c0399657f1bd931349e85ecd8deea1a11d4ac067b2473968f3716966f207`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. simvastatin label directs suspension during unavoidable strong-CYP3A4-inhibitor treatment and names selected HIV protease inhibitors and cobicistat products as examples.
- source_effect: `["increased_simvastatin_exposure_and_myopathy_risk"]`
- label_action: `["suspend_simvastatin_during_strong_inhibitor_treatment"]`
- scope: `{"scope_type":"source_product_plus_source_class_and_named_regimens","source_product":"simvastatin tablets","source_class":"strong CYP3A4 inhibitors","source_named_hiv_examples":["nelfinavir","ritonavir","darunavir/ritonavir"],"source_named_boosters":["cobicistat-containing products"],"runtime_class":"hiv_protease_inhibitor_or_pk_booster","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source does not establish one action for bare atazanavir, bare darunavir, or every local regimen-class member.
  - It does not establish Indian jurisdiction.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [7.1 Drug Interactions — Strong CYP3A4 Inhibitors] (sha256 218f225faaace391a2c563b1a71d8842677cd2cdf1ae2a0ccf67de41541abc44; path drug_interactions[0]) "If treatment with a CYP3A4 inhibitor is unavoidable, suspend simvastatin during the course of strong CYP3A4 inhibitor treatment. Examples: Select azole anti-fungals (e.g., itraconazole, ketoconazole, posaconazole, and voriconazole), select macrolide antibiotics (e.g., erythromycin and clarithromycin), select HIV protease inhibitors (e.g., nelfinavir, ritonavir, and darunavir/ritonavir), select HCV protease inhibitors (e.g., boceprevir and telaprevir), cobicistat-containing products, and nefazodone."

## atorvastatin__hiv_pi_cobicistat

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-atorvastatin-antiretroviral-regimen-matrix` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — atorvastatin calcium tablets | regulator="FDA (United States)" | product="atorvastatin calcium tablets" | section="2.6 Dosage in Patients Taking Cyclosporine, Clarithromycin, Itraconazole, Letermovir, or Certain Protease Inhibitors"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2240e6b63f-0a20-404a-8915-2f698877a96b%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=40e6b63f-0a20-404a-8915-2f698877a96b
- document: `40e6b63f-0a20-404a-8915-2f698877a96b@35`; retrieved_at=`2026-07-24`
- SPL: version=`35`; effective_time=`20240819`; source_date=`2024-08-19`
- payload: sha256=`604ce6214db052c58d1ca831b8329c6c47e28d4003925cb32b46600c84926a30`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]","dosage_and_administration[0]","dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. atorvastatin label uses different actions for different antiretroviral regimens, including avoidance, lowest-dose use, and a 20 mg cap.
- source_effect: `["regimen_specific_increase_in_atorvastatin_exposure_and_myopathy_risk"]`
- label_action: `["avoid_atorvastatin_with_named_regimens","use_lowest_necessary_atorvastatin_dose_with_lopinavir_plus_ritonavir","limit_atorvastatin_to_20_mg_with_named_regimens"]`
- scope: `{"scope_type":"source_named_regimen_matrix","source_regimens":["tipranavir plus ritonavir","lopinavir plus ritonavir","saquinavir plus ritonavir","darunavir plus ritonavir","fosamprenavir","fosamprenavir plus ritonavir"],"runtime_class":"hiv_protease_inhibitor_or_pk_booster","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source does not support flattening these regimen-specific actions into one bare-member action.
  - The fragments do not cover every cobicistat-, atazanavir-, darunavir-, lopinavir-, or ritonavir-containing regimen.
  - The pair matcher cannot determine the complete regimen or atorvastatin dose.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [2.6 Dosage — avoid regimens] (sha256 7f9debcc37ddad7eba436e3fecb51e2577954e8d778a39854bd964cd94792309; path dosage_and_administration[0]) "the HIV protease inhibitor tipranavir plus ritonavir or the hepatitis C virus (HCV) protease inhibitor glecaprevir plus pibrentasvir or letermovir when co-administered with cyclosporine, therapy with atorvastatin calcium tablets should be avoided."
  - [2.6 Dosage — lopinavir plus ritonavir] (sha256 4c4db155caf3053d9069d9394d2553ba0fa9e82f61e77f9e387b9d4390cc67e4; path dosage_and_administration[0]) "In patients with HIV taking lopinavir plus ritonavir, use the lowest dose necessary of atorvastatin calcium tablets."
  - [2.6 Dosage — selected 20 mg cap regimens] (sha256 aa95f59009b0eb855a4f2d31842b6fd88e205f2f3cb2ef7fac07141f123539d3; path dosage_and_administration[0]) "in patients with HIV taking a combination of saquinavir plus ritonavir, darunavir plus ritonavir, fosamprenavir, fosamprenavir plus ritonavir or letermovir therapy with atorvastatin calcium tablets should be limited to 20 mg, and appropriate clinical assessment is recommended to ensure that the lowest dose necessary of atorvastatin calcium tablets is used."

## rosuvastatin__hiv_pi_cobicistat

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-rosuvastatin-named-antiretroviral-regimens-10mg-cap` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — rosuvastatin tablets | regulator="FDA (United States)" | product="rosuvastatin tablets" | section="2.4 Use with Concomitant Therapy"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22ac89adcd-3226-4a66-8902-0f0a33be159a%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ac89adcd-3226-4a66-8902-0f0a33be159a
- document: `ac89adcd-3226-4a66-8902-0f0a33be159a@13`; retrieved_at=`2026-07-24`
- SPL: version=`13`; effective_time=`20230315`; source_date=`2023-03-15`
- payload: sha256=`493362e00005ddd7408577896aa30b5b346c8a215f344258dcb181d054796494`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. rosuvastatin label directs a 5 mg starting dose and 10 mg maximum for named ritonavir-containing regimens.
- source_effect: `["increased_rosuvastatin_exposure_and_myopathy_risk"]`
- label_action: `["initiate_rosuvastatin_at_5_mg_once_daily","limit_rosuvastatin_to_10_mg_once_daily"]`
- scope: `{"scope_type":"source_named_regimens_with_dose_cap","source_regimens":["atazanavir and ritonavir","lopinavir and ritonavir","dasabuvir/ombitasvir/paritaprevir/ritonavir"],"source_additional_non_hiv_regimens":["simeprevir","elbasvir/grazoprevir","sofosbuvir/velpatasvir","glecaprevir/pibrentasvir"],"runtime_class":"hiv_protease_inhibitor_or_pk_booster","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source does not support flattening named complete regimens into one action for bare ritonavir, cobicistat, lopinavir, atazanavir, or darunavir.
  - The pair matcher cannot determine the complete regimen or rosuvastatin dose.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [2.4 Use with Concomitant Therapy] (sha256 70c6df54a6cc5aeb0d09bbff3992df21b8f0871820885f966f7da891157cfd78; path dosage_and_administration[0]) "Patients taking atazanavir and ritonavir, lopinavir and ritonavir, simeprevir or combination of dasabuvir/ombitasvir/paritaprevir/ritonavir, elbasvir/grazoprevir, sofosbuvir/velpatasvir and glecaprevir/pibrentasvir Initiate rosuvastatin tablets therapy with 5 mg once daily. The dose of rosuvastatin tablets should not exceed 10 mg once daily [see Warnings and Precautions ( 5.1 ), Drug Interactions ( 7.3 ), and Clinical Pharmacology ( 12.3 )]."

## pravastatin__hiv_pi_cobicistat

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `2`

### evidence[0] — `dailymed-pravastatin-darunavir-ritonavir-pk` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — pravastatin sodium tablets | regulator="FDA (United States)" | product="pravastatin sodium tablets" | section="12.3 Clinical Pharmacology — drug-interaction pharmacokinetic table"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%221123d56c-16f0-4f81-b56f-67b1f343ae1e%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1123d56c-16f0-4f81-b56f-67b1f343ae1e
- document: `1123d56c-16f0-4f81-b56f-67b1f343ae1e@12`; retrieved_at=`2026-07-24`
- SPL: version=`12`; effective_time=`20231219`; source_date=`2023-12-19`
- payload: sha256=`79b62055c3c31412e8e769b8405d5624bc25624ab1569739ed0b4d331bfef45a`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["clinical_pharmacology[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. pravastatin label reports increased pravastatin exposure with darunavir/ritonavir.
- source_effect: `["increased_pravastatin_auc_and_peak_exposure_with_darunavir_ritonavir"]`
- label_action: `[]`
- scope: `{"scope_type":"source_exact_regimen_pharmacokinetic_observation","source_object":"pravastatin 40 mg single dose","source_regimen":"darunavir 600 mg twice daily plus ritonavir 100 mg twice daily","runtime_class":"hiv_protease_inhibitor_or_pk_booster","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The pharmacokinetic table row does not state a label action, dose recommendation, severity, or monitoring instruction.
  - It does not support bare darunavir or ritonavir outside the complete studied regimen.
  - It does not establish an action for cobicistat, atazanavir, or other class members.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [12.3 Clinical Pharmacology — darunavir/ritonavir row] (sha256 90ed6920e30480854e52d170ff92e1d7a4197a2c82e4a18eb93252e84222c502; path clinical_pharmacology[0]) "Darunavir 600 mg BID/Ritonavir 100 mg BID for 7 days 40 mg single dose ↑81% ↑63%"

### evidence[1] — `dailymed-pravastatin-lopinavir-ritonavir-pk` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — pravastatin sodium tablets | regulator="FDA (United States)" | product="pravastatin sodium tablets" | section="12.3 Clinical Pharmacology — drug-interaction pharmacokinetic table"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%221123d56c-16f0-4f81-b56f-67b1f343ae1e%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1123d56c-16f0-4f81-b56f-67b1f343ae1e
- document: `1123d56c-16f0-4f81-b56f-67b1f343ae1e@12`; retrieved_at=`2026-07-24`
- SPL: version=`12`; effective_time=`20231219`; source_date=`2023-12-19`
- payload: sha256=`79b62055c3c31412e8e769b8405d5624bc25624ab1569739ed0b4d331bfef45a`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["clinical_pharmacology[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. pravastatin label reports a smaller increase in pravastatin exposure with lopinavir/ritonavir than with the separately listed darunavir/ritonavir regimen.
- source_effect: `["increased_pravastatin_auc_and_peak_exposure_with_lopinavir_ritonavir"]`
- label_action: `[]`
- scope: `{"scope_type":"source_exact_regimen_pharmacokinetic_observation","source_object":"pravastatin 20 mg once daily","source_regimen":"Kaletra (lopinavir/ritonavir) 400 mg/100 mg twice daily","runtime_class":"hiv_protease_inhibitor_or_pk_booster","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The pharmacokinetic table row does not state a label action, dose recommendation, severity, or monitoring instruction.
  - It does not support bare lopinavir or ritonavir outside the complete studied regimen.
  - It does not establish an action for cobicistat, atazanavir, darunavir, or other class members.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [12.3 Clinical Pharmacology — Kaletra row] (sha256 bf56860eaee921f368188cd4c28df6185dfe454673cf0f8b9086383b28e9d700; path clinical_pharmacology[0]) "Kaletra 400 mg/100 mg BID for 14 days 20 mg OD for 4 days ↑33% ↑26%"

## pitavastatin__hiv_pi_cobicistat

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `dailymed-pitavastatin-antiretroviral-regimen-pk-matrix` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — LIVALO (pitavastatin) tablets | regulator="FDA (United States)" | product="LIVALO (pitavastatin) tablets" | section="12.3 Clinical Pharmacology — Table 3"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2244dcbf97-99ec-427c-ba50-207e0069d6d2%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=44dcbf97-99ec-427c-ba50-207e0069d6d2
- document: `44dcbf97-99ec-427c-ba50-207e0069d6d2@12`; retrieved_at=`2026-07-24`
- SPL: version=`12`; effective_time=`20260331`; source_date=`2026-03-31`
- payload: sha256=`ad31384291beba681afeb97a1c13683602d3c6cbc94c94880c26bd432e991a84`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["clinical_pharmacology[0]","clinical_pharmacology[0]","clinical_pharmacology[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. pitavastatin label reports directionally different exposure changes with atazanavir, darunavir/ritonavir, and lopinavir/ritonavir.
- source_effect: `["increased_pitavastatin_exposure_with_atazanavir","decreased_pitavastatin_exposure_with_darunavir_ritonavir","decreased_pitavastatin_exposure_with_lopinavir_ritonavir"]`
- label_action: `[]`
- scope: `{"scope_type":"source_named_regimen_pharmacokinetic_matrix","source_object":"pitavastatin","source_regimens":["atazanavir","darunavir/ritonavir","lopinavir/ritonavir"],"runtime_class":"hiv_protease_inhibitor_or_pk_booster","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The pharmacokinetic table rows do not state a label action, dose recommendation, severity, or monitoring instruction.
  - The directionally different effects do not support one class-wide action.
  - The source does not establish an interaction action for cobicistat or bare ritonavir.
  - The local severity tier and dispense workflow are review-model mappings, not values assigned by the cited label.
- fragments:
  - [12.3 Clinical Pharmacology — atazanavir row] (sha256 cf0e8103f3cc3a89675e8b4ac9caba468af9e5a27bb8b1d7a0e223b0d145f9f1; path clinical_pharmacology[0]) "Atazanavir Pitavastatin 4 mg QD + atazanavir 300 mg daily for 5 days ↑ 31% ↑ 60%"
  - [12.3 Clinical Pharmacology — darunavir/ritonavir row] (sha256 d4c3c38b0a03580baa1ea484cd0f682e249933fdb761bb91477caddd81a97693; path clinical_pharmacology[0]) "Darunavir/Ritonavir Pitavastatin 4mg QD on Days 1-5 and 12-16 + darunavir/ritonavir 800mg/100 mg QD on Days 6-16 ↓ 26% ↓ 4%"
  - [12.3 Clinical Pharmacology — lopinavir/ritonavir row] (sha256 241ae5b6f956cce34c40190a4db6a74a9f412a459d481f4a5a14b4046f0b2abe; path clinical_pharmacology[0]) "Lopinavir/Ritonavir Pitavastatin 4 mg QD on Days 1-5 and 20-24 + lopinavir/ritonavir 400 mg/100 mg BID on Days 9 - 24 ↓ 20% ↓4 %"
