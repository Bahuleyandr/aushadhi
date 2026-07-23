# Batch 1 v2 — Section D (QT/arrhythmia) reconciled packet

Engineering-reconciled local worktree packet. Every rule remains
`promotion_eligible:false` pending clinician approval.

- Source slice: `batch-01-v2/sections/D.verified.jsonl`
- Worktree state: `worktree-uncommitted`
- JSONL SHA-256: `ef4b282bb497f2981c0f7f54f6e6a6f3884b6167a7da068aaffbcc6248c6d6e6`
- Rules: 14
- Runtime-enabled: 0
- Diagnostic-only: 14
- Evidence records: 16
- Exact hashed fragments: 36
- Current official sources fetched: 15
- Restricted machine-evidence records: 0

## Reconciliation decisions

- All 13 legacy DailyMed evidence records are migrated to 13 exact current
  openFDA SPL records under the `openfda-labels` CC0 policy. Each record pins
  the exact set ID, SPL version, effective time, canonical payload hash, and
  source path; DailyMed remains a reference locator only.
- The three domperidone records use the
  `mhra-govuk-drug-safety-updates` OGL policy. Their fragments bind to the
  official GOV.UK Content API payload, while the public page independently
  supplies the required OGL v3 page assertion and attribution.
- Every rule is jurisdiction-bounded to its retained evidence: `UK` for the
  three MHRA/GOV.UK domperidone rules and `US` for the FDA/DailyMed rules. No
  EU or India scope is inferred from removed or locator-only sources.
- `ziprasidone__qt_prolonging_drug` now pins every drug named by the current
  FDA label and the locally mapped Class Ia/III members. Dofetilide, quinidine,
  hydroquinidine, moxifloxacin, procainamide, disopyramide, and ibutilide no
  longer fall through. The canonical `dolasetron` runtime token matches the
  source-named `dolasetron mesylate` ingredient without creating a second
  clinical member. Obsolete
  `second_subject` and `contraindicated_perpetrator_members` shadow rosters
  were removed so the canonical perpetrator allowlist is the single runtime
  source of truth.
- `domperidone__qt_prolonging_drug` pins the reviewed QT roster and closes the
  dofetilide, quinidine, ibutilide, and moxifloxacin gaps. Apomorphine remains
  excluded. Clarithromycin is excluded so its potent-CYP3A4 contraindication is
  the only pair-specific diagnostic candidate.
- The open MHRA/GOV.UK record supports domperidone's QT-drug and potent-CYP3A4
  class contraindications. Restricted product information is retained only as
  a manual locator for roster review; no restricted quotation is stored as
  machine evidence.
- Unsupported domperidone dose and duration numbers were removed from runtime
  management. They remain explicit unresolved review claims and do not drive
  an action.
- `domperidone__moderate_cyp3a4_inhibitor` covers diltiazem and verapamil but is
  diagnostic-only. Open-government evidence establishes CYP3A4-class cardiac
  risk but does not publish the member-specific licensed action.
- `methadone__cyp_inhibitor` is diagnostic-only because its intended oral-route
  exclusion is not matcher-gateable; inhibitor initiation/discontinuation,
  dose, and stable-treatment context also materially affect the label action.
- Generic additive-QT rules remain diagnostic-only until patient QTc,
  electrolyte, dose, route, cardiac-risk, and cumulative-QT inputs are
  executable. Their evidence metadata now records the full 53-member runtime
  class separately from source-named members, class terms, and examples.
- `ondansetron__apomorphine` now retains the exact current source-action
  sentence and is a draft diagnostic-only contraindication candidate for the
  exact pair. Apomorphine is narrowed to the source product's subcutaneous
  injection route; the prior sublingual route is excluded. Concrete route and
  formulation are required, initiation direction remains unresolved, and
  promotion stays disabled.
- The high-risk haloperidol branch now encodes only intravenous injection.
  Ordinary intramuscular use at a recommended dose is excluded. The
  source-supported above-recommended-dose branch remains non-executable because
  dose is not an input; the only retained source action is ECG monitoring if
  haloperidol is administered intravenously.
- Hydroxychloroquine now retains the exact source statements that concomitant
  QT-prolonging agents increase ventricular-arrhythmia risk, co-use is not
  recommended, electrolyte imbalances should be corrected, and cardiac
  function monitored as clinically indicated. The rule remains diagnostic-only
  because the local QT roster and member-specific risk tier require clinician
  approval.
