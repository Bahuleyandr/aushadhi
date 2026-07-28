# Handover — aushadhi drug-interaction checker

**Written:** 2026-07-28 · **For:** the next agent picking this up
**Read this before touching anything in `data-static/` or `src/lib/interaction-*`.**

---

## 0 · Exact state

```text
repository        Bahuleyandr/aushadhi   (PRIVATE — a connector 404 is expected)
branch            main
HEAD              3c61a187f3112b38398285917ffd0e86715958c2
origin/main       3c61a187f3112b38398285917ffd0e86715958c2   (identical)
working tree      clean
node              v26.5.0
platform          Windows 11, PowerShell + Git Bash both available
```

```text
npm test                             821 tests / 816 passed / 5 skipped / 0 FAILED (exit 0)
npm run interactions:promote:check   exit 0
npm run verify:combination-rxnorm-evidence   exit 0
npm run verify:pmbjp-mapping-codes -- --list=<pmbjp-list.pdf> --sha256=f54a…   18/18 confirmed
git diff --check                     clean
```

The 5 skips are deliberate and named: 2 `cache-retention` tests skip because `pigz`
isn't installed on this machine, plus 3 pre-existing. **A red suite is now a real
signal** — do not wave failures through as "pre-existing".

| artifact | count |
|---|---|
| production-open rules (`data-static/interaction-rules.json`) | **0**, `declared_coverage: unknown` |
| internal-evaluation rules + promotions | 8 / 8 (45 exact product pairs) |
| ingredient mappings | 9 |
| product-presentation mappings | 18 (all source-bound) |
| **combination identities** | **0** (deliberately empty) |
| attested draft pack (`batch-01-v2.jsonl`) | 199 rules, **all** `runtime_enabled:false` + `promotion_eligible:false` |

---

## 1 · Standing prohibitions — these are not negotiable

These came from the owner and from two rounds of independent review. Do not relax any
of them without an explicit, recorded decision from `clinician:subas`.

1. **Do not deploy anything.** Deployment requires separate explicit approval.
2. **Do not weaken the fail-closed production-open boundary.** `interaction-rules.json`
   is deliberately empty. It is not a bug.
3. **Do not copy internal-evaluation mappings or rules into production-open.** The
   catalogue carries restricted `janaushadhi` / `onemg-live` provenance; it may be used
   for internal evaluation and candidate discovery but must never leak into a
   redistributable artifact.
4. The checker must keep failing closed on missing, stale, ambiguous or drifted
   mappings; keep hiding severity/mechanism/management for unreviewed findings; avoid
   fuzzy ingredient acceptance; never infer oral/systemic presentation from a brand
   name; distinguish therapeutic duplication from an interaction; and never imply that
   a blank result means safety.
5. Clinical workflow boundaries for every promoted rule: the prescriber or
   anticoagulation service directs warfarin review and PT/INR monitoring; never direct
   the pharmacy to change a dose or stop a medicine independently; no invented PT/INR
   schedule; no invented post-discontinuation interval; preserve evidence jurisdiction;
   never present US or UK evidence as an Indian regulatory-label claim.
6. **The draft pack cannot self-authorize.** Runtime authority exists only through the
   clinician-approved promotion manifest.

---

## 2 · Architecture in one page

**Two packs.** `data-static/interaction-rules.json` is production-open and empty.
`interaction-rules.internal-evaluation.json` + `interaction-promotions.internal-evaluation.json`
hold the 8 clinician-approved warfarin rules. Never merge them.

**Three identity layers**, all fail-closed:

```text
ingredient-mapping-overrides.json        one catalogue ingredient -> one runtime drug
                                         RxNorm tty must be IN or PIN   (9 mappings)

combination-identity-overrides.json      fixed-dose combinations, SEPARATE path
                                         RxNorm tty MIN, verified component list
                                         (0 combinations — empty on purpose)

product-presentation-overrides.json      product -> route/formulation
                                         source-bound (see D2 below)   (18 mappings)
```

**Resolution keys on content hashes, not codes.** `productIdForRow()` hashes
brand/manufacturer/pack/form/ingredient-signature. Drug codes are descriptive metadata.
`product_assertion_sha256` is revalidated at resolution and returns `stale` on drift.

**Key files**

```text
src/lib/interaction-engine.mjs               matching, resolution, suppression, supersession
src/lib/interaction-mapping.mjs              ingredient + presentation manifests, mapResolvedProducts
src/lib/interaction-combination-identity.mjs fixed-dose combination path
src/lib/combination-rxnorm-evidence.mjs      offline RxNorm evidence verifier
src/lib/product-resolver.mjs                 productIdForRow / productAssertionHashForRow
src/cli/build-interaction-runtime-pack.mjs   promotion gate (also runs the evidence gate)
src/cli/verify-combination-rxnorm-evidence.mjs
src/cli/verify-pmbjp-mapping-codes.mjs       verifies the RESOLVER BINDING, not list membership
docs/interaction-review/                     all review packets + audit fixtures
```

