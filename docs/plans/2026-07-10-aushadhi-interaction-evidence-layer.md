# Aushadhi open interaction evidence layer implementation plan

**Status:** Approved direction, implementation starting 2026-07-10  
**Repository:** `D:\Dev\Projects\aushadhi`  
**Branch:** `feat/interaction-evidence`

## Goal

Build a deterministic, source-grounded, open-source drug-interaction engine for
Indian medicines. Aushadhi resolves an exact Indian product, expands every
active ingredient, maps each ingredient to reviewed identifiers, generates all
unique cross-drug ingredient pairs, and returns reviewed findings, evidence
candidates, unresolved mappings, and explicit coverage limitations.

The open release is an **interaction evidence checker**, not a claim of complete
clinical DDI coverage. Organisations that need broader coverage can add a
licensed provider through the same provider interface without contaminating the
open data pack.

## Current architecture and constraints

- Node.js 22 ESM with `node:test`; imports and automated tests must not perform
  network requests.
- `dist/latest/drugs.jsonl` is a large JSONL product artifact and must be read as
  a stream. The complete product collection must not be loaded into memory.
- Product ingredients are currently normalised through `normMolecule`, which is
  useful for catalogue deduplication but strips some salts. The clinical identity
  layer must therefore preserve the exact observed ingredient independently and
  must not use lossy catalogue normalisation as a clinical identifier.
- The current artifact contains `onemg-live` provenance and is private/internal.
  It may be evaluated locally but must not enter an open or redistributable data
  pack.
- A crawler may be writing `data/raw/`. Interaction work must not mutate crawler
  data, run mass fetching, or affect the crawler process, systemd, cron, or ports.

## Non-negotiable clinical contract

1. Missing interaction data means `coverage: unknown`; it never means safe.
2. Resolve products, then check ingredients. Never check brand strings directly.
3. Expand every fixed-dose combination and check every unique cross-drug pair.
4. Preserve exact salt, ester, hydrate, strength, route, and form assertions.
5. Every evidence item records source, URL or identifier, document version,
   retrieval date, jurisdiction, excerpt, licence, and review status.
6. Extracted evidence is a `review_candidate` until a human clinician approves it.
7. Only a human clinician can create a clinician-reviewed rule.
8. Severity other than `unknown`, mechanism summaries, and management text are
   displayed only from clinician-reviewed rules.
9. An LLM must never generate an interaction claim, severity, mechanism, or
   management recommendation.
10. Ambiguous products, ambiguous mappings, unmapped ingredients, stale evidence,
    and operational errors are returned explicitly.
11. No patient-facing UI is part of this plan. Start with libraries and a
    read-only CLI.

## Licence and distribution profiles

Source permissions are data, not comments. `data-static/interaction-sources.json`
is the machine-readable authority used by every builder and release command.

### `production-open`

May contain only sources with a verified licence permitting the intended use and
redistribution. Unknown, restricted, non-commercial, private, user-supplied
licensed, and licence-incompatible sources fail closed.

Initial eligible evidence/identity sources include:

- HL7 PDDI-CDS structures and examples (CC0-1.0).
- openFDA content explicitly covered by its CC0/public-domain terms.
- FDA-authored CYP/transporter material (US government public domain).
- WHO INN names as public non-proprietary names.
- RxNorm vocabulary/API identity results under NLM terms and attribution.
- FDA GSRS/UNII public substance identity data.

Conditional data stays in separate packs:

- DrugCentral-derived enrichment is CC BY-SA 4.0 and must remain a separately
  attributed/share-alike pack.
- CDCI/SNOMED CT is loaded only from user-supplied licensed files and is never
  bundled in the open artifact.

### `internal-evaluation`

May use explicitly approved restricted sources inside `data/restricted/`, but
outputs are non-commercial, non-redistributable, and physically separated.
`DDInter 2.0` remains disabled until its official endpoint has valid TLS, the
current licence is verified, and an exact snapshot SHA-256 is recorded. The
current 1mg-enriched Aushadhi artifact is also internal-only.

Unknown licences fail in every profile. Manual checker websites are reference
surfaces only and are never ingestion sources.

## Data boundaries

Committed:

- `data-static/interaction-sources.json` — source policy and licence facts.
- `data-static/interaction-rules.schema.json` — open rule schema.
- `data-static/interaction-rules.json` — versioned clinician-reviewed open rules;
  initially empty.
- `data-static/ingredient-mapping-overrides.json` — human-reviewed mappings;
  initially empty.

Generated and gitignored:

