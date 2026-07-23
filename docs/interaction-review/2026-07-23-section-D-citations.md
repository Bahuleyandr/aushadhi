# Section D — citation sign-off worksheet

**16 evidence records** across **14 rules**, containing **36 hashed fragments**. This worksheet deterministically formats the existing evidence fields; it does not add or revise clinical claims.

Machine-generated from enriched evidence. Citation status and clinician-review state are reported exactly as stored in the JSONL.

- Section: `D`
- JSONL SHA-256: `ef4b282bb497f2981c0f7f54f6e6a6f3884b6167a7da068aaffbcc6248c6d6e6`
- Commit: `worktree-uncommitted`
- citation_status: `{"machine_confirmed_govuk_ogl_bound_pending_clinician":3,"machine_confirmed_openfda_reconciled_pending_clinician":13}`

### qt_macrolide__qt_prolonging_drug — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-clarithromycin`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — clarithromycin | regulator="FDA (United States)" | product="clarithromycin" | section: "Warnings and Precautions"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22cde51c9f-f7b8-413f-8b8e-e56370cd5754%22&limit=100 (host api.fda.gov; setid cde51c9f-f7b8-413f-8b8e-e56370cd5754)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `cde51c9f-f7b8-413f-8b8e-e56370cd5754` @ `9` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2023-05-26 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=cde51c9f-f7b8-413f-8b8e-e56370cd5754
- provenance: `{"set_id":"cde51c9f-f7b8-413f-8b8e-e56370cd5754","version":"9","effective_time":"20230526","payload_sha256":"c19a863ea5655562aeb99d3bd09f3697f17d7cf786746d28eb740ccec62aeecd","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Clarithromycin has been associated with QT prolongation, arrhythmia, torsades de pointes, and reported fatalities.
- interaction_exists: `true`
- source_effect: `["qt_prolongation","torsades_reported","fatalities_reported"]`
- label_action: `[]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"extrapolated_class","directly_supported_members":["clarithromycin"],"runtime_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"requires_clinician_extrapolation":true,"object_members":["clarithromycin","erythromycin","azithromycin"],"perpetrator_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"runtime_class":"qt_prolonging_drug","requires_clinician_class_mapping":true,"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping","source_scope_boundary":["clarithromycin"]}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - this excerpt states the QT/torsades RISK (effect) but no explicit label ACTION — a separate action fragment is needed for a label_action
  - The qt_prolonging_drug runtime roster is a local diagnostic mapping; the source fragment does not name or validate every runtime member.
- fragments:
  - [Warnings and Precautions] (source_path `warnings_and_cautions[0]`; sha256 0f9e18c6abfeac8bc0add3276980b4e107360daae6300b4609f6a99a4fadd9e4) "Clarithromycin tablets have been associated with prolongation of the QT interval and infrequent cases of arrhythmia. Cases of torsades de pointes have been spontaneously reported during postmarketing surveillance in patients receiving clarithromycin tablets. Fatalities have been reported."

### qt_macrolide__qt_prolonging_drug — evidence[1] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-erythromycin`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — erythromycin | regulator="FDA (United States)" | product="erythromycin" | section: "Warnings and Precautions"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22933049f6-61b9-4ed5-b6b7-60c5037e2115%22&limit=100 (host api.fda.gov; setid 933049f6-61b9-4ed5-b6b7-60c5037e2115)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `933049f6-61b9-4ed5-b6b7-60c5037e2115` @ `11` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-03-05 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=933049f6-61b9-4ed5-b6b7-60c5037e2115
- provenance: `{"set_id":"933049f6-61b9-4ed5-b6b7-60c5037e2115","version":"11","effective_time":"20260305","payload_sha256":"662917ae32bf17ca47f697161bfc1daa327526fb9728edbb8daf5976380fc3a5","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: Erythromycin has been associated with QT prolongation and torsades, and its label advises avoidance with named Class IA and III antiarrhythmics.
- interaction_exists: `true`
- source_effect: `["qt_prolongation","torsades_reported","fatalities_reported"]`
- label_action: `["avoid"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"extrapolated_class","directly_supported_members":["erythromycin"],"runtime_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"requires_clinician_extrapolation":true,"object_members":["clarithromycin","erythromycin","azithromycin"],"perpetrator_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"runtime_class":"qt_prolonging_drug","requires_clinician_class_mapping":true,"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping","source_scope_boundary":["erythromycin"]}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This evidence does not by itself validate the local runtime severity, workflow action, or every extrapolated class member.
  - The qt_prolonging_drug runtime roster is a local diagnostic mapping; the source fragment does not name or validate every runtime member.
- fragments:
  - [Warnings and Precautions] (source_path `warnings[0]`; sha256 d580b956837ddc3d6e2e434f1f54fbbba5f582313e4dc03b900e8a3b8aa0d974) "Erythromycin has been associated with prolongation of the QT interval and infrequent cases of arrhythmia. Cases of torsades de pointes have been spontaneously reported during postmarketing surveillance in patients receiving erythromycin. Fatalities have been reported. Erythromycin should be avoided in patients with known prolongation of the QT interval, patients with ongoing proarrhythmic conditions such as uncorrected hypokalemia or hypomagnesemia, clinically significant bradycardia, and in patients receiving Class IA (quinidine, procainamide) or Class III (dofetilide, amiodarone, sotalol) antiarrhythmic agents."

