# Fixed-dose combination identity — canonical attestation packet

**Date:** 2026-07-28 · **Supersedes** both prior response packets as the record of truth.
Where an earlier packet disagrees with this one, this one is correct.

> Combination manifest empty · resolver unwired · `warfarin__cotrimoxazole` blocked ·
> production-open 0 rules. Nothing here changes any of that.

---

## 1 · Provenance — reconciled

**The `774` / `775` disagreement was real and mine.** Neither figure was wrong at the moment
it was written; they were taken at different commits and I published both without saying so.
`774` was the count at `c888135`; `775` was the count after the SCD→MIN check landed at
`a8e2235`. Only the head below is canonical.

```text
repository:     Bahuleyandr/aushadhi   (private)
branch:         main
review_range:   863a4b5abd9839e068e6afb8bb246718b3716feb
                ..
                e90332def83337c5b8b81e619006bd9eb4f64415
code_head:      e90332def83337c5b8b81e619006bd9eb4f64415
                the reviewable code state. A packet cannot name the SHA of the
                commit that contains it, so any commit after this one touches
                DOCUMENTATION ONLY. Verify with:
                  git diff --stat e90332def83337c5b8b81e619006bd9eb4f64415..HEAD
                which must list only docs/interaction-review/ paths.
                The current value is in docs/interaction-review/HEAD_COMMIT.txt.
git rev-parse HEAD        == git rev-parse origin/main
git status --porcelain    == empty
node:           v26.5.0
```

`change_commit: fa6c0a9` is withdrawn as an abbreviation; use the review range.

**On your 404:** the repository is private, so a connector 404 is expected and is not
evidence either way. I cannot grant access from here. If you need an inspectable diff,
`git format-patch 863a4b5..HEAD` produces one that can be shared out of band.

Immutable inputs:

```text
catalogue    dist/latest/drugs.jsonl
             sha256 a7b76e3aca27df3f1d2b3251b4bb616020d2877416133495dd877b63980ab913
             255,894 rows
pmbjp list   sha256 f54a140d9dc82880dcbb7672c18942417e8c9fe904376c742b6319665cdf9a08
tender       RC-222/2025
             sha256 47670d2b6f7daaa96afcca49c955a19fb1d3901f51f69c676624dd5b596f53ff
```

## 2 · Immutability — every `Set` and `Map`, and prototype safety

You were right that the `Map` fix was necessary but not sufficient. The compiled form now
holds **no reachable collection instance at all**: the reviewed-product `Map` is
module-private in a closure and is never returned. A test walks the entire exposed graph and
asserts no reachable value is a `Map` or a `Set`.

Prototype safety, as you specified — and note the ordering trap you flagged is real, so the
null-prototype objects are created **after** `structuredClone`:

```text
Object.getPrototypeOf(compiled)                    === null
Object.getPrototypeOf(compiled.reviewed_products)  === null
compiled.reviewed_products.get('__proto__')        === null
compiled.reviewed_products.get('constructor')      === null
```

Also proven: source mutation after compilation has no effect; nested component aliases,
presentation scopes, `rxnorm_scd.ingredients_and_strengths` entries and reviewed
presentations are all frozen.

## 3 · The evidence gate is now unavoidable

You were right that a documented command is not a boundary. Two independent mechanisms:

**(a) The promotion gate runs the verifier.** `interactions:promote:check` and the pack build
both call `assertCombinationEvidenceVerified()` first. A non-empty combination manifest whose
evidence is missing or unverified **fails the gate**, naming the combination and the finding
codes. Four regression tests in
[`test/combination-promotion-gate.test.mjs`](../../test/combination-promotion-gate.test.mjs)
prove it, including your required case.

**(b) `compiled_kind` is a type boundary, not a label.** Your point that documentation is not
a type stands, so:

```text
compileCombinationIdentityManifest(m, {kind: 'verified_manifest'})
  -> THROWS for a non-empty manifest unless evidenceVerified

resolveCombinationIdentity        accepts only verified_manifest
auditCombinationIdentity...       accepts either kind
assertRuntimeCombinationResult    rejects audit_match AND any result whose
                                  compiled_kind is audit_fixture
```

The audit-fixture sweep now demonstrates this on real data rather than asserting it:

```json
"compiled_kind": "audit_fixture",
"runtime_resolver_refuses_fixture": true,
"runtime_assertion_refused_matches": 2,
"matches": [ { "code": "89", "runtime_subject": null, "candidate_subject": {...} }, ... ]
```

