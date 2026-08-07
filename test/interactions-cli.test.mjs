import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalIngredientKey,
  ingredientIdForName,
} from '../src/lib/ingredient-identity.mjs';
import {
  productAssertionHashForRow,
  productIdForRow,
} from '../src/lib/product-resolver.mjs';
import { parseArgs } from '../src/cli/interactions.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'src', 'cli', 'interactions.mjs');
const RULES = path.join(ROOT, 'data-static', 'interaction-rules.json');
const digest = (value) => createHash('sha256').update(value).digest('hex');

// The combination-mapping CLI path verifies the operator-provisioned PMBJP
// source files (pinned by SHA-256) in the gitignored restricted zone; the
// dependent test skips with an explicit reason when they are absent.
const PMBJP_SOURCE_DIR = path.join(
  ROOT, 'data', 'interaction', 'internal-evaluation', 'pmbjp-product-list',
);
const PMBJP_SOURCE_SKIP = ['pmbjp-product-list.pdf', 'pmbjp-product-list.table.txt']
  .every((name) => fs.existsSync(path.join(PMBJP_SOURCE_DIR, name)))
  ? false
  : 'operator-provisioned PMBJP restricted source files are absent '
    + '(data/interaction/internal-evaluation/pmbjp-product-list/)';

function review(sourceId, identifier, sourceUrl) {
  return {
    status: 'reviewed',
    reviewer_id: 'reviewer:cli-fixture',
    reviewed_at: '2026-07-26',
    evidence: [{
      source_id: sourceId,
      identifier,
      source_url: sourceUrl,
      retrieved_at: '2026-07-26',
      evidence_sha256: digest(identifier),
    }],
  };
}

function makeFixture({
  sources = { 'github-jr': 2 },
  duplicateBrand = false,
  losslessIngredients = true,
  rowSource = 'github-jr',
  totalRows,
} = {}) {
  const root = path.join(ROOT, 'data', 'interaction', 'production-open');
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, '.tmp-cli-'));
  const rows = [
    {
      brand_name: 'Combo A Tablet',
      manufacturer: 'Alpha Pharma Ltd',
      pack_label: 'strip of 10 tablets',
      form_raw: 'tablet',
      ingredients: [
        {
          molecule: 'ingredient one',
          ...(losslessIngredients ? { molecule_raw: 'Ingredient One hydrochloride' } : {}),
          strength_raw: '10mg',
        },
        {
          molecule: 'ingredient two',
          ...(losslessIngredients ? { molecule_raw: 'Ingredient Two' } : {}),
          strength_raw: '5mg',
        },
      ],
      sources: [{ source: rowSource, source_id: '1', seen_at: '2026-07-10' }],
    },
    {
      brand_name: duplicateBrand ? 'Combo A Tablet' : 'Single B Tablet',
      manufacturer: 'Beta Pharma Ltd',
      pack_label: 'strip of 10 tablets',
      form_raw: 'tablet',
      ingredients: [{
        molecule: 'ingredient three',
        ...(losslessIngredients ? { molecule_raw: 'Ingredient Three' } : {}),
        strength_raw: '20mg',
      }],
      sources: [{ source: rowSource, source_id: '2', seen_at: '2026-07-10' }],
    },
  ];
  fs.writeFileSync(path.join(dir, 'drugs.jsonl'), `${rows.map(JSON.stringify).join('\n')}\n`);
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({
    date: '2026-07-10',
    total_rows: totalRows ?? rows.length,
    sources,
  }));
  const observedNames = [...new Set(rows.flatMap((row) => (
    row.ingredients.map((ingredient) => ingredient.molecule_raw).filter(Boolean)
  )))];
  fs.writeFileSync(path.join(dir, 'ingredient-mappings.json'), JSON.stringify({
    schema_version: 1,
    identity_namespace: 'aushadhi:ingredient-identity:v1',
    notices: ['CLI fixture mappings.'],
    mappings: observedNames.map((observedName, index) => {
      const canonicalName = canonicalIngredientKey(observedName);
      const rxcui = String(10_000 + index);
      return {
        mapping_id: `ingredient:cli:${index}`,
        assertion: {
          ingredient_id: ingredientIdForName(canonicalName),
          canonical_name: canonicalName,
        },
        identity: {
          clinical_ingredient_id: ingredientIdForName(canonicalName),
          canonical_name: canonicalName,
          runtime_drug: canonicalName,
          relationship: 'exact',
          rxnorm: {
            rxcui,
            name: observedName,
            tty: 'IN',
            version: '06-Jul-2026',
            api_version: '3.1.353',
            response_sha256: digest(`rxnorm:${rxcui}`),
          },
          unii: null,
        },
        review: review(
          'rxnorm',
          `rxcui:${rxcui}`,
          `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`,
        ),
      };
    }),
  }));
  fs.writeFileSync(path.join(dir, 'presentation-mappings.json'), JSON.stringify({
    schema_version: 1,
    product_id_namespace: 'aushadhi:product:v1',
    product_assertion_namespace: 'aushadhi:product-assertion:v1',
    mappings: rows.map((row, index) => ({
      mapping_id: `presentation:cli:${index}`,
      product_id: productIdForRow(row),
      product_assertion_sha256: productAssertionHashForRow(row),
      presentation: { route: 'oral', formulation: 'tablet' },
      review: review(
        'github-jr',
        `fixture-product:${index}`,
        'https://github.com/junioralive/Indian-Medicine-Dataset',
      ),
    })),
  }));
  return dir;
}

