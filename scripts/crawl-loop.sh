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
# Each iteration: rebuild artifact (merge new fetches) -> extend slug index a
# little -> exhaustively fetch every slugged drug page. On daily-cap (exit 2)
# sleep until the UTC-midnight reset; if there's genuinely nothing left to do,
# idle-poll for newly-listed drugs.
set -uo pipefail
cd "$(dirname "$0")/.."

export AUSHADHI_DAILY_CAP="${AUSHADHI_DAILY_CAP:-12000}"
export AUSHADHI_DISTINCT_EXIT_CODES=1
DISCOVER_PER_ITER="${AUSHADHI_DISCOVER_PER_ITER:-1500}"

echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') crawl-loop start (cap=${AUSHADHI_DAILY_CAP}/day, spacing=2.5s)"

while true; do
  npm run build >/dev/null 2>&1; bc=$?
  if [ "$bc" -ne 0 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: build failed rc=$bc; continuing crawl phases with the last artifact"
  fi

  node src/cli/gapfill.mjs --discover "$DISCOVER_PER_ITER"; dc=$?

  # CLI contract: exit 2 = daily cap; exit 3 = source block/robots refusal.
  if [ "$dc" -eq 3 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: discovery blocked/robots refused — holding indefinitely for human review"
    exec sleep infinity
  fi
  if [ "$dc" -eq 4 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: discovery anomaly — cursor preserved; sleeping 1h before retry without gapfill"
    sleep 3600
    continue
  fi

  if [ "$dc" -eq 2 ]; then
    echo "$(date -u '+%FT%TZ') discovery stopped at daily cap — sleeping 1h"
    sleep 3600
    continue
  fi

  if [ "$dc" -ne 0 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: discovery failed rc=$dc; running existing gapfill queue once before backoff"
  fi

  node src/cli/gapfill.mjs --all --limit 500000; gc=$?

  if [ "$gc" -eq 3 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: gapfill blocked/robots refused — holding indefinitely for human review"
    exec sleep infinity
  elif [ "$gc" -eq 2 ]; then
    echo "$(date -u '+%FT%TZ') daily cap reached — sleeping 1h for reset"
    sleep 3600
  elif [ "$gc" -ne 0 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: gapfill failed rc=$gc — sleeping 10m before retry"
    sleep 600
  elif [ "$dc" -ne 0 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: discovery failed rc=$dc; gapfill completed — sleeping 1h before discovery retry"
    sleep 3600
  elif [ "$bc" -ne 0 ]; then
    echo "$(date -u '+%FT%TZ') crawl-loop ERROR: build failed rc=$bc; crawl phases completed — sleeping 20m before build retry"
    sleep 1200
  else
    echo "$(date -u '+%FT%TZ') crawl-loop HEALTHY: discovery and gapfill completed"
    echo "$(date -u '+%FT%TZ') iteration under cap (little/nothing queued) — idle 20m"
    sleep 1200
  fi
done
