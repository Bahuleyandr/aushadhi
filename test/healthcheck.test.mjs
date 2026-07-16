import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const TMP = 'test/.tmp-healthcheck';

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

    const result = spawnSync('bash', ['scripts/healthcheck.sh'], {
      cwd: '.',
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${process.cwd()}/${TMP}/bin:${process.env.PATH}`,
        AUSHADHI_SERVICE: 'aushadhi-crawl.service',
        AUSHADHI_LOG: log,
        AUSHADHI_STATE: state,
        AUSHADHI_OUTPUT: `${TMP}/normalized.jsonl`,
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
