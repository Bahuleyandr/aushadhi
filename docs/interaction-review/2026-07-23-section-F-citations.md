# Section F (hyperkalaemia / renal / nephrotoxicity) — exact openFDA citation worksheet

Generated from `docs/interaction-review/batch-01-v2/sections/F.verified.jsonl`.

- Frozen Section F SHA-256: `73a68362fda43c9ff266940199f322339aad50ee3a11e440806af5b2efe31037`
- Rules: 16
- Evidence records: 17
- Exact fragments: 42
- Exact openFDA set-ID queries: 15
- Runtime enabled: 0
- Clinical context complete: 0
- Promotion eligible: 0
- Policy: `openfda-labels` / `interaction-evidence` / `CC0-1.0`
- Review state: machine-reconciled, pending clinician review

The source URLs below are the licensed openFDA origins. DailyMed links are references only. Exact fragments remain bound to their selected SPL payload, source path, document version, effective time, and canonical payload hash.

## acei_arb__mra_spironolactone_eplerenone — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[61]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-spironolactone`
- Product: spironolactone
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — ALDACTONE (spironolactone) tablets, film coated; labeler Pfizer Laboratories Div Pfizer Inc
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%220fed2822-3a03-4b64-9857-c682fcd462bc%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0fed2822-3a03-4b64-9857-c682fcd462bc
- Document: `0fed2822-3a03-4b64-9857-c682fcd462bc` version `25`; effective time `20251128`
- Payload SHA-256: `8cea6f08107df5cc687f6f7138dd3bfd3c5251243b272f4b854bbcde7ad5a70d`
- Proposition: Spironolactone combined with an ACE inhibitor or ARB increases the risk of hyperkalaemia.
- Source effect: `["hyperkalemia","severe hyperkalemia (per §7.1 wording, with potassium supplementation or drugs that can increase potassium)"]`
- Label action: `["monitor_serum_potassium","monitor_serum_potassium_more_frequently_when_combined_with_other_potassium_increasing_drugs","check_serum_potassium_when_acei_or_arb_therapy_is_altered","reduce_dose","discontinue","treat_hyperkalemia","discontinue_potassium_supplementation_in_heart_failure_patients_starting_aldactone"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_members_plus_source_class","object_members":["acei_arb"],"source_named_members":["ALDACTONE (spironolactone)"],"source_classes":["angiotensin converting enzyme inhibitors","angiotensin receptor blockers","ACE inhibitors","ARB"],"runtime_class":"mineralocorticoid_receptor_antagonist","requires_clinician_class_mapping":true}`

Exact fragments:

- **5.1 Hyperkalemia (Warnings and Precautions)** at `warnings_and_cautions[0]`; SHA-256 `1b4c7e2f459a648f117005cea4a2149c000e8fa183b8cd73c4aab336dc23b1b4`: “ALDACTONE can cause hyperkalemia. This risk is increased by impaired renal function or concomitant potassium supplementation, potassium-containing salt substitutes or drugs that increase potassium, such as angiotensin converting enzyme inhibitors and angiotensin receptor blockers”
- **5.1 Hyperkalemia (Warnings and Precautions)** at `warnings_and_cautions[0]`; SHA-256 `8a6e3ad6f6ad19d57bd86112ea7131b4c5ba27a44d595d99bf5d591b6925269b`: “Monitor serum potassium within 1 week of initiation or titration of ALDACTONE and regularly thereafter. More frequent monitoring may be needed when ALDACTONE is given with other drugs that cause hyperkalemia or in patients with impaired renal function.”
- **5.1 Hyperkalemia (Warnings and Precautions)** at `warnings_and_cautions[0]`; SHA-256 `78a4b512c6c1e7fa7161ed384261b76ca1b04bedd6f086b2f0b4fe062166e4e8`: “If hyperkalemia occurs, decrease the dose or discontinue ALDACTONE and treat hyperkalemia.”
- **7.1 Drugs and Supplements Increasing Serum Potassium (Drug Interactions)** at `drug_interactions[0]`; SHA-256 `9efe3993c58c985b3409c008b3b511fc7e09b190ddcdf7c70696e756567f8334`: “Concomitant administration of ALDACTONE with potassium supplementation or drugs that can increase potassium may lead to severe hyperkalemia.”
- **7.1 Drugs and Supplements Increasing Serum Potassium (Drug Interactions)** at `drug_interactions[0]`; SHA-256 `11bc3db5f5324159eea659544a1917ba93fe2c86c69578a32a4a23d6810dbda3`: “Check serum potassium levels when ACE inhibitor or ARB therapy is altered in patients receiving ALDACTONE.”

Does not by itself support:

- Eplerenone — this label is the spironolactone (ALDACTONE) product label only; it says nothing about eplerenone (INSPRA), which requires its own citation.
- Any class-level statement about MRAs / aldosterone antagonists as a group — the source speaks only for spironolactone on the MRA side.
- A contraindication or 'avoid' instruction for the ACEi/ARB + spironolactone combination — the label directs monitoring and dose reduction/discontinuation if hyperkalemia occurs, not avoidance of the combination.
- The word 'severe' as applied to §5.1: §5.1 says only 'can cause hyperkalemia'; 'severe hyperkalemia' appears in §7.1 in the context of potassium supplementation or potassium-increasing drugs generally.
- Individual named ACE inhibitor or ARB molecules (e.g. enalapril, losartan) — the label names only the classes generically.

## acei_arb__mra_spironolactone_eplerenone — evidence[1]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[61]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-eplerenone`
- Product: eplerenone
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — INSPRA (eplerenone) tablets, film coated; labeler Viatris Specialty LLC; label revised 6/2025
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%221a52bedc-8e2c-4116-a296-a87770676b4a%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1a52bedc-8e2c-4116-a296-a87770676b4a
- Document: `1a52bedc-8e2c-4116-a296-a87770676b4a` version `6`; effective time `20250623`
- Payload SHA-256: `f37b6fa100fdc46263e88ea707ea74b06866c41b3abddfbe204de9a0511a5cc5`
- Proposition: The eplerenone label identifies concomitant ACE inhibitors and ARBs as factors that increase hyperkalaemia risk and directs patient selection, monitoring, and dose reduction if hyperkalaemia develops.
- Source effect: `["increased_risk_of_hyperkalaemia"]`
- Label action: `["monitor_serum_potassium","use_with_caution","reduce_dose"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_members_plus_source_class","object_members":["acei_arb"],"source_named_members":["eplerenone","INSPRA"],"source_classes":["ACEs","ARBs","NSAIDs","moderate CYP3A inhibitors"],"runtime_class":"mineralocorticoid_receptor_antagonist","requires_clinician_class_mapping":true}`

Exact fragments:

