import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  COHORT_GENERATIONS_DIR,
  COHORT_INDEX,
  acquireBuildLock,
  computeInputFingerprint,
  createGenerationStage,
  hasPublishedCohort,
  promoteCohort,
  resolvePublishedCohort,
  shouldBuildCohort,
  verifyCohort,
  writeCohortManifest,
} from '../src/lib/build-cohort.mjs';
import { buildInputFingerprint } from '../src/cli/build-cohort.mjs';

const execFileAsync = promisify(execFile);

const REQUIRED_FIXTURES = {
  'drugs.csv': '\ufeffbrand_name\nA\nB\n',
  'drugs.jsonl': '{"id":1}\n{"id":2}\n',
  'compositions.csv': '\ufeffcomposition\nA\n',
  'substitute_edges.csv': 'brand_name\n',
  'conflicts.csv': 'kind\n',
  'conflicts.jsonl': '',
  'errors.csv': 'source,reason,detail\n',
  'summary.json': `${JSON.stringify({
    date: '2026-08-06', total_rows: 2, conflicts: 0, sources: { fixture: 2 },
  })}\n`,
  'ATTRIBUTION.md': '# Attribution\n',
  'prescribable.jsonl': '{"med_id":"m1"}\n',
  'formulation_groups.jsonl': '',
  'REPORT.md': '# report\n',
};

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-cohort-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeFixtureCohort(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, contents] of Object.entries(REQUIRED_FIXTURES)) {
    fs.writeFileSync(path.join(dir, name), contents);
  }
}

function writeVolumeFixtureCohort(dir, {
  rowCount,
  prescribableCount = rowCount,
  sources,
  date = '2026-08-06',
}) {
  writeFixtureCohort(dir);
  const rows = Array.from({ length: rowCount }, (_, index) => JSON.stringify({ id: index + 1 }));
  const medicines = Array.from(
    { length: prescribableCount },
    (_, index) => JSON.stringify({ med_id: `m${index + 1}` }),
  );
  fs.writeFileSync(path.join(dir, 'drugs.jsonl'), rows.length ? `${rows.join('\n')}\n` : '');
  fs.writeFileSync(
    path.join(dir, 'prescribable.jsonl'),
    medicines.length ? `${medicines.join('\n')}\n` : '',
  );
  fs.writeFileSync(
    path.join(dir, 'summary.json'),
    `${JSON.stringify({ date, total_rows: rowCount, conflicts: 0, sources })}\n`,
  );
}

async function stageVolumeCohort(distRoot, generationId, options) {
  const stageDir = await createGenerationStage({ distRoot, generationId });
  writeVolumeFixtureCohort(stageDir, options);
  await writeCohortManifest({
    dir: stageDir,
    date: options.date ?? '2026-08-06',
    generationId,
    inputFingerprint: `inputs-${generationId}`,
  });
  return stageDir;
}

function writeRawOnemgRows(rawRoot, count) {
  const snapshot = path.join(rawRoot, 'onemg', '2026-08-06');
  fs.mkdirSync(snapshot, { recursive: true });
  const rows = Array.from({ length: count }, (_, index) => ({
    source: 'onemg-live',
    source_id: String(index + 1),
    seen_at: '2026-08-06',
    brand_name: `Guard ${index + 1} Tablet`,
    manufacturer: 'Fixture Labs',
    pack_label: 'strip of 10',
    ingredients: [{
      molecule: `guardmolecule${index + 1}`,
      strength_value: index + 1,
      strength_unit: 'mg',
      strength_raw: `${index + 1}mg`,
    }],
    composition_status: 'complete',
    substitutes_raw: [],
  }));
  fs.writeFileSync(
    path.join(snapshot, 'normalized.jsonl'),
    rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '',
  );
}

test('generation staging is unique and starts clean', async (t) => {
  const distRoot = tempRoot(t);
  const dir = await createGenerationStage({
    distRoot,
    generationId: '20260806T010203Z-p123-a1b2c3',
  });
  assert.equal(path.basename(dir), '20260806T010203Z-p123-a1b2c3');
  assert.deepEqual(fs.readdirSync(dir), []);
  await assert.rejects(
    createGenerationStage({ distRoot, generationId: '20260806T010203Z-p123-a1b2c3' }),
    /already exists/i,
  );
});

test('cohort manifest binds hashes and record counts, then detects corruption', async (t) => {
  const root = tempRoot(t);
  writeFixtureCohort(root);
  const manifest = await writeCohortManifest({
    dir: root,
    date: '2026-08-06',
    generationId: 'gen-1',
    inputFingerprint: 'inputs-1',
  });
  assert.equal(manifest.counts.drugs, 2);
  assert.equal(manifest.counts.prescribable, 1);
  assert.equal(manifest.counts.conflicts, 0);
  assert.match(manifest.files['drugs.jsonl'].sha256, /^[a-f0-9]{64}$/);
  await verifyCohort({ dir: root, expectedDate: '2026-08-06', expectedGenerationId: 'gen-1' });

  fs.appendFileSync(path.join(root, 'prescribable.jsonl'), '{"med_id":"m2"}\n');
  await assert.rejects(
    verifyCohort({ dir: root, expectedDate: '2026-08-06', expectedGenerationId: 'gen-1' }),
    /prescribable\.jsonl.*hash/i,
  );
});

