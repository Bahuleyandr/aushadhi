#!/usr/bin/python3
"""Fail-closed retention for unindexed source-cohort generations."""

import datetime
import fcntl
import hashlib
import json
import os
import pwd
import re
import secrets
import shutil
import stat
import sys
import time


GENERATION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
UTC_TIMESTAMP_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$"
)
REQUIRED_FILES = {
    "drugs.csv",
    "drugs.jsonl",
    "compositions.csv",
    "substitute_edges.csv",
    "conflicts.csv",
    "conflicts.jsonl",
    "errors.csv",
    "summary.json",
    "ATTRIBUTION.md",
    "prescribable.jsonl",
    "formulation_groups.jsonl",
    "REPORT.md",
}
OPTIONAL_FILES = {"strength-review-shortlist.csv", "strength-conflicts.csv"}
ALLOWED_FILES = REQUIRED_FILES | OPTIONAL_FILES
JSONL_FILES = {
    "drugs.jsonl",
    "conflicts.jsonl",
    "prescribable.jsonl",
    "formulation_groups.jsonl",
}
MANIFEST_NAME = "cohort-manifest.json"
INDEX_NAME = "cohort-index.json"
MAX_METADATA_BYTES = 16 * 1024 * 1024


class RetentionRefusal(RuntimeError):
    pass


class RetentionSkip(RuntimeError):
    pass


def refuse(message):
    raise RetentionRefusal(message)


def exact_keys(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        refuse(f"{label} has unexpected fields")


def safe_integer(value, label, minimum=0):
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        refuse(f"{label} is invalid")
    return value


def safe_generation_id(value, label="generation id"):
    if not isinstance(value, str) or not GENERATION_RE.fullmatch(value):
        refuse(f"{label} is invalid")
    return value


def safe_date(value, label="cohort date"):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        refuse(f"{label} is invalid")
    try:
        parsed = datetime.date.fromisoformat(value)
    except ValueError:
        refuse(f"{label} is invalid")
    if parsed.isoformat() != value:
        refuse(f"{label} is invalid")
    return value


def utc_timestamp(value, label):
    if not isinstance(value, str) or not UTC_TIMESTAMP_RE.fullmatch(value):
        refuse(f"{label} is invalid")
    try:
        parsed = datetime.datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        refuse(f"{label} is invalid")
    return parsed.replace(tzinfo=datetime.timezone.utc)


def stat_identity(info):
    return (
        info.st_dev,
        info.st_ino,
        info.st_mode,
        info.st_size,
        info.st_mtime_ns,
        info.st_ctime_ns,
    )


def inode_identity(info):
    return (info.st_dev, info.st_ino, info.st_mode)


def stable_file(path, *, capture=False, max_bytes=None):
    flags = os.O_RDONLY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as error:
        refuse(f"cannot safely open {path}: {error}")
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode):
            refuse(f"not a regular file: {path}")
        if max_bytes is not None and before.st_size > max_bytes:
            refuse(f"metadata file exceeds {max_bytes} bytes: {path}")
        digest = hashlib.sha256()
        payload = bytearray() if capture else None
        while True:
            chunk = os.read(descriptor, 1 << 20)
            if not chunk:
                break
            digest.update(chunk)
            if payload is not None:
                payload.extend(chunk)
        after = os.fstat(descriptor)
        if stat_identity(before) != stat_identity(after):
            refuse(f"file changed while verifying: {path}")
        try:
            current = os.lstat(path)
        except OSError as error:
            refuse(f"file path changed while verifying {path}: {error}")
        if stat_identity(after) != stat_identity(current):
            refuse(f"file path changed while verifying: {path}")
        return {
            "payload": bytes(payload) if payload is not None else None,
            "sha256": digest.hexdigest(),
            "identity": stat_identity(after),
            "size": after.st_size,
        }
    finally:
        os.close(descriptor)


