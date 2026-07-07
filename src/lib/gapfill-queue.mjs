import { normBrandName } from './normalize.mjs';
import { identityKey } from './merge.mjs';

// Pure priority queue over artifact rows. Priority:
//   1. catalog-matched rows needing work (missing/conflicted/partial)
//   2. conflicted rows
//   3. missing-composition rows
//   4. partial rows
// Only rows resolvable to a 1mg slug (via the discover index) are queued.
export function buildQueue({ rows, conflicts, slugIndex, catalogNames = new Set(), limit = 200 }) {
  const conflictedKeys = new Set(conflicts.map((c) => c.identity_key));
  const buckets = [[], [], [], []];
  let skipped = 0;
  for (const r of rows) {
    const needsWork = r.composition_status !== 'complete' || conflictedKeys.has(identityKey(r));
    if (!needsWork) continue;
    const norm = normBrandName(r.brand_name);
    const path = slugIndex.get(norm);
    if (!path) { skipped++; continue; }
    const entry = {
      identity_key: identityKey(r), brand_name: r.brand_name,
      manufacturer: r.manufacturer, pack_label: r.pack_label, path,
    };
    if (catalogNames.has(norm)) buckets[0].push(entry);
    else if (conflictedKeys.has(identityKey(r))) buckets[1].push(entry);
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
