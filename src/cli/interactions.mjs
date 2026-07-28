import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkResolvedProducts, validateRulePack } from '../lib/interaction-checker.mjs';
import {
  compileCombinationIdentityManifest,
  validateCombinationIdentityManifest,
} from '../lib/interaction-combination-identity.mjs';
import {
  verifyCombinationManifestEvidence,
} from '../lib/combination-rxnorm-evidence.mjs';
import {
  mappingAllowedForProfile,
  mapResolvedProducts,
  summarizeInteractionMappings,
  validateIngredientMappingManifest,
  validateProductPresentationManifest,
} from '../lib/interaction-mapping.mjs';
import {
  assertArtifactProvenance,
  assertSourceAllowed,
  loadSourceManifest,
} from '../lib/interaction-source-policy.mjs';
import { scanProductQueries } from '../lib/product-resolver.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_ARTIFACT = path.join(ROOT, 'dist', 'latest', 'drugs.jsonl');
const DEFAULT_RULES_BY_PROFILE = {
  'production-open': path.join(ROOT, 'data-static', 'interaction-rules.json'),
  'internal-evaluation': path.join(
    ROOT,
    'data-static',
    'interaction-rules.internal-evaluation.json',
  ),
};
const DEFAULT_INGREDIENT_MAPPINGS = path.join(
  ROOT,
  'data-static',
  'ingredient-mapping-overrides.json',
);
const DEFAULT_PRESENTATION_MAPPINGS = path.join(
  ROOT,
  'data-static',
  'product-presentation-overrides.json',
);
const DEFAULT_COMBINATION_MANIFEST = path.join(
  ROOT,
  'data-static',
  'combination-identity-overrides.json',
);
const DEFAULT_COMBINATION_EVIDENCE = path.join(
  ROOT,
  'data-static',
  'combination-rxnorm-evidence',
);

function requireValue(args, index, flag) {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseArgs(args) {
  const options = {
    profile: null,
    artifactPath: DEFAULT_ARTIFACT,
    rulesPath: null,
    ingredientMappingsPath: DEFAULT_INGREDIENT_MAPPINGS,
    presentationMappingsPath: DEFAULT_PRESENTATION_MAPPINGS,
    combinationManifestPath: DEFAULT_COMBINATION_MANIFEST,
    combinationEvidenceDir: DEFAULT_COMBINATION_EVIDENCE,
    queries: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--profile') {
      options.profile = requireValue(args, index, flag);
      index += 1;
    } else if (flag === '--artifact') {
      options.artifactPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--rules') {
      options.rulesPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--ingredient-mappings') {
      options.ingredientMappingsPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--presentation-mappings') {
      options.presentationMappingsPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--combination-manifest') {
      options.combinationManifestPath = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--combination-evidence-dir') {
      options.combinationEvidenceDir = path.resolve(ROOT, requireValue(args, index, flag));
      index += 1;
    } else if (flag === '--drug') {
      options.queries.push(parseDrugQuery(requireValue(args, index, flag)));
      index += 1;
    } else {
      throw new Error(`unknown argument ${flag}`);
    }
  }

  if (!options.profile) throw new Error('--profile is required');
  if (!['production-open', 'internal-evaluation'].includes(options.profile)) {
    throw new Error(`unsupported --profile ${options.profile}`);
  }
  options.rulesPath ??= DEFAULT_RULES_BY_PROFILE[options.profile];
  if (options.queries.length < 2) throw new Error('at least two --drug inputs are required');
  return options;
}

function parseDrugQuery(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`invalid --drug JSON: ${error.message}`);
  }
}