def reject_duplicate_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            refuse(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def reject_json_constant(value):
    refuse(f"invalid JSON constant: {value}")


def parse_json_payload(payload, label):
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        refuse(f"{label} is not valid UTF-8: {error}")
    try:
        return json.loads(
            text,
            object_pairs_hook=reject_duplicate_pairs,
            parse_constant=reject_json_constant,
        )
    except json.JSONDecodeError as error:
        refuse(f"{label} is invalid JSON: {error}")


def read_json_stable(path, label):
    snapshot = stable_file(path, capture=True, max_bytes=MAX_METADATA_BYTES)
    snapshot["value"] = parse_json_payload(snapshot["payload"], label)
    return snapshot


def validate_index(index):
    exact_keys(
        index,
        {"schema_version", "updated_at", "latest", "dates", "generations"},
        "cohort index",
    )
    if index["schema_version"] != 1:
        refuse(f"unsupported cohort index schema: {index['schema_version']}")
    utc_timestamp(index["updated_at"], "cohort index updated_at")
    exact_keys(index["latest"], {"date", "generation_id"}, "cohort index latest")
    latest_date = safe_date(index["latest"]["date"], "cohort index latest date")
    latest_id = safe_generation_id(
        index["latest"]["generation_id"], "cohort index latest generation id"
    )
    dates = index["dates"]
    generations = index["generations"]
    if not isinstance(dates, dict):
        refuse("cohort index dates must be an object")
    if not isinstance(generations, dict):
        refuse("cohort index generations must be an object")
    for generation_id, entry in generations.items():
        safe_generation_id(generation_id, "cohort index generation id")
        exact_keys(
            entry,
            {"date", "manifest_sha256", "published_at"},
            f"cohort index generation {generation_id}",
        )
        safe_date(entry["date"], f"cohort index generation {generation_id} date")
        if not isinstance(entry["manifest_sha256"], str) or not SHA256_RE.fullmatch(
            entry["manifest_sha256"]
        ):
            refuse(f"cohort index generation {generation_id} manifest_sha256 is invalid")
        utc_timestamp(
            entry["published_at"],
            f"cohort index generation {generation_id} published_at",
        )
    for date, generation_id in dates.items():
        safe_date(date, "cohort index date pointer")
        safe_generation_id(generation_id, f"cohort index date pointer {date}")
        if generation_id not in generations or generations[generation_id]["date"] != date:
            refuse(f"cohort date pointer {date} does not match generation {generation_id}")
    if (
        dates.get(latest_date) != latest_id
        or latest_id not in generations
        or generations[latest_id]["date"] != latest_date
    ):
        refuse("cohort latest pointer does not match its date and generation records")
    return index


def read_index(dist_root):
    snapshot = read_json_stable(os.path.join(dist_root, INDEX_NAME), "cohort index")
    snapshot["value"] = validate_index(snapshot["value"])
    return snapshot


def ensure_physical_directory(path, label):
    try:
        information = os.lstat(path)
    except OSError as error:
        refuse(f"{label} is unavailable: {error}")
    if not stat.S_ISDIR(information.st_mode) or stat.S_ISLNK(information.st_mode):
        refuse(f"{label} must be a physical directory: {path}")
    return information


def directory_is_direct_child(parent_real, child):
    child_real = os.path.realpath(child)
    if os.path.dirname(child_real) != parent_real:
        refuse(f"generation resolves outside {parent_real}: {child}")
    return child_real


def validate_manifest(manifest, generation_id):
    exact_keys(
        manifest,
        {
            "schema_version",
            "generation_id",
            "date",
            "generated_at",
            "input_fingerprint",
            "counts",
            "files",
        },
        f"generation {generation_id} manifest",
    )
    if manifest["schema_version"] != 1:
        refuse(f"generation {generation_id} manifest schema is unsupported")
    if manifest["generation_id"] != generation_id:
        refuse(f"generation {generation_id} manifest identity mismatch")
    safe_date(manifest["date"], f"generation {generation_id} manifest date")
    generated = utc_timestamp(
        manifest["generated_at"], f"generation {generation_id} generated_at"
    )
    if not isinstance(manifest["input_fingerprint"], str) or not SHA256_RE.fullmatch(
        manifest["input_fingerprint"]
    ):
        refuse(f"generation {generation_id} input_fingerprint is invalid")
    exact_keys(
        manifest["counts"],
        {"drugs", "conflicts", "prescribable", "formulation_groups"},
        f"generation {generation_id} counts",
    )
    for name, value in manifest["counts"].items():
        safe_integer(value, f"generation {generation_id} count {name}")
    files = manifest["files"]
    if not isinstance(files, dict):
        refuse(f"generation {generation_id} files must be an object")
    names = set(files)
    if not REQUIRED_FILES.issubset(names) or not names.issubset(ALLOWED_FILES):
        refuse(f"generation {generation_id} manifest artifact set is invalid")
    for name, metadata in files.items():
        expected_keys = {"sha256", "size_bytes"}
        if name in JSONL_FILES:
            expected_keys.add("record_count")
        exact_keys(metadata, expected_keys, f"generation {generation_id} artifact {name}")
        if not isinstance(metadata["sha256"], str) or not SHA256_RE.fullmatch(
            metadata["sha256"]
        ):
            refuse(f"generation {generation_id} artifact {name} sha256 is invalid")
        safe_integer(
            metadata["size_bytes"], f"generation {generation_id} artifact {name} size"
        )
        if name in JSONL_FILES:
            safe_integer(
                metadata["record_count"],
                f"generation {generation_id} artifact {name} record count",
            )
    return generated


def verify_generation(generations_root, generation_id, expected_index_entry=None):
    safe_generation_id(generation_id)
    directory = os.path.join(generations_root, generation_id)
    before = ensure_physical_directory(directory, f"generation {generation_id}")
    root_real = os.path.realpath(generations_root)
    directory_real = directory_is_direct_child(root_real, directory)
    try:
        entries = list(os.scandir(directory))
    except OSError as error:
        refuse(f"cannot enumerate generation {generation_id}: {error}")
    actual_names = {entry.name for entry in entries}
    for entry in entries:
        if entry.is_symlink() or not entry.is_file(follow_symlinks=False):
            refuse(f"generation {generation_id} contains a non-regular entry: {entry.name}")
    manifest_snapshot = read_json_stable(
        os.path.join(directory, MANIFEST_NAME), f"generation {generation_id} manifest"
    )
    generated = validate_manifest(manifest_snapshot["value"], generation_id)
    manifest = manifest_snapshot["value"]
    expected_names = set(manifest["files"]) | {MANIFEST_NAME}
    if actual_names != expected_names:
        refuse(f"generation {generation_id} has missing or unexpected artifacts")
    artifact_identities = {}
    for name, metadata in sorted(manifest["files"].items()):
        artifact = stable_file(os.path.join(directory, name))
        if artifact["sha256"] != metadata["sha256"]:
            refuse(f"generation {generation_id} artifact {name} hash mismatch")
        if artifact["size"] != metadata["size_bytes"]:
            refuse(f"generation {generation_id} artifact {name} size mismatch")
        artifact_identities[name] = artifact["identity"]
    after = ensure_physical_directory(directory, f"generation {generation_id}")
    if stat_identity(before) != stat_identity(after):
        refuse(f"generation {generation_id} changed while verifying")
    if os.path.realpath(directory) != directory_real:
        refuse(f"generation {generation_id} path changed while verifying")
    if expected_index_entry is not None:
        if manifest_snapshot["sha256"] != expected_index_entry["manifest_sha256"]:
            refuse(f"indexed generation {generation_id} manifest hash mismatch")
        if manifest["date"] != expected_index_entry["date"]:
            refuse(f"indexed generation {generation_id} date mismatch")
    return {
        "directory_identity": stat_identity(after),
        "manifest_identity": manifest_snapshot["identity"],
        "manifest_sha256": manifest_snapshot["sha256"],
        "artifact_identities": artifact_identities,
        "date": manifest["date"],
        "newest_key": (generated.timestamp(), generation_id),
    }


def generation_names(generations_root):
    try:
        entries = list(os.scandir(generations_root))
    except OSError as error:
        refuse(f"cannot enumerate cohort generations: {error}")
    names = []
    for entry in entries:
        safe_generation_id(entry.name, "physical generation directory name")
        if entry.is_symlink() or not entry.is_dir(follow_symlinks=False):
            refuse(f"generation entry is not a physical directory: {entry.name}")
        names.append(entry.name)
    return sorted(names)


def scan_generations(generations_root, index):
    before = ensure_physical_directory(generations_root, "cohort generations root")
    names = generation_names(generations_root)
    snapshots = {}
    for generation_id in names:
        snapshots[generation_id] = verify_generation(
            generations_root,
            generation_id,
            index["generations"].get(generation_id),
        )
    after = ensure_physical_directory(generations_root, "cohort generations root")
    if stat_identity(before) != stat_identity(after):
        refuse("cohort generations root changed while classifying retention")
    missing = sorted(set(index["generations"]) - set(names))
    if missing:
        refuse(f"indexed cohort generation directories are missing: {missing}")
    return names, snapshots


def validate_authority_file(path, testing):
    snapshot = stable_file(path, capture=True, max_bytes=16 * 1024)
    mode = stat.S_IMODE(snapshot["identity"][2])
    information = os.lstat(path)
    if not testing and (information.st_uid != 0 or mode != 0o644):
        refuse("apply authority file must be root:root 0644")
    try:
        lines = snapshot["payload"].decode("utf-8").splitlines()
    except UnicodeDecodeError as error:
        refuse(f"apply authority file is not valid UTF-8: {error}")
    settings = [line.strip() for line in lines if line.strip() and not line.lstrip().startswith("#")]
    apply_settings = [
        line for line in settings
        if line.startswith("AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=")
    ]
    if apply_settings != ["AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=1"]:
        refuse("apply authority file does not explicitly authorize apply mode")


def acquire_run_lock(path):
    parent = os.path.dirname(path)
    ensure_physical_directory(parent, "retention lock directory")
    flags = os.O_RDWR | os.O_CREAT | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags, 0o640)
    except OSError as error:
        refuse(f"cannot safely open retention lock: {error}")
    information = os.fstat(descriptor)
    if not stat.S_ISREG(information.st_mode):
        os.close(descriptor)
        refuse("retention lock is not a regular file")
    current = os.lstat(path)
    if stat_identity(information) != stat_identity(current):
        os.close(descriptor)
        refuse("retention lock path changed while opening")
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(descriptor)
        raise RetentionSkip("source generation retention lock is held")
    return descriptor


