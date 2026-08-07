# Permission-request drafts

[**Pre-send note:** Aushadhi is currently a private development repository. These drafts
request permission for possible future uses; they do not claim that a public,
open-source, or non-commercial release already exists. The owner and qualified counsel
must approve the exact project description and intended use before anything is sent.]

**Status: DRAFTS ONLY — nothing here has been sent.** Fill the `[YOUR NAME]` /
`[…]` placeholders, obtain owner and legal review, and confirm the current recipient address on each
organisation's official contact page before sending. These accompany
[`docs/LICENSING_REPORT.md`](LICENSING_REPORT.md).

No published individual email address for a specific PMBI/CDSCO officer was found in the
research, so recipient lines say "find current contact on the site's contact page" rather
than guessing an address.

---

## 1. To PMBI (Pharmaceuticals & Medical Devices Bureau of India) — Jan Aushadhi / PMBJP

**Recipient:** find the current contact on the "Contact Us" page of
`https://www.janaushadhi.gov.in/` (PMBI) — also `https://www.pmbi.co.in/`. If a grievance
or public-information officer address is listed, address it there.

**Subject:** Request for permission to use and potentially redistribute the Jan Aushadhi
product and MRP list with attribution

---

Dear Sir/Madam,

I am writing on behalf of **Aushadhi**, a private development project evaluating a
structured reference dataset of Indian medicines (brand name → generic
composition → pack/strength) to help clinicians and health-software developers match and
validate drug compositions accurately.

We would like your permission to **reuse and publicly redistribute the Pradhan Mantri
Bhartiya Janaushadhi Pariyojana (PMBJP) product list**, specifically the following fields
from the published product portfolio / MRP list:

- Product / generic name
- Composition (salt and strength)
- Pack size / unit
- MRP (₹)
- PMBJP product code, where published

**Scope and intended use:**
- Current purpose: private internal validation and evaluation. The current repository and
  snapshots are not public releases and carry no redistribution authority.
- Potential redistribution: only if PMBI grants permission and the project owner later
  authorizes a release, the approved fields may be published with **clear attribution to
  PMBI / Jan Aushadhi** and a link to the official list.
- Update cadence: we would refresh from the current official list periodically (roughly
  quarterly, or whenever PMBI publishes an updated portfolio), and note the source
  version/date on each release.
- We would honour any conditions you set — for example, a required attribution wording, a
  restriction to non-commercial use, or a limit on which fields may be redistributed.

Could you please confirm:
1. Whether PMBI grants permission to reuse and redistribute the above fields under these
   terms; and
2. The exact attribution statement you would like us to display; and
3. Any conditions or restrictions we should observe.

If a formal open licence already applies to this list (for example, the Government Open
Data License – India), please point us to it and we will comply with its attribution and
usage terms instead.

Thank you very much for your time and for the public service Jan Aushadhi provides. I am
happy to provide any further details about the project.

Kind regards,
[YOUR NAME]
[ROLE / "maintainer, Aushadhi"]
[EMAIL]
[PROJECT URL]

---

## 2. To CDSCO (Central Drugs Standard Control Organization)

**Recipient:** find the current contact on the "Contact Us" / Public Grievance / CPIO page
of `https://cdsco.gov.in/`. CDSCO's Copyright Policy requires "due permission" for
reproduction, so this request is addressed under that policy.

**Subject:** Request for permission under CDSCO's Copyright Policy to reproduce
approved-drug / FDC list contents for validation and potential redistribution

---

Dear Sir/Madam,

I am writing on behalf of **Aushadhi**, a private development project evaluating a
structured reference dataset of Indian medicines to help clinicians and health-software
developers validate drug compositions and fixed-dose combinations.

We note that CDSCO's Copyright Policy states that the contents of the website "may not be
reproduced partially or fully, without due permission" from CDSCO. Accordingly, we
respectfully **request permission** in relation to the following CDSCO-published material:

- The list(s) of **approved drugs** and **approved fixed-dose combinations (FDCs)**,
  specifically the factual fields: ingredient/composition, strength, and approval
  status/reference.

**Scope and intended use:**
- Primary use: **validation** — we use the approved-FDC list to check that combination
  products in our dataset correspond to genuinely approved combinations. This is an
  internal correctness check.
- Potential redistribution: we would also like permission to **redistribute the factual
  approval information** (composition/strength/approval reference) in a future dataset,
  if separately approved, **with clear attribution to CDSCO** and a link to the source.
- We understand that a statutory exception may apply to material proven to have been
  published in the Official Gazette. This request does not rely on that unreviewed legal
  position and concerns CDSCO's compiled website/PDF lists.
- We will reproduce the material accurately, not use it in any misleading or objectionable
  context, and acknowledge CDSCO as the source, consistent with your Copyright Policy.

Could you please confirm whether CDSCO grants permission for (1) internal validation use
and (2) attributed redistribution of the factual approval information, and specify any
conditions or the exact attribution wording you require.

Thank you for your time and for CDSCO's work in drug safety and regulation.

Kind regards,
[YOUR NAME]
[ROLE / "maintainer, Aushadhi"]
[EMAIL]
[PROJECT URL]

---

## 3. To the maintainer of junioralive/Indian-Medicine-Dataset (GitHub issue text)

Post as an issue on `https://github.com/junioralive/Indian-Medicine-Dataset`, not as
email.

**Issue title:** Could you document the dataset's provenance and the rights basis for the
MIT licence?

---

Hi, and thanks for publishing this dataset — it is genuinely useful.

We use it as an input in a private Indian-medicines reference project, and we are
doing a licensing review of all our data sources. To use your dataset responsibly we would
love a bit more clarity on its provenance:

1. **Where does the data come from?** The README (currently) does not state a source or
   collection method. Was it compiled by hand, from a government/official list, or
   collected from one or more websites (e.g. an e-pharmacy catalogue)?
2. **What is the rights basis for the MIT licence on the data itself?** The MIT `LICENSE`
   clearly covers your own code/compilation work. If the underlying rows were gathered
   from a third-party source that has its own terms, an MIT stamp on the repository would
   not, by itself, clear those underlying rights. Could you clarify whether the data was
   original, public-domain/officially-licensed, or collected from a source whose terms
   permit redistribution?
3. Anything else about how the data may be reused/redistributed that you would like
   downstream users to know.

Even a couple of lines in the README about the source and how it was gathered would help
everyone downstream reuse it correctly. Thank you!
