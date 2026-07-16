import { normBrandName } from './normalize.mjs';

// "/drugs/biceltis-440mg-injection-174218" -> "biceltis 440mg injection".
// The discover browse-card `norm` is often polluted with the whole card text
// (pack/manufacturer/price); the PATH slug is a clean brand identifier.
export function slugToName(path) {
  const m = String(path ?? '').match(/\/drugs\/(.+)-\d+$/);
  return m ? m[1].replace(/-/g, ' ').trim() : '';
}

function tokenSet(s) {
  return new Set(normBrandName(s).split(' ').filter(Boolean));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// Build indexes over slug-index entries, keyed off the PATH-derived name:
//   exact:   normBrandName(path-name) -> [paths]   (recovers polluted-norm slugs)
//   byToken: token -> [candidate index]            (limits fuzzy comparisons)
export function buildSlugMatcher(entries) {
  const exact = new Map();
  const byToken = new Map();
  const cands = [];
  for (const e of entries) {
    const name = slugToName(e.path);
    if (!name) continue;
    const key = normBrandName(name);
    if (!key) continue;
    if (!exact.has(key)) exact.set(key, []);
    exact.get(key).push(e.path);
    const tokens = tokenSet(name);
    const idx = cands.length;
    cands.push({ path: e.path, tokens });
    for (const t of tokens) {
      let list = byToken.get(t);
      if (!list) byToken.set(t, (list = []));
      list.push(idx);
    }
  }
  return { exact, byToken, cands };
}

// Returns { path, confidence, method } or null. NEVER returns an ambiguous match
// (multiple exact ids, or a fuzzy tie) — callers must be able to trust a hit.
export function matchBrand(matcher, brandName, { minJaccard = 0.6 } = {}) {
  const key = normBrandName(brandName);
  if (!key) return null;
  const ex = matcher.exact.get(key);
  if (ex) return ex.length === 1 ? { path: ex[0], confidence: 1, method: 'exact' } : null;

  const bt = tokenSet(brandName);
  if (!bt.size) return null;
  const seen = new Set();
  for (const t of bt) {
    const list = matcher.byToken.get(t);
    if (list) for (const i of list) seen.add(i);
  }
  let best = null;
  let bestScore = 0;
  let tie = false;
  for (const i of seen) {
    const s = jaccard(bt, matcher.cands[i].tokens);
    if (s > bestScore) { bestScore = s; best = matcher.cands[i]; tie = false; }
    else if (s === bestScore && s > 0) tie = true;
  }
  if (best && bestScore >= minJaccard && !tie) {
    return { path: best.path, confidence: Number(bestScore.toFixed(3)), method: 'fuzzy' };
  }
  return null;
}
