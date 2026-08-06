#!/usr/bin/env bash
# Nightly rebuild + quality report. The cohort builder holds the shared build lock,
# stages every output under one generation ID, verifies it, then publishes it.
# Driven by aushadhi-build.timer on DD.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

nightly_error() {
  local rc="$1" line="$2" command="$3" timestamp receipt message
  timestamp="$(date -u '+%FT%TZ')"
  receipt="${AUSHADHI_BUILD_RECEIPT_DIR:-${AUSHADHI_DIST_ROOT:-dist}/.receipts}/nightly-build-error.log"
  printf -v message '%s nightly-build ERROR: rc=%s line=%s command=%q\n' "$timestamp" "$rc" "$line" "$command"
  mkdir -p "$(dirname "$receipt")" || true
  printf '%s' "$message" | tee -a "$receipt" >&2 || printf '%s' "$message" >&2
  exit "$rc"
}
trap 'nightly_error "$?" "$LINENO" "$BASH_COMMAND"' ERR

readonly max_age_seconds="${AUSHADHI_NIGHTLY_BUILD_MAX_AGE_SECONDS:-604800}"
[[ "$max_age_seconds" =~ ^[0-9]+$ ]] \
  && [ "$max_age_seconds" -ge 3600 ] \
  && [ "$max_age_seconds" -le 2678400 ] || {
  printf '%s\n' 'REFUSED: AUSHADHI_NIGHTLY_BUILD_MAX_AGE_SECONDS must be between 3600 and 2678400' >&2
  exit 2
}

echo "$(date -u '+%FT%TZ') nightly-build start"
node src/cli/build-cohort.mjs --if-needed --max-age-seconds "$max_age_seconds" --reason nightly
echo "$(date -u '+%FT%TZ') nightly-build done"
