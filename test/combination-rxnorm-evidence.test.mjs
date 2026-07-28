// Mandatory RxNorm evidence gate for fixed-dose combinations.
//
// Internal schema consistency does not prove RxNorm returned the declared data: a
// self-consistent manifest could pin any plausible rxcui, tty and hash. This suite
// pins the offline verifier that closes that gap by recomputing hashes from a
// committed raw response bundle and checking semantics against it.
//
// The fixtures below use the REAL RxNav response shapes. An earlier version used
// shapes invented for convenience, and against genuine responses the verifier found
// nothing to compare while reporting success. See
// test/combination-rxnorm-integration.test.mjs, which runs the same verifier over
// actually-captured responses.
import crypto from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_BUNDLE_SCHEMA_VERSION,
  INGREDIENT_RXCUI_FIELDS,
  assertVerifiedCombinationManifestEvidence,
  verifyCombinationManifestEvidence,
  verifyCombinationRxNormEvidence,
} from '../src/lib/combination-rxnorm-evidence.mjs';
import { ingredientIdForName } from '../src/lib/ingredient-identity.mjs';
import {
  productAssertionForRow,
  productAssertionHashForRow,
  productIdForRow,
} from '../src/lib/product-resolver.mjs';

const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const VERSION_RESPONSE = JSON.stringify({ version: '06-Jul-2026', apiVersion: '3.1.354' });
const PMBJP_89 = {
  brand_name: 'Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg) Tablets IP',
  manufacturer: 'PMBJP (Jan Aushadhi)',
  pack_label: "10's",
  form_raw: null,
  ingredients: [
    {
      molecule: 'co-trimoxazole sulphamethoxazole',
      strength_raw: '800mg',
      strength_value: 800,
      strength_unit: 'mg',
    },
    {
      molecule: 'trimethoprim',
      strength_raw: '160mg',
      strength_value: 160,
      strength_unit: 'mg',
    },
  ],
};

const properties = (rxcui, name, tty) => JSON.stringify({ properties: { rxcui, name, tty } });
const conceptGroup = (concepts) => JSON.stringify({
  relatedGroup: { conceptGroup: [{ conceptProperties: concepts }] },
});
const historyStatus = (rxcui, { status = 'Active', isCurrent = 'YES', features = null } = {}) => (
  JSON.stringify({
    rxcuiStatusHistory: {
      metaData: { rxcui, status, isCurrent },
      attributes: { rxcui },
      ...(features ? { definitionalFeatures: features } : {}),
    },
  })
);
const strengthRow = (rxcui, numerator, { denominator = '1', unit = 'EACH' } = {}) => ({
  baseRxcui: rxcui,
  bossRxcui: rxcui,
  activeIngredientRxcui: rxcui,
  moietyRxcui: rxcui,
  numeratorValue: numerator,
  numeratorUnit: 'MG',
  denominatorValue: denominator,
  denominatorUnit: unit,
});
const scdFeatures = (smx, tmp, doseForm = 'Oral Tablet') => ({
  ingredientAndStrength: [strengthRow('10180', smx), strengthRow('10829', tmp)],
  doseFormConcept: [{ doseFormRxcui: '317541', doseFormName: doseForm }],
});

const RESPONSES = {
  'rxcui/10831/properties': properties('10831', 'sulfamethoxazole / trimethoprim', 'MIN'),
  'rxcui/10831/related?rela=has_part': conceptGroup([
    { rxcui: '10180', name: 'sulfamethoxazole', tty: 'IN' },
    { rxcui: '10829', name: 'trimethoprim', tty: 'IN' },
  ]),
  'rxcui/10831/historystatus': historyStatus('10831'),
  'rxcui/10180/properties': properties('10180', 'sulfamethoxazole', 'IN'),
  'rxcui/10180/historystatus': historyStatus('10180'),
  'rxcui/10829/properties': properties('10829', 'trimethoprim', 'IN'),
  'rxcui/10829/historystatus': historyStatus('10829'),
  'rxcui/198335/properties': properties(
    '198335', 'sulfamethoxazole 800 MG / trimethoprim 160 MG Oral Tablet', 'SCD',
  ),
  'rxcui/198335/historystatus': historyStatus('198335', { features: scdFeatures('800', '160') }),
  'rxcui/198335/related?rela=has_ingredients': conceptGroup([
    { rxcui: '10831', name: 'sulfamethoxazole / trimethoprim', tty: 'MIN' },
  ]),
};

