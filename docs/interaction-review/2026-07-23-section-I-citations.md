# Section I — citation sign-off worksheet

**33 evidence records** across **24 rules**, containing **67 exact hashed fragments**. Every evidence item is reconciled to one uniquely selected live openFDA SPL record; the full API payloads are deliberately not committed.

Machine-generated from enriched evidence. Citation, licensing, provenance, jurisdiction, evidence role, and clinician-review state are reported exactly as stored in the JSONL.

Applicability is U.S.-only where retained interaction evidence supports an action. `doxycycline__polyvalent_cation` remains unscoped because its retained labels supply no action. Three no-effect records are explicitly typed as `interaction-counterevidence`; they cannot satisfy an interaction-action gate.

- Section: `I`
- JSONL SHA-256: `2d4bd7d469295c18abb8b812f463c1dcf0b644956bddcc32e278e24a26dbb408`
- citation_status: `{"machine_confirmed_openfda_reconciled_pending_clinician":33}`
- source_policy_use: `{"interaction-counterevidence":3,"interaction-evidence":30}`
- source policy: `openfda-labels` / `CC0-1.0`

### ciprofloxacin__polyvalent_cation — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-cipro-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — CIPRO tablets and oral suspension kit; labeler Bayer HealthCare Pharmaceuticals Inc. | regulator="FDA (United States)" | product="CIPRO tablets and oral suspension kit" | section: "2.4 Administration Instructions With Multivalent Cations; 7 Drug Interactions; 17 Patient Counseling Information (contradictory direction quarantined)"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22888dc7f9-ad9c-4c00-8d50-8ddfd9bd27c0%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=888dc7f9-ad9c-4c00-8d50-8ddfd9bd27c0
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`888dc7f9-ad9c-4c00-8d50-8ddfd9bd27c0` | version=`32` | effective_time=`20260302`
- canonical payload: sha256 `02d394aa039baecfa5623f4e14847b49188ee237b3557fdf105fa68b5336cb19` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-03-02 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-03-04
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Named oral multivalent-cation products reduce ciprofloxacin absorption; section 2.4 directs administration of CIPRO at least 2 hours before or 6 hours after them. A contradictory section 17 counseling sentence reverses the administration subject and is quarantined from timing support.
- interaction_exists: `true`
- source_effect: `["decreased_ciprofloxacin_absorption","lower_serum_and_urine_ciprofloxacin_levels"]`
- label_action: `["administer_cipro_at_least_2_hours_before_or_6_hours_after_named_products"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"CIPRO tablets and oral suspension kit","source_routes":["oral"],"source_formulations":["immediate-release tablet","oral suspension"],"source_named_members":["magnesium/aluminum antacids","sucralfate","iron-containing metal cations","zinc-containing multivitamins","calcium-containing products"],"runtime_members":["calcium carbonate","calcium","magnesium hydroxide","aluminium hydroxide","ferrous sulfate","iron","zinc","sucralfate","magnesium"],"runtime_class":"polyvalent_cation","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Bare calcium, iron, magnesium and salt aliases are terminology expansions.
  - Section 17 says the named cation products should be taken before or after CIPRO, reversing the subject used in section 2.4; that counseling sentence is quarantined and does not support the runtime timing.
  - Dairy alone differs from dairy in a meal; enteral feeds and intravenous ciprofloxacin are not supported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- source discrepancies:
  - `quarantined_from_timing_support`: Inform patients that antacids containing magnesium, or aluminum, as well as sucralfate, metal cations such as iron, and multivitamin preparations with zinc or didanosine should be taken at least two hours before or six hours after CIPRO administration.
- fragments:
  - [7 Drug Interactions] (path `drug_interactions[0]`; sha256 5ac04d5a0aeae6a132a26edb5245ae8386686636fea1ca0bb8df8db31c20fb33) "Decrease CIPRO absorption, resulting in lower serum and urine levels"
  - [2.4 Administration Instructions With Multivalent Cations] (path `dosage_and_administration[0]`; sha256 1d4535eff1d8191547141d8c520b40ebd4d6889202b716a8306afb458b367b15) "Administer CIPRO at least 2 hours before or 6 hours after magnesium/aluminum antacids; polymeric phosphate binders (for example, sevelamer, lanthanum carbonate) or sucralfate; Videx ® (didanosine) chewable/buffered tablets or pediatric powder for oral solution; other highly buffered drugs; or other products containing calcium, iron or zinc."

### levofloxacin__polyvalent_cation — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-levofloxacin-tablets-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — levofloxacin tablets; labeler Lupin Pharmaceuticals, Inc. | regulator="FDA (United States)" | product="levofloxacin tablets" | section: "2.4 Drug Interaction With Chelation Agents; 7.1 Chelation Agents"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%224be13bd5-0c39-43c3-9232-b1226ccd4dbc%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4be13bd5-0c39-43c3-9232-b1226ccd4dbc
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`4be13bd5-0c39-43c3-9232-b1226ccd4dbc` | version=`25` | effective_time=`20240710`
- canonical payload: sha256 `cd8d76ec5344887c2f90ad70a603e3353c4528283eb7364b985fd9016681241d` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-07-10 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2024-07-16
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Named chelation agents can lower oral levofloxacin tablet exposure; tablets are administered at least 2 hours before or after them.
- interaction_exists: `true`
- source_effect: `["interference_with_gastrointestinal_levofloxacin_absorption","systemic_levofloxacin_levels_considerably_lower_than_desired"]`
- label_action: `["administer_tablets_at_least_2_hours_before_or_2_hours_after_named_agents"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"levofloxacin tablets","source_routes":["oral"],"source_formulations":["immediate-release tablet"],"source_named_members":["magnesium/aluminum antacids","sucralfate","iron-containing metal cations","zinc-containing multivitamins"],"runtime_members":["magnesium hydroxide","magnesium","aluminium hydroxide","ferrous sulfate","iron","zinc","sucralfate"],"runtime_class":"polyvalent_cation","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Calcium products and unbuffered didanosine are not supported; bare magnesium and iron are terminology expansions.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [2.4 Drug Interaction With Chelation Agents] (path `dosage_and_administration[0]`; sha256 eb99999ecfbd51926d9bad9eb84eb2d3baac8ec8c6c1988e9a1f12cc2d273d23) "Levofloxacin tablets should be administered at least two hours before or two hours after antacids containing magnesium, aluminum, as well as sucralfate, metal cations such as iron, and multivitamin preparations with zinc or didanosine chewable/buffered tablets or the pediatric powder for oral solution [see Drug Interactions ( 7.1 ) and Patient Counseling Information ( 17 )] ."
  - [7.1 Chelation Agents] (path `drug_interactions[0]`; sha256 32a91eda85f1761d96fda83bee07246993e8aee474b9dc627438fb49761552e7) "These agents should be taken at least two hours before or two hours after oral levofloxacin administration."

### levofloxacin__polyvalent_cation — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-levofloxacin-solution-2025`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — levofloxacin oral solution; labeler Lannett Company, Inc. | regulator="FDA (United States)" | product="levofloxacin oral solution" | section: "2.4 Drug Interaction With Chelation Agents"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22362fb864-3afb-4841-a7c4-b64b1346aba0%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=362fb864-3afb-4841-a7c4-b64b1346aba0
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`362fb864-3afb-4841-a7c4-b64b1346aba0` | version=`29` | effective_time=`20250901`
- canonical payload: sha256 `e6976f03cdc2ce9a5db5d0b2db2da679b4045ddd735e5e128525067c460af364` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2025-09-01 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-06-04
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: The same 2-hour-before or 2-hour-after schedule is stated specifically for levofloxacin oral solution.
- interaction_exists: `true`
- source_effect: `["interference_with_gastrointestinal_levofloxacin_oral_solution_absorption"]`
- label_action: `["administer_oral_solution_at_least_2_hours_before_or_2_hours_after_named_agents"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"levofloxacin oral solution","source_routes":["oral"],"source_formulations":["oral solution"],"source_named_members":["magnesium/aluminum antacids","sucralfate","iron-containing metal cations","zinc-containing multivitamins"],"runtime_members":["magnesium hydroxide","magnesium","aluminium hydroxide","ferrous sulfate","iron","zinc","sucralfate"],"runtime_class":"polyvalent_cation","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This source does not support intravenous levofloxacin, calcium products, or unbuffered didanosine.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [2.4 Drug Interaction With Chelation Agents] (path `dosage_and_administration[0]`; sha256 8bf2f39e591f81ead4393c5302c9c71a99d215f800f9ca5cae360aa7c0f40cd0) "Levofloxacin oral solution should be administered at least two hours before or two hours after antacids containing magnesium, aluminum, as well as sucralfate, metal cations such as iron, and multivitamin preparations with zinc or didanosine chewable/buffered tablets or the pediatric powder for oral solution [see Drug Interactions ( 7.1 ) and Patient Counseling Information ( 17 )] ."

### moxifloxacin__polyvalent_cation — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-moxifloxacin-tablets-2025`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — moxifloxacin hydrochloride tablets; labeler Aurobindo Pharma Limited | regulator="FDA (United States)" | product="moxifloxacin hydrochloride tablets" | section: "2.2 Important Administration Instructions; 12.3 Pharmacokinetics"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22d6789c17-4a2f-4519-9060-e3b0dba422f0%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d6789c17-4a2f-4519-9060-e3b0dba422f0
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`d6789c17-4a2f-4519-9060-e3b0dba422f0` | version=`17` | effective_time=`20250901`
- canonical payload: sha256 `c750540abcbb57b167292148f96fac850c039ca7be99bd2b4661e646d010546b` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2025-09-01 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2025-09-12
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Moxifloxacin tablets are administered at least 4 hours before or 8 hours after named cation products; calcium showed no significant AUC effect.
- interaction_exists: `true`
- source_effect: `["substantially_interfered_moxifloxacin_absorption","systemic_moxifloxacin_concentrations_considerably_lower_than_desired"]`
- label_action: `["administer_moxifloxacin_at_least_4_hours_before_or_8_hours_after_named_products"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"moxifloxacin hydrochloride tablets","source_routes":["oral"],"source_formulations":["immediate-release tablet"],"source_named_members":["magnesium","aluminum","iron","zinc","sucralfate"],"runtime_members":["magnesium hydroxide","magnesium","aluminium hydroxide","ferrous sulfate","iron","zinc","sucralfate"],"runtime_class":"polyvalent_cation","requires_clinician_class_mapping":true,"source_excluded_member":"calcium"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Calcium is outside this rule; bare magnesium and iron are terminology expansions; intravenous moxifloxacin is not supported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [2.2 Important Administration Instructions] (path `dosage_and_administration[0]`; sha256 ac82c1b69a5c2d0632488dd59ead04128f3900fdc200bec7192a32eb1ba42b8a) "Administer moxifloxacin tablets at least 4 hours before or 8 hours after products containing magnesium, aluminum, iron or zinc, including antacids, sucralfate, multivitamins and didanosine buffered tablets for oral suspension or the pediatric powder for oral solution [see Drug Interactions (7.1) and Clinical Pharmacology (12.3) ]."
  - [12.3 Pharmacokinetics] (path `pharmacokinetics[0]`; sha256 ca5aaa9d8b33b0f0df469b3b8ac3ed549b3d76669a08036e938f9fb0680710af) "Calcium had no significant effect on the mean AUC of moxifloxacin."

### doxycycline__polyvalent_cation — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-doxycycline-hyclate-ir-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — doxycycline hyclate immediate-release capsules and tablets; labeler Sun Pharmaceutical Industries, Inc. | regulator="FDA (United States)" | product="doxycycline hyclate immediate-release capsules and tablets" | section: "Drug Interactions"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22214a9cfe-a522-4022-81d4-e59f447401fe%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=214a9cfe-a522-4022-81d4-e59f447401fe
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`214a9cfe-a522-4022-81d4-e59f447401fe` | version=`24` | effective_time=`20260603`
- canonical payload: sha256 `1062a0226e15a0fd96bb1d285932684b7a8a8543d006dc21798e5c7c4db3a29f` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-06-03 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-06-04
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Named antacids, iron preparations and bismuth impair immediate-release doxycycline/tetracycline absorption; no numeric interval is stated.
- interaction_exists: `true`
- source_effect: `["impaired_tetracycline_absorption"]`
- label_action: `[]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"doxycycline hyclate immediate-release capsules and tablets","source_routes":["oral"],"source_formulations":["immediate-release capsule","immediate-release tablet"],"source_named_members":["aluminum/calcium/magnesium antacids","iron preparations","bismuth subsalicylate"],"runtime_members":["calcium carbonate","calcium","magnesium hydroxide","magnesium","aluminium hydroxide","ferrous sulfate","iron","bismuth subsalicylate"],"runtime_class":"polyvalent_cation","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The label supplies no numeric separation action; zinc, sucralfate and generic dairy avoidance are not supported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [Drug Interactions] (path `drug_interactions[0]`; sha256 c0ce8b9b53669deb9fda50c26e9f628a8005eca31d3a77e356111f66181201fe) "Absorption of tetracyclines is impaired by antacids containing aluminum, calcium, or magnesium, and iron-containing preparations."
  - [Drug Interactions] (path `drug_interactions[0]`; sha256 8d0b74ca956eab0857249b172a7d1f0a2ee48bb9576a57bcf10679d503f13ef2) "Absorption of tetracyclines is impaired by bismuth subsalicylate."

### doxycycline__polyvalent_cation — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-doryx-mpc-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — DORYX MPC delayed-release tablets; labeler Mayne Pharma Commercial LLC | regulator="FDA (United States)" | product="DORYX MPC delayed-release tablets" | section: "7.3 Antacids and Iron Preparations"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22f9277bb8-982d-444d-9325-35d5c53a2d35%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f9277bb8-982d-444d-9325-35d5c53a2d35
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`f9277bb8-982d-444d-9325-35d5c53a2d35` | version=`15` | effective_time=`20260216`
- canonical payload: sha256 `2c29a6d220108ddfdcef3f189b656a315b2e6a3ac749947475122a86a6378c20` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-02-16 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-02-18
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: DORYX MPC has the same named absorption effect without a numeric interval.
- interaction_exists: `true`
- source_effect: `["impaired_doryx_mpc_absorption"]`
- label_action: `[]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"DORYX MPC delayed-release tablets","source_routes":["oral"],"source_formulations":["delayed-release tablet"],"source_named_members":["aluminum/calcium/magnesium antacids","iron preparations","bismuth subsalicylate"],"runtime_members":["calcium carbonate","calcium","magnesium hydroxide","magnesium","aluminium hydroxide","ferrous sulfate","iron","bismuth subsalicylate"],"runtime_class":"polyvalent_cation","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The label supplies no numeric separation recommendation and does not establish every other doxycycline formulation.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.3 Antacids and Iron Preparations] (path `drug_interactions[0]`; sha256 3b0cda803f9040a088a61350c6a49955fc9739669c5bbec82c3911fd17ef42b7) "Absorption of tetracyclines including DORYX MPC is impaired by antacids containing aluminum, calcium, or magnesium, bismuth subsalicylate, and iron-containing preparations."

### levothyroxine__oral_cation_binder — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-synthroid-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — SYNTHROID tablets; labeler AbbVie Inc. | regulator="FDA (United States)" | product="SYNTHROID tablets" | section: "7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%221e11ad30-1041-4520-10b0-8f9d30d30fcc%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1e11ad30-1041-4520-10b0-8f9d30d30fcc
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`1e11ad30-1041-4520-10b0-8f9d30d30fcc` | version=`1537` | effective_time=`20240220`
- canonical payload: sha256 `ffa8db465afb210c22f2129b0e09acea8b20926d64bc551176935296fd0bf673` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-02-20 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2024-02-29
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: SYNTHROID phosphate binders may bind levothyroxine and are administered at least 4 hours apart.
- interaction_exists: `true`
- source_effect: `["phosphate_binders_may_bind_levothyroxine"]`
- label_action: `["administer_synthroid_at_least_4_hours_apart_from_named_phosphate_binders"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"SYNTHROID tablets","source_routes":["oral"],"source_formulations":["tablet"],"source_named_members":["calcium carbonate","ferrous sulfate","sevelamer","lanthanum"],"runtime_members":["calcium carbonate","calcium","ferrous sulfate","iron","aluminium hydroxide","magnesium hydroxide","magnesium","sevelamer","lanthanum carbonate","sucralfate"],"runtime_class":"oral_cation_binder","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This sentence does not assign the same interval to sucralfate or every antacid entry; aliases require mapping.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics] (path `drug_interactions[0]`; sha256 6dc50c424df92ed59859a938373d68e911f55286bfb4a42e2e1d81397f35265b) "Phosphate Binders (e.g., calcium carbonate, ferrous sulfate, sevelamer, lanthanum) Phosphate binders may bind to levothyroxine. Administer SYNTHROID at least 4 hours apart from these agents."

### levothyroxine__oral_cation_binder — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-tirosint-capsules-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — TIROSINT capsules; labeler IBSA Pharma Inc. | regulator="FDA (United States)" | product="TIROSINT capsules" | section: "7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%227a7ade79-0165-4e31-b84e-667416c00c7e%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7a7ade79-0165-4e31-b84e-667416c00c7e
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`7a7ade79-0165-4e31-b84e-667416c00c7e` | version=`13` | effective_time=`20260325`
- canonical payload: sha256 `fceb2f7d5ccdcddd3f824d69c58fba88aa9e9da0114083158da1aca33e2c8106` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-03-25 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-03-27
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: TIROSINT calcium carbonate and ferrous sulfate form complexes with levothyroxine and are administered at least 4 hours apart.
- interaction_exists: `true`
- source_effect: `["calcium_or_iron_complex_formation_with_levothyroxine"]`
- label_action: `["administer_tirosint_at_least_4_hours_apart_from_calcium_carbonate_or_ferrous_sulfate"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"TIROSINT capsules","source_routes":["oral"],"source_formulations":["capsule"],"source_named_members":["calcium carbonate","ferrous sulfate"],"runtime_members":["calcium carbonate","calcium","ferrous sulfate","iron","aluminium hydroxide","magnesium hydroxide","magnesium","sevelamer","lanthanum carbonate","sucralfate"],"runtime_class":"oral_cation_binder","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This capsule sentence does not prove one interval for every other binder; aliases require mapping.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics] (path `drug_interactions[0]`; sha256 fc6cb41828094956df2206a462e9273f2425a536bb18d4fbbfe45ef969d513fc) "Calcium carbonate may form an insoluble chelate with levothyroxine, and ferrous sulfate likely forms a ferric-thyroxine complex. Administer TIROSINT at least 4 hours apart from these agents."

### levothyroxine__oral_cation_binder — evidence[2] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-tirosint-sol-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — TIROSINT-SOL oral solution; labeler IBSA Pharma Inc. | regulator="FDA (United States)" | product="TIROSINT-SOL oral solution" | section: "2.1 General Administration Information; 7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%225d378add-f13d-40f2-99dc-0f2340ab44b7%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5d378add-f13d-40f2-99dc-0f2340ab44b7
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`5d378add-f13d-40f2-99dc-0f2340ab44b7` | version=`18` | effective_time=`20260327`
- canonical payload: sha256 `043dda85e62c2e8f90d8b0c4360cabf0b1ad6c6cf323411ba0888d1882c7af0d` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-03-27 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-03-30
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: TIROSINT-SOL is separated by at least 4 hours from absorption-interfering drugs and phosphate binders.
- interaction_exists: `true`
- source_effect: `["absorption_interference_with_tirosint_sol","phosphate_binders_may_bind_levothyroxine_oral_solution"]`
- label_action: `["administer_tirosint_sol_at_least_4_hours_before_or_after_absorption_interfering_drugs"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"TIROSINT-SOL oral solution","source_routes":["oral"],"source_formulations":["oral solution"],"source_named_members":["calcium carbonate","ferrous sulfate","sevelamer","lanthanum","sucralfate","aluminum/magnesium antacids"],"runtime_members":["calcium carbonate","calcium","ferrous sulfate","iron","aluminium hydroxide","magnesium hydroxide","magnesium","sevelamer","lanthanum carbonate","sucralfate"],"runtime_class":"oral_cation_binder","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The broad instruction does not prove identical interaction magnitude for every member; aliases require mapping.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [2.1 General Administration Information] (path `dosage_and_administration[0]`; sha256 38e3dbd20b60e7d5d2c16ab45a9be09ae7ba67bc3c8e2019256dae65d8c82298) "Administer TIROSINT-SOL at least 4 hours before or after drugs known to interfere with TIROSINT-SOL absorption [see Drug Interactions (7.1)] ."
  - [7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics] (path `drug_interactions[0]`; sha256 06715340c979637877ff7045b2dfb5032884595afb3cd25994968347258f94c7) "Phosphate binders may bind to levothyroxine. Administer TIROSINT-SOL at least 4 hours apart from these agents."

### levothyroxine__acid_suppressant — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-synthroid-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — SYNTHROID tablets; labeler AbbVie Inc. | regulator="FDA (United States)" | product="SYNTHROID tablets" | section: "7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%221e11ad30-1041-4520-10b0-8f9d30d30fcc%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1e11ad30-1041-4520-10b0-8f9d30d30fcc
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`1e11ad30-1041-4520-10b0-8f9d30d30fcc` | version=`1537` | effective_time=`20240220`
- canonical payload: sha256 `ffa8db465afb210c22f2129b0e09acea8b20926d64bc551176935296fd0bf673` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-02-20 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2024-02-29
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: The SYNTHROID tablet label says PPIs can raise gastric pH, reduce absorption, and require monitoring.
- interaction_exists: `true`
- source_effect: `["hypochlorhydria_and_intragastric_ph_change","reduced_levothyroxine_absorption"]`
- label_action: `["monitor_patients_appropriately"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"SYNTHROID tablets","source_routes":["oral"],"source_formulations":["tablet"],"source_named_members":["proton pump inhibitors"],"runtime_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole"],"runtime_class":"proton_pump_inhibitor","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - No numeric monitoring interval, spacing remedy, oral-solution extrapolation, or H2 membership is supported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics] (path `drug_interactions[0]`; sha256 7d15d984915ada00e9de1dd8b463e580f697151145aa2146b97633672c7a7aae) "Sucralfate, antacids and proton pump inhibitors may cause hypochlorhydria, affect intragastric pH, and reduce levothyroxine absorption. Monitor patients appropriately."

### levothyroxine__acid_suppressant — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-tirosint-capsules-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — TIROSINT capsules; labeler IBSA Pharma Inc. | regulator="FDA (United States)" | product="TIROSINT capsules" | section: "7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%227a7ade79-0165-4e31-b84e-667416c00c7e%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7a7ade79-0165-4e31-b84e-667416c00c7e
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`7a7ade79-0165-4e31-b84e-667416c00c7e` | version=`13` | effective_time=`20260325`
- canonical payload: sha256 `fceb2f7d5ccdcddd3f824d69c58fba88aa9e9da0114083158da1aca33e2c8106` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-03-25 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-03-27
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: The TIROSINT capsule label identifies gastric acidity as essential and PPIs as absorption-interfering drugs requiring monitoring.
- interaction_exists: `true`
- source_effect: `["gastric_acidity_required_for_levothyroxine_absorption","ppi_related_reduction_in_levothyroxine_absorption"]`
- label_action: `["monitor_patients_appropriately"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"TIROSINT capsules","source_routes":["oral"],"source_formulations":["capsule"],"source_named_members":["proton pump inhibitors"],"runtime_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole"],"runtime_class":"proton_pump_inhibitor","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - No numeric monitoring interval or spacing remedy is supplied; TIROSINT-SOL reports no clinically significant omeprazole PK difference and is excluded; H2 membership is unsupported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics] (path `drug_interactions[0]`; sha256 3839566b53ee973122e8cffde397ff3548447fda3880812adb44bd7a195eb66b) "Other drugs: Proton Pump Inhibitors Sucralfate Antacids - Aluminum & Magnesium Hydroxides - Simethicone Gastric acidity is an essential requirement for adequate absorption of levothyroxine."
  - [7.1 Drugs Known to Affect Thyroid Hormone Pharmacokinetics] (path `drug_interactions[0]`; sha256 7356c2ab535dbfb282c3dab102c7f063cbf1c9e3ab8157921b3cfc45ed5ef43e) "Sucralfate, antacids and proton pump inhibitors may cause hypochlorhydria, affect intragastric pH, and reduce levothyroxine absorption. Monitor patients appropriately"

### levothyroxine__acid_suppressant — evidence[2] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-tirosint-sol-omeprazole-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — TIROSINT-SOL oral solution; labeler IBSA Pharma Inc. | regulator="FDA (United States)" | product="TIROSINT-SOL oral solution" | section: "12.3 Pharmacokinetics — Drug Interaction Study"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%225d378add-f13d-40f2-99dc-0f2340ab44b7%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5d378add-f13d-40f2-99dc-0f2340ab44b7
- policy: source=`openfda-labels` | use=`interaction-counterevidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`5d378add-f13d-40f2-99dc-0f2340ab44b7` | version=`18` | effective_time=`20260327`
- canonical payload: sha256 `043dda85e62c2e8f90d8b0c4360cabf0b1ad6c6cf323411ba0888d1882c7af0d` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-03-27 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-03-30
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: TIROSINT-SOL oral solution showed no clinically significant pharmacokinetic difference with omeprazole.
- interaction_exists: `false`
- source_effect: `["no_clinically_meaningful_effect"]`
- label_action: `[]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"TIROSINT-SOL oral solution","source_routes":["oral"],"source_formulations":["oral solution"],"source_named_members":["omeprazole"],"runtime_members":["omeprazole"],"runtime_class":"proton_pump_inhibitor","requires_clinician_class_mapping":false,"evidence_role":"product_specific_interaction_counterevidence"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This counterevidence supports only a no-clinically-meaningful-pharmacokinetic-effect finding for TIROSINT-SOL oral solution with omeprazole; it supplies no management action.
  - The omeprazole result is formulation- and product-specific and does not establish a no-effect class conclusion for every PPI or levothyroxine product.
  - No clinical-outcome conclusion or universal monitoring interval is supplied.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [12.3 Pharmacokinetics — Drug Interaction Study] (path `pharmacokinetics[0]`; sha256 e49900c30874c7824c32cec13cce1fac4758aaad26764d2f33e6e57db2d636ea) "No clinically significant differences in TIROSINT-SOL pharmacokinetics were observed when orally coadministered with omeprazole."

### alendronate__oral_cation_food — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-fosamax-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — FOSAMAX tablets and oral solution; labeler Organon LLC | regulator="FDA (United States)" | product="FOSAMAX tablets and oral solution" | section: "2.6 Important Administration Instructions; 7.1 Calcium Supplements/Antacids"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%2214e931fd-2c5f-4d90-b7db-5980706f4a56%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=14e931fd-2c5f-4d90-b7db-5980706f4a56
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`14e931fd-2c5f-4d90-b7db-5980706f4a56` | version=`10` | effective_time=`20260312`
- canonical payload: sha256 `08a59683c15d6a80999e5f289fc22bd841af07afd65f271c36eabcfc82827e3b` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-03-12 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-03-16
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: FOSAMAX is taken with plain water at least 30 minutes before first food, beverage or medication; cations interfere with absorption.
- interaction_exists: `true`
- source_effect: `["interference_with_fosamax_absorption"]`
- label_action: `["take_fosamax_at_least_30_minutes_before_first_food_beverage_or_medication","use_plain_water_only","wait_at_least_30_minutes_before_other_oral_medicines"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"FOSAMAX tablets and oral solution","source_routes":["oral"],"source_formulations":["tablet","oral solution"],"source_named_members":["calcium","antacids","multivalent-cation oral medicines","food/beverages other than plain water"],"runtime_members":["calcium carbonate","calcium","ferrous sulfate","iron","magnesium","magnesium hydroxide","aluminium hydroxide","milk"],"runtime_class":"oral_cation_food","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Milk is food context, salt aliases require mapping, and effervescent/intravenous products are unsupported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [2.6 Important Administration Instructions] (path `dosage_and_administration[0]`; sha256 ad15c0eecde3bc020984734351dfb71bb9a42eb76cf8184b70533fa778ce5eda) "Take FOSAMAX at least one-half hour before the first food, beverage, or medication of the day with plain water only [see Patient Counseling Information (17) ]."
  - [7.1 Calcium Supplements/Antacids] (path `drug_interactions[0]`; sha256 101621af349bd6dc7866f72a985c1228848dd8123bc9e2f4c1e30a06d6cd65a3) "Co-administration of FOSAMAX and calcium, antacids, or oral medications containing multivalent cations will interfere with absorption of FOSAMAX."

### risedronate_immediate_release__oral_cation_food — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-actonel-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — ACTONEL immediate-release tablets; labeler Allergan, Inc., distributed by AbbVie Inc. | regulator="FDA (United States)" | product="ACTONEL immediate-release tablets" | section: "2.6 Important Administration Instructions; 2.7 Calcium and Vitamin D Supplementation"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%2224ed00e0-25e2-49a8-97fc-66c1b417dc0b%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=24ed00e0-25e2-49a8-97fc-66c1b417dc0b
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`24ed00e0-25e2-49a8-97fc-66c1b417dc0b` | version=`31` | effective_time=`20260204`
- canonical payload: sha256 `688e3ee51a4aa387dc2edf6f901710dc90938f50773303caa20ab4113351342b` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-02-04 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-05-11
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: ACTONEL is taken at least 30 minutes before first food/drink and medicines; named cations are taken at another time.
- interaction_exists: `true`
- source_effect: `["interference_with_actonel_absorption"]`
- label_action: `["take_actonel_at_least_30_minutes_before_first_food_drink_or_oral_medicine","take_named_cations_at_a_different_time_of_day"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"ACTONEL immediate-release tablets","source_routes":["oral"],"source_formulations":["immediate-release tablet"],"source_named_members":["calcium supplements","antacids","magnesium products","iron preparations","food/drink other than water"],"runtime_members":["calcium carbonate","calcium","ferrous sulfate","iron","magnesium","magnesium hydroxide","aluminium hydroxide","milk"],"runtime_class":"oral_cation_food","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This does not support delayed-release risedronate; milk is food context and salt aliases require mapping.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [2.6 Important Administration Instructions] (path `dosage_and_administration[0]`; sha256 b3556a468779fdc2c67dec71e7fb33b2f5bf86ed94d104f976f38259c00ad6a4) "Take ACTONEL at least 30 minutes before the first food or drink of the day other than water, and before taking any oral medication or supplementation, including calcium, antacids, or vitamins to maximize absorption and clinical benefit, [ see Drug Interactions ( 7.1 ) ] ."
  - [2.7 Calcium and Vitamin D Supplementation] (path `dosage_and_administration[0]`; sha256 364aeac0caeb6dfc8ab20e36b0bd05085d6e677319fb9beb432da46aff60a861) "Instruct patients to take supplemental calcium and vitamin D if their dietary intake is inadequate; and to take calcium supplements, antacids, magnesium-based supplements or laxatives, and iron preparations at a different time of the day as they interfere with the absorption of ACTONEL."

### risedronate_delayed_release__oral_cation_food — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-atelvia-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — ATELVIA delayed-release tablets; labeler Allergan, Inc., distributed by AbbVie Inc. | regulator="FDA (United States)" | product="ATELVIA delayed-release tablets" | section: "2.2 Important Administration Instructions; 2.3 Calcium and Vitamin D Supplementation"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22c8b9ab88-1a26-46c3-80ec-4eaa45202021%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c8b9ab88-1a26-46c3-80ec-4eaa45202021
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`c8b9ab88-1a26-46c3-80ec-4eaa45202021` | version=`29` | effective_time=`20260203`
- canonical payload: sha256 `e1b00f4becb916bd8c37f331ee5dde4da7356ac70484b4ba7f8c7bd58e78e33b` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-02-03 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-05-20
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: ATELVIA is taken immediately after breakfast; named cations are taken at another time.
- interaction_exists: `true`
- source_effect: `["interference_with_atelvia_absorption"]`
- label_action: `["take_atelvia_immediately_after_breakfast","take_named_cations_at_a_different_time_of_day"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"ATELVIA delayed-release tablets","source_routes":["oral"],"source_formulations":["delayed-release tablet"],"source_named_members":["calcium supplements","antacids","magnesium products","iron preparations"],"runtime_members":["calcium carbonate","calcium","ferrous sulfate","iron","magnesium","magnesium hydroxide","aluminium hydroxide"],"runtime_class":"oral_cation_food","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - No numeric cation interval is supplied; milk is excluded because breakfast is required; immediate-release risedronate is unsupported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [2.2 Important Administration Instructions] (path `dosage_and_administration[0]`; sha256 04e6893322b7eef7c3e932382957f166a9b21e37b9f550f31d17526f7e1005bc) "Take Atelvia in the morning immediately following breakfast."
  - [2.3 Calcium and Vitamin D Supplementation] (path `dosage_and_administration[0]`; sha256 ec1d6363f9a7de8732301cc7f6728f75cabaeab4f206706d7e5722f0de6a13e8) "Instruct patients to take supplemental calcium and vitamin D if dietary intake is inadequate [ see Warnings and Precautions (5.3) ] and to take calcium supplements, antacids, magnesium-based supplements or laxatives, and iron preparations at a different time of the day as they interfere with the absorption of Atelvia."

### ibandronate__oral_cation_food — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-ibandronate-tablets-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — ibandronate sodium tablets; labeler Dr. Reddy's Laboratories Limited | regulator="FDA (United States)" | product="ibandronate sodium tablets" | section: "2.2 Important Administration Instructions; 7.1 Calcium Supplements/Antacids"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22f94d9c49-245a-8081-42c4-785113fce498%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f94d9c49-245a-8081-42c4-785113fce498
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`f94d9c49-245a-8081-42c4-785113fce498` | version=`24` | effective_time=`20260216`
- canonical payload: sha256 `c92452d6b6e974e6c9c3970080317b1ec2ddc8267a06b76707232a138ac9ed5a` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-02-16 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-06-15
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Oral ibandronate is taken at least 60 minutes before first food/drink or medicines; multivalent cations interfere with absorption.
- interaction_exists: `true`
- source_effect: `["interference_with_ibandronate_absorption"]`
- label_action: `["take_ibandronate_at_least_60_minutes_before_first_food_drink_or_oral_medicine","wait_at_least_60_minutes_after_dosing_before_other_oral_medicines"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"ibandronate sodium tablets","source_routes":["oral"],"source_formulations":["tablet"],"source_named_members":["calcium","aluminum","magnesium","iron","antacids","milk as food"],"runtime_members":["calcium carbonate","calcium","ferrous sulfate","iron","magnesium","magnesium hydroxide","aluminium hydroxide","milk"],"runtime_class":"oral_cation_food","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Milk is food context, salt aliases require mapping, and intravenous ibandronate is unsupported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [2.2 Important Administration Instructions] (path `dosage_and_administration[0]`; sha256 78d37961f5643a2957b0f9bbec55b6931b2effb73b4ca883fbeeddd8fdab7663) "Take ibandronate sodium tablets at least 60 minutes before the first food or drink (other than water) of the day or before taking any oral medication or supplementation, including calcium, antacids, or vitamins to maximize absorption and clinical benefit, (see Drug Interactions [7.1] )."
  - [7.1 Calcium Supplements/Antacids] (path `drug_interactions[0]`; sha256 42405a6bb3567760c1ae9e3d9b56e3639a84834c8986abc18ea8f69cee01438d) "Products containing calcium and other multivalent cations (such as aluminum, magnesium, iron) are likely to interfere with absorption of ibandronate sodium."

### atazanavir__proton_pump_inhibitor — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-reyataz-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — REYATAZ capsules and oral powder; labeler E.R. Squibb & Sons, L.L.C. | regulator="FDA (United States)" | product="REYATAZ capsules and oral powder" | section: "7.3 Established and Other Potentially Significant Drug Interactions"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22165cff62-b284-4a27-a65d-9ec8a5bfcdd8%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=165cff62-b284-4a27-a65d-9ec8a5bfcdd8
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`165cff62-b284-4a27-a65d-9ec8a5bfcdd8` | version=`37` | effective_time=`20241205`
- canonical payload: sha256 `bbb46854dc4a72233b7ab1692b6c942c9b668a10685851a41f6800d260eac85e` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-12-05 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2025-07-18
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: REYATAZ PPI management branches on history, ritonavir, regimen, PPI equivalence and timing.
- interaction_exists: `true`
- source_effect: `["reduced_atazanavir_exposure","loss_of_virologic_response_and_resistance_risk"]`
- label_action: `["limit_ppi_to_omeprazole_20_mg_equivalent_in_treatment_naive_adults","take_ppi_about_12_hours_before_reyataz_300_mg_plus_ritonavir_100_mg","ppi_coadministration_not_recommended_in_treatment_experienced_adults"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"REYATAZ capsules and oral powder","source_routes":["oral"],"source_formulations":["capsule","oral powder"],"source_named_members":["proton-pump inhibitors","omeprazole dose-equivalence anchor"],"runtime_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole"],"runtime_class":"proton_pump_inhibitor","requires_clinician_class_mapping":true,"required_patient_context":["treatment history","ritonavir booster","regimen and dose","PPI dose equivalence"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - No blanket action spans all branches; non-omeprazole members require class and dose-equivalence mapping.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.3 Established and Other Potentially Significant Drug Interactions] (path `drug_interactions[0]`; sha256 e456c09c719a39f63f829ea62e9c36a0026d908175a36a11822e209f2c27fbe6) "Coadministration of REYATAZ with or without ritonavir and omeprazole may result in loss of virologic response and development of resistance."
  - [7.3 Established and Other Potentially Significant Drug Interactions] (path `drug_interactions[0]`; sha256 c097b398dc83a3c4840771ffa757c1f21c04f041dea53e987432129eb320d643) "In HIV-treatment-naive adult patients: The proton-pump inhibitor (PPI) dose should not exceed a dose comparable to omeprazole 20 mg and must be taken approximately 12 hours prior to the REYATAZ 300 mg with ritonavir 100 mg dose."
  - [7.3 Established and Other Potentially Significant Drug Interactions] (path `drug_interactions[0]`; sha256 3ee95b87547455764821f63edb73f55ce2840ff01215a5505186611e729f7eeb) "In HIV-treatment-experienced adult patients: Coadministration of REYATAZ with PPIs is not recommended."

### atazanavir__h2_receptor_antagonist — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-reyataz-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — REYATAZ capsules and oral powder; labeler E.R. Squibb & Sons, L.L.C. | regulator="FDA (United States)" | product="REYATAZ capsules and oral powder" | section: "7.2 Potential for Other Drugs to Affect REYATAZ; 7.3 Established and Other Potentially Significant Drug Interactions"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22165cff62-b284-4a27-a65d-9ec8a5bfcdd8%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=165cff62-b284-4a27-a65d-9ec8a5bfcdd8
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`165cff62-b284-4a27-a65d-9ec8a5bfcdd8` | version=`37` | effective_time=`20241205`
- canonical payload: sha256 `bbb46854dc4a72233b7ab1692b6c942c9b668a10685851a41f6800d260eac85e` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-12-05 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2025-07-18
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: H2 antagonists lower atazanavir concentrations; exact treatment-naive boosted, treatment-naive unboosted, and treatment-experienced branches depend on booster, pregnancy, regimen, and famotidine equivalence.
- interaction_exists: `true`
- source_effect: `["reduced_atazanavir_plasma_concentrations","loss_of_virologic_response_and_resistance_risk"]`
- label_action: `["use_famotidine_equivalent_dose_limits","apply_treatment_naive_boosted_h2_schedule","apply_treatment_naive_unboosted_h2_schedule","apply_treatment_experienced_boosted_h2_schedule"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"REYATAZ capsules and oral powder","source_routes":["oral"],"source_formulations":["capsule","oral powder"],"source_named_members":["H2-receptor antagonists","famotidine dose-equivalence anchor"],"runtime_members":["famotidine","cimetidine","ranitidine","nizatidine"],"runtime_class":"h2_receptor_antagonist","requires_clinician_class_mapping":true,"required_patient_context":["treatment history","ritonavir booster","regimen and dose","H2 dose equivalence","pregnancy"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - No universal H2 dose/timing is supported; other members require class and dose-equivalence mapping.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.2 Potential for Other Drugs to Affect REYATAZ] (path `drug_interactions[0]`; sha256 10aed0244c0f2229089b687292f78a34a352329e62428a54ef1c4c57e87a987c) "Reduced plasma concentrations of atazanavir are expected if proton-pump inhibitors, antacids, buffered medications, or H 2 -receptor antagonists are administered with REYATAZ [see Dosage and Administration ( 2.3 , 2.4 , 2.5 and 2.6) ] ."
  - [7.3 Established and Other Potentially Significant Drug Interactions] (path `drug_interactions[0]`; sha256 7163dfe3d36badf3944dfc95345c2a6765da7e13836ed6559e921c43f3128c77) "REYATAZ 300 mg with ritonavir 100 mg once daily with food should be administered simultaneously with, and/or at least 10 hours after, a dose of the H 2 -receptor antagonist (H2RA)."
  - [7.3 Established and Other Potentially Significant Drug Interactions] (path `drug_interactions[0]`; sha256 0ee27ae4e07588c8e515fb2c40efb68d16c99de31890c5edcf99d48f79666550) "For patients unable to tolerate ritonavir, REYATAZ 400 mg once daily with food should be administered at least 2 hours before and at least 10 hours after a dose of the H2RA. No single dose of the H2RA should exceed a dose comparable to famotidine 20 mg, and the total daily dose should not exceed a dose comparable to famotidine 40 mg."
  - [7.3 Established and Other Potentially Significant Drug Interactions] (path `drug_interactions[0]`; sha256 a1d2be155fdcb216d172099242cccd47d8c30c24db542bdd29341b986da7a3cb) "Whenever an H2RA is given to a patient receiving REYATAZ with ritonavir, the H2RA dose should not exceed a dose comparable to famotidine 20 mg twice daily, and the REYATAZ with ritonavir doses should be administered simultaneously with, and/or at least 10 hours after, the dose of the H2RA."

### atazanavir__antacid_buffered_product — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-reyataz-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — REYATAZ capsules and oral powder; labeler E.R. Squibb & Sons, L.L.C. | regulator="FDA (United States)" | product="REYATAZ capsules and oral powder" | section: "7.3 Established and Other Potentially Significant Drug Interactions"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22165cff62-b284-4a27-a65d-9ec8a5bfcdd8%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=165cff62-b284-4a27-a65d-9ec8a5bfcdd8
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`165cff62-b284-4a27-a65d-9ec8a5bfcdd8` | version=`37` | effective_time=`20241205`
- canonical payload: sha256 `bbb46854dc4a72233b7ab1692b6c942c9b668a10685851a41f6800d260eac85e` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-12-05 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2025-07-18
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Antacids and buffered medicines lower atazanavir exposure; REYATAZ is given 2 hours before or 1 hour after.
- interaction_exists: `true`
- source_effect: `["reduced_atazanavir_exposure"]`
- label_action: `["administer_reyataz_2_hours_before_or_1_hour_after_antacids_or_buffered_medications"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"REYATAZ capsules and oral powder","source_routes":["oral"],"source_formulations":["capsule","oral powder"],"source_named_members":["antacids","buffered medications"],"runtime_members":["calcium carbonate","magnesium hydroxide","aluminium hydroxide","sodium bicarbonate"],"runtime_class":"antacid_buffered_product","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source names a class, not the four runtime ingredients; this interval does not apply to PPI/H2 branches.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.3 Established and Other Potentially Significant Drug Interactions] (path `drug_interactions[0]`; sha256 1b9c18c5d2ce909c13406824a6f42e9238b050cdb4b16463a28d1253c4f1f75a) "REYATAZ should be administered 2 hours before or 1 hour after antacids and buffered medications."

### rilpivirine__proton_pump_inhibitor — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-edurant-2025`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — EDURANT tablets and EDURANT PED tablets for suspension; labeler Janssen Products, LP | regulator="FDA (United States)" | product="EDURANT tablets and EDURANT PED tablets for suspension" | section: "4 Contraindications; 7 Drug Interactions"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%2203880372-2c68-45c6-a53a-f420c49541d6%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=03880372-2c68-45c6-a53a-f420c49541d6
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`03880372-2c68-45c6-a53a-f420c49541d6` | version=`28` | effective_time=`20250828`
- canonical payload: sha256 `4f39740e062e4f62ef6b525d189ba83a2b9dea6a3c67c3187cc3e47dec7ba7bc` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2025-08-28 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2025-09-01
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: PPIs are contraindicated with oral EDURANT products because gastric-pH elevation can lower rilpivirine and cause virologic failure.
- interaction_exists: `true`
- source_effect: `["significant_decrease_in_rilpivirine_plasma_concentrations","loss_of_virologic_response_and_resistance_risk"]`
- label_action: `["ppi_coadministration_contraindicated_with_edurant_or_edurant_ped"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"EDURANT tablets and EDURANT PED tablets for suspension","source_routes":["oral"],"source_formulations":["tablet","tablet for suspension"],"source_named_members":["esomeprazole","lansoprazole","omeprazole","pantoprazole","rabeprazole"],"runtime_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole"],"runtime_class":"proton_pump_inhibitor","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Dexlansoprazole needs the ODEFSEY source/class mapping; injectable rilpivirine is unsupported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [4 Contraindications] (path `contraindications[0]`; sha256 a873b224a1b95fa775d8e32a9631ea0e459688feef77822d9db3dff5a6ad4458) "Potential for significant decreases in rilpivirine plasma concentrations due to gastric pH increase, which may result in loss of virologic response."
  - [7 Drug Interactions] (path `drug_interactions[0]`; sha256 46b17b5240c7e596287a2f76d5dcde9929570f59e2f2482b27c513f6c2713f67) "Coadministration is contraindicated with EDURANT or EDURANT PED [see Contraindications (4) ] ."

### rilpivirine__proton_pump_inhibitor — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-odefsey-2025`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — ODEFSEY oral fixed-dose combination tablets; labeler Gilead Sciences, Inc. | regulator="FDA (United States)" | product="ODEFSEY oral fixed-dose combination tablets" | section: "4 Contraindications; 7.4 Drugs Increasing Gastric pH; 7.7 Significant Drug Interactions"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22ea3b9ec8-e04a-412c-8b3f-e5cbc7e641d5%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ea3b9ec8-e04a-412c-8b3f-e5cbc7e641d5
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`ea3b9ec8-e04a-412c-8b3f-e5cbc7e641d5` | version=`13` | effective_time=`20251202`
- canonical payload: sha256 `e2573b6bba708017c9b61e7a08a68de1ae674a9723beb44ea3cd2ef4679267ef` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2025-12-02 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2025-12-10
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: ODEFSEY names all six runtime PPIs and contraindicates coadministration because of virologic failure and resistance risk.
- interaction_exists: `true`
- source_effect: `["decreased_rilpivirine_exposure","loss_of_virologic_response_and_resistance_risk"]`
- label_action: `["ppi_coadministration_contraindicated_with_odefsey"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"ODEFSEY oral fixed-dose combination tablets","source_routes":["oral"],"source_formulations":["fixed-dose combination tablet"],"source_named_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole"],"runtime_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole"],"runtime_class":"proton_pump_inhibitor","requires_clinician_class_mapping":false}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This fixed-dose-combination evidence does not support injectable rilpivirine or automatic promotion.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.7 Significant Drug Interactions] (path `drug_interactions[0]`; sha256 e46039631df693f19d8d3940356843b1c7b6a71298f25b48b6ef010c78e0ffb0) "Proton Pump Inhibitors: e.g., dexlansoprazole, esomeprazole, lansoprazole, omeprazole, pantoprazole, rabeprazole ↓ RPV Coadministration is contraindicated due to potential for loss of virologic response and development of resistance."

### erlotinib__proton_pump_inhibitor — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-erlotinib-tablets-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — erlotinib tablets; labeler Alembic Pharmaceuticals Limited | regulator="FDA (United States)" | product="erlotinib tablets" | section: "2.4 Dose Modifications; 7 Drug Interactions"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22ab6f3cb3-34a8-4492-a5d7-fb6b055a2d6b%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ab6f3cb3-34a8-4492-a5d7-fb6b055a2d6b
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`ab6f3cb3-34a8-4492-a5d7-fb6b055a2d6b` | version=`3` | effective_time=`20240610`
- canonical payload: sha256 `b26b24a106ff7d3b745b6ad2d07c19ee8d01a3caa5fd0a969df41990982c5e77` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-06-10 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2024-06-12
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: PPIs decrease erlotinib exposure; separation may not eliminate sustained effects and use should be avoided if possible.
- interaction_exists: `true`
- source_effect: `["decreased_erlotinib_exposure"]`
- label_action: `["avoid_concomitant_ppi_use_if_possible","do_not_rely_on_spacing_to_eliminate_sustained_ppi_interaction"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"erlotinib tablets","source_routes":["oral"],"source_formulations":["tablet"],"source_named_members":["proton pump inhibitors","omeprazole"],"runtime_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole"],"runtime_class":"proton_pump_inhibitor","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Only omeprazole is named/studied; the roster requires class mapping; simple spacing is unsupported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7 Drug Interactions] (path `drug_interactions[0]`; sha256 60839323e441fc5651ec396390a3ae328b71c03c42f44d330a84df6a0bd1972d) "Co-administration of erlotinib with proton pump inhibitors (e.g., omeprazole) and H-2 receptor antagonists (e.g., ranitidine) decreased erlotinib exposure [see Clinical Pharmacology (12.3)] ."
  - [7 Drug Interactions] (path `drug_interactions[0]`; sha256 b16956425b1d2c4c38d3f79b46c382327aaf7d7f034804326e0c12a293af41ad) "For proton pump inhibitors, avoid concomitant use if possible."
  - [2.4 Dose Modifications] (path `dosage_and_administration[0]`; sha256 7eeacd7ccf1aa8b17dd9c988c64daf7b52d68a83db97420c83e7138d5584285b) "Separation of doses may not eliminate the interaction since proton pump inhibitors affect the pH of the upper GI tract for an extended period"

### erlotinib__h2_receptor_antagonist — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-erlotinib-tablets-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — erlotinib tablets; labeler Alembic Pharmaceuticals Limited | regulator="FDA (United States)" | product="erlotinib tablets" | section: "2.4 Dose Modifications; 12.3 Pharmacokinetics"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22ab6f3cb3-34a8-4492-a5d7-fb6b055a2d6b%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ab6f3cb3-34a8-4492-a5d7-fb6b055a2d6b
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`ab6f3cb3-34a8-4492-a5d7-fb6b055a2d6b` | version=`3` | effective_time=`20240610`
- canonical payload: sha256 `b26b24a106ff7d3b745b6ad2d07c19ee8d01a3caa5fd0a969df41990982c5e77` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-06-10 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2024-06-12
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: H2 antagonists reduce erlotinib exposure; erlotinib is taken 10 hours after and 2 hours before the next H2 dose.
- interaction_exists: `true`
- source_effect: `["decreased_erlotinib_exposure"]`
- label_action: `["take_erlotinib_10_hours_after_h2_and_at_least_2_hours_before_next_h2_dose"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"erlotinib tablets","source_routes":["oral"],"source_formulations":["tablet"],"source_named_members":["H2-receptor antagonists","ranitidine"],"runtime_members":["famotidine","cimetidine","ranitidine","nizatidine"],"runtime_class":"h2_receptor_antagonist","requires_clinician_class_mapping":true,"required_schedule_context":"H2 dosing frequency"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Ranitidine is directly named; other members need class mapping; dosing frequency is required.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [12.3 Pharmacokinetics] (path `pharmacokinetics[0]`; sha256 fbcfc029e4a9bf021922afe25fb33ca42639b6291e4b84c18de353b8abe1d7d3) "When erlotinib was administered 2 hours following a 300 mg dose of an H-2 receptor antagonist (ranitidine), the erlotinib AUC was reduced by 33% and the erlotinib C max was reduced by 54%."
  - [2.4 Dose Modifications] (path `dosage_and_administration[0]`; sha256 686d02d28ecb136d2f85a10cfbb7f7b0751f84cfb4d2bca1eb7a107258c678e4) "Erlotinib tablets must be taken 10 hours after the H 2 -receptor antagonist dosing and at least 2 hours before the next dose of the H 2 ­ receptor antagonist"

### erlotinib__antacid — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-erlotinib-tablets-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — erlotinib tablets; labeler Alembic Pharmaceuticals Limited | regulator="FDA (United States)" | product="erlotinib tablets" | section: "2.4 Dose Modifications"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22ab6f3cb3-34a8-4492-a5d7-fb6b055a2d6b%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ab6f3cb3-34a8-4492-a5d7-fb6b055a2d6b
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`ab6f3cb3-34a8-4492-a5d7-fb6b055a2d6b` | version=`3` | effective_time=`20240610`
- canonical payload: sha256 `b26b24a106ff7d3b745b6ad2d07c19ee8d01a3caa5fd0a969df41990982c5e77` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-06-10 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2024-06-12
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Antacid pharmacokinetics were not evaluated; if necessary, antacid and erlotinib are separated by several hours.
- interaction_exists: `true`
- source_effect: `["antacid_pharmacokinetic_effect_not_evaluated"]`
- label_action: `["separate_antacid_and_erlotinib_by_several_hours_if_necessary"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"erlotinib tablets","source_routes":["oral"],"source_formulations":["tablet"],"source_named_members":["antacids"],"runtime_members":["calcium carbonate","magnesium hydroxide","aluminium hydroxide","sodium bicarbonate"],"runtime_class":"antacid","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - No measured absorption/exposure reduction, numeric interval, or ingredient enumeration is supported.
  - Magaldrate, magnesium trisilicate, dried aluminium hydroxide, hydrotalcite, and other unlisted antacid identities are not established by this class-only label statement.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [2.4 Dose Modifications] (path `dosage_and_administration[0]`; sha256 07ea36bffd3f904b53fec10399a4ede3d2ee26ceb338fac6eed61298046d3e7c) "The effect of antacids on erlotinib pharmacokinetics has not been evaluated."
  - [2.4 Dose Modifications] (path `dosage_and_administration[0]`; sha256 ed565d6f5e2aff6cd7ad342e3d25ebede65fc36a129c5f66e42c40c64f67e305) "The antacid dose and the erlotinib tablets dose should be separated by several hours, if an antacid is necessary"

### dasatinib__proton_pump_inhibitor — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-sprycel-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — SPRYCEL tablets; labeler E.R. Squibb & Sons, L.L.C. | regulator="FDA (United States)" | product="SPRYCEL tablets" | section: "7.1 Effect of Other Drugs on Dasatinib; 12.3 Specific Populations"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%224764f37b-c9e6-4ede-bcc2-8a03b7c521df%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4764f37b-c9e6-4ede-bcc2-8a03b7c521df
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`4764f37b-c9e6-4ede-bcc2-8a03b7c521df` | version=`47` | effective_time=`20240731`
- canonical payload: sha256 `c960824976ef48faf37f2bd37f5b11b28242e39b8b84c05a57a1cb3fc8cd0832` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-07-31 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2024-08-15
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: PPIs reduce dasatinib exposure and should not be administered with SPRYCEL.
- interaction_exists: `true`
- source_effect: `["decreased_dasatinib_exposure","potentially_reduced_sprycel_efficacy"]`
- label_action: `["do_not_administer_ppis_with_sprycel"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"SPRYCEL tablets","source_routes":["oral"],"source_formulations":["tablet"],"source_named_members":["proton pump inhibitors","omeprazole"],"runtime_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole"],"runtime_class":"proton_pump_inhibitor","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Only omeprazole is studied; other members need class mapping; spacing is unsupported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.1 Effect of Other Drugs on Dasatinib] (path `drug_interactions[0]`; sha256 44b40451c57e07b06394edf3e45d0b018e6827835a211919ec66cc28fa3b2d70) "Do not administer H 2 antagonists or proton pump inhibitors with SPRYCEL."
  - [12.3 Specific Populations] (path `pharmacokinetics[0]`; sha256 3832a6558e319ed94877bca70cd505afda1a0450f88f72ac8da242ddc4db45b0) "The administration of a single 100 mg dose of SPRYCEL 22 hours following a 40 mg dose of omeprazole (proton pump inhibitor) at steady state reduced the mean AUC of dasatinib by 43% and the mean C max of dasatinib by 42%."

### dasatinib__proton_pump_inhibitor — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-phyrago-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — PHYRAGO tablets; labeler Cycle Pharmaceuticals Ltd. | regulator="FDA (United States)" | product="PHYRAGO immediate-release tablets" | section: "12.3 Pharmacokinetics — Gastric Acid Reducing Agents"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%2260976d1e-c415-417f-8168-4e07999a7281%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=60976d1e-c415-417f-8168-4e07999a7281
- policy: source=`openfda-labels` | use=`interaction-counterevidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`60976d1e-c415-417f-8168-4e07999a7281` | version=`3` | effective_time=`20250823`
- canonical payload: sha256 `0f8f4c1abe50135e02c9f1dd7ed06345b83d9afc2e1bf213aea5f22b5bb48cab` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2025-08-23 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-03-18
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: PHYRAGO showed no clinically significant pharmacokinetic difference with omeprazole.
- interaction_exists: `false`
- source_effect: `["no_clinically_meaningful_effect"]`
- label_action: `[]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"PHYRAGO immediate-release tablets","source_routes":["oral"],"source_formulations":["immediate-release tablet"],"source_named_members":["omeprazole"],"runtime_members":["omeprazole"],"runtime_class":"proton_pump_inhibitor","requires_clinician_class_mapping":false,"evidence_role":"product_specific_interaction_counterevidence"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This counterevidence supports only a no-clinically-meaningful-pharmacokinetic-effect finding for PHYRAGO with omeprazole; it supplies no PPI management action.
  - Only omeprazole supplies the PHYRAGO PPI observation; no class-wide no-effect conclusion is supported.
  - The PHYRAGO result does not override the contrary SPRYCEL product label.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [12.3 Pharmacokinetics — Gastric Acid Reducing Agents] (path `pharmacokinetics[0]`; sha256 9b4bdc732c6072152560013e56f96aedcb188138b9488c1195ec4e2dbe2a4c14) "The dasatinib C max decreased by 47.9% and AUC by 31.7% following concomitant use with a calcium carbonate antacid. No clinically significant differences in the pharmacokinetics of PHYRAGO were observed following concomitant use with omeprazole (proton pump inhibitor) or famotidine (H2 receptor antagonist)."

### dasatinib__h2_receptor_antagonist — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-sprycel-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — SPRYCEL tablets; labeler E.R. Squibb & Sons, L.L.C. | regulator="FDA (United States)" | product="SPRYCEL tablets" | section: "7.1 Effect of Other Drugs on Dasatinib; 12.3 Specific Populations"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%224764f37b-c9e6-4ede-bcc2-8a03b7c521df%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4764f37b-c9e6-4ede-bcc2-8a03b7c521df
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`4764f37b-c9e6-4ede-bcc2-8a03b7c521df` | version=`47` | effective_time=`20240731`
- canonical payload: sha256 `c960824976ef48faf37f2bd37f5b11b28242e39b8b84c05a57a1cb3fc8cd0832` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-07-31 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2024-08-15
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: H2 antagonists reduce dasatinib exposure and should not be administered; antacids are the alternative.
- interaction_exists: `true`
- source_effect: `["decreased_dasatinib_exposure","potentially_reduced_sprycel_efficacy"]`
- label_action: `["do_not_administer_h2_antagonists_with_sprycel","consider_antacids_instead"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"SPRYCEL tablets","source_routes":["oral"],"source_formulations":["tablet"],"source_named_members":["H2 antagonists","famotidine"],"runtime_members":["famotidine","cimetidine","ranitidine","nizatidine"],"runtime_class":"h2_receptor_antagonist","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Only famotidine is studied; other members need class mapping; no H2 spacing workaround is supported.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [12.3 Specific Populations] (path `pharmacokinetics[0]`; sha256 6f55ecbf70ed19a8b23b56eafc169451409c384017e68d3fb3dd1eb1b8cd8c7a) "The administration of a single dose of SPRYCEL 10 hours following famotidine (H 2 antagonist) reduced the mean AUC of dasatinib by 61% and the mean C max of dasatinib by 63%."
  - [7.1 Effect of Other Drugs on Dasatinib] (path `drug_interactions[0]`; sha256 ca79784db74817b7df5c37f25eb3aeac22ce014de19780fb97c6e6d31726909d) "Consider the use of antacids in place of H 2 antagonists or proton pump inhibitors."
  - [7.1 Effect of Other Drugs on Dasatinib] (path `drug_interactions[0]`; sha256 88722882516aa7f2ec93e0ecabe1bc3c7a85d7ee543b19692d939210b81bd1bd) "The coadministration of SPRYCEL with a gastric acid reducing agent may decrease the concentrations of dasatinib. Decreased dasatinib concentrations may reduce efficacy. Do not administer H 2 antagonists or proton pump inhibitors with SPRYCEL."

### dasatinib__h2_receptor_antagonist — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-phyrago-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — PHYRAGO tablets; labeler Cycle Pharmaceuticals Ltd. | regulator="FDA (United States)" | product="PHYRAGO immediate-release tablets" | section: "12.3 Pharmacokinetics — Gastric Acid Reducing Agents"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%2260976d1e-c415-417f-8168-4e07999a7281%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=60976d1e-c415-417f-8168-4e07999a7281
- policy: source=`openfda-labels` | use=`interaction-counterevidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`60976d1e-c415-417f-8168-4e07999a7281` | version=`3` | effective_time=`20250823`
- canonical payload: sha256 `0f8f4c1abe50135e02c9f1dd7ed06345b83d9afc2e1bf213aea5f22b5bb48cab` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2025-08-23 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-03-18
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: PHYRAGO showed no clinically significant pharmacokinetic difference with famotidine.
- interaction_exists: `false`
- source_effect: `["no_clinically_meaningful_effect"]`
- label_action: `[]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"PHYRAGO immediate-release tablets","source_routes":["oral"],"source_formulations":["immediate-release tablet"],"source_named_members":["famotidine"],"runtime_members":["famotidine"],"runtime_class":"h2_receptor_antagonist","requires_clinician_class_mapping":false,"evidence_role":"product_specific_interaction_counterevidence"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This counterevidence supports only a no-clinically-meaningful-pharmacokinetic-effect finding for PHYRAGO with famotidine; it supplies no H2-antagonist management action.
  - Only famotidine supplies the PHYRAGO H2-antagonist observation; no class-wide no-effect conclusion is supported.
  - The PHYRAGO result does not override the contrary SPRYCEL product label.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [12.3 Pharmacokinetics — Gastric Acid Reducing Agents] (path `pharmacokinetics[0]`; sha256 b74bc74fd1dd02fa30d8febf6978cfcb971c2ba88a4c47954709e761f6960202) "No clinically significant differences in the pharmacokinetics of PHYRAGO were observed following concomitant use with omeprazole (proton pump inhibitor) or famotidine (H2 receptor antagonist)."

### dasatinib_sprycel__antacid — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-sprycel-2024`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — SPRYCEL tablets; labeler E.R. Squibb & Sons, L.L.C. | regulator="FDA (United States)" | product="SPRYCEL tablets" | section: "7.1 Effect of Other Drugs on Dasatinib; 12.3 Specific Populations"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%224764f37b-c9e6-4ede-bcc2-8a03b7c521df%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4764f37b-c9e6-4ede-bcc2-8a03b7c521df
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`4764f37b-c9e6-4ede-bcc2-8a03b7c521df` | version=`47` | effective_time=`20240731`
- canonical payload: sha256 `c960824976ef48faf37f2bd37f5b11b28242e39b8b84c05a57a1cb3fc8cd0832` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2024-07-31 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2024-08-15
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Simultaneous aluminum/magnesium antacid reduces dasatinib exposure; give antacid 2 hours before or after SPRYCEL.
- interaction_exists: `true`
- source_effect: `["reduced_dasatinib_auc_and_cmax_with_simultaneous_antacid"]`
- label_action: `["administer_antacid_at_least_2_hours_before_or_after_sprycel","avoid_simultaneous_antacid"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"SPRYCEL tablets","source_routes":["oral"],"source_formulations":["tablet"],"source_named_members":["aluminum hydroxide/magnesium hydroxide antacid"],"runtime_members":["magnesium hydroxide","aluminium hydroxide"],"runtime_class":"antacid","requires_clinician_class_mapping":false}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The exposure study and spacing action are specific to an aluminum-hydroxide/magnesium-hydroxide antacid with SPRYCEL; no other antacid identity or dasatinib product is established.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [12.3 Specific Populations] (path `pharmacokinetics[0]`; sha256 24d34e9877b714b2dd0acc8f5c3aec0a99af7d961476f492e21bdf4cb3788df0) "The simultaneous administration of 30 mL of aluminum hydroxide/magnesium hydroxide with a single dose of SPRYCEL was associated with a 55% reduction in the mean AUC of dasatinib and a 58% reduction in the mean C max of dasatinib."
  - [7.1 Effect of Other Drugs on Dasatinib] (path `drug_interactions[0]`; sha256 5f411309e4d727b93ea55f3ef69702416bfcd1fe64a342209e45058fb15765b8) "Administer the antacid at least 2 hours prior to or 2 hours after the dose of SPRYCEL. Avoid simultaneous administration of SPRYCEL with antacids."

### dasatinib_phyrago__antacid — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-phyrago-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — PHYRAGO tablets; labeler Cycle Pharmaceuticals Ltd. | regulator="FDA (United States)" | product="PHYRAGO immediate-release tablets" | section: "7.1 Effect of Other Drugs on Dasatinib; 12.3 Pharmacokinetics — Gastric Acid Reducing Agents"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%2260976d1e-c415-417f-8168-4e07999a7281%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=60976d1e-c415-417f-8168-4e07999a7281
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`60976d1e-c415-417f-8168-4e07999a7281` | version=`3` | effective_time=`20250823`
- canonical payload: sha256 `0f8f4c1abe50135e02c9f1dd7ed06345b83d9afc2e1bf213aea5f22b5bb48cab` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2025-08-23 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-03-18
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Calcium-carbonate antacid lowers PHYRAGO exposure; avoid concomitant antacid use or, if unavoidable, separate by at least 2 hours.
- interaction_exists: `true`
- source_effect: `["reduced_phyrago_cmax_and_auc_with_calcium_carbonate_antacid"]`
- label_action: `["avoid_concomitant_antacid_with_phyrago","if_unavoidable_administer_antacid_at_least_2_hours_before_or_after_phyrago"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"PHYRAGO immediate-release tablets","source_routes":["oral"],"source_formulations":["immediate-release tablet"],"source_named_members":["calcium carbonate antacid"],"runtime_members":["calcium carbonate"],"runtime_class":"antacid","requires_clinician_class_mapping":false}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Only calcium carbonate is directly studied for PHYRAGO; no other antacid identity or dasatinib product is established.
  - The label action is avoid concomitant use first; 2-hour separation is only the fallback when concomitant antacid use cannot be avoided.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [12.3 Pharmacokinetics — Gastric Acid Reducing Agents] (path `pharmacokinetics[0]`; sha256 816633b3190b1003d035d41d6708457965b6beb6823283e339c6726b8017190c) "The dasatinib C max decreased by 47.9% and AUC by 31.7% following concomitant use with a calcium carbonate antacid."
  - [7.1 Effect of Other Drugs on Dasatinib] (path `drug_interactions[0]`; sha256 694c008adf2ec72ade3095d9da852bc13dd14bd18c28171dc0ae3e69b8d1e53a) "Avoid concomitant use of PHYRAGO with antacids. If concomitant use of an antacid cannot be avoided, administer the antacid at least 2 hours prior to or 2 hours after the dose of PHYRAGO [see Dosage and Administration ( 2.3 )] ."

### ketoconazole_oral__acid_suppressant — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-ketoconazole-tablets-2025`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — ketoconazole tablets; labeler Strides Pharma Science Limited | regulator="FDA (United States)" | product="ketoconazole tablets" | section: "Clinical Pharmacology; Drug Interactions"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%226d4be760-c723-4f54-a854-12c61cf91703%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6d4be760-c723-4f54-a854-12c61cf91703
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`6d4be760-c723-4f54-a854-12c61cf91703` | version=`8` | effective_time=`20251217`
- canonical payload: sha256 `176ebbbaa8c593687d7a44aa60347caccf69edb97fbbcceeac026c67c32ec2bb` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2025-12-17 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2026-02-09
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Acid reducers impair ketoconazole-tablet absorption; use an acidic beverage, separate neutralizers 1 hour before or 2 hours after, and monitor antifungal activity with dose increase only as deemed necessary.
- interaction_exists: `true`
- source_effect: `["impaired_ketoconazole_tablet_absorption","markedly_reduced_bioavailability_with_omeprazole"]`
- label_action: `["use_acidic_beverage_during_acid_reducer_co_treatment","administer_acid_neutralizer_1_hour_before_or_2_hours_after","monitor_antifungal_activity","increase_ketoconazole_tablet_dose_as_deemed_necessary"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"ketoconazole tablets","source_routes":["oral systemic"],"source_formulations":["tablet"],"source_named_members":["acid-neutralizing medicines","H2 antagonists","PPIs","aluminum hydroxide"],"runtime_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole","famotidine","cimetidine","ranitidine","nizatidine","calcium carbonate","magnesium hydroxide","aluminium hydroxide","sodium bicarbonate"],"runtime_class":"acid_suppressant","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The numeric interval is only for acid neutralizers; the roster needs class mapping; topical use and hepatic restrictions are outside this evidence; dose increase is not an automatic dispenser action.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [Drug Interactions] (path `drug_interactions[0]`; sha256 754f79ed7673d2c105a7d123ead82f869da0704f013715a31223e42b7d68414d) "Drugs that reduce the gastric acidity (e.g., acid neutralizing medicines such as aluminum hydroxide, or acid secretion suppressors such as H 2 -receptor antagonists and proton pump inhibitors) impair the absorption of ketoconazole from ketoconazole tablets."
  - [Drug Interactions] (path `drug_interactions[0]`; sha256 9b41f4e6e50a676a1daa6d1c001ee09e83c1dcd9d72ec139a12a0d3631f910dc) "Ketoconazole tablets should be administered with an acidic beverage (such as non-diet cola) upon co-treatment with drugs reducing gastric acidity."
  - [Drug Interactions] (path `drug_interactions[0]`; sha256 524286a2e61ee536d5999d6295cd1f8c8ee4dae3f26d8d4309ed9a0246e31d98) "Acid neutralizing medicines (e.g., aluminum hydroxide) should be administered at least 1 hour before or 2 hours after the intake of ketoconazole tablets."
  - [Drug Interactions] (path `drug_interactions[0]`; sha256 520d76381259a1ad3c31557bd39c3f4ca3d93de91c608c559b6f497edd72334d) "Upon coadministration, the antifungal activity should be monitored and the ketoconazole tablets dose increased as deemed necessary."
  - [Clinical Pharmacology] (path `clinical_pharmacology[0]`; sha256 f77ee9a1e9916a5954acff161658deb6c813ae44d11f12d3f56c650d38bcf08c) "After pretreatment with omeprazole, a proton pump inhibitor, the bioavailability of a single 200 mg dose of ketoconazole under fasted conditions was decreased to 17% of the bioavailability of ketoconazole administered alone."

### itraconazole_capsule__acid_suppressant — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-sporanox-capsules-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — SPORANOX capsules; labeler Janssen Pharmaceuticals, Inc. | regulator="FDA (United States)" | product="SPORANOX capsules" | section: "Absorption; Effect of Other Drugs on SPORANOX; Dosage and Administration"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22a4d555fa-787c-40fb-bb7d-b0d4f7318fd0%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a4d555fa-787c-40fb-bb7d-b0d4f7318fd0
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`a4d555fa-787c-40fb-bb7d-b0d4f7318fd0` | version=`31` | effective_time=`20260713`
- canonical payload: sha256 `b30f6fd29e285d1507167ba96ef057a1487b85a1e539750975f261d4b0676a94` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2026-07-13 (`openFDA SPL effective_time`) | retrieved: 2026-07-26 | accessed: 2026-07-26
- DailyMed reference page updated: 2026-07-15
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-26
- quote_integrity: `multi_fragment_verbatim`
- proposition: For conventional SPORANOX capsules, reduced acidity lowers absorption; take with a full meal, separate neutralizers by 2 hours, and use an acidic beverage under studied conditions.
- interaction_exists: `true`
- source_effect: `["reduced_itraconazole_capsule_absorption_with_reduced_acidity"]`
- label_action: `["take_sporanox_capsules_with_full_meal","administer_acid_neutralizer_at_least_2_hours_before_or_after","use_acidic_beverage_under_label_conditions"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"SPORANOX capsules","source_routes":["oral"],"source_formulations":["capsule"],"source_named_members":["acid-neutralizing medicines","H2 antagonists","PPIs","aluminum hydroxide"],"runtime_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole","famotidine","cimetidine","ranitidine","nizatidine","calcium carbonate","magnesium hydroxide","aluminium hydroxide","sodium bicarbonate"],"runtime_class":"acid_suppressant","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The numeric interval is only for neutralizers; this evidence is specific to conventional SPORANOX capsules and does not apply to TOLSURA or oral solution; no universal TDM interval is supplied.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [Absorption] (path `pharmacokinetics[0]`; sha256 51b34b84f5b068cb1d072fc80bd1d6c3b33513e58ce12674f51ebf65eb109a81) "Absorption of itraconazole capsules is reduced in subjects with reduced gastric acidity, such as subjects taking medications known as gastric acid secretion suppressors (e.g., H 2 -receptor antagonists, proton pump inhibitors) or subjects with achlorhydria caused by certain diseases."
  - [Effect of Other Drugs on SPORANOX] (path `drug_interactions[0]`; sha256 133bd2f24ae681b5984df31e5fbebf393dce3a36ef05333d7be8a752d53feef6) "Administer acid neutralizing medicines at least 2 hours before or 2 hours after the intake of SPORANOX ® capsules."
  - [Dosage and Administration] (path `dosage_and_administration[0]`; sha256 effa12bf16ae29dd78b64220eabc23fdee0e45da8e4748ed4219629a854f685d) "SPORANOX ® (itraconazole) Capsules should be taken with a full meal to ensure maximal absorption."
  - [Absorption] (path `pharmacokinetics[0]`; sha256 ec141d268c3f74a1d7e3e990e65e8fa0f928bb158b21d9e50c25c97a91d5050a) "Absorption of itraconazole under fasted conditions in these subjects is increased when SPORANOX ® Capsules are administered with an acidic beverage (such as a non-diet cola)."

### itraconazole_tolsura__acid_reducer — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-tolsura-2025`
- source: openFDA drug-label record (company-submitted SPL); DailyMed (US NLM) — TOLSURA capsules; labeler Mayne Pharma Commercial LLC | regulator="FDA (United States)" | product="TOLSURA capsules" | section: "7.2 Effect of Other Drugs on TOLSURA; 12.3 Pharmacokinetics — Omeprazole"
- openFDA query: https://api.fda.gov/drug/label.json?search=set_id%3A%22306352d1-9d5a-49ad-b72d-893b99546861%22&limit=100
- DailyMed reference: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=306352d1-9d5a-49ad-b72d-893b99546861
- policy: source=`openfda-labels` | use=`interaction-evidence` | licence=`CC0-1.0` | type=`company_submitted_spl_via_openfda`
- SPL identity: set_id=`306352d1-9d5a-49ad-b72d-893b99546861` | version=`10` | effective_time=`20250423`
- canonical payload: sha256 `b1a0e7cc66d7699cd501e6000c0e16b3e8ee3105e4663ada07b4f8ebdeba19ad` | `sorted-json-keys-v1` | `openfda-spl-text-v1`
- date: 2025-04-23 (`openFDA SPL effective_time`) | retrieved: 2026-07-23 | accessed: 2026-07-23
- DailyMed reference page updated: 2025-04-25
- jurisdiction/review: `US` / `review_candidate`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Acid-neutralizing medicines, H2-receptor antagonists and PPIs increase systemic itraconazole exposure from TOLSURA; monitor adverse reactions and consider prescriber-directed TOLSURA dose reduction. Omeprazole increased mean AUC by 22% and mean Cmax by 31% in the cited study.
- interaction_exists: `true`
- source_effect: `["increased_tolsura_systemic_itraconazole_exposure_with_gastric_acid_reducers","increased_tolsura_itraconazole_auc_22_percent_with_omeprazole","increased_tolsura_itraconazole_cmax_31_percent_with_omeprazole"]`
- label_action: `["monitor_for_adverse_reactions","tolsura_dose_reduction_may_be_necessary"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_route_formulation_and_members","source_product":"TOLSURA capsules","source_routes":["oral"],"source_formulations":["TOLSURA capsule"],"source_named_members":["acid neutralizing medicines","aluminum hydroxide","H2-receptor antagonists","proton pump inhibitors","omeprazole"],"runtime_members":["omeprazole","esomeprazole","lansoprazole","pantoprazole","rabeprazole","dexlansoprazole","famotidine","cimetidine","ranitidine","nizatidine","calcium carbonate","magnesium hydroxide","aluminium hydroxide","sodium bicarbonate"],"runtime_class":"acid_suppressant","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The TOLSURA result is product-specific and does not establish the same direction for conventional SPORANOX capsules or itraconazole oral solution.
  - Only aluminum hydroxide and omeprazole are named examples; admission of other individual H2 antagonists, PPIs, or neutralizers requires clinician class mapping.
  - This source does not validate unlisted member expansion, route or formulation inference, the local severity tier, local dispense workflow, clinician approval, or promotion readiness.
- fragments:
  - [7.2 Effect of Other Drugs on TOLSURA] (path `drug_interactions[0]`; sha256 1bb5dcb4e845d5b3dc80bc31edd5179a9e7caace4432942c8b38e0e1f9b74fbf) "Drugs that reduce gastric acidity e.g. acid neutralizing medicines such as aluminum hydroxide, or acid secretion suppressors such as H 2 - receptor antagonists and proton pump inhibitors (e.g., omeprazole)."
  - [7.2 Effect of Other Drugs on TOLSURA] (path `drug_interactions[0]`; sha256 d451c68bbae0634207ede685ee3a4951bb02d4e2f1555c01087ac75f3e72613b) "Co-administration of these drugs, including omeprazole, with TOLSURA increases the systemic exposure to itraconazole. Monitor for adverse reactions. TOLSURA dose reduction may be necessary [see Clinical Pharmacology (12.3) ]."
  - [12.3 Pharmacokinetics — Omeprazole] (path `pharmacokinetics[0]`; sha256 c6f17990d03aa6c9925c86233adac2854164d8e555acab04d349a54cc43731a1) "As illustrated in Table 8 below, the mean itraconazole AUC ∞ was 22% higher and mean C max 31% higher when TOLSURA was co-administered with omeprazole."
