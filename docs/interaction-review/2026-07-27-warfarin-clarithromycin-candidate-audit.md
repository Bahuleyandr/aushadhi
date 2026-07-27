# Warfarin–clarithromycin — read-only candidate audit

**Date:** 2026-07-27
**Packet:** `warfarin-clarithromycin-pmbjp-oral-tablets-candidate-audit-2026-07-27`
**Machine-readable companion:** `2026-07-27-warfarin-clarithromycin-candidate-audit.json`
**Status:** A1–A6 approved by `clinician:subas` on 2026-07-27 · **ALL SIX EXECUTED**
**Approval record:** `2026-07-27-warfarin-clarithromycin-clinician-approval.md`

> ## ✅ Completed 2026-07-27
>
> A1, A2 and A5 were unblocked once F5 was resolved as an extraction artifact, and are now recorded:
> ingredient identity `clarithromycin` = RxNorm 21212 / UNII H1250JIK0A, presentation
> `presentation:pmbjp:740:oral-tablet`, and the compiled rule `warfarin__clarithromycin_oral`
> (major / confirm_and_monitor, **3 exact pairs**).
>
> **The tender binding retracted below is itself withdrawn.** Re-read in `table` mode, RC-222/2025
> page 64 item 122 does bind code 740 to "Clarithromycin Tablets IP 250 mg" — the original claim was
> right, and catalogue, official product list and tender all agree.
>
> Totals: mappings 8→9 and 17→18, promotions 7→8, exact pairs 42→45.
> **Production-open unchanged: 0 rules.** Code verifier: 18/18 confirmed.

<details>
<summary>Historical: the halt that applied before F5 was resolved</summary>

> ## ⚠ Execution halted partway — read this first
>
> A1–A6 were all approved. While executing **A2** (recording the product-presentation mapping) I found
> that **PMBJP drug codes in the catalogue do not reliably match the official PMBJP product list**
> (finding **F5**, below). The official list assigns **code 739** to clarithromycin 250 mg and
> **code 740 to Cefpodoxime Proxetil Dispersible Tablets 50 mg** — a different drug.
>
> **This also retracts a claim in the original version of this packet.** It asserted the tender bound
> code 740 to clarithromycin. That claim rested on a positional column alignment in a multi-column PDF
> and is not reliable. It is now marked retracted.
>
> Because the A1/A2/A5 approval was given on the strength of that now-retracted claim, those three
> items are **halted for re-decision** rather than executed. **A3, A4 and A6 are unaffected** — they
> rest on the openFDA evidence and rule structure, not on PMBJP product codes — and have been executed.
>
> **No mapping and no promotion has been recorded. Production-open is still empty (0 rules).**

</details>

### What was executed

| Item | Status | Result |
|---|---|---|
| **A3** | ✅ done | `warfarin__clarithromycin_oral` added; clarithromycin removed from the class row; pack reassembled with live verification of all **245** evidence records; attestation + review index refreshed. New pack SHA `02f1a115…0009d`, **200 rules**, all still draft-gated. |
| **A4** | ✅ done — **decision revised to _retire_** | I first rescoped the row to erythromycin-only with an `evidence_gap` marker. That state failed a repo invariant: it duplicated the clarithromycin fragment across two rules (the pack forbids duplicate evidence fragments), and it left an *erythromycin* rule citing a *clarithromycin* label. Both point the same way, and it matches F1's own required action, so the row was **retired**. See the note below. |
| **A6** | ✅ done | Code 380 excluded. F3/F5 turned out to be extraction artifacts, so the standing ground is **F2**: RxNorm exposes both an immediate-release and a 24 HR extended-release 500 mg oral tablet, which the catalogue row cannot disambiguate. |
| **A1** | ✅ done | `ingredient:clarithromycin:rxnorm-21212` — RxNorm 21212 (`tty IN`), UNII H1250JIK0A, relationship `exact`. |
| **A2** | ✅ done | `presentation:pmbjp:740:oral-tablet` → product `sha256:7a9b5161…`, assertion `153530a9…`, internal-evaluation only, 5 evidence records. |
| **A5** | ✅ done | `warfarin__clarithromycin_oral` compiled — major / confirm_and_monitor, bound to draft row `33a01de9…`, **3 exact pairs**. |

The split works as designed — the duplicate alert is gone:

```
warfarin + clarithromycin  ->  warfarin__clarithromycin_oral / major   (single finding)
warfarin + erythromycin    ->  (no finding)                            (uncovered — see below)
warfarin + azithromycin    ->  warfarin__azithromycin_oral / moderate  (unchanged)
```

