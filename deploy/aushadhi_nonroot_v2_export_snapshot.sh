#!/usr/bin/env bash
# Unprivileged, fail-closed Aushadhi post-build export snapshotter.
set -Eeuo pipefail
umask 027

if [ "${EUID}" -eq 0 ]; then
  printf '%s\n' 'REFUSED: exporter must not run as root' >&2
  exit 2
fi

if [ "${AUSHADHI_EXPORT_TESTING:-0}" = "1" ]; then
  readonly REPO="${AUSHADHI_EXPORT_REPO:?test repo required}"
  readonly DIST_ROOT="${AUSHADHI_DIST_ROOT:-$REPO/dist}"
  readonly STATE_ROOT="${AUSHADHI_STATE_ROOT:-$REPO/data}"
  readonly STAGING="${AUSHADHI_EXPORT_STAGING:?test staging required}"
  readonly RELEASE_RECEIPT="${AUSHADHI_EXPORT_RELEASE_RECEIPT:?test release receipt required}"
  readonly ZSTD="${AUSHADHI_EXPORT_ZSTD:-/usr/bin/zstd}"
  readonly RELEASE_INSPECTION_PROFILE="staging-test"
else
  [ "$(/usr/bin/id -un)" = "aushadhi" ] || {
    printf '%s\n' 'REFUSED: exporter must run as aushadhi' >&2
    exit 2
  }
  readonly REPO="/opt/aushadhi"
  readonly DIST_ROOT="${AUSHADHI_DIST_ROOT:-/var/lib/aushadhi/dist}"
  readonly STATE_ROOT="${AUSHADHI_STATE_ROOT:-/var/lib/aushadhi/data}"
  readonly STAGING="${AUSHADHI_EXPORT_ROOT:-/var/lib/aushadhi-export}"
  readonly RELEASE_RECEIPT="${AUSHADHI_RELEASE_RECEIPT:-/opt/aushadhi/DEPLOYED-RELEASE.json}"
  readonly ZSTD="/usr/bin/zstd"
  readonly RELEASE_INSPECTION_PROFILE="live"
  [ "$DIST_ROOT" = "/var/lib/aushadhi/dist" ] || {
    printf '%s\n' 'REFUSED: production dist root must be /var/lib/aushadhi/dist' >&2
    exit 2
  }
  [ "$STATE_ROOT" = "/var/lib/aushadhi/data" ] || {
    printf '%s\n' 'REFUSED: production state root must be /var/lib/aushadhi/data' >&2
    exit 2
  }
  [ "$STAGING" = "/var/lib/aushadhi-export" ] || {
    printf '%s\n' 'REFUSED: production export root must be /var/lib/aushadhi-export' >&2
    exit 2
  }
fi

readonly STATE_CAP_BYTES=$((2 * 1024 * 1024 * 1024))
readonly -a STATE_EXCLUDE_ARGS=(
  --exclude=pages
  '--exclude=*/pages'
  '--exclude=*/pages/*'
  --exclude=restricted
  '--exclude=*/restricted'
  '--exclude=*/restricted/*'
  '--exclude=*.db'
  '--exclude=*.db-wal'
  '--exclude=*.db-shm'
  '--exclude=*.db3'
  '--exclude=*.db3-wal'
  '--exclude=*.db3-shm'
  '--exclude=*.sqlite'
  '--exclude=*.sqlite-wal'
  '--exclude=*.sqlite-shm'
  '--exclude=*.sqlite3'
  '--exclude=*.sqlite3-wal'
  '--exclude=*.sqlite3-shm'
  --exclude=state.json.crawler-state.lock
  '--exclude=*/state.json.crawler-state.lock'
  --exclude=.cache-retention.lock
  '--exclude=*/.cache-retention.lock'
  --exclude=.build.lock
  '--exclude=*/.build.lock'
  '--exclude=*/.build.lock/*'
  --exclude=build.lock
  '--exclude=*/build.lock'
  '--exclude=*/build.lock/*'
  --exclude=.export.lock
  '--exclude=*/.export.lock'
  '--exclude=*/.export.lock/*'
  '--exclude=.state.json.tmp-*'
  '--exclude=*/.state.json.tmp-*'
  '--exclude=.state.json.last-good.tmp-*'
  '--exclude=*/.state.json.last-good.tmp-*'
  '--exclude=.build-state.json.tmp-*'
  '--exclude=*/.build-state.json.tmp-*'
)

log() { printf '%s %s\n' "$(/bin/date -u '+%FT%TZ')" "$*"; }
refuse() { log "REFUSED: $*" >&2; exit 2; }

[ -d "$REPO" ] && [ ! -L "$REPO" ] || refuse 'repository missing or symlinked'
[ -d "$DIST_ROOT" ] && [ ! -L "$DIST_ROOT" ] || refuse 'dist root missing or symlinked'
[ -d "$STATE_ROOT" ] && [ ! -L "$STATE_ROOT" ] || refuse 'state root missing or symlinked'
[ -d "$STAGING" ] && [ ! -L "$STAGING" ] || refuse 'export root missing or symlinked'
[ -f "$RELEASE_RECEIPT" ] && [ ! -L "$RELEASE_RECEIPT" ] || refuse 'release receipt missing or symlinked'
[ -x "$ZSTD" ] && [ ! -L "$ZSTD" ] || refuse 'zstd executable missing or symlinked'
[ -x /usr/bin/flock ] || refuse 'flock is unavailable'

lock="$STAGING/.export.lock"
if [ -L "$lock" ] || { [ -e "$lock" ] && [ ! -f "$lock" ]; }; then
  refuse "export root lock path is unsafe: $lock"
fi
exec {lock_fd}>>"$lock" || refuse "cannot open export root lock: $lock"
if [ -L "$lock" ] || [ ! -f "$lock" ]; then
  refuse "export root lock path changed unsafely: $lock"
fi
opened_lock_identity=$(/usr/bin/stat -Lc '%d:%i' "/proc/$$/fd/$lock_fd") \
  || refuse 'cannot identify the opened export root lock'
current_lock_identity=$(/usr/bin/stat -Lc '%d:%i' "$lock") \
  || refuse 'cannot identify the current export root lock'