- **5 WARNINGS AND PRECAUTIONS — 5.1 Hyperkalemia** at `warnings_and_cautions[0]`; SHA-256 `c8ffc9e6fa86a724ae5e43e749fef54051e42577ed642ed84be3d0819724c6d6`: “The risk of hyperkalemia is higher in patients with impaired renal function, proteinuria, diabetes and those concomitantly treated with ACEs, ARBs, NSAIDs and moderate CYP3A inhibitors.”
- **5 WARNINGS AND PRECAUTIONS — 5.1 Hyperkalemia** at `warnings_and_cautions[0]`; SHA-256 `1cdc45cf6de028bf9d1a20eac04fca420e0b7b3cecb5d59f29d9c6423bf02875`: “Minimize the risk of hyperkalemia with proper patient selection and monitoring”
- **5 WARNINGS AND PRECAUTIONS — 5.1 Hyperkalemia** at `warnings_and_cautions[0]`; SHA-256 `29cc3077c789223ac84683f6037dfe5120fd3f22594b5eea3be4301c89249baf`: “Monitor patients for the development of hyperkalemia until the effect of INSPRA is established. Patients who develop hyperkalemia (5.5-5.9 mEq/L) may continue INSPRA therapy with proper dose adjustment. Dose reduction decreases potassium levels.”

Does not by itself support:

- spironolactone — this is the eplerenone (INSPRA) US label only; it says nothing about spironolactone, so the MRA side of the rule is verified for eplerenone alone
- mechanism — no text about additive aldosterone-receptor antagonism / RAAS blockade reducing potassium excretion appears in the quoted section
- product-specific potassium/renal initiation limits — the quoted Warnings text contains no serum-potassium-at-initiation threshold and no creatinine/CrCl cut-off; those live in Contraindications (4) and Dosage and Administration (2.1), which were not fetched or quoted here
- an ACEi/ARB-specific dose branch — the only dose-modification language here is generic (proper dose adjustment; dose reduction decreases potassium levels) plus a moderate-CYP3A-inhibitor dose reduction
- contraindication — the quoted text does not contraindicate or prohibit ACEi/ARB co-administration; it directs risk minimisation and monitoring

## acei_arb__amiloride — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[61]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-amiloride`
- Product: amiloride hydrochloride
- Publisher: openFDA drug-label record (company-submitted SPL); Endo USA, Inc. (AMILORIDE HYDROCHLORIDE tablet, US FDA label via DailyMed)
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22e0cc2d44-436a-47e8-a890-589882fff4c4%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e0cc2d44-436a-47e8-a890-589882fff4c4
- Document: `e0cc2d44-436a-47e8-a890-589882fff4c4` version `11`; effective time `20241121`
- Payload SHA-256: `1aee9554c99f7f00b8bde5464a7a9eb745f0a22f50b75e34c99091fb11ff97cb`
- Proposition: The amiloride label states that concomitant ACE inhibitor or angiotensin II receptor antagonist use may increase hyperkalaemia risk and directs caution with frequent serum-potassium monitoring.
- Source effect: `["increased_risk_of_hyperkalaemia"]`
- Label action: `["use_with_caution","monitor_serum_potassium"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_members_plus_source_class","object_members":["acei_arb"],"source_named_members":["amiloride HCl"],"source_classes":["potassium-conserving agents","angiotensin-converting enzyme inhibitor","angiotensin II receptor antagonist"],"runtime_class":"epithelial_sodium_channel_blocker","requires_clinician_class_mapping":true}`

Exact fragments:

- **WARNINGS** at `warnings[0]`; SHA-256 `b3c0bdcff9a8e4c63d5e874d161e7e2279c252b1b7bf8456e2a1199a981c53cc`: “The risk of hyperkalemia may be increased when potassium-conserving agents, including amiloride HCl, are administered concomitantly with an angiotensin-converting enzyme inhibitor, an angiotensin II receptor antagonist, cyclosporine or tacrolimus.”
- **WARNINGS** at `precautions[0]`; SHA-256 `c306c083b527c802a590188a409bcc473c13cb0e4e710b67c16367cbf27d153f`: “Therefore, if concomitant use of these agents is indicated because of demonstrated hypokalemia, they should be used with caution and with frequent monitoring of serum potassium.”

Does not by itself support:

- triamterene as a member - the label names only amiloride HCl; a triamterene (Dyrenium) or triamterene/HCTZ label is needed for that arm
- any severity grading - the quoted sentences say risk 'may be increased', not that the interaction is severe or fatal
- contraindication or avoidance - the label directs caution plus monitoring, not avoidance
- any claim about ciclosporin/tacrolimus being in scope of this rule (named in the source but outside the rule)

## acei_arb__potassium_supplement_salt_substitute — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[62]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-acei-potassium`
- Product: ZESTRIL (lisinopril) tablets
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — ZESTRIL (lisinopril) tablets; labeler Upsher-Smith Laboratories, LLC
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22838c2d78-d2d8-4981-9ec9-e50ef9e1a5d8%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=838c2d78-d2d8-4981-9ec9-e50ef9e1a5d8
- Document: `838c2d78-d2d8-4981-9ec9-e50ef9e1a5d8` version `2`; effective time `20250102`
- Payload SHA-256: `f003b80436f1469921fb898e272444b61f754376f4f7c12b396e485f5f2b6a2f`
- Proposition: The ZESTRIL (lisinopril) label identifies potassium supplements and potassium-containing salt substitutes as hyperkalaemia risk factors and directs periodic serum-potassium monitoring and prescriber consultation before salt-substitute use.
- Source effect: `["hyperkalemia"]`
- Label action: `["monitor_serum_potassium_periodically","advise_patient_not_to_use_potassium_containing_salt_substitutes_without_consulting_physician"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_members_plus_source_class","object_members":["lisinopril"],"source_named_members":["lisinopril"],"source_classes":["drugs that inhibit the renin angiotensin system"],"runtime_class":"potassium_supplement_or_salt_substitute","requires_clinician_class_mapping":true}`

Exact fragments:

- **5.5 Hyperkalemia (WARNINGS AND PRECAUTIONS)** at `warnings_and_cautions[0]`; SHA-256 `617ae35ed0305d8e6bc479b93f6d4155dd849032b56b2719085d4a688cd414f0`: “Serum potassium should be monitored periodically in patients receiving Zestril. Drugs that inhibit the renin angiotensin system can cause hyperkalemia. Risk factors for the development of hyperkalemia include renal insufficiency, diabetes mellitus, and the concomitant use of potassium-sparing diuretics, potassium supplements and/or potassium-containing salt substitutes [see Drug Interactions (7.1) ] .”
- **17 PATIENT COUNSELING INFORMATION - Hyperkalemia** at `information_for_patients[0]`; SHA-256 `5a358b4af2ddf71fd57f51482a30678595b93bfa3c52bd472f134dfff559900d`: “Tell patients not to use salt substitutes containing potassium without consulting their physician.”

