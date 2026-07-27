# Warfarin–co-trimoxazole — read-only candidate audit

**Date:** 2026-07-27 · **Status:** **BLOCKED** — pending `clinician:subas`
**Machine-readable companion:** `2026-07-27-warfarin-cotrimoxazole-candidate-audit.json`

> **Nothing here authorizes anything.** No mapping, no promotion, no change to the attested draft.
> Production-open remains empty.

---

## Bottom line

**The evidence is sound and the products are verified — but this rule cannot be promoted, and the
reason is architectural, not clinical.**

`warfarin__cotrimoxazole` is the first rule in this series whose perpetrator is a **fixed-dose
combination**. The promotion model maps *one* catalogue ingredient identity to *one* runtime drug with
`relationship: exact`, and the manifest validator requires the RxNorm term type to be `IN` or `PIN`.
A combination cannot be expressed that way.

| | |
|---|---|
| Clinical evidence | ✅ live, current, verbatim-verified |
| Product identification | ✅ PMBJP 89 and 90 confirmed against the official list |
| Promotable today | ❌ **no** — blocked on the mapping model |

## B1 — the blocker

- The draft rule's runtime drug is **`co-trimoxazole`**. An exact RxNorm search returns **zero**
  concepts for that name.
- The correct combination concept is **`sulfamethoxazole / trimethoprim`, RxCUI 10831, `tty: MIN`**.
- `validateIngredientMappingManifest` rejects any `tty` outside `{IN, PIN}`
  (`src/lib/interaction-mapping.mjs`, `RXNORM_INGREDIENT_TYPES`). All nine committed mappings are `IN`.

So this isn't merely unconventional — **the schema structurally refuses it.**

## B2 / B3 — both obvious workarounds are wrong

**Mapping via `trimethoprim`** (RxCUI 10829, `IN`) is wrong twice:

1. Six **single-ingredient trimethoprim** products exist in the catalogue — *Bacstol Tablet*,
   *Bacstol 200 Tablet*, *Keno 200mg Tablet*, *Metstol 100mg Tablet*, *Tmp 300mg Tablet*,
   *Tabrol Syrup*. Every one would inherit a warfarin interaction it was never reviewed for.
2. The label attributes the mechanism to the **other** component. Its verbatim words:

   > "Sulfamethoxazole is an inhibitor of CYP2C9."

**Mapping via `sulfamethoxazole`** (RxCUI 10180, `IN`) is mechanistically apt but denotes an
ingredient, not the combination — and it appears in **158** combination products.

**B4:** the catalogue's own identity for these three products is `co-trimoxazole sulphamethoxazole`,
a normalization artifact of the brand string. It could not honestly be recorded as `exact`.

## Evidence — verified, and it holds up

openFDA `7f82e5e0-b627-a3f3-e053-2991aa0abaa5`, HTTP 200:

| Check | Result |
|---|---|
| Version | live `6` = recorded `6` ✔ |
| Effective time | `20260209` = `20260209` ✔ |
| Both fragments verbatim + hash-stable | ✔ |

*Version-field note, reported honestly:* this record has no `openfda.spl_version`; the version is the
top-level `version` key. My first pass read the wrong path and briefly showed a mismatch — the values
agree.

The label supplies mechanism, effect and action, which is exactly what the draft's
**major / confirm_and_monitor** mapping rests on:

> "It has been reported that sulfamethoxazole and trimethoprim may prolong the prothrombin time in
> patients who are receiving the anticoagulant warfarin (a CYP2C9 substrate)… the coagulation time
> should be reassessed."

**PMBJP products** (official list, table-mode extraction, completeness asserted 2111/2111):

| S. No. | drug code | product | verdict |
|---|---|---|---|
| 83 | 88 | Co-trimoxazole … Oral Suspension IP, 50 ml | ❌ not a tablet |
| 84 | **89** | Co-trimoxazole (Sulphamethoxazole 800 mg + Trimethoprim 160 mg) Tablets IP, 10's | ✅ candidate |
| 85 | **90** | Co-trimoxazole (Sulphamethoxazole 100 mg + Trimethoprim 20 mg) Tablets IP, 10's | ✅ candidate (paediatric) |

> **Read the right column.** The list has two number columns — `S. No.` then `Drug Code`. Every code
> here and in every committed mapping is the **drug code**. Serials 88/89/90 are gentamicin and
> levofloxacin; reading that column instead is the same class of confusion that produced the
> retracted F5 claim.

RxNorm SCDs exist for both: **198335** (800/160) and **142118** (100/20).

**B5:** co-trimoxazole does **not** appear in tender RC-222/2025, so the `pmbjp-tender` citation
pattern used by every existing presentation mapping can't be reproduced from that document. The
official product list does confirm the codes, so this is a citation-completeness gap rather than an
identification failure.

## Also worth flagging

The draft selector's perpetrator route is `["systemic", "oral"]` — **`systemic` would encompass
intravenous co-trimoxazole.** Every promoted rule in this series is narrowed to oral tablets, and any
promotion here must be too.

## Decisions required from `clinician:subas`

- **C1.** Should the promotion model be extended to admit fixed-dose combinations — e.g. an ingredient
  identity with `tty: MIN` carrying an explicit component list (sulfamethoxazole 10180 + trimethoprim
  10829) — or do combination rules stay out of scope for internal evaluation? *This is the decision
  that unblocks or closes this rule.*
- **C2.** If combinations are admitted: does the **paediatric** 100/20 tablet (PMBJP 90) belong in an
  adult warfarin-interaction scope alongside the adult 800/160 tablet (PMBJP 89)?
- **C3.** Confirm any promotion is narrowed to **oral tablets**, excluding the 50 ml suspension
  (PMBJP 88) and intravenous presentations, despite the draft selector's broader `systemic` route.
- **C4.** Is a `pmbjp-tender` citation required here, given co-trimoxazole is absent from RC-222/2025
  and the official product list is the only PMBJP source confirming the codes?

**Not authorized by this packet:** any mapping, any promotion or compiled rule, any change to the
attested draft, any change to the ingredient-mapping schema, any production-open content.