### qt_macrolide__qt_prolonging_drug — evidence[2] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-azithromycin`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — azithromycin | regulator="FDA (United States)" | product="azithromycin" | section: "Warnings and Precautions"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22db52b91e-79f7-4cc1-9564-f2eee8e31c45%22&limit=100 (host api.fda.gov; setid db52b91e-79f7-4cc1-9564-f2eee8e31c45)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `db52b91e-79f7-4cc1-9564-f2eee8e31c45` @ `48` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-01-07 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=db52b91e-79f7-4cc1-9564-f2eee8e31c45
- provenance: `{"set_id":"db52b91e-79f7-4cc1-9564-f2eee8e31c45","version":"48","effective_time":"20260107","payload_sha256":"c2685e743c2b1fca5c3862fb87a4a452c366876d280ef0f18e31eae9a4e109f1","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: QT prolongation, cardiac arrhythmia risk, and torsades de pointes have been seen with macrolides including azithromycin.
- interaction_exists: `true`
- source_effect: `["qt_prolongation","torsades_reported"]`
- label_action: `[]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"extrapolated_class","directly_supported_members":["azithromycin"],"runtime_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"requires_clinician_extrapolation":true,"object_members":["clarithromycin","erythromycin","azithromycin"],"perpetrator_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"runtime_class":"qt_prolonging_drug","requires_clinician_class_mapping":true,"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping","source_scope_boundary":["azithromycin"]}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - this excerpt states the QT/torsades RISK (effect) but no explicit label ACTION — a separate action fragment is needed for a label_action
  - The qt_prolonging_drug runtime roster is a local diagnostic mapping; the source fragment does not name or validate every runtime member.
- fragments:
  - [Warnings and Precautions] (source_path `warnings_and_cautions[0]`; sha256 4c431aa99667cc09047f2b0cd46a15b56dd95eaaeba76321d6e7f160422ec2a5) "Prolonged cardiac repolarization and QT interval, imparting a risk of developing cardiac arrhythmia and torsades de pointes, have been seen with treatment with macrolides, including azithromycin."

### citalopram__qt_prolonging_drug — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `openfda-citalopram-qt-dose`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — citalopram hydrobromide | regulator="FDA (United States)" | product="citalopram hydrobromide" | section: "Warnings and Precautions"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22fd761647-e16b-45b3-a4bc-364de0ed7015%22&limit=100 (host api.fda.gov; setid fd761647-e16b-45b3-a4bc-364de0ed7015)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `fd761647-e16b-45b3-a4bc-364de0ed7015` @ `9` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2023-09-07 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fd761647-e16b-45b3-a4bc-364de0ed7015
- provenance: `{"set_id":"fd761647-e16b-45b3-a4bc-364de0ed7015","version":"9","effective_time":"20230907","payload_sha256":"c0b4d8007c86d870b128b056fc7b6596093f37c51808891db3b7a54e4ace32a0","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings[0]","warnings[0]","warnings[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Citalopram causes dose-dependent QTc prolongation; the retained label limits dosing to 40 mg/day generally and 20 mg/day for CYP2C19 poor metabolizers or patients taking cimetidine or another CYP2C19 inhibitor.
- interaction_exists: `true`
- source_effect: `["dose_dependent_qt_prolongation","torsades_reported"]`
- label_action: `["dose_ceiling_40mg","dose_ceiling_20mg_cyp2c19_higher_exposure"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"explicit_class_statement","object_members":["citalopram"],"source_class_term":"QT_prolonging_drugs","source_examples":["citalopram","cimetidine"],"runtime_class":"qt_prolonging_drug","requires_clinician_class_mapping":true,"runtime_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"perpetrator_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping","source_scope_boundary":"QT_prolonging_drugs"}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The retained fragments do not provide a blanket avoid-with-other-QT-drugs action, an ECG/electrolyte protocol, or a 20 mg/day ceiling based on age or hepatic impairment.
  - The local QT-drug runtime roster and Major severity remain diagnostic mappings pending clinician review.
- fragments:
  - [Warnings and Precautions] (source_path `warnings[0]`; sha256 ce1af6d7998ad91290d3e9409d13b24ccc76889c7cc8a174514e53303ad33442) "Citalopram causes dose-dependent QTc prolongation, an ECG abnormality that has been associated with Torsade de Pointes (TdP), ventricular tachycardia, and sudden death"
  - [Warnings and Precautions] (source_path `warnings[0]`; sha256 a8a361fdd7f1506e5f09f13f536e1c0ba5782e0fbb97dcebb96f912ecec5e3cb) "Because of the risk of QTc prolongation at higher citalopram doses, it is recommended that citalopram should not be given at doses above 40 mg/day."
  - [Warnings and Precautions] (source_path `warnings[0]`; sha256 1eb5fca8023bb0e7f2ff5ae8daffbbb847dea1c391e9b18561dd49c7d8faaab5) "The maximum dose should be limited to 20 mg/day in patients who are CYP2C19 poor metabolizers or those patients who may be taking concomitant cimetidine or another CYP2C19 inhibitor"

### escitalopram__qt_prolonging_drug — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-escitalopram-qt`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — escitalopram oxalate | regulator="FDA (United States)" | product="escitalopram oxalate" | section: "Warnings and Precautions"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%229c68f89b-1d34-4735-9631-817f012935d7%22&limit=100 (host api.fda.gov; setid 9c68f89b-1d34-4735-9631-817f012935d7)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `9c68f89b-1d34-4735-9631-817f012935d7` @ `13` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-03-11 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9c68f89b-1d34-4735-9631-817f012935d7
- provenance: `{"set_id":"9c68f89b-1d34-4735-9631-817f012935d7","version":"13","effective_time":"20260311","payload_sha256":"79c5982ed1bc848adf668a3dc8f3f8953989b945c614435bf6a1d3c0dd213bbb","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["adverse_reactions[0]","adverse_reactions[0]","adverse_reactions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Escitalopram labeling reports QT prolongation, torsades de pointes, and ventricular arrhythmias; the retained fragments do not provide a blanket co-administration action.
- interaction_exists: `true`
- source_effect: `["dose_related_qtc_prolongation","torsades_reported"]`
- label_action: `[]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"exact_members","object_members":["escitalopram"],"source_named_members":["escitalopram"],"runtime_class":"qt_prolonging_drug","runtime_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"perpetrator_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"requires_clinician_class_mapping":true,"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping","source_scope_boundary":["escitalopram"]}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The retained fragments do not establish a blanket avoid or contraindicate instruction with other QT-prolonging drugs.
  - The retained fragments do not establish a QT-specific co-administration dose limit or monitoring protocol.
  - The local QT-drug runtime roster and Major severity remain diagnostic mappings pending clinician review.