const bundle = (overrides = {}) => {
  const {
    responses: responseOverrides = {},
    capture: captureOverrides = {},
    ...bundleOverrides
  } = overrides;
  const responses = { ...RESPONSES, ...responseOverrides };
  return {
    schema_version: EVIDENCE_BUNDLE_SCHEMA_VERSION,
    classification: 'combination_identity_evidence',
    promotion_authority: 'identity_only',
    audit_only: false,
    combination_id: 'combination:co-trimoxazole:rxnorm-10831',
    rxnorm_release: '06-Jul-2026',
    api_version: '3.1.354',
    capture: {
      base_url: 'https://rxnav.nlm.nih.gov/REST',
      captured_at: '2026-07-28T06:27:46.630Z',
      version_before_response: VERSION_RESPONSE,
      version_before_sha256: sha256(VERSION_RESPONSE),
      version_after_response: VERSION_RESPONSE,
      version_after_sha256: sha256(VERSION_RESPONSE),
      version_stable: true,
      ...captureOverrides,
    },
    ...bundleOverrides,
    responses,
    response_hashes: Object.fromEntries(
      Object.entries(responses).map(([key, raw]) => [key, sha256(raw)]),
    ),
  };
};

const combination = (overrides = {}) => ({
  combination_id: 'combination:co-trimoxazole:rxnorm-10831',
  runtime_drug: 'co-trimoxazole',
  rxnorm: {
    rxcui: '10831',
    name: 'sulfamethoxazole / trimethoprim',
    tty: 'MIN',
    version: '06-Jul-2026',
    api_version: '3.1.354',
    properties_response_sha256: sha256(RESPONSES['rxcui/10831/properties']),
    component_relation: {
      relationship: 'has_part',
      component_rxcuis: ['10180', '10829'],
      response_sha256: sha256(RESPONSES['rxcui/10831/related?rela=has_part']),
    },
  },
  components: [
    {
      name: 'sulfamethoxazole',
      rxcui: '10180',
      tty: 'IN',
      assertion_ingredient_ids: [
        ingredientIdForName('sulfamethoxazole'),
        ingredientIdForName('co-trimoxazole sulphamethoxazole'),
      ],
    },
    {
      name: 'trimethoprim',
      rxcui: '10829',
      tty: 'IN',
      assertion_ingredient_ids: [ingredientIdForName('trimethoprim')],
    },
  ],
  presentations: [{
    source_identity: { namespace: 'presentation:pmbjp', code: '89' },
    product_id: productIdForRow(PMBJP_89),
    product_assertion_sha256: productAssertionHashForRow(PMBJP_89),
    product_assertion: productAssertionForRow(PMBJP_89),
    route: 'oral',
    formulation: 'tablet',
    rxnorm_scd: {
      rxcui: '198335',
      tty: 'SCD',
      name: 'sulfamethoxazole 800 MG / trimethoprim 160 MG Oral Tablet',
      ingredients_and_strengths: [
        {
          component_rxcui: '10180', ingredient_rxcui_field: 'baseRxcui',
          numerator_value: '800', numerator_unit: 'MG',
          denominator_value: '1', denominator_unit: 'EACH',
        },
        {
          component_rxcui: '10829', ingredient_rxcui_field: 'baseRxcui',
          numerator_value: '160', numerator_unit: 'MG',
          denominator_value: '1', denominator_unit: 'EACH',
        },
      ],
      dose_form: 'Oral Tablet',
      version: '06-Jul-2026',
      properties_response_sha256: sha256(RESPONSES['rxcui/198335/properties']),
      historystatus_response_sha256: sha256(RESPONSES['rxcui/198335/historystatus']),
      min_relation_response_sha256: sha256(
        RESPONSES['rxcui/198335/related?rela=has_ingredients'],
      ),
    },
  }],
  provenance: {
    identity_sources: [{ kind: 'official_product_list', evidence_ref: 'pmbjp-list' }],
  },
  review: {
    evidence: [{
      evidence_ref: 'pmbjp-list',
      source_id: 'janaushadhi',
      identifier: 'pmbjp-product-list:89',
    }],
  },
  ...overrides,
});