def acquire_build_lock(dist_root):
    lock_path = os.path.join(dist_root, ".build.lock")
    try:
        os.mkdir(lock_path, 0o750)
    except FileExistsError:
        information = os.lstat(lock_path)
        if stat.S_ISDIR(information.st_mode) and not stat.S_ISLNK(information.st_mode):
            raise RetentionSkip(f"build lock is held at {lock_path}")
        refuse(f"build lock path is unsafe: {lock_path}")
    except OSError as error:
        refuse(f"cannot acquire build lock: {error}")
    information = ensure_physical_directory(lock_path, "build lock")
    token = secrets.token_hex(16)
    generation_id = f"retention-p{os.getpid()}-{secrets.token_hex(4)}"
    owner = {
        "generation_id": generation_id,
        "pid": os.getpid(),
        "hostname": os.uname().nodename,
        "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(
            timespec="milliseconds"
        ).replace("+00:00", "Z"),
        "token": token,
    }
    owner_path = os.path.join(lock_path, "owner.json")
    owner_identity = None
    try:
        descriptor = os.open(
            owner_path,
            os.O_WRONLY
            | os.O_CREAT
            | os.O_EXCL
            | os.O_CLOEXEC
            | getattr(os, "O_NOFOLLOW", 0),
            0o640,
        )
        try:
            owner_identity = inode_identity(os.fstat(descriptor))
            payload = (json.dumps(owner, separators=(",", ":")) + "\n").encode()
            offset = 0
            while offset < len(payload):
                written = os.write(descriptor, payload[offset:])
                if written <= 0:
                    raise OSError("short write while recording build lock owner")
                offset += written
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    except Exception:
        if owner_identity is not None:
            try:
                current = os.lstat(owner_path)
                if inode_identity(current) == owner_identity and stat.S_ISREG(current.st_mode):
                    os.unlink(owner_path)
            except FileNotFoundError:
                pass
        try:
            os.rmdir(lock_path)
        except OSError:
            pass
        raise
    return {
        "path": lock_path,
        "identity": inode_identity(information),
        "token": token,
    }


