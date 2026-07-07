#!/usr/bin/env bash
# aushadhi exhaustive 1mg crawler — always-on loop for a single always-on host.
#
# Politeness invariants (do NOT weaken):
#   - ONE instance only (systemd single-service). Never run a second crawler
#     against 1mg from any other machine/IP at the same time.
#   - Per-request spacing (2.5s) is fixed in PoliteFetcher — the real guarantee.
#   - AUSHADHI_DAILY_CAP bounds sustained daily presence; raise deliberately.
#   - Hard-abort on repeated 403/429 (BlockedError, exit 2) — we back off, we
#     never push through a block.
#
# Each iteration: rebuild artifact (merge new fetches) -> extend slug index a
# little -> exhaustively fetch every slugged drug page. On daily-cap (exit 2)
# sleep until the UTC-midnight reset; if there's genuinely nothing left to do,
# idle-poll for newly-listed drugs.
set -uo pipefail
cd "$(dirname "$0")/.."

export AUSHADHI_DAILY_CAP="${AUSHADHI_DAILY_CAP:-12000}"
DISCOVER_PER_ITER="${AUSHADHI_DISCOVER_PER_ITER:-1500}"

echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') crawl-loop start (cap=${AUSHADHI_DAILY_CAP}/day, spacing=2.5s)"

while true; do
  npm run build >/dev/null 2>&1 || echo "$(date -u '+%FT%TZ') build failed (non-fatal)"

  node src/cli/gapfill.mjs --discover "$DISCOVER_PER_ITER"; dc=$?
  node src/cli/gapfill.mjs --all --limit 500000; gc=$?

  if [ "$dc" -eq 2 ] || [ "$gc" -eq 2 ]; then
    echo "$(date -u '+%FT%TZ') daily cap reached — sleeping 1h for reset"
    sleep 3600
  else
    echo "$(date -u '+%FT%TZ') iteration under cap (little/nothing queued) — idle 20m"
    sleep 1200
  fi
done
