# Section A — citation sign-off worksheet

**36 retained evidence records** across **33 rules**, containing **64 hashed fragments**.

This worksheet is deterministically generated from the slice. It records evidence provenance and exact source fragments; it does not add or revise clinical claims.

- Section: `A`
- JSONL SHA-256: `614b34c8c47b0476338aa8f8d5851ec7530bf756bb3bb4fdda7b2ed32d2aa739`
- openFDA-reconciled evidence: `34`
- source_policy_use: `{"interaction-counterevidence":1,"interaction-evidence":35}`
- citation_status: `{"machine_confirmed_govuk_ogl_bound_pending_clinician":2,"machine_confirmed_openfda_reconciled_clinician_approved_for_internal_product_scope":2,"machine_confirmed_openfda_reconciled_pending_clinician":32}`

For `openfda-labels`, the machine origin is the exact openFDA `set_id` query and the DailyMed URL is reference-only. Payload hashes use recursively sorted object keys with array order preserved (`sorted-json-keys-v1`); fragment containment uses the repository `openfda-spl-text-v1` normalization at each declared `source_path`.

## warfarin__nsaid_systemic

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-warfarin` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="warfarin sodium" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22c437507c-d308-4aac-aa5e-a54972c7fa95%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c437507c-d308-4aac-aa5e-a54972c7fa95
- document: `c437507c-d308-4aac-aa5e-a54972c7fa95@2`; retrieved_at=`2026-07-24`
- SPL: version=`2`; effective_time=`20140506`; source_date=`2014-05-06`
- payload: sha256=`fbddb21393465a8074d458d7593d52ef18d0d5288220c6396d6e65fd541747f4`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["precautions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: NSAIDs increase bleeding risk when combined with warfarin.
- source_effect: `["increased_bleeding_risk","increased_gi_adverse_reactions"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"explicit_class_statement","source_class_term":"nsaid","object_members":["warfarin"],"requires_clinician_class_mapping":true,"runtime_class":"nsaid@2026-07-22"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 330e970947155016b97c7d217cd55c96a0bd46703f61b6850f5a01f38296f953; path precautions[0]) "Caution should be observed when warfarin is administered concomitantly with nonsteroidal anti-inflammatory drugs (NSAIDs), including aspirin, to be certain that no change in anticoagulation dosage is required. In addition to specific drug interactions that might affect PT/INR, NSAIDs, including aspirin, can inhibit platelet aggregation, and can cause gastrointestinal bleeding, peptic ulceration and/or perforation."