def release_build_lock(lock):
    information = ensure_physical_directory(lock["path"], "owned build lock")
    if inode_identity(information) != lock["identity"]:
        refuse("build lock ownership changed before release")
    owner_path = os.path.join(lock["path"], "owner.json")
    owner = read_json_stable(owner_path, "build lock owner")["value"]
    if not isinstance(owner, dict) or owner.get("token") != lock["token"]:
        refuse("build lock token changed before release")
    os.unlink(owner_path)
    os.rmdir(lock["path"])


def test_pause_after_classification(testing):
    marker = os.environ.get("AUSHADHI_SOURCE_GENERATION_RETENTION_TEST_MARKER")
    release = os.environ.get("AUSHADHI_SOURCE_GENERATION_RETENTION_TEST_RELEASE")
    if marker is None and release is None:
        return
    if not testing or marker is None or release is None:
        refuse("retention test pause is available only with both paths in test mode")
    with open(marker, "x", encoding="utf-8") as handle:
        handle.write("classified\n")
    deadline = time.monotonic() + 15
    while not os.path.exists(release):
        if time.monotonic() >= deadline:
            refuse("timed out waiting for retention test release")
        time.sleep(0.02)


def delete_exact_generation(generations_root, generation_id, expected_snapshot):
    if not shutil.rmtree.avoids_symlink_attacks:
        refuse("platform does not provide symlink-safe recursive deletion")
    root_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
    root_descriptor = os.open(generations_root, root_flags)
    quarantine = f".retention-delete-p{os.getpid()}-{secrets.token_hex(4)}-{generation_id}"
    try:
        current = os.stat(generation_id, dir_fd=root_descriptor, follow_symlinks=False)
        if stat_identity(current) != expected_snapshot["directory_identity"]:
            refuse(f"generation {generation_id} identity changed before deletion")
        try:
            os.stat(quarantine, dir_fd=root_descriptor, follow_symlinks=False)
            refuse(f"retention quarantine unexpectedly exists for {generation_id}")
        except FileNotFoundError:
            pass
        os.rename(
            generation_id,
            quarantine,
            src_dir_fd=root_descriptor,
            dst_dir_fd=root_descriptor,
        )
        moved = os.stat(quarantine, dir_fd=root_descriptor, follow_symlinks=False)
        if inode_identity(moved) != expected_snapshot["directory_identity"][:3]:
            refuse(f"generation {generation_id} identity changed during quarantine")
        shutil.rmtree(quarantine, dir_fd=root_descriptor)
        os.fsync(root_descriptor)
    finally:
        os.close(root_descriptor)


