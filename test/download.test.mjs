import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { downloadToFile } from '../src/lib/download.mjs';

// Direct unit tests pinning the EXISTING behavior of downloadToFile: write to
// <dest>.part, rename only on success, and never leave a truncated .part
// behind to be mistaken for a valid snapshot. The module uses the global
// fetch, so each test swaps it and restores it in finally.

async function withPatchedFetch(fetchImpl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-download-'));
  try {
    return await run(dir);
  } finally {
    globalThis.fetch = original;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('downloadToFile writes the body atomically and returns the destination', async () => {
  const requests = [];
  await withPatchedFetch(async (url, options) => {
    requests.push({ url, options });
    return new Response('payload-bytes', { status: 200 });
  }, async (dir) => {
    const dest = path.join(dir, 'nested', 'snapshot.pdf');
    const result = await downloadToFile('https://example.test/doc.pdf', dest, {
      headers: { accept: 'application/pdf' },
    });
    assert.equal(result, dest);
    assert.equal(fs.readFileSync(dest, 'utf8'), 'payload-bytes');
    assert.equal(fs.existsSync(`${dest}.part`), false);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://example.test/doc.pdf');
    assert.deepEqual(requests[0].options, { headers: { accept: 'application/pdf' } });
  });
});

test('downloadToFile fails closed on a non-OK response without touching disk', async () => {
  await withPatchedFetch(async () => new Response('missing', { status: 404 }), async (dir) => {
    const dest = path.join(dir, 'snapshot.pdf');
    await assert.rejects(
      downloadToFile('https://example.test/doc.pdf', dest),
      /download failed \(404\): https:\/\/example\.test\/doc\.pdf/,
    );
    assert.equal(fs.existsSync(dest), false);
    assert.equal(fs.existsSync(`${dest}.part`), false);
  });
});

test('downloadToFile removes the .part file when the body stream fails mid-transfer', async () => {
  const makeFailingBody = () => new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('partial-'));
    },
    pull(controller) {
      controller.error(new Error('connection reset mid-body'));
    },
  });
  await withPatchedFetch(async () => new Response(makeFailingBody(), { status: 200 }), async (dir) => {
    const dest = path.join(dir, 'snapshot.pdf');
    await assert.rejects(
      downloadToFile('https://example.test/doc.pdf', dest),
      /connection reset mid-body/,
    );
    assert.equal(fs.existsSync(dest), false, 'destination must not exist after a failed stream');
    assert.equal(fs.existsSync(`${dest}.part`), false, 'no truncated .part may remain');
  });
});