> ### ⚠ A4 was decided as *retire*, and you should confirm you're happy with that
>
> I told you I was reading A4 as "keep the row, marked as an evidence gap". Implementing it proved
> that reading unworkable: retaining the row required keeping a **clarithromycin** label attached to
> an **erythromycin**-only rule, which duplicated the evidence fragment across two rules and tripped
> the pack's no-duplicate-fragment invariant. Rather than weaken a safety invariant to preserve a rule
> that had no evidence of its own, I retired it — which is what F1's own `required_action` said.
>
> **The consequence is real and worth stating plainly: `warfarin + erythromycin` now matches nothing.**
> It never fired at runtime (the row was always draft-gated), so nothing changes operationally, but the
> draft no longer carries the pair. The gap is recorded in F1 as outstanding work. **Reversible** — the
> row is in git history; restoring it should be paired with genuine erythromycin evidence.
>
> Final pack: **199 rules / 244 evidence records**, SHA `3a9d0531…d691f`, all draft-gated.

---

## 1. Bottom line

| Question | Answer |
|---|---|
| Can the existing class row be promoted? | **No.** It declares two runtime members but carries clarithromycin-only evidence. |
| Is an exact named child the right architecture? | **Yes** — `warfarin__clarithromycin_oral`, plus removing clarithromycin from the class row. |
| How many exact product pairs survive the evidence chain? | **3**, not the 6 that two clarithromycin products would have given. |
| Does this change the attested draft? | **Yes**, and that is a decision for the clinician, not for this audit. |

The audited rule `warfarin__macrolide_cyp_inhibitor` is draft-gated exactly as expected
(`runtime_enabled: false`, `promotion_eligible: false`) and its draft row hashes to
`0738d28943296c870140e6e51a3761370e1f3e494d42e5a3cf56a87ead42f311` inside pack
`42b50292…974a`.

---

## 2. Why the class row must not be promoted

The row declares runtime members `[clarithromycin, erythromycin]` but holds **exactly one**
evidence record — an openFDA clarithromycin label whose own `normalized_proposition` ends:

> *"Supports CLARITHROMYCIN only."*

and whose `scope_note` reads:

> *"Located source is a clarithromycin label; erythromycin/other macrolide members need separate evidence."*

Its scope block already carries `requires_clinician_class_mapping: true` and
`directly_supported_members: ["clarithromycin"]` against
`runtime_members: ["clarithromycin","erythromycin"]`. Promoting it as written would be mechanical
class expansion from single-member evidence.

---

## 3. Architecture: three designs were simulated against the real engine

| Sim | Design | Result | Verdict |
|---|---|---|---|
| **A** | Add exact child, leave class row alone | `warfarin+clarithromycin` raises **both** rules | Rejected — duplicate alert |
| **B** | Add exact child **and** drop clarithromycin from class members | clarithromycin → child only; erythromycin → class row only | **Recommended** |
| **C** | Add exact child carrying `suppresses:[…]` | Suppression **did not apply**; both still raised | Unavailable — and correctly so |

Sim C is the interesting one. The engine *does* implement `suppresses`, but
`canExplicitlySuppress()` refuses when either side is an unresolved finding. The class-row finding
resolves to `clinical_action_status: unresolved_pending_applicability`, so it cannot be suppressed.
That is the fail-closed boundary behaving correctly: **an unresolved finding must never be silently
hidden by another rule.** The `suppresses` route is therefore not available here, and should not be
forced open.

Sim B changes the attested draft (one row added, one row edited). Per the handover conditional that
requires deterministic JSONL ordering, full reassembly, live re-verification, a refreshed attestation
and derived indexes, and a newly bound draft-row SHA-256 — and the existing class-row review status
must **not** be carried over as authorization for the new child. **This audit stops before that
change.**

---

## 4. Four findings the handover did not contain

### F1 — the class row is evidentially hollow for erythromycin *(blocking for erythromycin)*
The single evidence record is clarithromycin's. If clarithromycin moves to an exact child, the class
row is left asserting a **major** warfarin interaction for erythromycin backed by **zero** evidence
records. Either source and review independent erythromycin evidence, or reduce/retire the row.
Leaving an unevidenced single-member class in place is not acceptable.

### F2 — the 500 mg strength is ambiguous in RxNorm *(blocking for code 380)*
RxNorm exposes **two** 500 mg oral-tablet concepts:

- `clarithromycin 500 MG Oral Tablet`
- `24 HR clarithromycin 500 MG Extended Release Oral Tablet`

