# Aushadhi data-source licensing report

**Date:** 2026-08-06
**Repo:** `bahuleyandr/aushadhi` (code) + `bahuleyandr/aushadhi-data` (dataset releases)
**Scope:** Every external data source ingested by the Aushadhi drug-product pipeline and
its interaction-evidence layer — what ships in the public dataset release, the reuse
terms found for each source, and whether crawling/ingesting and public redistribution
are permitted.

---

## ⚠️ Disclaimer — read first

**This report is research compiled by an AI assistant. It is NOT legal advice.** Licence
and reuse terms are jurisdiction- and fact-sensitive; a licence that is fine for one use
(internal analysis) can be a breach for another (public redistribution), and terms
change over time. Before acting on anything here, have it reviewed by a qualified lawyer
for Indian (and, where relevant, US/UK/EU) law.

**Provenance markers on quotes.** The research environment could not fetch most live
pages (an egress-policy block returned HTTP 403 for almost every non-GitHub host,
including all four e-pharmacy domains, `cdsco.gov.in`, `nppa.gov.in`,
`janaushadhi.gov.in`, `data.gov.in`, `kaggle.com`, `nlm.nih.gov`, `open.fda.gov`, and
`web.archive.org`). Quotes are therefore marked:

- **[SEARCH-INDEX]** — operative sentences returned by a web-search index quoting the
  live page. Near-verbatim, but the page itself could not be loaded to reconfirm.
- **[MIRROR]** — full text read from a GitHub-hosted mirror of the document.

**Every quote marked [SEARCH-INDEX] or [MIRROR] must be re-verified against the live page
in a browser before you rely on it.** The re-verification checklist is in the Appendix.

---

## 1. Executive summary

**Headline finding: the public dataset release already redistributes data that the repo's
own annotations mark non-redistributable, plus data from sources that carry no licence
record at all.** The annotation system is sound; the release gate does not enforce it.

The `aushadhi-data` release dated **2026-08-02** (`releases/2026-08-02/drugs.jsonl.zst`,
676,330 records) contains rows sourced from:

| Source in the release | Rows | Repo's own annotation | Problem |
|---|---:|---|---|
| `onemg-live` (Tata 1mg) | 149,284 | `PROPRIETARY`, `redistributable: false`, `internal-restricted` | Redistributed despite being marked non-redistributable |
| `pharmeasy` | 141,142 | **none** | No licence record anywhere in the repo |
| `netmeds` | 120,812 | **none** | No licence record anywhere in the repo |
| `apollo` | 14,931 | **none** | No licence record anywhere in the repo |
| `janaushadhi` (PMBJP) | 2,111 | `NOT-CLEARED-FOR-REDISTRIBUTION`, `redistributable: false` | Redistributed despite "not cleared" annotation |
| `nppa` (ceiling prices) | 732 | **none** | No licence record; legally clearable (gazette) but unannotated |
| `github-jr` | 253,973 | `MIT`, `redistributable: true` | Primary bulk source; MIT label does **not** clear the underlying scraped rights (see §6) |

So the release commingles **open** data (`github-jr`) with **restricted/proprietary**
data (`onemg-live`), **explicitly not-cleared** government data (`janaushadhi`), and
**four completely unannotated** sources (`pharmeasy`, `netmeds`, `apollo`, `nppa`). The
`aushadhi-data` release manifests carry no licence field and no redistribution statement.

The machine-readable annotation layer in `data-static/interaction-sources.json` is
detailed and mostly correct — it already marks `onemg-live` and `janaushadhi` as
restricted/non-redistributable. **The gap is enforcement:** nothing mechanically excludes
`redistributable: false` or unannotated sources from a public release, and three of the
biggest shipped sources (`pharmeasy`, `netmeds`, `apollo`) had no annotation to enforce
in the first place.

**What this report does:**
1. Assigns a researched verdict to every catalogue source and summarises the interaction
   layer (§3–§4).
2. Corrects the annotations that were wrong or missing (`pharmeasy`, `netmeds`, `apollo`,
   `nppa`) — see the companion commit.
3. Recommends prioritised actions to clear or contain each risk (§7).

The **release-gate enforcement change itself is intentionally out of scope** of the
accompanying pull request, to avoid colliding with concurrent CI work on the same repo.
It is the single highest-value follow-up (§7a).