test('promotion publishes immutable generations through one latest-and-date index', async (t) => {
  const distRoot = tempRoot(t);
  const firstStage = await createGenerationStage({ distRoot, generationId: 'gen-1' });
  writeFixtureCohort(firstStage);
  await writeCohortManifest({
    dir: firstStage,
    date: '2026-08-06',
    generationId: 'gen-1',
    inputFingerprint: 'inputs-1',
  });
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId: 'gen-1',
    stageDir: firstStage,
  });

  const secondStage = await createGenerationStage({ distRoot, generationId: 'gen-2' });
  writeFixtureCohort(secondStage);
  await writeCohortManifest({
    dir: secondStage,
    date: '2026-08-06',
    generationId: 'gen-2',
    inputFingerprint: 'inputs-2',
  });

  await promoteCohort({ distRoot, date: '2026-08-06', generationId: 'gen-2', stageDir: secondStage });
  const latest = await resolvePublishedCohort({ distRoot });
  const dated = await resolvePublishedCohort({ distRoot, date: '2026-08-06' });
  assert.equal(latest.generationId, 'gen-2');
  assert.equal(dated.generationId, 'gen-2');
  assert.equal(latest.dir, dated.dir);
  assert.equal(path.basename(path.dirname(latest.dir)), COHORT_GENERATIONS_DIR);
  assert.equal(fs.existsSync(path.join(latest.dir, 'strength-review-shortlist.csv')), false);
  await verifyCohort({ dir: latest.dir, expectedDate: '2026-08-06', expectedGenerationId: 'gen-2' });

  const prior = path.join(distRoot, COHORT_GENERATIONS_DIR, 'gen-1');
  assert.equal(fs.existsSync(prior), true, 'the prior generation remains recoverable for rollback');
  await verifyCohort({ dir: prior, expectedDate: '2026-08-06', expectedGenerationId: 'gen-1' });
  assert.equal(fs.existsSync(path.join(distRoot, COHORT_INDEX)), true);
});

test('promotion refuses an empty bootstrap cohort before creating an index', async (t) => {
  const distRoot = tempRoot(t);
  const stageDir = await stageVolumeCohort(distRoot, 'empty-bootstrap', {
    rowCount: 0,
    sources: {},
  });
  await assert.rejects(
    promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId: 'empty-bootstrap',
      stageDir,
    }),
    /candidate cohort summary total_rows must be a positive integer/u,
  );
  assert.equal(fs.existsSync(stageDir), true);
  assert.equal(fs.existsSync(path.join(distRoot, COHORT_INDEX)), false);
  assert.equal(fs.existsSync(path.join(distRoot, COHORT_GENERATIONS_DIR)), false);
});

test('promotion refuses a bootstrap cohort with no prescribable medicines', async (t) => {
  const distRoot = tempRoot(t);
  const stageDir = await stageVolumeCohort(distRoot, 'empty-prescribable', {
    rowCount: 1,
    prescribableCount: 0,
    sources: { alpha: 1 },
  });
  await assert.rejects(
    promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId: 'empty-prescribable',
      stageDir,
    }),
    /candidate cohort manifest prescribable count must be a positive integer/u,
  );
  assert.equal(fs.existsSync(path.join(distRoot, COHORT_INDEX)), false);
  assert.equal(fs.existsSync(stageDir), true);
});

test('promotion preserves the prior pointer when candidate volume collapses', async (t) => {
  const distRoot = tempRoot(t);
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId: 'volume-prior',
    stageDir: await stageVolumeCohort(distRoot, 'volume-prior', {
      rowCount: 4,
      sources: { alpha: 2, beta: 2 },
    }),
  });
  const collapsed = await stageVolumeCohort(distRoot, 'volume-collapsed', {
    rowCount: 1,
    sources: { alpha: 1, beta: 1 },
  });
  await assert.rejects(
    promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId: 'volume-collapsed',
      stageDir: collapsed,
    }),
    /candidate cohort total_rows 1 is below prior cohort 4/u,
  );
  assert.equal((await resolvePublishedCohort({ distRoot })).generationId, 'volume-prior');
  assert.equal(fs.existsSync(collapsed), true);
  assert.equal(
    fs.existsSync(path.join(distRoot, COHORT_GENERATIONS_DIR, 'volume-collapsed')),
    false,
  );
});

test('promotion preserves the prior pointer when prescribable volume collapses', async (t) => {
  const distRoot = tempRoot(t);
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId: 'prescribable-prior',
    stageDir: await stageVolumeCohort(distRoot, 'prescribable-prior', {
      rowCount: 3,
      prescribableCount: 3,
      sources: { alpha: 3 },
    }),
  });
  const collapsed = await stageVolumeCohort(distRoot, 'prescribable-collapsed', {
    rowCount: 3,
    prescribableCount: 1,
    sources: { alpha: 3 },
  });
  await assert.rejects(
    promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId: 'prescribable-collapsed',
      stageDir: collapsed,
    }),
    /candidate cohort prescribable count 1 is below prior cohort 3/u,
  );
  assert.equal((await resolvePublishedCohort({ distRoot })).generationId, 'prescribable-prior');
  assert.equal(fs.existsSync(collapsed), true);
});

