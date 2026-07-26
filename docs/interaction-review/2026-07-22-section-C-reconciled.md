# Batch 1 v2 — Section C (serotonin/CNS) reconciled packet

Engineering-reconciled local worktree packet. Every rule remains
`promotion_eligible:false` pending clinician approval.

- Source slice: `batch-01-v2/sections/C.verified.jsonl`
- Worktree state: `worktree-uncommitted`
- JSONL SHA-256: `9fa5a18bb0f303c0a2fa876daeade2904eb88929f9710d9457246944c64e72f6`
- Rules: 21
- Runtime-enabled: 0
- Diagnostic-only: 21
- Evidence records: 24
- Exact hashed fragments: 34
- Current official sources fetched: 18
- Restricted machine-evidence records: 0

## Reconciliation decisions

- All 23 legacy DailyMed evidence records are migrated to 18 exact current
  openFDA SPL records under the `openfda-labels` CC0 policy. Each record pins
  the exact set ID, SPL version, effective time, canonical payload hash, and
  source path; DailyMed remains a reference locator only. The dextromethorphan
  fragment was corrected from the legacy collapsed `useif` text to the exact
  current openFDA wording.
- Every rule is now jurisdiction-bounded to `US`, the only jurisdiction
  supported by the retained machine evidence. No UK or India scope is inferred
  from a US label.
- `ssri_snri__maoi_nonselective` is matcher-narrowed to fluoxetine, the only
  SSRI/SNRI product directly supported by its retained fragment. The exact
  five-week restriction is encoded only for starting a psychiatric MAOI after
  fluoxetine; the reverse direction is explicitly unsupported.
- The current June 2026 ZYVOX label replaces the prior universal
  antidepressant-cessation and fixed-washout pathway. The generic linezolid
  rule now monitors concomitant serotonergic use and directs clinically
  appropriate discontinuation of linezolid and/or the serotonergic agent only
  if symptoms occur. It carries no fixed restart interval, withholding branch,
  preselected action target, or blanket interruption protection.
- `tramadol__linezolid` and `pethidine__linezolid` are exact, diagnostic-only
  contraindication overrides. Their greater specificity and explicit
  suppression prevent a duplicate generic linezolid alert.
- `bupropion__linezolid_directional` is diagnostic-only because the source
  restriction applies to starting bupropion during linezolid treatment and the
  matcher has no initiation-direction input.
- Linezolid is excluded from the MAO-A-metabolized triptan contraindication.
  Linezolid plus any covered triptan follows the current ZYVOX monitoring rule.
- The MAO-A/triptan contraindication is matcher-narrowed to sumatriptan. Its
  exact two-week post-MAO-A-inhibitor restriction is retained; rizatriptan and
  zolmitriptan are not inferred from a sumatriptan-only fragment.
- The tramadol antidepressant roster now includes fluvoxamine, desvenlafaxine,
  and vortioxetine. The linezolid roster includes the supported SSRI, SNRI,
  TCA, buspirone, triptan, and opioid coverage.
- Tramadol seizure risk is no longer omitted or applied to the broader
  serotonin-syndrome roster. A separate diagnostic-only rule retains the exact
  current-label seizure fragments and maps only the source-named SSRI and TCA
  classes; SNRIs and vortioxetine are explicitly excluded from that seizure
  rule.
- The benzodiazepine/Z-drug roster is reconciled to all 22 encoded members,
  closing the clobazam and chlordiazepoxide opioid false negatives. Evidence
  metadata distinguishes the source class statement from the pinned local
  10-opioid and 22-sedative runtime mapping.
- The separate alcohol rule is narrowed to diazepam, the only sedative product
  directly supported by that rule's retained fragment.
- `maoi_nonselective__sympathomimetic` and
  `sedating_antihistamine__cns_depressant` are diagnostic-only because route
  and formulation exclusions are unavailable to the matcher.
- `dextromethorphan__ssri_snri` is diagnostic-only because its machine evidence
  is a fixed-combination product and the cited class statement does not directly
  name the SNRI branch.
- `dextromethorphan__maoi_nonselective` now records the exact directional
  two-week post-MAOI restriction. Current co-presence remains executable, while
  elapsed time after MAOI discontinuation is not matcher-gateable.
- The sedating-antihistamine evidence records now distinguish their
  representative products and source class examples from the pinned
  five-antihistamine and 41-member CNS-depressant diagnostic mapping.