function storagePath(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

async function readJson(file, label) {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${label} at ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid ${label} JSON at ${file}: ${error.message}`);
  }
}

function artifactSummaryProvenance(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    throw new Error('artifact summary must be an object');
  }
  if (!summary.sources || typeof summary.sources !== 'object' || Array.isArray(summary.sources)) {
    throw new Error('artifact summary requires source provenance');
  }
  if (!Number.isSafeInteger(summary.total_rows) || summary.total_rows < 0) {
    throw new Error('artifact summary total_rows must be a non-negative integer');
  }
  const sourceCounts = {};
  for (const [sourceId, count] of Object.entries(summary.sources)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`artifact summary source count for ${sourceId} must be a non-negative integer`);
    }
    if (count > 0) sourceCounts[sourceId] = count;
  }
  const sourceIds = Object.keys(sourceCounts).sort();
  if (sourceIds.length === 0) throw new Error('artifact summary has no non-empty sources');
  return { rowCount: summary.total_rows, sourceCounts, sourceIds };
}

function assertSummaryMatchesRows(summaryProvenance, observedProvenance) {
  if (summaryProvenance.rowCount !== observedProvenance.row_count) {
    throw new Error(
      `artifact row count does not match summary total_rows: expected ${summaryProvenance.rowCount}, observed ${observedProvenance.row_count}`,
    );
  }
  const observedIds = Object.keys(observedProvenance.source_counts).sort();
  for (const sourceId of observedIds) {
    const declaredCount = summaryProvenance.sourceCounts[sourceId];
    if (declaredCount === undefined) {
      throw new Error(`artifact row provenance source ${sourceId} is absent from summary`);
    }
    if (observedProvenance.source_counts[sourceId] > declaredCount) {
      throw new Error(`artifact row provenance count for ${sourceId} exceeds summary count`);
    }
  }
  for (const sourceId of summaryProvenance.sourceIds) {
    if (observedProvenance.source_counts[sourceId] === undefined) {
      throw new Error(`artifact summary source ${sourceId} is absent from row provenance`);
    }
  }
  return observedIds;
}

function assertMappingEvidenceSourcesAllowed(sourceManifest, profile, mappingManifests) {
  for (const { manifest, allowedUses } of mappingManifests) {
    for (const mapping of manifest?.mappings ?? []) {
      if (!mappingAllowedForProfile(mapping, profile)) continue;
      for (const evidence of mapping.review?.evidence ?? []) {
        const source = sourceManifest.sources?.[evidence.source_id];
        if (!source) {
          throw new Error(`mapping evidence uses unknown source ${evidence.source_id}`);
        }
        const use = allowedUses.find((candidate) => source.allowed_uses?.includes(candidate));
        if (!use) {
          throw new Error(
            `mapping evidence source ${evidence.source_id} is not allowed for this mapping type`,
          );
        }
        const storagePathForPolicy = source.required_storage_zones?.[profile]?.[0]
          ?? 'data-static';
        assertSourceAllowed(sourceManifest, {
          sourceId: evidence.source_id,
          profile,
          use,
          storagePath: storagePathForPolicy,
        });
      }
    }
  }
}

function assertEvidenceSourceAllowed(sourceManifest, {
  sourceId,
  profile,
  allowedUses,
  label,
}) {
  const source = sourceManifest.sources?.[sourceId];
  if (!source) throw new Error(`${label} uses unknown source ${sourceId}`);
  const use = allowedUses.find((candidate) => source.allowed_uses?.includes(candidate));
  if (!use) throw new Error(`${label} source ${sourceId} is not allowed for this evidence type`);
  const storagePathForPolicy = source.required_storage_zones?.[profile]?.[0] ?? 'data-static';
  assertSourceAllowed(sourceManifest, {
    sourceId,
    profile,
    use,
    storagePath: storagePathForPolicy,
  });
}

function assertCombinationEvidenceSourcesAllowed(sourceManifest, profile, combinationManifest) {
  for (const combination of combinationManifest.combinations) {
    if (!combination.allowed_profiles.includes(profile)) continue;
    for (const evidence of combination.review.evidence) {
      assertEvidenceSourceAllowed(sourceManifest, {
        sourceId: evidence.source_id,
        profile,
        allowedUses: ['product-resolution', 'identity', 'interaction-evidence'],
        label: `combination ${combination.combination_id} review evidence`,
      });
    }
    assertEvidenceSourceAllowed(sourceManifest, {
      sourceId: 'rxnorm',
      profile,
      allowedUses: ['identity'],
      label: `combination ${combination.combination_id} RxNorm evidence`,
    });
  }
}

async function loadCombinationEvidenceBundles(dir, combinationManifest) {
  const bundles = Object.create(null);
  for (const combination of combinationManifest.combinations) {
    const filename = `${combination.combination_id.replaceAll(/[^a-zA-Z0-9._-]/gu, '_')}.json`;
    bundles[combination.combination_id] = await readJson(
      path.join(dir, filename),
      `combination RxNorm evidence bundle for ${combination.combination_id}`,
    );
  }
  return bundles;
}

function assertCombinationEvidenceVerified(report) {
  if (report.verified) return;
  const detail = report.reports
    .map((entry) => (
      `${entry.combination_id}: ${entry.findings.map((finding) => finding.code).join(', ')}`
    ))
    .join('; ');
  throw new Error(`combination RxNorm evidence is unverified${detail ? `: ${detail}` : ''}`);
}

function assertRulePackProfile(runtimeProfile, rulePack) {
  if (runtimeProfile === 'production-open' && rulePack.profile !== 'production-open') {
    throw new Error('production-open cannot load an internal-evaluation rule pack');
  }
}

export async function runInteractionCheck(options) {
  const manifest = loadSourceManifest();
  const summaryPath = path.join(path.dirname(options.artifactPath), 'summary.json');
  const summary = await readJson(summaryPath, 'artifact summary');
  const summaryProvenance = artifactSummaryProvenance(summary);
  assertArtifactProvenance(manifest, {
    sourceIds: summaryProvenance.sourceIds,
    profile: options.profile,
    use: 'product-resolution',
    storagePath: storagePath(options.artifactPath),
  });

  const rulePack = await readJson(options.rulesPath, 'interaction rule pack');
  validateRulePack(rulePack);
  assertRulePackProfile(options.profile, rulePack);
  assertArtifactProvenance(manifest, {
    sourceIds: rulePack.source_ids,
    profile: rulePack.profile,
    use: 'interaction-rules',
    storagePath: storagePath(options.rulesPath),
    licenceNotices: rulePack.licence_notices ?? {},
  });
  const ingredientManifest = await readJson(
    options.ingredientMappingsPath,
    'ingredient mapping overrides',
  );
  const presentationManifest = await readJson(
    options.presentationMappingsPath,
    'product presentation overrides',
  );
  const combinationManifest = await readJson(
    options.combinationManifestPath,
    'combination identity manifest',
  );
  validateIngredientMappingManifest(ingredientManifest);
  validateProductPresentationManifest(presentationManifest);
  validateCombinationIdentityManifest(combinationManifest);
  assertMappingEvidenceSourcesAllowed(manifest, options.profile, [
    { manifest: ingredientManifest, allowedUses: ['identity'] },
    {
      manifest: presentationManifest,
      allowedUses: ['product-resolution', 'identity', 'interaction-evidence'],
    },
  ]);
  assertCombinationEvidenceSourcesAllowed(manifest, options.profile, combinationManifest);
  const combinationBundles = await loadCombinationEvidenceBundles(
    options.combinationEvidenceDir,
    combinationManifest,
  );
  const combinationVerificationReport = verifyCombinationManifestEvidence(
    combinationManifest,
    combinationBundles,
  );
  assertCombinationEvidenceVerified(combinationVerificationReport);
  const compiledCombinationManifest = compileCombinationIdentityManifest(
    combinationManifest,
    {
      kind: 'verified_manifest',
      verificationReport: combinationVerificationReport,
    },
  );

  const scan = await scanProductQueries({
    artifactPath: options.artifactPath,
    queries: options.queries,
  });
  const observedSourceIds = assertSummaryMatchesRows(summaryProvenance, scan.provenance);
  assertArtifactProvenance(manifest, {
    sourceIds: observedSourceIds,
    profile: options.profile,
    use: 'product-resolution',
    storagePath: storagePath(options.artifactPath),
  });
  const mappedRecords = mapResolvedProducts({
    records: scan.results,
    ingredientManifest,
    presentationManifest,
    combinationManifest: compiledCombinationManifest,
    profile: options.profile,
  });
  return {
    ...checkResolvedProducts({
      resolvedInputs: mappedRecords,
      rulePack,
    }),
    mapping_summary: summarizeInteractionMappings(mappedRecords),
  };
}

export async function main(args = process.argv.slice(2)) {
  const result = await runInteractionCheck(parseArgs(args));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
