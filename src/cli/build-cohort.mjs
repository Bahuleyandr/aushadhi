import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ctx } from '../lib/context.mjs';
import {
  COHORT_INDEX,
  acquireBuildLock,
  computeInputFingerprint,
  createGenerationStage,
  hasPublishedCohort,
  newGenerationId,
  promoteCohort,
  removeGenerationStage,
  resolvePublishedCohort,
  shouldBuildCohort,
  writeCohortManifest,
} from '../lib/build-cohort.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..', '..');

function parseArgs(argv) {
  const options = { ifNeeded: false, maxAgeSeconds: 86_400, reason: 'manual' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--if-needed') options.ifNeeded = true;
    else if (arg === '--max-age-seconds') options.maxAgeSeconds = Number(argv[++index]);
    else if (arg === '--reason') options.reason = argv[++index];
    else throw new Error(`unknown build-cohort argument: ${arg}`);
  }
  if (!Number.isFinite(options.maxAgeSeconds) || options.maxAgeSeconds < 1) {
    throw new Error('--max-age-seconds must be a positive number');
  }
  if (!/^[a-zA-Z0-9._-]{1,64}$/u.test(options.reason)) throw new Error('--reason is invalid');
  return options;
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function rawInputFilter(rawRoot, file) {
  const relative = path.relative(rawRoot, file);
  const parts = relative.split(path.sep);
  const source = parts[0]?.toLowerCase();
  const base = path.basename(file).toLowerCase();
  if (['onemg', 'apollo', 'pharmeasy', 'netmeds'].includes(source)) return base === 'normalized.jsonl';
  if (source === 'github-jr') return base === 'indian_medicine_data.csv';
  if (source === 'janaushadhi') return base === 'pmbjp.txt';
  if (source === 'kaggle-2025') return base.endsWith('.csv');
  if (source === 'atc') return /\.(csv|tsv)$/u.test(base);
  if (source === 'cdsco-fdc') {
    return /\.(pdf|txt)$/u.test(base);
  }
  if (source === 'nppa') return /\.(pdf|txt)$/u.test(base);
  return false;
}

export async function buildInputFingerprint({ rawRoot, projectRoot }) {
  const roots = [
    rawRoot,
    path.join(projectRoot, 'data-static'),
    path.join(projectRoot, 'src'),
    path.join(projectRoot, 'package.json'),
    path.join(projectRoot, 'package-lock.json'),
  ];
  return computeInputFingerprint(roots, {
    include: (file) => !isWithin(rawRoot, file) || rawInputFilter(rawRoot, file),
  });
}

async function readState(file) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function pathExists(target) {
  try {
    await fsp.lstat(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function readEffectiveBuildState({ distRoot, stateFile }) {
  const indexFile = path.join(distRoot, COHORT_INDEX);
  let indexInformation;
  try {
    indexInformation = await fsp.lstat(indexFile);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    if (await pathExists(path.join(distRoot, 'latest'))) {
      throw new Error(`legacy dist/latest exists without ${COHORT_INDEX}; refusing cached build state`);
    }
    return { state: await readState(stateFile), publishedReady: false };
  }
  if (!indexInformation.isFile() || indexInformation.isSymbolicLink()) {
    throw new Error(`cohort index must be a regular file: ${indexFile}`);
  }
  const published = await resolvePublishedCohort({ distRoot, verifyFiles: true });
  if (typeof published.manifest.input_fingerprint !== 'string'
    || published.manifest.input_fingerprint.length === 0) {
    throw new Error('published cohort manifest input_fingerprint is invalid');
  }
  return {
    state: {
      schema_version: 1,
      generation_id: published.generationId,
      date: published.date,
      input_fingerprint: published.manifest.input_fingerprint,
      completed_at: published.publishedAt,
      reason: 'indexed-reconciliation',
    },
    publishedReady: true,
  };
}

async function writeJsonAtomic(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  try {
    await fsp.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await fsp.rename(temporary, file);
  } finally {
    await fsp.rm(temporary, { force: true }).catch(() => {});
  }
}

async function recordPostCommitWarning({
  distRoot,
  generationId,
  warningType,
  error,
  publication,
  authoritativeState,
}) {
  const receipt = {
    schema_version: 1,
    receipt_type: 'build-post-commit-warning',
    warning_type: warningType,
    publication_committed: true,
    generation_id: generationId,
    warning_at: new Date().toISOString(),
    index_file: publication.indexFile,
    authoritative_state: authoritativeState,
    error: error instanceof Error ? error.message : String(error),
  };
  const receiptFile = path.join(
    distRoot,
    '.receipts',
    `build-post-commit-${warningType}-${generationId}.json`,
  );
  try {
    await writeJsonAtomic(receiptFile, receipt);
    return { ...receipt, receipt_file: receiptFile, receipt_written: true };
  } catch (receiptError) {
    return {
      ...receipt,
      receipt_file: receiptFile,
      receipt_written: false,
      receipt_write_error: receiptError instanceof Error ? receiptError.message : String(receiptError),
    };
  }
}

async function runNode(relativeScript, args, env) {
  const script = path.join(PROJECT_ROOT, relativeScript);
  const nodeArgs = relativeScript.endsWith('report.mjs')
    ? [script, ...args]
    : ['--max-old-space-size=6144', script, ...args];
  const child = spawn(process.execPath, nodeArgs, {
    cwd: PROJECT_ROOT,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  const [code, signal] = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (exitCode, exitSignal) => resolve([exitCode, exitSignal]));
  });
  if (code !== 0) {
    throw new Error(`${relativeScript} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`);
  }
}

export async function main(argv = process.argv.slice(2), log = console.log) {
  const options = parseArgs(argv);
  const context = ctx();
  const rawRoot = path.resolve(PROJECT_ROOT, context.rawRoot);
  const distRoot = path.resolve(PROJECT_ROOT, process.env.AUSHADHI_DIST_ROOT ?? context.distRoot);
  const date = context.date;
  const generationId = newGenerationId();
  const stateFile = path.join(distRoot, '.build-state.json');
  const lockPath = process.env.AUSHADHI_BUILD_LOCK
    ? path.resolve(PROJECT_ROOT, process.env.AUSHADHI_BUILD_LOCK)
    : path.join(distRoot, '.build.lock');
  const releaseLock = await acquireBuildLock({ distRoot, generationId, lockPath });
  let stageDir = null;
  let committedPublication = null;
  let authoritativeState = null;
  const postCommitWarnings = [];
  try {
    const inputFingerprint = await buildInputFingerprint({ rawRoot, projectRoot: PROJECT_ROOT });
    const effectiveState = await readEffectiveBuildState({ distRoot, stateFile });
    const { state } = effectiveState;
    const inputsRequireBuild = shouldBuildCohort({
      state,
      inputFingerprint,
      maxAgeMs: options.maxAgeSeconds * 1000,
    });
    if (options.ifNeeded && !inputsRequireBuild) {
      const latestReady = effectiveState.publishedReady
        || await hasPublishedCohort({ distRoot, state });
      if (latestReady) {
        log(`build-cohort SKIP: generation=${state.generation_id} inputs unchanged and age < ${options.maxAgeSeconds}s`);
        return { skipped: true, generationId: state.generation_id };
      }
    }

    stageDir = await createGenerationStage({ distRoot, generationId });
    const childEnv = {
      ...process.env,
      AUSHADHI_COHORT_DIR: stageDir,
    };
    log(`build-cohort start: generation=${generationId} reason=${options.reason}`);
    await runNode(path.join('src', 'cli', 'build.mjs'), [], childEnv);
    await runNode(path.join('src', 'cli', 'prescribable.mjs'), [], childEnv);
    await runNode(path.join('src', 'cli', 'report.mjs'), [], childEnv);

    const finalInputFingerprint = await buildInputFingerprint({ rawRoot, projectRoot: PROJECT_ROOT });
    if (finalInputFingerprint !== inputFingerprint) {
      throw new Error('build inputs changed while the cohort was being generated; refusing promotion');
    }
    const manifest = await writeCohortManifest({
      dir: stageDir,
      date,
      generationId,
      inputFingerprint,
    });
    committedPublication = await promoteCohort({
      distRoot,
      date,
      generationId,
      stageDir,
      verifiedManifest: manifest,
    });
    stageDir = null;
    authoritativeState = {
      schema_version: 1,
      generation_id: generationId,
      date,
      input_fingerprint: inputFingerprint,
      completed_at: committedPublication.publishedAt,
      reason: options.reason,
    };
    try {
      await writeJsonAtomic(stateFile, authoritativeState);
    } catch (error) {
      const warning = await recordPostCommitWarning({
        distRoot,
        generationId,
        warningType: 'state-cache-write',
        error,
        publication: committedPublication,
        authoritativeState,
      });
      postCommitWarnings.push(warning);
      log(
        `build-cohort WARNING: publication committed but state cache write failed; `
        + `generation=${generationId} receipt=${warning.receipt_file}`,
      );
    }
    log(`build-cohort done: generation=${generationId} latest=${committedPublication.latestDir}`);
    return {
      skipped: false,
      generationId,
      ...committedPublication,
      postCommitWarnings,
    };
  } catch (error) {
    if (committedPublication !== null) {
      const warning = await recordPostCommitWarning({
        distRoot,
        generationId,
        warningType: 'post-commit',
        error,
        publication: committedPublication,
        authoritativeState,
      });
      postCommitWarnings.push(warning);
      log(
        `build-cohort WARNING: publication remains committed after post-commit failure; `
        + `generation=${generationId} receipt=${warning.receipt_file}`,
      );
      log(`build-cohort done: generation=${generationId} latest=${committedPublication.latestDir}`);
      return {
        skipped: false,
        generationId,
        ...committedPublication,
        postCommitWarnings,
      };
    }
    let stageRemoved = false;
    let stageCleanupError;
    if (stageDir !== null) {
      try {
        stageRemoved = await removeGenerationStage({ distRoot, generationId, stageDir });
      } catch (cleanupError) {
        stageCleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
    }
    const receipt = {
      schema_version: 1,
      generation_id: generationId,
      failed_at: new Date().toISOString(),
      reason: options.reason,
      stage_dir: stageDir,
      stage_removed: stageRemoved,
      ...(stageCleanupError === undefined ? {} : { stage_cleanup_error: stageCleanupError }),
      error: error instanceof Error ? error.message : String(error),
    };
    const receiptFile = path.join(distRoot, '.receipts', `build-error-${generationId}.json`);
    try { await writeJsonAtomic(receiptFile, receipt); } catch { /* preserve the original failure */ }
    throw new Error(`${receipt.error}; receipt=${receiptFile}`, { cause: error });
  } finally {
    try {
      await releaseLock();
    } catch (error) {
      if (committedPublication === null) throw error;
      const warning = await recordPostCommitWarning({
        distRoot,
        generationId,
        warningType: 'build-lock-release',
        error,
        publication: committedPublication,
        authoritativeState,
      });
      postCommitWarnings.push(warning);
      log(
        `build-cohort WARNING: publication remains committed but build lock release failed; `
        + `generation=${generationId} receipt=${warning.receipt_file}`,
      );
    }
  }
}

const invokedDirectly = process.argv[1]
  && import.meta.url.toLowerCase() === pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase();
if (invokedDirectly) {
  try {
    await main();
  } catch (error) {
    console.error(`build-cohort ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
