# Reviewed interaction identity and presentation mapping

The interaction checker does not treat a catalogue molecule string, brand
suffix, pack label, or dosage-form-looking word as a clinical runtime identity.
Three assertions must be independently preserved:

1. the exact resolved product and its byte-stable assertion hash;
2. each ingredient occurrence, including the observed term and strength;
3. a reviewed concrete route and formulation for that exact product assertion.

Missing mappings remain unresolved. They never fall back to salt stripping,
fuzzy matching, brand parsing, or a default systemic/oral route.

## Deterministic mapping review backlog

Before querying an external terminology service, filter the current catalogue
through the interaction source policy:

```powershell
npm run interactions:catalogue -- `
  --profile internal-evaluation
```

The filter retains a row only when every contributing source is allowed for
product resolution in the selected profile. A mixed-provenance row is excluded
as a whole; fields from a disallowed source are never copied into a
policy-compatible product assertion. The generated `summary.json` binds the
input hashes, retained source counts, and per-source exclusion reasons.

Then build the complete local review queue from the approved draft rule pack
and the filtered catalogue:

```powershell
npm run interactions:mappings:backlog -- `
  --profile internal-evaluation `
  --artifact data/interaction/internal-evaluation/product-catalogue/drugs.jsonl
```

The command validates all draft rules, expands direct selectors, pinned inline
class members, recursively nested combination selectors, and explicitly
labelled global-member-set fallbacks. Every ingredient assertion retains its
rule ID, section, selector role and path, risk basis, context modifiers,
applicability, route/formulation scope, and all four `runtime_status` flags.

It writes three generated, gitignored files below
`data/interaction/internal-evaluation/mapping-backlog/`:

- `ingredient-assertions.jsonl` contains exact normalized rule assertions and
  their catalogue match statistics;
- `product-presentations.jsonl` binds matching catalogue products to both the
  deterministic product ID and exact product-assertion hash;
- `summary.json` binds both outputs to SHA-256 hashes of the rule pack, member
  sets, product artefact, and catalogue summary.

The builder verifies row-level source provenance against the catalogue summary
and the selected source-policy profile. Product IDs that refer to more than one
exact product assertion are collision-flagged and cannot be approved as a
single presentation mapping. Missing class rosters and unmatched ingredient
assertions remain explicit gaps.

All output remains `review_candidate`; accepted mapping counts are always zero.
The command has no flag that accepts identities, infers presentations, or
promotes runtime rules. In particular, catalogue `form_raw`, brand suffixes,
and pack labels are preserved only as exact product assertions and never
treated as clinical route or formulation evidence.

## Bounded mapping pilots

Extract a small, reproducible review packet from the complete backlog by rule
ID. An optional exclusive-source filter retains only product assertions whose
entire catalogue provenance comes from that one source:

```powershell
npm run interactions:mappings:pilot -- `
  --profile internal-evaluation `
  --rule-id warfarin__amiodarone `
  --source-only janaushadhi
```

The generated packet is written below
`data/interaction/internal-evaluation/mapping-pilots/`. Its summary pins the
parent backlog and output hashes. Selector requirements unrelated to the
chosen rule are removed, while each selected product assertion remains exact.
The extractor validates that its parent backlog is candidate-only and refuses
unknown rule IDs, changed input hashes, accepted identities, or inferred
presentations. It cannot write either committed override file.

## Machine-assisted identity proposals

The explicit proposal command queries the official RxNorm API and writes only
generated `review_candidate` records:

```powershell
node src/cli/propose-interaction-mappings.mjs `
  --profile internal-evaluation `
  --ingredient "warfarin" `
  --ingredient "ketoconazole"
```

The default output is
`data/interaction/internal-evaluation/rxnorm-mappings.jsonl`; the persistent
response cache is under the same profile directory. Both are gitignored.
Index-driven runs require an explicit maximum of 100 assertions:

```powershell
node src/cli/propose-interaction-mappings.mjs `
  --profile internal-evaluation `
  --ingredient-index data/interaction/internal-evaluation/ingredient-index.jsonl `
  --limit 25
```

