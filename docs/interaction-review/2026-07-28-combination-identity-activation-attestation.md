# Fixed-dose combination identity — activation attestation

**Date:** 2026-07-28
**Status:** technical identity foundation independently approved
**Clinical promotion authority:** none
**Deployment authority:** none

This packet records the first reviewed, evidence-bound activation of the separate
fixed-dose-combination identity path. It supersedes earlier packets only where they
describe the combination manifest as empty, the resolver as unwired, or the real
combination evidence bundle as absent. Historical findings and decisions remain part
of the audit record.

## 1 · Exact reviewed boundary

```text
repository      Bahuleyandr/aushadhi (private)
review_range    0a5d5acc2d20d481b92d9306e7140ff71b63892e
                ..
                9ba7833819649c187daa7ebc97eee379324b3a85
code_head       9ba7833819649c187daa7ebc97eee379324b3a85
node            v26.5.0
platform        Windows 11
```

`code_head` is the exact code and data revision independently reviewed. Any later
commit that contains this packet must be documentation-only relative to that SHA.
The stable pointer is also recorded in
[`HEAD_COMMIT.txt`](./HEAD_COMMIT.txt).

The repository is private. A connector 404 is expected and is not evidence that the
revision is missing.

## 2 · Activated identity scope

The internal-evaluation identity manifest now contains exactly one fixed-dose
combination:

```text
combination_id       combination:co-trimoxazole:rxnorm-10831
runtime drug         co-trimoxazole
RxNorm concept       10831, MIN
components           10180 sulfamethoxazole, IN
                     10829 trimethoprim, IN
match mode           exact_active_set
allowed profile      internal-evaluation only
reviewed products    PMBJP drug code 89, 800 mg / 160 mg oral tablet
                     PMBJP drug code 90, 100 mg / 20 mg oral tablet
excluded             PMBJP 88 oral suspension
                     intravenous and all other presentations
```

The MIN concept remains prohibited in
`ingredient-mapping-overrides.json`. Fixed-dose combinations use the separate
product-level path required by clinician decision C1. Every declared component must
consume exactly one observed active-ingredient slot, with no missing, duplicated, or
leftover active ingredient.

Combination subjects supplement component subjects. They do not replace them.
Clinical-alert deduplication remains rule-level and may occur only through explicit,
clinician-approved D1 supersession metadata.

## 3 · Evidence and source binding

### RxNorm

The authoritative offline bundle is:

```text
path            data-static/combination-rxnorm-evidence/
                combination_co-trimoxazole_rxnorm-10831.json
sha256          be734f07cceffad4f8309008a9d4df994f8141cef24b842b8d3797dea0758cbb
classification  combination_identity_evidence
authority       identity_only
captured_at     2026-07-28T06:27:46.630Z
release         06-Jul-2026
API version     3.1.354
version stable  true
```

The bundle pins and verifies the exact raw responses for the MIN, both components,
and both oral-tablet SCDs. The gate requires:

- exact TTY and names from each concept's `properties` response;
- `Active` and `isCurrent: YES` from every `historystatus` response;
- exact MIN `has_part` equality with the two declared IN components;
- exact SCD-to-MIN `has_ingredients` equality;
- exact per-component numerator, denominator, unit, and oral-tablet dose form;
- exact hashes for every captured response; and
- identical version responses immediately before and after capture.

The bundle's byte hash proves integrity after capture. It does not independently
authenticate the remote server; origin rests on the documented HTTPS capture
procedure plus the verifier's exact RxNorm base-URL binding.

### PMBJP

The reviewed product assertions are bound to the official PMBJP list:

```text
source URL      https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/feb/doc202626781701.pdf
PDF sha256      f54a140d9dc82880dcbb7672c18942417e8c9fe904376c742b6319665cdf9a08
PDF bytes       1,670,737
table sha256    bb5a5eabbda1802313b546c6b3605315c8bf4f113825ca1794724dab84e1f299
row-ledger hash 336b9ea72d2a249edac467bc9ec2c2c052520878ea13d7fdb4c8a4d7f8281688
parsed rows     2,111
extractor       Xpdf pdftotext 4.06, -table
```