test('promotion refuses a dropped prior source and accepts monotonic growth', async (t) => {
  const distRoot = tempRoot(t);
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId: 'sources-prior',
    stageDir: await stageVolumeCohort(distRoot, 'sources-prior', {
      rowCount: 2,
      sources: { alpha: 1, beta: 1 },
    }),
  });
  const dropped = await stageVolumeCohort(distRoot, 'sources-dropped', {
    rowCount: 2,
    sources: { alpha: 2 },
  });
  await assert.rejects(
    promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId: 'sources-dropped',
      stageDir: dropped,
    }),
    /dropped previously positive source: beta/u,
  );
  assert.equal((await resolvePublishedCohort({ distRoot })).generationId, 'sources-prior');

  const growth = await stageVolumeCohort(distRoot, 'sources-growth', {
    rowCount: 3,
    sources: { alpha: 2, beta: 1, gamma: 1 },
  });
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId: 'sources-growth',
    stageDir: growth,
  });
  assert.equal((await resolvePublishedCohort({ distRoot })).generationId, 'sources-growth');
});

test('promotion rejects a hidden prior-source collapse even when total rows stay flat', async (t) => {
  const distRoot = tempRoot(t);
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId: 'source-count-prior',
    stageDir: await stageVolumeCohort(distRoot, 'source-count-prior', {
      rowCount: 100,
      sources: { alpha: 99, beta: 1 },
    }),
  });
  const collapsed = await stageVolumeCohort(distRoot, 'source-count-collapsed', {
    rowCount: 100,
    sources: { alpha: 1, beta: 99 },
  });
  await assert.rejects(
    promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId: 'source-count-collapsed',
      stageDir: collapsed,
    }),
    /candidate cohort source alpha count 1 is below prior cohort 99/u,
  );
  assert.equal((await resolvePublishedCohort({ distRoot })).generationId, 'source-count-prior');
  assert.equal(fs.existsSync(collapsed), true);
});

test('legacy latest without an index is never treated as bootstrap', async (t) => {
  const distRoot = tempRoot(t);
  const legacy = path.join(distRoot, 'latest');
  fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy, 'sentinel'), 'legacy');
  const stageDir = await stageVolumeCohort(distRoot, 'legacy-blocked', {
    rowCount: 1,
    sources: { alpha: 1 },
  });
  await assert.rejects(
    promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId: 'legacy-blocked',
      stageDir,
    }),
    /legacy dist\/latest exists without cohort-index\.json/u,
  );
  assert.equal(fs.readFileSync(path.join(legacy, 'sentinel'), 'utf8'), 'legacy');
  assert.equal(fs.existsSync(stageDir), true);
  assert.equal(fs.existsSync(path.join(distRoot, COHORT_INDEX)), false);
});

test('published resolver selectively verifies named artifacts and detects same-metadata tampering', async (t) => {
  const distRoot = tempRoot(t);
  const stageDir = await createGenerationStage({ distRoot, generationId: 'selective-1' });
  writeFixtureCohort(stageDir);
  await writeCohortManifest({
    dir: stageDir,
    date: '2026-08-06',
    generationId: 'selective-1',
    inputFingerprint: 'inputs-selective-1',
  });
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId: 'selective-1',
    stageDir,
  });

  const published = await resolvePublishedCohort({
    distRoot,
    verifyFiles: ['drugs.jsonl', 'summary.json'],
  });
  const drugs = path.join(published.dir, 'drugs.jsonl');
  const preservedTime = new Date('2026-08-06T01:02:03.000Z');
  fs.utimesSync(drugs, preservedTime, preservedTime);
  const before = fs.statSync(drugs);
  const original = fs.readFileSync(drugs, 'utf8');
  fs.writeFileSync(drugs, original.replace('{"id":1}', '{"id":9}'));
  fs.utimesSync(drugs, before.atime, before.mtime);
  const after = fs.statSync(drugs);
  assert.equal(after.size, before.size);
  assert.equal(after.mtimeMs, before.mtimeMs);

  await assert.rejects(
    resolvePublishedCohort({ distRoot, verifyFiles: ['drugs.jsonl'] }),
    /drugs\.jsonl hash mismatch/i,
  );
  await assert.doesNotReject(
    resolvePublishedCohort({ distRoot, verifyFiles: ['summary.json'] }),
  );
  await assert.rejects(
    resolvePublishedCohort({ distRoot, verifyFiles: true }),
    /drugs\.jsonl hash mismatch/i,
  );
});

test('published resolver bounds artifact names and verifies JSONL record counts', async (t) => {
  const distRoot = tempRoot(t);
  const generationId = 'selective-counts';
  const stageDir = await createGenerationStage({ distRoot, generationId });
  writeFixtureCohort(stageDir);
  await writeCohortManifest({
    dir: stageDir,
    date: '2026-08-06',
    generationId,
    inputFingerprint: 'inputs-selective-counts',
  });
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId,
    stageDir,
  });

  await assert.rejects(
    resolvePublishedCohort({ distRoot, verifyFiles: ['../outside.jsonl'] }),
    /unsupported cohort artifact/i,
  );
  await assert.rejects(
    resolvePublishedCohort({ distRoot, verifyFiles: ['drugs.jsonl', 'drugs.jsonl'] }),
    /duplicate cohort artifact/i,
  );

  const generationDir = path.join(distRoot, COHORT_GENERATIONS_DIR, generationId);
  const manifestFile = path.join(generationDir, 'cohort-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.files['drugs.jsonl'].record_count += 1;
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const manifestBytes = fs.readFileSync(manifestFile);
  const indexFile = path.join(distRoot, COHORT_INDEX);
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  index.generations[generationId].manifest_sha256 = crypto
    .createHash('sha256')
    .update(manifestBytes)
    .digest('hex');
  fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);

  await assert.rejects(
    resolvePublishedCohort({ distRoot, verifyFiles: ['drugs.jsonl'] }),
    /drugs\.jsonl record count mismatch/i,
  );
});

