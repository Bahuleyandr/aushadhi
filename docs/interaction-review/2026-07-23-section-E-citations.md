# Section E (bradycardia / AV block) — exact openFDA citation worksheet

Generated from `docs/interaction-review/batch-01-v2/sections/E.verified.jsonl`.

- Frozen Section E SHA-256: `1512733e6e36c6d6cbc54f68488a2e5639621b9332df45b92a98802be0e4a52c`
- Rules: 12
- Evidence records: 13
- Exact fragments: 27
- Exact openFDA set-ID queries: 10
- Runtime enabled: 0
- Clinical context complete: 0
- Promotion eligible: 0
- Policy: `openfda-labels` / `interaction-evidence` / `CC0-1.0`
- Review state: machine-reconciled, pending clinician review

The source URLs below are the licensed openFDA origins. DailyMed links are references only. Exact fragments remain bound to their selected SPL payload, source path, document version, effective time, and canonical payload hash.

## beta_blocker__non_dihydropyridine_ccb — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[54]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `dailymed-verapamil-4f2ef5e8-v1-beta-blocker`
- Product: Verapamil Hydrochloride Extended-Release Tablets USP
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — verapamil hydrochloride extended-release tablets; labeler Nivagen Pharmaceuticals, Inc.
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%224f2ef5e8-a11f-4123-af41-95f4ed7377d6%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4f2ef5e8-a11f-4123-af41-95f4ed7377d6
- Document: `4f2ef5e8-a11f-4123-af41-95f4ed7377d6` version `1`; effective time `20200114`
- Payload SHA-256: `164058ce48854d395675aa9a5f71aff8dd49cac1d482af02fe80269b7d6d6b4e`
- Proposition: The verapamil label reports additive heart-rate, AV-conduction, and contractility effects with beta-blockers and directs caution and close monitoring.
- Source effect: `["additive_negative_effects_on_heart_rate_av_conduction_and_contractility","excessive_bradycardia_and_av_block_reported"]`
- Label action: `["use_only_with_caution_and_close_monitoring"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_drug_plus_source_class","source_named_drug":"verapamil","source_class":"beta-adrenergic blockers","runtime_class":"beta_blocker","requires_clinician_class_mapping":true}`

Exact fragments:

- **Drug Interactions — Beta-blockers** at `precautions[0]`; SHA-256 `021490f3d4397dbf09cc150e9825e1c75a98580ebfd1ccc885377af6f3b378cb`: “Concomitant therapy with beta-adrenergic blockers and verapamil may result in additive negative effects on heart rate, atrioventricular conduction and/or cardiac contractility.”
- **Drug Interactions — Beta-blockers** at `precautions[0]`; SHA-256 `157b36c299166f85044b6fd325b4e0d950165206e32d207f8b9bad5640f40dc4`: “However, there have been reports of excessive bradycardia and AV block, including complete heart block, when the combination has been used for the treatment of hypertension.”
- **Drug Interactions — Beta-blockers** at `precautions[0]`; SHA-256 `e27c399aa025e1d99226df8bef0104ddfae924ecc36017379a4858f641a90be6`: “The combination should be used only with caution and close monitoring.”

Does not by itself support:

- Diltiazem; that member is supported by a separate current diltiazem label record.
- The local major severity, newly-added-agent target, and pharmacy workflow are local mappings.
- The source does not establish UK or India jurisdiction scope or distinguish all beta-blocker routes and formulations.

