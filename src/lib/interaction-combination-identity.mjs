// Fixed-dose combination identities.
//
// The single-ingredient mapping model in ./interaction-mapping.mjs maps one
// catalogue ingredient assertion to one runtime drug and admits only IN or PIN
// RxNorm term types. A fixed-dose combination is a different kind of thing: RxNorm
// denotes it with a Multiple Ingredient (MIN) concept, and no single catalogue
// ingredient row stands for it. Rather than widening the single-ingredient
// allowlist -- which would silently change what an "ingredient identity" means --
// combinations live here, on their own path, with their own rules:
//
//   * a MIN term type is admissible ONLY on identity_kind 'fixed_dose_combination',
//     and only alongside a verified component list of IN/PIN ingredients;
//   * a combination is matched at PRODUCT level against the product's whole active
//     set, never by any single component, so neither component can independently
//     inherit a combination's clinical rule;
//   * component_match 'exact_active_set' requires a perfect pairing: every declared
//     component consumes exactly one ingredient slot and no slot is left over, so a
//     product carrying the pair plus anything else does not match;
//   * the declared route/dose-form scope and the reviewed presentation list must
//     agree, so an out-of-scope presentation is refused at authoring time.
//
// Everything fails closed: an unmatched product, an unreviewed presentation or a
// drifted product assertion yields no runtime subject.
import {
  INGREDIENT_IDENTITY_NAMESPACE,
  createIngredientIdentity,
} from './ingredient-identity.mjs';
import { productAssertionHashForRow, productIdForRow } from './product-resolver.mjs';
import {
  canonicalDrug,
  normalizeRuntimeInteractionSubject,
} from './interaction-engine.mjs';

export const COMBINATION_IDENTITY_SCHEMA_VERSION = 1;

const SHA256 = /^[a-f0-9]{64}$/u;
const LOCAL_ID = /^sha256:[a-f0-9]{64}$/u;
const RXCUI = /^[0-9]+$/u;
const IDENTITY_KINDS = new Set(['fixed_dose_combination']);
const COMPONENT_MATCH_MODES = new Set(['exact_active_set']);
const EXPOSURE_SCOPES = new Set(['systemic', 'local']);
const COMPONENT_TERM_TYPES = new Set(['IN', 'PIN']);
const COMBINATION_TERM_TYPES = new Set(['MIN']);
const RELEASE_PROFILES = new Set(['production-open', 'internal-evaluation']);
const PMBJP_PRODUCT_SOURCES = new Set(['official_product_list', 'pmbjp_live_product']);
const TENDER_STATUSES = new Set(['present', 'not_present', 'not_checked']);

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

function requireNonEmptyArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty array`);
  }
  return value;
}

function validateReview(value, label) {
  requireObject(value, label);
  requireExactKeys(value, new Set(['status', 'reviewer_id', 'reviewed_at', 'evidence']), label);
  if (value.status !== 'reviewed') throw new TypeError(`${label}.status must be reviewed`);
  requireString(value.reviewer_id, `${label}.reviewer_id`);
  requireIsoDate(value.reviewed_at, `${label}.reviewed_at`);
  requireNonEmptyArray(value.evidence, `${label}.evidence`);
  for (let index = 0; index < value.evidence.length; index += 1) {
    const evidence = value.evidence[index];
    const evidenceLabel = `${label}.evidence[${index}]`;
    requireObject(evidence, evidenceLabel);
    requireExactKeys(evidence, new Set([
      'source_id', 'identifier', 'source_url', 'retrieved_at', 'evidence_sha256',
    ]), evidenceLabel);
    requireString(evidence.source_id, `${evidenceLabel}.source_id`);
    requireString(evidence.identifier, `${evidenceLabel}.identifier`);
    requireHttpsUrl(evidence.source_url, `${evidenceLabel}.source_url`);
    requireIsoDate(evidence.retrieved_at, `${evidenceLabel}.retrieved_at`);
    requireSha256(evidence.evidence_sha256, `${evidenceLabel}.evidence_sha256`);
  }
}

function validateRxNorm(value, label) {
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'rxcui', 'name', 'tty', 'version', 'api_version', 'response_sha256',
  ]), label);
  if (!RXCUI.test(requireString(value.rxcui, `${label}.rxcui`))) {
    throw new TypeError(`${label}.rxcui must contain digits only`);
  }
  requireString(value.name, `${label}.name`);
  if (!COMBINATION_TERM_TYPES.has(value.tty)) {
    throw new TypeError(`${label}.tty must be MIN for a fixed-dose combination`);
  }
  requireString(value.version, `${label}.version`);
  requireString(value.api_version, `${label}.api_version`);
  requireSha256(value.response_sha256, `${label}.response_sha256`);
}

function validateComponents(components, label) {
  requireNonEmptyArray(components, `${label}.components`);
  if (components.length < 2) {
    throw new TypeError(`${label} requires at least two components`);
  }
  const claimed = new Map();
  const names = new Set();
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const componentLabel = `${label}.components[${index}]`;
    requireObject(component, componentLabel);
    requireExactKeys(
      component,
      new Set(['name', 'rxcui', 'tty', 'assertion_ingredient_ids']),
      componentLabel,
    );
    const name = requireString(component.name, `${componentLabel}.name`);
    if (names.has(name)) {
      throw new TypeError(`${label} lists component ${name} more than once`);
    }
    names.add(name);
    if (!RXCUI.test(requireString(component.rxcui, `${componentLabel}.rxcui`))) {
      throw new TypeError(`${componentLabel}.rxcui must contain digits only`);
    }
    if (!COMPONENT_TERM_TYPES.has(component.tty)) {
      throw new TypeError(`${componentLabel} tty must be IN or PIN`);
    }
    requireNonEmptyArray(
      component.assertion_ingredient_ids,
      `${componentLabel}.assertion_ingredient_ids`,
    );
    for (let idIndex = 0; idIndex < component.assertion_ingredient_ids.length; idIndex += 1) {
      const assertionId = requireLocalId(
        component.assertion_ingredient_ids[idIndex],
        `${componentLabel}.assertion_ingredient_ids[${idIndex}]`,
      );
      if (claimed.has(assertionId)) {
        throw new TypeError(
          `${label} assertion identity ${assertionId} is claimed by more than one component`,
        );
      }
      claimed.set(assertionId, name);
    }
  }
}

function validatePresentations(combination, label) {
  requireNonEmptyArray(combination.presentations, `${label}.presentations`);
  const routes = new Set(combination.routes);
  const doseForms = new Set(combination.dose_forms);
  const seen = new Set();
  for (let index = 0; index < combination.presentations.length; index += 1) {
    const presentation = combination.presentations[index];
    const presentationLabel = `${label}.presentations[${index}]`;
    requireObject(presentation, presentationLabel);
    requireExactKeys(presentation, new Set([
      'product_id', 'product_assertion_sha256', 'route', 'formulation', 'rxnorm_scd', 'pmbjp_code',
    ]), presentationLabel);
    const productId = requireLocalId(presentation.product_id, `${presentationLabel}.product_id`);
    if (seen.has(productId)) {
      throw new TypeError(`${label} lists product ${productId} more than once`);
    }
    seen.add(productId);
    requireSha256(
      presentation.product_assertion_sha256,
      `${presentationLabel}.product_assertion_sha256`,
    );
    const route = requireString(presentation.route, `${presentationLabel}.route`);
    const formulation = requireString(
      presentation.formulation,
      `${presentationLabel}.formulation`,
    );
    const normalized = normalizeRuntimeInteractionSubject({
      drug: 'combination_presentation_placeholder',
      route,
      formulation,
    });
    if (normalized.route !== route || normalized.formulation !== formulation) {
      throw new TypeError(
        `${presentationLabel} must use canonical route and formulation values`,
      );
    }
    // the declared scope and the reviewed product list must agree, so an
    // out-of-scope presentation is refused here rather than at resolution
    if (!routes.has(route)) {
      throw new TypeError(
        `${presentationLabel} presentation route ${route} is outside the declared routes`,
      );
    }
    if (!doseForms.has(formulation)) {
      throw new TypeError(
        `${presentationLabel} presentation formulation ${formulation} is outside the declared dose_forms`,
      );
    }
    if (!RXCUI.test(requireString(presentation.rxnorm_scd, `${presentationLabel}.rxnorm_scd`))) {
      throw new TypeError(`${presentationLabel}.rxnorm_scd must contain digits only`);
    }
    requireString(presentation.pmbjp_code, `${presentationLabel}.pmbjp_code`);
  }
}

// Clinician decision C4 (2026-07-27): a procurement tender is not the canonical
// inventory of every valid PMBJP product. What is required is an authoritative
// product-identity source; a tender citation is required only when the product is
// actually in the tender. Absence must be recorded explicitly rather than left
// silent, so a missing citation can never be mistaken for an unexamined gap.
function validateProvenance(value, label) {
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'pmbjp_product_source', 'pmbjp_tender_source', 'pmbjp_tender_status', 'tender_document',
  ]), label);
  const productSource = value.pmbjp_product_source;
  if (typeof productSource !== 'string' || !PMBJP_PRODUCT_SOURCES.has(productSource)) {
    throw new TypeError(
      `${label}.pmbjp_product_source must name an authoritative PMBJP product-identity source`,
    );
  }
  if (!TENDER_STATUSES.has(value.pmbjp_tender_status)) {
    throw new TypeError(`${label}.pmbjp_tender_status is invalid`);
  }
  if (value.pmbjp_tender_source === null) {
    if (value.pmbjp_tender_status === 'present') {
      throw new TypeError(
        `${label}.pmbjp_tender_status may not be present without a tender source`,
      );
    }
  } else {
    requireString(value.pmbjp_tender_source, `${label}.pmbjp_tender_source`);
    if (value.pmbjp_tender_status !== 'present') {
      throw new TypeError(
        `${label}.pmbjp_tender_status must be present when a tender source is cited`,
      );
    }
  }
  if (value.tender_document !== null) {
    requireString(value.tender_document, `${label}.tender_document`);
  }
}

function validateCombination(value, index) {
  const label = `combination identity ${index}`;
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'combination_id',
    'identity_kind',
    'runtime_drug',
    'rxnorm',
    'components',
    'component_match',
    'exposure_scope',
    'routes',
    'dose_forms',
    'presentations',
    'provenance',
    'allowed_profiles',
    'review',
  ]), label);
  requireString(value.combination_id, `${label}.combination_id`);
  if (!IDENTITY_KINDS.has(value.identity_kind)) {
    throw new TypeError(`${label}.identity_kind must be fixed_dose_combination`);
  }
  const runtimeDrug = requireString(value.runtime_drug, `${label}.runtime_drug`);
  if (canonicalDrug(runtimeDrug) !== runtimeDrug) {
    throw new TypeError(`${label}.runtime_drug must already be canonical`);
  }
  validateRxNorm(value.rxnorm, `${label}.rxnorm`);
  validateComponents(value.components, label);
  if (!COMPONENT_MATCH_MODES.has(value.component_match)) {
    throw new TypeError(`${label}.component_match must be exact_active_set`);
  }
  if (!EXPOSURE_SCOPES.has(value.exposure_scope)) {
    throw new TypeError(`${label}.exposure_scope is invalid`);
  }
  requireNonEmptyArray(value.routes, `${label}.routes`);
  requireNonEmptyArray(value.dose_forms, `${label}.dose_forms`);
  for (let routeIndex = 0; routeIndex < value.routes.length; routeIndex += 1) {
    requireString(value.routes[routeIndex], `${label}.routes[${routeIndex}]`);
  }
  for (let formIndex = 0; formIndex < value.dose_forms.length; formIndex += 1) {
    requireString(value.dose_forms[formIndex], `${label}.dose_forms[${formIndex}]`);
  }
  validatePresentations(value, label);
  validateProvenance(value.provenance, `${label}.provenance`);
  requireNonEmptyArray(value.allowed_profiles, `${label}.allowed_profiles`);
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
  validateReview(value.review, `${label}.review`);
}

export function validateCombinationIdentityManifest(manifest) {
  requireObject(manifest, 'combination identity manifest');
  requireExactKeys(manifest, new Set([
    'schema_version',
    'identity_namespace',
    'notices',
    'combinations',
  ]), 'combination identity manifest');
  if (manifest.schema_version !== COMBINATION_IDENTITY_SCHEMA_VERSION) {
    throw new TypeError('combination identity manifest schema_version is unsupported');
  }
  if (manifest.identity_namespace !== INGREDIENT_IDENTITY_NAMESPACE) {
    throw new TypeError('combination identity manifest identity_namespace is incompatible');
  }
  if (!Array.isArray(manifest.notices)) {
    throw new TypeError('combination identity manifest notices must be an array');
  }
  for (let index = 0; index < manifest.notices.length; index += 1) {
    requireString(manifest.notices[index], `combination identity manifest notices[${index}]`);
  }
  if (!Array.isArray(manifest.combinations)) {
    throw new TypeError('combination identity manifest combinations must be an array');
  }
  const combinationIds = new Set();
  for (let index = 0; index < manifest.combinations.length; index += 1) {
    const combination = manifest.combinations[index];
    validateCombination(combination, index);
    if (combinationIds.has(combination.combination_id)) {
      throw new TypeError(`duplicate combination_id ${combination.combination_id}`);
    }
    combinationIds.add(combination.combination_id);
  }
  return true;
}

function productAssertionIds(product) {
  return (product.ingredients ?? []).map((ingredient) => {
    try {
      return createIngredientIdentity(ingredient).ingredient_id;
    } catch {
      return null;
    }
  });
}

// exact_active_set: every component must consume exactly one ingredient slot and
// no slot may be left over. A perfect matching, not a containment test -- so the
// pair plus any additional active ingredient does not match, and neither component
// matches on its own.
function matchesExactActiveSet(components, assertionIds) {
  if (assertionIds.length !== components.length) return false;
  if (assertionIds.some((id) => id === null)) return false;
  const accepts = components.map((component) => new Set(component.assertion_ingredient_ids));
  const usedSlots = new Array(assertionIds.length).fill(false);
  const assign = (componentIndex) => {
    if (componentIndex === accepts.length) return true;
    for (let slot = 0; slot < assertionIds.length; slot += 1) {
      if (usedSlots[slot]) continue;
      if (!accepts[componentIndex].has(assertionIds[slot])) continue;
      usedSlots[slot] = true;
      if (assign(componentIndex + 1)) return true;
      usedSlots[slot] = false;
    }
    return false;
  };
  return assign(0);
}

function combinationAllowedForProfile(combination, profile) {
  if (profile === null || profile === undefined) return true;
  return combination.allowed_profiles.includes(profile);
}

const noCombination = (reason) => ({
  status: 'no_combination',
  combination_id: null,
  runtime_subject: null,
  reason,
});

export function resolveCombinationIdentity({ product, manifest, profile = null }) {
  requireObject(product, 'product');
  validateCombinationIdentityManifest(manifest);
  const assertionIds = productAssertionIds(product);
  if (assertionIds.length === 0) return noCombination('product_has_no_active_ingredients');

  const productId = productIdForRow(product);
  const candidates = manifest.combinations.filter((combination) => (
    combinationAllowedForProfile(combination, profile)
    && matchesExactActiveSet(combination.components, assertionIds)
  ));
  if (candidates.length === 0) return noCombination('no_reviewed_combination_matches_active_set');
  if (candidates.length > 1) {
    // ambiguity is a review defect, never a runtime guess
    return noCombination('ambiguous_reviewed_combinations');
  }

  const combination = candidates[0];
  const presentation = combination.presentations.find((entry) => entry.product_id === productId);
  if (!presentation) {
    return {
      ...noCombination('reviewed_combination_presentation_required'),
      combination_id: combination.combination_id,
    };
  }
  const assertionSha256 = productAssertionHashForRow(product);
  if (presentation.product_assertion_sha256 !== assertionSha256) {
    return {
      status: 'stale',
      combination_id: combination.combination_id,
      runtime_subject: null,
      product_assertion_sha256: assertionSha256,
      error: 'product_assertion_changed_since_review',
    };
  }
  return {
    status: 'reviewed_override',
    combination_id: combination.combination_id,
    product_assertion_sha256: assertionSha256,
    exposure_scope: combination.exposure_scope,
    components: combination.components.map((component) => ({
      name: component.name,
      rxcui: component.rxcui,
      tty: component.tty,
    })),
    rxnorm_scd: presentation.rxnorm_scd,
    runtime_subject: normalizeRuntimeInteractionSubject({
      drug: combination.runtime_drug,
      route: presentation.route,
      formulation: presentation.formulation,
    }),
  };
}
