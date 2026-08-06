import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let bashWorkingDirectory;

const runtimeProbe = spawnSync('bash', ['-c', [
  'command -v python3 >/dev/null',
  'if [ "$(id -u)" -eq 0 ]; then command -v runuser >/dev/null && id nobody >/dev/null; fi',
].join('\n')], { encoding: 'utf8' });
const requiresNonRootPython = runtimeProbe.status === 0
  ? {}
  : { skip: 'Bash/Python plus a non-root test identity are required for retention safety tests' };

function bashPath(value) {
  if (bashWorkingDirectory === undefined) {
    const bashCwd = spawnSync('bash', ['-c', 'pwd -P'], { cwd: '.', encoding: 'utf8' });
    if (bashCwd.status !== 0 || !bashCwd.stdout.trim()) {
      throw new Error(`cannot resolve Bash working directory: ${bashCwd.stderr}`);
    }
    bashWorkingDirectory = bashCwd.stdout.trim();
  }
  const relative = path.relative('.', path.resolve(value)).replaceAll('\\', '/');
  return `${bashWorkingDirectory}/${relative}`;
}

const HELPERS = String.raw`
make_generation() {
  local generation_id="$1" cohort_date="$2" generated_at="$3"
  /usr/bin/python3 - "$generations_root/$generation_id" "$generation_id" "$cohort_date" "$generated_at" <<'PYGENERATION'
import hashlib, json, os, sys
directory, generation_id, cohort_date, generated_at = sys.argv[1:5]
os.makedirs(directory)
contents = {
    "drugs.csv": "brand_name\nA\n",
    "drugs.jsonl": '{"id":1}\n',
    "compositions.csv": "composition\nA\n",
    "substitute_edges.csv": "brand_name\n",
    "conflicts.csv": "kind\n",
    "conflicts.jsonl": "",
    "errors.csv": "source,reason,detail\n",
    "summary.json": json.dumps({"date": cohort_date, "total_rows": 1, "conflicts": 0}) + "\n",
    "ATTRIBUTION.md": "# Attribution\n",
    "prescribable.jsonl": '{"med_id":"m1"}\n',
    "formulation_groups.jsonl": "",
    "REPORT.md": "# Report\n",
}
files = {}
jsonl = {"drugs.jsonl", "conflicts.jsonl", "prescribable.jsonl", "formulation_groups.jsonl"}
for name, text in contents.items():
    payload = text.encode()
    with open(os.path.join(directory, name), "wb") as handle:
        handle.write(payload)
    metadata = {"sha256": hashlib.sha256(payload).hexdigest(), "size_bytes": len(payload)}
    if name in jsonl:
        metadata["record_count"] = sum(1 for line in text.splitlines() if line.strip())
    files[name] = metadata
manifest = {
    "schema_version": 1,
    "generation_id": generation_id,
    "date": cohort_date,
    "generated_at": generated_at,
    "input_fingerprint": "a" * 64,
    "counts": {"drugs": 1, "conflicts": 0, "prescribable": 1, "formulation_groups": 0},
    "files": files,
}
with open(os.path.join(directory, "cohort-manifest.json"), "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2)
    handle.write("\n")
PYGENERATION
}

write_index() {
  local latest_date="$1" latest_id="$2" dates_spec="$3" generations_spec="$4"
  /usr/bin/python3 - "$dist_root" "$latest_date" "$latest_id" "$dates_spec" "$generations_spec" <<'PYINDEX'
import hashlib, json, os, sys
root, latest_date, latest_id, dates_spec, generations_spec = sys.argv[1:6]
dates = {}
for token in filter(None, dates_spec.split(',')):
    date, generation_id = token.split(':', 1)
    dates[date] = generation_id
generations = {}
for token in filter(None, generations_spec.split(',')):
    generation_id, date = token.split(':', 1)
    manifest = os.path.join(root, ".generations", generation_id, "cohort-manifest.json")
    with open(manifest, "rb") as handle:
        digest = hashlib.sha256(handle.read()).hexdigest()
    generations[generation_id] = {
        "date": date,
        "manifest_sha256": digest,
        "published_at": f"{date}T12:00:00.000Z",
    }
index = {
    "schema_version": 1,
    "updated_at": "2026-08-06T12:00:00.000Z",
    "latest": {"date": latest_date, "generation_id": latest_id},
    "dates": dates,
    "generations": generations,
}
temporary = os.path.join(root, ".cohort-index.test-tmp")
with open(temporary, "w", encoding="utf-8") as handle:
    json.dump(index, handle, indent=2)
    handle.write("\n")
os.replace(temporary, os.path.join(root, "cohort-index.json"))
PYINDEX
}

make_base_fixture() {
  make_generation indexed-history 2026-08-01 2026-08-01T01:00:00.000Z
  make_generation indexed-date 2026-08-02 2026-08-02T01:00:00.000Z
  make_generation indexed-latest 2026-08-03 2026-08-03T01:00:00.000Z
  make_generation orphan-delete 2026-07-01 2026-07-01T01:00:00.000Z
  make_generation protected-old 2026-07-02 2026-07-02T01:00:00.000Z
  make_generation gen-1 2026-07-03 2026-07-03T01:00:00.000Z
  make_generation new-a 2026-08-04 2026-08-04T01:00:00.000Z
  make_generation gen-10 2026-08-05 2026-08-05T01:00:00.000Z
  write_index \
    2026-08-03 indexed-latest \
    '2026-08-02:indexed-date,2026-08-03:indexed-latest' \
    'indexed-history:2026-08-01,indexed-date:2026-08-02,indexed-latest:2026-08-03'
}

run_retention() {
  AUSHADHI_SOURCE_GENERATION_RETENTION_TESTING=1 \
  AUSHADHI_DIST_ROOT="$dist_root" \
  AUSHADHI_SOURCE_GENERATION_RETENTION_LOCK="$lock_file" \
  AUSHADHI_SOURCE_GENERATION_RETENTION_AUTHORITY_FILE="$authority_file" \
  AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY="$1" \
  AUSHADHI_SOURCE_GENERATION_RETENTION_KEEP="$2" \
  AUSHADHI_SOURCE_GENERATION_RETENTION_PROTECT="$3" \
  /usr/bin/python3 "$AUSHADHI_RETENTION_SCRIPT"
}
`;

