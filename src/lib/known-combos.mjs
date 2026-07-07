import fs from 'node:fs';
import { moleculeNameKey } from './merge.mjs';

const SEED_FILE = new URL('../../data-static/india-fdc-seeds.json', import.meta.url);

export function pairKey(molecules) {
  return [...molecules].sort().join('|');
}

export function loadSeedCombos() {
  const { combos } = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  return combos.map((c) => c.molecules);
}

function allPairs(molecules) {
  const out = [];
  const m = [...new Set(molecules)];
  for (let i = 0; i < m.length; i++) {
    for (let j = i + 1; j < m.length; j++) out.push(pairKey([m[i], m[j]]));
  }
  return out;
}

// Knowledge base of 3+-molecule combos known to exist in the Indian market:
// every artifact row with >=3 parsed ingredients (janaushadhi today; each
// gap-filled 1mg page grows it) + the curated seed list. Indexed by the
// unordered pairs inside each combo, so a 2-slot row can be checked in O(1).
export function buildKnownCombos(artifactRows, { seeds = loadSeedCombos() } = {}) {
  const comboKeys = new Set(seeds.map((c) => moleculeNameKey(c.map((m) => ({ molecule: m })))));
  for (const r of artifactRows) {
    if ((r.ingredients?.length ?? 0) >= 3) comboKeys.add(moleculeNameKey(r.ingredients));
  }
  const pairIndex = new Set();
  for (const key of comboKeys) {
    for (const pk of allPairs(key.split('|'))) pairIndex.add(pk);
  }
  return { pairIndex, combos: comboKeys.size };
}

// A 2-slot-maxed row is LIKELY truncated when its visible molecule pair sits
// inside a known 3+ combo and no slot-unlimited source has verified it yet.
export function likelyTruncated(row, kb) {
  if (row.two_slot_maxed !== true) return false;
  if ((row.ingredients?.length ?? 0) !== 2) return false;
  if (!(row.sources ?? []).every((s) => s.source === 'github-jr' || s.source === 'kaggle-2025')) return false;
  return kb.pairIndex.has(pairKey(row.ingredients.map((i) => i.molecule)));
}
