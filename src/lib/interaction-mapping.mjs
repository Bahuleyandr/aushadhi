import { createHash } from 'node:crypto';
import {
  INGREDIENT_IDENTITY_NAMESPACE,
  createIngredientIdentity,
  ingredientIdForName,
  normalizeObservedIngredientName,
} from './ingredient-identity.mjs';
import {
  PRODUCT_ASSERTION_NAMESPACE,
  PRODUCT_ID_NAMESPACE,
  productAssertionForRow,
  productAssertionHashForRow,
  productIdForRow,
} from './product-resolver.mjs';
import {
  canonicalDrug,
  normalizeRuntimeInteractionSubject,
} from './interaction-engine.mjs';

export const INTERACTION_MAPPING_SCHEMA_VERSION = 1;
export const INGREDIENT_OCCURRENCE_NAMESPACE = 'aushadhi:ingredient-occurrence:v1';

const SHA256 = /^[a-f0-9]{64}$/u;
const LOCAL_ID = /^sha256:[a-f0-9]{64}$/u;
const RXCUI = /^[0-9]+$/u;
const UNII = /^[A-Z0-9]{10}$/u;
const RELEASE_PROFILES = new Set(['production-open', 'internal-evaluation']);
const RELATIONSHIPS = new Set([
  'exact',
  'salt',
  'active_moiety',
  'prodrug',
  'metabolite',
  'stereoisomer',
  'regimen',
  'synonym',
]);
const RXNORM_INGREDIENT_TYPES = new Set(['IN', 'PIN']);

// Clinician decision C4 (2026-07-27): a PMBJP presentation mapping must rest on an
// authoritative PMBJP product-identity source -- one that confirms the drug code,
// product name, active components, strength and dosage form. A procurement tender
// qualifies, but is no longer REQUIRED: it is not the canonical inventory of every
// valid PMBJP product, so a drug absent from a tender may be identified from the
// official product list alone. This is enforced here, for every mapping, rather
// than as a per-rule exception.
//
// Scope: this governs mappings that declare PMBJP provenance through the
// presentation:pmbjp: mapping_id namespace. Presentation mappings for non-PMBJP
// products are a different provenance question and are deliberately untouched.
export const PMBJP_PRODUCT_IDENTITY_PREFIXES = new Set([
  'pmbjp-product-list:',
  'pmbjp-live-product:',
  'pmbjp-tender:',
]);
const PMBJP_MAPPING_NAMESPACE = 'presentation:pmbjp:';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function requireExactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label} contains unknown property ${key}`);
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function requireSha256(value, label) {
  const normalized = requireString(value, label);
  if (!SHA256.test(normalized)) throw new TypeError(`${label} must be a lowercase SHA-256`);
  return normalized;
}

function requireLocalId(value, label) {
  const normalized = requireString(value, label);
  if (!LOCAL_ID.test(normalized)) throw new TypeError(`${label} must be a namespaced SHA-256`);
  return normalized;
}

function requireIsoDate(value, label) {
  const normalized = requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw new TypeError(`${label} must be an ISO calendar date`);
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new TypeError(`${label} must be a valid ISO calendar date`);
  }
  return normalized;
}

function requireHttpsUrl(value, label) {
  const normalized = requireString(value, label);
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new TypeError(`${label} must be a valid HTTPS URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) {
    throw new TypeError(
      `${label} must be a credential-free HTTPS URL without a custom port or fragment`,
    );
  }
  return normalized;
}

function validateReviewEvidence(value, label) {
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'source_id',
    'identifier',
    'source_url',
    'retrieved_at',
    'evidence_sha256',
  ]), label);
  requireString(value.source_id, `${label}.source_id`);
  requireString(value.identifier, `${label}.identifier`);
  requireHttpsUrl(value.source_url, `${label}.source_url`);
  requireIsoDate(value.retrieved_at, `${label}.retrieved_at`);
  requireSha256(value.evidence_sha256, `${label}.evidence_sha256`);
}

function validateReview(value, label) {
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'status',
    'reviewer_id',
    'reviewed_at',
    'evidence',
  ]), label);
  if (value.status !== 'reviewed') throw new TypeError(`${label}.status must be reviewed`);
  requireString(value.reviewer_id, `${label}.reviewer_id`);
  requireIsoDate(value.reviewed_at, `${label}.reviewed_at`);
  if (!Array.isArray(value.evidence) || value.evidence.length === 0) {
    throw new TypeError(`${label}.evidence must be a non-empty array`);
  }
  for (let index = 0; index < value.evidence.length; index += 1) {
    validateReviewEvidence(value.evidence[index], `${label}.evidence[${index}]`);
  }
}

