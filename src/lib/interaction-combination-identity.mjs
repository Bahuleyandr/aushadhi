// Fixed-dose combination identities.
//
// The single-ingredient mapping model in ./interaction-mapping.mjs maps one
// catalogue ingredient assertion to one runtime drug and admits only IN or PIN
// RxNorm term types. A fixed-dose combination is a different kind of thing: RxNorm
// denotes it with a Multiple Ingredient (MIN) concept, and no single catalogue
// ingredient row stands for it. Rather than widening the single-ingredient
// allowlist -- which would silently change what an "ingredient identity" means --
// combinations live here, on their own path.
//
// Safety properties, each pinned by tests:
//
//   * the release profile is REQUIRED and fails closed. There is no profile-blind
//     resolution: profile-agnostic inspection is a separate, explicitly named
//     audit function, so a production caller cannot forget the safety boundary;
//   * MIN is admissible only on identity_kind 'fixed_dose_combination', alongside a
//     component list of IN/PIN ingredients whose RxCUIs must equal the RxCUIs in a
//     recorded MIN component relation -- the structure is cross-validated, not
//     merely stored;
//   * a combination is matched at PRODUCT level against the whole active set, so no
//     component can independently inherit a combination's clinical rule;
//   * component_match 'exact_active_set' is a perfect pairing: every component
//     consumes exactly one ingredient slot and no slot is left over;
//   * the declared route/dose-form scope must EQUAL the reviewed presentation
//     scope, so a declaration can never be broader than what was reviewed;
//   * a reviewed product is recognised by its STABLE SOURCE IDENTITY, not by its
//     content hash. Content hashes change when content drifts, so an id-keyed
//     lookup would make drift look like an ordinary non-match. Drift on a reviewed
//     product is reported as `stale`, and an unusable ingredient identity is
//     reported as `invalid_product_assertion` rather than silently dropped;
//   * a source manifest may declare only 'internal-evaluation'. Production
//     authority is conferred by the promotion compiler against an approval record,
//     never by an author typing 'production-open' into a source file.
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
export const MAX_COMBINATION_COMPONENTS = 8;

const SHA256 = /^[a-f0-9]{64}$/u;
const LOCAL_ID = /^sha256:[a-f0-9]{64}$/u;
const RXCUI = /^[0-9]+$/u;
const NUMERIC = /^[0-9]+(\.[0-9]+)?$/u;
const IDENTITY_KINDS = new Set(['fixed_dose_combination']);
const COMPONENT_MATCH_MODES = new Set(['exact_active_set']);
const EXPOSURE_SCOPES = new Set(['systemic', 'local']);
const COMPONENT_TERM_TYPES = new Set(['IN', 'PIN']);
const RELEASE_PROFILES = new Set(['production-open', 'internal-evaluation']);
const AUTHORABLE_PROFILES = new Set(['internal-evaluation']);
const MIN_RELATIONSHIPS = new Set(['has_part']);
// kept deliberately in step with PMBJP_PRODUCT_IDENTITY_PREFIXES in
// ./interaction-mapping.mjs: a tender qualifies as an identity source, it is simply
// no longer required (clinician decision C4)
const IDENTITY_SOURCE_KINDS = new Set([
  'official_product_list',
  'pmbjp_live_product',
  'pmbjp_tender',
]);
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