## beta_blocker__non_dihydropyridine_ccb — evidence[1]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[54]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `dailymed-diltiazem-1ca03c9e-v2-beta-blocker`
- Product: Diltiazem Hydrochloride Extended-Release Tablets
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — diltiazem hydrochloride extended-release tablets
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%221ca03c9e-edc8-4c7f-89ee-f2346ea8c067%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1ca03c9e-edc8-4c7f-89ee-f2346ea8c067
- Document: `1ca03c9e-edc8-4c7f-89ee-f2346ea8c067` version `2`; effective time `20251016`
- Payload SHA-256: `e26bf8257e610acc4f7cec63102149fb53cc833b43e893e09dd28aefb1ef4ac5`
- Proposition: The diltiazem label reports additive cardiac-conduction effects with beta-blockers and directs monitoring of heart rate and conduction.
- Source effect: `["additive_effects_on_cardiac_conduction"]`
- Label action: `["monitor_heart_rate_and_cardiac_conduction"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_drug_plus_source_class","source_named_drug":"diltiazem","source_class":"beta-blockers","runtime_class":"beta_blocker","requires_clinician_class_mapping":true}`

Exact fragments:

- **5.1 Bradycardia or AV Block** at `warnings_and_cautions[0]`; SHA-256 `7228d8e76b9fd9c7f4707c09ef16e8fd02c0e4428669a2efe934f31fa70b7aac`: “Concomitant use of diltiazem with beta-blockers or digitalis may result in additive effects on cardiac conduction.”
- **5.1 Bradycardia or AV Block** at `warnings_and_cautions[0]`; SHA-256 `a56110d38d4f84281b51810d6e89bbe7a035185106fbff34c5efa5d20c2a7818`: “Monitor for effects on heart rate and cardiac conduction.”

Does not by itself support:

- Verapamil; that member is supported by a separate current verapamil label record.
- The local major severity and confirm-and-monitor workflow are local mappings.
- The source does not establish UK or India jurisdiction scope or a universal monitoring interval.

## beta_blocker__clonidine — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[55]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `dailymed-clonidine-c83e4e4f-v11-beta-blocker`
- Product: Clonidine Hydrochloride Tablets USP
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — clonidine hydrochloride tablets USP
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22c83e4e4f-bd0e-449d-958a-dc0d570a01ba%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c83e4e4f-bd0e-449d-958a-dc0d570a01ba
- Document: `c83e4e4f-bd0e-449d-958a-dc0d570a01ba` version `11`; effective time `20260430`
- Payload SHA-256: `6bd940dde766fb715e9867cec21c453aeee1c071a661bae06f65cce40fdf7cbc`
- Proposition: The clonidine label reports greater withdrawal-reaction likelihood with concomitant beta-blocker treatment, directs beta-blocker withdrawal before gradual clonidine discontinuation, and directs heart-rate monitoring with beta-blockers.
- Source effect: `["greater_clonidine_withdrawal_reaction_likelihood_with_concomitant_beta_blocker","sinus_node_or_av_nodal_conduction_effect"]`
- Label action: `["withdraw_beta_blocker_before_gradual_clonidine_discontinuation","monitor_heart_rate_with_beta_blockers"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_named_drug_plus_source_class","source_named_drug":"clonidine","source_class":"beta-blockers","runtime_class":"beta_blocker","requires_clinician_class_mapping":true}`

Exact fragments:

- **Warnings — Withdrawal** at `warnings[0]`; SHA-256 `3cd7ca7d07a1c2f5e43da00d6cd3ac2ed8888a072f43e64c38cb51a918790f68`: “Sudden cessation of clonidine treatment has, in some cases, resulted in symptoms such as nervousness, agitation, headache, and tremor accompanied or followed by a rapid rise in blood pressure and elevated catecholamine concentrations in the plasma. The likelihood of such reactions to discontinuation of clonidine therapy appears to be greater after administration of higher doses or continuation of concomitant beta-blocker treatment and special caution is therefore advised in these situations.”
- **Warnings — Withdrawal** at `warnings[0]`; SHA-256 `bef480938f7fa583ed4bf3961c777057c3d9594c9e845c28a8cc2bc305cfa1d3`: “If therapy is to be discontinued in patients receiving a beta-blocker and clonidine concurrently, the beta-blocker should be withdrawn several days before the gradual discontinuation of clonidine hydrochloride tablets USP.”
- **Drug Interactions** at `precautions[0]`; SHA-256 `be5f3eddec9bf8e39f669bb24c303ff70975138fd6ad04a47f4418f74a132073`: “Monitor heart rate in patients receiving clonidine concomitantly with agents known to affect sinus node function or AV nodal conduction, e.g., digitalis, calcium channel blockers and beta-blockers.”

