// Offline semantic verification of a combination's RxNorm evidence.
//
// A schema validator proves that a manifest's fields agree with ONE ANOTHER. It
// cannot prove RxNorm returned them: a self-consistent entry could declare any
// plausible-looking rxcui, tty and hash. This module closes that gap without
// putting network calls in the ordinary test path, by splitting the work:
//
//   capture responses  ->  commit an immutable raw evidence bundle
//                      ->  verify semantics + recompute hashes OFFLINE
//                      ->  compile the internal-evaluation manifest
//
// Everything here operates on the committed bundle, so it is reproducible and can
// run in CI without a network. Capture is a separate, explicit step.
//
// RxNorm relationship model relied upon:
//   * a MIN has `has_part` relationships to its IN/PIN components;
//   * an SCD's ingredient concepts are compared through an explicit field choice
//     rather than a generic guess -- see INGREDIENT_RXCUI_FIELDS. PIN-based
//     products expose several ingredient notions (base ingredient,
//     basis-of-strength substance, active ingredient) and the field actually
//     compared must be recorded, not inferred.
import { createHash } from 'node:crypto';
import { createIngredientIdentity } from './ingredient-identity.mjs';
import {
  productAssertionForRow,
  productAssertionHashForRow,
  productIdForRow,
} from './product-resolver.mjs';
import { strictPlainDataSnapshot } from './strict-plain-data.mjs';
import {
  assertVerifiedPmbjpCombinationEvidence,
} from './pmbjp-combination-evidence.mjs';

export const EVIDENCE_BUNDLE_SCHEMA_VERSION = 1;
// which RxNorm ingredient notion a comparison used; recorded per presentation so a
// PIN-based product cannot silently be compared on a different field
// RxNav's history-status response supplies these separately for every
// ingredient-and-strength row, so which one a comparison used must be recorded.
export const INGREDIENT_RXCUI_FIELDS = new Set([
  'baseRxcui', 'bossRxcui', 'activeIngredientRxcui', 'moietyRxcui',
]);
// Term type alone is not enough: an obsolete or remapped concept is still
// recognisably an SCD. Every concept in the relationship graph must be active and
// current.
const ACCEPTABLE_STATUS = 'Active';
const ACCEPTABLE_IS_CURRENT = 'YES';
const RXNORM_REST_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';
const AUTHORITATIVE_CLASSIFICATION = 'combination_identity_evidence';
// This authority is limited to compiling the identity manifest. It never authorises
// a clinical rule; that remains the clinician-approved promotion manifest's job.
const AUTHORITATIVE_PROMOTION_AUTHORITY = 'identity_only';
const INTEGRATION_FIXTURE_CLASSIFICATION = 'verifier_integration_fixture';
const MANIFEST_REPORT_BINDINGS = new WeakMap();

const SHA256 = /^[a-f0-9]{64}$/u;
// fixture hashes exist so tests can exercise matching without network capture; a
// production verification path must never accept one
const FIXTURE_HASHES = new Set([
  'a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64), '0'.repeat(64), 'f'.repeat(64),
]);

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const sameSet = (left, right) => left.size === right.size && [...left].every((v) => right.has(v));
const RXNORM_RELEASE_DATE = /^(\d{2})-([A-Z][a-z]{2})-(\d{4})$/u;
const MONTH_INDEX = new Map([
  ['Jan', 0], ['Feb', 1], ['Mar', 2], ['Apr', 3], ['May', 4], ['Jun', 5],
  ['Jul', 6], ['Aug', 7], ['Sep', 8], ['Oct', 9], ['Nov', 10], ['Dec', 11],
]);
const PRODUCT_ASSERTION_KEYS = new Set([
  'brand_name', 'manufacturer', 'pack_label', 'form_raw', 'ingredients',
]);
const PRODUCT_ASSERTION_INGREDIENT_KEYS = new Set([
  'observed_name', 'source_field', 'strength_raw', 'strength_value', 'strength_unit',
]);
const PRODUCT_ASSERTION_SOURCE_FIELDS = new Set(['observed_name', 'molecule_raw', 'molecule']);
const RXNORM_DOSE_FORM_SCOPES = new Map([
  ['Oral Tablet', Object.freeze({ route: 'oral', formulation: 'tablet' })],
]);
const EXPLICIT_PRODUCT_FORMS = new Map([
  ['tablet', 'tablet'],
  ['tablets', 'tablet'],
  ['oral tablet', 'tablet'],
  ['oral tablets', 'tablet'],
  ['capsule', 'capsule'],
  ['capsules', 'capsule'],
  ['oral capsule', 'capsule'],
  ['oral capsules', 'capsule'],
  ['suspension', 'suspension'],
  ['oral suspension', 'suspension'],
  ['solution', 'solution'],
  ['oral solution', 'solution'],
  ['injection', 'injection'],
]);
const PRODUCT_STRENGTH = /^(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu)(?:\s*(?:\/|per)\s*(\d+(?:\.\d+)?)?\s*(ml|each))?$/iu;
const MAX_CAPTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function rxNormReleaseTimestamp(value) {
  const match = RXNORM_RELEASE_DATE.exec(String(value ?? ''));
  if (!match) return null;
  const month = MONTH_INDEX.get(match[2]);
  if (month === undefined) return null;
  const timestamp = Date.UTC(Number(match[3]), month, Number(match[1]));
  const parsed = new Date(timestamp);
  if (parsed.getUTCFullYear() !== Number(match[3])
      || parsed.getUTCMonth() !== month
      || parsed.getUTCDate() !== Number(match[1])) {
    return null;
  }
  return timestamp;
}

