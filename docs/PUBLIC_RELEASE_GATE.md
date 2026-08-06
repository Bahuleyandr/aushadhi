# Public-release licensing gate — operator runbook

## What the gate enforces

Every row in a public release carries a `sources` array naming the manifest
source ids that contributed to it. The gate
(`src/lib/public-release-gate.mjs`, driven by
`src/cli/stage-public-release.mjs`) admits a row only when **every** one of
those sources is explicitly cleared for the `production-open` profile by
`data-static/interaction-sources.json`: licence verified, source enabled, not
ingestion-forbidden, marked redistributable, allowed in `production-open`,
and of a licence class that profile permits. Anything else fails closed —
restricted, unverified, disabled, or simply unlisted sources all exclude the
row, and the exclusion is tallied per source with a reason in the staged
`public-release-manifest.json`. A row whose `sources` array is missing or
malformed aborts the run: that is a corrupt export, not a restricted one.
The audit that motivated this is [docs/LICENSING_REPORT.md](LICENSING_REPORT.md)
(§7a: the published releases shipped restricted rows because nothing enforced
the manifest annotations mechanically).

## Publishing a compliant release

1. **Build the cohort** as usual (`npm run build`), producing
   `dist/<generation>/drugs.jsonl`.

2. **Stage through the gate** (streaming; never buffers the ~533 MB file):

   ```bash
   node src/cli/stage-public-release.mjs \
     --input dist/<generation>/drugs.jsonl \
     --output dist/public-release
   ```

   This writes `dist/public-release/drugs.jsonl` (cleared rows only) and
   `dist/public-release/public-release-manifest.json` (row totals, per-source
   included/excluded tallies with reasons, source-manifest sha256, and the
   staged artifact's sha256/size under `artifact_source`). The CLI refuses
   unrecognized or symlinked output directories, repository outputs outside
   `dist/`, and a release with zero included rows.

3. **Verify the staged artifact** — the pre-publish check operators must run:

   ```bash
   node src/cli/stage-public-release.mjs --check dist/public-release/drugs.jsonl
   ```

   Exit 0 with a one-line summary means no row references a non-cleared
   source. Any violation prints per-source counts to stderr and exits
   non-zero — do not publish that artifact.

4. **Compress** with the same flags the export snapshot uses
   (`deploy/aushadhi_nonroot_v2_export_snapshot.sh`):

   ```bash
   zstd -q -T0 -19 -c dist/public-release/drugs.jsonl > drugs.jsonl.zst
   ```

5. **Hash and measure** both forms:

   ```bash
   sha256sum dist/public-release/drugs.jsonl drugs.jsonl.zst
   stat -c %s dist/public-release/drugs.jsonl drugs.jsonl.zst
   ```

6. **Write the release manifest** in aushadhi-data at
   `releases/<YYYY-MM-DD>/manifest.json`, keeping the existing shape
   (`schema_version: 1`, `dataset`, `release_date`, `generated_at_utc`, a
   `source` block for the decompressed file — `host`, `path`, `format`,
   `record_count`, `size_bytes`, `sha256` — and an `artifact` block for the
   `.zst`), **plus** a `licence` block copied from the gate's
   `public-release-manifest.json`: `profile`, `redistributable`,
   `source_manifest` provenance, and the `included_sources` /
   `excluded_sources` summaries. `record_count` must equal the gate's
   `rows_included`. The gate's `artifact_source` block is shaped to be copied
   into `source` directly.

7. **Commit** the release directory (manifest + `drugs.jsonl.zst`) to
   `Bahuleyandr/aushadhi-data`.

**Do not publish the exporter's own snapshot.** The existing
`deploy/aushadhi_nonroot_v2_export_snapshot.sh` stamps its output
`internal-evaluation` / `redistributable: false`; that artifact is the
internal snapshot and must never be committed to a release directory that
consumers pull.

## Expected effect on the current data

Of the 676,330 rows in the published 2026-08-02 release, only `github-jr`
(253,973 rows) and `nppa` (732 rows, cleared as Official Gazette matter under
Copyright Act 1957 s.52(1)(q)(i) — see the `nppa` manifest entry and
LICENSING_REPORT §3.7) come from cleared sources, so a compliant release will
be roughly ~254k rows. Rows that merge a cleared source with a restricted one
are excluded whole, so the exact count is whatever the gate reports. The
VH-Health importer verifies manifest sha256s and treats "latest" as the
maximum date directory, so publishing a new compliant release directory
supersedes the old ones without touching them.

## Pulling or replacing the existing non-compliant releases (reserved)

Decision explicitly reserved for the repository owner; this PR does none of
it. What it would involve:

- **Deleting the four release directories** from aushadhi-data only removes
  them from HEAD — the restricted rows remain fully retrievable from git
  history.
- **A true purge** requires rewriting history with `git filter-repo` (or
  equivalent), force-pushing, and every consumer re-cloning; any existing
  clone or fork still holds the data.
- **Interim option:** publish a new compliant release directory (which the
  importer's max-date rule makes "latest") and mark the old directories
  superseded in their manifests or a top-level notice, deferring history
  rewriting.