[ "$opened_lock_identity" = "$current_lock_identity" ] \
  || refuse 'export root lock changed while opening'
/usr/bin/flock --exclusive --nonblock "$lock_fd" \
  || refuse "export root lock is held: $lock"
current_lock_identity=$(/usr/bin/stat -Lc '%d:%i' "$lock") \
  || refuse 'cannot revalidate the current export root lock'
[ "$opened_lock_identity" = "$current_lock_identity" ] \
  || refuse 'export root lock changed after acquisition'
work=''
cleanup() {
  if [ -n "$work" ] && [ -d "$work" ] && [ ! -L "$work" ]; then
    /bin/rm -rf -- "$work"
  fi
}
trap cleanup EXIT INT TERM

# Select only the immutable generation named by the atomically replaced cohort
# index. Legacy dated directories and unindexed generations are never inferred.
set +e
selection=$(/usr/bin/python3 - "$DIST_ROOT" <<'PYSELECT'
import datetime
import hashlib
import json
import os
import re
import stat
import sys
import unicodedata

root = os.path.abspath(sys.argv[1])
index_path = os.path.join(root, "cohort-index.json")
date_re = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
generation_re = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
sha_re = re.compile(r"^[a-f0-9]{64}$")

def refuse(message):
    raise SystemExit(f"REFUSED: {message}")

def stable_read(path, max_bytes):
    flags = os.O_RDONLY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(path, flags)
    except FileNotFoundError:
        return None
    except OSError as error:
        refuse(f"cannot safely open {path}: {error}")
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode):
            refuse(f"not a regular file: {path}")
        if before.st_size > max_bytes:
            refuse(f"metadata file exceeds {max_bytes} bytes: {path}")
        payload = bytearray()
        digest = hashlib.sha256()
        while True:
            chunk = os.read(fd, 1 << 20)
            if not chunk:
                break
            payload.extend(chunk)
            digest.update(chunk)
        after = os.fstat(fd)
        stable = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")
        if any(getattr(before, key) != getattr(after, key) for key in stable):
            refuse(f"file changed during validation: {path}")
        return bytes(payload), digest.hexdigest()
    finally:
        os.close(fd)

def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            refuse(f"duplicate JSON field: {key}")
        result[key] = value
    return result

def parse_json(payload, label):
    try:
        return json.loads(payload, object_pairs_hook=reject_duplicates)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        refuse(f"invalid {label}: {error}")

def exact_object(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        refuse(f"{label} has unexpected fields")

def safe_date(value):
    if not isinstance(value, str) or not date_re.fullmatch(value):
        refuse(f"invalid cohort date: {value}")
    try:
        parsed = datetime.datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        refuse(f"invalid cohort date: {value}")
    if parsed.strftime("%Y-%m-%d") != value:
        refuse(f"invalid cohort date: {value}")
    return value

def safe_generation(value):
    if not isinstance(value, str) or not generation_re.fullmatch(value):
        refuse(f"invalid cohort generation: {value}")
    return value

def safe_timestamp(value, label):
    if not isinstance(value, str) or not value:
        refuse(f"{label} is invalid")
    try:
        datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        refuse(f"{label} is invalid")

index_read = stable_read(index_path, 16 << 20)
if index_read is None:
    cohort_like = os.path.lexists(os.path.join(root, ".generations")) \
        or os.path.lexists(os.path.join(root, "latest"))
    if not cohort_like:
        for name in os.listdir(root):
            if date_re.fullmatch(name):
                cohort_like = True
                break
    if cohort_like:
        refuse("cohort data exists without cohort-index.json")
    raise SystemExit(3)

index = parse_json(index_read[0], "cohort index")
exact_object(index, ("schema_version", "updated_at", "latest", "dates", "generations"), "cohort index")
if type(index["schema_version"]) is not int or index["schema_version"] != 1:
    refuse(f"unsupported cohort index schema: {index['schema_version']}")
safe_timestamp(index["updated_at"], "cohort index updated_at")
exact_object(index["latest"], ("date", "generation_id"), "cohort index latest pointer")
latest_date = safe_date(index["latest"]["date"])
latest_generation = safe_generation(index["latest"]["generation_id"])
if not isinstance(index["dates"], dict):
    refuse("cohort index dates must be an object")
if not isinstance(index["generations"], dict):
    refuse("cohort index generations must be an object")

for generation, entry in index["generations"].items():
    safe_generation(generation)
    exact_object(entry, ("date", "manifest_sha256", "published_at"), f"cohort generation {generation}")
    safe_date(entry["date"])
    if not isinstance(entry["manifest_sha256"], str) or not sha_re.fullmatch(entry["manifest_sha256"]):
        refuse(f"cohort generation {generation} manifest_sha256 is invalid")
    safe_timestamp(entry["published_at"], f"cohort generation {generation} published_at")
for date, generation in index["dates"].items():
    safe_date(date)
    safe_generation(generation)
    if index["generations"].get(generation, {}).get("date") != date:
        refuse(f"cohort date pointer {date} does not match generation {generation}")
if index["dates"].get(latest_date) != latest_generation \
        or index["generations"].get(latest_generation, {}).get("date") != latest_date:
    refuse("cohort latest pointer does not match its date and generation records")

generations_root = os.path.join(root, ".generations")
generation_root = os.path.join(generations_root, latest_generation)
for path, label in (
    (generations_root, "cohort generations root"),
    (generation_root, "selected cohort generation"),
):
    try:
        information = os.lstat(path)
    except OSError as error:
        refuse(f"{label} is unavailable: {error}")
    if not stat.S_ISDIR(information.st_mode) or stat.S_ISLNK(information.st_mode):
        refuse(f"{label} is not a physical directory")
real_generations = os.path.realpath(generations_root)
real_generation = os.path.realpath(generation_root)
if os.path.commonpath((real_generations, real_generation)) != real_generations \
        or real_generation == real_generations:
    refuse("selected cohort generation resolves outside the generations root")

manifest_read = stable_read(os.path.join(generation_root, "cohort-manifest.json"), 16 << 20)
if manifest_read is None:
    refuse("selected cohort manifest is missing")
expected_manifest_sha = index["generations"][latest_generation]["manifest_sha256"]
if manifest_read[1] != expected_manifest_sha:
    refuse(f"published cohort manifest hash mismatch for generation {latest_generation}")
manifest = parse_json(manifest_read[0], "cohort manifest")
if manifest.get("schema_version") != 1 \
        or manifest.get("generation_id") != latest_generation \
        or manifest.get("date") != latest_date:
    refuse(f"published cohort manifest identity mismatch for generation {latest_generation}")

print(latest_date)
print(latest_generation)
print(expected_manifest_sha)
PYSELECT
)
selection_status=$?
set -e
if [ "$selection_status" -eq 3 ]; then
  log 'nothing to export: no published cohort index'
  exit 0
