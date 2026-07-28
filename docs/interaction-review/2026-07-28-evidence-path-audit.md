# Audit — openFDA and PMBJP evidence paths

**Date:** 2026-07-28 · **Scope:** do these two paths suffer the failure mode that was
found in the RxNorm verifier — *code written against self-authored fixtures, which
verifies nothing against real data while reporting success*?

**Answer: no. Both fail closed on shape mismatch, and both were proved non-vacuous
against live data.** One unrelated latent leniency was found in the PMBJP name
comparison and has been fixed.

---

## Method

A verifier passing is not evidence it works — that is the whole point of the failure
mode. So each path was tested three ways:

1. **Are the field names real?** Inventory what the committed evidence actually relies
   on, and compare against the live API.
2. **Does it pass against live data?** Run the real verifier over the network.
3. **Does it FAIL when it should?** Corrupt a real record and confirm each corruption
   is caught, with the right reason. This is the test the RxNorm verifier would have
   failed.

---

## openFDA / DailyMed — sound

### Field names are real

The 244 committed evidence records rely on these `source_path` shapes:

```text
229  drug_interactions[N]         12  clinical_pharmacology[N]     3  description[N]
 61  warnings_and_cautions[N]     12  pharmacokinetics[N]          2  clinical_studies[N]
 41  dosage_and_administration[N] 10  boxed_warning[N]             1  do_not_use[N]
 24  contraindications[N]          9  details.body   (GOV.UK)      1  contraindications_table[N]
 23  precautions[N]                6  information_for_patients[N]  1  general_precautions[N]
 20  warnings[N]                   4  adverse_reactions[N]         1  spl_unclassified_section[N]
                                   3  use_in_specific_populations[N]
```

Every one is a genuine openFDA drug-label section; `details.body` is the genuine GOV.UK
Content API field. Nothing invented.

### It passes live

```text
npm run verify:interaction-evidence -- --sections=A
  records_verified 39 · openfda 37 · govuk 2 · unique set IDs 23 · unique GOV.UK pages 2
```

### It fails when it should — the decisive test

One real record (`warfarin__nsaid_systemic`, set_id `c437507c-…`, fragment at
`precautions[0]`) corrupted five ways against the **live** network:

| corruption | outcome |
|---|---|
| unmodified control | **passed** |
| `source_path` → `invented_section_name[0]` | failed — *payload does not contain source_path* |
| fragment text replaced with a sentence not in the label | failed — *fragment is absent from payload source_path* |
| `payload_sha256` corrupted | failed — *openFDA payload SHA-256 does not match provenance* |
| `version` set to a stale value | failed — *document_version must equal provenance.version* |

**Why this path is structurally immune** to the RxNorm failure mode:
`payloadValueAtPath()` walks a real path into the payload and calls `evidenceFail()`
when any segment is absent, and `assertFragmentMatchesValue()` requires the fragment
text to be *present* in the retrieved value. My RxNorm SCD parser instead read a key
that did not exist, got `undefined`, and compared an empty set to an empty set. These
two throw where that one shrugged.

The unit-test fixtures for this path **are** self-authored — but because production
code fails closed on a shape mismatch, a divergence surfaces as an error rather than a
false pass. That is the difference that matters, and the live corruption probe confirms
it end to end.

## PMBJP — sound, with one leniency found and fixed

### It fails when it should

The official list was corrupted so that codes denote the wrong products, then the real
CLI was run against it:

```text
hard    code 740 clarithromycin  <->  code 18 azithromycin      (different molecule)
subtle  code 2141 warfarin 1mg   <->  code 2142 warfarin 2mg    (same molecule, different strength)
```

```text
checked 18 · confirmed 14 · unconfirmed 4
  2141  code_denotes_a_different_product   mapped Warfarin 1mg      list Warfarin 2mg
  2142  code_denotes_a_different_product   mapped Warfarin 2mg      list Warfarin 1mg
    18  code_denotes_a_different_product   mapped Azithromycin 250  list Clarithromycin 250
   740  code_denotes_a_different_product   mapped Clarithromycin 250 list Azithromycin 250
```

All four caught, including the **subtle** one. A comparison matching molecules only
would have sailed through that pair, so the strength comparison is real. Extraction is
pinned to `-table` with an in-document completeness assertion, so the F5 class of defect
is also closed.

### Finding — name agreement could be satisfied by the molecule alone

`signaturesAgree()` compared the leading molecule token and every numeric strength, but
**short-circuited to `true` whenever *either* side carried no parseable strength**:

```js
if (a.strengths.length === 0 || b.strengths.length === 0) return true;   // was
```

So a mapping named without a strength would confirm against any row sharing its first
token — including a different dosage form. Characterised directly:

```text
"Warfarin Tablets IP"       vs  "Warfarin Sodium Injection 5mg"   ->  AGREED   (wrong)
"Warfarin Tablets IP 1mg"   vs  "Warfarin Injection"              ->  AGREED   (wrong)
"Warfarin Tablets IP 1mg"   vs  "Warfarin Tablets IP 2mg"         ->  differs  (right)
"Clarithromycin … 250 mg"   vs  "Azithromycin … 250 mg"           ->  differs  (right)
```