function runHarness(body) {
  return spawnSync('bash', ['-c', [
    'if [ "$(id -u)" -eq 0 ]; then',
    '  exec /usr/sbin/runuser -u nobody -- /bin/bash -s',
    'fi',
    'exec /bin/bash -s',
  ].join('\n')], {
    cwd: '.',
    encoding: 'utf8',
    input: `set -Eeuo pipefail
test_root="$(mktemp -d)"
trap '/bin/rm -rf -- "$test_root"' EXIT
dist_root="$test_root/dist"
generations_root="$dist_root/.generations"
lock_file="$test_root/cache/retention.lock"
authority_file="$test_root/source-generation-retention-apply.conf"
/bin/mkdir -p "$generations_root" "$(dirname "$lock_file")"
${HELPERS}
${body}
`,
    env: {
      ...process.env,
      WSLENV: [process.env.WSLENV, 'AUSHADHI_RETENTION_SCRIPT'].filter(Boolean).join(':'),
      AUSHADHI_RETENTION_SCRIPT: bashPath(
        'deploy/aushadhi_nonroot_source_generation_retention.py',
      ),
    },
  });
}

test('source generation retention is a byte-preserving dry run and preserves every indexed generation', requiresNonRootPython, () => {
  const result = runHarness(String.raw`
make_base_fixture
before="$(sha256sum "$dist_root/cohort-index.json" | cut -d' ' -f1)"
run_retention 0 2 protected-old
after="$(sha256sum "$dist_root/cohort-index.json" | cut -d' ' -f1)"
test "$before" = "$after"
/usr/bin/printf '%s\n' '__REMAINING__'
/usr/bin/find "$generations_root" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | /usr/bin/sort
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /mode=dry-run.*physical=8.*indexed=3.*keep=2.*candidates=2/u);
  assert.match(result.stdout, /PRESERVE latest 2026-08-03 indexed-latest/u);
  assert.match(result.stdout, /PRESERVE date-pointer 2026-08-02 indexed-date/u);
  assert.match(result.stdout, /WOULD REMOVE unindexed generation orphan-delete/u);
  assert.match(result.stdout, /WOULD REMOVE unindexed generation gen-1/u);
  assert.doesNotMatch(result.stdout, /WOULD REMOVE.*indexed-history/u);
  assert.equal(result.stdout.split('__REMAINING__\n')[1].trim().split('\n').length, 8);
});

test('explicitly authorized apply removes only exact old unindexed generations', requiresNonRootPython, () => {
  const result = runHarness(String.raw`
make_base_fixture
/usr/bin/printf '%s\n' 'AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=1' > "$authority_file"
/bin/mkdir -p "$dist_root/.staging" "$dist_root/latest" \
  "$test_root/raw/restricted/cdci" "$test_root/export" "$test_root/application"
/usr/bin/printf '%s' preserve > "$dist_root/.staging/sentinel"
/usr/bin/printf '%s' preserve > "$dist_root/latest/sentinel"
/usr/bin/printf '%s' preserve > "$dist_root/.build-state.json"
/usr/bin/printf '%s' preserve > "$test_root/raw/restricted/cdci/sentinel"
/usr/bin/printf '%s' preserve > "$test_root/export/sentinel"
/usr/bin/printf '%s' preserve > "$test_root/application/sentinel"
run_retention 1 2 protected-old
test ! -e "$generations_root/orphan-delete"
test ! -e "$generations_root/gen-1"
test -d "$generations_root/gen-10"
test -d "$generations_root/indexed-history"
test -d "$generations_root/indexed-date"
test -d "$generations_root/indexed-latest"
test -d "$generations_root/protected-old"
test -d "$generations_root/new-a"
test "$(cat "$dist_root/.staging/sentinel")" = preserve
test "$(cat "$dist_root/latest/sentinel")" = preserve
test "$(cat "$dist_root/.build-state.json")" = preserve
test "$(cat "$test_root/raw/restricted/cdci/sentinel")" = preserve
test "$(cat "$test_root/export/sentinel")" = preserve
test "$(cat "$test_root/application/sentinel")" = preserve
test ! -e "$dist_root/.build.lock"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /REMOVED unindexed generation orphan-delete/u);
  assert.match(result.stdout, /REMOVED unindexed generation gen-1/u);
  assert.doesNotMatch(result.stdout, /REMOVED.*gen-10/u);
});