---

## 3 · What was built this session

Chronologically, each merged to `main` with `--no-ff` and pushed.

**Warfarin–clarithromycin** (`054bceb`) — A1/A2/A5 recorded and compiled: 9th ingredient
mapping, 18th presentation mapping, 8th promotion, 3 exact pairs.

**Warfarin–co-trimoxazole audit** (`fb57c17`) — **BLOCKED**, and still is. Evidence is
sound (openFDA `7f82e5e0-b627-a3f3-e053-2991aa0abaa5` v6, both fragments verbatim and
hash-stable; PMBJP drug codes 88/89/90 confirmed). The blocker is architectural: the
perpetrator is a **fixed-dose combination**, RxCUI 10831 `tty: MIN`, and the
single-ingredient model admits only IN/PIN.

**Fixed-dose combination path** (`a9e18c1` → hardened through `1ecfb59`, `b85d421`) —
clinician approved C1 **with an architectural condition: do not widen the IN/PIN
allowlist**. So combinations live on their own module. `exact_active_set` is a perfect
pairing (every component consumes exactly one ingredient slot, no leftovers), matched at
**product** level, so no component can independently inherit a combination's rule.

**RxNorm evidence gate** (`3443e34`) — offline verifier + mandatory CLI gate.

**D2, source-bound presentations** (`45764a2`) — all 18 mappings now bind a stable
`source_identity` alongside the content id and assertion hash.

**D1, supersession** (`b85d421`) — combination subjects **supplement** component
subjects; duplicate alerts removed at rule level only, on declared overlaps.

---

## 4 · Landmines — read this section twice

These each cost real time or produced a wrong answer that had to be retracted.

### 4.1 `pdftotext -layout` silently mis-renders ruled tables

Extracting the PMBJP product list with `-layout` orphans **632 of 2111** name cells from
their codes. I concluded the committed codes were wrong (finding "F5"), wrote a
correction, and the correction was *also* wrong. `-table` reproduces the catalogue
exactly. **Always assert an independent in-document row count against the parse** —
`assertJanAushadhiParseComplete()` does this now.

### 4.2 The PMBJP list has TWO number columns

`S. No.` then `Drug Code`. **Mappings key on the DRUG CODE.** Co-trimoxazole is serials
83/84/85 = drug codes 88/89/90. Grepping the serial column returns gentamicin and
levofloxacin. I hit this even after fixing 4.1.

### 4.3 `createIngredientIdentity` does not read `name`

It reads `observed_name` / `molecule_raw` / `molecule`. PMBJP rows have `name: null`;
reading it makes products look ingredient-less. Related: `/sulph?a/` matches "sulpha"
but **never** "sul**f**a" — use `sul[fp]h?a`.

### 4.4 A verifier written against self-authored fixtures proves only self-agreement

My RxNorm SCD verification parsed an endpoint shape I invented. Against real RxNav
responses it found nothing to compare **and reported success**. Real shapes, verified
live 2026-07-28 (release `06-Jul-2026`, api `3.1.354`):

```text
rxcui/<id>/properties               -> properties.tty / .name
rxcui/<id>/related?rela=has_part    -> relatedGroup.conceptGroup[].conceptProperties[]   (MIN -> IN/PIN)
rxcui/<id>/related?rela=has_ingredients -> SCD -> MIN
rxcui/<id>/historystatus            -> rxcuiStatusHistory.metaData.status / .isCurrent
                                       ...definitionalFeatures.ingredientAndStrength[]
                                         { baseRxcui, bossRxcui, activeIngredientRxcui,
                                           moietyRxcui, numeratorValue, numeratorUnit,
                                           denominatorValue, denominatorUnit }   ← camelCase
                                       ...definitionalFeatures.doseFormConcept[].doseFormName
```

Note the SCD's **term type comes from its own `properties`**, not history-status.

### 4.5 `Object.freeze` is shallow, and `structuredClone` preserves `Map`/`Set`

A shallow freeze still allows `compiled.combinations[0].components[0].assertion_ingredient_ids.push(...)`.
The compiled form now deep-clones + recursively freezes and exposes **no reachable
collection instance**. Also: `structuredClone` does **not** preserve a null prototype, so
null-proto objects must be created *after* cloning.

### 4.6 Unresolved findings are never superseded — that is correct

