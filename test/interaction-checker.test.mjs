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

const ingredient = (
  ingredient_id,
  mapping_status = 'exact',
  runtime_subject = {
    drug: ingredient_id,
    route: 'oral',
    formulation: 'tablet',
  },
) => ({
  ingredient_id,
  mapping_status,
  runtime_drug: ingredient_id,
  runtime_subject,
});
const product = (product_id, ingredientIds, {
  presentation = {
    status: 'reviewed_override',
    route: 'oral',
    formulation: 'tablet',
  },
  combination,
} = {}) => ({
  product_id,
  presentation,
  ingredients: ingredientIds.map((id) => typeof id === 'string' ? ingredient(id) : id),
  ...(combination === undefined ? {} : { combination }),
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
  dispense_action = status === 'clinician_reviewed' ? 'confirm_and_monitor' : null,
  mechanism = status === 'clinician_reviewed' ? 'Clinician-authored mechanism.' : null,
  management = status === 'clinician_reviewed' ? 'Clinician-authored management.' : null,
  product_pairs = status === 'clinician_reviewed'
    ? [['product:1', 'product:2']]
    : undefined,
} = {}) => ({
  rule_id: id,
  pair,
  ...(product_pairs === undefined ? {} : { product_pairs }),
  applicability: {
    routes: [],
    dose_conditions: [],
    population_conditions: [],
  },
  severity,
  dispense_action,
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

test('a forged reviewed combination cannot inject a product-level subject', () => {
  const combinationSubjectId = 'combination:co-trimoxazole:rxnorm-10831';
  const combination = {
    status: 'reviewed_override',
    combination_id: 'combination:co-trimoxazole:rxnorm-10831',
    source_identity: { namespace: 'presentation:pmbjp', code: '89' },
    product_assertion_sha256: 'a'.repeat(64),
    components: [
      {
        runtime_ingredient_id: 'ingredient:sulfamethoxazole',
        assertion_ingredient_id: 'assertion:sulfamethoxazole',
      },
      {
        runtime_ingredient_id: 'ingredient:trimethoprim',
        assertion_ingredient_id: 'assertion:trimethoprim',
      },
    ],
    runtime_subject: {
      drug: 'co-trimoxazole',
      route: 'oral',
      formulation: 'tablet',
    },
  };
  const combinationProduct = product(
    'product:2',
    ['ingredient:sulfamethoxazole', 'ingredient:trimethoprim'],
    {
      presentation: {
        status: 'reviewed_override',
        mapping_scope: 'reviewed_combination_product',
        combination_id: combination.combination_id,
        route: 'oral',
        formulation: 'tablet',
      },
      combination,
    },
  );
  const result = checkResolvedProducts({
    resolvedInputs: [
      resolved(
        'Warfarin plus methotrexate fixture',
        product('product:1', ['ingredient:warfarin', 'ingredient:methotrexate']),
      ),
      resolved('Reviewed co-trimoxazole fixture', combinationProduct),
    ],
    rulePack: pack({
      rules: [
        rule({
          id: 'ddi:warfarin:co-trimoxazole',
          pair: [combinationSubjectId, 'ingredient:warfarin'],
        }),
        rule({
          id: 'ddi:methotrexate:trimethoprim',
          pair: ['ingredient:methotrexate', 'ingredient:trimethoprim'],
        }),
      ],
    }),
  });

  assert.deepEqual(
    result.reviewed_findings.map((finding) => finding.rule_id),
    ['ddi:methotrexate:trimethoprim'],
  );
  assert.ok(!result.checked_pairs.some((entry) => entry.pair.includes(combinationSubjectId)));
});

test('the reserved combination namespace cannot enter through an ordinary ingredient mapping', () => {
  const combinationSubjectId = 'combination:co-trimoxazole:rxnorm-10831';
  const result = checkResolvedProducts({
    resolvedInputs: [
      resolved('Warfarin fixture', product('product:1', ['ingredient:warfarin'])),
      resolved(
        'Forged ordinary ingredient fixture',
        product('product:2', [combinationSubjectId, 'ingredient:sulfamethoxazole']),
      ),
    ],
    rulePack: pack({
      rules: [rule({
        id: 'ddi:warfarin:co-trimoxazole',
        pair: [combinationSubjectId, 'ingredient:warfarin'],
      })],
    }),
  });

  assert.deepEqual(result.reviewed_findings, []);
  assert.ok(!result.checked_pairs.some((entry) => entry.pair.includes(combinationSubjectId)));
  assert.ok(result.unresolved_inputs.some(
    (entry) => entry.status === 'invalid_reserved_subject_namespace',
  ));
});

test('unreviewed or incompletely mapped combination results never enter exact pair matching', () => {
  const combinationSubjectId = 'combination:co-trimoxazole:rxnorm-10831';
  const base = {
    combination_id: 'combination:co-trimoxazole:rxnorm-10831',
    components: [
      {
        runtime_ingredient_id: 'ingredient:sulfamethoxazole',
        assertion_ingredient_id: 'assertion:sulfamethoxazole',
      },
      {
        runtime_ingredient_id: 'ingredient:trimethoprim',
        assertion_ingredient_id: 'assertion:trimethoprim',
      },
    ],
    runtime_subject: {
      drug: 'co-trimoxazole',
      route: 'oral',
      formulation: 'tablet',
    },
  };
  const cases = [
    { label: 'audit result', combination: { ...base, status: 'audit_match', audit_only: true } },
    { label: 'no combination', combination: { ...base, status: 'no_combination' } },
    {
      label: 'incomplete component mapping',
      combination: {
        ...base,
        status: 'reviewed_override',
        components: base.components.slice(0, 1),
      },
    },
    {
      label: 'extra mapped component',
      combination: { ...base, status: 'reviewed_override' },
      ingredients: [
        'ingredient:sulfamethoxazole',
        'ingredient:trimethoprim',
        'ingredient:unexpected',
      ],
    },
  ];

  for (const {
    label,
    combination,
    ingredients = ['ingredient:sulfamethoxazole', 'ingredient:trimethoprim'],
  } of cases) {
    const result = checkResolvedProducts({
      resolvedInputs: [
        resolved('Warfarin', product('product:1', ['ingredient:warfarin'])),
        resolved(
          label,
          product('product:2', ingredients, {
            presentation: {
              status: 'reviewed_override',
              mapping_scope: 'reviewed_combination_product',
              combination_id: base.combination_id,
              route: 'oral',
              formulation: 'tablet',
            },
            combination,
          }),
        ),
      ],
      rulePack: pack({
        rules: [rule({
          id: 'ddi:warfarin:co-trimoxazole',
          pair: [combinationSubjectId, 'ingredient:warfarin'],
        })],
      }),
    });
    assert.deepEqual(result.reviewed_findings, []);
    assert.ok(!result.checked_pairs.some((entry) => entry.pair.includes(combinationSubjectId)));
  }
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
  assert.equal(result.clinical_interaction_status, 'no_reviewed_interaction_found');
  assert.equal(result.outcome_code, 'no_reviewed_finding');
  assert.equal(result.checks_performed.therapeutic_duplication.finding_count, 1);
});

test('pure therapeutic duplication has a typed outcome without claiming interaction safety', () => {
  const result = checkResolvedProducts({
    resolvedInputs: [
      resolved('Brand A', product('product:1', ['ingredient:a'])),
      resolved('Brand B', product('product:2', ['ingredient:a'])),
    ],
    rulePack: pack(),
  });

  assert.deepEqual(result.checked_pairs, []);
  assert.equal(result.clinical_interaction_status, 'not_evaluated');
  assert.equal(result.outcome_code, 'therapeutic_duplication_only');
  assert.equal(result.duplicate_ingredients.length, 1);
  assert.ok(result.capability_limitations.some(
    (entry) => entry.code === 'NO_LISTED_INTERACTION_IS_NOT_SAFETY',
  ));
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
  assert.ok(result.review_candidates.every((entry) => (
    entry.severity === 'unknown'
    && entry.mechanism === null
    && entry.management === null
    && entry.review_status === 'review_candidate'
    && entry.inference_class === 'source_grounded_review_candidate'
  )));
  assert.equal(result.clinical_interaction_status, 'review_candidate_found');
  assert.equal(result.outcome_code, 'manual_review_required');
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
  assert.equal(result.reviewed_findings[0].dispense_action, 'confirm_and_monitor');
  assert.equal(result.reviewed_findings[0].mechanism, 'Clinician-authored mechanism.');
  assert.equal(result.reviewed_findings[0].management, 'Clinician-authored management.');
  assert.equal(result.clinical_interaction_status, 'reviewed_interaction_found');
  assert.equal(result.outcome_code, 'reviewed_action_required');

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
    presentation_mapping: 'complete',
    interaction_knowledge: 'partial',
    overall: 'partial',
  });
  assert.equal(result.clinical_interaction_status, 'no_reviewed_interaction_found');
  assert.equal(result.outcome_code, 'input_gaps');
  assert.deepEqual(result.input_gaps, result.unresolved_inputs);
  assert.ok(result.not_evaluated.some((entry) => entry.code === 'INPUT_GAP'));
  assert.ok(result.not_evaluated.some(
    (entry) => entry.code === 'RULE_PACK_COVERAGE_INCOMPLETE',
  ));

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
    presentation_mapping: 'complete',
    interaction_knowledge: 'complete',
    overall: 'complete',
  });
  assert.equal(result.disclaimer, DISCLAIMER);
  assert.match(result.disclaimer, /does not establish safety/i);
  assert.equal(result.checks_performed.checked_pair_count, 1);
  assert.equal(result.not_evaluated.length, 0);
  assert.deepEqual(
    result.capability_limitations.map((entry) => entry.code),
    [
      'NO_LISTED_INTERACTION_IS_NOT_SAFETY',
      'EXACT_REVIEWED_PRODUCT_SCOPE_ONLY',
    ],
  );
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

  const missingProductPairs = rule();
  delete missingProductPairs.product_pairs;
  assert.throws(
    () => validateRulePack(pack({ rules: [missingProductPairs] })),
    /product_pairs.*at least one/i,
  );

  assert.throws(
    () => validateRulePack(pack({ rules: [rule({
      product_pairs: [['product:2', 'product:1']],
    })] })),
    /product_pairs.*canonical order/i,
  );
  assert.throws(
    () => validateRulePack(pack({ rules: [rule({
      product_pairs: [
        ['product:1', 'product:2'],
        ['product:1', 'product:2'],
      ],
    })] })),
    /product_pairs.*unique/i,
  );
  assert.throws(
    () => validateRulePack(pack({ rules: [rule({ dispense_action: 'change_dose' })] })),
    /dispense_action.*invalid/i,
  );
  assert.throws(
    () => validateRulePack(pack({ rules: [rule({
      status: 'review_candidate',
      dispense_action: 'confirm_and_monitor',
    })] })),
    /review_candidate dispense_action must be null/i,
  );
});

