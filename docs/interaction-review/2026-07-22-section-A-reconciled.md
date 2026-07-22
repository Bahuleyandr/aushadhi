# Batch 1 v2 — Section A RECONCILED packet

**Generated directly from the committed JSONL** — every value below is read from the rule object or produced by running the engine, not from agent narration.

- Source of truth: `docs/interaction-review/batch-01-v2/batch-01-v2.jsonl`
- Commit: `87b0dfb`
- JSONL SHA-256: `e44556b208071c2dac5d86c2339973dd0cf958453fa5db9955f0c7076c3e971c`
- Status: **adversarially reviewed and schema-tested; clinical evidence verification pending.** Every evidence excerpt/date is `<verify>`. Draft — NOT a runtime path; author + independent authorised approval (Task 7) still required before promotion.

## Engine semantics this packet relies on (all TDD-tested, see test/interaction-engine.test.mjs + test/interaction-pack-integration.test.mjs)
- **Clinical severity vs operational action:** clinical severity is raised only by a CONFIRMED factor. Missing renal/hepatic data never yields a contraindicated *clinical severity*; it drives a restrictive *operational* dispense_action and records `data_required`.
- **action_target / do_not_interrupt:** a withhold action names which medicine to withhold/clarify and which established drug must not be interrupted.
- **Exact CrCl bands:** `crcl_30_to_50`, `crcl_lt_50` (the `crcl_lt_60` proxy was removed).
- **Indication-gating:** an indication-constrained rule matches only its indication (unknown indication does not exclude; findings carry `indication_scope`).
- **Inline `members[]`** pins a class ref to exactly those drugs. **N-ary `all_of_present`** matches N>2 distinct agents.

## Live integration transcript (actual engine output at this commit)
```
aspirin,clopidogrel,warfarin               -> warfarin__aspirin_analgesic_antiplatelet [major/confirm_and_monitor]; dual_antiplatelet__oral_anticoagulant_triple_therapy [major/confirm_and_monitor]
aspirin,warfarin (2-of-3)                  -> warfarin__aspirin_analgesic_antiplatelet [major/confirm_and_monitor]
dabigatran,ketoconazole  NVAF crcl40       -> dabigatran_nvaf__dronedarone_or_ketoconazole [major/confirm_and_monitor target=newly_added_perpetrator]
dabigatran,ketoconazole  NVAF crcl20       -> dabigatran_nvaf__dronedarone_or_ketoconazole [contraindicated/withhold_and_clarify target=newly_added_perpetrator]
dabigatran,ketoconazole  NVAF renal unknown -> dabigatran_nvaf__dronedarone_or_ketoconazole [moderate/withhold_and_clarify target=newly_added_perpetrator need=CrCl]
dabigatran,verapamil     NVAF              -> dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor [minor/supply_with_counselling]
dabigatran,ketoconazole  VTE crcl40        -> dabigatran_vte__pgp_inhibitor [contraindicated/withhold_and_clarify target=newly_added_perpetrator]
apixaban,clarithromycin                    -> (no rule matched)
apixaban,ketoconazole                      -> apixaban__strong_cyp3a4_pgp_inhibitor [major/withhold_and_clarify target=newly_added_perpetrator]
rivaroxaban,clarithromycin                 -> (no rule matched)
rivaroxaban,ketoconazole  Child-Pugh C     -> rivaroxaban__strong_cyp3a4_pgp_inhibitor [contraindicated/withhold_and_clarify target=newly_added_perpetrator]
clopidogrel,omeprazole                     -> clopidogrel__cyp2c19_inhibiting_ppi [moderate/withhold_and_clarify target=newly_added_perpetrator]
```

## Per-rule reconciled state (read from the JSONL)

### warfarin__nsaid_systemic
- object: `drug:warfarin` | perpetrator: `class:nsaid`
- risk_basis: `additive_pd` | severity(base): `major` | dispense_action: `withhold_and_clarify`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- jurisdiction: `["US","UK","IN"]`
- **runtime_executable: false** — therapy_status is not yet a machine-evaluable context factor; the new-vs-established branch is advisory prose until the engine gains a therapy_status input.
- context_modifiers:
  - `hepatic:hepatic_impaired` -> major/- (on_unknown:base)
- evidence sources: fda-label-warfarin (FDA warfarin sodium, Drug Interactions) — all excerpts/dates `<verify>`
- open `<verify>` items (4):
  - applicability.renal: <verify: whether a renal-impairment context_modifier should gate this rule and at what eGFR/CrCl threshold - the revi…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify — NSAIDs increase the risk of bleeding when used with warfarin>