function validateRxNorm(value, label) {
  if (value === null) return;
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'rxcui',
    'name',
    'tty',
    'version',
    'api_version',
    'response_sha256',
  ]), label);
  if (!RXCUI.test(requireString(value.rxcui, `${label}.rxcui`))) {
    throw new TypeError(`${label}.rxcui must contain digits only`);
  }
  requireString(value.name, `${label}.name`);
  if (!RXNORM_INGREDIENT_TYPES.has(value.tty)) {
    throw new TypeError(`${label}.tty must be IN or PIN`);
  }
  requireString(value.version, `${label}.version`);
  requireString(value.api_version, `${label}.api_version`);
  requireSha256(value.response_sha256, `${label}.response_sha256`);
}

function validateUnii(value, label) {
  if (value === null) return;
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'code',
    'preferred_name',
    'response_sha256',
  ]), label);
  if (!UNII.test(requireString(value.code, `${label}.code`))) {
    throw new TypeError(`${label}.code must be a canonical uppercase ten-character UNII`);
  }
  requireString(value.preferred_name, `${label}.preferred_name`);
  requireSha256(value.response_sha256, `${label}.response_sha256`);
}

function validateIngredientMapping(value, index) {
  const label = `ingredient mapping ${index}`;
  requireObject(value, label);
  requireExactKeys(value, new Set(['mapping_id', 'assertion', 'identity', 'review']), label);
  requireString(value.mapping_id, `${label}.mapping_id`);

  requireObject(value.assertion, `${label}.assertion`);
  requireExactKeys(
    value.assertion,
    new Set(['ingredient_id', 'canonical_name']),
    `${label}.assertion`,
  );
  const assertionName = requireString(
    value.assertion.canonical_name,
    `${label}.assertion.canonical_name`,
  );
  const assertionId = requireLocalId(
    value.assertion.ingredient_id,
    `${label}.assertion.ingredient_id`,
  );
  if (ingredientIdForName(assertionName) !== assertionId) {
    throw new TypeError(`${label}.assertion ingredient_id does not match canonical_name`);
  }

  requireObject(value.identity, `${label}.identity`);
  requireExactKeys(value.identity, new Set([
    'clinical_ingredient_id',
    'canonical_name',
    'runtime_drug',
    'relationship',
    'rxnorm',
    'unii',
  ]), `${label}.identity`);
  const clinicalName = requireString(
    value.identity.canonical_name,
    `${label}.identity.canonical_name`,
  );
  const clinicalId = requireLocalId(
    value.identity.clinical_ingredient_id,
    `${label}.identity.clinical_ingredient_id`,
  );
  if (ingredientIdForName(clinicalName) !== clinicalId) {
    throw new TypeError(`${label}.identity clinical_ingredient_id does not match canonical_name`);
  }
  const runtimeDrug = requireString(value.identity.runtime_drug, `${label}.identity.runtime_drug`);
  if (canonicalDrug(runtimeDrug) !== runtimeDrug) {
    throw new TypeError(`${label}.identity.runtime_drug must already be canonical`);
  }
  if (!RELATIONSHIPS.has(value.identity.relationship)) {
    throw new TypeError(`${label}.identity.relationship is invalid`);
  }
  if (value.identity.relationship === 'exact'
      && assertionName.toLocaleLowerCase('und') !== clinicalName.toLocaleLowerCase('und')) {
    throw new TypeError(`${label} exact relationship requires matching canonical names`);
  }
  validateRxNorm(value.identity.rxnorm, `${label}.identity.rxnorm`);
  validateUnii(value.identity.unii, `${label}.identity.unii`);
  if (value.identity.rxnorm === null && value.identity.unii === null) {
    throw new TypeError(`${label}.identity requires an RxNorm or UNII identifier`);
  }
  validateReview(value.review, `${label}.review`);
}