Does not by itself support:

- A universal heart-rate threshold, blood-pressure threshold, or dispensing interval.
- The local major severity, newly-added-agent target, and confirm-and-monitor workflow are local mappings.
- The source does not establish UK or India jurisdiction scope or beta-blocker member-specific differences.

## digoxin__verapamil — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[56]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `dailymed-digoxin-dfac7f13-v18-verapamil`
- Product: Digoxin Tablets
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — digoxin tablets; labeler Amneal Pharmaceuticals
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22dfac7f13-28be-423d-9389-9089da29da17%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=dfac7f13-28be-423d-9389-9089da29da17
- Document: `dfac7f13-28be-423d-9389-9089da29da17` version `18`; effective time `20240808`
- Payload SHA-256: `57162ee761a3af43183d249cab7091f822e46df92e6ea7ae860c275d0c729040`
- Proposition: The digoxin label reports a 50% to 75% serum-concentration increase with verapamil and directs baseline measurement, dose or frequency reduction, and continued monitoring.
- Source effect: `["increased_serum_digoxin_concentration_50_to_75_percent"]`
- Label action: `["measure_serum_digoxin_before_start","reduce_digoxin_dose_or_modify_frequency","continue_monitoring"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"exact_named_pair_and_oral_product","source_object":"digoxin tablets","source_perpetrator":"verapamil","source_effect_measure":"serum digoxin concentration increase","source_route":"oral digoxin"}`

Exact fragments:

- **7.1 P-glycoprotein** at `drug_interactions[0]`; SHA-256 `1d3472feb9e86e7db71d1ae25dff436723c1e55f2dd171b7e875777b71351719`: “Digoxin is a substrate of P-glycoprotein, at the level of intestinal absorption, renal tubular section and biliary-intestinal secretion.”
- **7.2 Pharmacokinetic Drug Interactions — verapamil row** at `drug_interactions[0]`; SHA-256 `f61d7ec68f6289531062d90c79b18666a628452ac9d78af0c65b876ec29cea7b`: “Verapamil 50% to 75%”
- **7.2 Pharmacokinetic Drug Interactions — greater-than-50% recommendation** at `drug_interactions[0]`; SHA-256 `924edf73172f35446343602a8b6fa12b53fd82f71d446bc50a01e361c8ab59aa`: “Measure serum digoxin concentrations before initiating concomitant drugs. Reduce digoxin concentrations by decreasing dose by approximately 30% to 50% or by modifying the dosing frequency and continue monitoring.”

Does not by itself support:

- An interaction-specific eGFR threshold or automatic withhold action.
- A universal timing interval for the follow-up level or a patient-specific dose decision.
- The local major severity and confirm-and-monitor workflow or UK and India jurisdiction scope.

## digoxin__amiodarone — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[56]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `dailymed-amiodarone-d911b4cf-v5-digoxin`
- Product: Amiodarone Hydrochloride Tablets
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — amiodarone hydrochloride tablets
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22d911b4cf-eec4-43f8-aa64-cc60cfc901b9%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d911b4cf-eec4-43f8-aa64-cc60cfc901b9
- Document: `d911b4cf-eec4-43f8-aa64-cc60cfc901b9` version `5`; effective time `20251209`
- Payload SHA-256: `245650ab25f1cbb86b00d6f59bd81b6b24b4ebd1c1d8f4e59c2511e3a1da650c`
- Proposition: The amiodarone label states that amiodarone inhibits P-glycoprotein, increases digoxin concentration, and directs halving or discontinuing digoxin with toxicity monitoring if continued.
- Source effect: `["increased_digoxin_concentration"]`
- Label action: `["reduce_digoxin_by_half_or_discontinue","monitor_for_toxicity_if_continued"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"exact_named_pair_and_oral_products","source_object":"digoxin","source_perpetrator":"amiodarone hydrochloride tablets"}`

