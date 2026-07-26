export const DISCLAIMER = 'No listed interaction does not establish safety. Verify with a pharmacist or clinician and current approved labeling.';

const COVERAGE_VALUES = new Set(['complete', 'partial', 'unknown']);
const MAPPED_STATUSES = new Set(['exact', 'reviewed_override']);
const REVIEW_STATUSES = new Set(['clinician_reviewed', 'review_candidate']);

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, label) {
  if (!isObject(value)) throw new TypeError(`${label} must be an object`);
}

function assertExactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label} contains unknown property ${key}`);
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function assertStringArray(value, label, { minItems = 0, unique = false } = {}) {
  if (!Array.isArray(value) || value.length < minItems) {
    throw new TypeError(`${label} must be an array with at least ${minItems} item(s)`);
  }
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const item = requireString(value[index], `${label}[${index}]`);
    if (unique && seen.has(item)) throw new TypeError(`${label} must contain unique values`);
    seen.add(item);
  }
}

function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function normalizePairArguments(first, second) {
  if (!Array.isArray(first) && second === undefined) {
    throw new TypeError('pairKey requires exactly two ingredient identifiers');
  }
  const pair = Array.isArray(first) && second === undefined ? first : [first, second];
  if (pair.length !== 2) throw new TypeError('pairKey requires exactly two ingredient identifiers');
  const normalized = pair.map((id, index) => requireString(id, `ingredient identifier ${index + 1}`));
  if (normalized.some((id) => id.includes('|'))) {
    throw new TypeError('ingredient identifiers must not contain the pair-key separator');
  }
  if (normalized[0] === normalized[1]) {
    throw new TypeError('pairKey requires two different ingredient identifiers');
  }
  return normalized.sort(compareStrings);
}

export function pairKey(first, second) {
  return normalizePairArguments(first, second).join('|');
}

function ingredientId(value, label) {
  if (typeof value === 'string') return requireString(value, label);
  assertObject(value, label);
  return requireString(value.ingredient_id, `${label}.ingredient_id`);
}

function normalizeProducts(products) {
  if (!Array.isArray(products)) throw new TypeError('resolved products must be an array');
  const normalized = products.map((value, productIndex) => {
    assertObject(value, `resolved product ${productIndex}`);
    const product_id = requireString(value.product_id, `resolved product ${productIndex}.product_id`);
    if (!Array.isArray(value.ingredients)) {
      throw new TypeError(`resolved product ${productIndex}.ingredients must be an array`);
    }
    const ingredients = [...new Set(value.ingredients.map((entry, ingredientIndex) => (
      ingredientId(entry, `resolved product ${productIndex}.ingredients[${ingredientIndex}]`)
    )))].sort(compareStrings);
    return { product_id, ingredients };
  });

  return normalized.sort((a, b) => (
    compareStrings(a.product_id, b.product_id)
    || compareStrings(a.ingredients.join('\u0000'), b.ingredients.join('\u0000'))
  ));
}

export function generateCrossDrugPairs(products) {
  const normalized = normalizeProducts(products);
  const byKey = new Map();

  for (let leftIndex = 0; leftIndex < normalized.length; leftIndex += 1) {
    const left = normalized[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < normalized.length; rightIndex += 1) {
      const right = normalized[rightIndex];
      const productPair = [left.product_id, right.product_id].sort(compareStrings);
      const productPairKey = JSON.stringify(productPair);
      for (const leftIngredient of left.ingredients) {
        for (const rightIngredient of right.ingredients) {
          if (leftIngredient === rightIngredient) continue;
          const pair = [leftIngredient, rightIngredient].sort(compareStrings);
          const key = pairKey(pair);
          let entry = byKey.get(key);
          if (!entry) {
            entry = { pair, productPairs: new Map() };
            byKey.set(key, entry);
          }
          entry.productPairs.set(productPairKey, productPair);
        }
      }
    }
  }

  return [...byKey.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([pair_key, entry]) => ({
      pair_key,
      pair: [...entry.pair],
      product_pairs: [...entry.productPairs.entries()]
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([, pair]) => [...pair]),
    }));
}

function validateEvidence(value, label, expectedReviewStatus) {
  assertObject(value, label);
  assertExactKeys(value, new Set([
    'source',
    'source_url',
    'source_identifier',
    'document_id',
    'document_version',
    'retrieved_at',
    'jurisdiction',
    'excerpt',
    'licence',
    'review_status',
  ]), label);
  requireString(value.source, `${label}.source`);
  if (value.source_url === undefined && value.source_identifier === undefined) {
    throw new TypeError(`${label} requires source_url or source_identifier`);
  }
  if (value.source_url !== undefined) {
    requireString(value.source_url, `${label}.source_url`);
    let url;
    try {
      url = new URL(value.source_url);
    } catch {
      throw new TypeError(`${label}.source_url must be a valid URL`);
    }
    if (url.protocol !== 'https:') throw new TypeError(`${label}.source_url must use HTTPS`);
  }
  if (value.source_identifier !== undefined) {
    requireString(value.source_identifier, `${label}.source_identifier`);
  }
  requireString(value.document_id, `${label}.document_id`);
  requireString(value.document_version, `${label}.document_version`);
  if (!isIsoDate(value.retrieved_at)) throw new TypeError(`${label}.retrieved_at must be an ISO date`);
  requireString(value.jurisdiction, `${label}.jurisdiction`);
  requireString(value.excerpt, `${label}.excerpt`);
  requireString(value.licence, `${label}.licence`);
  if (!REVIEW_STATUSES.has(value.review_status)) {
    throw new TypeError(`${label}.review_status is invalid`);
  }
  if (value.review_status !== expectedReviewStatus) {
    throw new TypeError(`${label}.review_status must be ${expectedReviewStatus}`);
  }
}

function validateApplicability(value, label) {
  assertObject(value, label);
  assertExactKeys(value, new Set(['routes', 'dose_conditions', 'population_conditions']), label);
  for (const key of ['routes', 'dose_conditions', 'population_conditions']) {
    assertStringArray(value[key], `${label}.${key}`);
  }
}

function validateRule(value, index) {
  const label = `rules[${index}]`;
  assertObject(value, label);
  assertExactKeys(value, new Set([
    'rule_id',
    'pair',
    'applicability',
    'severity',
    'mechanism',
    'management',
    'evidence',
    'review',
  ]), label);
  requireString(value.rule_id, `${label}.rule_id`);
  if (!Array.isArray(value.pair) || value.pair.length !== 2) {
    throw new TypeError(`${label}.pair must contain exactly two ingredient identifiers`);
  }
  const canonicalPair = normalizePairArguments(value.pair);
  if (value.pair[0] !== canonicalPair[0] || value.pair[1] !== canonicalPair[1]) {
    throw new TypeError(`${label}.pair must use canonical order`);
  }
  validateApplicability(value.applicability, `${label}.applicability`);
  requireString(value.severity, `${label}.severity`);
  if (value.mechanism !== null) requireString(value.mechanism, `${label}.mechanism`);
  if (value.management !== null) requireString(value.management, `${label}.management`);
  if (!Array.isArray(value.evidence) || value.evidence.length === 0) {
    throw new TypeError(`${label}.evidence must contain at least one item`);
  }
  assertObject(value.review, `${label}.review`);
  assertExactKeys(value.review, new Set([
    'status',
    'reviewer_id',
    'reviewed_at',
    'source_versions',
  ]), `${label}.review`);
  if (!REVIEW_STATUSES.has(value.review.status)) throw new TypeError(`${label}.review.status is invalid`);
  assertStringArray(value.review.source_versions, `${label}.review.source_versions`);

  if (value.review.status === 'clinician_reviewed') {
    requireString(value.review.reviewer_id, `${label}.review.reviewer_id`);
    if (!isIsoDate(value.review.reviewed_at)) {
      throw new TypeError(`${label}.review.reviewed_at must be an ISO date`);
    }
    if (value.review.source_versions.length === 0) {
      throw new TypeError(`${label}.review.source_versions must contain at least one item`);
    }
  } else {
    if (value.severity !== 'unknown') {
      throw new TypeError(`${label} review_candidate severity must be unknown`);
    }
    if (value.mechanism !== null) {
      throw new TypeError(`${label} review_candidate mechanism must be null`);
    }
    if (value.management !== null) {
      throw new TypeError(`${label} review_candidate management must be null`);
    }
  }

  for (let evidenceIndex = 0; evidenceIndex < value.evidence.length; evidenceIndex += 1) {
    validateEvidence(
      value.evidence[evidenceIndex],
      `${label}.evidence[${evidenceIndex}]`,
      value.review.status,
    );
  }
}

export function validateRulePack(rulePack) {
  if (!isObject(rulePack)) throw new TypeError('rule pack must be an object');
  assertExactKeys(rulePack, new Set([
    'schema_version',
    'pack_id',
    'pack_version',
    'profile',
    'licence',
    'source_ids',
    'licence_notices',
    'declared_coverage',
    'rules',
  ]), 'rule pack');
  if (rulePack.schema_version !== '1.0.0') {
    throw new TypeError('rule pack schema_version must be 1.0.0');
  }
  requireString(rulePack.pack_id, 'rule pack pack_id');
  requireString(rulePack.pack_version, 'rule pack pack_version');
  if (rulePack.profile !== 'production-open' && rulePack.profile !== 'internal-evaluation') {
    throw new TypeError('rule pack profile is invalid');
  }
  requireString(rulePack.licence, 'rule pack licence');
  assertStringArray(rulePack.source_ids, 'rule pack source_ids', { minItems: 1, unique: true });
  if (!COVERAGE_VALUES.has(rulePack.declared_coverage)) {
    throw new TypeError('rule pack declared_coverage is invalid');
  }
  if (!Array.isArray(rulePack.rules)) throw new TypeError('rule pack rules must be an array');
  if (rulePack.rules.length === 0 && rulePack.declared_coverage === 'complete') {
    throw new TypeError('empty rule pack cannot declare complete coverage');
  }

  const ruleIds = new Set();
  const pairKeys = new Set();
  for (let index = 0; index < rulePack.rules.length; index += 1) {
    const value = rulePack.rules[index];
    validateRule(value, index);
    if (ruleIds.has(value.rule_id)) throw new TypeError(`duplicate rule_id ${value.rule_id}`);
    ruleIds.add(value.rule_id);
    const key = pairKey(value.pair);
    if (pairKeys.has(key)) throw new TypeError(`duplicate rule pair ${key}`);
    pairKeys.add(key);
  }
  return true;
}

function mappingStatus(value) {
  if (typeof value === 'string') return 'exact';
  if (!isObject(value)) return 'unmapped';
  if (value.mapping_status === undefined) return value.ingredient_id ? 'exact' : 'unmapped';
  return value.mapping_status;
}

function mappingIssue(record, ingredient, ingredientIndex, status) {
  const issue = {
    input: structuredClone(record.input),
    status,
    product_id: record.product.product_id,
    ingredient_index: ingredientIndex,
  };
  if (isObject(ingredient)) {
    for (const key of [
      'ingredient_id',
      'assertion_ingredient_id',
      'ingredient_occurrence_id',
      'observed_name',
      'canonical_name',
      'assertion_canonical_name',
      'identity_relationship',
      'runtime_drug',
      'candidates',
      'error',
      'presentation_error',
    ]) {
      if (ingredient[key] !== undefined) issue[key] = structuredClone(ingredient[key]);
    }
  }
  return issue;
}

function duplicateIngredients(products) {
  const productOccurrences = new Map();
  for (const product of normalizeProducts(products)) {
    for (const id of product.ingredients) {
      const occurrences = productOccurrences.get(id) ?? [];
      occurrences.push(product.product_id);
      productOccurrences.set(id, occurrences);
    }
  }
  return [...productOccurrences.entries()]
    .filter(([, productIds]) => productIds.length > 1)
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([ingredient_id, productIds]) => ({
      ingredient_id,
      product_ids: [...productIds].sort(compareStrings),
    }));
}

function coverageProductResolution(inputs, resolvedCount) {
  if (inputs.length === 0) return 'unknown';
  if (inputs.some((entry) => entry.status === 'operational_error')) return 'unknown';
  if (resolvedCount === inputs.length) return 'complete';
  if (resolvedCount > 0) return 'partial';
  return 'unknown';
}

function coverageIngredientMapping(mappedCount, unresolvedCount, hasOperationalError) {
  if (hasOperationalError || mappedCount + unresolvedCount === 0) return 'unknown';
  if (unresolvedCount === 0) return 'complete';
  if (mappedCount > 0) return 'partial';
  return 'unknown';
}

function combineCoverage(values) {
  if (values.includes('unknown')) return 'unknown';
  if (values.includes('partial')) return 'partial';
  return 'complete';
}

function validateReviewCandidate(value, index) {
  const label = `reviewCandidates[${index}]`;
  assertObject(value, label);
  const status = value.review_status ?? value.review?.status;
  if (status !== 'review_candidate') throw new TypeError(`${label} must remain a review_candidate`);
  if (value.severity !== undefined && value.severity !== 'unknown') {
    throw new TypeError(`${label} severity must be unknown`);
  }
  if (value.mechanism !== undefined && value.mechanism !== null) {
    throw new TypeError(`${label} mechanism must be null`);
  }
  if (value.management !== undefined && value.management !== null) {
    throw new TypeError(`${label} management must be null`);
  }
  if (!Array.isArray(value.evidence) || value.evidence.length === 0) {
    throw new TypeError(`${label}.evidence must contain at least one item`);
  }
  for (let evidenceIndex = 0; evidenceIndex < value.evidence.length; evidenceIndex += 1) {
    validateEvidence(value.evidence[evidenceIndex], `${label}.evidence[${evidenceIndex}]`, 'review_candidate');
  }

  let key;
  if (value.pair !== undefined) key = pairKey(value.pair);
  if (value.pair_key !== undefined) {
    requireString(value.pair_key, `${label}.pair_key`);
    if (key !== undefined && value.pair_key !== key) {
      throw new TypeError(`${label}.pair_key does not match pair`);
    }
    key = value.pair_key;
  }
  if (key === undefined) throw new TypeError(`${label} requires pair or pair_key`);
  return key;
}

function findingSortKey(value) {
  return value.rule_id ?? value.candidate_id ?? value.pair_key ?? pairKey(value.pair);
}

export function checkResolvedProducts({
  resolvedInputs,
  rulePack,
  reviewCandidates = [],
} = {}) {
  if (!Array.isArray(resolvedInputs)) throw new TypeError('resolvedInputs must be an array');
  if (!Array.isArray(reviewCandidates)) throw new TypeError('reviewCandidates must be an array');
  validateRulePack(rulePack);

  const resolved = [];
  const unresolved = [];
  const mappedProducts = [];
  let mappedIngredientCount = 0;
  let unresolvedIngredientCount = 0;
  let mappingOperationalError = false;

  for (let inputIndex = 0; inputIndex < resolvedInputs.length; inputIndex += 1) {
    const record = resolvedInputs[inputIndex];
    assertObject(record, `resolvedInputs[${inputIndex}]`);
    requireString(record.status, `resolvedInputs[${inputIndex}].status`);
    if (record.status !== 'resolved') {
      unresolved.push(structuredClone(record));
      continue;
    }
    assertObject(record.product, `resolvedInputs[${inputIndex}].product`);
    requireString(record.product.product_id, `resolvedInputs[${inputIndex}].product.product_id`);
    if (!Array.isArray(record.product.ingredients)) {
      throw new TypeError(`resolvedInputs[${inputIndex}].product.ingredients must be an array`);
    }
    resolved.push(structuredClone(record));
    const mappedIngredients = [];
    for (let ingredientIndex = 0; ingredientIndex < record.product.ingredients.length; ingredientIndex += 1) {
      const ingredient = record.product.ingredients[ingredientIndex];
      const status = mappingStatus(ingredient);
      let id = null;
      if (MAPPED_STATUSES.has(status)) {
        try {
          id = ingredientId(ingredient, `resolvedInputs[${inputIndex}].product.ingredients[${ingredientIndex}]`);
        } catch {
          id = null;
        }
      }
      if (id !== null) {
        mappedIngredients.push({ ingredient_id: id });
        mappedIngredientCount += 1;
      } else {
        const issueStatus = status === 'operational_error' ? status : (status || 'unmapped');
        unresolvedIngredientCount += 1;
        if (issueStatus === 'operational_error') mappingOperationalError = true;
        unresolved.push(mappingIssue(record, ingredient, ingredientIndex, issueStatus));
      }
    }
    mappedProducts.push({
      product_id: record.product.product_id,
      ingredients: mappedIngredients,
    });
  }

  const checked_pairs = generateCrossDrugPairs(mappedProducts);
  const checkedKeys = new Set(checked_pairs.map((entry) => entry.pair_key));
  const reviewed_findings = [];
  const packCandidates = [];
  for (const value of rulePack.rules) {
    if (!checkedKeys.has(pairKey(value.pair))) continue;
    if (value.review.status === 'clinician_reviewed') reviewed_findings.push(structuredClone(value));
    else packCandidates.push(structuredClone(value));
  }

  const suppliedCandidates = reviewCandidates.map((value, index) => ({
    value,
    key: validateReviewCandidate(value, index),
  }));
  const review_candidates = [
    ...packCandidates,
    ...suppliedCandidates
      .filter(({ key }) => checkedKeys.has(key))
      .map(({ value }) => structuredClone(value)),
  ].sort((left, right) => compareStrings(findingSortKey(left), findingSortKey(right)));
  reviewed_findings.sort((left, right) => compareStrings(findingSortKey(left), findingSortKey(right)));

  const product_resolution = coverageProductResolution(resolvedInputs, resolved.length);
  const ingredient_mapping = coverageIngredientMapping(
    mappedIngredientCount,
    unresolvedIngredientCount,
    mappingOperationalError,
  );
  const interaction_knowledge = rulePack.declared_coverage;
  const coverage = {
    product_resolution,
    ingredient_mapping,
    interaction_knowledge,
    overall: combineCoverage([product_resolution, ingredient_mapping, interaction_knowledge]),
  };

  return {
    resolved_inputs: resolved,
    reviewed_findings,
    review_candidates,
    unresolved_inputs: unresolved,
    duplicate_ingredients: duplicateIngredients(mappedProducts),
    checked_pairs,
    coverage,
    disclaimer: DISCLAIMER,
  };
}
