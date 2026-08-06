import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeGithubJr } from '../src/adapters/github-jr.mjs';
import { mergeRows } from '../src/lib/merge.mjs';
import { emitArtifact } from '../src/lib/emit.mjs';

test('fixture mini-pipeline: normalize -> merge -> emit', async () => {
  const dir = 'test/.tmp-dist-pipeline';
  fs.rmSync(dir, { recursive: true, force: true });
  const all = [];
  for await (const r of normalizeGithubJr('test/fixtures/github-jr/sample.csv', '2026-07-07')) all.push(r);
  const { rows, conflicts } = mergeRows(all);
  await emitArtifact({
    distRoot: dir,
    date: '2026-07-07',
    outputDir: `${dir}/2026-07-07`,
    rows,
    conflicts,
    errors: [],
    meta: { sources: { 'github-jr': all.length } },
  });
  const summary = JSON.parse(fs.readFileSync(`${dir}/2026-07-07/summary.json`, 'utf8'));
  assert.equal(summary.total_rows, 3);
  assert.equal(summary.unique_compositions, 2);
  const comps = fs.readFileSync(`${dir}/2026-07-07/compositions.csv`, 'utf8').trim().split('\n');
  assert.equal(comps.length, 3); // header + 2 compositions
  fs.rmSync(dir, { recursive: true, force: true });
});
