import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueue } from '../src/lib/gapfill-queue.mjs';
import { buildKnownCombos } from '../src/lib/known-combos.mjs';

const row = (brand, status, over = {}) => ({
  brand_name: brand, manufacturer: 'M Pharma Ltd', pack_label: 'strip of 10',
  composition_status: status, ingredients: status === 'missing' ? [] : [{ molecule: 'x', strength_value: 1, strength_unit: 'mg', strength_raw: '1mg' }],
  ...over,
});

const slugIndex = new Map([
  ['alpha 10 tablet', '/drugs/alpha-10-tablet-101'],
  ['beta syrup', '/drugs/beta-syrup-102'],
  ['gamma 20 tablet', '/drugs/gamma-20-tablet-103'],
  ['delta cream', '/drugs/delta-cream-104'],
]);

test('priority: catalog-matched > conflicted > missing; slugless skipped', () => {
  const rows = [
    row('Alpha 10 Tablet', 'missing'),          // catalog + missing -> P1
    row('Beta Syrup', 'complete'),              // conflicted -> P2
    row('Gamma 20 Tablet', 'missing'),          // missing -> P3
    row('NoSlug Tablet', 'missing'),            // no slug -> skipped
  ];
  const conflicts = [{ kind: 'composition_disagreement', identity_key: 'beta syrup|m|strip of 10' }];
  const { queue, skipped } = buildQueue({
    rows, conflicts, slugIndex,
    catalogNames: new Set(['alpha 10 tablet']),
    limit: 10,
  });
  assert.deepEqual(queue.map((q) => q.path), [
    '/drugs/alpha-10-tablet-101',
    '/drugs/beta-syrup-102',
    '/drugs/gamma-20-tablet-103',
  ]);
  assert.equal(skipped, 1);
});

test('limit respected and paths deduped', () => {
  const rows = [row('Alpha 10 Tablet', 'missing'), row('Alpha 10 Tablet', 'missing'), row('Gamma 20 Tablet', 'missing')];
  const { queue } = buildQueue({ rows, conflicts: [], slugIndex, catalogNames: new Set(), limit: 1 });
  assert.equal(queue.length, 1);
});

test('complete rows not queued', () => {
  const rows = [row('Delta Cream', 'complete')];
  const { queue } = buildQueue({ rows, conflicts: [], slugIndex, catalogNames: new Set(), limit: 10 });
  assert.equal(queue.length, 0);
});

test('LIKELY-truncated combos (known-FDC subset) outrank conflicts and missing', () => {
  const ing = (m) => ({ molecule: m, strength_value: null, strength_unit: null, strength_raw: null });
  const tb = row('Alpha 10 Tablet', 'complete', {
    two_slot_maxed: true,
    ingredients: [ing('rifampicin'), ing('isoniazid')], // subset of seeded TB 4FDC
    sources: [{ source: 'github-jr' }],
  });
  const missing = row('Gamma 20 Tablet', 'missing', { sources: [{ source: 'github-jr' }] });
  const conflicted = row('Beta Syrup', 'complete', { sources: [{ source: 'github-jr' }] });
  const conflicts = [{ kind: 'composition_disagreement', identity_key: 'beta syrup|m|strip of 10' }];
  const kb = buildKnownCombos([]);
  const { queue } = buildQueue({ rows: [missing, conflicted, tb], conflicts, slugIndex, catalogNames: new Set(), limit: 10, knownCombos: kb });
  assert.deepEqual(queue.map((q) => q.path), [
    '/drugs/alpha-10-tablet-101',  // likely-truncated first
    '/drugs/beta-syrup-102',       // then conflicted
    '/drugs/gamma-20-tablet-103',  // then missing
  ]);
});

test('exhaustive mode queues complete rows too, but priority work comes first', () => {
  const rows = [
    row('Delta Cream', 'complete', { sources: [{ source: 'github-jr' }] }),   // complete, unverified -> exhaustive tail
    row('Gamma 20 Tablet', 'missing', { sources: [{ source: 'github-jr' }] }), // missing -> priority
  ];
  const { queue } = buildQueue({ rows, conflicts: [], slugIndex, catalogNames: new Set(), limit: 10, exhaustive: true });
  assert.deepEqual(queue.map((q) => q.path), [
    '/drugs/gamma-20-tablet-103',  // priority (missing) first
    '/drugs/delta-cream-104',      // exhaustive tail (complete) last
  ]);
});

test('exhaustive mode skips rows already verified by onemg-live (fetch each page once)', () => {
  const rows = [
    row('Delta Cream', 'complete', { sources: [{ source: 'github-jr' }, { source: 'onemg-live' }] }),
    row('Alpha 10 Tablet', 'complete', { sources: [{ source: 'github-jr' }] }),
  ];
  const { queue } = buildQueue({ rows, conflicts: [], slugIndex, catalogNames: new Set(), limit: 10, exhaustive: true });
  assert.deepEqual(queue.map((q) => q.path), ['/drugs/alpha-10-tablet-101']); // Delta already onemg-verified -> skipped
});

test('non-exhaustive mode unchanged: complete unverified rows still skipped', () => {
  const rows = [row('Delta Cream', 'complete', { sources: [{ source: 'github-jr' }] })];
  const { queue } = buildQueue({ rows, conflicts: [], slugIndex, catalogNames: new Set(), limit: 10 });
  assert.equal(queue.length, 0);
});

test('two-slot-maxed github-jr-only rows queue for truncation verification', () => {
  const suspect = row('Delta Cream', 'complete', {
    two_slot_maxed: true, sources: [{ source: 'github-jr', source_id: '1', seen_at: '2026-07-07' }],
  });
  const verified = row('Beta Syrup', 'complete', {
    two_slot_maxed: true,
    sources: [{ source: 'github-jr' }, { source: 'onemg-live' }], // richer source already covered it
  });
  const { queue } = buildQueue({ rows: [suspect, verified], conflicts: [], slugIndex, catalogNames: new Set(), limit: 10 });
  assert.deepEqual(queue.map((q) => q.path), ['/drugs/delta-cream-104']);
});
