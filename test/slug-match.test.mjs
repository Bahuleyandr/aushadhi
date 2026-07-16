import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugToName, buildSlugMatcher, matchBrand } from '../src/lib/slug-match.mjs';

test('slugToName strips /drugs/ prefix and -id suffix, hyphens -> spaces', () => {
  assert.equal(slugToName('/drugs/biceltis-440mg-injection-174218'), 'biceltis 440mg injection');
  assert.equal(slugToName('/drugs/augmentin-625-duo-tablet-138629'), 'augmentin 625 duo tablet');
  assert.equal(slugToName('/drugs/x-1'), 'x');
  assert.equal(slugToName('/not-a-drug'), '');
});

test('exact match on PATH-derived name recovers polluted-norm slugs', () => {
  // norm is the polluted browse-card blob; matcher must ignore it and use the path
  const m = buildSlugMatcher([
    { path: '/drugs/augmentin-625-duo-tablet-138629', norm: 'augmentin 625 duo tabletprescription requiredstrip of 10glaxo₹223' },
  ]);
  const r = matchBrand(m, 'Augmentin 625 Duo Tablet');
  assert.equal(r.path, '/drugs/augmentin-625-duo-tablet-138629');
  assert.equal(r.method, 'exact');
  assert.equal(r.confidence, 1);
});

test('ambiguous exact (same path-name, different ids) -> never auto-applied', () => {
  const m = buildSlugMatcher([
    { path: '/drugs/calpol-500-tablet-123' },
    { path: '/drugs/calpol-500-tablet-456' },
  ]);
  assert.equal(matchBrand(m, 'Calpol 500 Tablet'), null);
});

test('fuzzy token match for extra/re-ordered words, unambiguous only', () => {
  const m = buildSlugMatcher([{ path: '/drugs/azithral-500-tablet-325616' }]);
  // reordered but identical token set -> fuzzy method, full token overlap (conf 1)
  const r1 = matchBrand(m, 'Tablet Azithral 500');
  assert.ok(r1 && r1.method === 'fuzzy' && r1.path === '/drugs/azithral-500-tablet-325616');
  assert.equal(r1.confidence, 1);
  // genuine extra word -> partial confidence, still above threshold
  const r2 = matchBrand(m, 'Azithral 500 Tablet DT');
  assert.ok(r2 && r2.method === 'fuzzy');
  assert.ok(r2.confidence >= 0.6 && r2.confidence < 1);
});

test('no match below the similarity threshold', () => {
  const m = buildSlugMatcher([{ path: '/drugs/azithral-500-tablet-325616' }]);
  assert.equal(matchBrand(m, 'Completely Unrelated Syrup'), null);
});

test('fuzzy tie between two equally-good candidates -> not applied', () => {
  const m = buildSlugMatcher([
    { path: '/drugs/dolo-650-tablet-111' },
    { path: '/drugs/dolo-650-capsule-222' },
  ]);
  // "dolo 650" is an equally-strong subset of both -> ambiguous -> null
  assert.equal(matchBrand(m, 'Dolo 650'), null);
});
