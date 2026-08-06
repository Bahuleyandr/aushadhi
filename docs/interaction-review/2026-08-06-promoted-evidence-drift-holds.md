# Promoted interaction evidence drift — technical hold record

**Checked:** 2026-08-06
**Profile:** `internal-evaluation` only
**Disposition:** two promotions held; six remain active
**Production authority:** none; production-open remains empty

## Outcome

A live provenance recheck found that two of the eight clinician-approved
promotions no longer matched the exact source payload that was approved. The
approved clinical fragments were still present in the newly observed material,
but fragment survival does not make a changed payload self-authorizing. The two
rules are therefore omitted from the compiled internal-evaluation runtime pack:

| rule | approved source | newly observed source | disposition |
|---|---|---|---|
| `warfarin__azithromycin_oral` | openFDA SPL version 48, effective 2026-01-07, payload `c2685e743c2b1fca5c3862fb87a4a452c366876d280ef0f18e31eae9a4e109f1` | SPL version 49, effective 2026-07-24, payload `4cdab603d1ce790a38fee1969df01bca4338b283109b4d742a131d532d34204c` | held |
| `warfarin__tramadol` | GOV.UK Content API document version `2024-06-20T11:11:09+01:00`, payload `2f7e923cbd5447e3df760ac9f5c7b55d064f3adb5bf681fe3d1fd24643331f22` | same document-version identifier, payload `b9d638afd2b21893f9222da1767b87e509e88de414aa6fac27e01b1ea5ec2f9f` | held |

This is a technical fail-closed action, not a new clinical decision and not a
claim that either interaction ceased to exist. It does not alter the original
approval event, promotion record, jurisdiction, severity, mechanism, or
management text.

## Binding and compiler behavior

The required source hold manifest is
`data-static/interaction-promotion-holds.internal-evaluation.json`. It binds:

- draft pack SHA-256
  `eaacb97372717cc4dd3f2aba6c10e5cd3c7d394c0e24f0b0feaa4d5895b3b756`;
- evidence digest SHA-256
  `8bda060f96f1fcddccb897233316c3a96d17864a33c7b2f396c362e3b4f47fdb`;
- source-policy SHA-256
  `c1ede6a424db18be166a1aef775c3d6163d4d539a5c19546cbcbd615d0faa6c4`;
- canonical complete runtime-hold scope SHA-256
  `256faf2ae557d528b5c94765e4fe8e5f1af731e430b1120a610701f6488b52db`;
- each held rule and exact evidence source;
- the approved source version and payload hash; and
- the newly observed source version and payload hash.

Compilation fails if the hold manifest is absent, malformed, not
deterministically ordered, identifies a non-promoted rule, fails to select
exactly one draft evidence record, or no longer matches the bound draft pack,
evidence digest, source policy, approved version, or approved payload. All eight
promotions still pass their ordinary integrity, clinical-approval, mapping, and
scope gates before the two held rules are removed from output. This prevents a
hold from concealing an otherwise broken promotion.

The compiler also emits the separately bound, nonclinical artifact
`data-static/interaction-promotion-holds.runtime.internal-evaluation.json`.
It contains only exact ingredient and product pairs plus technical provenance;
it contains no severity, mechanism, management, evidence excerpt, or clinical
recommendation. Its `holds_sha256` binds the complete canonical hold array, and
must equal the independently pinned scope digest in the source manifest. Opaque
code-pinned leaf hashes bind every exact ingredient/product-pair scope without
embedding the restricted product identifiers in the production-open package.
They reject scope mutation and reject any active rule whose scope overlaps a
historical hold, regardless of its rule ID. The internal-evaluation CLI requires
this artifact and verifies its hold-array hash, active-rule-pack hash, and
source-hold-manifest hash. An exact held
product pair returns `clinical_interaction_status: not_evaluated`,
`outcome_code: manual_review_required`, and the machine code
`PROMOTION_HELD_LIVE_PROVENANCE_DRIFT`. It never becomes a blank result or a
reviewed clinical finding. If the same check also contains an independently
reviewed active finding, the aggregate result is
`reviewed_interaction_found_with_unevaluated_scope` with
`reviewed_action_and_manual_review_required`; the reviewed finding and the held
scope remain separately visible.

The public payloads observed on 2026-08-06 are retained under
`docs/interaction-review/evidence-drift/2026-08-06/`. The capture manifest pins
the byte hash of each retained file, the canonical payload hashes above, the
openFDA SPL identity, and an independent DailyMed identity check. The capture
has promotion and deployment authority `none`; its regression test establishes
offline reproducibility, not clinical acceptance of the changed sources.

The resulting internal-evaluation pack contains these six rules:

1. `warfarin__amiodarone`
2. `warfarin__clarithromycin_oral`
3. `warfarin__fluconazole`
4. `warfarin__ketoconazole_oral`
5. `warfarin__metronidazole`
6. `warfarin__voriconazole`

`data-static/interaction-rules.json` remains the empty production-open pack.

## Conditions for clearing a hold

A hold cannot be cleared merely because the previously approved fragment still
appears in a newer payload. Clearing either hold requires all of the following:

1. verify the retained real updated source payload under the applicable source
   policy, or capture a newer payload if the source has changed again;
2. reconcile its exact fragment paths, normalized proposition, version,
   effective date, jurisdiction, and canonical payload hash;
3. assess every material change around the retained fragment and record whether
   clinical scope, mechanism, management, or limitations changed;
4. regenerate and attest the affected draft row and evidence digest;
5. obtain a new authenticated clinician approval bound to the reconciled source
   version and payload; and
6. implement an authenticated clearance event bound to the reconciled source
   and approval, deliberately revise the code-pinned required hold, update the
   promotion manifest, regenerate both internal-evaluation artifacts, and pass
   the complete promotion and regression gates.

There is intentionally no generic hold-clearance schema today. Deleting a hold
from JSON, renaming a held rule, or renaming the internal pack cannot reactivate
either historical promotion. Until the full
clearance path exists and is approved, exact held pairs must remain explicitly
`not_evaluated` and must never be represented as safe or `no_interaction`.

## Addendum — source-policy re-bind (licensing annotation)

`data-static/interaction-sources.json` was later annotated with
licensing metadata (pharmeasy/netmeds/apollo/nppa entries and
janaushadhi/cdsco notes; see `docs/LICENSING_REPORT.md`). The hold
manifest's `source_policy_sha256` was re-bound to the annotated
manifest (`8a4fc02e2110deaded7f74f6f2c21090258e327717549083d29a22a6f559210b`)
and `interaction-promotion-holds.runtime.internal-evaluation.json` was
regenerated; only its `promotion_hold_manifest_sha256` changed. No hold
was added, removed, or cleared, and the draft-pack, evidence-digest,
runtime-hold-scope and rule-pack digests recorded above are unchanged.