### warfarin__miconazole_oromucosal_gel
- object: `drug:warfarin` | perpetrator: `drug:miconazole`
- risk_basis: `pk_perpetrator` | severity(base): `major` | dispense_action: `withhold_and_clarify`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- jurisdiction: `["UK","IN","US"]`
- **runtime_executable: false** — supply-status (OTC vs Rx) and marketed-product are not machine-evaluable dimensions yet; the jurisdiction/product split is advisory until the engine gains supply_status/product inputs. A separate lower-severity TOPICAL miconazole rule may be needed (topical skin/nail products are out of scope here but are not interaction-free).
- evidence sources: mhra-smpc-miconazole-oromucosal-gel (MHRA miconazole oromucosal gel (Rx SmPC), Interactions (SmPC 4.5)); mhra-otc-pack-miconazole-oromucosal-gel (MHRA miconazole oromucosal gel (OTC/pharmacy pack), Contraindications / patient leaflet 'Do not use') — all excerpts/dates `<verify>`
- open `<verify>` items (10):
  - management.prescriber_action: Strong interaction (potent CYP2C9 inhibition markedly raises INR/bleeding). Status is jurisdiction- and supply-status…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify — miconazole oromucosal gel potentiates oral anticoagulant effect; monitor/adjust or avoid>
  - evidence[1].revision_date: <verify>
  - evidence[1].accessed_at: <verify>
  - evidence[1].excerpt: <verify — UK OTC pack: do not use if taking anticoagulants/warfarin (contraindication wording)>
  - product_jurisdiction_branches.uk_otc_oral_gel: labelled do-not-use with warfarin (contraindication) <verify exact wording>
  - product_jurisdiction_branches.uk_rx_oral_gel: planned use with close INR-guided titration per SmPC <verify product-specific>
  - product_jurisdiction_branches.us_india: <verify whether a systemically-absorbed miconazole oral/oromucosal product is marketed and its status>

