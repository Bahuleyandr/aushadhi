import {
  assertAuthenticReviewedCombinationMappedProduct,
  assertReviewedCombinationMappedProduct,
} from './interaction-mapping.mjs';
import {
  strictPlainDataSnapshot,
  strictPlainDataSnapshotAllowShared,
} from './strict-plain-data.mjs';
import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';

export const DISCLAIMER = 'No listed interaction does not establish safety. Verify with a pharmacist or clinician and current approved labeling.';

const COVERAGE_VALUES = new Set(['complete', 'partial', 'unknown']);
const MAPPED_STATUSES = new Set(['exact', 'reviewed_override']);
const REVIEW_STATUSES = new Set(['clinician_reviewed', 'review_candidate']);
const RULE_PACK_SCHEMA_VERSIONS = new Set(['1.0.0', '1.1.0']);
const SUBJECT_SPECIFICITY_RANK = new Map([
  ['exact_member', 1],
  ['exact_fixed_dose_combination', 2],
]);
const BASE_RULE_KEYS = new Set([
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
]);
const SUPERSESSION_RULE_KEYS = Object.freeze([
  'interaction_family_id',
  'subject_specificity',
  'subject_roles',
  'supersedes_rule_ids',
]);
const DISPENSE_ACTIONS = new Set([
  'supply_with_counselling',
  'space_doses',
  'confirm_and_monitor',
  'withhold_and_clarify',
]);
// Mirrors the draft-side enum (interaction-engine.mjs / interaction-draft-validation.mjs).
// Review candidates are separately pinned to severity 'unknown'.
const SEVERITIES = new Set(['minor', 'moderate', 'major', 'contraindicated']);
const SHA256 = /^[0-9a-f]{64}$/u;
const COMMITTED_INTERNAL_PACK_ID = 'aushadhi-internal-interactions';
const INTERNAL_CLINICIAN_SOURCE_ID = 'aushadhi-open-clinician-rules';
// Changing this opaque scope allowlist is part of the authenticated hold-clearance path.
const REQUIRED_COMMITTED_HOLD_SCOPE_LEAF_HASHES = Object.freeze([
  '3226817098a8fe14a6ee9db1160c17454a297629cfcea845f03795cb7a250b1b',
  '3986a8b62eb3ae04753680133fb9326188435b986f144454ae361c2a41c9974c',
  '3c01f53f52139f0a013f33c088187b68508e04e79d7906e9ffd91d86b2f477d6',
  '4a165c47c38bce0b0818436d31efb273ff7ca4e00ee40b74017e42027ce8d25f',
  '4f64e604aa238cdb860479f332d6115fac5637eb1bf8e88ff9ada5ad8a5b8b79',
  '6325fd99ac2476c7dcf5c97c4e5724a71a75b2ae479a5eb48dd677a87d279b01',
  '7320131abb96a1329914aef2d232e00946ffaa2e1cefc8fe32daccc01fd453c9',
  'ad04962754e792fa608d66337bf69a1cae44d6285003f8e771c99a3976ebb49f',
  'ad449bccad346b0066a49c001e449320184d993d507385a83a340cf4843f57dd',
  'c304ee0b0085dc8d06f03eb213f988d2eff8a5c520f61cdbd6ba99256457c4ab',
  'dd048ed185dff0fec675855149312949b3c6f26e46ff00f3eae5cf83f89785ab',
  'fa9e12c44b95a9379685943b16c4b976d6a5531a9e3da7a2ba1bc5d432f16b64',
]);
const TECHNICAL_HOLD_KEYS = new Set([
  'rule_id',
  'pair',
  'product_pairs',
  'evidence_source_id',
  'status',
  'reason',
  'detected_at',
  'approved_source_version',
  'observed_source_version',
  'approved_payload_sha256',
  'observed_payload_sha256',
]);

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort(compareStrings).map((key) => [
        key,
        canonicalJsonValue(value[key]),
      ]),
    );
  }
  return value;
}

function sha256Canonical(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJsonValue(value)))
    .digest('hex');
}

export function technicalHoldsSha256(holds) {
  if (!Array.isArray(holds)) throw new TypeError('technical holds must be an array');
  return sha256Canonical(holds);
}

function technicalHoldScopeLeafHash(pair, productPair) {
  return sha256Canonical({ pair, product_pair: productPair });
}