const codes = (result) => result.findings.map((finding) => finding.code);
const rehash = (key, raw) => ({
  evidence: bundle({ responses: { [key]: raw } }),
  hash: sha256(raw),
  entry: combination(),
});

test('a combination backed by matching captured responses verifies', () => {
  const result = verifyCombinationRxNormEvidence(combination(), bundle());
  assert.deepEqual(result.findings, []);
  assert.equal(result.verified, true);
});

test('authoritative evidence has an exact classification, authority, audit flag and combination id', () => {
  for (const [override, code] of [
    [{ classification: 'verifier_integration_fixture' }, 'invalid_bundle_classification'],
    [{ promotion_authority: 'none' }, 'invalid_promotion_authority'],
    [{ audit_only: true }, 'audit_only_evidence'],
    [{ combination_id: 'combination:other:rxnorm-999' }, 'bundle_combination_id_mismatch'],
  ]) {
    const result = verifyCombinationRxNormEvidence(combination(), bundle(override));
    assert.ok(codes(result).includes(code), `${JSON.stringify(override)} must fail as ${code}`);
    assert.equal(result.verified, false);
  }
});

test('a capture cannot predate the RxNorm release it claims to verify', () => {
  const result = verifyCombinationRxNormEvidence(
    combination(),
    bundle({ capture: { captured_at: '2000-01-01T00:00:00.000Z' } }),
  );
  assert.equal(result.verified, false);
  assert.ok(codes(result).includes('capture_predates_rxnorm_release'));
});

test('an authoritative capture cannot claim a future capture time', () => {
  const result = verifyCombinationRxNormEvidence(
    combination(),
    bundle({ capture: { captured_at: '2099-01-01T00:00:00.000Z' } }),
  );
  assert.equal(result.verified, false);
  assert.ok(codes(result).includes('capture_timestamp_in_future'));
});

test('a non-authoritative fixture requires an explicit test-only option', () => {
  const evidence = bundle({
    classification: 'verifier_integration_fixture',
    promotion_authority: 'none',
    audit_only: true,
  });
  assert.equal(verifyCombinationRxNormEvidence(combination(), evidence).verified, false);
  assert.equal(
    verifyCombinationRxNormEvidence(
      combination(),
      evidence,
      { allowNonAuthoritativeFixture: true },
    ).verified,
    true,
  );
});

test('capture verification requires both raw version responses and their exact hashes', () => {
  const missing = bundle();
  delete missing.capture.version_before_response;
  assert.ok(codes(verifyCombinationRxNormEvidence(combination(), missing))
    .includes('missing_capture_version_response'));

  const badHash = bundle({
    capture: { version_after_sha256: sha256('not the captured response') },
  });
  assert.ok(codes(verifyCombinationRxNormEvidence(combination(), badHash))
    .includes('capture_version_hash_mismatch'));
});

test('capture verification binds evidence to the exact RxNorm REST base URL', () => {
  const result = verifyCombinationRxNormEvidence(
    combination(),
    bundle({ capture: { base_url: 'https://example.invalid/REST' } }),
  );
  assert.ok(codes(result).includes('invalid_capture_base_url'));
});

