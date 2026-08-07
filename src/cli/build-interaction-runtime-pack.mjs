import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { validateCombinationIdentityManifest } from '../lib/interaction-combination-identity.mjs';
import {
  assertVerifiedCombinationManifestEvidence,
  verifyCombinationManifestEvidence,
} from '../lib/combination-rxnorm-evidence.mjs';
import {
  verifyPmbjpCombinationEvidenceFiles,
} from '../lib/pmbjp-combination-evidence.mjs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  compileInteractionRuntimeArtifacts,
  serializeInteractionRuntimePack,
  serializeInteractionTechnicalHoldPack,
} from '../lib/interaction-promotion.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PATHS = {
  promotion: path.join(
    ROOT,
    'data-static',
    'interaction-promotions.internal-evaluation.json',
  ),
  promotionHolds: path.join(
    ROOT,
    'data-static',
    'interaction-promotion-holds.internal-evaluation.json',
  ),
  sourcePolicy: path.join(ROOT, 'data-static', 'interaction-sources.json'),
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
  technicalHoldsOutput: path.join(
    ROOT,
    'data-static',
    'interaction-promotion-holds.runtime.internal-evaluation.json',
  ),
  // Governance policy v1.1 (owner-approved 2026-08-07): mirrored
  // production-open profile paths — same mechanism, second profile. The
  // production-open manifests exist only once the owner commits the signed
  // clinician approvals; until then the canonical production-open pack must
  // remain the committed empty pack (its deterministic recompilation from an
  // absent promotions manifest).
  openPromotion: path.join(
    ROOT,
    'data-static',
    'interaction-promotions.production-open.json',
  ),
  openPromotionHolds: path.join(
    ROOT,
    'data-static',
    'interaction-promotion-holds.production-open.json',
  ),
  openOutput: path.join(ROOT, 'data-static', 'interaction-rules.json'),
  openTechnicalHoldsOutput: path.join(
    ROOT,
    'data-static',
    'interaction-promotion-holds.runtime.production-open.json',
  ),
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function sharedCommittedCompileInputs() {
  return {
    sourcePolicyBytes: fs.readFileSync(PATHS.sourcePolicy),
    draftPackBytes: fs.readFileSync(PATHS.draft),
    attestation: fs.readFileSync(PATHS.attestation, 'utf8'),
    memberSetsBytes: fs.readFileSync(PATHS.memberSets),
    ingredientManifest: readJson(PATHS.ingredients),
    presentationManifest: readJson(PATHS.presentations),
  };
}

export function buildCommittedRuntimeArtifacts(pmbjpSource = defaultPmbjpSource(ROOT)) {
  const { manifest, report } = assertCombinationEvidenceVerified(ROOT, pmbjpSource);
  return compileInteractionRuntimeArtifacts({
    promotionManifest: readJson(PATHS.promotion),
    promotionHoldManifest: readJson(PATHS.promotionHolds),
    ...sharedCommittedCompileInputs(),
    combinationManifest: manifest,
    combinationEvidenceReport: report,
  });
}

export function buildCommittedRuntimePack(pmbjpSource = defaultPmbjpSource(ROOT)) {
  return buildCommittedRuntimeArtifacts(pmbjpSource).rulePack;
}

export function committedProductionOpenManifestsPresent() {
  const promotionExists = fs.existsSync(PATHS.openPromotion);
  const holdsExist = fs.existsSync(PATHS.openPromotionHolds);
  if (promotionExists !== holdsExist) {
    throw new Error(
      'production-open promotion and hold manifests must be committed together',
    );
  }
  return promotionExists;
}