Exact fragments:

- **7 Drug Interactions** at `drug_interactions[0]`; SHA-256 `dec49fcde2214446a09c414cf15ff8be4804c31a5ad49c1103a00dc2b70c523d`: “Amiodarone inhibits P-glycoprotein and CYP1A2, CYP2C9, CYP2D6, and CYP3A, increasing exposure to other drugs.”
- **7 Drug Interactions — Digoxin** at `drug_interactions[0]`; SHA-256 `81930db391b1aa71827c80a821f02dc3e39545d298fdebdf8fb1bfeb3683cf89`: “Increased digoxin concentration. Reduce digoxin by half or discontinue. If continued, monitor for evidence of toxicity.”

Does not by itself support:

- An automatic pharmacist-led discontinuation; the source presents alternative treatment decisions.
- An interaction-specific eGFR threshold or universal serum-level schedule.
- The local major severity and confirm-and-monitor workflow or UK and India jurisdiction scope.

## digoxin__dronedarone — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[56]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `dailymed-multaq-3bd4006a-v13-digoxin`
- Product: MULTAQ (dronedarone) Tablets
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — MULTAQ (dronedarone) tablets; labeler sanofi-aventis U.S. LLC
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%223bd4006a-8bad-4909-ac6d-b6d84390155c%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=3bd4006a-8bad-4909-ac6d-b6d84390155c
- Document: `3bd4006a-8bad-4909-ac6d-b6d84390155c` version `13`; effective time `20260127`
- Payload SHA-256: `5598b248a03ecbe68ed6dbab1a9514150e6b3234e28bbf284662383d4aab371a`
- Proposition: The MULTAQ label states that dronedarone inhibits P-glycoprotein and increases digoxin exposure, then directs consideration of discontinuation or a half-dose with close levels and toxicity observation.
- Source effect: `["increased_digoxin_exposure_via_pgp_inhibition"]`
- Label action: `["consider_discontinuing_digoxin","halve_digoxin_if_continued","monitor_levels_and_toxicity"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"exact_named_pair_and_oral_products","source_object":"digoxin","source_perpetrator":"MULTAQ (dronedarone)"}`

Exact fragments:

- **7.3 P-glycoprotein Substrates — Digoxin** at `drug_interactions[0]`; SHA-256 `cf1622572dcb145d72009fc312a8da6b4afd3ab2ddd6af33f814e5d56ba99d6e`: “Dronedarone increased digoxin exposure by inhibiting the P-gp transporter. Consider discontinuing digoxin. If digoxin treatment is continued, halve the dose of digoxin, monitor serum levels closely, and observe for toxicity”

Does not by itself support:

- An automatic pharmacist-led discontinuation; the source presents alternative prescriber decisions.
- An interaction-specific eGFR threshold or universal monitoring time point.
- The local major severity and confirm-and-monitor workflow or UK and India jurisdiction scope.

## digoxin__clarithromycin — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[57]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `dailymed-clarithromycin-99d2fd6b-v2-digoxin`
- Product: Clarithromycin Tablets
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — clarithromycin tablets
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%2299d2fd6b-39ca-42f9-ad06-30e7fbc22c47%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=99d2fd6b-39ca-42f9-ad06-30e7fbc22c47
- Document: `99d2fd6b-39ca-42f9-ad06-30e7fbc22c47` version `2`; effective time `20221223`
- Payload SHA-256: `4d5805ef5ff7fc747b0f403b41b0b73399ba811df06ab4eaf70dabbf448d7ee6`
- Proposition: The clarithromycin label reports elevated digoxin concentrations and toxicity including potentially fatal arrhythmias and advises considering serum digoxin monitoring.
- Source effect: `["elevated_digoxin_serum_concentrations","digoxin_toxicity_including_potentially_fatal_arrhythmias"]`
- Label action: `["consider_monitoring_serum_digoxin_concentrations"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"exact_named_pair_and_oral_products","source_object":"digoxin","source_perpetrator":"clarithromycin tablets"}`