Does not by itself support:

- Applies to angiotensin receptor blockers (losartan, valsartan, candesartan, telmisartan, irbesartan, olmesartan, etc.) — no ARB is named anywhere in this label
- Applies to ACE inhibitors other than lisinopril (enalapril, ramipril, perindopril, captopril, etc.) — none is named
- That potassium supplements or potassium-containing salt substitutes are contraindicated, or must be avoided outright, with ACE inhibitors/ARBs — the label frames them as a risk factor and gives monitoring/counselling advice, not a contraindication
- That the class-level sentence 'Drugs that inhibit the renin angiotensin system can cause hyperkalemia' is tied to potassium supplements or salt substitutes for non-lisinopril members; that sentence is a bare mechanism statement with no concomitant-product interaction named

## acei_arb__nsaid_systemic — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[63]`
- Local mapping: `moderate/confirm_and_monitor`
- Source ID: `fda-label-nsaid-renal`
- Product: ibuprofen
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (NLM) — CALDOLOR (ibuprofen) injection label, Cumberland Pharmaceuticals Inc., Revised 11/2024
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%221eaa7790-f1a1-4f51-b10a-cbbaf033f684%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1eaa7790-f1a1-4f51-b10a-cbbaf033f684
- Document: `1eaa7790-f1a1-4f51-b10a-cbbaf033f684` version `16`; effective time `20250214`
- Payload SHA-256: `c36e698bbd083a7858376e29b0b1d35656f3fc6c42f82267d53edd969f49959d`
- Proposition: The intravenous ibuprofen label states that NSAIDs may diminish ACE inhibitor or ARB antihypertensive effect and may worsen renal function in elderly, volume-depleted, or renally impaired patients.
- Source effect: `["diminished antihypertensive effect of ACE inhibitors/ARBs/beta-blockers","deterioration of renal function","possible acute renal failure (usually reversible)"]`
- Label action: `["monitor_blood_pressure","monitor_for_signs_of_worsening_renal_function","ensure_adequate_hydration","assess_renal_function_at_baseline_and_periodically"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"explicit_class_statement","object_members":["acei_arb"],"source_class_term":"NSAIDs","source_examples":["CALDOLOR (ibuprofen) injection","propranolol (named only as a beta-blocker example)"],"runtime_class":"nsaid","requires_clinician_class_mapping":true}`

Exact fragments:

- **Drug Interactions — Clinical Impact** at `drug_interactions[0]`; SHA-256 `7b4b6826d189abac4851e99607e119753800a26c92f0fe115276884204678056`: “NSAIDs may diminish the antihypertensive effect of angiotensin converting enzyme (ACE) inhibitors, angiotensin receptor blockers (ARBs), or beta-blockers (including propranolol).”
- **Drug Interactions — Clinical Impact** at `drug_interactions[0]`; SHA-256 `352082b73ac96c1f6c4d015b713d4d5ae95b471112c6d07a149a5061aa67f34d`: “In patients who are elderly, volume-depleted (including those on diuretic therapy), or have renal impairment, co-administration of an NSAID with ACE inhibitors or ARBs may result in deterioration of renal function, including possible acute renal failure. These effects are usually reversible.”
- **Drug Interactions — Intervention** at `drug_interactions[0]`; SHA-256 `55b4a1eed0af138478c768e29834d85019cd3da86df26b4c195f3859806f7ab8`: “During concomitant use of CALDOLOR and ACE-inhibitors, ARBs, or beta- blockers, monitor blood pressure to ensure that the desired blood pressure is obtained.”
- **Drug Interactions — Intervention** at `drug_interactions[0]`; SHA-256 `b2422143555942a4b8f6c6a36654aca27af787829711fa93284f305d486cbada`: “During concomitant use of CALDOLOR and ACE-inhibitors or ARBs in patients who are elderly, volume-depleted, or have impaired renal function, monitor for signs of worsening renal function [ see Warnings and Precautions ( 5.6 ) ].”
- **Drug Interactions — Intervention** at `drug_interactions[0]`; SHA-256 `fd6a69ae66f79383147d8dd5a903bebade6aa3c397cc0e27dc35f1a2c77bd1e4`: “When these drugs are administered concomitantly, patients should be adequately hydrated. Assess renal function at the beginning of the concomitant treatment and periodically thereafter.”

Does not by itself support:

- Renal deterioration/acute renal failure stated only for patients who are elderly, volume-depleted (including on diuretics), or with renal impairment — the label does not state increased renal risk for all patients on an NSAID + ACEi/ARB.
- Does not state contraindication, avoidance, or 'do not use' — the only actions are monitoring and hydration.
- This is an intravenous ibuprofen (CALDOLOR) SPL; it does not by itself establish the wording of oral ibuprofen labels (the checked pre-PLR oral ibuprofen SPLs carry only the diminished-antihypertensive-effect sentence) nor of any other individual systemic NSAID product label.
- Does not name any individual ACE inhibitor or any individual ARB.
- The beta-blocker limb covers only blood pressure/antihypertensive effect, not renal function.
- Says nothing about hyperkalaemia or about the 'triple whammy' with diuretics beyond volume depletion as a risk factor.

## acei_arb_diuretic__nsaid_triple_whammy — evidence[0]

