#!/usr/bin/env bash
# aushadhi Apollo Pharmacy crawler — always-on loop for a single always-on host.
# Politeness invariants (do NOT weaken): one instance only, per-request 2.5s
# spacing fixed in PoliteFetcher, AUSHADHI_APOLLO_CAP bounds daily presence,
# hard-abort on repeated 403/429. Different host from 1mg -> may run concurrently.
set -uo pipefail
cd "$(dirname "$0")/.."

readonly MAX_CAP=10000
configured_cap="${AUSHADHI_APOLLO_CAP:-10000}"
case "$configured_cap" in ''|*[!0-9]*|0) configured_cap=$MAX_CAP ;; esac
if [ "$configured_cap" -gt "$MAX_CAP" ]; then
  echo "$(date -u '+%FT%TZ') apollo: requested cap $configured_cap exceeds policy; clamped to $MAX_CAP"
  configured_cap=$MAX_CAP
fi
export AUSHADHI_APOLLO_CAP="$configured_cap"
export AUSHADHI_DISTINCT_EXIT_CODES=1
readonly HOLD_MARKER="${AUSHADHI_RAW_ROOT:-data/raw}/apollo/operator-hold"

persist_operator_hold() {
  local reason="$1"
  node --input-type=module - "$HOLD_MARKER" "apollo" "$reason" <<'NODE'
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
    echo "$(date -u '+%FT%TZ') apollo FATAL: operator-hold publication failed; refusing all further source requests"
    exec sleep infinity
  fi
  echo "$(date -u '+%FT%TZ') apollo HOLD: $reason; marker=$HOLD_MARKER"
  echo "apollo HOLD: clearance requires: stop the service, investigate, explicitly delete the marker, then start the service; this loop never clears it"
  exec sleep infinity
}

if [ -e "$HOLD_MARKER" ] || [ -L "$HOLD_MARKER" ]; then
  enter_operator_hold "persistent operator hold from an earlier source block"
fi

sleep_until_utc_reset() {
  local now_epoch reset_epoch delay
  now_epoch=$(date -u +%s)
  reset_epoch=$(date -u -d 'tomorrow 00:05:00 UTC' +%s 2>/dev/null || true)
  case "$reset_epoch" in
    ''|*[!0-9]*) delay=86400 ;;
    *) delay=$(( reset_epoch - now_epoch )); [ "$delay" -gt 0 ] || delay=86400 ;;
  esac
  echo "$(date -u '+%FT%TZ') apollo: cap reached — reset wait ${delay}s until after 00:00 UTC"
  sleep "$delay"
}

echo "$(date -u '+%FT%TZ') apollo-loop start (cap=${AUSHADHI_APOLLO_CAP}/day, spacing=2.5s)"

while true; do
  node src/cli/apollo.mjs; rc=$?
  case "$rc" in
    2)
      sleep_until_utc_reset
      ;;
    3)
      echo "$(date -u '+%FT%TZ') apollo HOLD: blocked/robots; automatic retries disabled pending human clearance"
      enter_operator_hold "blocked/robots"
      ;;
    4)
      echo "$(date -u '+%FT%TZ') apollo ERROR: discovery/parser anomaly — sleeping 1h before fail-closed retry"
      sleep 3600
      ;;
    5)
      echo "$(date -u '+%FT%TZ') apollo: NO_WORK: scheduled idle 6h"
      sleep 21600
      ;;
    0)
      echo "$(date -u '+%FT%TZ') apollo: crawl complete — scheduled idle 6h (re-check for new products)"
      sleep 21600
      ;;
    *)
      echo "$(date -u '+%FT%TZ') apollo ERROR: rc=$rc — sleeping 20m before retry"
      sleep 1200
      ;;
  esac
done