export function validateIngredientMappingManifest(manifest) {
  requireObject(manifest, 'ingredient mapping manifest');
  requireExactKeys(manifest, new Set([
    'schema_version',
    'identity_namespace',
    'notices',
    'mappings',
  ]), 'ingredient mapping manifest');
  if (manifest.schema_version !== INTERACTION_MAPPING_SCHEMA_VERSION) {
    throw new TypeError('ingredient mapping manifest schema_version is unsupported');
  }
  if (manifest.identity_namespace !== INGREDIENT_IDENTITY_NAMESPACE) {
    throw new TypeError('ingredient mapping manifest identity_namespace is incompatible');
  }
  if (!Array.isArray(manifest.notices)) {
    throw new TypeError('ingredient mapping manifest notices must be an array');
  }
  for (let index = 0; index < manifest.notices.length; index += 1) {
    requireString(manifest.notices[index], `ingredient mapping manifest notices[${index}]`);
  }
  if (!Array.isArray(manifest.mappings)) {
    throw new TypeError('ingredient mapping manifest mappings must be an array');
  }
  const mappingIds = new Set();
  const assertionIds = new Set();
  for (let index = 0; index < manifest.mappings.length; index += 1) {
    const mapping = manifest.mappings[index];
    validateIngredientMapping(mapping, index);
    if (mappingIds.has(mapping.mapping_id)) {
      throw new TypeError(`duplicate ingredient mapping_id ${mapping.mapping_id}`);
    }
    if (assertionIds.has(mapping.assertion.ingredient_id)) {
      throw new TypeError(
        `duplicate ingredient assertion mapping ${mapping.assertion.ingredient_id}`,
      );
    }
    mappingIds.add(mapping.mapping_id);
    assertionIds.add(mapping.assertion.ingredient_id);
  }
  return true;
}

function validatePresentationMapping(value, index) {
  const label = `product presentation mapping ${index}`;
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'mapping_id',
    'product_id',
    'product_assertion_sha256',
    'allowed_profiles',
    'presentation',
    'review',
  ]), label);
  requireString(value.mapping_id, `${label}.mapping_id`);
  requireLocalId(value.product_id, `${label}.product_id`);
  requireSha256(value.product_assertion_sha256, `${label}.product_assertion_sha256`);
  requireObject(value.presentation, `${label}.presentation`);
  requireExactKeys(
    value.presentation,
    new Set(['route', 'formulation']),
    `${label}.presentation`,
  );
  const route = requireString(value.presentation.route, `${label}.presentation.route`);
  const formulation = requireString(
    value.presentation.formulation,
    `${label}.presentation.formulation`,
  );
  const normalized = normalizeRuntimeInteractionSubject({
    drug: 'presentation_mapping_placeholder',
    route,
    formulation,
  });
  if (normalized.route !== route || normalized.formulation !== formulation) {
    throw new TypeError(`${label}.presentation must use canonical route and formulation values`);
  }
  if (value.allowed_profiles !== undefined) {
    if (!Array.isArray(value.allowed_profiles) || value.allowed_profiles.length === 0) {
      throw new TypeError(`${label}.allowed_profiles must be a non-empty array`);
    }
    const seenProfiles = new Set();
    for (let profileIndex = 0; profileIndex < value.allowed_profiles.length; profileIndex += 1) {
      const profile = requireString(
        value.allowed_profiles[profileIndex],
        `${label}.allowed_profiles[${profileIndex}]`,
      );
      if (!RELEASE_PROFILES.has(profile)) {
        throw new TypeError(`${label}.allowed_profiles contains unsupported profile ${profile}`);
      }
      if (seenProfiles.has(profile)) {
        throw new TypeError(`${label}.allowed_profiles contains duplicate profile ${profile}`);
      }
      seenProfiles.add(profile);
    }
  }
  validateReview(value.review, `${label}.review`);
  if (value.mapping_id.startsWith(PMBJP_MAPPING_NAMESPACE)) {
    const hasProductIdentitySource = value.review.evidence.some((evidence) => (
      [...PMBJP_PRODUCT_IDENTITY_PREFIXES].some((prefix) => evidence.identifier.startsWith(prefix))
    ));
    if (!hasProductIdentitySource) {
      throw new TypeError(
        `${label}.review requires an authoritative PMBJP product-identity source`,
      );
    }
  }
}

