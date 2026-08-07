import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { TextDecoder } from 'node:util';
import { gunzipSync } from 'node:zlib';

export class BlockedError extends Error {}
export class CapReachedError extends Error {}
export class HttpStatusError extends Error {
  constructor(status, requestPath) {
    super(`giving up on ${requestPath}: HTTP ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.requestPath = requestPath;
  }
}

export class CacheCorruptionError extends Error {
  constructor(requestPath, candidates) {
    super(`no valid cache representation remains for ${requestPath}: ${candidates.join('; ')}`);
    this.name = 'CacheCorruptionError';
    this.requestPath = requestPath;
    this.candidates = candidates;
  }
}

export class StateCorruptionError extends Error {
  constructor(stateFile, details) {
    super(`crawler state is invalid and has no valid last-known-good recovery at ${stateFile}: ${details}`);
    this.name = 'StateCorruptionError';
    this.stateFile = stateFile;
  }
}

export class StateLockError extends Error {
  constructor(lockPath, owner) {
    const stale = owner?.hostname === os.hostname() && !processIsAlive(owner.pid);
    const description = owner
      ? `${stale ? 'stale ' : ''}pid ${owner.pid ?? 'unknown'} on ${owner.hostname ?? 'unknown host'} since ${owner.startedAt ?? 'unknown time'}`
      : 'an unreadable owner record';
    super(`crawler state is already locked by ${description}: ${lockPath}`);
    this.name = 'StateLockError';
    this.lockPath = lockPath;
    this.owner = owner;
    this.stale = stale;
  }
}

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const heldStateLocks = new Map();
let exitCleanupInstalled = false;

function stateBackupPath(stateFile) {
  return `${stateFile}.lkg`;
}

function stateLockPath(stateFile) {
  return `${stateFile}.crawler-state.lock`;
}

function stateLockReclaimPath(lockPath) {
  return `${lockPath}.reclaim`;
}

function readJsonFileSync(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('state root must be an object');
  }
  if (value.count !== undefined && (!Number.isSafeInteger(value.count) || value.count < 0)) {
    throw new TypeError('state count must be a non-negative safe integer');
  }
  if (value.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    throw new TypeError('state date must use YYYY-MM-DD');
  }
  if (value.lastRequestAt !== undefined
    && (typeof value.lastRequestAt !== 'string' || !Number.isFinite(Date.parse(value.lastRequestAt)))) {
    throw new TypeError('state lastRequestAt must be an ISO timestamp');
  }
  return value;
}

function parseStatePayload(payload) {
  return validateState(JSON.parse(payload));
}

function processIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function removeLockSyncIfOwned(lockPath, token) {
  try {
    const owner = readJsonFileSync(lockPath);
    if (owner.token === token) fs.unlinkSync(lockPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') return;
  }
}

function installExitCleanup() {
  if (exitCleanupInstalled) return;
  exitCleanupInstalled = true;
  process.once('exit', () => {
    for (const [lockPath, { token }] of heldStateLocks) {
      removeLockSyncIfOwned(lockPath, token);
    }
  });
}

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await fsp.open(directory, 'r');
    await handle.sync();
  } catch (error) {
    if (!['EACCES', 'EBADF', 'EINVAL', 'EISDIR', 'ENOTSUP', 'EPERM'].includes(error?.code)) throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function atomicWrite(file, payload, validate) {
  const directory = path.dirname(file);
  await fsp.mkdir(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(file)}.tmp-${process.pid}-${crypto.randomUUID()}`,
  );
  let handle;
  try {
    handle = await fsp.open(temporary, 'wx', 0o600);
    await handle.writeFile(payload);
    await handle.sync();
    await handle.close();
    handle = null;
    if (validate) await validate(temporary);
    await fsp.rename(temporary, file);
    await syncDirectory(directory);
  } finally {
    await handle?.close().catch(() => {});
    await fsp.unlink(temporary).catch(() => {});
  }
}

async function publishExclusiveFile(file, payload) {
  const directory = path.dirname(file);
  await fsp.mkdir(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(file)}.owner-${process.pid}-${crypto.randomUUID()}`,
  );
  let handle;
  let linked = false;
  try {
    handle = await fsp.open(temporary, 'wx', 0o600);
    await handle.writeFile(payload);
    await handle.sync();
    await handle.close();
    handle = null;
    await fsp.link(temporary, file);
    linked = true;
    await syncDirectory(directory);
  } catch (error) {
    if (linked) await fsp.unlink(file).catch(() => {});
    throw error;
  } finally {
    await handle?.close().catch(() => {});
    await fsp.unlink(temporary).catch(() => {});
  }
}

async function reclaimDeadLocalStateLock(lockPath, expectedOwner) {
  if (!expectedOwner || expectedOwner.hostname !== os.hostname()
    || processIsAlive(expectedOwner.pid) || typeof expectedOwner.token !== 'string'
    || !expectedOwner.token) return false;

  const reclaimPath = stateLockReclaimPath(lockPath);
  try {
    await fsp.mkdir(reclaimPath);
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    throw error;
  }

  try {
    let currentOwner;
    try {
      currentOwner = readJsonFileSync(lockPath);
    } catch (error) {
      if (error?.code === 'ENOENT') return true;
      return false;
    }
    if (currentOwner?.hostname !== expectedOwner.hostname
      || currentOwner?.pid !== expectedOwner.pid
      || currentOwner?.token !== expectedOwner.token
      || processIsAlive(currentOwner.pid)) return false;
    await fsp.unlink(lockPath);
    await syncDirectory(path.dirname(lockPath));
    return true;
  } finally {
    await fsp.rmdir(reclaimPath).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
}

async function validateStateFile(file) {
  parseStatePayload(await fsp.readFile(file, 'utf8'));
}

function decodeCacheBytes(bytes) {
  if (bytes.length === 0) throw new TypeError('cache entry is empty');
  return utf8Decoder.decode(bytes);
}

async function writeCacheRecord(file, body) {
  if (typeof body !== 'string') throw new TypeError('cache body must be a string');
  const bytes = Buffer.from(body, 'utf8');
  if (bytes.length === 0) throw new TypeError('cache body must not be empty');
  await atomicWrite(file, bytes, async (temporary) => {
    decodeCacheBytes(await fsp.readFile(temporary));
  });
}

function readCacheRecord(file, { compressed = false } = {}) {
  const stored = fs.readFileSync(file);
  const bytes = compressed ? gunzipSync(stored) : stored;
  return decodeCacheBytes(bytes);
}

function transientTransportError(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return true;
  return [
    'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETDOWN', 'ENETUNREACH',
    'ENOTFOUND', 'EPIPE', 'ETIMEDOUT',
  ].includes(error?.code ?? error?.cause?.code);
}

function transientHttpStatus(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function retryAfterMs(response, now) {
  const value = response?.headers?.get?.('retry-after');
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : null;
}

// Uses an explicit ref'd timer instead of AbortSignal.timeout(): the latter's
// internal timer is unref'd on some Node lines (observed on 22.x), so when the
// in-flight request is the only pending work the event loop drains before the
// deadline can fire and the returned promise never settles.
async function withDeadline(timeoutMs, operation) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      const reason = new DOMException(
        `operation timed out after ${timeoutMs}ms`,
        'TimeoutError',
      );
      controller.abort(reason);
      reject(reason);
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export function parseRobots(txt) {
  const dis = [];
  let applies = false;
  let inUaGroup = false;
  for (const line of txt.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === 'user-agent') {
      // consecutive User-agent lines form one group; any '*' in the group applies
      applies = inUaGroup ? (applies || v === '*') : v === '*';
      inUaGroup = true;
    } else {
      inUaGroup = false;
      if (applies && k === 'disallow' && v) dis.push(v);
    }
  }
  return dis;
}

export function isAllowed(disallow, p) {
  return !disallow.some((d) => new RegExp(
    `^${d.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}`,
  ).test(p));
}

export class PoliteFetcher {
  constructor(o) {
    Object.assign(this, {
      minDelayMs: 2500,
      jitterMs: 500,
      dailyCap: 5000,
      maxRetries: 3,
      retryBaseMs: 1000,
      maxRetryDelayMs: 60_000,
      requestTimeoutMs: 30_000,
      consecutiveBlockLimit: 3,
      fetchImpl: globalThis.fetch,
      now: Date.now,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      ...o,
    });
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new TypeError('requestTimeoutMs must be a positive finite number');
    }
    for (const name of ['minDelayMs', 'jitterMs', 'retryBaseMs', 'maxRetryDelayMs']) {
      if (!Number.isFinite(this[name]) || this[name] < 0) {
        throw new TypeError(`${name} must be a non-negative finite number`);
      }
    }
    for (const name of ['dailyCap', 'maxRetries']) {
      if (!Number.isSafeInteger(this[name]) || this[name] < 0) {
        throw new TypeError(`${name} must be a non-negative safe integer`);
      }
    }
    if (!Number.isSafeInteger(this.consecutiveBlockLimit) || this.consecutiveBlockLimit < 1) {
      throw new TypeError('consecutiveBlockLimit must be a positive safe integer');
    }
    this.lastAt = 0;
    this.blocks = 0;
    this.disallow = [];
    this.persistChain = Promise.resolve();
    this.requestChain = Promise.resolve();
    this.lockToken = null;
  }

  async acquireStateLock() {
    if (this.lockToken) return;
    const lockPath = stateLockPath(this.stateFile);
    const token = crypto.randomUUID();
    const owner = {
      pid: process.pid,
      hostname: os.hostname(),
      startedAt: new Date().toISOString(),
      stateFile: path.resolve(this.stateFile),
      token,
    };
    while (true) {
      try {
        await publishExclusiveFile(lockPath, `${JSON.stringify(owner)}\n`);
        break;
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        let existingOwner = null;
        try { existingOwner = readJsonFileSync(lockPath); } catch { /* diagnostic below */ }
        if (await reclaimDeadLocalStateLock(lockPath, existingOwner)) continue;
        throw new StateLockError(lockPath, existingOwner);
      }
    }
    this.lockToken = token;
    heldStateLocks.set(lockPath, { token });
    installExitCleanup();
  }

  async releaseStateLock() {
    if (!this.lockToken) return;
    const lockPath = stateLockPath(this.stateFile);
    const token = this.lockToken;
    let owner;
    try {
      owner = readJsonFileSync(lockPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      this.lockToken = null;
      heldStateLocks.delete(lockPath);
      return;
    }
    if (owner?.token !== token) {
      this.lockToken = null;
      heldStateLocks.delete(lockPath);
      return;
    }
    await fsp.unlink(lockPath);
    await syncDirectory(path.dirname(lockPath));
    this.lockToken = null;
    heldStateLocks.delete(lockPath);
  }

  async close() {
    try {
      await this.requestChain;
      await this.persistChain;
    } finally {
      await this.releaseStateLock();
    }
  }

  async loadState() {
    const backupFile = stateBackupPath(this.stateFile);
    const failures = [];
    for (const candidate of [this.stateFile, backupFile]) {
      try {
        const payload = await fsp.readFile(candidate, 'utf8');
        const state = parseStatePayload(payload);
        if (candidate === backupFile) {
          await atomicWrite(this.stateFile, `${JSON.stringify(state)}\n`, validateStateFile);
        }
        return state;
      } catch (error) {
        if (error?.code !== 'ENOENT') failures.push(`${path.basename(candidate)}: ${error.message}`);
      }
    }
    if (failures.length > 0) throw new StateCorruptionError(this.stateFile, failures.join('; '));
    return {};
  }

  async request(url, readBody) {
    return withDeadline(this.requestTimeoutMs, async (signal) => {
      const response = await this.fetchImpl(url, {
        headers: { 'user-agent': this.userAgent },
        signal,
      });
      const body = readBody && response.ok ? await response.text() : null;
      return { response, body };
    });
  }

  async init() {
    await fsp.mkdir(this.cacheDir, { recursive: true });
    await this.acquireStateLock();
    try {
      this.state = await this.loadState();
      const today = new Date(this.now()).toISOString().slice(0, 10);
      // day rollover resets ONLY the daily counter — cursors etc. must survive
      if (this.state.date !== today) this.state = { ...this.state, date: today, count: 0 };
      else this.state.count ??= 0;
      let result;
      try {
        result = await this.dispatchRequest(`${this.baseUrl}/robots.txt`, true);
      } catch (error) {
        if (error instanceof CapReachedError) throw error;
        throw new Error(`robots.txt fetch failed (${error.name ?? 'transport error'}) — refusing to crawl without it`, { cause: error });
      }
      if (!result.response.ok) {
        throw new Error(`robots.txt fetch failed (${result.response.status}) — refusing to crawl without it`);
      }
      this.disallow = parseRobots(result.body);
    } catch (error) {
      await this.releaseStateLock();
      throw error;
    }
  }

  cachePath(p) {
    return path.join(this.cacheDir, `${crypto.createHash('sha256').update(p).digest('hex')}.html`);
  }

  cached(p) {
    const primary = this.cachePath(p);
    if (fs.existsSync(`${primary}.invalid`)) return null;
    const archive = `${primary}.gz`;
    const candidates = [
      { file: primary, options: {} },
      { file: archive, options: { compressed: true } },
    ];
    const failures = [];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate.file)) continue;
      try {
        return readCacheRecord(candidate.file, candidate.options);
      } catch (error) {
        if (error?.code === 'ENOENT') continue;
        failures.push(`${path.basename(candidate.file)}: ${error.message}`);
      }
    }
    if (failures.length > 0) throw new CacheCorruptionError(p, failures);
    return null;
  }

  async writeCacheAtomically(p, body) {
    const primary = this.cachePath(p);
    await writeCacheRecord(primary, body);
    await fsp.unlink(`${primary}.gz`).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
    await fsp.unlink(`${primary}.invalid`).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
    await syncDirectory(path.dirname(primary));
  }

  async invalidate(p) {
    // Parser rejection must remove both forms; deleting only cachePath(p) can
    // otherwise expose an archived copy on the next run.
    const primary = this.cachePath(p);
    await atomicWrite(`${primary}.invalid`, `${new Date(this.now()).toISOString()}\n`, async (temporary) => {
      if (!(await fsp.readFile(temporary, 'utf8')).trim()) throw new TypeError('invalid cache marker');
    });
    const files = [primary, `${primary}.gz`];
    await Promise.all(files.map((file) => fsp.unlink(file).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    })));
    await syncDirectory(path.dirname(primary));
  }

  async waitForSlot() {
    const persistedLastAt = Date.parse(this.state?.lastRequestAt);
    const lastAt = Math.max(this.lastAt, Number.isFinite(persistedLastAt) ? persistedLastAt : 0);
    const wait = lastAt + this.minDelayMs + Math.floor(Math.random() * this.jitterMs) - this.now();
    if (wait > 0) await this.sleep(wait);
  }

  async dispatchRequest(url, readBody) {
    if (this.state.count >= this.dailyCap) {
      await this.persist();
      throw new CapReachedError(`daily cap ${this.dailyCap} reached`);
    }
    await this.waitForSlot();
    const dispatchedAt = this.now();
    this.lastAt = dispatchedAt;
    this.state.lastRequestAt = new Date(dispatchedAt).toISOString();
    this.state.count++;
    await this.persist();
    return this.request(url, readBody);
  }

  retryDelay(response, retryNumber) {
    const headerDelay = retryAfterMs(response, this.now());
    const requested = headerDelay ?? this.retryBaseMs * 2 ** retryNumber;
    return Math.min(this.maxRetryDelayMs, Math.max(0, requested));
  }

  async get(p, options = {}) {
    const operation = () => this.getSerial(p, options);
    const result = this.requestChain.then(operation, operation);
    this.requestChain = result.catch(() => {});
    return result;
  }

  async getWithMetadata(p, options = {}) {
    if (options.fresh === false) {
      throw new TypeError('response metadata cannot be served from an unbound page cache');
    }
    return this.get(p, { ...options, fresh: true, includeResponseMetadata: true });
  }

  async getSerial(p, { fresh = false, includeResponseMetadata = false } = {}) {
    if (includeResponseMetadata && !fresh) {
      throw new TypeError('response metadata requires a fresh network response');
    }
    if (!isAllowed(this.disallow, p)) throw new Error(`robots.txt disallows ${p}`);
    if (!fresh) {
      const hit = this.cached(p);
      if (hit !== null) return hit;
    }
    let attempt = 0;
    while (true) {
      let result;
      try {
        result = await this.dispatchRequest(`${this.baseUrl}${p}`, true);
      } catch (error) {
        if (!transientTransportError(error) || attempt >= this.maxRetries) throw error;
        attempt++;
        await this.sleep(this.retryDelay(null, attempt));
        continue;
      }

      const { response, body } = result;
      if (response.ok) {
        this.blocks = 0;
        await this.writeCacheAtomically(p, body);
        return includeResponseMetadata
          ? { body, responseUrl: typeof response.url === 'string' ? response.url : null }
          : body;
      }

      if (response.status === 403 || response.status === 429) {
        this.blocks++;
        if (this.blocks >= this.consecutiveBlockLimit) {
          throw new BlockedError(`aborting after ${this.blocks} consecutive ${response.status} responses`);
        }
      } else {
        this.blocks = 0;
      }

      if (!transientHttpStatus(response.status) || attempt >= this.maxRetries) {
        throw new HttpStatusError(response.status, p);
      }
      const serverDelay = retryAfterMs(response, this.now());
      if (response.status === 429 && serverDelay !== null && serverDelay > this.maxRetryDelayMs) {
        throw new HttpStatusError(response.status, p);
      }
      attempt++;
      await this.sleep(this.retryDelay(response, attempt));
    }
  }

  async persist() {
    const state = validateState(this.state);
    const payload = `${JSON.stringify(state)}\n`;
    parseStatePayload(payload);
    const operation = async () => {
      await this.acquireStateLock();
      await atomicWrite(this.stateFile, payload, validateStateFile);
      await atomicWrite(stateBackupPath(this.stateFile), payload, validateStateFile);
    };
    this.persistChain = this.persistChain.then(operation, operation);
    return this.persistChain;
  }
}