fi
[ "$selection_status" -eq 0 ] || refuse 'cohort index selection failed'
mapfile -t selected <<< "$selection"
[ "${#selected[@]}" -eq 3 ] || refuse 'cohort index selector returned an invalid result'
date_tag="${selected[0]}"
generation_id="${selected[1]}"
expected_manifest_sha="${selected[2]}"
src_dir="$DIST_ROOT/.generations/$generation_id"

dest="$STAGING/$date_tag"
if [ -L "$dest" ] || { [ -e "$dest" ] && [ ! -d "$dest" ]; }; then
  refuse "unsafe destination exists: $dest"
fi

work="$STAGING/.tmp-$date_tag-$$"
[ ! -e "$work" ] && [ ! -L "$work" ] || refuse 'temporary path already exists'
/bin/mkdir -m 0700 "$work"
snapshot="$work/snapshot"
/bin/mkdir -m 0700 "$snapshot"
cohort_meta="$work/cohort-meta.json"

# Validate every file bound by the cohort manifest before reading it for export.
# The release receipt is also validated and reduced to the immutable code identity
# that will be copied into the stage manifest.
if ! /usr/bin/python3 - "$src_dir" "$date_tag" "$generation_id" "$expected_manifest_sha" \
  "$RELEASE_RECEIPT" "$cohort_meta" "$RELEASE_INSPECTION_PROFILE" <<'PYCOHORT'
import hashlib
import json
import os
import re
import stat
import sys
import unicodedata

(
    root, expected_date, expected_generation, expected_manifest_sha,
    receipt_path, output, expected_inspection_profile,
) = sys.argv[1:8]
sha_re = re.compile(r"^[a-f0-9]{64}$")
generation_re = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
source_field_re = re.compile(r"[^a-z0-9]+")
source_fields = {
    "source", "sources", "sourceid", "sourceids", "sourceidentity",
    "sourcelist", "sourcename", "sourcepolicyid",
}

def restricted_source_identity(value):
    if not isinstance(value, str):
        return False
    compact = source_field_re.sub("", unicodedata.normalize("NFKC", value).casefold())
    return (
        "cdci" in compact
        or "commondrugcodesforindia" in compact
        or "indiadrugextension" in compact
        or "in1000189" in compact
        or ("snomed" in compact and "india" in compact and "drug" in compact)
    )

def assert_no_restricted_source_metadata(value, label):
    def inspect_strings(candidate, location):
        if isinstance(candidate, str):
            if restricted_source_identity(candidate):
                raise SystemExit(
                    f"REFUSED: {label} contains restricted CDCI/SNOMED India Drug source metadata at {location}"
                )
        elif isinstance(candidate, list):
            for index, item in enumerate(candidate):
                inspect_strings(item, f"{location}[{index}]")
        elif isinstance(candidate, dict):
            for key, item in candidate.items():
                inspect_strings(key, f"{location}.<key>")
                inspect_strings(item, f"{location}.{key}")

    def walk(candidate, location):
        if isinstance(candidate, dict):
            for key, item in candidate.items():
                normalized_key = source_field_re.sub(
                    "", unicodedata.normalize("NFKC", str(key)).casefold()
                )
                if normalized_key in source_fields:
                    inspect_strings(item, f"{location}.{key}")
                walk(item, f"{location}.{key}")
        elif isinstance(candidate, list):
            for index, item in enumerate(candidate):
                walk(item, f"{location}[{index}]")

    walk(value, "$")

def validate_jsonl_source_metadata(path, label, expected):
    flags = os.O_RDONLY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode):
            raise SystemExit(f"REFUSED: not a regular file: {path}")
        digest = hashlib.sha256()
        size = 0
        with os.fdopen(os.dup(fd), "rb") as handle:
            line_number = 0
            while True:
                raw = handle.readline((16 << 20) + 1)
                if not raw:
                    break
                digest.update(raw)
                size += len(raw)
                line_number += 1
                if len(raw) > (16 << 20):
                    raise SystemExit(f"REFUSED: {label}:{line_number} exceeds the JSONL row limit")
                if not raw.strip():
                    continue
                try:
                    row = json.loads(raw)
                except (UnicodeDecodeError, json.JSONDecodeError) as error:
                    raise SystemExit(f"REFUSED: invalid {label}:{line_number}: {error}")
                assert_no_restricted_source_metadata(row, f"{label}:{line_number}")
        after = os.fstat(fd)
        stable = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")
        if any(getattr(before, key) != getattr(after, key) for key in stable):
            raise SystemExit(f"REFUSED: file changed during source-boundary validation: {path}")
        if size != expected.get("size_bytes") or digest.hexdigest() != expected.get("sha256"):
            raise SystemExit(f"REFUSED: {label} changed before source-boundary validation")
    finally:
        os.close(fd)

def stable_read(path, *, capture=False, count_rows=False, max_capture_bytes=None):
    flags = os.O_RDONLY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode):
            raise SystemExit(f"REFUSED: not a regular file: {path}")
        if capture and max_capture_bytes is not None and before.st_size > max_capture_bytes:
            raise SystemExit(f"REFUSED: metadata file exceeds {max_capture_bytes} bytes: {path}")
        digest = hashlib.sha256()
        payload = bytearray() if capture else None
        line_has_content = False
        rows = 0
        while True:
            chunk = os.read(fd, 1 << 20)
            if not chunk:
                break
            digest.update(chunk)
            if payload is not None:
                payload.extend(chunk)
            if count_rows:
                parts = chunk.split(b"\n")
                if len(parts) == 1:
                    line_has_content = line_has_content or bool(parts[0].strip())
                else:
                    rows += int(line_has_content or bool(parts[0].strip()))
                    rows += sum(bool(line.strip()) for line in parts[1:-1])
                    line_has_content = bool(parts[-1].strip())
        if count_rows and line_has_content:
            rows += 1
        after = os.fstat(fd)
        stable = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")
        if any(getattr(before, key) != getattr(after, key) for key in stable):
            raise SystemExit(f"REFUSED: file changed during validation: {path}")
        return (
            bytes(payload) if payload is not None else None,
            digest.hexdigest(),
            before.st_size,
            rows,
            before,
        )
    finally:
        os.close(fd)