test('published resolver requires selected artifacts to be regular files with bound sizes', async (t) => {
  const distRoot = tempRoot(t);
  const generationId = 'selective-file-contract';
  const stageDir = await createGenerationStage({ distRoot, generationId });
  writeFixtureCohort(stageDir);
  await writeCohortManifest({
    dir: stageDir,
    date: '2026-08-06',
    generationId,
    inputFingerprint: 'inputs-selective-file-contract',
  });
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId,
    stageDir,
  });

  const generationDir = path.join(distRoot, COHORT_GENERATIONS_DIR, generationId);
  const summaryPath = path.join(generationDir, 'summary.json');
  const summaryContents = fs.readFileSync(summaryPath);
  fs.rmSync(summaryPath);
  fs.mkdirSync(summaryPath);
  await assert.rejects(
    resolvePublishedCohort({ distRoot, verifyFiles: ['summary.json'] }),
    /regular file.*summary\.json/i,
  );
  fs.rmSync(summaryPath, { recursive: true });
  fs.writeFileSync(summaryPath, summaryContents);

  const manifestFile = path.join(generationDir, 'cohort-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.files['summary.json'].size_bytes += 1;
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const indexFile = path.join(distRoot, COHORT_INDEX);
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  index.generations[generationId].manifest_sha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(manifestFile))
    .digest('hex');
  fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
  await assert.rejects(
    resolvePublishedCohort({ distRoot, verifyFiles: ['summary.json'] }),
    /summary\.json size mismatch/i,
  );
});

test('strict publication resolver rejects an unindexed legacy latest directory', async (t) => {
  const distRoot = tempRoot(t);
  fs.mkdirSync(path.join(distRoot, 'latest'));
  await assert.rejects(
    resolvePublishedCohort({ distRoot }),
    /legacy dist[\\/]latest exists without cohort-index\.json.*refusing non-atomic/i,
  );
});

test('an observer always resolves the old cohort until the atomic index swap, then the new cohort', async (t) => {
  const distRoot = tempRoot(t);
  const publish = async (generationId, beforePointerSwap) => {
    const stageDir = await createGenerationStage({ distRoot, generationId });
    writeFixtureCohort(stageDir);
    await writeCohortManifest({
      dir: stageDir,
      date: '2026-08-06',
      generationId,
      inputFingerprint: `inputs-${generationId}`,
    });
    return promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId,
      stageDir,
      beforePointerSwap,
    });
  };
  await publish('observer-old');

  let unblock;
  const blocked = new Promise((resolve) => { unblock = resolve; });
  let pointerReady;
  const ready = new Promise((resolve) => { pointerReady = resolve; });
  const promotion = publish('observer-new', async () => {
    pointerReady();
    await blocked;
  });
  await ready;
  const during = await resolvePublishedCohort({ distRoot });
  assert.equal(during.generationId, 'observer-old');
  assert.equal(fs.existsSync(path.join(during.dir, 'cohort-manifest.json')), true);

  unblock();
  await promotion;
  const after = await resolvePublishedCohort({ distRoot });
  assert.equal(after.generationId, 'observer-new');
  assert.equal(fs.existsSync(path.join(after.dir, 'cohort-manifest.json')), true);
});

test('a failed index swap leaves the prior pointer intact and the new generation recoverable', async (t) => {
  const distRoot = tempRoot(t);
  const stage = async (generationId) => {
    const stageDir = await createGenerationStage({ distRoot, generationId });
    writeFixtureCohort(stageDir);
    await writeCohortManifest({
      dir: stageDir,
      date: '2026-08-06',
      generationId,
      inputFingerprint: `inputs-${generationId}`,
    });
    return stageDir;
  };
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId: 'rollback-old',
    stageDir: await stage('rollback-old'),
  });

  await assert.rejects(
    promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId: 'rollback-new',
      stageDir: await stage('rollback-new'),
      beforePointerSwap: () => { throw new Error('injected pointer failure'); },
    }),
    /injected pointer failure/u,
  );
  assert.equal((await resolvePublishedCohort({ distRoot })).generationId, 'rollback-old');
  const recoverable = path.join(distRoot, COHORT_GENERATIONS_DIR, 'rollback-new');
  assert.equal(fs.existsSync(recoverable), true);
  await verifyCohort({
    dir: recoverable,
    expectedDate: '2026-08-06',
    expectedGenerationId: 'rollback-new',
  });
});

