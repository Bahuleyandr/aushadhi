import { createHash } from 'node:crypto';

export const INGREDIENT_IDENTITY_NAMESPACE = 'aushadhi:ingredient-identity:v1';

const WHITESPACE = /\s+/gu;

export function normalizeObservedIngredientName(value) {
  return (value ?? '').toString().normalize('NFKC').replace(WHITESPACE, ' ').trim();
}

export function canonicalIngredientKey(value) {
  return normalizeObservedIngredientName(value).toLocaleLowerCase('und');
}

export function ingredientIdForName(name) {
  const canonicalName = canonicalIngredientKey(name);
  if (!canonicalName) throw new TypeError('A non-empty ingredient name is required.');
  const digest = createHash('sha256')
    .update(INGREDIENT_IDENTITY_NAMESPACE, 'utf8')
    .update('\0', 'utf8')
    .update(canonicalName, 'utf8')
    .digest('hex');
  return `sha256:${digest}`;
}

export function createIngredientIdentity(ingredient) {
  if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) {
    throw new TypeError('An ingredient object with an ingredient name is required.');
  }

  const candidates = [
    ['observed_name', ingredient.observed_name, 'observed'],
    ['molecule_raw', ingredient.molecule_raw, 'observed'],
    ['molecule', ingredient.molecule, 'catalogue_normalized_fallback'],
  ];
  const selected = candidates.find(([, value]) => normalizeObservedIngredientName(value));
  if (!selected) throw new TypeError('A non-empty ingredient name is required.');

  const [sourceField, value, precision] = selected;
  const observedName = normalizeObservedIngredientName(value);
  const canonicalName = canonicalIngredientKey(observedName);
  return {
    ingredient_id: ingredientIdForName(canonicalName),
    canonical_name: canonicalName,
    observed_name: observedName,
    precision,
    source_field: sourceField,
  };
}