function requireRxcui(value, label) {
  const normalized = requireString(value, label);
  if (!RXCUI.test(normalized)) throw new TypeError(`${label} must contain digits only`);
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

const sameSet = (left, right) => left.size === right.size && [...left].every((v) => right.has(v));

// Does a system of distinct representatives exist -- can we pick one distinct
// element from each set? Standard augmenting-path bipartite matching.
function existsDistinctRepresentatives(sets) {
  const owner = new Map();
  const assign = (index, seen) => {
    for (const element of sets[index]) {
      if (seen.has(element)) continue;
      seen.add(element);
      if (!owner.has(element) || assign(owner.get(element), seen)) {
        owner.set(element, index);
        return true;
      }
    }
    return false;
  };
  for (let index = 0; index < sets.length; index += 1) {
    if (!assign(index, new Set())) return false;
  }
  return true;
}

function* permutationsOf(length) {
  const indices = Array.from({ length }, (_, index) => index);
  const generate = function* generate(prefix, remaining) {
    if (remaining.length === 0) {
      yield prefix;
      return;
    }
    for (let index = 0; index < remaining.length; index += 1) {
      yield* generate(
        [...prefix, remaining[index]],
        [...remaining.slice(0, index), ...remaining.slice(index + 1)],
      );
    }
  };
  yield* generate([], indices);
}

// Two combinations overlap when SOME product active set could match both. Textual
// identity is not the test: alias sets that merely intersect can still admit a
// common active set. Conversely, combinations that share one component (say
// paracetamol+codeine and paracetamol+ibuprofen) do NOT overlap, and rejecting
// those would make the model useless for real fixed-dose combinations.
function combinationsCanOverlap(left, right) {
  if (left.components.length !== right.components.length) return false;
  const leftSets = left.components.map((c) => new Set(c.assertion_ingredient_ids));
  const rightSets = right.components.map((c) => new Set(c.assertion_ingredient_ids));
  for (const permutation of permutationsOf(rightSets.length)) {
    const intersections = leftSets.map((set, index) => (
      new Set([...set].filter((value) => rightSets[permutation[index]].has(value)))
    ));
    if (intersections.some((set) => set.size === 0)) continue;
    if (existsDistinctRepresentatives(intersections)) return true;
  }
  return false;
}

function validateReview(value, label) {
  requireObject(value, label);
  requireExactKeys(value, new Set(['status', 'reviewer_id', 'reviewed_at', 'evidence']), label);
  if (value.status !== 'reviewed') throw new TypeError(`${label}.status must be reviewed`);
  requireString(value.reviewer_id, `${label}.reviewer_id`);
  requireIsoDate(value.reviewed_at, `${label}.reviewed_at`);
  requireNonEmptyArray(value.evidence, `${label}.evidence`);
  const refs = new Set();
  for (let index = 0; index < value.evidence.length; index += 1) {
    const evidence = value.evidence[index];
    const evidenceLabel = `${label}.evidence[${index}]`;
    requireObject(evidence, evidenceLabel);
    requireExactKeys(evidence, new Set([
      'evidence_ref', 'source_id', 'identifier', 'source_url', 'retrieved_at', 'evidence_sha256',
    ]), evidenceLabel);
    const ref = requireString(evidence.evidence_ref, `${evidenceLabel}.evidence_ref`);
    if (refs.has(ref)) throw new TypeError(`${label} contains duplicate evidence_ref ${ref}`);
    refs.add(ref);
    requireString(evidence.source_id, `${evidenceLabel}.source_id`);
    requireString(evidence.identifier, `${evidenceLabel}.identifier`);
    requireHttpsUrl(evidence.source_url, `${evidenceLabel}.source_url`);
    requireIsoDate(evidence.retrieved_at, `${evidenceLabel}.retrieved_at`);
    requireSha256(evidence.evidence_sha256, `${evidenceLabel}.evidence_sha256`);
  }
  return refs;
}

function validateComponents(components, label) {
  requireNonEmptyArray(components, `${label}.components`);
  if (components.length < 2) throw new TypeError(`${label} requires at least two components`);
  if (components.length > MAX_COMBINATION_COMPONENTS) {
    throw new TypeError(`${label} may declare at most ${MAX_COMBINATION_COMPONENTS} components`);
  }
  const claimed = new Set();
  const names = new Set();
  const rxcuis = new Set();
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
    if (names.has(name)) throw new TypeError(`${label} lists component ${name} more than once`);
    names.add(name);
    const rxcui = requireRxcui(component.rxcui, `${componentLabel}.rxcui`);
    if (rxcuis.has(rxcui)) {
      throw new TypeError(`${label} rxcui ${rxcui} is used by more than one component`);
    }
    rxcuis.add(rxcui);
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
      claimed.add(assertionId);
    }
  }
  return { rxcuis, claimed };
}

