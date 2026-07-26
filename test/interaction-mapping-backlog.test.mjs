import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildInteractionMappingBacklog,
  buildInteractionMappingBacklogFromFiles,
  extractRuleMappingAssertions,
} from '../src/lib/interaction-mapping-backlog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoots = new Set();

function runtimeStatus(overrides = {}) {
  return {
    pair_matcher_executable: true,
    clinical_context_complete: false,
    runtime_enabled: false,
    promotion_eligible: false,
    ...overrides,
  };
}

function rule({
  ruleId,
  object,
  other,
  otherRole = 'perpetrator',
  section = 'T',
  riskBasis = 'pk_exposure',
  modifiers = [],
}) {
  return {
    rule_id: ruleId,
    _section: section,
    risk_basis: riskBasis,
    object,
    [otherRole]: other,
    applicability: {
      routes: ['oral'],
      formulations: ['tablet'],
      renal: 'review_required',
      indication: null,
      jurisdiction: ['US'],
    },
    context_modifiers: modifiers,
    runtime_status: runtimeStatus(),
  };
}

function product({
  brand,
  ingredient,
  source = 'github-jr',
  manufacturer = 'Maker',
  pack = '10 tablets',
}) {
  return {
    brand_name: brand,
    manufacturer,
    pack_label: pack,
    form_raw: null,
    ingredients: [{
      observed_name: ingredient,
      strength_raw: '5 mg',
      strength_value: 5,
      strength_unit: 'mg',
    }],
    sources: [{ source }],
  };
}

async function* asAsync(rows) {
  yield* rows;
}

function addTempRoot(root) {
  tempRoots.add(root);
  return root;
}

test.after(async () => {
  await Promise.all([...tempRoots].map((root) => fs.rm(root, {
    recursive: true,
    force: true,
  })));
});

test('selector extraction preserves direct, class, combination, risk, and runtime requirements', () => {
  const rules = [
    rule({
      ruleId: 'direct_and_global',
      object: { drug: 'Warfarin', route: ['oral'] },
      other: {
        class: 'cyp3a4_inhibitor',
        strength: ['strong'],
        route: ['oral'],
        formulation: ['tablet'],
      },
      modifiers: [{
        factor: 'renal',
        when: 'egfr_lt_30',
        severity: 'major',
        on_unknown: 'base',
      }],
    }),
    rule({
      ruleId: 'inline_and_combination',
      object: {
        class: 'nsaid',
        members: ['Aspirin', 'Ibuprofen'],
        member_exceptions: ['aspirin'],
        members_source: 'pinned@test',
        route: ['oral'],
      },
      otherRole: 'coadministered_with',
      other: {
        combination: [
          { substance: 'Digoxin', route: ['oral'] },
          { drug: 'Verapamil', route: ['oral'] },
        ],
      },
      riskBasis: 'additive_pd',
    }),
  ];
  const memberSets = {
    classes: {
      cyp3a4_inhibitor: {
        strong: ['Ketoconazole', 'Ritonavir'],
        moderate: ['Diltiazem'],
      },
    },
  };

  const extracted = extractRuleMappingAssertions({ rules, memberSets });
  assert.deepEqual(
    extracted.rows.map((row) => row.assertion.canonical_name),
    ['digoxin', 'ibuprofen', 'ketoconazole', 'ritonavir', 'verapamil', 'warfarin'],
  );
  assert.equal(extracted.requirement_count, 6);
  assert.deepEqual(extracted.gaps, []);

  const ketoconazole = extracted.rows.find(
    (row) => row.assertion.canonical_name === 'ketoconazole',
  );
  const [requirement] = ketoconazole.selector_requirements;
  assert.equal(requirement.member_origin, 'global_member_set_fallback');
  assert.deepEqual(requirement.member_strength_buckets, ['strong']);
  assert.equal(requirement.class_name, 'cyp3a4_inhibitor');
  assert.deepEqual(requirement.selector_scope.formulations, ['tablet']);
  assert.deepEqual(requirement.applicability.routes, ['oral']);
  assert.equal(requirement.risk_context.risk_basis, 'pk_exposure');
  assert.deepEqual(requirement.risk_context.context_modifiers, [{
    factor: 'renal',
    when: 'egfr_lt_30',
    severity: 'major',
    on_unknown: 'base',
  }]);
  assert.deepEqual(requirement.runtime_status, runtimeStatus());
  assert.match(requirement.requirement_id, /^sha256:[a-f0-9]{64}$/u);

  const ibuprofen = extracted.rows.find(
    (row) => row.assertion.canonical_name === 'ibuprofen',
  );
  assert.equal(
    ibuprofen.selector_requirements[0].member_origin,
    'inline_pinned_roster',
  );
  const digoxin = extracted.rows.find(
    (row) => row.assertion.canonical_name === 'digoxin',
  );
  assert.equal(
    digoxin.selector_requirements[0].selector_path,
    'coadministered_with.combination[0]',
  );
  assert.ok(extracted.rows.every((row) => row.review_status === 'review_candidate'));
  assert.ok(extracted.rows.every((row) => row.proposed_identity === null));
});

