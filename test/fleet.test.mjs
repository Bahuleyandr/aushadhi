import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { writeCohortManifest } from '../src/lib/build-cohort.mjs';
import {
  countJsonlRows,
  inspectBuildHealth,
  inspectSource,
  renderBuildHealth,
  renderFleet,
  summarizeRunLog,
} from '../src/lib/fleet.mjs';

test('renderFleet: progress %, thousands, and ETA from remaining/cap', () => {
  const md = renderFleet([
    { name: 'netmeds', today: 574, cap: 20000, cursor: 574, total: 230784, rows: 974 },
    { name: 'pharmeasy', today: 3956, cap: 20000, cursor: 3956, total: 179623, rows: 4082 },
  ]);
  assert.match(md, /netmeds/);
  assert.match(md, /230,784/);
  assert.match(md, /0\.2%/);          // 574/230784
  assert.match(md, /~12d/);           // ceil((230784-574)/20000)=12
  assert.match(md, /~9d/);            // ceil((179623-3956)/20000)=9
});

test('renderFleet: missing total/cursor -> no % or ETA, still lists the crawler', () => {
  const md = renderFleet([{ name: '1mg', today: 2935, cap: 20000, cursor: null, total: null, rows: 145793 }]);
  assert.match(md, /1mg/);
  assert.match(md, /145,793/);
  assert.doesNotMatch(md, /NaN/);
});

test('renderFleet: unresolved quarantine remains visible at 100% cursor progress', () => {
  const md = renderFleet([{
    name: 'apollo',
    today: 56,
    cap: 10000,
    cursor: 3931,
    total: 3931,
    rows: 14835,
    quarantined: 1,
    tombstones: 0,
  }]);
  assert.match(md, /100\.0%/);
  assert.match(md, /quarantine/i);
  assert.match(md, /\|\s*1\s*\|/);
});

test('countJsonlRows streams JSONL and handles blank lines and a final unterminated row', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-fleet-lines-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'large.jsonl');
  fs.writeFileSync(file, `${'{"id":1}\n'.repeat(50_000)}\n  \n{"id":2}`);

  assert.equal(await countJsonlRows(file), 50_001);
});

test('inspectSource reports the newest productive output, index freshness, cursors, and outcomes', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-fleet-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, 'apollo');
  fs.mkdirSync(path.join(sourceRoot, '2026-08-05'), { recursive: true });
  fs.mkdirSync(path.join(sourceRoot, '2026-08-06'), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'state.json'), JSON.stringify({
    date: '2026-08-06',
    count: 17,
    apollo: {
      saltChecks: {
        '/salt/a': '2026-08-06T10:00:00.000Z',
        '/salt/b': '2026-08-06T11:00:00.000Z',
      },
      quarantine: [{ path: '/medicine/a' }],
      tombstones: ['product:/medicine/gone'],
      products: {
        pathOutcomes: [
          { path: '/medicine/deferred', status: 'not_found' },
          { path: '/medicine/gone', status: 'gone' },
        ],
      },
      salts: { pathOutcomes: [] },
    },
  }));
  const index = path.join(sourceRoot, 'salt-index.jsonl');
  fs.writeFileSync(index, '{"path":"a"}\n{"path":"b"}\n{"path":"c"}\n');
  const productive = path.join(sourceRoot, '2026-08-05', 'normalized.jsonl');
  fs.writeFileSync(productive, '{"source_id":"a"}\n{"source_id":"b"}\n');
  const empty = path.join(sourceRoot, '2026-08-06', 'normalized.jsonl');
  fs.writeFileSync(empty, '');
  const now = new Date('2026-08-06T12:00:00.000Z');
  fs.utimesSync(index, new Date(now.getTime() - 7_200_000), new Date(now.getTime() - 7_200_000));
  fs.utimesSync(productive, new Date(now.getTime() - 3_600_000), new Date(now.getTime() - 3_600_000));
  fs.utimesSync(empty, new Date(now.getTime() - 60_000), new Date(now.getTime() - 60_000));

  const inspected = await inspectSource({
    rawRoot: root,
    source: 'apollo',
    indexFile: 'salt-index.jsonl',
    now,
  });

  assert.equal(inspected.today, 17);
  assert.equal(inspected.cursor, 2);
  assert.equal(inspected.total, 3);
  assert.equal(inspected.rows, 2);
  assert.equal(inspected.outputAgeMs, 3_600_000);
  assert.equal(inspected.indexAgeMs, 7_200_000);
  assert.equal(inspected.quarantined, 1);
  assert.equal(inspected.notFound, 1);
  assert.equal(inspected.gone, 1);
  assert.equal(inspected.tombstones, 1);
  assert.equal(inspected.operatorHold, false);
});

