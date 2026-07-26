// Molecule-plausibility strength model for reconcile-time conflict resolution.
//
// Learns each molecule's real-world strength distribution from the full pre-merge
// row set, then answers the queries used to resolve cross-source strength conflicts
// (see docs/plausibility-reconcile-plan.md):
//
//   - isPlausible(molecule, value, unit): does this strength occur with meaningful
//     frequency for this molecule? (count and share floors)
//   - plausScore(ingredients): summed share of an assignment — used to pick the
//     pharmacologically-correct option among swap candidates (beats source-trust,
//     which is wrong ~half the time on swaps).
//   - assignmentUnambiguous(ingredients): can we CERTIFY this molecule->strength
//     assignment? True only when no alternative permutation of the strengths across
//     the molecules is also plausible (so any swap would be provably wrong).
//
// Distributions are learned from data that still contains errors, so a systematically
// wrong value keeps a small non-zero share; the floors below err toward caution.

export const PLAUSIBLE_MIN_COUNT = 3;
export const PLAUSIBLE_MIN_SHARE = 0.005;

const molKey = (molecule) => String(molecule ?? '').toLowerCase().trim();
const valKey = (value, unit) => `${Math.round(value * 1000) / 1000}|${String(unit ?? '').toLowerCase()}`;
const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

function* permutations(items) {
  if (items.length <= 1) {
    yield items.slice();
    return;
  }
  for (let i = 0; i < items.length; i += 1) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) yield [items[i], ...tail];
  }
}

export function buildStrengthModel(rows = []) {
  const counts = new Map(); // molecule -> Map<valKey, count>
  const totals = new Map(); // molecule -> total strength observations
  for (const row of rows ?? []) {
    for (const ingredient of row?.ingredients ?? []) {
      const molecule = molKey(ingredient?.molecule);
      const value = ingredient?.strength_value;
      if (!molecule || !isNum(value)) continue;
      let byValue = counts.get(molecule);
      if (!byValue) {
        byValue = new Map();
        counts.set(molecule, byValue);
      }
      const key = valKey(value, ingredient?.strength_unit);
      byValue.set(key, (byValue.get(key) ?? 0) + 1);
      totals.set(molecule, (totals.get(molecule) ?? 0) + 1);
    }
  }

  const observed = (molecule, value, unit) => (isNum(value)
    ? counts.get(molKey(molecule))?.get(valKey(value, unit)) ?? 0 : 0);
  const total = (molecule) => totals.get(molKey(molecule)) ?? 0;

  function isPlausible(molecule, value, unit) {
    if (value === null || value === undefined) return true; // no strength to judge
    if (!isNum(value)) return false; // NaN / Infinity / non-numeric were never observed -> implausible
    const n = observed(molecule, value, unit);
    return n >= PLAUSIBLE_MIN_COUNT && n / Math.max(1, total(molecule)) >= PLAUSIBLE_MIN_SHARE;
  }

  function plausScore(ingredients = []) {
    let score = 0;
    for (const ingredient of ingredients ?? []) {
      const value = ingredient?.strength_value;
      if (!isNum(value)) continue;
      const denom = total(ingredient?.molecule);
      if (denom) score += observed(ingredient?.molecule, value, ingredient?.strength_unit) / denom;
    }
    return score;
  }

  function assignmentUnambiguous(ingredients = []) {
    const list = ingredients ?? [];
    if (!list.length || list.length > 3) return false;
    if (list.some((ingredient) => !isNum(ingredient?.strength_value))) return false;
    const names = list.map((ingredient) => molKey(ingredient.molecule));
    // Round values the same way valKey/observed do, so the identity/base comparison
    // uses the exact bucket plausibility is evaluated on (no raw-vs-rounded mismatch).
    const values = list.map((ingredient) => [Math.round(ingredient.strength_value * 1000) / 1000, String(ingredient.strength_unit ?? '').toLowerCase()]);
    const fullyPlausible = (assignment) => names.every((name, index) => isPlausible(name, assignment[index][0], assignment[index][1]));
    if (!fullyPlausible(values)) return false;
    const canonical = (assignment) => {
      const mapping = new Map();
      names.forEach((name, index) => mapping.set(name, `${assignment[index][0]}|${assignment[index][1]}`));
      return [...mapping.entries()].sort().map(([name, value]) => `${name}=${value}`).join(';');
    };
    const base = canonical(values);
    for (const permutation of permutations(values)) {
      if (canonical(permutation) === base) continue;
      if (fullyPlausible(permutation)) return false; // an alternative assignment is also plausible
    }
    return true;
  }

  return { isPlausible, plausScore, assignmentUnambiguous, observed, total };
}