test('promotion revalidates a coherently mutated generation after rename', async (t) => {
  const distRoot = tempRoot(t);
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId: 'mutation-prior',
    stageDir: await stageVolumeCohort(distRoot, 'mutation-prior', {
      rowCount: 2,
      sources: { alpha: 1, beta: 1 },
    }),
  });
  const candidateId = 'mutation-candidate';
  await assert.rejects(
    promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId: candidateId,
      stageDir: await stageVolumeCohort(distRoot, candidateId, {
        rowCount: 3,
        sources: { alpha: 2, beta: 1 },
      }),
      beforePointerSwap: async () => {
        const generationDir = path.join(distRoot, COHORT_GENERATIONS_DIR, candidateId);
        writeVolumeFixtureCohort(generationDir, {
          rowCount: 1,
          sources: { alpha: 1 },
        });
        fs.rmSync(path.join(generationDir, 'cohort-manifest.json'));
        await writeCohortManifest({
          dir: generationDir,
          date: '2026-08-06',
          generationId: candidateId,
          inputFingerprint: 'mutated-after-rename',
        });
      },
    }),
    /candidate cohort total_rows 1 is below prior cohort 2/u,
  );
  assert.equal((await resolvePublishedCohort({ distRoot })).generationId, 'mutation-prior');
  assert.equal(
    fs.existsSync(path.join(distRoot, COHORT_GENERATIONS_DIR, candidateId)),
    true,
  );
});

test('promotion refuses an index mutation immediately before pointer swap', async (t) => {
  const distRoot = tempRoot(t);
  await promoteCohort({
    distRoot,
    date: '2026-08-06',
    generationId: 'index-race-prior',
    stageDir: await stageVolumeCohort(distRoot, 'index-race-prior', {
      rowCount: 2,
      sources: { alpha: 2 },
    }),
  });
  const candidateId = 'index-race-candidate';
  await assert.rejects(
    promoteCohort({
      distRoot,
      date: '2026-08-06',
      generationId: candidateId,
      stageDir: await stageVolumeCohort(distRoot, candidateId, {
        rowCount: 3,
        sources: { alpha: 3 },
      }),
      beforePointerSwap: () => {
        const indexFile = path.join(distRoot, COHORT_INDEX);
        const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
        index.updated_at = '2026-08-06T12:00:00.000Z';
        fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
      },
    }),
    /cohort index changed before the atomic pointer swap/u,
  );
  assert.equal((await resolvePublishedCohort({ distRoot })).generationId, 'index-race-prior');
  assert.equal(
    fs.existsSync(path.join(distRoot, COHORT_GENERATIONS_DIR, candidateId)),
    true,
  );
});

test('shared build lock excludes a second pipeline and releases cleanly', async (t) => {
  const distRoot = tempRoot(t);
  const release = await acquireBuildLock({ distRoot, generationId: 'gen-a' });
  await assert.rejects(
    acquireBuildLock({ distRoot, generationId: 'gen-b' }),
    /build lock is held/i,
  );
  await release();
  const releaseAgain = await acquireBuildLock({ distRoot, generationId: 'gen-c' });
  await releaseAgain();
});

test('shared build lock reclaims a dead local owner but never a live one', async (t) => {
  const distRoot = tempRoot(t);
  const lockDir = path.join(distRoot, '.build.lock');
  fs.mkdirSync(lockDir);
  fs.writeFileSync(path.join(lockDir, 'owner.json'), `${JSON.stringify({
    generation_id: 'dead',
    pid: 999_999_999,
    hostname: os.hostname(),
    token: 'dead-token',
  })}\n`);
  const release = await acquireBuildLock({ distRoot, generationId: 'replacement' });
  const owner = JSON.parse(fs.readFileSync(path.join(lockDir, 'owner.json'), 'utf8'));
  assert.equal(owner.generation_id, 'replacement');
  assert.equal(owner.pid, process.pid);
  await release();
});

test('input fingerprint and freshness gate rebuild only for changed or stale sources', async (t) => {
  const root = tempRoot(t);
  fs.mkdirSync(path.join(root, 'onemg', '2026-08-06'), { recursive: true });
  fs.writeFileSync(path.join(root, 'onemg', '2026-08-06', 'normalized.jsonl'), '{"id":1}\n');
  const first = await computeInputFingerprint([root]);
  const state = { date: '2026-08-06', input_fingerprint: first, completed_at: '2026-08-06T00:00:00.000Z' };
  assert.equal(shouldBuildCohort({ state, inputFingerprint: first, now: new Date('2026-08-06T00:30:00Z'), maxAgeMs: 3_600_000 }), false);
  assert.equal(shouldBuildCohort({ state, inputFingerprint: first, now: new Date('2026-08-06T02:00:00Z'), maxAgeMs: 3_600_000 }), true);
  assert.equal(shouldBuildCohort({ state: { ...state, date: '2026-08-05' }, inputFingerprint: first, now: new Date('2026-08-06T00:30:00Z'), maxAgeMs: 3_600_000 }), false);
  assert.equal(shouldBuildCohort({ state, inputFingerprint: first, now: new Date('2026-08-05T23:59:00Z'), maxAgeMs: 3_600_000 }), true);

  fs.appendFileSync(path.join(root, 'onemg', '2026-08-06', 'normalized.jsonl'), '{"id":2}\n');
  const changed = await computeInputFingerprint([root]);
  assert.notEqual(changed, first);
  assert.equal(shouldBuildCohort({ state, inputFingerprint: changed, now: new Date('2026-08-06T00:30:00Z'), maxAgeMs: 3_600_000 }), true);
});

