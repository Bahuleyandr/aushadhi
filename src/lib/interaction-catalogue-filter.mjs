import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readStrictJsonl } from './ingredient-index.mjs';
import {
  assertArtifactProvenance,
  assertSourceAllowed,
  loadSourceManifest,
} from './interaction-source-policy.mjs';

export const INTERACTION_CATALOGUE_FILTER_SCHEMA_VERSION = 1;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedCountObject(counts) {
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => compareCodePoint(left, right)),
  );
}

function addCounts(counts, values) {
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
}

function sourceIdsForRow(row, lineNumber) {
  if (!Array.isArray(row?.sources) || row.sources.length === 0) {
    throw new TypeError(`product record at line ${lineNumber} requires source provenance`);
  }
  const sourceIds = [];
  for (const source of row.sources) {
    const sourceId = source?.source_policy_id ?? source?.source;
    if (typeof sourceId !== 'string' || sourceId.trim() !== sourceId || sourceId === '') {
      throw new TypeError(`invalid source provenance at line ${lineNumber}`);
    }
    sourceIds.push(sourceId);
  }
  return [...new Set(sourceIds)].sort(compareCodePoint);
}

function validateSummary(summary) {
  if (!isObject(summary)) throw new Error('artifact summary must be an object');
  if (!Number.isSafeInteger(summary.total_rows) || summary.total_rows < 0) {
    throw new Error('artifact summary total_rows must be a non-negative integer');
  }
  if (!isObject(summary.sources)) throw new Error('artifact summary requires source provenance');
  const sourceCounts = {};
  for (const [sourceId, count] of Object.entries(summary.sources)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(
        `artifact summary source count for ${sourceId} must be a non-negative integer`,
      );
    }
    if (count > 0) sourceCounts[sourceId] = count;
  }
  if (Object.keys(sourceCounts).length === 0) {
    throw new Error('artifact summary has no non-empty sources');
  }
  return { rowCount: summary.total_rows, sourceCounts };
}

function assertSummaryMatchesRows(summary, rowCount, sourceCounts) {
  if (summary.rowCount !== rowCount) {
    throw new Error(
      `artifact row count does not match summary total_rows: expected ${summary.rowCount}, observed ${rowCount}`,
    );
  }
  for (const [sourceId, count] of sourceCounts) {
    if (summary.sourceCounts[sourceId] === undefined) {
      throw new Error(`artifact row provenance source ${sourceId} is absent from summary`);
    }
    if (count > summary.sourceCounts[sourceId]) {
      throw new Error(`artifact row provenance count for ${sourceId} exceeds summary count`);
    }
  }
  for (const sourceId of Object.keys(summary.sourceCounts)) {
    if (!sourceCounts.has(sourceId)) {
      throw new Error(`artifact summary source ${sourceId} is absent from row provenance`);
    }
  }
}

