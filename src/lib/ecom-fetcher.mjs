import fs from 'node:fs';
import path from 'node:path';
import { PoliteFetcher } from './politeness.mjs';

// Generic polite fetcher for an e-pharmacy source (apollo/pharmeasy/netmeds).
// Each source gets its own cache/state dir so their crawls are independent and
// can run concurrently (different hosts). Per-request spacing (the real
// politeness guarantee) stays fixed; the daily cap is env-tunable per source
// via AUSHADHI_<SOURCE>_CAP, falling back to AUSHADHI_DAILY_CAP.
export function makeEcomFetcher(rawRoot, source, baseUrl) {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const root = path.join(rawRoot, source);
  const capEnv = Number(process.env[`AUSHADHI_${source.toUpperCase()}_CAP`] ?? process.env.AUSHADHI_DAILY_CAP);
  return new PoliteFetcher({
    baseUrl,
    cacheDir: path.join(root, 'pages'),
    stateFile: path.join(root, 'state.json'),
    userAgent: `aushadhi-dataset-builder/${pkg.version} (contact: safari-oil-shelve@duck.com)`,
    ...(Number.isFinite(capEnv) && capEnv > 0 ? { dailyCap: capEnv } : {}),
  });
}