test('input fingerprint detects a same-size mutation with the original modification time', async (t) => {
  const root = tempRoot(t);
  const input = path.join(root, 'input.bin');
  const timestamp = new Date('2026-08-06T00:00:00.000Z');
  fs.writeFileSync(input, 'AAAA');
  fs.utimesSync(input, timestamp, timestamp);
  const firstStat = fs.statSync(input);
  const first = await computeInputFingerprint([root]);

  fs.writeFileSync(input, 'BBBB');
  fs.utimesSync(input, timestamp, timestamp);
  const secondStat = fs.statSync(input);
  assert.equal(secondStat.size, firstStat.size);
  assert.equal(secondStat.mtimeMs, firstStat.mtimeMs);

  const changed = await computeInputFingerprint([root]);
  assert.notEqual(changed, first);
});

test('build input fingerprint rejects an allowlisted symlink before freshness or drift checks', async (t) => {
  const projectRoot = tempRoot(t);
  const rawRoot = path.join(projectRoot, 'raw');
  const inputDir = path.join(rawRoot, 'onemg', '2026-08-06');
  const target = path.join(projectRoot, 'outside-normalized.jsonl');
  const input = path.join(inputDir, 'normalized.jsonl');
  fs.mkdirSync(inputDir, { recursive: true });
  fs.writeFileSync(target, '{"id":1}\n');
  try {
    fs.symlinkSync(target, input, 'file');
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('Windows did not permit creating the symlink fixture');
      return;
    }
    throw error;
  }

  await assert.rejects(
    buildInputFingerprint({ rawRoot, projectRoot }),
    /input fingerprint candidate must not be a symbolic link.*normalized\.jsonl/i,
  );
  fs.writeFileSync(target, '{"id":9}\n');
  await assert.rejects(
    buildInputFingerprint({ rawRoot, projectRoot }),
    /input fingerprint candidate must not be a symbolic link.*normalized\.jsonl/i,
  );
});

test('build input fingerprint binds source PDFs and operator-supplied sibling text', async (t) => {
  const projectRoot = tempRoot(t);
  const rawRoot = path.join(projectRoot, 'raw');
  const fixtures = [
    ['cdsco-fdc', 'fdc.PDF', 'fdc.txt'],
    ['nppa', 'prices.pdf', 'prices.txt'],
  ];
  for (const [source, pdfName, textName] of fixtures) {
    const sourceRoot = path.join(rawRoot, source);
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, pdfName), `${source} pdf`);
    fs.writeFileSync(path.join(sourceRoot, textName), `${source} operator text`);
  }
  for (const [source, pdfName, textName] of fixtures) {
    const sourceRoot = path.join(rawRoot, source);
    const textFile = path.join(sourceRoot, textName);
    const pdfFile = path.join(sourceRoot, pdfName);
    const beforeText = await buildInputFingerprint({ rawRoot, projectRoot });
    fs.appendFileSync(textFile, ' changed');
    const afterText = await buildInputFingerprint({ rawRoot, projectRoot });
    assert.notEqual(afterText, beforeText, `${source} operator text must affect the fingerprint`);
    fs.writeFileSync(textFile, `${source} operator text`);

    const beforePdf = await buildInputFingerprint({ rawRoot, projectRoot });
    fs.appendFileSync(pdfFile, ' changed');
    const afterPdf = await buildInputFingerprint({ rawRoot, projectRoot });
    assert.notEqual(afterPdf, beforePdf, `${source} PDF must remain fingerprinted`);
    fs.writeFileSync(pdfFile, `${source} pdf`);
  }
});

test('input fingerprint prunes excluded cache and restricted directories before descent', async (t) => {
  const root = tempRoot(t);
  const pages = path.join(root, 'pages');
  const restricted = path.join(root, 'restricted');
  const included = path.join(root, 'inputs', 'normalized.jsonl');
  fs.mkdirSync(pages, { recursive: true });
  fs.mkdirSync(restricted, { recursive: true });
  fs.mkdirSync(path.dirname(included), { recursive: true });
  fs.writeFileSync(path.join(pages, 'active-cache.html'), '<html>first</html>');
  fs.writeFileSync(path.join(restricted, 'private.json'), '{"private":true}\n');
  fs.writeFileSync(included, '{"id":1}\n');

  const visited = [];
  const include = (target) => {
    const relative = path.relative(root, target);
    visited.push(relative);
    if (relative === 'pages') {
      fs.writeFileSync(path.join(pages, 'active-cache.html'), '<html>changed during scan</html>');
    }
    return path.basename(target) === 'normalized.jsonl';
  };
  const first = await computeInputFingerprint([root], { include });
  fs.writeFileSync(path.join(pages, 'active-cache.html'), '<html>changed again</html>');
  fs.writeFileSync(path.join(restricted, 'private.json'), '{"private":false}\n');
  const second = await computeInputFingerprint([root], { include });

  assert.equal(second, first);
  assert.ok(visited.includes('pages'));
  assert.ok(visited.includes('restricted'));
  assert.ok(visited.includes(path.join('inputs', 'normalized.jsonl')));
  assert.equal(visited.some((entry) => entry.startsWith(`pages${path.sep}`)), false);
  assert.equal(visited.some((entry) => entry.startsWith(`restricted${path.sep}`)), false);
});

