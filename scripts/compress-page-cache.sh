#!/usr/bin/env bash
# Compress old raw page-cache entries without touching normalized data, crawler
# state, indexes, or build artifacts.
set -euo pipefail

raw_root="${AUSHADHI_RAW_ROOT:-data/raw}"
min_age_minutes="${AUSHADHI_CACHE_MIN_AGE_MINUTES:-360}"
jobs="${AUSHADHI_CACHE_COMPRESS_JOBS:-4}"
batch_size="${AUSHADHI_CACHE_COMPRESS_BATCH_SIZE:-64}"
dry_run="${AUSHADHI_CACHE_DRY_RUN:-0}"

for value_name in min_age_minutes jobs batch_size; do
  value="${!value_name}"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "ERROR: $value_name must be a non-negative integer (got '$value')" >&2
    exit 2
  fi
done
if [ "$jobs" -eq 0 ] || [ "$batch_size" -eq 0 ]; then
  echo "ERROR: jobs and batch_size must be greater than zero" >&2
  exit 2
fi
if [ "$dry_run" != "0" ] && [ "$dry_run" != "1" ]; then
  echo "ERROR: AUSHADHI_CACHE_DRY_RUN must be 0 or 1" >&2
  exit 2
fi
if ! command -v pigz >/dev/null 2>&1; then
  echo "ERROR: pigz is required for page-cache compression" >&2
  exit 2
fi
if [ ! -d "$raw_root" ]; then
  echo "ERROR: raw root does not exist: $raw_root" >&2
  exit 2
fi

resolved_root="$(realpath "$raw_root")"
case "$resolved_root" in
  /|/var|/var/lib|/var/lib/aushadhi|/var/lib/aushadhi/data)
    echo "ERROR: refusing unsafe raw root: $resolved_root" >&2
    exit 2
    ;;
esac

page_dirs=()
for source in onemg apollo pharmeasy netmeds; do
  page_dir="$resolved_root/$source/pages"
  if [ -d "$page_dir" ]; then
    page_dirs+=("$page_dir")
  fi
done
if [ "${#page_dirs[@]}" -eq 0 ]; then
  echo "cache-retention: no source page directories found under $resolved_root"
  exit 0
fi

candidate_list="$(mktemp)"
trap 'rm -f "$candidate_list"' EXIT
if [ "$min_age_minutes" -eq 0 ]; then
  find "${page_dirs[@]}" -xdev -type f -name '*.html' -print0 >"$candidate_list"
else
  find "${page_dirs[@]}" -xdev -type f -name '*.html' \
    -mmin "+$min_age_minutes" -print0 >"$candidate_list"
fi

candidate_count="$(tr -cd '\0' <"$candidate_list" | wc -c)"
echo "cache-retention: candidates=$candidate_count min_age_minutes=$min_age_minutes"
if [ "$candidate_count" -eq 0 ] || [ "$dry_run" = "1" ]; then
  exit 0
fi

# Each pigz process is single-threaded; xargs supplies bounded parallelism.
# -f replaces an older compressed copy when a deliberately refreshed page exists.
xargs -0 -r -n "$batch_size" -P "$jobs" \
  pigz -1 -p 1 -f -- <"$candidate_list"

sed -z 's/\.html$/.html.gz/' <"$candidate_list" \
  | xargs -0 -r -n "$batch_size" -P "$jobs" pigz -t --

echo "cache-retention: compressed_and_verified=$candidate_count"
df -h "$resolved_root"