- fragments:
  - [Warnings and Precautions] (source_path `adverse_reactions[0]`; sha256 a95641f8246af63a2c99249d9cda0ec31c46787f6b19c36bee3e0ac7160ca3c1) "The maximum mean (95% upper confidence bound) difference from placebo arm were 4.5 (6.4) and 10.7 (12.7) msec for 10 mg and supratherapeutic 30 mg escitalopram given once daily, respectively."
  - [Warnings and Precautions] (source_path `adverse_reactions[0]`; sha256 605b267fcc2756722349f0452a838d9b6ff2b9deacb77504fe3f0f616fb8bed3) "atrial fibrillation, bradycardia, cardiac failure, myocardial infarction, tachycardia, torsade de pointes, ventricular arrhythmia, ventricular tachycardia."
  - [Warnings and Precautions] (source_path `adverse_reactions[0]`; sha256 95ba90b1a13ee806ace749567c52f54fe52d242a6892ac1efef8f28ca58b352f) "electrocardiogram QT prolongation"

### domperidone__potent_cyp3a4_inhibitor — evidence[0] — `machine_confirmed_govuk_ogl_bound_pending_clinician`

- source_id: `mhra-govuk-domperidone-potent-cyp3a4-contraindication`
- source: Medicines and Healthcare products Regulatory Agency on GOV.UK | regulator="MHRA" | product="domperidone" | section: "Advice for healthcare professionals, Contraindications"
- url: https://www.gov.uk/drug-safety-update/domperidone-risks-of-cardiac-side-effects (host gov.uk)
- policy: `mhra-govuk-drug-safety-updates` / `interaction-evidence` | licence: `OGL-3.0`
- document: `domperidone-risks-of-cardiac-side-effects` @ `2014-12-11T14:37:02+00:00` | retrieved: 2026-07-23 | jurisdiction: `UK`
- date: 2014-12-11 (`regulatory_safety_update`) | accessed: 2026-07-23
- attribution: Contains public sector information licensed under the Open Government Licence v3.0.
- provenance: `{"page_licence":"OGL-3.0","document_sha256":"9a597cd640051e543c6d3372d288d1cd20226707a0a5bf51f59d86fa44893fbf","payload_url":"https://www.gov.uk/api/content/drug-safety-update/domperidone-risks-of-cardiac-side-effects"}`
- currentness: `checked_current_govuk_ogl` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: MHRA states that domperidone is contraindicated in people receiving potent CYP3A4 inhibitors.
- interaction_exists: `true`
- source_effect: `["increased_serious_cardiac_side_effect_risk"]`
- label_action: `["contraindicated"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"source_class_statement","object_members":["domperidone"],"source_class_term":"potent_CYP3A4_inhibitors","runtime_class":"cyp3a4_inhibitor","requires_clinician_class_mapping":true}
- jurisdictions: `["UK"]`
- does NOT by itself support:
  - The local strong-inhibitor roster is a clinician-reviewed class mapping.
  - This open-government safety update does not enumerate individual potent CYP3A4 inhibitors.
- fragments:
  - [Advice for healthcare professionals, Contraindications] (source_path `details.body`; sha256 178f64924527435cfdfec2804a73cc4ac8b8eaf0dfea0f0bc5b5703d5ff8f098) "Domperidone is now contraindicated in people:"
  - [Advice for healthcare professionals, Contraindications] (source_path `details.body`; sha256 85379b2febdc3703b7ab658542d82c760ff20f02e891287280dc4076f13de2e3) "receiving other medications known to prolong QT interval or potent CYP3A4 inhibitors"

### domperidone__moderate_cyp3a4_inhibitor — evidence[0] — `machine_confirmed_govuk_ogl_bound_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `mhra-govuk-domperidone-cyp3a4-cardiac-risk`
- source: Medicines and Healthcare products Regulatory Agency on GOV.UK | regulator="MHRA" | product="domperidone" | section: "Domperidone and cardiac risk"
- url: https://www.gov.uk/drug-safety-update/domperidone-risks-of-cardiac-side-effects (host gov.uk)
- policy: `mhra-govuk-drug-safety-updates` / `interaction-evidence` | licence: `OGL-3.0`
- document: `domperidone-risks-of-cardiac-side-effects` @ `2014-12-11T14:37:02+00:00` | retrieved: 2026-07-23 | jurisdiction: `UK`
- date: 2014-12-11 (`regulatory_safety_update`) | accessed: 2026-07-23
- attribution: Contains public sector information licensed under the Open Government Licence v3.0.
- provenance: `{"page_licence":"OGL-3.0","document_sha256":"9a597cd640051e543c6d3372d288d1cd20226707a0a5bf51f59d86fa44893fbf","payload_url":"https://www.gov.uk/api/content/drug-safety-update/domperidone-risks-of-cardiac-side-effects"}`
- currentness: `checked_current_govuk_ogl` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: MHRA reports higher cardiac risk when CYP3A4 inhibitors are used at the same time as domperidone.
- interaction_exists: `true`
- source_effect: `["increased_serious_cardiac_side_effect_risk"]`
- label_action: `[]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"source_class_statement_with_manual_member_locator","object_members":["domperidone"],"source_class_term":"CYP3A4_inhibitors","runtime_class":"cyp3a4_inhibitor","runtime_members":["diltiazem","verapamil"],"requires_clinician_class_mapping":true}
- jurisdictions: `["UK"]`
- does NOT by itself support:
  - The open-government source gives no member-specific action for diltiazem or verapamil; no machine action is supported.
  - The exact member locator comes from restricted product information and is retained only for manual review; no restricted quotation is stored.
  - The local Major severity remains a diagnostic mapping and must not be pharmacist-facing without licensed-source confirmation.
- fragments:
  - [Domperidone and cardiac risk] (source_path `details.body`; sha256 eb43619b83588dca242631b4c070550e90603afc2952c2664eb2bb09b1bb0503) "A higher risk was observed particularly in people older than 60 years, people taking daily oral domperidone doses of more than 30 mg, and those taking QT-prolonging medicines or CYP3A4 inhibitors at the same time as domperidone."

### domperidone__qt_prolonging_drug — evidence[0] — `machine_confirmed_govuk_ogl_bound_pending_clinician`

- source_id: `mhra-govuk-domperidone-qt-contraindication-2026`
- source: Medicines and Healthcare products Regulatory Agency on GOV.UK | regulator="MHRA" | product="domperidone" | section: "Reminder of existing domperidone advice"
- url: https://www.gov.uk/drug-safety-update/domperidone-new-contraindication-in-patients-with-phaeochromocytoma-due-to-the-risk-of-severe-hypertension (host gov.uk)
- policy: `mhra-govuk-drug-safety-updates` / `interaction-evidence` | licence: `OGL-3.0`
- document: `domperidone-new-contraindication-in-patients-with-phaeochromocytoma-due-to-the-risk-of-severe-hypertension` @ `2026-07-21T14:00:37+01:00` | retrieved: 2026-07-23 | jurisdiction: `UK`
- date: 2026-07-21 (`regulatory_safety_update`) | accessed: 2026-07-23
- attribution: Contains public sector information licensed under the Open Government Licence v3.0.
- provenance: `{"page_licence":"OGL-3.0","document_sha256":"8f9d3a275610ade302be000834701ea60f27926c809196bb4a8d863fbe9971db","payload_url":"https://www.gov.uk/api/content/drug-safety-update/domperidone-new-contraindication-in-patients-with-phaeochromocytoma-due-to-the-risk-of-severe-hypertension"}`
- currentness: `checked_current_govuk_ogl` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: The current MHRA reminder states that domperidone is contraindicated with other medicines known to prolong QT.
- interaction_exists: `true`
- source_effect: `["qt_prolongation_serious_ventricular_arrhythmia_and_sudden_cardiac_death_risk"]`
- label_action: `["contraindicated"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"source_class_statement_with_local_roster","object_members":["domperidone"],"source_class_term":"medications_known_to_prolong_QT_interval","runtime_class":"qt_prolonging_drug","runtime_members":["disopyramide","hydroquinidine","quinidine","amiodarone","dofetilide","dronedarone","ibutilide","sotalol","haloperidol","pimozide","sertindole","citalopram","escitalopram","erythromycin","levofloxacin","moxifloxacin","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","methadone"],"requires_clinician_class_mapping":true}
- jurisdictions: `["UK"]`
- does NOT by itself support:
  - The machine evidence supports the QT-prolonging-drug class contraindication but does not enumerate the local runtime roster.
  - The exact roster was reviewed through restricted product information as a manual locator only; no restricted source text is stored as machine evidence.
  - Apomorphine and clarithromycin exclusions require clinician review; clarithromycin is separately covered by the potent-CYP3A4 rule.