test('selector extraction reports missing class rosters without inventing members', () => {
  const extracted = extractRuleMappingAssertions({
    rules: [rule({
      ruleId: 'missing_class',
      object: { drug: 'warfarin' },
      other: { class: 'not_pinned', strength: ['strong'] },
    })],
    memberSets: { classes: {} },
  });
  assert.deepEqual(
    extracted.rows.map((row) => row.assertion.canonical_name),
    ['warfarin'],
  );
  assert.deepEqual(
    extracted.gaps.map((gap) => gap.reason),
    ['class_selector_has_no_members', 'missing_class_member_set'],
  );
});

test('catalogue scan is deterministic, exact-only, candidate-only, and flags product collisions', async () => {
  const rules = [rule({
    ruleId: 'warfarin_ketoconazole',
    object: { drug: 'warfarin', route: ['oral'] },
    other: {
      class: 'azole',
      members: ['ketoconazole'],
      route: ['oral'],
      formulation: ['tablet'],
    },
  })];
  const alpha = product({ brand: 'Alpha', ingredient: 'Warfarin' });
  const alphaCaseVariant = product({
    brand: 'alpha',
    ingredient: 'warfarin',
    source: 'janaushadhi',
  });
  const ketoconazole = product({ brand: 'Keto', ingredient: 'Ketoconazole' });
  const unrelated = product({ brand: 'Other', ingredient: 'Metformin' });
  const products = [alpha, alphaCaseVariant, alpha, ketoconazole, unrelated];

  const forward = await buildInteractionMappingBacklog({
    rules,
    memberSets: { classes: {} },
    products: asAsync(products),
  });
  const reverse = await buildInteractionMappingBacklog({
    rules,
    memberSets: { classes: {} },
    products: asAsync([...products].reverse()),
  });
  assert.deepEqual(reverse, forward);
  assert.deepEqual(forward.observed_provenance, {
    row_count: 5,
    source_counts: {
      'github-jr': 4,
      janaushadhi: 1,
    },
  });
  assert.deepEqual(forward.counts, {
    rule_count: 1,
    selector_requirement_count: 2,
    rule_ingredient_assertion_count: 2,
    catalog_matched_ingredient_assertion_count: 2,
    catalog_unmatched_ingredient_assertion_count: 0,
    product_assertion_candidate_count: 3,
    product_id_count: 2,
    product_id_collision_count: 1,
    product_assertions_in_collision_count: 2,
    selector_gap_count: 0,
    accepted_ingredient_mapping_count: 0,
    accepted_product_presentation_count: 0,
  });

  const warfarin = forward.ingredient_rows.find(
    (row) => row.assertion.canonical_name === 'warfarin',
  );
  assert.equal(warfarin.catalog_match.catalog_row_count, 3);
  assert.equal(warfarin.catalog_match.product_assertion_count, 2);
  assert.equal(warfarin.catalog_match.occurrence_count, 3);
  assert.deepEqual(warfarin.catalog_match.observed_names, ['Warfarin', 'warfarin']);
  assert.equal(warfarin.proposed_identity, null);
  assert.equal(forward.product_id_collisions.length, 1);
  assert.ok(forward.product_rows.every((row) => row.review_status === 'review_candidate'));
  assert.ok(forward.product_rows.every((row) => (
    row.proposed_presentation.route === null
    && row.proposed_presentation.formulation === null
  )));
});

