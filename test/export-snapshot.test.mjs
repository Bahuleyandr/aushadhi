import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let bashWorkingDirectory;

const bashProbe = spawnSync(
  'bash',
  ['-c', 'test "$EUID" -ne 0 || { command -v runuser >/dev/null && id -u nobody >/dev/null; }'],
  { encoding: 'utf8' },
);
const requiresNonRootBash = bashProbe.status === 0
  ? {}
  : { skip: 'Bash cannot execute the exporter as a non-root user on this machine' };

function bashPath(value) {
  if (bashWorkingDirectory === undefined) {
    const bashCwd = spawnSync('bash', ['-c', 'pwd -P'], {
      cwd: '.',
      encoding: 'utf8',
    });
    if (bashCwd.status !== 0 || !bashCwd.stdout.trim()) {
      throw new Error(`cannot resolve the Bash working directory: ${bashCwd.stderr}`);
    }
    bashWorkingDirectory = bashCwd.stdout.trim();
  }
  const relative = path.relative('.', path.resolve(value)).replaceAll('\\', '/');
  return `${bashWorkingDirectory}/${relative}`;
}

const HARNESS_HELPERS = String.raw`
make_fake_zstd() {
  /bin/cat > "$fake_zstd" <<'FAKEZSTD'
#!/usr/bin/env bash
set -Eeuo pipefail
output=''
remove_source=0
source_file=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      output="$2"
      shift 2
      ;;
    --rm)
      remove_source=1
      shift
      ;;
    --)
      shift
      if [ "$#" -gt 0 ]; then source_file="$1"; shift; fi
      ;;
    -*) shift ;;
    *) source_file="$1"; shift ;;
  esac
done
if [ -n "$source_file" ]; then
  if [ -n "$output" ]; then target="$output"; else target="$source_file.zst"; fi
  /bin/cat -- "$source_file" > "$target"
  if [ "$remove_source" -eq 1 ]; then /bin/rm -f -- "$source_file"; fi
elif [ -n "$output" ]; then
  /bin/cat > "$output"
else
  /bin/cat
fi
FAKEZSTD
  /bin/chmod 0755 "$fake_zstd"
}

write_release_receipt() {
  /usr/bin/python3 - "$release_receipt" <<'PYRELEASE'
import json, sys
doc = {
    "schema_version": 1,
    "repository_commit": "a" * 40,
    "repository_tree_sha256": "b" * 64,
    "runtime_manifest_sha256": "1" * 64,
    "dependency_tree_sha256": "2" * 64,
    "privileged_files_sha256": {"usr/local/libexec/helper": "3" * 64},
    "installed_tree_metadata_sha256": "4" * 64,
    "inspection_profile": "staging-test",
    "inspected_roots": {
        "source_root": "/tmp/source",
        "installed_root": "/tmp/installed",
        "systemd_root": "/tmp/systemd",
        "privileged_root": "/tmp/privileged",
        "export_roots": ["/tmp/export"],
        "runtime_manifest": "/tmp/source/deploy/dalekdefender/runtime-manifest.json",
    },
    "filesystem_policy": {
        "installed_tree": {"uid": 0, "gid": 0, "receipt_mode": "0644"},
        "systemd_files": {"uid": 0, "gid": 0, "mode": "0644"},
        "privileged_files": [{"target": "usr/local/libexec/helper", "uid": 0, "gid": 0, "mode": "0755"}],
    },
    "installed_at_utc": "2026-08-06T01:02:03Z",
    "installed_files_sha256": {"package.json": "c" * 64},
    "systemd_files_sha256": {"aushadhi-build.service": "d" * 64},
    "artifact_policy": {
        "profile": "internal-evaluation",
        "redistributable": False,
        "production_authority": "none",
        "restricted_sources": ["janaushadhi", "onemg-live"],
    },
}
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump(doc, handle, sort_keys=True)
    handle.write("\n")
PYRELEASE
}

write_cohort() {
  generation="$1"
  drug_id="$2"
  prescribable_id="$3"
  if [ "$#" -ge 4 ]; then cohort_date="$4"; else cohort_date="2026-08-06"; fi
  cohort="$repo/dist/.generations/$generation"
  /bin/mkdir -p "$cohort"
  /usr/bin/printf '{"id":"%s","sources":[{"source":"onemg-live"}]}\n' "$drug_id" > "$cohort/drugs.jsonl"
  /usr/bin/printf '{"med_id":"%s"}\n' "$prescribable_id" > "$cohort/prescribable.jsonl"
  /usr/bin/printf '%s\n' 'review-row' > "$cohort/strength-review-shortlist.csv"
  /usr/bin/python3 - "$cohort" "$generation" "$cohort_date" <<'PYCOHORT'
import hashlib, json, os, sys
root, generation, cohort_date = sys.argv[1:4]
summary = {
    "date": cohort_date,
    "total_rows": 1,
    "conflicts": 0,
    "sources": {"github-jr": 1, "onemg-live": 1},
}
with open(os.path.join(root, "summary.json"), "w", encoding="utf-8") as handle:
    json.dump(summary, handle, sort_keys=True)
    handle.write("\n")
files = {}
for name in ("drugs.jsonl", "prescribable.jsonl", "summary.json", "strength-review-shortlist.csv"):
    target = os.path.join(root, name)
    with open(target, "rb") as handle:
        contents = handle.read()
    files[name] = {
        "sha256": hashlib.sha256(contents).hexdigest(),
        "size_bytes": len(contents),
    }
    if name.endswith(".jsonl"):
        files[name]["record_count"] = sum(bool(line.strip()) for line in contents.splitlines())
manifest = {
    "schema_version": 1,
    "generation_id": generation,
    "date": cohort_date,
    "generated_at": f"{cohort_date}T01:00:00.000Z",
    "input_fingerprint": "e" * 64,
    "counts": {"drugs": 1, "prescribable": 1},
    "files": files,
}
manifest_path = os.path.join(root, "cohort-manifest.json")
with open(manifest_path, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, sort_keys=True)
    handle.write("\n")
with open(manifest_path, "rb") as handle:
    manifest_sha = hashlib.sha256(handle.read()).hexdigest()
dist_root = os.path.dirname(os.path.dirname(root))
index_path = os.path.join(dist_root, "cohort-index.json")
if os.path.exists(index_path):
    with open(index_path, encoding="utf-8") as handle:
        index = json.load(handle)
else:
    index = {"schema_version": 1, "dates": {}, "generations": {}}
published_at = f"{cohort_date}T01:00:00.000Z"
index.update({
    "updated_at": published_at,
    "latest": {"date": cohort_date, "generation_id": generation},
})
index["dates"][cohort_date] = generation
index["generations"][generation] = {
    "date": cohort_date,
    "manifest_sha256": manifest_sha,
    "published_at": published_at,
}
with open(index_path, "w", encoding="utf-8") as handle:
    json.dump(index, handle, sort_keys=True)
    handle.write("\n")
PYCOHORT
}

make_state() {
  /bin/mkdir -p \
    "$repo/data/ordinary/.build.lock" \
    "$repo/data/ordinary/.export.lock" \
    "$repo/data/pages" \
    "$repo/data/raw/onemg/pages" \
    "$repo/data/restricted/cdci"
  /usr/bin/printf '%s\n' ordinary-state > "$repo/data/ordinary/state.json"
  /usr/bin/printf '%s\n' durable-outcome > "$repo/data/ordinary/outcomes.jsonl"
  /usr/bin/printf '%s\n' stale-lock > "$repo/data/ordinary/state.json.crawler-state.lock"
  /usr/bin/printf '%s\n' stale-temp > "$repo/data/ordinary/.state.json.tmp-123-deadbeef"
  /usr/bin/printf '%s\n' stale-cache-lock > "$repo/data/ordinary/.cache-retention.lock"
  /usr/bin/printf '%s\n' stale-build-owner > "$repo/data/ordinary/.build.lock/owner.json"
  /usr/bin/printf '%s\n' stale-export-owner > "$repo/data/ordinary/.export.lock/owner.json"
  /usr/bin/printf '%s\n' page-cache > "$repo/data/pages/cache.html"
  /usr/bin/printf '%s\n' nested-page-cache > "$repo/data/raw/onemg/pages/cache.html"
  /usr/bin/printf '%s\n' cdci-secret > "$repo/data/restricted/cdci/source.csv"
  /usr/bin/python3 - "$repo/data/ordinary/allowed.sqlite" "$repo/data/restricted/cdci/secret.sqlite" <<'PYDB'
import sqlite3, sys
for database, value in zip(sys.argv[1:], ("ordinary", "restricted"), strict=True):
    connection = sqlite3.connect(database)
    connection.execute("CREATE TABLE fixture (value TEXT NOT NULL)")
    connection.execute("INSERT INTO fixture VALUES (?)", (value,))
    connection.commit()
    connection.close()
PYDB
  /usr/bin/printf '%s\n' excluded-wal > "$repo/data/ordinary/allowed.sqlite-wal"
  /usr/bin/printf '%s\n' excluded-shm > "$repo/data/ordinary/allowed.sqlite-shm"
}

run_export() {
  if [ "$EUID" -eq 0 ]; then
    /bin/chown -R "$(id -u nobody):$(id -g nobody)" "$test_root"
    "$(command -v runuser)" -u nobody -- /usr/bin/env \
      AUSHADHI_EXPORT_TESTING=1 \
      AUSHADHI_EXPORT_REPO="$repo" \
      AUSHADHI_EXPORT_STAGING="$staging" \
      AUSHADHI_EXPORT_ZSTD="$fake_zstd" \
      AUSHADHI_EXPORT_RELEASE_RECEIPT="$release_receipt" \
      bash "$AUSHADHI_EXPORT_SCRIPT"
  else
    /usr/bin/env \
      AUSHADHI_EXPORT_TESTING=1 \
      AUSHADHI_EXPORT_REPO="$repo" \
      AUSHADHI_EXPORT_STAGING="$staging" \
      AUSHADHI_EXPORT_ZSTD="$fake_zstd" \
      AUSHADHI_EXPORT_RELEASE_RECEIPT="$release_receipt" \
      bash "$AUSHADHI_EXPORT_SCRIPT"
  fi
}

run_retention() {
  apply="$1"
  keep="$2"
  if [ "$EUID" -eq 0 ]; then
    /bin/chown -R "$(id -u nobody):$(id -g nobody)" "$test_root"
    "$(command -v runuser)" -u nobody -- /usr/bin/env \
      AUSHADHI_EXPORT_RETENTION_TESTING=1 \
      AUSHADHI_EXPORT_ROOT="$staging" \
      AUSHADHI_EXPORT_RETENTION_APPLY="$apply" \
      AUSHADHI_EXPORT_RETENTION_KEEP="$keep" \
      AUSHADHI_EXPORT_RETENTION_PROTECT='' \
      bash "$AUSHADHI_RETENTION_SCRIPT"
  else
    /usr/bin/env \
      AUSHADHI_EXPORT_RETENTION_TESTING=1 \
      AUSHADHI_EXPORT_ROOT="$staging" \
      AUSHADHI_EXPORT_RETENTION_APPLY="$apply" \
      AUSHADHI_EXPORT_RETENTION_KEEP="$keep" \
      AUSHADHI_EXPORT_RETENTION_PROTECT='' \
      bash "$AUSHADHI_RETENTION_SCRIPT"
  fi
}

run_export_limited() {
  if [ "$EUID" -eq 0 ]; then
    /bin/chown -R "$(id -u nobody):$(id -g nobody)" "$test_root"
    "$(command -v runuser)" -u nobody -- /usr/bin/env \
      AUSHADHI_EXPORT_TESTING=1 \
      AUSHADHI_EXPORT_REPO="$repo" \
      AUSHADHI_EXPORT_STAGING="$staging" \
      AUSHADHI_EXPORT_ZSTD="$fake_zstd" \
      AUSHADHI_EXPORT_RELEASE_RECEIPT="$release_receipt" \
      bash -c 'ulimit -v 65536; exec bash "$1"' _ "$AUSHADHI_EXPORT_SCRIPT"
  else
    /usr/bin/env \
      AUSHADHI_EXPORT_TESTING=1 \
      AUSHADHI_EXPORT_REPO="$repo" \
      AUSHADHI_EXPORT_STAGING="$staging" \
      AUSHADHI_EXPORT_ZSTD="$fake_zstd" \
      AUSHADHI_EXPORT_RELEASE_RECEIPT="$release_receipt" \
      bash -c 'ulimit -v 65536; exec bash "$1"' _ "$AUSHADHI_EXPORT_SCRIPT"
  fi
}

rebind_cohort() {
  /usr/bin/python3 - "$cohort" "$repo/dist/cohort-index.json" <<'PYREBIND'
import hashlib, json, os, sys
root, index_path = sys.argv[1:3]
manifest_path = os.path.join(root, "cohort-manifest.json")
with open(manifest_path, encoding="utf-8") as handle:
    manifest = json.load(handle)
for name, metadata in manifest["files"].items():
    with open(os.path.join(root, name), "rb") as handle:
        contents = handle.read()
    metadata["sha256"] = hashlib.sha256(contents).hexdigest()
    metadata["size_bytes"] = len(contents)
    if "record_count" in metadata:
        metadata["record_count"] = sum(bool(line.strip()) for line in contents.splitlines())
with open(manifest_path, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, sort_keys=True)
    handle.write("\n")
with open(manifest_path, "rb") as handle:
    manifest_sha = hashlib.sha256(handle.read()).hexdigest()
with open(index_path, encoding="utf-8") as handle:
    index = json.load(handle)
index["generations"][manifest["generation_id"]]["manifest_sha256"] = manifest_sha
with open(index_path, "w", encoding="utf-8") as handle:
    json.dump(index, handle, sort_keys=True)
    handle.write("\n")
PYREBIND
}

add_large_manifest_sentinel() {
  /usr/bin/truncate -s 96M "$cohort/large-validation-sentinel.bin"
  /usr/bin/python3 - "$cohort" "$repo/dist/cohort-index.json" <<'PYSENTINEL'
import hashlib, json, os, sys
root, index_path = sys.argv[1:3]
target = os.path.join(root, "large-validation-sentinel.bin")
digest = hashlib.sha256()
with open(target, "rb") as handle:
    for chunk in iter(lambda: handle.read(1 << 20), b""):
        digest.update(chunk)
manifest_path = os.path.join(root, "cohort-manifest.json")
with open(manifest_path, encoding="utf-8") as handle:
    manifest = json.load(handle)
manifest["files"]["large-validation-sentinel.bin"] = {
    "sha256": digest.hexdigest(),
    "size_bytes": os.path.getsize(target),
}
with open(manifest_path, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, sort_keys=True)
    handle.write("\n")
with open(manifest_path, "rb") as handle:
    manifest_sha = hashlib.sha256(handle.read()).hexdigest()
with open(index_path, encoding="utf-8") as handle:
    index = json.load(handle)
index["generations"][manifest["generation_id"]]["manifest_sha256"] = manifest_sha
with open(index_path, "w", encoding="utf-8") as handle:
    json.dump(index, handle, sort_keys=True)
    handle.write("\n")
PYSENTINEL
}
`;

