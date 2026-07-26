# Batch 1 v2 — Section I (absorption / chelation / pH-dependent absorption) RECONCILED packet

Engineering-reconciled from 15 conceptual source rows into 24 deterministic draft rules. The two additional rows are deliberate product branches: the former generic dasatinib-antacid rule is split into SPRYCEL and PHYRAGO, and TOLSURA now has its own opposite-direction acid-reducer rule.

The packet contains 33 policy-bound evidence records with 67 exact source-path-bound fragments across 22 uniquely selected openFDA SPL records. 30 records are typed as `interaction-evidence`; three product/formulation-specific no-effect records are typed as `interaction-counterevidence` and cannot satisfy an interaction-action gate. All evidence remains pending clinician review. These rows are draft review material, not the shipped runtime pack.

- Source JSONL: `docs/interaction-review/batch-01-v2/sections/I.verified.jsonl`
- Source JSONL SHA-256: `2d4bd7d469295c18abb8b812f463c1dcf0b644956bddcc32e278e24a26dbb408`
- Input conceptual rows: 15
- Reconciled rows: 24
- Pair matcher executable: 21
- Clinical context complete: 0
- Runtime enabled: 0
- Diagnostic-only: 24
- Promotion eligible: 0
- Interaction evidence: 30
- Interaction counterevidence: 3
- Exact hashed fragments: 67
- Unique openFDA SPL records: 22

## Independent semantic re-audit corrections

1. **Antacid roster gaps now fail closed.** The erlotinib label names the antacid class but does not enumerate ingredients. Its retained four-member local review roster is explicitly incomplete and the rule is runtime-disabled. Magaldrate, magnesium trisilicate, dried aluminium hydroxide, and hydrotalcite remain excluded pending exact identity evidence and clinician mapping.
2. **Dasatinib antacid handling is product-specific.** `dasatinib_sprycel__antacid` contains only the cited aluminum-hydroxide/magnesium-hydroxide identity and retains the SPRYCEL 2-hour spacing action. `dasatinib_phyrago__antacid` contains only the directly studied calcium-carbonate identity and retains PHYRAGO's avoid-first action; 2-hour spacing is only the fallback when concomitant use cannot be avoided. Both are non-executable until product identity is available.
3. **No-effect observations are counterevidence, not positive interactions.** TIROSINT-SOL with omeprazole and PHYRAGO with omeprazole/famotidine now use `source_policy_use:"interaction-counterevidence"`, `supports.interaction_exists:false`, the closed `no_clinically_meaningful_effect` effect type, and no label action.
4. **TOLSURA has its own positive branch.** `itraconazole_tolsura__acid_reducer` preserves the exact current label statement that acid neutralizers, H2-receptor antagonists, and PPIs increase systemic itraconazole exposure from TOLSURA, with adverse-reaction monitoring and possible prescriber-directed dose reduction. It is diagnostic-only because product identity is not executable.
5. **SPORANOX and TOLSURA are no longer mixed in one evidence array.** The conventional-SPORANOX row retains its reduced-absorption, full-meal, neutralizer-spacing, and acidic-beverage direction. The TOLSURA evidence moved to its separate increased-exposure row.
   The 2026-07-26 live recheck confirmed all four conventional-SPORANOX
   fragments at the same SPL version/effective time; only the canonical
   openFDA payload bytes changed, so its provenance hash and retrieval date
   were refreshed.
6. **Ketoconazole instructions remain subclass-specific.** The exact acidic-beverage instruction remains attached to acid-reducer co-treatment, while the 1-hour-before/2-hours-after interval remains limited to acid-neutralizing medicines. No clock interval is inferred for H2 antagonists or PPIs.
7. **Applicability indication shape is closed.** Every non-null `applicability.indication` is now a non-empty string array; no Section-I row retains the former scalar form.
8. **Antibiotic dose forms are concrete.** The ciprofloxacin, levofloxacin, moxifloxacin, and doxycycline selectors now use `immediate_release_tablet` / `delayed_release_tablet` where applicable, rather than abstract release-profile values that remain unresolved at runtime.

## Runtime state

### Runtime-enabled draft rows

- None. Every Section-I rule fails closed because `clinical_context_complete:false`.

All rows remain `promotion_eligible:false`; none is clinician-approved or present in the production runtime pack.

### Diagnostic-only rows