test('schema 1.1 supersession metadata is complete, role-bound, ordered, and graph-valid', () => {
  const family = 'test-object-harm';
  const target = {
    ...rule({
      id: 'ddi:test:object:member',
      pair: ['ingredient:member', 'ingredient:object'],
    }),
    interaction_family_id: family,
    subject_specificity: 'exact_member',
    subject_roles: {
      object: 'ingredient:object',
      perpetrator: 'ingredient:member',
    },
    supersedes_rule_ids: [],
  };
  const suppressor = {
    ...rule({
      id: 'ddi:test:object:combination',
      pair: ['combination:test', 'ingredient:object'],
    }),
    interaction_family_id: family,
    subject_specificity: 'exact_fixed_dose_combination',
    subject_roles: {
      object: 'ingredient:object',
      perpetrator: 'combination:test',
    },
    supersedes_rule_ids: [target.rule_id],
  };
  const version11 = {
    ...pack({ rules: [suppressor, target] }),
    schema_version: '1.1.0',
  };

  assert.equal(validateRulePack(version11), true);
  assert.throws(
    () => validateRulePack({ ...version11, schema_version: '1.0.0' }),
    /unknown property interaction_family_id/i,
  );

  const partial = structuredClone(version11);
  delete partial.rules[0].subject_roles;
  assert.throws(
    () => validateRulePack(partial),
    /provide all supersession fields together/i,
  );

  const wrongRoles = structuredClone(version11);
  wrongRoles.rules[0].subject_roles.perpetrator = 'ingredient:member';
  assert.throws(
    () => validateRulePack(wrongRoles),
    /subject_roles must map exactly to pair/i,
  );

  const unknownTarget = structuredClone(version11);
  unknownTarget.rules[0].supersedes_rule_ids = ['ddi:test:unknown'];
  assert.throws(
    () => validateRulePack(unknownTarget),
    /supersedes unknown rule/i,
  );

  const selfTarget = structuredClone(version11);
  selfTarget.rules[0].supersedes_rule_ids = [selfTarget.rules[0].rule_id];
  assert.throws(
    () => validateRulePack(selfTarget),
    /must not supersede itself/i,
  );

  const targetWithoutMetadata = structuredClone(version11);
  for (const key of [
    'interaction_family_id',
    'subject_specificity',
    'subject_roles',
    'supersedes_rule_ids',
  ]) {
    delete targetWithoutMetadata.rules[1][key];
  }
  assert.throws(
    () => validateRulePack(targetWithoutMetadata),
    /superseded rule.*must declare supersession metadata/i,
  );

  const notMoreSpecific = structuredClone(version11);
  notMoreSpecific.rules[1].pair = ['combination:test-target', 'ingredient:object'];
  notMoreSpecific.rules[1].subject_specificity = 'exact_fixed_dose_combination';
  notMoreSpecific.rules[1].subject_roles.perpetrator = 'combination:test-target';
  assert.throws(
    () => validateRulePack(notMoreSpecific),
    /must be more specific/i,
  );

  const differentFamily = structuredClone(version11);
  differentFamily.rules[1].interaction_family_id = 'different-test-family';
  assert.throws(
    () => validateRulePack(differentFamily),
    /different interaction family/i,
  );

  const differentObject = structuredClone(version11);
  differentObject.rules[1].pair = ['ingredient:member', 'ingredient:other-object'];
  differentObject.rules[1].subject_roles.object = 'ingredient:other-object';
  assert.throws(
    () => validateRulePack(differentObject),
    /different object subject/i,
  );

  const inheritedSpecificityName = structuredClone(version11);
  inheritedSpecificityName.rules[0].subject_specificity = 'toString';
  assert.throws(
    () => validateRulePack(inheritedSpecificityName),
    /subject_specificity is invalid/i,
  );

  const fixedDoseWithoutCombinationSubject = structuredClone(version11);
  fixedDoseWithoutCombinationSubject.rules[0].pair = [
    'ingredient:member-two',
    'ingredient:object',
  ];
  fixedDoseWithoutCombinationSubject.rules[0].subject_roles.perpetrator = 'ingredient:member-two';
  assert.throws(
    () => validateRulePack(fixedDoseWithoutCombinationSubject),
    /requires exactly one combination subject/i,
  );

  const noProductOverlap = structuredClone(version11);
  noProductOverlap.rules[1].product_pairs = [['product:3', 'product:4']];
  assert.throws(
    () => validateRulePack(noProductOverlap),
    /must overlap product pairs/i,
  );

  const ambiguousSuppressors = structuredClone(version11);
  ambiguousSuppressors.rules.push({
    ...structuredClone(ambiguousSuppressors.rules[0]),
    rule_id: 'ddi:test:object:second-combination',
    pair: ['combination:test-second', 'ingredient:object'],
    subject_roles: {
      object: 'ingredient:object',
      perpetrator: 'combination:test-second',
    },
  });
  assert.throws(
    () => validateRulePack(ambiguousSuppressors),
    /multiple eligible suppressors for product pair/i,
  );
});

