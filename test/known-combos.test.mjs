import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKnownCombos, pairKey, likelyTruncated, loadSeedCombos } from '../src/lib/known-combos.mjs';

const ing = (m) => ({ molecule: m, strength_value: null, strength_unit: null, strength_raw: null });

const artifactRows = [
  { // janaushadhi triple — full composition, becomes knowledge
    brand_name: 'Chlorzoxazone, Diclofenac and Paracetamol Tablets',
    ingredients: ['chlorzoxazone', 'diclofenac', 'paracetamol'].map(ing),
    sources: [{ source: 'janaushadhi' }],
  },
  { // 2-molecule row — NOT knowledge (could itself be truncated)
    brand_name: 'Augmentin 625 Duo Tablet',
    ingredients: ['amoxycillin', 'clavulanic acid'].map(ing),
    sources: [{ source: 'github-jr' }],
  },
];

test('seed file loads and contains the TB 4FDC', () => {
  const seeds = loadSeedCombos();
  assert.ok(seeds.length >= 20, `got ${seeds.length}`);
  assert.ok(seeds.some((c) => pairKey(['rifampicin', 'isoniazid']) && c.includes('rifampicin') && c.includes('ethambutol') && c.includes('pyrazinamide') && c.includes('isoniazid')));
  assert.ok(seeds.every((c) => c.length >= 3), 'seeds are 3+ molecule combos only');
});

test('buildKnownCombos indexes pairs from artifact 3+ rows AND seeds', () => {
  const kb = buildKnownCombos(artifactRows);
  // from the janaushadhi triple: all 3 pairs
  assert.ok(kb.pairIndex.has(pairKey(['diclofenac', 'paracetamol'])));
  assert.ok(kb.pairIndex.has(pairKey(['chlorzoxazone', 'diclofenac'])));
  // from seeds: TB pair
  assert.ok(kb.pairIndex.has(pairKey(['rifampicin', 'isoniazid'])));
  // 2-molecule artifact rows contribute nothing
  assert.ok(!kb.pairIndex.has(pairKey(['amoxycillin', 'clavulanic acid'])));
  assert.ok(kb.combos >= 21); // 20+ seeds + 1 artifact-derived
});

test('likelyTruncated: 2-slot pair inside a known combo, only when unverified', () => {
  const kb = buildKnownCombos(artifactRows);
  const tbRow = {
    two_slot_maxed: true,
    ingredients: ['isoniazid', 'rifampicin'].map(ing),
    sources: [{ source: 'github-jr' }],
  };
  assert.equal(likelyTruncated(tbRow, kb), true);
  // a pair NOT in any known combo
  assert.equal(likelyTruncated({ ...tbRow, ingredients: ['azithromycin', 'paracetamol'].map(ing) }, kb), false);
  // already verified by a richer source -> not a candidate
  assert.equal(likelyTruncated({ ...tbRow, sources: [{ source: 'github-jr' }, { source: 'onemg-live' }] }, kb), false);
  // 1-molecule rows are never truncation candidates
  assert.equal(likelyTruncated({ two_slot_maxed: false, ingredients: [ing('paracetamol')], sources: [{ source: 'github-jr' }] }, kb), false);
});
