# Warfarin–co-trimoxazole vNext — implementation status

**As of:** 2026-07-29
**Overall:** draft package implemented; no policy or rule sign-off; no promotion or
deployment authority

## Implemented in this repository

- A repository-native, machine-readable internal-evaluation governance-policy draft.
- A machine-readable clinical-rule subject with:
  - current-check-only applicability;
  - no lookback, course-end inference, recent-exposure trigger, or episode system;
  - no age filter or age-derived branch;
  - exact oral-tablet identity bindings;
  - exactly six enumerated product pairs;
  - explicit PMBJP 89 strength-and-dose-form alignment without claiming a direct
    PMBJP product label;
  - explicit PMBJP 90 proposed strength extrapolation without direct label evidence;
  - bounded clinical text and separated audience fields;
  - default-deny pharmacy, prescriber/service, and patient render allowlists;
  - explicit condition precedence, intersection-only conditional/general
    composition, no union, no unsafe fallback, and no-content behavior for unknown
    or conflicting render conditions;
  - distinct no-content behavior for an unreviewed subject or identity-unresolved
    finding and pharmacy-escalation-only behavior for exposure-unresolved
    applicability after subject and identity review;
  - per-state exposure and confirmation-method compatibility;
  - pending- and terminal-state-specific evidence, correction recheck, and trusted
    order-event and authorized-actor requirements for the correction pathway and
    cancellation or correction terminals;
  - no urgent-supply authority; and
  - no current supersession.
- A draft-only template separating a future event body, detached signature envelope,
  canonical approval-record container, append-only store receipt, and signed
  checkpoint.
- Correct hash terminology: the two inherited evidence/manifest values are
  `committed_blob_content_sha256`; actual Git object identifiers are separately named
  `git_blob_oid_sha1`.
- A machine-readable package status that reports every authority dimension as
  `none`.
- Exact-value validation for every safety-critical policy, subject, workflow,
  signature-template, receipt-template, and checkpoint-template field.
- Duplicate-member-rejecting raw JSON parsing, exact top-level schema
  discriminators, and detached deeply immutable validator results.
- A test that rehashes the committed RxNorm/combination objects, Git object IDs,
  current JSONL row, and repository-base relationship; current product/assertion
  values are resolved against the reviewed manifests. A separate test binds every
  requested clinician sign-off item to the human rendering, and a normalized
  whole-document SHA-256 binding rejects any added, removed, or contradictory
  clinician-facing text.
- Existing fail-closed identity and production isolation remain unchanged.

These artifacts describe and validate a draft contract. They do not implement
authentication, authorization, an approval event store, structured runtime workflow
state, medication-status or intended-use input, or clinical promotion. In
particular, `current_check_only` is not live temporal enforcement: the current
checker sees product co-presence but cannot prove current or intended overlap.

## Required before governance-policy sign-off

- Define and approve the independent bootstrap governance policy.
- Define governance approvers, roles, quorum, suspension authority, review periods,
  and expiry behavior.
- Pin a conformant RFC 8785 implementation and cross-language conformance vectors,
  including duplicate-key and I-JSON rejection.
- Pin the signature profile, accepted algorithm, signer/key registry, authorization
  registry, authentication assertion issuer, trusted-time behavior, replay controls,
  and revocation semantics.
- Pin the append-only event-store profile, configuration identity, store key,
  retention policy, fork handling, and externally retained signed checkpoints.
- Approve the exact `aushadhi.interaction-approval-record` container and the
  `UTF-8-NFC-LF-no-trailing-LF` approval-statement hash profile.

Until these exist, the policy is not sign-off ready and cannot authorize a rule.

## Required before clinical-rule sign-off

- Complete authenticated governance-policy sign-off and bind its exact canonical
  SHA-256 in the rule subject.
- Have the clinician resolve every decision listed in `CLINICIAN-REVIEW.md`,
  especially the PMBJP 90 strength extrapolation.
- Finalize the exact approval statement without blanks, placeholders, or mutable
  fields.
- Commit the final policy and subject before constructing an approval event.
- Verify every inherited repository, source, identity, product, and assertion binding
  against the committed objects.
- Reverify the retained openFDA payload and fragments against their recorded hashes;
  the repository test rehashes the committed identity objects and draft row but does
  not substitute for that source-object check.

The event body must then be created as a new immutable object. It must bind the exact
subject hash, policy hash, approval statement, reviewer identity and role, reviewed
time, and the commit containing the finalized artifacts. It must not contain its own
hash or signature, self-attested key status, receipt data, or technical gate results.
The event body and detached signature envelope must then be placed in the canonical
approval-record container; receipt and checkpoint objects are not members of that
record.

