// Mandatory RxNorm evidence gate for fixed-dose combinations.
//
// Independent review (2026-07-28) held that internal schema consistency does not
// prove RxNorm returned the declared data: a self-consistent manifest could pin any
// plausible rxcui, tty and hash. This suite pins the offline verifier that closes
// that gap by recomputing hashes from a committed raw response bundle and checking
// the semantics against it.
import crypto from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_BUNDLE_SCHEMA_VERSION,
  verifyCombinationRxNormEvidence,
} from '../src/lib/combination-rxnorm-evidence.mjs';

const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const PROPERTIES = JSON.stringify({
  properties: { rxcui: '10831', name: 'sulfamethoxazole / trimethoprim', tty: 'MIN' },
});
const HAS_PART = JSON.stringify({
  relatedGroup: {
    conceptGroup: [{
      tty: 'IN',
      conceptProperties: [
        { rxcui: '10180', name: 'sulfamethoxazole', tty: 'IN' },
        { rxcui: '10829', name: 'trimethoprim', tty: 'IN' },
      ],
    }],
  },
});
const SCD_198335 = JSON.stringify({
  rxcui: '198335',
  tty: 'SCD',
  dose_form: 'Oral Tablet',
  ingredients: [
    { baseRxcui: '10180', numerator_value: '800', numerator_unit: 'MG' },
    { baseRxcui: '10829', numerator_value: '160', numerator_unit: 'MG' },
  ],
});
const activeStatus = (rxcui) => JSON.stringify({
  rxcuiStatusHistory: { metaData: { rxcui, status: 'Active', isCurrent: 'YES' } },
});

const SCD_MIN_RELATION = JSON.stringify({
  relatedGroup: {
    conceptGroup: [{
      tty: 'MIN',
      conceptProperties: [
        { rxcui: '10831', name: 'sulfamethoxazole / trimethoprim', tty: 'MIN' },
      ],
    }],
  },
});

const bundle = (overrides = {}) => ({
  schema_version: EVIDENCE_BUNDLE_SCHEMA_VERSION,
  rxnorm_release: '06-Jul-2026',
  api_version: '3.1.354',
  responses: {
    'rxcui/10831/properties': PROPERTIES,
    'rxcui/10831/related?rela=has_part': HAS_PART,
    'rxcui/198335/allhistoricalndcs-or-properties': SCD_198335,
    'rxcui/198335/related?rela=has_ingredients': SCD_MIN_RELATION,
    'rxcui/10831/historystatus': activeStatus('10831'),
    'rxcui/10180/historystatus': activeStatus('10180'),
    'rxcui/10829/historystatus': activeStatus('10829'),
    'rxcui/198335/historystatus': activeStatus('198335'),
  },
  ...overrides,
});

// every committed response is hashed, so a status or relationship response cannot
// be swapped without detection
const withHashes = (evidence) => {
  evidence.response_hashes = Object.fromEntries(
    Object.entries(evidence.responses).map(([key, raw]) => [key, sha256(raw)]),
  );
  return evidence;
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
    properties_response_sha256: sha256(PROPERTIES),
    component_relation: {
      relationship: 'has_part',
      component_rxcuis: ['10180', '10829'],
      response_sha256: sha256(HAS_PART),
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
          denominator_value: null, denominator_unit: null,
        },
        {
          component_rxcui: '10829', ingredient_rxcui_field: 'baseRxcui',
          numerator_value: '160', numerator_unit: 'MG',
          denominator_value: null, denominator_unit: null,
        },
      ],
      dose_form: 'Oral Tablet',
      version: '06-Jul-2026',
      response_sha256: sha256(SCD_198335),
      min_relation_response_sha256: sha256(SCD_MIN_RELATION),
    },
  }],
  ...overrides,
});

const codes = (result) => result.findings.map((finding) => finding.code);

test('a combination backed by matching captured responses verifies', () => {
  const result = verifyCombinationRxNormEvidence(combination(), withHashes(bundle()));
  assert.deepEqual(result.findings, []);
  assert.equal(result.verified, true);
});