Exact fragments:

- **Table 8 — Digoxin** at `drug_interactions[0]`; SHA-256 `d9440add326c588d82d616910053b10bb06854abe31af40ec3fad5a8b45d4c4d`: “Elevated digoxin serum concentrations in patients receiving clarithromycin and digoxin concomitantly have been reported in postmarketing surveillance. Some patients have shown clinical signs consistent with digoxin toxicity, including potentially fatal arrhythmias. Monitoring of serum digoxin concentrations should be considered, especially for patients with digoxin concentrations in the upper therapeutic range.”

Does not by itself support:

- One fixed digoxin dose reduction or serum-level time point for every patient.
- An interaction-specific eGFR threshold or automatic antimicrobial substitution.
- The local major severity and confirm-and-monitor workflow or UK and India jurisdiction scope.

## digoxin__diltiazem — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[56]`
- Local mapping: `moderate/confirm_and_monitor`
- Source ID: `dailymed-digoxin-dfac7f13-v18-diltiazem`
- Product: Digoxin Tablets
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — digoxin tablets; labeler Amneal Pharmaceuticals
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22dfac7f13-28be-423d-9389-9089da29da17%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=dfac7f13-28be-423d-9389-9089da29da17
- Document: `dfac7f13-28be-423d-9389-9089da29da17` version `18`; effective time `20240808`
- Payload SHA-256: `57162ee761a3af43183d249cab7091f822e46df92e6ea7ae860c275d0c729040`
- Proposition: The digoxin label reports a 20% serum-concentration increase with diltiazem and directs baseline measurement, a smaller dose or frequency reduction, and continued monitoring.
- Source effect: `["increased_serum_digoxin_concentration_20_percent"]`
- Label action: `["measure_serum_digoxin_before_start","reduce_digoxin_dose_or_modify_frequency","continue_monitoring"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"exact_named_pair_and_oral_product","source_object":"digoxin tablets","source_perpetrator":"diltiazem","source_effect_measure":"serum digoxin concentration increase","source_route":"oral digoxin"}`

Exact fragments:

- **7.2 Pharmacokinetic Drug Interactions — diltiazem row** at `drug_interactions[0]`; SHA-256 `15db95701a79e8ee4ebd3948db0f0e35b3497ce91f691efba787835bdd6c36e6`: “Diltiazem 20%”
- **7.2 Pharmacokinetic Drug Interactions — less-than-50% recommendation** at `drug_interactions[0]`; SHA-256 `271692b51645c356e6b14994b87591cfdce50f890004807c30a04198c8dfd649`: “Measure serum digoxin concentrations before initiating concomitant drugs. Reduce digoxin concentrations by decreasing the dose by approximately 15% to 30% or by modifying the dosing frequency and continue monitoring.”

Does not by itself support:

- An interaction-specific eGFR threshold or automatic withhold action.
- A universal follow-up time point or patient-specific dose decision.
- The local moderate severity and confirm-and-monitor workflow or UK and India jurisdiction scope.

## digoxin__renal_impairment_accumulation — evidence[0]

