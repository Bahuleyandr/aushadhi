#!/usr/bin/env bash
# Conservative retention for verified Aushadhi export snapshots only.
set -Eeuo pipefail
umask 027

if [ "${EUID}" -eq 0 ]; then
  printf '%s\n' 'REFUSED: export retention must not run as root' >&2
  exit 2
fi

if [ "${AUSHADHI_EXPORT_RETENTION_TESTING:-0}" = "1" ]; then
  readonly EXPORT_ROOT="${AUSHADHI_EXPORT_ROOT:?test export root required}"
else
  [ "$(/usr/bin/id -un)" = "aushadhi" ] || {
    printf '%s\n' 'REFUSED: export retention must run as aushadhi' >&2
    exit 2
  }
  readonly EXPORT_ROOT="${AUSHADHI_EXPORT_ROOT:-/var/lib/aushadhi-export}"
  [ "$EXPORT_ROOT" = "/var/lib/aushadhi-export" ] || {
    printf '%s\n' 'REFUSED: production retention root must be /var/lib/aushadhi-export' >&2
    exit 2
  }
fi

readonly APPLY="${AUSHADHI_EXPORT_RETENTION_APPLY:-0}"
readonly KEEP="${AUSHADHI_EXPORT_RETENTION_KEEP:-14}"
readonly PROTECT="${AUSHADHI_EXPORT_RETENTION_PROTECT:-}"

[ "$APPLY" = "0" ] || [ "$APPLY" = "1" ] || {
  printf '%s\n' 'REFUSED: AUSHADHI_EXPORT_RETENTION_APPLY must be 0 or 1' >&2
  exit 2
}
[[ "$KEEP" =~ ^[0-9]+$ ]] && [ "$KEEP" -ge 1 ] && [ "$KEEP" -le 365 ] || {
  printf '%s\n' 'REFUSED: AUSHADHI_EXPORT_RETENTION_KEEP must be between 1 and 365' >&2
  exit 2
}
[ -d "$EXPORT_ROOT" ] && [ ! -L "$EXPORT_ROOT" ] || {
  printf '%s\n' 'REFUSED: export root is missing or symlinked' >&2
  exit 2
}
[ "$(/usr/bin/basename "$EXPORT_ROOT")" = "aushadhi-export" ] || {
  printf '%s\n' 'REFUSED: export retention root must end in aushadhi-export' >&2
  exit 2
}
[ -x /usr/bin/flock ] || {
  printf '%s\n' 'REFUSED: flock is unavailable' >&2
  exit 2
}

# Export and retention share one exclusive root lock. Neither job may classify or
# replace directories while the other is reading them.
lock="$EXPORT_ROOT/.export.lock"
if [ -L "$lock" ] || { [ -e "$lock" ] && [ ! -f "$lock" ]; }; then
  printf 'REFUSED: export root lock path is unsafe: %s\n' "$lock" >&2
  exit 2
fi
exec {lock_fd}>>"$lock" || {
  printf 'REFUSED: cannot open export root lock: %s\n' "$lock" >&2
  exit 2
}
if [ -L "$lock" ] || [ ! -f "$lock" ]; then
  printf 'REFUSED: export root lock path changed unsafely: %s\n' "$lock" >&2
  exit 2
fi
opened_lock_identity=$(/usr/bin/stat -Lc '%d:%i' "/proc/$$/fd/$lock_fd") || {
  printf '%s\n' 'REFUSED: cannot identify the opened export root lock' >&2
  exit 2
}
current_lock_identity=$(/usr/bin/stat -Lc '%d:%i' "$lock") || {
  printf '%s\n' 'REFUSED: cannot identify the current export root lock' >&2
  exit 2
}
[ "$opened_lock_identity" = "$current_lock_identity" ] || {
  printf '%s\n' 'REFUSED: export root lock changed while opening' >&2
  exit 2
}
/usr/bin/flock --exclusive --nonblock "$lock_fd" || {
  printf 'REFUSED: export root lock is held: %s\n' "$lock" >&2
  exit 2
}
current_lock_identity=$(/usr/bin/stat -Lc '%d:%i' "$lock") || {
  printf '%s\n' 'REFUSED: cannot revalidate the current export root lock' >&2
  exit 2
}
[ "$opened_lock_identity" = "$current_lock_identity" ] || {
  printf '%s\n' 'REFUSED: export root lock changed after acquisition' >&2
  exit 2
}

