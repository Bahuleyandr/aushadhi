# Phase 4 deployment record — retired

This file described a 2026-07 deployment procedure for an earlier split build,
root-owned runtime, and hand-copied release. It is retained only as a historical
pointer. **Do not execute the former procedure.** Its paths, hashes, test counts,
service ownership, exporter schema, and rollback assumptions are obsolete.

The reviewed runtime source of truth is now
`deploy/dalekdefender/README.md` together with
`deploy/dalekdefender/runtime-manifest.json`. The current design requires:

- a clean, immutable `/opt/aushadhi` release owned by root;
- all long-running and build processes to run as the unprivileged `aushadhi`
  account with narrowly writable state directories;
- an atomic, manifest-bound catalogue cohort rather than separate build,
  prescribable, and report publication steps;
- an exact, post-install-verified `DEPLOYED-RELEASE.json` binding the repository,
  caller-selected inspection roots, root-owned installed-tree metadata,
  dependencies, systemd units, root-owned privileged helpers, and runtime policy;
- restricted CDCI and internal-evaluation interaction data to remain outside
  deployed and redistributable artifacts; and
- separate explicit approval before any installation, start, enable, restart,
  crawler resumption, or deployment action.

The 1mg service is intentionally stopped and disabled pending a tested release,
a one-request source-health result, and explicit approval to resume it. This
repository update does not grant that approval.
