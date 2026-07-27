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

## ⚠ Root cause — CORRECTED 2026-07-27 (an earlier version of this document was wrong)

**Retracted claim:** *"PMBJP codes are not stable across editions; the catalogue came from a larger
edition that is now unrecoverable."*

**What tracing the source actually showed:** the catalogue was built from the **same document the
adapter still points at**, unchanged. Git history shows the URL was never edited (only made
env-overridable). That document contains **exactly 2111 serial-numbered products — matching the
catalogue's 2111 janaushadhi rows exactly.** There is no missing edition.

The real cause is **our own extraction**. The PMBJP list is a Word table in which many name cells
render on a *separate line* from their serial/code cell — 1479 rows carry their name inline, **632 do
not**. The 2026-07-07 extraction paired the code stream to the name stream *positionally*, so the
pairing drifts wherever a name is orphaned.

Read straight off PDF page 62:

| code | catalogue (07-07 parse) | **actual document** |
|---|---|---|
| 2138 | Torsemide 100mg ✓ | Torsemide 100mg |
| 2139 | Valsartan 40mg ✗ | *(bare — name renders lower)* |
| 2140 | Verapamil 40mg ✗ | Valsartan 40mg |
| 2141 | **Warfarin 1mg** ✗ | *(bare)* |
| 2142 | Warfarin 2mg ✗ | Verapamil 40mg |
| 2144 | Pyridostigmine ✗ | **Warfarin 1mg** |

The real table uses every *other* code here (2138, 2140, 2142, 2144, 2146), with 2139/2141/2143/2145
carrying the names that render lower (Zinc Sulphate, Pyridostigmine, Budesonide, Combikit). Zipping
the name stream onto the code stream in order reproduces the catalogue **exactly**, right down to
Pyridostigmine landing on 2144. That is a positional-pairing artifact, not an edition difference.

**What is actually wrong is only the code *label*.** `product_id` hashes brand name, manufacturer,
pack, form and ingredients — none of which came from the code column. **All 17 mappings bind the
correct products.** What is mislabelled is the code in `mapping_id` and in the tender citation.

### Corrected codes

| status | product | mapped | true |
|---|---|---|---|
| already correct | Azithromycin 250mg · Metronidazole 400mg · Tramadol 50mg | 18 · 202 · 28 | same |
| correctable now | Fluconazole 150 mg | 1246 | **1252** |
| correctable now | Tramadol PR 100 mg | 521 | **519** |
| correctable now | Voriconazole 200mg | 2034 | **2033** |
| correctable now | Warfarin 1mg | 2141 | **2144** |
| needs geometry-aware extraction | 10 products incl. both amiodarone, warfarin 2mg/5mg, ketoconazole | — | orphaned rows |

## Superseded: the original "not a parser bug" reasoning

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

## Rebuild assessment (2026-07-27) — **do not rebuild yet**

The obvious next step is "rebuild the catalogue so codes become verifiable". I ran the pre-flight
first, and it says **don't**.

`product_id` hashes brand name, manufacturer, pack, form and ingredients — it is *independent of the
drug code*. So I could compute, read-only, exactly which mappings a rebuild would preserve:

| | |
|---|---|
| committed mappings | 17 |
| `product_id` **preserved** by a rebuild today | **7** |
| `product_id` **lost** | **10** |
| catalogue rows now | 2111 |
| rows available from the reachable source today | 1466 |
| products that would be **dropped** | **645** |

Rebuilding from the currently reachable source would therefore destroy 10 of 17 clinician-approved
product bindings and shrink the catalogue by 645 products. That is worse than the problem it solves.

**It also proved the diagnosis outright.** For the 7 that survive, the code *moves*:

| product | catalogue edition | current list |
|---|---|---|
| Warfarin Tablets IP 1mg | 2141 | **2144** |
| Fluconazole Tablets IP 150 mg | 1246 | **1252** |
| Voriconazole Tablets IP 200mg | 2034 | **2033** |
| Tramadol PR Tablets IP 100 mg | 521 | **519** |

Same product, identical content hash, different drug code — direct proof that a PMBJP code is only
meaningful against a named source document.

**Why the right source isn't available:** the adapter default (PIB attachment) serves 1466 rows
against the catalogue's 2111, so the catalogue came from a larger document. The source the mapping
evidence actually cites — the janaushadhi.gov.in product MRP list — is a React SPA whose public
endpoint (`janaushadhi.gov.in:8443/api/v1/website/getAllProductForWeb`) returned HTTP 500 for GET and
for POST with the usual pagination shapes. I stopped after five requests rather than keep hammering a
government endpoint.

**What would make a rebuild safe:** obtain a citable official list at least as complete as the
snapshot (≥ 2111 rows), record its URL and sha256 through the new provenance capture, re-run this
pre-flight to confirm all 17 `product_id`s are preserved, *then* rebuild and re-run the code verifier
against that pinned document.

**Interim position:** no rebuild. Catalogue, 17 mappings and 7 promoted rules are left exactly as they
are — internal-evaluation only, content-hash bound, fail-closed on drift, production-open empty. This
is a stable resting state, and the unverifiable citations are recorded here rather than silently
accepted.

## What remains

- Rebuild or re-fetch the PMBJP catalogue **with provenance recorded**, then re-run the verifier
  against that exact edition.
- Re-verify the tender page citations for the 13 unconfirmed mappings against the edition the
  catalogue was actually built from.
- **Record no new PMBJP product-presentation mapping** until its code can be confirmed against a
  named source document. This is why the warfarin–clarithromycin items A1/A2/A5 remain halted.

Nothing was deleted or downgraded: the 17 mappings remain committed, internal-evaluation only, and
content-hash bound. Production-open remains empty.
