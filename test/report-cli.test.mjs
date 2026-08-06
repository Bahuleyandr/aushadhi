import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/cli/report.mjs';

test('report CLI reads and writes the selected staged cohort', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-report-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'summary.json'), `${JSON.stringify({
    date: '2026-08-06',
    total_rows: 2,
    sources: { test: 2 },
    conflicts: 2,
  })}\n`);
  fs.writeFileSync(path.join(dir, 'conflicts.jsonl'), '{"kind":"strength"}\n{"kind":"strength"}\n');
  const logs = [];

  const markdown = await main((line) => logs.push(line), { outputDir: dir });

  assert.equal(fs.readFileSync(path.join(dir, 'REPORT.md'), 'utf8'), `${markdown}\n`);
  assert.equal(logs.length, 1);
  assert.match(markdown, /strength/);
  assert.match(markdown, /\b2\b/);
});

test('report CLI reads the bound report without rewriting a published cohort', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-report-published-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'cohort-manifest.json'), '{"schema_version":1}\n');
  fs.writeFileSync(path.join(dir, 'REPORT.md'), '# Bound report\n');
  const before = fs.statSync(path.join(dir, 'REPORT.md')).mtimeMs;
  const logs = [];
  const markdown = await main((line) => logs.push(line), { outputDir: dir });
  assert.equal(markdown, '# Bound report');
  assert.deepEqual(logs, ['# Bound report']);
  assert.equal(fs.statSync(path.join(dir, 'REPORT.md')).mtimeMs, before);
});