status=0
/usr/bin/python3 - "$EXPORT_ROOT" "$KEEP" "$PROTECT" "$APPLY" <<'PYRETENTION' || status=$?
import datetime
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import unicodedata

root, keep_raw, protect_raw, apply_raw = sys.argv[1:5]
keep = int(keep_raw)
apply = apply_raw == "1"
date_re = re.compile(r"^\d{4}-\d{2}-\d{2}$")
generation_re = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
sha_re = re.compile(r"^[a-f0-9]{64}$")

def restricted_source_identity(value):
    if not isinstance(value, str):
        return False
    compact = re.sub(
        r"[^a-z0-9]+", "", unicodedata.normalize("NFKC", value).casefold()
    )
    return (
        "cdci" in compact
        or "commondrugcodesforindia" in compact
        or "indiadrugextension" in compact
        or "in1000189" in compact
        or ("snomed" in compact and "india" in compact and "drug" in compact)
    )

def refuse(message):
    raise RuntimeError(message)

def stable_digest(path, *, capture=False, max_capture_bytes=None):
    flags = os.O_RDONLY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode):
            refuse(f"not a regular file: {path}")
        if capture and max_capture_bytes is not None and before.st_size > max_capture_bytes:
            refuse(f"metadata file exceeds {max_capture_bytes} bytes: {path}")
        digest = hashlib.sha256()
        payload = bytearray() if capture else None
        while True:
            chunk = os.read(fd, 1 << 20)
            if not chunk:
                break
            digest.update(chunk)
            if payload is not None:
                payload.extend(chunk)
        after = os.fstat(fd)
        stable = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")
        if any(getattr(before, key) != getattr(after, key) for key in stable):
            refuse(f"file changed while verifying: {path}")
        return (bytes(payload) if payload is not None else None), before.st_size, digest.hexdigest()
    finally:
        os.close(fd)

def require_sha(value, label):
    if not isinstance(value, str) or not sha_re.fullmatch(value):
        refuse(f"{label} is not a SHA-256 identity")

def require_hash_map(value, label):
    if not isinstance(value, dict) or not value:
        refuse(f"{label} is not a non-empty SHA-256 hash map")
    for pathname, digest in value.items():
        if not isinstance(pathname, str) or not pathname or not isinstance(digest, str) or not sha_re.fullmatch(digest):
            refuse(f"{label} contains an invalid SHA-256 entry")

def verify_artifact(directory, entry, label):
    if not isinstance(entry, dict):
        refuse(f"{label} metadata is missing")
    name = entry.get("filename")
    if not isinstance(name, str) or name in {"", ".", ".."} or os.path.basename(name) != name:
        refuse(f"{label} has an unsafe filename")
    if restricted_source_identity(name):
        refuse(f"{label} crosses the CDCI exclusion boundary")
    expected_size = entry.get("size_bytes")
    expected_sha = entry.get("sha256")
    require_sha(expected_sha, f"{label} hash")
    if isinstance(expected_size, bool) or not isinstance(expected_size, int) or expected_size < 0:
        refuse(f"{label} size is invalid")
    _, actual_size, actual_sha = stable_digest(os.path.join(directory, name))
    if actual_size != expected_size:
        refuse(f"{label}: {name} size mismatch")
    if actual_sha != expected_sha:
        refuse(f"{label}: {name} hash mismatch")
    return name

