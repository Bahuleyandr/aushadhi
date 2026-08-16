#!/usr/bin/env bash
# Stateless crawler watchdog. Emits exactly one OK/ALERT line for Hermes.
set -uo pipefail

SVC="${AUSHADHI_SERVICE:-aushadhi-crawl.service}"
RAW_ROOT="${AUSHADHI_RAW_ROOT:-/var/lib/aushadhi/data/raw}"
LOG_ROOT="${AUSHADHI_LOG_ROOT:-/var/log/aushadhi}"

case "$SVC" in
  aushadhi-crawl.service) default_source=onemg; log_name=crawl; cap_var=AUSHADHI_DAILY_CAP; default_cap=20000; index_name=slug-index.jsonl ;;
  aushadhi-apollo.service) default_source=apollo; log_name=apollo; cap_var=AUSHADHI_APOLLO_CAP; default_cap=10000; index_name=salt-index.jsonl ;;
  aushadhi-pharmeasy.service) default_source=pharmeasy; log_name=pharmeasy; cap_var=AUSHADHI_PHARMEASY_CAP; default_cap=20000; index_name=product-index.jsonl ;;
  aushadhi-netmeds.service) default_source=netmeds; log_name=netmeds; cap_var=AUSHADHI_NETMEDS_CAP; default_cap=20000; index_name=product-index.jsonl ;;
  *) default_source=unknown; log_name=crawl; cap_var=AUSHADHI_DAILY_CAP; default_cap=20000; index_name=product-index.jsonl ;;
esac

SOURCE="${AUSHADHI_SOURCE:-$default_source}"
SOURCE_ROOT="${AUSHADHI_SOURCE_ROOT:-$RAW_ROOT/$SOURCE}"
LOG="${AUSHADHI_LOG:-$LOG_ROOT/$SOURCE/$log_name.log}"
STATE="${AUSHADHI_STATE:-$SOURCE_ROOT/state.json}"
INDEX="${AUSHADHI_INDEX:-$SOURCE_ROOT/$index_name}"
HOLD_MARKER="${AUSHADHI_HOLD_MARKER:-$SOURCE_ROOT/operator-hold}"
OUTPUT="${AUSHADHI_OUTPUT:-}"
STALE_SECS="${AUSHADHI_STALE_SECS:-1800}"
PRODUCTIVE_STALE_SECS="${AUSHADHI_PRODUCTIVE_STALE_SECS:-21600}"
INDEX_STALE_SECS="${AUSHADHI_INDEX_STALE_SECS:-172800}"
MISSING_AGE=2147483647
now=$(date -u +%s)

unit_environment=$(systemctl show "$SVC" -p Environment --value 2>/dev/null || true)
CAP="${AUSHADHI_CAP:-}"
if [ -z "$CAP" ]; then CAP=$(printenv "$cap_var" 2>/dev/null || true); fi
if [ -z "$CAP" ]; then
  CAP=$(printf '%s\n' "$unit_environment" | tr ' ' '\n' | sed -n "s/^${cap_var}=//p" | tail -n1)
fi
CAP="${CAP:-$default_cap}"
case "$CAP" in ''|*[!0-9]*) CAP=$default_cap ;; esac
if [ "$SOURCE" != onemg ] && [ "$CAP" -gt "$default_cap" ]; then CAP=$default_cap; fi
case "$STALE_SECS" in ''|*[!0-9]*) STALE_SECS=1800 ;; esac
case "$PRODUCTIVE_STALE_SECS" in ''|*[!0-9]*) PRODUCTIVE_STALE_SECS=21600 ;; esac
case "$INDEX_STALE_SECS" in ''|*[!0-9]*) INDEX_STALE_SECS=172800 ;; esac

active=$(systemctl is-active "$SVC" 2>/dev/null || true)
enabled=$(systemctl is-enabled "$SVC" 2>/dev/null || true)
substate=$(systemctl show "$SVC" -p SubState --value 2>/dev/null || true)
restarts=$(systemctl show "$SVC" -p NRestarts --value 2>/dev/null || echo '?')
if [ -L "$LOG" ] || [ ! -f "$LOG" ] || [ ! -r "$LOG" ]; then
  if [ -L "$LOG" ]; then log_kind=symlink
  elif [ ! -e "$LOG" ]; then log_kind=missing
  elif [ ! -f "$LOG" ]; then log_kind=non-regular
  else log_kind=unreadable
  fi
  echo "ALERT: $SOURCE log-unreadable kind=$log_kind path='$LOG' liveness=${active:-unknown}/${substate:-unknown} service=$SVC nrestarts=$restarts"
  exit 1
