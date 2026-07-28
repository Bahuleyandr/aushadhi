# Second response to independent review — fixed-dose combination identity

**Date:** 2026-07-28 · **Prior:** `2026-07-28-combination-identity-review-response.md`

> Combination manifest empty · resolver unwired · `warfarin__cotrimoxazole` blocked ·
> production-open 0 rules. Nothing in this packet changes any of that.

---

## Packet provenance (approval blocker 1)

You were right to reject the arrow expression. Unambiguous fields:

```text
repository:    Bahuleyandr/aushadhi
branch:        main
base_commit:   a9e18c1a798353a99c0852bce684548c3c9c74c2
prior_head:    863a4b5abd9839e068e6afb8bb246718b3716feb
head_commit:   c8881354241f32e2814c48442ac31d971eb83099
change_commit: fa6c0a9 (merged --no-ff into main)
working_tree:  clean (git status --porcelain empty)
node:          v26.5.0
```

`863a4b5` was the head of the previous packet; `a9e18c1` was its base. Both are on
`main` in the repository above. If they did not resolve for you, the likely cause is
that this repository is **private** — I cannot confirm what your tooling can reach.

Immutable inputs:

```text
catalogue      dist/latest/drugs.jsonl
               sha256 a7b76e3aca27df3f1d2b3251b4bb616020d2877416133495dd877b63980ab913
               255,894 rows
pmbjp list     sha256 f54a140d9dc82880dcbb7672c18942417e8c9fe904376c742b6319665cdf9a08
tender         RC-222/2025
               sha256 47670d2b6f7daaa96afcca49c955a19fb1d3901f51f69c676624dd5b596f53ff
```

Commands, all offline:

```bash
npm test && npm run interactions:promote:check && npm run verify:combination-rxnorm-evidence
```

## Blocker 3 — the RxNorm evidence gate now exists

You were right that internal consistency does not prove external correctness, and that
a self-consistent entry could pin any plausible hash. Built to your workflow:

```text
capture responses -> commit immutable raw bundle -> offline semantic verification
                  -> hash recomputation -> compile internal-evaluation manifest
```

- [`src/lib/combination-rxnorm-evidence.mjs`](../../src/lib/combination-rxnorm-evidence.mjs)
- [`src/cli/verify-combination-rxnorm-evidence.mjs`](../../src/cli/verify-combination-rxnorm-evidence.mjs)
  — `npm run verify:combination-rxnorm-evidence`
- 11 tests in [`test/combination-rxnorm-evidence.test.mjs`](../../test/combination-rxnorm-evidence.test.mjs)

It recomputes every hash from the committed raw response and fails on: a synthetic
fixture hash on the production path, a hash/response mismatch, missing raw evidence, a
`has_part` set RxNorm did not return, a concept that is not a `MIN`, a presentation that
is not an `SCD`, an SCD whose `has_ingredients` link does not reach the declared `MIN`,
changed strength or dose form, and release or API-version disagreement.

The `has_ingredients` check closes your required item "the SCD has the expected MIN or
exact component relationship" on its stronger branch: an SCD can carry exactly the right
ingredient set and still belong to a different multiple-ingredient concept, and only the
link catches that. `min_relation_response_sha256` is a required field per presentation.

Two points from your note are handled explicitly:

- **PIN ingredient fields.** The compared field is recorded per presentation
  (`ingredient_rxcui_field`, one of base ingredient / basis-of-strength / active
  ingredient / plain), and an unrecognised field is a finding. Nothing is inferred.
- **Fixture evidence never enters a production path.** Placeholder hashes are refused
  by code, not convention.

The gate currently reports the manifest is empty and that it is mandatory before any
non-fixture combination is authored. It is honest about verifying nothing yet.

**Your correction accepted:** the packet should not have said "all seven blockers are
addressed". Blocker 3 was closed at the schema layer only. It is now closed at both
layers, and the statement is: *six were closed previously; blocker 3 is closed as of
this packet.*

## The three code-inspection items — all three were real

### Deep immutability — you were right, `Object.freeze` was shallow

