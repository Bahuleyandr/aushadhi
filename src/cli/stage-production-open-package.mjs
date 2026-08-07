#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  buildCommittedProductionOpenArtifacts,
  committedProductionOpenManifestsPresent,
} from './build-interaction-runtime-pack.mjs';
import {
  assertProductionOpenPackMatchesAuthority,
} from '../lib/production-open-package-boundary.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACKAGE_NAME = '@aushadhi/production-open-interactions';
const PACKAGE_DESCRIPTION = 'Aushadhi production-open interaction rule data';
const DATA_FILES = [
  'data-static/interaction-rules.json',
  'data-static/interaction-rules.schema.json',
];
const PACKED_FILES = [
  'README.md',
  ...DATA_FILES,
  'package.json',
];
const FORBIDDEN_TEXT = [
  'internal-evaluation',
  'warfarin__azithromycin_oral',
  'warfarin__tramadol',
  '5968b93a6bd3e19bbefacbaffed16ef902dc74d50f9f0ac4fd4b636f417b44c6',
  'c2685e743c2b1fca5c3862fb87a4a452c366876d280ef0f18e31eae9a4e109f1',
  '4cdab603d1ce790a38fee1969df01bca4338b283109b4d742a131d532d34204c',
  '2f7e923cbd5447e3df760ac9f5c7b55d064f3adb5bf681fe3d1fd24643331f22',
  'b9d638afd2b21893f9222da1767b87e509e88de414aa6fac27e01b1ea5ec2f9f',
];

function fail(message) {
  throw new Error(`production-open package: ${message}`);
}

function parseArgs(argv) {
  let check = false;
  let output = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') {
      if (check) fail('--check may only be provided once');
      check = true;
      continue;
    }
    if (argument === '--output') {
      if (output !== null) fail('--output may only be provided once');
      output = argv[index + 1];
      index += 1;
      if (!output || output.startsWith('--')) fail('--output requires a path');
      continue;
    }
    if (argument.startsWith('--output=')) {
      if (output !== null) fail('--output may only be provided once');
      output = argument.slice('--output='.length);
      if (!output) fail('--output requires a path');
      continue;
    }
    fail(`unknown argument ${argument}`);
  }

  if (check && output !== null) {
    fail('--check creates and verifies an isolated temporary package; omit --output');
  }
  return { check, output };
}

function readCanonicalSources() {
  const rulesPath = path.join(ROOT, 'data-static', 'interaction-rules.json');
  const schemaPath = path.join(ROOT, 'data-static', 'interaction-rules.schema.json');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');
  const schemaText = fs.readFileSync(schemaPath, 'utf8');
  let rules;
  let schema;
  try {
    rules = JSON.parse(rulesText);
    schema = JSON.parse(schemaText);
  } catch (error) {
    fail(`canonical JSON is invalid: ${error.message}`);
  }

  if (rules.profile !== 'production-open') fail('canonical rules profile must be production-open');
  // Governance policy v1.1 (owner-approved 2026-08-07): the pack is no longer
  // required to remain empty here. Content correctness is proven by
  // deterministic regeneration from the owner-approved production-open
  // manifests. This staging boundary invokes that same compiler path so the
  // check cannot be bypassed by running the package command directly. Coverage
  // may never be declared complete.
  if (!['unknown', 'partial'].includes(rules.declared_coverage)) {
    fail('canonical rules coverage must remain unknown or partial; complete is prohibited');
  }
  if (!Array.isArray(rules.rules)) fail('canonical production-open rules must be an array');
  const manifestsPresent = committedProductionOpenManifestsPresent();
  const compiledRulePack = manifestsPresent
    ? buildCommittedProductionOpenArtifacts()?.rulePack
    : null;
  try {
    assertProductionOpenPackMatchesAuthority({
      rules,
      rulesText,
      productionOpenManifestsPresent: manifestsPresent,
      compiledRulePack,
    });
  } catch (error) {
    fail(error.message);
  }
  const profileEnum = schema?.properties?.profile?.enum;
  if (!Array.isArray(profileEnum) || !profileEnum.includes('production-open')) {
    fail('canonical schema must define the production-open profile');
  }

  const projectedSchema = structuredClone(schema);
  projectedSchema.properties.profile.enum = ['production-open'];
  return {
    rulesPath,
    schemaPath,
    rulesText,
    schemaText,
    rules,
    projectedSchema,
  };
}