manifest_bytes, manifest_sha, _, _, _ = stable_read(
    os.path.join(root, "cohort-manifest.json"), capture=True, max_capture_bytes=4 << 20,
)
if manifest_sha != expected_manifest_sha:
    raise SystemExit("REFUSED: cohort manifest no longer matches the published index")
try:
    manifest = json.loads(manifest_bytes)
except (UnicodeDecodeError, json.JSONDecodeError) as error:
    raise SystemExit(f"REFUSED: invalid cohort manifest: {error}")
if manifest.get("schema_version") != 1:
    raise SystemExit(f"REFUSED: unsupported cohort manifest schema: {manifest.get('schema_version')}")
generation = manifest.get("generation_id")
if not isinstance(generation, str) or not generation_re.fullmatch(generation):
    raise SystemExit("REFUSED: invalid cohort generation_id")
if generation != expected_generation:
    raise SystemExit("REFUSED: cohort manifest generation does not match the published index")
if manifest.get("date") != expected_date:
    raise SystemExit("REFUSED: cohort manifest date does not match its directory")
files = manifest.get("files")
if not isinstance(files, dict):
    raise SystemExit("REFUSED: cohort manifest files must be an object")
for required in ("drugs.jsonl", "prescribable.jsonl", "summary.json"):
    if required not in files:
        raise SystemExit(f"REFUSED: cohort manifest does not bind {required}")

actual_entries = set(os.listdir(root)) - {"cohort-manifest.json"}
if actual_entries != set(files):
    missing = sorted(set(files) - actual_entries)
    unbound = sorted(actual_entries - set(files))
    raise SystemExit(f"REFUSED: cohort entries disagree with manifest; missing={missing}, unbound={unbound}")

verified_files = {}
for name, expected in sorted(files.items()):
    if not isinstance(name, str) or name in {"", ".", ".."} or os.path.basename(name) != name:
        raise SystemExit(f"REFUSED: unsafe cohort filename: {name!r}")
    if not isinstance(expected, dict):
        raise SystemExit(f"REFUSED: invalid cohort metadata for {name}")
    _, digest, size, rows, _ = stable_read(
        os.path.join(root, name),
        count_rows="record_count" in expected,
    )
    if expected.get("size_bytes") != size:
        raise SystemExit(f"REFUSED: {name} size mismatch")
    if expected.get("sha256") != digest or not sha_re.fullmatch(str(expected.get("sha256", ""))):
        raise SystemExit(f"REFUSED: {name} hash mismatch")
    verified = {"sha256": digest, "size_bytes": size}
    if "record_count" in expected:
        if expected.get("record_count") != rows:
            raise SystemExit(f"REFUSED: {name} record count mismatch")
        verified["record_count"] = rows
    verified_files[name] = verified

for name in ("drugs.jsonl", "prescribable.jsonl"):
    validate_jsonl_source_metadata(os.path.join(root, name), name, verified_files[name])

try:
    summary_bytes, summary_digest, summary_size, _, _ = stable_read(
        os.path.join(root, "summary.json"), capture=True, max_capture_bytes=4 << 20,
    )
    if summary_size != verified_files["summary.json"]["size_bytes"] \
            or summary_digest != verified_files["summary.json"]["sha256"]:
        raise SystemExit("REFUSED: summary.json changed before source-boundary validation")
    summary = json.loads(summary_bytes)
except (UnicodeDecodeError, json.JSONDecodeError) as error:
    raise SystemExit(f"REFUSED: invalid summary.json: {error}")
if summary.get("date") != expected_date:
    raise SystemExit("REFUSED: summary date does not match cohort")
assert_no_restricted_source_metadata(summary, "summary.json")
sources = summary.get("sources")
if not isinstance(sources, dict) or not sources:
    raise SystemExit("REFUSED: summary source list is missing")
source_list = []
for source_id, count in sorted(sources.items()):
    if not isinstance(source_id, str) or not source_id or isinstance(count, bool) or not isinstance(count, int) or count < 0:
        raise SystemExit("REFUSED: invalid summary source list")
    source_list.append({"source_id": source_id, "record_count": count})

receipt_bytes, receipt_sha, _, _, receipt_info = stable_read(
    receipt_path, capture=True, max_capture_bytes=4 << 20,
)
if expected_inspection_profile == "live" and (
    receipt_info.st_uid != 0 or receipt_info.st_gid != 0
    or stat.S_IMODE(receipt_info.st_mode) != 0o644
):
    raise SystemExit("REFUSED: live release receipt must remain root:root 0644")
try:
    receipt = json.loads(receipt_bytes)
except (UnicodeDecodeError, json.JSONDecodeError) as error:
    raise SystemExit(f"REFUSED: invalid release receipt: {error}")
commit = receipt.get("repository_commit")
tree = receipt.get("repository_tree_sha256")
if receipt.get("schema_version") != 1:
    raise SystemExit("REFUSED: unsupported release receipt schema")
if not isinstance(commit, str) or not re.fullmatch(r"[a-fA-F0-9]{7,64}", commit):
    raise SystemExit("REFUSED: release receipt repository_commit is invalid")
if not isinstance(tree, str) or not sha_re.fullmatch(tree.lower()):
    raise SystemExit("REFUSED: release receipt repository_tree_sha256 is invalid")
if not isinstance(receipt.get("installed_at_utc"), str) or not receipt["installed_at_utc"]:
    raise SystemExit("REFUSED: release receipt installed_at_utc is missing")