### warfarin__fluoroquinolone
- object: `drug:warfarin` | perpetrator: `class:fluoroquinolone`
- risk_basis: `observed_clinical_multifactorial` | severity(base): `moderate` | dispense_action: `supply_with_counselling`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- jurisdiction: `["US","UK","IN"]`
- evidence sources: fda-label-ciprofloxacin (FDA ciprofloxacin, Drug Interactions); uk-anchor-pending (MHRA <verify: UK SmPC / BNF fluoroquinolone product>, <verify>); in-anchor-pending (CDSCO <verify: IN fluoroquinolone product label>, <verify>) — all excerpts/dates `<verify>`
- open `<verify>` items (19):
  - mechanism: Increased INR / anticoagulant effect reported (CYP-mediated inhibition of warfarin metabolism, plus reported gut-flor…
  - management.monitoring_events[0].window: <verify>
  - management.monitoring_events[1].window: <verify>
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify — increased anticoagulant effect reported when quinolones given with warfarin; monitor prothrombin time / INR>
  - evidence[1].product: <verify: UK SmPC / BNF fluoroquinolone product>
  - evidence[1].label_section: <verify>
  - evidence[1].revision_date: <verify>
  - evidence[1].accessed_at: <verify>
  - evidence[1].excerpt: <verify: UK SmPC/BNF text supporting fluoroquinolone effect on warfarin INR — pending promotion>
  - evidence[1].normalized_proposition: <verify: UK anchor confirming fluoroquinolones may enhance warfarin anticoagulant effect; INR monitoring advised>
  - …and 7 more

### warfarin__tramadol
- object: `drug:warfarin` | perpetrator: `drug:tramadol`
- risk_basis: `observed_clinical_multifactorial` | severity(base): `major` | dispense_action: `confirm_and_monitor`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- jurisdiction: `["US","UK","IN"]`
- evidence sources: mhra-dsu-tramadol-warfarin (MHRA tramadol, Drug Safety Update) — all excerpts/dates `<verify>`
- open `<verify>` items (4):
  - management.exceptions: Severity raised from moderate to major per clinician review (Section A, row 10) on the basis of reported increased IN…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify> — MHRA warns that concurrent tramadol can increase INR and cause major, potentially life-threatening or fata…

### warfarin__azithromycin_oral
- object: `drug:warfarin` | perpetrator: `drug:azithromycin`
- risk_basis: `observed_clinical_multifactorial` | severity(base): `moderate` | dispense_action: `supply_with_counselling`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- jurisdiction: `["US","UK","IN"]`
- evidence sources: fda-label-azithromycin (FDA azithromycin, Drug Interactions) — all excerpts/dates `<verify>`
- open `<verify>` items (4):
  - mechanism: Occasional INR increases reported when azithromycin is co-administered with warfarin; azithromycin is not interaction…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify — monitor prothrombin time when azithromycin used with warfarin>

### apixaban__strong_cyp3a4_pgp_inhibitor
- object: `drug:apixaban` | perpetrator: `class:cyp3a4_pgp_inhibitor [strong] except[voriconazole,cobicistat,posaconazole,clarithromycin]`
- risk_basis: `pk_perpetrator` | severity(base): `major` | dispense_action: `withhold_and_clarify`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- indication: `"any_apixaban_indication — the required action is determined by the current apixaban dose band (5 mg or 10 mg BID vs 2.5 mg BID), not by the indication itself"` | jurisdiction: `["US"]`
- **runtime_executable: false** — apixaban dose is not yet a machine-evaluable selector; the 50%-reduce vs avoid branch is advisory until the engine gains a dose input. Jurisdiction US-only until UK/IN actions are sourced.
- evidence sources: fda-label-apixaban (FDA apixaban, Dosage and Administration / Drug Interactions) — all excerpts/dates `<verify>`
- open `<verify>` items (5):
  - perpetrator.member_notes.voriconazole_posaconazole_cobicistat: <verify> — combined-strong-DUAL (CYP3A4 AND P-gp) status not established for this rule; excluded pending evidence.
  - management.exceptions: Action depends on the current apixaban dose band: 5/10 mg BID -> reduce 50%; 2.5 mg BID -> avoid. clarithromycin: <ve…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify — on 5 or 10 mg BID reduce apixaban 50% with combined strong dual CYP3A4/P-gp inhibitors; avoid if already on…

### rivaroxaban__strong_cyp3a4_pgp_inhibitor
- object: `drug:rivaroxaban` | perpetrator: `class:cyp3a4_pgp_inhibitor members[itraconazole,ketoconazole,ritonavir,cobicistat] except[clarithromycin,voriconazole,posaconazole]`
- risk_basis: `pk_perpetrator` | severity(base): `major` | dispense_action: `withhold_and_clarify`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- jurisdiction: `["US"]`
- context_modifiers:
  - `hepatic:child_pugh_b` -> contraindicated/withhold_and_clarify (on_unknown:base)
  - `hepatic:child_pugh_c` -> contraindicated/withhold_and_clarify (on_unknown:base)
- evidence sources: fda-label-rivaroxaban (FDA rivaroxaban, Drug Interactions); fda-label-rivaroxaban-hepatic (FDA rivaroxaban, Contraindications / Use in Specific Populations (Hepatic Impairment)) — all excerpts/dates `<verify>`
- open `<verify>` items (8):
  - perpetrator.member_notes.voriconazole_posaconazole: <verify> — combined-strong-DUAL status not established for this rule; excluded pending evidence.
  - management.exceptions: Trigger is combined strong CYP3A4 AND P-gp inhibition. <verify: any clarithromycin-specific position in the rivaroxab…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify - avoid rivaroxaban with combined P-gp and strong CYP3A4 inhibitors>
  - evidence[1].revision_date: <verify>
  - evidence[1].accessed_at: <verify>
  - evidence[1].excerpt: <verify - rivaroxaban contraindicated in hepatic disease associated with coagulopathy, including Child-Pugh B and C>

### edoxaban__pgp_inducer
- object: `drug:edoxaban` | perpetrator: `drug:rifampicin`
- risk_basis: `pk_perpetrator` | severity(base): `major` | dispense_action: `withhold_and_clarify`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- jurisdiction: `["US"]`
- evidence sources: fda-label-edoxaban (FDA edoxaban, Drug Interactions) — all excerpts/dates `<verify>`
- open `<verify>` items (4):
  - management.exceptions: Perpetrator scope restricted to label-named potent inducers rather than the whole strong/P-gp inducer class; rifampic…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify — exact label wording on rifampin coadministration (e.g. avoid concomitant use with rifampin)>

### dabigatran_nvaf__dronedarone_or_ketoconazole
- object: `drug:dabigatran` | perpetrator: `class:pgp_inhibitor members[dronedarone,ketoconazole]`
- risk_basis: `pk_perpetrator` | severity(base): `moderate` | dispense_action: `confirm_and_monitor`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- indication: `["non_valvular_atrial_fibrillation"]` | jurisdiction: `["US"]`
- context_modifiers:
  - `renal:crcl_30_to_50` -> major/confirm_and_monitor (on_unknown:escalate)
  - `renal:crcl_lt_30` -> contraindicated/withhold_and_clarify (on_unknown:escalate)
- evidence sources: fda-label-dabigatran (FDA dabigatran etexilate, Dosage and Administration / Drug Interactions) — all excerpts/dates `<verify>`
- open `<verify>` items (5):
  - mechanism: Dabigatran is a renally-cleared P-gp substrate; dronedarone and systemic ketoconazole raise its exposure. Ketoconazol…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify>
  - evidence[0].normalized_proposition: <verify> — per US dabigatran label

### dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor
- object: `drug:dabigatran` | perpetrator: `class:pgp_inhibitor members[verapamil,amiodarone,quinidine,clarithromycin,ticagrelor]`
- risk_basis: `pk_perpetrator` | severity(base): `minor` | dispense_action: `supply_with_counselling`
- action_target: `null` | do_not_interrupt: `["object_drug"]`
- indication: `["non_valvular_atrial_fibrillation"]` | jurisdiction: `["US"]`
- evidence sources: fda-label-dabigatran (FDA dabigatran etexilate, Drug Interactions) — all excerpts/dates `<verify>`
- open `<verify>` items (5):
  - management.prescriber_action: US NVAF label: NO dabigatran dose adjustment required for verapamil, amiodarone, quinidine, clarithromycin or ticagre…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify>
  - evidence[0].normalized_proposition: <verify> — per US dabigatran label

### dabigatran_vte__pgp_inhibitor
- object: `drug:dabigatran` | perpetrator: `class:pgp_inhibitor`
- risk_basis: `pk_perpetrator` | severity(base): `moderate` | dispense_action: `confirm_and_monitor`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- indication: `["venous_thromboembolism_treatment","venous_thromboembolism_prevention"]` | jurisdiction: `["US"]`
- context_modifiers:
  - `renal:crcl_lt_50` -> contraindicated/withhold_and_clarify (on_unknown:escalate)
- evidence sources: fda-label-dabigatran (FDA dabigatran etexilate, Dosage and Administration / Drug Interactions) — all excerpts/dates `<verify>`
- open `<verify>` items (4):
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify>
  - evidence[0].normalized_proposition: <verify> — per US dabigatran label

### dabigatran_hip_prophylaxis__pgp_inhibitor
- object: `drug:dabigatran` | perpetrator: `class:pgp_inhibitor`
- risk_basis: `pk_perpetrator` | severity(base): `moderate` | dispense_action: `confirm_and_monitor`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- indication: `["hip_replacement_prophylaxis"]` | jurisdiction: `["US"]`
- context_modifiers:
  - `renal:crcl_lt_50` -> contraindicated/withhold_and_clarify (on_unknown:escalate)
- evidence sources: fda-label-dabigatran (FDA dabigatran etexilate, Dosage and Administration / Drug Interactions) — all excerpts/dates `<verify>`
- open `<verify>` items (5):
  - management.prescriber_action: Hip-replacement prophylaxis: at CrCl >=50 mL/min consider separating administration for dronedarone or systemic ketoc…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify>
  - evidence[0].normalized_proposition: <verify> — per US dabigatran label

### clopidogrel__cyp2c19_inhibiting_ppi
- object: `drug:clopidogrel` | perpetrator: `class:cyp2c19_inhibiting_ppi`
- risk_basis: `pk_perpetrator` | severity(base): `moderate` | dispense_action: `withhold_and_clarify`
- action_target: `newly_added_perpetrator` | do_not_interrupt: `["object_drug"]`
- jurisdiction: `["US","UK","IN"]`
- evidence sources: fda-label-clopidogrel (FDA clopidogrel, Warnings and Precautions / Drug Interactions) — all excerpts/dates `<verify>`
- open `<verify>` items (3):
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify - avoid omeprazole and esomeprazole with clopidogrel; they reduce active metabolite>

### aspirin_ld_ir__ibuprofen_timing
- object: `drug:aspirin` | perpetrator: `drug:ibuprofen`
- risk_basis: `additive_pd` | severity(base): `moderate` | dispense_action: `space_doses`
- action_target: `null` | do_not_interrupt: `["aspirin"]`
- indication: `"cardioprotective"` | jurisdiction: `["US","UK","IN"]`
- **runtime_executable: false** — The dose / formulation / dosing_pattern selectors are NOT yet gated by the matcher (satisfies() matches on drug/class only); until gating is implemented this rule can over-apply to enteric-coated aspirin or chronic ibuprofen. Marked runtime_executable=false. co_surface with aspirin__nsaid_additive_gi_bleeding still required.
- evidence sources: fda-sciencepaper-asa-ibuprofen (FDA aspirin / ibuprofen, FDA science paper: Concomitant Use of Ibuprofen and Aspirin) — all excerpts/dates `<verify>`
- open `<verify>` items (4):
  - management.patient_counselling: For immediate-release low-dose aspirin: take the aspirin at least <verify: minimum interval IR low-dose aspirin must …
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify> — ibuprofen 400 mg taken 8 h before or within 30 min after immediate-release 81 mg aspirin can interfere wit…

### dual_antiplatelet__oral_anticoagulant_triple_therapy
- object: `combination[all_of_present]: aspirin + class:p2y12_inhibitor` | perpetrator: `class:oral_anticoagulant members[warfarin,acenocoumarol,phenindione,dabigatran,rivaroxaban,apixaban,edoxaban]`
- risk_basis: `additive_pd` | severity(base): `major` | dispense_action: `confirm_and_monitor`
- action_target: `null` | do_not_interrupt: `["aspirin","p2y12_inhibitor","oral_anticoagulant"]`
- jurisdiction: `["US","UK","IN"]`
- context_modifiers:
  - `renal:crcl_lt_30` -> major/- (on_unknown:base)
  - `hepatic:child_pugh_b` -> major/- (on_unknown:base)
- evidence sources: guideline-triple-antithrombotic (null null, Antithrombotic therapy guidance) — all excerpts/dates `<verify>`
- open `<verify>` items (8):
  - object.combination[0].note: Antiplatelet component. Dose deliberately NOT constrained (the instruction specified 'aspirin', not low-dose), so hig…
  - object.combination[1].note: Named members: clopidogrel, ticagrelor, prasugrel. Class NOT yet present in data-static/interaction-member-sets.json …
  - perpetrator.note: Named members: warfarin, acenocoumarol, phenindione (VKAs) and dabigatran, rivaroxaban, apixaban, edoxaban (DOACs). C…
  - evidence[0].revision_date: <verify>
  - evidence[0].accessed_at: <verify>
  - evidence[0].excerpt: <verify - triple antithrombotic therapy increases bleeding; minimise duration>
  - context_modifiers[0].management_override.monitoring: Renal impairment raises bleeding risk (and DOAC accumulation if a DOAC is used - DOAC renal dosing is defined by CrCl…
  - context_modifiers[1].management_override.monitoring: Hepatic impairment raises bleeding risk; closer surveillance and confirm anticoagulant choice with the prescriber. Me…

## Questions closable from the reviewer-supplied primary sources
These clinical directions are now ENCODED in the rules above (source named; excerpt/date still `<verify>` pending formal extraction):
| Question | Encoded resolution |
|---|---|
| Apixaban strong dual inhibitors | 50% at 5/10 mg BID, avoid at 2.5 mg BID (dose branch, runtime_executable=false); **clarithromycin exempted** (member_exceptions). |
| Rivaroxaban + clarithromycin | **Removed from avoid path** (member_exceptions); ketoconazole/itraconazole/ritonavir/cobicistat retained. |
| Edoxaban + rifampicin | **withhold_and_clarify** targeted at rifampicin; do_not_interrupt edoxaban; US-only. |
| Dabigatran renal bands | Exact `crcl_30_to_50` (reduce to 75 mg) / `crcl_lt_30` (avoid) for NVAF; `crcl_lt_50` avoid for VTE/hip; proxy deleted. |
| Warfarin–tramadol | Major; risk_basis observed_clinical_multifactorial; anchored to MHRA DSU. |
| Aspirin–ibuprofen timing | 81 mg IR + 400 mg ibuprofen; >=8 h before / >=30 min after (single-dose); runtime_executable=false. |
| Clopidogrel PPI | Restricted to omeprazole/esomeprazole; **withhold/substitute the PPI** (pantoprazole named), do not interrupt clopidogrel. |

## Still genuinely open (not fabrications — require the clinician / a separate pass)
1. **Citation verification:** every evidence excerpt + revision_date + accessed_at is `<verify>` — the formal source-extraction pass has not run.
2. **UK/IN jurisdictions:** most rules are anchored to a single US (or MHRA) source; UK/IN actions and anchors are `<verify>`.
3. **runtime_executable=false branches:** warfarin+NSAID therapy_status, miconazole product/supply-status, apixaban dose, aspirin dose/formulation/dosing-pattern — these need new engine inputs (therapy_status / supply_status / dose) before they gate matching. They are advisory prose today.
4. **Single-drug-condition rules** (e.g. standalone rivaroxaban Child-Pugh restriction independent of any DDI) cannot be evaluated by the drug–drug engine; encoded here only as modifiers on the DDI rule.
5. **miconazole** still needs the executable product/jurisdiction split + a separate lower-severity topical rule.

## Disposition
Author-clinician sign-off + independent authorised approver still required (Task 7) before any promotion to the runtime pack. This packet is for that review.