function publicReadme(rules) {
  return `# Aushadhi production-open interaction data

This package contains data only:

- \`data-static/interaction-rules.json\` is the canonical production-open rule pack.
- \`data-static/interaction-rules.schema.json\` is a production-only projection of
  the canonical schema. Its profile enum is narrowed to \`production-open\`; every
  other schema constraint is unchanged.

The rule pack currently declares coverage as \`${rules.declared_coverage}\`. A
blank result does not mean safe or establish that no interaction exists.
Consumers must present that limitation and must not use this data as a
substitute for clinical judgement.

No executable code, private review material, product catalogue, or deployment
authority is included.
`;
}

function packageManifest(rules) {
  return {
    name: PACKAGE_NAME,
    version: rules.pack_version,
    description: PACKAGE_DESCRIPTION,
    license: rules.licence,
    files: DATA_FILES,
    publishConfig: {
      access: 'public',
    },
  };
}

function npmPackFiles(directory) {
  const command = process.platform === 'win32'
    ? process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe'
    : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm', 'pack', '--dry-run', '--ignore-scripts', '--json']
    : ['pack', '--dry-run', '--ignore-scripts', '--json'];
  const result = spawnSync(command, args, {
    cwd: directory,
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (result.status !== 0) {
    fail(`npm pack verification failed: ${result.stderr || result.stdout}`);
  }
  let metadata;
  try {
    [metadata] = JSON.parse(result.stdout);
  } catch (error) {
    fail(`npm pack returned invalid JSON: ${error.message}`);
  }
  return metadata.files
    .map(({ path: relativePath }) => relativePath.replaceAll('\\', '/'))
    .sort();
}

function verifyStagedPackage(directory) {
  const files = npmPackFiles(directory);
  if (JSON.stringify(files) !== JSON.stringify(PACKED_FILES)) {
    fail(`packed file allowlist mismatch: ${JSON.stringify(files)}`);
  }

  const packedText = files
    .map((relativePath) => fs.readFileSync(path.join(directory, relativePath), 'utf8'))
    .join('\n');
  for (const forbidden of FORBIDDEN_TEXT) {
    if (packedText.toLowerCase().includes(forbidden.toLowerCase())) {
      fail(`packed content contains forbidden marker ${forbidden}`);
    }
  }
}

function assertReplaceableOutput(output) {
  if (!fs.existsSync(output)) return;
  const stat = fs.lstatSync(output);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`refusing to replace non-directory or symbolic-link output ${output}`);
  }
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      const entryStat = fs.lstatSync(fullPath);
      if (entryStat.isSymbolicLink()) {
        fail(`refusing to replace unrecognized output directory ${output}`);
      }
      if (entryStat.isDirectory()) {
        visit(fullPath);
      } else if (entryStat.isFile()) {
        files.push(path.relative(output, fullPath).replaceAll('\\', '/'));
      } else {
        fail(`refusing to replace unrecognized output directory ${output}`);
      }
    }
  };
  visit(output);
  files.sort();
  if (JSON.stringify(files) !== JSON.stringify(PACKED_FILES)) {
    fail(`refusing to replace unrecognized output directory ${output}`);
  }

  let existingManifest;
  try {
    existingManifest = JSON.parse(fs.readFileSync(path.join(output, 'package.json'), 'utf8'));
  } catch {
    fail(`refusing to replace unrecognized output directory ${output}`);
  }
  const manifestKeys = Object.keys(existingManifest).sort();
  const expectedKeys = ['description', 'files', 'license', 'name', 'publishConfig', 'version'];
  if (
    JSON.stringify(manifestKeys) !== JSON.stringify(expectedKeys)
    || existingManifest.name !== PACKAGE_NAME
    || existingManifest.description !== PACKAGE_DESCRIPTION
    || typeof existingManifest.version !== 'string'
    || existingManifest.version.length === 0
    || typeof existingManifest.license !== 'string'
    || existingManifest.license.length === 0
    || JSON.stringify(existingManifest.files) !== JSON.stringify(DATA_FILES)
    || JSON.stringify(existingManifest.publishConfig) !== JSON.stringify({ access: 'public' })
  ) {
    fail(`refusing to replace unrecognized output directory ${output}`);
  }

  let existingRules;
  let existingSchema;
  try {
    existingRules = JSON.parse(fs.readFileSync(
      path.join(output, 'data-static', 'interaction-rules.json'),
      'utf8',
    ));
    existingSchema = JSON.parse(fs.readFileSync(
      path.join(output, 'data-static', 'interaction-rules.schema.json'),
      'utf8',
    ));
  } catch {
    fail(`refusing to replace unrecognized output directory ${output}`);
  }
  if (
    existingRules.profile !== 'production-open'
    || !['unknown', 'partial'].includes(existingRules.declared_coverage)
    || !Array.isArray(existingRules.rules)
    || JSON.stringify(existingSchema?.properties?.profile?.enum) !== JSON.stringify(['production-open'])
  ) {
    fail(`refusing to replace unrecognized output directory ${output}`);
  }
  verifyStagedPackage(output);
}