fi
if ! last=$(tail -n 1 "$LOG" 2>/dev/null); then
  echo "ALERT: $SOURCE log-read-failed path='$LOG' liveness=${active:-unknown}/${substate:-unknown} service=$SVC nrestarts=$restarts"
  exit 1
fi
if [ -e "$HOLD_MARKER" ] || [ -L "$HOLD_MARKER" ]; then
  if [ -f "$HOLD_MARKER" ] && [ ! -L "$HOLD_MARKER" ]; then marker_kind=regular; else marker_kind=unsafe; fi
  echo "ALERT: $SOURCE operator-hold marker present human-hold required marker='$HOLD_MARKER' marker_kind=$marker_kind liveness=${active:-unknown}/${substate:-unknown} nrestarts=$restarts last='$last'"
  exit 1
fi
if [ "$SOURCE" = onemg ] && [ "$active" = inactive ] \
  && { [ "$enabled" = disabled ] || [ "$enabled" = masked ]; }; then
  echo "OK: onemg intentionally-disabled liveness=$active/${substate:-unknown} enablement=$enabled nrestarts=$restarts last='$last'"
  exit 0
fi
if [ "$active" != active ] || [ "$substate" != running ]; then
  detail=$(systemctl show "$SVC" -p ActiveState,SubState,Result,ExecMainStatus 2>/dev/null | tr '\n' ' ')
  echo "ALERT: $SOURCE liveness=${active:-unknown}/${substate:-unknown} service=$SVC nrestarts=$restarts detail='$detail' last='$last'"
  exit 1
fi

state_fields=$(node - "$STATE" "$SOURCE" 2>/dev/null <<'NODE' || true
const fs = require('node:fs');
const [file, source] = process.argv.slice(2);
try {
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  const refresh = source === 'onemg'
    ? (state.discover ?? {}) : (state[source]?.indexRefresh ?? {});
  const fields = [state.count, state.date, refresh.completedAt ?? refresh.completed_at, refresh.startedAt ?? refresh.started_at];
  process.stdout.write(fields.map((value) => value ?? '').join('|'));
} catch {}
NODE
)
IFS='|' read -r count state_date index_completed index_started <<< "$state_fields"
state_valid=1
case "$count" in ''|*[!0-9]*) count=0; state_valid=0 ;; esac
if [ "$state_valid" -ne 1 ]; then
  echo "ALERT: $SOURCE state-invalid liveness=active/running service=$SVC state='$STATE' nrestarts=$restarts last='$last'"
  exit 1
fi

age_from_epoch() {
  local epoch="$1"
  if [ -z "$epoch" ] || [ "$epoch" -le 0 ] 2>/dev/null; then
    printf '%s' "$MISSING_AGE"
  elif [ "$epoch" -gt "$now" ]; then
    printf '0'
  else
    printf '%s' "$(( now - epoch ))"
  fi
}

logage=$(age_from_epoch "$(stat -c %Y "$LOG" 2>/dev/null || echo 0)")
if [ "$state_valid" -eq 1 ]; then
  stateage=$(age_from_epoch "$(stat -c %Y "$STATE" 2>/dev/null || echo 0)")
else
  stateage=$MISSING_AGE
fi
index_epoch=$(date -u -d "$index_completed" +%s 2>/dev/null || stat -c %Y "$INDEX" 2>/dev/null || echo 0)
indexage=$(age_from_epoch "$index_epoch")

if [ -n "$OUTPUT" ]; then
  if [ -s "$OUTPUT" ]; then output_epoch=$(stat -c %Y "$OUTPUT" 2>/dev/null || echo 0); else output_epoch=0; fi
else
  output_epoch=$(find "$SOURCE_ROOT" -mindepth 2 -maxdepth 2 -type f -name normalized.jsonl -size +0c \
    -printf '%T@\n' 2>/dev/null | sort -nr | head -n1 | cut -d. -f1)
fi
outputage=$(age_from_epoch "${output_epoch:-0}")

age_label() {
  if [ "$1" -eq "$MISSING_AGE" ]; then printf 'missing'; else printf '%ss' "$1"; fi
}
logage_label=$(age_label "$logage")
stateage_label=$(age_label "$stateage")
outputage_label=$(age_label "$outputage")
indexage_label=$(age_label "$indexage")

status_marker=$(grep -Ei \
  'crawl-loop (ERROR|HEALTHY|NO_WORK):|(^|[[:space:]])discover:.*links=[1-9][0-9]*|(^|[[:space:]])(apollo|pharmeasy|netmeds) (HOLD|ERROR):|STOPPED:|aborting after|refusing to crawl|robots\.txt (fetch failed|disallows)|blocked/robots|done:|crawl complete|scheduled idle|cap reached' \
  "$LOG" 2>/dev/null | tail -n1 || true)