The earlier sentence "fixture evidence never enters a production path" was stronger than the
evidence behind it. It is now enforced by type.

## 4 · RxNorm semantics

**Concept status — was not checked, now is.** You were right that TTY validation alone is
insufficient because an obsolete SCD is still an SCD. Every concept in the graph — the MIN,
every component, every SCD — must have a committed history-status response with
`status: Active` and `isCurrent: YES`. `Obsolete`, `Remapped`, `Non Current` and `Unknown`
all fail, as does a missing status response.

**Per-entry ingredient field — was per-presentation, now per entry.** You were right that a
MIN may mix IN and PIN components, so one selector for the whole SCD is too coarse:

```json
{
  "component_rxcui": "10180", "ingredient_rxcui_field": "baseRxcui",
  "numerator_value": "800", "numerator_unit": "MG",
  "denominator_value": null, "denominator_unit": null
}
```

`ingredient_rxcui_field` is one of `rxcui` / `baseRxcui` / `bossRxcui` /
`activeIngredientRxcui`, chosen per entry. A test compares one component on `baseRxcui` and
another on `bossRxcui` within a single SCD.

**Exact, not subset.** All three sets are compared with set equality, so an extra returned
component fails exactly as a missing one does: MIN `has_part`, SCD ingredient set, and SCD
`has_ingredients` → MIN.

**Bundle-wide integrity.** Every committed response is hashed, not only the manifest-pinned
ones, so a status or relationship response cannot be swapped without detection. On your point
that hashing proves integrity but not origin: agreed, and stated — the capture step records
the RxNorm version response and the bundle pins the release, but provenance of the bytes
rests on the capture procedure, not on the hash.

## 5 · Overlap — Hall deficiency now tested

Your three-component case is in the suite and **validates** (no overlap), because A1 and A2
can both pair only with B1 so no perfect matching exists. That exercises the
distinct-representatives search rather than merely naming it. The two-component overlap case
still fails at authoring, and the shared-component case (paracetamol+codeine /
paracetamol+ibuprofen) still validates.

## 6 · Audit-fixture sweep

```text
classification    audit_fixture_sweep -- no promotion authority
fixture manifest  docs/interaction-review/audit-fixtures/
                  2026-07-28-cotrimoxazole-audit-fixture-manifest.json
                  sha256 1b1da8c4ca40e57769ff40077b5a22d5b2a6a1dea650fb73e7be89dbc1f783cb
sweep script      docs/interaction-review/audit-fixtures/2026-07-28-catalogue-sweep.mjs
                  sha256 0b53a8386457554f176bced80c5feb747a457042b6524efd10a7af18ccd12ac2
catalogue         sha256 a7b76e3aca27df3f1d2b3251b4bb616020d2877416133495dd877b63980ab913
```

| outcome | count |
|---|---|
| `audit_match` (all with `runtime_subject: null`) | **2** — PMBJP 89, 90 |
| no reviewed presentation → fails closed | 147 |
| no active-set match | 255,745 |
| runtime results produced | **0** — the runtime resolver refuses the fixture by type |

## 7 · Gate

```text
788 tests / 783 passed / 5 explicitly skipped / 0 failed   (exit 0)

npm test                             exit 0
interactions:promote:check           exit 0
verify:combination-rxnorm-evidence   exit 0
verify:pmbjp-mapping-codes           18/18 confirmed
git diff --check                     clean
```

Skips name `pigz` as the missing prerequisite.

## Still open

- **D2** — migration of the 18 single-ingredient presentation mappings to bind
  `source_identity` separately. Open; blocks presentation-based production promotion; does not
  block this foundation.
- **A real evidence bundle.** Your suggestion of a read-only, explicitly non-authoritative
  *verifier integration fixture* using real RxNorm responses is accepted and **not yet done**:
  it needs live capture, which I have not performed. Recorded as the next step, with your
  requirement that the version response be captured immediately before and after the concept
  captures and both must agree.
- **Resolver wiring**, pending D1 deduplication tests.

---

## Addendum — 2026-07-28, verifier integration fixture

**Code head advanced to `3443e34e157653ed492d685af91be4ba84a5d793`.** The invariant
above still holds: later commits touch documentation only.

Your suggested integration fixture found a real defect on its first run, so it is
worth recording plainly.

**The SCD verification path was verifying nothing.** Its parsing had been written
against a response shape invented for the unit fixtures — a bespoke endpoint
returning `ingredients[]` with snake_case strengths. RxNav returns no such thing.
Against real responses the verifier found nothing to compare and reported success.

