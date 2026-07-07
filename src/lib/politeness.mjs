import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class BlockedError extends Error {}

export function parseRobots(txt) {
  const dis = [];
  let applies = false;
  for (const line of txt.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === 'user-agent') applies = v === '*';
    else if (applies && k === 'disallow' && v) dis.push(v);
  }
  return dis;
}

export function isAllowed(disallow, p) {
  return !disallow.some((d) => new RegExp(
    '^' + d.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'),
  ).test(p));
}

export class PoliteFetcher {
  constructor(o) {
    Object.assign(this, {
      minDelayMs: 2500,
      jitterMs: 500,
      dailyCap: 5000,
      maxRetries: 3,
      consecutiveBlockLimit: 3,
      fetchImpl: globalThis.fetch,
      now: Date.now,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      ...o,
    });
    this.lastAt = 0;
    this.blocks = 0;
    this.disallow = [];
  }

  async init() {
    await fsp.mkdir(this.cacheDir, { recursive: true });
    this.state = fs.existsSync(this.stateFile) ? JSON.parse(fs.readFileSync(this.stateFile, 'utf8')) : {};
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (this.state.date !== today) this.state = { date: today, count: 0 };
    const res = await this.fetchImpl(this.baseUrl + '/robots.txt', { headers: { 'user-agent': this.userAgent } });
    if (res.ok) this.disallow = parseRobots(await res.text());
  }

  cachePath(p) {
    return path.join(this.cacheDir, crypto.createHash('sha256').update(p).digest('hex') + '.html');
  }

  cached(p) {
    const cp = this.cachePath(p);
    return fs.existsSync(cp) ? fs.readFileSync(cp, 'utf8') : null;
  }

  async get(p) {
    if (!isAllowed(this.disallow, p)) throw new Error(`robots.txt disallows ${p}`);
    const hit = this.cached(p);
    if (hit !== null) return hit;
    if (this.state.count >= this.dailyCap) throw new Error(`daily cap ${this.dailyCap} reached`);
    const wait = this.lastAt + this.minDelayMs + Math.floor(Math.random() * this.jitterMs) - this.now();
    if (wait > 0) await this.sleep(wait);
    let attempt = 0;
    while (true) {
      this.lastAt = this.now();
      const res = await this.fetchImpl(this.baseUrl + p, { headers: { 'user-agent': this.userAgent } });
      this.state.count++;
      if (res.ok) {
        this.blocks = 0;
        const body = await res.text();
        await fsp.writeFile(this.cachePath(p), body);
        await this.persist();
        return body;
      }
      if (res.status === 403 || res.status === 429) {
        this.blocks++;
        if (this.blocks >= this.consecutiveBlockLimit) {
          await this.persist();
          throw new BlockedError(`aborting after ${this.blocks} consecutive ${res.status} responses`);
        }
      }
      attempt++;
      if (attempt > this.maxRetries) {
        await this.persist();
        throw new Error(`giving up on ${p}: HTTP ${res.status}`);
      }
      await this.sleep(1000 * 2 ** attempt);
    }
  }

  async persist() {
    await fsp.writeFile(this.stateFile, JSON.stringify(this.state));
  }
}
