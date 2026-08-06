import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  inspectBuildHealth,
  inspectSource,
  readTailFile,
  renderBuildHealth,
  renderFleet,
  summarizeRunLog,
} from '../lib/fleet.mjs';
import { ctx } from '../lib/context.mjs';

const WINDOWS = process.platform === 'win32';
const context = ctx();
const rawRoot = process.env.AUSHADHI_RAW_ROOT
  ?? (WINDOWS ? path.resolve(context.rawRoot) : '/var/lib/aushadhi/data/raw');
const distRoot = process.env.AUSHADHI_DIST_ROOT
  ?? (WINDOWS ? path.resolve(context.distRoot) : '/var/lib/aushadhi/dist');
const logRoot = process.env.AUSHADHI_LOG_ROOT
  ?? (WINDOWS ? path.resolve('logs') : '/var/log/aushadhi');

const sources = [
  {
    name: '1mg', source: 'onemg', service: 'aushadhi-crawl.service', log: 'crawl.log',
    index: 'slug-index.jsonl', capEnv: 'AUSHADHI_DAILY_CAP', policyCap: 20_000, hardMax: false,
  },
  {
    name: 'apollo', source: 'apollo', service: 'aushadhi-apollo.service', log: 'apollo.log',
    index: 'salt-index.jsonl', capEnv: 'AUSHADHI_APOLLO_CAP', policyCap: 10_000, hardMax: true,
  },
  {
    name: 'pharmeasy', source: 'pharmeasy', service: 'aushadhi-pharmeasy.service', log: 'pharmeasy.log',
    index: 'product-index.jsonl', capEnv: 'AUSHADHI_PHARMEASY_CAP', policyCap: 20_000, hardMax: true,
  },
  {
    name: 'netmeds', source: 'netmeds', service: 'aushadhi-netmeds.service', log: 'netmeds.log',
    index: 'product-index.jsonl', capEnv: 'AUSHADHI_NETMEDS_CAP', policyCap: 20_000, hardMax: true,
  },
];

function queryService(service) {
  const result = spawnSync(process.env.AUSHADHI_SYSTEMCTL ?? 'systemctl', [
    'show', service, '--no-pager',
    '--property=LoadState,ActiveState,SubState,Result,NRestarts,ExecMainStatus,Environment',
  ], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) {
    return { label: 'unknown', environment: {}, detail: result.error?.message ?? result.stderr.trim() };
  }
  const properties = Object.fromEntries(result.stdout.split(/\r?\n/u).flatMap((line) => {
    const separator = line.indexOf('=');
    return separator === -1 ? [] : [[line.slice(0, separator), line.slice(separator + 1)]];
  }));
  const environment = Object.fromEntries((properties.Environment ?? '').split(/\s+/u).flatMap((entry) => {
    const separator = entry.indexOf('=');
    return separator <= 0 ? [] : [[entry.slice(0, separator), entry.slice(separator + 1)]];
  }));
  const label = properties.LoadState === 'not-found'
    ? 'not-found'
    : `${properties.ActiveState || 'unknown'}/${properties.SubState || 'unknown'}`;
  return { label, environment, properties };
}

function configuredCap(definition, service) {
  const candidates = [service.environment[definition.capEnv], process.env[definition.capEnv]];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return {
        cap: definition.hardMax ? Math.min(parsed, definition.policyCap) : parsed,
        requested: parsed,
      };
    }
  }
  return { cap: definition.policyCap, requested: definition.policyCap };
}

const rows = [];
const capWarnings = [];
for (const definition of sources) {
  const service = queryService(definition.service);
  const inspected = await inspectSource({
    rawRoot,
    source: definition.source,
    indexFile: definition.index,
  });
  const log = await readTailFile(path.join(logRoot, definition.source, definition.log));
  const run = summarizeRunLog(log);
  const cap = configuredCap(definition, service);
  if (definition.hardMax && cap.requested > definition.policyCap) {
    capWarnings.push(
      `${definition.name} requested cap ${cap.requested} exceeds hard maximum ${definition.policyCap}; runtime clamps it`,
    );
  }
  rows.push({
    name: definition.name,
    cap: cap.cap,
    service: service.label,
    ...inspected,
    runState: inspected.operatorHold
      ? 'hold'
      : inspected.stateError
      ? 'state-error'
      : (inspected.indexRefreshStartedAt && !['hold', 'error'].includes(run.state)
        ? `index-refresh (${inspected.indexRefreshPending} queued)` : run.state),
    zeroYieldRuns: run.zeroYieldRuns,
    repeatedTerminal: run.repeatedTerminal,
  });
}

const stateDates = [...new Set(rows.map((row) => row.stateDate).filter(Boolean))];
console.log(`aushadhi fleet — state dates: ${stateDates.join(', ') || 'n/a'}`);
console.log(`runtime: raw=${rawRoot} dist=${distRoot} logs=${logRoot}\n`);
console.log(renderFleet(rows));
for (const warning of capWarnings) console.log(`POLICY WARNING: ${warning}`);
console.log('');
console.log(renderBuildHealth(await inspectBuildHealth({ distRoot })));

if (rows.some((row) => row.stateError)) {
  const errors = rows.filter((row) => row.stateError).map((row) => `${row.name}: ${row.stateError}`);
  console.log(`state diagnostics: ${errors.join('; ')}`);
}

if (!fs.existsSync(rawRoot)) console.log('state diagnostics: raw runtime root is missing');