function makeCombinationFixture() {
  const root = path.join(ROOT, 'dist');
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, '.tmp-cli-combination-'));
  const rows = [
    {
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
      sources: [{ source: 'janaushadhi', source_id: '89', seen_at: '2026-07-07' }],
    },
    {
      brand_name: 'Co-trimoxazole (Sulphamethoxazole 100mg and Trimethoprim 20mg) Tablets IP',
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: "10's",
      form_raw: null,
      ingredients: [
        {
          molecule: 'co-trimoxazole sulphamethoxazole',
          strength_raw: '100mg',
          strength_value: 100,
          strength_unit: 'mg',
        },
        {
          molecule: 'trimethoprim',
          strength_raw: '20mg',
          strength_value: 20,
          strength_unit: 'mg',
        },
      ],
      sources: [{ source: 'janaushadhi', source_id: '90', seen_at: '2026-07-07' }],
    },
  ];
  fs.writeFileSync(path.join(dir, 'drugs.jsonl'), `${rows.map(JSON.stringify).join('\n')}\n`);
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({
    date: '2026-07-28',
    total_rows: rows.length,
    sources: { janaushadhi: rows.length },
  }));
  fs.writeFileSync(path.join(dir, 'ingredient-mappings.json'), JSON.stringify({
    schema_version: 1,
    identity_namespace: 'aushadhi:ingredient-identity:v1',
    notices: ['Empty CLI combination fixture.'],
    mappings: [],
  }));
  fs.writeFileSync(path.join(dir, 'presentation-mappings.json'), JSON.stringify({
    schema_version: 1,
    product_id_namespace: 'aushadhi:product:v1',
    product_assertion_namespace: 'aushadhi:product-assertion:v1',
    mappings: [],
  }));
  return dir;
}

function runCli(args, { attachMappings = true, env = {} } = {}) {
  const invocation = [...args];
  const artifactIndex = invocation.indexOf('--artifact');
  if (attachMappings && artifactIndex >= 0) {
    const dir = path.dirname(invocation[artifactIndex + 1]);
    const ingredientMappings = path.join(dir, 'ingredient-mappings.json');
    const presentationMappings = path.join(dir, 'presentation-mappings.json');
    if (fs.existsSync(ingredientMappings) && fs.existsSync(presentationMappings)) {
      invocation.push(
        '--ingredient-mappings', ingredientMappings,
        '--presentation-mappings', presentationMappings,
      );
    }
  }
  return spawnSync(process.execPath, [CLI, ...invocation], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', ...env },
  });
}

