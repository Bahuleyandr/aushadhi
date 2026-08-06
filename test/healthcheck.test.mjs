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
  show)
    case "$*" in
      *SubState*) printf 'running\\n' ;;
      *NRestarts*) printf '0\\n' ;;
      *Environment*) printf 'AUSHADHI_DAILY_CAP=12000\\n' ;;
      *) printf '0\\n' ;;
    esac
    ;;
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
    assert.match(result.stdout, /^OK: onemg active/);
    assert.doesNotMatch(result.stdout, /^ALERT:/);
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('healthcheck defaults to hardened runtime paths and reports productive/index age', () => {
  const script = fs.readFileSync('scripts/healthcheck.sh', 'utf8');
  assert.match(script, /\/var\/lib\/aushadhi\/data\/raw/);
  assert.match(script, /\/var\/log\/aushadhi/);
  assert.match(script, /\$LOG_ROOT\/\$SOURCE\/\$log_name\.log/);
  assert.doesNotMatch(script, /\/root\/aushadhi/);
  assert.match(script, /SubState/);
  assert.match(script, /outputage=/);
  assert.match(script, /indexage=/);
  assert.match(script, /zero_yield_runs=/);
  assert.match(script, /JSON\.parse/);
  assert.match(script, /HOLD:/);
  assert.match(script, /operator-hold/);
  assert.match(script, /NO_WORK:/);
});