test('input fingerprint ignores files that disappear during an included-file hash race', async (t) => {
  const root = tempRoot(t);
  const input = path.join(root, 'input.txt');
  fs.writeFileSync(input, 'volatile input');

  const raced = await computeInputFingerprint([root], {
    include: (target) => {
      fs.rmSync(target);
      return true;
    },
  });
  const absent = await computeInputFingerprint([root]);

  assert.equal(raced, absent);
});

test('input fingerprint does not encode an ENOENT marker for a missing input path', async (t) => {
  const root = tempRoot(t);
  const missing = path.join(root, 'missing');
  const empty = path.join(root, 'empty');
  fs.mkdirSync(empty);

  assert.equal(
    await computeInputFingerprint([missing]),
    await computeInputFingerprint([empty]),
  );
});

test('input fingerprint is independent of directory insertion order', async (t) => {
  const firstRoot = tempRoot(t);
  const secondRoot = tempRoot(t);
  const timestamp = new Date('2026-08-06T00:00:00.000Z');
  for (const name of ['z.txt', 'a.txt', 'm.txt']) {
    const file = path.join(firstRoot, name);
    fs.writeFileSync(file, name);
    fs.utimesSync(file, timestamp, timestamp);
  }
  for (const name of ['m.txt', 'a.txt', 'z.txt']) {
    const file = path.join(secondRoot, name);
    fs.writeFileSync(file, name);
    fs.utimesSync(file, timestamp, timestamp);
  }

  assert.equal(
    await computeInputFingerprint([firstRoot]),
    await computeInputFingerprint([secondRoot]),
  );
});

test('published-cohort skip eligibility rejects same-size artifact tampering', async (t) => {
  const root = tempRoot(t);
  writeFixtureCohort(root);
  await writeCohortManifest({
    dir: root,
    date: '2026-08-06',
    generationId: 'gen-integrity',
    inputFingerprint: 'inputs-integrity',
  });
  const state = { generation_id: 'gen-integrity', date: '2026-08-06' };
  assert.equal(await hasPublishedCohort({ dir: root, state }), true);

  const drugs = path.join(root, 'drugs.jsonl');
  const original = fs.readFileSync(drugs, 'utf8');
  fs.writeFileSync(drugs, original.replace('{"id":1}', '{"id":9}'));
  assert.equal(fs.statSync(drugs).size, Buffer.byteLength(original));
  assert.equal(await hasPublishedCohort({ dir: root, state }), false);
});

test('build-cohort CLI fails closed on empty first-build inputs and removes its stage', async (t) => {
  const root = tempRoot(t);
  const rawRoot = path.join(root, 'raw');
  const distRoot = path.join(root, 'dist');
  const buildLock = path.join(root, 'state', 'build.lock');
  fs.mkdirSync(rawRoot);
  let failure;
  try {
    await execFileAsync(process.execPath, ['src/cli/build-cohort.mjs', '--reason', 'empty-test'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AUSHADHI_RAW_ROOT: rawRoot,
        AUSHADHI_DIST_ROOT: distRoot,
        AUSHADHI_BUILD_LOCK: buildLock,
      },
      windowsHide: true,
    });
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, 'empty raw inputs must not publish a cohort');
  assert.match(failure.stderr, /candidate cohort summary total_rows must be a positive integer/u);
  assert.equal(fs.existsSync(path.join(distRoot, COHORT_INDEX)), false);
  assert.equal(fs.existsSync(path.join(distRoot, COHORT_GENERATIONS_DIR)), false);
  assert.deepEqual(fs.readdirSync(path.join(distRoot, '.staging')), []);
  const receipts = fs.readdirSync(path.join(distRoot, '.receipts'));
  assert.equal(receipts.length, 1);
  const receipt = JSON.parse(fs.readFileSync(path.join(distRoot, '.receipts', receipts[0]), 'utf8'));
  assert.equal(receipt.stage_removed, true);
  assert.equal(fs.existsSync(buildLock), false);
});

test('post-commit state-cache failure returns success and reconciles future freshness from the index', async (t) => {
  const root = tempRoot(t);
  const rawRoot = path.join(root, 'raw');
  const distRoot = path.join(root, 'dist');
  const buildLock = path.join(root, 'state', 'build.lock');
  fs.mkdirSync(rawRoot);
  writeRawOnemgRows(rawRoot, 1);
  fs.mkdirSync(path.join(distRoot, '.build-state.json'), { recursive: true });
  const env = {
    ...process.env,
    AUSHADHI_RAW_ROOT: rawRoot,
    AUSHADHI_DIST_ROOT: distRoot,
    AUSHADHI_BUILD_LOCK: buildLock,
  };

  const first = await execFileAsync(
    process.execPath,
    ['src/cli/build-cohort.mjs', '--reason', 'state-cache-obstructed'],
    { cwd: process.cwd(), env, windowsHide: true },
  );
  assert.match(first.stdout, /publication committed but state cache write failed/u);
  assert.match(first.stdout, /build-cohort done:/u);
  const published = await resolvePublishedCohort({ distRoot, verifyFiles: true });
  const receipts = fs.readdirSync(path.join(distRoot, '.receipts'));
  assert.equal(receipts.some((name) => name.startsWith('build-error-')), false);
  const warningName = receipts.find(
    (name) => name.startsWith('build-post-commit-state-cache-write-'),
  );
  assert.ok(warningName);
  const warning = JSON.parse(
    fs.readFileSync(path.join(distRoot, '.receipts', warningName), 'utf8'),
  );
  assert.equal(warning.publication_committed, true);
  assert.equal(warning.generation_id, published.generationId);
  assert.equal(warning.authoritative_state.generation_id, published.generationId);
  assert.deepEqual(
    fs.readdirSync(distRoot).filter((name) => name.startsWith('.build-state.json.tmp-')),
    [],
  );

  const second = await execFileAsync(process.execPath, [
    'src/cli/build-cohort.mjs',
    '--if-needed',
    '--max-age-seconds',
    '3600',
    '--reason',
    'state-cache-reconciled',
  ], { cwd: process.cwd(), env, windowsHide: true });
  assert.match(second.stdout, /build-cohort SKIP:/u);
  assert.equal((await resolvePublishedCohort({ distRoot })).generationId, published.generationId);
  assert.equal(fs.existsSync(buildLock), false);
});