test('CLI requires an explicit release profile', () => {
  const result = runCli(['--drug', 'Anything']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--profile/i);
  assert.equal(result.stdout, '');
});

test('CLI selects the rule pack for the explicit release profile by default', () => {
  const production = parseArgs([
    '--profile', 'production-open',
    '--drug', 'First',
    '--drug', 'Second',
  ]);
  const internal = parseArgs([
    '--profile', 'internal-evaluation',
    '--drug', 'First',
    '--drug', 'Second',
  ]);

  assert.equal(path.basename(production.rulesPath), 'interaction-rules.json');
  assert.equal(
    path.basename(internal.rulesPath),
    'interaction-rules.internal-evaluation.json',
  );
  assert.equal(
    path.basename(internal.combinationManifestPath),
    'combination-identity-overrides.json',
  );
  assert.equal(
    path.basename(internal.combinationEvidenceDir),
    'combination-rxnorm-evidence',
  );
  assert.equal(production.artifactPath, null);
  assert.equal(internal.artifactPath, null);
});

test('CLI resolves its default artifact through an external immutable cohort index', () => {
  const distRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-interactions-dist-'));
  try {
    const generationId = 'generation-1';
    const date = '2026-08-06';
    const generationDir = path.join(distRoot, '.generations', generationId);
    fs.mkdirSync(generationDir, { recursive: true });
    const rows = ['First Medicine', 'Second Medicine'].map((brandName, index) => ({
      brand_name: brandName,
      manufacturer: 'Fixture Manufacturer',
      pack_label: 'strip of 10 tablets',
      form_raw: 'tablet',
      ingredients: [{
        molecule: `fixture ingredient ${index + 1}`,
        molecule_raw: `Fixture Ingredient ${index + 1}`,
        strength_raw: '1 mg',
      }],
      sources: [{ source: 'github-jr', source_id: String(index + 1), seen_at: date }],
    }));
    const drugsContents = `${rows.map(JSON.stringify).join('\n')}\n`;
    const summaryContents = JSON.stringify({
      date,
      total_rows: rows.length,
      sources: { 'github-jr': rows.length },
    });
    const drugsPath = path.join(generationDir, 'drugs.jsonl');
    const summaryPath = path.join(generationDir, 'summary.json');
    const preservedTime = new Date('2026-08-06T00:00:00.000Z');
    fs.writeFileSync(drugsPath, drugsContents);
    fs.utimesSync(drugsPath, preservedTime, preservedTime);
    fs.writeFileSync(summaryPath, summaryContents);
    const cohortManifest = `${JSON.stringify({
      schema_version: 1,
      generation_id: generationId,
      date,
      counts: { drugs: rows.length },
      files: {
        'drugs.jsonl': {
          sha256: digest(drugsContents),
          size_bytes: Buffer.byteLength(drugsContents),
          record_count: rows.length,
        },
        'summary.json': {
          sha256: digest(summaryContents),
          size_bytes: Buffer.byteLength(summaryContents),
        },
      },
    })}\n`;
    fs.writeFileSync(path.join(generationDir, 'cohort-manifest.json'), cohortManifest);
    fs.writeFileSync(path.join(distRoot, 'cohort-index.json'), JSON.stringify({
      schema_version: 1,
      updated_at: '2026-08-06T00:00:00.000Z',
      latest: { date, generation_id: generationId },
      dates: { [date]: generationId },
      generations: {
        [generationId]: {
          date,
          manifest_sha256: digest(cohortManifest),
          published_at: '2026-08-06T00:00:00.000Z',
        },
      },
    }));

    const result = runCli([
      '--profile', 'production-open',
      '--drug', 'First Medicine',
      '--drug', 'Second Medicine',
    ], {
      attachMappings: false,
      env: { AUSHADHI_DIST_ROOT: distRoot },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).coverage.interaction_knowledge, 'unknown');

    fs.writeFileSync(drugsPath, drugsContents.replace('First Medicine', 'Third Medicine'));
    fs.utimesSync(drugsPath, preservedTime, preservedTime);
    assert.equal(fs.statSync(drugsPath).size, Buffer.byteLength(drugsContents));
    const tampered = runCli([
      '--profile', 'production-open',
      '--drug', 'First Medicine',
      '--drug', 'Second Medicine',
    ], {
      attachMappings: false,
      env: { AUSHADHI_DIST_ROOT: distRoot },
    });
    assert.equal(tampered.status, 1);
    assert.match(tampered.stderr, /drugs\.jsonl hash mismatch/i);
  } finally {
    fs.rmSync(distRoot, { recursive: true, force: true });
  }
});