- Pregabalin and gabapentin now use separate current FDA/DailyMed evidence.
  Restricted licensed-source quotations were removed from machine evidence.
- Pethidine/tramadol after an MAOI now records the exact supported 14-day
  direction, and bupropion/antidepressant-MAOI switching records the exact
  supported 14 days in both directions. Unsupported reverse directions are not
  invented.
- Every Section C candidate is fail-closed with `runtime_enabled:false`.
  Direction-incomplete candidates emit no side-specific `action_target` or
  interruption protection, while candidates with abstract, empty, or missing
  route/formulation selectors retain `clinical_context_complete:false`.
- Retired `runtime_executable` prose, unresolved timing boilerplate,
  unsupported renal/hepatic modifiers, and stale v1 references were removed.

## Runtime state

Runtime-enabled rules: none.

Diagnostic-only rules:

- `ssri_snri__maoi_nonselective`
- `ssri_snri__methylene_blue_iv`
- `tramadol__serotonergic_antidepressant`
- `tramadol__ssri_tca_seizure_risk`
- `pethidine_tramadol__maoi_nonselective`
- `linezolid__serotonergic_agent`
- `tramadol__linezolid`
- `pethidine__linezolid`
- `bupropion__linezolid_directional`
- `triptan_mao_metabolized__maoi_mao_a`
- `ssri_snri__triptan`
- `dextromethorphan__maoi_nonselective`
- `dextromethorphan__ssri_snri`
- `opioid__benzodiazepine_cns_depressant`
- `opioid__gabapentinoid`
- `benzodiazepine_zdrug__alcohol`
- `maoi_nonselective__sympathomimetic`
- `maoi_nonselective__direct_sympathomimetic`
- `lithium__ssri_snri`
- `bupropion__maoi_nonselective`
- `sedating_antihistamine__cns_depressant`

## Adversarial verification

- Tramadol matches fluvoxamine, desvenlafaxine, and vortioxetine.
- The separate tramadol seizure rule matches pinned SSRI/TCA members,
  remains diagnostic-only, and does not match venlafaxine, desvenlafaxine,
  duloxetine, or vortioxetine.
- Linezolid matches the prior omitted antidepressants, buspirone,
  frovatriptan, and opioids.
- Linezolid plus tramadol or pethidine retains the exact contraindication as a
  diagnostic candidate; no pharmacist-facing finding is enabled.
- Linezolid plus bupropion remains visible but diagnostic-only.
- Morphine matches clobazam and chlordiazepoxide.
- Every one of the 22 pinned benzodiazepine/Z-drug members matches the
  diagnostic opioid rule, and every one of the 41 pinned CNS depressants
  remains visible through the diagnostic-only antihistamine rule.
- The generic linezolid management contains no obsolete 24-hour restart or
  stale withholding branch, and the dextromethorphan/MAOI management contains
  no unresolved timing placeholder.
- Sumatriptan plus linezolid does not enter the MAO-A triptan
  contraindication.
- Sumatriptan plus a pinned MAO-A inhibitor enters the exact two-week rule;
  rizatriptan and zolmitriptan do not.
- Fluoxetine plus a pinned psychiatric MAOI enters the five-week-aware rule;
  sertraline does not enter that representative-product gate.
- All 21 rules have applicability jurisdiction exactly equal to the
  jurisdiction supported by their retained evidence.
- A representative pair for every rule remains review-visible as diagnostic.
  Wrong-jurisdiction probes emit none of the scoped rules, while missing
  jurisdiction fails closed without exposing jurisdiction-specific action
  text.

## Validation

- Strict live provenance validation: 21 rules, 24 evidence records, 34 unique
  exact-text hashes, and 18 current exact-version openFDA SPL records; every
  canonical payload hash and source path verified with zero errors.
- Structural validation: 21 rules, zero runtime-enabled, zero errors and zero
  warnings.
- Focused Section C/D adversarial tests: 34 semantic tests passed, including
  review-index parity.
- All runtime-status objects contain exactly the four required boolean fields,
  and every rule remains ineligible for promotion.

## Remaining review gates

The local class mappings, action wording, and diagnostic/runtime boundary still
require the planned two-clinician approval. The aggregate pack must be rebuilt
from the verified slices before aggregate-level runtime tests can represent this
packet.
