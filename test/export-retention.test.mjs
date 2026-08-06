import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  : { skip: 'Bash cannot execute retention as a non-root user on this machine' };

function bashPath(value) {
  if (bashWorkingDirectory === undefined) {
    const result = spawnSync('bash', ['-c', 'pwd -P'], { cwd: '.', encoding: 'utf8' });
    if (result.status !== 0 || !result.stdout.trim()) {
      throw new Error(`cannot resolve Bash working directory: ${result.stderr}`);
    }
    bashWorkingDirectory = result.stdout.trim();
  }
  const relative = path.relative('.', path.resolve(value)).replaceAll('\\', '/');
  return `${bashWorkingDirectory}/${relative}`;
}

const HELPERS = String.raw`
make_snapshot() {
  date_tag="$1"
  generation="$2"
  target="$export_root/$date_tag"
  /bin/mkdir -p "$target"
  /usr/bin/python3 - "$target" "$date_tag" "$generation" <<'PYSNAPSHOT'
import hashlib, json, os, sys
root, date_tag, generation = sys.argv[1:4]
payloads = {
    "drugs.jsonl.zst": f"drugs-{generation}\n".encode(),
    "prescribable.jsonl.zst": f"prescribable-{generation}\n".encode(),
    "state.tar.zst": f"state-{generation}\n".encode(),
    "db-0123456789abcdef-state.sqlite.zst": f"database-{generation}\n".encode(),
}
for name, contents in payloads.items():
    with open(os.path.join(root, name), "wb") as handle:
        handle.write(contents)
def artifact(name):
    contents = payloads[name]
    return {"filename": name, "size_bytes": len(contents), "sha256": hashlib.sha256(contents).hexdigest()}
source_bytes = f"source-{generation}\n".encode()
prescribable_bytes = f"rx-source-{generation}\n".encode()
manifest = {
    "schema_version": 4,
    "stage_kind": "aushadhi-export-snapshot",
    "release_date": date_tag,
    "generation_id": generation,
    "generated_at_utc": f"{date_tag}T01:00:00+00:00",
    "cohort": {
        "schema_version": 1,
        "manifest_sha256": hashlib.sha256(f"cohort-{generation}".encode()).hexdigest(),
        "generated_at": f"{date_tag}T00:00:00.000Z",
        "input_fingerprint": "e" * 64,
        "files": {
            "drugs.jsonl": {"record_count": 1, "size_bytes": len(source_bytes), "sha256": hashlib.sha256(source_bytes).hexdigest()},
            "prescribable.jsonl": {"record_count": 1, "size_bytes": len(prescribable_bytes), "sha256": hashlib.sha256(prescribable_bytes).hexdigest()},
            "summary.json": {"size_bytes": 2, "sha256": hashlib.sha256(b"{}\n").hexdigest()},
        },
    },
    "code_release": {
        "repository_commit": "a" * 40,
        "repository_tree_sha256": "b" * 64,
        "runtime_manifest_sha256": "1" * 64,
        "dependency_tree_sha256": "2" * 64,
        "privileged_files_sha256": {"usr/local/libexec/helper": "3" * 64},
        "installed_at_utc": f"{date_tag}T00:30:00Z",
        "installed_files_sha256": {"package.json": "c" * 64},
        "systemd_files_sha256": {"aushadhi-export.service": "d" * 64},
        "release_receipt_sha256": "f" * 64,
    },
    "artifact_policy": {"profile": "internal-evaluation", "redistributable": False, "production_authority": "none"},
    "source_list": [{"source_id": "onemg-live", "record_count": 1}],
    "source": {"path": f".generations/{generation}/drugs.jsonl", "format": "jsonl", "record_count": 1,
               "size_bytes": len(source_bytes), "sha256": hashlib.sha256(source_bytes).hexdigest()},
    "artifact": {"format": "zstd-compressed jsonl", **artifact("drugs.jsonl.zst")},
    "prescribable": {"format": "zstd-compressed jsonl", "record_count": 1,
                      "uncompressed_size_bytes": len(prescribable_bytes),
                      "uncompressed_sha256": hashlib.sha256(prescribable_bytes).hexdigest(),
                      **artifact("prescribable.jsonl.zst")},
    "review_shortlist": None,
    "databases": [{"name": "state.sqlite", "source_relative_path": "raw/state.sqlite",
                   "snapshot": "db-0123456789abcdef-state.sqlite.zst",
                   "snapshot_size_bytes": len(payloads["db-0123456789abcdef-state.sqlite.zst"]),
                   "snapshot_sha256": hashlib.sha256(payloads["db-0123456789abcdef-state.sqlite.zst"]).hexdigest(),
                   "verification": "verified-online-backup"}],
    "state_snapshot": {"format": "zstd-compressed tar", "verification": "required", **artifact("state.tar.zst")},
    "state_note": "ok",
    "recovery_policy": {
        "critical_state_required": True,
        "sqlite_backup_method": "sqlite-online-backup",
        "generic_archive_excludes": ["pages", "restricted", "SQLite", "WAL", "SHM"],
        "ephemeral_state_excludes": ["state.json.crawler-state.lock", ".build.lock", ".export.lock", ".state.json.tmp-*"],
        "restricted_cdci_exported": False,
        "licensed_recovery_boundary": "internal-recovery-only",
    },
}
with open(os.path.join(root, "stage-manifest.json"), "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, sort_keys=True)
    handle.write("\n")
PYSNAPSHOT
}

run_retention() {
  apply="$1"
  keep="$2"
  protect="$3"
  if [ "$EUID" -eq 0 ]; then
    /bin/chown -R "$(id -u nobody):$(id -g nobody)" "$test_root"
    "$(command -v runuser)" -u nobody -- /usr/bin/env \
      AUSHADHI_EXPORT_RETENTION_TESTING=1 \
      AUSHADHI_EXPORT_ROOT="$export_root" \
      AUSHADHI_EXPORT_RETENTION_APPLY="$apply" \
      AUSHADHI_EXPORT_RETENTION_KEEP="$keep" \
      AUSHADHI_EXPORT_RETENTION_PROTECT="$protect" \
      bash "$AUSHADHI_RETENTION_SCRIPT"
  else
    /usr/bin/env \
      AUSHADHI_EXPORT_RETENTION_TESTING=1 \
      AUSHADHI_EXPORT_ROOT="$export_root" \
      AUSHADHI_EXPORT_RETENTION_APPLY="$apply" \
      AUSHADHI_EXPORT_RETENTION_KEEP="$keep" \
      AUSHADHI_EXPORT_RETENTION_PROTECT="$protect" \
      bash "$AUSHADHI_RETENTION_SCRIPT"
  fi
}

run_retention_limited() {
  if [ "$EUID" -eq 0 ]; then
    /bin/chown -R "$(id -u nobody):$(id -g nobody)" "$test_root"
    "$(command -v runuser)" -u nobody -- /usr/bin/env \
      AUSHADHI_EXPORT_RETENTION_TESTING=1 \
      AUSHADHI_EXPORT_ROOT="$export_root" \
      AUSHADHI_EXPORT_RETENTION_APPLY=0 \
      AUSHADHI_EXPORT_RETENTION_KEEP=1 \
      AUSHADHI_EXPORT_RETENTION_PROTECT='' \
      bash -c 'ulimit -v 65536; exec bash "$1"' _ "$AUSHADHI_RETENTION_SCRIPT"
  else
    /usr/bin/env \
      AUSHADHI_EXPORT_RETENTION_TESTING=1 \
      AUSHADHI_EXPORT_ROOT="$export_root" \
      AUSHADHI_EXPORT_RETENTION_APPLY=0 \
      AUSHADHI_EXPORT_RETENTION_KEEP=1 \
      AUSHADHI_EXPORT_RETENTION_PROTECT='' \
      bash -c 'ulimit -v 65536; exec bash "$1"' _ "$AUSHADHI_RETENTION_SCRIPT"
  fi
}

enlarge_snapshot_artifact() {
  target="$export_root/$1"
  /usr/bin/truncate -s 96M "$target/drugs.jsonl.zst"
  /usr/bin/python3 - "$target" <<'PYLARGE'
import hashlib, json, os, sys
root = sys.argv[1]
artifact = os.path.join(root, "drugs.jsonl.zst")
digest = hashlib.sha256()
with open(artifact, "rb") as handle:
    for chunk in iter(lambda: handle.read(1 << 20), b""):
        digest.update(chunk)
manifest_path = os.path.join(root, "stage-manifest.json")
with open(manifest_path, encoding="utf-8") as handle:
    manifest = json.load(handle)
manifest["artifact"]["size_bytes"] = os.path.getsize(artifact)
manifest["artifact"]["sha256"] = digest.hexdigest()
with open(manifest_path, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, sort_keys=True)
    handle.write("\n")
PYLARGE
}
`;

