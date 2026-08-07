# Public-catalogue staging gate

## Authority boundary

This is an engineering validation control only. It does not authorize publication,
distribution, production use, deployment, deletion of an earlier snapshot, or a change
to any clinical promotion. The existing `aushadhi-data` snapshots are private,
`internal-evaluation`, and non-redistributable. Any future public release requires
separate owner, source-rights, legal, and release approval after this gate passes.

## What the gate enforces

`src/lib/public-release-gate.mjs`, driven by
`src/cli/stage-public-release.mjs`, evaluates the complete provenance of every row
against the committed `data-static/interaction-sources.json` policy. The CLI does not
accept an alternate policy manifest.

A source is technically eligible for the staged `production-open` catalogue only when
the existing source-policy validator confirms all of the following:

- verified licence metadata, enabled status, and redistribution eligibility;
- the `production-open` profile and `catalogue` use;
- the exact `data/interaction/production-open` storage zone;
- the `open-core` artifact pack; and
- no unsatisfied attribution, licence-notice, ShareAlike, or changes-notice obligation.

The gate reconciles a row's primary `source` or `source_policy_id` with every entry in
its `sources` array. Missing, empty, malformed, or conflicting provenance aborts the
stage. Restricted, unverified, disabled, or unlisted sources exclude the whole row and
are tallied in `public-release-manifest.json`.

The gate deliberately does not create source rights. In particular, `nppa`,
`pharmeasy`, `netmeds`, and `apollo` remain unlisted and fail closed. NPPA cannot be
classified at source level until every proposed row is bound to an exact verified
Gazette instrument and the legal basis is independently approved. Changes to the
digest-bound source manifest require the existing review and re-attestation workflow.

## Stage a candidate

Use a new output directory for every candidate; completed stages are immutable and are
never replaced by this command.

```bash
node src/cli/stage-public-release.mjs \
  --input dist/<generation>/drugs.jsonl \
  --output dist/public-release/<candidate-id>
```

The command streams the input, writes only technically eligible rows to
`drugs.jsonl`, and writes a sibling `public-release-manifest.json` containing:

- policy profile and committed source-manifest SHA-256;
- explicit `release_authority: none` and `deployment_authority: none` boundaries;
- input, included, and excluded row totals;
- exact included/excluded source tallies;
- the staged artifact's record count, byte size, and SHA-256.

The stage fails if no row is eligible, provenance is corrupt, the destination exists,
or a repository destination is outside `dist/`.

## Verify the complete candidate package

`--check` accepts the candidate directory, not a loose JSONL file:

```bash
node src/cli/stage-public-release.mjs \
  --check dist/public-release/<candidate-id>
```

Verification fails unless the directory contains exactly `drugs.jsonl` and
`public-release-manifest.json` as regular files. It revalidates every row against the
current committed policy and verifies the manifest schema, profile, policy hash, row
counts, source tallies, artifact size, and artifact SHA-256. Extra, missing, tampered,
or symlinked package entries fail closed.

An exit status of zero proves only that the candidate package satisfies this technical
gate at the checked repository revision. It is not permission to compress, publish,
deploy, or advertise the data as legally cleared.

## Current expected result

The current committed policy may technically admit `github-jr` open-core rows. Its
upstream row provenance is still undocumented, so a separate source-rights decision is
required before any public release approval. Every row containing `onemg-live`,
`janaushadhi`, `cdsco-fdc`, an unlisted e-pharmacy source, NPPA, or any other
non-eligible source is excluded whole.

Do not use the internal exporter's snapshot as a candidate. Its own stage manifest is
explicitly `internal-evaluation`, non-redistributable, and without production authority.