def verify_snapshot(name):
    directory = os.path.join(root, name)
    info = os.lstat(directory)
    if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
        refuse(f"{name} is not a physical snapshot directory")
    try:
        datetime.date.fromisoformat(name)
    except ValueError:
        refuse(f"{name} is not a calendar date")
    raw, _, _ = stable_digest(
        os.path.join(directory, "stage-manifest.json"), capture=True, max_capture_bytes=4 << 20,
    )
    try:
        manifest = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        refuse(f"{name} stage-manifest.json is invalid: {error}")
    if manifest.get("schema_version") != 4 or manifest.get("stage_kind") != "aushadhi-export-snapshot":
        refuse(f"{name} is not a schema-4 export snapshot")
    if manifest.get("release_date") != name:
        refuse(f"{name} release_date mismatch")
    generation = manifest.get("generation_id")
    if not isinstance(generation, str) or not generation_re.fullmatch(generation):
        refuse(f"{name} generation_id is invalid")

    cohort = manifest.get("cohort")
    if not isinstance(cohort, dict) or cohort.get("schema_version") != 1:
        refuse(f"{name} cohort identity is invalid")
    require_sha(cohort.get("manifest_sha256"), f"{name} cohort manifest hash")
    cohort_files = cohort.get("files")
    if not isinstance(cohort_files, dict):
        refuse(f"{name} cohort files are missing")
    for required in ("drugs.jsonl", "prescribable.jsonl", "summary.json"):
        expected = cohort_files.get(required)
        if not isinstance(expected, dict):
            refuse(f"{name} cohort does not bind {required}")
        require_sha(expected.get("sha256"), f"{name} {required} hash")
        if isinstance(expected.get("size_bytes"), bool) or not isinstance(expected.get("size_bytes"), int):
            refuse(f"{name} {required} size is invalid")

    source = manifest.get("source")
    expected_source = cohort_files["drugs.jsonl"]
    if not isinstance(source, dict) \
            or source.get("path") != f".generations/{generation}/drugs.jsonl" \
            or source.get("sha256") != expected_source.get("sha256") \
            or source.get("size_bytes") != expected_source.get("size_bytes") \
            or source.get("record_count") != expected_source.get("record_count"):
        refuse(f"{name} source is not bound to the cohort")
    prescribable = manifest.get("prescribable")
    expected_prescribable = cohort_files["prescribable.jsonl"]
    if not isinstance(prescribable, dict) \
            or prescribable.get("uncompressed_sha256") != expected_prescribable.get("sha256") \
            or prescribable.get("uncompressed_size_bytes") != expected_prescribable.get("size_bytes") \
            or prescribable.get("record_count") != expected_prescribable.get("record_count"):
        refuse(f"{name} prescribable artifact is not bound to the cohort")

    code_release = manifest.get("code_release")
    if not isinstance(code_release, dict):
        refuse(f"{name} release identity is missing")
    commit = code_release.get("repository_commit")
    if not isinstance(commit, str) or not re.fullmatch(r"[a-fA-F0-9]{7,64}", commit):
        refuse(f"{name} repository commit is invalid")
    for field in (
        "repository_tree_sha256",
        "runtime_manifest_sha256",
        "dependency_tree_sha256",
        "release_receipt_sha256",
    ):
        require_sha(code_release.get(field), f"{name} {field}")
    for field in ("installed_files_sha256", "systemd_files_sha256", "privileged_files_sha256"):
        require_hash_map(code_release.get(field), f"{name} {field}")

    policy = manifest.get("artifact_policy")
    if policy != {"profile": "internal-evaluation", "redistributable": False, "production_authority": "none"}:
        refuse(f"{name} is not explicitly internal-evaluation/non-redistributable")
    sources = manifest.get("source_list")
    if not isinstance(sources, list) or not sources:
        refuse(f"{name} source list is missing")
    for source_entry in sources:
        if not isinstance(source_entry, dict) or set(source_entry) != {"source_id", "record_count"}:
            refuse(f"{name} source list is invalid or crosses the CDCI boundary")
        source_id = source_entry.get("source_id")
        record_count = source_entry.get("record_count")
        if not isinstance(source_id, str) or not source_id \
                or restricted_source_identity(source_id) \
                or isinstance(record_count, bool) or not isinstance(record_count, int) \
                or record_count < 0:
            refuse(f"{name} source list is invalid or crosses the CDCI boundary")

    recovery = manifest.get("recovery_policy")
    if not isinstance(recovery, dict) or recovery.get("critical_state_required") is not True \
            or recovery.get("sqlite_backup_method") != "sqlite-online-backup" \
            or recovery.get("restricted_cdci_exported") is not False \
            or recovery.get("licensed_recovery_boundary") != "internal-recovery-only":
        refuse(f"{name} recovery policy is incomplete")
    excluded = recovery.get("generic_archive_excludes")
    if not isinstance(excluded, list) or not {"restricted", "SQLite", "WAL", "SHM"}.issubset(excluded):
        refuse(f"{name} recovery exclusions are incomplete")
    ephemeral = recovery.get("ephemeral_state_excludes")
    if not isinstance(ephemeral, list) or not {
        "state.json.crawler-state.lock", ".build.lock", ".export.lock", ".state.json.tmp-*",
    }.issubset(ephemeral):
        refuse(f"{name} ephemeral state exclusions are incomplete")
    if manifest.get("state_note") != "ok":
        refuse(f"{name} does not contain required critical state")

    expected_files = {"stage-manifest.json"}
    expected_files.add(verify_artifact(directory, manifest.get("artifact"), f"{name} drugs artifact"))
    expected_files.add(verify_artifact(directory, prescribable, f"{name} prescribable artifact"))
    state = manifest.get("state_snapshot")
    if not isinstance(state, dict) or state.get("verification") != "required":
        refuse(f"{name} state snapshot is not required")
    expected_files.add(verify_artifact(directory, state, f"{name} state snapshot"))
    review = manifest.get("review_shortlist")
    if review is not None:
        expected_files.add(verify_artifact(directory, review, f"{name} review shortlist"))
    databases = manifest.get("databases")
    if not isinstance(databases, list):
        refuse(f"{name} database backup list is invalid")
    for index, database in enumerate(databases):
        if not isinstance(database, dict) or database.get("verification") != "verified-online-backup":
            refuse(f"{name} SQLite backup {index} is not verified")
        expected_files.add(verify_artifact(directory, {
            "filename": database.get("snapshot"),
            "size_bytes": database.get("snapshot_size_bytes"),
            "sha256": database.get("snapshot_sha256"),
        }, f"{name} SQLite backup {index}"))
        relative = database.get("source_relative_path")
        if not isinstance(relative, str) or restricted_source_identity(relative) \
                or relative.startswith(("/", "../")):
            refuse(f"{name} SQLite backup {index} source path is unsafe")

    actual_files = set(os.listdir(directory))
    if actual_files != expected_files:
        refuse(f"{name} has missing or unexpected export artifacts")
    return {"date": name, "generation": generation}