US-scoped rules with no `patientContext.jurisdiction` resolve to
`unresolved_pending_jurisdiction`, and supersession refuses to hide them. A test fixture
of mine failed because of this and I nearly "fixed" the implementation. Hiding an alert
whose applicability could not be established is the wrong failure direction.

### 4.7 `canExplicitlySuppress()` does not compare victims

The pre-existing suppression path ignores the victim drug. `canSupersede()` does compare
it, which is what keeps `methotrexate__trimethoprim` alive when a warfarin combination
rule fires in the same check. **If you touch suppression, preserve this.**

### 4.8 Manifest schemas are strict allowlists

`identity` takes exactly 6 keys; evidence records take exactly 5 (no `note`, no
`excludes`). Exclusions belong in `approval_text`. Adding a field means updating the
allowlist deliberately.

### 4.9 Shell quoting on this box

Inline `node -e` and bash heredocs mangle regexes and quotes regularly. Write a `.mjs`
or `.py` file to the scratchpad and run that. Also: `node -e` inherits whatever cwd the
shell is in — I once wrote a file to `D:\Dev\data-static` instead of the project. Never
leave loose files at `D:\Dev` root.

---

## 5 · Open items

### 5.1 Warfarin–co-trimoxazole — BLOCKED, awaiting two things

Clinician decisions C1–C4 are **recorded and implemented**. What remains:

1. **A real RxNorm evidence bundle for the combination.** The verifier and its mandatory
   gate exist; nothing is authored. A read-only integration fixture with real responses
   already lives at
   `data-static/combination-rxnorm-evidence/integration-fixture/` — that is
   `classification: verifier_integration_fixture`, `promotion_authority: none`, and is
   **not** the combination's own bundle.
2. **Independent approval** of the foundation.

Recorded clinician decisions, for context:

```text
C1  extend the model for fixed-dose combinations, but via a SEPARATE path.
    Do NOT add MIN to the IN/PIN allowlist.                        [implemented]
C2  include both PMBJP 89 (800/160) and 90 (100/20 paediatric).    [implemented]
C3  restrict scope to oral tablets; exclude PMBJP 88 suspension and IV. [implemented]
C4  a tender citation is not required when the product is absent from it;
    an authoritative PMBJP product-identity source is.             [implemented]
    Clinical mapping stays major / confirm_and_monitor.
D1  combination subjects SUPPLEMENT component subjects.            [implemented]
D2  bind source_identity on source-specific presentation mappings. [implemented]
```

**Do not author the combination without a real evidence bundle.** The promotion gate
will refuse it, by design.

### 5.2 Independent-review status

Disposition after three rounds: **conditional acceptance of the empty, unwired
foundation; full approval withheld.** The reviewer's four final items were all addressed
(provenance reconciliation, deep immutability, an unavoidable evidence gate, RxNorm
status + per-entry ingredient field). The response packets are:

```text
docs/interaction-review/2026-07-28-combination-identity-attestation.md   ← canonical
docs/interaction-review/2026-07-28-combination-identity-review-response{,-2}.md
docs/interaction-review/2026-07-27-warfarin-cotrimoxazole-candidate-audit.{json,md}
docs/interaction-review/2026-07-28-fixed-dose-combination-identity-implementation.md
```

The attestation packet supersedes the two response packets where they disagree.

### 5.3 Known gaps I flagged rather than fixed

- The new `verify:pmbjp-mapping-codes` statuses (`bound_product_id_changed`,
  `source_identity_claimed_by_several_rows`, …) are exercised through library tests, not
  the CLI, because the CLI reads the manifest from a fixed path.
- No CI lane installs `pigz`, so those 2 tests always skip here.
- The openFDA and PMBJP evidence paths were **not** re-audited for the 4.4 failure mode
  (verifier written against self-authored fixtures). They have real captured sources so
  they are better placed, but it is worth a look.

### 5.4 Unrelated, still open

Task list carries **"Aushadhi: validate formulation layer on real data + deploy to DD"**
as in-progress from before this thread. Untouched here, and the only item involving a
deployment.

---

## 6 · Working agreements

- **Verify every inherited claim against the repository before acting on it.** The
  handover I received contained a "0 failed" claim that was false in this environment,
  and my own audit contained two errors I only found by re-checking against the
  catalogue.
- Establish ground truth **before** migrating data. Binding a code without checking it
  first would have cemented a wrong one — see 4.1/4.2.
- TDD throughout: write the failing test, watch it fail *for the right reason*, then
  implement. Several bugs here were found because a test failed unexpectedly.
- Default git flow: branch → commit → merge `--no-ff` into `main` → push → delete branch.
  There is **no CI** (`.github/workflows` does not exist), so pushing `main` is safe and
  triggers no deploy.
- State limits plainly. Where something proves less than it appears to, say so in the
  packet rather than letting the reader infer more.