test('a synthetic fixture hash is refused on the production path', () => {
  const entry = combination();
  entry.rxnorm.properties_response_sha256 = 'a'.repeat(64);
  const result = verifyCombinationRxNormEvidence(entry, withHashes(bundle()));
  assert.equal(result.verified, false);
  assert.ok(codes(result).includes('fixture_hash_in_production_path'));
});

test('a hash that does not match the committed response is refused', () => {
  const entry = combination();
  entry.rxnorm.component_relation.response_sha256 = sha256('a different response');
  const result = verifyCombinationRxNormEvidence(entry, withHashes(bundle()));
  assert.ok(codes(result).includes('hash_mismatch'));
});

test('missing raw evidence is refused rather than assumed', () => {
  const evidence = bundle();
  delete evidence.responses['rxcui/10831/related?rela=has_part'];
  const result = verifyCombinationRxNormEvidence(combination(), evidence);
  assert.ok(codes(result).includes('missing_raw_evidence'));
  assert.ok(codes(result).includes('unreadable_relation_response'));
});

test('a declared has_part set that RxNorm did not return is refused', () => {
  const entry = combination();
  const relation = JSON.stringify({
    relatedGroup: {
      conceptGroup: [{
        conceptProperties: [
          { rxcui: '10180', tty: 'IN' },
          { rxcui: '99999', tty: 'IN' },
        ],
      }],
    },
  });
  const evidence = bundle();
  evidence.responses['rxcui/10831/related?rela=has_part'] = relation;
  entry.rxnorm.component_relation.response_sha256 = sha256(relation);
  const result = verifyCombinationRxNormEvidence(entry, withHashes(evidence));
  assert.ok(codes(result).includes('component_relation_mismatch'));
});

test('a concept that is not actually a MIN is refused', () => {
  const properties = JSON.stringify({
    properties: { rxcui: '10831', name: 'sulfamethoxazole / trimethoprim', tty: 'SCD' },
  });
  const entry = combination();
  const evidence = bundle();
  evidence.responses['rxcui/10831/properties'] = properties;
  entry.rxnorm.properties_response_sha256 = sha256(properties);
  const result = verifyCombinationRxNormEvidence(entry, withHashes(evidence));
  assert.ok(codes(result).includes('tty_mismatch'));
});

test('a presentation that is not actually an SCD is refused', () => {
  const scd = JSON.stringify({
    rxcui: '198335', tty: 'SBD', dose_form: 'Oral Tablet',
    ingredients: [
      { baseRxcui: '10180', numerator_value: '800', numerator_unit: 'MG' },
      { baseRxcui: '10829', numerator_value: '160', numerator_unit: 'MG' },
    ],
  });
  const entry = combination();
  const evidence = bundle();
  evidence.responses['rxcui/198335/allhistoricalndcs-or-properties'] = scd;
  entry.presentations[0].rxnorm_scd.response_sha256 = sha256(scd);
  const result = verifyCombinationRxNormEvidence(entry, withHashes(evidence));
  assert.ok(codes(result).includes('scd_tty_mismatch'));
});

test('a changed SCD strength or dose form is refused', () => {
  const scd = JSON.stringify({
    rxcui: '198335', tty: 'SCD', dose_form: 'Oral Suspension',
    ingredients: [
      { baseRxcui: '10180', numerator_value: '400', numerator_unit: 'MG' },
      { baseRxcui: '10829', numerator_value: '160', numerator_unit: 'MG' },
    ],
  });
  const entry = combination();
  const evidence = bundle();
  evidence.responses['rxcui/198335/allhistoricalndcs-or-properties'] = scd;
  entry.presentations[0].rxnorm_scd.response_sha256 = sha256(scd);
  const result = verifyCombinationRxNormEvidence(entry, withHashes(evidence));
  assert.ok(codes(result).includes('scd_strength_mismatch'));
  assert.ok(codes(result).includes('scd_dose_form_mismatch'));
});