zero_yield_runs=$(grep -Ei 'done:|NO_WORK:' "$LOG" 2>/dev/null | tail -n64 | awk '
  /NO_WORK:/ || /done:.*added[=:][[:space:]]*0([^0-9]|$)/ || /done:[[:space:]]*0[[:space:]]+((products|drugs)[[:space:]]+this run|pages parsed)/ { streak += 1; next }
  /done:/ { streak = 0 }
  END { print streak + 0 }
')

if printf '%s\n' "$status_marker" | grep -Eiq 'HOLD:|aborting after|refusing to crawl|robots\.txt (fetch failed|disallows)|blocked/robots'; then
  echo "ALERT: $SOURCE blocked/robots human-hold required count=${count}/${CAP} liveness=active/running outputage=$outputage_label indexage=$indexage_label zero_yield_runs=$zero_yield_runs nrestarts=$restarts marker='$status_marker'"
  exit 1
fi
if printf '%s\n' "$status_marker" | grep -Eiq 'crawl-loop ERROR:| (apollo|pharmeasy|netmeds) ERROR:|discovery/parser anomaly'; then
  echo "ALERT: $SOURCE phase anomaly count=${count}/${CAP} liveness=active/running outputage=$outputage_label indexage=$indexage_label zero_yield_runs=$zero_yield_runs nrestarts=$restarts marker='$status_marker'"
  exit 1
fi

activityage=$logage
activity=log
if [ "$stateage" -lt "$activityage" ]; then activityage=$stateage; activity=state; fi
if [ "$outputage" -lt "$activityage" ]; then activityage=$outputage; activity=output; fi
if [ "$indexage" -lt "$activityage" ]; then activityage=$indexage; activity=index; fi

if [ "$outputage" -eq "$MISSING_AGE" ]; then productive=missing
elif [ "$outputage" -gt "$PRODUCTIVE_STALE_SECS" ]; then productive=stale
else productive=fresh
fi
if [ -n "$index_started" ]; then index_state=refreshing
elif [ "$indexage" -eq "$MISSING_AGE" ]; then index_state=missing
elif [ "$indexage" -gt "$INDEX_STALE_SECS" ]; then index_state=stale
else index_state=fresh
fi
if [ "$zero_yield_runs" -ge 2 ]; then terminal_state=repeated-zero-yield
elif [ "$zero_yield_runs" -eq 1 ]; then terminal_state=zero-yield
else terminal_state=productive
fi

sleep_grace=0
if printf '%s\n' "$status_marker" | grep -Eiq 'reset wait [0-9]+s'; then
  reset_wait=$(printf '%s\n' "$status_marker" | sed -n 's/.*reset wait \([0-9][0-9]*\)s.*/\1/p')
  sleep_grace=$(( ${reset_wait:-86400} + 600 ))
elif printf '%s\n' "$last" | grep -Eiq 'idle [0-9]+s'; then
  idle_wait=$(printf '%s\n' "$last" | sed -n 's/.*idle \([0-9][0-9]*\)s.*/\1/p')
  sleep_grace=$(( ${idle_wait:-3600} + 600 ))
elif printf '%s\n' "$status_marker" | grep -Eiq 'scheduled idle 6h|NO_WORK:|crawl complete'; then
  sleep_grace=23400
elif printf '%s\n' "$status_marker" | grep -Eiq 'sleeping 20m'; then
  sleep_grace=1800
elif printf '%s\n' "$status_marker" | grep -Eiq 'sleeping 1h'; then
  sleep_grace=4500
elif printf '%s\n' "$status_marker" | grep -Eiq 'cap reached' || { [ "$count" -ge "$CAP" ] && [ "$state_date" = "$(date -u +%F)" ]; }; then
  sleep_grace=90000
fi

facts="count=${count}/${CAP} liveness=active/running activity=${activity}:${activityage}s logage=$logage_label stateage=$stateage_label outputage=$outputage_label productive=$productive indexage=$indexage_label index=$index_state terminal=$terminal_state zero_yield_runs=$zero_yield_runs nrestarts=$restarts"
if [ "$sleep_grace" -gt 0 ] && [ "$logage" -le "$sleep_grace" ]; then
  echo "OK: $SOURCE scheduled-wait $facts grace=${sleep_grace}s last='$last'"
  exit 0
fi
if [ "$activityage" -gt "$STALE_SECS" ]; then
  echo "ALERT: $SOURCE activity-silent $facts threshold=${STALE_SECS}s last='$last'"
  exit 1
fi

echo "OK: $SOURCE active $facts last='$last'"
exit 0