---

## 2. Per-source verdict table

Legend — **Crawl OK?** / **Redistribute OK?**: Yes / No / Conditional / Uncertain.
**Risk**: high / medium / low / clear.

### Catalogue / drug-product layer

| Source | What ships | Terms found (one line) | Crawl OK? | Redistribute OK? | Risk | Action to clear |
|---|---|---|---|---|---|---|
| `github-jr` (junioralive Indian-Medicine-Dataset) | 253,973 rows — primary bulk | Repo carries an MIT LICENSE (`© 2024 JuniorAlive`); **README states no data provenance at all** | Yes (MIT + public GitHub) | **Uncertain** — MIT covers only the uploader's compilation, not underlying scraped rights | **medium–high** | Ask maintainer to document provenance/rights basis (§7e); decide keep-with-risk vs replace |
| `onemg-live` (Tata 1mg) | 149,284 rows | 1mg ToS: no scraping, no reproduction/distribution of "TATA 1mg Content" | **No** (ToS bars automated access) | **No** (ToS bars reproduction) | **high** | Exclude from public release; keep internal-only, or seek 1mg permission |
| `pharmeasy` | 141,142 rows | PharmEasy ToS: "no automated means such as data scraper, deep-link, robot"; no copying/republishing content | **No** | **No** | **high** | Exclude from public release; keep internal-only, or seek permission |
| `netmeds` | 120,812 rows | Netmeds ToS: bars spiders/robots + data-mining/extraction; limited revocable licence | **No** | **No** | **high** | Exclude from public release; keep internal-only, or seek permission |
| `apollo` | 14,931 rows | Apollo ToS: "any other use … is strictly prohibited … copy, reproduce, transmit, publish, display, distribute"; explicit scraping clause **not confirmed** | **No (redistribution); crawl uncertain** | **No** | **high** | Exclude from public release; verify scraping clause; keep internal-only or seek permission |
| `janaushadhi` (PMBJP list) | 2,111 rows | No published terms found (SPA/unreachable); Government/PSU work → default all-rights-reserved | Uncertain | **No** (permission needed) | **medium–high** | Exclude from public release until PMBI permission (draft provided); or use the aggregate data.gov.in dataset under GODL |
| `nppa` (ceiling prices) | 732 rows incl. price | Ceiling prices are Official Gazette matter → reproducible under Copyright Act 1957 **s.52(1)(q)(i)** | Yes (gazette matter) | **Yes** (gazette carve-out) | **clear** (data); site policy unverified | Annotate as gazette-cleared, attribute NPPA; re-verify site copyright page |
| `kaggle-2025` | not shipped (disabled) | Kaggle page indicates **CC BY-NC-SA 4.0**; provenance opaque (likely e-pharmacy scrape) | Yes (with Kaggle acct) | **NC only**, and underlying rights uncleared | medium | Keep disabled, or use NC-partitioned + re-verify live licence field |
| `cdsco-fdc` | not shipped (validation-only) | CDSCO Copyright Policy: "may not be reproduced … without due permission" | Uncertain | **No** (permission needed) | medium | Keep validation-only/internal; seek CDSCO permission (draft provided); gazette ban-lists are separately exempt |
| `atc` (WHO ATC/DDD) | ships as `atc_codes` on 618,324 rows | WHOCC: "requires reference to WHOCC … distribution for commercial purposes is not allowed … changing/manipulating not allowed" | Conditional | **Conditional** — individual codes on own rows OK w/ attribution + NC; full index **No** | medium | Keep to per-row code annotation + WHOCC attribution; keep dataset NC-compatible or partition ATC |
| `cdci-snomed-ct` | not shipped (export forbidden) | SNOMED CT Affiliate licence; user-supplied | Yes (with affiliate licence) | **No** (affiliate terms) | low (already contained) | No action; export already forbidden |

### Interaction-evidence layer (summary — mostly already correctly annotated)

These feed the clinician-reviewed interaction rule pack, not the brand→composition
catalogue. Annotations in `interaction-sources.json` were checked against research and
are correct:

| Source | Licence | Redistribute? | Note |
|---|---|---|---|
| `openfda-labels`, `fda-gsrs-unii` | CC0-1.0 | Yes, any purpose | Cleanest; no attribution required (courtesy only) |
| `fda-cyp-transporter`, `fda-authored-web-content` | US public domain | Yes | FDA-authored content only |
| `mhra-govuk-drug-safety-updates` | OGL v3.0 | Yes, incl. commercial | Attribution statement required; exclude Crown logos |
| `rxnorm` | NLM RxNorm terms | Yes (prescribable subset) | Avoid UMLS/SNOMED-restricted full RxNorm |
| `who-inn` | WHO INN public names | Yes | Identity only |
| `drugcentral` | CC-BY-SA-4.0 | Yes | Attribution + ShareAlike; own share-alike pack |
| `hl7-pddi-cds` | CC0-1.0 | Yes | Rule structure |
| `aushadhi-open-clinician-rules` | CC-BY-4.0 | Yes | The project's own rules |
| `ddinter-2` | CC-BY-**NC**-SA-4.0 | **NC only** | Disabled; keep partitioned if enabled (viral SA + NC) |
| `dailymed-…`, `fda-accessdata-…` | Unknown | No | Locator-only; ingestion forbidden |
| `emc`, `acr`, `drugs-com`, `medscape`, `webmd`, `drugbank-web` manual refs | Proprietary web | No | Manual-reference only; ingestion forbidden |

---

## 3. Detailed catalogue-source sections

### 3.1 `github-jr` — junioralive/Indian-Medicine-Dataset (primary bulk, 253,973 rows)

- Repo **does** carry an MIT `LICENSE`. First lines (fetched from raw GitHub): `MIT
  License` / `Copyright (c) 2024 JuniorAlive`.
  Source: `https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/LICENSE` [MIRROR]
- README describes 253,973 medicines with name, price, manufacturer, type, pack size,
  composition (CSV + JSON). Its only reuse guidance [MIRROR]:
  > "This dataset is open for use by anyone interested in exploring Indian pharmaceutical
  > products."
- **Provenance red flag:** the README states **no data source or collection method** —
  no mention of scraping, 1mg, or any e-pharmacy. The price/pack-size/composition schema
  is characteristic of e-pharmacy catalogue scraping, but the repo asserts and clears
  nothing.
- **Verdict:** MIT covers only *JuniorAlive's own contribution* (the compilation/
  formatting). An MIT stamp cannot grant rights the uploader never held. If the rows are
  scraped from a commercial e-pharmacy catalogue, the underlying facts/compilation may
  carry that site's ToS constraints. Redistribution is **not cleanly cleared by the MIT
  label**. This is the pipeline's PRIMARY bulk source, so the provenance risk is material.
  Homepage: `https://github.com/junioralive/Indian-Medicine-Dataset`

### 3.2 `onemg-live` — Tata 1mg (149,284 rows shipped)

Terms page `https://www.1mg.com/Tnc` [SEARCH-INDEX]:
> prohibits using "any engine, software, tool, agent or other device or mechanism (such
> as spiders, robots, avatars or intelligent agents) to navigate or search the Website"

> users may not use "any automated means (such as a scraper) to access the Website, the
> Information, or Services for any purpose"

> "The TATA 1mg Content is the property of TATA 1mg and is protected under copyright,
> trademark and other applicable law(s)."

> users shall not "modify the TATA 1mg Content or reproduce, display, publicly perform,
> distribute, or otherwise use the TATA 1mg Content in any way for any public or
> commercial purpose or for personal gains"

**Verdict:** crawling is a ToS breach; public redistribution squarely breaches the
copying/republication clauses. 1mg's monographs are heavily editorialised, so copying
them raises copyright exposure, not just contract. Highest-risk of the four e-pharmacies.
Correctly annotated `PROPRIETARY`/`redistributable: false` — but shipped anyway.

### 3.3 `pharmeasy` — PharmEasy (141,142 rows shipped; was unannotated)

Terms page `https://pharmeasy.in/legal/terms-and-conditions` [SEARCH-INDEX]:
> "you agree not to access the Website and materials or services by any means other than
> through the interface provided by the Company"

> "you shall not use any automated means such as data scraper, deep-link, robot, or
> similar automated tools"

