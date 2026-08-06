import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ctx } from '../src/lib/context.mjs';

test('context defaults remain repository-relative for local development', () => {
  const beforeRaw = process.env.AUSHADHI_RAW_ROOT;
  const beforeDist = process.env.AUSHADHI_DIST_ROOT;
  delete process.env.AUSHADHI_RAW_ROOT;
  delete process.env.AUSHADHI_DIST_ROOT;
  try {
    const context = ctx();
    assert.equal(context.rawRoot, 'data/raw');
    assert.equal(context.distRoot, 'dist');
  } finally {
    if (beforeRaw === undefined) delete process.env.AUSHADHI_RAW_ROOT;
    else process.env.AUSHADHI_RAW_ROOT = beforeRaw;
    if (beforeDist === undefined) delete process.env.AUSHADHI_DIST_ROOT;
    else process.env.AUSHADHI_DIST_ROOT = beforeDist;
  }
});

test('context redirects every mutable runtime root away from read-only code', () => {
  const beforeRaw = process.env.AUSHADHI_RAW_ROOT;
  const beforeDist = process.env.AUSHADHI_DIST_ROOT;
  process.env.AUSHADHI_RAW_ROOT = '/var/lib/aushadhi/data/raw';
  process.env.AUSHADHI_DIST_ROOT = '/var/lib/aushadhi/dist';
  try {
    const context = ctx();
    assert.equal(context.rawRoot, '/var/lib/aushadhi/data/raw');
    assert.equal(context.distRoot, '/var/lib/aushadhi/dist');
  } finally {
    if (beforeRaw === undefined) delete process.env.AUSHADHI_RAW_ROOT;
    else process.env.AUSHADHI_RAW_ROOT = beforeRaw;
    if (beforeDist === undefined) delete process.env.AUSHADHI_DIST_ROOT;
    else process.env.AUSHADHI_DIST_ROOT = beforeDist;
  }
});