- Runtime status: `{"pair_matcher_executable":false,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[56]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `dailymed-digoxin-dfac7f13-v18-renal`
- Product: Digoxin Tablets
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — digoxin tablets; labeler Amneal Pharmaceuticals
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22dfac7f13-28be-423d-9389-9089da29da17%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=dfac7f13-28be-423d-9389-9089da29da17
- Document: `dfac7f13-28be-423d-9389-9089da29da17` version `18`; effective time `20240808`
- Payload SHA-256: `57162ee761a3af43183d249cab7091f822e46df92e6ea7ae860c275d0c729040`
- Proposition: The digoxin label states that renal impairment requires smaller maintenance doses and prolongs the time needed to reach a new steady-state concentration.
- Source effect: `["renal_impairment_reduces_digoxin_dose_requirement","renal_impairment_prolongs_time_to_steady_state"]`
- Label action: `["use_smaller_than_usual_maintenance_doses"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"single_drug_condition_and_oral_product","source_product":"digoxin tablets","source_condition":"renal impairment","source_dosing_metric":"creatinine clearance","runtime_execution_status":"diagnostic_only_unary_not_pair_matcher_executable"}`

Exact fragments:

- **8.6 Renal Impairment** at `use_in_specific_populations[0]`; SHA-256 `60413eadd8981b3a936ab153700d0e2a754e6972cd542fce1accac4e6fb2298e`: “Digoxin is primarily excreted by the kidneys; therefore, patients with impaired renal function require smaller than usual maintenance doses of digoxin”
- **8.6 Renal Impairment** at `use_in_specific_populations[0]`; SHA-256 `9591e33ce3dab2bae28e7b4f3d2303fd9aabcf33cbb426a20ff34e10f429c6e1`: “Because of the prolonged elimination half-life, a longer period of time is required to achieve an initial or new steady-state serum concentration in patients with renal impairment than in patients with normal renal function.”

Does not by itself support:

- A numeric eGFR threshold, an eGFR-to-creatinine-clearance substitution, or an automatic withhold action.
- One maintenance dose or serum-level schedule for every degree of renal impairment.
- The local major severity and diagnostic confirm-and-monitor presentation or UK and India jurisdiction scope.

## digoxin__potassium_wasting_diuretic — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[58]`
- Local mapping: `moderate/confirm_and_monitor`
- Source ID: `dailymed-digoxin-f3d29508-v6-diuretics`
- Product: Digoxin Tablets USP
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — Digoxin Tablets USP
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22f3d29508-e7cc-47ff-845d-b5375ee30407%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f3d29508-e7cc-47ff-845d-b5375ee30407
- Document: `f3d29508-e7cc-47ff-845d-b5375ee30407` version `6`; effective time `20231229`
- Payload SHA-256: `e598cc1e6360127d128458052a9ba3054e9a24ff657e34c2c3bf8f015828fe05`
- Proposition: The digoxin label states that potassium or magnesium depletion sensitizes the myocardium to digoxin, identifies diuretics as a possible cause, and directs maintenance of normal potassium and magnesium.
- Source effect: `["potassium_or_magnesium_depletion_sensitizes_myocardium_to_digoxin","diuretics_can_contribute_to_electrolyte_deficiency"]`
- Label action: `["maintain_normal_serum_potassium_and_magnesium"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_product_plus_broad_source_diuretic_class","source_product":"Digoxin Tablets USP","source_class":"diuretics that may contribute to electrolyte deficiency","runtime_class":"potassium_wasting_diuretic","runtime_members":["furosemide","torsemide","bumetanide","hydrochlorothiazide","chlorthalidone","indapamide","metolazone"],"requires_clinician_class_mapping":true}`

Exact fragments:

- **Use in Patients with Electrolyte Disorders** at `precautions[0]`; SHA-256 `910595d34719b97e8d94e66bab37405846e171715ce3efb43d60b92a0506b156`: “In patients with hypokalemia or hypomagnesemia, toxicity may occur despite serum digoxin concentrations below 2.0 ng/mL, because potassium or magnesium depletion sensitizes the myocardium to digoxin.”
- **Use in Patients with Electrolyte Disorders** at `precautions[0]`; SHA-256 `8e4dd9549f953dde8379f213e90254b9a2356f0b95b79297ee96e30c2ede3ddc`: “Therefore, it is desirable to maintain normal serum potassium and magnesium concentrations in patients being treated with digoxin.”
- **Use in Patients with Electrolyte Disorders** at `precautions[0]`; SHA-256 `556244dcda4505bf80072a15e03dd3bf654e16cd6502b097f412217adca0a695`: “Deficiencies of these electrolytes may result from malnutrition, diarrhea, or prolonged vomiting, as well as the use of the following drugs or procedures: diuretics, amphotericin B, corticosteroids, antacids, dialysis, and mechanical suction of gastrointestinal secretions.”

