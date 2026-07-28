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

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
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

export function verifyCombinationManifestEvidence(manifest, bundles) {
  const reports = manifest.combinations.map((combination) => (
    verifyCombinationRxNormEvidence(combination, bundles?.[combination.combination_id])
  ));
  const report = deepFreeze({
    verified: reports.every((report) => report.verified),
    combinations_checked: reports.length,
    reports,
  });
  if (report.verified) {
    MANIFEST_REPORT_BINDINGS.set(report, {
      manifest,
      fingerprint: sha256(JSON.stringify(manifest)),
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
  if (sha256(JSON.stringify(manifest)) !== binding.fingerprint) {
    throw new TypeError('combination evidence manifest changed since evidence verification');
  }
  if (report.verified !== true) {
    throw new TypeError('combination evidence report is not verified');
  }
  return report;
}
