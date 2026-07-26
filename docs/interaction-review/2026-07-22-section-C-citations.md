# Section C — citation sign-off worksheet

**24 evidence records** across **21 rules**, containing **34 hashed fragments**. This worksheet deterministically formats the existing evidence fields; it does not add or revise clinical claims.

Machine-generated from enriched evidence. Citation status and clinician-review state are reported exactly as stored in the JSONL.

- Section: `C`
- JSONL SHA-256: `9fa5a18bb0f303c0a2fa876daeade2904eb88929f9710d9457246944c64e72f6`
- Commit: `worktree-uncommitted`
- citation_status: `{"machine_confirmed_openfda_reconciled_pending_clinician":24}`

### ssri_snri__maoi_nonselective — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-ssri-maoi`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — fluoxetine | regulator="FDA (United States)" | product="fluoxetine" | section: "Contraindications"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%229651816f-58f5-4bf8-8183-6f3d84d36b5c%22&limit=100 (host api.fda.gov; setid 9651816f-58f5-4bf8-8183-6f3d84d36b5c)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `9651816f-58f5-4bf8-8183-6f3d84d36b5c` @ `11` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2024-07-12 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9651816f-58f5-4bf8-8183-6f3d84d36b5c
- provenance: `{"set_id":"9651816f-58f5-4bf8-8183-6f3d84d36b5c","version":"11","effective_time":"20240712","payload_sha256":"03b19cd6184792f01924edd4396425d3074365d81cee8df7ade456965fbc8f77","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["contraindications[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Psychiatric MAOI use with fluoxetine, or within 5 weeks after stopping fluoxetine, is contraindicated because of serotonin-syndrome risk.
- interaction_exists: `true`
- source_effect: `["interaction_risk_described"]`
- label_action: `["contraindicated_per_source","washout_required"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"extrapolated_class","directly_supported_members":["fluoxetine"],"runtime_members":["fluoxetine","phenelzine","tranylcypromine","isocarboxazid"],"requires_clinician_extrapolation":true,"object_members":["fluoxetine"],"perpetrator_members":["phenelzine","tranylcypromine","isocarboxazid"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The retained fragment does not establish an MAOI-to-fluoxetine interval or support runtime expansion to other SSRIs or SNRIs.
- fragments:
  - [Contraindications] (source_path `contraindications[0]`; sha256 19671aed007b68cc281fb1b6acc6c794507e735e731b4d9956359e59547c823c) "The use of MAOIs intended to treat psychiatric disorders with fluoxetine capsules or within 5 weeks of stopping treatment with fluoxetine capsules is contraindicated because of an increased risk of serotonin syndrome."

### ssri_snri__methylene_blue_iv — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-methylene-blue-serotonergic-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — methylene blue | regulator="FDA (United States)" | product="methylene blue" | section: "Warnings"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22e2d9d96c-a711-47c5-855a-7eb7f163493e%22&limit=100 (host api.fda.gov; setid e2d9d96c-a711-47c5-855a-7eb7f163493e)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `e2d9d96c-a711-47c5-855a-7eb7f163493e` @ `8` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-03-11 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e2d9d96c-a711-47c5-855a-7eb7f163493e
- provenance: `{"set_id":"e2d9d96c-a711-47c5-855a-7eb7f163493e","version":"8","effective_time":"20260311","payload_sha256":"bee3dfa9f1339047dbec4bd9618408afee04789bf6b241d06089c4fd69736493","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Methylene blue is a potent MAOI that may cause potentially fatal serotonin toxicity with SRIs; if it is indicated, SRIs must be ceased before treatment, procedure, or surgery.
- interaction_exists: `true`
- source_effect: `["interaction_risk_described"]`
- label_action: `["cease_sri_before_treatment"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"extrapolated_class","directly_supported_members":["methylene blue"],"runtime_members":["fluoxetine","sertraline","paroxetine","citalopram","escitalopram","fluvoxamine","venlafaxine","desvenlafaxine","duloxetine","vortioxetine","methylene_blue"],"requires_clinician_extrapolation":true,"object_members":["fluoxetine","sertraline","paroxetine","citalopram","escitalopram","fluvoxamine","venlafaxine","desvenlafaxine","duloxetine","vortioxetine"],"perpetrator_members":["methylene_blue"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The retained fragment does not establish an urgent-use branch, monitoring duration, safe dose threshold, or route-specific threshold.
  - The runtime SSRI/SNRI roster remains a local mapping pending clinician review.
- fragments:
  - [Warnings] (source_path `warnings[0]`; sha256 0632dcac1a2d225fd7ead2129521818db6546df8c4125fb02c5218417934a649) "Methylene blue is a potent monoamine oxidase inhibitor: Methylene blue has been demonstrated to be a potent monoamine oxidase inhibitor (MAOI) and may cause potentially fatal serotonin toxicity (serotonin syndrome) when combined with serotonin reuptake inhibitors (SRIs). (4) (see DRUG INTERACTIONS.) Serotonin toxicity is characterized by development of neuromuscular hyperactivity (tremor, clonus, myoclonus, and hyperreflexia, and, in the advanced stage, pyramidal rigidity); autonomic hyperactivity (diaphoresis, fever, tachycardia, tachypnoea, and mydriasis); and altered mental status (agitation, excitement, and in the advanced stage, confusion). If methylene blue is judged to be indicated, SRIs must be ceased, prior to treatment/procedure/surgery."

### tramadol__serotonergic_antidepressant — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-tramadol-serotonergic-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — tramadol hydrochloride tablets | regulator="FDA (United States)" | product="tramadol hydrochloride tablets" | section: "Warnings and Precautions, Serotonin Syndrome Risk (5.9)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22855905c7-1481-4b2d-a318-3254ad8ed73c%22&limit=100 (host api.fda.gov; setid 855905c7-1481-4b2d-a318-3254ad8ed73c)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `855905c7-1481-4b2d-a318-3254ad8ed73c` @ `1` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-06-08 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=855905c7-1481-4b2d-a318-3254ad8ed73c
- provenance: `{"set_id":"855905c7-1481-4b2d-a318-3254ad8ed73c","version":"1","effective_time":"20260608","payload_sha256":"49a332d991f97b968d8301f7f49220a4d3ed9460493f58af98ced3f9e04a023a","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]","warnings_and_cautions[0]","warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Tramadol can cause serotonin syndrome with SSRIs, SNRIs, TCAs, triptans, and other serotonergic drugs.
- interaction_exists: `true`
- source_effect: `["serotonin_syndrome_risk"]`
- label_action: `["discontinue_tramadol_if_serotonin_syndrome_suspected"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_classes","object_members":["tramadol"],"source_classes":["SSRIs","SNRIs","TCAs"],"runtime_class":"serotonergic_antidepressant_ssri_snri_tca","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - These retained serotonin-syndrome fragments do not establish seizure risk; the source-exact SSRI/TCA seizure claim is retained in the separate diagnostic-only tramadol__ssri_tca_seizure_risk rule.
  - The local Major severity and confirm-and-monitor workflow remain local mappings pending clinician review.
- fragments:
  - [Warnings and Precautions, Serotonin Syndrome Risk (5.9)] (source_path `warnings_and_cautions[0]`; sha256 3491c530e4bbffaccaf1f19ce96bb850768589c70793f2d3b9ee03222a8ce5ab) "Cases of serotonin syndrome, a potentially life-threatening condition, have been reported with the use of tramadol, particularly during concomitant use with serotonergic drugs."
  - [Warnings and Precautions, Serotonin Syndrome Risk (5.9)] (source_path `warnings_and_cautions[0]`; sha256 014fdd1c54670963c7bf33c09a5ff45c2d97d9f40c672e5ece5592b414a1b153) "Serotonergic drugs include selective serotonin reuptake inhibitors (SSRIs), serotonin and norepinephrine reuptake inhibitors (SNRIs), tricyclic antidepressants (TCAs), triptans, 5-HT3 receptor antagonists, drugs that affect the serotonergic neurotransmitter system (e.g., mirtazapine, trazodone, tramadol), certain muscle relaxants (i.e., cyclobenzaprine, metaxalone), and drugs that impair metabolism of serotonin (including MAO inhibitors, both those intended to treat psychiatric disorders and also others, such as linezolid and intravenous methylene blue) [see Drug Interactions (7)]."
  - [Warnings and Precautions, Serotonin Syndrome Risk (5.9)] (source_path `warnings_and_cautions[0]`; sha256 ddb4b96333ba6490f7e01f8e9272aac1f9a4de65a1041b0e57564abde66d6b65) "Discontinue tramadol hydrochloride tablets if serotonin syndrome is suspected."

### tramadol__ssri_tca_seizure_risk — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-tramadol-seizure-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — tramadol hydrochloride tablets | regulator="FDA (United States)" | product="tramadol hydrochloride tablets" | section: "Warnings and Precautions, Increased Risk of Seizure (5.10)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22855905c7-1481-4b2d-a318-3254ad8ed73c%22&limit=100 (host api.fda.gov; setid 855905c7-1481-4b2d-a318-3254ad8ed73c)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `855905c7-1481-4b2d-a318-3254ad8ed73c` @ `1` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-06-08 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=855905c7-1481-4b2d-a318-3254ad8ed73c
- provenance: `{"set_id":"855905c7-1481-4b2d-a318-3254ad8ed73c","version":"1","effective_time":"20260608","payload_sha256":"49a332d991f97b968d8301f7f49220a4d3ed9460493f58af98ced3f9e04a023a","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]","warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Seizures have occurred with tramadol at recommended doses, and concomitant use with SSRIs or TCAs increases seizure risk.
- interaction_exists: `true`
- source_effect: `["seizures_reported_at_recommended_doses","increased_seizure_risk_with_ssri_or_tca"]`
- label_action: `[]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_classes_with_narrow_local_mapping","object_members":["tramadol"],"source_classes":["SSRIs","TCAs"],"runtime_class":"ssri_or_tca_seizure_risk","runtime_members":["fluoxetine","sertraline","paroxetine","citalopram","escitalopram","fluvoxamine","amitriptyline","clomipramine","imipramine","nortriptyline"],"requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The seizure fragment does not name SNRIs; venlafaxine, desvenlafaxine, and duloxetine are therefore excluded from this rule.
  - The source establishes risk but does not direct contraindication, avoidance, dose adjustment, or a monitoring protocol for SSRI/TCA co-use.
  - The source also names other opioids, MAO inhibitors, neuroleptics, and other seizure-threshold-lowering drugs; those categories are outside this deliberately narrow diagnostic rule.
- fragments:
  - [Warnings and Precautions, Increased Risk of Seizure (5.10)] (source_path `warnings_and_cautions[0]`; sha256 1e2f7b8928a1978ca14602c0db1b7d1381bd31517bfdb61b0dc04fdf6cc647fc) "Seizures have been reported in patients receiving tramadol hydrochloride tablets within the recommended dosage range."
  - [Warnings and Precautions, Increased Risk of Seizure (5.10)] (source_path `warnings_and_cautions[0]`; sha256 1381bd00b22720414e07ddc5b48d73830fb0294bf1df405aa1ade9bd25858dbc) "Concomitant use of tramadol hydrochloride tablets increases the seizure risk in patients taking [see Drug Interactions ( 7 )] : • Selective serotonin re-uptake inhibitors (SSRI antidepressants or anorectics), • Tricyclic antidepressants (TCAs), and other tricyclic compounds (e.g., cyclobenzaprine, promethazine, etc.), • Other opioids, • MAO inhibitors [see Warnings and Precautions ( 5.9 ); Drug Interactions ( 7 )] . • Neuroleptics, or • Other drugs that reduce the seizure threshold."

### pethidine_tramadol__maoi_nonselective — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-meperidine-maoi-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — meperidine hydrochloride tablets | regulator="FDA (United States)" | product="meperidine hydrochloride tablets" | section: "Warnings and Precautions, MAOI Interaction"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22792fefda-6cc4-4709-b902-fd9787fc310a%22&limit=100 (host api.fda.gov; setid 792fefda-6cc4-4709-b902-fd9787fc310a)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `792fefda-6cc4-4709-b902-fd9787fc310a` @ `2` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-02-13 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=792fefda-6cc4-4709-b902-fd9787fc310a
- provenance: `{"set_id":"792fefda-6cc4-4709-b902-fd9787fc310a","version":"2","effective_time":"20260213","payload_sha256":"10e14c54fe196c463e47c3cd48153f653bd93f07ef1c3dfa646d0826af0a2096","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["boxed_warning[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Meperidine use with MAOIs within the preceding 14 days is contraindicated.
- interaction_exists: `true`
- source_effect: `["maoi_opioid_interaction_risk"]`
- label_action: `["contraindicated","fourteen_day_post_maoi_restriction"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product","object_members":["pethidine"],"source_named_members":["meperidine"],"perpetrator_class":"MAOIs"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Meperidine is normalized locally to pethidine; this record does not support tramadol by itself.
  - The retained fragment does not establish an opioid-to-MAOI switch interval or a symptom-monitoring protocol.
- fragments:
  - [Warnings and Precautions, MAOI Interaction] (source_path `boxed_warning[0]`; sha256 be4b6e40d835ca167b3457b028236027e476bc21ca89a56add1f31bb6802ce23) "Use of meperidine hydrochloride tablets with MAOIs within the last 14 days is contraindicated [see Contraindications (4), Warnings and Precautions (5.8), Drug Interactions (7)]."

### pethidine_tramadol__maoi_nonselective — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-tramadol-maoi-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — tramadol hydrochloride tablets | regulator="FDA (United States)" | product="tramadol hydrochloride tablets" | section: "Contraindications (4)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22855905c7-1481-4b2d-a318-3254ad8ed73c%22&limit=100 (host api.fda.gov; setid 855905c7-1481-4b2d-a318-3254ad8ed73c)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `855905c7-1481-4b2d-a318-3254ad8ed73c` @ `1` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-06-08 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=855905c7-1481-4b2d-a318-3254ad8ed73c
- provenance: `{"set_id":"855905c7-1481-4b2d-a318-3254ad8ed73c","version":"1","effective_time":"20260608","payload_sha256":"49a332d991f97b968d8301f7f49220a4d3ed9460493f58af98ced3f9e04a023a","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["contraindications[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Tramadol labeling lists concurrent MAOI use or use within the preceding 14 days as contraindicated.
- interaction_exists: `true`
- source_effect: `["maoi_opioid_interaction_risk"]`
- label_action: `["contraindicated","fourteen_day_post_maoi_restriction"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product","object_members":["tramadol"],"perpetrator_class":"MAOIs"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This record does not support pethidine by itself.
  - The retained fragment does not establish an opioid-to-MAOI switch interval or a symptom-monitoring protocol.
- fragments:
  - [Contraindications (4)] (source_path `contraindications[0]`; sha256 b30ad736e65f3514fda96e1d42193d1d930a3c79e07c0c6c05598d45d520cafb) "Concurrent use of monoamine oxidase inhibitors (MAOIs) or use within the last 14 days [see Drug Interactions (7)]."

### linezolid__serotonergic_agent — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-zyvox-linezolid-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — ZYVOX (linezolid) | regulator="FDA (United States)" | product="ZYVOX (linezolid)" | section: "Warnings and Precautions, Serotonin Syndrome (5.3)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%226e70e63b-bfd5-478d-a8ee-8ba22c9efabd%22&limit=100 (host api.fda.gov; setid 6e70e63b-bfd5-478d-a8ee-8ba22c9efabd)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `6e70e63b-bfd5-478d-a8ee-8ba22c9efabd` @ `72` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-06-23 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6e70e63b-bfd5-478d-a8ee-8ba22c9efabd
- provenance: `{"set_id":"6e70e63b-bfd5-478d-a8ee-8ba22c9efabd","version":"72","effective_time":"20260623","payload_sha256":"1b4a690cbdba33849794ae8b5d66b92a8240ffe7e5a8b4743a0b72dafce4487e","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]","warnings_and_cautions[0]","warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Current ZYVOX labeling reports serotonin syndrome, including fatal cases, with serotonergic agents and directs monitoring with clinically appropriate discontinuation if symptoms occur.
- interaction_exists: `true`
- source_effect: `["serotonin_syndrome_including_fatal_cases"]`
- label_action: `["monitor_for_serotonin_syndrome","consider_discontinuing_one_or_both_agents_if_symptomatic"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_classes","object_members":["linezolid"],"source_classes":["serotonin_reuptake_inhibitors","serotonin_norepinephrine_reuptake_inhibitors","tricyclic_antidepressants","triptans","opioids"],"source_named_members":["buspirone","meperidine"],"runtime_class":"linezolid_serotonergic_agent","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The current label does not direct a universal pre-treatment antidepressant washout or the obsolete two-week, five-week, and 24-hour pathway retained in the prior draft.
  - The evidence does not by itself validate every opioid or antidepressant member selected by the local runtime class.
- fragments:
  - [Warnings and Precautions, Serotonin Syndrome (5.3)] (source_path `warnings_and_cautions[0]`; sha256 d588e6490fcc4eda696f465b7ace0a0c86a404f0e4d61e810fa65d7a66b0d28d) "Spontaneous reports of serotonin syndrome including fatal cases associated with the concomitant use of ZYVOX and serotonergic agents have been reported."
  - [Warnings and Precautions, Serotonin Syndrome (5.3)] (source_path `warnings_and_cautions[0]`; sha256 d6b1eb41c92f643abe65467b9626113a9c840662028af05e930b63522d64ad1f) "Commonly used serotonergic agents include serotonin reuptake inhibitors, serotonin-norepinephrine reuptake inhibitors, tricyclic antidepressants, buspirone, serotonin 5-HT1 receptor agonists (triptans), and opioids, including meperidine."
  - [Warnings and Precautions, Serotonin Syndrome (5.3)] (source_path `warnings_and_cautions[0]`; sha256 0f0d8c5cc14a46d4170d8456040cd5c45df007e343a0605508b04d5266ee850d) "Monitor patients for the emergence of serotonin syndrome with the concomitant use of ZYVOX and serotonergic agents or with use of ZYVOX in patients with carcinoid syndrome. If signs or symptoms of serotonin syndrome occur, consider discontinuing ZYVOX and/or concomitant serotonergic agents as clinically appropriate and initiate supportive treatment."

### tramadol__linezolid — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-tramadol-linezolid-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — tramadol hydrochloride tablets | regulator="FDA (United States)" | product="tramadol hydrochloride tablets" | section: "Drug Interactions (7), Monoamine Oxidase Inhibitors"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22855905c7-1481-4b2d-a318-3254ad8ed73c%22&limit=100 (host api.fda.gov; setid 855905c7-1481-4b2d-a318-3254ad8ed73c)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `855905c7-1481-4b2d-a318-3254ad8ed73c` @ `1` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-06-08 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=855905c7-1481-4b2d-a318-3254ad8ed73c
- provenance: `{"set_id":"855905c7-1481-4b2d-a318-3254ad8ed73c","version":"1","effective_time":"20260608","payload_sha256":"49a332d991f97b968d8301f7f49220a4d3ed9460493f58af98ced3f9e04a023a","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["drug_interactions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: The current tramadol label says not to use tramadol with MAOIs or within 14 days after them and explicitly names linezolid as an example.
- interaction_exists: `true`
- source_effect: `["serotonin_syndrome_or_opioid_toxicity"]`
- label_action: `["do_not_use","fourteen_day_post_maoi_restriction"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_exact_pair","object_members":["tramadol"],"perpetrator_members":["linezolid"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The pair matcher detects current co-presence but cannot determine whether linezolid was stopped within the preceding 14 days.
- fragments:
  - [Drug Interactions (7), Monoamine Oxidase Inhibitors] (source_path `drug_interactions[0]`; sha256 393d65568b33324bc14852d497cb6e2665c41503e8268eb4c004846099e89062) "Intervention: Do not use tramadol hydrochloride tablets in patients taking MAOIs or within 14 days of stopping such treatment. Examples: phenelzine, tranylcypromine, linezolid"

### pethidine__linezolid — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-meperidine-linezolid-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — meperidine hydrochloride tablets | regulator="FDA (United States)" | product="meperidine hydrochloride tablets" | section: "Drug Interactions (7), Monoamine Oxidase Inhibitors"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22792fefda-6cc4-4709-b902-fd9787fc310a%22&limit=100 (host api.fda.gov; setid 792fefda-6cc4-4709-b902-fd9787fc310a)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `792fefda-6cc4-4709-b902-fd9787fc310a` @ `2` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-02-13 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=792fefda-6cc4-4709-b902-fd9787fc310a
- provenance: `{"set_id":"792fefda-6cc4-4709-b902-fd9787fc310a","version":"2","effective_time":"20260213","payload_sha256":"10e14c54fe196c463e47c3cd48153f653bd93f07ef1c3dfa646d0826af0a2096","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["drug_interactions[0]","drug_interactions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: The current meperidine label says not to use meperidine with MAOIs or within 14 days after them and explicitly names linezolid as an example.
- interaction_exists: `true`
- source_effect: `["severe_potentially_fatal_maoi_reaction"]`
- label_action: `["do_not_use","fourteen_day_post_maoi_restriction"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_exact_pair","object_members":["pethidine"],"source_named_members":["meperidine"],"perpetrator_members":["linezolid"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Meperidine is normalized locally to the international name pethidine.
  - The pair matcher detects current co-presence but cannot determine whether linezolid was stopped within the preceding 14 days.
- fragments:
  - [Drug Interactions (7), Monoamine Oxidase Inhibitors] (source_path `drug_interactions[0]`; sha256 6b654060a9f6561ff8dd6b55e43360972d99ded38f916caacedd3557b3854ceb) "Intervention: Do not use meperidine hydrochloride tablets in patients taking MAOIs or within 14 days of stopping such treatment."
  - [Drug Interactions (7), Monoamine Oxidase Inhibitors] (source_path `drug_interactions[0]`; sha256 2b384bfc01f0273720b006d30e89b592e8a53fb2218b24748a22ea7dfe6e26b9) "Examples: phenelzine, tranylcypromine, linezolid"

### bupropion__linezolid_directional — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-bupropion-linezolid-directional-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — bupropion hydrochloride tablets | regulator="FDA (United States)" | product="bupropion hydrochloride tablets" | section: "Dosage and Administration (2.5)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%2288c980c8-aaa8-4378-9ac2-24d588640caa%22&limit=100 (host api.fda.gov; setid 88c980c8-aaa8-4378-9ac2-24d588640caa)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `88c980c8-aaa8-4378-9ac2-24d588640caa` @ `10` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-06-24 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=88c980c8-aaa8-4378-9ac2-24d588640caa
- provenance: `{"set_id":"88c980c8-aaa8-4378-9ac2-24d588640caa","version":"10","effective_time":"20260624","payload_sha256":"171b447621ea55aae13560fb6dc9d0904b22ded58b9956ed7bc5733d91674476","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["dosage_and_administration[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Do not start bupropion in a patient being treated with linezolid; urgent linezolid added to established bupropion follows a separate stop-and-monitor pathway.
- interaction_exists: `true`
- source_effect: `["hypertensive_reaction_risk"]`
- label_action: `["do_not_start_bupropion_during_linezolid"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"directional_exact_pair","object_members":["bupropion"],"perpetrator_members":["linezolid"],"direction":"start_bupropion_while_linezolid_active"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This is not a symmetric pair contraindication; the runtime cannot determine initiation direction.
- fragments:
  - [Dosage and Administration (2.5)] (source_path `dosage_and_administration[0]`; sha256 f06096c6391c53c4d259789305e6536b27884aafd9e4d32c3e80d0fff8663ade) "Do not start bupropion hydrochloride tablets in a patient who is being treated with a reversible MAOI such as linezolid or intravenous methylene blue. Drug interactions can increase the risk of hypertensive reactions."

### triptan_mao_metabolized__maoi_mao_a — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-sumatriptan`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — sumatriptan (US) | regulator="FDA (United States)" | product="sumatriptan (US)" | section: "Contraindications"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%2232f6d89b-4aea-5396-e054-00144ff88e88%22&limit=100 (host api.fda.gov; setid 32f6d89b-4aea-5396-e054-00144ff88e88)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `32f6d89b-4aea-5396-e054-00144ff88e88` @ `1` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2016-05-16 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=32f6d89b-4aea-5396-e054-00144ff88e88
- provenance: `{"set_id":"32f6d89b-4aea-5396-e054-00144ff88e88","version":"1","effective_time":"20160516","payload_sha256":"2e61a242848858cb0de4cf9fe70778ff06cb18f549fcfd29f5883f94b24da171","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["description[1]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Sumatriptan is contraindicated with concurrent MAO-A inhibitor administration or recent MAO-A inhibitor use within 2 weeks.
- interaction_exists: `true`
- source_effect: `["increased_triptan_exposure"]`
- label_action: `["washout_required"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_and_class","object_members":["sumatriptan"],"source_class_term":"MAO-A_inhibitors","runtime_class":"maoi_mao_a_inhibitor","runtime_members":["phenelzine","tranylcypromine","isocarboxazid","moclobemide"],"requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This sumatriptan record does not support rizatriptan, zolmitriptan, or other triptans.
  - Linezolid is excluded from this gate and is handled by the current ZYVOX serotonergic-agent rule.
- fragments:
  - [Contraindications] (source_path `description[1]`; sha256 98c274b1f061abf7dde69917ace042f2e9b674fd48232851d5e2ebc124b314ae) "Concurrent administration of a monoamine oxidase (MAO)-A inhibitor or recent (within 2 weeks) use of an MAO-A inhibitor"

### ssri_snri__triptan — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `openfda-sumatriptan-ssri-snri`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — sumatriptan (US) | regulator="FDA (United States)" | product="sumatriptan (US)" | section: "Warnings"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%221ecbd827-e22b-113d-e054-00144ff8d46c%22&limit=100 (host api.fda.gov; setid 1ecbd827-e22b-113d-e054-00144ff8d46c)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `1ecbd827-e22b-113d-e054-00144ff8d46c` @ `2` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2019-12-27 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1ecbd827-e22b-113d-e054-00144ff8d46c
- provenance: `{"set_id":"1ecbd827-e22b-113d-e054-00144ff8d46c","version":"2","effective_time":"20191227","payload_sha256":"1ea849ce50b1d332b98029503e98c7625aba27cb3c66fce41c9ab49bce0784fc","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: US sumatriptan product label: sumatriptan used with SSRIs or SNRIs may cause serotonin syndrome. Supports SUMATRIPTAN (not every triptan).
- interaction_exists: `true`
- source_effect: `["interaction_risk_present"]`
- label_action: `["see_normalized_proposition"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"extrapolated_class","directly_supported_members":["sumatriptan"],"runtime_members":["fluoxetine","sertraline","paroxetine","citalopram","escitalopram","fluvoxamine","venlafaxine","desvenlafaxine","duloxetine","vortioxetine","sumatriptan","rizatriptan","zolmitriptan","naratriptan","eletriptan","frovatriptan","almotriptan"],"requires_clinician_extrapolation":true,"object_members":["fluoxetine","sertraline","paroxetine","citalopram","escitalopram","fluvoxamine","venlafaxine","desvenlafaxine","duloxetine","vortioxetine"],"perpetrator_members":["sumatriptan","rizatriptan","zolmitriptan","naratriptan","eletriptan","frovatriptan","almotriptan"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This evidence does not by itself validate the local runtime severity, workflow action, or every extrapolated class member.
- fragments:
  - [Warnings] (source_path `warnings[0]`; sha256 9851ff5b7f621915d6ad8f869f338e9b1a2f4f58c798908f407dea003bf3a139) "Serotonin syndrome may occur with triptans, including Sumatriptan, particularly during combined use with selective serotonin reuptake inhibitors (SSRIs) or serotonin norepinephrine reuptake inhibitors (SNRIs)."

### dextromethorphan__maoi_nonselective — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-dextromethorphan-maoi-current`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — dextromethorphan polistirex extended-release suspension | regulator="FDA (United States)" | product="dextromethorphan polistirex extended-release suspension" | section: "Warnings, Do not use"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22234e6a2c-a280-4a39-8777-9316e9d681fb%22&limit=100 (host api.fda.gov; setid 234e6a2c-a280-4a39-8777-9316e9d681fb)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `234e6a2c-a280-4a39-8777-9316e9d681fb` @ `14` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-05-27 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=234e6a2c-a280-4a39-8777-9316e9d681fb
- provenance: `{"set_id":"234e6a2c-a280-4a39-8777-9316e9d681fb","version":"14","effective_time":"20260527","payload_sha256":"a434534c934edabef52964fb4917a1f11ed7125ec83cfc2772bafdf2a8511ff3","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["do_not_use[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: The OTC label says not to use dextromethorphan while taking a prescription MAOI or for two weeks afterward.
- interaction_exists: `true`
- source_effect: `["serious_maoi_interaction_risk"]`
- label_action: `["do_not_use","two_week_post_maoi_restriction"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_and_class","object_members":["dextromethorphan"],"perpetrator_class":"prescription_MAOIs"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The OTC label does not enumerate individual psychiatric MAOIs.
- fragments:
  - [Warnings, Do not use] (source_path `do_not_use[0]`; sha256 c60211be6b391bf7590b50832cb4bbee863faf0877c05e4df5a02e8468bd0229) "Do not use if you are now taking a prescription monoamine oxidase inhibitor (MAOI) (certain drugs for depression, psychiatric, or emotional conditions, or Parkinson's disease), or for 2 weeks after stopping the MAOI drug."

### dextromethorphan__ssri_snri — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-auvelity-serotonergic-current`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — AUVELITY (dextromethorphan hydrobromide and bupropion hydrochloride) | regulator="FDA (United States)" | product="AUVELITY (dextromethorphan hydrobromide and bupropion hydrochloride)" | section: "Warnings and Precautions, Serotonin Syndrome (5.8)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22dcefda7c-9a68-278e-e053-2995a90aec79%22&limit=100 (host api.fda.gov; setid dcefda7c-9a68-278e-e053-2995a90aec79)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `dcefda7c-9a68-278e-e053-2995a90aec79` @ `15` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-06-01 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=dcefda7c-9a68-278e-e053-2995a90aec79
- provenance: `{"set_id":"dcefda7c-9a68-278e-e053-2995a90aec79","version":"15","effective_time":"20260601","payload_sha256":"22aa9facdefff987060f6f4c02eccb95c98e61d3a87f65bfbfe30e05a5b83123","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]","warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: AUVELITY labeling warns that its dextromethorphan component can cause serotonin syndrome with SSRIs or TCAs and directs monitoring when other serotonergic drugs are used.
- interaction_exists: `true`
- source_effect: `["serotonin_syndrome_risk"]`
- label_action: `["inform_patients","monitor_for_symptoms"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"fixed_combination_and_source_named_classes","source_product":"AUVELITY","object_component":"dextromethorphan","source_classes":["SSRIs","TCAs"],"runtime_class":"ssri_or_snri","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This fixed-combination label does not directly establish the same risk magnitude for standalone OTC dextromethorphan.
  - The cited class statement names SSRIs and TCAs, not SNRIs; the SNRI branch remains diagnostic class extrapolation.
- fragments:
  - [Warnings and Precautions, Serotonin Syndrome (5.8)] (source_path `warnings_and_cautions[0]`; sha256 3149fc50bc891a7651263db9a3e1ff686acaf8d6324dd0d655efdb7742728a61) "AUVELITY contains dextromethorphan. Concomitant use of AUVELITY with SSRIs or tricyclic antidepressants may cause serotonin syndrome, a potentially life-threatening condition with changes including altered mental status, hypertension, restlessness, myoclonus, hyperthermia, hyperreflexia, diaphoresis, shivering, and tremor [see Drug Interactions (7.1), Overdosage (10)]."
  - [Warnings and Precautions, Serotonin Syndrome (5.8)] (source_path `warnings_and_cautions[0]`; sha256 d2a8fb9e2aae7b8315311bfa9f4f0cc8c3f9365ddd1de3ac2bfd825b21d35d12) "If concomitant use of AUVELITY with other serotonergic drugs is clinically warranted, inform patients of the increased risk for serotonin syndrome and monitor for symptoms."

### opioid__benzodiazepine_cns_depressant — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-boxed-warning-opioid-benzodiazepine`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — opioid analgesics / benzodiazepines | regulator="FDA (United States)" | product="opioid analgesics / benzodiazepines" | section: "Boxed Warning"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%225a8157d3-ba20-4abf-b0d4-6ad141b31d63%22&limit=100 (host api.fda.gov; setid 5a8157d3-ba20-4abf-b0d4-6ad141b31d63)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `5a8157d3-ba20-4abf-b0d4-6ad141b31d63` @ `30` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-04-24 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5a8157d3-ba20-4abf-b0d4-6ad141b31d63
- provenance: `{"set_id":"5a8157d3-ba20-4abf-b0d4-6ad141b31d63","version":"30","effective_time":"20260424","payload_sha256":"c8256946915c1d88a43494e57a8beb6d45e4e033d1e21684495fee5ac96eedae","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["boxed_warning[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Concomitant opioid and benzodiazepine/CNS-depressant use risks profound sedation, respiratory depression, and death.
- interaction_exists: `true`
- source_effect: `["profound_sedation","respiratory_depression","coma","death"]`
- label_action: `["reserve_for_inadequate_alternatives","minimise_dose_and_duration","monitor"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_class_statement_with_local_runtime_mapping","directly_supported_members":["oxycodone"],"source_class_terms":["opioids","benzodiazepines","other central nervous system depressants"],"runtime_object_class":"opioid","runtime_object_members":["morphine","oxycodone","fentanyl","tramadol","codeine","hydromorphone","buprenorphine","methadone","tapentadol","pethidine"],"runtime_perpetrator_class":"benzodiazepine_or_z_drug","runtime_perpetrator_members":["diazepam","lorazepam","alprazolam","clonazepam","temazepam","nitrazepam","chlordiazepoxide","oxazepam","midazolam","clobazam","bromazepam","flurazepam","triazolam","clorazepate","estazolam","quazepam","loprazolam","lormetazepam","zolpidem","zopiclone","zaleplon","eszopiclone"],"runtime_class":"opioid+benzodiazepine_or_z_drug","runtime_members":["morphine","oxycodone","fentanyl","tramadol","codeine","hydromorphone","buprenorphine","methadone","tapentadol","pethidine","diazepam","lorazepam","alprazolam","clonazepam","temazepam","nitrazepam","chlordiazepoxide","oxazepam","midazolam","clobazam","bromazepam","flurazepam","triazolam","clorazepate","estazolam","quazepam","loprazolam","lormetazepam","zolpidem","zopiclone","zaleplon","eszopiclone"],"requires_clinician_class_mapping":true,"source_scope_is_not_runtime_roster":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The cited representative label directly identifies oxycodone; it uses opioid, benzodiazepine, and other-CNS-depressant class terms rather than enumerating the local runtime members.
  - The 10-opioid and 22-member benzodiazepine-or-z-drug rosters are local mappings requiring clinician review; z-drugs are mapped from the broader CNS-depressant statement and are not individually named.
  - The evidence does not by itself validate the local runtime severity or workflow action for every mapped pair.
- fragments:
  - [Boxed Warning] (source_path `boxed_warning[0]`; sha256 cc37a94747b60a1a91ed7e8a493c97d19ce4bf8ac4ea04d54cf85fea88338a84) "Concomitant use of opioids with benzodiazepines or other central nervous system (CNS) depressants, including alcohol, may result in profound sedation, respiratory depression, coma, and death. Reserve concomitant prescribing of ROXICODONE and benzodiazepines or other CNS depressants for use in patients for whom alternative treatment options are inadequate [see Warnings and Precautions (5.3), Drug Interactions (7)]."

### opioid__gabapentinoid — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-gabapentin-opioid-respiratory-depression`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — gabapentin | regulator="FDA (United States)" | product="gabapentin" | section: "Warnings and Precautions, Respiratory Depression (5.8)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22c7f21eaa-68ee-420c-9c98-e997cc73a297%22&limit=100 (host api.fda.gov; setid c7f21eaa-68ee-420c-9c98-e997cc73a297)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `c7f21eaa-68ee-420c-9c98-e997cc73a297` @ `3` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2025-05-01 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c7f21eaa-68ee-420c-9c98-e997cc73a297
- provenance: `{"set_id":"c7f21eaa-68ee-420c-9c98-e997cc73a297","version":"3","effective_time":"20250501","payload_sha256":"974f16968dd93447cfcd27fa379adc576775a191c1fec96e329b5ea1ba2b20b0","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Gabapentin can cause respiratory depression with CNS depressants including opioids; monitor and adjust dosage.
- interaction_exists: `true`
- source_effect: `["respiratory_depression"]`
- label_action: `["monitor_patients","adjust_dosage_as_appropriate"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_and_class","object_members":["gabapentin"],"perpetrator_class":"opioids"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This record does not by itself support pregabalin.
- fragments:
  - [Warnings and Precautions, Respiratory Depression (5.8)] (source_path `warnings_and_cautions[0]`; sha256 35b2488a653cace9028ba525b7d256004b1407a0b152955db4751205a3d73030) "Respiratory Depression: May occur with gabapentin when used with concomitant central nervous system (CNS) depressants, including opioids, or in the setting of underlying respiratory impairment. Monitor patients and adjust dosage as appropriate (5.8)"

### opioid__gabapentinoid — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-pregabalin-opioid-respiratory-depression`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — pregabalin extended-release tablets | regulator="FDA (United States)" | product="pregabalin extended-release tablets" | section: "Warnings and Precautions, Respiratory Depression (5.5)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22f6aa5977-97c8-4a56-8e35-d9ab5cc24369%22&limit=100 (host api.fda.gov; setid f6aa5977-97c8-4a56-8e35-d9ab5cc24369)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `f6aa5977-97c8-4a56-8e35-d9ab5cc24369` @ `2` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-06-10 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f6aa5977-97c8-4a56-8e35-d9ab5cc24369
- provenance: `{"set_id":"f6aa5977-97c8-4a56-8e35-d9ab5cc24369","version":"2","effective_time":"20260610","payload_sha256":"b7c06122ea241e14d40868218878ccc706a288357b9f8ec8908a5908ef3d12fd","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]","warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Pregabalin can cause serious, life-threatening, or fatal respiratory depression with CNS depressants including opioids; monitor and consider a low starting dose.
- interaction_exists: `true`
- source_effect: `["serious_life_threatening_or_fatal_respiratory_depression"]`
- label_action: `["monitor_for_respiratory_depression_and_sedation","consider_low_starting_dose"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_exact_product_and_class","object_members":["pregabalin"],"perpetrator_class":"opioids"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This extended-release pregabalin record does not by itself validate every immediate-release formulation or gabapentin.
- fragments:
  - [Warnings and Precautions, Respiratory Depression (5.5)] (source_path `warnings_and_cautions[0]`; sha256 a6c64aabaacf11fce934c6bdba8abd51983ad540cdb61cf8877103c34d82c308) "There is evidence from case reports, human studies, and animal studies associating pregabalin with serious, life-threatening, or fatal respiratory depression when co-administered with central nervous system (CNS) depressants, including opioids, or in the setting of underlying respiratory impairment."
  - [Warnings and Precautions, Respiratory Depression (5.5)] (source_path `warnings_and_cautions[0]`; sha256 0d4607ca2833d54852a22df451d8bf0f63e0fed3727ebd429c2faefae9c1699d) "When the decision is made to co-prescribe pregabalin extended-release tablets with another CNS depressant, particularly an opioid, or to prescribe pregabalin extended-release tablets to patients with underlying respiratory impairment, monitor patients for symptoms of respiratory depression and sedation, and consider initiating pregabalin extended-release tablets at a low dose."

### benzodiazepine_zdrug__alcohol — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `openfda-diazepam-alcohol`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — diazepam (representative benzodiazepine) | regulator="FDA (United States)" | product="diazepam (representative benzodiazepine)" | section: "Warnings"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%2248aa32cb-047a-414a-822e-82a5f26d8817%22&limit=100 (host api.fda.gov; setid 48aa32cb-047a-414a-822e-82a5f26d8817)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `48aa32cb-047a-414a-822e-82a5f26d8817` @ `17` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2024-01-31 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=48aa32cb-047a-414a-822e-82a5f26d8817
- provenance: `{"set_id":"48aa32cb-047a-414a-822e-82a5f26d8817","version":"17","effective_time":"20240131","payload_sha256":"2b235e6b19c54bfe8def9e9a681a6b6e1de88e65191d4a09b83a1f7695e70bc9","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: The diazepam label advises against simultaneous alcohol ingestion because diazepam has a central-nervous-system depressant effect.
- interaction_exists: `true`
- source_effect: `["additive_central_nervous_system_depression"]`
- label_action: `["avoid_concurrent_alcohol"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"extrapolated_class","directly_supported_members":["diazepam"],"runtime_members":["diazepam"],"requires_clinician_extrapolation":false,"object_members":["diazepam"],"perpetrator_members":["substance:alcohol"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The retained fragment does not support runtime expansion to other benzodiazepines or Z-drugs, a respiratory-depression claim, or a hepatic modifier.
- fragments:
  - [Warnings] (source_path `warnings[0]`; sha256 272b46619e1898ba46cf45cdea41c8c48bd0c391dca2cc1d3ba91a2856707f21) "Since diazepam has a central nervous system depressant effect, patients should be advised against the simultaneous ingestion of alcohol and other CNS-depressant drugs during diazepam therapy."

### maoi_nonselective__sympathomimetic — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-parnate-otc-sympathomimetics`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — PARNATE (tranylcypromine) | regulator="FDA (United States)" | product="PARNATE (tranylcypromine)" | section: "Contraindications (4.1), Table 1"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22b72d8187-dfcc-4ea0-b5e9-c0be95b69a27%22&limit=100 (host api.fda.gov; setid b72d8187-dfcc-4ea0-b5e9-c0be95b69a27)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `b72d8187-dfcc-4ea0-b5e9-c0be95b69a27` @ `11` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2025-07-02 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b72d8187-dfcc-4ea0-b5e9-c0be95b69a27
- provenance: `{"set_id":"b72d8187-dfcc-4ea0-b5e9-c0be95b69a27","version":"11","effective_time":"20250702","payload_sha256":"c2bca7fd5685c9c80b57d57384cc2a5244c153b0c08360b8ac2e06300df07c65","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["contraindications_table[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: PARNATE contraindicates sympathomimetic decongestants and explicitly names pseudoephedrine, phenylephrine, and ephedrine.
- interaction_exists: `true`
- source_effect: `["hypertensive_reaction_including_intracerebral_hemorrhage"]`
- label_action: `["contraindicated"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_members","object_members":["tranylcypromine"],"perpetrator_members":["pseudoephedrine","phenylephrine","ephedrine"]}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The matcher cannot distinguish oral decongestant use from topical, nasal, ophthalmic, or procedure-specific exposure.
  - This PARNATE record does not by itself validate the same action for every nonselective MAOI.
- fragments:
  - [Contraindications (4.1), Table 1] (source_path `contraindications_table[0]`; sha256 bf55e749238e07114e936fa21611b568a39ed9cab8c528a415b27d52253fa055) "Sympathomimetic products (e.g., cold, hay fever or weight reducing products that contain vasoconstrictors such as pseudoephedrine, phenylephrine, and ephedrine; or dietary supplements that contain sympathomimetics)"

### maoi_nonselective__direct_sympathomimetic — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-parnate-direct-sympathomimetic-emergency`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — PARNATE (tranylcypromine) | regulator="FDA (United States)" | product="PARNATE (tranylcypromine)" | section: "Warnings and Precautions, Emergency Treatment (5.7)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22b72d8187-dfcc-4ea0-b5e9-c0be95b69a27%22&limit=100 (host api.fda.gov; setid b72d8187-dfcc-4ea0-b5e9-c0be95b69a27)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `b72d8187-dfcc-4ea0-b5e9-c0be95b69a27` @ `11` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2025-07-02 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b72d8187-dfcc-4ea0-b5e9-c0be95b69a27
- provenance: `{"set_id":"b72d8187-dfcc-4ea0-b5e9-c0be95b69a27","version":"11","effective_time":"20250702","payload_sha256":"c2bca7fd5685c9c80b57d57384cc2a5244c153b0c08360b8ac2e06300df07c65","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: PARNATE treats direct-acting sympathomimetics such as epinephrine as contraindicated products and gives a monitored emergency exception.
- interaction_exists: `true`
- source_effect: `["hypertensive_reaction_risk"]`
- label_action: `["contraindicated","emergency_exception_with_close_monitoring"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_and_example","object_members":["tranylcypromine"],"source_named_members":["epinephrine"],"runtime_class":"sympathomimetic_direct_and_indirect","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Dopamine and norepinephrine remain class-mapped rather than directly named by this fragment.
  - Route, emergency setting, and absence of alternatives are not available to the pair matcher.
- fragments:
  - [Warnings and Precautions, Emergency Treatment (5.7)] (source_path `warnings_and_cautions[0]`; sha256 f0b5f6526b01360aefc3f133ab2e5f58040ca05e98e8d09b55d8334d1d421741) "If in the absence of therapeutic alternatives emergency treatment with a contraindicated product (e.g., linezolid, intravenous methylene blue, direct-acting sympathomimetic drugs such as epinephrine) becomes necessary and cannot be delayed, discontinue PARNATE as soon as possible before initiating treatment with the other product and monitor closely for adverse reactions [see Drug Interactions (7.1)]"

### lithium__ssri_snri — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-lithium-serotonergic-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — lithium carbonate | regulator="FDA (United States)" | product="lithium carbonate" | section: "Warnings and Precautions, Serotonin Syndrome (5.6)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%2205312159-3d8a-45e0-99cb-b83a7b200cd3%22&limit=100 (host api.fda.gov; setid 05312159-3d8a-45e0-99cb-b83a7b200cd3)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `05312159-3d8a-45e0-99cb-b83a7b200cd3` @ `15` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-07-06 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=05312159-3d8a-45e0-99cb-b83a7b200cd3
- provenance: `{"set_id":"05312159-3d8a-45e0-99cb-b83a7b200cd3","version":"15","effective_time":"20260706","payload_sha256":"1fd9e808e6e8e6405ea8909c1b22fb33dc3ac2484a49a05863794b1984622805","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]","warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Lithium can precipitate serotonin syndrome, with increased risk from SSRIs and SNRIs; monitor and discontinue lithium plus serotonergic agents if symptoms occur.
- interaction_exists: `true`
- source_effect: `["serotonin_syndrome_risk"]`
- label_action: `["monitor_for_serotonin_syndrome","discontinue_lithium_and_serotonergic_agents_if_symptomatic"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_classes","object_members":["lithium"],"source_classes":["SSRIs","SNRIs"],"runtime_class":"ssri_or_snri","requires_clinician_class_mapping":true}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This evidence does not direct routine lithium-level monitoring as the specific interaction response.
- fragments:
  - [Warnings and Precautions, Serotonin Syndrome (5.6)] (source_path `warnings_and_cautions[0]`; sha256 d7394fce258961aac79f0c6d962e45c9509b1dc7f22a56b195c31235810ad2b2) "Lithium can precipitate serotonin syndrome, a potentially life-threatening condition. The risk is increased with concomitant use of other serotonergic drugs (including selective serotonin reuptake inhibitors, serotonin and norepinephrine reuptake inhibitors, triptans, tricyclic antidepressants, fentanyl, tramadol, tryptophan, buspirone, and St. John's Wort) and with drugs that impair metabolism of serotonin, i.e., MAOIs [see Drug Interactions ( 7.1)]."
  - [Warnings and Precautions, Serotonin Syndrome (5.6)] (source_path `warnings_and_cautions[0]`; sha256 5d1985ef72de9137fa2e08e2ebe3265d71acaff818e66c3910db03855cc49375) "Monitor all patients taking lithium for the emergence of serotonin syndrome. Discontinue treatment with lithium and any concomitant serotonergic agents immediately if the above symptoms occur, and initiate supportive symptomatic treatment."

### bupropion__maoi_nonselective — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-bupropion-maoi-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — bupropion hydrochloride tablets | regulator="FDA (United States)" | product="bupropion hydrochloride tablets" | section: "Drug Interactions, MAO Inhibitors (7.6)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%2288c980c8-aaa8-4378-9ac2-24d588640caa%22&limit=100 (host api.fda.gov; setid 88c980c8-aaa8-4378-9ac2-24d588640caa)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `88c980c8-aaa8-4378-9ac2-24d588640caa` @ `10` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-06-24 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=88c980c8-aaa8-4378-9ac2-24d588640caa
- provenance: `{"set_id":"88c980c8-aaa8-4378-9ac2-24d588640caa","version":"10","effective_time":"20260624","payload_sha256":"171b447621ea55aae13560fb6dc9d0904b22ded58b9956ed7bc5733d91674476","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["drug_interactions[0]","drug_interactions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Bupropion with antidepressant MAOIs is contraindicated because of hypertensive reactions, with 14-day washouts in both directions.
- interaction_exists: `true`
- source_effect: `["hypertensive_reaction_risk"]`
- label_action: `["contraindicated","fourteen_day_washout_each_direction"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"source_named_product_and_class","object_members":["bupropion"],"perpetrator_class":"antidepressant_MAOIs"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The symmetric psychiatric-MAOI rule excludes the label's separate directional linezolid and intravenous-methylene-blue pathways.
- fragments:
  - [Drug Interactions, MAO Inhibitors (7.6)] (source_path `drug_interactions[0]`; sha256 c6f1dca9488064611acc1c20db79fe7a94b884093463237d526d33eabbfeb2e8) "Concomitant use of MAOIs and bupropion is contraindicated because there is an increased risk of hypertensive reactions if bupropion is used concomitantly with MAOIs."
  - [Drug Interactions, MAO Inhibitors (7.6)] (source_path `drug_interactions[0]`; sha256 a90bf4698d47c4327b4b1cbe24e503ea12f944ab6d53dc44d8f97320e91701f6) "At least 14 days should elapse between discontinuation of an MAOI intended to treat depression and initiation of treatment with bupropion hydrochloride tablets. Conversely, at least 14 days should be allowed after stopping bupropion hydrochloride tablets before starting an MAOI antidepressant [see Dosage and Administration (2.4, 2.5), Contraindications (4)]."

### sedating_antihistamine__cns_depressant — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `openfda-diphenhydramine-cns-depressants`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — diphenhydramine hydrochloride | regulator="FDA (United States)" | product="diphenhydramine hydrochloride" | section: "Drug Interactions"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22a1110433-498a-48cb-ac79-5732fd4f8fba%22&limit=100 (host api.fda.gov; setid a1110433-498a-48cb-ac79-5732fd4f8fba)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `a1110433-498a-48cb-ac79-5732fd4f8fba` @ `11` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-03-05 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a1110433-498a-48cb-ac79-5732fd4f8fba
- provenance: `{"set_id":"a1110433-498a-48cb-ac79-5732fd4f8fba","version":"11","effective_time":"20260305","payload_sha256":"74e148593c03853964e4d36fe80b101827e9547ddebdbfc190ce0629148b7896","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["drug_interactions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Diphenhydramine hydrochloride has additive effects with alcohol and other CNS depressants.
- interaction_exists: `true`
- source_effect: `["additive_sedation"]`
- label_action: `["see_normalized_proposition"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"representative_product_plus_source_cns_depressant_class","directly_supported_members":["diphenhydramine"],"source_class_terms":["alcohol","hypnotics","sedatives","tranquilizers"],"runtime_object_class":"sedating_antihistamine","runtime_object_members":["chlorpheniramine","diphenhydramine","promethazine","hydroxyzine","cyproheptadine"],"runtime_perpetrator_class":"cns_depressant","runtime_perpetrator_members":["diazepam","lorazepam","alprazolam","clonazepam","temazepam","nitrazepam","chlordiazepoxide","oxazepam","midazolam","clobazam","bromazepam","flurazepam","triazolam","clorazepate","estazolam","quazepam","loprazolam","lormetazepam","zolpidem","zopiclone","zaleplon","eszopiclone","gabapentin","pregabalin","phenobarbital","baclofen","morphine","oxycodone","fentanyl","tramadol","codeine","hydromorphone","buprenorphine","methadone","tapentadol","pethidine","amitriptyline","clomipramine","imipramine","nortriptyline","alcohol"],"runtime_class":"sedating_antihistamine+cns_depressant","runtime_members":["chlorpheniramine","diphenhydramine","promethazine","hydroxyzine","cyproheptadine","diazepam","lorazepam","alprazolam","clonazepam","temazepam","nitrazepam","chlordiazepoxide","oxazepam","midazolam","clobazam","bromazepam","flurazepam","triazolam","clorazepate","estazolam","quazepam","loprazolam","lormetazepam","zolpidem","zopiclone","zaleplon","eszopiclone","gabapentin","pregabalin","phenobarbital","baclofen","morphine","oxycodone","fentanyl","tramadol","codeine","hydromorphone","buprenorphine","methadone","tapentadol","pethidine","amitriptyline","clomipramine","imipramine","nortriptyline","alcohol"],"requires_clinician_class_mapping":true,"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source directly supports only the representative antihistamine named in this record and uses CNS-depressant class terms or examples rather than enumerating the runtime roster.
  - The five-antihistamine and 41-member CNS-depressant rosters are local mappings requiring clinician review; not every runtime member is source-named.
  - Route and formulation are not matcher-gateable, so this expanded class mapping remains diagnostic-only.
- fragments:
  - [Drug Interactions] (source_path `drug_interactions[0]`; sha256 bb1c57abf114c995ddbb1085fcf1ab2a15fba4aa7ba0d1f8ee5391f2a02e76d0) "Diphenhydramine hydrochloride has additive effects with alcohol and other CNS depressants (hypnotics, sedatives, tranquilizers, etc)."

### sedating_antihistamine__cns_depressant — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `openfda-promethazine-cns-depressants`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — promethazine hydrochloride tablets, USP | regulator="FDA (United States)" | product="promethazine hydrochloride tablets, USP" | section: "Drug Interactions"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%2244cd6d46-fbb9-4836-9426-d8ce2cb6d66d%22&limit=100 (host api.fda.gov; setid 44cd6d46-fbb9-4836-9426-d8ce2cb6d66d)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `44cd6d46-fbb9-4836-9426-d8ce2cb6d66d` @ `9` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2025-09-12 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=44cd6d46-fbb9-4836-9426-d8ce2cb6d66d
- provenance: `{"set_id":"44cd6d46-fbb9-4836-9426-d8ce2cb6d66d","version":"9","effective_time":"20250912","payload_sha256":"b44f189d53b35bce397910a3c8c32bd3515c2701858d010b7455795577ee4f5d","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["drug_interactions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Promethazine hydrochloride may increase, prolong, or intensify the sedative action of named central-nervous-system depressants.
- interaction_exists: `true`
- source_effect: `["additive_sedation"]`
- label_action: `["see_normalized_proposition"]`
- runtime_severity_is_local_mapping: `true`
- scope: `{"scope_type":"representative_product_plus_source_cns_depressant_class","directly_supported_members":["promethazine"],"source_class_terms":["alcohol","sedatives/hypnotics","barbiturates","narcotics and narcotic analgesics","general anesthetics","tricyclic antidepressants","tranquilizers"],"runtime_object_class":"sedating_antihistamine","runtime_object_members":["chlorpheniramine","diphenhydramine","promethazine","hydroxyzine","cyproheptadine"],"runtime_perpetrator_class":"cns_depressant","runtime_perpetrator_members":["diazepam","lorazepam","alprazolam","clonazepam","temazepam","nitrazepam","chlordiazepoxide","oxazepam","midazolam","clobazam","bromazepam","flurazepam","triazolam","clorazepate","estazolam","quazepam","loprazolam","lormetazepam","zolpidem","zopiclone","zaleplon","eszopiclone","gabapentin","pregabalin","phenobarbital","baclofen","morphine","oxycodone","fentanyl","tramadol","codeine","hydromorphone","buprenorphine","methadone","tapentadol","pethidine","amitriptyline","clomipramine","imipramine","nortriptyline","alcohol"],"runtime_class":"sedating_antihistamine+cns_depressant","runtime_members":["chlorpheniramine","diphenhydramine","promethazine","hydroxyzine","cyproheptadine","diazepam","lorazepam","alprazolam","clonazepam","temazepam","nitrazepam","chlordiazepoxide","oxazepam","midazolam","clobazam","bromazepam","flurazepam","triazolam","clorazepate","estazolam","quazepam","loprazolam","lormetazepam","zolpidem","zopiclone","zaleplon","eszopiclone","gabapentin","pregabalin","phenobarbital","baclofen","morphine","oxycodone","fentanyl","tramadol","codeine","hydromorphone","buprenorphine","methadone","tapentadol","pethidine","amitriptyline","clomipramine","imipramine","nortriptyline","alcohol"],"requires_clinician_class_mapping":true,"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping"}`
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source directly supports only the representative antihistamine named in this record and uses CNS-depressant class terms or examples rather than enumerating the runtime roster.
  - The five-antihistamine and 41-member CNS-depressant rosters are local mappings requiring clinician review; not every runtime member is source-named.
  - Route and formulation are not matcher-gateable, so this expanded class mapping remains diagnostic-only.
- fragments:
  - [Drug Interactions] (source_path `drug_interactions[0]`; sha256 8c56dcfd5f68a0d532f2b143940e7a7468175402f8165dc895a9849b0f557fd8) "Promethazine hydrochloride tablets, USP may increase, prolong, or intensify the sedative action of other central-nervous-system depressants, such as alcohol, sedatives/hypnotics (including barbiturates), narcotics, narcotic analgesics, general anesthetics, tricyclic antidepressants, and tranquilizers"

## Remaining sign-off signals (auto-derived)

1. Records whose scope sets `requires_clinician_class_mapping:true`: **10** — tramadol__serotonergic_antidepressant[0], tramadol__ssri_tca_seizure_risk[0], linezolid__serotonergic_agent[0], triptan_mao_metabolized__maoi_mao_a[0], dextromethorphan__ssri_snri[0], opioid__benzodiazepine_cns_depressant[0], maoi_nonselective__direct_sympathomimetic[0], lithium__ssri_snri[0], sedating_antihistamine__cns_depressant[0], sedating_antihistamine__cns_depressant[1].
2. Records whose `currentness_status` does not start with `checked_current`: **0**.
3. Records whose `citation_status` contains `discrepancy`: **0**.
4. Per-record `does_not_by_itself_support` entries above are reproduced from the JSONL and require review as written.
