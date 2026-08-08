# Class-rule compile expansion (Option B) — design note

**Status:** Owner-approved direction (Bahuleyan, 2026-08-07: Option B over
pre-instantiating exact draft rows), implemented 2026-08-07
**Branch:** `claude/hearth-thread-0841s6`
**Authority:** none — this change adds compiler capability only. Nothing is
promoted, approved, or signed by it; the batch-1 statin rules remain
`draft_for_review` with `runtime_enabled: false`.

## Problem

`bindScope` in `src/lib/interaction-promotion.mjs` accepts only draft rules
whose `object` and `perpetrator` are exact drug selectors with route and
formulation arrays exactly equal to the signed scope's
`[scope.route]` / `[scope.formulation]`. Of the 199 attested draft rows in
`docs/interaction-review/batch-01-v2/batch-01-v2.jsonl`, exactly 8 satisfy
that — the already-promoted warfarin rules. None of the five owner-approved
batch-1 statin rules compiles: two carry class perpetrators (one also a class
object), and even the exact pairs lack pinned formulation arrays
(scratchpad BATCH-1-RUNBOOK.md Phase B0).

Option A would have extended the draft pack with owner-authored exact rows
(new pack SHA, attestation regeneration, holds-manifest digest re-bind).
The owner chose **Option B: the compiler expands class-level draft rules at
compile time into exact member instantiations**, keeping the attested pack
untouched.

## Design

### What expansion is

A new module, `src/lib/interaction-rule-expansion.mjs`, turns one draft rule
into its set of exact instantiation candidates:

- each **(object member × perpetrator member)** pair becomes one candidate
  with a deterministic id
  `<parent_rule_id>::<object_slug>__<perpetrator_slug>`
  (e.g. `simvastatin__verapamil_diltiazem::simvastatin__verapamil`);
- an exact drug selector is the singleton case of the same machinery, so
  exact rows that only lack formulation pinning (e.g.
  `simvastatin__amiodarone`) go through the identical gate;
- a candidate that survives every gate below can be **promoted individually**:
  the promotion manifest entry names the expanded rule id, carries an
  `expansion` block (`parent_rule_id`, `object_member`,
  `perpetrator_member`), and binds `draft_rule_sha256` to the **parent**
  rule's canonical JSONL line in the attested pack;
- at compile time the compiler re-runs the full expansion validation and
  instantiates an exact-selector rule pinned to the signed scope's route and
  formulation, which then flows through the **unchanged** exact-rule binding
  (`bindScope`), mappings, product-pair derivation, and pack validation.
  Runtime artifacts stay per-pair explicit; the runtime checker is not
  modified in any way.

### Fail-closed gates (each refusal names the member and reason)

1. **Digest-pinned member sets only.** Rosters resolve exclusively against
   `data-static/interaction-member-sets.json`, whose SHA-256 the draft-pack
   attestation pins (`member_sets_sha256`); the compiler and the dry-run CLI
   both assert the attestation before expanding. Refused:
   - class not in the pinned sets (`unknown_member_set`);
   - strength that does not pin exactly one existing bucket
     (`ambiguous_member_set_strength` / `unknown_member_set`). A strength
     qualifier recorded as an absent field, `null`, or a deliberately-empty
     array `[]` all record the same fact — "no strength qualifier" — as
     everywhere else the draft schema is read (draft validation accepts all
     three shapes; the runtime engine, coverage collector, and mapping
     backlog all normalize `[]` to every pinned bucket; the attested pack
     records both `[]` and `null`). Expansion reads the three shapes
     identically but stays stricter than those readers: no qualifier binds
     only when the pinned class defines exactly one bucket, refusing
     otherwise; any other shape (non-array, blank/non-string entries,
     multiple entries) refuses as malformed rather than being conflated
     with the deliberately-empty case.

     **Full-pack blast radius of this normalization** (verified by full
     199-rule dry runs on base `32726b8` and the fix, diffing the complete
     expansion/refusal sets): **20 rules change behaviorally**, not just
     the three the fix was scoped to. Totals move **166 → 185 expansions**
     and **1589 → 1736 refusals**; every removed refusal is exactly an
     `ambiguous_member_set_strength` entry (22 removed), and every added
     refusal is a substantive downstream gate firing on its own merits.
     The **19 new expansion candidates** span 10 rules:
     `warfarin__fluoroquinolone` (warfarin×ciprofloxacin),
     `warfarin__ssri_snri` (warfarin×sertraline),
     `dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor` (dabigatran ×
     amiodarone/clarithromycin/quinidine/verapamil),
     `dabigatran_nvaf__dronedarone_or_ketoconazole` (dabigatran ×
     dronedarone/ketoconazole), `clopidogrel__cyp2c19_inhibiting_ppi`
     (clopidogrel × omeprazole/esomeprazole),
     `heparin_lmwh__nsaid_or_antiplatelet_bleeding` (enoxaparin×ketorolac),
     `potassium_chloride_solid_oral__gi_transit_slowing` (potassium
     chloride × atropine/oxybutynin), `sulfonylurea__fluconazole`
     (glipizide/glyburide/tolbutamide × fluconazole),
     `sulfonylurea__gemfibrozil` (glyburide×gemfibrozil), and
     `thiopurine__allopurinol` (azathioprine/mercaptopurine ×
     allopurinol). Each new member was re-verified as verbatim-named by its
     rule's cited evidence under the word-boundary naming gate, and every
     candidate remains owner-gated: reviewed mappings plus a signed
     `approved_rule_id` approval are still required before promotion. Ten
     further rules progress past the strength gate into new refusals only
     (e.g. `warfarin__nsaid_systemic`, `dextromethorphan__ssri_snri`,
     `sulfonylurea__miconazole_candidate` — the last now correctly refusing
     `empty_roster_after_exceptions`); one more rule
     (`simvastatin_lovastatin__hiv_pi_cobicistat`, multi-bucket, still
     refused) changes only its refusal message wording. The exact totals
     and refusal-reason histogram are pinned by the full-pack expectation
     test in `test/interaction-promotion-expansion.test.mjs`, so any future
     normalization change surfaces its whole blast radius in CI;
   - a rule-embedded roster member absent from the pinned bucket
     (`member_not_in_pinned_member_set`) — this is a hard error, never a
     silent drop;
   - a pinned bucket member the rule roster neither lists nor excepts
     (`pinned_member_unaccounted`) — narrowing must be explicit;
   - a `member_exceptions` entry not in the pinned bucket
     (`member_exception_not_in_pinned_member_set`);
   - any identity that is not already canonical
     (`member_identity_not_canonical`) — expansion never renames a member on
     the pack's behalf.
