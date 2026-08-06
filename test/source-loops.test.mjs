import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const loops = [
  ['apollo', 'scripts/apollo-loop.sh', 10_000, 'apollo'],
  ['pharmeasy', 'scripts/pharmeasy-loop.sh', 20_000, 'pharmeasy'],
  ['netmeds', 'scripts/netmeds-loop.sh', 20_000, 'netmeds'],
];

const allLoops = [
  ['onemg', 'scripts/crawl-loop.sh'],
  ...loops.map(([source, file]) => [source, file]),
];

function caseBranch(script, code, nextCode) {
  const exitCase = script.indexOf('case "$rc" in');
  assert.notEqual(exitCase, -1, 'missing exit-code case statement');
  const start = script.indexOf(`\n    ${code})`, exitCase);
  const end = nextCode === null
    ? script.indexOf('\n  esac', start) : script.indexOf(`\n    ${nextCode})`, start);
  assert.notEqual(start, -1, `missing exit ${code} branch`);
  assert.notEqual(end, -1, `missing end for exit ${code} branch`);
  return script.slice(start, end);
}

for (const [source, file, cap, stateDirectory] of loops) {
  test(`${source} loop uses its conservative cap and distinct stop contract`, () => {
    const script = fs.readFileSync(file, 'utf8');
    assert.match(script, new RegExp(`AUSHADHI_${source.toUpperCase()}_CAP:-${cap}`));
    assert.doesNotMatch(script, /30000/);
    assert.match(script, new RegExp(`MAX_CAP=${cap}`));
    assert.match(script, /configured_cap.*-gt.*MAX_CAP/);
    assert.match(script, /^export AUSHADHI_DISTINCT_EXIT_CODES=1$/m);

    const capped = caseBranch(script, 2, 3);
    assert.match(capped, /sleep_until_utc_reset/);
    assert.doesNotMatch(capped, /sleep 3600/);

    const blocked = caseBranch(script, 3, 4);
    assert.match(blocked, /HOLD:/);
    assert.match(blocked, /enter_operator_hold/);
    assert.doesNotMatch(blocked, /sleep 3600/);

    assert.match(caseBranch(script, 4, 5), /sleep 3600/);
    const noWork = caseBranch(script, 5, 0);
    assert.match(noWork, /scheduled idle/);
    assert.match(noWork, /sleep 21600/);
    assert.match(caseBranch(script, 0, '*'), /sleep 21600/);

    assert.match(script, new RegExp(`AUSHADHI_RAW_ROOT:-data/raw}/${stateDirectory}/operator-hold`));
    const startupCheck = script.indexOf('if [ -e "$HOLD_MARKER" ]');
    const firstCrawl = script.indexOf(`node src/cli/${source}.mjs`);
    assert.ok(startupCheck >= 0 && startupCheck < firstCrawl);
    assert.match(script, /clearance requires: stop the service, investigate, explicitly delete the marker, then start the service/);
    assert.doesNotMatch(script, /rm\s+(?:-[^\s]+\s+)*["']?\$HOLD_MARKER/);
  });
}

test('1mg loop persists source holds and checks them before any crawl command', () => {
  const script = fs.readFileSync('scripts/crawl-loop.sh', 'utf8');
  assert.match(script, /AUSHADHI_RAW_ROOT:-data\/raw}\/onemg\/operator-hold/);
  const startupCheck = script.indexOf('if [ -e "$HOLD_MARKER" ]');
  const firstCrawl = script.indexOf('node src/cli/gapfill.mjs');
  assert.ok(startupCheck >= 0 && startupCheck < firstCrawl);
  assert.match(script, /enter_operator_hold "discovery blocked\/robots refused"/);
  assert.match(script, /enter_operator_hold "gapfill blocked\/robots refused"/);
  assert.match(script, /clearance requires: stop the service, investigate, explicitly delete the marker, then start the service/);
  assert.doesNotMatch(script, /rm\s+(?:-[^\s]+\s+)*["']?\$HOLD_MARKER/);
});

for (const [source, file] of allLoops) {
  test(`${source} operator-hold publication is fail-closed and durable`, () => {
    const script = fs.readFileSync(file, 'utf8');
    const persistStart = script.indexOf('persist_operator_hold()');
    const enterStart = script.indexOf('enter_operator_hold()');
    const startupCheck = script.indexOf('if [ -e "$HOLD_MARKER" ] || [ -L "$HOLD_MARKER" ]');
    assert.ok(persistStart >= 0 && persistStart < enterStart, 'persistence helper must precede hold entry');
    assert.ok(startupCheck > enterStart, 'startup must treat even a broken symlink as a hold marker');

    const persist = script.slice(persistStart, enterStart);
    assert.match(persist, /lstatSync/);
    assert.match(persist, /isSymbolicLink\(\)/);
    assert.match(persist, /isFile\(\)/);
    assert.match(persist, /O_NOFOLLOW/);
    assert.match(persist, /O_DIRECTORY/);
    assert.ok((persist.match(/fsyncSync/g) || []).length >= 2, 'marker and parent directory must both be fsynced');

    const enterEnd = script.indexOf('\n}', enterStart);
    const enter = script.slice(enterStart, enterEnd);
    assert.match(enter, /if ! persist_operator_hold "\$reason"; then/);
    assert.match(enter, /operator-hold publication failed/);
    assert.match(enter, /exec sleep infinity/);
    assert.ok(
      enter.indexOf('persist_operator_hold "$reason"') < enter.lastIndexOf('exec sleep infinity'),
      'durable publication must complete before the normal hold sleep',
    );
  });

  test(`${source} embedded publication helper creates a regular marker and rejects symlinks on Linux`, () => {
    if (process.platform !== 'linux') return;

    const script = fs.readFileSync(file, 'utf8');
    const embedded = script.match(/<<'NODE'\r?\n([\s\S]*?)\r?\nNODE\r?\n/);
    assert.ok(embedded, 'missing embedded durability helper');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `aushadhi-${source}-hold-`));
    const marker = path.join(root, source, 'operator-hold');
    try {
      const published = spawnSync(
        process.execPath,
        ['--input-type=module', '-', marker, source, 'test block'],
        { input: embedded[1], encoding: 'utf8' },
      );
      assert.equal(published.status, 0, published.stderr);
      assert.equal(fs.lstatSync(marker).isFile(), true);
      assert.equal(fs.lstatSync(marker).isSymbolicLink(), false);
      assert.match(fs.readFileSync(marker, 'utf8'), new RegExp(`^source=${source}$`, 'm'));
      assert.match(fs.readFileSync(marker, 'utf8'), /^reason=test block$/m);
      assert.deepEqual(
        fs.readdirSync(path.dirname(marker)).filter((name) => name.startsWith('operator-hold.tmp.')),
        [],
      );

      const symlinkTarget = path.join(root, `${source}-symlink-target`);
      fs.writeFileSync(symlinkTarget, 'must-not-change\n');
      fs.unlinkSync(marker);
      fs.symlinkSync(symlinkTarget, marker);
      const rejected = spawnSync(
        process.execPath,
        ['--input-type=module', '-', marker, source, 'second block'],
        { input: embedded[1], encoding: 'utf8' },
      );
      assert.notEqual(rejected.status, 0);
      assert.match(rejected.stderr, /not a regular non-symlink file/);
      assert.equal(fs.readFileSync(symlinkTarget, 'utf8'), 'must-not-change\n');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