function runHarness(body) {
  return spawnSync('bash', ['-s'], {
    cwd: '.',
    encoding: 'utf8',
    input: `set -Eeuo pipefail
test_root="$(mktemp -d)"
trap '/bin/rm -rf -- "$test_root"' EXIT
repo="$test_root/repo"
staging="$test_root/aushadhi-export"
fake_zstd="$test_root/fake-zstd.sh"
release_receipt="$repo/DEPLOYED-RELEASE.json"
/bin/mkdir -p "$repo/dist" "$repo/data" "$staging"
${HARNESS_HELPERS}
make_fake_zstd
write_release_receipt
${body}
`,
    env: {
      ...process.env,
      WSLENV: [process.env.WSLENV, 'AUSHADHI_EXPORT_SCRIPT', 'AUSHADHI_RETENTION_SCRIPT']
        .filter(Boolean).join(':'),
      AUSHADHI_EXPORT_SCRIPT: bashPath('deploy/aushadhi_nonroot_v2_export_snapshot.sh'),
      AUSHADHI_RETENTION_SCRIPT: bashPath('deploy/aushadhi_nonroot_v2_export_retention.sh'),
    },
  });
}

function jsonAfterMarker(stdout, marker) {
  const start = stdout.lastIndexOf(`${marker}\n`);
  assert.notEqual(start, -1, stdout);
  return JSON.parse(stdout.slice(start + marker.length + 1));
}