## warfarin__aspirin_analgesic_antiplatelet

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-warfarin` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="warfarin sodium" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22bf21781b-d4d5-456d-a5bc-d48bd2da61ce%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=bf21781b-d4d5-456d-a5bc-d48bd2da61ce
- document: `bf21781b-d4d5-456d-a5bc-d48bd2da61ce@1`; retrieved_at=`2026-07-24`
- SPL: version=`1`; effective_time=`20151028`; source_date=`2015-10-28`
- payload: sha256=`4f9c3e2d6db48df4c3e4f3b27555a1a44069302d35645990658192b079734c51`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Aspirin adds antiplatelet and bleeding risk to warfarin anticoagulation.
- source_effect: `["increased_bleeding_risk"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","aspirin"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [7.2 Drugs that Increase Bleeding Risk] (sha256 c3bb05cf6d41e72ff08697c3b6c7677d084bf14add688f2a7dc7059c88323d15; path drug_interactions[0]) "Because bleeding risk is increased when these drugs are used concomitantly with warfarin, closely monitor patients receiving any such drug with warfarin."
  - [Table 3 - Antiplatelet Agents (row)] (sha256 dd19ed72d87b404f62aa77645f9e6199c4633508d9579e44e839e63c3de45270; path drug_interactions[0]) "aspirin, cilostazol, clopidogrel, dipyridamole, prasugrel, ticlopidine"

## warfarin__fluconazole

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `2`

### evidence[0] — `fda-label-fluconazole` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="fluconazole" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22f694c617-3383-416c-91b6-b94fda371204%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f694c617-3383-416c-91b6-b94fda371204
- document: `f694c617-3383-416c-91b6-b94fda371204@57`; retrieved_at=`2026-07-26`
- SPL: version=`57`; effective_time=`20260402`; source_date=`2026-04-02`
- payload: sha256=`ff8cbc0726257ccfd11021bb489b0cf0bb417351b66ab35dcb6fb44a4290690c`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]","drug_interactions[0]","drug_interactions[0]","drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-26`
- proposition: The current U.S. fluconazole label reports increased prothrombin time and bleeding events with warfarin, recommends careful prothrombin-time monitoring, states that warfarin dose adjustment may be necessary, and says fluconazole enzyme inhibition persists 4 to 5 days after discontinuation.
- source_effect: `["increased_prothrombin_time","increased_bleeding_risk","metabolic_enzyme_inhibition","persistence_after_discontinuation"]`
- label_action: `["monitor_pt","warfarin_dose_adjustment_may_be_needed"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","fluconazole"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - An Indian regulatory-label claim.
  - An exact Child-Pugh B interaction modifier.
  - Autonomous pharmacy dose adjustment.
  - A universal PT/INR schedule or a single-dose fluconazole exception.
- fragments:
  - [Drug Interactions] (sha256 6cc431edbbdc9af98661ed37eb4722c72ffb9b639b858b1f87f0d54c82b4b1c2; path drug_interactions[0]) "Prothrombin time may be increased in patients receiving concomitant DIFLUCAN and coumarin-type anticoagulants."
  - [Drug Interactions] (sha256 dd9153523b8b9a61676a9accdb512f3e64a9e336cff5f03e816775f50cc77e96; path drug_interactions[0]) "In post-marketing experience, as with other azole antifungals, bleeding events (bruising, epistaxis, gastrointestinal bleeding, hematuria, and melena) have been reported in association with increases in prothrombin time in patients receiving fluconazole concurrently with warfarin."
  - [Drug Interactions] (sha256 23fb9333179368b4cc9e2d7b6635f92456f215dddd0a1f34dbef75afbde4ab7d; path drug_interactions[0]) "Careful monitoring of prothrombin time in patients receiving DIFLUCAN and coumarin-type anticoagulants is recommended."
  - [Drug Interactions] (sha256 ca0d712a3ca6977fea968162b70b6abe77bef9340604a5362b54b4dc4835c858; path drug_interactions[0]) "Dose adjustment of warfarin may be necessary."
  - [Drug Interactions] (sha256 707c94a9014f8ee2f86e602a8c8709048de9571b8c372c0bdb3e403e5ae1aa54; path drug_interactions[0]) "Fluconazole is a moderate CYP2C9 and CYP3A4 inhibitor."
  - [Drug Interactions] (sha256 7cbff3b30b4d67a23fca16402337ccc0b95d72bb161e76da00bb9cd582bd992b; path drug_interactions[0]) "The enzyme inhibiting effect of fluconazole persists 4 to 5 days after discontinuation of fluconazole treatment due to the long half-life of fluconazole."

### evidence[1] — `fda-label-warfarin-current` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="warfarin sodium tablets" | section="Drug Interactions; Boxed Warning; Patient Counseling Information"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2251e98fb6-ba76-497e-95d8-fe895ef0b7ed%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=51e98fb6-ba76-497e-95d8-fe895ef0b7ed
- document: `51e98fb6-ba76-497e-95d8-fe895ef0b7ed@7`; retrieved_at=`2026-07-26`
- SPL: version=`7`; effective_time=`20260629`; source_date=`2026-06-29`
- payload: sha256=`bcb1e6db5ac6619c0c93ede9f0c689dfd8ffdff4f187067335c243046b5d3e04`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-26`
- proposition: The current U.S. warfarin label lists fluconazole as a CYP2C9 and CYP3A4 inhibitor, requires closer INR monitoring when interacting medicines and antifungals are started or stopped, warns of major or fatal bleeding, and identifies reportable bleeding symptoms.
- source_effect: `["increased_inr","increased_bleeding_risk"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","fluconazole"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local severity, workflow action, or runtime promotion without clinician approval.
  - An Indian regulatory-label claim.
  - An exact Child-Pugh B interaction modifier.
  - Autonomous pharmacy dose adjustment.
- fragments:
  - [Drug Interactions] (sha256 14a1ce05e42103a7f45533ca89dc0759c12616d5a28e3ef3db3a61b9356a758f; path drug_interactions[0]) "CYP2C9 amiodarone, capecitabine, cotrimoxazole, etravirine, fluconazole, fluvastatin, fluvoxamine, metronidazole, miconazole, oxandrolone, sulfinpyrazone, tigecycline, voriconazole, zafirlukast"
  - [Drug Interactions] (sha256 ebd497231a12303e4d4ec4633a822878a063947bc7fdba8474431482441a0d7b; path drug_interactions[0]) "More frequent INR monitoring should be performed when starting or stopping other drugs, including botanicals, or when changing dosages of other drugs, including drugs intended for short-term use (e.g., antibiotics, antifungals, corticosteroids) [see Boxed Warning ] ."

## warfarin__miconazole_oromucosal_gel

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["UK"]`
- machine_evidence: `1`

### evidence[0] — `mhra-dsu-miconazole-warfarin` — `machine_confirmed_govuk_ogl_bound_pending_clinician`

- source: Medicines and Healthcare products Regulatory Agency on GOV.UK | regulator="MHRA" | product="miconazole oral gel (prescription-only and pharmacy supply)" | section="Advice for healthcare professionals / Review of interaction"
- policy contract: source_policy_id=`mhra-govuk-drug-safety-updates`; use=`interaction-evidence`; licence=`OGL-3.0`; jurisdiction=`UK`; review_status=`review_candidate`
- origin: https://www.gov.uk/drug-safety-update/miconazole-daktarin-over-the-counter-oral-gel-contraindicated-in-patients-taking-warfarin
- Content API payload: https://www.gov.uk/api/content/drug-safety-update/miconazole-daktarin-over-the-counter-oral-gel-contraindicated-in-patients-taking-warfarin
- document: `miconazole-daktarin-over-the-counter-oral-gel-contraindicated-in-patients-taking-warfarin@2017-09-26T16:57:40+01:00`; retrieved_at=`2026-07-24`
- payload: canonical sha256=`08a0da360c9e4c823552e29e9f3f3b934bf09155768a55706dcb4fd497c80e52`; source_paths=`["details.body","details.body","details.body"]`
- page licence: `OGL-3.0`; attribution="Contains public sector information licensed under the Open Government Licence v3.0."
- currentness: `checked_current_govuk_ogl` @`2026-07-24`
- proposition: MHRA states that patients taking warfarin should not use pharmacy-supplied over-the-counter miconazole oral gel; prescribed concomitant use requires close monitoring and anticoagulant titration.
- source_effect: `["increased_bleeding_risk","metabolic_enzyme_inhibition"]`
- label_action: `["otc_miconazole_oral_gel_do_not_use_with_warfarin","prescribed_use_monitor_and_titrate_anticoagulant_effect"]`
- scope: `{"scope_type":"source_product_supply_branches","source_product":"miconazole oral gel","supply_branches":["pharmacy_over_the_counter","prescription_only"],"object_members":["warfarin"]}`
- jurisdictions: `["UK"]`
- does NOT by itself support:
  - The source does not establish topical skin or nail miconazole as equivalent to oral gel.
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - This source does not establish the rule in IN, US.
  - Runtime use while the declared selector or evidence scope is not executable.
- fragments:
  - [Advice for healthcare professionals / Review of interaction] (sha256 b1a8ab440f0d76a5c91aa0b6d0ed30b2bd5ecf8584bd73b7b467d104c2a5f756; path details.body) "patients taking warfarin should not use over-the-counter miconazole oral gel available from pharmacies"
  - [Advice for healthcare professionals / Review of interaction] (sha256 1619a003626551e6ea2e59e414ecab7b28f6cb1af49475cb3d969633c8be0d34; path details.body) "if the concomitant use of miconazole oral gel with an oral anticoagulant such as warfarin is planned, exercise caution and ensure that you monitor and titrate the anticoagulant effect carefully"
  - [Advice for healthcare professionals / Review of interaction] (sha256 881a066463c2c8cfed2b21bc939ed1651230435cf5c8a22a296923b2455a20ab; path details.body) "The antifungal drug miconazole inhibits several P450 isozymes, including CYP2C9, which can heighten the anticoagulant effect of warfarin and lead to an increase in international normalised ratio (INR) values (and subsequent bleeding complications)."

## warfarin__ketoconazole_systemic

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-ketoconazole` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="ketoconazole (oral)" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22bc189ce2-3f10-260d-e053-2a95a90ae808%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=bc189ce2-3f10-260d-e053-2a95a90ae808
- document: `bc189ce2-3f10-260d-e053-2a95a90ae808@2`; retrieved_at=`2026-07-24`
- SPL: version=`2`; effective_time=`20250117`; source_date=`2025-01-17`
- payload: sha256=`a0872968d6e697c71b32e13b40b74dceb7730b7158aae2100888551e44f7f985`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["precautions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Systemic ketoconazole may enhance the anticoagulant effect of warfarin (US ketoconazole label). Mechanism (CYP inhibition) not asserted from this excerpt.
- source_effect: `["documented_pharmacologic_interaction"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","ketoconazole"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 64dfb2a92e85dfdf2e7414db0e0f5d5376120ed5caef04d5b53a844e28269d84; path precautions[0]) "Coumarins: Ketoconazole may enhance the anticoagulant effect of coumarin-like drugs, thus the anticoagulant effect should be carefully titrated and monitored."

## warfarin__voriconazole

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-voriconazole` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="voriconazole" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2267c174da-41b8-4738-8a22-dd814b8e96b8%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=67c174da-41b8-4738-8a22-dd814b8e96b8
- document: `67c174da-41b8-4738-8a22-dd814b8e96b8@27`; retrieved_at=`2026-07-24`
- SPL: version=`27`; effective_time=`20260215`; source_date=`2026-02-15`
- payload: sha256=`482ea96d744a36285c329e6ed88a69bbe8fcc9460b2f23921f3476f4969f02ae`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Voriconazole increases warfarin effect via CYP2C9 inhibition.
- source_effect: `["increased_drug_exposure","altered_anticoagulant_effect","metabolic_enzyme_inhibition"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","voriconazole"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 04bbd65b0552714cdb2385963e691b69412a96076507d3f9e3aab19591a76792; path drug_interactions[0]) "Warfarin (CYP2C9 Inhibition) Other Oral Coumarin Anticoagulants (CYP2C9/3A4 Inhibition) Prothrombin Time Significantly Increased Not Studied In Vivo or In Vitro for other Oral Coumarin Anticoagulants, but Drug Plasma Exposure Likely to be Increased"
  - [Drug Interactions] (sha256 4820a3e1f08ec57b2912285bab8fe4a0080f89acd37eef2bbf40fda3984e4b4d; path drug_interactions[0]) "If patients receiving coumarin preparations are treated simultaneously with voriconazole, the prothrombin time or other suitable anticoagulation tests should be monitored at close intervals and the dosage of anticoagulants adjusted accordingly."

## warfarin__macrolide_cyp_inhibitor

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-clarithromycin` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="clarithromycin" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22b98b02bb-2609-49a0-b29f-e5911aa0cbc1%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b98b02bb-2609-49a0-b29f-e5911aa0cbc1
- document: `b98b02bb-2609-49a0-b29f-e5911aa0cbc1@23`; retrieved_at=`2026-07-24`
- SPL: version=`23`; effective_time=`20230530`; source_date=`2023-05-30`
- payload: sha256=`5268af02e66c314a67f9f9037d996024e4dbddedbdf1e378b964f834eef5dfea`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Clarithromycin may potentiate the effects of oral anticoagulants (US clarithromycin label). Supports CLARITHROMYCIN only.
- source_effect: `["documented_pharmacologic_interaction"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"extrapolated_class","directly_supported_members":["clarithromycin"],"runtime_members":["clarithromycin","erythromycin"],"requires_clinician_class_mapping":true,"runtime_class":"macrolide_cyp3a_inhibitor","source_members":["clarithromycin"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 81311cfe10ec4333bcc636eedccba36e6a060d84a9b726864bfe463da1338ed2; path drug_interactions[0]) "Spontaneous reports in the postmarketing period suggest that concomitant administration of clarithromycin and oral anticoagulants may potentiate the effects of the oral anticoagulants."

## warfarin__metronidazole_tinidazole

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-metronidazole` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="metronidazole" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22a2883ca1-5a9a-4259-9d80-46ab67274384%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a2883ca1-5a9a-4259-9d80-46ab67274384
- document: `a2883ca1-5a9a-4259-9d80-46ab67274384@25`; retrieved_at=`2026-07-24`
- SPL: version=`25`; effective_time=`20260522`; source_date=`2026-05-22`
- payload: sha256=`4baf60bc4b057156c7bd085554287e2c69e557fce0d266d35980ec69b9926417`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Metronidazole may potentiate warfarin and prolong prothrombin time (US metronidazole label). Supports METRONIDAZOLE only; tinidazole not confirmed from this source.
- source_effect: `["altered_anticoagulant_effect"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"extrapolated_class","directly_supported_members":["metronidazole"],"runtime_members":["metronidazole","tinidazole"],"requires_clinician_class_mapping":true,"runtime_class":"nitroimidazole","source_members":["metronidazole"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 f9149da76ffb56c60582de935878be386ed69358a931a46de449d5ad79eef6ca; path drug_interactions[0]) "Metronidazole has been reported to potentiate the anticoagulant effect of warfarin and other oral coumarin anticoagulants, resulting in a prolongation of prothrombin time."

## warfarin__cotrimoxazole

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-cotrimoxazole` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="sulfamethoxazole/trimethoprim" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%227f82e5e0-b627-a3f3-e053-2991aa0abaa5%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7f82e5e0-b627-a3f3-e053-2991aa0abaa5
- document: `7f82e5e0-b627-a3f3-e053-2991aa0abaa5@6`; retrieved_at=`2026-07-24`
- SPL: version=`6`; effective_time=`20260209`; source_date=`2026-02-09`
- payload: sha256=`63dfc42563d6fb406df816f4d801878e9a33bae39cdae3abb01ffe0e0dbb706e`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Co-trimoxazole increases warfarin effect via CYP2C9 inhibition.
- source_effect: `["altered_anticoagulant_effect","metabolic_enzyme_inhibition"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","co-trimoxazole"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 c0fb47f494a1a43f71d48d9298a92854e3e9c0de8ec40cd99e032dd3e23b3d02; path drug_interactions[0]) "Sulfamethoxazole is an inhibitor of CYP2C9."
  - [Drug Interactions] (sha256 ab592d24f03eaccf6fcc91f344da320fa27b38226884ae501853bbcd07b62a25; path drug_interactions[0]) "It has been reported that sulfamethoxazole and trimethoprim may prolong the prothrombin time in patients who are receiving the anticoagulant warfarin (a CYP2C9 substrate). This interaction should be kept in mind when sulfamethoxazole and trimethoprim is given to patients already on anticoagulant therapy, and the coagulation time should be reassessed."

## warfarin__amiodarone

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `2`

### evidence[0] — `fda-label-amiodarone-current` — `machine_confirmed_openfda_reconciled_clinician_approved_for_internal_product_scope`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="amiodarone hydrochloride tablets" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22f49d011f-5ca6-4f75-ba16-2099fe42f5aa%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f49d011f-5ca6-4f75-ba16-2099fe42f5aa
- document: `f49d011f-5ca6-4f75-ba16-2099fe42f5aa@2`; retrieved_at=`2026-07-26`
- SPL: version=`2`; effective_time=`20260615`; source_date=`2026-06-15`
- payload: sha256=`efe97f1d109d8a6f98ed8d48f98aa024ea7b69057e50534128aa2d4870ee46be`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-26`
- proposition: The current U.S. label states that amiodarone potentiates warfarin's anticoagulant response, can cause serious or fatal bleeding, requires prothrombin-time monitoring, and can persist for weeks to months after amiodarone discontinuation.
- source_effect: `["altered_anticoagulant_effect","increased_bleeding_risk","persistence_after_discontinuation"]`
- label_action: `["dose_reduction","monitor"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","amiodarone"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local severity, workflow action, or runtime promotion without clinician approval.
  - An Indian regulatory-label claim.
  - An exact Child-Pugh B interaction modifier.
  - Autonomous pharmacy dose adjustment.
- fragments:
  - [Drug Interactions] (sha256 b3bb5ea6d6a9bb4e28684a7b826f07d5a75950b1a5be7c7f01f779491bc686c2; path drug_interactions[0]) "Potentiates anticoagulant response and can result in serious or fatal bleeding. Coadministration increases prothrombin time by 100% after 3 to 4 days. Reduce warfarin dose by one-third to one-half and monitor prothrombin times."
  - [Drug Interactions] (sha256 d3644fa5d9f2325be0273520ec53bb86056779d7c3a22963f365c15e7ecaa383; path drug_interactions[0]) "Because of amiodarone's long half-life, expect drug interactions to persist for weeks to months after discontinuation of amiodarone."

### evidence[1] — `fda-label-warfarin-current` — `machine_confirmed_openfda_reconciled_clinician_approved_for_internal_product_scope`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="warfarin sodium tablets" | section="Drug Interactions; Boxed Warning; Patient Counseling Information"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2251e98fb6-ba76-497e-95d8-fe895ef0b7ed%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=51e98fb6-ba76-497e-95d8-fe895ef0b7ed
- document: `51e98fb6-ba76-497e-95d8-fe895ef0b7ed@7`; retrieved_at=`2026-07-26`
- SPL: version=`7`; effective_time=`20260629`; source_date=`2026-06-29`
- payload: sha256=`bcb1e6db5ac6619c0c93ede9f0c689dfd8ffdff4f187067335c243046b5d3e04`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]","boxed_warning[0]","information_for_patients[0]"]`
- currentness: `checked_current_openfda` @`2026-07-26`
- proposition: The current U.S. warfarin label lists amiodarone among relevant CYP inhibitors, requires closer INR monitoring when interacting medicines are started, stopped, or changed, warns of major or fatal bleeding, and identifies reportable bleeding symptoms.
- source_effect: `["increased_inr","increased_bleeding_risk"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","amiodarone"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local severity, workflow action, or runtime promotion without clinician approval.
  - An Indian regulatory-label claim.
  - An exact Child-Pugh B interaction modifier.
  - Autonomous pharmacy dose adjustment.
- fragments:
  - [Drug Interactions] (sha256 45a04f184beb02c9e1ccb20df1c8b6d526c75fa4ff34b7ef7997ff7271a7ae36; path drug_interactions[0]) "The CYP450 inhibition and induction potential should be considered when starting, stopping, or changing dose of concomitant medications. Closely monitor INR if a concomitant drug is a CYP2C9, 1A2, and/or 3A4 inhibitor or inducer."
  - [Drug Interactions] (sha256 271674318fb812b8be8bf0bc94a40f081fab4a438c9354aa67a0542abefed40f; path drug_interactions[0]) "Table 2: Examples of CYP450 Interactions with Warfarin Enzyme Inhibitors Inducers CYP2C9 amiodarone"
  - [Boxed Warning] (sha256 9f152e08ac14adaa7a45698016db9c3420063fa966c5ba59d52c131287dd35ae; path boxed_warning[0]) "Warfarin sodium can cause major or fatal bleeding. (5.1) Perform regular monitoring of INR in all treated patients. (2.1)"
  - [Patient Counseling Information] (sha256 cf11d4a374c9494ceb41efbe153a6411268d00cd1de9c5cb8c2df36b1e988699; path information_for_patients[0]) "Notify their physician immediately if any unusual bleeding or symptoms occur. Signs and symptoms of bleeding include: pain, swelling or discomfort, prolonged bleeding from cuts, increased menstrual flow or vaginal bleeding, nosebleeds, bleeding of gums from brushing, unusual bleeding or bruising, red or dark brown urine, red or tar black stools, headache, dizziness, or weakness"

## warfarin__fluoroquinolone

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `2`

### evidence[0] — `fda-label-ciprofloxacin` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="ciprofloxacin" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%221e815845-5336-4b5f-975a-39d79b30cd10%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1e815845-5336-4b5f-975a-39d79b30cd10
- document: `1e815845-5336-4b5f-975a-39d79b30cd10@1`; retrieved_at=`2026-07-24`
- SPL: version=`1`; effective_time=`20091019`; source_date=`2009-10-19`
- payload: sha256=`172dd5e885f3b92da3cfe1b74bae7ae3c948386e23dd322903ee8d9800dc2fea`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[1]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Quinolones can enhance the anticoagulant effect of warfarin; monitor coagulation tests / INR.
- source_effect: `["altered_anticoagulant_effect"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"explicit_class_statement","source_class_term":"quinolones","direct_example_members":["ciprofloxacin"],"requires_clinician_class_mapping":true,"runtime_class":"fluoroquinolone"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 494cc54ba37339329ed8628aedc032ae9bc2426a20dc49991e2f4581c1e10702; path drug_interactions[1]) "Quinolones, including ciprofloxacin, have been reported to enhance the effects of the oral anticoagulant warfarin or its derivatives. When these products are administered concomitantly, prothrombin time or other suitable coagulation tests should be closely monitored."

### evidence[1] — `fda-label-ciprofloxacin-secondary` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="ciprofloxacin (US DailyMed)" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%224fe686e7-b9bb-7450-e054-00144ff8d46c%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4fe686e7-b9bb-7450-e054-00144ff8d46c
- document: `4fe686e7-b9bb-7450-e054-00144ff8d46c@4`; retrieved_at=`2026-07-24`
- SPL: version=`4`; effective_time=`20240717`; source_date=`2024-07-17`
- payload: sha256=`b3be78b23978616f0900bde8f7e869ec321907d4dd0ac2b310654450809d3de1`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: US ciprofloxacin label: quinolones including ciprofloxacin may enhance the anticoagulant effect of warfarin; monitor coagulation tests. Supports CIPROFLOXACIN only. NOTE: this is a US DailyMed source, NOT an Indian (CDSCO) anchor.
- source_effect: `["altered_anticoagulant_effect"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"extrapolated_class","directly_supported_members":["ciprofloxacin"],"runtime_members":["ciprofloxacin","levofloxacin","moxifloxacin","ofloxacin","norfloxacin"],"requires_clinician_class_mapping":true,"runtime_class":"fluoroquinolone","source_members":["ciprofloxacin"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 e6ca135ff43f5d0b876ac42f2ee291e9d2d80463b0478d918068c617feae98fc; path drug_interactions[0]) "The risk may vary with the underlying infection, age and general status of the patient so that the contribution of ciprofloxacin to the increase in INR (international normalized ratio) is difficult to assess. Monitor prothrombin time and INR frequently during and shortly after co-administration of ciprofloxacin with an oral anti-coagulant (for example, warfarin)."

## warfarin__ssri_snri

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-ssri-class` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="selective serotonin reuptake inhibitors (class labeling)" | section="Warnings and Precautions (abnormal bleeding)"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%224e09f580-d612-416c-a4a4-79a4411845b2%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4e09f580-d612-416c-a4a4-79a4411845b2
- document: `4e09f580-d612-416c-a4a4-79a4411845b2@7`; retrieved_at=`2026-07-24`
- SPL: version=`7`; effective_time=`20241119`; source_date=`2024-11-19`
- payload: sha256=`d18842e2d081486011993662c5cd585ec3b3d5ea1d72636939e87155c76bdac6`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["warnings_and_cautions[0]","warnings_and_cautions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Sertraline (SSRI) may add bleeding risk when used with warfarin; careful INR monitoring is advised (SSRI-class labeling). Supports SSRIs; does NOT independently support the full SNRI member set.
- source_effect: `["increased_bleeding_risk"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"extrapolated_class","directly_supported_members":["sertraline"],"runtime_members":["fluoxetine","sertraline","paroxetine","citalopram","escitalopram","venlafaxine","duloxetine"],"requires_clinician_class_mapping":true,"runtime_class":"ssri_snri","source_members":["sertraline"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Warnings and Precautions (abnormal bleeding)] (sha256 201e35b5d829120cbab5382165cd7b35891fba9d262bbb79b7d1172f4cdac9a1; path warnings_and_cautions[0]) "Drugs that interfere with serotonin reuptake inhibition, including sertraline, increase the risk of bleeding events. Concomitant use of aspirin, nonsteroidal anti-inflammatory drugs (NSAIDs), other antiplatelet drugs, warfarin, and other anticoagulants may add to this risk."
  - [Warnings and Precautions (abnormal bleeding)] (sha256 2b93741cb5b069e6b8f80b9ea39a29c4af27e31db6f99ee6183a53bede36aab5; path warnings_and_cautions[0]) "Inform patients of the increased risk of bleeding associated with the concomitant use of sertraline and antiplatelet agents or anticoagulants. For patients taking warfarin, carefully monitor the international normalized ratio."

## warfarin__tramadol

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["UK"]`
- machine_evidence: `1`

### evidence[0] — `mhra-dsu-tramadol-warfarin` — `machine_confirmed_govuk_ogl_bound_pending_clinician`

- source: Medicines and Healthcare products Regulatory Agency on GOV.UK | regulator="MHRA" | product="tramadol" | section="Drug Safety Update"
- policy contract: source_policy_id=`mhra-govuk-drug-safety-updates`; use=`interaction-evidence`; licence=`OGL-3.0`; jurisdiction=`UK`; review_status=`review_candidate`
- origin: https://www.gov.uk/drug-safety-update/warfarin-be-alert-to-the-risk-of-drug-interactions-with-tramadol
- Content API payload: https://www.gov.uk/api/content/drug-safety-update/warfarin-be-alert-to-the-risk-of-drug-interactions-with-tramadol
- document: `warfarin-be-alert-to-the-risk-of-drug-interactions-with-tramadol@2024-06-20T11:11:09+01:00`; retrieved_at=`2026-07-24`
- payload: canonical sha256=`2f7e923cbd5447e3df760ac9f5c7b55d064f3adb5bf681fe3d1fd24643331f22`; source_paths=`["details.body","details.body"]`
- page licence: `OGL-3.0`; attribution="Contains public sector information licensed under the Open Government Licence v3.0."
- currentness: `checked_current_govuk_ogl` @`2026-07-24`
- proposition: MHRA warns of increased INR and major bruising or life-threatening bleeding when warfarin and tramadol are used together.
- source_effect: `["increased_bleeding_risk"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","tramadol"]}`
- jurisdictions: `["UK"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - This source does not establish the rule in US, IN.
- fragments:
  - [Drug Safety Update] (sha256 e2d7b280bb9f442a9aa94429aee02618de0706ac2f46635bc8dc50689287bbd1; path details.body) "be aware of the risk of increased INR when warfarin and tramadol are used together, with a risk of major bruising and bleeding which could be life-threatening"
  - [MHRA DSU - monitoring advice] (sha256 d5a876316a60444c2cf4d14512b7a619067dfd877eeba128488a05ae57bcd550; path details.body) "consider whether additional monitoring of INR is required when starting tramadol or another concomitant medicine"

## warfarin__rifampicin

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-rifampin` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="rifampin" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%224c39ee75-ae96-456d-bf47-16d49865345e%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4c39ee75-ae96-456d-bf47-16d49865345e
- document: `4c39ee75-ae96-456d-bf47-16d49865345e@1`; retrieved_at=`2026-07-24`
- SPL: version=`1`; effective_time=`20230412`; source_date=`2023-04-12`
- payload: sha256=`273a8d5def6c5eff99863850039e92a113e86230b63c980d12b6e88e95ea1a8c`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["precautions[0]","precautions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Rifampicin lowers warfarin effect (reduced INR) via strong CYP induction.
- source_effect: `["decreased_drug_exposure","altered_anticoagulant_effect"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","rifampicin"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 1e0e24b3e0c320653b476e327f8b728a48be640851c69937dd46acb4092555ca; path precautions[0]) "Oral Anticoagulants Prevention or Management: Perform prothrombin time daily or as frequently as necessary to establish and maintain the required dose of anticoagulant"
  - [Drug Interactions] (sha256 c4d306e28529dd442e61656504fcc540e286e94bdfa6683be2156a7bc9a71cd7; path precautions[0]) "Warfarin Decrease exposure"

## warfarin__azithromycin_oral

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-azithromycin` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="azithromycin" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22db52b91e-79f7-4cc1-9564-f2eee8e31c45%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=db52b91e-79f7-4cc1-9564-f2eee8e31c45
- document: `db52b91e-79f7-4cc1-9564-f2eee8e31c45@48`; retrieved_at=`2026-07-24`
- SPL: version=`48`; effective_time=`20260107`; source_date=`2026-01-07`
- payload: sha256=`c2685e743c2b1fca5c3862fb87a4a452c366876d280ef0f18e31eae9a4e109f1`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Monitor prothrombin time/INR when azithromycin is co-administered with warfarin.
- source_effect: `["altered_anticoagulant_effect"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"exact_members","members":["warfarin","azithromycin"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 d3a7048dfb58fa31fc1679f8c51e2c20e3f6338a6f7460548d4295b1c08fb199; path drug_interactions[0]) "Spontaneous postmarketing reports suggest that concomitant administration of azithromycin may potentiate the effects of oral anticoagulants such as warfarin, although the prothrombin time was not affected in the dedicated drug interaction study with azithromycin and warfarin. Prothrombin times should be carefully monitored while patients are receiving azithromycin and oral anticoagulants concomitantly."

## apixaban__strong_cyp3a4_pgp_inhibitor

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `2`

### evidence[0] — `fda-label-apixaban` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="apixaban" | section="Dosage and Administration / Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%227be1f4c1-bb2f-4ded-ae9a-515d2a22f93e%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7be1f4c1-bb2f-4ded-ae9a-515d2a22f93e
- document: `7be1f4c1-bb2f-4ded-ae9a-515d2a22f93e@1`; retrieved_at=`2026-07-24`
- SPL: version=`1`; effective_time=`20250829`; source_date=`2025-08-29`
- payload: sha256=`8f4946baa65b7344b21d6ee205465947d4b5312b91a4f26912470dda3caccf0b`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]","dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Combined strong dual CYP3A4/P-gp inhibitors raise apixaban exposure: reduce apixaban 50% on 5/10 mg BID; avoid on 2.5 mg BID (US ELIQUIS label). Clarithromycin is a labelled EXCEPTION - see the separate clarithromycin evidence record.
- source_effect: `["increased_drug_exposure","metabolic_enzyme_inhibition"]`
- label_action: `["reduce_dose_50pct_if_5_or_10bid","avoid_if_2.5bid"]`
- scope: `{"scope_type":"explicit_class_statement","source_examples":["ketoconazole","ritonavir"],"runtime_members_derived_from":"fda_cyp3a4_pgp_role_list@2026-07","runtime_membership_evidence_separate":true,"object_members":["apixaban"],"source_class_term":"combined P-gp and strong CYP3A4 inhibitors","requires_clinician_class_mapping":true,"runtime_class":"fda_cyp3a4_pgp_role_list@2026-07"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
- fragments:
  - [Dosage and Administration / Drug Interactions] (sha256 a250c6f325be0439d8a192834ec86c0f2e86d9e87556ac9eb72d875d2a9eba77; path dosage_and_administration[0]) "For adult patients receiving ELIQUIS doses of 5 mg or 10 mg twice daily, reduce the dose by 50% when ELIQUIS is coadministered with drugs that are combined P-glycoprotein (P-gp) and strong cytochrome P450 3A4 (CYP3A4) inhibitors (e.g., ketoconazole, itraconazole, ritonavir) [see Clinical Pharmacology (12.3)] ."
  - [Dosage and Administration / Drug Interactions] (sha256 512f540d81a3d330c07421913e0b95504f05c52ce4c64499f17ec13a5dd76266; path dosage_and_administration[0]) "In patients already taking 2.5 mg twice daily, avoid coadministration of ELIQUIS with combined P-gp and strong CYP3A4 inhibitors [see Drug Interactions (7.1) ]."

### evidence[1] — `fda-label-apixaban-clarithromycin-exception` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="apixaban (ELIQUIS)" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%227be1f4c1-bb2f-4ded-ae9a-515d2a22f93e%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7be1f4c1-bb2f-4ded-ae9a-515d2a22f93e
- document: `7be1f4c1-bb2f-4ded-ae9a-515d2a22f93e@1`; retrieved_at=`2026-07-24`
- SPL: version=`1`; effective_time=`20250829`; source_date=`2025-08-29`
- payload: sha256=`8f4946baa65b7344b21d6ee205465947d4b5312b91a4f26912470dda3caccf0b`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: US apixaban label: no apixaban dose adjustment is necessary with clarithromycin, despite its combined strong CYP3A4/P-gp inhibition.
- source_effect: `["metabolic_enzyme_inhibition"]`
- label_action: `["no_dose_adjustment"]`
- scope: `{"scope_type":"exact_members","object_members":["apixaban"],"perpetrator_members":["clarithromycin"],"member_exception":"clarithromycin","members":["apixaban","clarithromycin"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
- fragments:
  - [Drug Interactions] (sha256 74944dbf0b8b33a309ea58c2d95b28cce5fa9cdf5269a886e698fc11face4db1; path drug_interactions[0]) "Although clarithromycin is a combined P-gp and strong CYP3A4 inhibitor, pharmacokinetic data suggest that no dose adjustment is necessary with concomitant administration with ELIQUIS [see Clinical Pharmacology (12.3)] ."

## rivaroxaban__strong_cyp3a4_pgp_inhibitor

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `2`

### evidence[0] — `fda-label-rivaroxaban` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="rivaroxaban" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2210db92f9-2300-4a80-836b-673e1ae91610%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=10db92f9-2300-4a80-836b-673e1ae91610
- document: `10db92f9-2300-4a80-836b-673e1ae91610@64`; retrieved_at=`2026-07-24`
- SPL: version=`64`; effective_time=`20260116`; source_date=`2026-01-16`
- payload: sha256=`12047377e83591063b3240b067b5e66bb04a334847b18886af5ae8b4e69785de`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","warnings_and_cautions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Combined strong CYP3A4/P-gp inhibitors increase rivaroxaban exposure; avoid concomitant use.
- source_effect: `["increased_bleeding_risk","increased_drug_exposure"]`
- label_action: `["avoid"]`
- scope: `{"scope_type":"explicit_class_statement","source_examples":["ketoconazole","ritonavir"],"runtime_members_derived_from":"fda_cyp3a4_pgp_role_list@2026-07","runtime_membership_evidence_separate":true,"object_members":["rivaroxaban"],"source_class_term":"combined P-gp and strong CYP3A4 inhibitors","requires_clinician_class_mapping":true,"runtime_class":"fda_cyp3a4_pgp_role_list@2026-07"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - Runtime use while the declared selector or evidence scope is not executable.
- fragments:
  - [Drug Interactions] (sha256 b5bf5a012cf2e160c06a62999aef8e3d9c589bf910d709eaf2037c122a9e7120; path drug_interactions[0]) "Avoid concomitant administration of XARELTO with known combined P-gp and strong CYP3A inhibitors (e.g., ketoconazole and ritonavir) [see Warnings and Precautions (5.6) and Clinical Pharmacology (12.3)]."
  - [Drug Interactions] (sha256 bea3213f8d4647fa66759d24279d5bc9be197d04ac63b8b4d39e12de09e13d42; path warnings_and_cautions[0]) "Concomitant use of drugs that are known combined P-gp and strong CYP3A inhibitors increases rivaroxaban exposure and may increase bleeding risk [see Drug Interactions (7.2)]."

### evidence[1] — `fda-label-rivaroxaban-clarithromycin-exception` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="rivaroxaban (XARELTO)" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-counterevidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2210db92f9-2300-4a80-836b-673e1ae91610%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=10db92f9-2300-4a80-836b-673e1ae91610
- document: `10db92f9-2300-4a80-836b-673e1ae91610@64`; retrieved_at=`2026-07-24`
- SPL: version=`64`; effective_time=`20260116`; source_date=`2026-01-16`
- payload: sha256=`12047377e83591063b3240b067b5e66bb04a334847b18886af5ae8b4e69785de`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The current U.S. rivaroxaban label states that no precautions are necessary with concomitant clarithromycin.
- interaction_exists: `false`
- source_effect: `["no_clinically_meaningful_effect"]`
- label_action: `[]`
- scope: `{"scope_type":"exact_members","object_members":["rivaroxaban"],"perpetrator_members":["clarithromycin"],"member_exception":"clarithromycin","members":["rivaroxaban","clarithromycin"],"evidence_role":"product_specific_interaction_counterevidence"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This product-specific counterevidence supports no special precautions for rivaroxaban plus clarithromycin; it does not support increased bleeding risk or a positive interaction action.
  - It does not establish a class-wide no-effect conclusion for other combined P-gp and strong CYP3A inhibitors.
  - It does not validate local runtime severity, workflow action, clinician approval, or promotion readiness.
- fragments:
  - [Drug Interactions] (sha256 ca1814677dfff8114e62c5e25272d2f3a076affe711ce7c6224f38b951db4b7c; path drug_interactions[0]) "Although clarithromycin is a combined P-gp and strong CYP3A inhibitor, pharmacokinetic data suggests that no precautions are necessary with concomitant administration with XARELTO"

## rivaroxaban__hepatic_impairment_child_pugh_b_c

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-rivaroxaban-hepatic` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="rivaroxaban" | section="Contraindications / Use in Specific Populations (Hepatic Impairment)"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2210db92f9-2300-4a80-836b-673e1ae91610%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=10db92f9-2300-4a80-836b-673e1ae91610
- document: `10db92f9-2300-4a80-836b-673e1ae91610@64`; retrieved_at=`2026-07-24`
- SPL: version=`64`; effective_time=`20260116`; source_date=`2026-01-16`
- payload: sha256=`12047377e83591063b3240b067b5e66bb04a334847b18886af5ae8b4e69785de`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["use_in_specific_populations[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Avoid rivaroxaban in moderate/severe (Child-Pugh B/C) hepatic impairment, or hepatic disease associated with coagulopathy (US XARELTO label). Independent drug-condition restriction - does NOT support the strong-inhibitor DDI.
- source_effect: `["increased_exposure_in_hepatic_impairment"]`
- label_action: `["avoid"]`
- scope: `{"scope_type":"drug_condition","members":["rivaroxaban"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
- fragments:
  - [Contraindications / Use in Specific Populations (Hepatic Impairment)] (sha256 ac3f8a07010be8dcddc7a6968ab8b77c25fed3e182135f28e9b43635e7f769fe; path use_in_specific_populations[0]) "Avoid the use of XARELTO in patients with moderate (Child-Pugh B) and severe (Child-Pugh C) hepatic impairment or with any hepatic disease associated with coagulopathy."

## apixaban__strong_cyp3a4_pgp_inducer

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-apixaban` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="apixaban" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%227be1f4c1-bb2f-4ded-ae9a-515d2a22f93e%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7be1f4c1-bb2f-4ded-ae9a-515d2a22f93e
- document: `7be1f4c1-bb2f-4ded-ae9a-515d2a22f93e@1`; retrieved_at=`2026-07-24`
- SPL: version=`1`; effective_time=`20250829`; source_date=`2025-08-29`
- payload: sha256=`8f4946baa65b7344b21d6ee205465947d4b5312b91a4f26912470dda3caccf0b`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Combined strong CYP3A4/P-gp inducers reduce apixaban exposure; avoid concomitant use.
- source_effect: `["decreased_drug_exposure","increased_thromboembolic_risk"]`
- label_action: `["generally_avoid"]`
- scope: `{"scope_type":"explicit_class_statement","source_class_term":"cyp3a4_pgp_inducer","object_members":["apixaban"],"requires_clinician_class_mapping":true,"runtime_class":"cyp3a4_pgp_inducer@2026-07-22"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 6a4dfcfe3769ae8d2470d7ea4ed2eebcb64d7692013bd23b6b4fbf1cfcc91e29; path drug_interactions[0]) "Avoid concomitant use of ELIQUIS with combined P-gp and strong CYP3A4 inducers (e.g., rifampin, carbamazepine, phenytoin, St. John's wort) because such drugs will decrease exposure to apixaban [see Clinical Pharmacology (12.3)] ."
  - [Drug Interactions] (sha256 2477f6f7491788fe46652fc3b0b39b4b24005de998c6f36fc79fef059b3d411e; path drug_interactions[0]) "Concomitant use with drugs that are combined P-gp and strong CYP3A4 inducers decreases exposure to apixaban [see Clinical Pharmacology (12.3)] which increases the risk for stroke and other thromboembolic events."

## rivaroxaban__strong_cyp3a4_pgp_inducer

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-rivaroxaban` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="rivaroxaban" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%2210db92f9-2300-4a80-836b-673e1ae91610%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=10db92f9-2300-4a80-836b-673e1ae91610
- document: `10db92f9-2300-4a80-836b-673e1ae91610@64`; retrieved_at=`2026-07-24`
- SPL: version=`64`; effective_time=`20260116`; source_date=`2026-01-16`
- payload: sha256=`12047377e83591063b3240b067b5e66bb04a334847b18886af5ae8b4e69785de`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Combined strong CYP3A4/P-gp inducers reduce rivaroxaban exposure; avoid concomitant use.
- source_effect: `["decreased_drug_exposure"]`
- label_action: `["generally_avoid"]`
- scope: `{"scope_type":"explicit_class_statement","source_class_term":"cyp3a4_pgp_inducer","object_members":["rivaroxaban"],"requires_clinician_class_mapping":true,"runtime_class":"cyp3a4_pgp_inducer@2026-07-22"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 8705247e7b717fe551d6d1bfb5d88d65494514ef1c46cc55f339df52196b7d3e; path drug_interactions[0]) "Avoid concomitant use of XARELTO with drugs that are combined P-gp and strong CYP3A inducers (e.g., carbamazepine, phenytoin, rifampin, St. John's wort)"

## dabigatran__pgp_inducer

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-dabigatran` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="dabigatran etexilate" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22ba74e3cd-b06f-4145-b284-5fd6b84ff3c9%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ba74e3cd-b06f-4145-b284-5fd6b84ff3c9
- document: `ba74e3cd-b06f-4145-b284-5fd6b84ff3c9@48`; retrieved_at=`2026-07-24`
- SPL: version=`48`; effective_time=`20250625`; source_date=`2025-06-25`
- payload: sha256=`f41a6cabbdd0a0cf230c3eb4d881574cb28c6a18b3613e2ce5bed1eda181f2b2`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: P-gp inducers (rifampicin) reduce dabigatran exposure; avoid concomitant use.
- source_effect: `["decreased_drug_exposure"]`
- label_action: `["generally_avoid"]`
- scope: `{"scope_type":"explicit_class_statement","source_class_term":"pgp_inducer","object_members":["dabigatran"],"requires_clinician_class_mapping":true,"runtime_class":"pgp_inducer@2026-07-22"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Drug Interactions] (sha256 db2898d7d236164b83bd40f3519d687de7f2b530c9649a1d36f7ef8edb833154; path drug_interactions[0]) "The concomitant use of PRADAXA with P-gp inducers (e.g., rifampin) reduces exposure to dabigatran and should generally be avoided"

## edoxaban__pgp_inducer

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-edoxaban` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="edoxaban" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22e77d3400-56ad-11e3-949a-0800200c9a66%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e77d3400-56ad-11e3-949a-0800200c9a66
- document: `e77d3400-56ad-11e3-949a-0800200c9a66@28`; retrieved_at=`2026-07-24`
- SPL: version=`28`; effective_time=`20250710`; source_date=`2025-07-10`
- payload: sha256=`5a2a879203589df4ddddba456e951a0d6a0a00d951388aae502b81a5158c8184`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: US Savaysa label: avoid concomitant use of edoxaban with rifampin.
- source_effect: `["documented_pharmacologic_interaction"]`
- label_action: `["avoid"]`
- scope: `{"scope_type":"exact_members","members":["edoxaban","rifampicin"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
- fragments:
  - [Drug Interactions] (sha256 d93e9ad9e1cceeafc3a07f854335956313667a4a56a3e2f08d9f6a7934097081; path drug_interactions[0]) "Avoid the concomitant use of SAVAYSA with rifampin [see Clinical Pharmacology (12.3)]."

## dabigatran_nvaf__dronedarone_or_ketoconazole

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-dabigatran` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="dabigatran etexilate" | section="Dosage and Administration / Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22ba74e3cd-b06f-4145-b284-5fd6b84ff3c9%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ba74e3cd-b06f-4145-b284-5fd6b84ff3c9
- document: `ba74e3cd-b06f-4145-b284-5fd6b84ff3c9@48`; retrieved_at=`2026-07-24`
- SPL: version=`48`; effective_time=`20250625`; source_date=`2025-06-25`
- payload: sha256=`f41a6cabbdd0a0cf230c3eb4d881574cb28c6a18b3613e2ce5bed1eda181f2b2`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","warnings_and_cautions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: In adult NVAF with CrCl 30-50 mL/min, reduce dabigatran to 75 mg twice daily with dronedarone or systemic ketoconazole; avoid P-gp inhibitors when CrCl is 15-30 mL/min (US PRADAXA label, Jun 2025).
- source_effect: `["documented_pharmacologic_interaction"]`
- label_action: `["reduce_dose_75mg_bid","avoid_below_crcl_30"]`
- scope: `{"scope_type":"exact_members","members":["dabigatran","dronedarone","ketoconazole"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
- fragments:
  - [Dosage and Administration - NVAF, moderate renal impairment] (sha256 73fa1a190f64cbb77b81317a8da8f5ad8c5b480e4e0d52a4c2b63da1c0565ac2; path drug_interactions[0]) "In patients with moderate renal impairment (CrCl 30-50 mL/min), reduce the dosage of PRADAXA to 75 mg twice daily when administered concomitantly with the P-gp inhibitors dronedarone or systemic ketoconazole."
  - [Dosage and Administration - NVAF, severe renal impairment] (sha256 948f3d94b68dfc7f40b99990a2c077a58c17420a1a7b8559343a04064092817e; path warnings_and_cautions[0]) "Avoid use of PRADAXA Capsules and P-gp inhibitors in patients with severe renal impairment (CrCl 15-30 mL/min)"

## dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-dabigatran` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="dabigatran etexilate" | section="Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22ba74e3cd-b06f-4145-b284-5fd6b84ff3c9%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ba74e3cd-b06f-4145-b284-5fd6b84ff3c9
- document: `ba74e3cd-b06f-4145-b284-5fd6b84ff3c9@48`; retrieved_at=`2026-07-24`
- SPL: version=`48`; effective_time=`20250625`; source_date=`2025-06-25`
- payload: sha256=`f41a6cabbdd0a0cf230c3eb4d881574cb28c6a18b3613e2ce5bed1eda181f2b2`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: For adult NVAF, verapamil, amiodarone, quinidine, clarithromycin and ticagrelor do not require dabigatran dose adjustment; do not extrapolate to other P-gp inhibitors (US PRADAXA label, Jun 2025).
- source_effect: `["documented_pharmacologic_interaction"]`
- label_action: `["no_dose_adjustment"]`
- scope: `{"scope_type":"exact_members","members":["verapamil","amiodarone","quinidine","clarithromycin","ticagrelor"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
- fragments:
  - [Drug Interactions] (sha256 e1e99ff1ded74dde8675fbbfb2fc2534afc630ad47569c636f0f4dae6daa048c; path drug_interactions[0]) "The use of the P-gp inhibitors verapamil, amiodarone, quinidine, clarithromycin, and ticagrelor does not require a dosage adjustment of PRADAXA."
  - [Drug Interactions] (sha256 cabdc4ccc5e3e9b2756a31d2b95ac0848f082f39b5aafbc328792edd5e22dd81; path drug_interactions[0]) "These results should not be extrapolated to other P-gp inhibitors [see Warnings and Precautions (5.5), Use in Specific Populations (8.6), and Clinical Pharmacology (12.3)]."

## dabigatran_vte__pgp_inhibitor

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-dabigatran` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="dabigatran etexilate" | section="Dosage and Administration / Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22ba74e3cd-b06f-4145-b284-5fd6b84ff3c9%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ba74e3cd-b06f-4145-b284-5fd6b84ff3c9
- document: `ba74e3cd-b06f-4145-b284-5fd6b84ff3c9@48`; retrieved_at=`2026-07-24`
- SPL: version=`48`; effective_time=`20250625`; source_date=`2025-06-25`
- payload: sha256=`f41a6cabbdd0a0cf230c3eb4d881574cb28c6a18b3613e2ce5bed1eda181f2b2`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["dosage_and_administration[0]","dosage_and_administration[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: For adult VTE treatment/recurrence prevention, avoid concomitant P-gp inhibitors when CrCl is below 50 mL/min (US PRADAXA label, Jun 2025).
- source_effect: `["documented_pharmacologic_interaction"]`
- label_action: `["avoid_below_crcl_50"]`
- scope: `{"scope_type":"explicit_class_statement","class_id":"pgp_inhibitor","class_version":"2026-07-22","note":"label states \"P-gp inhibitors\" generically for the VTE indication","requires_clinician_class_mapping":true,"runtime_class":"pgp_inhibitor@2026-07-22","source_class_statement":"Source uses the class term recorded in normalized_proposition."}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - Runtime use while the declared selector or evidence scope is not executable.
- fragments:
  - [Dosage and Administration / Drug Interactions] (sha256 16365a795e90436c7f0b9f67b11baf860cd9709bde0d032206fd5d6e08d34ca3; path dosage_and_administration[0]) "Treatment and Reduction in the Risk of Recurrence of Deep Venous Thrombosis and Pulmonary Embolism Dosing recommendations for patients with CrCl ≤ 30 mL/min cannot be provided."
  - [Dosage and Administration / Drug Interactions] (sha256 e40215ec956a062a7278bd0daadc376c30ce12d2c08c9d47b2e69fa53fb961bf; path dosage_and_administration[0]) "Avoid use of concomitant P-gp inhibitors in patients with CrCl < 50 mL/min [see Warnings and Precautions (5.5), Drug Interactions (7.2) and Clinical Pharmacology (12.3)]."

## dabigatran_hip_prophylaxis__pgp_inhibitor

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-dabigatran` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="dabigatran etexilate" | section="Dosage and Administration / Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22ba74e3cd-b06f-4145-b284-5fd6b84ff3c9%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ba74e3cd-b06f-4145-b284-5fd6b84ff3c9
- document: `ba74e3cd-b06f-4145-b284-5fd6b84ff3c9@48`; retrieved_at=`2026-07-24`
- SPL: version=`48`; effective_time=`20250625`; source_date=`2025-06-25`
- payload: sha256=`f41a6cabbdd0a0cf230c3eb4d881574cb28c6a18b3613e2ce5bed1eda181f2b2`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: For hip-replacement prophylaxis, avoid P-gp inhibitors below CrCl 50 mL/min; at CrCl at least 50 mL/min, separating selected inhibitors (dronedarone, systemic ketoconazole) by several hours may help (US PRADAXA label, Jun 2025).
- source_effect: `["documented_pharmacologic_interaction"]`
- label_action: `["avoid_below_crcl_50","spacing_at_crcl_ge_50"]`
- scope: `{"scope_type":"explicit_class_statement","class_id":"pgp_inhibitor","class_version":"2026-07-22","requires_clinician_class_mapping":true,"runtime_class":"pgp_inhibitor@2026-07-22","source_class_statement":"Source uses the class term recorded in normalized_proposition."}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - Runtime use while the declared selector or evidence scope is not executable.
- fragments:
  - [Dosage and Administration - hip replacement prophylaxis, CrCl >=50 mL/min] (sha256 0658820e8b629e20b240f7e663367e0360dcd48e8dc8076bdcefb707699bfc33; path drug_interactions[0]) "it may be helpful to separate the timing of administration of PRADAXA and the P-gp inhibitor by several hours"
  - [Dosage and Administration - hip replacement prophylaxis, CrCl <50 mL/min] (sha256 eefc754f08c24e9ba053807d1cff275b61099bea2339c49c130af86360575b8e; path drug_interactions[0]) "The concomitant use of PRADAXA and P-gp inhibitors in patients with CrCl < 50 mL/min should be avoided"

## clopidogrel__cyp2c19_inhibiting_ppi

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-clopidogrel` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="clopidogrel" | section="Warnings and Precautions / Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22de8b0b67-eb25-4684-83b5-7ad785314227%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=de8b0b67-eb25-4684-83b5-7ad785314227
- document: `de8b0b67-eb25-4684-83b5-7ad785314227@5`; retrieved_at=`2026-07-24`
- SPL: version=`5`; effective_time=`20250530`; source_date=`2025-05-30`
- payload: sha256=`cf1e82c4f62e42a80b1a37f6a0a6e9b43e5a11a906c1dc2edbdaed8fa8cd7e29`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["warnings_and_cautions[0]","warnings_and_cautions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Omeprazole/esomeprazole reduce clopidogrel activation via CYP2C19 inhibition.
- source_effect: `["metabolic_enzyme_inhibition","reduced_or_altered_platelet_effect"]`
- label_action: `["avoid"]`
- scope: `{"scope_type":"exact_members","object_members":["clopidogrel"],"perpetrator_members":["omeprazole","esomeprazole"],"members":["clopidogrel","omeprazole","esomeprazole"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Warnings and Precautions / Drug Interactions] (sha256 b82d08123121b4ed15bc83b9e9d79087da73d67a366a7d43f2579b9e093567c9; path warnings_and_cautions[0]) "The metabolism of clopidogrel can also be impaired by drugs that inhibit CYP2C19, such as omeprazole or esomeprazole."
  - [Warnings and Precautions / Drug Interactions] (sha256 da268ab7531ee738bc7f8d6dd8c937c9bc5811e1d154b75e9fdb2f2c3ef380a1; path warnings_and_cautions[0]) "Avoid concomitant use of Plavix with omeprazole or esomeprazole because both significantly reduce the antiplatelet activity of Plavix [see Drug Interactions (7.1)]."

## aspirin_ld_ir__ibuprofen_timing

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `[]`
- machine_evidence: `0`

- gap: Open-evidence gap: live fetches of the official FDA URL https://www.fda.gov/media/76636/download on 2026-07-24 were inconsistent, returning both "Not found" and a valid PDF whose exact timing sentence was machine-extracted. The fda-authored-web-content source policy remains disabled and has no enabled licence/payload-extraction contract, so the fragment is not retained and no mirror was substituted.

## aspirin__ibuprofen_additive_gi_bleeding

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-caldolor-aspirin-gi` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="ibuprofen injection (CALDOLOR)" | section="Drug Interactions - Aspirin"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%221eaa7790-f1a1-4f51-b10a-cbbaf033f684%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1eaa7790-f1a1-4f51-b10a-cbbaf033f684
- document: `1eaa7790-f1a1-4f51-b10a-cbbaf033f684@16`; retrieved_at=`2026-07-24`
- SPL: version=`16`; effective_time=`20250214`; source_date=`2025-02-14`
- payload: sha256=`c36e698bbd083a7858376e29b0b1d35656f3fc6c42f82267d53edd969f49959d`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]","drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The US CALDOLOR label states that aspirin plus an NSAID increased gastrointestinal adverse reactions in a clinical study and does not generally recommend CALDOLOR with analgesic-dose aspirin because of increased bleeding risk.
- source_effect: `["increased_bleeding_risk","increased_gi_adverse_reactions"]`
- label_action: `["not_generally_recommended"]`
- scope: `{"scope_type":"exact_members","members":["aspirin","ibuprofen"],"source_product":"CALDOLOR","source_ibuprofen_route":"intravenous","source_aspirin_dose":"analgesic"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source action applies to intravenous CALDOLOR and analgesic-dose aspirin; it does not by itself establish the same management for oral ibuprofen or low-dose aspirin.
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
- fragments:
  - [Drug Interactions - Aspirin] (sha256 21e981565ce97e71cbdd9df6999bc349b2fe647efc59debb3f6c4247159a2106; path drug_interactions[0]) "Controlled clinical studies showed that the concomitant use of NSAIDs and analgesic doses of aspirin does not produce any greater therapeutic effect than the use of NSAIDs alone. In a clinical study, the concomitant use of an NSAID and aspirin was associated with a significantly increased incidence of GI adverse reactions as compared to use of the NSAID alone [see Warnings and Precautions (5.2)]."
  - [Drug Interactions - Aspirin] (sha256 9bba7d75891688d75aa1ca9f99697191b5fa5e6275ce3ee354076128ff256c69; path drug_interactions[0]) "Concomitant use of CALDOLOR and analgesic doses of aspirin is not generally recommended because of the increased risk of bleeding [see Warnings and Precautions (5.11)]."

## aspirin__nsaid_additive_gi_bleeding

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `[]`
- machine_evidence: `0`

- gap: Open-evidence gap: current openFDA SPL 8bff5df5-d856-4237-b6a8-ae445b454844 version 13 effective 20250922 does not contain the previously cited aspirin-specific GI-risk fragment; no replacement text was inferred or fuzzy-matched.

## dual_antiplatelet__oral_anticoagulant_triple_therapy

- runtime_enabled: `false`
- pair_matcher_executable: `false`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-apixaban-appraise2` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="apixaban (ELIQUIS)" | section="Antithrombotic therapy guidance"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%227be1f4c1-bb2f-4ded-ae9a-515d2a22f93e%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7be1f4c1-bb2f-4ded-ae9a-515d2a22f93e
- document: `7be1f4c1-bb2f-4ded-ae9a-515d2a22f93e@1`; retrieved_at=`2026-07-24`
- SPL: version=`1`; effective_time=`20250829`; source_date=`2025-08-29`
- payload: sha256=`8f4946baa65b7344b21d6ee205465947d4b5312b91a4f26912470dda3caccf0b`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: In APPRAISE-2, apixaban increased major bleeding in patients receiving aspirin alone or aspirin plus clopidogrel (US ELIQUIS label).
- source_effect: `["increased_bleeding_risk"]`
- label_action: `[]`
- scope: `{"scope_type":"exact_members","members":["apixaban","aspirin","clopidogrel"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - all_oral_anticoagulants
  - all_p2y12_inhibitors
  - duration_minimisation
  - universal_pharmacist_management
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - The source does not state a specific management action.
  - Runtime use while the declared selector or evidence scope is not executable.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Antithrombotic therapy guidance] (sha256 7edc28c4f773638d9fbcf04d9f05a6f69325441d809a025827a74068202803f4; path drug_interactions[0]) "APPRAISE-2, a placebo-controlled clinical trial of ELIQUIS in high-risk, post-acute coronary syndrome patients treated with aspirin or the combination of aspirin and clopidogrel, was terminated early due to a higher rate of bleeding with ELIQUIS compared to placebo. The rate of ISTH major bleeding was 2.8% per year with ELIQUIS versus 0.6% per year with placebo in patients receiving single antiplatelet therapy and was 5.9% per year with ELIQUIS versus 2.5% per year with placebo in those receiving dual antiplatelet therapy."

## ssri_snri__nsaid_additive_gi_bleeding

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-sertraline-nsaid-bleeding` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="sertraline tablets" | section="Warnings and Precautions - Increased Risk of Bleeding"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%222dac437f-b5ef-42dd-aa0b-1f4b9b45ef43%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2dac437f-b5ef-42dd-aa0b-1f4b9b45ef43
- document: `2dac437f-b5ef-42dd-aa0b-1f4b9b45ef43@8`; retrieved_at=`2026-07-24`
- SPL: version=`8`; effective_time=`20230901`; source_date=`2023-09-01`
- payload: sha256=`db4fd5c1da05ef533e1a138bd4aa7b7311b0ab0366a85b8232e7bc7dfdf05950`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["warnings_and_cautions[0]","warnings_and_cautions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: The U.S. sertraline label states that serotonin-reuptake inhibition increases bleeding risk and that concomitant NSAIDs may add to that risk; this directly supports sertraline/SSRIs, not every SNRI.
- source_effect: `["increased_bleeding_risk"]`
- label_action: `[]`
- scope: `{"scope_type":"extrapolated_class","directly_supported_members":["sertraline"],"source_class_statement":"drugs that interfere with serotonin reuptake inhibition","requires_clinician_class_mapping":true,"runtime_class":"ssri_snri"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source does not establish every SNRI in the runtime class roster.
  - The source does not state a specific management action.
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
  - Runtime use while the declared selector or evidence scope is not executable.
- fragments:
  - [Warnings and Precautions - Increased Risk of Bleeding] (sha256 a4582c77e025324e50e483c4664fdba39339332b36a52639ae9232c25ab7d15a; path warnings_and_cautions[0]) "Drugs that interfere with serotonin reuptake inhibition, including sertraline, increase the risk of bleeding events."
  - [Warnings and Precautions - Increased Risk of Bleeding] (sha256 ef1606001b04c6cb0c16c5dc821c6a9a412c4dce1fc9dcd7f26567f0557990d2; path warnings_and_cautions[0]) "Concomitant use of aspirin, nonsteroidal anti-inflammatory drugs (NSAIDs), other antiplatelet drugs, warfarin, and other anticoagulants may add to this risk."

## heparin_lmwh__nsaid_or_antiplatelet_bleeding

- runtime_enabled: `false`
- pair_matcher_executable: `true`
- applicability.jurisdiction: `["US"]`
- machine_evidence: `1`

### evidence[0] — `fda-label-enoxaparin` — `machine_confirmed_openfda_reconciled_pending_clinician`

- source: openFDA drug-label record (company-submitted SPL); U.S. National Library of Medicine / FDA | regulator="FDA" | product="enoxaparin" | section="Warnings and Precautions / Drug Interactions"
- policy contract: source_policy_id=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; jurisdiction=`US`; review_status=`review_candidate`
- origin: https://api.fda.gov/drug/label.json?search=set_id%3A%22de6fb917-a94a-41ea-9d7d-937d4080ffcd%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=de6fb917-a94a-41ea-9d7d-937d4080ffcd
- document: `de6fb917-a94a-41ea-9d7d-937d4080ffcd@15`; retrieved_at=`2026-07-24`
- SPL: version=`15`; effective_time=`20260206`; source_date=`2026-02-06`
- payload: sha256=`0398fe777298792b741b3d827f25f825b0575124d2d75bf20ba9ea112ffdeb1e`; canonicalization=`sorted-json-keys-v1`; normalization=`openfda-spl-text-v1`
- source_paths: `["drug_interactions[0]"]`
- currentness: `checked_current_openfda` @`2026-07-24`
- proposition: Heparins/LMWH plus NSAIDs or antiplatelets additively increase bleeding risk.
- source_effect: `["increased_bleeding_risk"]`
- label_action: `["monitor"]`
- scope: `{"scope_type":"extrapolated_class","directly_supported_members":["enoxaparin"],"runtime_members":["unfractionated heparin","enoxaparin","dalteparin","tinzaparin"],"requires_clinician_class_mapping":true,"runtime_class":"heparin_lmwh+nsaid_or_antiplatelet","source_members":["enoxaparin"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Local runtime severity, workflow action, and promotion without clinician approval.
  - Runtime use while the declared selector or evidence scope is not executable.
  - The source class or named members require clinician approval before mapping to the runtime class roster.
  - This source does not establish the rule in UK, IN.
- fragments:
  - [Warnings and Precautions / Drug Interactions] (sha256 396ccf69ce4c680e2d02130cb2ade6e172196a95b2b95eb6069384800b53e0d2; path drug_interactions[0]) "Whenever possible, agents which may enhance the risk of hemorrhage should be discontinued prior to initiation of Lovenox therapy. These agents include medications such as: anticoagulants, platelet inhibitors including acetylsalicylic acid, salicylates, NSAIDs (including ketorolac tromethamine), dipyridamole, or sulfinpyrazone. If coadministration is essential, conduct close clinical and laboratory monitoring [see Warnings and Precautions (5.1)]."