test('authoritative evidence requires an ISO UTC capture timestamp', () => {
  for (const captured_at of [undefined, '2026-07-28', 'not-a-date']) {
    const evidence = bundle({ capture: {
      ...(captured_at === undefined ? {} : { captured_at }),
    } });
    if (captured_at === undefined) delete evidence.capture.captured_at;
    const result = verifyCombinationRxNormEvidence(
      combination(),
      evidence,
    );
    assert.ok(codes(result).includes('invalid_capture_timestamp'));
  }
});

test('capture verification refuses malformed, incomplete and placeholder version evidence', () => {
  const malformed = '{';
  const malformedResult = verifyCombinationRxNormEvidence(combination(), bundle({
    capture: {
      version_before_response: malformed,
      version_before_sha256: sha256(malformed),
      version_after_response: malformed,
      version_after_sha256: sha256(malformed),
    },
  }));
  assert.ok(codes(malformedResult).includes('unreadable_capture_version_response'));

  const missingApi = JSON.stringify({ version: '06-Jul-2026' });
  const missingApiResult = verifyCombinationRxNormEvidence(combination(), bundle({
    capture: {
      version_before_response: missingApi,
      version_before_sha256: sha256(missingApi),
      version_after_response: missingApi,
      version_after_sha256: sha256(missingApi),
    },
  }));
  assert.ok(codes(missingApiResult).includes('capture_api_version_disagreement'));

  const placeholderResult = verifyCombinationRxNormEvidence(combination(), bundle({
    capture: {
      version_before_sha256: 'a'.repeat(64),
      version_after_sha256: 'a'.repeat(64),
    },
  }));
  assert.ok(codes(placeholderResult).includes('invalid_capture_version_hash'));
});

test('capture verification requires byte-stable before and after version responses', () => {
  const changed = `${VERSION_RESPONSE}\n`;
  const evidence = bundle({
    capture: {
      version_after_response: changed,
      version_after_sha256: sha256(changed),
    },
  });
  assert.ok(codes(verifyCombinationRxNormEvidence(combination(), evidence))
    .includes('capture_version_disagreement'));

  assert.ok(codes(verifyCombinationRxNormEvidence(
    combination(),
    bundle({ capture: { version_stable: false } }),
  )).includes('capture_version_unstable'));
});

test('captured version content must equal the top-level release and API version', () => {
  const otherRelease = JSON.stringify({ version: '01-Jun-2026', apiVersion: '3.1.354' });
  const releaseResult = verifyCombinationRxNormEvidence(combination(), bundle({
    capture: {
      version_before_response: otherRelease,
      version_before_sha256: sha256(otherRelease),
      version_after_response: otherRelease,
      version_after_sha256: sha256(otherRelease),
    },
  }));
  assert.ok(codes(releaseResult).includes('capture_release_disagreement'));

  const otherApi = JSON.stringify({ version: '06-Jul-2026', apiVersion: '3.1.300' });
  const apiResult = verifyCombinationRxNormEvidence(combination(), bundle({
    capture: {
      version_before_response: otherApi,
      version_before_sha256: sha256(otherApi),
      version_after_response: otherApi,
      version_after_sha256: sha256(otherApi),
    },
  }));
  assert.ok(codes(apiResult).includes('capture_api_version_disagreement'));
});

test('the supported ingredient fields are the RxNav ingredient notions', () => {
  assert.deepEqual([...INGREDIENT_RXCUI_FIELDS].sort(), [
    'activeIngredientRxcui', 'baseRxcui', 'bossRxcui', 'moietyRxcui',
  ]);
});

test('a synthetic fixture hash is refused on the production path', () => {
  const entry = combination();
  entry.rxnorm.properties_response_sha256 = 'a'.repeat(64);
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, bundle()))
    .includes('fixture_hash_in_production_path'));
});

test('a hash that does not match the committed response is refused', () => {
  const entry = combination();
  entry.rxnorm.component_relation.response_sha256 = sha256('a different response');
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, bundle())).includes('hash_mismatch'));
});

