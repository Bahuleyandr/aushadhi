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

test('export snapshot omits restricted state from archives and database artifacts', requiresNonRootBash, () => {
  const harness = `set -Eeuo pipefail
test_root="$(mktemp -d)"
trap '/bin/rm -rf -- "$test_root"' EXIT
repo="$test_root/repo"
staging="$test_root/staging"
fake_zstd="$test_root/fake-zstd.sh"
/bin/mkdir -p \
  "$repo/dist/2026-07-31" \
  "$repo/data/ordinary" \
  "$repo/data/pages" \
  "$repo/data/restricted/cdci" \
  "$repo/data/restricted/future-source" \
  "$staging"
printf '%s\n' '{"id":"ordinary-export"}' > "$repo/dist/2026-07-31/drugs.jsonl"
printf '%s\n' ordinary-state > "$repo/data/ordinary/allowed.txt"
printf '%s\n' page-cache > "$repo/data/pages/cache.html"
printf '%s\n' cdci-secret > "$repo/data/restricted/cdci/source.csv"
printf '%s\n' future-secret > "$repo/data/restricted/future-source/source.txt"
/usr/bin/python3 - \
  "$repo/data/ordinary/allowed.sqlite" \
  "$repo/data/restricted/cdci/secret.sqlite" <<'SQLITEFIXTURES'
import sqlite3
import sys

for database, value in zip(sys.argv[1:], ("ordinary", "restricted"), strict=True):
    connection = sqlite3.connect(database)
    connection.execute("CREATE TABLE fixture (value TEXT NOT NULL)")
    connection.execute("INSERT INTO fixture VALUES (?)", (value,))
    connection.commit()
    connection.close()
SQLITEFIXTURES
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
      if [ "$#" -gt 0 ]; then
        source_file="$1"
        shift
      fi
      ;;
    -*)
      shift
      ;;
    *)
      source_file="$1"
      shift
      ;;
  esac
done
if [ -n "$source_file" ]; then
  target="\${output:-$source_file.zst}"
  /bin/cat -- "$source_file" > "$target"
  if [ "$remove_source" -eq 1 ]; then
    /bin/rm -f -- "$source_file"
  fi
elif [ -n "$output" ]; then
  /bin/cat > "$output"
else
  /bin/cat
fi
FAKEZSTD
/bin/chmod 0755 "$fake_zstd"
if [ "$EUID" -eq 0 ]; then
  /bin/chown -R "$(id -u nobody):$(id -g nobody)" "$test_root"
  "$(command -v runuser)" -u nobody -- /usr/bin/env \
    AUSHADHI_EXPORT_TESTING=1 \
    AUSHADHI_EXPORT_REPO="$repo" \
    AUSHADHI_EXPORT_STAGING="$staging" \
    AUSHADHI_EXPORT_ZSTD="$fake_zstd" \
    bash "$AUSHADHI_EXPORT_SCRIPT"
else
  /usr/bin/env \
    AUSHADHI_EXPORT_TESTING=1 \
    AUSHADHI_EXPORT_REPO="$repo" \
    AUSHADHI_EXPORT_STAGING="$staging" \
    AUSHADHI_EXPORT_ZSTD="$fake_zstd" \
    bash "$AUSHADHI_EXPORT_SCRIPT"
fi
/usr/bin/printf '%s\n' '__STATE_ARCHIVE_LISTING__'
/usr/bin/tar -tf "$staging/2026-07-31/state.tar.zst"
/usr/bin/printf '%s\n' '__STAGED_FILES__'
/usr/bin/find "$staging/2026-07-31" -maxdepth 1 -type f -printf '%f\n' | /usr/bin/sort
/usr/bin/printf '%s\n' '__STAGE_MANIFEST__'
/bin/cat "$staging/2026-07-31/stage-manifest.json"
`;
  const result = spawnSync('bash', ['-s'], {
    cwd: '.',
    encoding: 'utf8',
    input: harness,
    env: {
      ...process.env,
      WSLENV: [process.env.WSLENV, 'AUSHADHI_EXPORT_SCRIPT'].filter(Boolean).join(':'),
      AUSHADHI_EXPORT_SCRIPT: bashPath('deploy/aushadhi_nonroot_v2_export_snapshot.sh'),
    },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const listingMarker = '__STATE_ARCHIVE_LISTING__\n';
  const stagedFilesMarker = '__STAGED_FILES__\n';
  const manifestMarker = '__STAGE_MANIFEST__\n';
  const listingStart = result.stdout.indexOf(listingMarker);
  const stagedFilesStart = result.stdout.indexOf(stagedFilesMarker);
  const manifestStart = result.stdout.indexOf(manifestMarker);
  assert.notEqual(listingStart, -1, result.stdout);
  assert.notEqual(stagedFilesStart, -1, result.stdout);
  assert.notEqual(manifestStart, -1, result.stdout);
  const entries = result.stdout
    .slice(listingStart + listingMarker.length, stagedFilesStart)
    .trim()
    .split('\n');
  assert.ok(entries.includes('./ordinary/allowed.txt'));
  assert.equal(entries.some((entry) => /^\.\/pages(?:\/|$)/.test(entry)), false);
  assert.equal(entries.some((entry) => /^\.\/restricted(?:\/|$)/.test(entry)), false);

  const stagedFiles = result.stdout
    .slice(stagedFilesStart + stagedFilesMarker.length, manifestStart)
    .trim()
    .split('\n');
  assert.ok(stagedFiles.some((entry) => entry.endsWith('-allowed.sqlite.zst')));
  assert.equal(stagedFiles.some((entry) => entry.includes('secret.sqlite')), false);

  const manifest = JSON.parse(result.stdout.slice(manifestStart + manifestMarker.length));
  assert.equal(manifest.state_note, 'ok');
  assert.deepEqual(
    manifest.databases.map((database) => database.source_relative_path),
    ['ordinary/allowed.sqlite'],
  );
  assert.equal(
    manifest.state_snapshot.format,
    'zstd-compressed tar of data/ minus pages/ and restricted/',
  );
});