function exactKeys(value, expected) {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function samePlainData(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => samePlainData(entry, right[index]));
  }
  if (left === null || right === null
      || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index] && samePlainData(left[key], right[key])
    ));
}

function rowFromProductAssertion(findings, presentation, label) {
  const assertion = presentation.product_assertion;
  if (!assertion || typeof assertion !== 'object' || Array.isArray(assertion)) {
    fail(findings, 'missing_product_assertion',
      `${label} requires the canonical product assertion preimage`);
    return null;
  }
  if (!exactKeys(assertion, PRODUCT_ASSERTION_KEYS)
      || typeof assertion.brand_name !== 'string'
      || assertion.brand_name.trim() === ''
      || !Array.isArray(assertion.ingredients)
      || assertion.ingredients.length === 0) {
    fail(findings, 'invalid_product_assertion', `${label} product_assertion is not canonical`);
    return null;
  }
  for (const field of ['manufacturer', 'pack_label', 'form_raw']) {
    if (assertion[field] !== null && typeof assertion[field] !== 'string') {
      fail(findings, 'invalid_product_assertion',
        `${label} product_assertion.${field} must be a string or null`);
      return null;
    }
  }

  const ingredients = [];
  for (const [index, ingredient] of assertion.ingredients.entries()) {
    if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)
        || !exactKeys(ingredient, PRODUCT_ASSERTION_INGREDIENT_KEYS)
        || typeof ingredient.observed_name !== 'string'
        || ingredient.observed_name.trim() === ''
        || !PRODUCT_ASSERTION_SOURCE_FIELDS.has(ingredient.source_field)
        || (ingredient.strength_raw !== null && typeof ingredient.strength_raw !== 'string')
        || (ingredient.strength_unit !== null && typeof ingredient.strength_unit !== 'string')
        || (ingredient.strength_value !== null
          && !Number.isFinite(ingredient.strength_value))) {
      fail(findings, 'invalid_product_assertion',
        `${label} product_assertion.ingredients[${index}] is not canonical`);
      return null;
    }
    ingredients.push({
      [ingredient.source_field]: ingredient.observed_name,
      strength_raw: ingredient.strength_raw,
      strength_value: ingredient.strength_value,
      strength_unit: ingredient.strength_unit,
    });
  }

  const row = {
    brand_name: assertion.brand_name,
    manufacturer: assertion.manufacturer,
    pack_label: assertion.pack_label,
    form_raw: assertion.form_raw,
    ingredients,
  };
  let canonical;
  try {
    canonical = productAssertionForRow(row);
  } catch (error) {
    fail(findings, 'invalid_product_assertion', `${label} ${error.message}`);
    return null;
  }
  if (!samePlainData(canonical, assertion)) {
    fail(findings, 'noncanonical_product_assertion',
      `${label} product_assertion does not equal its canonical form`);
    return null;
  }
  if (productAssertionHashForRow(row) !== presentation.product_assertion_sha256) {
    fail(findings, 'product_assertion_hash_mismatch',
      `${label} product_assertion does not hash to product_assertion_sha256`);
  }
  if (productIdForRow(row) !== presentation.product_id) {
    fail(findings, 'product_id_mismatch',
      `${label} product_assertion does not hash to product_id`);
  }
  return row;
}

function componentAssignment(components, assertionIds) {
  if (!Array.isArray(components) || assertionIds.length !== components.length) return null;
  const used = new Array(assertionIds.length).fill(false);
  const slots = new Array(components.length).fill(-1);
  const assign = (componentIndex) => {
    if (componentIndex === components.length) return true;
    const accepted = new Set(components[componentIndex].assertion_ingredient_ids ?? []);
    for (let slot = 0; slot < assertionIds.length; slot += 1) {
      if (used[slot] || !accepted.has(assertionIds[slot])) continue;
      used[slot] = true;
      slots[componentIndex] = slot;
      if (assign(componentIndex + 1)) return true;
      used[slot] = false;
      slots[componentIndex] = -1;
    }
    return false;
  };
  return assign(0) ? slots : null;
}