function technicalHoldScopeLeaves(holds) {
  return holds.flatMap((hold) => hold.product_pairs.map((productPair) => (
    technicalHoldScopeLeafHash(hold.pair, productPair)
  ))).sort(compareStrings);
}

function belongsToCommittedInternalFamily(rulePack) {
  return rulePack.profile === 'internal-evaluation'
    && (
      rulePack.pack_id === COMMITTED_INTERNAL_PACK_ID
      || rulePack.source_ids.includes(INTERNAL_CLINICIAN_SOURCE_ID)
    );
}

function assertExactCommittedHoldScope(holds) {
  const actual = technicalHoldScopeLeaves(holds);
  if (JSON.stringify(actual) !== JSON.stringify(REQUIRED_COMMITTED_HOLD_SCOPE_LEAF_HASHES)) {
    throw new TypeError(
      'technical hold pack required held scope does not match the committed held scope',
    );
  }
}

function assertNoActiveHistoricallyHeldScope(rulePack) {
  if (rulePack.profile !== 'internal-evaluation') return;
  for (const rule of rulePack.rules) {
    for (const productPair of rule.product_pairs ?? []) {
      const leafHash = technicalHoldScopeLeafHash(rule.pair, productPair);
      if (REQUIRED_COMMITTED_HOLD_SCOPE_LEAF_HASHES.includes(leafHash)) {
        throw new TypeError(
          `active rule overlaps a historically held scope: ${rule.rule_id}`,
        );
      }
    }
  }
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

function stableResolvedInputEnvelope(value, label) {
  assertObject(value, label);
  if (utilTypes.isProxy(value)) throw new TypeError(`${label} may not be a Proxy`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must use a plain object prototype`);
  }
  const stable = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new TypeError(`${label} may not contain symbol properties`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(
        `${label}.${key} must be an enumerable data property; accessors are forbidden`,
      );
    }
    Object.defineProperty(stable, key, {
      value: key === 'product'
        ? descriptor.value
        : strictPlainDataSnapshot(descriptor.value, `${label}.${key}`),
      enumerable: true,
      writable: false,
      configurable: false,
    });
  }
  return Object.freeze(stable);
}

function stableResolvedProduct(value, label) {
  try {
    assertAuthenticReviewedCombinationMappedProduct(value);
    return value;
  } catch {
    return strictPlainDataSnapshotAllowShared(value, label);
  }
}

function assertCanonicalStringArray(value, label) {
  assertStringArray(value, label, { unique: true });
  for (let index = 1; index < value.length; index += 1) {
    if (compareStrings(value[index - 1], value[index]) >= 0) {
      throw new TypeError(`${label} must use deterministic canonical order`);
    }
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
      // The same product supplied twice cannot interact with itself: a
      // degenerate [X, X] product pair is a shape validateProductPairs
      // forbids, and pairing an FDC's own components against each other
      // would surface intra-product pairs that cross-drug checking never
      // generates. Duplicate entry is still reported as therapeutic
      // duplication by duplicateIngredients.
      if (left.product_id === right.product_id) continue;
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

function validateSupersessionFields(value, label) {
  requireString(value.interaction_family_id, `${label}.interaction_family_id`);
  if (!SUBJECT_SPECIFICITY_RANK.has(value.subject_specificity)) {
    throw new TypeError(`${label}.subject_specificity is invalid`);
  }
  const combinationSubjects = value.pair.filter((subject) => subject.startsWith('combination:'));
  if (value.subject_specificity === 'exact_fixed_dose_combination'
      && combinationSubjects.length !== 1) {
    throw new TypeError(
      `${label}.subject_specificity exact_fixed_dose_combination requires exactly one combination subject`,
    );
  }
  if (value.subject_specificity === 'exact_member' && combinationSubjects.length !== 0) {
    throw new TypeError(
      `${label}.subject_specificity exact_member must not use a combination subject`,
    );
  }
  assertObject(value.subject_roles, `${label}.subject_roles`);
  assertExactKeys(
    value.subject_roles,
    new Set(['object', 'perpetrator']),
    `${label}.subject_roles`,
  );
  const objectSubject = requireString(
    value.subject_roles.object,
    `${label}.subject_roles.object`,
  );
  const perpetratorSubject = requireString(
    value.subject_roles.perpetrator,
    `${label}.subject_roles.perpetrator`,
  );
  if (objectSubject === perpetratorSubject) {
    throw new TypeError(`${label}.subject_roles must identify two different subjects`);
  }
  const rolePair = [objectSubject, perpetratorSubject].sort(compareStrings);
  if (rolePair[0] !== value.pair[0] || rolePair[1] !== value.pair[1]) {
    throw new TypeError(`${label}.subject_roles must map exactly to pair`);
  }
  assertCanonicalStringArray(value.supersedes_rule_ids, `${label}.supersedes_rule_ids`);
}

function validateLicenceNotices(value) {
  assertObject(value, 'licence_notices');
  const required = new Set([
    'attribution',
    'licence_notice',
    'licence_id',
    'licence_url',
    'source_url',
    'changes',
  ]);
  for (const [sourceId, notice] of Object.entries(value)) {
    const label = `licence_notices.${sourceId}`;
    assertObject(notice, label);
    assertExactKeys(notice, required, label);
    for (const field of ['attribution', 'licence_notice', 'licence_id', 'changes']) {
      requireString(notice[field], `${label}.${field}`);
    }
    for (const field of ['licence_url', 'source_url']) {
      const raw = requireString(notice[field], `${label}.${field}`);
      if (raw !== raw.trim() || !raw.startsWith('https://')) {
        throw new TypeError(`${label}.${field} must be a canonical HTTPS URL`);
      }
      let url;
      try {
        url = new URL(raw);
      } catch {
        throw new TypeError(`${label}.${field} must be a valid HTTPS URL`);
      }
      if (url.protocol !== 'https:') {
        throw new TypeError(`${label}.${field} must be a valid HTTPS URL`);
      }
    }
  }
}

function validateRule(value, index, schemaVersion) {
  const label = `rules[${index}]`;
  assertObject(value, label);
  const allowedKeys = schemaVersion === '1.1.0'
    ? new Set([...BASE_RULE_KEYS, ...SUPERSESSION_RULE_KEYS])
    : BASE_RULE_KEYS;
  assertExactKeys(value, allowedKeys, label);
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
    if (!SEVERITIES.has(value.severity)) {
      throw new TypeError(`${label}.severity is invalid`);
    }
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

  const suppliedSupersessionFields = SUPERSESSION_RULE_KEYS.filter(
    (key) => Object.hasOwn(value, key),
  );
  if (suppliedSupersessionFields.length > 0) {
    if (suppliedSupersessionFields.length !== SUPERSESSION_RULE_KEYS.length) {
      throw new TypeError(`${label} must provide all supersession fields together`);
    }
    if (value.review.status !== 'clinician_reviewed') {
      throw new TypeError(`${label} supersession fields require clinician_reviewed status`);
    }
    validateSupersessionFields(value, label);
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
  rulePack = strictPlainDataSnapshot(rulePack, 'rule pack');
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
  if (!RULE_PACK_SCHEMA_VERSIONS.has(rulePack.schema_version)) {
    throw new TypeError('rule pack schema_version must be 1.0.0 or 1.1.0');
  }
  requireString(rulePack.pack_id, 'rule pack pack_id');
  requireString(rulePack.pack_version, 'rule pack pack_version');
  if (rulePack.profile !== 'production-open' && rulePack.profile !== 'internal-evaluation') {
    throw new TypeError('rule pack profile is invalid');
  }
  requireString(rulePack.licence, 'rule pack licence');
  assertStringArray(rulePack.source_ids, 'rule pack source_ids', { minItems: 1, unique: true });
  validateLicenceNotices(rulePack.licence_notices);
  if (!COVERAGE_VALUES.has(rulePack.declared_coverage)) {
    throw new TypeError('rule pack declared_coverage is invalid');
  }
  if (!Array.isArray(rulePack.rules)) throw new TypeError('rule pack rules must be an array');
  if (rulePack.rules.length === 0 && rulePack.declared_coverage === 'complete') {
    throw new TypeError('empty rule pack cannot declare complete coverage');
  }

  const ruleIds = new Set();
  const rulesById = new Map();
  const pairKeys = new Set();
  for (let index = 0; index < rulePack.rules.length; index += 1) {
    const value = rulePack.rules[index];
    validateRule(value, index, rulePack.schema_version);
    if (ruleIds.has(value.rule_id)) throw new TypeError(`duplicate rule_id ${value.rule_id}`);
    ruleIds.add(value.rule_id);
    rulesById.set(value.rule_id, value);
    const key = pairKey(value.pair);
    if (pairKeys.has(key)) throw new TypeError(`duplicate rule pair ${key}`);
    pairKeys.add(key);
  }
  assertNoActiveHistoricallyHeldScope(rulePack);

  if (rulePack.schema_version === '1.1.0') {
    const suppressorsByTarget = new Map();
    for (const suppressor of rulePack.rules) {
      if (!Array.isArray(suppressor.supersedes_rule_ids)) continue;
      for (const targetId of suppressor.supersedes_rule_ids) {
        if (targetId === suppressor.rule_id) {
          throw new TypeError(`rule ${suppressor.rule_id} must not supersede itself`);
        }
        const target = rulesById.get(targetId);
        if (target === undefined) {
          throw new TypeError(`rule ${suppressor.rule_id} supersedes unknown rule ${targetId}`);
        }
        if (target.review.status !== 'clinician_reviewed'
            || suppressor.review.status !== 'clinician_reviewed') {
          throw new TypeError('supersession endpoints must be clinician_reviewed');
        }
        if (!SUPERSESSION_RULE_KEYS.every((key) => Object.hasOwn(target, key))) {
          throw new TypeError(`superseded rule ${targetId} must declare supersession metadata`);
        }
        if (suppressor.interaction_family_id !== target.interaction_family_id) {
          throw new TypeError(
            `rule ${suppressor.rule_id} must not supersede a different interaction family`,
          );
        }
        if (suppressor.subject_roles.object !== target.subject_roles.object) {
          throw new TypeError(
            `rule ${suppressor.rule_id} must not supersede a rule with a different object subject`,
          );
        }
        if (SUBJECT_SPECIFICITY_RANK.get(suppressor.subject_specificity)
            <= SUBJECT_SPECIFICITY_RANK.get(target.subject_specificity)) {
          throw new TypeError(
            `rule ${suppressor.rule_id} must be more specific than superseded rule ${targetId}`,
          );
        }
        const suppressorProductPairs = new Set(
          suppressor.product_pairs.map(productPairKey),
        );
        if (!target.product_pairs.some((pair) => suppressorProductPairs.has(productPairKey(pair)))) {
          throw new TypeError(
            `rule ${suppressor.rule_id} and superseded rule ${targetId} must overlap product pairs`,
          );
        }
        const suppressors = suppressorsByTarget.get(targetId) ?? [];
        suppressors.push(suppressor);
        suppressorsByTarget.set(targetId, suppressors);
      }
    }
    for (const [targetId, suppressors] of suppressorsByTarget) {
      const target = rulesById.get(targetId);
      for (const pair of target.product_pairs) {
        const key = productPairKey(pair);
        const overlappingSuppressors = suppressors.filter(
          (suppressor) => suppressor.product_pairs.some(
            (suppressorPair) => productPairKey(suppressorPair) === key,
          ),
        );
        if (overlappingSuppressors.length > 1) {
          throw new TypeError(
            `superseded rule ${targetId} has multiple eligible suppressors for product pair ${key}`,
          );
        }
      }
    }
  }
  return true;
}

function requireAllKeys(value, keys, label) {
  assertExactKeys(value, keys, label);
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) throw new TypeError(`${label} is missing property ${key}`);
  }
}

function validateTechnicalHold(value, index) {
  const label = `technical hold pack holds[${index}]`;
  assertObject(value, label);
  requireAllKeys(value, TECHNICAL_HOLD_KEYS, label);
  requireString(value.rule_id, `${label}.rule_id`);
  requireString(value.evidence_source_id, `${label}.evidence_source_id`);
  if (!Array.isArray(value.pair) || value.pair.length !== 2) {
    throw new TypeError(`${label}.pair must contain exactly two ingredient identifiers`);
  }
  const canonicalPair = normalizePairArguments(value.pair);
  if (JSON.stringify(value.pair) !== JSON.stringify(canonicalPair)) {
    throw new TypeError(`${label}.pair must use canonical order`);
  }
  validateProductPairs(value.product_pairs, `${label}.product_pairs`);
  if (value.status !== 'held') throw new TypeError(`${label}.status must equal held`);
  if (value.reason !== 'live_provenance_drift') {
    throw new TypeError(`${label}.reason must equal live_provenance_drift`);
  }
  if (!isIsoDate(value.detected_at)) {
    throw new TypeError(`${label}.detected_at must be an ISO date`);
  }
  requireString(value.approved_source_version, `${label}.approved_source_version`);
  requireString(value.observed_source_version, `${label}.observed_source_version`);
  for (const field of ['approved_payload_sha256', 'observed_payload_sha256']) {
    if (!SHA256.test(value[field] ?? '')) {
      throw new TypeError(`${label}.${field} must be a lowercase SHA-256`);
    }
  }
  if (value.approved_source_version === value.observed_source_version
      && value.approved_payload_sha256 === value.observed_payload_sha256) {
    throw new TypeError(`${label} does not record provenance drift`);
  }
}

export function validateTechnicalHoldPack(technicalHoldPack, {
  rulePack,
  promotionHoldManifestSha256,
  runtimeHoldScopeSha256,
} = {}) {
  if (!isObject(technicalHoldPack)) throw new TypeError('technical hold pack must be an object');
  technicalHoldPack = strictPlainDataSnapshot(technicalHoldPack, 'technical hold pack');
  const keys = new Set([
    'schema_version',
    'profile',
    'rule_pack_id',
    'rule_pack_version',
    'rule_pack_sha256',
    'promotion_hold_manifest_sha256',
    'holds_sha256',
    'holds',
  ]);
  requireAllKeys(technicalHoldPack, keys, 'technical hold pack');
  if (technicalHoldPack.schema_version !== 2) {
    throw new TypeError('technical hold pack schema_version must equal 2');
  }
  if (technicalHoldPack.profile !== 'internal-evaluation') {
    throw new TypeError('technical hold pack profile must be internal-evaluation');
  }
  requireString(technicalHoldPack.rule_pack_id, 'technical hold pack rule_pack_id');
  requireString(technicalHoldPack.rule_pack_version, 'technical hold pack rule_pack_version');
  for (const field of [
    'rule_pack_sha256',
    'promotion_hold_manifest_sha256',
    'holds_sha256',
  ]) {
    if (!SHA256.test(technicalHoldPack[field] ?? '')) {
      throw new TypeError(`technical hold pack ${field} must be a lowercase SHA-256`);
    }
  }
  if (!Array.isArray(technicalHoldPack.holds)) {
    throw new TypeError('technical hold pack holds must be an array');
  }
  const seenRuleIds = new Set();
  const seenScopeLeaves = new Set();
  let previousRuleId = null;
  for (let index = 0; index < technicalHoldPack.holds.length; index += 1) {
    const hold = technicalHoldPack.holds[index];
    validateTechnicalHold(hold, index);
    if (seenRuleIds.has(hold.rule_id)) {
      throw new TypeError(`technical hold pack contains duplicate rule_id ${hold.rule_id}`);
    }
    if (previousRuleId !== null && compareStrings(previousRuleId, hold.rule_id) >= 0) {
      throw new TypeError('technical hold pack holds must use deterministic rule_id order');
    }
    seenRuleIds.add(hold.rule_id);
    previousRuleId = hold.rule_id;
    for (const productPair of hold.product_pairs) {
      const leafHash = technicalHoldScopeLeafHash(hold.pair, productPair);
      if (seenScopeLeaves.has(leafHash)) {
        throw new TypeError('technical hold pack contains duplicate exact held scope');
      }
      seenScopeLeaves.add(leafHash);
    }
  }
  const computedHoldsSha256 = technicalHoldsSha256(technicalHoldPack.holds);
  if (technicalHoldPack.holds_sha256 !== computedHoldsSha256) {
    throw new TypeError('technical hold pack holds SHA-256 does not match');
  }
  let committedInternalFamily = technicalHoldPack.rule_pack_id === COMMITTED_INTERNAL_PACK_ID;
  if (rulePack !== undefined) {
    rulePack = strictPlainDataSnapshot(rulePack, 'rule pack');
    validateRulePack(rulePack);
    if (technicalHoldPack.profile !== rulePack.profile
        || technicalHoldPack.rule_pack_id !== rulePack.pack_id
        || technicalHoldPack.rule_pack_version !== rulePack.pack_version) {
      throw new TypeError('technical hold pack identity does not match the rule pack');
    }
    const expectedHash = createHash('sha256')
      .update(`${JSON.stringify(rulePack, null, 2)}\n`)
      .digest('hex');
    if (technicalHoldPack.rule_pack_sha256 !== expectedHash) {
      throw new TypeError('technical hold pack rule pack SHA-256 does not match');
    }
    committedInternalFamily = belongsToCommittedInternalFamily(rulePack);
    const activeRuleIds = new Set(rulePack.rules.map((rule) => rule.rule_id));
    for (const hold of technicalHoldPack.holds) {
      if (activeRuleIds.has(hold.rule_id)) {
        throw new TypeError(`technical hold ${hold.rule_id} must not also be an active rule`);
      }
    }
  }
  if (committedInternalFamily) assertExactCommittedHoldScope(technicalHoldPack.holds);
  if (promotionHoldManifestSha256 !== undefined) {
    if (!SHA256.test(promotionHoldManifestSha256)) {
      throw new TypeError('promotion hold manifest SHA-256 must be a lowercase SHA-256');
    }
    if (technicalHoldPack.promotion_hold_manifest_sha256
        !== promotionHoldManifestSha256) {
      throw new TypeError('technical hold pack promotion manifest SHA-256 does not match');
    }
  }
  if (runtimeHoldScopeSha256 !== undefined) {
    if (!SHA256.test(runtimeHoldScopeSha256)) {
      throw new TypeError('runtime hold scope SHA-256 must be a lowercase SHA-256');
    }
    if (technicalHoldPack.holds_sha256 !== runtimeHoldScopeSha256) {
      throw new TypeError('technical hold pack runtime hold scope SHA-256 does not match');
    }
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

function hasReviewedRuntimeSubject(product, ingredient) {
  const presentation = product.presentation;
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

function reviewedCombinationSubjectId(product, expectedProfile) {
  const combination = product.combination;
  const presentation = product.presentation;
  if (!isObject(combination) || combination.status !== 'reviewed_override') return null;
  try {
    assertReviewedCombinationMappedProduct(product, expectedProfile);
  } catch {
    return null;
  }
  if (typeof combination.combination_id !== 'string'
      || combination.combination_id.trim() === '') {
    return null;
  }
  if (!isObject(presentation)
      || presentation.status !== 'reviewed_override'
      || presentation.mapping_scope !== 'reviewed_combination_product'
      || presentation.combination_id !== combination.combination_id) {
    return null;
  }
  const subject = combination.runtime_subject;
  if (!isObject(subject)) return null;
  for (const field of ['drug', 'route', 'formulation']) {
    if (typeof subject[field] !== 'string' || subject[field].trim() === '') return null;
  }
  if (subject.route !== presentation.route || subject.formulation !== presentation.formulation) {
    return null;
  }
  if (!Array.isArray(combination.components) || combination.components.length < 2) return null;

  const componentIds = new Set();
  for (const component of combination.components) {
    if (!isObject(component)
        || typeof component.runtime_ingredient_id !== 'string'
        || component.runtime_ingredient_id.trim() === ''
        || typeof component.assertion_ingredient_id !== 'string'
        || component.assertion_ingredient_id.trim() === '') {
      return null;
    }
    componentIds.add(component.runtime_ingredient_id);
  }
  if (componentIds.size !== combination.components.length) return null;

  const mappedIngredientIds = new Set();
  for (const ingredient of product.ingredients) {
    if (!MAPPED_STATUSES.has(mappingStatus(ingredient))) continue;
    if (!hasReviewedRuntimeSubject(product, ingredient)) continue;
    try {
      mappedIngredientIds.add(ingredientId(ingredient, 'combination component'));
    } catch {
      return null;
    }
  }
  if (mappedIngredientIds.size !== componentIds.size
      || ![...componentIds].every((id) => mappedIngredientIds.has(id))) {
    return null;
  }
  return combination.combination_id;
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

function matchedProductPairs(checkedPair, rule) {
  if (!Array.isArray(rule.product_pairs)) {
    return structuredClone(checkedPair.product_pairs);
  }
  const allowed = new Set(rule.product_pairs.map(productPairKey));
  return checkedPair.product_pairs
    .filter((pair) => allowed.has(productPairKey(pair)))
    .map((pair) => [...pair]);
}

function canSupersedeExactProductMatch(suppressor, candidate) {
  if (suppressor === candidate) return false;
  if (!Array.isArray(suppressor.rule.supersedes_rule_ids)
      || !suppressor.rule.supersedes_rule_ids.includes(candidate.rule.rule_id)) {
    return false;
  }
  if (!isObject(candidate.rule.subject_roles)) return false;
  if (suppressor.rule.interaction_family_id !== candidate.rule.interaction_family_id) return false;
  if (suppressor.rule.subject_roles.object !== candidate.rule.subject_roles.object) return false;
  if (SUBJECT_SPECIFICITY_RANK.get(suppressor.rule.subject_specificity)
      <= SUBJECT_SPECIFICITY_RANK.get(candidate.rule.subject_specificity)) {
    return false;
  }
  const suppressorPairs = new Set(suppressor.matched_product_pairs.map(productPairKey));
  return candidate.matched_product_pairs.length > 0
    && candidate.matched_product_pairs.every(
      (pair) => suppressorPairs.has(productPairKey(pair)),
    );
}

function applyExactProductSupersession(matches) {
  const surviving = [];
  const superseded = [];
  for (const candidate of matches) {
    const eligibleSuppressors = matches.filter(
      (suppressor) => canSupersedeExactProductMatch(suppressor, candidate),
    );
    if (eligibleSuppressors.length !== 1) {
      surviving.push(candidate);
      continue;
    }
    const [suppressor] = eligibleSuppressors;
    superseded.push({
      ...structuredClone(candidate.rule),
      matched_product_pairs: structuredClone(candidate.matched_product_pairs),
      superseded_by: suppressor.rule.rule_id,
      superseded_reason: 'more_specific_rule_in_the_same_interaction_family',
    });
  }
  return { surviving, superseded };
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
  technicalHoldMatches,
  unresolvedInputs,
  duplicateIngredients: duplicates,
  checkedPairs,
}) {
  if (technicalHoldMatches.length > 0 && reviewedFindings.length > 0) {
    return 'reviewed_action_and_manual_review_required';
  }
  if (reviewedFindings.length > 0) return 'reviewed_action_required';
  if (technicalHoldMatches.length > 0) return 'manual_review_required';
  if (reviewCandidates.length > 0) return 'manual_review_required';
  if (unresolvedInputs.length > 0) return 'input_gaps';
  if (duplicates.length > 0 && checkedPairs.length === 0) {
    return 'therapeutic_duplication_only';
  }
  if (checkedPairs.length === 0) return 'no_cross_drug_pair';
  // A duplication finding must stay visible in the outcome even when
  // cross-drug pairs were checked: consumers keying UI or alerting off
  // outcome_code must not see a plain "no reviewed finding" while a
  // double-dosing signal sits only in duplicate_ingredients.
  if (duplicates.length > 0) return 'no_reviewed_finding_with_duplication';
  return 'no_reviewed_finding';
}

function clinicalStatusFor({
  reviewedFindings,
  reviewCandidates,
  technicalHoldMatches,
  checkedPairs,
}) {
  if (technicalHoldMatches.length > 0 && reviewedFindings.length > 0) {
    return 'reviewed_interaction_found_with_unevaluated_scope';
  }
  if (technicalHoldMatches.length > 0 && reviewCandidates.length > 0) {
    return 'review_candidate_found_with_unevaluated_scope';
  }
  if (reviewedFindings.length > 0) return 'reviewed_interaction_found';
  if (technicalHoldMatches.length > 0) return 'not_evaluated';
  if (reviewCandidates.length > 0) return 'review_candidate_found';
  if (checkedPairs.length === 0) return 'not_evaluated';
  return 'no_reviewed_interaction_found';
}

function buildNotEvaluated({
  unresolvedInputs,
  checkedPairs,
  rulePack,
  technicalHoldMatches,
}) {
  const entries = unresolvedInputs.map((input, index) => ({
    code: 'INPUT_GAP',
    input_gap_index: index,
    status: input.status ?? 'unknown',
    ...(input.input === undefined ? {} : { input: structuredClone(input.input) }),
    ...(input.product_id === undefined ? {} : { product_id: input.product_id }),
  }));
  for (const match of technicalHoldMatches) {
    entries.push({
      code: 'PROMOTION_HELD_LIVE_PROVENANCE_DRIFT',
      rule_id: match.hold.rule_id,
      reason: match.hold.reason,
      detected_at: match.hold.detected_at,
      matched_product_pairs: structuredClone(match.matched_product_pairs),
    });
  }
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
  technicalHoldPack,
} = {}) {
  if (!Array.isArray(resolvedInputs)) throw new TypeError('resolvedInputs must be an array');
  if (!Array.isArray(reviewCandidates)) throw new TypeError('reviewCandidates must be an array');
  rulePack = strictPlainDataSnapshot(rulePack, 'rule pack');
  validateRulePack(rulePack);
  if (belongsToCommittedInternalFamily(rulePack) && technicalHoldPack === undefined) {
    throw new TypeError('technical hold pack is required for the committed internal rule pack');
  }
  if (technicalHoldPack !== undefined) {
    technicalHoldPack = strictPlainDataSnapshot(
      technicalHoldPack,
      'technical hold pack',
    );
    validateTechnicalHoldPack(technicalHoldPack, { rulePack });
  }

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
    let record = stableResolvedInputEnvelope(
      resolvedInputs[inputIndex],
      `resolvedInputs[${inputIndex}]`,
    );
    requireString(record.status, `resolvedInputs[${inputIndex}].status`);
    if (record.status !== 'resolved') {
      unresolved.push(structuredClone(record));
      continue;
    }
    assertObject(record.product, `resolvedInputs[${inputIndex}].product`);
    const product = stableResolvedProduct(
      record.product,
      `resolvedInputs[${inputIndex}].product`,
    );
    record = Object.freeze(Object.assign(Object.create(null), record, { product }));
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
      if (id?.startsWith('combination:')) {
        unresolvedIngredientCount += 1;
        unresolved.push(mappingIssue(
          record,
          ingredient,
          ingredientIndex,
          'invalid_reserved_subject_namespace',
        ));
        continue;
      }
      if (id !== null) {
        mappedIngredientCount += 1;
        if (hasReviewedRuntimeSubject(record.product, ingredient)) {
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
    const combinationSubjectId = reviewedCombinationSubjectId(record.product, rulePack.profile);
    if (combinationSubjectId !== null) {
      mappedIngredients.push({ ingredient_id: combinationSubjectId });
    }
    mappedProducts.push({
      product_id: record.product.product_id,
      ingredients: mappedIngredients,
    });
  }

  const checked_pairs = generateCrossDrugPairs(mappedProducts);
  const checkedByKey = new Map(checked_pairs.map((entry) => [entry.pair_key, entry]));
  const checkedKeys = new Set(checkedByKey.keys());
  const technicalHoldMatches = [];
  for (const hold of technicalHoldPack?.holds ?? []) {
    const checkedPair = checkedByKey.get(pairKey(hold.pair));
    if (!checkedPair) continue;
    const matched_product_pairs = matchedProductPairs(checkedPair, hold);
    if (matched_product_pairs.length === 0) continue;
    technicalHoldMatches.push({ hold, matched_product_pairs });
  }
  const reviewedMatches = [];
  const packCandidates = [];
  for (const value of rulePack.rules) {
    const checkedPair = checkedByKey.get(pairKey(value.pair));
    if (!checkedPair) continue;
    const matched_product_pairs = matchedProductPairs(checkedPair, value);
    if (matched_product_pairs.length === 0) continue;
    if (value.review.status === 'clinician_reviewed') {
      reviewedMatches.push({
        rule: structuredClone(value),
        matched_product_pairs,
      });
    }
    else packCandidates.push(structuredClone(value));
  }
  const supersession = applyExactProductSupersession(reviewedMatches);
  const reviewed_findings = supersession.surviving.map(({ rule }) => rule);
  const superseded_findings = supersession.superseded;

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
  superseded_findings.sort(
    (left, right) => (
      compareStrings(findingSortKey(left), findingSortKey(right))
      || compareStrings(left.superseded_by, right.superseded_by)
    ),
  );

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
      matched_reviewed_finding_count: reviewedMatches.length,
      reviewed_finding_count: reviewed_findings.length,
      surviving_reviewed_finding_count: reviewed_findings.length,
      superseded_finding_count: superseded_findings.length,
      review_candidate_count: review_candidates.length,
      technical_hold_match_count: technicalHoldMatches.length,
    },
    checked_pair_count: checked_pairs.length,
  };
  const not_evaluated = buildNotEvaluated({
    unresolvedInputs: unresolved,
    checkedPairs: checked_pairs,
    rulePack,
    technicalHoldMatches,
  });
  const outcome_code = outcomeFor({
    reviewedFindings: reviewed_findings,
    reviewCandidates: review_candidates,
    technicalHoldMatches,
    unresolvedInputs: unresolved,
    duplicateIngredients: duplicate_ingredients,
    checkedPairs: checked_pairs,
  });
  const clinical_interaction_status = clinicalStatusFor({
    reviewedFindings: reviewed_findings,
    reviewCandidates: review_candidates,
    technicalHoldMatches,
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
    superseded_findings,
    review_candidates,
    unresolved_inputs: unresolved,
    duplicate_ingredients,
    checked_pairs,
    coverage,
    disclaimer: DISCLAIMER,
  };
}
