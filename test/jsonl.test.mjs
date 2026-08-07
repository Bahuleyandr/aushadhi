import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readJsonl, readJsonlSync } from '../src/lib/jsonl.mjs';

// Direct unit tests pinning the EXISTING behavior of the JSONL helpers:
// missing files read as empty, blank lines are ignored, and corrupt lines
// are skipped rather than aborting the stream.

async function withTempDir(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-jsonl-'));
  try {
    return await run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function collect(iterable) {
  const out = [];
  for await (const item of iterable) out.push(item);
  return out;
}

test('readJsonlSync returns [] for a missing file', () => {
  assert.deepEqual(readJsonlSync('/nonexistent/aushadhi-jsonl-fixture.jsonl'), []);
});

test('readJsonl yields nothing for a missing file', async () => {
  assert.deepEqual(await collect(readJsonl('/nonexistent/aushadhi-jsonl-fixture.jsonl')), []);
});

test('readJsonlSync parses one object per line and preserves order', async () => {
  await withTempDir((dir) => {
    const file = path.join(dir, 'rows.jsonl');
    fs.writeFileSync(file, '{"id":1}\n{"id":2,"name":"two"}\n{"id":3}\n');
    assert.deepEqual(readJsonlSync(file), [{ id: 1 }, { id: 2, name: 'two' }, { id: 3 }]);
  });
});

test('readJsonlSync skips blank, whitespace-only, and corrupt lines', async () => {
  await withTempDir((dir) => {
    const file = path.join(dir, 'mixed.jsonl');
    fs.writeFileSync(file, [
      '{"id":1}',
      '',
      '   ',
      'not json at all',
      '{"id":2,truncated',
      '{"id":3}',
      '',
    ].join('\n'));
    assert.deepEqual(readJsonlSync(file), [{ id: 1 }, { id: 3 }]);
  });
});

test('readJsonl streams the same tolerant parse, including CRLF line endings', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'crlf.jsonl');
    fs.writeFileSync(file, '{"id":1}\r\n\r\nbroken{\r\n{"id":2}\r\n');
    assert.deepEqual(await collect(readJsonl(file)), [{ id: 1 }, { id: 2 }]);
  });
});

test('readJsonl and readJsonlSync agree on the same file', async () => {
  await withTempDir(async (dir) => {
    const file = path.join(dir, 'agree.jsonl');
    const rows = Array.from({ length: 50 }, (_, index) => ({ index, value: `row-${index}` }));
    fs.writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
    const streamed = await collect(readJsonl(file));
    assert.deepEqual(streamed, rows);
    assert.deepEqual(readJsonlSync(file), streamed);
  });
});

test('scalar JSON lines are parsed as scalars, not wrapped', async () => {
  await withTempDir((dir) => {
    const file = path.join(dir, 'scalars.jsonl');
    fs.writeFileSync(file, '1\n"text"\ntrue\nnull\n');
    assert.deepEqual(readJsonlSync(file), [1, 'text', true, null]);
  });
});