- `data/interaction/<profile>/ingredient-index.jsonl`
- `data/interaction/<profile>/ingredient-index.meta.json`
- `data/interaction/<profile>/rxnorm-mappings.jsonl`
- `data/interaction/<profile>/evidence-candidates.jsonl`
- `data/interaction/<profile>/checks/*.json`

Restricted and gitignored:

- `data/restricted/ddinter/`
- `data/restricted/onemg-derived/`

No generated or restricted data is committed.

## Identity model

Aushadhi owns immutable local identifiers. External identifiers are versioned
mappings and are never primary keys.

An ingredient-index row has this minimum shape:

```json
{
  "ingredient_id": "sha256:<digest>",
  "canonical_name": "amoxicillin",
  "observed_names": ["amoxicillin", "amoxycillin"],
  "precise_substances": ["amoxicillin trihydrate"],
  "product_count": 123,
  "single_ingredient_product_count": 100,
  "combination_product_count": 23,
  "source_assertions": ["github-jr"]
}
```

`canonical_name` is a deterministic search/display key, not a declaration that
all observed salts or forms are clinically identical. Precise-substance and
active-moiety relationships require reviewed mappings.

## Interaction rule model

Every pair is stored in a deterministic, order-independent key. A reviewed rule
contains:

```json
{
  "rule_id": "ddi:<ingredient-a-id>:<ingredient-b-id>",
  "pair": ["<ingredient-a-id>", "<ingredient-b-id>"],
  "applicability": {
    "routes": [],
    "dose_conditions": [],
    "population_conditions": []
  },
  "severity": "unknown",
  "mechanism": null,
  "management": null,
  "evidence": [],
  "review": {
    "status": "clinician_reviewed",
    "reviewer_id": "",
    "reviewed_at": "",
    "source_versions": []
  }
}
```

The rule schema rejects non-`unknown` severity or non-null mechanism/management
when clinician review metadata is absent.

## Runtime result contract

```json
{
  "resolved_inputs": [],
  "reviewed_findings": [],
  "review_candidates": [],
  "unresolved_inputs": [],
  "coverage": {
    "product_resolution": "complete|partial|unknown",
    "ingredient_mapping": "complete|partial|unknown",
    "interaction_knowledge": "complete|partial|unknown",
    "overall": "complete|partial|unknown"
  },
  "disclaimer": "No listed interaction does not establish safety. Verify with a pharmacist or clinician and current approved labeling."
}
```

`interaction_knowledge: complete` means only that every generated pair was
checked against the declared rule-pack version. It does not claim universal
clinical completeness and does not alter the disclaimer.

---

## Phase 1 — Open deterministic foundation

### Task 1: Source and licence policy

**Files**

- Create `data-static/interaction-sources.json`
- Create `src/lib/interaction-source-policy.mjs`
- Create `test/interaction-source-policy.test.mjs`

**TDD steps**

1. Add failing tests for unknown profile, unknown source, unknown licence,
   restricted/non-commercial sources in `production-open`, restricted sources
   outside their storage zone, and mixed-provenance artifacts.
2. Add passing cases for verified open sources and explicitly allowed internal
   sources.
3. Implement strict manifest validation. No policy defaults to allow.
4. Export `loadSourceManifest`, `assertSourceAllowed`, `assertSourcesAllowed`,
   and `assertArtifactProvenance`.
5. Confirm `ddinter-2`, `onemg-live`, manual checkers, and unknown sources cannot
   enter a production-open artifact.
6. Run focused tests and commit `feat(interactions): add fail-closed source policy`.

### Task 2: Lossless streaming ingredient index

**Files**

- Create `src/lib/ingredient-identity.mjs`
- Create `src/lib/ingredient-index.mjs`
- Create `test/ingredient-index.test.mjs`

**TDD steps**

1. Add failing tests for preservation of exact observed names, deterministic
   canonical keys, order-independent output, FDC expansion, duplicate ingredients
   within a product, and source provenance aggregation.
2. Add a strict JSONL test showing malformed input fails with a line number.
3. Implement a streaming reader over `dist/latest/drugs.jsonl`. Retain only the
   unique-ingredient aggregation map; never collect all product rows.
4. Generate stable local ingredient IDs from a versioned identity namespace and
   canonical key.
5. Write JSONL in deterministic code-point order through a temporary file, then
   replace the target.
6. Emit metadata containing schema version, profile, source artifact path, source
   counts, row counts, ingredient count, and warnings. Keep timestamps out of the
   deterministic JSONL payload.
7. Run focused tests and commit `feat(interactions): add streaming ingredient index`.

### Task 3: Reviewed rule pack and checker kernel

**Files**

