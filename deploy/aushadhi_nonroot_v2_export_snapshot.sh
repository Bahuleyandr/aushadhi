#!/usr/bin/env bash
# Unprivileged Aushadhi post-build export snapshotter.
set -Eeuo pipefail
umask 027

if [ "${EUID}" -eq 0 ]; then
  printf '%s\n' 'REFUSED: exporter must not run as root' >&2
  exit 2
fi
if [ "${AUSHADHI_EXPORT_TESTING:-0}" = "1" ]; then
  readonly REPO="${AUSHADHI_EXPORT_REPO:?test repo required}"
  readonly DIST_ROOT="$REPO/dist"
  readonly STATE_ROOT="$REPO/data"
  readonly STAGING="${AUSHADHI_EXPORT_STAGING:?test staging required}"
  readonly ZSTD="${AUSHADHI_EXPORT_ZSTD:-/usr/bin/zstd}"
else
  [ "$(/usr/bin/id -un)" = "aushadhi" ] || {
    printf '%s\n' 'REFUSED: exporter must run as aushadhi' >&2
    exit 2
  }
  readonly REPO="/opt/aushadhi"
  readonly DIST_ROOT="/var/lib/aushadhi/dist"
  readonly STATE_ROOT="/var/lib/aushadhi/data"
  readonly STAGING="/var/lib/aushadhi-export"
  readonly ZSTD="/usr/bin/zstd"
fi
readonly RETAIN=14
readonly STATE_CAP_BYTES=$((2 * 1024 * 1024 * 1024))
readonly -a STATE_EXCLUDE_ARGS=(--exclude=pages --exclude=restricted)

log() { printf '%s %s\n' "$(/bin/date -u '+%FT%TZ')" "$*"; }