// A properties response proves a concept's name and term type; it does not prove a
// MIN's composition. The exact component relation must be recorded and pinned
// separately, and must equal the declared component list.
function validateRxNorm(value, label, componentRxcuis) {
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'rxcui', 'name', 'tty', 'version', 'api_version',
    'properties_response_sha256', 'component_relation',
  ]), label);
  requireRxcui(value.rxcui, `${label}.rxcui`);
  requireString(value.name, `${label}.name`);
  if (value.tty !== 'MIN') {
    throw new TypeError(`${label}.tty must be MIN for a fixed-dose combination`);
  }
  requireString(value.version, `${label}.version`);
  requireString(value.api_version, `${label}.api_version`);
  requireSha256(value.properties_response_sha256, `${label}.properties_response_sha256`);

  const relationLabel = `${label}.component_relation`;
  const relation = requireObject(value.component_relation, relationLabel);
  requireExactKeys(
    relation,
    new Set(['relationship', 'component_rxcuis', 'response_sha256']),
    relationLabel,
  );
  if (!MIN_RELATIONSHIPS.has(relation.relationship)) {
    throw new TypeError(`${relationLabel}.relationship must be has_part`);
  }
  requireNonEmptyArray(relation.component_rxcuis, `${relationLabel}.component_rxcuis`);
  const declared = new Set();
  for (let index = 0; index < relation.component_rxcuis.length; index += 1) {
    declared.add(requireRxcui(
      relation.component_rxcuis[index],
      `${relationLabel}.component_rxcuis[${index}]`,
    ));
  }
  if (!sameSet(declared, componentRxcuis)) {
    throw new TypeError(
      `${relationLabel} component_rxcuis must equal the declared component rxcuis`,
    );
  }
  requireSha256(relation.response_sha256, `${relationLabel}.response_sha256`);
}

function validateScd(value, label, componentRxcuis) {
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'rxcui', 'tty', 'name', 'ingredients_and_strengths', 'dose_form', 'version',
    'response_sha256', 'min_relation_response_sha256',
  ]), label);
  requireRxcui(value.rxcui, `${label}.rxcui`);
  if (value.tty !== 'SCD') throw new TypeError(`${label}.tty must be SCD`);
  requireString(value.name, `${label}.name`);
  requireNonEmptyArray(value.ingredients_and_strengths, `${label}.ingredients_and_strengths`);
  const present = new Set();
  for (let index = 0; index < value.ingredients_and_strengths.length; index += 1) {
    const entry = value.ingredients_and_strengths[index];
    const entryLabel = `${label}.ingredients_and_strengths[${index}]`;
    requireObject(entry, entryLabel);
    requireExactKeys(
      entry,
      new Set(['ingredient_rxcui', 'numerator_value', 'numerator_unit']),
      entryLabel,
    );
    present.add(requireRxcui(entry.ingredient_rxcui, `${entryLabel}.ingredient_rxcui`));
    const numerator = requireString(entry.numerator_value, `${entryLabel}.numerator_value`);
    if (!NUMERIC.test(numerator)) {
      throw new TypeError(`${entryLabel}.numerator_value must be numeric`);
    }
    requireString(entry.numerator_unit, `${entryLabel}.numerator_unit`);
  }
  if (!sameSet(present, componentRxcuis)) {
    throw new TypeError(`${label} rxnorm_scd ingredients must equal the declared component rxcuis`);
  }
  requireString(value.dose_form, `${label}.dose_form`);
  requireString(value.version, `${label}.version`);
  requireSha256(value.response_sha256, `${label}.response_sha256`);
  // an SCD relates to its MIN through has_ingredients; the evidence gate checks that
  // link points back at THIS combination, so the hash must be pinned here
  requireSha256(value.min_relation_response_sha256, `${label}.min_relation_response_sha256`);
}

function canonicalPresentationValues(route, formulation, label) {
  const normalized = normalizeRuntimeInteractionSubject({
    drug: 'combination_presentation_placeholder',
    route,
    formulation,
  });
  if (normalized.route !== route || normalized.formulation !== formulation) {
    throw new TypeError(`${label} must use canonical route and formulation values`);
  }
}