test('an SCD that does not relate to the declared MIN is refused', () => {
  // right ingredient set, wrong multiple-ingredient concept: only the
  // has_ingredients link catches this
  const relation = JSON.stringify({
    relatedGroup: {
      conceptGroup: [{
        tty: 'MIN',
        conceptProperties: [{ rxcui: '99999', name: 'some other combination', tty: 'MIN' }],
      }],
    },
  });
  const entry = combination();
  const evidence = bundle();
  evidence.responses['rxcui/198335/related?rela=has_ingredients'] = relation;
  entry.presentations[0].rxnorm_scd.min_relation_response_sha256 = sha256(relation);
  const result = verifyCombinationRxNormEvidence(entry, withHashes(evidence));
  assert.ok(codes(result).includes('scd_min_relation_mismatch'));
});

test('a release or API version disagreement is refused', () => {
  const result = verifyCombinationRxNormEvidence(
    combination(),
    withHashes(bundle({ rxnorm_release: '01-Jun-2026', api_version: '3.1.300' })),
  );
  assert.ok(codes(result).includes('release_disagreement'));
  assert.ok(codes(result).includes('api_version_disagreement'));
});

test('the compared ingredient field is explicit, so PIN products cannot drift silently', () => {
  const entry = combination();
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[0].ingredient_rxcui_field = 'guessed';
  const result = verifyCombinationRxNormEvidence(entry, withHashes(bundle()));
  assert.ok(codes(result).includes('unsupported_ingredient_field'));
});

test('the ingredient field is chosen PER ENTRY, so a MIN may mix IN and PIN', () => {
  // component A compared on baseRxcui, component B on bossRxcui in the same SCD
  const scdRaw = JSON.stringify({
    rxcui: '198335', tty: 'SCD', dose_form: 'Oral Tablet',
    ingredients: [
      { baseRxcui: '10180', numerator_value: '800', numerator_unit: 'MG' },
      { bossRxcui: '10829', numerator_value: '160', numerator_unit: 'MG' },
    ],
  });
  const entry = combination();
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[1].ingredient_rxcui_field = 'bossRxcui';
  entry.presentations[0].rxnorm_scd.response_sha256 = sha256(scdRaw);
  const evidence = bundle();
  evidence.responses['rxcui/198335/allhistoricalndcs-or-properties'] = scdRaw;
  const result = verifyCombinationRxNormEvidence(entry, withHashes(evidence));
  assert.deepEqual(result.findings, []);
});

test('an obsolete, remapped or non-current concept is refused', () => {
  for (const [status, isCurrent, code] of [
    ['Obsolete', 'NO', 'concept_not_active'],
    ['Remapped', 'NO', 'concept_not_active'],
    ['Active', 'NO', 'concept_not_current'],
  ]) {
    const evidence = bundle();
    evidence.responses['rxcui/198335/historystatus'] = JSON.stringify({
      rxcuiStatusHistory: { metaData: { rxcui: '198335', status, isCurrent } },
    });
    const result = verifyCombinationRxNormEvidence(combination(), withHashes(evidence));
    assert.ok(codes(result).includes(code), `${status}/${isCurrent} must be refused`);
  }
});

test('a missing concept status is refused rather than assumed active', () => {
  const evidence = bundle();
  delete evidence.responses['rxcui/10180/historystatus'];
  const result = verifyCombinationRxNormEvidence(combination(), withHashes(evidence));
  assert.ok(codes(result).includes('missing_concept_status'));
});

test('every committed response is hashed, so a swapped response is caught', () => {
  const evidence = withHashes(bundle());
  evidence.responses['rxcui/10180/historystatus'] = JSON.stringify({
    rxcuiStatusHistory: { metaData: { rxcui: '10180', status: 'Obsolete', isCurrent: 'NO' } },
  });
  const result = verifyCombinationRxNormEvidence(combination(), evidence);
  assert.ok(codes(result).includes('bundle_hash_mismatch'));
});

test('a missing evidence bundle fails closed', () => {
  const result = verifyCombinationRxNormEvidence(combination(), undefined);
  assert.equal(result.verified, false);
  assert.ok(codes(result).includes('missing_evidence_bundle'));
});