Exact RxNorm searches are kept distinct from normalized searches. A single
exact active ingredient (`IN`) or precise ingredient (`PIN`) result is still
only a candidate. Normalized, ambiguous, and unexpected-term-type results
cannot be accepted automatically. Operational failures are retried but never
cached or converted into `unmapped`.

## Reviewed ingredient mappings

Human-approved mappings live in
`data-static/ingredient-mapping-overrides.json`. Each row pins:

- the immutable local assertion ingredient ID and canonical observed term;
- the canonical clinical ingredient ID and runtime drug token;
- a typed relationship such as `exact`, `salt`, `active_moiety`, `prodrug`,
  `metabolite`, `stereoisomer`, `regimen`, or `synonym`;
- exact RxNorm or UNII identifiers plus response hashes;
- reviewer, review date, source URL, retrieval date, and evidence hash.

Committed manifests contain only explicitly accepted mappings. Candidate
generation never edits them.

## Reviewed product presentations

Human-approved route/form mappings live in
`data-static/product-presentation-overrides.json`. A mapping binds a concrete
route and formulation to both:

- the deterministic local `product_id`; and
- an exact product-assertion SHA-256 covering brand, manufacturer, pack, raw
  form, observed ingredient terms, and strengths.

This second hash prevents case, label, strength, salt, or composition drift
from inheriting an old presentation decision merely because catalogue
normalization kept the same product ID. Abstract values such as `systemic`,
`parenteral`, and `solid_oral` are rejected.

Mappings backed by profile-restricted evidence declare `allowed_profiles`.
The reviewed PMBJP pilot mappings are limited to `internal-evaluation`; the
ordinary `production-open` path ignores them and cannot create a runtime
subject from them.

## Runtime handoff

`src/lib/interaction-mapping.mjs` creates a stable ingredient-occurrence ID for
each ingredient within the exact product. A structured runtime subject is
created only when both the ingredient identity and the product presentation
have reviewed mappings:

```json
{
  "drug": "ketoconazole",
  "route": "oral",
  "formulation": "tablet"
}
```

The ordinary read-only interaction CLI loads the two committed override files
and the rule pack for the explicit release profile by default, then reports a
`mapping_summary`. Test or review fixtures can use explicit files:

```powershell
node src/cli/interactions.mjs `
  --profile internal-evaluation `
  --ingredient-mappings path/to/ingredient-mappings.json `
  --presentation-mappings path/to/presentation-mappings.json `
  --drug "Exact Brand A" `
  --drug "Exact Brand B"
```

The committed production rule pack remains empty and declares unknown
coverage. The internal-evaluation pack contains the clinician-approved
warfarin-amiodarone rule for six exact PMBJP oral-tablet product pairs and the
clinician-approved warfarin-fluconazole rule for 12 exact PMBJP oral-tablet
product pairs. A reviewed ingredient identity without its exact reviewed
presentation is excluded from clinical pair generation, and a different
product carrying the same ingredient does not inherit the approval. Reviewed
mapping completeness does not otherwise promote a clinical rule.

The internal-evaluation runtime pack is deterministically compiled from
`data-static/interaction-promotions.internal-evaluation.json`; it is not a
second clinical source of truth. Each promotion binds the exact SHA-256 of an
attested v2 draft row, the clinician's verbatim approval and reviewer ID, the
validated label versions, reviewed ingredient mapping IDs, reviewed
presentation mapping IDs, and the expected product-pair count. The compiler
fails closed if any bound input drifts:

```powershell
npm run interactions:promote
npm run interactions:promote:check
```

The first command regenerates the pack. The second derives it in memory and
requires exact byte equality with the committed artifact. This promotion path
targets `internal-evaluation` only; the `production-open` pack remains empty
and cannot inherit an internal approval.