That is presentation inferred from a name, which the standing prohibitions forbid.

**Severity: latent, not live.** All 18 committed mappings carry a parseable strength on
both sides (verified against the official list), so the branch was never load-bearing.
Tightening was measured before applying: **18/18 still confirm.**

**Fixed** — the branch now returns `false`, `namesAgree` is exported, and six assertions
pin the behaviour in `test/pmbjp-code-identity.test.mjs`.

### Related, flagged not changed

`namesAgree` also short-circuits on `source.startsWith(mapped)`, so a source row that
begins with the whole mapped name but continues with other text still confirms. That
existed to absorb `-layout` trailing junk; with `-table` pinned and completeness
asserted, the justification has weakened. Dropping it also keeps 18/18, so it can be
removed — but it is a separate behavioural change and was left alone here.

---

## Gates

```text
npm test                             823 tests / 818 passed / 5 skipped / 0 FAILED (exit 0)
npm run interactions:promote:check   exit 0
verify:pmbjp-mapping-codes           18/18 confirmed against the real list
verify:interaction-evidence -A       39 records verified live
git diff --check                     clean
```

At this audit's code head, production-open had 0 rules, the combination manifest was
empty, and `warfarin__cotrimoxazole` was blocked. The later identity activation is
recorded in
[`2026-07-28-combination-identity-activation-attestation.md`](./2026-07-28-combination-identity-activation-attestation.md).

## What this audit does not cover

- Sections B–J were re-verified live separately; section A alone establishes the
  mechanism, and the corruption probe is what establishes non-vacuity.
- The GOV.UK path (5 records) was exercised live but not corruption-probed
  individually; it shares `assertEvidenceMatchesPayload`, which is the code the openFDA
  probe exercised.
- This audit asked one question. It is not a general review of either path.

---

## Unplanned finding — corrected: 9 payload hashes drifted, 9/9 fragments remain intact

Running sections B–J live (to widen the sample) surfaced something the audit was not
looking for. **This is the fail-closed machinery working, not failing** — but it is a
real defect in the committed draft evidence and should not sit unrecorded.

```text
npm run verify:interaction-evidence -- --sections=BCDEFGHIJ
  9 of 205 interaction evidence records failed live provenance verification
  all 9: "openFDA payload SHA-256 does not match provenance"
```

**All nine have an unchanged `version` and `effective_time`.** So the SPL was not
revised; the openFDA *record* changed in some other field. The payload hash binds the
whole record, so it is sensitive to changes with no bearing on the clinical claim.

I then checked the question that actually matters — are the **quoted fragments** still
present verbatim in the current label?

| | |
|---|---|
| records failing the hash | 9 |
| of those, every quoted fragment still present | **9** — drift is in fields irrelevant to the claim |
| of those, a quoted fragment genuinely **gone** | **0** |

### Correction — the AUVELITY finding selected the wrong shared-prefix occurrence

`C/dextromethorphan__ssri_snri`, evidence `fda-label-auvelity-serotonergic-current`,
`warnings_and_cautions[0]`, still at version 15 / effective_time 20260601:

```text
first occurrence   "AUVELITY contains dextromethorphan. Dextromethorphan overdose
                    can cause toxic psychosis, stupor, coma, and hyperexcitability …"

second occurrence  "AUVELITY contains dextromethorphan. Concomitant use of AUVELITY
                    with SSRIs or tricyclic antidepressants may cause serotonin
                    syndrome, a potentially life-threatening condition …"
```

There is one matching openFDA result and one `warnings_and_cautions[0]` source field,
but that field contains the prefix `AUVELITY contains dextromethorphan.` **twice**.
The original audit stopped at the first occurrence and compared its neuropsychiatric
continuation with the retained serotonin-syndrome fragment. The second occurrence is
the retained SSRI/TCA sentence. Reproducing the repository verifier's normalisation
and full-fragment search confirms both stored AUVELITY fragments remain present. This
was an occurrence-selection bug in the audit, not missing evidence or a label-content
change.

### Scope and impact

**No runtime or promotion impact.** All of sections B–J are draft-only: every rule is
`runtime_enabled: false` and `promotion_eligible: false`, and none is among the 8
promoted internal-evaluation rules. Those 8 are all Section A, which verified **39/39
clean** against live sources.

### Corrective action

- **Refresh provenance only.** Re-pin the nine current full-payload hashes and their
  access/currentness/retrieval dates, then regenerate the aggregate and attestation
  through the supported live-verifying assembler. Do not change any quote, fragment
  hash, proposition, clinical scope, severity, management, runtime flag, or promotion
  manifest.
- **Consider narrowing `payload_sha256`.** Hashing the entire openFDA record makes
  routine, clinically irrelevant edits trigger the same fail-closed signal as a claim
  change. Binding the hash to the cited sections would distinguish those cases. That
  is a schema change affecting every existing record, so it is an owner decision.
- **Run `verify:interaction-evidence` on a schedule.** This drift was invisible until
  the sections were re-run; nothing would have surfaced it otherwise.
