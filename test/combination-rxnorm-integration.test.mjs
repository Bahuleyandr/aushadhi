// Verifier integration fixture — REAL RxNorm responses.
//
// Independent review (2026-07-28) suggested this, and it earned its keep
// immediately: the verifier's SCD parsing had been written against response shapes
// invented for the unit fixtures, and did not match RxNav at all. Against real
// responses the old code would have found nothing to compare while reporting
// success — a gate that verifies nothing.
//
// The bundle below was captured read-only on 2026-07-28. It is NOT part of the
// combination manifest, authorises nothing, and exists solely so the verifier is
// exercised against genuine API shapes.
//
// What the real shapes are, for the record:
//   rxcui/<id>/properties                       -> properties.tty / .name
//   rxcui/<id>/historystatus                    -> rxcuiStatusHistory.metaData.status
//                                                              .isCurrent
//                                                  ...definitionalFeatures
//                                                       .ingredientAndStrength[]
//                                                         { baseRxcui, bossRxcui,
//                                                           activeIngredientRxcui,
//                                                           moietyRxcui,
//                                                           numeratorValue/Unit,
//                                                           denominatorValue/Unit }
//                                                       .doseFormConcept[].doseFormName
//   rxcui/<id>/related?rela=has_part             -> MIN  -> IN/PIN components
//   rxcui/<id>/related?rela=has_ingredients      -> SCD  -> MIN
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyCombinationRxNormEvidence } from '../src/lib/combination-rxnorm-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = path.join(
  ROOT, 'data-static', 'combination-rxnorm-evidence', 'integration-fixture',
  'combination_co-trimoxazole_rxnorm-10831.json',
);
const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));
const hash = (key) => bundle.response_hashes[key];

const scd = (rxcui, name, smx, tmp) => ({
  rxcui,
  tty: 'SCD',
  name,
  ingredients_and_strengths: [
    {
      component_rxcui: '10180', ingredient_rxcui_field: 'baseRxcui',
      numerator_value: smx, numerator_unit: 'MG',
      denominator_value: '1', denominator_unit: 'EACH',
    },
    {
      component_rxcui: '10829', ingredient_rxcui_field: 'baseRxcui',
      numerator_value: tmp, numerator_unit: 'MG',
      denominator_value: '1', denominator_unit: 'EACH',
    },
  ],
  dose_form: 'Oral Tablet',
  version: bundle.rxnorm_release,
  properties_response_sha256: hash(`rxcui/${rxcui}/properties`),
  historystatus_response_sha256: hash(`rxcui/${rxcui}/historystatus`),
  min_relation_response_sha256: hash(`rxcui/${rxcui}/related?rela=has_ingredients`),
});

const combination = () => ({
  combination_id: 'combination:co-trimoxazole:rxnorm-10831',
  runtime_drug: 'co-trimoxazole',
  rxnorm: {
    rxcui: '10831',
    name: 'sulfamethoxazole / trimethoprim',
    tty: 'MIN',
    version: bundle.rxnorm_release,
    api_version: bundle.api_version,
    properties_response_sha256: hash('rxcui/10831/properties'),
    component_relation: {
      relationship: 'has_part',
      component_rxcuis: ['10180', '10829'],
      response_sha256: hash('rxcui/10831/related?rela=has_part'),
    },
  },
  components: [
    { name: 'sulfamethoxazole', rxcui: '10180', tty: 'IN' },
    { name: 'trimethoprim', rxcui: '10829', tty: 'IN' },
  ],
  presentations: [
    {
      source_identity: { namespace: 'presentation:pmbjp', code: '89' },
      rxnorm_scd: scd('198335', 'sulfamethoxazole 800 MG / trimethoprim 160 MG Oral Tablet', '800', '160'),
    },
    {
      source_identity: { namespace: 'presentation:pmbjp', code: '90' },
      rxnorm_scd: scd('142118', 'sulfamethoxazole 100 MG / trimethoprim 20 MG Oral Tablet', '100', '20'),
    },
  ],
});

const codes = (result) => result.findings.map((finding) => finding.code);

test('the captured bundle is a non-authoritative integration fixture', () => {
  assert.equal(bundle.classification, 'verifier_integration_fixture');
  assert.equal(bundle.promotion_authority, 'none');
  assert.equal(bundle.audit_only, true);
  // it lives outside the combination manifest, which is still empty
  const manifest = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data-static', 'combination-identity-overrides.json'), 'utf8',
  ));
  assert.deepEqual(manifest.combinations, []);
});

test('the RxNorm version response was stable across the capture', () => {
  // captured immediately before and after the concept requests; both must agree
  assert.equal(bundle.capture.version_stable, true);
  assert.equal(
    bundle.capture.version_before_sha256,
    bundle.capture.version_after_sha256,
  );
  assert.equal(bundle.rxnorm_release, '06-Jul-2026');
});

test('the verifier passes against REAL RxNorm responses', () => {
  const result = verifyCombinationRxNormEvidence(combination(), bundle);
  assert.deepEqual(result.findings, []);
  assert.equal(result.verified, true);
});

test('real responses still catch a wrong strength', () => {
  const entry = combination();
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[0].numerator_value = '400';
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, bundle)).includes('scd_strength_mismatch'));
});

test('real responses still catch a wrong denominator', () => {
  const entry = combination();
  entry.presentations[0].rxnorm_scd.ingredients_and_strengths[0].denominator_value = '5';
  assert.ok(
    codes(verifyCombinationRxNormEvidence(entry, bundle)).includes('scd_denominator_mismatch'),
  );
});

test('real responses still catch a wrong dose form', () => {
  const entry = combination();
  entry.presentations[0].rxnorm_scd.dose_form = 'Oral Suspension';
  assert.ok(codes(verifyCombinationRxNormEvidence(entry, bundle)).includes('scd_dose_form_mismatch'));
});

test('real responses still catch a component RxNorm does not list', () => {
  const entry = combination();
  entry.components[1] = { name: 'ciprofloxacin', rxcui: '2551', tty: 'IN' };
  entry.rxnorm.component_relation.component_rxcuis = ['10180', '2551'];
  const result = verifyCombinationRxNormEvidence(entry, bundle);
  assert.ok(codes(result).includes('component_relation_mismatch'));
});

test('real responses confirm each concept is Active and current', () => {
  // every concept in the graph carries status Active / isCurrent YES
  for (const rxcui of ['10831', '10180', '10829', '198335', '142118']) {
    const meta = JSON.parse(bundle.responses[`rxcui/${rxcui}/historystatus`])
      .rxcuiStatusHistory.metaData;
    assert.equal(meta.status, 'Active', rxcui);
    assert.equal(meta.isCurrent, 'YES', rxcui);
  }
});

test('real responses confirm the MIN and SCD relationship directions', () => {
  const hasPart = JSON.parse(bundle.responses['rxcui/10831/related?rela=has_part']);
  const components = (hasPart.relatedGroup.conceptGroup ?? [])
    .flatMap((group) => group.conceptProperties ?? [])
    .map((concept) => `${concept.rxcui}:${concept.tty}`);
  assert.deepEqual(components.sort(), ['10180:IN', '10829:IN']);

  for (const rxcui of ['198335', '142118']) {
    const related = JSON.parse(bundle.responses[`rxcui/${rxcui}/related?rela=has_ingredients`]);
    const mins = (related.relatedGroup.conceptGroup ?? [])
      .flatMap((group) => group.conceptProperties ?? [])
      .filter((concept) => concept.tty === 'MIN')
      .map((concept) => concept.rxcui);
    assert.deepEqual(mins, ['10831'], rxcui);
  }
});
