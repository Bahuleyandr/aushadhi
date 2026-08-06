import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolvePdfText } from '../src/lib/derived-pdf-text.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'derived-pdf-text-'));
  const rawRoot = path.join(root, 'raw');
  const derivedRoot = path.join(root, 'derived');
  fs.mkdirSync(rawRoot, { recursive: true });
  return { root, rawRoot, derivedRoot };
}

async function convert(_source, target) {
  fs.writeFileSync(target, 'extracted text\n');
  return { file: target, mode: 'layout' };
}

test('rejects an operator extraction before reading it when the PDF is outside rawRoot', async () => {
  const { root, rawRoot, derivedRoot } = fixture();
  const outsidePdf = path.join(root, 'outside.pdf');
  fs.writeFileSync(outsidePdf, 'pdf');
  fs.writeFileSync(path.join(root, 'outside.txt'), 'operator extraction');

  await assert.rejects(
    resolvePdfText({
      pdf: outsidePdf,
      rawRoot,
      derivedRoot,
      source: 'nppa',
      convert,
    }),
    /outside the raw source root/u,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('rejects a non-file operator extraction', async () => {
  const { root, rawRoot, derivedRoot } = fixture();
  const pdf = path.join(rawRoot, 'source.pdf');
  fs.writeFileSync(pdf, 'pdf');
  fs.mkdirSync(path.join(rawRoot, 'source.txt'));

  await assert.rejects(
    resolvePdfText({
      pdf,
      rawRoot,
      derivedRoot,
      source: 'nppa',
      convert,
    }),
    /operator-supplied PDF text is not a regular file/u,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('rejects a non-file derived-cache entry', async () => {
  const { root, rawRoot, derivedRoot } = fixture();
  const pdf = path.join(rawRoot, 'source.pdf');
  fs.writeFileSync(pdf, 'pdf');

  const first = await resolvePdfText({
    pdf,
    rawRoot,
    derivedRoot,
    source: 'nppa',
    convert,
  });
  fs.rmSync(first.file);
  fs.mkdirSync(first.file);

  await assert.rejects(
    resolvePdfText({
      pdf,
      rawRoot,
      derivedRoot,
      source: 'nppa',
      convert,
    }),
    /derived PDF text is not a regular file/u,
  );
  fs.rmSync(root, { recursive: true, force: true });
});
