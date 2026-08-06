# Handover — aushadhi drug-interaction checker

**Written:** 2026-07-28 · **For:** the next agent picking this up
**Read this before touching anything in `data-static/`,**
**`data/interaction/internal-evaluation/`, or `src/lib/interaction-*`.**

> **Current-state update (2026-08-06):** this handover records the reviewed
> 2026-07-28 state. A later live provenance check found source-payload drift for
> `warfarin__azithromycin_oral` and `warfarin__tramadol`. Their clinician
> approvals remain historical records, but mandatory technical holds now omit
> both from the internal-evaluation runtime pack. The current pack has six active
> rules. Exact held product pairs return `not_evaluated` and
> `manual_review_required` through a separately bound nonclinical runtime hold
> artifact. Mixed checks keep both the reviewed finding and the held scope
> visible through `reviewed_interaction_found_with_unevaluated_scope` and
> `reviewed_action_and_manual_review_required`; production-open remains empty. See
> [`2026-08-06-promoted-evidence-drift-holds.md`](./2026-08-06-promoted-evidence-drift-holds.md).

## 0 · Exact reviewed state

```text
repository        Bahuleyandr/aushadhi (PRIVATE — a connector 404 is expected)
reviewed code     9ba7833819649c187daa7ebc97eee379324b3a85
review range      0a5d5acc2d20d481b92d9306e7140ff71b63892e..9ba7833819649c187daa7ebc97eee379324b3a85
node              v26.5.0
platform          Windows 11, PowerShell + Git Bash available
```

Later commits may contain review documentation only. The reviewed code pointer is in
[`HEAD_COMMIT.txt`](./HEAD_COMMIT.txt), and the current disposition is in
[`2026-07-28-combination-identity-activation-attestation.md`](./2026-07-28-combination-identity-activation-attestation.md).

```text
npm test                                  891 total / 888 passed / 3 skipped / 0 failed
npm run interactions:promote:check        exit 0
npm run verify:combination-rxnorm-evidence
                                              1 checked / 1 verified
npm run verify:pmbjp-mapping-codes -- --list=<official PDF> --sha256=f54a...
                                              18/18 confirmed with Xpdf 4.06 -table
git diff --check                          clean
independent hostile reviews               GO / GO at exact reviewed code
```

The three skips are deliberate integration tests that need optional exact source
payloads or a cached live-openFDA response. None skips the combination identity,
mapping, PMBJP source boundary, promotion gate, or checker path. A red suite is a real
signal.

| artifact | current count |
|---|---:|
| production-open rules | **0**, `declared_coverage: unknown` |
| internal-evaluation rules / promotions | **8 / 8** |
| internal exact product pairs | **45** |
| co-trimoxazole clinical rules / promotions | **0 / 0** |
| ingredient mappings | **9** |
| product-presentation mappings | **18**, all source-bound |
| internal combination identities | **1** |
| reviewed combination presentations | **2**, PMBJP 89 and 90 |
| attested draft rows | **199**, all non-authorizing |

## 1 · Standing prohibitions

These came from the owner and independent clinical/governance review. Do not relax
them without an explicit, recorded decision from `clinician:subas`.

1. **Do not deploy anything.** Deployment requires separate explicit approval.
2. **Do not weaken production-open fail-closed behavior.**
   `data-static/interaction-rules.json` is deliberately empty.
3. **Do not copy internal-evaluation identities, mappings, catalogue rows, or rules
   into production-open.** Janaushadhi and `onemg-live` provenance is restricted and
   non-redistributable.
4. Keep failing closed on missing, stale, ambiguous, drifted, or unreviewed mappings.
   Do not accept fuzzy ingredient identity, infer oral/systemic presentation from a
   brand name, expose clinical details for unreviewed findings, or imply that a blank
   result means safety.
5. Keep therapeutic duplication distinct from a drug interaction.
6. For any promoted warfarin rule, the prescriber or anticoagulation service directs
   warfarin review and PT/INR monitoring. Never direct the pharmacy to stop or change
   a dose independently. Do not invent a monitoring schedule or
   post-discontinuation interval. Preserve evidence jurisdiction; US or UK evidence
   is not an Indian regulatory-label claim.
7. **The draft pack and the combination identity cannot self-authorize a clinical
   rule.** Runtime clinical authority exists only through an explicit
   clinician-approved promotion manifest.

## 2 · Architecture

### Two rule packs

`data-static/interaction-rules.json` is production-open, empty, and reports unknown
coverage. `interaction-rules.internal-evaluation.json` plus
`interaction-promotions.internal-evaluation.json` hold the eight existing
clinician-approved warfarin rules. Never merge these packs.

### Three identity layers