function runHarness(body) {
  return spawnSync('bash', ['-s'], {
    cwd: '.',
    encoding: 'utf8',
    input: `set -Eeuo pipefail
test_root="$(mktemp -d)"
trap '/bin/rm -rf -- "$test_root"' EXIT
export_root="$test_root/aushadhi-export"
/bin/mkdir -p "$export_root"
${HELPERS}
${body}
`,
    env: {
      ...process.env,
      WSLENV: [process.env.WSLENV, 'AUSHADHI_RETENTION_SCRIPT'].filter(Boolean).join(':'),
      AUSHADHI_RETENTION_SCRIPT: bashPath('deploy/aushadhi_nonroot_v2_export_retention.sh'),
    },
  });
}

test('export retention is a verified dry run by default and preserves newest completed cohorts', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
make_snapshot 2026-08-01 generation-1
make_snapshot 2026-08-02 generation-2
make_snapshot 2026-08-03 generation-3
make_snapshot 2026-08-04 generation-4
run_retention 0 2 ''
/usr/bin/printf '%s\n' '__REMAINING__'
/usr/bin/find "$export_root" -mindepth 1 -maxdepth 1 -type d -name '????-??-??' -printf '%f\n' | /usr/bin/sort
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /mode=dry-run.*verified=4.*keep=2/u);
  assert.match(result.stdout, /PRESERVE latest 2026-08-04 generation-4/u);
  assert.match(result.stdout, /WOULD REMOVE verified export 2026-08-01 generation-1/u);
  assert.match(result.stdout, /WOULD REMOVE verified export 2026-08-02 generation-2/u);
  assert.equal(
    result.stdout.split('__REMAINING__\n')[1].trim(),
    ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'].join('\n'),
  );
});

