#!/usr/bin/env bash
# aushadhi exhaustive 1mg crawler — always-on loop for a single always-on host.
#
# Politeness invariants (do NOT weaken):
#   - ONE instance only (systemd single-service). Never run a second crawler
#     against 1mg from any other machine/IP at the same time.
#   - Per-request spacing (2.5s) is fixed in PoliteFetcher — the real guarantee.
#   - AUSHADHI_DAILY_CAP bounds sustained daily presence; raise deliberately.
#   - Hard-abort on repeated 403/429 (BlockedError, exit 3 under this wrapper;
#     legacy callers retain exit 2) — we back off, never push through a block.
#
# Each iteration extends discovery and drains retryable work. Catalogue publication
# belongs exclusively to aushadhi-build.service so this long-running crawler can
# keep the published dist tree read-only.
# Exit 5 means discovery is deferred AND no retryable targeted work remains.
set -uo pipefail
cd "$(dirname "$0")/.."

export AUSHADHI_DAILY_CAP="${AUSHADHI_DAILY_CAP:-20000}"
export AUSHADHI_DISTINCT_EXIT_CODES=1
DISCOVER_PER_ITER="${AUSHADHI_DISCOVER_PER_ITER:-1500}"
NO_WORK_SLEEP_SECONDS="${AUSHADHI_NO_WORK_SLEEP_SECONDS:-3600}"
readonly HOLD_MARKER="${AUSHADHI_RAW_ROOT:-data/raw}/onemg/operator-hold"

persist_operator_hold() {
  local reason="$1"
  node --input-type=module - "$HOLD_MARKER" "onemg" "$reason" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const marker = process.argv[2];
const source = process.argv[3];
const reason = process.argv[4].replace(/[\r\n]/g, ' ');
const parent = path.dirname(marker);
const { O_CREAT, O_DIRECTORY, O_EXCL, O_NOFOLLOW, O_RDONLY, O_WRONLY } = fs.constants;

function syncRegularMarkerAndParent() {
  const markerLink = fs.lstatSync(marker);
  if (markerLink.isSymbolicLink() || !markerLink.isFile()) {
    throw new Error('operator-hold marker is not a regular non-symlink file');
  }

  const markerFd = fs.openSync(marker, O_RDONLY | O_NOFOLLOW);
  try {
    if (!fs.fstatSync(markerFd).isFile()) throw new Error('opened operator-hold marker is not regular');
    fs.fsyncSync(markerFd);
  } finally {
    fs.closeSync(markerFd);
  }

  const parentLink = fs.lstatSync(parent);
  if (parentLink.isSymbolicLink() || !parentLink.isDirectory()) {
    throw new Error('operator-hold parent is not a regular directory');
  }
  const parentFd = fs.openSync(parent, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
  try {
    if (!fs.fstatSync(parentFd).isDirectory()) throw new Error('opened operator-hold parent is not a directory');
    fs.fsyncSync(parentFd);
  } finally {
    fs.closeSync(parentFd);
  }
}

try {
  if (O_NOFOLLOW === undefined || O_DIRECTORY === undefined) {
    throw new Error('required no-follow/directory open flags are unavailable');
  }
  fs.mkdirSync(parent, { recursive: true, mode: 0o750 });
  const writableParent = fs.lstatSync(parent);
  if (writableParent.isSymbolicLink() || !writableParent.isDirectory()) {
    throw new Error('operator-hold parent is not a regular directory');
  }
  let createdFd;
  try {
    createdFd = fs.openSync(marker, O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW, 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  if (createdFd !== undefined) {
    try {
      fs.writeFileSync(createdFd,
        `source=${source}\nheld_at_utc=${new Date().toISOString()}\nreason=${reason}\n`);
      fs.fsyncSync(createdFd);
    } finally {
      fs.closeSync(createdFd);
    }
  }
  syncRegularMarkerAndParent();
} catch (error) {
  console.error(`operator-hold publication failed: ${error.message}`);
  process.exitCode = 1;
}
NODE
}

enter_operator_hold() {
  local reason="$1"
  if ! persist_operator_hold "$reason"; then
    echo "$(date -u '+%FT%TZ') crawl-loop FATAL: operator-hold publication failed; refusing all further source requests"
    exec sleep infinity
  fi
  echo "$(date -u '+%FT%TZ') crawl-loop HOLD: $reason; marker=$HOLD_MARKER"
  echo "crawl-loop HOLD: clearance requires: stop the service, investigate, explicitly delete the marker, then start the service; this loop never clears it"
  exec sleep infinity
}

if [ -e "$HOLD_MARKER" ] || [ -L "$HOLD_MARKER" ]; then
  enter_operator_hold "persistent operator hold from an earlier source block"
fi

sleep_until_utc_reset() {
  local seconds
  seconds="$(node -e '
    const now = new Date();
    const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 5);
    process.stdout.write(String(Math.max(1, Math.ceil((reset - now.getTime()) / 1000))));
  ')"
  echo "$(date -u '+%FT%TZ') daily cap reached — sleeping ${seconds}s until the UTC reset"
  sleep "$seconds"
}

echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') crawl-loop start (cap=${AUSHADHI_DAILY_CAP}/day, spacing=2.5s)"

while true; do
  node src/cli/gapfill.mjs --discover "$DISCOVER_PER_ITER"; dc=$?

  # CLI contract: exit 2 = daily cap; 3 = source block/robots refusal;
  # 4 = anomaly; 5 = discovery deferred and no retryable target remains.
  if [ "$dc" -eq 3 ]; then
    enter_operator_hold "discovery blocked/robots refused"
  fi
  if [ "$dc" -eq 4 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: discovery anomaly — cursor preserved; sleeping 1h before retry without gapfill"
    sleep 3600
    continue
  fi

  if [ "$dc" -eq 5 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop NO_WORK: discovery deferred and no retryable work remains — idle ${NO_WORK_SLEEP_SECONDS}s"
    sleep "$NO_WORK_SLEEP_SECONDS"
    continue
  fi

  if [ "$dc" -eq 2 ]; then
    sleep_until_utc_reset
    continue
  fi

  if [ "$dc" -ne 0 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: discovery failed rc=$dc; running existing gapfill queue once before backoff"
  fi

  node src/cli/gapfill.mjs --all --limit 500000; gc=$?

  if [ "$gc" -eq 3 ]; then
    enter_operator_hold "gapfill blocked/robots refused"
  elif [ "$gc" -eq 2 ]; then
    sleep_until_utc_reset
  elif [ "$gc" -eq 5 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop NO_WORK: no retryable gapfill work remains — idle ${NO_WORK_SLEEP_SECONDS}s"
    sleep "$NO_WORK_SLEEP_SECONDS"
  elif [ "$gc" -ne 0 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: gapfill failed rc=$gc — sleeping 10m before retry"
    sleep 600
  elif [ "$dc" -ne 0 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: discovery failed rc=$dc; gapfill completed — sleeping 1h before discovery retry"
    sleep 3600
  else
    echo "$(date -u '+%FT%TZ') crawl-loop HEALTHY: discovery and gapfill completed"
    echo "$(date -u '+%FT%TZ') iteration under cap (little/nothing queued) — idle 20m"
    sleep 1200
  fi
done
