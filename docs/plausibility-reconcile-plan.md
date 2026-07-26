# Plan: plausibility strength resolution in the DD reconcile pipeline

**Goal.** Replace the source-trust strength selection in the nightly merge with
**molecule-plausibility resolution**, so every consumer of `drugs.jsonl` gets
corrected strengths; add per-record strength verification; and emit a doctor-facing
**prescribable** layer for VH Health with option-B suppression of unverifiable
strengths.

Reference implementation: [`tools/prescribable/build_prescribable.py`](../tools/prescribable/build_prescribable.py).

---

## 1. Current pipeline (as found on DD, 2026-07-21)

```
aushadhi-build.timer (03:30 IST)
  └─ /opt/aushadhi/scripts/nightly-build.sh
       ├─ npm run build   → node --max-old-space-size=4096 src/cli/build.mjs
       │                     reads per-source raw normalized.jsonl
       │                     → src/lib/merge.mjs  → dist/<date>/drugs.jsonl
       └─ npm run report  → src/cli/report.mjs   → dist/<date>/REPORT.md
  (later) aushadhi_nonroot_v2_export_snapshot.sh  → /var/lib/aushadhi-export/<date>/
```

**Where strength is chosen today** — `src/lib/merge.mjs`:
- `identityKey` groups rows by a **strength-inclusive** key (`moleculeSetKey` embeds
  `molecule:strengthValue+unit`). Same brand+different strength ⇒ *different* groups.
- Cross-source disagreement is detected via `conflictEntityKey` (strength-agnostic)
  and marked `confidence = 'conflict'`, but the rows stay separate.
- `mergeCompiledGroup` / `mergeRawGroup` pick the output row's composition from the
  **highest-ranked source**: `out.ingredients = best.ingredients`, where `best` is the
  first after sorting by `sourceRankForOutput` (a fixed `SOURCE_PRECEDENCE`). **This is
  the source-trust selection to replace.**
- `finishProvenance` sets `source_count` and `confidence`.

**Verified facts feeding this plan** (see `project_aushadhi_secondary_hotfix` memory):
- The pharmeasy multi-molecule swap is a **source-data** error (pharmeasy.in serves
  it), NOT a parser bug — so it must be fixed at reconcile, not in the adapter.
- Source-trust is wrong ~half the time on swaps (e.g. `Alviroz Asp`, `Angirex` had a
  *trusted* source swapped). Plausibility resolves these correctly.
- Local prototype numbers to reproduce on DD: 477,783 rows → **313,510** prescribable
  medicines; **90.5% verified**, **6.3% suppressed** (option B), 25 swaps repaired,
  **218** review-shortlist records.

---

## 2. Design decision — where to resolve vs. where to suppress

Keep the two concerns at different layers so we never destroy data for non-clinical
consumers:

| Layer | Action |
|---|---|
| **`drugs.jsonl`** (general dataset, all consumers) | plausibility **resolution** (fix swaps + one-sided errors) + add `strength_status` / `strength_verified` / `strength_conflict` flags. **Do NOT suppress** — keep the best-estimate strength plus the flag. |
| **`prescribable.jsonl`** (VH Health clinical ingestion) | pack-collapse + **option-B suppression** of `unverified` strengths. |

This makes the `merge.mjs` change non-destructive (fix + flag) and confines the
aggressive suppression to the clinical layer.

---

## 3. Work breakdown

### Phase 0 — Sync & scaffold
- The Windows clone `D:\Dev\Projects\aushadhi` is **stale** (`merge.mjs` ≠ DD). Develop
  on the DD dev tree `/home/bahuleyan/aushadhi-completeness-fix` (matches `/opt/aushadhi`)
  **or** re-sync the clone from DD first. Do not assume the clone is current.
- New module: `src/lib/plausibility.mjs`.

### Phase 1 — `src/lib/plausibility.mjs` (learn distributions)  ·  TDD
- One pass over the pre-merge row set (in `build.mjs`) building
  `molecule → Map<(value,unit), count>` + per-molecule totals.
- Exports (mirror the Python reference exactly):
  - `isPlausible(molecule, value, unit)` — `count ≥ 3 && share ≥ 0.005`.
  - `plausScore(ingredients)` — Σ share, for choosing among candidate assignments.
  - `assignmentUnambiguous(ingredients)` — true iff every non-identity permutation of
    the strengths across the molecules is implausible (≤3 molecules; else false).
- `test/plausibility.test.mjs`: montelukast/levocetirizine distribution fixture; swap
  resolution picks `levo 5 + mont 10`; ambiguity detection; single-molecule case.

### Phase 2 — annotate `drugs.jsonl` with strength verification  ·  TDD  ·  DONE 2026-07-21

> **Design correction (from reading the full `merge.mjs`):** DD groups by
> `entityKey`/`conflictGroupKey` built on `normBrandName` (not brand-core), so the
> cross-source swap siblings (pharmeasy `"Almont Lc Strip Of 10 Tablets"` vs github
> `"Almont LC 5mg/10mg Tablet"`) are **never grouped** at the merge layer — the swap
> *resolution* structurally cannot happen here and correctly lives in the brand-core
> **prescribable layer** (Phase 3). `out.ingredients = best.ingredients` only picks
> among *identical* compositions, so it is not the swap resolver.
> **Phase 2 therefore delivers the high-value, low-risk part: ANNOTATION** — every
> merged row gets `strength_status` / `strength_verified` / `strength_conflict` from
> the (verified) plausibility model; strengths are neither altered nor suppressed.
> Implemented as `annotateStrengthVerification` in `merge.mjs` + an optional
> `mergeRows(all, { model })` param (backward-compatible), model built in `build.mjs`
> from the re-normalized `all` rows. Tests: `strength-verification.test.mjs` 6/6,
> `merge.test.mjs` 29/29 unchanged, full suite 254/254. Real-data check on the
> 477,783-row `drugs.jsonl`: 89.7% verified / 7.7% unverified / 2.6% no-strength,
> model build 315 ms, unverified spread source-agnostically. NOT yet run end-to-end
> through `npm run build` (raw crawl data is root-owned) — that happens at deploy.