test('export snapshot validates the cohort and release identity and keeps recovery data internal', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-1 drugs-1 rx-1
make_state
run_export
/usr/bin/printf '%s\n' '__STATE_ARCHIVE_LISTING__'
/usr/bin/tar -tf "$staging/2026-08-06/state.tar.zst"
/usr/bin/printf '%s\n' '__STAGED_FILES__'
/usr/bin/find "$staging/2026-08-06" -maxdepth 1 -type f -printf '%f\n' | /usr/bin/sort
/usr/bin/printf '%s\n' '__STAGE_MANIFEST__'
/bin/cat "$staging/2026-08-06/stage-manifest.json"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const listing = result.stdout
    .split('__STATE_ARCHIVE_LISTING__\n')[1]
    .split('__STAGED_FILES__\n')[0]
    .trim()
    .split('\n');
  assert.ok(listing.includes('./ordinary/state.json'));
  assert.ok(listing.includes('./ordinary/outcomes.jsonl'));
  assert.equal(listing.some((entry) => /(?:^|\/)pages(?:\/|$)/u.test(entry)), false);
  assert.equal(listing.some((entry) => /^\.\/restricted(?:\/|$)/u.test(entry)), false);
  assert.equal(listing.some((entry) => /\.(?:db|db3|sqlite|sqlite3)(?:-wal|-shm)?$/u.test(entry)), false);
  assert.equal(listing.some((entry) => /(?:crawler-state\.lock|cache-retention\.lock|(?:build|export)\.lock|\.tmp-)/u.test(entry)), false);

  const stagedFiles = result.stdout
    .split('__STAGED_FILES__\n')[1]
    .split('__STAGE_MANIFEST__\n')[0]
    .trim()
    .split('\n');
  assert.ok(stagedFiles.some((entry) => entry.endsWith('-allowed.sqlite.zst')));
  assert.equal(stagedFiles.some((entry) => entry.includes('secret.sqlite')), false);

  const manifest = jsonAfterMarker(result.stdout, '__STAGE_MANIFEST__');
  assert.equal(manifest.schema_version, 4);
  assert.equal(manifest.generation_id, 'generation-1');
  assert.equal(manifest.cohort.schema_version, 1);
  assert.match(manifest.cohort.manifest_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(manifest.source.path, '.generations/generation-1/drugs.jsonl');
  assert.equal(manifest.source.sha256, manifest.cohort.files['drugs.jsonl'].sha256);
  assert.equal(manifest.prescribable.uncompressed_sha256, manifest.cohort.files['prescribable.jsonl'].sha256);
  assert.deepEqual(manifest.source_list, [
    { record_count: 1, source_id: 'github-jr' },
    { record_count: 1, source_id: 'onemg-live' },
  ]);
  assert.equal(manifest.code_release.repository_commit, 'a'.repeat(40));
  assert.equal(manifest.code_release.runtime_manifest_sha256, '1'.repeat(64));
  assert.equal(manifest.code_release.dependency_tree_sha256, '2'.repeat(64));
  assert.equal(manifest.code_release.installed_tree_metadata_sha256, '4'.repeat(64));
  assert.equal(manifest.code_release.inspection_profile, 'staging-test');
  assert.deepEqual(manifest.code_release.privileged_files_sha256, {
    'usr/local/libexec/helper': '3'.repeat(64),
  });
  assert.match(manifest.code_release.release_receipt_sha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(manifest.artifact_policy, {
    profile: 'internal-evaluation',
    production_authority: 'none',
    redistributable: false,
  });
  assert.equal(manifest.recovery_policy.restricted_cdci_exported, false);
  assert.equal(manifest.recovery_policy.licensed_recovery_boundary, 'internal-recovery-only');
  assert.equal(manifest.recovery_policy.sqlite_backup_method, 'sqlite-online-backup');
  assert.ok(manifest.recovery_policy.ephemeral_state_excludes.includes('state.json.crawler-state.lock'));
  assert.equal(manifest.state_snapshot.verification, 'required');
  assert.deepEqual(
    manifest.databases.map((database) => database.source_relative_path),
    ['ordinary/allowed.sqlite'],
  );
});

test('retention dry-run and apply classify real immutable-generation exporter output', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-old drugs-old rx-old 2026-08-05
make_state
run_export
write_cohort generation-new drugs-new rx-new 2026-08-06
run_export
/usr/bin/printf '%s\n' '__DRY_RUN__'
run_retention 0 1
/usr/bin/printf '%s\n' '__APPLY__'
run_retention 1 1
/usr/bin/printf '%s\n' '__REMAINING__'
/usr/bin/find "$staging" -mindepth 1 -maxdepth 1 -type d -name '????-??-??' -printf '%f\n' | /usr/bin/sort
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const dryRun = result.stdout.split('__DRY_RUN__\n')[1].split('__APPLY__\n')[0];
  const apply = result.stdout.split('__APPLY__\n')[1].split('__REMAINING__\n')[0];
  assert.match(dryRun, /mode=dry-run.*verified=2.*candidates=1/u);
  assert.match(dryRun, /WOULD REMOVE verified export 2026-08-05 generation-old/u);
  assert.match(apply, /REMOVED verified export 2026-08-05 generation-old/u);
  assert.equal(result.stdout.split('__REMAINING__\n')[1].trim(), '2026-08-06');
});

