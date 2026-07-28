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
  verifyCombinationRxNormEvidence,
} from '../src/lib/combination-rxnorm-evidence.mjs';

const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const properties = (rxcui, name, tty) => JSON.stringify({ properties: { rxcui, name, tty } });
const conceptGroup = (concepts) => JSON.stringify({
  relatedGroup: { conceptGroup: [{ conceptProperties: concepts }] },
});
const historyStatus = (rxcui, { status = 'Active', isCurrent = 'YES', features = null } = {}) => (
  JSON.stringify({
    rxcuiStatusHistory: {
      metaData: { rxcui, status, isCurrent },
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
  'rxcui/10180/historystatus': historyStatus('10180'),
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
  const responses = { ...RESPONSES, ...(overrides.responses ?? {}) };
  return {
    schema_version: EVIDENCE_BUNDLE_SCHEMA_VERSION,
    rxnorm_release: '06-Jul-2026',
    api_version: '3.1.354',
    ...overrides,
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
    { name: 'sulfamethoxazole', rxcui: '10180', tty: 'IN' },
    { name: 'trimethoprim', rxcui: '10829', tty: 'IN' },
  ],
  presentations: [{
    source_identity: { namespace: 'presentation:pmbjp', code: '89' },
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

test('an SCD that does not relate to the declared MIN is refused', () => {
  const raw = conceptGroup([{ rxcui: '99999', name: 'other', tty: 'MIN' }]);
  const { evidence, hash, entry } = rehash('rxcui/198335/related?rela=has_ingredients', raw);
  entry.presentations[0].rxnorm_scd.min_relation_response_sha256 = hash;
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, evidence))
    .includes('scd_min_relation_mismatch'));
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