function normalizedWords(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function componentComparisonWords(value) {
  return normalizedWords(value).replace(/\bsulph/gu, 'sulf');
}

function reviewedCombinationAlias(brandName) {
  const openingParenthesis = String(brandName ?? '').indexOf('(');
  if (openingParenthesis <= 0) return null;
  const alias = normalizedWords(String(brandName).slice(0, openingParenthesis));
  return alias || null;
}

function explicitProductFormulation(value) {
  if (value === null) return null;
  return EXPLICIT_PRODUCT_FORMS.get(normalizedWords(value)) ?? undefined;
}

function productStrengthBasis(value) {
  if (typeof value !== 'string') return null;
  const match = PRODUCT_STRENGTH.exec(value.trim());
  if (!match) return null;
  return {
    numerator_value: match[1],
    numerator_unit: match[2].toUpperCase(),
    denominator_value: match[4] === undefined ? '1' : (match[3] ?? '1'),
    denominator_unit: match[4] === undefined ? 'EACH' : match[4].toUpperCase(),
  };
}

function presentationCodeEvidence(combination, code) {
  const evidenceByRef = new Map(
    (combination.review?.evidence ?? []).map((entry) => [entry.evidence_ref, entry]),
  );
  for (const source of combination.provenance?.identity_sources ?? []) {
    if (source.kind !== 'official_product_list') continue;
    const evidence = evidenceByRef.get(source.evidence_ref);
    if (evidence?.source_id !== 'janaushadhi') continue;
    const match = /^pmbjp-product-list:(\d+(?:,\d+)*)$/u.exec(evidence.identifier ?? '');
    if (match && match[1].split(',').includes(code)) return evidence;
  }
  return null;
}

function verifyPresentationProductBinding(findings, combination, presentation) {
  const label = `${combination.combination_id} presentation `
    + `${presentation.source_identity?.namespace ?? '(missing)'}:`
    + `${presentation.source_identity?.code ?? '(missing)'}`;
  const expectedCombinationId = `combination:${
    normalizedWords(combination.runtime_drug).replaceAll(' ', '-')
  }:rxnorm-${combination.rxnorm?.rxcui}`;
  if (combination.combination_id !== expectedCombinationId) {
    fail(findings, 'combination_id_identity_mismatch',
      `${label} must use structural id ${expectedCombinationId}`);
  }
  if (presentation.source_identity?.namespace !== 'presentation:pmbjp'
      || !/^\d+$/u.test(String(presentation.source_identity?.code ?? ''))
      || presentationCodeEvidence(
        combination,
        String(presentation.source_identity?.code ?? ''),
      ) === null) {
    fail(findings, 'presentation_source_not_bound_to_review_evidence',
      `${label} is not bound to an authoritative PMBJP product-list review record`);
  }

  const row = rowFromProductAssertion(findings, presentation, label);
  if (row === null) return findings;
  const explicitFormulation = explicitProductFormulation(
    presentation.product_assertion.form_raw,
  );
  if (explicitFormulation === undefined) {
    fail(findings, 'unsupported_explicit_product_form',
      `${label} product_assertion.form_raw is not a reviewed explicit formulation`);
  } else if (explicitFormulation !== null
      && explicitFormulation !== presentation.formulation) {
    fail(findings, 'explicit_product_form_mismatch',
      `${label} explicitly records ${explicitFormulation} but the reviewed presentation is `
      + `${presentation.formulation}`);
  }
  const runtimeWords = normalizedWords(combination.runtime_drug);
  const reviewedAlias = reviewedCombinationAlias(row.brand_name);
  if (!runtimeWords || reviewedAlias === null || runtimeWords !== reviewedAlias) {
    fail(findings, 'runtime_drug_product_mismatch',
      `${label} runtime drug "${combination.runtime_drug}" does not equal the reviewed `
      + `combination alias ${reviewedAlias ?? '(missing)'}`);
  }
  const runtimeComponentWords = componentComparisonWords(combination.runtime_drug);
  const componentNames = [
    ...combination.components.map((component) => component.name),
    ...presentation.product_assertion.ingredients.map(
      (ingredient) => ingredient.observed_name,
    ),
  ].map(componentComparisonWords);
  if (componentNames.includes(runtimeComponentWords)) {
    fail(findings, 'runtime_drug_is_component',
      `${label} runtime drug "${combination.runtime_drug}" names a component, not the combination`);
  }

  const assertionIds = row.ingredients.map(
    (ingredient) => createIngredientIdentity(ingredient).ingredient_id,
  );
  const assignedSlots = componentAssignment(combination.components, assertionIds);
  if (assignedSlots === null) {
    fail(findings, 'product_component_set_mismatch',
      `${label} product assertion does not exactly match the combination components`);
    return findings;
  }
  const scdEntries = new Map(
    presentation.rxnorm_scd.ingredients_and_strengths.map(
      (entry) => [entry.component_rxcui, entry],
    ),
  );
  for (const [componentIndex, component] of combination.components.entries()) {
    const ingredient = row.ingredients[assignedSlots[componentIndex]];
    const scdEntry = scdEntries.get(component.rxcui);
    const rawBasis = productStrengthBasis(ingredient.strength_raw);
    if (!scdEntry
        || rawBasis === null
        || ingredient.strength_value === null
        || ingredient.strength_value === undefined
        || Number(rawBasis.numerator_value) !== Number(ingredient.strength_value)
        || rawBasis.numerator_unit !== String(ingredient.strength_unit ?? '').toUpperCase()
        || String(ingredient.strength_value) !== scdEntry.numerator_value
        || String(ingredient.strength_unit ?? '').toUpperCase() !== scdEntry.numerator_unit
        || Number(rawBasis.denominator_value) !== Number(scdEntry.denominator_value)
        || rawBasis.denominator_unit !== scdEntry.denominator_unit) {
      fail(findings, 'product_scd_strength_mismatch',
        `${label} product strength and basis for ${component.name} do not equal its SCD strength`);
    }
  }

  const expectedScope = RXNORM_DOSE_FORM_SCOPES.get(presentation.rxnorm_scd.dose_form);
  if (expectedScope === undefined) {
    fail(findings, 'unsupported_scd_runtime_scope',
      `${label} dose form ${presentation.rxnorm_scd.dose_form} has no reviewed runtime scope`);
  } else if (presentation.route !== expectedScope.route
      || presentation.formulation !== expectedScope.formulation) {
    fail(findings, 'product_scd_scope_mismatch',
      `${label} declares ${presentation.route}/${presentation.formulation} but `
      + `${presentation.rxnorm_scd.dose_form} requires `
      + `${expectedScope.route}/${expectedScope.formulation}`);
  }
  return findings;
}

function fail(findings, code, detail) {
  findings.push({ code, detail });
  return findings;
}

function bundleEntry(bundle, key) {
  const raw = bundle.responses?.[key];
  return typeof raw === 'string' ? raw : null;
}

function verifyBundleAuthority(findings, combination, bundle, options) {
  const fixtureAllowed = options?.allowNonAuthoritativeFixture === true;
  const isFixture = bundle.classification === INTEGRATION_FIXTURE_CLASSIFICATION;
  if (isFixture && fixtureAllowed) {
    if (bundle.promotion_authority !== 'none') {
      fail(findings, 'invalid_fixture_promotion_authority',
        'an integration fixture must declare promotion_authority none');
    }
    if (bundle.audit_only !== true) {
      fail(findings, 'invalid_fixture_audit_flag',
        'an integration fixture must declare audit_only true');
    }
    return findings;
  }

  if (bundle.classification !== AUTHORITATIVE_CLASSIFICATION) {
    fail(findings, 'invalid_bundle_classification',
      `authoritative evidence must declare classification ${AUTHORITATIVE_CLASSIFICATION}`);
  }
  if (bundle.promotion_authority !== AUTHORITATIVE_PROMOTION_AUTHORITY) {
    fail(findings, 'invalid_promotion_authority',
      `authoritative evidence must declare promotion_authority `
      + AUTHORITATIVE_PROMOTION_AUTHORITY);
  }
  if (bundle.audit_only !== false) {
    fail(findings, 'audit_only_evidence',
      'authoritative combination identity evidence must declare audit_only false');
  }
  if (bundle.combination_id !== combination.combination_id) {
    fail(findings, 'bundle_combination_id_mismatch',
      `evidence bundle declares combination_id ${bundle.combination_id ?? '(missing)'} `
      + `but is being used for ${combination.combination_id}`);
  }
  return findings;
}

function verifyCapture(findings, bundle) {
  const capture = bundle.capture;
  if (!capture || typeof capture !== 'object' || Array.isArray(capture)) {
    return fail(findings, 'missing_capture_metadata',
      'evidence bundle has no RxNorm capture metadata');
  }
  if (capture.base_url !== RXNORM_REST_BASE_URL) {
    fail(findings, 'invalid_capture_base_url',
      `capture.base_url must be exactly ${RXNORM_REST_BASE_URL}`);
  }
  if (bundle.classification === AUTHORITATIVE_CLASSIFICATION
      && (typeof capture.captured_at !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T.*Z$/u.test(capture.captured_at)
        || Number.isNaN(Date.parse(capture.captured_at)))) {
    fail(findings, 'invalid_capture_timestamp',
      'authoritative evidence capture.captured_at must be an ISO UTC timestamp');
  }
  const capturedAt = Date.parse(capture.captured_at);
  const releaseAt = rxNormReleaseTimestamp(bundle.rxnorm_release);
  if (bundle.classification === AUTHORITATIVE_CLASSIFICATION && releaseAt === null) {
    fail(findings, 'invalid_rxnorm_release_date',
      'authoritative evidence rxnorm_release must use DD-Mon-YYYY');
  } else if (bundle.classification === AUTHORITATIVE_CLASSIFICATION
      && !Number.isNaN(capturedAt)
      && capturedAt < releaseAt) {
    fail(findings, 'capture_predates_rxnorm_release',
      `capture.captured_at ${capture.captured_at} predates declared RxNorm release `
      + `${bundle.rxnorm_release}`);
  }
  if (bundle.classification === AUTHORITATIVE_CLASSIFICATION
      && !Number.isNaN(capturedAt)
      && capturedAt > Date.now() + MAX_CAPTURE_CLOCK_SKEW_MS) {
    fail(findings, 'capture_timestamp_in_future',
      `capture.captured_at ${capture.captured_at} is later than the verifier clock`);
  }

  const captures = [];
  for (const position of ['before', 'after']) {
    const responseField = `version_${position}_response`;
    const hashField = `version_${position}_sha256`;
    const raw = capture[responseField];
    const declaredHash = capture[hashField];
    if (typeof raw !== 'string' || raw === '') {
      fail(findings, 'missing_capture_version_response',
        `capture.${responseField} must contain the raw RxNorm version response`);
    }
    if (!SHA256.test(String(declaredHash ?? '')) || FIXTURE_HASHES.has(declaredHash)) {
      fail(findings, 'invalid_capture_version_hash',
        `capture.${hashField} must be a non-placeholder lowercase SHA-256`);
    } else if (typeof raw === 'string' && sha256(raw) !== declaredHash) {
      fail(findings, 'capture_version_hash_mismatch',
        `capture.${hashField} does not hash capture.${responseField}`);
    }

    let parsed = null;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        fail(findings, 'unreadable_capture_version_response',
          `capture.${responseField} is not valid JSON`);
      }
    }
    captures.push({ raw, declaredHash, parsed, position });
  }

  if (capture.version_stable !== true) {
    fail(findings, 'capture_version_unstable',
      'capture.version_stable must be true for authoritative evidence');
  }
  const [before, after] = captures;
  if (before.raw !== after.raw || before.declaredHash !== after.declaredHash) {
    fail(findings, 'capture_version_disagreement',
      'the before and after RxNorm version responses are not byte-identical');
  }
  for (const captured of captures) {
    if (!captured.parsed) continue;
    if (captured.parsed.version !== bundle.rxnorm_release) {
      fail(findings, 'capture_release_disagreement',
        `capture.${captured.position} reports RxNorm release `
        + `${captured.parsed.version ?? '(missing)'} but the bundle declares `
        + `${bundle.rxnorm_release}`);
    }
    if (captured.parsed.apiVersion !== bundle.api_version) {
      fail(findings, 'capture_api_version_disagreement',
        `capture.${captured.position} reports API version `
        + `${captured.parsed.apiVersion ?? '(missing)'} but the bundle declares `
        + `${bundle.api_version}`);
    }
  }
  return findings;
}