test('test-mode export rejects a receipt that claims the live inspection profile', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-1 drugs-1 rx-1
make_state
/usr/bin/python3 - "$release_receipt" <<'PYRECEIPT'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    receipt = json.load(handle)
receipt["inspection_profile"] = "live"
with open(path, "w", encoding="utf-8") as handle:
    json.dump(receipt, handle, sort_keys=True)
    handle.write("\n")
PYRECEIPT
status=0
run_export || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
test ! -e "$staging/2026-08-06"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /inspection profile/iu);
});

test('a hash-bound cohort with CDCI in summary provenance is refused before export', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-cdci-summary drugs-1 rx-1
/usr/bin/python3 - "$cohort/summary.json" <<'PYSUMMARY'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    summary = json.load(handle)
summary["sources"]["Common Drug Codes for India"] = 1
with open(path, "w", encoding="utf-8") as handle:
    json.dump(summary, handle, sort_keys=True)
    handle.write("\n")
PYSUMMARY
rebind_cohort
make_state
status=0
run_export || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
test ! -e "$staging/2026-08-06"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /summary\.json.*restricted CDCI\/SNOMED India Drug source metadata/iu);
});

test('a hash-bound cohort with SNOMED India Drug row provenance is refused before export', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-cdci-row drugs-1 rx-1
/usr/bin/printf '%s\n' \
  '{"id":"drugs-1","sources":[{"source":"SnomedCT_IndiaDrugExtensionRF2_PRODUCTION_IN1000189"}]}' \
  > "$cohort/drugs.jsonl"
rebind_cohort
make_state
status=0
run_export || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
test ! -e "$staging/2026-08-06"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /drugs\.jsonl:1.*restricted CDCI\/SNOMED India Drug source metadata/iu);
});

