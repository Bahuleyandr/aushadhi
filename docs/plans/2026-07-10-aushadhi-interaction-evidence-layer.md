# Aushadhi Interaction Evidence Layer Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add an ingredient-level, citation-first interaction checker to Aushadhi that resolves Indian brands to canonical ingredients, identifies supported potential interactions, and never interprets missing evidence as proof of safety.

**Architecture:** Keep the current Indian brand/composition pipeline as the identity layer. Add independent source adapters that ingest public interaction evidence into a normalized, versioned JSONL store. The checker operates deterministically over canonical ingredient pairs and returns source excerpts, jurisdiction, review status, and coverage gaps. No consumer-site scraping and no LLM-generated interaction claims are permitted. DDInter may be used only in an explicitly non-commercial evaluation profile unless separate commercial permission is obtained.

**Tech Stack:** Node.js 22 ESM, `node:test`, existing JSONL/CSV pipeline, NLM RxNorm REST API, openFDA drug-label API, DailyMed citation links, public FDA/ONC reference tables.

---

## Non-negotiable safety and licensing rules

1. **An empty match means `unknown`, not `safe`.** Never output “no interaction” unless the requested drugs were resolved, the source coverage is explicitly known, and a reviewed rule supports that wording.
2. **Ingredients, not brand strings, are checked.** Every Aushadhi brand is expanded into all normalized ingredients before pair generation.
3. **Every finding carries provenance.** At minimum: source, source URL/identifier, retrieval date, jurisdiction, evidence excerpt, source license, and review status.
4. **No LLM may invent or upgrade severity.** NLP/LLM extraction may only produce review candidates in a future phase; unreviewed candidates remain `severity: unknown` and are never presented as clinical advice.
5. **No scraping Drugs.com, Medscape, DrugBank, BNF, Micromedex, Lexicomp, or similar consumer/commercial checkers.** Their public web interfaces are not embeddable datasets.
6. **The current 1mg-enriched Aushadhi artifact remains private/internal.** `src/lib/emit.mjs` already records that 1mg terms restrict scraping and that the dataset must not be redistributed. Any public or commercial interaction product needs a clean-source build profile that excludes 1mg-derived rows and uses licensed or redistribution-safe brand data.
7. **DDInter 2.0 is evaluation-only by default.** Its published/website terms are non-commercial (CC BY-NC-SA 4.0). Keep it physically and logically separate from distributable artifacts.
8. **openFDA is evidence, not a complete pairwise checker.** Its label sections are public and generally CC0, but labels vary and FDA warns against relying on openFDA for medical-care decisions.
9. **Human clinical review is required before a rule is marked `clinician-reviewed`.**

## Source decision table

| Source | Role | License/availability | Production posture |
|---|---|---|---|
| NLM RxNorm/RxClass | Canonical ingredient IDs and classes | Public API; generally no license required | Use for identity mapping; it no longer supplies DDI results |
| openFDA drug labels | `drug_interactions`, warnings and contraindication evidence | Generally public domain/CC0; API limits apply | Primary public evidence feed; store citations and raw source IDs |
| DailyMed | Stable SPL/set-ID citation target and label cross-check | Public NLM label service | Use for evidence links and source verification |
| FDA CYP/transporter tables | Public substrate/inhibitor/inducer reference rules | Public FDA material | Curated class/mechanism seed rules with citations |
| ONC high-priority DDI list | Small baseline of clinically critical pairs | Publicly published expert-panel list | Curated seed set only; preserve source citation |
| DrugCentral | Ingredient/synonym/label enrichment | CC BY-SA 4.0 | Optional identifier enrichment; not assumed to be a complete DDI checker |
| DDInter 2.0 | 302,516 DDIs across 2,310 drugs, with severity/mechanism/management | CC BY-NC-SA 4.0; current website certificate must be verified before download | Optional non-commercial evaluation and coverage benchmark only |
| DrugBank/FDB/Micromedex/Lexicomp | Mature commercial clinical knowledge bases | Licensed/proprietary | Future licensed production option; never scrape |

## Primary references checked for this plan

