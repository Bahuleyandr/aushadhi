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

export const EVIDENCE_BUNDLE_SCHEMA_VERSION = 1;
// which RxNorm ingredient notion a comparison used; recorded per presentation so a
// PIN-based product cannot silently be compared on a different field
export const INGREDIENT_RXCUI_FIELDS = new Set([
  'rxcui', 'baseRxcui', 'bossRxcui', 'activeIngredientRxcui',
]);
// Term type alone is not enough: an obsolete or remapped concept is still
// recognisably an SCD. Every concept in the relationship graph must be active and
// current.
const ACCEPTABLE_STATUS = 'Active';
const ACCEPTABLE_IS_CURRENT = 'YES';

const SHA256 = /^[a-f0-9]{64}$/u;
// fixture hashes exist so tests can exercise matching without network capture; a
// production verification path must never accept one
const FIXTURE_HASHES = new Set([
  'a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64), '0'.repeat(64), 'f'.repeat(64),
]);

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const sameSet = (left, right) => left.size === right.size && [...left].every((v) => right.has(v));

function fail(findings, code, detail) {
  findings.push({ code, detail });
  return findings;
}

function bundleEntry(bundle, key) {
  const raw = bundle.responses?.[key];
  return typeof raw === 'string' ? raw : null;
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
  const status = parseBundle(bundle, key)?.rxcuiStatusHistory?.metaData;
  if (!status) {
    return fail(findings, 'unreadable_concept_status',
      `${role} ${rxcui} history-status response is unparseable`);
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
  const observedTty = new Map();
  for (const group of related.relatedGroup?.conceptGroup ?? []) {
    for (const concept of group.conceptProperties ?? []) {
      observed.add(String(concept.rxcui));
      observedTty.set(String(concept.rxcui), concept.tty);
    }
  }
  const declared = new Set(rxnorm.component_relation.component_rxcuis);
  if (!sameSet(observed, declared)) {
    fail(findings, 'component_relation_mismatch',
      `${combination.combination_id} declares has_part ${[...declared].sort().join(', ')} `
      + `but RxNorm returned ${[...observed].sort().join(', ') || '(none)'}`);
  }
  for (const component of combination.components) {
    const tty = observedTty.get(component.rxcui);
    if (tty !== undefined && tty !== component.tty) {
      fail(findings, 'component_tty_mismatch',
        `${combination.combination_id} component ${component.rxcui} declares ${component.tty} `
        + `but RxNorm returned ${tty}`);
    }
  }
  return findings;
}

function verifyPresentation(findings, combination, presentation, bundle) {
  const scd = presentation.rxnorm_scd;
  const label = `${combination.combination_id} presentation `
    + `${presentation.source_identity.namespace}:${presentation.source_identity.code}`;
  const key = `rxcui/${scd.rxcui}/allhistoricalndcs-or-properties`;
  verifyHash(findings, bundle, key, scd.response_sha256, `${label} rxnorm_scd.response_sha256`);

  const observed = parseBundle(bundle, key);
  if (!observed) {
    fail(findings, 'unreadable_scd_response', `${label} SCD response is missing or unparseable`);
    return findings;
  }
  if (String(observed.rxcui ?? '') !== scd.rxcui) {
    fail(findings, 'scd_rxcui_mismatch',
      `${label} declares SCD ${scd.rxcui} but the response is for ${observed.rxcui}`);
  }
  if (observed.tty !== 'SCD') {
    fail(findings, 'scd_tty_mismatch', `${label} rxcui ${scd.rxcui} is ${observed.tty}, not SCD`);
  }
  if (observed.dose_form !== scd.dose_form) {
    fail(findings, 'scd_dose_form_mismatch',
      `${label} declares dose form "${scd.dose_form}" but RxNorm returned "${observed.dose_form}"`);
  }

  // the compared field is selected PER ENTRY: a MIN may mix IN and PIN components,
  // and RxNorm exposes base / basis-of-strength / active ingredient separately
  const declaredIngredients = new Map();
  const fieldByComponent = new Map();
  for (const entry of scd.ingredients_and_strengths) {
    if (!INGREDIENT_RXCUI_FIELDS.has(entry.ingredient_rxcui_field)) {
      fail(findings, 'unsupported_ingredient_field',
        `${label} compares an unsupported field ${entry.ingredient_rxcui_field}`);
      return findings;
    }
    declaredIngredients.set(entry.component_rxcui, `${entry.numerator_value}${entry.numerator_unit}`);
    fieldByComponent.set(entry.component_rxcui, entry.ingredient_rxcui_field);
  }
  const observedIngredients = new Map();
  for (const entry of observed.ingredients ?? []) {
    // match on whichever field the corresponding declared entry nominated
    for (const [componentRxcui, field] of fieldByComponent) {
      if (String(entry[field] ?? '') === componentRxcui) {
        observedIngredients.set(componentRxcui, `${entry.numerator_value}${entry.numerator_unit}`);
      }
    }
    if (![...fieldByComponent.values()].some((field) => (
      declaredIngredients.has(String(entry[field] ?? ''))
    ))) {
      observedIngredients.set(`unmatched:${entry.rxcui ?? entry.baseRxcui ?? '?'}`, 'unmatched');
    }
  }
  if (!sameSet(new Set(declaredIngredients.keys()), new Set(observedIngredients.keys()))) {
    fail(findings, 'scd_ingredient_mismatch',
      `${label} declares ingredients ${[...declaredIngredients.keys()].sort().join(', ')} `
      + `but RxNorm returned ${[...observedIngredients.keys()].sort().join(', ') || '(none)'}`);
  }
  for (const [rxcui, strength] of declaredIngredients) {
    const observedStrength = observedIngredients.get(rxcui);
    if (observedStrength !== undefined && observedStrength !== strength) {
      fail(findings, 'scd_strength_mismatch',
        `${label} declares ${rxcui} at ${strength} but RxNorm returned ${observedStrength}`);
    }
  }
  verifyConceptStatus(findings, scd.rxcui, 'presentation SCD', bundle);
  const componentRxcuis = new Set(combination.components.map((component) => component.rxcui));
  if (!sameSet(new Set(declaredIngredients.keys()), componentRxcuis)) {
    fail(findings, 'scd_component_mismatch',
      `${label} SCD ingredients do not equal the combination's declared components`);
  }

  // An SCD reaches its MIN through has_ingredients. Checking that link closes the
  // gap where an SCD carries the right ingredient set but belongs to a different
  // multiple-ingredient concept.
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
  if (!relatedMins.has(combination.rxnorm.rxcui)) {
    fail(findings, 'scd_min_relation_mismatch',
      `${label} SCD ${scd.rxcui} does not relate to MIN ${combination.rxnorm.rxcui} `
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

// Verifies one combination against the committed raw evidence bundle. Returns a
// report; the CLI turns a non-empty findings list into a non-zero exit.
export function verifyCombinationRxNormEvidence(combination, bundle) {
  const findings = [];
  if (!bundle || typeof bundle !== 'object') {
    fail(findings, 'missing_evidence_bundle',
      `${combination?.combination_id ?? 'combination'} has no evidence bundle`);
    return { combination_id: combination?.combination_id ?? null, verified: false, findings };
  }
  if (bundle.schema_version !== EVIDENCE_BUNDLE_SCHEMA_VERSION) {
    fail(findings, 'unsupported_bundle_schema', 'evidence bundle schema_version is unsupported');
  }
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

export function verifyCombinationManifestEvidence(manifest, bundles) {
  const reports = manifest.combinations.map((combination) => (
    verifyCombinationRxNormEvidence(combination, bundles?.[combination.combination_id])
  ));
  return {
    verified: reports.every((report) => report.verified),
    combinations_checked: reports.length,
    reports,
  };
}