// A hash is only meaningful if it is recomputed from the committed raw response.
function verifyHash(findings, bundle, key, declaredHash, label) {
  if (!SHA256.test(String(declaredHash ?? ''))) {
    return fail(findings, 'invalid_hash', `${label} is not a lowercase SHA-256`);
  }
  if (FIXTURE_HASHES.has(declaredHash)) {
    return fail(findings, 'fixture_hash_in_production_path',
      `${label} is a fixture placeholder and may not be used as evidence`);
  }
  const raw = bundleEntry(bundle, key);
  if (raw === null) {
    return fail(findings, 'missing_raw_evidence',
      `${label} has no committed raw response under bundle key ${key}`);
  }
  const recomputed = sha256(raw);
  if (recomputed !== declaredHash) {
    return fail(findings, 'hash_mismatch',
      `${label} declares ${declaredHash} but the committed response hashes to ${recomputed}`);
  }
  return findings;
}

function parseBundle(bundle, key) {
  try {
    return JSON.parse(bundleEntry(bundle, key) ?? '');
  } catch {
    return null;
  }
}

// Every committed response is hashed, not only the ones the manifest pins, so the
// bundle cannot carry an unverified status or relationship response.
function verifyBundleIntegrity(findings, bundle) {
  const recorded = bundle.response_hashes;
  if (!recorded || typeof recorded !== 'object') {
    return fail(findings, 'missing_response_hashes',
      'evidence bundle does not record a hash for each committed response');
  }
  for (const [key, raw] of Object.entries(bundle.responses ?? {})) {
    const declared = recorded[key];
    if (declared === undefined) {
      fail(findings, 'unhashed_response', `committed response ${key} has no recorded hash`);
      continue;
    }
    const recomputed = sha256(raw);
    if (recomputed !== declared) {
      fail(findings, 'bundle_hash_mismatch',
        `committed response ${key} hashes to ${recomputed} but the bundle records ${declared}`);
    }
  }
  for (const key of Object.keys(recorded)) {
    if (!(key in (bundle.responses ?? {}))) {
      fail(findings, 'orphan_response_hash', `bundle records a hash for absent response ${key}`);
    }
  }
  return findings;
}

