import fs from 'node:fs';
import path from 'node:path';
import { PoliteFetcher } from './politeness.mjs';

// The ONE place the 1mg fetcher identity/config lives (gapfill + fixture grabs).
export function makeOnemgFetcher(rawRoot = 'data/raw') {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const onemgRoot = path.join(rawRoot, 'onemg');
  // Daily cap is env-tunable for long exhaustive backfills; per-request spacing
  // (the real politeness guarantee) stays fixed at the PoliteFetcher default.
  const capEnv = Number(process.env.AUSHADHI_DAILY_CAP);
  return new PoliteFetcher({
    baseUrl: 'https://www.1mg.com',
    cacheDir: path.join(onemgRoot, 'pages'),
    stateFile: path.join(onemgRoot, 'state.json'),
    userAgent: `aushadhi-dataset-builder/${pkg.version} (contact: safari-oil-shelve@duck.com)`,
    ...(Number.isFinite(capEnv) && capEnv > 0 ? { dailyCap: capEnv } : {}),
  });
}