- Runtime status: `{"pair_matcher_executable":false,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[63]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-lisinopril-nsaid-volume-depletion`
- Product: lisinopril
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — FDA-approved label for Lisinopril Tablets, USP, labeler Actavis Pharma, Inc.
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%2243e2c8d1-3704-4323-bcaf-f582572b81f7%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=43e2c8d1-3704-4323-bcaf-f582572b81f7
- Document: `43e2c8d1-3704-4323-bcaf-f582572b81f7` version `35`; effective time `20171111`
- Payload SHA-256: `20d0157188e1bcbb36e0e58f53fafa499e75a1476bf9d6d2837d27e732046467`
- Proposition: The lisinopril label states that NSAID coadministration may worsen renal function in elderly, volume-depleted, diuretic-treated, or renally impaired patients and directs periodic renal-function monitoring.
- Source effect: `["deterioration_of_renal_function","possible_acute_renal_failure","attenuation_of_antihypertensive_effect"]`
- Label action: `["monitor_renal_function_periodically"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `[]`
- Scope: `{"scope_type":"source_named_member_with_patient_risk_context","source_named_members":["lisinopril"],"source_classes":["ACE inhibitors","NSAIDs","selective COX-2 inhibitors"],"source_patient_context":["elderly","volume-depleted including diuretic therapy","compromised renal function"],"runtime_class":"nsaid","requires_clinician_class_mapping":true}`

Exact fragments:

- **7.3 Non-Steroidal Anti-Inflammatory Agents Including Selective Cyclooxygenase-2 Inhibitors (COX-2 Inhibitors)** at `drug_interactions[0]`; SHA-256 `0df02995a6c480cb865cc3cffa9c0f506d41bc886d562c5cc67c7ef283400ae3`: “In patients who are elderly, volume-depleted (including those on diuretic therapy), or with compromised renal function, coadministration of NSAIDs, including selective COX-2 inhibitors, with ACE inhibitors, including lisinopril, may result in deterioration of renal function, including possible acute renal failure. These effects are usually reversible. Monitor renal function periodically in patients receiving lisinopril and NSAID therapy.”
- **7.3 Non-Steroidal Anti-Inflammatory Agents Including Selective Cyclooxygenase-2 Inhibitors (COX-2 Inhibitors)** at `drug_interactions[0]`; SHA-256 `912c5ea7537e943716860acdd758c4d27104ee33f2da9bbc44d0dc957efc25ba`: “The antihypertensive effect of ACE inhibitors, including lisinopril, may be attenuated by NSAIDs.”

Does not by itself support:

- The ARB branch; this is an ACE-inhibitor product label.
- A three-drug interaction claim for ACE inhibitor or ARB plus diuretic plus NSAID; diuretic therapy appears only as a volume-depletion context.
- Incremental or synergistic risk from the three-drug regimen compared with the two-drug lisinopril plus NSAID interaction.
- An avoid, contraindication, or pharmacist hold instruction; the quoted label action is periodic renal-function monitoring.
- Any specific estimated-glomerular-filtration-rate threshold.

## acei__arb_dual_raas_blockade — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[64]`
- Local mapping: `major/withhold_and_clarify`
- Source ID: `fda-label-arb-dual-blockade`
- Product: telmisartan
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (US FDA label) — labeler Micro Labs Limited, telmisartan tablets
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22d7c9bd41-9558-46e1-ab03-82cdf85db3fe%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d7c9bd41-9558-46e1-ab03-82cdf85db3fe
- Document: `d7c9bd41-9558-46e1-ab03-82cdf85db3fe` version `14`; effective time `20230119`
- Payload SHA-256: `35b9a9a10e63d4b5fa1d729ae8a7521c4fecaba7bb73eac0b4fc74f8ebd66d56`
- Proposition: Dual blockade of the renin-angiotensin system (ACEi + ARB) increases hypotension, hyperkalaemia and renal-impairment risk without net outcome benefit for most patients.
- Source effect: `["hypotension","hyperkalemia","changes_in_renal_function_including_acute_renal_failure","increased_incidence_of_renal_dysfunction_with_telmisartan_plus_ramipril","no_additional_benefit_from_dual_RAS_blockade_in_most_patients"]`
- Label action: `["avoid_combined_use_of_RAS_inhibitors","monitor_blood_pressure","monitor_renal_function","monitor_electrolytes"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_members_plus_source_class","object_members":["acei"],"source_named_members":["telmisartan","ramipril","aliskiren"],"source_classes":["angiotensin-receptor blockers","ACE inhibitors","RAS inhibitors"],"runtime_class":"arb","requires_clinician_class_mapping":true}`

Exact fragments:

- **5.6 Dual Blockade of the Renin-Angiotensin-Aldosterone System (RAS)** at `warnings_and_cautions[0]`; SHA-256 `9a3552c81a8a1b8fabfd288ec9398a1e6cf357282edbd705ef8c9b355515039f`: “Dual blockade of the RAS with angiotensin-receptor blockers, ACE inhibitors, or aliskiren is associated with increased risks of hypotension, hyperkalemia, and changes in renal function (including acute renal failure) compared to monotherapy.”
- **5.6 Dual Blockade of the Renin-Angiotensin-Aldosterone System (RAS)** at `warnings_and_cautions[0]`; SHA-256 `4db808a7dd3116b8a577caf76077909e905bb802a7500e03b1bb4071db11e2d0`: “Patients receiving the combination of telmisartan and ramipril did not obtain any additional benefit compared to monotherapy, but experienced an increased incidence of renal dysfunction (e.g., acute renal failure) compared with groups receiving telmisartan alone or ramipril alone.”
- **5.6 Dual Blockade of the Renin-Angiotensin-Aldosterone System (RAS)** at `warnings_and_cautions[0]`; SHA-256 `af5b8f7c2284fd25fd245ea1e252104419fdb879a9aa87e02eb166942fda917a`: “In most patients no benefit has been associated with using two RAS inhibitors concomitantly. In general, avoid combined use of RAS inhibitors. Closely monitor blood pressure, renal function, and electrolytes in patients on telmisartan and other agents that affect the RAS.”

Does not by itself support:

- Member-level verification for any individual ACE inhibitor other than ramipril, or any ARB other than telmisartan — the class wording ('angiotensin-receptor blockers, ACE inhibitors') is a class statement inside a single product's label, not a per-member finding; other members carry their own near-identical class labeling and would each need their own citation.
- Any quantified magnitude, frequency, or severity grading of the hypotension/hyperkalaemia/renal risk.
- Any claim that the combination is contraindicated (the label says 'In general, avoid', not contraindicated) — the only absolute prohibition printed is aliskiren + telmisartan in patients with diabetes, which is outside the ACEi+ARB proposition.
- Outcome claims beyond 'no additional benefit' — the label does not state net harm on mortality or cardiovascular outcomes.

## cotrimoxazole__ace_inhibitor — evidence[0]

- Runtime status: `{"pair_matcher_executable":false,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[65]`
- Local mapping: `major/withhold_and_clarify`
- Source ID: `fda-label-bactrim-ace-inhibitor`
- Product: co-trimoxazole (sulfamethoxazole/trimethoprim)
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — FDA-approved label for BACTRIM / BACTRIM DS (sulfamethoxazole and trimethoprim) tablets, labeler Sun Pharmaceutical Industries, Inc.
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22f59d0c04-9c66-4d53-a0e1-cb55570deb62%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f59d0c04-9c66-4d53-a0e1-cb55570deb62
- Document: `f59d0c04-9c66-4d53-a0e1-cb55570deb62` version `18`; effective time `20241230`
- Payload SHA-256: `f9757c9b56b5e32938b0c9976f669d8539247d0230b471e348d1aa998f583d18`
- Currentness checked, accessed, and retrieved: `2026-07-28`
- Proposition: The BACTRIM label recommends avoiding concurrent angiotensin-converting-enzyme inhibitor use and reports hyperkalaemia cases with the combination.
- Source effect: `["hyperkalemia_reported_with_concomitant_ace_inhibitor"]`
- Label action: `["avoid_concurrent_use"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"fixed_combination_plus_explicit_source_class","source_named_members":["BACTRIM","sulfamethoxazole and trimethoprim"],"source_classes":["Angiotensin Converting Enzyme Inhibitors"],"runtime_class":"acei","requires_clinician_class_mapping":true}`