test('missing raw evidence is refused rather than assumed', () => {
  const evidence = bundle();
  delete evidence.responses['rxcui/10831/related?rela=has_part'];
  delete evidence.response_hashes['rxcui/10831/related?rela=has_part'];
  const result = verifyCombinationRxNormEvidence(combination(), evidence);
  assert.ok(codes(result).includes('missing_raw_evidence'));
});

test('a declared has_part set that RxNorm did not return is refused', () => {
  const raw = conceptGroup([{ rxcui: '10180', tty: 'IN' }, { rxcui: '99999', tty: 'IN' }]);
  const { evidence, hash, entry } = rehash('rxcui/10831/related?rela=has_part', raw);
  entry.rxnorm.component_relation.response_sha256 = hash;
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, evidence))
    .includes('component_relation_mismatch'));
});

test('each component name and term type must match its own properties response', () => {
  const wrongName = combination();
  wrongName.components[0].name = 'not sulfamethoxazole';
  assert.ok(codes(verifyCombinationRxNormEvidence(wrongName, bundle()))
    .includes('component_name_mismatch'));

  const wrongTtyRaw = properties('10180', 'sulfamethoxazole', 'PIN');
  const wrongTtyEvidence = bundle({
    responses: { 'rxcui/10180/properties': wrongTtyRaw },
  });
  assert.ok(codes(verifyCombinationRxNormEvidence(combination(), wrongTtyEvidence))
    .includes('component_properties_tty_mismatch'));

  const wrongRelationName = conceptGroup([
    { rxcui: '10180', name: 'not sulfamethoxazole', tty: 'IN' },
    { rxcui: '10829', name: 'trimethoprim', tty: 'IN' },
  ]);
  const relationFixture = rehash(
    'rxcui/10831/related?rela=has_part',
    wrongRelationName,
  );
  relationFixture.entry.rxnorm.component_relation.response_sha256 = relationFixture.hash;
  assert.ok(codes(verifyCombinationRxNormEvidence(
    relationFixture.entry,
    relationFixture.evidence,
  )).includes('component_relation_name_mismatch'));
});

test('a concept that is not actually a MIN is refused', () => {
  const raw = properties('10831', 'sulfamethoxazole / trimethoprim', 'SCD');
  const { evidence, hash, entry } = rehash('rxcui/10831/properties', raw);
  entry.rxnorm.properties_response_sha256 = hash;
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, evidence)).includes('tty_mismatch'));
});

test('a presentation that is not actually an SCD is refused', () => {
  const raw = properties('198335', 'sulfamethoxazole 800 MG / trimethoprim 160 MG Oral Tablet', 'SBD');
  const { evidence, hash, entry } = rehash('rxcui/198335/properties', raw);
  entry.presentations[0].rxnorm_scd.properties_response_sha256 = hash;
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, evidence)).includes('scd_tty_mismatch'));
});

test('a changed SCD strength or dose form is refused', () => {
  const raw = historyStatus('198335', { features: scdFeatures('400', '160', 'Oral Suspension') });
  const { evidence, hash, entry } = rehash('rxcui/198335/historystatus', raw);
  entry.presentations[0].rxnorm_scd.historystatus_response_sha256 = hash;
  const result = verifyCombinationRxNormEvidence(entry, evidence);
  assert.ok(codes(result).includes('scd_strength_mismatch'));
  assert.ok(codes(result).includes('scd_dose_form_mismatch'));
});

test('an extra ingredient row RxNorm returned fails like a missing one', () => {
  const features = scdFeatures('800', '160');
  features.ingredientAndStrength.push(strengthRow('2551', '250'));
  const raw = historyStatus('198335', { features });
  const { evidence, hash, entry } = rehash('rxcui/198335/historystatus', raw);
  entry.presentations[0].rxnorm_scd.historystatus_response_sha256 = hash;
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, evidence))
    .includes('scd_ingredient_mismatch'));
});

