import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TMP = 'test/.tmp-healthcheck';
let bashWorkingDirectory;

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

test('healthcheck clears a prior discovery anomaly after later discovery progress', () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(`${TMP}/bin`, { recursive: true });
  fs.writeFileSync(`${TMP}/bin/systemctl`, `#!/usr/bin/env sh
case "$1" in
  is-active) printf 'active\\n' ;;
  show) printf '0\\n' ;;
  *) exit 1 ;;
esac
`);
  fs.chmodSync(`${TMP}/bin/systemctl`, 0o755);

  const log = `${TMP}/crawl.log`;
  const state = `${TMP}/state.json`;
  try {
    fs.writeFileSync(log, [
      '2026-07-14T08:56:37Z crawl-loop ERROR: discovery anomaly — cursor preserved; sleeping 1h before retry without gapfill',
      'discover: label=w page=32 links=30 new=30',
    ].join('\n') + '\n');
    fs.writeFileSync(state, JSON.stringify({ count: 1710 }));

    const importedVariables = [
      'AUSHADHI_TEST_BIN',
      'AUSHADHI_SERVICE',
      'AUSHADHI_LOG',
      'AUSHADHI_STATE',
      'AUSHADHI_OUTPUT',
      'AUSHADHI_DAILY_CAP',
    ];
    const result = spawnSync('bash', [
      '-c',
      'PATH="$AUSHADHI_TEST_BIN:$PATH"; export PATH; exec bash scripts/healthcheck.sh',
    ], {
      cwd: '.',
      encoding: 'utf8',
      env: {
        ...process.env,
        WSLENV: [
          process.env.WSLENV,
          ...importedVariables,
        ].filter(Boolean).join(':'),
        AUSHADHI_TEST_BIN: bashPath(`${TMP}/bin`),
        AUSHADHI_SERVICE: 'aushadhi-crawl.service',
        AUSHADHI_LOG: bashPath(log),
        AUSHADHI_STATE: bashPath(state),
        AUSHADHI_OUTPUT: bashPath(`${TMP}/normalized.jsonl`),
        AUSHADHI_DAILY_CAP: '12000',
      },
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /^OK: active and fetching/);
    assert.doesNotMatch(result.stdout, /^ALERT:/);
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