Exact fragments:

- **PRECAUTIONS > Drug Interactions (table row: Angiotensin Converting Enzyme Inhibitors) — recommendation column** at `precautions[0]`; SHA-256 `e54a06981317a04a0147512e4a71de5a32089938a3aa21926f7672856b8880ce`: “Avoid concurrent use”
- **PRECAUTIONS > Drug Interactions (table row: Angiotensin Converting Enzyme Inhibitors) — comments column** at `precautions[0]`; SHA-256 `705cd439774fa3bcf626f71b5e63625d493a47d0e494d7622fcd27f5b00a4d6a`: “In the literature, three cases of hyperkalemia in elderly patients have been reported after concomitant intake of BACTRIM and an angiotensin converting enzyme inhibitor.”

Does not by itself support:

- Single-ingredient trimethoprim; the source product is the sulfamethoxazole and trimethoprim fixed combination.
- Angiotensin receptor blockers or other potassium-raising medicines; the categorical avoid instruction is specific to ACE inhibitors.
- Mortality, sudden death, or a quantified event rate.
- An age-restricted rule; the comment reports three elderly cases, while the table recommendation itself is not written as an age branch.
- Any runtime severity category; severity remains a local draft mapping.

## cotrimoxazole__other_potassium_raising_agent — evidence[0]

- Runtime status: `{"pair_matcher_executable":false,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[65,66]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-bactrim-potassium-raising-drugs`
- Product: co-trimoxazole (sulfamethoxazole/trimethoprim)
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — FDA-approved label for BACTRIM / BACTRIM DS (sulfamethoxazole and trimethoprim) tablets, labeler Sun Pharmaceutical Industries, Inc.
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22f59d0c04-9c66-4d53-a0e1-cb55570deb62%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f59d0c04-9c66-4d53-a0e1-cb55570deb62
- Document: `f59d0c04-9c66-4d53-a0e1-cb55570deb62` version `18`; effective time `20241230`
- Payload SHA-256: `f9757c9b56b5e32938b0c9976f669d8539247d0230b471e348d1aa998f583d18`
- Currentness checked, accessed, and retrieved: `2026-07-28`
- Proposition: The BACTRIM label states that recommended-dose trimethoprim may cause hyperkalaemia when drugs known to induce hyperkalaemia are coadministered and directs close serum-potassium monitoring.
- Source effect: `["hyperkalemia"]`
- Label action: `["monitor_serum_potassium_closely"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"fixed_combination_plus_unnamed_source_class","source_named_members":["BACTRIM","sulfamethoxazole and trimethoprim"],"source_classes":["drugs known to induce hyperkalemia"],"runtime_class":"potassium_raising_agent","requires_clinician_class_mapping":true}`

Exact fragments:

- **PRECAUTIONS > Electrolyte Abnormalities > Hyperkalemia** at `precautions[0]`; SHA-256 `05f43d2cdd7d86120c2251ae10e0f3b30eb31c9129c67eb10b8035e3d1c0e00b`: “Even treatment with recommended doses may cause hyperkalemia when trimethoprim is administered to patients with underlying disorders of potassium metabolism, with renal insufficiency, or if drugs known to induce hyperkalemia are given concomitantly.”
- **PRECAUTIONS > Electrolyte Abnormalities > Hyperkalemia** at `precautions[0]`; SHA-256 `f1411ab05e2d2101b93a24c212c8cd9c7f289b41b8bcf8b0252209c9fd035d6a`: “Close monitoring of serum potassium is warranted in these patients.”

Does not by itself support:

- Single-ingredient trimethoprim; the source product is the sulfamethoxazole and trimethoprim fixed combination.
- Named coverage for spironolactone, eplerenone, amiloride, triamterene, potassium supplements, salt substitutes, or angiotensin receptor blockers.
- A blanket avoid or contraindication instruction for the unnamed potassium-raising class; the quoted action is close serum-potassium monitoring.
- Severe hyperkalaemia, sudden death, mortality, or an older-adult-specific rule.
- Any specific renal-function or serum-potassium threshold.

## lithium__nsaid_systemic — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[67]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-lithium`
- Product: lithium carbonate
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — LITHOBID (lithium carbonate tablet, film coated, extended release), ANI Pharmaceuticals, Inc.; FDA label rev 10/2022
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22f7f5b69a-c2a1-4586-a189-1475d41387c0%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f7f5b69a-c2a1-4586-a189-1475d41387c0
- Document: `f7f5b69a-c2a1-4586-a189-1475d41387c0` version `12`; effective time `20221028`
- Payload SHA-256: `12623059e38606cc99b08c4948f000d2052865d6711c9d5d334b1f827c49fe75`
- Proposition: The LITHOBID label reports increased lithium concentrations and lithium toxicity with NSAIDs and directs close lithium-level monitoring when NSAID use starts or stops.
- Source effect: `["increased_steady_state_plasma_lithium_concentration","lithium_toxicity"]`
- Label action: `["monitor_serum_lithium_closely_on_initiation_or_discontinuation_of_nsaid"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"explicit_class_statement","object_members":["lithium"],"source_class_term":"nonsteroidal anti-inflammatory drugs (NSAIDs)","source_examples":["lithium","indomethacin","piroxicam","celecoxib"],"runtime_class":"nsaid","requires_clinician_class_mapping":true}`

Exact fragments:

- **Drug Interactions — Nonsteroidal anti-inflammatory drugs (NSAIDs)** at `precautions[0]`; SHA-256 `fe23dbe3cf0f0b49dc5adfc7520bd0c2f90c4de818a1b473e4875706d2648418`: “Nonsteroidal anti-inflammatory drugs (NSAIDs): Lithium levels should be closely monitored when patients initiate or discontinue NSAID use. In some cases, lithium toxicity has resulted from interactions between a NSAID and lithium. Indomethacin and piroxicam have been reported to increase significantly steady-state plasma lithium concentrations. There is also evidence that other nonsteroidal anti-inflammatory agents, including the selective cyclooxygenase-2 (COX-2) inhibitors, have the same effect. In a study conducted in healthy subjects, mean steady-state lithium plasma levels increased approximately 17% in subjects receiving lithium 450 mg BID with celecoxib 200 mg BID as compared to subjects receiving lithium alone.”

Does not by itself support:

- The stated mechanism 'NSAIDs reduce renal lithium clearance' — the NSAID paragraph of this label states only that lithium concentrations rise and that toxicity has resulted; it makes no statement about renal clearance or renal elimination. (Reduced-clearance/sodium-loss mechanism language in this label belongs to the diuretic/ACE-inhibitor interactions and must not be transferred to NSAIDs.)
- Any contraindication, avoidance, or 'do not co-administer' recommendation — the only action stated is close monitoring of lithium levels.
- Any lithium dose-reduction instruction or quantified dose adjustment for NSAID co-administration.
- Topical/ophthalmic NSAID formulations — the paragraph addresses systemic NSAID use only.
- Aspirin specifically (not named; not stated to be included or excluded).
- Any severity grading or frequency/likelihood estimate beyond 'In some cases'.

## lithium__acei_arb — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[68]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-lithium`
- Product: lithium carbonate
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — FDA label, Lithium Carbonate tablet, extended release, 450 mg; labeler American Health Packaging
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22d276da3c-9952-4674-a54d-b1258df71b8a%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d276da3c-9952-4674-a54d-b1258df71b8a
- Document: `d276da3c-9952-4674-a54d-b1258df71b8a` version `8`; effective time `20251113`
- Payload SHA-256: `4452586c2a19310f3b2733dffc6e18b4aa0a332346f8adcd9f696b37bffab98c`
- Proposition: The lithium-carbonate label states that ACE inhibitors and angiotensin II receptor antagonists may substantially increase steady-state plasma lithium levels and directs dose reduction when needed with more frequent level measurement.
- Source effect: `["substantially_increased_steady_state_plasma_lithium_levels","lithium_toxicity"]`
- Label action: `["reduce_dose","monitor_plasma_lithium_levels_more_often"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_members_plus_source_class","object_members":["lithium"],"source_named_members":["enalapril","captopril","losartan","lithium carbonate"],"source_classes":["angiotensin-converting enzyme inhibitors","angiotensin II receptor antagonists"],"runtime_class":"acei_arb","requires_clinician_class_mapping":true}`

Exact fragments:

- **PRECAUTIONS — Drug Interactions** at `precautions[0]`; SHA-256 `df125fcd0575ad898ab7639acae6e75fb9afec4ad7f116ee0ab681caa7b3ab65`: “There is evidence that angiotensin-converting enzyme inhibitors, such as enalapril and captopril, and angiotensin II receptor antagonists, such as losartan, may substantially increase steady-state plasma lithium levels, sometimes resulting in lithium toxicity.”
- **PRECAUTIONS — Drug Interactions** at `precautions[0]`; SHA-256 `d322f2643c4ec9669bc50ad3dcb6a615c941d3896466a9fea0ba464aeea313aa`: “When such combinations are used, lithium dosage may need to be decreased, and plasma lithium levels should be measured more often.”

Does not by itself support:

- the mechanism clause 'reduce renal lithium clearance' for ACE inhibitors or ARBs — the label attaches reduced renal clearance of lithium only to diuretic-induced sodium loss, and says of ACEi/ARB only that they 'may substantially increase steady-state plasma lithium levels'
- any statement that the interaction is contraindicated or that the combination must be avoided — the label directs dose reduction and more frequent level monitoring, not avoidance
- quantification of magnitude, onset, or frequency of the lithium rise
- extension to renin-angiotensin agents outside the two named classes (e.g. aliskiren / direct renin inhibitors, ARNIs such as sacubitril/valsartan beyond its valsartan ARB component)
- class-wide pharmacokinetic equivalence among individual ACE inhibitors or individual ARBs beyond the named examples

## lithium__thiazide_diuretic — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[69]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-lithium`
- Product: lithium carbonate
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — FDA label for LITHIUM CARBONATE tablet, labeler Sun Pharmaceutical Industries, Inc.
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22d3284649-ed4c-4096-987b-4ac16b8278f2%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d3284649-ed4c-4096-987b-4ac16b8278f2
- Document: `d3284649-ed4c-4096-987b-4ac16b8278f2` version `9`; effective time `20231002`
- Payload SHA-256: `196fa28c87a0f710913b07d8ea027309e209db738e14d8325872d4b3c376128b`
- Proposition: The lithium-carbonate label states that diuretic-induced sodium loss may reduce lithium clearance and increase serum lithium concentrations and directs more frequent monitoring and concentration-guided dose reduction.
- Source effect: `["reduced_lithium_clearance","increased_serum_lithium_concentration"]`
- Label action: `["monitor_serum_lithium_concentration","monitor_serum_electrolytes","reduce_dose"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_members_plus_source_class","object_members":["lithium"],"source_named_members":["hydrochlorothiazide","chlorothiazide","furosemide"],"source_classes":["Diuretics"],"runtime_class":"thiazide_diuretic","requires_clinician_class_mapping":true}`

Exact fragments:

- **7 DRUG INTERACTIONS — 7.1, Diuretics row, Examples cell** at `drug_interactions[0]`; SHA-256 `e90f01ba0963b98c000d6a77209e77ea8f0f18d06ae5da277df4b464c8e447f0`: “hydrochlorothiazide, chlorothiazide, furosemide”
- **7 DRUG INTERACTIONS — 7.1, Diuretics row, Clinical Impact cell** at `drug_interactions[0]`; SHA-256 `1eb66cee8da807375b4e3dcae22fc2581758be2b76056659e90043ab31a9b52e`: “Diuretic-induced sodium loss may reduce lithium clearance and increase serum lithium concentrations.”
- **7 DRUG INTERACTIONS — 7.1, Diuretics row, Intervention cell** at `drug_interactions[0]`; SHA-256 `49bb4b15f246024bdb749471d5ffe83275ec20716f2cf926bafef0e296355a4f`: “More frequent monitoring of serum electrolyte and lithium concentrations. Reduce lithium dosage based on serum lithium concentration and clinical response [see Dosage and Administration (2.3), Warning and Precautions (5.3)].”

Does not by itself support:

- A thiazide-specific mechanism — the label's statement is made for the class 'Diuretics' and attributes the effect to diuretic-induced sodium loss generally; thiazides appear only as two of three named examples (the third, furosemide, is a loop diuretic).
- Thiazide or thiazide-like diuretics other than hydrochlorothiazide and chlorothiazide (e.g. chlortalidone, indapamide, metolazone, bendroflumethiazide) — none are named on this page.
- Any severity grading, contraindication, 'avoid' or 'not recommended' language for lithium + thiazide; the label states only monitoring and dose reduction.
- Any dose-threshold- or duration-conditioned rule; dose reduction is directed reactively, guided by serum lithium concentration and clinical response, not by a diuretic dose branch.
- Any quantitative magnitude of the rise in serum lithium concentration, or a stated onset/time course.
- Lithium products other than this lithium carbonate tablet labeling (no lithium citrate / extended-release product statement is quoted here).