2. **Evidence must name the member.** A member is instantiable only when at
   least one of the parent rule's evidence records names it **verbatim** —
   as a standalone word in an attested fragment's `text`, or in the record's
   `product` identity (the cited label's own subject). Curation annotations
   such as `supports.scope` are deliberately not consulted. Members not
   named refuse with `evidence_does_not_name_member` ("evidence does not
   name member"); the owner resolves those by adding evidence through the
   draft flow, not by the compiler assuming class coverage.

   The naming gate is deliberately **lexical**: it tests word-boundary
   presence of the member's name in attested text, not the semantics of the
   sentence around it. A member named in a negative context ("no interaction
   was observed with X") passes the gate exactly like one named in a warning.
   That is acceptable because the gate governs **dry-run candidate quality
   only** — it decides which member pairs may be *proposed* as expansion
   candidates, never which rules go live. Every candidate still requires its
   own signed clinician approval naming the expanded rule id, and that review
   reads the actual evidence; a lexically admitted but clinically wrong
   candidate dies at the approval step. The gate's job is to keep members the
   evidence never mentions out of the candidate list, and for that a strict
   word-boundary test is the right, deterministic tool.
3. **Reviewed route scope.** A side's reviewed routes come from its own
   `route` array, else from `applicability.routes`; a side with neither
   refuses (`missing_route_data`) — the compiler never invents an exposure
   scope. The signed promotion scope's single route must sit inside the
   reviewed scope; the abstract reviewed scopes `systemic` and `parenteral`
   narrow only to the concrete routes in the code-reviewed
   `ABSTRACT_ROUTE_COVERAGE` table (systemic ⊇ oral/iv/im/sc; parenteral ⊇
   iv/im/sc). Formulation: when the draft pins formulations, the signed
   formulation must be among them; when the draft is silent on formulation
   (all batch-1 rows), the signed scope's single formulation is a strict
   narrowing recorded in the approval — the compiled artifact only ever
   covers the exact reviewed product presentations.
4. **No structural surprises.** Self-pairs refuse; combination/substance
   selectors refuse (`unsupported_selector` — FDC expansion is explicitly
   future work); expanded ids must match the deterministic id; an expansion
   may not shadow an existing pack rule id; expansion entries may not carry
   supersession metadata or combination-bound sides.
5. **Drift holds still bind the parent.** The code-pinned required promotion
   holds (azithromycin/tramadol, 2026-08-06) are enforced against the
   expansion's **parent** rule id, and the compiler additionally
   hard-refuses any expansion promotion whose parent draft rule is held —
   whether the hold is code-pinned or attaches through the manifest, and
   independent of whether the held parent is also promoted exactly (where
   the hold attaches to the exact promotion and rule_id-keyed hold
   exclusion alone would not reach an expansion sibling's distinct id). A
   drift-held parent cannot be promoted through expansion at all until the
   owner resolves the hold.

### The known erythromycin inconsistency

`simvastatin_lovastatin__strong_cyp3a4_inhibitor` embeds erythromycin in its
perpetrator roster (lovastatin-label-only support), while the pinned
`cyp3a4_inhibitor.strong` set does not list it (it sits in `moderate`). Per
gate 1 this surfaces as a **hard validation error** in the batch-1 dry run
and fails any attempted compile of that member. The code does not resolve
it: the owner resolves it through the draft flow (member sets or rule
roster) or excludes the member.

### Determinism

Expansion order is fully deterministic (members sorted lexicographically,
expansions sorted by expanded id, refusals by side/member/reason); the
dry-run report contains no timestamps and byte-reproduces run over run. The
legacy exact-promotion path is byte-identical before and after this change
(regression-guarded against the committed compiled pack), and repeated
compiles of expansion manifests serialize identically, so the
`production-open-package-boundary` byte-match contract is unaffected.

## What stays owner-gated (unchanged authority model)

- **Every expanded rule needs its own signed approval.** The promotion
  manifest entry for an expanded rule id carries a full approval object;
  `approval.approved_rule_id` must exactly equal the expanded rule id, and
  the approval text must name that id as a complete identifier (both enforced),
  must satisfy the existing profile rules (production-open approvals need
  `authorized_profile: "production-open"` and profile-naming text per
  `d1127ae`), and `source_versions` must equal the parent rule's exact
  evidence versions.
- Reviewed ingredient and presentation mappings per member, per profile,
  authored and merged by the owner — expansion resolves members against
  them and fails closed when they are missing or unreviewed.
- Signatures are recorded only by the owner reviewing and merging the PR
  carrying the approval artifacts; chat approval is never a signature.
- Publication authority is untouched (`release_authority: none`).

## Surface added

- `src/lib/interaction-rule-expansion.mjs` — expansion + instantiation.
- `src/lib/interaction-promotion.mjs` — optional `expansion` block on
  schema_version-2 promotion entries; instantiation before the unchanged
  `bindScope`; parent-resolved hold binding; exported `parseDraftPack` for
  the CLI. `bindScope` and all compiled-output serialization unchanged.
- `src/cli/expand-interaction-draft-rules.mjs` +
  `npm run interactions:expand:dry-run` — attestation-verified, read-only,
  deterministic dry-run report (JSON to stdout; no authority).
- Tests: `test/interaction-rule-expansion.test.mjs` (unit),
  `test/interaction-promotion-expansion.test.mjs` (integration against the
  real attested pack, including the byte-identical legacy regression guard
  and the batch-1 dry-run expectations).

## Batch-1 dry run (2026-08-07, committed pack `eaacb97…`)

23 instantiation candidates, 19 refusals across the five owner-approved
batch-1 rules:

| Rule | Expands | Refusals |
|---|---|---|
| `simvastatin_lovastatin__strong_cyp3a4_inhibitor` | 18 (simvastatin/lovastatin × 9 named strong inhibitors) | **erythromycin: member-set divergence (hard error)**; 6 members evidence does not name (conivaptan, idelalisib, indinavir, nelfinavir, saquinavir, troleandomycin) |
| `atorvastatin__strong_cyp3a4_inhibitor` | 2 (clarithromycin, itraconazole — the only fragment-named members) | 10 members evidence does not name, **including atorvastatin × ketoconazole** |
| `simvastatin__gemfibrozil` | 0 | both sides `missing_route_data` (the draft row carries no route anywhere) — owner adds route data through the draft flow |
| `simvastatin__amiodarone` | 1 | — |
| `simvastatin__verapamil_diltiazem` | 2 (verapamil, diltiazem) | — |

Reproduce with:

```bash
npm run interactions:expand:dry-run -- \
  --rule-id=simvastatin_lovastatin__strong_cyp3a4_inhibitor \
  --rule-id=atorvastatin__strong_cyp3a4_inhibitor \
  --rule-id=simvastatin__gemfibrozil \
  --rule-id=simvastatin__amiodarone \
  --rule-id=simvastatin__verapamil_diltiazem
```

## Future work (owner decisions, out of scope here)

- FDC/combination-side expansion (`unsupported_selector` today).
- Whether class-statement evidence (e.g. the ZOCOR "strong CYP3A4
  inhibitors" contraindication) should ever admit fragment-unnamed members —
  today it never does; the six unnamed rule-1 members and ten unnamed
  rule-2 members stay refused until the pack cites member-naming evidence.
- Resolving the erythromycin member-set divergence and the route-less
  `simvastatin__gemfibrozil` row through the draft flow.