- Create `data-static/interaction-rules.schema.json`
- Create `data-static/interaction-rules.json`
- Create `src/lib/interaction-checker.mjs`
- Create `test/interaction-checker.test.mjs`

**TDD steps**

1. Add failing tests for deterministic pair keys, every unique cross-drug FDC
   pair, same-ingredient therapeutic duplication, and no intra-product pairs.
2. Add tests proving unreviewed evidence never appears in reviewed findings.
3. Add tests proving severity/mechanism/management are hidden unless the rule is
   clinician-reviewed.
4. Add tests for ambiguous/unmapped inputs and the coverage lattice:
   `unknown` dominates `partial`, which dominates `complete`.
5. Implement pure functions with no filesystem or network side effects:
   `pairKey`, `generateCrossDrugPairs`, `validateRulePack`, and
   `checkResolvedProducts`.
6. Keep the committed rule pack empty; do not invent clinical rules.
7. Run focused tests and commit `feat(interactions): add reviewed checker kernel`.

### Task 4: Exact resolver and read-only CLI

**Files**

- Create `src/lib/product-resolver.mjs`
- Create `src/cli/interactions.mjs`
- Create `test/product-resolver.test.mjs`
- Create `test/interactions-cli.test.mjs`
- Modify `package.json`

**TDD steps**

1. Resolve by exact normalised brand plus optional manufacturer, strength/form,
   and pack assertions. Brand-only collisions return `ambiguous` candidates.
2. Never auto-select a fuzzy match. Optional fuzzy search may return candidates
   only.
3. Stream the product artifact and retain only matching candidates.
4. Accept repeatable `--drug` inputs and optional disambiguators; write one JSON
   result to stdout and diagnostics to stderr.
5. Require an explicit `--profile`; the current private artifact is allowed only
   with `internal-evaluation`.
6. Provide `--rules` and `--artifact` overrides for deterministic fixtures.
7. Add `npm run interactions` without causing network activity.
8. Run focused tests and commit `feat(interactions): add exact local checker CLI`.

## Phase 2 — Reviewed identifier mappings

### Task 5: Exact RxNorm/UNII mapping workflow

- Exact RxNorm search may be accepted only when one active ingredient or precise
  ingredient concept matches the exact observed term and expected term type.
- Normalised or approximate RxNorm results are candidates only and never
  auto-accepted.
- Human overrides require reviewer, review date, evidence, and identifier status.
- HTTP uses an injectable client, explicit timeout, bounded retries/backoff, TLS
  verification, and a persistent cache. Tests use mocked HTTP only.
- Operational errors are never cached as `unmapped`.
- RxNorm is identity only; its interaction service was discontinued in 2024.

## Phase 3 — Evidence candidates and clinical review

### Task 6: Public label evidence adapters

- Fetch openFDA labels only through an explicit CLI command.
- Store SPL set/version identifiers and section-level hashes.
- Extract deterministic candidate spans from `drug_interactions`, warnings,
  contraindications, and boxed warnings; do not create clinical claims.
- Use DailyMed links for stable verification where permitted.
- FDA CYP/transporter tables create mechanism/class candidates only, never
  inferred pairwise rules.

### Task 7: Open clinical editorial workflow

- Candidate PRs pass schema, licence, provenance, pair-order, and evidence-link CI.
- A clinician authors original mechanism/management summaries and records review
  metadata.
- A second authorised clinical reviewer approves release.
- Source-version changes mark dependent rules stale and remove non-unknown
  severity from display until re-reviewed.
- Contributions use a Developer Certificate of Origin or contributor agreement.

## Phase 4 — Interoperability and optional providers

### Task 8: HL7 PDDI-CDS export

- Export reviewed rules to PDDI-CDS-compatible FHIR `PlanDefinition`, `Library`,
  and test artifacts without requiring a CQL engine in the core checker.

### Task 9: Licensed-provider interface

- Define a provider-neutral adapter returning source-specific findings.
- Never merge providers by choosing the most severe result.
- CDCI/SNOMED and commercial providers remain user-supplied/licensed plugins.
- DDInter remains quarantined internal-only and cannot be selected by an open
  release profile.

## Validation gates for every phase

1. Focused tests for the changed module.
2. `npm test`.
3. `git diff --check`.
4. Scan tracked changes for secrets, cookies, bearer tokens, and private data.
5. Scan for TLS bypass (`rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED`,
   `--insecure`, `-k`) and fail if found.
6. Prove restricted/unknown sources cannot enter `production-open` outputs.
7. Confirm generated data remains untracked.
8. Make cohesive local commits only; do not push or deploy.