Does not by itself support:

- Individual proof that each retained diuretic member caused hypokalaemia or hypomagnesaemia in a particular patient.
- A fixed supplementation plan, renal threshold, or monitoring interval.
- The local moderate severity and confirm-and-monitor workflow or UK and India jurisdiction scope.

## ivabradine__ordinary_negative_chronotrope — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[59]`
- Local mapping: `moderate/confirm_and_monitor`
- Source ID: `dailymed-corlanor-92018a65-v33-negative-chronotropes`
- Product: CORLANOR (ivabradine) Tablets and Oral Solution
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — CORLANOR (ivabradine); labeler Amgen Inc.
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%2292018a65-38f6-45f7-91d4-a34921b81d0d%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=92018a65-38f6-45f7-91d4-a34921b81d0d
- Document: `92018a65-38f6-45f7-91d4-a34921b81d0d` version `33`; effective time `20251110`
- Payload SHA-256: `d2773090d9a0f82189a6c71cd459278b60b183571ae91ec7295a8595e532b54f`
- Proposition: The CORLANOR label reports increased bradycardia risk with drugs that slow heart rate and directs heart-rate monitoring; beta-blocker co-therapy is common.
- Source effect: `["increased_bradycardia_risk_with_other_negative_chronotropes"]`
- Label action: `["monitor_heart_rate"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"source_product_plus_source_class","source_product":"CORLANOR (ivabradine)","source_class":"drugs that slow heart rate and other negative chronotropes","source_named_examples":["digoxin","amiodarone","beta-blockers"],"runtime_class":"ordinary_negative_chronotrope","runtime_members":["digoxin","clonidine","metoprolol","atenolol","propranolol","bisoprolol","carvedilol","nebivolol","labetalol","nadolol","timolol","acebutolol","betaxolol","celiprolol","esmolol","pindolol"],"requires_clinician_class_mapping":true}`

Exact fragments:

- **7.2 Negative Chronotropes** at `drug_interactions[0]`; SHA-256 `a525f8b266dbe8cf905ba035c168d2faf5627ddbff1492b9eae5e2c3ef73f4c1`: “Most patients receiving Corlanor will also be treated with a beta-blocker.”
- **7.2 Negative Chronotropes** at `drug_interactions[0]`; SHA-256 `a8defff4182c9934d657e9ec17a1b5eb4bd50f7f2602cb97facd935874d264ba`: “The risk of bradycardia increases with concomitant administration of drugs that slow heart rate (e.g., digoxin, amiodarone, beta-blockers).”
- **7.2 Negative Chronotropes** at `drug_interactions[0]`; SHA-256 `4e788eb9021075edfe6c1e07804f53252f5bc9b59c00a7611acda914def2f9a5`: “Monitor heart rate in patients taking Corlanor with other negative chronotropes.”

Does not by itself support:

- Individual naming of clonidine or every beta-blocker in the local inline roster.
- Formulation-specific handling for ophthalmic timolol or a universal heart-rate threshold.
- The local moderate severity and confirm-and-monitor workflow or UK and India jurisdiction scope.

## ivabradine__qt_active_antiarrhythmic — evidence[0]