test('a stale regular lock file does not wedge an exporter restart', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-restart drugs-1 rx-1
make_state
/usr/bin/printf '%s\n' stale-owner-from-killed-process > "$staging/.export.lock"
run_export
test -f "$staging/.export.lock"
test -f "$staging/2026-08-06/stage-manifest.json"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /export complete: 2026-08-06/u);
});

test('an active shared export-root flock excludes a concurrent exporter', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-lock drugs-1 rx-1
make_state
/usr/bin/printf '' > "$staging/.export.lock"
exec 8>>"$staging/.export.lock"
/usr/bin/flock --exclusive --nonblock 8
status=0
run_export || status=$?
/usr/bin/flock --unlock 8
/usr/bin/printf '__STATUS__%s\n' "$status"
test ! -e "$staging/2026-08-06"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /export root lock is held/iu);
});

test('same-date export repairs corrupt staging and atomically replaces a changed generation', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-1 drugs-1 rx-1
make_state
run_export
/usr/bin/printf '%s\n' corrupt > "$staging/2026-08-06/drugs.jsonl.zst"
run_export
/usr/bin/sha256sum "$staging/2026-08-06/drugs.jsonl.zst" | /usr/bin/cut -d' ' -f1
write_cohort generation-2 drugs-2 rx-2
run_export
/usr/bin/printf '%s\n' '__TOP_LEVEL__'
/usr/bin/find "$staging" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | /usr/bin/sort
/usr/bin/printf '%s\n' '__DRUGS__'
/bin/cat "$staging/2026-08-06/drugs.jsonl.zst"
/usr/bin/printf '%s\n' '__STAGE_MANIFEST__'
/bin/cat "$staging/2026-08-06/stage-manifest.json"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /replacing stale or invalid staged export/u);
  assert.equal(
    result.stdout.split('__TOP_LEVEL__\n')[1].split('__DRUGS__\n')[0].trim(),
    '2026-08-06',
  );
  assert.match(result.stdout.split('__DRUGS__\n')[1], /"id":"drugs-2"/u);
  const manifest = jsonAfterMarker(result.stdout, '__STAGE_MANIFEST__');
  assert.equal(manifest.generation_id, 'generation-2');
});