export function validateProductPresentationManifest(manifest) {
  requireObject(manifest, 'product presentation manifest');
  requireExactKeys(manifest, new Set([
    'schema_version',
    'product_id_namespace',
    'product_assertion_namespace',
    'mappings',
  ]), 'product presentation manifest');
  if (manifest.schema_version !== INTERACTION_MAPPING_SCHEMA_VERSION) {
    throw new TypeError('product presentation manifest schema_version is unsupported');
  }
  if (manifest.product_id_namespace !== PRODUCT_ID_NAMESPACE) {
    throw new TypeError('product presentation manifest product_id_namespace is incompatible');
  }
  if (manifest.product_assertion_namespace !== PRODUCT_ASSERTION_NAMESPACE) {
    throw new TypeError(
      'product presentation manifest product_assertion_namespace is incompatible',
    );
  }
  if (!Array.isArray(manifest.mappings)) {
    throw new TypeError('product presentation manifest mappings must be an array');
  }
  const mappingIds = new Set();
  const productIds = new Set();
  for (let index = 0; index < manifest.mappings.length; index += 1) {
    const mapping = manifest.mappings[index];
    validatePresentationMapping(mapping, index);
    if (mappingIds.has(mapping.mapping_id)) {
      throw new TypeError(`duplicate product presentation mapping_id ${mapping.mapping_id}`);
    }
    if (productIds.has(mapping.product_id)) {
      throw new TypeError(`duplicate product presentation mapping ${mapping.product_id}`);
    }
    mappingIds.add(mapping.mapping_id);
    productIds.add(mapping.product_id);
  }
  return true;
}

function strengthAssertion(ingredient) {
  const strengthValue = ingredient.strength_value;
  if (strengthValue !== null
      && strengthValue !== undefined
      && !Number.isFinite(strengthValue)) {
    throw new TypeError('ingredient strength_value must be finite');
  }
  return {
    strength_raw: normalizeObservedIngredientName(ingredient.strength_raw) || null,
    strength_value: strengthValue ?? null,
    strength_unit: normalizeObservedIngredientName(ingredient.strength_unit) || null,
  };
}

function occurrenceMaterial(productId, ingredient) {
  const assertion = createIngredientIdentity(ingredient);
  return {
    product_id: productId,
    assertion_ingredient_id: assertion.ingredient_id,
    observed_name: assertion.observed_name,
    source_field: assertion.source_field,
    ...strengthAssertion(ingredient),
  };
}

export function ingredientOccurrenceId(productId, ingredient) {
  requireLocalId(productId, 'productId');
  return `sha256:${createHash('sha256')
    .update(INGREDIENT_OCCURRENCE_NAMESPACE, 'utf8')
    .update('\u0000', 'utf8')
    .update(JSON.stringify(occurrenceMaterial(productId, ingredient)), 'utf8')
    .digest('hex')}`;
}

export function createIngredientMappingCandidate(ingredient) {
  const assertion = createIngredientIdentity(ingredient);
  return {
    review_status: 'review_candidate',
    assertion: {
      ingredient_id: assertion.ingredient_id,
      canonical_name: assertion.canonical_name,
      observed_name: assertion.observed_name,
      precision: assertion.precision,
      source_field: assertion.source_field,
    },
    proposed_identity: null,
  };
}

export function createProductPresentationCandidate(product) {
  return {
    review_status: 'review_candidate',
    product_id: productIdForRow(product),
    product_assertion_sha256: productAssertionHashForRow(product),
    product_assertion: productAssertionForRow(product),
    proposed_presentation: {
      route: null,
      formulation: null,
    },
  };
}

export function mappingAllowedForProfile(mapping, profile) {
  if (profile === null || profile === undefined) return true;
  return mapping.allowed_profiles === undefined || mapping.allowed_profiles.includes(profile);
}

function buildMappingIndexes(ingredientManifest, presentationManifest, profile) {
  validateIngredientMappingManifest(ingredientManifest);
  validateProductPresentationManifest(presentationManifest);
  return {
    ingredients: new Map(ingredientManifest.mappings.map((entry) => (
      [entry.assertion.ingredient_id, entry]
    ))),
    presentations: new Map(
      presentationManifest.mappings
        .filter((entry) => mappingAllowedForProfile(entry, profile))
        .map((entry) => [entry.product_id, entry]),
    ),
  };
}

function mappedPresentation(product, entry) {
  const assertionSha256 = productAssertionHashForRow(product);
  if (!entry) {
    return {
      status: 'unmapped',
      product_assertion_sha256: assertionSha256,
      route: null,
      formulation: null,
      error: 'reviewed_product_presentation_mapping_required',
    };
  }
  if (entry.product_assertion_sha256 !== assertionSha256) {
    return {
      status: 'stale',
      mapping_id: entry.mapping_id,
      product_assertion_sha256: assertionSha256,
      route: null,
      formulation: null,
      error: 'product_assertion_changed_since_review',
    };
  }
  return {
    status: 'reviewed_override',
    mapping_id: entry.mapping_id,
    product_assertion_sha256: assertionSha256,
    route: entry.presentation.route,
    formulation: entry.presentation.formulation,
  };
}