# Symlink-safe, atomic compression of a dist-relative file to a zstd artifact plus a
# side-metadata json (record_count/size/sha256 of source and artifact). Shared by the
# primary drugs.jsonl and the optional prescribable.jsonl so both get identical hardening.
compress_dist_file() {  # $1=dist-relative path  $2=output .zst  $3=metadata json
  /usr/bin/python3 - "$DIST_ROOT" "$1" "$2" "$3" "$ZSTD" <<'PYSOURCE'
import hashlib
import json
import os
import stat
import subprocess
import sys
from pathlib import PurePosixPath

root, relative, output, metadata, zstd = sys.argv[1:6]
parts = PurePosixPath(relative).parts
if not parts or PurePosixPath(relative).is_absolute() or any(part in {"", ".", ".."} for part in parts):
    raise SystemExit("REFUSED: invalid relative export path")
flags_dir = os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
flags_file = os.O_RDONLY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
opened = []
try:
    dir_fd = os.open(root, flags_dir)
    opened.append(dir_fd)
    for component in parts[:-1]:
        dir_fd = os.open(component, flags_dir, dir_fd=dir_fd)
        opened.append(dir_fd)
    fd = os.open(parts[-1], flags_file, dir_fd=dir_fd)
    opened.append(fd)
    before = os.fstat(fd)
    if not stat.S_ISREG(before.st_mode):
        raise SystemExit("REFUSED: selected export descriptor is not regular")
    digest = hashlib.sha256()
    rows = 0
    output_flags = os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
    output_fd = os.open(output, output_flags, 0o600)
    opened.append(output_fd)
    process = subprocess.Popen(
        [zstd, "-q", "-T0", "-19", "-c"],
        stdin=subprocess.PIPE,
        stdout=output_fd,
    )
    assert process.stdin is not None
    with os.fdopen(os.dup(fd), "rb") as source:
        for chunk in iter(lambda: source.read(1 << 20), b""):
            digest.update(chunk)
            rows += chunk.count(b"\n")
            process.stdin.write(chunk)
    process.stdin.close()
    if process.wait() != 0:
        raise SystemExit("REFUSED: zstd source compression failed")
    os.fsync(output_fd)
    after = os.fstat(fd)
    stable = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")
    if any(getattr(before, name) != getattr(after, name) for name in stable):
        raise SystemExit("REFUSED: selected export changed during snapshot")
    artifact_info = os.fstat(output_fd)
    os.lseek(output_fd, 0, os.SEEK_SET)
    artifact_digest = hashlib.sha256()
    with os.fdopen(os.dup(output_fd), "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            artifact_digest.update(chunk)
    doc = {
        "path": os.path.join(root, relative),
        "record_count": rows,
        "size_bytes": before.st_size,
        "sha256": digest.hexdigest(),
        "artifact_size_bytes": artifact_info.st_size,
        "artifact_sha256": artifact_digest.hexdigest(),
    }
    with open(metadata, "x", encoding="utf-8") as handle:
        json.dump(doc, handle, sort_keys=True)
        handle.write("\n")
finally:
    for opened_fd in reversed(opened):
        try:
            os.close(opened_fd)
        except OSError:
            pass
PYSOURCE
}

[ -d "$REPO" ] && [ ! -L "$REPO" ] || { log "REFUSED: repository missing or symlinked"; exit 2; }
[ -d "$DIST_ROOT" ] && [ ! -L "$DIST_ROOT" ] || { log "REFUSED: dist root missing or symlinked"; exit 2; }
[ -d "$STAGING" ] && [ ! -L "$STAGING" ] || { log "REFUSED: staging missing or symlinked"; exit 2; }

# Physical traversal only. Dated directories are real directories; dist/latest is
# deliberately ignored so no symlink or alias can redirect the exporter.
newest=$(/usr/bin/find -P "$DIST_ROOT" -mindepth 2 -maxdepth 2 \
  -path "$DIST_ROOT/????-??-??/drugs.jsonl" -type f \
  -printf '%T@\t%p\n' 2>/dev/null | /usr/bin/sort -rn | /usr/bin/head -1 | /usr/bin/cut -f2-)
if [ -z "$newest" ]; then
  log "nothing to export: no dated dist/*/drugs.jsonl"
  exit 0
fi
if [ -L "$newest" ] || [ ! -f "$newest" ]; then
  log "REFUSED: selected export is not a regular non-symlink file"
  exit 2
fi
src_dir=$(/usr/bin/dirname "$newest")
if [ -L "$src_dir" ]; then
  log "REFUSED: selected dated directory is a symlink"
  exit 2
fi
date_tag=$(/usr/bin/basename "$src_dir")
if [[ ! "$date_tag" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  log "REFUSED: selected export has an invalid date directory"
  exit 2
fi
dest="$STAGING/$date_tag"
tmp="$STAGING/.tmp-$date_tag-$$"
if [ -e "$dest" ] || [ -L "$dest" ]; then
  if [ -d "$dest" ] && [ ! -L "$dest" ] \
    && [ -f "$dest/stage-manifest.json" ] && [ ! -L "$dest/stage-manifest.json" ] \
    && [ -f "$dest/drugs.jsonl.zst" ] && [ ! -L "$dest/drugs.jsonl.zst" ]; then
    log "already staged: $date_tag"
    exit 0
  fi
  log "REFUSED: incomplete or unsafe destination exists: $dest"
  exit 2
fi
[ ! -e "$tmp" ] && [ ! -L "$tmp" ] || { log "REFUSED: temporary path already exists"; exit 2; }
/bin/mkdir -m 0700 "$tmp"
trap '/bin/rm -rf -- "$tmp"' ERR INT TERM

log "staging $date_tag from $newest"
newest_rel="${newest#"$DIST_ROOT"/}"
[ "$newest_rel" != "$newest" ] || { log "REFUSED: selected export is outside dist root"; exit 2; }
source_meta="$tmp/source-meta.json"
compress_dist_file "$newest_rel" "$tmp/drugs.jsonl.zst" "$source_meta"

# Optional companion artifacts from the prescribable stage (npm run prescribable).
# Absent on older builds -> skipped, never fatal. prescribable.jsonl gets the same
# hardened, symlink-safe compression as the primary artifact; the small review CSV is
# copied verbatim (hashed in the manifest step).
prescribable_meta=''
if [ -f "$src_dir/prescribable.jsonl" ] && [ ! -L "$src_dir/prescribable.jsonl" ]; then
  prescribable_meta="$tmp/prescribable-meta.json"
  compress_dist_file "$date_tag/prescribable.jsonl" "$tmp/prescribable.jsonl.zst" "$prescribable_meta"
  log "staged prescribable.jsonl"
fi
review_rel=''
review_size=0
review_sha=''
if [ -f "$src_dir/strength-review-shortlist.csv" ] && [ ! -L "$src_dir/strength-review-shortlist.csv" ]; then
  /bin/cp -- "$src_dir/strength-review-shortlist.csv" "$tmp/strength-review-shortlist.csv"
  review_rel=strength-review-shortlist.csv
  review_size=$(/usr/bin/stat -c%s "$tmp/strength-review-shortlist.csv")
  review_sha=$(/usr/bin/sha256sum "$tmp/strength-review-shortlist.csv" | /usr/bin/cut -d' ' -f1)
  log "staged strength-review-shortlist.csv"
fi

# SQLite online backups run with the same unprivileged UID as the crawler data.
db_entries='[]'
while IFS= read -r db; do
  base=$(/usr/bin/basename "$db")
  db_rel="${db#"$STATE_ROOT"/}"
  [ "$db_rel" != "$db" ] || { log "WARN: sqlite path escaped state root: $db"; continue; }
  db_id=$(/usr/bin/python3 - "$db_rel" <<'PYID'
import hashlib, sys
print(hashlib.sha256(sys.argv[1].encode("utf-8")).hexdigest()[:16])
PYID
)
  snap="$tmp/db-$db_id-$base"
  if /usr/bin/python3 - "$db" "$snap" <<'PYBK'
import sqlite3
import sys
src, dst = sys.argv[1], sys.argv[2]
source = sqlite3.connect(f"file:{src}?mode=ro", uri=True, timeout=60)
target = sqlite3.connect(dst)
with target:
    source.backup(target)
target.close()
source.close()
PYBK
  then
    "$ZSTD" -q -T0 -3 --rm -- "$snap"
    /bin/chmod 0600 "$snap.zst"
    db_entries=$(/usr/bin/python3 - "$db_entries" "$base" "$db_rel" "$db" "$snap.zst" <<'PYDB'
import hashlib, json, os, sys
entries = json.loads(sys.argv[1])
base, relative, orig, zst = sys.argv[2:6]
digest = hashlib.sha256()
with open(zst, "rb") as handle:
    for chunk in iter(lambda: handle.read(1 << 20), b""):
        digest.update(chunk)
entries.append({"name": base, "source_relative_path": relative, "source_path": orig,
                "source_size_bytes": os.path.getsize(orig),
                "snapshot": os.path.basename(zst),
                "snapshot_size_bytes": os.path.getsize(zst),
                "snapshot_sha256": digest.hexdigest()})
print(json.dumps(entries))
PYDB
)
  else
    log "WARN: sqlite backup failed for $db"
    /bin/rm -f -- "$snap"
  fi
done < <(/usr/bin/find -P "$STATE_ROOT" -maxdepth 4 \
  -path "$STATE_ROOT/restricted" -prune -o \
  -type f \( -name '*.db' -o -name '*.db3' -o -name '*.sqlite' -o -name '*.sqlite3' \) \
  -not -name '*-wal' -not -name '*-shm' -print 2>/dev/null)

state_note=ok
state_file_rel=''
state_size=0
state_sha=''
set_size=''
if [ ! -d "$STATE_ROOT" ] || [ -L "$STATE_ROOT" ]; then
  state_note=no-data-dir
else
  set_size=$(/usr/bin/du -sb "${STATE_EXCLUDE_ARGS[@]}" "$STATE_ROOT" 2>/dev/null | /usr/bin/cut -f1)
  if [ -n "$set_size" ] && [ "$set_size" -gt "$STATE_CAP_BYTES" ]; then
    state_note="skipped-oversize:${set_size}B>${STATE_CAP_BYTES}B"
  else
    if /usr/bin/tar -C "$STATE_ROOT" "${STATE_EXCLUDE_ARGS[@]}" --warning=no-file-changed -cf - . 2>/dev/null \
      | "$ZSTD" -q -T0 -6 -o "$tmp/state.tar.zst"; then
      state_note=ok
    elif [ -s "$tmp/state.tar.zst" ]; then
      state_note=ok-livewarn
    else
      state_note=tar-failed
      /bin/rm -f -- "$tmp/state.tar.zst"
    fi
    if [ -s "$tmp/state.tar.zst" ]; then
      /bin/chmod 0600 "$tmp/state.tar.zst"
      state_file_rel=state.tar.zst
      state_size=$(/usr/bin/stat -c%s "$tmp/state.tar.zst")
      state_sha=$(/usr/bin/sha256sum "$tmp/state.tar.zst" | /usr/bin/cut -d' ' -f1)
    fi
  fi
fi

/usr/bin/python3 - "$date_tag" "$source_meta" "$db_entries" "$state_file_rel" "$state_size" \
  "$state_sha" "$state_note" "$tmp/stage-manifest.json" \
  "${prescribable_meta:-}" "$review_rel" "$review_size" "$review_sha" <<'PYMF'
import json, socket, sys, time
(date_tag, source_meta, dbs, state_file, state_size, state_sha, state_note, out,
 prescribable_meta, review_file, review_size, review_sha) = sys.argv[1:13]
with open(source_meta, encoding="utf-8") as handle:
    source = json.load(handle)
prescribable = None
if prescribable_meta:
    with open(prescribable_meta, encoding="utf-8") as handle:
        pm = json.load(handle)
    prescribable = {"filename": "prescribable.jsonl.zst", "format": "zstd-compressed jsonl",
                    "record_count": int(pm["record_count"]),
                    "size_bytes": int(pm["artifact_size_bytes"]), "sha256": pm["artifact_sha256"],
                    "uncompressed_size_bytes": int(pm["size_bytes"]), "uncompressed_sha256": pm["sha256"]}
review_shortlist = ({"filename": review_file, "format": "csv",
                     "size_bytes": int(review_size), "sha256": review_sha}
                    if review_file else None)
doc = {
  "schema_version": 3,
  "stage_kind": "aushadhi-export-snapshot",
  "release_date": date_tag,
  "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime()),
  "source": {"host": socket.gethostname(), "path": source["path"], "format": "jsonl",
             "record_count": int(source["record_count"]),
             "size_bytes": int(source["size_bytes"]), "sha256": source["sha256"]},
  "artifact": {"filename": "drugs.jsonl.zst", "format": "zstd-compressed jsonl",
               "size_bytes": int(source["artifact_size_bytes"]),
               "sha256": source["artifact_sha256"]},
  "prescribable": prescribable,
  "review_shortlist": review_shortlist,
  "databases": json.loads(dbs),
  "state_snapshot": ({"filename": state_file,
                      "format": "zstd-compressed tar of data/ minus pages/ and restricted/",
                      "size_bytes": int(state_size), "sha256": state_sha}
                     if state_file else None),
  "state_note": state_note,
}
with open(out, "w") as handle:
    json.dump(doc, handle, indent=2)
    handle.write("\n")
PYMF
/bin/rm -f -- "$source_meta"
[ -n "$prescribable_meta" ] && /bin/rm -f -- "$prescribable_meta" || true
/bin/chmod 0644 "$tmp/drugs.jsonl.zst" "$tmp/stage-manifest.json"
[ -e "$tmp/prescribable.jsonl.zst" ] && /bin/chmod 0644 "$tmp/prescribable.jsonl.zst" || true
[ -e "$tmp/strength-review-shortlist.csv" ] && /bin/chmod 0644 "$tmp/strength-review-shortlist.csv" || true
if [ -e "$tmp/state.tar.zst" ]; then /bin/chmod 0600 "$tmp/state.tar.zst"; fi
/bin/chmod 0755 "$tmp"
/bin/mv -- "$tmp" "$dest"
trap - ERR INT TERM

# Keep the newest RETAIN real dated directories only.
mapfile -t dated_dirs < <(/usr/bin/find -P "$STAGING" -mindepth 1 -maxdepth 1 -type d \
  -name '????-??-??' -printf '%p\n' | /usr/bin/sort)
if [ "${#dated_dirs[@]}" -gt "$RETAIN" ]; then
  remove_count=$((${#dated_dirs[@]} - RETAIN))
  for ((index=0; index<remove_count; index++)); do
    /bin/rm -rf -- "${dated_dirs[$index]}"
  done
fi
log "export complete: $date_tag"