for field in ("runtime_manifest_sha256", "dependency_tree_sha256"):
    value = receipt.get(field)
    if not isinstance(value, str) or not sha_re.fullmatch(value.lower()):
        raise SystemExit(f"REFUSED: release receipt {field} is invalid")
installed_metadata = receipt.get("installed_tree_metadata_sha256")
if not isinstance(installed_metadata, str) or not sha_re.fullmatch(installed_metadata.lower()):
    raise SystemExit("REFUSED: release receipt installed_tree_metadata_sha256 is invalid")
if receipt.get("inspection_profile") != expected_inspection_profile:
    raise SystemExit(
        f"REFUSED: release receipt inspection profile must be {expected_inspection_profile}"
    )
inspected_roots = receipt.get("inspected_roots")
expected_root_keys = {
    "source_root", "installed_root", "systemd_root", "privileged_root",
    "export_roots", "runtime_manifest",
}
if not isinstance(inspected_roots, dict) or set(inspected_roots) != expected_root_keys:
    raise SystemExit("REFUSED: release receipt inspected roots are invalid")
if not all(isinstance(inspected_roots.get(key), str) and inspected_roots[key]
           for key in expected_root_keys - {"export_roots"}):
    raise SystemExit("REFUSED: release receipt inspected root path is invalid")
if not isinstance(inspected_roots.get("export_roots"), list) \
        or not inspected_roots["export_roots"] \
        or not all(isinstance(value, str) and value for value in inspected_roots["export_roots"]):
    raise SystemExit("REFUSED: release receipt export roots are invalid")
if expected_inspection_profile == "live":
    canonical = {
        "installed_root": "/opt/aushadhi",
        "systemd_root": "/etc/systemd/system",
        "privileged_root": "/",
        "export_roots": ["/var/lib/aushadhi-export"],
    }
    if any(inspected_roots.get(key) != value for key, value in canonical.items()):
        raise SystemExit("REFUSED: live release receipt does not bind the canonical runtime roots")
filesystem_policy = receipt.get("filesystem_policy")
if not isinstance(filesystem_policy, dict) \
        or not isinstance(filesystem_policy.get("installed_tree"), dict) \
        or not isinstance(filesystem_policy.get("systemd_files"), dict) \
        or not isinstance(filesystem_policy.get("privileged_files"), list):
    raise SystemExit("REFUSED: release receipt filesystem policy is invalid")
if expected_inspection_profile == "live":
    installed_policy = filesystem_policy["installed_tree"]
    if installed_policy.get("uid") != 0 or installed_policy.get("gid") != 0 \
            or installed_policy.get("receipt_mode") != "0644" \
            or installed_policy.get("disallow_group_or_other_write") is not True:
        raise SystemExit("REFUSED: live release receipt installed-tree policy is unsafe")
for field in ("installed_files_sha256", "systemd_files_sha256", "privileged_files_sha256"):
    hashes = receipt.get(field)
    if not isinstance(hashes, dict) or not hashes:
        raise SystemExit(f"REFUSED: release receipt {field} must be a non-empty object")
    for pathname, digest in hashes.items():
        if not isinstance(pathname, str) or not pathname or not isinstance(digest, str) \
                or not sha_re.fullmatch(digest.lower()):
            raise SystemExit(f"REFUSED: release receipt {field} contains an invalid entry")
policy = receipt.get("artifact_policy")
if not isinstance(policy, dict):
    raise SystemExit("REFUSED: release receipt artifact_policy is missing")
if policy.get("profile") != "internal-evaluation" or policy.get("redistributable") is not False \
        or policy.get("production_authority") != "none":
    raise SystemExit("REFUSED: release receipt does not enforce internal-evaluation/non-redistributable policy")

doc = {
    "cohort": {
        "schema_version": 1,
        "manifest_sha256": manifest_sha,
        "generated_at": manifest.get("generated_at"),
        "input_fingerprint": manifest.get("input_fingerprint"),
        "files": verified_files,
    },
    "generation_id": generation,
    "source_list": source_list,
    "code_release": {
        "repository_commit": commit,
        "repository_tree_sha256": tree.lower(),
        "runtime_manifest_sha256": receipt["runtime_manifest_sha256"].lower(),
        "dependency_tree_sha256": receipt["dependency_tree_sha256"].lower(),
        "installed_tree_metadata_sha256": installed_metadata.lower(),
        "inspection_profile": receipt["inspection_profile"],
        "inspected_roots": inspected_roots,
        "filesystem_policy": filesystem_policy,
        "privileged_files_sha256": receipt["privileged_files_sha256"],
        "installed_at_utc": receipt["installed_at_utc"],
        "installed_files_sha256": receipt["installed_files_sha256"],
        "systemd_files_sha256": receipt["systemd_files_sha256"],
        "release_receipt_sha256": receipt_sha,
    },
    "artifact_policy": {
        "profile": "internal-evaluation",
        "redistributable": False,
        "production_authority": "none",
    },
}
with open(output, "x", encoding="utf-8") as handle:
    json.dump(doc, handle, sort_keys=True)
    handle.write("\n")
PYCOHORT
then
  refuse 'cohort or release validation failed'
fi