async function readJson(file, label) {
  let text;
  try {
    text = await fsp.readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${label} at ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid ${label} JSON at ${file}: ${error.message}`);
  }
}

async function sha256File(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(file);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('error', reject);
    input.on('end', resolve);
  });
  return hash.digest('hex');
}

async function temporaryPath(file) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  return path.join(
    path.dirname(file),
    `.${path.basename(file)}.tmp-${process.pid}-${randomUUID()}`,
  );
}

async function replaceStagedFiles(staged) {
  const backups = [];
  try {
    for (const { temporary, destination } of staged) {
      let backup = null;
      try {
        await fsp.access(destination);
        backup = `${destination}.bak-${process.pid}-${randomUUID()}`;
        await fsp.rename(destination, backup);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      backups.push({ destination, backup });
      await fsp.rename(temporary, destination);
    }
  } catch (error) {
    for (const { destination, backup } of backups.reverse()) {
      await fsp.rm(destination, { force: true }).catch(() => {});
      if (backup) await fsp.rename(backup, destination).catch(() => {});
    }
    throw error;
  } finally {
    await Promise.all([
      ...staged.map(({ temporary }) => fsp.rm(temporary, { force: true }).catch(() => {})),
      ...backups
        .filter(({ backup }) => backup)
        .map(({ backup }) => fsp.rm(backup, { force: true }).catch(() => {})),
    ]);
  }
}

export async function buildInteractionCatalogueFromFiles({
  profile,
  artifactPath,
  artifactStoragePath,
  artifactSummaryPath,
  artifactSummaryStoragePath = artifactSummaryPath,
  outputPath,
  outputStoragePath,
  outputSummaryPath,
  outputSummaryStoragePath = outputSummaryPath,
  sourceManifestPath,
}) {
  if (!['production-open', 'internal-evaluation'].includes(profile)) {
    throw new TypeError('profile must be production-open or internal-evaluation');
  }
  const requiredPaths = {
    artifactPath,
    artifactStoragePath,
    artifactSummaryPath,
    outputPath,
    outputStoragePath,
    outputSummaryPath,
  };
  for (const [label, value] of Object.entries(requiredPaths)) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new TypeError(`${label} is required`);
    }
  }
  if (new Set([
    path.resolve(artifactPath),
    path.resolve(artifactSummaryPath),
    path.resolve(outputPath),
    path.resolve(outputSummaryPath),
  ]).size !== 4) {
    throw new TypeError('input and output paths must all be distinct');
  }

  const [rawSummary, inputArtifactSha256, inputSummarySha256] = await Promise.all([
    readJson(artifactSummaryPath, 'artifact summary'),
    sha256File(artifactPath),
    sha256File(artifactSummaryPath),
  ]);
  const declaredSummary = validateSummary(rawSummary);
  const manifest = loadSourceManifest(sourceManifestPath);
  const outputTemporary = await temporaryPath(outputPath);
  const outputHandle = await fsp.open(outputTemporary, 'wx');
  const outputHash = createHash('sha256');
  const observedSourceCounts = new Map();
  const retainedSourceCounts = new Map();
  const excludedSourceCounts = new Map();
  const excludedReasons = new Map();
  const sourceDecisions = new Map();
  let inputRowCount = 0;
  let retainedRowCount = 0;
  let excludedRowCount = 0;

  try {
    for await (const row of readStrictJsonl(artifactPath)) {
      inputRowCount += 1;
      const sourceIds = sourceIdsForRow(row, inputRowCount);
      addCounts(observedSourceCounts, sourceIds);
      const rejectionReasons = [];
      for (const sourceId of sourceIds) {
        if (!sourceDecisions.has(sourceId)) {
          let rejection = null;
          try {
            assertSourceAllowed(manifest, {
              sourceId,
              profile,
              use: 'product-resolution',
              storagePath: artifactStoragePath,
            });
            assertSourceAllowed(manifest, {
              sourceId,
              profile,
              use: 'product-resolution',
              storagePath: path.posix.dirname(outputStoragePath),
            });
          } catch (error) {
            rejection = error.message;
          }
          sourceDecisions.set(sourceId, rejection);
        }
        const rejection = sourceDecisions.get(sourceId);
        if (rejection !== null) {
          rejectionReasons.push({ sourceId, message: rejection });
        }
      }
      if (rejectionReasons.length > 0) {
        excludedRowCount += 1;
        addCounts(excludedSourceCounts, rejectionReasons.map(({ sourceId }) => sourceId));
        for (const { sourceId, message } of rejectionReasons) {
          if (!excludedReasons.has(sourceId)) excludedReasons.set(sourceId, message);
        }
        continue;
      }
      const line = `${JSON.stringify(row)}\n`;
      await outputHandle.write(line, null, 'utf8');
      outputHash.update(line, 'utf8');
      retainedRowCount += 1;
      addCounts(retainedSourceCounts, sourceIds);
    }
    await outputHandle.sync();
    await outputHandle.close();
    assertSummaryMatchesRows(declaredSummary, inputRowCount, observedSourceCounts);
    if (retainedRowCount === 0) {
      throw new Error('source-policy filtering retained no product rows');
    }

    const retainedSourceIds = [...retainedSourceCounts.keys()].sort(compareCodePoint);
    const outputPolicy = assertArtifactProvenance(manifest, {
      sourceIds: retainedSourceIds,
      profile,
      use: 'product-resolution',
      storagePath: path.posix.dirname(outputStoragePath),
    });
    const summary = {
      schema_version: INTERACTION_CATALOGUE_FILTER_SCHEMA_VERSION,
      profile,
      total_rows: retainedRowCount,
      sources: sortedCountObject(retainedSourceCounts),
      input: {
        artifact_storage_path: artifactStoragePath,
        artifact_sha256: inputArtifactSha256,
        summary_storage_path: artifactSummaryStoragePath,
        summary_sha256: inputSummarySha256,
        row_count: inputRowCount,
        source_counts: sortedCountObject(observedSourceCounts),
      },
      output: {
        artifact_storage_path: outputStoragePath,
        artifact_sha256: outputHash.digest('hex'),
        summary_storage_path: outputSummaryStoragePath,
      },
      source_policy: outputPolicy,
      exclusions: {
        row_count: excludedRowCount,
        source_counts: sortedCountObject(excludedSourceCounts),
        reasons: Object.fromEntries(
          [...excludedReasons.entries()].sort(([left], [right]) => (
            compareCodePoint(left, right)
          )),
        ),
      },
    };
    const summaryTemporary = await temporaryPath(outputSummaryPath);
    await fsp.writeFile(summaryTemporary, `${JSON.stringify(summary, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await replaceStagedFiles([
      { temporary: outputTemporary, destination: outputPath },
      { temporary: summaryTemporary, destination: outputSummaryPath },
    ]);
    return { summary, output_path: outputPath, summary_output_path: outputSummaryPath };
  } catch (error) {
    await outputHandle.close().catch(() => {});
    await fsp.rm(outputTemporary, { force: true }).catch(() => {});
    throw error;
  }
}
