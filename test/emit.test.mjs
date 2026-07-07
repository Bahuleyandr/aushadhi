import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { emitArtifact } from '../src/lib/emit.mjs';

test('emitArtifact writes all files + latest copy', async () => {
  const dir = 'test/.tmp-dist';
  fs.rmSync(dir, { recursive: true, force: true });
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
    distRoot: dir, date: '2026-07-07', rows, conflicts: [], errors: [],
    meta: { sources: { 'github-jr': 1 } },
  });
  assert.ok(res.dir.includes('2026-07-07'));
  for (const f of ['drugs.csv', 'drugs.jsonl', 'compositions.csv', 'substitute_edges.csv', 'conflicts.csv', 'errors.csv', 'summary.json', 'ATTRIBUTION.md']) {
    assert.ok(fs.existsSync(`${dir}/2026-07-07/${f}`), f);
  }
  assert.ok(fs.existsSync(`${dir}/latest/drugs.jsonl`));
  const summary = JSON.parse(fs.readFileSync(`${dir}/2026-07-07/summary.json`, 'utf8'));
  assert.equal(summary.total_rows, 1);
  assert.equal(summary.composition_status.complete, 1);
  assert.equal(summary.unique_compositions, 1);
  const edges = fs.readFileSync(`${dir}/2026-07-07/substitute_edges.csv`, 'utf8');
  assert.match(edges, /B 500 Tablet/);
  fs.rmSync(dir, { recursive: true, force: true });
});