- NLM RxNav and current API status: https://lhncbc.nlm.nih.gov/RxNav/
- NLM confirmation that DDI features ended on 2024-01-02: https://lhncbc.nlm.nih.gov/RxNav/information/FAQs.html
- openFDA label API: https://open.fda.gov/apis/drug/label
- openFDA data rights/CC0 terms: https://open.fda.gov/terms/
- DailyMed public label service: https://dailymed.nlm.nih.gov/dailymed/about-dailymed.cfm
- ONC high-priority interaction paper: https://pmc.ncbi.nlm.nih.gov/articles/PMC3422823/
- FDA CYP/transporter reference tables: https://www.fda.gov/drugs/drug-interactions-labeling/drug-development-and-drug-interactions-table-substrates-inhibitors-and-inducers
- DDInter 2.0 paper and coverage: https://pmc.ncbi.nlm.nih.gov/articles/PMC11701621/
- DDInter terms (CC BY-NC-SA 4.0; site TLS certificate was invalid when checked on 2026-07-10): https://ddinter2.scbdd.com/terms
- DrugCentral download and CC BY-SA license: https://drugcentral.org/download and https://drugcentral.org/privacy

---

### Task 1: Create source and license manifest

**Objective:** Make source rights and allowed uses machine-readable before ingesting any interaction data.

**Files:**
- Create: `data-static/interaction-sources.json`
- Create: `src/lib/interaction-source-policy.mjs`
- Test: `test/interaction-source-policy.test.mjs`

**Step 1: Write failing tests**

Test that every source entry includes:

```js
{
  id,
  name,
  homepage,
  license,
  commercial_use,
  redistribution,
  role,
  retrieved_at
}
```

Test that `ddinter2` is rejected from production/distributable builds and that `openfda-label` is allowed with attribution metadata.

**Step 2: Run the test and verify failure**

Run:

```bash
node --test test/interaction-source-policy.test.mjs
```

Expected: FAIL because the manifest and policy module do not exist.

**Step 3: Implement the manifest and policy guard**

Export:

```js
export function assertSourceAllowed(source, { profile = 'production' } = {})
```

Profiles:

- `production`: rejects non-commercial and unknown-license sources.
- `internal-evaluation`: permits DDInter but marks all derived rows `redistributable: false`.

**Step 4: Re-run test**

Expected: PASS.

**Step 5: Commit**

```bash
git add data-static/interaction-sources.json src/lib/interaction-source-policy.mjs test/interaction-source-policy.test.mjs
git commit -m "feat(interactions): enforce source license policy"
```

---

### Task 2: Build a canonical Aushadhi ingredient index

**Objective:** Produce one canonical row per normalized ingredient seen in `dist/latest/drugs.jsonl`.

**Files:**
- Create: `src/lib/ingredient-index.mjs`
- Create: `src/cli/build-ingredient-index.mjs`
- Test: `test/ingredient-index.test.mjs`
- Modify: `package.json`

**Step 1: Write failing tests**

Cover:

- single-ingredient brands;
- fixed-dose combinations producing multiple ingredient entries;
- salt aliases already normalized by `normMolecule`;
- deduplication across brands;
- preservation of original spellings as aliases;
- deterministic sorted output.

Expected output schema:

```json
{
  "canonical_name": "warfarin",
  "aliases": ["warfarin sodium"],
  "brand_count": 12,
  "rxcui": null,
  "mapping_status": "unmapped"
}
```

**Step 2: Verify RED**

```bash
node --test test/ingredient-index.test.mjs
```

**Step 3: Implement minimal index builder**

Read JSONL as a stream rather than loading the 255k-row artifact entirely into memory.

**Step 4: Add CLI**

```json
"build:ingredients": "node src/cli/build-ingredient-index.mjs"
```

Write:

- `dist/latest/ingredients.jsonl`
- `dist/latest/ingredients-summary.json`

**Step 5: Verify GREEN**

```bash
npm test
npm run build:ingredients
```

Expected: tests pass; output contains no duplicate `canonical_name` values.

**Step 6: Commit**

```bash
git add src/lib/ingredient-index.mjs src/cli/build-ingredient-index.mjs test/ingredient-index.test.mjs package.json
git commit -m "feat(interactions): build canonical ingredient index"
```

---

### Task 3: Add reviewed RxNorm mapping with cache

**Objective:** Map Aushadhi canonical ingredient names to RxCUIs without silently accepting ambiguous approximate matches.

**Files:**
- Create: `src/adapters/rxnorm.mjs`
- Create: `src/lib/ingredient-mapping.mjs`
- Create: `data-static/rxnorm-overrides.json`
- Test: `test/adapters/rxnorm.test.mjs`
- Test: `test/ingredient-mapping.test.mjs`

**Step 1: Write failing adapter tests with mocked HTTP**

Cover:

- exact ingredient match;
- approximate match returned as a candidate, not automatically accepted;
- HTTP 429 retry/backoff;
- network failure leaves mapping unresolved;
- cache hit performs no HTTP request;
- Indian ingredient absent from RxNorm remains `unmapped`.

