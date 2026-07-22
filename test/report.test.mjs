import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../src/lib/report.mjs';

const summary = {
  date: '2026-07-17',
  total_rows: 267618,
  unique_compositions: 15107,
  composition_status: { complete: 267618 },
  confidence: { single_source: 200000, multi_source: 60000, conflict: 7618 },
  conflicts: 1577,
  errors: 0,
  sources: { 'github-jr': 253973, 'onemg-live': 145793, apollo: 5094 },
  atc_molecules: 98,
  atc_coverage_rows: 185018,
  likely_truncated: 31749,
};

test('renderReport: header, formatted totals, sources', () => {
  const md = renderReport(summary);
  assert.match(md, /# aushadhi dataset report/i);
  assert.match(md, /2026-07-17/);
  assert.match(md, /267,618/);      // thousands-formatted total
  assert.match(md, /github-jr/);
  assert.match(md, /253,973/);
});

test('renderReport: confidence distribution with percentages', () => {
  const md = renderReport(summary);
  assert.match(md, /multi_source/);
  assert.match(md, /conflict/);
  // 60000/267618 = 22.4%
  assert.match(md, /22\.4%/);
});

test('renderReport: ATC coverage percentage', () => {
  const md = renderReport(summary);
  // 185018/267618 = 69.1%
  assert.match(md, /69\.1%/);
  assert.match(md, /98 molecules/);
});

test('renderReport: conflict breakdown by kind when provided', () => {
  const md = renderReport(summary, { composition_disagreement: 900, strength_disagreement: 677 });
  assert.match(md, /composition_disagreement/);
  assert.match(md, /900/);
});

test('renderReport: tolerates missing optional fields', () => {
  const md = renderReport({ date: '2026-07-17', total_rows: 10, sources: {} });
  assert.match(md, /# aushadhi dataset report/i);
  assert.ok(typeof md === 'string' && md.length > 0);
});

test('renderReport: strength verification section when the model ran', () => {
  const md = renderReport({
    ...summary,
    strength_verified_rows: 240000, strength_unverified_rows: 20000,
    strength_no_strength_rows: 7618, strength_conflict_rows: 300,
  });
  assert.match(md, /Strength verification/i);
  assert.match(md, /verified/);
  assert.match(md, /240,000/);
  assert.match(md, /89\.7%/);        // 240000/267618
  assert.match(md, /strength_conflict/);
  assert.match(md, /\b300\b/);
});

test('renderReport: no strength section when the fields are absent (backward compatible)', () => {
  const md = renderReport(summary);  // base summary has no strength_* fields
  assert.doesNotMatch(md, /Strength verification/i);
});
