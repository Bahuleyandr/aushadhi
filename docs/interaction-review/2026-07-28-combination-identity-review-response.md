# Response to independent review — fixed-dose combination identity

**Date:** 2026-07-28 · **Prior packet:** `2026-07-28-fixed-dose-combination-identity-implementation.md`
**Disposition requested:** re-review. `warfarin__cotrimoxazole` remains blocked, the combination
manifest remains empty, production-open remains at 0 rules.

---

## Blockers

All seven are addressed. Two are **not** implemented as specified, for reasons given below —
please check those two first.

| # | Blocker | Status |
|---|---|---|
| 1 | Release profile fail-open | **Fixed** as specified |
| 2 | Scope agreement one-way | **Fixed** — set equality (the alternative, not the preferred fix) |
| 3 | RxNorm syntactic only | **Fixed** structurally; see limit below |
| 4 | Drift silently becomes non-match | **Fixed differently** — your fix would not have worked |
| 5 | C4 inconsistency | **Fixed** as specified |
| 6 | Gate not green | **Fixed** — 0 failed |
| 7 | production-open self-declarable | **Fixed** via your Option B |

### 1 — profile now fails closed

`resolveCombinationIdentity` requires an explicit, recognised profile; omitted, `null`,
`undefined`, empty and unrecognised values all throw. Profile-blind inspection is a
separate function named `auditCombinationIdentityAcrossProfiles`, which marks its result
`audit_only: true` and reports the profiles a match was authored for. All six of your
required tests are present.

### 2 — set equality, not derivation

You preferred deriving scope from presentations; I implemented bidirectional equality
instead. Reason: C3 asked for an explicit oral-tablet **scope declaration**, and the
declaration is the clinician's stated intent — worth keeping legible in the manifest rather
than inferring it. Equality makes the two impossible to disagree, which is the property you
actually needed. Declared values must also be canonical and duplicate-free, as you asked.

### 3 — structure cross-validated; one honest limit

Now required and **cross-checked**, not merely stored:

- `component_relation` with `has_part` and `component_rxcuis`, which must **equal** the
  declared component RxCUI set;
- `rxnorm_scd` as a structured object whose `tty` must be `SCD` and whose
  `ingredients_and_strengths` RxCUIs must **equal** the declared component set;
- duplicate component RxCUIs rejected (your example manifest now throws).

**Limit, stated plainly:** the validator proves *internal structural consistency* and pins
hashes. It does not prove those hashes match live RxNorm — that requires a network
verification step, which belongs in an evidence-verification CLI like the existing
`verify-interaction-evidence-provenance`, not in a pure validator. I have not claimed
otherwise anywhere in the packet.

### 4 — your prescribed fix would not have worked

You asked me to index reviewed presentations by product id, then compare the assertion hash.
I checked `product-resolver.mjs` as you instructed, and that ordering cannot detect the drift
you were worried about:

> `productIdForRow()` hashes brand name, manufacturer, pack label, form and the ingredient
> signature. It is **content-derived**. When a reviewed product's ingredients drift, the
> product id changes **too** — so an id-keyed lookup misses the entry and the drift still
> degrades to an ordinary non-match.

The stable handle is the catalogue's own source identity: rows carry
`sources: [{source: "janaushadhi", source_id: "89", …}]`, which is outside the assertion hash.
So resolution now:

1. looks the product up by **stable source identity**;
2. if reviewed, compares assertion hash **and** product id → `stale` on either mismatch;
3. only then checks the active set — a reviewed product that no longer matches its component
   set returns `stale` with `reviewed_product_no_longer_matches_component_set`, not a miss;
4. otherwise falls back to component matching for unreviewed products.

Identity-generation failure is no longer collapsed to `null`; it returns
`invalid_product_assertion` / `ingredient_identity_generation_failed`.

**A related gap you should rule on.** `productAssertionHashForRow()` covers brand, manufacturer,
pack, form, ingredients and strengths — but **not** `sources`, so a product's PMBJP code can
change without changing the assertion hash. Binding both the source identity and the content
hash contains this for combinations, but the single-ingredient presentation mappings key on
`product_id` alone and remain exposed to the same code-vs-content split that produced the F5
false alarm. Out of scope here; flagged rather than quietly fixed.

### 5 — provenance unified and evidence-linked

You were right that the two validators disagreed. `pmbjp_tender` is now an accepted identity
source kind, in step with `PMBJP_PRODUCT_IDENTITY_PREFIXES` in the shared validator, with a
comment binding them. Provenance took your stronger shape: `identity_sources[]` with
`evidence_ref`, plus a `tender_check` with `status` / `document_id` / `evidence_ref`. Every
`evidence_ref` must resolve to a unique hashed record in `review.evidence`. Both `present` and
`not_present` now require a named document **and** evidence — "we checked RC-222/2025 and it
was not there" is a positive assertion and must be evidenced.

### 6 — gate is green

The two `cache-retention` tests now detect `pigz` and skip explicitly with a documented reason
instead of failing. You were right that "pre-existing" does not make a failed suite a passed one.

```text
759 tests / 754 passed / 5 explicitly skipped / 0 failed   (exit 0)
```

### 7 — production-open is not authorable

Your Option B, enforced at the schema level: `allowed_profiles` may contain only
`internal-evaluation`. An author cannot type `production-open` into a source manifest at all.

## Hardening

All four done: overlapping combinations and duplicate reviewed products rejected at authoring
(no runtime ambiguity path); presentation identity generalised to
`source_identity: {namespace, code}` with PMBJP as one namespace; components bounded at 8;
`compileCombinationIdentityManifest()` validates once and returns a frozen compiled form —
`resolveCombinationIdentity` refuses an uncompiled manifest rather than silently revalidating.

## D1 — recorded as you directed

> Combination subjects **supplement** component subjects. Duplicate clinical alerts are removed
> only through explicit rule-family specificity and supersession metadata. No component subject
> is globally replaced or suppressed merely because a fixed-dose combination subject resolved.

The resolver stays **unwired** until that deduplication has positive and negative regression
tests, including preservation of unrelated component interactions such as
methotrexate + trimethoprim.

## Reproduction

```text
commit         a9e18c1 → this change on main
node           v26.5.0
catalogue      dist/latest/drugs.jsonl, 255,894 rows
pmbjp list     sha256 f54a140d9dc82880dcbb7672c18942417e8c9fe904376c742b6319665cdf9a08
tender         RC-222/2025 sha256 47670d2b…f53ff
```

```bash
npm test && npm run interactions:promote:check
```

Catalogue sweep, re-run against the rewritten resolver — unchanged:

| outcome | count |
|---|---|
| resolved (`internal-evaluation`) | **2** — PMBJP 89, 90 |
| matched components, no reviewed presentation → fails closed | 147 |
| no active-set match | 255,745 |
| `stale` / `invalid_product_assertion` | 0 |
| resolved (`production-open`) | **0** |

Gates: `interactions:promote:check` verified · `verify:pmbjp-mapping-codes` 18/18 ·
`git diff --check` clean · production-open 0 rules · combinations recorded 0 · promotions 8.

## Not done

Your minimum package asks for a full diff and immutable input hashes for the RxNorm responses.
The RxNorm hashes in the fixtures are **synthetic placeholders** — no combination is recorded,
so no real RxNorm response has been pinned yet. Real hashes get captured when a combination is
actually authored, which is the step that remains blocked.