test('build-cohort CLI publishes one complete cohort and skips an unchanged fresh rebuild', async (t) => {
  const root = tempRoot(t);
  const rawRoot = path.join(root, 'raw');
  const distRoot = path.join(root, 'dist');
  fs.mkdirSync(rawRoot);
  writeRawOnemgRows(rawRoot, 1);
  const env = {
    ...process.env,
    AUSHADHI_RAW_ROOT: rawRoot,
    AUSHADHI_DIST_ROOT: distRoot,
    AUSHADHI_BUILD_LOCK: path.join(root, 'state', 'build.lock'),
  };
  const first = await execFileAsync(process.execPath, ['src/cli/build-cohort.mjs', '--reason', 'test'], {
    cwd: process.cwd(),
    env,
    windowsHide: true,
  });
  assert.match(first.stdout, /build-cohort done:/);
  const firstPublished = await resolvePublishedCohort({ distRoot });
  const latestManifest = JSON.parse(fs.readFileSync(path.join(firstPublished.dir, 'cohort-manifest.json'), 'utf8'));
  assert.ok(fs.existsSync(path.join(firstPublished.dir, 'prescribable.jsonl')));
  assert.ok(fs.existsSync(path.join(firstPublished.dir, 'REPORT.md')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(distRoot, '.build-state.json'), 'utf8')).generation_id, latestManifest.generation_id);

  const second = await execFileAsync(process.execPath, [
    'src/cli/build-cohort.mjs', '--if-needed', '--max-age-seconds', '3600', '--reason', 'test',
  ], { cwd: process.cwd(), env, windowsHide: true });
  assert.match(second.stdout, /build-cohort SKIP:/);
  assert.equal((await resolvePublishedCohort({ distRoot })).generationId, latestManifest.generation_id);

  const third = await execFileAsync(process.execPath, ['src/cli/build-cohort.mjs', '--reason', 'test'], {
    cwd: process.cwd(),
    env,
    windowsHide: true,
  });
  assert.match(third.stdout, /build-cohort done:/);
  const replacement = JSON.parse(fs.readFileSync(path.join((await resolvePublishedCohort({ distRoot })).dir, 'cohort-manifest.json'), 'utf8'));
  assert.notEqual(replacement.generation_id, latestManifest.generation_id);
  assert.equal(JSON.parse(fs.readFileSync(path.join(distRoot, '.build-state.json'), 'utf8')).generation_id, replacement.generation_id);
});

test('build-cohort removes only its exact stage after child failure and preserves the error receipt', async (t) => {
  const root = tempRoot(t);
  const rawRoot = path.join(root, 'raw');
  const distRoot = path.join(root, 'dist');
  const stagingRoot = path.join(distRoot, '.staging');
  const unrelated = path.join(stagingRoot, 'unrelated');
  fs.mkdirSync(unrelated, { recursive: true });
  fs.writeFileSync(path.join(unrelated, 'sentinel'), 'preserve');
  fs.mkdirSync(rawRoot, { recursive: true });
  fs.writeFileSync(path.join(rawRoot, 'onemg'), 'not a directory');
  const buildLock = path.join(root, 'state', 'build.lock');
  let failure;
  try {
    await execFileAsync(process.execPath, ['src/cli/build-cohort.mjs', '--reason', 'test-failure'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AUSHADHI_RAW_ROOT: rawRoot,
        AUSHADHI_DIST_ROOT: distRoot,
        AUSHADHI_BUILD_LOCK: buildLock,
      },
      windowsHide: true,
    });
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, 'the deliberately malformed raw source must fail the child build');
  assert.match(failure.stderr, /src[\\/]cli[\\/]build\.mjs failed/u);
  assert.deepEqual(fs.readdirSync(stagingRoot), ['unrelated']);
  assert.equal(fs.readFileSync(path.join(unrelated, 'sentinel'), 'utf8'), 'preserve');
  const receipts = fs.readdirSync(path.join(distRoot, '.receipts'))
    .filter((name) => /^build-error-.*\.json$/u.test(name));
  assert.equal(receipts.length, 1);
  const receipt = JSON.parse(
    fs.readFileSync(path.join(distRoot, '.receipts', receipts[0]), 'utf8'),
  );
  assert.equal(receipt.stage_removed, true);
  assert.equal('stage_cleanup_error' in receipt, false);
  assert.equal(fs.existsSync(receipt.stage_dir), false);
  assert.equal(fs.existsSync(buildLock), false);
});