test('apply mode removes only verified, unprotected exports outside the configured cohort count', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
make_snapshot 2026-08-01 generation-1
make_snapshot 2026-08-02 generation-2
make_snapshot 2026-08-03 generation-3
make_snapshot 2026-08-04 generation-4
run_retention 1 2 '2026-08-01'
/usr/bin/printf '%s\n' '__REMAINING__'
/usr/bin/find "$export_root" -mindepth 1 -maxdepth 1 -type d -name '????-??-??' -printf '%f\n' | /usr/bin/sort
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /REMOVED verified export 2026-08-02 generation-2/u);
  assert.doesNotMatch(result.stdout, /REMOVED verified export 2026-08-01/u);
  assert.equal(
    result.stdout.split('__REMAINING__\n')[1].trim(),
    ['2026-08-01', '2026-08-03', '2026-08-04'].join('\n'),
  );
});

test('one corrupt export fails closed before any retention deletion', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
make_snapshot 2026-08-01 generation-1
make_snapshot 2026-08-02 generation-2
make_snapshot 2026-08-03 generation-3
/usr/bin/printf '%s\n' tampered >> "$export_root/2026-08-01/drugs.jsonl.zst"
status=0
run_retention 1 1 '' || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
/usr/bin/printf '%s\n' '__REMAINING__'
/usr/bin/find "$export_root" -mindepth 1 -maxdepth 1 -type d -name '????-??-??' -printf '%f\n' | /usr/bin/sort
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /REFUSED:.*2026-08-01.*drugs\.jsonl\.zst.*(?:hash|size)/iu);
  assert.equal(
    result.stdout.split('__REMAINING__\n')[1].trim(),
    ['2026-08-01', '2026-08-02', '2026-08-03'].join('\n'),
  );
});