- fragments:
  - [Reminder of existing domperidone advice] (source_path `details.body`; sha256 f3d0ae10efa648f63e6d84356b8b9b45cf8d86705ef3c0245edbb7c3bacae641) "domperidone is contraindicated in people receiving other medications known to prolong QT interval or potent CYP3A4 inhibitors"

### ondansetron__apomorphine — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-apomorphine`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — apomorphine hydrochloride | regulator="FDA (United States)" | product="apomorphine hydrochloride" | section: "Contraindications; Drug Interactions (7.1)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22aedf70e4-1949-44bc-bf1b-0f282c4f0705%22&limit=100 (host api.fda.gov; setid aedf70e4-1949-44bc-bf1b-0f282c4f0705)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `aedf70e4-1949-44bc-bf1b-0f282c4f0705` @ `1` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2022-02-24 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=aedf70e4-1949-44bc-bf1b-0f282c4f0705
- provenance: `{"set_id":"aedf70e4-1949-44bc-bf1b-0f282c4f0705","version":"1","effective_time":"20220224","payload_sha256":"cf23d2b38e30e56170659d21807e44246df37283d7f42875f8fb34cc6bbbd111","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["contraindications[0]","drug_interactions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Concomitant apomorphine and ondansetron is contraindicated because profound hypotension and loss of consciousness have been reported.
- interaction_exists: `true`
- source_effect: `["profound_hypotension","loss_of_consciousness"]`
- label_action: `["contraindicated"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"exact_members","object_members":["ondansetron"],"perpetrator_members":["apomorphine"],"source_product_route":["subcutaneous"],"runtime_routes":{"ondansetron":["oral","iv"],"apomorphine":["subcutaneous"]}}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source contraindicates a broader 5-HT3-antagonist class, but this rule intentionally retains only the exact ondansetron/apomorphine pair.
  - The source product is subcutaneous apomorphine; this evidence does not support the prior sublingual route.
  - The source does not identify which medicine is newly initiated, so no side-specific action target is emitted.
- fragments:
  - [Contraindications] (source_path `contraindications[0]`; sha256 e200134bcb0d41d5a0a9d72da56a35e1a7596bb4e14b4d59d1f38b5f7c640646) "There have been reports of profound hypotension and loss of consciousness when apomorphine hydrocloride was administered with ondansetron."
  - [Drug Interactions, 5HT3 Antagonists (7.1)] (source_path `drug_interactions[0]`; sha256 871cb19cd49e2acfb0ba36db844070298a664ae0e8851f2a0ba21bbb1ac7b43b) "Based on reports of profound hypotension and loss of consciousness when apomorphine hydrocloride was administered with ondansetron, the concomitant use of apomorphine hydrocloride with 5HT 3 antagonists including antiemetics (for example, ondansetron, granisetron, dolasetron, palonosetron) and alosetron, is contraindicated."

