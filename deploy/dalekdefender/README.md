# Dalekdefender runtime package

This directory is the versioned source of truth for Aushadhi's hardened runtime
topology on Dalekdefender. It does not authorize a deployment. Installing,
starting, enabling, or restarting these units requires separate explicit
approval and a release receipt tied to the exact reviewed commit.

The intended application root is `/opt/aushadhi`. Mutable crawler state, logs,
cache, and exported snapshots live outside that read-only tree under
`/var/lib/aushadhi`, `/var/log/aushadhi`, `/var/cache/aushadhi`, and
`/var/lib/aushadhi-export` respectively. Long-running jobs use the unprivileged
`aushadhi` account. Each crawler can write only its own source subtree beneath
the raw, log, and cache roots. The build alone can write
`/var/cache/aushadhi/build`, including its content-addressed derived PDF text.

## Tracked topology

- `aushadhi-crawl.service`: Tata 1mg loop, capped at 20,000 requests per UTC day.
- `aushadhi-apollo.service`: Apollo loop, capped at 10,000 requests per UTC day.
- `aushadhi-pharmeasy.service`: PharmEasy loop, capped at 20,000 requests per UTC day.
- `aushadhi-netmeds.service`: Netmeds loop, capped at 20,000 requests per UTC day.
- `aushadhi-build.service` and `.timer`: atomic catalogue build and report.
- `aushadhi-export.service`: post-build snapshot export, triggered only after a
  successful build.
- `aushadhi-export-retention.service` and `.timer`: verified snapshot retention;
  dry-run only unless a separately authorized override enables deletion.
- `aushadhi-source-generation-retention.service` and `.timer`: index-aware
  source-cohort generation retention; dry-run by default and incapable of
  selecting any generation still named by the cohort index.
- `aushadhi-cache-retention.service` and `.timer`: bounded compression of raw
  page-cache HTML.
- `aushadhi-network-hook.py`: fixed, root-owned split-tunnel setup/cleanup for
  the four allowlisted crawler units.
- `aushadhi-observer.py`: fixed, root-owned observer dispatcher; it exposes only
  the four allowlisted read-only health checks.
- `sudoers-aushadhi-observer`: exact command allowlist for the unprivileged
  operator; no shell, arbitrary arguments, restart, or sample access is granted.
- `aushadhi-source-healthcheck.sh`: one-request 1mg egress diagnostic for use
  only while the 1mg service is inactive.
- `logrotate-aushadhi`: bounded rotation for crawler and build logs.
- `runtime-manifest.json`: paths, authority boundary, restricted-source policy,
  and required `DEPLOYED-RELEASE.json` fields.
- `release-receipt.mjs`: fail-closed generator and verifier for the immutable
  application, dependency, unit, privileged-helper, and policy identity.

Legacy `*.service.d/splittunnel.conf` and build-memory drop-ins are deliberately
not part of this topology. Their settings are now in the tracked base units, and
leaving old copies installed would execute duplicate network hooks.

Crawler loops collect and normalize source data only. They never publish a
catalogue cohort. `aushadhi-build.service` is the sole runtime entry point that
may publish `dist`; it reads the raw tree as immutable input, stages the entire
cohort, verifies its manifest, and changes the current-generation pointer only
after success. PDF text derived during that build is content-addressed beneath
`/var/cache/aushadhi/build/derived`; it is never written beside an operator-supplied PDF
in `/var/lib/aushadhi/data/raw`.

The nightly wrapper invokes the coordinator with `--if-needed`. Unchanged inputs
do not create a new date cohort merely because midnight passed; the bounded
`AUSHADHI_NIGHTLY_BUILD_MAX_AGE_SECONDS` policy defaults to 604800 seconds and
accepts only 3600 through 2678400 seconds. Every promotion, including bootstrap,
must have a positive row count and at least one positive source count. Once an
index exists, the prior latest cohort is fully verified, candidate rows may not
decrease, prescribable medicines may not decrease, and every previously positive
source count may not decrease. There is no runtime recovery or bootstrap bypass
for this promotion guard.

The indexed manifest is authoritative for freshness. `.build-state.json` is only
a cache: a missing, invalid, or obstructed cache is reconciled from the fully
verified latest index and manifest. If its write fails after the index commit,
the coordinator records a typed post-commit warning and still exits successfully
so the `OnSuccess` export remains eligible; it never reports that committed
publication as a rollback.

## Current operational hold

The 1mg service is deliberately stopped and disabled because repeated fixed-index
passes produced requests but no new normalized medicines. Do not enable or start
it merely by installing this package. Resumption needs a tested release, a
one-request source-health result, and separate explicit approval. The other three
crawler services are independent of this hold.

## Split-tunnel boundary

Dalekdefender's default ProtonVPN egress is unsuitable for some catalogue sources.
Each crawler therefore has one fixed mark and policy-routing priority. The base
unit invokes `/usr/local/libexec/aushadhi-network-hook` with an exact service name;
the helper rejects every other name and action, serializes changes with a root-only
lock, and removes the unit's rules on stop.

The helper currently binds the host-specific LAN interface
`enx00e04c3e5d80`. Revalidate that interface, the main-table default route, the
Proton route guard, and all four marks before any approved installation. Do not
replace the fixed helper with shell commands assembled from unit parameters.

Crawler log redirection is performed by the service shell after systemd drops
to `aushadhi`; PID 1 must not create the files through `StandardOutput=append:`.
This keeps each current log `aushadhi:aushadhi` `0640`, allowing the fixed
observer to read fail-closed parser and source-hold markers without granting it
root execution. Before changing an existing log's metadata, require a regular,
non-symlink file, preserve its bytes, and record its prior owner, mode, size,
mtime, and hash as rollback evidence. Log rotation uses `copytruncate`, so it
preserves the corrected ownership.

