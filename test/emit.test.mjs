import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { emitArtifact } from '../src/lib/emit.mjs';

test('emitArtifact writes all core files without publishing latest', async () => {
  const dir = 'test/.tmp-dist';
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(`${dir}/2026-07-07`, { recursive: true });
  fs.writeFileSync(`${dir}/2026-07-07/prescribable.jsonl`, '{"stale":true}\n');
  fs.writeFileSync(`${dir}/2026-07-07/REPORT.md`, 'stale\n');
  const rows = [{
    brand_name: 'A 500 Tablet', manufacturer: 'M', pack_label: 'strip of 10', form_raw: null,
    price_inr: 10, is_discontinued: false,
    ingredients: [{ molecule: 'azithromycin', strength_value: 500, strength_unit: 'mg', strength_raw: '500mg' }],
    composition_raw: 'Azithromycin (500mg)', composition_status: 'complete',
    substitutes_raw: [{ name: 'B 500 Tablet', manufacturer: 'N' }], type: 'allopathy',
    sources: [{ source: 'github-jr', source_id: '1', seen_at: '2026-07-07' }],
    first_seen: '2026-07-07', last_seen: '2026-07-07',
  }];
  const res = await emitArtifact({
    distRoot: dir, date: '2026-07-07', outputDir: `${dir}/2026-07-07`, rows, conflicts: [], errors: [],
    meta: { sources: { 'github-jr': 1 } },
  });
  assert.ok(res.dir.includes('2026-07-07'));
  for (const f of ['drugs.csv', 'drugs.jsonl', 'compositions.csv', 'substitute_edges.csv', 'conflicts.csv', 'errors.csv', 'summary.json', 'ATTRIBUTION.md']) {
    assert.ok(fs.existsSync(`${dir}/2026-07-07/${f}`), f);
  }
  assert.equal(fs.existsSync(`${dir}/latest`), false);
  assert.equal(fs.existsSync(`${dir}/2026-07-07/prescribable.jsonl`), false);
  assert.equal(fs.existsSync(`${dir}/2026-07-07/REPORT.md`), false);
  const summary = JSON.parse(fs.readFileSync(`${dir}/2026-07-07/summary.json`, 'utf8'));
  assert.equal(summary.total_rows, 1);
  assert.equal(summary.composition_status.complete, 1);
  assert.equal(summary.unique_compositions, 1);
  const edges = fs.readFileSync(`${dir}/2026-07-07/substitute_edges.csv`, 'utf8');
  assert.match(edges, /B 500 Tablet/);
  assert.match(edges, /seen_at/); // provenance columns present
  assert.ok(fs.existsSync(`${dir}/2026-07-07/conflicts.jsonl`)); // machine-readable twin
  fs.rmSync(dir, { recursive: true, force: true });
});

test('emitArtifact writes a clean pipeline stage without publishing partial latest', async () => {
  const distRoot = 'test/.tmp-dist-stage';
  const stageDir = `${distRoot}/.staging/gen-1`;
  fs.rmSync(distRoot, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(`${stageDir}/strength-review-shortlist.csv`, 'stale\n');
  const rows = [{
    brand_name: 'A', manufacturer: 'M', pack_label: '', ingredients: [],
    composition_status: 'empty', substitutes_raw: [], sources: [],
    first_seen: '2026-08-06', last_seen: '2026-08-06',
  }];
  await emitArtifact({
    distRoot, date: '2026-08-06', outputDir: stageDir,
    rows, conflicts: [], errors: [], meta: { sources: {} },
  });
  assert.ok(fs.existsSync(`${stageDir}/drugs.jsonl`));
  assert.equal(fs.existsSync(`${stageDir}/strength-review-shortlist.csv`), false);
  assert.equal(fs.existsSync(`${distRoot}/latest`), false);
  fs.rmSync(distRoot, { recursive: true, force: true });
});

test('emitArtifact refuses to mutate a manifest-bound published cohort', async (t) => {
  const distRoot = 'test/.tmp-dist-published';
  const published = `${distRoot}/2026-08-06`;
  t.after(() => fs.rmSync(distRoot, { recursive: true, force: true }));
  fs.mkdirSync(published, { recursive: true });
  fs.writeFileSync(`${published}/cohort-manifest.json`, '{"schema_version":1}\n');
  await assert.rejects(
    emitArtifact({
      distRoot,
      date: '2026-08-06',
      outputDir: published,
      rows: [],
      conflicts: [],
      errors: [],
      meta: { sources: {} },
    }),
    /manifest-bound cohort.*immutable/i,
  );
  assert.equal(fs.readFileSync(`${published}/cohort-manifest.json`, 'utf8'), '{"schema_version":1}\n');
});

test('emitArtifact refuses an implicit dist/date mutable destination', async () => {
  await assert.rejects(
    emitArtifact({
      distRoot: 'test/.tmp-dist-implicit',
      date: '2026-08-06',
      rows: [],
      conflicts: [],
      errors: [],
      meta: { sources: {} },
    }),
    /AUSHADHI_COHORT_DIR.*required/i,
  );
});