**Step 2: Implement mapping states**

Allowed states:

```text
exact
reviewed-override
ambiguous
unmapped
```

Never auto-promote `ambiguous` to an RxCUI.

**Step 3: Store mapping provenance**

```json
{
  "canonical_name": "paracetamol",
  "rxcui": "161",
  "status": "reviewed-override",
  "matched_name": "acetaminophen",
  "source": "rxnorm",
  "source_version": "YYYY-MM",
  "reviewed_at": "ISO-8601"
}
```

**Step 4: Verify and commit**

```bash
node --test test/adapters/rxnorm.test.mjs test/ingredient-mapping.test.mjs
git add src/adapters/rxnorm.mjs src/lib/ingredient-mapping.mjs data-static/rxnorm-overrides.json test/
git commit -m "feat(interactions): add reviewed RxNorm mapping"
```

---

### Task 4: Ingest and cache openFDA label evidence

**Objective:** Fetch label records for mapped ingredients and preserve the raw interaction-related sections with identifiers.

**Files:**
- Create: `src/adapters/openfda-labels.mjs`
- Create: `src/cli/fetch-interaction-labels.mjs`
- Test: `test/adapters/openfda-labels.test.mjs`
- Modify: `.gitignore`
- Modify: `package.json`

**Step 1: Write failing mocked tests**

Cover:

- query by harmonized generic name/RxCUI where available;
- extraction of `drug_interactions`, `contraindications`, `warnings`, `boxed_warning`;
- multiple labels for one ingredient;
- missing `drug_interactions` section;
- 404, 429 and 5xx handling;
- on-disk cache and retrieval timestamp;
- no API key or bearer token written to output.

**Step 2: Implement polite fetcher**

Use explicit timeout, bounded retries, exponential backoff, and a low request rate. Cache under:

```text
data/raw/interactions/openfda-label/YYYY-MM-DD/<rxcui-or-slug>.json
```

Raw fetched data remains private pipeline input, not a clinical result.

**Step 3: Add CLI**

```json
"fetch:interaction-labels": "node src/cli/fetch-interaction-labels.mjs"
```

Support `--limit`, `--resume`, and `--ingredient` for safe testing.

**Step 4: Verify and commit**

```bash
node --test test/adapters/openfda-labels.test.mjs
npm test
git add src/adapters/openfda-labels.mjs src/cli/fetch-interaction-labels.mjs test/adapters/openfda-labels.test.mjs .gitignore package.json
git commit -m "feat(interactions): ingest cited FDA label evidence"
```

---

### Task 5: Extract deterministic interaction candidates

**Objective:** Convert label text into review candidates only when another known canonical ingredient is explicitly named.

**Files:**
- Create: `src/lib/interaction-candidates.mjs`
- Create: `src/cli/build-interaction-candidates.mjs`
- Test: `test/interaction-candidates.test.mjs`

**Step 1: Write failing tests**

Cover:

- exact canonical ingredient mention;
- synonym mention through reviewed alias map;
- no substring false positives (`metformin` must not match arbitrary longer text);
- same-ingredient self-match rejected;
- duplicate evidence paragraphs merged;
- candidate severity defaults to `unknown`;
- negated/unclear text remains a candidate for review, never a confirmed rule.

**Step 2: Implement dictionary matching**

Use token boundaries and the reviewed ingredient alias index. Do not use an LLM.

**Step 3: Emit candidates**

```text
data/review/interactions/openfda-candidates.jsonl
```

Each row includes the exact evidence excerpt and label identifiers.

**Step 4: Verify and commit**

```bash
node --test test/interaction-candidates.test.mjs
git add src/lib/interaction-candidates.mjs src/cli/build-interaction-candidates.mjs test/interaction-candidates.test.mjs
git commit -m "feat(interactions): extract reviewable label candidates"
```

---

### Task 6: Add reviewed seed rules

**Objective:** Establish a small, source-grounded baseline before attempting broad automated coverage.

**Files:**
- Create: `data-static/interactions/onchigh-reviewed.json`
- Create: `data-static/interactions/fda-cyp-reviewed.json`
- Create: `src/lib/interaction-rule-schema.mjs`
- Test: `test/interaction-rule-schema.test.mjs`

**Step 1: Define normalized rule schema**

