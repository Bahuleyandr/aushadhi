import { normBrandName } from './normalize.mjs';
import { identityKey } from './merge.mjs';

// A 2-slot-maxed row that only github-jr has seen is a truncation-verification
// candidate; once ANY richer source (onemg-live/kaggle) has covered the
// identity, the flag is considered checked.
function needsTruncationCheck(r) {
  return r.two_slot_maxed === true && (r.sources ?? []).every((s) => s.source === 'github-jr');
}

// Pure priority queue over artifact rows. Priority:
//   1. catalog-matched rows needing work (missing/conflicted/truncation-suspect)
//   2. conflicted rows
//   3. missing-composition rows
//   4. truncation-verification candidates (2-slot-maxed, github-jr-only)
// Only rows resolvable to a 1mg slug (via the discover index) are queued.
export function buildQueue({ rows, conflicts, slugIndex, catalogNames = new Set(), limit = 200 }) {
  const conflictedKeys = new Set(conflicts.map((c) => c.identity_key));
  const buckets = [[], [], [], []];
  let skipped = 0;
  for (const r of rows) {
    const key = identityKey(r);
    const conflicted = conflictedKeys.has(key);
    const needsWork = r.composition_status !== 'complete' || conflicted || needsTruncationCheck(r);
    if (!needsWork) continue;
    const norm = normBrandName(r.brand_name);
    const path = slugIndex.get(norm);
    if (!path) { skipped++; continue; }
    const entry = {
      identity_key: key, brand_name: r.brand_name,
      manufacturer: r.manufacturer, pack_label: r.pack_label, path,
    };
    if (catalogNames.has(norm)) buckets[0].push(entry);
    else if (conflicted) buckets[1].push(entry);
    else if (r.composition_status === 'missing') buckets[2].push(entry);
    else buckets[3].push(entry);
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
