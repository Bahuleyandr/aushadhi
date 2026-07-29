# Warfarin–co-trimoxazole vNext approval package

**Prepared:** 2026-07-29
**Status:** `draft_non_authorizing`
**Profile requested:** `internal-evaluation`
**Clinical-use authority:** none
**Production authority:** none
**Deployment authority:** none

This is a repository-native replacement draft for the warfarin–co-trimoxazole
approval package. It resolves the ambiguous external R2/R3/R4 naming by starting a
new version-1 artifact lineage whose authority can be derived only from a later
authenticated event. The version number is an artifact version, not a claim that a
clinical decision has been made.

Creating, committing, merging, hashing, validating, or distributing this directory
does not approve a governance policy or clinical rule. The current JSONL draft stays
`runtime_enabled:false` and `promotion_eligible:false`.
`data-static/interaction-rules.json` must remain empty.

## Package contents

- `governance-policy.internal-evaluation.v1.draft.json` is a proposed policy ceiling
  for internal evaluation. It cannot approve itself, and its trust-profile bindings
  are deliberately unresolved.
- `warfarin-cotrimoxazole.rule-subject.v1.draft.json` is the exact proposed clinical
  subject: current-check-only, no age-derived branch, two exact co-trimoxazole oral
  tablets, three exact warfarin oral tablets, six deterministically ordered product
  pairs, default-deny conditional audience bindings with explicit precedence and
  intersection-only composition, per-state exposure and confirmation-method
  compatibility plus evidence requirements, and trusted order-event and
  authorized-actor requirements for the correction pathway and cancellation or
  correction terminal states.
- `approval-event.template.draft.json` separates the future immutable event body,
  detached signer envelope, canonical approval-record container, append-only store
  receipt, and signed checkpoint. Every event completion and authority field is null.
  This template must never be mutated into an approval event.
- `CLINICIAN-REVIEW.md` is a human-readable rendering and decision checklist. It is
  not the canonical approval subject and contains no signature. Focused tests parse
  its canonical clinical-text section and complete workflow table, and also bind its
  optional audit fields, change-control decisions, and every requested sign-off item
  to the canonical subject. `package-status.json` additionally binds the entire
  normalized document by SHA-256, so added, removed, or contradictory clinician-facing
  text invalidates package validation.
- `IMPLEMENTATION-STATUS.md` distinguishes repository controls that exist from
  controls required before policy sign-off, rule sign-off, promotion, production, or
  deployment.
- `package-status.json` is the machine-readable package status.

The repository parser rejects duplicate JSON members before object validation. The
draft validators pin top-level schema discriminators and return detached, deeply
immutable snapshots. Plain `JSON.parse` must not be used as the approval-artifact
ingress because it loses duplicate-member evidence.

## Deliberately narrow initial subject

The first subject uses the only temporal meaning the current checker can support:
both exact products appear in the same current interaction check. It does not claim
confirmed administration or adherence. This is a draft-contract boundary, not live
temporal enforcement: the current checker has no medication-status or intended-use
input, which must be added and validated before promotion.

The subject does not authorize:

- recent or completed exposure;
- a lookback window or post-course interval;
- course-end inference or an interaction-episode subsystem;
- an adult-only, paediatric-only, or age-derived branch;
- an urgent-supply pathway;
- fuzzy, ingredient-wide, component-only, brand-derived, route-derived, or
  formulation-derived matching; or
- production, deployment, or clinical use.

## Binding and hashing rules

Raw-file hashes, canonical-object hashes, and Git object identifiers are different
values and remain separately named. In particular, the two inherited SHA-256 values
for the RxNorm combination bundle and combination identity manifest are recorded as
`committed_blob_content_sha256`. They are not described as Git-blob SHA-256 values.
The actual Git object identifiers are separately named `git_blob_oid_sha1`.

The policy and subject do not contain their own hashes. The subject also does not
contain the commit that will eventually contain it. The safe ordering is:

1. finalize and separately approve the governance policy;
2. finalize the clinical subject with its exact policy hash;
3. commit the final policy and subject;
4. create a new immutable event body that binds both hashes and that artifact commit;
5. obtain a detached authenticated signature;
6. place the exact event body and detached envelope in the canonical
   `aushadhi.interaction-approval-record` container and hash its RFC 8785 bytes;
7. append that approval record to the approved event store;
8. retain a valid receipt that binds the combined approval record and an externally
   retained signed checkpoint;
9. run the separate technical promotion gates.

RFC 8785 canonicalization creates repeatable bytes. It does not authenticate the
reviewer or grant authority.

The approval-record schema contains only `event_body` and
`detached_signature_envelope` alongside its schema and hash-profile fields. Receipt
and checkpoint objects are explicitly excluded. The approval-statement digest uses
the profile `UTF-8-NFC-LF-no-trailing-LF`: normalize Unicode to NFC, normalize line
endings to LF, remove trailing LF characters, then hash the UTF-8 bytes with
SHA-256. These are draft profiles that still require governance approval.

Any future lifecycle event that supersedes another event must bind both the immutable
event ID and the superseded approval-record JCS hash. The approved store profile must
also enforce globally unique event IDs, deterministic stream ordering, fork rejection,
and checkpoint retention. Those controls are not implemented by this draft.

## Current decision boundary

The machine-readable policy and subject are structurally reviewable but not sign-off
ready. The governance approver model, signature profile, trusted signer and
authorization registries, event-store profile, replay/revocation controls, and
external checkpointing are unresolved. The policy therefore has no approval effect,
and the rule subject cannot yet bind an approved policy.

Promotion and deployment are out of scope for this package.