test('two declared ingredients cannot consume the same observed strength row', () => {
  const sharedRow = {
    ...strengthRow('10180', '800'),
    bossRxcui: '10829',
  };
  const raw = historyStatus('198335', {
    features: {
      ingredientAndStrength: [sharedRow, strengthRow('2551', '250')],
      doseFormConcept: [{ doseFormRxcui: '317541', doseFormName: 'Oral Tablet' }],
    },
  });
  const { evidence, hash, entry } = rehash('rxcui/198335/historystatus', raw);
  entry.presentations[0].rxnorm_scd.historystatus_response_sha256 = hash;
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[1]
    .ingredient_rxcui_field = 'bossRxcui';
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[1].numerator_value = '800';
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, evidence))
    .includes('scd_ingredient_row_reused'));
});

test('every declared SCD ingredient requires an exact denominator value and unit', () => {
  const entry = combination();
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[0].denominator_value = null;
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[0].denominator_unit = null;
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, bundle()))
    .includes('missing_scd_denominator'));
});

test('a missing denominator is refused even when its ingredient row is also missing', () => {
  const features = scdFeatures('800', '160');
  features.ingredientAndStrength.shift();
  features.ingredientAndStrength.push(strengthRow('2551', '250'));
  const raw = historyStatus('198335', { features });
  const { evidence, hash, entry } = rehash('rxcui/198335/historystatus', raw);
  entry.presentations[0].rxnorm_scd.historystatus_response_sha256 = hash;
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[0].denominator_value = null;
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[0].denominator_unit = null;
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, evidence))
    .includes('missing_scd_denominator'));
});

test('an SCD that does not relate to the declared MIN is refused', () => {
  const raw = conceptGroup([{ rxcui: '99999', name: 'other', tty: 'MIN' }]);
  const { evidence, hash, entry } = rehash('rxcui/198335/related?rela=has_ingredients', raw);
  entry.presentations[0].rxnorm_scd.min_relation_response_sha256 = hash;
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, evidence))
    .includes('scd_min_relation_mismatch'));
});

test('an SCD relation with an extra MIN is refused', () => {
  const raw = conceptGroup([
    { rxcui: '10831', name: 'sulfamethoxazole / trimethoprim', tty: 'MIN' },
    { rxcui: '99999', name: 'other combination', tty: 'MIN' },
  ]);
  const { evidence, hash, entry } = rehash('rxcui/198335/related?rela=has_ingredients', raw);
  entry.presentations[0].rxnorm_scd.min_relation_response_sha256 = hash;
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, evidence))
    .includes('scd_min_relation_mismatch'));
});

test('each SCD version must equal the evidence bundle release', () => {
  const entry = combination();
  entry.presentations[0].rxnorm_scd.version = '01-Jun-2026';
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, bundle()))
    .includes('scd_release_disagreement'));
});

test('a release or API version disagreement is refused', () => {
  const result = verifyCombinationRxNormEvidence(
    combination(),
    bundle({ rxnorm_release: '01-Jun-2026', api_version: '3.1.300' }),
  );
  assert.ok(codes(result).includes('release_disagreement'));
  assert.ok(codes(result).includes('api_version_disagreement'));
});

test('the compared ingredient field is explicit, per entry', () => {
  const entry = combination();
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[0].ingredient_rxcui_field = 'guessed';
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, bundle()))
    .includes('unsupported_ingredient_field'));
});

test('the ingredient field is chosen PER ENTRY, so a MIN may mix IN and PIN', () => {
  const entry = combination();
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[1]
    .ingredient_rxcui_field = 'bossRxcui';
  assert.deepEqual(verifyCombinationRxNormEvidence(entry, bundle()).findings, []);
});

test('an obsolete, remapped or non-current concept is refused', () => {
  for (const [status, isCurrent, code] of [
    ['Obsolete', 'NO', 'concept_not_active'],
    ['Remapped', 'NO', 'concept_not_active'],
    ['Active', 'NO', 'concept_not_current'],
  ]) {
    const raw = historyStatus('198335', { status, isCurrent, features: scdFeatures('800', '160') });
    const evidence = bundle({ responses: { 'rxcui/198335/historystatus': raw } });
    const entry = combination();
    entry.presentations[0].rxnorm_scd.historystatus_response_sha256 = sha256(raw);
    assert.ok(
      codes(verifyCombinationRxNormEvidence(entry, evidence)).includes(code),
      `${status}/${isCurrent} must be refused`,
    );
  }
});