// RxNorm's history-status response distinguishes Active / Obsolete / Remapped /
// Non Current / Unknown. A remapped concept must be re-reviewed against its
// replacement rather than silently accepted.
function verifyConceptStatus(findings, rxcui, role, bundle) {
  const key = `rxcui/${rxcui}/historystatus`;
  const raw = bundleEntry(bundle, key);
  if (raw === null) {
    return fail(findings, 'missing_concept_status',
      `${role} ${rxcui} has no committed history-status response`);
  }
  const history = parseBundle(bundle, key)?.rxcuiStatusHistory;
  const status = history?.metaData;
  if (!status) {
    return fail(findings, 'unreadable_concept_status',
      `${role} ${rxcui} history-status response is unparseable`);
  }
  if (String(history.attributes?.rxcui ?? '') !== rxcui) {
    fail(findings, 'concept_status_rxcui_mismatch',
      `${role} ${rxcui} history-status response identifies concept `
      + `${history.attributes?.rxcui ?? '(missing)'}`);
  }
  if (status.status !== ACCEPTABLE_STATUS) {
    return fail(findings, 'concept_not_active',
      `${role} ${rxcui} has RxNorm status ${status.status}, not ${ACCEPTABLE_STATUS}`);
  }
  if (String(status.isCurrent ?? '').toUpperCase() !== ACCEPTABLE_IS_CURRENT) {
    return fail(findings, 'concept_not_current',
      `${role} ${rxcui} is not current (isCurrent=${status.isCurrent})`);
  }
  return findings;
}

