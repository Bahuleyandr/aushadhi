# Source-cohort generation retention

Status: staged policy and inactive units. This document describes controls; it
does not authorize installation, timer activation, configuration, or deletion.

## Scope

The source-cohort publisher stores immutable cohorts under
`dist/.generations/<generation_id>` and selects them through the single atomic
`dist/cohort-index.json` pointer. Source-generation retention is deliberately
separate from export-snapshot retention. It never selects raw evidence,
restricted CDCI material, application files, recovery state, or exported
snapshots.

The authoritative preservation set is the union of:

- every key in `cohort-index.json.generations`, including superseded same-date
  generations that are not selected by a date pointer;
- the latest generation and every dated pointer;
- exact generation IDs listed in
  `AUSHADHI_SOURCE_GENERATION_RETENTION_PROTECT`; and
- the newest `AUSHADHI_SOURCE_GENERATION_RETENTION_KEEP` verified unindexed
  generations, ordered by manifest `generated_at` and generation ID.

Only a physical, non-symlink, direct child of `dist/.generations` outside that
set can become a candidate. The current publisher keeps all historical
generations in the index, so ordinary operation should report zero candidates.
Retention is for fully validated unindexed orphans, not for aging out indexed
history.

## Fail-closed classification

Before reporting candidates, the helper:

1. Refuses root and, outside its disposable test mode, requires the `aushadhi`
   account and the exact `/var/lib/aushadhi/dist` root.
2. Takes a dedicated nonblocking file lock and creates the same physical
   `dist/.build.lock` directory used by cohort publication. An existing build
   lock produces a safe skip and is never reclaimed.
3. Stable-reads bounded UTF-8 JSON with duplicate-key and non-finite-number
   rejection. The index must use schema 1, exact fields, calendar dates, UTC
   timestamps, safe generation IDs, lowercase SHA-256 identities, and mutually
   consistent latest/date/generation records.
4. Requires every generation entry to be a physical direct directory, every
   cohort entry to be a regular non-symlink file, an exact schema-1 manifest,
   the complete bounded artifact set, and matching size and SHA-256 identities.
   An unexpected file, invalid name, symlink, corrupt manifest, missing indexed
   generation, or corrupt artifact refuses the entire run before mutation.
5. Requires every configured protected ID to identify a verified physical
   cohort and bounds `KEEP` to 1 through 365.

Dry-run is the default and prints `WOULD REMOVE` records without changing a
generation or the index.

## Apply authority and final revalidation

Apply mode requires both the effective
`AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=1` setting and a separately managed
`/etc/aushadhi/source-generation-retention-apply.conf`. In production that file
must be a physical root:root `0644` file containing the exact apply setting.
The tracked unit defaults to apply 0 and merely declares the optional authority
file; the repository does not create it.

Immediately before each exact removal, the helper re-reads and strictly
validates the index and requires its bytes and filesystem identity to be
unchanged. It also requires the physical generation set to be unchanged except
for candidates already removed by that invocation, confirms that the candidate
has not become indexed or protected, and re-verifies its directory inode,
manifest, and every artifact. The candidate is then renamed relative to an open
`.generations` directory descriptor, its inode is checked again, and only that
quarantine name is recursively removed using Python's symlink-safe deletion
implementation. Any revalidation or deletion error stops the run.

The helper never rewrites `cohort-index.json`. Its build-lock owner is removed
only after its token and directory inode still match; cleanup never recursively
removes an unknown lock.

## Promotion-side volume guard

Retention does not make a bad cohort safe. `promoteCohort` itself rejects a
candidate before the stage-to-generation rename unless `summary.total_rows` is
positive and `summary.sources` contains a positive source count. Bootstrap is
allowed only when neither `cohort-index.json` nor legacy `dist/latest` exists.
With an index, the prior latest cohort is fully verified first; candidate rows
and prescribable counts must be at least their prior totals, and every previously
positive source count must not decrease. There is no recovery bypass. A refusal
leaves the existing pointer unchanged, and the coordinator records the failure
and removes only its own exact staging directory.

The index and its verified manifest, not `.build-state.json`, are authoritative
for freshness. The state file is a rebuild-avoidance cache. A missing, invalid,
or unwritable cache is derived from the latest indexed generation. A cache write
failure after the atomic pointer commit creates a typed post-commit warning but
does not turn the successful publication into a failed service result or block
the build unit's `OnSuccess` export.

## Review evidence

Reviewers should require all of the following before considering a separately
authorized installation or apply configuration:

- focused source-generation retention tests, including dry-run, exact apply,
  corruption, symlink, held-lock, and post-classification index-race cases;
- cohort tests covering empty bootstrap, prior-volume collapse, dropped source,
  prescribable collapse, monotonic growth, legacy-latest refusal, pointer
  preservation, exact-stage cleanup, coherent post-rename mutation, and
  post-commit state-cache failure;
- Bash syntax validation for `scripts/nightly-build.sh`;
- Python syntax validation for the helper;
- `systemd-analyze verify` for the build and source-retention service/timer; and
- a release receipt binding the reviewed helper and unit hashes.