test('file builder enforces provenance and writes reproducible review artifacts', async () => {
  const token = randomUUID();
  const inputRoot = addTempRoot(path.join(ROOT, 'dist', `.tmp-mapping-backlog-${token}`));
  const outputRoot = addTempRoot(path.join(
    ROOT,
    'data',
    'interaction',
    'internal-evaluation',
    `.tmp-mapping-backlog-${token}`,
  ));
  const artifactPath = path.join(inputRoot, 'drugs.jsonl');
  const artifactSummaryPath = path.join(inputRoot, 'summary.json');
  const ingredientOutputPath = path.join(outputRoot, 'ingredient-assertions.jsonl');
  const productOutputPath = path.join(outputRoot, 'product-presentations.jsonl');
  const summaryOutputPath = path.join(outputRoot, 'summary.json');
  const artifact = {
    brand_name: 'Warfarin Test',
    manufacturer: 'Maker',
    pack_label: '10 tablets',
    form_raw: null,
    ingredients: [{ molecule: 'warfarin', strength_raw: '5 mg' }],
    sources: [{ source: 'github-jr' }],
  };
  await fs.mkdir(inputRoot, { recursive: true });
  await fs.writeFile(artifactPath, `${JSON.stringify(artifact)}\n`, 'utf8');
  await fs.writeFile(artifactSummaryPath, `${JSON.stringify({
    total_rows: 1,
    sources: { 'github-jr': 1 },
  })}\n`, 'utf8');

  const options = {
    profile: 'internal-evaluation',
    rulesPath: path.join(
      ROOT,
      'docs',
      'interaction-review',
      'batch-01-v2',
      'batch-01-v2.jsonl',
    ),
    rulesStoragePath: 'docs/interaction-review/batch-01-v2/batch-01-v2.jsonl',
    memberSetsPath: path.join(ROOT, 'data-static', 'interaction-member-sets.json'),
    memberSetsStoragePath: 'data-static/interaction-member-sets.json',
    artifactPath,
    artifactSummaryPath,
    artifactStoragePath: `dist/.tmp-mapping-backlog-${token}/drugs.jsonl`,
    artifactSummaryStoragePath: `dist/.tmp-mapping-backlog-${token}/summary.json`,
    ingredientOutputPath,
    productOutputPath,
    summaryOutputPath,
    outputStoragePath: `data/interaction/internal-evaluation/.tmp-mapping-backlog-${token}`,
  };
  const first = await buildInteractionMappingBacklogFromFiles(options);
  const firstFiles = await Promise.all([
    fs.readFile(ingredientOutputPath, 'utf8'),
    fs.readFile(productOutputPath, 'utf8'),
    fs.readFile(summaryOutputPath, 'utf8'),
  ]);
  const second = await buildInteractionMappingBacklogFromFiles(options);
  const secondFiles = await Promise.all([
    fs.readFile(ingredientOutputPath, 'utf8'),
    fs.readFile(productOutputPath, 'utf8'),
    fs.readFile(summaryOutputPath, 'utf8'),
  ]);

  assert.deepEqual(secondFiles, firstFiles);
  assert.deepEqual(second.summary, first.summary);
  assert.equal(first.summary.inputs.rules.rule_count, 199);
  assert.deepEqual(first.summary.inputs.rules.sections, [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  ]);
  assert.equal(first.summary.source_policy.input.artifact_pack, 'open-core');
  assert.equal(first.summary.source_policy.output.redistributable, false);
  assert.equal(first.summary.counts.accepted_ingredient_mapping_count, 0);
  assert.equal(first.summary.counts.accepted_product_presentation_count, 0);
  assert.equal(first.summary.review_boundary.route_or_formulation_inference_permitted, false);
  assert.doesNotMatch(firstFiles[2], /generated_at|created_at|timestamp/iu);
  assert.ok(firstFiles[0].endsWith('\n'));
  assert.ok(firstFiles[1].endsWith('\n'));
});

test('file builder leaves existing outputs untouched when artifact summary validation fails', async () => {
  const token = randomUUID();
  const inputRoot = addTempRoot(path.join(ROOT, 'dist', `.tmp-mapping-fail-${token}`));
  const outputRoot = addTempRoot(path.join(
    ROOT,
    'data',
    'interaction',
    'internal-evaluation',
    `.tmp-mapping-fail-${token}`,
  ));
  const artifactPath = path.join(inputRoot, 'drugs.jsonl');
  const artifactSummaryPath = path.join(inputRoot, 'summary.json');
  const ingredientOutputPath = path.join(outputRoot, 'ingredient-assertions.jsonl');
  const productOutputPath = path.join(outputRoot, 'product-presentations.jsonl');
  const summaryOutputPath = path.join(outputRoot, 'summary.json');
  await fs.mkdir(inputRoot, { recursive: true });
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(artifactPath, `${JSON.stringify(product({
    brand: 'Test',
    ingredient: 'Warfarin',
  }))}\n`, 'utf8');
  await fs.writeFile(artifactSummaryPath, JSON.stringify({
    total_rows: 2,
    sources: { 'github-jr': 1 },
  }), 'utf8');
  await Promise.all([
    fs.writeFile(ingredientOutputPath, 'previous ingredient\n', 'utf8'),
    fs.writeFile(productOutputPath, 'previous product\n', 'utf8'),
    fs.writeFile(summaryOutputPath, 'previous summary\n', 'utf8'),
  ]);

  await assert.rejects(buildInteractionMappingBacklogFromFiles({
    profile: 'internal-evaluation',
    rulesPath: path.join(
      ROOT,
      'docs',
      'interaction-review',
      'batch-01-v2',
      'batch-01-v2.jsonl',
    ),
    memberSetsPath: path.join(ROOT, 'data-static', 'interaction-member-sets.json'),
    artifactPath,
    artifactSummaryPath,
    artifactStoragePath: `dist/.tmp-mapping-fail-${token}/drugs.jsonl`,
    ingredientOutputPath,
    productOutputPath,
    summaryOutputPath,
    outputStoragePath: `data/interaction/internal-evaluation/.tmp-mapping-fail-${token}`,
  }), /row count does not match summary total_rows/i);
  assert.deepEqual(await Promise.all([
    fs.readFile(ingredientOutputPath, 'utf8'),
    fs.readFile(productOutputPath, 'utf8'),
    fs.readFile(summaryOutputPath, 'utf8'),
  ]), [
    'previous ingredient\n',
    'previous product\n',
    'previous summary\n',
  ]);
});
