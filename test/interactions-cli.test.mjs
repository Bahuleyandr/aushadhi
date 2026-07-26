import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
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

function runCli(args, { attachMappings = true } = {}) {
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
    env: { ...process.env, NO_COLOR: '1' },
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