test('invalid new cohort content fails closed without replacing a verified export', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-1 drugs-1 rx-1
make_state
run_export
write_cohort generation-2 drugs-2 rx-2
/usr/bin/printf '%s\n' '{"med_id":"tampered"}' >> "$cohort/prescribable.jsonl"
status=0
run_export || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
/usr/bin/printf '%s\n' '__STAGE_MANIFEST__'
/bin/cat "$staging/2026-08-06/stage-manifest.json"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /prescribable\.jsonl.*(?:hash|size).*mismatch/iu);
  const manifest = jsonAfterMarker(result.stdout, '__STAGE_MANIFEST__');
  assert.equal(manifest.generation_id, 'generation-1');
});

test('a tampered cohort-index manifest hash fails closed without replacing a verified export', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-1 drugs-1 rx-1
make_state
run_export
write_cohort generation-2 drugs-2 rx-2
/usr/bin/python3 - "$repo/dist/cohort-index.json" <<'PYINDEX'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    index = json.load(handle)
index["generations"]["generation-2"]["manifest_sha256"] = "f" * 64
with open(path, "w", encoding="utf-8") as handle:
    json.dump(index, handle, sort_keys=True)
    handle.write("\n")
PYINDEX
status=0
run_export || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
/usr/bin/printf '%s\n' '__STAGE_MANIFEST__'
/bin/cat "$staging/2026-08-06/stage-manifest.json"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /published cohort manifest hash mismatch.*generation-2/iu);
  const manifest = jsonAfterMarker(result.stdout, '__STAGE_MANIFEST__');
  assert.equal(manifest.generation_id, 'generation-1');
});