// Compiles the committed production-open manifests, or returns null when no
// owner-approved production-open promotions manifest is committed yet. The
// combination verification pair is optional because the currently approved
// scope has no combination-bound sides; a future combination-bound
// production-open promotion fails closed inside the compiler without it.
export function buildCommittedProductionOpenArtifacts(combinationVerification = null) {
  if (!committedProductionOpenManifestsPresent()) return null;
  return compileInteractionRuntimeArtifacts({
    promotionManifest: readJson(PATHS.openPromotion),
    promotionHoldManifest: readJson(PATHS.openPromotionHolds),
    ...sharedCommittedCompileInputs(),
    combinationManifest: combinationVerification?.manifest ?? null,
    combinationEvidenceReport: combinationVerification?.report ?? null,
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

// Machine-enforced coupling: the manifest must exist, and any recorded combinations
// may not be compiled or promoted until their RxNorm evidence verifies. The returned
// manifest/report pair preserves the verifier capability for downstream compilation.
function defaultPmbjpSource(root) {
  const restrictedRoot = path.join(root, 'data', 'interaction', 'internal-evaluation');
  const sourceDir = path.join(restrictedRoot, 'pmbjp-product-list');
  return {
    pdfPath: path.join(sourceDir, 'pmbjp-product-list.pdf'),
    tableTextPath: path.join(sourceDir, 'pmbjp-product-list.table.txt'),
  };
}

export function assertCombinationEvidenceVerified(
  root = ROOT,
  pmbjpSource = defaultPmbjpSource(root),
) {
  const manifestPath = path.join(root, 'data-static', 'combination-identity-overrides.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`combination identity manifest is missing: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  validateCombinationIdentityManifest(manifest);
  deepFreeze(manifest);

  const bundleDir = path.join(root, 'data-static', 'combination-rxnorm-evidence');
  const bundles = {};
  for (const combination of manifest.combinations) {
    const file = path.join(
      bundleDir,
      `${combination.combination_id.replaceAll(/[^a-zA-Z0-9._-]/gu, '_')}.json`,
    );
    if (fs.existsSync(file)) {
      bundles[combination.combination_id] = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  }
  const pmbjpSourceReport = verifyPmbjpCombinationEvidenceFiles(manifest, pmbjpSource);
  const report = verifyCombinationManifestEvidence(
    manifest,
    bundles,
    { pmbjpSourceReport },
  );
  if (!report.verified) {
    const detail = report.reports
      .filter((entry) => !entry.verified)
      .map((entry) => `${entry.combination_id}: ${entry.findings.map((f) => f.code).join(', ')}`)
      .join('; ');
    throw new Error(
      'combination RxNorm evidence is unverified, so the runtime pack may not be built or '
      + `checked: ${detail}`,
    );
  }
  assertVerifiedCombinationManifestEvidence(report, manifest);
  return Object.freeze({ manifest, report });
}

function main() {
  const args = process.argv.slice(2);
  const allowed = args.every((arg) => (
    arg === '--check'
    || arg.startsWith('--pmbjp-list=')
    || arg.startsWith('--pmbjp-table=')
  ));
  if (!allowed || args.filter((arg) => arg === '--check').length > 1) {
    throw new TypeError(
      'usage: node src/cli/build-interaction-runtime-pack.mjs [--check] '
      + '[--pmbjp-list=<pdf>] [--pmbjp-table=<table-text>]',
    );
  }
  const source = defaultPmbjpSource(ROOT);
  const pdfArg = args.find((arg) => arg.startsWith('--pmbjp-list='));
  const tableArg = args.find((arg) => arg.startsWith('--pmbjp-table='));
  if (pdfArg) source.pdfPath = path.resolve(ROOT, pdfArg.slice('--pmbjp-list='.length));
  if (tableArg) source.tableTextPath = path.resolve(ROOT, tableArg.slice('--pmbjp-table='.length));
  const combinationVerification = assertCombinationEvidenceVerified(ROOT, source);
  const artifacts = compileInteractionRuntimeArtifacts({
    promotionManifest: readJson(PATHS.promotion),
    promotionHoldManifest: readJson(PATHS.promotionHolds),
    ...sharedCommittedCompileInputs(),
    combinationManifest: combinationVerification.manifest,
    combinationEvidenceReport: combinationVerification.report,
  });
  const serialized = serializeInteractionRuntimePack(artifacts.rulePack);
  const serializedTechnicalHolds = serializeInteractionTechnicalHoldPack(
    artifacts.technicalHoldPack,
  );
  const openArtifacts = buildCommittedProductionOpenArtifacts(combinationVerification);
  const check = args.includes('--check');
  if (check) {
    if (!fs.existsSync(PATHS.output) || fs.readFileSync(PATHS.output, 'utf8') !== serialized) {
      throw new Error(
        'checked-in internal runtime pack is stale; run npm run interactions:promote',
      );
    }
    if (!fs.existsSync(PATHS.technicalHoldsOutput)
        || fs.readFileSync(PATHS.technicalHoldsOutput, 'utf8')
          !== serializedTechnicalHolds) {
      throw new Error(
        'checked-in internal runtime technical holds are stale; '
          + 'run npm run interactions:promote',
      );
    }
    process.stdout.write(`Verified ${PATHS.output}\n`);
    process.stdout.write(`Verified ${PATHS.technicalHoldsOutput}\n`);
  } else {
    replaceAtomically(PATHS.technicalHoldsOutput, serializedTechnicalHolds);
    replaceAtomically(PATHS.output, serialized);
    process.stdout.write(`Wrote ${PATHS.output}\n`);
    process.stdout.write(`Wrote ${PATHS.technicalHoldsOutput}\n`);
  }

  if (openArtifacts === null) {
    // No owner-approved production-open promotions manifest is committed;
    // the deterministic production-open result is the committed empty pack.
    const openPack = JSON.parse(fs.readFileSync(PATHS.openOutput, 'utf8'));
    if (!Array.isArray(openPack.rules) || openPack.rules.length !== 0) {
      throw new Error(
        'canonical production-open pack contains rules but no owner-approved '
          + 'production-open promotions manifest is committed',
      );
    }
    if (fs.existsSync(PATHS.openTechnicalHoldsOutput)) {
      throw new Error(
        'production-open runtime technical holds exist without a committed '
          + 'production-open promotion hold manifest',
      );
    }
    process.stdout.write(
      `Verified ${PATHS.openOutput} (empty; no production-open promotions committed)\n`,
    );
    return;
  }

  const serializedOpen = serializeInteractionRuntimePack(openArtifacts.rulePack);
  const serializedOpenTechnicalHolds = serializeInteractionTechnicalHoldPack(
    openArtifacts.technicalHoldPack,
  );
  if (check) {
    if (!fs.existsSync(PATHS.openOutput)
        || fs.readFileSync(PATHS.openOutput, 'utf8') !== serializedOpen) {
      throw new Error(
        'checked-in production-open runtime pack is stale; run npm run interactions:promote',
      );
    }
    if (!fs.existsSync(PATHS.openTechnicalHoldsOutput)
        || fs.readFileSync(PATHS.openTechnicalHoldsOutput, 'utf8')
          !== serializedOpenTechnicalHolds) {
      throw new Error(
        'checked-in production-open runtime technical holds are stale; '
          + 'run npm run interactions:promote',
      );
    }
    process.stdout.write(`Verified ${PATHS.openOutput}\n`);
    process.stdout.write(`Verified ${PATHS.openTechnicalHoldsOutput}\n`);
    return;
  }
  replaceAtomically(PATHS.openTechnicalHoldsOutput, serializedOpenTechnicalHolds);
  replaceAtomically(PATHS.openOutput, serializedOpen);
  process.stdout.write(`Wrote ${PATHS.openOutput}\n`);
  process.stdout.write(`Wrote ${PATHS.openTechnicalHoldsOutput}\n`);
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