Captured read-only from `https://rxnav.nlm.nih.gov/REST`, version response taken
immediately before **and** after the concept requests and confirmed identical, per
your requirement:

```text
rxnorm_release   06-Jul-2026
api_version      3.1.354
responses        13, committed under
                 data-static/combination-rxnorm-evidence/integration-fixture/
                 sha256 5ba9dc630eec53b295cc370732b16e2be1a4fcef6b1b226003a62bc97fda203c
classification   verifier_integration_fixture · promotion_authority none
```

What was already correct, now confirmed against live data:

```text
rxcui/<id>/properties                  -> properties.tty / .name
rxcui/<id>/related?rela=has_part       -> relatedGroup.conceptGroup[].conceptProperties[]
rxcui/<id>/historystatus               -> rxcuiStatusHistory.metaData.status / .isCurrent
```

What was wrong and is now corrected:

```text
SCD ingredients, strengths, dose form
  -> rxcuiStatusHistory.definitionalFeatures.ingredientAndStrength[]
       { baseRxcui, bossRxcui, activeIngredientRxcui, moietyRxcui,
         numeratorValue, numeratorUnit, denominatorValue, denominatorUnit }
     ...definitionalFeatures.doseFormConcept[].doseFormName
SCD term type
  -> its own properties endpoint, not the history-status response
```

So `rxnorm_scd` now pins **three** hashes — properties, history-status and
`has_ingredients` — rather than one invented one. `moietyRxcui` was added to the
ingredient-field allowlist (RxNav returns it); the plain `rxcui` field was removed,
since ingredient-and-strength rows do not carry one. Denominator comparison was added
because real rows carry `1 EACH` for a tablet.

Live data confirms: all five concepts `Active` / `isCurrent YES`; MIN `10831`
`has_part` → `{10180 IN, 10829 IN}`; both SCDs `has_ingredients` → `10831`.

```text
799 tests / 794 passed / 5 explicitly skipped / 0 failed   (exit 0)
```

Manifest still empty · resolver still unwired · `warfarin__cotrimoxazole` still
blocked · production-open still 0.

---

## Addendum — D2 complete

**Code head `45764a2a91993b821460e7a2276532c304af7551`.** All 18 single-ingredient
PMBJP presentation mappings are now source-bound. This clears the item you recorded
as blocking presentation-based production promotion.

**Ground truth was established before anything was bound.** Binding a code without
first checking it would have cemented whatever was there — the F5 failure mode. Every
mapping's code was checked against the catalogue row's own `sources[].source_id`
across all 255,894 rows:

```text
code agrees with the catalogue row     18 / 18
assertion drift                         0
duplicate PMBJP source identities       0   (whole catalogue)
```

So this is a pure re-attestation with no corrections. `productAssertionHashForRow()`
was **not** changed to absorb `sources[]`, as you directed.

Resolution is source-identity-first and never falls back to content-only:

```text
source identity matches + content matches   -> reviewed_override
source identity matches + content changed   -> stale
source identity differs                     -> unmapped, source_identity_mismatch
no source identity, content matches         -> unmapped, reviewed_source_identity_absent
same source identity on two catalogue rows  -> throws
```

Mappings without a `source_identity` keep content-only behaviour, so non-PMBJP
presentation mappings are untouched.

All six of your regression cases are pinned, including the two that content-only
resolution would have got wrong: identical content under a different code, and a wrong
PMBJP code on a matching product id.

`verify:pmbjp-mapping-codes` now checks the **resolver binding**, not list membership:
it locates each mapping by source identity, compares the current product id and
assertion hash, sweeps the whole catalogue so a source identity claimed by two rows is
an error rather than whichever row was read first, and only then checks the official
list. Still **18/18 confirmed**.

**Honest limit:** the new CLI statuses (`source_identity_absent_from_catalogue`,
`source_identity_claimed_by_several_rows`, `bound_product_id_changed`,
`bound_product_assertion_changed`) are exercised through the library-level tests, not
through the CLI itself, because the CLI reads the committed manifest from a fixed path.

```text
809 tests / 804 passed / 5 explicitly skipped / 0 failed   (exit 0)
```

Production-open still 0 rules · combination manifest still empty · resolver still
unwired · `warfarin__cotrimoxazole` still blocked.

**Remaining:** D1 resolver wiring, pending combination/component deduplication tests.