function validatePresentations(combination, label, componentRxcuis) {
  requireNonEmptyArray(combination.presentations, `${label}.presentations`);
  const seenProducts = new Set();
  const seenSourceIdentities = new Set();
  const presentedScopes = new Set();
  for (let index = 0; index < combination.presentations.length; index += 1) {
    const presentation = combination.presentations[index];
    const presentationLabel = `${label}.presentations[${index}]`;
    requireObject(presentation, presentationLabel);
    requireExactKeys(presentation, new Set([
      'source_identity', 'product_id', 'product_assertion_sha256',
      'route', 'formulation', 'rxnorm_scd',
    ]), presentationLabel);

    const identityLabel = `${presentationLabel}.source_identity`;
    const sourceIdentity = requireObject(presentation.source_identity, identityLabel);
    requireExactKeys(sourceIdentity, new Set(['namespace', 'code']), identityLabel);
    const namespace = requireString(sourceIdentity.namespace, `${identityLabel}.namespace`);
    const code = requireString(sourceIdentity.code, `${identityLabel}.code`);
    const identityKey = `${namespace}:${code}`;
    if (seenSourceIdentities.has(identityKey)) {
      throw new TypeError(`${label} contains duplicate presentation source identity ${identityKey}`);
    }
    seenSourceIdentities.add(identityKey);

    const productId = requireLocalId(presentation.product_id, `${presentationLabel}.product_id`);
    if (seenProducts.has(productId)) {
      throw new TypeError(`${label} lists product ${productId} more than once`);
    }
    seenProducts.add(productId);
    requireSha256(
      presentation.product_assertion_sha256,
      `${presentationLabel}.product_assertion_sha256`,
    );
    const route = requireString(presentation.route, `${presentationLabel}.route`);
    const formulation = requireString(presentation.formulation, `${presentationLabel}.formulation`);
    canonicalPresentationValues(route, formulation, presentationLabel);
    presentedScopes.add(`${route} ${formulation}`);
    validateScd(presentation.rxnorm_scd, `${presentationLabel}.rxnorm_scd`, componentRxcuis);
  }
  return { presentedScopes, seenSourceIdentities };
}

// Scope is declared as route/formulation PAIRS. Independent route and dose-form
// sets cannot distinguish {oral+tablet, intravenous+injection} from the invalid
// cross products {oral+injection, intravenous+tablet}.
function validatePresentationScopes(values, label) {
  requireNonEmptyArray(values, label);
  const seen = new Set();
  for (let index = 0; index < values.length; index += 1) {
    const scope = values[index];
    const scopeLabel = `${label}[${index}]`;
    requireObject(scope, scopeLabel);
    requireExactKeys(scope, new Set(['route', 'formulation']), scopeLabel);
    const route = requireString(scope.route, `${scopeLabel}.route`);
    const formulation = requireString(scope.formulation, `${scopeLabel}.formulation`);
    const normalized = normalizeRuntimeInteractionSubject({ drug: 'x', route, formulation });
    if (normalized.route !== route) {
      throw new TypeError(`${scopeLabel}.route must be a canonical route`);
    }
    if (normalized.formulation !== formulation) {
      throw new TypeError(`${scopeLabel}.formulation must be a canonical formulation`);
    }
    const key = `${route} ${formulation}`;
    if (seen.has(key)) {
      throw new TypeError(`${label} contains duplicate scope ${route}/${formulation}`);
    }
    seen.add(key);
  }
  return seen;
}

function validateProvenance(value, label, evidenceRefs) {
  requireObject(value, label);
  requireExactKeys(value, new Set(['identity_sources', 'tender_check']), label);
  const requireRef = (ref, refLabel) => {
    const normalized = requireString(ref, refLabel);
    if (!evidenceRefs.has(normalized)) {
      throw new TypeError(`${refLabel} evidence_ref ${normalized} does not resolve to a review record`);
    }
    return normalized;
  };

  requireNonEmptyArray(value.identity_sources, `${label}.identity_sources`);
  for (let index = 0; index < value.identity_sources.length; index += 1) {
    const source = value.identity_sources[index];
    const sourceLabel = `${label}.identity_sources[${index}]`;
    requireObject(source, sourceLabel);
    requireExactKeys(source, new Set(['kind', 'evidence_ref']), sourceLabel);
    if (!IDENTITY_SOURCE_KINDS.has(source.kind)) {
      throw new TypeError(`${sourceLabel}.kind must name an authoritative product-identity source`);
    }
    requireRef(source.evidence_ref, sourceLabel);
  }

  const tenderLabel = `${label}.tender_check`;
  const tender = requireObject(value.tender_check, tenderLabel);
  requireExactKeys(tender, new Set(['status', 'document_id', 'evidence_ref']), tenderLabel);
  if (!TENDER_STATUSES.has(tender.status)) {
    throw new TypeError(`${tenderLabel}.status is invalid`);
  }
  if (tender.status === 'not_checked') {
    if (tender.document_id !== null || tender.evidence_ref !== null) {
      throw new TypeError(`${tenderLabel} must carry no document or evidence when not_checked`);
    }
    return;
  }
  // both `present` and `not_present` are positive assertions about a NAMED document:
  // "we looked in this tender and the product was / was not there"
  if (tender.document_id === null) {
    throw new TypeError(`${tenderLabel}.document_id is required when a tender has been checked`);
  }
  requireString(tender.document_id, `${tenderLabel}.document_id`);
  if (tender.evidence_ref === null) {
    throw new TypeError(`${tenderLabel}.evidence_ref is required when a tender has been checked`);
  }
  requireRef(tender.evidence_ref, tenderLabel);
}