test('inspectSource reports an operator-hold marker independently of crawler logs', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-fleet-hold-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, 'apollo');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'state.json'), JSON.stringify({
    date: '2026-08-06', count: 4, apollo: {},
  }));
  fs.writeFileSync(path.join(sourceRoot, 'salt-index.jsonl'), '{"path":"/salt/a"}\n');
  fs.writeFileSync(path.join(sourceRoot, 'operator-hold'), 'source=apollo\nreason=blocked/robots\n');

  const inspected = await inspectSource({
    rawRoot: root,
    source: 'apollo',
    indexFile: 'salt-index.jsonl',
  });
  assert.equal(inspected.operatorHold, true);
  assert.equal(inspected.operatorHoldValid, true);
  assert.equal(inspected.operatorHoldPath, path.join(sourceRoot, 'operator-hold'));
});

test('inspectSource uses completed refresh time and reads 1mg gapfill outcomes', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-fleet-refresh-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, 'onemg');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'slug-index.jsonl'), '{"path":"/drugs/a-1"}\n');
  fs.writeFileSync(path.join(sourceRoot, 'state.json'), JSON.stringify({
    date: '2026-08-06',
    count: 9,
    discover: {
      label: 22,
      page: 32,
      completed_at: '2026-08-06T11:00:00.000Z',
      next_refresh_at: '2026-08-07T11:00:00.000Z',
    },
    gapfill: {
      quarantine: [{ path: '/drugs/q-2' }],
      pathOutcomes: [
        { path: '/drugs/a-1', status: 'not_found' },
        { path: '/drugs/b-2', status: 'gone' },
        { path: '/drugs/c-3', status: 'excluded' },
      ],
    },
  }));
  fs.utimesSync(
    path.join(sourceRoot, 'slug-index.jsonl'),
    new Date('2026-08-01T00:00:00.000Z'),
    new Date('2026-08-01T00:00:00.000Z'),
  );

  const inspected = await inspectSource({
    rawRoot: root,
    source: 'onemg',
    indexFile: 'slug-index.jsonl',
    now: new Date('2026-08-06T12:00:00.000Z'),
  });
  assert.equal(inspected.cursor, 'w:32');
  assert.equal(inspected.outputAgeMs, null);
  assert.equal(inspected.indexAgeMs, 3_600_000);
  assert.ok(inspected.indexFileAgeMs > inspected.indexAgeMs);
  assert.equal(inspected.quarantined, 1);
  assert.equal(inspected.notFound, 1);
  assert.equal(inspected.gone, 1);
  assert.equal(inspected.excluded, 1);
  assert.equal(inspected.tombstones, 2);
});

test('summarizeRunLog exposes repeated zero-yield completion and a later human hold', () => {
  const repeated = summarizeRunLog([
    '2026-08-06T00:00:00Z apollo done: added=0 total=100 quarantined=0 notFound=1 gone=2',
    '2026-08-06T00:00:01Z apollo: crawl complete — scheduled idle 6h',
    '2026-08-06T06:00:00Z apollo done: added=0 total=100 quarantined=0 notFound=1 gone=2',
  ].join('\n'));
  assert.equal(repeated.zeroYieldRuns, 2);
  assert.equal(repeated.repeatedTerminal, true);
  assert.equal(repeated.state, 'complete');

  const held = summarizeRunLog('2026-08-06T07:00:00Z apollo HOLD: blocked/robots; human clearance required');
  assert.equal(held.state, 'hold');
  assert.match(held.detail, /blocked\/robots/);
});