```text
ingredient-mapping-overrides.json
  one catalogue ingredient -> one runtime drug
  RxNorm TTY restricted to IN or PIN

combination-identity-overrides.json
  separate product-level path for fixed-dose combinations
  RxNorm TTY MIN, exact verified component set, exact reviewed products
  internal-evaluation only

product-presentation-overrides.json
  exact product -> route/formulation
  content-hash and source-identity bound
```

The combination path does not widen the single-ingredient IN/PIN allowlist.
`exact_active_set` is a perfect pairing: every declared component consumes one
observed ingredient slot, and no active ingredient may remain. A component never
inherits the combination runtime subject.

Combination subjects supplement component subjects. Any duplicate clinical alert is
removed only by explicit D1 rule-family supersession, with the victim, product
overlap, subject roles, specificity, and applicability checked.

### Identity and authority keys

`productIdForRow()` hashes brand, manufacturer, pack, form, and ingredient signature.
Drug codes are descriptive source metadata, not identity by themselves.
`product_assertion_sha256` is revalidated against the exact reviewed catalogue
assertion.

Authority-bearing inputs use strict plain-data snapshots. Proxies, accessors, exotic
prototypes, symbols, cycles, and custom serialization fail closed. An authentic
reviewed combination mapping is deep-frozen, privately branded by object identity,
and bound to a full final-content fingerprint before the checker can consume it.

### Key files

```text
src/lib/interaction-engine.mjs
src/lib/interaction-checker.mjs
src/lib/interaction-mapping.mjs
src/lib/interaction-combination-identity.mjs
src/lib/combination-rxnorm-evidence.mjs
src/lib/pmbjp-combination-evidence.mjs
src/lib/strict-plain-data.mjs
src/lib/product-resolver.mjs
src/cli/build-interaction-runtime-pack.mjs
src/cli/verify-combination-rxnorm-evidence.mjs
src/cli/verify-pmbjp-mapping-codes.mjs
docs/interaction-review/
```

## 3 · What is now complete

### Existing clinical rules

The eight clinician-approved internal warfarin rules remain byte-stable at runtime:
eight rules, eight promotions, and 45 exact product pairs. Production-open remains at
zero rules.

### Fixed-dose combination foundation

Clinician decisions C1–C4, D1, and D2 are implemented:

```text
C1  separate fixed-dose-combination path; never add MIN to IN/PIN
C2  include PMBJP 89 (800/160) and 90 (100/20 paediatric)
C3  oral tablets only; exclude PMBJP 88 suspension and IV
C4  authoritative PMBJP product identity is required; tender presence is not
D1  combination subjects supplement component subjects
D2  source-specific presentations bind source_identity
```

The internal identity is
`combination:co-trimoxazole:rxnorm-10831`. It uses MIN 10831, components
sulfamethoxazole 10180 IN and trimethoprim 10829 IN, and two reviewed oral-tablet
SCDs: 198335 and 142118.

The real authoritative RxNorm evidence bundle exists at:

```text
data-static/combination-rxnorm-evidence/
  combination_co-trimoxazole_rxnorm-10831.json
sha256 be734f07cceffad4f8309008a9d4df994f8141cef24b842b8d3797dea0758cbb
release 06-Jul-2026 / API 3.1.354
```

The combination manifest is:

```text
data-static/combination-identity-overrides.json
sha256 a0813b2a4d80198c6793d6e576b41847da31415f51a68ee75c744a8656223466
```

The mandatory gate checks exact names and term types, Active/current status, MIN
parts, SCD-to-MIN relations, ingredient strengths including denominators, dose form,
release/API version, and every captured-response hash.

The PMBJP product verifier binds codes 89 and 90 to the exact official-list rows,
asserts 2,111 parsed rows, and pins the PDF, Xpdf `-table` extract, and semantic row
ledger. The verifier owns the restricted source root and rejects junctions or
symbolic links at the root or any ancestor.

### Independent review

Two hostile reviews and a separate patch review re-anchored on exact code SHA
`9ba7833`. They replayed the known mapping accessor authority-transplant schedules and
the Windows junction-root escape, plus related proxy, clone, alias, product-code,
source-policy, D1, schema, and production-isolation attacks. All returned **GO** with
no clinical promotion authority.

## 4 · Landmines

### 4.1 Use Xpdf `pdftotext -table`

Poppler's `pdftotext` does not support `-table`. Xpdf 4.06 does. On this machine the
verified binary is under:

```text
D:\Dev\_codex\artifacts\scratch\2026-07-28\aushadhi-clear-blockers\
  xpdf-tools\xpdf-tools-win-4.06\bin64\pdftotext.exe
```

Put that directory first on `PATH` for the mapping-code verifier. Do not substitute
`-layout`: it orphaned 632 of 2,111 name cells from their codes. Always keep the
independent in-document row-count assertion.

### 4.2 PMBJP has two number columns

The first number is `S. No.`; the second is `Drug Code`. Mappings use **Drug Code**.
Co-trimoxazole serials 83/84/85 correspond to drug codes 88/89/90.