# Return 0 only for a fully verified stage of this exact generation, cohort, and
# deployed release. Return 3 for a stale/incomplete/corrupt managed directory so
# it can be rebuilt. Unsafe path types are rejected before this function is called.
classify_stage() {
  /usr/bin/python3 - "$1" "$cohort_meta" <<'PYSTAGE'
import hashlib
import json
import os
import stat
import sys

stage, expected_path = sys.argv[1:3]

def invalid(reason):
    print(reason)
    raise SystemExit(3)

def regular_digest(name, expected_size, expected_sha):
    if not isinstance(name, str) or os.path.basename(name) != name or name in {"", ".", ".."}:
        invalid("unsafe artifact filename")
    target = os.path.join(stage, name)
    try:
        info = os.lstat(target)
    except OSError:
        invalid(f"missing artifact {name}")
    if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode):
        invalid(f"unsafe artifact {name}")
    digest = hashlib.sha256()
    with open(target, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    if info.st_size != expected_size or digest.hexdigest() != expected_sha:
        invalid(f"artifact verification failed for {name}")
    return name

try:
    with open(expected_path, encoding="utf-8") as handle:
        expected = json.load(handle)
    manifest_info = os.lstat(os.path.join(stage, "stage-manifest.json"))
    if not stat.S_ISREG(manifest_info.st_mode) or stat.S_ISLNK(manifest_info.st_mode):
        invalid("unsafe stage manifest")
    with open(os.path.join(stage, "stage-manifest.json"), encoding="utf-8") as handle:
        manifest = json.load(handle)
except (OSError, json.JSONDecodeError, TypeError) as error:
    invalid(f"unreadable stage: {error}")

if manifest.get("schema_version") != 4 or manifest.get("stage_kind") != "aushadhi-export-snapshot":
    invalid("unsupported stage manifest")
if manifest.get("generation_id") != expected.get("generation_id"):
    invalid("generation changed")
if manifest.get("cohort") != expected.get("cohort"):
    invalid("cohort identity changed")
if manifest.get("code_release") != expected.get("code_release"):
    invalid("release identity changed")
if manifest.get("artifact_policy") != expected.get("artifact_policy"):
    invalid("artifact policy changed")
if manifest.get("source_list") != expected.get("source_list"):
    invalid("source list changed")
if manifest.get("state_note") != "ok":
    invalid("critical state is not verified")
recovery = manifest.get("recovery_policy")
if not isinstance(recovery, dict) or recovery.get("critical_state_required") is not True \
        or recovery.get("sqlite_backup_method") != "sqlite-online-backup" \
        or recovery.get("restricted_cdci_exported") is not False \
        or recovery.get("licensed_recovery_boundary") != "internal-recovery-only":
    invalid("recovery policy is incomplete")
ephemeral = recovery.get("ephemeral_state_excludes")
if not isinstance(ephemeral, list) or not {
    "state.json.crawler-state.lock", ".build.lock", ".export.lock", ".state.json.tmp-*",
}.issubset(ephemeral):
    invalid("ephemeral state exclusions are incomplete")

expected_files = {"stage-manifest.json"}
for key in ("artifact", "prescribable", "review_shortlist", "state_snapshot"):
    entry = manifest.get(key)
    if entry is None and key == "review_shortlist":
        continue
    if not isinstance(entry, dict):
        invalid(f"missing {key}")
    if key == "state_snapshot" and entry.get("verification") != "required":
        invalid("state snapshot is not required")
    expected_files.add(regular_digest(entry.get("filename"), entry.get("size_bytes"), entry.get("sha256")))
for database in manifest.get("databases", []):
    if not isinstance(database, dict) or database.get("verification") != "verified-online-backup":
        invalid("SQLite backup is not verified")
    expected_files.add(regular_digest(database.get("snapshot"), database.get("snapshot_size_bytes"), database.get("snapshot_sha256")))
actual_files = set(os.listdir(stage))
if actual_files != expected_files:
    invalid("stage has missing or unexpected files")
print("verified exact stage")
PYSTAGE
}

if [ -e "$dest" ]; then
  if classify_stage "$dest"; then
    log "already staged and verified: $date_tag generation $(/usr/bin/python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["generation_id"])' "$cohort_meta")"
    exit 0
  else
    stage_status=$?
    [ "$stage_status" -eq 3 ] || refuse 'existing stage classification failed'
    log "replacing stale or invalid staged export: $date_tag"
  fi
fi

# Symlink-safe, stable-descriptor compression of a dist-relative file.
compress_dist_file() {  # $1=dist-relative path $2=output .zst $3=metadata json
  /usr/bin/python3 - "$DIST_ROOT" "$1" "$2" "$3" "$ZSTD" <<'PYCOMPRESS'
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
    line_has_content = False
    output_flags = os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
    output_fd = os.open(output, output_flags, 0o600)
    opened.append(output_fd)
    process = subprocess.Popen([zstd, "-q", "-T0", "-19", "-c"], stdin=subprocess.PIPE, stdout=output_fd)
    assert process.stdin is not None
    with os.fdopen(os.dup(fd), "rb") as source:
        for chunk in iter(lambda: source.read(1 << 20), b""):
            digest.update(chunk)
            parts = chunk.split(b"\n")
            if len(parts) == 1:
                line_has_content = line_has_content or bool(parts[0].strip())
            else:
                rows += int(line_has_content or bool(parts[0].strip()))
                rows += sum(bool(line.strip()) for line in parts[1:-1])
                line_has_content = bool(parts[-1].strip())
            process.stdin.write(chunk)
    if line_has_content:
        rows += 1
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
PYCOMPRESS
}

newest_rel=".generations/$generation_id/drugs.jsonl"
prescribable_rel=".generations/$generation_id/prescribable.jsonl"
source_meta="$work/source-meta.json"
prescribable_meta="$work/prescribable-meta.json"
log "staging $date_tag from generation-bound cohort"
compress_dist_file "$newest_rel" "$snapshot/drugs.jsonl.zst" "$source_meta" || refuse 'drugs.jsonl compression failed'
compress_dist_file "$prescribable_rel" "$snapshot/prescribable.jsonl.zst" "$prescribable_meta" || refuse 'prescribable.jsonl compression failed'

# The compressed inputs must still equal the hashes validated from the cohort
# manifest; this closes the validation/compression race.
if ! /usr/bin/python3 - "$cohort_meta" "$source_meta" "$prescribable_meta" <<'PYBIND'
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    cohort = json.load(handle)["cohort"]["files"]
for name, metadata_path in (("drugs.jsonl", sys.argv[2]), ("prescribable.jsonl", sys.argv[3])):
    with open(metadata_path, encoding="utf-8") as handle:
        actual = json.load(handle)
    expected = cohort[name]
    for field in ("sha256", "size_bytes", "record_count"):
        if expected.get(field) != actual.get(field):
            raise SystemExit(f"REFUSED: {name} changed after cohort validation ({field} mismatch)")
PYBIND
then
  refuse 'cohort binding changed during export'
fi

review_meta=''
if /usr/bin/python3 -c 'import json,sys;raise SystemExit(0 if "strength-review-shortlist.csv" in json.load(open(sys.argv[1]))["cohort"]["files"] else 1)' "$cohort_meta"; then
  review_meta="$work/review-meta.json"
  if ! /usr/bin/python3 - "$src_dir/strength-review-shortlist.csv" "$snapshot/strength-review-shortlist.csv" "$cohort_meta" "$review_meta" <<'PYCOPY'