test('a legacy dated cohort without an atomic index is refused', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
/bin/mkdir -p "$repo/dist/2026-08-06"
/usr/bin/printf '%s\n' '{}' > "$repo/dist/2026-08-06/cohort-manifest.json"
status=0
run_export || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
test ! -e "$staging/2026-08-06"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /cohort data exists without cohort-index\.json/iu);
});

test('the cohort index schema is an exact allowlist', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-1 drugs-1 rx-1
/usr/bin/python3 - "$repo/dist/cohort-index.json" <<'PYINDEX'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    index = json.load(handle)
index["unreviewed_pointer"] = "generation-1"
with open(path, "w", encoding="utf-8") as handle:
    json.dump(index, handle, sort_keys=True)
    handle.write("\n")
PYINDEX
status=0
run_export || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /cohort index has unexpected fields/iu);
});

test('a symlinked indexed generation is refused', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-1 drugs-1 rx-1
/bin/mv "$cohort" "$repo/relocated-generation"
/bin/ln -s "$repo/relocated-generation" "$cohort"
status=0
run_export || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /selected cohort generation is not a physical directory/iu);
});

test('a failed SQLite online backup aborts the export', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-1 drugs-1 rx-1
/bin/mkdir -p "$repo/data/ordinary"
/usr/bin/printf '%s\n' critical-state > "$repo/data/ordinary/state.json"
/usr/bin/printf '%s\n' not-a-database > "$repo/data/ordinary/broken.sqlite"
status=0
run_export || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
test ! -e "$staging/2026-08-06"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /SQLite online backup failed.*broken\.sqlite/iu);
});

