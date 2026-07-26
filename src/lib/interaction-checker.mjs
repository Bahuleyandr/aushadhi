export const DISCLAIMER = 'No listed interaction does not establish safety. Verify with a pharmacist or clinician and current approved labeling.';

const COVERAGE_VALUES = new Set(['complete', 'partial', 'unknown']);
const MAPPED_STATUSES = new Set(['exact', 'reviewed_override']);
const REVIEW_STATUSES = new Set(['clinician_reviewed', 'review_candidate']);
const DISPENSE_ACTIONS = new Set([
  'supply_with_counselling',
  'space_doses',
  'confirm_and_monitor',
  'withhold_and_clarify',
]);

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

function normalizeProductPair(value, label) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(`${label} must contain exactly two product identifiers`);
  }
  const pair = value.map((id, index) => requireString(id, `${label}[${index}]`));
  if (pair[0] === pair[1]) {
    throw new TypeError(`${label} requires two different product identifiers`);
  }
  return pair.sort(compareStrings);
}

function productPairKey(value) {
  return JSON.stringify(value);
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

function validateProductPairs(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${label} must contain at least one product pair`);
  }
  const seen = new Set();
  let previous = null;
  for (let index = 0; index < value.length; index += 1) {
    const pair = normalizeProductPair(value[index], `${label}[${index}]`);
    if (pair[0] !== value[index][0] || pair[1] !== value[index][1]) {
      throw new TypeError(`${label}[${index}] must use canonical order`);
    }
    const key = productPairKey(pair);
    if (seen.has(key)) throw new TypeError(`${label} must contain unique product pairs`);
    if (previous !== null && compareStrings(previous, key) >= 0) {
      throw new TypeError(`${label} must use deterministic canonical order`);
    }
    seen.add(key);
    previous = key;
  }
}

function validateRule(value, index) {
  const label = `rules[${index}]`;
  assertObject(value, label);
  assertExactKeys(value, new Set([
    'rule_id',
    'pair',
    'product_pairs',
    'applicability',
    'severity',
    'dispense_action',
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
  if (value.dispense_action !== null
    && !DISPENSE_ACTIONS.has(value.dispense_action)) {
    throw new TypeError(`${label}.dispense_action is invalid`);
  }
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
    validateProductPairs(value.product_pairs, `${label}.product_pairs`);
    if (!DISPENSE_ACTIONS.has(value.dispense_action)) {
      throw new TypeError(`${label}.dispense_action is required for clinician-reviewed rules`);
    }
    requireString(value.review.reviewer_id, `${label}.review.reviewer_id`);
    if (!isIsoDate(value.review.reviewed_at)) {
      throw new TypeError(`${label}.review.reviewed_at must be an ISO date`);
    }
    if (value.review.source_versions.length === 0) {
      throw new TypeError(`${label}.review.source_versions must contain at least one item`);
    }
  } else {
    if (value.dispense_action !== null) {
      throw new TypeError(`${label} review_candidate dispense_action must be null`);
    }
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

function hasReviewedRuntimeSubject(record, ingredient) {
  const presentation = record.product.presentation;
  const subject = ingredient?.runtime_subject;
  if (presentation?.status !== 'reviewed_override' || !isObject(subject)) return false;
  for (const field of ['drug', 'route', 'formulation']) {
    if (typeof subject[field] !== 'string' || subject[field].trim() === '') return false;
  }
  if (subject.route !== presentation.route || subject.formulation !== presentation.formulation) {
    return false;
  }
  return ingredient.runtime_drug === undefined || subject.drug === ingredient.runtime_drug;
}

function presentationIssueStatus(record) {
  const status = record.product.presentation?.status;
  if (status === 'stale') return 'stale_presentation';
  if (status === 'operational_error') return 'operational_error';
  return 'unmapped_presentation';
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

function checkedPairMatchesRule(checkedPair, rule) {
  if (!Array.isArray(rule.product_pairs)) return true;
  const allowed = new Set(rule.product_pairs.map(productPairKey));
  return checkedPair.product_pairs.some((pair) => allowed.has(productPairKey(pair)));
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

function projectReviewCandidate(value) {
  const pair = value.pair === undefined
    ? undefined
    : normalizePairArguments(value.pair);
  const pair_key = value.pair_key ?? pairKey(pair);
  return {
    candidate_id: value.candidate_id ?? value.rule_id ?? `candidate:${pair_key}`,
    ...(pair === undefined ? {} : { pair }),
    pair_key,
    ...(Array.isArray(value.product_pairs)
      ? { product_pairs: structuredClone(value.product_pairs) }
      : {}),
    evidence: structuredClone(value.evidence),
    review_status: 'review_candidate',
    severity: 'unknown',
    mechanism: null,
    management: null,
    inference_class: value.inference_class ?? 'source_grounded_review_candidate',
  };
}

function outcomeFor({
  reviewedFindings,
  reviewCandidates,
  unresolvedInputs,
  duplicateIngredients: duplicates,
  checkedPairs,
}) {
  if (reviewedFindings.length > 0) return 'reviewed_action_required';
  if (reviewCandidates.length > 0) return 'manual_review_required';
  if (unresolvedInputs.length > 0) return 'input_gaps';
  if (duplicates.length > 0 && checkedPairs.length === 0) {
    return 'therapeutic_duplication_only';
  }
  if (checkedPairs.length === 0) return 'no_cross_drug_pair';
  return 'no_reviewed_finding';
}

function clinicalStatusFor({
  reviewedFindings,
  reviewCandidates,
  checkedPairs,
}) {
  if (reviewedFindings.length > 0) return 'reviewed_interaction_found';
  if (reviewCandidates.length > 0) return 'review_candidate_found';
  if (checkedPairs.length === 0) return 'not_evaluated';
  return 'no_reviewed_interaction_found';
}

function buildNotEvaluated({
  unresolvedInputs,
  checkedPairs,
  rulePack,
}) {
  const entries = unresolvedInputs.map((input, index) => ({
    code: 'INPUT_GAP',
    input_gap_index: index,
    status: input.status ?? 'unknown',
    ...(input.input === undefined ? {} : { input: structuredClone(input.input) }),
    ...(input.product_id === undefined ? {} : { product_id: input.product_id }),
  }));
  if (checkedPairs.length === 0) {
    entries.push({
      code: 'NO_CROSS_DRUG_PAIR_EVALUATED',
      reason: unresolvedInputs.length > 0
        ? 'Input or mapping gaps prevented generation of a complete cross-drug pair.'
        : 'The supplied products did not produce a cross-drug ingredient pair.',
    });
  }
  if (rulePack.declared_coverage !== 'complete') {
    entries.push({
      code: 'RULE_PACK_COVERAGE_INCOMPLETE',
      declared_coverage: rulePack.declared_coverage,
      reason: 'Pairs outside the reviewed rule pack are not evaluated as complete knowledge.',
    });
  }
  return entries;
}

function buildCapabilityLimitations(rulePack) {
  const limitations = [{
    code: 'NO_LISTED_INTERACTION_IS_NOT_SAFETY',
    message: DISCLAIMER,
  }];
  if (rulePack.rules.some((rule) => Array.isArray(rule.product_pairs))) {
    limitations.push({
      code: 'EXACT_REVIEWED_PRODUCT_SCOPE_ONLY',
      message: 'Reviewed findings apply only to the exact approved product-presentation pairs.',
    });
  }
  if (rulePack.declared_coverage !== 'complete') {
    limitations.push({
      code: 'RULE_PACK_NOT_UNIVERSALLY_COMPLETE',
      message: `The loaded rule pack declares ${rulePack.declared_coverage} interaction coverage.`,
    });
  }
  return limitations;
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
  let mappedPresentationCount = 0;
  let unresolvedPresentationCount = 0;
  let presentationOperationalError = false;

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
    if (record.product.presentation?.status === 'reviewed_override') {
      mappedPresentationCount += 1;
    } else {
      unresolvedPresentationCount += 1;
      if (record.product.presentation?.status === 'operational_error') {
        presentationOperationalError = true;
      }
    }
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
        mappedIngredientCount += 1;
        if (hasReviewedRuntimeSubject(record, ingredient)) {
          mappedIngredients.push({ ingredient_id: id });
        } else {
          unresolved.push(mappingIssue(
            record,
            ingredient,
            ingredientIndex,
            presentationIssueStatus(record),
          ));
        }
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
  const checkedByKey = new Map(checked_pairs.map((entry) => [entry.pair_key, entry]));
  const checkedKeys = new Set(checkedByKey.keys());
  const reviewed_findings = [];
  const packCandidates = [];
  for (const value of rulePack.rules) {
    const checkedPair = checkedByKey.get(pairKey(value.pair));
    if (!checkedPair || !checkedPairMatchesRule(checkedPair, value)) continue;
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
  ]
    .map(projectReviewCandidate)
    .sort((left, right) => compareStrings(findingSortKey(left), findingSortKey(right)));
  reviewed_findings.sort((left, right) => compareStrings(findingSortKey(left), findingSortKey(right)));

  const product_resolution = coverageProductResolution(resolvedInputs, resolved.length);
  const ingredient_mapping = coverageIngredientMapping(
    mappedIngredientCount,
    unresolvedIngredientCount,
    mappingOperationalError,
  );
  const presentation_mapping = coverageIngredientMapping(
    mappedPresentationCount,
    unresolvedPresentationCount,
    presentationOperationalError,
  );
  const interaction_knowledge = rulePack.declared_coverage;
  const coverage = {
    product_resolution,
    ingredient_mapping,
    presentation_mapping,
    interaction_knowledge,
    overall: combineCoverage([
      product_resolution,
      ingredient_mapping,
      presentation_mapping,
      interaction_knowledge,
    ]),
  };
  const duplicate_ingredients = duplicateIngredients(mappedProducts);
  const input_gaps = structuredClone(unresolved);
  const checks_performed = {
    profile: rulePack.profile,
    rule_pack_id: rulePack.pack_id,
    rule_pack_version: rulePack.pack_version,
    product_resolution: {
      status: product_resolution,
      input_count: resolvedInputs.length,
      resolved_count: resolved.length,
    },
    ingredient_identity_mapping: {
      status: ingredient_mapping,
      mapped_count: mappedIngredientCount,
      unresolved_count: unresolvedIngredientCount,
    },
    product_presentation_mapping: {
      status: presentation_mapping,
      mapped_count: mappedPresentationCount,
      unresolved_count: unresolvedPresentationCount,
    },
    therapeutic_duplication: {
      status: 'performed',
      finding_count: duplicate_ingredients.length,
    },
    cross_drug_pair_generation: {
      status: 'performed',
      checked_pair_count: checked_pairs.length,
    },
    reviewed_rule_matching: {
      status: checked_pairs.length > 0 ? 'performed' : 'not_performed',
      reviewed_finding_count: reviewed_findings.length,
      review_candidate_count: review_candidates.length,
    },
    checked_pair_count: checked_pairs.length,
  };
  const not_evaluated = buildNotEvaluated({
    unresolvedInputs: unresolved,
    checkedPairs: checked_pairs,
    rulePack,
  });
  const outcome_code = outcomeFor({
    reviewedFindings: reviewed_findings,
    reviewCandidates: review_candidates,
    unresolvedInputs: unresolved,
    duplicateIngredients: duplicate_ingredients,
    checkedPairs: checked_pairs,
  });
  const clinical_interaction_status = clinicalStatusFor({
    reviewedFindings: reviewed_findings,
    reviewCandidates: review_candidates,
    checkedPairs: checked_pairs,
  });

  return {
    clinical_interaction_status,
    outcome_code,
    checks_performed,
    input_gaps,
    not_evaluated,
    capability_limitations: buildCapabilityLimitations(rulePack),
    resolved_inputs: resolved,
    reviewed_findings,
    review_candidates,
    unresolved_inputs: unresolved,
    duplicate_ingredients,
    checked_pairs,
    coverage,
    disclaimer: DISCLAIMER,
  };
}
