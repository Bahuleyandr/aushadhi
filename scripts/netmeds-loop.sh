#!/usr/bin/env bash
# aushadhi Netmeds crawler — always-on loop for a single always-on host.
# Politeness invariants (do NOT weaken): one instance only, per-request 2.5s
# spacing fixed in PoliteFetcher, AUSHADHI_NETMEDS_CAP bounds daily presence,
# hard-abort on repeated 403/429. Different host from 1mg -> may run concurrently.
set -uo pipefail
cd "$(dirname "$0")/.."

export AUSHADHI_NETMEDS_CAP="${AUSHADHI_NETMEDS_CAP:-20000}"
echo "$(date -u '+%FT%TZ') netmeds-loop start (cap=${AUSHADHI_NETMEDS_CAP}/day, spacing=2.5s)"

while true; do
  node src/cli/netmeds.mjs; rc=$?
  if [ "$rc" -eq 2 ]; then
    echo "$(date -u '+%FT%TZ') netmeds: daily cap / block — sleeping 1h for reset"
    sleep 3600
  elif [ "$rc" -eq 0 ]; then
    echo "$(date -u '+%FT%TZ') netmeds: crawl complete — idle 6h (re-check for new products)"
    sleep 21600
  else
    echo "$(date -u '+%FT%TZ') netmeds ERROR rc=$rc — sleeping 20m before retry"
    sleep 1200
  fi
done