- Runtime status: `{"pair_matcher_executable":false,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[59]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `dailymed-corlanor-92018a65-v33-qt-risk`
- Product: CORLANOR (ivabradine) Tablets and Oral Solution
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — CORLANOR (ivabradine); labeler Amgen Inc.
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%2292018a65-38f6-45f7-91d4-a34921b81d0d%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=92018a65-38f6-45f7-91d4-a34921b81d0d
- Document: `92018a65-38f6-45f7-91d4-a34921b81d0d` version `33`; effective time `20251110`
- Payload SHA-256: `d2773090d9a0f82189a6c71cd459278b60b183571ae91ec7295a8595e532b54f`
- Proposition: The CORLANOR label states that ivabradine-related bradycardia can increase QT prolongation and torsades risk, especially with QTc-prolonging drugs.
- Source effect: `["bradycardia_increases_qt_prolongation_and_torsades_risk_with_qtc_prolonging_drugs"]`
- Label action: `[]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `[]`
- Scope: `{"scope_type":"source_product_plus_source_qtc_prolonging_class","source_product":"CORLANOR (ivabradine)","source_class":"QTc prolonging drugs","source_named_examples":["amiodarone"],"runtime_class":"qt_active_antiarrhythmic","runtime_members":["amiodarone","sotalol"],"requires_clinician_class_mapping":true}`

Exact fragments:

- **5.3 Bradycardia and Conduction Disturbances** at `warnings_and_cautions[0]`; SHA-256 `8facba49d2b83e0f2c36c0cbd4c617c851578463f08c02cc861bca907d591989`: “Risk factors for bradycardia include sinus node dysfunction, conduction defects (e.g., 1 st or 2 nd degree atrioventricular block, bundle branch block), ventricular dyssynchrony, and use of other negative chronotropes (e.g., digoxin, diltiazem, verapamil, amiodarone). Bradycardia may increase the risk of QT prolongation which may lead to severe ventricular arrhythmias, including torsade de pointes, especially in patients with risk factors such as use of QTc prolonging drugs”

Does not by itself support:

- The U.S. source supplies no avoid or withhold action for amiodarone or sotalol.
- Sotalol is not individually named in this source; its runtime inclusion remains a clinician class mapping.
- No reusable jurisdiction-backed action evidence is accepted for this diagnostic tier.

## adenosine__dipyridamole — evidence[0]

- Runtime status: `{"pair_matcher_executable":true,"clinical_context_complete":false,"runtime_enabled":false,"promotion_eligible":false}`
- Source rows: `[60]`
- Local mapping: `major/confirm_and_monitor`
- Source ID: `dailymed-adenosine-364a4c53-v3-dipyridamole`
- Product: Adenosine Injection USP
- Publisher: openFDA drug-label record (company-submitted SPL); DailyMed (U.S. National Library of Medicine) — adenosine injection USP
- Licensed API source: https://api.fda.gov/drug/label.json?search=set_id%3A%22364a4c53-0705-7969-e063-6294a90a1717%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=364a4c53-0705-7969-e063-6294a90a1717
- Document: `364a4c53-0705-7969-e063-6294a90a1717` version `3`; effective time `20251217`
- Payload SHA-256: `e81dc80363cdad16c64d250293dfccc044c7c73797453d2b6fe194ca84ce0798`
- Proposition: The adenosine label states that dipyridamole potentiates adenosine effects and that smaller adenosine doses may be effective.
- Source effect: `["potentiated_adenosine_effects"]`
- Label action: `["consider_smaller_adenosine_doses"]`
- Source jurisdictions: `["US"]`
- Rule action-bearing jurisdictions: `["US"]`
- Scope: `{"scope_type":"exact_named_pair_and_intravenous_object_product","source_object":"adenosine injection USP","source_perpetrator":"dipyridamole","source_route":"intravenous adenosine","runtime_execution_status":"diagnostic_only_route_and_setting_not_matcher_gateable"}`

Exact fragments:

- **Precautions — Drug Interactions** at `precautions[0]`; SHA-256 `cef503b7cc9f6496b14ba933c7e5e5c6d360724bcba89dc9c47258d37abc1af5`: “Adenosine effects are potentiated by dipyridamole. Thus, smaller doses of adenosine may be effective in the presence of dipyridamole.”

Does not by itself support:

- A duration extension claim or one numeric adenosine dose-reduction factor.
- A community-pharmacy withhold action or a direction to stop established dipyridamole.
- The local major severity and diagnostic confirm-and-monitor presentation or UK and India jurisdiction scope.