def run_retention(dist_root, keep, protected, apply, testing):
    generations_root = os.path.join(dist_root, ".generations")
    ensure_physical_directory(dist_root, "distribution root")
    ensure_physical_directory(generations_root, "cohort generations root")
    dist_real = os.path.realpath(dist_root)
    generations_real = os.path.realpath(generations_root)
    if os.path.dirname(generations_real) != dist_real:
        refuse("cohort generations root resolves outside the distribution root")

    initial_index = read_index(dist_root)
    index = initial_index["value"]
    names, snapshots = scan_generations(generations_root, index)
    physical = set(names)
    indexed = set(index["generations"])
    if not protected.issubset(physical):
        refuse(
            f"configured protected generations are not verified physical cohorts: {sorted(protected - physical)}"
        )
    unindexed = physical - indexed
    newest = set(
        sorted(unindexed, key=lambda name: snapshots[name]["newest_key"])[-keep:]
    )
    latest = index["latest"]["generation_id"]
    date_pointers = set(index["dates"].values())
    preserve = indexed | date_pointers | {latest} | protected | newest
    candidates = sorted(
        physical - preserve, key=lambda name: snapshots[name]["newest_key"]
    )
    mode = "apply" if apply else "dry-run"
    print(
        f"mode={mode} root={dist_root} physical={len(physical)} indexed={len(indexed)} "
        f"unindexed={len(unindexed)} keep={keep} protected={len(protected)} candidates={len(candidates)}"
    )
    print(f"PRESERVE latest {index['latest']['date']} {latest}")
    for date, generation_id in sorted(index["dates"].items()):
        print(f"PRESERVE date-pointer {date} {generation_id}")

    test_pause_after_classification(testing)
    if not apply:
        for generation_id in candidates:
            print(
                f"WOULD REMOVE unindexed generation {generation_id} "
                f"{snapshots[generation_id]['date']}"
            )
        return

    deleted = set()
    initial_names = set(names)
    for generation_id in candidates:
        current_index = read_index(dist_root)
        if (
            current_index["sha256"] != initial_index["sha256"]
            or current_index["identity"] != initial_index["identity"]
            or current_index["payload"] != initial_index["payload"]
        ):
            refuse("cohort index changed after retention classification")
        current_names = set(generation_names(generations_root))
        if current_names != initial_names - deleted:
            refuse("cohort generation set changed after retention classification")
        current_indexed = set(current_index["value"]["generations"])
        current_pointers = set(current_index["value"]["dates"].values()) | {
            current_index["value"]["latest"]["generation_id"]
        }
        if generation_id in current_indexed | current_pointers | protected | newest:
            refuse(f"generation {generation_id} became protected before deletion")
        current_snapshot = verify_generation(generations_root, generation_id)
        if current_snapshot != snapshots[generation_id]:
            refuse(f"generation {generation_id} changed after retention classification")
        delete_exact_generation(generations_root, generation_id, current_snapshot)
        deleted.add(generation_id)
        print(
            f"REMOVED unindexed generation {generation_id} "
            f"{snapshots[generation_id]['date']}"
        )