Content — "text, graphics, user interfaces, sounds and music, artwork and computer code" —
is "owned and controlled by the company and protected by copyright, patent and trademark
laws". Users are barred from "copying, republishing, posting, displaying, translating,
transmitting, reproducing or distributing any content" without authorisation.

**Verdict:** crawling and redistribution both barred by ToS. High risk.

### 3.4 `netmeds` — Netmeds (120,812 rows shipped; was unannotated)

Terms page `https://www.netmeds.com/terms-and-conditions` [SEARCH-INDEX]:
> prohibits using "any engine, software, tool, agent or other mechanism (such as spiders,
> robots, avatars, worms, time bombs etc.) to navigate or search the Website"

> forbids "any bots or scrape the Website for any information"

> the licence does not include "any use of data mining, robots, or similar data gathering
> and extraction tools to extract (whether once or many times) any parts of the Website"

> "Your use of the Website, the Services, and access to the Company Content is subject to
> a limited, revocable and non-exclusive license…"

**Verdict:** crawling barred; redistribution outside the limited revocable licence. High
risk (Reliance-group plaintiff).

### 3.5 `apollo` — Apollo Pharmacy (14,931 rows shipped; was unannotated)

Terms page `https://www.apollopharmacy.in/terms` [SEARCH-INDEX]:
> "any other use of the material and content of the APL Platform is strictly prohibited
> and you agree not to (and agree not to assist or facilitate any third party to) copy,
> reproduce, transmit, publish, display, distribute, commercially exploit or create
> derivative works of such material and content."

An **express** automated-access/scraper clause was **not** found in the available search
excerpts and could not be confirmed by direct fetch — treat crawl status as uncertain but
likely restricted given the sweeping "any other use … strictly prohibited" language.

**Verdict:** redistribution clearly barred; crawling uncertain (verify by direct fetch).
High risk on redistribution.

### 3.6 `janaushadhi` — PMBJP product & MRP list (2,111 rows shipped)

- No copyright/terms text could be located: `janaushadhi.gov.in` is a client-side JS app
  that renders only "You need to enable JavaScript to run this app" to the search index,
  and the host was unreachable this session. [NOT FOUND / UNREACHABLE]
- **Absence of a found policy ≠ permissive policy.** As a Government/PMBI (public-sector
  undertaking) work, the content is copyright-protected by default (Copyright Act s.2(k),
  s.17(d)/(dd), 60-year term s.28/s.28A). With no published licence, the default is **all
  rights reserved**.