## Release receipt and authority

Every installation must write `/opt/aushadhi/DEPLOYED-RELEASE.json` containing
the fields listed by `runtime-manifest.json`, including the repository commit,
tree, runtime-manifest, installed-file, dependency-tree, systemd-file, and
privileged-file hashes, timestamp, and artifact policy. A receipt describes what
was installed; it is not deployment authority.

Normal receipt generation is a live inspection: it accepts only
`/opt/aushadhi`, `/etc/systemd/system`, `/`, and
`/var/lib/aushadhi-export` as its installed, systemd, privileged, and export
roots. It records the selected source and inspected roots, verifies every
installed file and directory as root-owned and non-runtime-writable, requires
the receipt itself to be root:root `0644`, and verifies the completed receipt
after its atomic installation. `--staging-test-mode` permits disposable fixture
roots, marks the receipt `staging-test`, and is rejected by the live exporter.
Privileged helpers are independently bound to root:root and their exact modes.

The runtime artifact profile is `internal-evaluation`, is not redistributable,
and has no production authority. Restricted Janaushadhi and onemg-live material
must not enter a production-open or redistributable artifact. CDCI data remains
under `data/restricted/cdci`; this runtime manifest explicitly excludes it from
deployment and export.

## Operator preflight for a separately approved release

Before changing the host, an operator must:

1. Verify the reviewed branch is clean and record its exact commit.
2. Run the complete local test and clinical-boundary gates documented in the
   repository.
3. Compare every intended installed file with the reviewed commit and generate
   the release receipt.
4. Install `/opt/aushadhi` and its dependency tree root:root with directories
   `0755`, tracked file modes preserved, and no group/other-writable entries;
   install the final receipt root:root `0644`. Confirm each source-specific
   mutable subtree has the intended runtime ownership and mode. Verify every
   crawler log is a regular non-symlink, preserve its bytes, and set it to
   `aushadhi:aushadhi` `0640` before starting a crawler; never truncate a live
   log to repair ownership.
5. Remove legacy Aushadhi systemd drop-ins, copy the reviewed base units and fixed
   helpers, run `systemd-analyze verify`, then inspect the effective units with
   `systemctl cat` before starting anything.
6. Before any catalogue reader or crawler resumption, require one separately
   approved successful dedicated build and verify that it published
   `/var/lib/aushadhi/dist/cohort-index.json` plus its immutable generation and
   completed the bound export. A legacy `dist/latest` tree is never accepted as
   a substitute for this first indexed cohort.
7. Keep `aushadhi-crawl.service` disabled unless the same approval explicitly
   authorizes resuming 1mg.

This document intentionally does not provide a copy-and-start command sequence:
the repository package is staged for review, while deployment remains a separate
operator action.

## Read-only verification

After an approved installation, verify the effective state without changing it:

```bash
systemctl cat aushadhi-crawl.service aushadhi-apollo.service \
  aushadhi-pharmeasy.service aushadhi-netmeds.service
systemctl show -p User -p Group -p WorkingDirectory -p MemoryHigh -p MemoryMax \
  aushadhi-crawl.service aushadhi-apollo.service \
  aushadhi-pharmeasy.service aushadhi-netmeds.service
cat /opt/aushadhi/DEPLOYED-RELEASE.json
sudo /usr/local/libexec/aushadhi-observer healthcheck-apollo
sudo /usr/local/libexec/aushadhi-observer healthcheck-pharmeasy
sudo /usr/local/libexec/aushadhi-observer healthcheck-netmeds
```

Run `aushadhi-source-healthcheck.sh` only when 1mg is inactive. It performs one
marked request and removes its temporary route and NAT rule on every exit path.

## Cache retention

`scripts/compress-page-cache.sh` accepts only the four known `pages` directories
beneath `AUSHADHI_RAW_ROOT`, uses bounded parallel compression, verifies each
generated gzip stream, and refuses broad roots. Set
`AUSHADHI_CACHE_DRY_RUN=1` for a non-mutating candidate report. The separate
distribution-snapshot retention job protects the latest complete generation and
its required backups; it never deletes source data or restricted CDCI material.

## Source generation retention

`aushadhi-source-generation-retention.service` runs the root-installed
`/usr/local/libexec/aushadhi-source-generation-retention` helper as `aushadhi`.
It strictly and stably validates `cohort-index.json`, every physical direct child
of `dist/.generations`, each cohort manifest, and the manifest-bound artifacts.
Every `index.generations` entry, the latest pointer, every date pointer,
configured protected generation, and the configured newest unindexed
generations are preserved. Because the current publisher retains all historical
generation records in the index, a normal run has no deletion candidates; the
job can only classify fully verified orphan directories that are not indexed.

The tracked service is dry-run (`AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=0`)
and the weekly timer does not grant mutation authority. Apply requires the
separately installed `/etc/aushadhi/source-generation-retention-apply.conf` to
be root:root `0644` and to contain the exact
`AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=1` setting. The helper independently
checks that file, so an environment override alone is insufficient. Any such
file, service activation, or apply run requires separate explicit approval and
is not performed by this package.

Retention takes a dedicated nonblocking lock and the publisher's exact
`dist/.build.lock`, then revalidates the unchanged index, generation set,
directory inode, manifest, and artifact identities immediately before moving
one exact candidate to an inode-bound quarantine name and removing it. It never
reclaims an existing build lock. The service can write only the distribution
and its dedicated cache directory; the application, raw/restricted/CDCI, and
export trees are read-only or inaccessible. See
`docs/source-generation-retention.md` for the complete policy and refusal
conditions.
