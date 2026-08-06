import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { resolvePublishedCohort } from './build-cohort.mjs';

const REQUIRED_COHORT_FILES = [
  'drugs.jsonl',
  'prescribable.jsonl',
  'formulation_groups.jsonl',
  'REPORT.md',
];

const fmt = (n) => (n === null || n === undefined
  ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','));

function ageMs(value, now) {
  if (value === null || value === undefined) return null;
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, now.getTime() - timestamp);
}

function fmtAge(value) {
  if (!Number.isFinite(value)) return '—';
  const seconds = Math.floor(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function countEntries(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function nestedSourceState(source, state) {
  if (source === 'onemg') return state.gapfill ?? state.onemg ?? {};
  return state[source] ?? {};
}

async function regularFileStat(file) {
  try {
    const stat = await fsp.lstat(file);
    return stat.isFile() && !stat.isSymbolicLink() ? stat : null;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function countJsonlRows(file) {
  let rows = 0;
  let hasContent = false;
  const input = fs.createReadStream(file);
  for await (const chunk of input) {
    for (let index = 0; index < chunk.length; index += 1) {
      const byte = chunk[index];
      if (byte === 10) {
        if (hasContent) rows += 1;
        hasContent = false;
      } else if (byte !== 9 && byte !== 13 && byte !== 32) {
        hasContent = true;
      }
    }
  }
  if (hasContent) rows += 1;
  return rows;
}

export async function readTailFile(file, maxBytes = 128 * 1024) {
  let handle;
  try {
    handle = await fsp.open(file, 'r');
    const stat = await handle.stat();
    const length = Math.min(stat.size, maxBytes);
    const start = stat.size - length;
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    let text = buffer.toString('utf8');
    if (start > 0) {
      const newline = text.indexOf('\n');
      text = newline === -1 ? '' : text.slice(newline + 1);
    }
    return text;
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  } finally {
    await handle?.close();
  }
}

function sourceCursor(source, state) {
  const nested = nestedSourceState(source, state);
  if (source === 'onemg') {
    const discover = state.discover ?? nested.discover;
    if (!Number.isInteger(discover?.label) || !Number.isInteger(discover?.page)) return null;
    const label = discover.label >= 0 && discover.label < 26
      ? String.fromCharCode(97 + discover.label) : discover.label;
    return `${label}:${discover.page}`;
  }
  if (source === 'apollo') {
    if (nested.saltChecks && typeof nested.saltChecks === 'object' && !Array.isArray(nested.saltChecks)) {
      return Object.keys(nested.saltChecks).length;
    }
    return Number.isInteger(nested.saltCursor) ? nested.saltCursor : null;
  }
  return Number.isInteger(nested.cursor) ? nested.cursor : null;
}

function sourceOutcomes(source, state) {
  const nested = nestedSourceState(source, state);
  const outcomes = [
    ...(Array.isArray(nested.pathOutcomes) ? nested.pathOutcomes : []),
    ...(Array.isArray(nested.products?.pathOutcomes) ? nested.products.pathOutcomes : []),
    ...(Array.isArray(nested.salts?.pathOutcomes) ? nested.salts.pathOutcomes : []),
    ...(!nested.pathOutcomes && Array.isArray(state.pathOutcomes) ? state.pathOutcomes : []),
  ];
  const outcomeCount = (status) => outcomes.filter((entry) => entry?.status === status).length;
  const quarantined = countEntries(nested.quarantine ?? state.quarantine);
  const notFound = countEntries(nested.notFound ?? nested.not_found) || outcomeCount('not_found');
  const gone = countEntries(nested.gone) || outcomeCount('gone');
  const excluded = countEntries(nested.excluded) || outcomeCount('excluded');
  const explicitTombstones = countEntries(nested.tombstones ?? state.tombstones);
  return {
    quarantined,
    notFound,
    gone,
    excluded,
    tombstones: explicitTombstones || gone + excluded,
  };
}

export async function inspectSource({ rawRoot, source, indexFile, now = new Date() }) {
  const root = path.join(rawRoot, source);
  const operatorHoldPath = path.join(root, 'operator-hold');
  let operatorHold = false;
  let operatorHoldValid = false;
  try {
    const holdStat = await fsp.lstat(operatorHoldPath);
    operatorHold = true;
    operatorHoldValid = holdStat.isFile() && !holdStat.isSymbolicLink();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  let state = {};
  let stateError = null;
  const stateFile = path.join(root, 'state.json');
  const stateStat = await regularFileStat(stateFile);
  if (stateStat) {
    try {
      state = JSON.parse(await fsp.readFile(stateFile, 'utf8'));
    } catch (error) {
      stateError = `invalid state.json: ${error.message}`;
    }
  } else {
    stateError = 'state.json missing';
  }

  const indexPath = path.join(root, indexFile);
  const indexStat = await regularFileStat(indexPath);
  const total = indexStat ? await countJsonlRows(indexPath) : null;
  let rows = 0;
  let newestProductiveMtime = null;
  let rootPresent = false;
  try {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    rootPresent = true;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const output = path.join(root, entry.name, 'normalized.jsonl');
      const stat = await regularFileStat(output);
      if (!stat) continue;
      const outputRows = await countJsonlRows(output);
      rows += outputRows;
      if (outputRows > 0 && (newestProductiveMtime === null || stat.mtimeMs > newestProductiveMtime)) {
        newestProductiveMtime = stat.mtimeMs;
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const nested = nestedSourceState(source, state);
  const indexRefresh = source === 'onemg'
    ? (state.discover ?? null) : (nested.indexRefresh ?? state.indexRefresh ?? null);
  const indexRefreshCompletedAt = indexRefresh?.completedAt ?? indexRefresh?.completed_at ?? null;
  const indexRefreshStartedAt = indexRefresh?.startedAt ?? indexRefresh?.started_at ?? null;
  const completedAtMs = Date.parse(indexRefreshCompletedAt);
  const indexFileAgeMs = ageMs(indexStat?.mtimeMs, now);
  const outcomes = stateError
    ? { quarantined: null, notFound: null, gone: null, excluded: null, tombstones: null }
    : sourceOutcomes(source, state);
  return {
    source,
    stateDate: typeof state.date === 'string' ? state.date : null,
    today: Number.isInteger(state.count) ? state.count : null,
    cursor: sourceCursor(source, state),
    total,
    rows: rootPresent ? rows : null,
    outputAgeMs: ageMs(newestProductiveMtime, now),
    indexAgeMs: Number.isFinite(completedAtMs) ? ageMs(completedAtMs, now) : indexFileAgeMs,
    indexFileAgeMs,
    stateAgeMs: ageMs(stateStat?.mtimeMs, now),
    indexRefreshCompletedAt,
    indexRefreshStartedAt,
    indexRefreshPending: countEntries(indexRefresh?.queue),
    operatorHold,
    operatorHoldValid,
    operatorHoldPath,
    ...outcomes,
    stateError,
  };
}

function yieldedRows(line) {
  const explicit = line.match(/\bdone:.*?\badded[=:]\s*(\d+)/i);
  if (explicit) return Number(explicit[1]);
  const legacy = line.match(/\bdone:\s*(\d+)\s+(?:(?:products|drugs)\s+this run|pages parsed)/i);
  if (legacy) return Number(legacy[1]);
  return /\bNO_WORK:/i.test(line) ? 0 : null;
}

export function summarizeRunLog(text = '') {
  const yields = [];
  let state = 'unknown';
  let detail = null;
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line) continue;
    const yielded = yieldedRows(line);
    if (yielded !== null) {
      yields.push(yielded);
      state = /\bNO_WORK:/i.test(line) ? 'idle' : 'complete';
      detail = line;
    }
    if (/\bHOLD:|blocked\/robots|refusing to crawl|aborting after .*consecutive (?:403|429)/i.test(line)) {
      state = 'hold';
      detail = line;
    } else if (/\b(?:daily )?cap\b.*(?:UTC reset|reset wait)/i.test(line)) {
      state = 'cap-wait';
      detail = line;
    } else if (/\b(?:ERROR:|anomaly).*(?:retry|sleep)|\bphase failure/i.test(line)) {
      state = 'error';
      detail = line;
    } else if (/\b(?:NO_WORK:|scheduled idle)/i.test(line)) {
      state = 'idle';
      detail = line;
    } else if (/\bcrawl complete\b/i.test(line)) {
      state = 'complete';
      detail = line;
    }
  }
  let zeroYieldRuns = 0;
  for (let index = yields.length - 1; index >= 0 && yields[index] === 0; index -= 1) zeroYieldRuns += 1;
  return {
    state,
    detail,
    zeroYieldRuns,
    repeatedTerminal: zeroYieldRuns >= 2,
  };
}

async function storageHealth(distRoot) {
  try {
    const stat = await fsp.statfs(distRoot);
    const freeBytes = stat.bavail * stat.bsize;
    const totalBytes = stat.blocks * stat.bsize;
    const freePercent = totalBytes > 0 ? (100 * freeBytes) / totalBytes : null;
    let status = 'ok';
    if (freeBytes < 5 * 1024 ** 3 || freePercent < 5) status = 'critical';
    else if (freeBytes < 10 * 1024 ** 3 || freePercent < 10) status = 'low';
    return { status, freeBytes, totalBytes, freePercent };
  } catch (error) {
    return { status: 'unknown', detail: error.message };
  }
}

export async function inspectBuildHealth({ distRoot, now = new Date() }) {
  const storage = await storageHealth(distRoot);
  try {
    const state = JSON.parse(await fsp.readFile(path.join(distRoot, '.build-state.json'), 'utf8'));
    const published = await resolvePublishedCohort({ distRoot, verifyFiles: true });
    const latest = published.dir;
    const manifest = published.manifest;
    if (state.schema_version !== 1) throw new Error(`unsupported build state schema ${state.schema_version}`);
    if (manifest.schema_version !== 1) throw new Error(`unsupported cohort schema ${manifest.schema_version}`);
    if (state.generation_id !== manifest.generation_id) throw new Error('build state and latest cohort generation do not match');
    if (state.date !== manifest.date) throw new Error('build state and latest cohort date do not match');
    for (const name of REQUIRED_COHORT_FILES) {
      if (!Object.hasOwn(manifest.files ?? {}, name)) throw new Error(`latest cohort is missing ${name}`);
    }
    for (const [name, expected] of Object.entries(manifest.files ?? {})) {
      if (name !== path.basename(name) || name.includes('/') || name.includes('\\')) {
        throw new Error(`latest cohort artifact name is unsafe: ${name}`);
      }
      const stat = await regularFileStat(path.join(latest, name));
      if (!stat) throw new Error(`latest cohort artifact is missing or unsafe: ${name}`);
      if (!Number.isFinite(expected?.size_bytes) || stat.size !== expected.size_bytes) {
        throw new Error(`latest cohort artifact size mismatch: ${name}`);
      }
    }
    const completedAt = Date.parse(state.completed_at);
    return {
      status: 'ok',
      generationId: state.generation_id,
      date: state.date,
      ageMs: ageMs(completedAt, now),
      reason: state.reason ?? null,
      storage,
    };
  } catch (error) {
    return { status: 'unhealthy', detail: error.message, storage };
  }
}

function fmtBytes(value) {
  if (!Number.isFinite(value)) return 'unknown';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount.toFixed(unit < 3 ? 0 : 1)}${units[unit]}`;
}

export function renderBuildHealth(build) {
  const storage = build.storage?.freePercent == null
    ? `storage=${build.storage?.status ?? 'unknown'}`
    : `storage=${build.storage.status} ${fmtBytes(build.storage.freeBytes)} free (${build.storage.freePercent.toFixed(1)}%)`;
  if (build.status !== 'ok') return `build: cohort=${build.status} detail=${build.detail ?? 'unknown'}; ${storage}`;
  return `build: cohort=ok generation=${build.generationId} date=${build.date} age=${fmtAge(build.ageMs)}`
    + `${build.reason ? ` reason=${build.reason}` : ''}; ${storage}`;
}

export function renderFleet(crawlers = []) {
  const lines = [
    '| crawler | service | today | cap | progress | rows | output age | index age | run state | terminal | quarantine | ETA |',
    '|---|---|---:|---:|---|---:|---:|---:|---|---:|---:|---:|',
  ];
  for (const crawler of crawlers) {
    const hasProgress = crawler.total != null && crawler.cursor != null
      && typeof crawler.cursor === 'number' && crawler.total > 0;
    const progress = hasProgress
      ? `${fmt(crawler.cursor)}/${fmt(crawler.total)} (${((100 * crawler.cursor) / crawler.total).toFixed(1)}%)`
      : (crawler.cursor == null ? '—' : String(crawler.cursor));
    const eta = (crawler.quarantined ?? 0) > 0
      ? 'unresolved'
      : hasProgress && crawler.cap
        ? `~${Math.max(0, Math.ceil((crawler.total - crawler.cursor) / crawler.cap))}d` : '—';
    const runState = crawler.operatorHold
      ? 'hold'
      : crawler.repeatedTerminal
      ? `zero-yield x${crawler.zeroYieldRuns}`
      : (crawler.zeroYieldRuns === 1 ? 'zero-yield' : (crawler.runState ?? '—'));
    lines.push(
      `| ${crawler.name} | ${crawler.service ?? 'unknown'} | ${fmt(crawler.today)} | ${fmt(crawler.cap)} | ${progress} `
      + `| ${fmt(crawler.rows)} | ${fmtAge(crawler.outputAgeMs)} | ${fmtAge(crawler.indexAgeMs)} | ${runState} `
      + `| ${fmt(crawler.tombstones)} | ${fmt(crawler.quarantined)} | ${eta} |`,
    );
  }
  return lines.join('\n');
}
