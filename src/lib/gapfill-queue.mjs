import { normBrandName } from './normalize.mjs';
import { identityKey } from './merge.mjs';
import { likelyTruncated } from './known-combos.mjs';

// A 2-slot-maxed row that only slot-limited sources have seen is a
// truncation-verification candidate; once a slot-unlimited source
// (onemg-live/janaushadhi) has covered the identity, it is considered checked.
function needsTruncationCheck(r) {
  return r.two_slot_maxed === true
    && (r.sources ?? []).every((s) => s.source === 'github-jr' || s.source === 'kaggle-2025');
}

const onemgVerified = (r) => (r.sources ?? []).some((s) => s.source === 'onemg-live');

// Pure priority queue over artifact rows. Priority:
//   1. catalog-matched rows needing work
//   2. LIKELY-truncated combos (visible pair sits inside a known 3+ molecule
//      FDC — TB 4FDC, cold trios, etc. — per the known-combos knowledge base)
//   3. conflicted rows
//   4. missing-composition rows
//   5. remaining truncation-verification candidates (2-slot-maxed, unverified)
//   6. (exhaustive only) every other slugged row not yet fetched from 1mg
// Only rows resolvable to a 1mg slug (via the discover index) are queued.
// exhaustive=true → fetch every drug page ONCE (skips rows already onemg-verified),
// so the whole market gets first-party composition + substitutes, not just needs-work.
export function buildQueue({ rows, conflicts, slugIndex, catalogNames = new Set(), limit = 200, knownCombos = null, exhaustive = false }) {
  const conflictedKeys = new Set(conflicts.map((c) => c.identity_key));
  const buckets = [[], [], [], [], [], []];
  let skipped = 0;
  for (const r of rows) {
    const key = identityKey(r);
    const conflicted = conflictedKeys.has(key);
    const priorityWork = r.composition_status !== 'complete' || conflicted || needsTruncationCheck(r);
    const needsWork = priorityWork || (exhaustive && !onemgVerified(r));
    if (!needsWork) continue;
    const norm = normBrandName(r.brand_name);
    const path = slugIndex.get(norm);
    if (!path) { skipped++; continue; }
    const entry = {
      identity_key: key, brand_name: r.brand_name,
      manufacturer: r.manufacturer, pack_label: r.pack_label, path,
    };
    if (catalogNames.has(norm)) buckets[0].push(entry);
    else if (knownCombos && likelyTruncated(r, knownCombos)) buckets[1].push(entry);
    else if (conflicted) buckets[2].push(entry);
    else if (r.composition_status === 'missing') buckets[3].push(entry);
    else if (needsTruncationCheck(r)) buckets[4].push(entry);
    else buckets[5].push(entry); // exhaustive tail: complete, not yet 1mg-verified
  }
  const seen = new Set();
  const queue = [];
  for (const bucket of buckets) {
    for (const e of bucket) {
      if (queue.length >= limit) break;
      if (seen.has(e.path)) continue;
      seen.add(e.path);
      queue.push(e);
    }
  }
  return { queue, skipped };
}