test('source healthcheck wrappers select exactly one service and delegate to the common check', () => {
  for (const source of ['apollo', 'pharmeasy', 'netmeds']) {
    const script = fs.readFileSync(`scripts/healthcheck-${source}.sh`, 'utf8');
    assert.match(script, new RegExp(`AUSHADHI_SERVICE=aushadhi-${source}\\.service`));
    assert.match(script, new RegExp(`AUSHADHI_SOURCE=${source}`));
    assert.match(script, /exec .*healthcheck\.sh/);
    assert.doesNotMatch(script, /\/root\//);
  }
});

test('healthcheck rejects an active unit whose main process is not running', () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(`${TMP}/bin`, { recursive: true });
  fs.writeFileSync(`${TMP}/bin/systemctl`, `#!/usr/bin/env sh
case "$1" in
  is-active) printf 'active\\n' ;;
  show)
    case "$*" in
      *SubState*) printf 'dead\\n' ;;
      *NRestarts*) printf '2\\n' ;;
      *Environment*) printf 'AUSHADHI_DAILY_CAP=20000\\n' ;;
      *) printf '0\\n' ;;
    esac
    ;;
  *) exit 1 ;;
esac
`);
  fs.chmodSync(`${TMP}/bin/systemctl`, 0o755);
  const log = `${TMP}/crawl.log`;
  const state = `${TMP}/state.json`;
  try {
    fs.writeFileSync(log, 'crawl-loop start\n');
    fs.writeFileSync(state, JSON.stringify({ date: '2026-08-06', count: 1 }));
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
        WSLENV: [process.env.WSLENV, ...importedVariables].filter(Boolean).join(':'),
        AUSHADHI_TEST_BIN: bashPath(`${TMP}/bin`),
        AUSHADHI_SERVICE: 'aushadhi-crawl.service',
        AUSHADHI_LOG: bashPath(log),
        AUSHADHI_STATE: bashPath(state),
        AUSHADHI_OUTPUT: bashPath(`${TMP}/normalized.jsonl`),
        AUSHADHI_DAILY_CAP: '20000',
      },
    });

    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /^ALERT: .*active\/dead/);
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('healthcheck fails closed when an active crawler state file is missing or invalid', () => {
  const root = fs.mkdtempSync('test/.tmp-healthcheck-state-');
  fs.mkdirSync(`${root}/bin`, { recursive: true });
  fs.writeFileSync(`${root}/bin/systemctl`, `#!/usr/bin/env sh
case "$1" in
  is-active) printf 'active\\n' ;;
  is-enabled) printf 'enabled\\n' ;;
  show)
    case "$*" in
      *SubState*) printf 'running\\n' ;;
      *NRestarts*) printf '0\\n' ;;
      *Environment*) printf 'AUSHADHI_APOLLO_CAP=10000\\n' ;;
      *) printf '0\\n' ;;
    esac
    ;;
  *) exit 1 ;;
esac
`);
  fs.chmodSync(`${root}/bin/systemctl`, 0o755);
  const log = `${root}/apollo.log`;
  const state = `${root}/state.json`;
  fs.writeFileSync(log, '2026-08-06T00:00:00Z apollo-loop start\n');
  fs.writeFileSync(state, '{not-json\n');
  const importedVariables = [
    'AUSHADHI_TEST_BIN', 'AUSHADHI_SERVICE', 'AUSHADHI_LOG',
    'AUSHADHI_STATE', 'AUSHADHI_OUTPUT', 'AUSHADHI_APOLLO_CAP',
  ];
  try {
    const result = spawnSync('bash', [
      '-c',
      'PATH="$AUSHADHI_TEST_BIN:$PATH"; export PATH; exec bash scripts/healthcheck.sh',
    ], {
      cwd: '.',
      encoding: 'utf8',
      env: {
        ...process.env,
        WSLENV: [process.env.WSLENV, ...importedVariables].filter(Boolean).join(':'),
        AUSHADHI_TEST_BIN: bashPath(`${root}/bin`),
        AUSHADHI_SERVICE: 'aushadhi-apollo.service',
        AUSHADHI_LOG: bashPath(log),
        AUSHADHI_STATE: bashPath(state),
        AUSHADHI_OUTPUT: bashPath(`${root}/normalized.jsonl`),
        AUSHADHI_APOLLO_CAP: '10000',
      },
    });
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /^ALERT: apollo state-invalid/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('healthcheck accepts only the intentionally disabled 1mg unit as a held source', () => {
  const root = fs.mkdtempSync('test/.tmp-healthcheck-held-');
  fs.mkdirSync(`${root}/bin`, { recursive: true });
  fs.writeFileSync(`${root}/bin/systemctl`, `#!/usr/bin/env sh
case "$1" in
  is-active) printf 'inactive\\n' ;;
  is-enabled) printf 'disabled\\n' ;;
  show)
    case "$*" in
      *SubState*) printf 'dead\\n' ;;
      *NRestarts*) printf '0\\n' ;;
      *Environment*) printf 'AUSHADHI_DAILY_CAP=20000\\n' ;;
      *) printf '0\\n' ;;
    esac
    ;;
  *) exit 1 ;;
esac
`);
  fs.chmodSync(`${root}/bin/systemctl`, 0o755);
  const log = `${root}/crawl.log`;
  fs.writeFileSync(log, '1mg held by operator\n');
  const importedVariables = ['AUSHADHI_TEST_BIN', 'AUSHADHI_SERVICE', 'AUSHADHI_LOG'];
  const run = (service) => spawnSync('bash', [
    '-c',
    'PATH="$AUSHADHI_TEST_BIN:$PATH"; export PATH; exec bash scripts/healthcheck.sh',
  ], {
    cwd: '.',
    encoding: 'utf8',
    env: {
      ...process.env,
      WSLENV: [process.env.WSLENV, ...importedVariables].filter(Boolean).join(':'),
      AUSHADHI_TEST_BIN: bashPath(`${root}/bin`),
      AUSHADHI_SERVICE: service,
      AUSHADHI_LOG: bashPath(log),
    },
  });

  try {
    const onemg = run('aushadhi-crawl.service');
    assert.equal(onemg.status, 0, `${onemg.stdout}\n${onemg.stderr}`);
    assert.match(onemg.stdout, /^OK: onemg intentionally-disabled/);
    assert.doesNotMatch(onemg.stdout, /ALERT:/);

    const apollo = run('aushadhi-apollo.service');
    assert.equal(apollo.status, 1, `${apollo.stdout}\n${apollo.stderr}`);
    assert.match(apollo.stdout, /^ALERT: apollo liveness=inactive\/dead/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('healthcheck distinguishes block holds, cap waits, and repeated zero-yield idle', () => {
  const root = fs.mkdtempSync('test/.tmp-healthcheck-status-');
  fs.mkdirSync(`${root}/bin`, { recursive: true });
  fs.writeFileSync(`${root}/bin/systemctl`, `#!/usr/bin/env sh
case "$1" in
  is-active) printf 'active\\n' ;;
  show)
    case "$*" in
      *SubState*) printf 'running\\n' ;;
      *NRestarts*) printf '0\\n' ;;
      *Environment*) printf 'AUSHADHI_APOLLO_CAP=10000\\n' ;;
      *) printf '0\\n' ;;
    esac
    ;;
  *) exit 1 ;;
esac
`);
  fs.chmodSync(`${root}/bin/systemctl`, 0o755);
  const log = `${root}/apollo.log`;
  const state = `${root}/state.json`;
  const output = `${root}/normalized.jsonl`;
  const index = `${root}/salt-index.jsonl`;
  fs.writeFileSync(state, JSON.stringify({ date: '2026-08-06', count: 10 }));
  fs.writeFileSync(output, '{"source_id":"1"}\n');
  fs.writeFileSync(index, '{"path":"/salt/a"}\n');

  const importedVariables = [
    'AUSHADHI_TEST_BIN',
    'AUSHADHI_SERVICE',
    'AUSHADHI_LOG',
    'AUSHADHI_STATE',
    'AUSHADHI_OUTPUT',
    'AUSHADHI_INDEX',
    'AUSHADHI_SOURCE_ROOT',
    'AUSHADHI_APOLLO_CAP',
  ];
  const run = () => spawnSync('bash', [
    '-c',
    'PATH="$AUSHADHI_TEST_BIN:$PATH"; export PATH; exec bash scripts/healthcheck.sh',
  ], {
    cwd: '.',
    encoding: 'utf8',
    env: {
      ...process.env,
      WSLENV: [process.env.WSLENV, ...importedVariables].filter(Boolean).join(':'),
      AUSHADHI_TEST_BIN: bashPath(`${root}/bin`),
      AUSHADHI_SERVICE: 'aushadhi-apollo.service',
      AUSHADHI_LOG: bashPath(log),
      AUSHADHI_STATE: bashPath(state),
      AUSHADHI_OUTPUT: bashPath(output),
      AUSHADHI_INDEX: bashPath(index),
      AUSHADHI_SOURCE_ROOT: bashPath(root),
      AUSHADHI_APOLLO_CAP: '10000',
    },
  });

  try {
    fs.writeFileSync(log, '2026-08-06T01:00:00Z apollo HOLD: blocked/robots; human clearance required\n');
    const held = run();
    assert.equal(held.status, 1, `${held.stdout}\n${held.stderr}`);
    assert.match(held.stdout, /human-hold required/);

    fs.writeFileSync(`${root}/operator-hold`, 'source=apollo\nreason=blocked/robots\n');
    fs.writeFileSync(log, '2026-08-06T02:00:00Z apollo: cap reached — reset wait 7200s until after 00:00 UTC\n');
    const markerHeld = run();
    assert.equal(markerHeld.status, 1, `${markerHeld.stdout}\n${markerHeld.stderr}`);
    assert.match(markerHeld.stdout, /operator-hold marker/);
    assert.doesNotMatch(markerHeld.stdout, /^OK:/);

    fs.unlinkSync(`${root}/operator-hold`);
    const capped = run();
    assert.equal(capped.status, 0, `${capped.stdout}\n${capped.stderr}`);
    assert.match(capped.stdout, /^OK: apollo scheduled-wait/);

    fs.writeFileSync(log, [
      'apollo done: status=no_work, added=0, total=100',
      'apollo done: status=no_work, added=0, total=100',
      'apollo: crawl complete — scheduled idle 6h',
    ].join('\n') + '\n');
    const idle = run();
    assert.equal(idle.status, 0, `${idle.stdout}\n${idle.stderr}`);
    assert.match(idle.stdout, /terminal=repeated-zero-yield/);
    assert.match(idle.stdout, /zero_yield_runs=2/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