### 4.3 Ingredient identity does not read `name`

`createIngredientIdentity()` reads `observed_name`, `molecule_raw`, or `molecule`.
PMBJP rows have `name: null`. Also, `/sulph?a/` does not match `sulfa`; use
`sul[fp]h?a`.

### 4.4 Self-authored verifier fixtures prove only self-agreement

The earlier SCD verifier passed against an invented endpoint shape. Real RxNav shapes
are:

```text
rxcui/<id>/properties
  properties.tty / properties.name

rxcui/<id>/related?rela=has_part
  relatedGroup.conceptGroup[].conceptProperties[]

rxcui/<id>/related?rela=has_ingredients
  SCD -> MIN

rxcui/<id>/historystatus
  rxcuiStatusHistory.metaData.status / isCurrent
  definitionalFeatures.ingredientAndStrength[]
  definitionalFeatures.doseFormConcept[]
```

The SCD TTY comes from its own `properties`, not `historystatus`.

### 4.5 Freeze, clone, and getter traps

`Object.freeze()` is shallow. `structuredClone()` preserves `Map` and `Set` but does
not preserve a null prototype. Build null-prototype indexes after cloning, and
recursively freeze every reachable authority object.

Never read an untrusted envelope or product repeatedly. A stateful accessor once
allowed different product views during resolution and capability minting.
`mapResolvedProducts()` must continue snapshotting the whole record before any read.

### 4.6 Restricted roots can move through junctions

`realpathSync(TRUSTED_RESTRICTED_ROOT)` alone is not a boundary: an NTFS junction can
make the hard-coded root resolve outside the intended zone. Preserve the
segment-by-segment `lstatSync()` check on the root and every ancestor.

### 4.7 Unresolved findings are never superseded

This is intentional. A rule pending jurisdiction or other applicability data must not
be hidden.

### 4.8 Suppression and victims

The older `canExplicitlySuppress()` path does not compare victims.
`canSupersede()` does. Preserve the latter behavior so an unrelated
methotrexate–trimethoprim alert survives when a warfarin combination rule fires.

### 4.9 Schemas are strict allowlists

Adding any manifest or evidence field requires deliberate runtime and JSON Schema
updates. Rule-pack `licence_notices` is required, attributions must contain non-space
text, and URLs must be exact trimmed lowercase `https://`.

### 4.10 Shell quoting

Inline `node -e` and shell heredocs are unreliable on this Windows setup. Put one-off
scripts under `D:\Dev\_codex\artifacts\scratch\YYYY-MM-DD\`, never at `D:\Dev` root.

## 5 · What remains

### 5.1 One clinical decision

The technical identity foundation is no longer blocked. What remains for
warfarin–co-trimoxazole is explicit clinician approval of the exact clinical rule and
promotion entry.

Do not infer that approval from:

- the reviewed combination identity;
- C1–C4, D1, or D2;
- the RxNorm or PMBJP identity evidence;
- the candidate audit;
- the draft pack; or
- the independent technical GO verdicts.

The clinical review must approve exact product pairs, evidence jurisdiction,
severity, action, mechanism, and management wording. Until then, co-trimoxazole has
zero clinical runtime rules.

### 5.2 Deployment remains separate

The unrelated task “Aushadhi: validate formulation layer on real data + deploy to DD”
was not touched. Nothing in this work authorizes a deployment.

### 5.3 Nonblocking coverage notes

- Some detailed PMBJP mapping-code failure statuses are exercised through library
  tests rather than the fixed-path CLI.
- Three source-payload/live-cache integration tests skip when their optional local
  fixtures are absent.
- Restricted PMBJP source bytes are intentionally ignored by Git and must remain in
  `data/interaction/internal-evaluation/`.
- The restricted-root boundary is check-then-use rather than directory-handle
  anchored. A privileged concurrent filesystem mutator is a theoretical residual
  race; no bypass was demonstrated, and changed bytes remain hash- and
  semantics-checked.
- Omitting PMBJP path arguments fails closed but currently emits Node deprecation
  warning `DEP0187`; explicit path-type validation would remove the warning.
- The hard-pinned PMBJP source contract and `interaction-sources.json` agree at the
  reviewed SHA, but no explicit cross-file consistency assertion prevents future
  policy drift.

## 6 · Working agreements

- Re-verify inherited claims against the live checkout before acting.
- Establish catalogue ground truth before migrating any code or source binding.
- Use TDD: observe the intended failure, implement, then rerun the relevant full gate.
- Default git flow is branch, commit, merge `--no-ff` into `main`, push, and delete the
  branch. This repository has no `.github/workflows` CI lane.
- State proof limits plainly. Identity authority is not clinical authority, a hash is
  not remote-origin authentication, and a blank checker result is not safety.