test('CLI accepts explicit combination manifest and evidence directory paths', () => {
  const options = parseArgs([
    '--profile', 'internal-evaluation',
    '--combination-manifest', 'fixtures/combination.json',
    '--combination-evidence-dir', 'fixtures/combination-evidence',
    '--drug', 'First',
    '--drug', 'Second',
  ]);
  assert.equal(
    options.combinationManifestPath,
    path.join(ROOT, 'fixtures', 'combination.json'),
  );
  assert.equal(
    options.combinationEvidenceDir,
    path.join(ROOT, 'fixtures', 'combination-evidence'),
  );
});

test('CLI does not permit a source-policy manifest override', () => {
  const result = runCli([
    '--profile', 'production-open',
    '--manifest', 'untrusted-policy.json',
    '--drug', 'First',
    '--drug', 'Second',
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown argument --manifest/i);
  assert.equal(result.stdout, '');
});

test('CLI resolves exact products, expands FDCs and reports unknown open-rule coverage', () => {
  const dir = makeFixture();
  try {
    const result = runCli([
      '--profile', 'production-open',
      '--artifact', path.join(dir, 'drugs.jsonl'),
      '--rules', RULES,
      '--drug', 'Combo A Tablet',
      '--drug', 'Single B Tablet',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    const output = JSON.parse(result.stdout);
    assert.equal(output.resolved_inputs.length, 2);
    assert.equal(output.checked_pairs.length, 2);
    assert.deepEqual(output.reviewed_findings, []);
    assert.equal(output.coverage.product_resolution, 'complete');
    assert.equal(output.coverage.ingredient_mapping, 'complete');
    assert.equal(output.coverage.presentation_mapping, 'complete');
    assert.equal(output.coverage.interaction_knowledge, 'unknown');
    assert.equal(output.clinical_interaction_status, 'no_reviewed_interaction_found');
    assert.equal(output.outcome_code, 'no_reviewed_finding');
    assert.equal(output.checks_performed.checked_pair_count, 2);
    assert.ok(output.not_evaluated.some(
      (entry) => entry.code === 'RULE_PACK_COVERAGE_INCOMPLETE',
    ));
    assert.deepEqual(output.input_gaps, []);
    assert.ok(output.capability_limitations.some(
      (entry) => entry.code === 'NO_LISTED_INTERACTION_IS_NOT_SAFETY',
    ));
    assert.deepEqual(output.mapping_summary, {
      resolved_products: 2,
      mapped_ingredients: 3,
      unmapped_ingredients: 0,
      mapped_presentations: 2,
      unmapped_presentations: 0,
      runtime_subjects: 3,
    });
    assert.match(output.disclaimer, /does not establish safety/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('internal CLI verifies and maps both reviewed PMBJP combination presentations', { skip: PMBJP_SOURCE_SKIP }, () => {
  const dir = makeCombinationFixture();
  try {
    const result = runCli([
      '--profile', 'internal-evaluation',
      '--artifact', path.join(dir, 'drugs.jsonl'),
      '--drug', 'Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg) Tablets IP',
      '--drug', 'Co-trimoxazole (Sulphamethoxazole 100mg and Trimethoprim 20mg) Tablets IP',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    const output = JSON.parse(result.stdout);
    assert.equal(output.resolved_inputs.length, 2);
    for (const entry of output.resolved_inputs) {
      assert.equal(entry.product.combination.status, 'reviewed_override');
      assert.equal(entry.product.presentation.mapping_scope, 'reviewed_combination_product');
      assert.ok(entry.product.ingredients.every((ingredient) => (
        ingredient.mapping_scope === 'reviewed_combination_product'
        && ingredient.mapping_status === 'reviewed_override'
      )));
    }
    const combinationSubjectId = 'combination:co-trimoxazole:rxnorm-10831';
    assert.ok(output.checked_pairs.some((entry) => entry.pair.includes(combinationSubjectId)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI fails closed on missing, tampered, and audit-only combination evidence inputs', () => {
  const fixtureDir = makeCombinationFixture();
  const manifestPath = path.join(ROOT, 'data-static', 'combination-identity-overrides.json');
  const combinationId = 'combination:co-trimoxazole:rxnorm-10831';
  const filename = `${combinationId.replaceAll(/[^a-zA-Z0-9._-]/gu, '_')}.json`;
  const sourceBundle = path.join(
    ROOT,
    'data-static',
    'combination-rxnorm-evidence',
    filename,
  );
  const integrationBundle = path.join(
    ROOT,
    'data-static',
    'combination-rxnorm-evidence',
    'integration-fixture',
    filename,
  );
  try {
    const base = [
      '--profile', 'internal-evaluation',
      '--artifact', path.join(fixtureDir, 'drugs.jsonl'),
      '--drug', 'Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg) Tablets IP',
      '--drug', 'Co-trimoxazole (Sulphamethoxazole 100mg and Trimethoprim 20mg) Tablets IP',
    ];
    const missing = runCli([
      ...base,
      '--combination-manifest', path.join(fixtureDir, 'missing-combinations.json'),
    ]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /cannot read combination identity manifest|ENOENT/u);
    assert.equal(missing.stdout, '');

    for (const [caseName, source, mutate] of [
      ['tampered', sourceBundle, (bundle) => {
        bundle.responses['rxcui/10831/properties'] += ' ';
      }],
      ['audit-only', integrationBundle, () => {}],
    ]) {
      const evidenceDir = path.join(fixtureDir, `${caseName}-evidence`);
      fs.mkdirSync(evidenceDir);
      const bundle = JSON.parse(fs.readFileSync(source, 'utf8'));
      mutate(bundle);
      fs.writeFileSync(path.join(evidenceDir, filename), JSON.stringify(bundle));
      const result = runCli([
        ...base,
        '--combination-manifest', manifestPath,
        '--combination-evidence-dir', evidenceDir,
      ]);
      assert.notEqual(result.status, 0, caseName);
      assert.match(
        result.stderr,
        /combination.*evidence.*unverified|bundle_hash_mismatch|classification|audit/iu,
        caseName,
      );
      assert.equal(result.stdout, '', caseName);
    }
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('production-open output never exposes an internal reviewed combination', () => {
  const dir = makeFixture();
  try {
    const result = runCli([
      '--profile', 'production-open',
      '--artifact', path.join(dir, 'drugs.jsonl'),
      '--rules', RULES,
      '--drug', 'Combo A Tablet',
      '--drug', 'Single B Tablet',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.ok(output.resolved_inputs.every((entry) => (
      entry.product.combination.status === 'no_combination'
      && entry.product.combination.combination_id === null
      && entry.product.combination.runtime_subject === null
    )));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI returns ambiguous products instead of auto-selecting one', () => {
  const dir = makeFixture({ duplicateBrand: true });
  try {
    const result = runCli([
      '--profile', 'production-open',
      '--artifact', path.join(dir, 'drugs.jsonl'),
      '--rules', RULES,
      '--drug', 'Combo A Tablet',
      '--drug', '{"brand_name":"Combo A Tablet","manufacturer":"Beta Pharma Ltd"}',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.resolved_inputs.length, 1);
    assert.equal(output.unresolved_inputs.length, 1);
    assert.equal(output.unresolved_inputs[0].status, 'ambiguous');
    assert.equal(output.coverage.product_resolution, 'partial');
    assert.equal(output.outcome_code, 'input_gaps');
    assert.deepEqual(output.input_gaps, output.unresolved_inputs);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('production-open fails closed when artifact provenance includes onemg-live', () => {
  const dir = makeFixture({ sources: { 'github-jr': 2, 'onemg-live': 1 } });
  try {
    const result = runCli([
      '--profile', 'production-open',
      '--artifact', path.join(dir, 'drugs.jsonl'),
      '--rules', RULES,
      '--drug', 'Combo A Tablet',
      '--drug', 'Single B Tablet',
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /onemg-live|restricted|not allowed/i);
    assert.equal(result.stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('row provenance cannot be concealed by a safe-looking artifact summary', () => {
  const dir = makeFixture({ rowSource: 'onemg-live' });
  try {
    const result = runCli([
      '--profile', 'production-open',
      '--artifact', path.join(dir, 'drugs.jsonl'),
      '--rules', RULES,
      '--drug', 'Combo A Tablet',
      '--drug', 'Single B Tablet',
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /onemg-live|provenance|summary/i);
    assert.equal(result.stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('malformed source counts and stale row counts fail closed', () => {
  for (const options of [
    { sources: { 'github-jr': '2' } },
    { totalRows: 3 },
  ]) {
    const dir = makeFixture(options);
    try {
      const result = runCli([
        '--profile', 'production-open',
        '--artifact', path.join(dir, 'drugs.jsonl'),
        '--rules', RULES,
        '--drug', 'Combo A Tablet',
        '--drug', 'Single B Tablet',
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /count|total_rows|row count|summary/i);
      assert.equal(result.stdout, '');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('catalogue-normalized ingredient fallbacks remain unresolved', () => {
  const dir = makeFixture({ losslessIngredients: false });
  try {
    const result = runCli([
      '--profile', 'production-open',
      '--artifact', path.join(dir, 'drugs.jsonl'),
      '--rules', RULES,
      '--drug', 'Combo A Tablet',
      '--drug', 'Single B Tablet',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.resolved_inputs.length, 2);
    assert.equal(output.unresolved_inputs.length, 3);
    assert.equal(output.checked_pairs.length, 0);
    assert.equal(output.coverage.ingredient_mapping, 'unknown');
    assert.ok(output.unresolved_inputs.every((entry) => (
      entry.status === 'unmapped'
      && entry.error === 'reviewed_identity_mapping_required'
    )));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('production-open rejects reviewed mappings derived from restricted evidence', () => {
  const dir = makeFixture();
  try {
    const file = path.join(dir, 'presentation-mappings.json');
    const mappings = JSON.parse(fs.readFileSync(file, 'utf8'));
    mappings.mappings[0].review.evidence[0] = {
      source_id: 'onemg-live',
      identifier: 'restricted-product-page',
      source_url: 'https://www.1mg.com/drugs/example',
      retrieved_at: '2026-07-26',
      evidence_sha256: digest('restricted-product-page'),
    };
    fs.writeFileSync(file, JSON.stringify(mappings));
    const result = runCli([
      '--profile', 'production-open',
      '--artifact', path.join(dir, 'drugs.jsonl'),
      '--rules', RULES,
      '--drug', 'Combo A Tablet',
      '--drug', 'Single B Tablet',
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /onemg-live|restricted|production-open|not allowed/i);
    assert.equal(result.stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('committed mappings do not auto-accept unrelated observed products or ingredients', () => {
  const dir = makeFixture();
  try {
    const result = runCli([
      '--profile', 'production-open',
      '--artifact', path.join(dir, 'drugs.jsonl'),
      '--rules', RULES,
      '--drug', 'Combo A Tablet',
      '--drug', 'Single B Tablet',
    ], { attachMappings: false });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.checked_pairs.length, 0);
    assert.equal(output.coverage.ingredient_mapping, 'unknown');
    assert.equal(output.mapping_summary.mapped_ingredients, 0);
    assert.equal(output.mapping_summary.unmapped_ingredients, 3);
    assert.ok(output.unresolved_inputs.every((entry) => (
      entry.error === 'reviewed_identity_mapping_required'
    )));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