## Required before internal-evaluation promotion

- Authenticate and authorize the detached clinician signature against pinned trust
  records.
- Append the completed approval record to the approved store and verify a
  store-signed receipt plus an externally retained signed checkpoint.
- Keep event authenticity, current clinical authority, subject binding, gate status,
  promotion eligibility, and activation as separate derived dimensions.
- Reconcile the broader non-authorizing `batch-01-v2` JSONL row, compute its new hash,
  and pin that new row in a clinician-approved promotion record.
- Implement runtime/compiler/renderer support for structured audience fields and
  workflow states. The present compiler flattens management text and cannot enforce
  this proposed contract.
- Enforce the subject's default-deny and conditional audience allowlists, including
  precedence, intersection-only composition, no unsafe fallback, and the distinction
  between an unreviewed or identity-unresolved finding and exposure-unresolved
  applicability.
- Enforce per-state exposure and confirmation-method compatibility, terminal-state
  evidence, and correction recheck.
- Validate cancellation and correction terminal evidence against a trusted order
  system and authorization registry; pharmacy self-attestation must never satisfy
  either terminal state.
- Implement and test a medication-status or intended-use input contract before
  claiming that `current_check_only` is temporally enforced.
- Implement the visible watermark:
  `INTERNAL EVALUATION — NOT FOR CLINICAL USE`.
- Implement the exact package/event/gate runner and validate:
  - policy, subject, event, signature, receipt, and checkpoint integrity;
  - repository, source, identity, product, and assertion bindings;
  - exactly six positive pairs and no seventh pair;
  - order invariance;
  - PMBJP 89 direct-evidence metadata;
  - PMBJP 90 strength-extrapolation metadata;
  - suspension, intravenous, fuzzy, component-only, stale, ambiguous, drifted, and
    unreviewed negative cases;
  - unresolved/not-evaluated semantics;
  - workflow and audience boundaries;
  - duplicate and supersession behavior;
  - evaluation watermarking;
  - production-open remaining empty; and
  - the full regression suite.

A failed or stale technical gate blocks promotion. It does not rewrite or erase an
otherwise authentic historical approval event. Passing gates cannot replace a
missing or invalid approval.

## Verification snapshot — 2026-07-30

- `npm test`: 903 tests; 900 passed; 3 skipped; 0 failed.
- Focused co-trimoxazole, combination, source-policy, promotion, and supersession
  tests: 140 passed; 0 failed; 0 skipped.
- `npm run interactions:promote:check`: passed for the unchanged eight-rule
  internal-evaluation runtime pack.
- `npm run verify:combination-rxnorm-evidence`: one combination checked and
  `combination:co-trimoxazole:rxnorm-10831` verified.
- `npm run verify:pmbjp-mapping-codes` against the retained official PMBJP PDF and
  pinned SHA-256: 18 of 18 mappings confirmed.
- `npm run verify:interaction-evidence`: failed closed because 6 of 244 existing
  evidence records no longer matched live provenance. Five openFDA records reported
  payload-hash drift (`warfarin__azithromycin_oral`,
  `dextromethorphan__ssri_snri`,
  `sedating_antihistamine__cns_depressant`,
  `qt_macrolide__qt_prolonging_drug`, and
  `risedronate_immediate_release__oral_cation_food`); one record reported version
  drift (`potassium_chloride_solid_oral__gi_transit_slowing`).

That live-provenance failure is a real promotion blocker. It was not bypassed, and no
evidence record was changed as part of this draft-package work. It does not create
authority or change the non-authorizing structural status of this package.

## Required before production or deployment

Production requires a separate scope and separate explicit approvals. At minimum it
still needs:

- independent evidence triangulation, including peer-reviewed clinical outcomes;
- India-specific anticoagulation, pharmacy, antimicrobial-stewardship, clinical,
  legal, and regulatory governance;
- prospective shadow-mode and human-factors validation;
- alert-burden and safe-repeat-alert testing;
- security, privacy, least-privilege, PHI-separation, and tamper-evidence review;
- tested rollback and kill-switch behavior that preserves approval history;
- automated drift monitoring for SPL, PMBJP, RxNorm, schemas, compilers, renderers,
  trust profiles, and event-store state; and
- numerical acceptance criteria with accountable clinical and release owners.

None of this package grants production or deployment authority. Do not deploy.

## Preserved repository state

- The existing warfarin–co-trimoxazole JSONL row remains non-authorizing.
- No warfarin–co-trimoxazole promotion exists.
- `data-static/interaction-rules.json` remains the empty production-open pack with
  declared coverage `unknown`.
- The eight existing internal-evaluation clinical rules and promotions are unchanged.
