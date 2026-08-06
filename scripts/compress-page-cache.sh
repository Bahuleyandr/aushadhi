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
for command_name in pigz flock sync; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "ERROR: $command_name is required for page-cache compression" >&2
    exit 2
  fi
done
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

exec {retention_lock_fd}>"$resolved_root/.cache-retention.lock"
if ! flock -n "$retention_lock_fd"; then
  echo "cache-retention: another retention pass already owns $resolved_root; skipping" >&2
  exit 0
fi

candidate_list="$(mktemp)"
recovery_list="$(mktemp)"
result_dir="$(mktemp -d)"
trap 'rm -f "$candidate_list" "$recovery_list"; rm -rf "$result_dir"' EXIT

mark_compressed() {
  mktemp "$result_dir/compressed.XXXXXX" >/dev/null
}

restore_staged_after_failure() {
  local staged="$1"
  local target="$2"
  if [ ! -e "$target" ]; then
    mv -- "$staged" "$target"
  else
    rm -- "$staged"
  fi
}

compress_staged() {
  local staged="$1"
  local target="$2"
  local archive="${target}.gz"
  local temporary_archive="${staged}.gz.tmp"

  rm -f -- "$temporary_archive"
  if ! pigz -1 -p 1 -c -- "$staged" >"$temporary_archive"; then
    rm -f -- "$temporary_archive"
    restore_staged_after_failure "$staged" "$target"
    return 1
  fi
  if ! pigz -t -- "$temporary_archive"; then
    rm -f -- "$temporary_archive"
    restore_staged_after_failure "$staged" "$target"
    return 1
  fi

  if [ -e "$target" ] || [ -e "${target}.invalid" ]; then
    rm -f -- "$temporary_archive" "$staged"
    return 0
  fi
  mv -f -- "$temporary_archive" "$archive"
  sync -f "$archive"
  if [ -e "$target" ] || [ -e "${target}.invalid" ]; then
    rm -f -- "$archive" "$staged"
    return 0
  fi
  rm -- "$staged"
  mark_compressed
}

recover_interrupted() {
  local staged="$1"
  local target="${staged%%.compressing-*}"
  compress_staged "$staged" "$target"
}

compress_candidate() {
  local target="$1"
  local staged="${target}.compressing-$$-${RANDOM}"
  if ! mv -- "$target" "$staged" 2>/dev/null; then
    return 0
  fi

  # The path may have been refreshed after discovery but before the atomic
  # move. Restore it when no newer primary appeared; never overwrite a new one.
  if [ "$min_age_minutes" -ne 0 ] \
    && ! find "$staged" -maxdepth 0 -mmin "+$min_age_minutes" -print -quit | grep -q .; then
    if [ ! -e "$target" ]; then
      mv -- "$staged" "$target"
    else
      rm -- "$staged"
    fi
    return 0
  fi

  compress_staged "$staged" "$target"
}

export -f mark_compressed restore_staged_after_failure compress_staged recover_interrupted compress_candidate
export result_dir min_age_minutes

find "${page_dirs[@]}" -xdev -type f -name '*.html.compressing-*' \
  ! -name '*.gz.tmp' -print0 >"$recovery_list"
recovery_count="$(tr -cd '\0' <"$recovery_list" | wc -c)"
if [ "$dry_run" = "0" ] && [ "$recovery_count" -gt 0 ]; then
  xargs -0 -r -n "$batch_size" -P "$jobs" \
    bash -c 'set -euo pipefail; for staged do recover_interrupted "$staged"; done' _ \
    <"$recovery_list"
fi

if [ "$min_age_minutes" -eq 0 ]; then
  find "${page_dirs[@]}" -xdev -type f -name '*.html' -print0 >"$candidate_list"
else
  find "${page_dirs[@]}" -xdev -type f -name '*.html' \
    -mmin "+$min_age_minutes" -print0 >"$candidate_list"
fi

candidate_count="$(tr -cd '\0' <"$candidate_list" | wc -c)"
echo "cache-retention: candidates=$candidate_count interrupted=$recovery_count min_age_minutes=$min_age_minutes"
if [ "$candidate_count" -eq 0 ] || [ "$dry_run" = "1" ]; then
  compressed_count="$(find "$result_dir" -type f -name 'compressed.*' | wc -l)"
  if [ "$compressed_count" -gt 0 ]; then
    echo "cache-retention: compressed_and_verified=$compressed_count"
  fi
  exit 0
fi

# Each pigz process is single-threaded; xargs supplies bounded parallelism. The
# live name is moved aside first, so a concurrent atomic refresh creates a new
# primary that compression never unlinks or overwrites.
xargs -0 -r -n "$batch_size" -P "$jobs" \
  bash -c 'set -euo pipefail; for target do compress_candidate "$target"; done' _ \
  <"$candidate_list"

compressed_count="$(find "$result_dir" -type f -name 'compressed.*' | wc -l)"
echo "cache-retention: compressed_and_verified=$compressed_count"
df -h "$resolved_root"