- The product/MRP list was **not** found on `data.gov.in` under GODL; only an aggregate
  programme-statistics dataset ("Year-wise Details of Sales Through Jan Aushadhi
  Kendras…") is there, and that one would be GODL.
- Mitigating (uncertain) argument: drug names, compositions and MRPs are unprotectable
  **facts**, and Indian law requires a "modicum of creativity" for compilation copyright
  (EBC v. D.B. Modak, (2008) 1 SCC 1) — a bare price list arguably fails that. But this is
  a legal-risk argument, not a licence.
- The pipeline fetches the list from a PIB-hosted PDF
  (`https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/feb/doc202626781701.pdf`).

**Verdict:** treat as **permission-needed**. Correctly annotated
`NOT-CLEARED-FOR-REDISTRIBUTION` — but shipped anyway. Write to PMBI (draft in
`docs/PERMISSION_REQUEST_DRAFTS.md`), or ship only the aggregate GODL dataset.

### 3.7 `nppa` — NPPA NLEM ceiling-price list (732 rows shipped incl. price)

- NPPA ceiling-price fixations are issued as S.O./notification instruments under the Drugs
  (Prices Control) Order, 2013 (an order under s.3 of the Essential Commodities Act) and
  **published in the Official Gazette**. The PDFs on `nppa.gov.in` are copies of these
  instruments.
- **Copyright Act 1957, s.52(1)(q)(i)** [MIRROR of full-text Act]:
  > "the reproduction or publication of— (i) any matter which has been published in any
  > Official Gazette except an Act of a Legislature" … does not constitute infringement.
- Ceiling-price notifications are gazette matter, not Acts, so reproduction and
  republication is **statutorily permitted irrespective of website terms**. (s.2(k)/
  s.17(d) make them Government works — copyright vests in Government, so they are not "US
  public domain" — but s.52(1)(q)(i) is the operative carve-out.)
- The `nppa.gov.in` footer links a "Copyright Policy" whose **text could not be located
  or fetched** [NOT FOUND / UNREACHABLE]. Non-gazette site content (dashboards, analyses)
  is therefore uncertain until that page is verified; the same price instruments are also
  available from `egazette.gov.in`.

**Verdict on the price data: cleared** — reproducible and redistributable under
s.52(1)(q)(i). Reproduce accurately and acknowledge NPPA as source. **Was unannotated;
now annotated** (see §7b and the companion commit) — note the manifest limitation
discussed there.

### 3.8 `kaggle-2025` — Kaggle apkaayush/india-medicines-and-drug-info-dataset (not shipped)

- Kaggle page not directly fetchable (403). Declared licence per search of the page:
  **CC BY-NC-SA 4.0** [SEARCH-INDEX]. Provenance not surfaced; this dataset family is
  broadly known to originate from e-pharmacy/1mg-style scrapes.
- **Verdict:** if CC BY-NC-SA 4.0 as indicated, redistribution requires attribution +
  NonCommercial + ShareAlike, and NC bars any commercial redistribution. Same
  underlying-rights caveat as `github-jr`: a Kaggle uploader's CC label does not prove
  they held the rights to relicense scraped data. Correctly `enabled: false` /
  `redistributable: false` today. Re-verify the live licence field before enabling.

### 3.9 `cdsco-fdc` — CDSCO fixed-dose-combination material (validation-only, not shipped)

CDSCO Copyright Policy `https://cdsco.gov.in/opencms/opencms/en/Copyright-Policy/`
[SEARCH-INDEX]:
> "The contents of this website may not be reproduced partially or fully, without due
> permission from Central Drugs Standard Control Organization, Govt. of India. If referred
> to as a part of another publication, the source must be appropriately acknowledged. The
> contents of this website can not be used in any misleading or objectionable context."

This is the **restrictive** NIC/opencms variant, **not** the permissive GIGW "may be
reproduced free of charge" template. **Verdict:** redistribution needs permission.
Exception: content that is verbatim gazette-notification matter (e.g. FDC ban
notifications under s.26A) is reproducible under s.52(1)(q)(i). Correctly annotated
`REUSE-PERMISSION-REQUIRED`; validation-only role emits no product rows. Seek permission
(draft provided) or restrict to gazette-sourced material.

### 3.10 `atc` — WHO ATC/DDD classification (ships as `atc_codes` on 618,324 rows)

WHOCC copyright disclaimer (`https://atcddd.fhi.no/copyright_disclaimer/` /
`https://www.whocc.no/copyright_disclaimer/`) [SEARCH-INDEX]:
> "Use of all or parts of the material requires reference to the WHO Collaborating Centre
> for Drug Statistics Methodology. Copying and distribution for commercial purposes is not
> allowed. Changing or manipulating the material is not allowed."

**Verdict — the distinction matters:**
- Redistributing the **full ATC index** is restricted: non-commercial only, must
  reference WHOCC, no modification. Bundling the whole classification into a
  redistributable file would breach the no-commercial-distribution / no-manipulation
  terms.
- Annotating **your own drug rows with individual ATC codes** is a much weaker claim on
  WHOCC's material and is the defensible path — but still include WHOCC attribution and
  keep the use non-commercial. The dataset's own licence must stay NC-compatible, or the
  ATC codes must be partitioned. The full ATC reference is operator-supplied, not bundled
  (`src/adapters/atc.mjs` comment confirms).

### 3.11 `cdci-snomed-ct` — SNOMED CT India drug extension (not shipped; export forbidden)

User-supplied SNOMED CT RF2 under a SNOMED Affiliate licence (`SNOMED-CT-AFFILIATE`,
`redistributable: false`, `internal-evaluation` only). Deployment/export is forbidden by
`release-receipt.mjs`. **Verdict:** already correctly contained; no action.

---

## 4. Interaction-evidence layer — confirmation

Research (openFDA CC0; RxNorm prescribable subset unrestricted; DrugCentral CC-BY-SA-4.0;
MHRA OGL v3.0; DDInter CC-BY-NC-SA-4.0; WHO INN public names; HL7 PDDI-CDS CC0) matches
the existing `interaction-sources.json` annotations. No corrections needed in this layer.
The only compatibility caution: `ddinter-2` (CC-BY-NC-SA-4.0) and any NC source must stay
partitioned from the CC0/OGL/CC-BY-SA open core (see §6).

---

## 5. Key legal backdrop (India)

- **Government works are copyright-protected, not public domain.** Copyright Act 1957
  s.2(k) (definition of "Government work"), s.17(d)/(dd) (Government/PSU is first owner),
  s.28/s.28A (60-year term). So Indian government website content needs a licence (GODL,
  a GIGW-style policy, or express permission) to reproduce — **unlike** US federal works.
- **Gazette exception — s.52(1)(q)(i):** reproduction/publication of "any matter which has
  been published in any Official Gazette except an Act of a Legislature" is not
  infringement. **This is what clears the NPPA ceiling prices** (and CDSCO gazette ban
  notifications) regardless of website policy.
- **Facts are not copyrightable; thin compilation copyright.** EBC v. D.B. Modak, (2008) 1
  SCC 1 rejected pure "sweat of the brow" and required a "modicum of creativity" for
  compilations. Raw fields — drug name, salt composition, MRP, availability — are facts
  and unprotected; copying expressive content (monographs, descriptions, images) or
  wholesale replicating a site's curated structure is where copyright risk lives.
- **No sui generis database right in India** (unlike the EU Database Directive) — no
  separate extraction right; databases are protected only as copyright compilations.
- **ToS/contract is the operative risk for e-pharmacies.** All four sites frame their
  terms as electronic records/contracts under the IT Act, 2000. Scraping in breach of an
  express anti-scraping clause is a breach-of-contract exposure even where the data is
  factual. Browsewrap enforceability in India is untested, but anti-scraping clauses are
  standard and the safe reading is that they bind users who access the site.
- **Case-law markers.** *OLX v. Padawan* (Delhi HC, Endlaw J.) — permanent injunction
  against a portal "lifting" OLX listings; closest Indian precedent for enjoining
  republication of scraped listings. *ANI Media Pvt. Ltd. v. OpenAI* (Delhi HC, interim
  order 24 July 2026) — interim injunction **refused**; prima facie training on
  copyrighted content fell within fair dealing for "private or personal use, including
  research" (s.52(1)(a)(i)). Interim only, main suit pending — the strongest recent Indian
  signal that ingestion/analysis is treated more leniently than verbatim republication.
  No Indian equivalent of *hiQ v. LinkedIn* blessing public-data scraping exists.

---

## 6. Licence-compatibility

- **Open core combines fine:** CC0 (`openfda`, `fda-gsrs-unii`, `hl7-pddi-cds`), OGL v3.0
  (`mhra`), and CC-BY-SA-4.0 (`drugcentral`) can be combined in one redistributable
  product with attribution + ShareAlike honoured on the BY-SA portion.
- **NonCommercial sources contaminate a commingled file.** The moment a **NC** source
  enters a single combined file — DDInter (CC-BY-NC-SA-4.0), Kaggle (CC-BY-NC-SA-4.0), or
  the WHO ATC terms (non-commercial) — the whole file inherits NonCommercial (and, for
  DDInter/Kaggle, a viral ShareAlike). **Keep NC sources in separate, clearly-licensed
  partitions**; do not merge them into the open-core file. For ATC specifically, keep to
  per-row code annotation (not full-index redistribution) and keep the dataset NC-
  compatible or partition the ATC codes.
- **Provenance-opaque scraped inputs.** `github-jr` (MIT) and the Kaggle dataset (CC
  BY-NC-SA) are provenance-opaque scraped e-pharmacy data. Their open labels **do not
  clear the underlying rights** — an uploader cannot license out what they never held.
  This directly undercuts `github-jr`, the pipeline's **primary bulk source** (253,973
  rows). It is the single largest unquantified risk in the public dataset.

---

## 7. Recommended actions (priority order)

**a. Stop shipping restricted / unannotated sources in public releases (highest value).**
Exclude `onemg-live`, `pharmeasy`, `netmeds`, `apollo`, and `janaushadhi` rows from public
releases until cleared — or make releases access-controlled. **The release gate should
enforce `redistributable: false` and missing-licence exclusion mechanically**, so a source
marked non-redistributable (or with no manifest entry) cannot reach a public artifact.
*This enforcement code change is deliberately left out of the accompanying PR to avoid
conflicting with concurrent CI work; it is the top follow-up.*

**b. NPPA ceiling prices — cleared via the gazette exception; annotate as such.** The
price data is reproducible and redistributable under Copyright Act s.52(1)(q)(i);
attribution to NPPA is recommended. **Manifest limitation:** the policy enum
(`interaction-source-policy.mjs` `LICENCE_ID_CLASSES`) currently has **no token for
"Indian Official Gazette / open-government reproducible matter."** Rather than mis-stamp
Indian government data with a US (`US-PUBLIC-DOMAIN`), UK (`OGL-3.0`), or CC (`CC0-1.0`)
token in a licensing record, the companion commit adds an `nppa` entry that records the
gazette-clearance basis in a `notes`/`rights_scope` field while keeping the machine flag
fail-safe. **Follow-up (deferred code change):** add an `INDIA-GAZETTE`-style
open-government licence id to the enum, then flip `nppa` to `redistributable: true` in the
`production-open` profile with NPPA attribution.

**c. GODL attribution template — if/when any data.gov.in dataset is used.** None is used
today (the government sources are accessed as direct/operator-dropped PDFs, not via the
data.gov.in NDSAP/GODL portal). If a GODL dataset is ever ingested (e.g. the aggregate
PMBJP sales dataset), publish the GODL Section 5 attribution: *"[Data Provider], [Year],
[Dataset], [Portal], [Version/Date], [URL/DOI]. Published under Government Open Data
License – India: [licence URL]."* — plus non-endorsement, respecting the Section 6
exemptions.

**d. Send permission requests to PMBI/Jan Aushadhi and CDSCO.** Ready-to-send drafts are
in `docs/PERMISSION_REQUEST_DRAFTS.md`. Do not send until reviewed.

**e. Treat `github-jr` as a provenance risk.** Its MIT label does not clear the rights of
whatever was scraped to build it. Decide: keep it with documented risk, or seek
clarification from the maintainer (GitHub-issue draft in the drafts file). Because it is
the primary bulk source, resolving its provenance materially de-risks the whole release.

**f. Keep ATC usage within WHOCC terms.** Attribution to WHOCC, non-commercial, no
full-index redistribution — restrict to per-row code annotation. Keep the dataset's own
licence NC-compatible or partition the ATC codes.

---

## 8. Appendix — re-verification checklist

The research environment could not fetch these live; **re-verify each in a browser**
before relying on the quotes marked [SEARCH-INDEX]/[MIRROR] or acting on the verdicts:

1. **1mg ToS** — `https://www.1mg.com/Tnc` (and `robots.txt`).
2. **PharmEasy ToS** — `https://pharmeasy.in/legal/terms-and-conditions` (and `robots.txt`).
3. **Netmeds ToS** — `https://www.netmeds.com/terms-and-conditions` (and `robots.txt`).
4. **Apollo ToS** — `https://www.apollopharmacy.in/terms` — confirm presence/absence of an
   express automated-access/scraper clause (and `robots.txt`).
5. **CDSCO Copyright Policy** — `https://cdsco.gov.in/opencms/opencms/en/Copyright-Policy/`.
6. **NPPA Copyright Policy** — footer link on `https://nppa.gov.in/en` (text not found).
7. **Kaggle licence field** — `https://www.kaggle.com/datasets/apkaayush/india-medicines-and-drug-info-dataset`
   (confirm the live "License" value is CC BY-NC-SA 4.0).
8. **WHOCC copyright terms** — `https://atcddd.fhi.no/copyright_disclaimer/`.
9. **Jan Aushadhi terms** — render `https://www.janaushadhi.gov.in/` and
   `https://www.pmbi.co.in/` in a JS-capable browser; capture any Terms/Copyright routes.
10. **data.gov.in GODL** — `https://www.data.gov.in/government-open-data-license-india`
    and `/terms-of-use` (confirm mirror fidelity); manual catalogue search for any
    PMBJP *product-level* dataset under GODL.
