import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DISCLAIMER,
  checkResolvedProducts,
  generateCrossDrugPairs,
  pairKey,
  validateRulePack,
} from '../src/lib/interaction-checker.mjs';

const ingredient = (ingredient_id, mapping_status = 'exact') => ({ ingredient_id, mapping_status });
const product = (product_id, ingredientIds) => ({
  product_id,
  ingredients: ingredientIds.map((id) => typeof id === 'string' ? ingredient(id) : id),
});
const resolved = (input, value) => ({ input, status: 'resolved', product: value });

const evidence = (review_status = 'clinician_reviewed') => ({
  source: 'openfda-labels',
  source_url: 'https://api.fda.gov/drug/label.json',
  document_id: 'set-id-1',
  document_version: '1',
  retrieved_at: '2026-07-10',
  jurisdiction: 'US',
  excerpt: 'Source-grounded test evidence.',
  licence: 'CC0-1.0',
  review_status,
});

const rule = ({
  id = 'ddi:ingredient-a:ingredient-b',
  pair = ['ingredient:a', 'ingredient:b'],
  status = 'clinician_reviewed',
  severity = status === 'clinician_reviewed' ? 'major' : 'unknown',
  mechanism = status === 'clinician_reviewed' ? 'Clinician-authored mechanism.' : null,
  management = status === 'clinician_reviewed' ? 'Clinician-authored management.' : null,
} = {}) => ({
  rule_id: id,
  pair,
  applicability: {
    routes: [],
    dose_conditions: [],
    population_conditions: [],
  },
  severity,
  mechanism,
  management,
  evidence: [evidence(status)],
  review: status === 'clinician_reviewed'
    ? {
        status,
        reviewer_id: 'clinician:test-reviewer',
        reviewed_at: '2026-07-10',
        source_versions: ['openfda-labels:set-id-1:1'],
      }
    : { status, source_versions: ['openfda-labels:set-id-1:1'] },
});

const pack = ({ rules = [], declared_coverage = 'unknown' } = {}) => ({
  schema_version: '1.0.0',
  pack_id: 'aushadhi-open-interactions',
  pack_version: '0.0.0-test',
  profile: 'production-open',
  licence: 'CC-BY-4.0',
  source_ids: ['aushadhi-open-clinician-rules'],
  declared_coverage,
  rules,
});

test('pairKey is deterministic and order independent', () => {
  assert.equal(pairKey('ingredient:b', 'ingredient:a'), 'ingredient:a|ingredient:b');
  assert.equal(pairKey(['ingredient:a', 'ingredient:b']), 'ingredient:a|ingredient:b');
  assert.throws(() => pairKey('ingredient:a', 'ingredient:a'), /two different ingredient identifiers/i);
  assert.throws(() => pairKey('ingredient:a'), /exactly two/i);
});

test('generateCrossDrugPairs expands every unique cross-product pair across any number of products', () => {
  const pairs = generateCrossDrugPairs([
    product('product:1', ['ingredient:a', 'ingredient:b']),
    product('product:2', ['ingredient:c', 'ingredient:d']),
    product('product:3', ['ingredient:e']),
  ]);

  assert.deepEqual(pairs.map((entry) => entry.pair_key), [
    'ingredient:a|ingredient:c',
    'ingredient:a|ingredient:d',
    'ingredient:a|ingredient:e',
    'ingredient:b|ingredient:c',
    'ingredient:b|ingredient:d',
    'ingredient:b|ingredient:e',
    'ingredient:c|ingredient:e',
    'ingredient:d|ingredient:e',
  ]);
  assert.ok(!pairs.some((entry) => entry.pair_key === 'ingredient:a|ingredient:b'));
  assert.ok(!pairs.some((entry) => entry.pair_key === 'ingredient:c|ingredient:d'));
});

test('generateCrossDrugPairs is deterministic, deduplicates pair keys, and does not mutate inputs', () => {
  const products = [
    product('product:2', ['ingredient:c', 'ingredient:a', 'ingredient:a']),
    product('product:1', ['ingredient:b']),
    product('product:3', ['ingredient:b']),
  ];
  const snapshot = structuredClone(products);

  const forward = generateCrossDrugPairs(products);
  const reverse = generateCrossDrugPairs([...products].reverse());

  assert.deepEqual(forward, reverse);
  assert.deepEqual(products, snapshot);
  assert.deepEqual(forward.map((entry) => entry.pair_key), [
    'ingredient:a|ingredient:b',
    'ingredient:b|ingredient:c',
  ]);
});

test('same ingredient across products is reported as therapeutic duplication, not an interaction pair', () => {
  const result = checkResolvedProducts({
    resolvedInputs: [
      resolved('Brand A', product('product:1', ['ingredient:a', 'ingredient:b'])),
      resolved('Brand B', product('product:2', ['ingredient:a', 'ingredient:c'])),
    ],
    rulePack: pack(),
  });

  assert.deepEqual(result.duplicate_ingredients, [{
    ingredient_id: 'ingredient:a',
    product_ids: ['product:1', 'product:2'],
  }]);
  assert.ok(!result.checked_pairs.some((entry) => entry.pair_key === 'ingredient:a|ingredient:a'));
});