### ondansetron__qt_prolonging_drug — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-ondansetron-qt-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — ondansetron orally disintegrating tablets | regulator="FDA (United States)" | product="ondansetron orally disintegrating tablets" | section: "Warnings and Precautions, QT Prolongation (5.2)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22c83821ad-822e-47dc-8108-612312cf3a16%22&limit=100 (host api.fda.gov; setid c83821ad-822e-47dc-8108-612312cf3a16)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `c83821ad-822e-47dc-8108-612312cf3a16` @ `2` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-05-04 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c83821ad-822e-47dc-8108-612312cf3a16
- provenance: `{"set_id":"c83821ad-822e-47dc-8108-612312cf3a16","version":"2","effective_time":"20260504","payload_sha256":"80f17054fda2812bb984a90bdf8df43d38ecb1a72038556d68607f01541e48a5","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]","warnings_and_cautions[0]","warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Ondansetron can prolong QT and has postmarketing torsade reports; ECG monitoring is recommended with other QT-prolonging medicines or additional cardiac risk factors.
- interaction_exists: `true`
- source_effect: `["qt_prolongation","torsade_de_pointes_reported"]`
- label_action: `["ecg_monitoring_recommended"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"source_named_product_and_class","object_members":["ondansetron"],"source_class_term":"other_medicinal_products_that_lead_to_QT_prolongation","runtime_class":"qt_prolonging_drug","requires_clinician_class_mapping":true,"source_scope_boundary":"other_medicinal_products_that_lead_to_QT_prolongation","runtime_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"perpetrator_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping"}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The source recommends ECG monitoring rather than a universal contraindication with every QT-prolonging medicine.
  - The local Major severity and runtime roster are local mappings.
  - The qt_prolonging_drug runtime roster is a local diagnostic mapping; the source fragment does not name or validate every runtime member.
- fragments:
  - [Warnings and Precautions, QT Prolongation (5.2)] (source_path `warnings_and_cautions[0]`; sha256 1d096c691ae70b901daa9d055119a6efd23a4eaccc1b7721c01722558025c415) "Electrocardiogram (ECG) changes, including QT interval prolongation have been seen in patients receiving ondansetron."
  - [Warnings and Precautions, QT Prolongation (5.2)] (source_path `warnings_and_cautions[0]`; sha256 8b9bc236ce6499f5650988a81c237add20bc4937e8db3b22a1a2787189a03828) "In addition, postmarketing cases of Torsade de Pointes have been reported in patients using ondansetron."
  - [Warnings and Precautions, QT Prolongation (5.2)] (source_path `warnings_and_cautions[0]`; sha256 ebf8700716b0f246c86095f6fc669a91e20fb03d919721c89eef758aa02dd0af) "ECG monitoring is recommended in patients with electrolyte abnormalities (e.g., hypokalemia or hypomagnesemia), congestive heart failure, bradyarrhythmias, or patients taking other medicinal products that lead to QT prolongation [see Clinical Pharmacology (12.2)]."

### haloperidol_iv_or_above_recommended_dose__qt_prolonging_drug — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-haloperidol`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — haloperidol | regulator="FDA (United States)" | product="haloperidol" | section: "Warnings"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22e69578b5-3e98-4fc6-a5ad-61e8ec4cb8c1%22&limit=100 (host api.fda.gov; setid e69578b5-3e98-4fc6-a5ad-61e8ec4cb8c1)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `e69578b5-3e98-4fc6-a5ad-61e8ec4cb8c1` @ `2` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2013-05-06 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e69578b5-3e98-4fc6-a5ad-61e8ec4cb8c1
- provenance: `{"set_id":"e69578b5-3e98-4fc6-a5ad-61e8ec4cb8c1","version":"2","effective_time":"20130506","payload_sha256":"973be788189838194197d8782c1f6482d222051e3dff4f40d834a4fb88354009","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings[0]","warnings[0]","warnings[0]","warnings[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Intravenous haloperidol and higher-than-recommended doses of any formulation are associated with higher QT/torsades risk; ECG monitoring is directed if haloperidol is administered intravenously.
- interaction_exists: `true`
- source_effect: `["qt_prolongation","torsades","sudden_death"]`
- label_action: `["ecg_monitoring_if_administered_intravenously"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"drug_condition","object_members":["haloperidol"],"condition":"intravenous_route; higher_than_recommended_dose_retained_as_non_executable_source_context","runtime_class":"qt_prolonging_drug","runtime_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"perpetrator_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"requires_clinician_class_mapping":true,"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping","source_scope_boundary":["haloperidol"]}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Ordinary intramuscular haloperidol at a recommended dose does not belong in the intravenous or above-recommended-dose branch.
  - Dose is not an executable matcher input, so the source-supported above-recommended-dose branch is not represented as a runtime selector.
  - The qt_prolonging_drug runtime roster is a local diagnostic mapping; the source fragment does not name or validate every runtime member.
- fragments:
  - [Warnings] (source_path `warnings[0]`; sha256 7b7d4b44c9199f0255721d6c112e1e4892f7b2ca6da4a778d1b9c1ded09ec9d3) "Cases of sudden death, QT-prolongation, and Torsades de Pointes have been reported in patients receiving haloperidol."
  - [Warnings] (source_path `warnings[0]`; sha256 a61015b23d7bf2bcb1d9c4558bd250c842fe8260d1196f09d08d82345c68ff16) "Higher than recommended doses of any formulation and intravenous administration of haloperidol appear to be associated with a higher risk of QT-prolongation and Torsades de Pointes."
  - [Warnings] (source_path `warnings[0]`; sha256 34cbdde2d0e6c950925f7a70c0721f844c9072a5a452ad484ed54a57ce56a6b0) "If HALOPERIDOL is administered intravenously, the ECG should be monitored for QT prolongation and arrhythmias."
  - [Warnings] (source_path `warnings[0]`; sha256 0beb9d2f87fd1590b7924e3eed753980d84e23f7ab22e5325d00a36e2d75e6e5) "HALOPERIDOL INJECTION IS NOT APPROVED FOR INTRAVENOUS ADMINISTRATION."

### haloperidol_oral__qt_prolonging_drug — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-haloperidol`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — haloperidol | regulator="FDA (United States)" | product="haloperidol" | section: "Warnings"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22c559b0b0-4087-d12a-e718-c18ccb6811e6%22&limit=100 (host api.fda.gov; setid c559b0b0-4087-d12a-e718-c18ccb6811e6)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `c559b0b0-4087-d12a-e718-c18ccb6811e6` @ `22` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2025-01-15 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c559b0b0-4087-d12a-e718-c18ccb6811e6
- provenance: `{"set_id":"c559b0b0-4087-d12a-e718-c18ccb6811e6","version":"22","effective_time":"20250115","payload_sha256":"19513be8fbdac4c07a9dcf71d2dc237f9b6742add97ec4ce93b1e5e1133782d6","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `single_verbatim`
- proposition: The haloperidol label advises particular caution with other QT-prolonging conditions, including drugs known to prolong QT.
- interaction_exists: `true`
- source_effect: `["qt_prolongation","torsades_reported","fatalities_reported"]`
- label_action: `["use_with_caution"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"extrapolated_class","directly_supported_members":["haloperidol"],"runtime_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"requires_clinician_extrapolation":true,"object_members":["haloperidol"],"perpetrator_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"runtime_class":"qt_prolonging_drug","requires_clinician_class_mapping":true,"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping","source_scope_boundary":["haloperidol"]}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - This evidence does not by itself validate the local runtime severity, workflow action, or every extrapolated class member.
  - The qt_prolonging_drug runtime roster is a local diagnostic mapping; the source fragment does not name or validate every runtime member.
- fragments:
  - [Warnings] (source_path `warnings[0]`; sha256 d26268e6193d32b4d0b569fbd09e04540b27bffa2dc0a390ca546885fb508dcf) "particular caution is advised in treating patients with other QT-prolonging conditions (including electrolyte imbalance [particularly hypokalemia and hypomagnesemia], drugs known to prolong QT, underlying cardiac abnormalities, hypothyroidism, and familial long QT-syndrome)."

### ziprasidone__qt_prolonging_drug — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician`

- source_id: `fda-label-ziprasidone-qt-contraindications-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — ziprasidone capsules | regulator="FDA (United States)" | product="ziprasidone capsules" | section: "Contraindications, QT Prolongation (4.1)"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%227e7261d7-4902-4bb5-a268-6c358890f963%22&limit=100 (host api.fda.gov; setid 7e7261d7-4902-4bb5-a268-6c358890f963)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `7e7261d7-4902-4bb5-a268-6c358890f963` @ `18` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2026-05-21 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7e7261d7-4902-4bb5-a268-6c358890f963
- provenance: `{"set_id":"7e7261d7-4902-4bb5-a268-6c358890f963","version":"18","effective_time":"20260521","payload_sha256":"b505b9073e9b04f4541db8618c81257c5016cde8da619e534d54e776fd724699","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["contraindications[0]","contraindications[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: The current ziprasidone label prohibits named QT-prolonging drugs and other Class Ia and III antiarrhythmics.
- interaction_exists: `true`
- source_effect: `["additive_qt_prolongation_and_fatal_arrhythmia_risk"]`
- label_action: `["should_not_be_given_with","contraindicated"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"source_named_members_plus_source_class","object_members":["ziprasidone"],"source_named_members":["dofetilide","sotalol","quinidine","mesoridazine","thioridazine","chlorpromazine","droperidol","pimozide","sparfloxacin","gatifloxacin","moxifloxacin","halofantrine","mefloquine","pentamidine","arsenic trioxide","levomethadyl acetate","dolasetron mesylate","probucol","tacrolimus"],"source_classes":["Class_Ia_antiarrhythmics","Class_III_antiarrhythmics"],"runtime_class":"qt_prolonging_drug","runtime_members":["dofetilide","sotalol","quinidine","hydroquinidine","procainamide","disopyramide","amiodarone","dronedarone","ibutilide","mesoridazine","thioridazine","chlorpromazine","droperidol","pimozide","sparfloxacin","gatifloxacin","moxifloxacin","halofantrine","mefloquine","pentamidine","arsenic trioxide","levomethadyl acetate","dolasetron","probucol","tacrolimus"],"requires_clinician_class_mapping":true}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - Hydroquinidine, procainamide, disopyramide, amiodarone, dronedarone, and ibutilide are local members mapped from the source Class Ia and III language rather than individually named in the fragment.
  - The canonical runtime token dolasetron maps to the source-named ingredient dolasetron mesylate; the salt spelling is not a second runtime member.
- fragments:
  - [Contraindications, QT Prolongation (4.1)] (source_path `contraindications[0]`; sha256 5e80fbffaa2481235200b2ca0898ed2a3781b883243547a876e947eb632093ae) "Pharmacokinetic/pharmacodynamic studies between ziprasidone and other drugs that prolong the QT interval have not been performed. An additive effect of ziprasidone and other drugs that prolong the QT interval cannot be excluded. Therefore, ziprasidone should not be given with:"
  - [Contraindications, QT Prolongation (4.1)] (source_path `contraindications[0]`; sha256 b8088d1292a76edcd0bfe8486433c555ac8e926f218966ff1a7e1595e15c59b7) "dofetilide, sotalol, quinidine, other Class Ia and III anti-arrhythmics, mesoridazine, thioridazine, chlorpromazine, droperidol, pimozide, sparfloxacin, gatifloxacin, moxifloxacin, halofantrine, mefloquine, pentamidine, arsenic trioxide, levomethadyl acetate, dolasetron mesylate, probucol or tacrolimus."

### methadone__qt_prolonging_drug — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-methadone`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — methadone hydrochloride | regulator="FDA (United States)" | product="methadone hydrochloride" | section: "Warnings"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%22aa8e14c1-fbfd-4e4d-b59e-2d4ae1ca815f%22&limit=100 (host api.fda.gov; setid aa8e14c1-fbfd-4e4d-b59e-2d4ae1ca815f)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `aa8e14c1-fbfd-4e4d-b59e-2d4ae1ca815f` @ `11` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2022-06-13 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=aa8e14c1-fbfd-4e4d-b59e-2d4ae1ca815f
- provenance: `{"set_id":"aa8e14c1-fbfd-4e4d-b59e-2d4ae1ca815f","version":"11","effective_time":"20220613","payload_sha256":"04ae56f83e9b38f97883742483d0ce4ebd79132dfcad4e99b4b4ad8832354e08","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["boxed_warning[0]","boxed_warning[0]","warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Methadone treatment has been associated with QT prolongation and torsades; the label directs cardiac-rhythm monitoring when risk factors or medicines affecting cardiac conduction are present.
- interaction_exists: `true`
- source_effect: `["qt_prolongation","torsades_reported"]`
- label_action: `["ecg_monitoring_recommended","use_with_caution"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"drug_condition","object_members":["methadone"],"condition":"intrinsic/route/dose","runtime_class":"qt_prolonging_drug","runtime_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"perpetrator_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"requires_clinician_class_mapping":true,"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping","source_scope_boundary":["methadone"]}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The PK/CYP exposure mechanism (methadone metabolism inhibition raising methadone exposure) — that belongs to methadone__cyp_inhibitor; this cardiac evidence only establishes methadone's intrinsic QT/torsades effect and risk-factor management.
  - Does not by itself quantify or establish interaction risk with any specific named co-administered drug or drug class; it references generic descriptors ('medications affecting cardiac conduction', 'concomitant medications with cardiac effects') rather than naming members.
  - Does not name torsadogenic drug classes (e.g., Class Ia/III antiarrhythmics) as interacting agents.
  - The qt_prolonging_drug runtime roster is a local diagnostic mapping; the source fragment does not name or validate every runtime member.
- fragments:
  - [Warnings] (source_path `boxed_warning[0]`; sha256 35b096e065fa47fb9f8025816b22795984fb4f46e86395e6006f1ccc80eaeda4) "QT interval prolongation and serious arrhythmia (torsades de pointes) have occurred during treatment with methadone."
  - [Warnings] (source_path `boxed_warning[0]`; sha256 296add5197a50a2eff2b0ba4da328e5ce3d5474f0bc77b63c6eaa1df4aa04406) "Closely monitor patients with risk factors for development of prolonged QT interval, a history of cardiac conduction abnormalities, and those taking medications affecting cardiac conduction for changes in cardiac rhythm during initiation and titration of methadone hydrochloride tablets"
  - [Warnings] (source_path `warnings_and_cautions[0]`; sha256 5abd627ed18461d5e67e187d1d2f1abba03fabe8987b005a51bbd14ac00e342b) "Evaluate patients developing QT prolongation while on methadone treatment for the presence of modifiable risk factors, such as concomitant medications with cardiac effects, drugs that might cause electrolyte abnormalities, and drugs that might act as inhibitors of methadone metabolism."

### methadone__cyp_inhibitor — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-methadone-cyp-inhibitors-2026`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — methadone hydrochloride tablets | regulator="FDA (United States)" | product="methadone hydrochloride tablets" | section: "Drug Interactions (7), CYP Inhibitors"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%226984eb5a-57a3-4686-bc67-91bc3e7a531e%22&limit=100 (host api.fda.gov; setid 6984eb5a-57a3-4686-bc67-91bc3e7a531e)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `6984eb5a-57a3-4686-bc67-91bc3e7a531e` @ `18` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2025-12-23 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6984eb5a-57a3-4686-bc67-91bc3e7a531e
- provenance: `{"set_id":"6984eb5a-57a3-4686-bc67-91bc3e7a531e","version":"18","effective_time":"20251223","payload_sha256":"7141ad2949b6c0bf6906acc252d3b311cf9bccae438a8de004040757be9e6357","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["drug_interactions[0]","drug_interactions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: CYP3A4, CYP2B6, CYP2C19, CYP2C9, or CYP2D6 inhibitors can raise methadone exposure and cause fatal overdose; stopping an inhibitor can reduce efficacy or cause withdrawal.
- interaction_exists: `true`
- source_effect: `["increased_methadone_exposure_and_fatal_overdose","reduced_efficacy_or_withdrawal_after_inhibitor_stops"]`
- label_action: `["consider_dosage_reduction","frequent_evaluation_for_respiratory_depression_and_sedation"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"source_class_statement","object_members":["methadone"],"source_classes":["CYP3A4_inhibitors","CYP2B6_inhibitors","CYP2C19_inhibitors","CYP2C9_inhibitors","CYP2D6_inhibitors"],"runtime_class":"methadone_relevant_cyp_inhibitor","requires_clinician_class_mapping":true}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The runtime roster is a local class mapping and does not prove equal magnitude for every listed inhibitor.
  - Oral-route, initiation, discontinuation, dose, and stable-treatment context are unavailable to the pair matcher.
- fragments:
  - [Drug Interactions (7), CYP Inhibitors] (source_path `drug_interactions[0]`; sha256 a6cdecf8a26e341c3bbfdfacbad6d59e00c3ccd78e8edd90fd328ffdc96f9c8a) "The concomitant use of Methadone Hydrochloride Tablets and CYP3A4, CYP2B6, CYP2C19, CYP2C9, or CYP2D6 inhibitors can increase the plasma concentration of methadone, resulting in increased or prolonged opioid effects, and may result in a fatal overdose, particularly when an inhibitor is added after a stable dose of Methadone Hydrochloride Tablets is achieved."
  - [Drug Interactions (7), CYP Inhibitors] (source_path `drug_interactions[0]`; sha256 a97dc1f1e02ea6b2c3860c6c32d5b35907544e908b1560f7298dbe52a1f7cf5e) "After stopping a CYP3A4, CYP2B6, CYP2C19, CYP2C9, or CYP2D6 inhibitor, as the effects of the inhibitor decline, the methadone plasma concentration can decrease [see Clinical Pharmacology (12.3)], resulting in decreased opioid efficacy or withdrawal symptoms in patients physically dependent on methadone."

### hydroxychloroquine__qt_prolonging_drug — evidence[0] — `machine_confirmed_openfda_reconciled_pending_clinician` _(rule runtime_enabled:false)_

- source_id: `fda-label-hydroxychloroquine`
- source: openFDA drug-label record (company-submitted SPL); DailyMed reference locator — hydroxychloroquine sulfate | regulator="FDA (United States)" | product="hydroxychloroquine sulfate" | section: "Warnings and Precautions"
- url: https://api.fda.gov/drug/label.json?search=set_id%3A%222c109188-d28b-4c65-8b52-819bd8547f2e%22&limit=100 (host api.fda.gov; setid 2c109188-d28b-4c65-8b52-819bd8547f2e)
- policy: `openfda-labels` / `interaction-evidence` | licence: `CC0-1.0`
- document: `2c109188-d28b-4c65-8b52-819bd8547f2e` @ `1` | retrieved: 2026-07-23 | jurisdiction: `US`
- date: 2024-08-16 (`openFDA SPL effective_time`) | accessed: 2026-07-23
- reference_url: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2c109188-d28b-4c65-8b52-819bd8547f2e
- provenance: `{"set_id":"2c109188-d28b-4c65-8b52-819bd8547f2e","version":"1","effective_time":"20240816","payload_sha256":"fc3ba6ac8ea63cd88532ef1a0e4f84ceda676a50df523377b6f8cde76f73dea0","payload_canonicalization":"sorted-json-keys-v1","normalization_version":"openfda-spl-text-v1","source_paths":["warnings_and_cautions[0]","warnings_and_cautions[0]","warnings_and_cautions[0]","warnings_and_cautions[0]","warnings_and_cautions[0]","warnings_and_cautions[0]"]}`
- currentness: `checked_current_openfda` @2026-07-23
- quote_integrity: `multi_fragment_verbatim`
- proposition: Hydroxychloroquine can prolong QT; concomitant QT-prolonging agents increase ventricular-arrhythmia risk, co-use is not recommended, electrolyte imbalances should be corrected, and cardiac function monitored as clinically indicated.
- interaction_exists: `true`
- source_effect: `["qt_prolongation","torsades_reported","increased_ventricular_arrhythmia_risk_with_qt_prolonging_agents"]`
- label_action: `["coadministration_not_recommended","correct_electrolyte_imbalances_prior_to_use","monitor_cardiac_function_as_clinically_indicated"]`
- runtime_severity_is_local_mapping: `true`
- scope: {"scope_type":"intrinsic_product_effect_plus_diagnostic_local_class_mapping","object_members":["hydroxychloroquine"],"source_class_term":"QT_interval_prolonging_agents","runtime_class":"qt_prolonging_drug","requires_clinician_class_mapping":true,"source_scope_boundary":"hydroxychloroquine_plus_source_class_term_QT_interval_prolonging_agents","runtime_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"perpetrator_members":["amiodarone","sotalol","dronedarone","clarithromycin","erythromycin","moxifloxacin","levofloxacin","ciprofloxacin","ondansetron","domperidone","haloperidol","ziprasidone","quetiapine","citalopram","escitalopram","methadone","hydroxychloroquine","chloroquine","quinine","fluconazole","pimozide","disopyramide","hydroquinidine","quinidine","dofetilide","ibutilide","sertindole","spiramycin","pentamidine","halofantrine","lumefantrine","cisapride","dolasetron","prucalopride","mequitazine","mizolastine","toremifene","vandetanib","vincamine","bepridil","diphemanil","procainamide","mesoridazine","thioridazine","chlorpromazine","droperidol","sparfloxacin","gatifloxacin","mefloquine","arsenic trioxide","levomethadyl acetate","probucol","tacrolimus"],"source_scope_is_not_runtime_roster":true,"runtime_scope_status":"diagnostic_only_local_mapping"}
- jurisdictions: `["US"]`
- does NOT by itself support:
  - The qt_prolonging_drug roster and Major severity remain diagnostic local mappings pending clinician review; the source class term does not validate every runtime member or a member-specific tier.
  - The retained fragments do not establish a numeric QTc threshold, monitoring cadence, dose action, renal/hepatic modifier, or which established medicine to stop.
- fragments:
  - [Warnings and Precautions] (source_path `warnings_and_cautions[0]`; sha256 3160a566eb6f6cc157db606b13ed2b939817e7448449199952862d0e3d66f1d9) "Hydroxychloroquine sulfate tablets has a potential to prolong the QT interval."
  - [Warnings and Precautions] (source_path `warnings_and_cautions[0]`; sha256 78e18a39fa543f46794bf4456cea05716efc87575136a4b0d0a90629e88658c0) "Ventricular arrhythmias (including torsades de pointes) have been reported in hydroxychloroquine sulfate tablets-treated patients."
  - [Warnings and Precautions] (source_path `warnings_and_cautions[0]`; sha256 1c52553954e2be8a1a3113550cf699ce823fc55a6bd35ce5a61575bceb758996) "Concomitant administration with QT interval prolonging agents as this may lead to an increased risk for ventricular arrhythmias."
  - [Warnings and Precautions] (source_path `warnings_and_cautions[0]`; sha256 5efbf3c80161c0c5c9feaf16424e45da071a3762670a072ea87bee7dc16d97b2) "Therefore, hydroxychloroquine sulfate tablets are not recommended in patients taking other drugs that have the potential to prolong the QT interval."
  - [Warnings and Precautions] (source_path `warnings_and_cautions[0]`; sha256 c3373c22b4268d8b8e5d6e7e21ec9cef0e3124e0bdcd19877eaba1123e546457) "Correct electrolyte imbalances prior to use."
  - [Warnings and Precautions] (source_path `warnings_and_cautions[0]`; sha256 f7e742299fecf7ded9726873157d35271765a41436e05a4fa0c7baf96e6098bc) "Monitor cardiac function as clinically indicated during hydroxychloroquine sulfate tablets therapy."

## Remaining sign-off signals (auto-derived)

1. Records whose scope sets `requires_clinician_class_mapping:true`: **15** — qt_macrolide__qt_prolonging_drug[0], qt_macrolide__qt_prolonging_drug[1], qt_macrolide__qt_prolonging_drug[2], citalopram__qt_prolonging_drug[0], escitalopram__qt_prolonging_drug[0], domperidone__potent_cyp3a4_inhibitor[0], domperidone__moderate_cyp3a4_inhibitor[0], domperidone__qt_prolonging_drug[0], ondansetron__qt_prolonging_drug[0], haloperidol_iv_or_above_recommended_dose__qt_prolonging_drug[0], haloperidol_oral__qt_prolonging_drug[0], ziprasidone__qt_prolonging_drug[0], methadone__qt_prolonging_drug[0], methadone__cyp_inhibitor[0], hydroxychloroquine__qt_prolonging_drug[0].
2. Records whose `currentness_status` does not start with `checked_current`: **0**.
3. Records whose `citation_status` contains `discrepancy`: **0**.
4. Per-record `does_not_by_itself_support` entries above are reproduced from the JSONL and require review as written.