test('a SQLite discovery traversal error aborts before any export is published', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-discovery drugs-1 rx-1
make_state
/bin/mkdir -p "$repo/data/ordinary/unreadable"
/bin/chmod 000 "$repo/data/ordinary/unreadable"
status=0
run_export || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
test ! -e "$staging/2026-08-06"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /SQLite discovery failed/iu);
});

test('SQLite databases deeper than the former discovery limit are backed up', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-1 drugs-1 rx-1
make_state
deep_dir="$repo/data/ordinary/one/two/three/four/five/six/seven"
/bin/mkdir -p "$deep_dir"
/usr/bin/python3 - "$deep_dir/deep.sqlite" <<'PYDB'
import sqlite3, sys
connection = sqlite3.connect(sys.argv[1])
connection.execute("CREATE TABLE fixture (value TEXT NOT NULL)")
connection.execute("INSERT INTO fixture VALUES ('deep')")
connection.commit()
connection.close()
PYDB
run_export
/usr/bin/printf '%s\n' '__STAGE_MANIFEST__'
/bin/cat "$staging/2026-08-06/stage-manifest.json"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const manifest = jsonAfterMarker(result.stdout, '__STAGE_MANIFEST__');
  assert.deepEqual(
    manifest.databases.map((database) => database.source_relative_path),
    [
      'ordinary/allowed.sqlite',
      'ordinary/one/two/three/four/five/six/seven/deep.sqlite',
    ],
  );
});

test('cohort validation streams a large manifest-bound sentinel within a bounded memory envelope', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
write_cohort generation-1 drugs-1 rx-1
add_large_manifest_sentinel
make_state
run_export_limited
test -f "$staging/2026-08-06/stage-manifest.json"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /export complete: 2026-08-06/u);
});