test('a rehashed status response for a different concept is refused', () => {
  const key = 'rxcui/10180/historystatus';
  const evidence = bundle({ responses: { [key]: historyStatus('99999') } });
  assert.ok(codes(verifyCombinationRxNormEvidence(combination(), evidence))
    .includes('concept_status_rxcui_mismatch'));
});

test('a missing concept status is refused rather than assumed active', () => {
  const evidence = bundle();
  delete evidence.responses['rxcui/10180/historystatus'];
  delete evidence.response_hashes['rxcui/10180/historystatus'];
  assert.ok(codes(verifyCombinationRxNormEvidence(combination(), evidence))
    .includes('missing_concept_status'));
});

test('every committed response is hashed, so a swapped response is caught', () => {
  const evidence = bundle();
  evidence.responses['rxcui/10180/historystatus'] = historyStatus('10180', {
    status: 'Obsolete', isCurrent: 'NO',
  });
  assert.ok(codes(verifyCombinationRxNormEvidence(combination(), evidence))
    .includes('bundle_hash_mismatch'));
});

test('a missing evidence bundle fails closed', () => {
  const result = verifyCombinationRxNormEvidence(combination(), undefined);
  assert.equal(result.verified, false);
  assert.ok(codes(result).includes('missing_evidence_bundle'));
});

test('manifest verification returns a non-forgeable report bound to the exact manifest object', () => {
  const entry = combination();
  const manifest = { combinations: [entry] };
  const report = verifyCombinationManifestEvidence(manifest, {
    [entry.combination_id]: bundle(),
  });
  assert.equal(report.verified, true);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.reports), true);
  assert.equal(Object.isFrozen(report.reports[0]), true);
  assert.strictEqual(assertVerifiedCombinationManifestEvidence(report, manifest), report);
  assert.throws(
    () => assertVerifiedCombinationManifestEvidence(
      { verified: true, combinations_checked: 1, reports: [] },
      manifest,
    ),
    /authentic verifier result/u,
  );
  assert.throws(
    () => assertVerifiedCombinationManifestEvidence(report, structuredClone(manifest)),
    /exact manifest object/u,
  );
});

test('a branded report is invalidated if the bound manifest object is mutated', () => {
  const manifest = { combinations: [] };
  const report = verifyCombinationManifestEvidence(manifest, {});
  manifest.combinations.push(combination());
  assert.throws(
    () => assertVerifiedCombinationManifestEvidence(report, manifest),
    /changed since evidence verification/u,
  );
});

test('evidence bundles must be immutable plain-data snapshots before any hash or parse', () => {
  const entry = combination();
  const manifest = { combinations: [entry] };
  const evidence = bundle();
  const key = 'rxcui/198335/historystatus';
  const authentic = evidence.responses[key];
  let reads = 0;
  Object.defineProperty(evidence.responses, key, {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      return authentic;
    },
  });

  assert.throws(
    () => verifyCombinationManifestEvidence(manifest, {
      [entry.combination_id]: evidence,
    }),
    /enumerable data property|accessors/u,
  );
  assert.equal(reads, 0);
});

test('a non-authoritative fixture can never produce a manifest-verification capability', () => {
  const entry = combination();
  const manifest = { combinations: [entry] };
  const evidence = bundle({
    classification: 'verifier_integration_fixture',
    promotion_authority: 'none',
    audit_only: true,
  });
  const report = verifyCombinationManifestEvidence(manifest, {
    [entry.combination_id]: evidence,
  });
  assert.equal(report.verified, false);
  assert.throws(
    () => assertVerifiedCombinationManifestEvidence(report, manifest),
    /authentic verifier result|not verified/u,
  );
});