## gentamicin__furosemide — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[70]`
- Local mapping: `major/withhold_and_clarify`
- Source ID: `fda-label-gentamicin`
- Product: gentamicin sulfate
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (NLM) — US FDA-approved label, Gentamicin Sulfate Injection, USP
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22913a36c3-50d6-429a-a8dd-a03126d2ca08%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=913a36c3-50d6-429a-a8dd-a03126d2ca08
- Document: `913a36c3-50d6-429a-a8dd-a03126d2ca08` version `5`; effective time `20251031`
- Payload SHA-256: `d84df059bf2254613739e920279b3a17c378805ff924a1807cf90198760e8947`
- Proposition: The gentamicin-injection label says concurrent ethacrynic-acid or furosemide use should be avoided because of ototoxicity and states that intravenous diuretics may enhance aminoglycoside toxicity.
- Source effect: `["ototoxicity_attributed_to_certain_diuretics","enhanced_aminoglycoside_toxicity_when_diuretics_are_intravenous"]`
- Label action: `["avoid_concurrent_use"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"exact_named_members_with_route_boundary","source_named_members":["gentamicin","ethacrynic acid","furosemide"],"source_route_context":["gentamicin injection","intravenous diuretics"]}`

Exact fragments:

- **WARNINGS** at `boxed_warning[0]`; SHA-256 `ef731d8aed59b37b5fd6a4eb39f997fc9a7891ff0b86eeb350e037208b925e47`: “The concurrent use of gentamicin with potent diuretics, such as ethacrynic acid or furosemide, should be avoided, since certain diuretics by themselves may cause ototoxicity.”
- **WARNINGS** at `boxed_warning[0]`; SHA-256 `a17510aa2bf4104ba01c8ddd1137881e15d61c734338487aca5bb82bc25ecc46`: “In addition, when administered intravenously, diuretics may enhance aminoglycoside toxicity by altering the antibiotic concentration in serum and tissue.”

Does not by itself support:

- increased nephrotoxicity from the combination — the diuretic paragraph names only ototoxicity and generic 'aminoglycoside toxicity'; the label's nephrotoxicity statements are separate and not tied to diuretic co-administration
- aminoglycosides other than gentamicin (amikacin, tobramycin, streptomycin, neomycin, plazomicin are not named)
- loop diuretics other than ethacrynic acid and furosemide (bumetanide, torsemide are not named)
- contraindication-level severity — the label says the combination 'should be avoided', not contraindicated

## methotrexate_high_dose__nsaid_systemic — evidence[0]