function publishStage(staging, output) {
  assertReplaceableOutput(output);
  if (!fs.existsSync(output)) {
    fs.renameSync(staging, output);
    return;
  }

  const backup = `${output}.replaced-${randomUUID()}`;
  fs.renameSync(output, backup);
  try {
    fs.renameSync(staging, output);
    fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(output) && fs.existsSync(backup)) fs.renameSync(backup, output);
    throw error;
  }
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative.length > 0
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function prospectiveRealPath(target) {
  const suffix = [];
  let existing = target;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) fail(`cannot resolve output path ${target}`);
    suffix.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(fs.realpathSync(existing), ...suffix);
}

function assertSafeOutputPath(output) {
  const repository = fs.realpathSync(ROOT);
  const dist = path.join(repository, 'dist');
  for (const candidate of [output, prospectiveRealPath(output)]) {
    const resolved = path.resolve(candidate);
    if ((resolved === repository || isInside(repository, resolved)) && !isInside(dist, resolved)) {
      fail(`repository output must be a child of ${dist}`);
    }
  }
}

function stagePackage(output, sources) {
  const resolvedOutput = path.resolve(output);
  const protectedPaths = [
    ROOT,
    path.join(ROOT, 'data-static'),
    sources.rulesPath,
    sources.schemaPath,
  ].map((entry) => path.resolve(entry).toLowerCase());
  if (protectedPaths.includes(resolvedOutput.toLowerCase())) {
    fail(`refusing to stage over protected path ${resolvedOutput}`);
  }
  assertSafeOutputPath(resolvedOutput);

  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  const staging = `${resolvedOutput}.staging-${randomUUID()}`;
  fs.mkdirSync(path.join(staging, 'data-static'), { recursive: true });
  try {
    fs.writeFileSync(path.join(staging, 'README.md'), publicReadme(sources.rules), 'utf8');
    fs.writeFileSync(
      path.join(staging, 'package.json'),
      `${JSON.stringify(packageManifest(sources.rules), null, 2)}\n`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(staging, 'data-static', 'interaction-rules.json'),
      sources.rulesText,
      'utf8',
    );
    fs.writeFileSync(
      path.join(staging, 'data-static', 'interaction-rules.schema.json'),
      `${JSON.stringify(sources.projectedSchema, null, 2)}\n`,
      'utf8',
    );
    verifyStagedPackage(staging);
    publishStage(staging, resolvedOutput);
  } finally {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  }
  return resolvedOutput;
}

function verifyCanonicalUnchanged(sources) {
  if (fs.readFileSync(sources.rulesPath, 'utf8') !== sources.rulesText) {
    fail('canonical production-open rules changed during staging');
  }
  if (fs.readFileSync(sources.schemaPath, 'utf8') !== sources.schemaText) {
    fail('canonical interaction schema changed during staging');
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sources = readCanonicalSources();
  if (options.check) {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-production-open-check-'));
    try {
      stagePackage(path.join(scratch, 'package'), sources);
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    verifyCanonicalUnchanged(sources);
    process.stdout.write(
      `production-open package check passed (4 files, declared coverage ${sources.rules.declared_coverage})\n`,
    );
    return;
  }

  const output = stagePackage(
    options.output ?? path.join(ROOT, 'dist', 'production-open-package'),
    sources,
  );
  verifyCanonicalUnchanged(sources);
  process.stdout.write(`staged production-open package at ${output}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
