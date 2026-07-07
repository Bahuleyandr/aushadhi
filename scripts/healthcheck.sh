#!/usr/bin/env bash
# aushadhi crawler health check — designed for a periodic watchdog (Hermes).
#
# Emits ONE line and sets exit code:
#   exit 0  -> healthy (OK: ...)          — no action
#   exit 1  -> unhealthy (ALERT: ...)     — forward the line to Telegram
#
# It is STATELESS except for NRestarts trending: the caller should remember the
# printed nrestarts=N and raise its own alert if it climbs by >=3 between runs
# (that is a crash-loop; a single occasional restart is normal — Restart=always).
#
# Run locally on dalekdefender (where Hermes runs). From elsewhere, wrap in:
#   ssh root@dd 'bash /root/aushadhi/scripts/healthcheck.sh'
set -uo pipefail

SVC=aushadhi-crawl.service
LOG=/root/aushadhi/logs/crawl.log
STATE=/root/aushadhi/data/raw/onemg/state.json
CAP="${AUSHADHI_DAILY_CAP:-12000}"
STALE_SECS="${AUSHADHI_STALE_SECS:-1800}"   # 30m of log silence BELOW cap = wedged
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

# 2) 1mg BLOCK or robots failure. These exit-2 the same as a normal cap-stop, so
#    detect them by log CONTENT, not exit code. Repeated blocks need a human.
if tail -n 120 "$LOG" 2>/dev/null | grep -Eiq "aborting after|consecutive (403|429)|refusing to crawl"; then
  echo "ALERT: aushadhi-crawl hit a 1mg BLOCK / robots failure (nrestarts=$restarts). recent: $(tail -n 3 "$LOG" 2>/dev/null | tr '\n' '~')"
  exit 1
fi

count=$(grep -o '"count":[0-9]*' "$STATE" 2>/dev/null | grep -o '[0-9]*' || echo 0)
last=$(tail -n 1 "$LOG" 2>/dev/null || echo '')
logage=$(( now - $(stat -c %Y "$LOG" 2>/dev/null || echo "$now") ))

# 3) Known-good idle states (do NOT alert):
#    - last line is a designed sleep message, or
#    - daily cap reached (sleeping until UTC-midnight reset; DD=IST so ~05:30).
if echo "$last" | grep -Eiq "sleeping 1h|idle 20m|daily cap reached"; then
  echo "OK: active, sleeping as designed (count=${count}/${CAP}, nrestarts=$restarts). last='$last'"; exit 0
fi
if [ "${count:-0}" -ge "$CAP" ]; then
  echo "OK: active, daily cap reached (count=${count}/${CAP}, nrestarts=$restarts), awaiting reset"; exit 0
fi

# 4) Below cap and not in a known sleep -> we expect fresh fetch log lines (~every 2.5s).
if [ "$logage" -gt "$STALE_SECS" ]; then
  echo "ALERT: aushadhi-crawl active but log silent ${logage}s while below cap (count=${count}/${CAP}, nrestarts=$restarts) — possibly wedged. last='$last'"
  exit 1
fi

echo "OK: active and fetching (count=${count}/${CAP}, log ${logage}s ago, nrestarts=$restarts). last='$last'"
exit 0
