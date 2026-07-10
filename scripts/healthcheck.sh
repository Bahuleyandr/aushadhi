#!/usr/bin/env bash
# aushadhi crawler health check — designed for a periodic watchdog (Hermes).
#
# Emits ONE line and sets exit code:
#   exit 0  -> healthy (OK: ...)          — no action
#   exit 1  -> unhealthy (ALERT: ...)     — forward to the configured alert channel
#
# It is STATELESS except for NRestarts trending: the caller should remember the
# printed nrestarts=N and raise its own alert if it climbs by >=3 between runs
# (that is a crash-loop; a single occasional restart is normal — Restart=always).
#
# Run locally on dalekdefender (where Hermes runs). From elsewhere, wrap in:
#   ssh root@dd 'bash /root/aushadhi/scripts/healthcheck.sh'
set -uo pipefail

SVC="${AUSHADHI_SERVICE:-aushadhi-crawl.service}"
LOG="${AUSHADHI_LOG:-/root/aushadhi/logs/crawl.log}"
STATE="${AUSHADHI_STATE:-/root/aushadhi/data/raw/onemg/state.json}"
OUTPUT="${AUSHADHI_OUTPUT:-/root/aushadhi/data/raw/onemg/$(date -u +%F)/normalized.jsonl}"
# derive the real cap from the running unit so this never drifts from the service
CAP="${AUSHADHI_DAILY_CAP:-$(systemctl show "$SVC" -p Environment --value 2>/dev/null | tr ' ' '\n' | sed -n 's/^AUSHADHI_DAILY_CAP=//p')}"
CAP="${CAP:-12000}"
STALE_SECS="${AUSHADHI_STALE_SECS:-1800}"   # 30m of log silence BELOW cap = wedged
case "$CAP" in ''|*[!0-9]*) CAP=12000 ;; esac
case "$STALE_SECS" in ''|*[!0-9]*) STALE_SECS=1800 ;; esac
MISSING_AGE=2147483647
now=$(date -u +%s)

active=$(systemctl is-active "$SVC" 2>/dev/null || true)
restarts=$(systemctl show "$SVC" -p NRestarts --value 2>/dev/null || echo '?')

# 1) service must be up. Restart=always means a healthy service is 'active';
#    'failed'/'inactive'/stuck 'activating' = it is NOT running our loop.
if [ "$active" != "active" ]; then
  detail=$(systemctl show "$SVC" -p ActiveState,SubState,Result,ExecMainStatus --value 2>/dev/null | tr '\n' ' ')
  echo "ALERT: aushadhi-crawl is '$active' (nrestarts=$restarts) [$detail] last='$(tail -n1 "$LOG" 2>/dev/null)'"
  exit 1
fi

count=$(grep -oE '"count"[[:space:]]*:[[:space:]]*[0-9]+' "$STATE" 2>/dev/null | grep -oE '[0-9]+' | head -n1 || true)
state_valid=1
if [ -z "$count" ]; then
  count=0
  state_valid=0
fi
last=$(tail -n 1 "$LOG" 2>/dev/null || echo '')
log_mtime=$(stat -c %Y "$LOG" 2>/dev/null || echo 0)
if [ "$log_mtime" -gt 0 ]; then
  logage=$(( now - log_mtime ))
else
  logage=$MISSING_AGE
fi
state_mtime=$(stat -c %Y "$STATE" 2>/dev/null || echo 0)
if [ "$state_valid" -eq 1 ] && [ "$state_mtime" -gt 0 ]; then
  stateage=$(( now - state_mtime ))
else
  stateage=$MISSING_AGE
fi
output_mtime=$(stat -c %Y "$OUTPUT" 2>/dev/null || echo 0)
if [ "$output_mtime" -gt 0 ]; then
  outputage=$(( now - output_mtime ))
else
  outputage=$MISSING_AGE
fi
if [ "$logage" -lt 0 ]; then logage=0; fi
if [ "$stateage" -lt 0 ]; then stateage=0; fi
if [ "$outputage" -lt 0 ]; then outputage=0; fi

# Read the newest relevant status event in file order. This lets a later HEALTHY
# marker clear an earlier phase error or block without keeping local state.
status_marker=$(grep -Ei "crawl-loop (ERROR|HEALTHY):|aborting after|consecutive (403|429)|refusing to crawl|blocked/robots refused" "$LOG" 2>/dev/null | tail -n1 || true)
if echo "$status_marker" | grep -Eiq "aborting after|consecutive (403|429)|refusing to crawl|blocked/robots refused"; then
  echo "ALERT: aushadhi-crawl hit a 1mg BLOCK / robots failure (count=${count}/${CAP}, nrestarts=$restarts). marker='$status_marker' last='$last'"
  exit 1
fi
if echo "$status_marker" | grep -Eq "crawl-loop ERROR:"; then
  echo "ALERT: aushadhi-crawl phase failure (count=${count}/${CAP}, nrestarts=$restarts). marker='$status_marker' last='$last'"
  exit 1
fi

# 3) Network fetches update state.json; cache-only gapfill pages append today's
#    normalized JSONL. Treat any of those files as a valid activity witness.
activityage=$logage
activity=log
if [ "$stateage" -lt "$activityage" ]; then
  activityage=$stateage
  activity=state
fi
if [ "$outputage" -lt "$activityage" ]; then
  activityage=$outputage
  activity=output
fi

# 4) Designed sleeps are healthy only for their bounded interval plus grace.
#    A stale old sleep line must not hide a process wedged after logging it.
sleep_grace=0
if echo "$last" | grep -Eiq "idle 20m"; then
  sleep_grace=1800
elif echo "$last" | grep -Eiq "sleeping 1h|daily cap reached" || [ "${count:-0}" -ge "$CAP" ]; then
  sleep_grace=4500
fi
if [ "$sleep_grace" -gt 0 ] && [ "$activityage" -le "$sleep_grace" ]; then
  echo "OK: active, sleeping as designed (count=${count}/${CAP}, activity=${activity}:${activityage}s, grace=${sleep_grace}s, nrestarts=$restarts). last='$last'"
  exit 0
fi

if [ "$activityage" -gt "$STALE_SECS" ]; then
  echo "ALERT: aushadhi-crawl activity silent ${activityage}s while below cap (count=${count}/${CAP}, logage=${logage}s, stateage=${stateage}s, outputage=${outputage}s, nrestarts=$restarts) — possibly wedged. last='$last'"
  exit 1
fi

echo "OK: active and fetching (count=${count}/${CAP}, activity=${activity}:${activityage}s, logage=${logage}s, stateage=${stateage}s, outputage=${outputage}s, nrestarts=$restarts). last='$last'"
exit 0
