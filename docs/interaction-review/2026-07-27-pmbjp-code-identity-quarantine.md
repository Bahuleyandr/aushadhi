# F5 — PMBJP drug-code identity: finding, root cause, and remediation

**Date:** 2026-07-27 · **Status:** open (blocks new PMBJP product mappings)
**Machine-readable companion:** `2026-07-27-pmbjp-code-identity-quarantine.json`

---

## The finding

A committed product-presentation mapping is named `presentation:pmbjp:<code>:oral-tablet`, and its
review evidence cites `pmbjp-tender:RC-<n>/<year>:<code>:page-<n>`. Those codes cannot currently be
confirmed against any named source document.

Checked against the official PMBJP product list retrieved 2026-07-27, of **17** committed mappings:

| result | count |
|---|---|
| confirmed | **4** |
| code denotes a **different product** | **7** |
| code absent from the source list | **6** |

Examples: code `430` is mapped to *Amiodarone 200 mg* but denotes *Nebivolol 5 mg*; code `2142` is
mapped to *Warfarin 2 mg* but denotes *Verapamil 40 mg*; code `2772` is mapped to *Fluconazole 200 mg*
but denotes *Vincristine Injection*.

## Severity — stated precisely

**Runtime risk: LOW. Evidence-chain risk: HIGH.**

Mapping resolution keys on `product_id` — a content hash of the catalogue product row — and
revalidates `product_assertion_sha256`, returning `stale` on drift. The PMBJP code is *descriptive
metadata*, **not** the resolution key. A wrong code therefore **cannot** mis-resolve onto a different
drug at runtime; the content binding holds and fails closed.

What is compromised is the **evidence chain**: a clinician approved each mapping against a tender
citation identified by that code, and the code may point at the wrong tender row.

## Root cause — it is *not* a parser bug

I first suspected the janaushadhi adapter mis-assigned codes. It does not. Re-running the committed
parser over the current official list yields `739 = Clarithromycin Tablets IP 250 mg` and
`740 = Cefpodoxime Proxetil Dispersible Tablets 50 mg`, exactly matching the document; it binds names
to the drug-code column, not the serial. A regression test now pins that behaviour.

The actual cause is that **PMBJP drug codes are not stable across product-list editions**, and the
catalogue snapshot records **no source-document identity**. Matching 874 products by name across the
catalogue snapshot and the current official list, only 286 carry the same code (**32.7%**), with small
offsets in *both* directions — the signature of different editions, not a parsing fault.

A compounding factor: the mapping evidence cites codes from `janaushadhi.gov.in` and `pmbi.co.in`,
while the `product_id` those mappings bind was derived from a catalogue built off
`static.pib.gov.in`. Those are different documents with different code assignments.

**The 2026-07-07 snapshot's edition is unrecoverable** — `data/raw/janaushadhi` is empty and
`dist/latest` records no PMBJP source URL or hash.

## What was fixed

1. **Provenance capture (root fix).** `fetchJanAushadhi` now writes `pmbjp.provenance.json` recording
   `origin`, `source_url`, `pdf_sha256`, `pdf_byte_count` and an explicit `code_space_verifiable`
   flag. A future snapshot is attributable to an exact document.
2. **Honest handling of the unverifiable case.** A text-only cache with no recoverable PDF is recorded
   as `code_space_verifiable: false` rather than silently assumed correct — precisely the state the
   current snapshot is in.
3. **A fail-closed verifier.** `npm run verify:pmbjp-mapping-codes -- --list=<official-list>` checks
   every committed mapping code against a named, hashed source list and **exits non-zero** when any
   code cannot be confirmed. Optional `--sha256=` pins the source document.

## What remains

- Rebuild or re-fetch the PMBJP catalogue **with provenance recorded**, then re-run the verifier
  against that exact edition.
- Re-verify the tender page citations for the 13 unconfirmed mappings against the edition the
  catalogue was actually built from.
- **Record no new PMBJP product-presentation mapping** until its code can be confirmed against a
  named source document. This is why the warfarin–clarithromycin items A1/A2/A5 remain halted.

Nothing was deleted or downgraded: the 17 mappings remain committed, internal-evaluation only, and
content-hash bound. Production-open remains empty.