test('retention requires the complete dependency and privileged release identity', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
make_snapshot 2026-08-01 generation-1
/usr/bin/python3 - "$export_root/2026-08-01/stage-manifest.json" <<'PYTAMPER'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    manifest = json.load(handle)
del manifest["code_release"]["privileged_files_sha256"]
with open(path, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, sort_keys=True)
    handle.write("\n")
PYTAMPER
status=0
run_retention 0 1 '' || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /privileged_files_sha256.*SHA-256/iu);
});

test('retention refuses a staged SNOMED India Drug source identity', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
make_snapshot 2026-08-01 generation-1
/usr/bin/python3 - "$export_root/2026-08-01/stage-manifest.json" <<'PYTAMPER'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    manifest = json.load(handle)
manifest["source_list"] = [{
    "source_id": "SNOMED CT India Drug Extension IN1000189",
    "record_count": 1,
}]
with open(path, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, sort_keys=True)
    handle.write("\n")
PYTAMPER
status=0
run_retention 0 1 '' || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /source list.*crosses the CDCI boundary/iu);
});

test('a stale regular lock file does not wedge retention after restart', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
make_snapshot 2026-08-01 generation-1
/usr/bin/printf '%s\n' stale-owner-from-killed-process > "$export_root/.export.lock"
run_retention 0 1 ''
test -f "$export_root/.export.lock"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /mode=dry-run.*verified=1/u);
});

test('an active shared export-root flock excludes concurrent retention', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
make_snapshot 2026-08-01 generation-1
/usr/bin/printf '' > "$export_root/.export.lock"
exec 8>>"$export_root/.export.lock"
/usr/bin/flock --exclusive --nonblock 8
status=0
run_retention 0 1 '' || status=$?
/usr/bin/flock --unlock 8
/usr/bin/printf '__STATUS__%s\n' "$status"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /export root lock is held/iu);
});

test('retention streams a large staged artifact within a bounded memory envelope', requiresNonRootBash, () => {
  const result = runHarness(String.raw`
make_snapshot 2026-08-01 generation-1
enlarge_snapshot_artifact 2026-08-01
run_retention_limited
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /mode=dry-run.*verified=1/u);
});

test('retention unit can write only the export root and remains dry-run by default', () => {
  const service = fs.readFileSync('deploy/dalekdefender/aushadhi-export-retention.service', 'utf8');
  const timer = fs.readFileSync('deploy/dalekdefender/aushadhi-export-retention.timer', 'utf8');
  assert.match(service, /^User=aushadhi$/mu);
  assert.match(service, /^Environment=AUSHADHI_EXPORT_RETENTION_APPLY=0$/mu);
  assert.match(service, /^ReadWritePaths=\/var\/lib\/aushadhi-export$/mu);
  assert.doesNotMatch(service, /ReadWritePaths=.*(?:\/opt\/aushadhi|\/var\/lib\/aushadhi\/dist)/u);
  assert.match(service, /^ExecStart=\/usr\/local\/libexec\/aushadhi-export-retention$/mu);
  assert.match(timer, /^Persistent=true$/mu);
});