function verifyCombinationConcept(findings, combination, bundle) {
  const { rxnorm } = combination;
  verifyConceptStatus(findings, rxnorm.rxcui, 'combination MIN', bundle);
  for (const component of combination.components) {
    verifyConceptStatus(findings, component.rxcui, 'component', bundle);
    const componentPropertiesKey = `rxcui/${component.rxcui}/properties`;
    const componentProperties = parseBundle(bundle, componentPropertiesKey)?.properties;
    if (!componentProperties) {
      fail(findings, 'missing_component_properties',
        `component ${component.rxcui} has no readable properties response`);
      continue;
    }
    if (String(componentProperties.rxcui ?? '') !== component.rxcui) {
      fail(findings, 'component_properties_rxcui_mismatch',
        `component ${component.rxcui} properties response identifies concept `
        + `${componentProperties.rxcui ?? '(missing)'}`);
    }
    if (componentProperties.name !== component.name) {
      fail(findings, 'component_name_mismatch',
        `component ${component.rxcui} declares name "${component.name}" but RxNorm returned `
        + `"${componentProperties.name ?? '(missing)'}"`);
    }
    if (componentProperties.tty !== component.tty) {
      fail(findings, 'component_properties_tty_mismatch',
        `component ${component.rxcui} declares ${component.tty} but its properties response `
        + `returned ${componentProperties.tty ?? '(missing)'}`);
    }
  }
  const propertiesKey = `rxcui/${rxnorm.rxcui}/properties`;
  verifyHash(findings, bundle, propertiesKey, rxnorm.properties_response_sha256,
    `${combination.combination_id} rxnorm.properties_response_sha256`);

  const properties = parseBundle(bundle, propertiesKey)?.properties;
  if (!properties) {
    fail(findings, 'unreadable_properties_response',
      `${combination.combination_id} properties response is missing or unparseable`);
  } else {
    if (String(properties.rxcui) !== rxnorm.rxcui) {
      fail(findings, 'rxcui_mismatch',
        `${combination.combination_id} declares rxcui ${rxnorm.rxcui} but RxNorm returned ${properties.rxcui}`);
    }
    if (properties.tty !== 'MIN') {
      fail(findings, 'tty_mismatch',
        `${combination.combination_id} rxcui ${rxnorm.rxcui} is ${properties.tty}, not MIN`);
    }
    if (properties.name !== rxnorm.name) {
      fail(findings, 'name_mismatch',
        `${combination.combination_id} declares name "${rxnorm.name}" but RxNorm returned "${properties.name}"`);
    }
  }

  const relationKey = `rxcui/${rxnorm.rxcui}/related?rela=has_part`;
  verifyHash(findings, bundle, relationKey, rxnorm.component_relation.response_sha256,
    `${combination.combination_id} component_relation.response_sha256`);

  const related = parseBundle(bundle, relationKey);
  if (!related) {
    fail(findings, 'unreadable_relation_response',
      `${combination.combination_id} has_part response is missing or unparseable`);
    return findings;
  }
  const observed = new Set();
  const observedConcepts = new Map();
  for (const group of related.relatedGroup?.conceptGroup ?? []) {
    for (const concept of group.conceptProperties ?? []) {
      observed.add(String(concept.rxcui));
      observedConcepts.set(String(concept.rxcui), concept);
    }
  }
  const declared = new Set(rxnorm.component_relation.component_rxcuis);
  if (!sameSet(observed, declared)) {
    fail(findings, 'component_relation_mismatch',
      `${combination.combination_id} declares has_part ${[...declared].sort().join(', ')} `
      + `but RxNorm returned ${[...observed].sort().join(', ') || '(none)'}`);
  }
  for (const component of combination.components) {
    const relatedComponent = observedConcepts.get(component.rxcui);
    const tty = relatedComponent?.tty;
    if (tty !== undefined && tty !== component.tty) {
      fail(findings, 'component_tty_mismatch',
        `${combination.combination_id} component ${component.rxcui} declares ${component.tty} `
        + `but RxNorm returned ${tty}`);
    }
    if (relatedComponent !== undefined && relatedComponent.name !== component.name) {
      fail(findings, 'component_relation_name_mismatch',
        `${combination.combination_id} component ${component.rxcui} declares name `
        + `"${component.name}" but has_part returned `
        + `"${relatedComponent.name ?? '(missing)'}"`);
    }
  }
  return findings;
}