The catalogue row for code 380 carries `form_raw: null` and only the brand string
"Clarithromycin Tablets IP 500 mg", which does not distinguish immediate-release from
extended-release. There is precedent for treating an ER concept as a separate reviewed presentation
(tramadol 24 HR ER, rxcui 833709), so this must be disambiguated rather than assumed.

### F3 — code 380 has no tender binding *(blocking for code 380)*
Tender **RC-222/2025** was downloaded from the official host
(`sha256 47670d2b…f53ff`, 2,321,513 bytes) and text-extracted. It contains **no 500 mg clarithromycin
line and no drug code 380 anywhere**. Only the 250 mg product is tendered there.

### F5 — PMBJP codes in the catalogue do not match the official product list *(blocking for all PMBJP mappings)*

Discovered on 2026-07-27 while executing A2.

Comparing every drug code shared between the catalogue snapshot (`dist/latest/drugs.jsonl`,
janaushadhi rows) and the official PMBJP product list PDF:

| | count |
|---|---|
| codes that agree | 568 |
| codes that **disagree** | 898 |
| **agreement rate** | **38.7%** |

The mismatch has a shifting-offset signature — catalogue code 51 carries the product the official
list assigns to 48, catalogue 53 carries official 51, catalogue 55 carries official 52 — consistent
with either a row-alignment defect in the janaushadhi PDF parser or a different list edition with
reassigned codes. The catalogue build provenance does not record which edition or URL it came from,
so the two cannot be reconciled from the repository alone.

**For the codes under audit:** official list says **739** = clarithromycin 250 mg and **740** =
Cefpodoxime Proxetil Dispersible Tablets 50 mg; catalogue says 740 = clarithromycin 250 mg. Official
says **383** = clarithromycin 500 mg; catalogue says 380, and code 380 is absent from the official
list entirely.

**For the 17 already-approved mapping codes:** 4 agree (1502 amiodarone 100 mg, 202 metronidazole
400 mg, 18 azithromycin 250 mg, 28 tramadol 50 mg), **7 disagree** — 430 → official *Nebivolol 5 mg*,
2142 → *Verapamil 40 mg*, 400 → *Cefixime + Clavulanate*, 2034 → *Potassium/Magnesium Citrate*,
521 → *Alfacalcidol*, 2772 → *Vincristine Injection*, 1246 unresolved — and 6 codes are absent from
the official list (2141, 452, 2771, 2773, 201, 72).

**Runtime risk: LOW. Evidence-chain risk: HIGH.** This distinction matters and I want to be precise
about it. Mapping resolution keys on `product_id` — a content hash of the catalogue product row — and
revalidates `product_assertion_sha256`, returning `status: 'stale'` on drift
(`src/lib/interaction-mapping.mjs`). The PMBJP code is *descriptive metadata* in `mapping_id` and in
the tender evidence identifier, **not** the resolution key. So a wrong code does **not** cause a
runtime mis-resolution onto a different drug — the fail-closed content binding holds. What *is*
compromised is the **evidence chain**: the review evidence cites
`pmbjp-tender:RC-<n>/<year>:<code>:page-<n>`, so a wrong code means a clinician approved against a
citation pointing at the wrong tender row.

**Required action:** record no further PMBJP product-presentation mapping until the code-identity
question is resolved — establish which official list edition the catalogue snapshot was built from,
record that provenance, and re-verify the already-approved codes' tender citations against it.

### F4 — an unlisted third clarithromycin row exists *(mandatory exclusion)*
PMBJP code **2097**: *"Combipack of Clarithromycin 500mg Tablets IP, Esomeprazole 40mg Tablets IP
(Gastro resistant) and Tablets in Mono Amoxycillin 750mg Tablets IP Carton"* — an H. pylori
eradication combipack. Its ingredient identity resolves to the **separate** canonical ingredient
`combipack of clarithromycin`, not `clarithromycin`. It must be explicitly excluded and must never
inherit a clarithromycin mapping.

---

## 5. Live evidence reverification (2026-07-27)

**Section A provenance verifier** — `node src/cli/verify-interaction-evidence-provenance.mjs --sections=A`
→ **pass**: 39 records verified (37 openFDA + 2 gov.uk), 23 unique openFDA set IDs.

**openFDA clarithromycin label** `b98b02bb-2609-49a0-b29f-e5911aa0cbc1` — HTTP 200

| Check | Result |
|---|---|
| Live SPL version vs draft | `23` = `23` ✔ |
| Effective time vs draft | `20230530` = `20230530` ✔ |
| Fragment hash recomputed | `81311cfe…8ed2` stable ✔ |
| Fragment present verbatim in live label | ✔ |