- `ciprofloxacin__polyvalent_cation` — pair-matchable review finding; action remains outside the production pack
- `levofloxacin__polyvalent_cation` — pair-matchable review finding; action remains outside the production pack
- `moxifloxacin__polyvalent_cation` — pair-matchable review finding; action remains outside the production pack
- `doxycycline__polyvalent_cation` — pair-matchable review finding; action remains outside the production pack
- `levothyroxine__oral_cation_binder` — pair-matchable review finding; action remains outside the production pack
- `levothyroxine__acid_suppressant` — pair-matchable review finding; action remains outside the production pack
- `alendronate__oral_cation_food` — pair-matchable review finding; action remains outside the production pack
- `risedronate_immediate_release__oral_cation_food` — pair-matchable review finding; action remains outside the production pack
- `risedronate_delayed_release__oral_cation_food` — pair-matchable review finding; action remains outside the production pack
- `ibandronate__oral_cation_food` — pair-matchable review finding; action remains outside the production pack
- `atazanavir__proton_pump_inhibitor` — pair-matchable review finding; action remains outside the production pack
- `atazanavir__h2_receptor_antagonist` — pair-matchable review finding; action remains outside the production pack
- `atazanavir__antacid_buffered_product` — pair-matchable review finding; action remains outside the production pack
- `rilpivirine__proton_pump_inhibitor` — pair-matchable review finding; action remains outside the production pack
- `erlotinib__proton_pump_inhibitor` — pair-matchable review finding; action remains outside the production pack
- `erlotinib__h2_receptor_antagonist` — pair-matchable review finding; action remains outside the production pack
- `erlotinib__antacid` — pair-matchable review finding; action remains outside the production pack
- `dasatinib__proton_pump_inhibitor` — pair-matchable review finding; action remains outside the production pack
- `dasatinib__h2_receptor_antagonist` — pair-matchable review finding; action remains outside the production pack
- `dasatinib_sprycel__antacid` — product/formulation identity is not executable
- `dasatinib_phyrago__antacid` — product/formulation identity is not executable
- `ketoconazole_oral__acid_suppressant` — pair-matchable review finding; action remains outside the production pack
- `itraconazole_capsule__acid_suppressant` — pair-matchable review finding; action remains outside the production pack
- `itraconazole_tolsura__acid_reducer` — product/formulation identity is not executable

## Evidence-role boundary

The three counterevidence records are:

- `fda-label-tirosint-sol-omeprazole-2026` — TIROSINT-SOL oral solution showed no clinically significant pharmacokinetic difference with omeprazole.
- `fda-label-phyrago-2026` — PHYRAGO showed no clinically significant pharmacokinetic difference with omeprazole.
- `fda-label-phyrago-2026` — PHYRAGO showed no clinically significant pharmacokinetic difference with famotidine.

They are payload-bound through the same exact openFDA `set_id`, SPL version, `effective_time`, selected-record hash, source path, and fragment hash checks as positive evidence. Their closed role prevents a no-effect record from satisfying a rule's interaction/action support requirement.

## Verification coverage

`test/interaction-pack-section-i.test.mjs` guards:

- all 24 unique IDs, conceptual source-row lineage, and exact four-boolean runtime tuples;
- null-or-array indication shape and concrete antibiotic formulations;
- exact inline member arrays and representative non-member rejection;
- fail-closed exclusion of magaldrate, magnesium trisilicate, dried aluminium hydroxide, and hydrotalcite;
- separate SPRYCEL spacing and PHYRAGO avoid-first antacid branches;
- typed TIROSINT-SOL and PHYRAGO counterevidence;
- the separate TOLSURA increased-exposure monitoring/dose-reduction branch;
- exact ketoconazole acidic-beverage and neutralizer-spacing fragments;
- 33 source-policy records, 3 counterevidence records, 67 exact fragment hashes, and 22 unique cached/live SPL selections;
- the exact JSONL SHA-256 pinned in both Section-I documents.

## Residual review decisions

1. Product identity must be executable before the SPRYCEL, PHYRAGO, TOLSURA, SPORANOX, TIROSINT, or TIROSINT-SOL distinctions can become runtime actions.
2. The incomplete erlotinib antacid class mapping and all unlisted antacid identities require exact evidence plus clinician approval.
3. Atazanavir still requires booster, treatment-history, regimen, and acid-suppressant-dose context.
4. Route/formulation-aware subjects are required for the remaining oral-only absorption rules; ingredient strings alone must fail closed.
5. No row is promotion-ready. Author and approver remain null, every `promotion_eligible` flag is false, and independent authorised clinician approval is still mandatory.