```json
{
  "interaction_id": "stable-hash",
  "ingredient_a": {"canonical_name": "...", "rxcui": "..."},
  "ingredient_b": {"canonical_name": "...", "rxcui": "..."},
  "severity": "contraindicated|major|moderate|minor|unknown",
  "mechanism": "...",
  "clinical_effect": "...",
  "management_text": "...",
  "evidence": [{
    "source": "onchigh|openfda-label|fda-cyp",
    "source_url": "https://...",
    "source_id": "...",
    "excerpt": "...",
    "jurisdiction": "US",
    "retrieved_at": "ISO-8601"
  }],
  "license": "...",
  "review_status": "unreviewed|clinician-reviewed",
  "reviewed_by": "...",
  "reviewed_at": "ISO-8601"
}
```

**Step 2: Enforce schema invariants**

- ingredients sorted deterministically;
- source URL required;
- severity other than `unknown` requires `clinician-reviewed`;
- no rule may claim `safe`;
- no management recommendation without a cited evidence excerpt.

**Step 3: Curate sources manually**

Transcribe only factual rules needed for the seed set. Preserve citations; do not copy proprietary prose.

**Step 4: Verify and commit**

```bash
node --test test/interaction-rule-schema.test.mjs
git add data-static/interactions src/lib/interaction-rule-schema.mjs test/interaction-rule-schema.test.mjs
git commit -m "feat(interactions): add reviewed public seed rules"
```

---

### Task 7: Build the pairwise checker engine

**Objective:** Resolve entered brands/ingredients and check every cross-product ingredient pair.

**Files:**
- Create: `src/lib/interaction-checker.mjs`
- Test: `test/interaction-checker.test.mjs`

**Step 1: Write failing tests**

Cover:

- two single-ingredient drugs;
- fixed-dose combination versus single ingredient;
- fixed-dose combination versus fixed-dose combination;
- duplicate ingredient suppression;
- ambiguous brand resolution;
- unmapped ingredient;
- matched reviewed rule;
- unreviewed candidate separated from reviewed findings;
- no match returns `coverage: unknown`, never `safe`;
- deterministic ordering.

**Step 2: Implement result contract**

```json
{
  "resolved_inputs": [],
  "reviewed_findings": [],
  "review_candidates": [],
  "unresolved_inputs": [],
  "coverage": "complete|partial|unknown",
  "disclaimer": "No listed interaction does not establish safety. Verify with a pharmacist or clinician and current approved labeling."
}
```

**Step 3: Verify and commit**

```bash
node --test test/interaction-checker.test.mjs
git add src/lib/interaction-checker.mjs test/interaction-checker.test.mjs
git commit -m "feat(interactions): add citation-first checker engine"
```

---

### Task 8: Add a read-only CLI

**Objective:** Provide an auditable local checker before any web/API exposure.