try:
    root_info = os.lstat(root)
    if not stat.S_ISDIR(root_info.st_mode) or stat.S_ISLNK(root_info.st_mode):
        refuse("export root is not a physical directory")
    entries = sorted(os.listdir(root))
    unexpected = [entry for entry in entries if entry != ".export.lock" and not date_re.fullmatch(entry)]
    if unexpected:
        refuse(f"unexpected export-root entries block retention: {unexpected}")
    names = [entry for entry in entries if date_re.fullmatch(entry)]
    snapshots = [verify_snapshot(name) for name in names]
    snapshots.sort(key=lambda item: item["date"])

    protected_tokens = [token.strip() for token in protect_raw.split(",") if token.strip()]
    if any(not generation_re.fullmatch(token) for token in protected_tokens):
        refuse("AUSHADHI_EXPORT_RETENTION_PROTECT contains an invalid token")
    protected_names = set()
    for token in protected_tokens:
        matched = [item["date"] for item in snapshots if token in {item["date"], item["generation"]}]
        if not matched:
            refuse(f"configured protected cohort is not a verified export: {token}")
        protected_names.update(matched)

    newest_names = {item["date"] for item in snapshots[-keep:]}
    preserve = newest_names | protected_names
    candidates = [item for item in snapshots if item["date"] not in preserve]
    mode = "apply" if apply else "dry-run"
    print(f"mode={mode} root={root} verified={len(snapshots)} keep={keep} protected={len(protected_names)} candidates={len(candidates)}")
    if snapshots:
        latest = snapshots[-1]
        print(f"PRESERVE latest {latest['date']} {latest['generation']}")

    if not apply:
        for item in candidates:
            print(f"WOULD REMOVE verified export {item['date']} {item['generation']}")
        raise SystemExit(0)

    # Revalidate every candidate and compare its generation immediately before
    # mutation. Then atomically move all candidates aside before deleting any;
    # a rename failure rolls the whole set back.
    for expected in candidates:
        current = verify_snapshot(expected["date"])
        if current != expected:
            refuse(f"{expected['date']} changed after retention classification")
    moved = []
    try:
        for item in candidates:
            source = os.path.join(root, item["date"])
            quarantine = os.path.join(root, f".retention-delete-{item['date']}-{os.getpid()}")
            if os.path.lexists(quarantine):
                refuse(f"retention quarantine already exists for {item['date']}")
            os.rename(source, quarantine)
            moved.append((item, source, quarantine))
    except Exception:
        for _, source, quarantine in reversed(moved):
            if os.path.lexists(quarantine) and not os.path.lexists(source):
                os.rename(quarantine, source)
        raise
    for item, _, quarantine in moved:
        shutil.rmtree(quarantine)
        print(f"REMOVED verified export {item['date']} {item['generation']}")
except (RuntimeError, OSError) as error:
    print(f"REFUSED: {error}", file=sys.stderr)
    raise SystemExit(2)
PYRETENTION
[ "$status" -eq 0 ] || exit "$status"