import hashlib, json, os, stat, sys
source, target, cohort_path, output = sys.argv[1:5]
fd = os.open(source, os.O_RDONLY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0))
try:
    before = os.fstat(fd)
    if not stat.S_ISREG(before.st_mode):
        raise SystemExit("REFUSED: review shortlist is not regular")
    with os.fdopen(os.dup(fd), "rb") as handle:
        contents = handle.read()
    after = os.fstat(fd)
    if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) != \
       (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns):
        raise SystemExit("REFUSED: review shortlist changed during copy")
finally:
    os.close(fd)
digest = hashlib.sha256(contents).hexdigest()
with open(cohort_path, encoding="utf-8") as handle:
    expected = json.load(handle)["cohort"]["files"]["strength-review-shortlist.csv"]
if expected.get("size_bytes") != len(contents) or expected.get("sha256") != digest:
    raise SystemExit("REFUSED: review shortlist does not match cohort manifest")
out_fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0), 0o600)
try:
    os.write(out_fd, contents)
    os.fsync(out_fd)
finally:
    os.close(out_fd)
with open(output, "x", encoding="utf-8") as handle:
    json.dump({"size_bytes": len(contents), "sha256": digest}, handle, sort_keys=True)
    handle.write("\n")
PYCOPY
  then
    refuse 'review shortlist copy failed'
  fi
fi

db_list="$work/sqlite-paths.nul"
if ! /usr/bin/find -P "$STATE_ROOT" \
    \( -type d -name pages -o -path "$STATE_ROOT/restricted" \) -prune -o \
    -type f \( -name '*.db' -o -name '*.db3' -o -name '*.sqlite' -o -name '*.sqlite3' \) \
    -print0 | LC_ALL=C /usr/bin/sort -z > "$db_list"; then
  refuse 'SQLite discovery failed'
fi

# Refuse state symlinks outside explicitly excluded page/restricted trees. A
# recovery snapshot must not be redirectable outside the state boundary.
unsafe_state_link=$(/usr/bin/find -P "$STATE_ROOT" -mindepth 1 \
  \( -type d -name pages -o -path "$STATE_ROOT/restricted" \) -prune -o \
  -type l -print -quit 2>/dev/null)
[ -z "$unsafe_state_link" ] || refuse "state contains a symlink: $unsafe_state_link"

db_entries='[]'
while IFS= read -r -d '' db; do
  base=$(/usr/bin/basename "$db")
  db_rel="${db#"$STATE_ROOT"/}"
  [ "$db_rel" != "$db" ] || refuse "SQLite path escaped state root: $db"
  db_id=$(/usr/bin/python3 - "$db_rel" <<'PYID'
import hashlib, sys
print(hashlib.sha256(sys.argv[1].encode("utf-8")).hexdigest()[:16])
PYID
)
  snap="$work/db-$db_id-$base"
  if ! /usr/bin/python3 - "$db" "$snap" <<'PYBK'
import sqlite3
import sys
src, dst = sys.argv[1:3]
try:
    source = sqlite3.connect(f"file:{src}?mode=ro", uri=True, timeout=60)
    target = sqlite3.connect(dst)
    with target:
        source.backup(target)
    result = target.execute("PRAGMA quick_check").fetchone()
    if result != ("ok",):
        raise sqlite3.DatabaseError(f"backup quick_check returned {result!r}")
    target.close()
    source.close()
except Exception as error:
    raise SystemExit(f"REFUSED: SQLite online backup failed for {src}: {error}")
PYBK
  then
    /bin/rm -f -- "$snap"
    exit 2
  fi
  "$ZSTD" -q -T0 -3 --rm -- "$snap" || refuse "SQLite backup compression failed for $db"
  /bin/chmod 0600 "$snap.zst"
  compressed_name="db-$db_id-$base.zst"
  /bin/mv -- "$snap.zst" "$snapshot/$compressed_name"
  [ -f "$snapshot/$compressed_name" ] || refuse "SQLite backup artifact missing for $db"
  db_entries=$(/usr/bin/python3 - "$db_entries" "$base" "$db_rel" "$snapshot/$compressed_name" <<'PYDB'
import hashlib, json, os, sys
entries = json.loads(sys.argv[1])
base, relative, artifact = sys.argv[2:5]
digest = hashlib.sha256()
with open(artifact, "rb") as handle:
    for chunk in iter(lambda: handle.read(1 << 20), b""):
        digest.update(chunk)
entries.append({
    "name": base,
    "source_relative_path": relative,
    "snapshot": os.path.basename(artifact),
    "snapshot_size_bytes": os.path.getsize(artifact),
    "snapshot_sha256": digest.hexdigest(),
    "verification": "verified-online-backup",
})
print(json.dumps(entries, sort_keys=True))
PYDB
)
done < "$db_list"

critical_file=$(/usr/bin/find -P "$STATE_ROOT" -mindepth 1 -maxdepth 8 \
  \( -type d -name pages -o -path "$STATE_ROOT/restricted" \) -prune -o \
  -type f \
  ! -name '*.db' ! -name '*.db-wal' ! -name '*.db-shm' \
  ! -name '*.db3' ! -name '*.db3-wal' ! -name '*.db3-shm' \
  ! -name '*.sqlite' ! -name '*.sqlite-wal' ! -name '*.sqlite-shm' \
  ! -name '*.sqlite3' ! -name '*.sqlite3-wal' ! -name '*.sqlite3-shm' \
  -print -quit 2>/dev/null)
[ -n "$critical_file" ] || refuse 'no critical non-database state is available for recovery'

set_size=$(/usr/bin/du -sb "${STATE_EXCLUDE_ARGS[@]}" "$STATE_ROOT" 2>/dev/null | /usr/bin/cut -f1)
[ -n "$set_size" ] || refuse 'could not size critical state'
[ "$set_size" -le "$STATE_CAP_BYTES" ] || refuse "critical state exceeds ${STATE_CAP_BYTES} bytes"
if ! /usr/bin/tar -C "$STATE_ROOT" "${STATE_EXCLUDE_ARGS[@]}" --warning=no-file-changed -cf - . 2>/dev/null \
    | "$ZSTD" -q -T0 -6 -o "$snapshot/state.tar.zst"; then
  /bin/rm -f -- "$snapshot/state.tar.zst"
  refuse 'critical state archive failed or changed during snapshot'