function verifyPresentation(findings, combination, presentation, bundle) {
  const scd = presentation.rxnorm_scd;
  const label = `${combination.combination_id} presentation `
    + `${presentation.source_identity.namespace}:${presentation.source_identity.code}`;

  if (scd.version !== bundle.rxnorm_release) {
    fail(findings, 'scd_release_disagreement',
      `${label} pins RxNorm release ${scd.version} but the evidence bundle was captured `
      + `against ${bundle.rxnorm_release}`);
  }
  verifyConceptStatus(findings, scd.rxcui, 'presentation SCD', bundle);

  // --- term type comes from the properties endpoint -------------------------
  const propertiesKey = `rxcui/${scd.rxcui}/properties`;
  verifyHash(findings, bundle, propertiesKey, scd.properties_response_sha256,
    `${label} rxnorm_scd.properties_response_sha256`);
  const properties = parseBundle(bundle, propertiesKey)?.properties;
  if (!properties) {
    fail(findings, 'unreadable_scd_properties', `${label} properties response is unparseable`);
  } else {
    if (String(properties.rxcui) !== scd.rxcui) {
      fail(findings, 'scd_rxcui_mismatch',
        `${label} declares SCD ${scd.rxcui} but the response is for ${properties.rxcui}`);
    }
    if (properties.tty !== 'SCD') {
      fail(findings, 'scd_tty_mismatch', `${label} rxcui ${scd.rxcui} is ${properties.tty}, not SCD`);
    }
    if (properties.name !== scd.name) {
      fail(findings, 'scd_name_mismatch',
        `${label} declares name "${scd.name}" but RxNorm returned "${properties.name}"`);
    }
  }

  // --- ingredients, strengths and dose form come from history-status --------
  const historyKey = `rxcui/${scd.rxcui}/historystatus`;
  verifyHash(findings, bundle, historyKey, scd.historystatus_response_sha256,
    `${label} rxnorm_scd.historystatus_response_sha256`);
  const features = parseBundle(bundle, historyKey)?.rxcuiStatusHistory?.definitionalFeatures;
  if (!features) {
    fail(findings, 'unreadable_scd_definitional_features',
      `${label} history-status response carries no definitionalFeatures`);
    return findings;
  }

  const doseForms = (features.doseFormConcept ?? []).map((entry) => entry.doseFormName);
  if (!doseForms.includes(scd.dose_form)) {
    fail(findings, 'scd_dose_form_mismatch',
      `${label} declares dose form "${scd.dose_form}" but RxNorm returned `
      + `${doseForms.map((form) => `"${form}"`).join(', ') || '(none)'}`);
  }

  const observedRows = features.ingredientAndStrength ?? [];
  const declared = new Map();
  for (const entry of scd.ingredients_and_strengths) {
    if (!INGREDIENT_RXCUI_FIELDS.has(entry.ingredient_rxcui_field)) {
      fail(findings, 'unsupported_ingredient_field',
        `${label} compares an unsupported field ${entry.ingredient_rxcui_field}`);
      return findings;
    }
    if (declared.has(entry.component_rxcui)) {
      fail(findings, 'duplicate_scd_component',
        `${label} declares component ${entry.component_rxcui} more than once`);
    }
    if (typeof entry.denominator_value !== 'string' || entry.denominator_value === ''
        || typeof entry.denominator_unit !== 'string' || entry.denominator_unit === '') {
      fail(findings, 'missing_scd_denominator',
        `${label} component ${entry.component_rxcui} must declare an exact denominator `
        + 'value and unit');
    }
    declared.set(entry.component_rxcui, entry);
  }

  // match each declared entry on the field it nominated, so a MIN may mix IN and PIN
  const matchedComponents = new Set();
  const claimedRows = new Set();
  for (const [componentRxcui, entry] of declared) {
    const matchingRowIndexes = [];
    for (const [index, observed] of observedRows.entries()) {
      if (String(observed[entry.ingredient_rxcui_field] ?? '') === componentRxcui) {
        matchingRowIndexes.push(index);
      }
    }
    if (matchingRowIndexes.length === 0) continue;
    if (matchingRowIndexes.length > 1) {
      fail(findings, 'scd_ingredient_row_ambiguous',
        `${label} component ${componentRxcui} matches more than one RxNorm strength row`);
      continue;
    }
    const rowIndex = matchingRowIndexes[0];
    if (claimedRows.has(rowIndex)) {
      fail(findings, 'scd_ingredient_row_reused',
        `${label} component ${componentRxcui} reuses an RxNorm strength row already assigned `
        + 'to another component');
      continue;
    }
    claimedRows.add(rowIndex);
    const row = observedRows[rowIndex];
    matchedComponents.add(componentRxcui);
    if (String(row.numeratorValue) !== entry.numerator_value
        || String(row.numeratorUnit) !== entry.numerator_unit) {
      fail(findings, 'scd_strength_mismatch',
        `${label} declares ${componentRxcui} at ${entry.numerator_value}${entry.numerator_unit} `
        + `but RxNorm returned ${row.numeratorValue}${row.numeratorUnit}`);
    }
    if (typeof entry.denominator_value === 'string'
        && typeof entry.denominator_unit === 'string'
        && (String(row.denominatorValue) !== entry.denominator_value
        || String(row.denominatorUnit) !== entry.denominator_unit)) {
      fail(findings, 'scd_denominator_mismatch',
        `${label} declares ${componentRxcui} per ${entry.denominator_value}${entry.denominator_unit} `
        + `but RxNorm returned ${row.denominatorValue}${row.denominatorUnit}`);
    }
  }
  // exact equality in BOTH directions: an extra returned row fails like a missing one
  if (!sameSet(matchedComponents, new Set(declared.keys()))
      || claimedRows.size !== observedRows.length
      || observedRows.length !== declared.size) {
    fail(findings, 'scd_ingredient_mismatch',
      `${label} declares ${[...declared.keys()].sort().join(', ')} but RxNorm returned `
      + `${observedRows.length} ingredient rows of which ${matchedComponents.size} matched`);
  }
  const componentRxcuis = new Set(combination.components.map((component) => component.rxcui));
  if (!sameSet(new Set(declared.keys()), componentRxcuis)) {
    fail(findings, 'scd_component_mismatch',
      `${label} SCD ingredients do not equal the combination's declared components`);
  }

  // --- the SCD must reach THIS combination's MIN ---------------------------
  const minKey = `rxcui/${scd.rxcui}/related?rela=has_ingredients`;
  verifyHash(findings, bundle, minKey, scd.min_relation_response_sha256,
    `${label} rxnorm_scd.min_relation_response_sha256`);
  const minRelation = parseBundle(bundle, minKey);
  if (!minRelation) {
    fail(findings, 'unreadable_scd_min_relation',
      `${label} has_ingredients response is missing or unparseable`);
    return findings;
  }
  const relatedMins = new Set();
  for (const group of minRelation.relatedGroup?.conceptGroup ?? []) {
    for (const concept of group.conceptProperties ?? []) {
      if (concept.tty === 'MIN') relatedMins.add(String(concept.rxcui));
    }
  }
  const expectedMins = new Set([combination.rxnorm.rxcui]);
  if (!sameSet(relatedMins, expectedMins)) {
    fail(findings, 'scd_min_relation_mismatch',
      `${label} SCD ${scd.rxcui} must relate exactly to MIN ${combination.rxnorm.rxcui} `
      + `(has_ingredients returned ${[...relatedMins].sort().join(', ') || '(no MIN)'})`);
  }
  return findings;
}