Original (superseded) sketch:
- In `build.mjs`, build the distribution once from all rows; pass into merge.
- Add a post-merge `resolveStrengthConflicts(rows, dist)` stage that, per
  `conflictEntityKey` sibling group (brand + molecule-**name** set + pack, strength-
  agnostic):
  - **swap** (same value multiset, reassigned) → rewrite to the `plausScore`-max
    assignment; `strength_status='resolved_by_plausibility'`.
  - **one plausible / others implausible** → keep the plausible; drop/flag the rest.
  - **all plausible** (legit variants, e.g. 250 vs 500) → keep separate; `verified`.
  - **none plausible** → leave as-is; `strength_conflict=true` (review shortlist).
- Replace `out.ingredients = best.ingredients` reliance on source rank for the
  composition with the resolved ingredients.
- Emit new fields on every output row: `strength_status`, `strength_verified`,
  `strength_conflict`, `strength_note`. **No suppression here.**
- Extend `test/merge.test.mjs`: swap repair, legit-variant preservation, review flag,
  provenance unchanged.

### Phase 3 — prescribable dist artifact (VH Health)  ·  TDD
- Port `tools/prescribable/build_prescribable.py` to `src/cli/prescribable.mjs`
  (pack-collapse `drugs.jsonl` → medicine-level records; option-B suppression of
  `unverified`; nested `pack_variants`).
- `nightly-build.sh`: add `npm run prescribable` after `npm run build`.
- Emit `dist/<date>/prescribable.jsonl` and `dist/<date>/strength-review-shortlist.csv`.
- Add both to `aushadhi_nonroot_v2_export_snapshot.sh` staging + `stage-manifest.json`.

### Phase 4 — validate & deploy
- On DD dev tree: `npm test` green, then `npm run build` against current raw; **diff**
  the new `drugs.jsonl` vs current — record count stable, `confidence` distribution
  sane, and the new `strength_status` split ≈ **90.5% verified / 6.3% would-suppress**
  (matches the local prototype). Investigate any large drift before shipping.
- `merge.mjs` / `plausibility.mjs` / `build.mjs` / `prescribable.mjs` are **NOT** in
  `HOTFIX_RELS`, so this is a normal deploy (like the apollo change): `root-cp` from
  the dev tree to `/opt/aushadhi`, effective the next nightly build. Do one **manual**
  `npm run build` on `/opt/aushadhi` first and re-check the diff before relying on the
  timer. No secondary-parser-hotfix / sudo-bootstrap flow needed.
- Update `REPORT.md` to surface: verified %, suppressed %, review-shortlist count.

---

## 4. Risks & decisions

- **Plausibility self-contamination.** Distributions include the errors themselves,
  inflating wrong values (`levo 10mg`) enough to look plausible, which over-suppresses
  some correct combos. *Mitigation (optional Phase 5):* bootstrap — learn, drop
  per-molecule outliers below a floor, relearn. Safe to ship without it (errs toward
  suppression).
- **Suppression scope.** Confirmed: suppress only in the prescribable layer, not
  `drugs.jsonl`.
- **Review shortlist (~218).** `strength_conflict=true` records are the human-review
  tail. Near-term: clinician spot-check. Production: cross-check against an
  authoritative reference (CIMS / NPPA / national formulary) rather than eyeballing.
- **Coverage note.** `unverified` shrinks automatically as netmeds/apollo/1mg deepen
  and give single-source combos a second witness.

---

## 5. Definition of done
- [x] **Phase 1** `plausibility.mjs` + tests green (21/21) — adversarially verified, 2 bugs fixed
- [x] **Phase 2** `merge.mjs` annotates every row (`strength_status/verified/conflict`); tests green (254/254); real-data distribution sane. *Swap resolution moved to Phase 3 (prescribable layer) — see design correction above.*
- [x] **Phase 3** `src/cli/prescribable.mjs` — faithful JS port of the prototype (reuses `plausibility.mjs`; Excel omitted). brand-core cross-source merge + plausibility swap resolution + pack-collapse + option-B suppression + review shortlist → `dist/<date>/prescribable.jsonl` + `strength-review-shortlist.csv` + `strength-conflicts.csv`. Wired: `npm run prescribable` in `package.json` + `nightly-build.sh` (build → prescribable → report). Tests `prescribable.test.mjs` 8/8; full suite **262/262**. **Validated EXACT-MATCH vs the Python prototype on real 477,783-row data: 313,510 medicines · verified 283,873 · unverified 19,617 (suppressed) · no_strength 9,995 · resolved 25 · review 218 — delta 0 on every metric**; swap spot-checks correct (Alviroz Asp → aspirin 75/rosuvastatin 10). Port bug found+fixed during validation: pass-2 must NOT skip empty-molecule records (they survive as no_strength).
- [ ] **Phase 4 (deploy)** add `prescribable.jsonl` + `strength-review-shortlist.csv` to `aushadhi_nonroot_v2_export_snapshot.sh` staging + `stage-manifest.json`; root-cp all changed files to `/opt/aushadhi`; one manual `npm run build && npm run prescribable` verified end-to-end (raw data is root-owned — first real run); REPORT.md surfaces `meta.strength_verified_rows` etc.
