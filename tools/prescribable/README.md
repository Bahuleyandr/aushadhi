# Prescribable model + plausibility strength resolution

Reference implementation (Python prototype) for the two-tier **prescribable** model
and the **molecule-plausibility** strength resolution described in
[`docs/plausibility-reconcile-plan.md`](../../docs/plausibility-reconcile-plan.md).

This is the spec/reference the DD `merge.mjs` port is derived from. It runs on the
exported `drugs.jsonl` and produces the doctor-facing prescribable layer.

## What it does

1. **Cross-source merge** into prescribable medicines: identity = `brand-core + dosage
   form + molecule/strength set`; **pack size is collapsed** (10s/15s/bottle is a
   dispensing detail), preserved as nested `pack_variants` for the pharmacist layer.
2. **Plausibility resolution** (replaces source-trust): learns each molecule's
   real-world strength distribution from the whole dataset, then
   - resolves molecule-swap conflicts by which assignment is pharmacologically
     plausible (correctly fixes cases where a *trusted* source had the swap),
   - keeps legitimate multi-strength variants separate,
   - flags the small tail it cannot decide.
3. **Verification + option-B suppression** (clinical safety): a strength is
   `verified` iff ≥2 sources agree, OR single-molecule & plausible, OR (single-source
   combo) the assignment is plausibility-**unambiguous**. Otherwise the strength is
   **suppressed** (molecules kept, values nulled) and marked `unverified`.

## Output schema (`prescribable.jsonl`, one record per medicine)

| field | meaning |
|---|---|
| `med_id` | stable 12-char id (brand-core + form + composition) |
| `display_name`, `form`, `molecules[]`, `composition_display` | doctor-facing |
| `strength_verified` (bool) | **the gate** — auto-fill strength only when true |
| `strength_status` | `verified` / `resolved_by_plausibility` / `unverified` / `no_strength` |
| `strength_conflict` (bool) | on the review shortlist (sources disagree, plausibility can't decide) |
| `strength_note` | human-readable reason when action is needed |
| `pack_variants[]` | pharmacist/dispensing layer (pack_label, price, source, source_id) |
| `sources`, `source_count`, `atc_codes`, `manufacturer`, price range, dates | provenance |

## Run

```
python tools/prescribable/build_prescribable.py
```

Input/output paths are the constants at the top of the script (default: the
`data-drops/2026-07-20/` snapshot). Emits `prescribable.jsonl`, the Excel
compendium, `strength-conflicts-*.csv`, and `strength-review-shortlist-*.csv`.

Requires only `xlsxwriter` (`pip install xlsxwriter`); parsing is stdlib.

## Known limitation

The plausibility distribution is learned from data that still contains the errors,
so a systematically-wrong strength (e.g. pharmeasy's `levocetirizine 10mg`) gets a
small non-zero plausibility, which makes some *correct* single-source combos look
ambiguous and be suppressed (safe, but over-conservative). A bootstrap
de-contamination pass (learn → drop outliers → relearn) would recover some. See the
plan doc.