function validateCombination(value, index) {
  const label = `combination identity ${index}`;
  requireObject(value, label);
  requireExactKeys(value, new Set([
    'combination_id', 'identity_kind', 'runtime_drug', 'rxnorm', 'components',
    'component_match', 'exposure_scope', 'presentation_scopes', 'presentations',
    'provenance', 'allowed_profiles', 'review',
  ]), label);
  requireString(value.combination_id, `${label}.combination_id`);
  if (!IDENTITY_KINDS.has(value.identity_kind)) {
    throw new TypeError(`${label}.identity_kind must be fixed_dose_combination`);
  }
  const runtimeDrug = requireString(value.runtime_drug, `${label}.runtime_drug`);
  if (canonicalDrug(runtimeDrug) !== runtimeDrug) {
    throw new TypeError(`${label}.runtime_drug must already be canonical`);
  }
  const { rxcuis, claimed } = validateComponents(value.components, label);
  validateRxNorm(value.rxnorm, `${label}.rxnorm`, rxcuis);
  if (!COMPONENT_MATCH_MODES.has(value.component_match)) {
    throw new TypeError(`${label}.component_match must be exact_active_set`);
  }
  if (!EXPOSURE_SCOPES.has(value.exposure_scope)) {
    throw new TypeError(`${label}.exposure_scope is invalid`);
  }
  const declaredScopes = validatePresentationScopes(
    value.presentation_scopes,
    `${label}.presentation_scopes`,
  );
  const { presentedScopes, seenSourceIdentities } = validatePresentations(value, label, rxcuis);
  // equality, not containment: a declaration may never be broader than what was reviewed
  if (!sameSet(declaredScopes, presentedScopes)) {
    throw new TypeError(
      `${label}.presentation_scopes must exactly equal the reviewed presentation route and `
      + 'formulation pairs',
    );
  }

  requireNonEmptyArray(value.allowed_profiles, `${label}.allowed_profiles`);
  const seenProfiles = new Set();
  for (let index2 = 0; index2 < value.allowed_profiles.length; index2 += 1) {
    const profile = requireString(
      value.allowed_profiles[index2],
      `${label}.allowed_profiles[${index2}]`,
    );
    if (!AUTHORABLE_PROFILES.has(profile)) {
      throw new TypeError(
        `${label}.allowed_profiles may only contain internal-evaluation; production authority is `
        + 'conferred by the promotion compiler against an approval record',
      );
    }
    if (seenProfiles.has(profile)) {
      throw new TypeError(`${label}.allowed_profiles contains duplicate profile ${profile}`);
    }
    seenProfiles.add(profile);
  }
  const evidenceRefs = validateReview(value.review, `${label}.review`);
  validateProvenance(value.provenance, `${label}.provenance`, evidenceRefs);
  return { claimed, seenSourceIdentities };
}