test('rule-pack accessors cannot change authority between validation and matching', () => {
  const accessorRule = rule();
  Object.defineProperty(accessorRule, 'subject_specificity', {
    enumerable: true,
    get() {
      return 'exact_fixed_dose_combination';
    },
  });
  const specificityAccessorPack = {
    ...pack({ rules: [accessorRule] }),
    schema_version: '1.1.0',
  };
  assert.throws(
    () => validateRulePack(specificityAccessorPack),
    /accessors and custom serialization are forbidden/i,
  );
  assert.throws(
    () => checkResolvedProducts({
      resolvedInputs: [],
      rulePack: specificityAccessorPack,
    }),
    /accessors and custom serialization are forbidden/i,
  );

  const targetsAccessorRule = rule();
  Object.defineProperty(targetsAccessorRule, 'supersedes_rule_ids', {
    enumerable: true,
    get() {
      return [];
    },
  });
  assert.throws(
    () => validateRulePack({
      ...pack({ rules: [targetsAccessorRule] }),
      schema_version: '1.1.0',
    }),
    /accessors and custom serialization are forbidden/i,
  );
});

test('a reviewed rule is restricted to its exact approved product pairs', () => {
  const reviewedRule = rule();
  const approved = checkResolvedProducts({
    resolvedInputs: [
      resolved('Brand A', product('product:1', ['ingredient:a'])),
      resolved('Brand B', product('product:2', ['ingredient:b'])),
    ],
    rulePack: pack({ rules: [reviewedRule], declared_coverage: 'partial' }),
  });
  assert.equal(approved.reviewed_findings.length, 1);

  const unapproved = checkResolvedProducts({
    resolvedInputs: [
      resolved('Brand A', product('product:1', ['ingredient:a'])),
      resolved('Different Brand B', product('product:3', ['ingredient:b'])),
    ],
    rulePack: pack({ rules: [reviewedRule], declared_coverage: 'partial' }),
  });
  assert.equal(unapproved.checked_pairs.length, 1);
  assert.deepEqual(unapproved.reviewed_findings, []);
  assert.equal(unapproved.clinical_interaction_status, 'no_reviewed_interaction_found');
  assert.equal(unapproved.outcome_code, 'no_reviewed_finding');
});

