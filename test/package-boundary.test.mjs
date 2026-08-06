import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGE_CLI = path.join(ROOT, 'src', 'cli', 'stage-production-open-package.mjs');
const ROOT_PACK_ALLOWLIST = ['README.md', 'package.json'];
const OPEN_PACK_ALLOWLIST = [
  'README.md',
  'data-static/interaction-rules.json',
  'data-static/interaction-rules.schema.json',
  'package.json',
];
const FORBIDDEN_PACKED_TEXT = [
  'internal-evaluation',
  'warfarin__azithromycin_oral',
  'warfarin__tramadol',
  '5968b93a6bd3e19bbefacbaffed16ef902dc74d50f9f0ac4fd4b636f417b44c6',
  'c2685e743c2b1fca5c3862fb87a4a452c366876d280ef0f18e31eae9a4e109f1',
  '4cdab603d1ce790a38fee1969df01bca4338b283109b4d742a131d532d34204c',
  '2f7e923cbd5447e3df760ac9f5c7b55d064f3adb5bf681fe3d1fd24643331f22',
  'b9d638afd2b21893f9222da1767b87e509e88de414aa6fac27e01b1ea5ec2f9f',
];

function run(command, args, cwd = ROOT) {
  const executable = process.platform === 'win32'
    ? process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe'
    : command;
  const executableArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', command, ...args]
    : args;
  return spawnSync(executable, executableArgs, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
  });
}

function npmPackFiles(cwd) {
  const result = run('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], cwd);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const [pack] = JSON.parse(result.stdout);
  return pack.files
    .map(({ path: relativePath }) => relativePath.replaceAll('\\', '/'))
    .sort();
}

function assertPackedTextClean(cwd, files) {
  const packedText = files
    .map((relativePath) => fs.readFileSync(path.join(cwd, relativePath), 'utf8'))
    .join('\n');
  for (const forbidden of FORBIDDEN_PACKED_TEXT) {
    assert.doesNotMatch(packedText, new RegExp(forbidden, 'iu'));
  }
}

test('root npm package is deliberately metadata-only and contains no restricted text', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.files, []);

  const files = npmPackFiles(ROOT);
  assert.deepEqual(files, ROOT_PACK_ALLOWLIST);
  assertPackedTextClean(ROOT, files);
});

test('production-open package stages an exact data-only allowlist with a narrowed schema', (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-open-package-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const output = path.join(scratch, 'package');
  const canonicalRulesPath = path.join(ROOT, 'data-static', 'interaction-rules.json');
  const canonicalSchemaPath = path.join(ROOT, 'data-static', 'interaction-rules.schema.json');
  const canonicalRules = fs.readFileSync(canonicalRulesPath, 'utf8');
  const canonicalSchema = JSON.parse(fs.readFileSync(canonicalSchemaPath, 'utf8'));

  const result = run('node', [STAGE_CLI, '--output', output]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(npmPackFiles(output), OPEN_PACK_ALLOWLIST);

  assert.equal(
    fs.readFileSync(path.join(output, 'data-static', 'interaction-rules.json'), 'utf8'),
    canonicalRules,
  );
  const stagedSchema = JSON.parse(fs.readFileSync(
    path.join(output, 'data-static', 'interaction-rules.schema.json'),
    'utf8',
  ));
  const expectedSchema = structuredClone(canonicalSchema);
  expectedSchema.properties.profile.enum = ['production-open'];
  assert.deepEqual(stagedSchema, expectedSchema);

  const stagedManifest = JSON.parse(fs.readFileSync(path.join(output, 'package.json'), 'utf8'));
  assert.equal(stagedManifest.name, '@aushadhi/production-open-interactions');
  assert.deepEqual(stagedManifest.files, [
    'data-static/interaction-rules.json',
    'data-static/interaction-rules.schema.json',
  ]);
  assert.equal(stagedManifest.scripts, undefined);
  assert.equal(stagedManifest.main, undefined);
  assert.equal(stagedManifest.exports, undefined);
  assert.equal(stagedManifest.bin, undefined);

  const stagedReadme = fs.readFileSync(path.join(output, 'README.md'), 'utf8');
  assert.match(stagedReadme, /blank result does\s+not mean\s+(?:safe|safety)/iu);
  assertPackedTextClean(output, OPEN_PACK_ALLOWLIST);
});

test('production-open package check is non-mutating and canonical rules remain empty', () => {
  const canonicalRulesPath = path.join(ROOT, 'data-static', 'interaction-rules.json');
  const canonicalSchemaPath = path.join(ROOT, 'data-static', 'interaction-rules.schema.json');
  const rulesBefore = fs.readFileSync(canonicalRulesPath, 'utf8');
  const schemaBefore = fs.readFileSync(canonicalSchemaPath, 'utf8');

  const result = run('node', [STAGE_CLI, '--check']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(canonicalRulesPath, 'utf8'), rulesBefore);
  assert.equal(fs.readFileSync(canonicalSchemaPath, 'utf8'), schemaBefore);

  const rules = JSON.parse(rulesBefore);
  assert.equal(rules.profile, 'production-open');
  assert.equal(rules.declared_coverage, 'unknown');
  assert.deepEqual(rules.rules, []);
});

test('production-open staging rejects a flag as --output value', (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-open-args-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));

  const result = run('node', [STAGE_CLI, '--output', '--check'], scratch);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--output requires a path/iu);
  assert.deepEqual(fs.readdirSync(scratch), []);
});

test('production-open staging preserves an unrecognized existing directory', (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-open-preserve-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const output = path.join(scratch, 'package');
  fs.mkdirSync(output);
  fs.writeFileSync(
    path.join(output, 'package.json'),
    `${JSON.stringify({ name: '@aushadhi/production-open-interactions' })}\n`,
  );
  fs.writeFileSync(path.join(output, 'do-not-delete.txt'), 'owner data\n');

  const result = run('node', [STAGE_CLI, '--output', output]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing to replace unrecognized output directory/iu);
  assert.equal(fs.readFileSync(path.join(output, 'do-not-delete.txt'), 'utf8'), 'owner data\n');
  assert.deepEqual(fs.readdirSync(output).sort(), ['do-not-delete.txt', 'package.json']);
});

test('production-open staging refuses to write into repository source directories', () => {
  const output = path.join(ROOT, 'data-static', '__production-open-package-test__');
  assert.equal(fs.existsSync(output), false);

  const result = run('node', [STAGE_CLI, '--output', output]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /repository output must be a child of/iu);
  assert.equal(fs.existsSync(output), false);
});
