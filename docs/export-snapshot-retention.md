# Export snapshot and retention contract

This contract is review material only. It does not authorize installation,
activation, deletion, deployment, or distribution.

## Completed export

`deploy/aushadhi_nonroot_v2_export_snapshot.sh` reads completed cohorts only from
the immutable `/var/lib/aushadhi/dist/.generations/<generation-id>/` directory
selected by the atomically replaced `/var/lib/aushadhi/dist/cohort-index.json`.
`/opt/aushadhi` remains the read-only code and release-receipt root. A date or
unindexed generation is not completion evidence: the exporter stable-reads and
validates the exact index, binds its manifest SHA-256, and then verifies schema 1
`cohort-manifest.json`, every file bound by that manifest, its generation ID,
and the source and prescribable hashes.

The schema 4 `stage-manifest.json` records the cohort-manifest hash, generation
ID, source list, deployed code/release identity, and an explicit
`internal-evaluation`, non-redistributable, no-production-authority policy. A
release identity includes the repository tree, runtime manifest, dependency
tree, privileged-file set, installed-file set, and systemd-file set hashes.
A same-date rerun is a no-op only when the staged directory and every staged file
still verify against the exact cohort and release. A changed generation or a
corrupt stage is built separately and exchanged atomically with the old dated
directory.

Recovery material is internal-only. Critical non-database state is required.
SQLite files are captured with SQLite's online backup API and checked before
compression; any backup failure aborts the export. The generic state tar excludes
all SQLite databases, WAL and SHM files, page caches, and the complete
`data/restricted` tree. CDCI is never exported. The recovery snapshot may contain
other private or licensed crawler state and is therefore not redistributable.
Runtime-only locks and narrowly named atomic temporary files are excluded too,
including crawler-state, build, export, and cache-retention locks; restoring a
snapshot therefore cannot resurrect a foreign-host lock owner and wedge a job.

## Retention boundary

`deploy/aushadhi_nonroot_v2_export_retention.sh` can mutate only physical dated
directories directly beneath `/var/lib/aushadhi-export`. It never deletes source
cohorts in `/var/lib/aushadhi/dist`, application files, crawler state, or CDCI.
Before planning any removal it verifies every dated export, including its cohort
binding, release identity, policy, recovery evidence, and all staged file hashes.
One invalid or unexpected entry blocks the entire run before deletion.

Retention preserves the newest completed exports selected by
`AUSHADHI_EXPORT_RETENTION_KEEP` (14 by default), always including the latest,
plus exact dates or generation IDs listed in the comma-separated
`AUSHADHI_EXPORT_RETENTION_PROTECT` setting. A configured protected cohort that
does not resolve to a verified export is a hard failure.

The service is deliberately non-mutating by default:

```text
AUSHADHI_EXPORT_RETENTION_APPLY=0
```

An operator with separate deletion authority must review a successful dry-run
and explicitly set the value to `1` in a systemd drop-in before a later run may
remove anything. Candidates are reverified, moved aside by exact path as a set,
and only then removed. The script has no broad-root, wildcard-delete, source-data,
or restricted-data path.

Source-cohort generation retention is intentionally separate. Immutable
directories beneath `/var/lib/aushadhi/dist/.generations` remain rollback
material and are not deleted by the export-retention job. No automatic source
generation deletion is authorized by this repository; disk-pressure handling
requires a separately reviewed policy that atomically updates the cohort index
and never removes its latest or per-date targets.