**Files:**
- Create: `src/cli/interactions.mjs`
- Test: `test/interactions-cli.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Write failing CLI tests**

Expected usage:

```bash
npm run interactions -- check --drug "Brand A" --drug "Brand B"
```

Support `--json` for machine-readable output.

**Step 2: Implement**

CLI must:

- print resolved brand → ingredient mapping;
- group findings by ingredient pair;
- show severity only for reviewed rules;
- print source links and evidence dates;
- list unresolved ingredients prominently;
- always print the absence-of-evidence warning.

**Step 3: Verify and commit**

```bash
node --test test/interactions-cli.test.mjs
npm test
git add src/cli/interactions.mjs test/interactions-cli.test.mjs package.json README.md
git commit -m "feat(interactions): add local evidence checker CLI"
```

---

### Task 9: Add optional DDInter non-commercial evaluation adapter

**Objective:** Measure mapping and rule coverage without contaminating production artifacts.

**Files:**
- Create: `src/adapters/ddinter-evaluation.mjs`
- Create: `src/cli/evaluate-ddinter-coverage.mjs`
- Test: `test/adapters/ddinter-evaluation.test.mjs`
- Modify: `.gitignore`

**Step 1: Gate the adapter**

Require both:

```text
AUSHADHI_PROFILE=internal-evaluation
AUSHADHI_ACCEPT_DDINTER_NC_LICENSE=1
```

Fail closed otherwise.

**Step 2: Verify source integrity**

- Use HTTPS only with valid certificate validation.
- Do not use `curl -k` or disable TLS verification.
- Pin the downloaded snapshot checksum and retrieval date.
- Keep raw data under `data/restricted/ddinter/`, excluded from distributable output and Git unless the license manifest explicitly permits storage.

**Step 3: Produce coverage report only**

```json
{
  "aushadhi_ingredients": 0,
  "mapped_to_ddinter": 0,
  "reviewed_rule_overlap": 0,
  "ddinter_only_candidates": 0,
  "generated_at": "ISO-8601",
  "profile": "internal-evaluation"
}
```

Do not expose DDInter descriptions in production results.

**Step 4: Verify and commit**

```bash
node --test test/adapters/ddinter-evaluation.test.mjs
git add src/adapters/ddinter-evaluation.mjs src/cli/evaluate-ddinter-coverage.mjs test/adapters/ddinter-evaluation.test.mjs .gitignore
git commit -m "feat(interactions): add gated DDInter coverage evaluation"
```

---

### Task 10: Clinical validation and release gate

**Objective:** Prevent an unvalidated interaction engine from being presented as clinical decision support.

**Files:**
- Create: `docs/INTERACTION_REVIEW.md`
- Create: `test/fixtures/interactions/clinician-reviewed-cases.json`
- Create: `test/interaction-clinical-regression.test.mjs`
- Modify: `README.md`

**Step 1: Build a clinician-reviewed fixture**

A clinician/pharmacist selects representative cases covering:

- contraindicated/high-priority pairs;
- PK metabolism interactions;
- PD additive-risk interactions;
- fixed-dose combination expansion;
- deliberately unsupported pairs that must return `unknown`;
- ambiguous Indian brand names.

No expected result is generated by the model implementing the test.

**Step 2: Add regression assertions**

Assert exact source IDs, review status, pair identity, and coverage state. Do not assert copied prose beyond short source excerpts.

**Step 3: Add release gate**

A build may be labeled `interaction-evidence-preview` only when:

- all technical tests pass;
- every non-unknown severity rule is clinician-reviewed;
- source/license manifest validation passes;
- no restricted source appears in production artifact;
- unresolved and partial coverage are visibly reported.

**Step 4: Verify and commit**

```bash
npm test
npm run interactions -- check --drug "<review fixture A>" --drug "<review fixture B>" --json
git add docs/INTERACTION_REVIEW.md test/fixtures/interactions test/interaction-clinical-regression.test.mjs README.md
git commit -m "test(interactions): add clinical validation gate"
```

---

### Task 11: Operational refresh and monitoring

**Objective:** Keep public-source evidence current without silently changing reviewed clinical output.

**Files:**
- Create: `scripts/update-interaction-evidence.sh`
- Create: `scripts/interaction-evidence-healthcheck.sh`
- Create: `docs/INTERACTION_OPERATIONS.md`
- Test: `test/interaction-evidence-update.test.mjs`

**Step 1: Separate fetch from promotion**

The update job fetches new labels and generates candidates, but never overwrites clinician-reviewed rules automatically.

**Step 2: Health checks**

Alert on:

- source refresh older than the configured threshold;
- checksum/source manifest mismatch;
- RxNorm mapping regression;
- restricted-license data entering production output;
- reviewed rule disappearing or changing identity.

**Step 3: Schedule conservatively**

Monthly source refresh is sufficient initially. Use a script-only Hermes cron; stay silent on OK and notify `#aushadhi-crawl` only when review is required.

**Step 4: Verify and commit**

```bash
bash -n scripts/update-interaction-evidence.sh scripts/interaction-evidence-healthcheck.sh
node --test test/interaction-evidence-update.test.mjs
git add scripts docs/INTERACTION_OPERATIONS.md test/interaction-evidence-update.test.mjs
git commit -m "ops(interactions): add evidence refresh safeguards"
```

---

## MVP acceptance criteria

- [ ] Two Aushadhi brand names can be resolved into all component ingredients.
- [ ] The checker evaluates every unique cross-drug ingredient pair.
- [ ] Every displayed finding has a direct source URL/identifier and retrieval date.
- [ ] Severity is shown only for clinician-reviewed rules.
- [ ] Unmapped/ambiguous ingredients are explicit.
- [ ] No-match output says `coverage unknown`, not `safe` or `no interaction`.
- [ ] Production output contains no DDInter/DrugBank/consumer-checker restricted data.
- [ ] All Node tests, license-policy tests and clinical regression fixtures pass.
- [ ] The initial interface remains local/read-only until clinical validation is complete.

## Recommended implementation sequence

1. Tasks 1–3: identity and license foundation.
2. Tasks 4–6: public evidence ingestion and reviewed seed rules.
3. Tasks 7–8: local checker MVP.
4. Task 10: clinical validation before wider use.
5. Task 9: optional DDInter coverage benchmark only.
6. Task 11: maintenance after the MVP is clinically reviewed.

Do **not** begin with a web UI or patient-facing feature. Build and validate the evidence contract first.