export function validateCombinationIdentityManifest(manifest) {
  requireObject(manifest, 'combination identity manifest');
  requireExactKeys(manifest, new Set([
    'schema_version', 'identity_namespace', 'notices', 'combinations',
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
  const validated = [];
  const globalSourceIdentities = new Map();
  for (let index = 0; index < manifest.combinations.length; index += 1) {
    const combination = manifest.combinations[index];
    const { seenSourceIdentities } = validateCombination(combination, index);
    if (combinationIds.has(combination.combination_id)) {
      throw new TypeError(`duplicate combination_id ${combination.combination_id}`);
    }
    combinationIds.add(combination.combination_id);
    // ambiguity is a review defect: reject it at authoring rather than discovering
    // it at resolution time
    for (const earlier of validated) {
      if (combinationsCanOverlap(earlier, combination)) {
        throw new TypeError(
          `combinations ${earlier.combination_id} and ${combination.combination_id} `
          + 'could both match the same product active set',
        );
      }
    }
    validated.push(combination);
    for (const identityKey of seenSourceIdentities) {
      if (globalSourceIdentities.has(identityKey)) {
        throw new TypeError(
          `reviewed product ${identityKey} appears in more than one combination`,
        );
      }
      globalSourceIdentities.set(identityKey, combination.combination_id);
    }
  }
  return true;
}

function deepFreeze(value) {
  if (Array.isArray(value)) {
    for (const entry of value) deepFreeze(entry);
    return Object.freeze(value);
  }
  if (isObject(value)) {
    for (const entry of Object.values(value)) deepFreeze(entry);
    return Object.freeze(value);
  }
  return value;
}

// Validate once, then resolve many products against the compiled representation.
// The compiled form is DETACHED (deep clone) and DEEPLY frozen: Object.freeze is
// shallow, so a shallow freeze would still let a caller mutate nested component
// alias arrays or reviewed presentations. The reviewed-product index is exposed
// through a lookup function rather than a live Map, which would otherwise be
// mutable regardless of the wrapper's frozen state.
export function compileCombinationIdentityManifest(manifest) {
  validateCombinationIdentityManifest(manifest);
  const combinations = deepFreeze(structuredClone(manifest.combinations));
  const reviewedProducts = new Map();
  for (const combination of combinations) {
    for (const presentation of combination.presentations) {
      const key = `${presentation.source_identity.namespace}:${presentation.source_identity.code}`;
      reviewedProducts.set(key, Object.freeze({ combination, presentation }));
    }
  }
  return Object.freeze({
    compiled: true,
    combinations,
    reviewed_products: Object.freeze({ get: (key) => reviewedProducts.get(key) ?? null }),
  });
}

function requireCompiled(manifest) {
  if (!isObject(manifest) || manifest.compiled !== true) {
    throw new TypeError('manifest must be compiled with compileCombinationIdentityManifest first');
  }
  return manifest;
}

function requireReleaseProfile(profile) {
  if (typeof profile !== 'string' || !RELEASE_PROFILES.has(profile)) {
    throw new TypeError(
      `profile must be explicitly set to one of: ${[...RELEASE_PROFILES].join(', ')}`,
    );
  }
  return profile;
}

// Identity failures are reported, never collapsed to a silent non-match.
function productAssertionIds(product) {
  const ids = [];
  for (const ingredient of product.ingredients ?? []) {
    try {
      ids.push(createIngredientIdentity(ingredient).ingredient_id);
    } catch {
      return null;
    }
  }
  return ids;
}

function sourceIdentityKeys(product) {
  return (product.sources ?? [])
    .filter((entry) => isObject(entry) && entry.source && entry.source_id !== undefined)
    .map((entry) => `presentation:${entry.source}:${entry.source_id}`);
}

function matchesExactActiveSet(components, assertionIds) {
  if (assertionIds.length !== components.length) return false;
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

const noCombination = (reason, extra = {}) => ({
  status: 'no_combination',
  combination_id: null,
  runtime_subject: null,
  reason,
  ...extra,
});

// The catalogue records PMBJP codes as `janaushadhi`; reviewed presentations name
// the namespace `presentation:pmbjp`. Keep the alias explicit rather than guessing.
const SOURCE_NAMESPACE_ALIASES = new Map([['presentation:janaushadhi:', 'presentation:pmbjp:']]);

function reviewedEntryFor(compiledManifest, product) {
  for (const rawKey of sourceIdentityKeys(product)) {
    for (const [from, to] of SOURCE_NAMESPACE_ALIASES) {
      const key = rawKey.startsWith(from) ? `${to}${rawKey.slice(from.length)}` : rawKey;
      const entry = compiledManifest.reviewed_products.get(key);
      if (entry) return { entry, key };
    }
  }
  return null;
}

function resolveInternal(product, compiledManifest, profile, { auditOnly = false } = {}) {
  requireObject(product, 'product');
  const allowed = (combination) => auditOnly || combination.allowed_profiles.includes(profile);

  const assertionIds = productAssertionIds(product);
  if (assertionIds === null) {
    return {
      status: 'invalid_product_assertion',
      combination_id: null,
      runtime_subject: null,
      error: 'ingredient_identity_generation_failed',
    };
  }
  if (assertionIds.length === 0) return noCombination('product_has_no_active_ingredients');

  // A reviewed product is recognised by its STABLE source identity first, so that a
  // content change surfaces as drift instead of looking like an ordinary non-match.
  const reviewed = reviewedEntryFor(compiledManifest, product);
  if (reviewed && allowed(reviewed.entry.combination)) {
    const { combination, presentation } = reviewed.entry;
    const assertionSha256 = productAssertionHashForRow(product);
    const productId = productIdForRow(product);
    if (presentation.product_assertion_sha256 !== assertionSha256
        || presentation.product_id !== productId) {
      return {
        status: 'stale',
        combination_id: combination.combination_id,
        source_identity: presentation.source_identity,
        runtime_subject: null,
        product_id: productId,
        product_assertion_sha256: assertionSha256,
        error: 'product_assertion_changed_since_review',
      };
    }
    if (!matchesExactActiveSet(combination.components, assertionIds)) {
      return {
        status: 'stale',
        combination_id: combination.combination_id,
        source_identity: presentation.source_identity,
        runtime_subject: null,
        error: 'reviewed_product_no_longer_matches_component_set',
      };
    }
    const match = {
      status: 'reviewed_override',
      combination_id: combination.combination_id,
      source_identity: presentation.source_identity,
      product_assertion_sha256: assertionSha256,
      exposure_scope: combination.exposure_scope,
      components: combination.components.map((component) => ({
        name: component.name, rxcui: component.rxcui, tty: component.tty,
      })),
      rxnorm_scd: presentation.rxnorm_scd,
    };
    const subject = normalizeRuntimeInteractionSubject({
      drug: combination.runtime_drug,
      route: presentation.route,
      formulation: presentation.formulation,
    });
    // An audit result is a DIFFERENT TYPE, not a runtime result carrying a flag: a
    // careless consumer can ignore a flag, but there is no runtime_subject here to
    // consume, and assertRuntimeCombinationResult refuses it outright.
    return auditOnly
      ? {
        ...match,
        status: 'audit_match',
        audit_only: true,
        authored_profiles: [...combination.allowed_profiles],
        candidate_subject: subject,
        runtime_subject: null,
      }
      : { ...match, runtime_subject: subject };
  }

  const matching = compiledManifest.combinations.filter((combination) => (
    allowed(combination) && matchesExactActiveSet(combination.components, assertionIds)
  ));
  if (matching.length === 0) return noCombination('no_reviewed_combination_matches_active_set');
  return {
    ...noCombination('reviewed_combination_presentation_required'),
    combination_id: matching[0].combination_id,
  };
}

export function resolveCombinationIdentity({ product, manifest, profile }) {
  const compiledManifest = requireCompiled(manifest);
  const releaseProfile = requireReleaseProfile(profile);
  return resolveInternal(product, compiledManifest, releaseProfile);
}

// A runtime consumer must refuse an audit result even if one is handed to it by
// mistake, so the separation cannot be defeated by ignoring a flag.
export function assertRuntimeCombinationResult(result) {
  if (isObject(result) && (result.audit_only === true || result.status === 'audit_match')) {
    throw new TypeError('an audit result may not be used on a runtime path');
  }
  return result;
}

// Offline inspection only. Deliberately named so it can never be mistaken for the
// production resolution path: it disregards release profiles and reports which
// profiles a match was authored for.
export function auditCombinationIdentityAcrossProfiles({ product, manifest }) {
  const compiledManifest = requireCompiled(manifest);
  return resolveInternal(product, compiledManifest, null, { auditOnly: true });
}