test('a mapped ingredient cannot enter clinical matching without its reviewed presentation subject', () => {
  const noPresentation = product('product:1', [
    ingredient('ingredient:a', 'exact', null),
  ], { presentation: { status: 'unmapped' } });
  const result = checkResolvedProducts({
    resolvedInputs: [
      resolved('Brand A', noPresentation),
      resolved('Brand B', product('product:2', ['ingredient:b'])),
    ],
    rulePack: pack({ rules: [rule()], declared_coverage: 'partial' }),
  });

  assert.deepEqual(result.reviewed_findings, []);
  assert.deepEqual(result.checked_pairs, []);
  assert.equal(result.unresolved_inputs.length, 1);
  assert.equal(result.unresolved_inputs[0].status, 'unmapped_presentation');
  assert.equal(result.clinical_interaction_status, 'not_evaluated');
  assert.equal(result.outcome_code, 'input_gaps');
  assert.deepEqual(result.coverage, {
    product_resolution: 'complete',
    ingredient_mapping: 'complete',
    presentation_mapping: 'partial',
    interaction_knowledge: 'partial',
    overall: 'partial',
  });
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

test('the checked-in rule schema exposes the same versioned D1 fields as the runtime validator', () => {
  const schema = JSON.parse(fs.readFileSync(
    new URL('../data-static/interaction-rules.schema.json', import.meta.url),
    'utf8',
  ));
  assert.deepEqual(schema.properties.schema_version.enum, ['1.0.0', '1.1.0']);
  assert.deepEqual(
    Object.keys(schema.$defs.rule.properties)
      .filter((key) => [
        'interaction_family_id',
        'subject_specificity',
        'subject_roles',
        'supersedes_rule_ids',
      ].includes(key))
      .sort(),
    [
      'interaction_family_id',
      'subject_roles',
      'subject_specificity',
      'supersedes_rule_ids',
    ],
  );
  assert.deepEqual(
    schema.$defs.rule.properties.subject_specificity.enum,
    ['exact_member', 'exact_fixed_dose_combination'],
  );
});
