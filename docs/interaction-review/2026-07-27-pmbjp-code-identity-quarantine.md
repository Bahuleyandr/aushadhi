# F5 — PMBJP drug-code identity: **RESOLVED — false alarm, plus a real defect found and fixed**

**Date:** 2026-07-27 · **Status:** resolved
**Machine-readable companion:** `2026-07-27-pmbjp-code-identity-quarantine.json`

---

## Outcome

**The committed catalogue drug codes are correct.** All **17/17** product-presentation mappings
verify against the official PMBJP product list. No mapping, no promotion and no clinical binding was
ever wrong. New PMBJP mappings are **no longer blocked**.

## What went wrong — in the investigation, not the data

F5 was raised because I extracted the PMBJP list with **Xpdf `pdftotext -layout`**. On this ruled
table, `-layout` renders **632 of 2111** product-name cells into a separate block, orphaning them
from their drug code. Comparing the catalogue against that damaged extraction produced an apparent
**38.7%** code agreement and an apparent 7 mappings pointing at different drugs.

Extracting the *same document* with **`-table`** gives 2111 complete rows. Against that:

| | |
|---|---|
| catalogue rows agreeing | **2045 / 2111 (96.9%)** |
| remaining 66 | trailing-whitespace only, same products |
| committed mappings confirmed | **17 / 17** |

Corroboration: the `-table` ordering is alphabetical within its section (Torsemide → Valsartan →
Verapamil → Warfarin 1mg → Warfarin 2mg → Zinc Sulphate), which the `-layout` reading breaks. The
catalogue matches `-table` exactly — including `380 = Clarithromycin 500 mg`,
`740 = Clarithromycin 250 mg`, `452 = Warfarin 5 mg`, `2141 = Warfarin 1mg`.

### Claims retracted

- ❌ *"PMBJP codes are not stable across product-list editions."* Never demonstrated — the apparent
  instability was extraction damage.
- ❌ *"The catalogue came from a different, larger, unrecoverable edition."* It matches the document
  the adapter still points at, row for row (2111 = 2111).
- ❌ *"Our 2026-07-07 extraction paired codes to names positionally and mislabelled them."* The
  07-07 extraction was correct; my later `-layout` re-extraction was the damaged one.
- ❌ The proposed corrections `1246→1252`, `521→519`, `2034→2033`, `2141→2144`. Those "true" codes
  were read off the damaged extraction. **The committed codes are right.**

## The real defect — found, and fixed

The investigation was wrong, but it surfaced something genuine:

> **The extraction mode was part of the data contract, but was neither pinned nor checked.**

The adapter asked for `-layout`, which silently loses 645 rows on this document. **A rebuild on the
currently installed Xpdf 4.00 would have produced a catalogue with wholesale-wrong drug codes, and
nothing would have complained.** That is the bug that mattered.

Fixed:

1. **`pdfToText` takes an explicit `mode`** (`layout` | `table`) and rejects anything else. The
   janaushadhi adapter now requests `table`.
2. **`assertJanAushadhiParseComplete`** compares parsed rows against the count of serial numbers in
   the document — an in-document ground truth independent of name/code pairing — and throws on a
   mismatch. On this document: `-layout` → 1466 vs 2111 (**throws**), `-table` → 2111 vs 2111 (passes).
3. **`build.mjs` asserts completeness** before accepting any janaushadhi rows, so a lossy extraction
   fails the build instead of silently corrupting the catalogue.
4. **Provenance capture** (`pmbjp.provenance.json`: origin, source_url, pdf_sha256, byte count,
   `code_space_verifiable`) so a snapshot is attributable to an exact document.
5. **`npm run verify:pmbjp-mapping-codes`** checks every mapping code against a named, hashed source
   list and exits non-zero on any unconfirmed code.

## Lesson

`pdftotext -layout` silently mis-renders ruled tables, and a parser that only reads well-formed rows
will happily return a truncated result. **Any tabular extraction needs an independent in-document row
count asserted against the parse**, or a wrong answer looks exactly like a clean one. That assertion
now exists, and it would have prevented both the original risk *and* this false alarm.

## Outstanding

Nothing blocking. Optional hardening: extend the same parsed-vs-ground-truth assertion to the other
PDF-backed adapters (`cdsco-fdc`, `nppa`), which still use `-layout` with no completeness check.