Your exact mutation worked. The compiled form is now `structuredClone`d and recursively
frozen, and the reviewed-product index is exposed as a frozen lookup object rather than
a live `Map` (a `Map` stays mutable no matter what you freeze around it). Tests prove
mutating the source after compilation has no effect, nested arrays and objects are
frozen, and `reviewed_products.set` is not callable.

### Overlap — the check was wrong in **both** directions

Your minimum case already threw, but for the wrong reason, and the same crude rule had a
worse failure: it rejected *any* two combinations sharing a component alias. That would
have rejected **paracetamol+codeine alongside paracetamol+ibuprofen** — making the model
useless for real fixed-dose combinations.

Replaced with the test you actually described: two combinations overlap iff *some product
active set could match both*, computed as a permutation search over components with a
system-of-distinct-representatives check on the alias intersections. Both cases are now
pinned — your `{x},{y}` vs `{x},{y,z}` case fails at authoring; the paracetamol pair
validates.

### Audit results are now a distinct type

Not a flag on a runtime-shaped result. Status is `audit_match`, there is no
`runtime_subject` (it is `null`), the match is reported as `candidate_subject`, and
`assertRuntimeCombinationResult()` throws if an audit result reaches a runtime path.

## Scope pairs — accepted

`routes` and `dose_forms` are gone, replaced by `presentation_scopes: [{route,
formulation}]`, validated as pairs against the reviewed presentations. Independent set
equality could not distinguish `{oral+tablet, iv+injection}` from `{oral+injection,
iv+tablet}`; pair equality can.

## D2 — accepted, and recorded as blocking production promotion

> All source-specific presentation mappings, including the existing single-ingredient
> PMBJP mappings, must bind a stable `source_identity` in addition to the content-derived
> `product_id` and `product_assertion_sha256`. `productAssertionHashForRow()` must **not**
> absorb `sources[]`.

**Not implemented in this packet, deliberately.** It migrates and re-attests 18
clinician-approved mappings and changes single-ingredient resolution — that is its own
change with its own review, not a rider on this one. You classified it as not blocking
the empty FDC foundation but blocking presentation-based production promotion; it is
recorded on exactly those terms, with your six regression cases carried forward verbatim.

## Catalogue sweep — reclassified as you asked

You were right that "manifest empty" and "2 resolved" read as contradictory. The sweep
uses a fixture, and both fixture and script are now committed so it can be reproduced:

```text
classification    AUDIT FIXTURE SWEEP -- carries no promotion authority
fixture manifest  docs/interaction-review/audit-fixtures/
                  2026-07-28-cotrimoxazole-audit-fixture-manifest.json
                  sha256 3de7a42e3591f22e8f202352aa7455439d1ae571202e9e1bd32eb97f30e0113e
sweep script      docs/interaction-review/audit-fixtures/2026-07-28-catalogue-sweep.mjs
                  sha256 3eaa1f9ea4ea70d9c934ebb95f6301a87fb8065b826962cb9dabcfbb0b9ebda0
catalogue         sha256 a7b76e3aca27df3f1d2b3251b4bb616020d2877416133495dd877b63980ab913
command           node docs/interaction-review/audit-fixtures/2026-07-28-catalogue-sweep.mjs \
                    docs/interaction-review/audit-fixtures/2026-07-28-cotrimoxazole-audit-fixture-manifest.json
```

| profile | outcome | count |
|---|---|---|
| internal-evaluation | `reviewed_override` | **2** — PMBJP 89, 90 |
| internal-evaluation | no reviewed presentation → fails closed | 147 |
| internal-evaluation | no active-set match | 255,745 |
| **production-open** | **`reviewed_override`** | **0** |

The fixture carries synthetic RxNorm hashes, so this establishes **matching and
fail-closed behaviour only**. It validates no RxNorm evidence and authorises nothing.

## Gate

```text
775 tests / 770 passed / 5 explicitly skipped / 0 failed   (exit 0)
```

Skips name `pigz` as the missing prerequisite. Your point about a CI lane installing
`pigz` is noted and not addressed here.

## What remains open

- D2 migration of the 18 single-ingredient presentation mappings.
- A real evidence bundle: none exists, because no combination is authored. The gate is
  in place and mandatory; it has nothing to verify yet — which is the blocked step.
- Resolver wiring, pending D1 deduplication tests.
