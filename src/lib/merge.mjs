import { normBrandName, normManufacturer, normPack } from './normalize.mjs';

export const SOURCE_PRECEDENCE = ['onemg-live', 'apollo', 'pharmeasy', 'netmeds', 'nppa', 'kaggle-2025', 'janaushadhi', 'github-jr', 'cdsco-fdc'];
const rank = (s) => {
  const i = SOURCE_PRECEDENCE.indexOf(s);
  return i === -1 ? SOURCE_PRECEDENCE.length : i;
};

export function identityKey(row) {
  return [normBrandName(row.brand_name), normManufacturer(row.manufacturer), normPack(row.pack_label)].join('|');
}

export function moleculeSetKey(ingredients = []) {
  return ingredients.map((i) => `${i.molecule}:${i.strength_value ?? ''}${i.strength_unit ?? ''}`).sort().join('|');
}

// Name-only key (no strengths) — the ONE convention shared by CDSCO FDC
// validation, substitute cross-validation, and strength-disagreement checks.
export function moleculeNameKey(ingredients = []) {
  return [...new Set(ingredients.map((i) => i.molecule))].sort().join('|');
}

const molNames = (ings = []) => new Set(ings.map((i) => i.molecule));
const isSubset = (a, b) => [...a].every((x) => b.has(x));

// Cross-validation: a 1mg-substitute pair should share the same molecule-NAME set
// (strengths legitimately differ across substitute pack sizes). A mismatch is a
// parse-error signal on one side — flagged, never silently trusted.
export function detectSubstituteMismatches(rows) {
  const byBrand = new Map();
  const keyCache = new Map();
  const keyOf = (r) => {
    let k = keyCache.get(r);
    if (k === undefined) { k = moleculeNameKey(r.ingredients); keyCache.set(r, k); }
    return k;
  };
  for (const r of rows) {
    const k = normBrandName(r.brand_name);
    if (!byBrand.has(k)) byBrand.set(k, r);
  }
  const conflicts = [];
  for (const r of rows) {
    if (!r.ingredients?.length || !(r.substitutes_raw ?? []).length) continue;
    for (const s of r.substitutes_raw) {
      const other = byBrand.get(normBrandName(s.name));
      if (!other || !other.ingredients?.length) continue;
      if (keyOf(r) !== keyOf(other)) {
        conflicts.push({
          kind: 'substitute_group_mismatch',
          identity_key: identityKey(r),
          a: { brand: r.brand_name, key: keyOf(r) },
          b: { brand: other.brand_name, key: keyOf(other) },
        });
      }
    }
  }
  return conflicts;
}

export function mergeRows(allRows) {
  const groups = new Map();
  for (const r of allRows) {
    const k = identityKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const rows = [];
  const conflicts = [];
  for (const [key, group] of groups) {
    group.sort((a, b) => rank(a.source) - rank(b.source));
    const best = group[0];
    const out = { ...best };
    for (const field of ['form_raw', 'price_inr', 'is_discontinued', 'type']) {
      out[field] = group.map((r) => r[field]).find((v) => v !== null && v !== undefined && v !== '') ?? null;
    }
    // composition: best-rank wins unless a lower rank is a strict molecule superset
    let chosen = best;
    for (const r of group.slice(1)) {
      const a = molNames(chosen.ingredients);
      const b = molNames(r.ingredients);
      if (b.size > a.size && isSubset(a, b)) {
        chosen = r; // richer superset (fixes 2-slot truncation)
      } else if (a.size && b.size
        && moleculeSetKey(chosen.ingredients) !== moleculeSetKey(r.ingredients)) {
        if (!isSubset(b, a) && !isSubset(a, b)) {
          conflicts.push({
            kind: 'composition_disagreement', identity_key: key,
            a: { source: chosen.source, key: moleculeSetKey(chosen.ingredients) },
            b: { source: r.source, key: moleculeSetKey(r.ingredients) },
          });
        } else if (moleculeNameKey(chosen.ingredients) === moleculeNameKey(r.ingredients)) {
          // same molecules, different strengths — never silently resolved (spec §7)
          conflicts.push({
            kind: 'strength_disagreement', identity_key: key,
            a: { source: chosen.source, key: moleculeSetKey(chosen.ingredients) },
            b: { source: r.source, key: moleculeSetKey(r.ingredients) },
          });
        }
      }
    }
    // composition fields travel TOGETHER with the chosen row — a field-fill
    // composition_raw could contradict the elected ingredients
    out.ingredients = chosen.ingredients;
    out.composition_raw = chosen.composition_raw ?? null;
    out.composition_status = chosen.ingredients.length ? 'complete' : 'missing';
    out.two_slot_maxed = chosen.two_slot_maxed === true;
    out.substitutes_raw = [...new Map(
      group.flatMap((r) => r.substitutes_raw ?? []).map((s) => [normBrandName(s.name), s]),
    ).values()];
    out.sources = group.map((r) => ({ source: r.source, source_id: r.source_id ?? null, seen_at: r.seen_at }));
    const dates = group.map((r) => r.seen_at).sort();
    out.first_seen = dates[0];
    out.last_seen = dates.at(-1);
    delete out.source;
    delete out.source_id;
    delete out.seen_at;
    rows.push(out);
  }
  return { rows, conflicts };
}
