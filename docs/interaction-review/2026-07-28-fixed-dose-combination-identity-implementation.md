# Fixed-dose combination identity — implementation record

**Date:** 2026-07-28 · **Status:** implemented, **awaiting independent approval**
**Authorised by:** `clinician:subas` decisions C1–C4, 2026-07-27
**Companion:** `2026-07-27-warfarin-cotrimoxazole-candidate-audit.{json,md}`

> **Nothing is promoted.** The combination manifest is empty, production-open is still
> 0 rules, and `warfarin__cotrimoxazole` remains blocked. This packet records what was
> built so it can be reviewed.

---

## What C1's architectural condition required, and what was built

The condition was explicit: **do not** widen `RXNORM_INGREDIENT_TYPES` to admit `MIN`.
Combinations get their own path; the single-ingredient model stays as it is.

| | |
|---|---|
| New module | [`src/lib/interaction-combination-identity.mjs`](../../src/lib/interaction-combination-identity.mjs) |
| New manifest | [`data-static/combination-identity-overrides.json`](../../data-static/combination-identity-overrides.json) — **0 combinations** |
| Single-ingredient model | **unchanged** — still `IN`/`PIN` only, and a test asserts it still refuses `MIN` |

`MIN` is admissible only on `identity_kind: fixed_dose_combination`, and only alongside
a verified component list of `IN`/`PIN` ingredients. Every other `identity_kind` is
rejected.

## The matching semantics you asked for

`component_match: "exact_active_set"` is implemented as a **perfect pairing**, not a
containment test: every declared component must consume exactly one ingredient slot and
no slot may be left over. This is what makes each of your requirements hold:

| Requirement | How it holds |
|---|---|
| Both components must be present | a component with no slot fails the pairing |
| Neither component independently inherits the rule | the combination is matched at **product** level; no component is mapped as a runtime drug |
| Exact active set, not "contains sulfamethoxazole" | a leftover slot fails the pairing |
| Strength/presentation via SCD | each reviewed presentation carries its `rxnorm_scd` |
| Oral tablets only | declared scope and reviewed presentation list must **agree**, checked at authoring |

On the route model you flagged: `systemic` is no longer stored as if it were a route.
The schema separates `exposure_scope: "systemic"` from `routes: ["oral"]` and
`dose_forms: ["tablet"]`, as you specified.

## Verification — fixtures, then the whole catalogue

25 tests in [`test/interaction-combination-identity.test.mjs`](../../test/interaction-combination-identity.test.mjs).
The product fixtures are the **real** catalogue rows: a test asserts they hash to the
genuine product ids `f3835b62…` (89) and `1b8857c5…` (90).

Your required regression set, all passing:

```text
Positive:  PMBJP 89 · PMBJP 90
Negative:  trimethoprim-only (Bacstol Tablet) · sulfamethoxazole+pyrimethamine
           (Malin 25/500) · sulfamethopyrazine+trimethoprim (Stanrox DS)
           · pair + extra active ingredient · PMBJP 88 suspension
           · intravenous presentation · drifted product assertion · production-open profile
```

Fixtures alone prove the logic; they don't prove nothing else in India's market
resolves. So the resolver was swept over **all 255,894 catalogue products** with the
combination loaded:

| outcome | count |
|---|---|
| resolved to a `co-trimoxazole` oral-tablet subject | **2** — PMBJP 89 and 90, and nothing else |
| matched the component set but **no reviewed presentation** → fails closed | 147 |
| did not match the active set at all | 255,745 |
| stale / errors | 0 |
| **resolved under `production-open`** | **0** |

Those 147 are the mainstream `sulfamethoxazole + trimethoprim` products. They match the
*chemistry* but are refused for want of a reviewed presentation — the fail-closed
boundary doing exactly its job.

## C4 applied globally, not as an exception

Enforced in the shared presentation-mapping validator
([`src/lib/interaction-mapping.mjs`](../../src/lib/interaction-mapping.mjs)): a mapping
declaring PMBJP provenance must cite an authoritative PMBJP product-identity source.
A tender **qualifies** but is no longer **required**.

**One finding you should see.** Requiring the official *product list* specifically —
the narrowest reading of C4 — would have **invalidated 12 of the 18 approved presentation
mappings**, because they cite a tender as their only PMBJP source. The policy therefore
accepts product list, live product, or tender as identity sources, and simply stops
*requiring* a tender. A test pins that count of 12 so the consequence stays visible.

Scope note: the requirement applies to mappings in the `presentation:pmbjp:` namespace.
Non-PMBJP presentation mappings are a different provenance question and were left alone —
an earlier, wider version of this check imposed a PMBJP requirement on unrelated products
and was corrected.

## Two corrections to the 07-27 audit

Both were found by checking the audit's claims against the catalogue rather than trusting them.

1. **B2 stands, but its stated basis was incomplete.** The six single-ingredient
   trimethoprim products are real — *Bacstol Tablet*, *Bacstol 200*, *Keno 200mg*,
   *Metstol 100mg*, *Tmp 300mg*, *Tabrol Syrup*. The audit did not mention two further
   families that a naive "contains trimethoprim" rule would also capture:
   **`trimethoprim combinations`** (an unresolvable normalization bucket) and
   **`sulfamethopyrazine + trimethoprim`** — a *different* sulfonamide. The last is the
   sharpest negative in the suite.
2. **B4 was more consequential than recorded.** The audit noted the identity artifact
   `co-trimoxazole sulphamethoxazole`. What it missed: the PMBJP products decompose into
   **two** named ingredient rows, and their sulfamethoxazole component sits under that
   artifact identity — *not* under the `sulfamethoxazole` identity the other 158 products
   use. A combination component therefore has to declare **every** catalogue identity it
   accepts, explicitly and reviewably. It does; fuzzy name matching is never used.

## Still blocked — what remains

Per your disposition, no mapping, compiled rule or production-open content was created.
Two things remain before `warfarin__cotrimoxazole` could be promoted:

- **Independent approval of this implementation** (schema, validator, tests, provenance).
- **D1 — an open design decision, deliberately not taken here.** The resolver is *not*
  yet wired into `mapResolvedProducts`. Wiring it raises a question with clinical
  consequences: when a combination product resolves, does the combination subject
  **replace** the component subjects or **supplement** them? Today neither component is
  mapped, so the question is dormant. But if `trimethoprim` were ever mapped in its own
  right — which is legitimate, it has its own interactions — a combination product would
  emit both a `trimethoprim` and a `co-trimoxazole` subject and could double-alert. That
  is the same duplicate-alert failure the clarithromycin class row produced, so it is
  yours to decide, not mine to assume.

**Gates:** 748 tests / 743 pass / 3 skipped / 2 failing — both pre-existing
`cache-retention` failures needing `pigz`, absent on this machine.
`interactions:promote:check` verified · `verify:pmbjp-mapping-codes` 18/18 confirmed ·
`git diff --check` clean · production-open 0 rules · combinations recorded 0.