function mappedIngredient(ingredient, productId, presentation, entry) {
  const assertion = createIngredientIdentity(ingredient);
  const occurrenceId = ingredientOccurrenceId(productId, ingredient);
  const base = {
    ...ingredient,
    assertion_ingredient_id: assertion.ingredient_id,
    ingredient_occurrence_id: occurrenceId,
    observed_name: assertion.observed_name,
    assertion_canonical_name: assertion.canonical_name,
    assertion_precision: assertion.precision,
    assertion_source_field: assertion.source_field,
  };
  if (!entry) {
    return {
      ...base,
      mapping_status: 'unmapped',
      error: 'reviewed_identity_mapping_required',
      runtime_subject: null,
    };
  }
  const runtimeSubject = presentation.status === 'reviewed_override'
    ? normalizeRuntimeInteractionSubject({
      drug: entry.identity.runtime_drug,
      route: presentation.route,
      formulation: presentation.formulation,
    })
    : null;
  return {
    ...base,
    ingredient_id: entry.identity.clinical_ingredient_id,
    canonical_name: entry.identity.canonical_name,
    runtime_drug: entry.identity.runtime_drug,
    identity_relationship: entry.identity.relationship,
    external_identifiers: {
      rxnorm: entry.identity.rxnorm === null
        ? null
        : {
          rxcui: entry.identity.rxnorm.rxcui,
          name: entry.identity.rxnorm.name,
          tty: entry.identity.rxnorm.tty,
          version: entry.identity.rxnorm.version,
          api_version: entry.identity.rxnorm.api_version,
        },
      unii: entry.identity.unii === null
        ? null
        : {
          code: entry.identity.unii.code,
          preferred_name: entry.identity.unii.preferred_name,
        },
    },
    mapping_id: entry.mapping_id,
    mapping_status: 'reviewed_override',
    runtime_subject: runtimeSubject,
    ...(runtimeSubject === null
      ? { presentation_error: presentation.error }
      : {}),
  };
}

export function mapResolvedProducts({
  records,
  ingredientManifest,
  presentationManifest,
  profile = null,
}) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  const indexes = buildMappingIndexes(ingredientManifest, presentationManifest, profile);
  return records.map((record, recordIndex) => {
    requireObject(record, `record ${recordIndex}`);
    if (record.status !== 'resolved') return structuredClone(record);
    requireObject(record.product, `record ${recordIndex}.product`);
    const expectedProductId = productIdForRow(record.product);
    if (record.product.product_id !== expectedProductId) {
      throw new TypeError(`record ${recordIndex}.product.product_id does not match product content`);
    }
    if (!Array.isArray(record.product.ingredients) || record.product.ingredients.length === 0) {
      throw new TypeError(`record ${recordIndex}.product.ingredients must be non-empty`);
    }
    const presentation = mappedPresentation(
      record.product,
      indexes.presentations.get(expectedProductId),
    );
    const seenOccurrences = new Set();
    const ingredients = record.product.ingredients.map((ingredient) => {
      const assertion = createIngredientIdentity(ingredient);
      const mapped = mappedIngredient(
        ingredient,
        expectedProductId,
        presentation,
        indexes.ingredients.get(assertion.ingredient_id),
      );
      if (seenOccurrences.has(mapped.ingredient_occurrence_id)) {
        throw new TypeError(
          `record ${recordIndex} contains indistinguishable duplicate ingredient occurrences`,
        );
      }
      seenOccurrences.add(mapped.ingredient_occurrence_id);
      return mapped;
    });
    return {
      ...structuredClone(record),
      product: {
        ...structuredClone(record.product),
        product_assertion_sha256: productAssertionHashForRow(record.product),
        presentation,
        ingredients,
      },
    };
  });
}

export function summarizeInteractionMappings(records) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  const summary = {
    resolved_products: 0,
    mapped_ingredients: 0,
    unmapped_ingredients: 0,
    mapped_presentations: 0,
    unmapped_presentations: 0,
    runtime_subjects: 0,
  };
  for (const record of records) {
    if (record?.status !== 'resolved') continue;
    summary.resolved_products += 1;
    if (record.product?.presentation?.status === 'reviewed_override') {
      summary.mapped_presentations += 1;
    } else {
      summary.unmapped_presentations += 1;
    }
    for (const ingredient of record.product?.ingredients ?? []) {
      if (ingredient.mapping_status === 'reviewed_override') summary.mapped_ingredients += 1;
      else summary.unmapped_ingredients += 1;
      if (ingredient.runtime_subject !== null && ingredient.runtime_subject !== undefined) {
        summary.runtime_subjects += 1;
      }
    }
  }
  return summary;
}
