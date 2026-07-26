import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  compileInteractionRuntimePack,
  serializeInteractionRuntimePack,
} from '../lib/interaction-promotion.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PATHS = {
  promotion: path.join(
    ROOT,
    'data-static',
    'interaction-promotions.internal-evaluation.json',
  ),
  draft: path.join(
    ROOT,
    'docs',
    'interaction-review',
    'batch-01-v2',
    'batch-01-v2.jsonl',
  ),
  attestation: path.join(
    ROOT,
    'docs',
    'interaction-review',
    'batch-01-v2',
    'batch-01-v2.provenance.json',
  ),
  memberSets: path.join(ROOT, 'data-static', 'interaction-member-sets.json'),
  ingredients: path.join(ROOT, 'data-static', 'ingredient-mapping-overrides.json'),
  presentations: path.join(ROOT, 'data-static', 'product-presentation-overrides.json'),
  output: path.join(
    ROOT,
    'data-static',
    'interaction-rules.internal-evaluation.json',
  ),
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function buildCommittedRuntimePack() {
  return compileInteractionRuntimePack({
    promotionManifest: readJson(PATHS.promotion),
    draftPackBytes: fs.readFileSync(PATHS.draft),
    attestation: fs.readFileSync(PATHS.attestation, 'utf8'),
    memberSetsBytes: fs.readFileSync(PATHS.memberSets),
    ingredientManifest: readJson(PATHS.ingredients),
    presentationManifest: readJson(PATHS.presentations),
  });
}

function replaceAtomically(targetPath, text) {
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const backupPath = `${targetPath}.${process.pid}.${randomUUID()}.bak`;
  fs.writeFileSync(temporaryPath, text, { flag: 'wx' });
  let movedOriginal = false;
  try {
    if (fs.existsSync(targetPath)) {
      fs.renameSync(targetPath, backupPath);
      movedOriginal = true;
    }
    fs.renameSync(temporaryPath, targetPath);
    if (fs.readFileSync(targetPath, 'utf8') !== text) {
      throw new Error('runtime pack differs after atomic replacement');
    }
    if (movedOriginal) fs.rmSync(backupPath, { force: true });
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { force: true });
    if (movedOriginal && fs.existsSync(backupPath)) fs.renameSync(backupPath, targetPath);
    throw error;
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check') || args.filter((arg) => arg === '--check').length > 1) {
    throw new TypeError('usage: node src/cli/build-interaction-runtime-pack.mjs [--check]');
  }
  const serialized = serializeInteractionRuntimePack(buildCommittedRuntimePack());
  if (args.includes('--check')) {
    if (!fs.existsSync(PATHS.output) || fs.readFileSync(PATHS.output, 'utf8') !== serialized) {
      throw new Error(
        'checked-in internal runtime pack is stale; run npm run interactions:promote',
      );
    }
    process.stdout.write(`Verified ${PATHS.output}\n`);
    return;
  }
  replaceAtomically(PATHS.output, serialized);
  process.stdout.write(`Wrote ${PATHS.output}\n`);
}

if (process.argv[1]
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