test('inspectBuildHealth verifies every file in the bound cohort', async (t) => {
  const distRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-fleet-build-'));
  t.after(() => fs.rmSync(distRoot, { recursive: true, force: true }));
  const latest = path.join(distRoot, '.generations', 'generation-1');
  fs.mkdirSync(latest, { recursive: true });
  const artifacts = {
    'drugs.csv': '\ufeffbrand_name\nA\n',
    'drugs.jsonl': '{"id":1}\n',
    'compositions.csv': '\ufeffcomposition\nA\n',
    'substitute_edges.csv': 'brand_name\n',
    'conflicts.csv': 'kind\n',
    'conflicts.jsonl': '',
    'errors.csv': 'source,reason,detail\n',
    'summary.json': `${JSON.stringify({ date: '2026-08-06', total_rows: 1, conflicts: 0 })}\n`,
    'ATTRIBUTION.md': '# Attribution\n',
    'prescribable.jsonl': '{"id":1}\n',
    'formulation_groups.jsonl': '{"id":1}\n',
    'REPORT.md': '# Report\n',
  };
  for (const [name, body] of Object.entries(artifacts)) fs.writeFileSync(path.join(latest, name), body);
  await writeCohortManifest({
    dir: latest,
    date: '2026-08-06',
    generationId: 'generation-1',
    inputFingerprint: 'fingerprint',
    now: new Date('2026-08-06T01:00:00.000Z'),
  });
  const manifestBytes = fs.readFileSync(path.join(latest, 'cohort-manifest.json'));
  fs.writeFileSync(path.join(distRoot, 'cohort-index.json'), JSON.stringify({
    schema_version: 1,
    updated_at: '2026-08-06T01:00:00.000Z',
    latest: { date: '2026-08-06', generation_id: 'generation-1' },
    dates: { '2026-08-06': 'generation-1' },
    generations: {
      'generation-1': {
        date: '2026-08-06',
        manifest_sha256: createHash('sha256').update(manifestBytes).digest('hex'),
        published_at: '2026-08-06T01:00:00.000Z',
      },
    },
  }));
  fs.writeFileSync(path.join(distRoot, '.build-state.json'), JSON.stringify({
    schema_version: 1,
    generation_id: 'generation-1',
    date: '2026-08-06',
    input_fingerprint: 'fingerprint',
    completed_at: '2026-08-06T01:00:00.000Z',
    reason: 'inputs-changed',
  }));

  const healthy = await inspectBuildHealth({
    distRoot,
    now: new Date('2026-08-06T02:00:00.000Z'),
  });
  assert.equal(healthy.status, 'ok');
  assert.equal(healthy.generationId, 'generation-1');
  assert.equal(healthy.ageMs, 3_600_000);
  assert.match(renderBuildHealth(healthy), /cohort=ok/);
  assert.match(renderBuildHealth(healthy), /storage=/);

  const drugs = path.join(latest, 'drugs.jsonl');
  fs.writeFileSync(drugs, '{"id":9}\n');
  assert.equal(fs.statSync(drugs).size, Buffer.byteLength(artifacts['drugs.jsonl']));
  const corrupted = await inspectBuildHealth({ distRoot });
  assert.equal(corrupted.status, 'unhealthy');
  assert.match(corrupted.detail, /drugs\.jsonl hash mismatch/i);
  fs.writeFileSync(drugs, artifacts['drugs.jsonl']);

  fs.writeFileSync(path.join(distRoot, '.build-state.json'), JSON.stringify({
    ...JSON.parse(fs.readFileSync(path.join(distRoot, '.build-state.json'), 'utf8')),
    generation_id: 'different-generation',
  }));
  const unhealthy = await inspectBuildHealth({ distRoot });
  assert.equal(unhealthy.status, 'unhealthy');
  assert.match(unhealthy.detail, /generation/i);
});

test('renderFleet includes liveness, productive/index age, and repeated terminal state', () => {
  const md = renderFleet([{
    name: 'apollo',
    service: 'active/running',
    today: 17,
    cap: 10_000,
    cursor: 2,
    total: 3,
    rows: 12,
    outputAgeMs: 60_000,
    indexAgeMs: 7_200_000,
    quarantined: 1,
    tombstones: 2,
    zeroYieldRuns: 3,
    repeatedTerminal: true,
  }]);
  assert.match(md, /active\/running/);
  assert.match(md, /1m/);
  assert.match(md, /2h/);
  assert.match(md, /zero-yield x3/);
  assert.match(md, /\| 2 \| 1 \| unresolved/);
});

test('renderFleet lets a direct operator-hold marker override stale healthy or zero-yield logs', () => {
  const md = renderFleet([{
    name: 'apollo',
    service: 'active/running',
    today: 17,
    cap: 10_000,
    cursor: 2,
    total: 3,
    rows: 12,
    operatorHold: true,
    runState: 'complete',
    zeroYieldRuns: 3,
    repeatedTerminal: true,
  }]);
  assert.match(md, /\| hold \|/);
  assert.doesNotMatch(md, /zero-yield/);
});

test('fleet CLI uses hardened runtime roots and bounded JSONL/log readers', () => {
  const cli = fs.readFileSync('src/cli/fleet-status.mjs', 'utf8');
  assert.match(cli, /AUSHADHI_RAW_ROOT/);
  assert.match(cli, /AUSHADHI_DIST_ROOT/);
  assert.match(cli, /AUSHADHI_LOG_ROOT/);
  assert.match(cli, /\/var\/lib\/aushadhi\/data\/raw/);
  assert.match(cli, /\/var\/lib\/aushadhi\/dist/);
  assert.match(cli, /\/var\/log\/aushadhi/);
  assert.match(cli, /path\.join\(logRoot, definition\.source, definition\.log\)/);
  assert.match(cli, /inspected\.operatorHold\s*\?\s*'hold'/);
  assert.match(cli, /readTailFile/);
  assert.doesNotMatch(cli, /readFileSync\([^\n]*\.jsonl/);
});