The source verifier owns the exact restricted root, rejects a caller-selected
lookalike root, resolves every evidence file inside that root, and now rejects an
NTFS junction or symbolic link at the root or any ancestor.
The PMBJP source policy permits identity use only in `internal-evaluation`; it remains
restricted and non-redistributable.

The filesystem check is fail-closed but check-then-use rather than directory-handle
anchored. A privileged concurrent filesystem mutator is therefore a theoretical
residual race; no bypass was demonstrated, and changed source bytes remain subject to
the pinned byte hashes and semantic checks.

## 4 · Runtime authority boundaries

The activation does not trust shape-compatible caller objects:

- manifests and evidence bundles are strict plain-data snapshots;
- proxies, accessors, custom prototypes, symbols, cycles, and custom serialization
  are rejected before authority-bearing reads;
- `mapResolvedProducts()` snapshots each record and product exactly once;
- final product identity is rechecked after mapping;
- an authentic reviewed combination product is recursively frozen, object-identity
  branded in a private `WeakMap`, and bound to a domain-separated hash of its complete
  final mapped content;
- cloned, altered, stale, unreviewed, ambiguous, out-of-profile, or component-only
  products cannot create a combination runtime subject; and
- production-open filtering removes the internal combination identity.

The promotion gate independently requires an authentic verified RxNorm report and an
authentic verified PMBJP source report before it will compile a non-empty combination
manifest.

## 5 · Clinical authority remains absent

This attestation authorizes only the internal identity foundation. It does not approve
the warfarin–co-trimoxazole interaction rule.

Current rule state:

```text
production-open rules                    0
production-open declared coverage        unknown
internal-evaluation rules                8
internal-evaluation promotions           8
internal exact product pairs             45
co-trimoxazole clinical rules             0
co-trimoxazole clinical promotions        0
```

The attested draft pack remains non-authorizing. A co-trimoxazole clinical rule may
enter the promotion manifest only after an explicit, recorded clinician decision on
the exact rule text and scope. That review must preserve the established workflow
boundary: the prescriber or anticoagulation service directs warfarin review and PT/INR
monitoring; pharmacy must not be instructed to stop or change a dose independently;
no monitoring schedule or post-discontinuation interval may be invented; and US
evidence must not be presented as an Indian regulatory-label claim.

A blank checker result still does not mean safety.

## 6 · Independent hostile review

Two independent reviews re-anchored on the exact `code_head` and returned **GO** with
`promotion_authority: none`.

The reviewers replayed:

- both known stateful `record.product` authority-transplant schedules;
- top-level and nested accessors, proxies, custom prototypes, altered clones, and
  post-mapping mutation attempts;
- the verifier-owned PMBJP root as an NTFS junction;
- a junction in an ancestor of that root and a child junction escaping the root;
- source-ID, product-code, URL, hash, alias, and brand-fragment laundering;
- D1, production-isolation, source-policy, and licence schema/runtime parity probes.

All authority-transplant getters were rejected with zero reads. Junction probes were
rejected before a capability could be minted. The reviewers found no remaining
technical promotion blocker in the foundation.

## 7 · Gates at the reviewed code head

```text
npm test
  891 total / 888 passed / 3 deliberate skips / 0 failed

npm run verify:combination-rxnorm-evidence
  checked 1 / verified 1

npm run interactions:promote:check
  internal-evaluation pack verified

npm run verify:pmbjp-mapping-codes -- --list=<official PDF> --sha256=f54a...
  Xpdf pdftotext 4.06 / 18 of 18 mappings confirmed

independent hostile focused suite
  177 of 177 passed

git diff --check
  clean
```

The three skips require optional exact source-payload or cached live-openFDA fixtures.
They do not skip the combination identity, mapping, source-boundary, promotion, or
checker paths.

## 8 · Disposition

The active technical blockers named in the prior handover are cleared:

- the real authoritative RxNorm combination bundle exists and passes the mandatory
  offline gate;
- the official PMBJP products are source-bound and verified from the fixed restricted
  root;
- the separate MIN identity path is wired for the two reviewed oral tablets;
- independent foundation review is complete; and
- the two final hostile-review findings are closed.

What remains is an owner/clinician decision, not unfinished technical foundation work:
explicit approval of the exact warfarin–co-trimoxazole clinical rule and promotion
entry. Deployment remains separately prohibited until expressly approved.
