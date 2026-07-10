import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'src', 'cli', 'interactions.mjs');
const RULES = path.join(ROOT, 'data-static', 'interaction-rules.json');

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
  return dir;
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
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
    assert.equal(output.coverage.interaction_knowledge, 'unknown');
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
      && entry.error === 'catalogue_normalized_fallback_requires_review'
    )));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