fi
[ -s "$snapshot/state.tar.zst" ] || refuse 'critical state archive is empty'
/bin/chmod 0600 "$snapshot/state.tar.zst"
state_size=$(/usr/bin/stat -c%s "$snapshot/state.tar.zst")
state_sha=$(/usr/bin/sha256sum "$snapshot/state.tar.zst" | /usr/bin/cut -d' ' -f1)

/usr/bin/python3 - "$date_tag" "$cohort_meta" "$source_meta" "$prescribable_meta" \
  "$review_meta" "$db_entries" "$state_size" "$state_sha" "$snapshot/stage-manifest.json" <<'PYMANIFEST'
import json, socket, sys, time
(date_tag, cohort_path, source_path, prescribable_path, review_path, dbs,
 state_size, state_sha, output) = sys.argv[1:10]
with open(cohort_path, encoding="utf-8") as handle:
    validated = json.load(handle)
with open(source_path, encoding="utf-8") as handle:
    source = json.load(handle)
with open(prescribable_path, encoding="utf-8") as handle:
    prescribable = json.load(handle)
review = None
if review_path:
    with open(review_path, encoding="utf-8") as handle:
        review_meta = json.load(handle)
    review = {
        "filename": "strength-review-shortlist.csv",
        "format": "csv",
        **review_meta,
    }
doc = {
    "schema_version": 4,
    "stage_kind": "aushadhi-export-snapshot",
    "release_date": date_tag,
    "generation_id": validated["generation_id"],
    "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime()),
    "source_host": socket.gethostname(),
    "cohort": validated["cohort"],
    "code_release": validated["code_release"],
    "artifact_policy": validated["artifact_policy"],
    "source_list": validated["source_list"],
    "source": {
        "path": f".generations/{validated['generation_id']}/drugs.jsonl",
        "format": "jsonl",
        "record_count": source["record_count"],
        "size_bytes": source["size_bytes"],
        "sha256": source["sha256"],
    },
    "artifact": {
        "filename": "drugs.jsonl.zst",
        "format": "zstd-compressed jsonl",
        "size_bytes": source["artifact_size_bytes"],
        "sha256": source["artifact_sha256"],
    },
    "prescribable": {
        "filename": "prescribable.jsonl.zst",
        "format": "zstd-compressed jsonl",
        "record_count": prescribable["record_count"],
        "size_bytes": prescribable["artifact_size_bytes"],
        "sha256": prescribable["artifact_sha256"],
        "uncompressed_size_bytes": prescribable["size_bytes"],
        "uncompressed_sha256": prescribable["sha256"],
    },
    "review_shortlist": review,
    "databases": json.loads(dbs),
    "state_snapshot": {
        "filename": "state.tar.zst",
        "format": "zstd-compressed tar of critical state; pages, restricted, SQLite, WAL, and SHM excluded",
        "size_bytes": int(state_size),
        "sha256": state_sha,
        "verification": "required",
    },
    "state_note": "ok",
    "recovery_policy": {
        "critical_state_required": True,
        "sqlite_backup_method": "sqlite-online-backup",
        "generic_archive_excludes": ["pages", "restricted", "SQLite", "WAL", "SHM"],
        "ephemeral_state_excludes": [
            "state.json.crawler-state.lock",
            ".cache-retention.lock",
            ".build.lock",
            "build.lock",
            ".export.lock",
            ".state.json.tmp-*",
            ".state.json.last-good.tmp-*",
            ".build-state.json.tmp-*",
        ],
        "restricted_cdci_exported": False,
        "licensed_recovery_boundary": "internal-recovery-only",
    },
}
with open(output, "x", encoding="utf-8") as handle:
    json.dump(doc, handle, indent=2, sort_keys=True)
    handle.write("\n")
PYMANIFEST

/bin/chmod 0644 "$snapshot/drugs.jsonl.zst" "$snapshot/prescribable.jsonl.zst" "$snapshot/stage-manifest.json"
[ -e "$snapshot/strength-review-shortlist.csv" ] && /bin/chmod 0644 "$snapshot/strength-review-shortlist.csv" || true
/bin/chmod 0750 "$snapshot"

if ! classify_stage "$snapshot"; then
  refuse 'new export did not pass final verification'
fi

# Install an absent date by rename. Replace an existing same-date stage with
# renameat2(RENAME_EXCHANGE), so readers see either the complete old generation or
# the complete new generation and never a half-populated directory.
if ! /usr/bin/python3 - "$snapshot" "$dest" <<'PYINSTALL'
import ctypes
import errno
import os
import stat
import sys
source, destination = sys.argv[1:3]
source_info = os.lstat(source)
if not stat.S_ISDIR(source_info.st_mode) or stat.S_ISLNK(source_info.st_mode):
    raise SystemExit("REFUSED: prepared snapshot is unsafe")
if not os.path.exists(destination):
    os.rename(source, destination)
    raise SystemExit(0)
dest_info = os.lstat(destination)
if not stat.S_ISDIR(dest_info.st_mode) or stat.S_ISLNK(dest_info.st_mode):
    raise SystemExit("REFUSED: destination changed to an unsafe type")
libc = ctypes.CDLL(None, use_errno=True)
renameat2 = getattr(libc, "renameat2", None)
if renameat2 is None:
    raise SystemExit("REFUSED: atomic same-date replacement is unsupported")
AT_FDCWD = -100
RENAME_EXCHANGE = 2
result = renameat2(AT_FDCWD, os.fsencode(source), AT_FDCWD, os.fsencode(destination), RENAME_EXCHANGE)
if result != 0:
    error = ctypes.get_errno()
    raise SystemExit(f"REFUSED: atomic same-date replacement failed: {os.strerror(error)}")
PYINSTALL
then
  refuse 'atomic export installation failed'
fi

log "export complete: $date_tag"