- Runtime status: `{"pair_matcher_executable":false,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[72]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-methotrexate-nsaid-high-dose`
- Product: methotrexate
- Publisher: openFDA drug-label record (company-submitted SPL); Azurity Pharmaceuticals, Inc. (XATMEP- methotrexate solution; US FDA label via DailyMed)
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22aec9984e-34c5-481b-b6bf-9bb5caf1daf8%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=aec9984e-34c5-481b-b6bf-9bb5caf1daf8
- Document: `aec9984e-34c5-481b-b6bf-9bb5caf1daf8` version `12`; effective time `20260528`
- Payload SHA-256: `4ddb6a0f604dbb2225894a473c46272432c989dd3474ecbf52fe38af57354c7e`
- Proposition: The XATMEP label reports elevated and prolonged methotrexate levels with some NSAIDs during high-dose therapy, resulting in deaths from severe hematologic and gastrointestinal toxicity; this fragment supplies no label action.
- Source effect: `["elevated_and_prolonged_serum_methotrexate_levels","severe_hematologic_toxicity","severe_gastrointestinal_toxicity","death"]`
- Label action: `[]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `[]`
- Scope: `{"scope_type":"source_qualified_class_statement","object_members":["methotrexate"],"source_dose_scope":"high dose methotrexate therapy","source_class_term":"some NSAIDs","runtime_class":"nsaid","requires_clinician_class_mapping":true}`

Exact fragments:

- **DRUG INTERACTIONS** at `drug_interactions[0]`; SHA-256 `b06948264d5d58af546449b5933f60d2f8c1f0d15bed3c5eabdf2cdf2d1c0909`: “Concomitant administration of some NSAIDs with high dose methotrexate therapy has been reported to elevate and prolong serum methotrexate levels, resulting in deaths from severe hematologic and gastrointestinal toxicity.”

Does not by itself support:

- Any named individual NSAID or a blanket claim about every NSAID.
- An avoid, contraindication, dose-change, or monitoring action.
- A route, formulation, regimen threshold, or lower-dose action.

## methotrexate_lower_dose__nsaid_systemic — evidence[0]

- Runtime status: `{"pair_matcher_executable":false,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[72]`
- Local mapping: `moderate/confirm_and_monitor`
- Source ID: `fda-label-methotrexate-nsaid-lower-dose`
- Product: methotrexate
- Publisher: openFDA drug-label record (company-submitted SPL); Azurity Pharmaceuticals, Inc. (XATMEP- methotrexate solution; US FDA label via DailyMed)
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22aec9984e-34c5-481b-b6bf-9bb5caf1daf8%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=aec9984e-34c5-481b-b6bf-9bb5caf1daf8
- Document: `aec9984e-34c5-481b-b6bf-9bb5caf1daf8` version `12`; effective time `20260528`
- Payload SHA-256: `4ddb6a0f604dbb2225894a473c46272432c989dd3474ecbf52fe38af57354c7e`
- Proposition: The XATMEP label directs caution with NSAIDs or salicylates at lower methotrexate doses and reports reduced tubular secretion in an animal model that may enhance toxicity.
- Source effect: `["reduced_renal_tubular_secretion_of_methotrexate_in_an_animal_model","may_enhance_methotrexate_toxicity"]`
- Label action: `["use_with_caution"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_qualified_class_statement","object_members":["methotrexate"],"source_dose_scope":"lower doses of methotrexate including XATMEP","source_class_term":"NSAIDs and salicylates","runtime_class":"nsaid","requires_clinician_class_mapping":true}`

Exact fragments:

- **DRUG INTERACTIONS** at `drug_interactions[0]`; SHA-256 `4a9a8dd578d52b1d3f0bc968a749386592cc850944995c716051d361754aeb4d`: “Caution should be used when NSAIDs and salicylates are administered concomitantly with lower doses of methotrexate, including XATMEP. These drugs have been reported to reduce the tubular secretion of methotrexate in an animal model and may enhance its toxicity.”

Does not by itself support:

- The high-dose deaths or severe hematologic and gastrointestinal toxicity statement.
- A human measurement of reduced tubular secretion or a certainty claim about enhanced toxicity.
- Any named individual NSAID, dose change, avoidance action, or monitoring schedule.

## methotrexate__cotrimoxazole — evidence[0]

- Runtime status: `{"pair_matcher_executable":false,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[73]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-methotrexate-tmpsmx`
- Product: methotrexate
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — METHOTREXATE- methotrexate sodium injection, solution, Fresenius Kabi USA, LLC; FDA label, set id b585f621-f6c9-4735-ab61-bd1b401f3df0
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22b585f621-f6c9-4735-ab61-bd1b401f3df0%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b585f621-f6c9-4735-ab61-bd1b401f3df0
- Document: `b585f621-f6c9-4735-ab61-bd1b401f3df0` version `6`; effective time `20210324`
- Payload SHA-256: `a10b5478ce229038c5e4aa155467b2fcc9f251ef8d857ad3a58ef88fcbb55d2c`
- Proposition: The methotrexate-injection label reports that trimethoprim and sulfamethoxazole fixed-combination use has rarely increased bone-marrow suppression, probably through decreased tubular secretion and/or an additive antifolate effect.
- Source effect: `["increased_bone_marrow_suppression","increased_methotrexate_toxicity_in_folate_deficiency","decreased_renal_tubular_secretion_of_methotrexate","additive_antifolate_effect"]`
- Label action: `[]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `[]`
- Scope: `{"scope_type":"exact_members","object_members":["methotrexate"],"covers_members":["methotrexate","sulfamethoxazole/trimethoprim (co-trimoxazole)"]}`

Exact fragments:

- **Drug Interactions** at `precautions[0]`; SHA-256 `238ed90b70a53d8c9f0d8e6dcf501bcd1567f292c87c788f6a64920603b72e18`: “Trimethoprim/sulfamethoxazole has been reported rarely to increase bone marrow suppression in patients receiving methotrexate, probably by decreased tubular secretion and/or an additive antifolate effect.”
- **Drug Interactions** at `precautions[0]`; SHA-256 `d09801197bae8814ab03cb0d8992064b69dca16664f1d1c1f92a8deea044ed04`: “Folate deficiency states may increase methotrexate toxicity.”

Does not by itself support:

- trimethoprim as a single agent (the label names only the fixed combination "Trimethoprim/sulfamethoxazole"; single-agent trimethoprim is not named)
- any explicit label action — no avoid, contraindication, dose reduction, or monitoring instruction (e.g. CBC frequency) is stated in these sentences
- any severity grading; the label qualifies frequency as "rarely" and the mechanism as "probably"
- generalisation to a sulfonamide or antifolate antibiotic class beyond the named combination
- route-specific claims for oral methotrexate tablets; the source product is a methotrexate sodium injection label
- a causal certainty claim — the wording is "has been reported", i.e. reported association, not established causation

## methotrexate_high_dose__ppi — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[74]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `fda-label-methotrexate-ppi`
- Product: RASUVO (methotrexate) injection, solution
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — RASUVO (methotrexate) injection, solution; labeler Medexus Pharma Inc.
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22d0075461-0e7e-4967-9c9b-d6440e912c0e%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d0075461-0e7e-4967-9c9b-d6440e912c0e
- Document: `d0075461-0e7e-4967-9c9b-d6440e912c0e` version `10`; effective time `20251215`
- Payload SHA-256: `2de8a93d0f570a118ce6cb599194747a2131fed2bcc4a3fbab5df596db6941d6`
- Proposition: The methotrexate label directs caution with proton-pump inhibitors during high-dose methotrexate and reports possible elevation, prolongation, and delayed elimination.
- Source effect: `["elevated_and_prolonged_serum_methotrexate","elevated_and_prolonged_hydroxymethotrexate","delayed_methotrexate_elimination","methotrexate_toxicity"]`
- Label action: `["use_with_caution"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_members_plus_source_class","object_members":["methotrexate"],"source_named_members":["methotrexate","omeprazole","esomeprazole","pantoprazole","ranitidine"],"source_classes":["proton pump inhibitor (PPI)","PPIs"],"runtime_class":"proton_pump_inhibitor","requires_clinician_class_mapping":true}`

Exact fragments:

- **7.2 Proton Pump Inhibitors (PPIs) and H2 Blockers [DRUG INTERACTIONS]** at `drug_interactions[0]`; SHA-256 `116789b660bac22123047cc0ff81561b936dc8fac9bd62d8707d4fb426ca6e68`: “Use caution if high-dose methotrexate is administered to patients receiving proton pump inhibitor (PPI) therapy.”
- **7.2 Proton Pump Inhibitors (PPIs) and H2 Blockers [DRUG INTERACTIONS]** at `drug_interactions[0]`; SHA-256 `7ebe90862cc3d88a2d3cd7ab79b68d0f9aeeb053bd29821a82317f7877d217c4`: “Case reports and published population pharmacokinetic studies suggest that concomitant use of some PPIs, such as omeprazole, esomeprazole, and pantoprazole, with methotrexate (primarily at high dose), may elevate and prolong serum levels of methotrexate and/or its metabolite hydroxymethotrexate, possibly leading to methotrexate toxicities.”
- **7.2 Proton Pump Inhibitors (PPIs) and H2 Blockers [DRUG INTERACTIONS]** at `drug_interactions[0]`; SHA-256 `698f3fb30ce3f2ffa8b8b23de0d643d55e60735f363af50a77d41cabd1431883`: “In two of these cases, delayed methotrexate elimination was observed when high-dose methotrexate was co-administered with PPIs, but was not observed when methotrexate was co-administered with ranitidine.”
- **7.2 Proton Pump Inhibitors (PPIs) and H2 Blockers [DRUG INTERACTIONS]** at `drug_interactions[0]`; SHA-256 `1c5f0954178793dfce99d7f111c1b0d0306d539c444844cbb3e8d1898657710b`: “However, no formal drug interaction studies of methotrexate with ranitidine have been conducted.”

Does not by itself support:

- Low-dose (e.g. weekly rheumatologic/dermatologic) methotrexate — the operative qualifier throughout is 'high-dose' / 'primarily at high dose'.
- Individual PPI members not named on the label: lansoprazole, rabeprazole, dexlansoprazole (the label says 'some PPIs, such as ...', it does not extend the finding to every PPI).
- Any instruction to avoid, contraindicate, or discontinue the PPI — the only stated action is 'Use caution'.
- Any instruction to reduce the methotrexate dose, monitor methotrexate serum levels, or delay the PPI around high-dose methotrexate cycles — no such directive appears in this section.
- A causal/confirmed mechanism — the label states only that case reports and population PK studies 'suggest' the effect ('may elevate and prolong').
- Any claim that H2-blockers (e.g. ranitidine) are a safe substitute — the label explicitly notes no formal interaction studies with ranitidine have been conducted.