Verbatim fragment:

> "Spontaneous reports in the postmarketing period suggest that concomitant administration of
> clarithromycin and oral anticoagulants may potentiate the effects of the oral anticoagulants."

*Envelope note (reported honestly):* the whole-response payload hash differs from the stored one
(`8d044da5…` live vs `5268af02…` stored). This is openFDA **envelope** drift — the API response wraps
results in mutable `meta` including `last_updated`. Every content-bearing identifier matches: set_id,
version 23, effective_time, and the verbatim fragment. This is not label content drift.

**RxNorm identity** — API version `06-Jul-2026`; exact single candidate `rxcui 21212`,
name `clarithromycin`, `tty IN`; **UNII `H1250JIK0A`**. Response hashes are bound in the JSON packet.

**RxNorm presentation** — 6 SCD concepts, 4 oral tablet. 250 mg → exactly one concept
(`clarithromycin 250 MG Oral Tablet`). 500 mg → two concepts (see F2). 2 non-tablet forms present.

**PMBI tender RC-222/2025** — code **740 bound**: page **64**, serial **122**, drug code **740**,
item text *"Clarithromycin Tablets IP 250 mg"*, composition *"Clarithromycin IP 250mg"*, pack
*"10's X 10"*, with a secondary annexure on page 98. The serial/drug-code column aligns 1:1 with the
18 item names on that page. Presentation is taken **from the tender document**, never inferred from
the catalogue brand string.

---

## 6. What would be proposed, if approved

`warfarin__clarithromycin_oral` — **major / confirm_and_monitor**, `pk_perpetrator`, US evidence.

**3 exact product pairs** (code 740 × the three already-reviewed warfarin oral tablets):

| Clarithromycin | Warfarin |
|---|---|
| 740 (250 mg, 10's) | 2141 |
| 740 (250 mg, 10's) | 2142 |
| 740 (250 mg, 10's) | 452 |

Candidate identifiers, computed read-only:

- ingredient `sha256:5bf88d10…0710` → RxNorm 21212 / UNII H1250JIK0A
- product `sha256:7a9b5161…f29f4`, assertion `153530a9…fa52`, `internal-evaluation` profile only

Clinical workflow constraints carried unchanged: the prescriber or anticoagulation service directs
warfarin review and PT/INR monitoring; the pharmacy never changes a dose or stops either medicine
independently; bleeding-symptom counselling included; no invented PT/INR schedule; no invented
post-discontinuation interval; US evidence stays US evidence and is never presented as an Indian
regulatory-label claim.

---

## 7. Exclusions (adversarially enumerated)

- **erythromycin** — no evidence anywhere in the rule (F1)
- **azithromycin** — already governed by `warfarin__azithromycin_oral` (moderate)
- **code 2097** — H. pylori combipack, distinct ingredient identity (F4)
- **code 380** — blocked by F2 and F3
- **oral suspension** — non-tablet, unreviewed
- **injection** — parenteral, out of scope
- **24 HR extended-release 500 mg** — distinct presentation concept
- **every other clarithromycin product** — 345 catalogue products contain clarithromycin; a reviewed
  ingredient does not authorize every product containing it

---

## 8. Approval statements required from `clinician:subas`

- **A1.** Approve ingredient identity clarithromycin = RxNorm 21212 (`tty IN`), UNII `H1250JIK0A`, as an
  exact mapping that explicitly does **not** absorb `combipack of clarithromycin`.
- **A2.** Approve `presentation:pmbjp:740:oral-tablet` bound to product `sha256:7a9b5161…` and
  assertion `153530a9…`, on PMBI tender RC-222/2025 page 64 item 122 evidence, internal-evaluation only.
- **A3.** Decide the architecture (Sim B): create `warfarin__clarithromycin_oral` and remove
  clarithromycin from the class row — accepting that this changes the attested draft and requires
  reassembly, live re-verification, refreshed attestation, and a newly bound draft-row SHA-256.
- **A4.** Decide the fate of the residual macrolide class row, which after A3 asserts a major
  erythromycin interaction with zero evidence (F1).
- **A5.** Approve `warfarin__clarithromycin_oral` as major / confirm_and_monitor for internal
  evaluation only, limited to the 3 exact reviewed pairs.
- **A6.** Confirm code 380 stays excluded pending official tender evidence and IR/ER disambiguation.

**Explicitly not authorized by this packet:** any mapping, any promotion or compiled runtime rule,
any change to the attested draft, any promotion of the class row, any production-open content.