test('apply mode requires a separate authority file and bounded exact configuration', requiresNonRootPython, () => {
  const result = runHarness(String.raw`
make_base_fixture
status_apply=0
run_retention 1 2 protected-old || status_apply=$?
status_value=0
run_retention true 2 protected-old || status_value=$?
status_keep=0
run_retention 0 0 protected-old || status_keep=$?
/usr/bin/printf '__STATUS__%s:%s:%s\n' "$status_apply" "$status_value" "$status_keep"
test -d "$generations_root/orphan-delete"
test -d "$generations_root/gen-1"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2:2:2/u);
  assert.match(result.stderr, /apply authority|APPLY must be 0 or 1|KEEP must be between 1 and 365/u);
});

test('duplicate-key cohort index and corrupt generation both fail closed before any deletion', requiresNonRootPython, () => {
  const duplicate = runHarness(String.raw`
make_base_fixture
/usr/bin/printf '%s\n' 'AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=1' > "$authority_file"
/usr/bin/python3 - "$dist_root/cohort-index.json" <<'PYDUPLICATE'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    index = json.load(handle)
rest = {key: value for key, value in index.items() if key != "schema_version"}
with open(path, "w", encoding="utf-8") as handle:
    handle.write('{"schema_version":1,"schema_version":1,')
    handle.write(json.dumps(rest)[1:])
    handle.write("\n")
PYDUPLICATE
status=0
run_retention 1 2 protected-old || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
test -d "$generations_root/orphan-delete"
test -d "$generations_root/gen-1"
`);
  assert.equal(duplicate.status, 0, `${duplicate.stdout}\n${duplicate.stderr}`);
  assert.match(duplicate.stdout, /__STATUS__2/u);
  assert.match(duplicate.stderr, /duplicate JSON key/u);

  const corrupt = runHarness(String.raw`
make_base_fixture
/usr/bin/printf '%s\n' 'AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=1' > "$authority_file"
/usr/bin/printf '%s' tampered >> "$generations_root/gen-1/drugs.csv"
status=0
run_retention 1 2 protected-old || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
test -d "$generations_root/orphan-delete"
test -d "$generations_root/gen-1"
`);
  assert.equal(corrupt.status, 0, `${corrupt.stdout}\n${corrupt.stderr}`);
  assert.match(corrupt.stdout, /__STATUS__2/u);
  assert.match(corrupt.stderr, /generation gen-1 artifact drugs\.csv (?:hash|size) mismatch/u);
});

test('symlinked generation and an existing build lock preserve every directory', requiresNonRootPython, () => {
  const symlink = runHarness(String.raw`
make_base_fixture
/usr/bin/printf '%s\n' 'AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=1' > "$authority_file"
/bin/mkdir -p "$test_root/outside"
/usr/bin/printf '%s' outside > "$test_root/outside/sentinel"
/bin/rm -rf -- "$generations_root/orphan-delete"
/bin/ln -s "$test_root/outside" "$generations_root/orphan-delete"
status=0
run_retention 1 2 protected-old || status=$?
/usr/bin/printf '__STATUS__%s\n' "$status"
test "$(cat "$test_root/outside/sentinel")" = outside
test -d "$generations_root/gen-1"
`);
  assert.equal(symlink.status, 0, `${symlink.stdout}\n${symlink.stderr}`);
  assert.match(symlink.stdout, /__STATUS__2/u);
  assert.match(symlink.stderr, /not a physical directory/u);

  const locked = runHarness(String.raw`
make_base_fixture
/usr/bin/printf '%s\n' 'AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=1' > "$authority_file"
/bin/mkdir "$dist_root/.build.lock"
/usr/bin/printf '%s\n' held > "$dist_root/.build.lock/owner.json"
run_retention 1 2 protected-old
test -d "$generations_root/orphan-delete"
test -d "$generations_root/gen-1"
test "$(cat "$dist_root/.build.lock/owner.json")" = held
`);
  assert.equal(locked.status, 0, `${locked.stdout}\n${locked.stderr}`);
  assert.match(locked.stdout, /SKIP: build lock is held/u);
});

test('apply revalidates the stable cohort index immediately before deletion', requiresNonRootPython, () => {
  const result = runHarness(String.raw`
make_base_fixture
/usr/bin/printf '%s\n' 'AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=1' > "$authority_file"
marker="$test_root/classified"
release="$test_root/release"
AUSHADHI_SOURCE_GENERATION_RETENTION_TESTING=1 \
AUSHADHI_SOURCE_GENERATION_RETENTION_TEST_MARKER="$marker" \
AUSHADHI_SOURCE_GENERATION_RETENTION_TEST_RELEASE="$release" \
AUSHADHI_DIST_ROOT="$dist_root" \
AUSHADHI_SOURCE_GENERATION_RETENTION_LOCK="$lock_file" \
AUSHADHI_SOURCE_GENERATION_RETENTION_AUTHORITY_FILE="$authority_file" \
AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=1 \
AUSHADHI_SOURCE_GENERATION_RETENTION_KEEP=2 \
AUSHADHI_SOURCE_GENERATION_RETENTION_PROTECT=protected-old \
/usr/bin/python3 "$AUSHADHI_RETENTION_SCRIPT" > "$test_root/stdout" 2> "$test_root/stderr" &
retention_pid=$!
for _ in $(seq 1 500); do
  [ -e "$marker" ] && break
  /bin/sleep 0.02
done
test -e "$marker"
/usr/bin/python3 - "$dist_root" <<'PYMUTATE'
import hashlib, json, os, sys
root = sys.argv[1]
index_file = os.path.join(root, "cohort-index.json")
with open(index_file, encoding="utf-8") as handle:
    index = json.load(handle)
generation_id = "orphan-delete"
manifest_file = os.path.join(root, ".generations", generation_id, "cohort-manifest.json")
with open(manifest_file, "rb") as handle:
    digest = hashlib.sha256(handle.read()).hexdigest()
index["updated_at"] = "2026-08-06T12:00:01.000Z"
index["generations"][generation_id] = {
    "date": "2026-07-01",
    "manifest_sha256": digest,
    "published_at": "2026-07-01T12:00:00.000Z",
}
temporary = index_file + ".race"
with open(temporary, "w", encoding="utf-8") as handle:
    json.dump(index, handle, indent=2)
    handle.write("\n")
os.replace(temporary, index_file)
PYMUTATE
/usr/bin/touch "$release"
status=0
wait "$retention_pid" || status=$?
/bin/cat "$test_root/stdout"
/bin/cat "$test_root/stderr" >&2
/usr/bin/printf '__STATUS__%s\n' "$status"
test -d "$generations_root/orphan-delete"
test -d "$generations_root/gen-1"
test ! -e "$dist_root/.build.lock"
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /__STATUS__2/u);
  assert.match(result.stderr, /cohort index changed after retention classification/u);
});