- Citalopram, escitalopram, haloperidol, and methadone propositions/actions
  remain narrowed to retained exact fragments. Unsupported blanket avoidance,
  organ-impairment, numeric-dose, and monitoring claims were removed.
- The methadone QT and CYP rules now encode `opioid_use_disorder` and
  `analgesia` as two explicit indication values instead of a matcher-inert
  combined string.
- Every Section D candidate is fail-closed with `runtime_enabled:false`.
  Direction-incomplete contraindication candidates emit no side-specific
  `action_target` or interruption protection and retain
  `clinical_context_complete:false`.
- Resolved macrolide evidence and metadata are no longer marked missing.
  Only the unsupported comparative macrolide ranking and local pair-specific
  action remain as unresolved claims.
- The shared QT member set now includes all source-named domperidone and
  ziprasidone members, so source-scoped inline rosters do not silently drift
  outside the curated vocabulary.

## Runtime state

Runtime-enabled rules: none.

Diagnostic-only rules:

- `qt_macrolide__qt_prolonging_drug`
- `citalopram__qt_prolonging_drug`
- `escitalopram__qt_prolonging_drug`
- `domperidone__potent_cyp3a4_inhibitor`
- `domperidone__moderate_cyp3a4_inhibitor`
- `domperidone__qt_prolonging_drug`
- `ondansetron__apomorphine`
- `ondansetron__qt_prolonging_drug`
- `haloperidol_iv_or_above_recommended_dose__qt_prolonging_drug`
- `haloperidol_oral__qt_prolonging_drug`
- `ziprasidone__qt_prolonging_drug`
- `methadone__qt_prolonging_drug`
- `methadone__cyp_inhibitor`
- `hydroxychloroquine__qt_prolonging_drug`

## Adversarial verification

- Every source-named ziprasidone contraindication member and each mapped
  Class Ia/III member, including hydroquinidine, produces one diagnostic
  contraindication candidate. Canonical `dolasetron` and source spelling `dolasetron
  mesylate` resolve to one clinical member and cannot duplicate the finding.
- Domperidone plus dofetilide, quinidine, ibutilide, or moxifloxacin produces
  one diagnostic QT contraindication candidate.
- Domperidone plus diltiazem or verapamil produces one diagnostic Major
  finding and no enabled finding.
- Domperidone plus clarithromycin produces the pair-specific diagnostic
  contraindication `domperidone__potent_cyp3a4_inhibitor`; the
  domperidone QT rule does not duplicate it.
- Methadone plus fluvoxamine or clarithromycin remains visible but
  diagnostic-only.
- Ondansetron plus subcutaneous-injection apomorphine produces the exact
  contraindication candidate; sublingual apomorphine does not match.
- Intravenous-injection haloperidol reaches the high-risk diagnostic branch;
  ordinary intramuscular haloperidol does not.
- Generic ondansetron, citalopram, and hydroxychloroquine QT pairs remain
  diagnostic after the member-set expansion, and all eight diagnostic QT rules
  record runtime-scope parity without claiming all members are source-named.
- Unknown methadone indication yields an indication clarification posture;
  explicit `opioid_use_disorder` and `analgesia` values select the two retained
  use contexts.
- Every rule's applicability jurisdiction exactly equals the jurisdiction
  supported by its retained evidence.
- A representative pair for every rule remains review-visible as diagnostic.
  Wrong-jurisdiction probes emit none of the scoped rules, while missing
  jurisdiction fails closed without exposing jurisdiction-specific action
  text.

## Validation

- Strict live provenance validation: 14 rules, 16 evidence records, 36 unique
  exact-text hashes, 13 current exact-version openFDA SPL records, and three
  OGL-bound records across two GOV.UK pages; every canonical payload hash and
  source path verified with zero errors.
- Structural validation: 14 rules, zero runtime-enabled, zero errors and zero
  warnings.
- Focused Section C/D adversarial tests: 34 semantic tests passed, including
  review-index parity.
- All runtime-status objects contain exactly the four required boolean fields,
  and every rule remains ineligible for promotion.

## Remaining review gates

The local QT-class mappings, restricted manual roster locators, and action
wording still require the planned two-clinician approval. The aggregate pack
must be rebuilt from the verified slices before aggregate-level runtime tests
can represent this packet.