test('unreviewed rules and supplied evidence remain review candidates', () => {
  const candidateRule = rule({
    id: 'candidate:a-b',
    status: 'review_candidate',
    severity: 'unknown',
    mechanism: null,
    management: null,
  });
  const suppliedCandidate = {
    candidate_id: 'candidate:label:a-b',
    pair: ['ingredient:a', 'ingredient:b'],
    pair_key: 'ingredient:a|ingredient:b',
    evidence: [evidence('review_candidate')],
    review_status: 'review_candidate',
  };
  const result = checkResolvedProducts({
    resolvedInputs: [
      resolved('Brand A', product('product:1', ['ingredient:a'])),
      resolved('Brand B', product('product:2', ['ingredient:b'])),
    ],
    rulePack: pack({ rules: [candidateRule] }),
    reviewCandidates: [suppliedCandidate],
  });

  assert.deepEqual(result.reviewed_findings, []);
  assert.deepEqual(result.review_candidates.map((entry) => entry.candidate_id ?? entry.rule_id), [
    'candidate:a-b',
    'candidate:label:a-b',
  ]);
  assert.ok(result.review_candidates.every((entry) => entry.severity === undefined || entry.severity === 'unknown'));
});

test('only fully clinician-reviewed rules expose severity, mechanism, and management', () => {
  const reviewedRule = rule();
  const result = checkResolvedProducts({
    resolvedInputs: [
      resolved('Brand A', product('product:1', ['ingredient:a'])),
      resolved('Brand B', product('product:2', ['ingredient:b'])),
    ],
    rulePack: pack({ rules: [reviewedRule], declared_coverage: 'complete' }),
  });

  assert.equal(result.reviewed_findings.length, 1);
  assert.equal(result.reviewed_findings[0].severity, 'major');
  assert.equal(result.reviewed_findings[0].mechanism, 'Clinician-authored mechanism.');
  assert.equal(result.reviewed_findings[0].management, 'Clinician-authored management.');

  assert.throws(
    () => validateRulePack(pack({ rules: [rule({ status: 'review_candidate', severity: 'major' })] })),
    /review_candidate.*severity.*unknown/i,
  );
  const missingReviewer = reviewedRule;
  delete missingReviewer.review.reviewer_id;
  assert.throws(() => validateRulePack(pack({ rules: [missingReviewer] })), /reviewer_id/i);
  const missingEvidence = rule();
  missingEvidence.evidence = [];
  assert.throws(() => validateRulePack(pack({ rules: [missingEvidence] })), /evidence/i);
});

test('ambiguous products and unmapped ingredients are explicit and coverage uses the safety lattice', () => {
  const mappedProduct = product('product:1', ['ingredient:a']);
  const partlyMappedProduct = product('product:2', [
    ingredient('ingredient:b', 'reviewed_override'),
    { observed_name: 'Unknown salt', mapping_status: 'unmapped' },
  ]);
  const ambiguous = {
    input: 'Ambiguous Brand',
    status: 'ambiguous',
    candidates: [{ product_id: 'product:x' }, { product_id: 'product:y' }],
  };
  const result = checkResolvedProducts({
    resolvedInputs: [resolved('Brand A', mappedProduct), ambiguous, resolved('Brand B', partlyMappedProduct)],
    rulePack: pack({ declared_coverage: 'partial' }),
  });

  assert.deepEqual(result.resolved_inputs.map((entry) => entry.input), ['Brand A', 'Brand B']);
  assert.equal(result.unresolved_inputs.length, 2);
  assert.equal(result.unresolved_inputs[0].status, 'ambiguous');
  assert.equal(result.unresolved_inputs[1].status, 'unmapped');
  assert.equal(result.unresolved_inputs[1].observed_name, 'Unknown salt');
  assert.deepEqual(result.coverage, {
    product_resolution: 'partial',
    ingredient_mapping: 'partial',
    interaction_knowledge: 'partial',
    overall: 'partial',
  });

  const operationalUnknown = checkResolvedProducts({
    resolvedInputs: [
      resolved('Brand A', mappedProduct),
      { input: 'Brand C', status: 'operational_error', error: 'timeout' },
    ],
    rulePack: pack({ declared_coverage: 'partial' }),
  });
  assert.equal(operationalUnknown.coverage.product_resolution, 'unknown');
  assert.equal(operationalUnknown.coverage.overall, 'unknown');
});

test('a non-empty complete declared pack can report checked coverage but retains the safety disclaimer', () => {
  const result = checkResolvedProducts({
    resolvedInputs: [
      resolved('Brand A', product('product:1', ['ingredient:a'])),
      resolved('Brand B', product('product:2', ['ingredient:b'])),
    ],
    rulePack: pack({ rules: [rule()], declared_coverage: 'complete' }),
  });

  assert.deepEqual(result.coverage, {
    product_resolution: 'complete',
    ingredient_mapping: 'complete',
    interaction_knowledge: 'complete',
    overall: 'complete',
  });
  assert.equal(result.disclaimer, DISCLAIMER);
  assert.match(result.disclaimer, /does not establish safety/i);
});

test('empty and invalid rule packs fail closed and cannot claim complete coverage', () => {
  assert.throws(() => validateRulePack(null), /rule pack must be an object/i);
  assert.throws(() => validateRulePack({}), /schema_version/i);
  assert.throws(() => validateRulePack(pack({ declared_coverage: 'invalid' })), /declared_coverage/i);
  assert.throws(() => validateRulePack(pack({ declared_coverage: 'complete' })), /empty.*complete/i);

  const duplicateIds = [rule(), rule()];
  assert.throws(() => validateRulePack(pack({ rules: duplicateIds })), /duplicate rule_id/i);

  const reversedPair = rule({ pair: ['ingredient:b', 'ingredient:a'] });
  assert.throws(() => validateRulePack(pack({ rules: [reversedPair] })), /canonical order/i);
});

test('the committed open rule pack is empty and declares unknown coverage', () => {
  const committedPack = JSON.parse(fs.readFileSync(
    new URL('../data-static/interaction-rules.json', import.meta.url),
    'utf8',
  ));

  assert.equal(validateRulePack(committedPack), true);
  assert.equal(committedPack.declared_coverage, 'unknown');
  assert.deepEqual(committedPack.rules, []);
});