def main():
    testing = os.environ.get("AUSHADHI_SOURCE_GENERATION_RETENTION_TESTING", "0") == "1"
    if os.geteuid() == 0:
        refuse("source generation retention must not run as root")
    if not testing and pwd.getpwuid(os.geteuid()).pw_name != "aushadhi":
        refuse("source generation retention must run as aushadhi")

    dist_root = os.path.abspath(
        os.environ.get("AUSHADHI_DIST_ROOT", "/var/lib/aushadhi/dist")
    )
    lock_file = os.path.abspath(
        os.environ.get(
            "AUSHADHI_SOURCE_GENERATION_RETENTION_LOCK",
            "/var/cache/aushadhi/source-generation-retention/retention.lock",
        )
    )
    authority_file = os.path.abspath(
        os.environ.get(
            "AUSHADHI_SOURCE_GENERATION_RETENTION_AUTHORITY_FILE",
            "/etc/aushadhi/source-generation-retention-apply.conf",
        )
    )
    if not testing:
        if dist_root != "/var/lib/aushadhi/dist":
            refuse("production retention root must be /var/lib/aushadhi/dist")
        if lock_file != "/var/cache/aushadhi/source-generation-retention/retention.lock":
            refuse("production retention lock path is fixed")
        if authority_file != "/etc/aushadhi/source-generation-retention-apply.conf":
            refuse("production apply authority path is fixed")

    apply_raw = os.environ.get("AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY", "0")
    keep_raw = os.environ.get("AUSHADHI_SOURCE_GENERATION_RETENTION_KEEP", "14")
    protect_raw = os.environ.get("AUSHADHI_SOURCE_GENERATION_RETENTION_PROTECT", "")
    if apply_raw not in {"0", "1"}:
        refuse("AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY must be 0 or 1")
    if not re.fullmatch(r"\d+", keep_raw or ""):
        refuse("AUSHADHI_SOURCE_GENERATION_RETENTION_KEEP must be between 1 and 365")
    keep = int(keep_raw)
    if keep < 1 or keep > 365:
        refuse("AUSHADHI_SOURCE_GENERATION_RETENTION_KEEP must be between 1 and 365")
    protected = {
        token.strip() for token in protect_raw.split(",") if token.strip()
    }
    for generation_id in protected:
        safe_generation_id(generation_id, "configured protected generation id")
    apply = apply_raw == "1"
    if apply:
        validate_authority_file(authority_file, testing)

    run_lock = acquire_run_lock(lock_file)
    build_lock = None
    failure = None
    try:
        build_lock = acquire_build_lock(dist_root)
        run_retention(dist_root, keep, protected, apply, testing)
    except Exception as error:
        failure = error
    finally:
        if build_lock is not None:
            try:
                release_build_lock(build_lock)
            except Exception as error:
                if failure is None:
                    failure = error
                else:
                    failure = RetentionRefusal(
                        f"{failure}; build lock cleanup also failed: {error}"
                    )
        os.close(run_lock)
    if failure is not None:
        raise failure


if __name__ == "__main__":
    try:
        main()
    except RetentionSkip as error:
        print(f"SKIP: {error}")
    except (RetentionRefusal, OSError) as error:
        print(f"REFUSED: {error}", file=sys.stderr)
        raise SystemExit(2)