function verifyRelease(findings, combination, bundle) {
  if (bundle.rxnorm_release !== combination.rxnorm.version) {
    fail(findings, 'release_disagreement',
      `${combination.combination_id} pins RxNorm release ${combination.rxnorm.version} `
      + `but the evidence bundle was captured against ${bundle.rxnorm_release}`);
  }
  if (bundle.api_version !== combination.rxnorm.api_version) {
    fail(findings, 'api_version_disagreement',
      `${combination.combination_id} pins API version ${combination.rxnorm.api_version} `
      + `but the evidence bundle was captured against ${bundle.api_version}`);
  }
  return findings;
}

// Verifies one combination against the committed raw evidence bundle. The
// non-authoritative option exists solely for the real-response integration test;
// manifest verification deliberately has no equivalent option.
export function verifyCombinationRxNormEvidence(combination, bundle, options = undefined) {
  const findings = [];
  if (!bundle || typeof bundle !== 'object') {
    fail(findings, 'missing_evidence_bundle',
      `${combination?.combination_id ?? 'combination'} has no evidence bundle`);
    return { combination_id: combination?.combination_id ?? null, verified: false, findings };
  }
  try {
    combination = strictPlainDataSnapshot(combination, 'combination identity');
    bundle = strictPlainDataSnapshot(bundle, 'combination evidence bundle');
  } catch (error) {
    fail(findings, 'non_plain_evidence_input', error.message);
    return {
      combination_id: combination?.combination_id ?? null,
      verified: false,
      findings,
    };
  }
  if (bundle.schema_version !== EVIDENCE_BUNDLE_SCHEMA_VERSION) {
    fail(findings, 'unsupported_bundle_schema', 'evidence bundle schema_version is unsupported');
  }
  verifyBundleAuthority(findings, combination, bundle, options);
  verifyCapture(findings, bundle);
  verifyBundleIntegrity(findings, bundle);
  verifyRelease(findings, combination, bundle);
  verifyCombinationConcept(findings, combination, bundle);
  for (const presentation of combination.presentations) {
    verifyPresentation(findings, combination, presentation, bundle);
  }
  return {
    combination_id: combination.combination_id,
    verified: findings.length === 0,
    findings,
  };
}

export function verifyCombinationManifestEvidence(manifest, bundles, options = {}) {
  const pmbjpSourceReport = options?.pmbjpSourceReport ?? null;
  const snapshot = strictPlainDataSnapshot(manifest, 'combination identity manifest');
  const bundleSnapshot = strictPlainDataSnapshot(
    bundles ?? {},
    'combination evidence bundles',
  );
  const fullIdentityManifest = snapshot.schema_version === 1
    && snapshot.identity_namespace === 'aushadhi:ingredient-identity:v1';
  const hasPmbjpPresentations = snapshot.combinations.some((combination) => (
    combination.presentations?.some(
      (presentation) => presentation.source_identity?.namespace === 'presentation:pmbjp',
    )
  ));
  let pmbjpSourceError = null;
  if (fullIdentityManifest && hasPmbjpPresentations) {
    try {
      assertVerifiedPmbjpCombinationEvidence(pmbjpSourceReport, manifest);
    } catch (error) {
      pmbjpSourceError = error;
    }
  }
  const reports = snapshot.combinations.map((combination) => {
    const rxNormReport = verifyCombinationRxNormEvidence(
      combination,
      bundleSnapshot[combination.combination_id],
    );
    const findings = [...rxNormReport.findings];
    for (const presentation of combination.presentations ?? []) {
      verifyPresentationProductBinding(findings, combination, presentation);
    }
    if (pmbjpSourceError !== null && combination.presentations?.some(
      (presentation) => presentation.source_identity?.namespace === 'presentation:pmbjp',
    )) {
      fail(findings, 'unverified_pmbjp_product_identity_source', pmbjpSourceError.message);
    }
    return {
      combination_id: combination.combination_id,
      verified: findings.length === 0,
      findings,
    };
  });
  const report = deepFreeze({
    verified: reports.every((report) => report.verified),
    combinations_checked: reports.length,
    reports,
  });
  if (report.verified) {
    MANIFEST_REPORT_BINDINGS.set(report, {
      manifest,
      snapshot,
      fingerprint: sha256(JSON.stringify(snapshot)),
      pmbjp_source_report: pmbjpSourceReport,
    });
  }
  return report;
}

export function assertVerifiedCombinationManifestEvidence(report, manifest) {
  if (!report || typeof report !== 'object' || !MANIFEST_REPORT_BINDINGS.has(report)) {
    throw new TypeError('combination evidence report is not an authentic verifier result');
  }
  const binding = MANIFEST_REPORT_BINDINGS.get(report);
  if (binding.manifest !== manifest) {
    throw new TypeError('combination evidence report is not bound to this exact manifest object');
  }
  const currentSnapshot = strictPlainDataSnapshot(manifest, 'combination identity manifest');
  if (sha256(JSON.stringify(currentSnapshot)) !== binding.fingerprint) {
    throw new TypeError('combination evidence manifest changed since evidence verification');
  }
  if (report.verified !== true) {
    throw new TypeError('combination evidence report is not verified');
  }
  return report;
}

export function verifiedCombinationManifestSnapshot(report, manifest) {
  assertVerifiedCombinationManifestEvidence(report, manifest);
  return MANIFEST_REPORT_BINDINGS.get(report).snapshot;
}
