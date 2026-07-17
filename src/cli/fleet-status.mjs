import fs from 'node:fs';
import path from 'node:path';
import { renderFleet } from '../lib/fleet.mjs';
import { ctx } from '../lib/context.mjs';

// One-glance progress of the crawler fleet, read from each crawler's on-disk
// state. Liveness (crashed/blocked) is healthcheck.sh's job — this is the
// "how far along is each?" view. Run on DD: `npm run fleet`.
const c = ctx();
const raw = c.rawRoot;

const readState = (src) => {
  try { return JSON.parse(fs.readFileSync(path.join(raw, src, 'state.json'), 'utf8')); } catch { return {}; }
};
const wcl = (f) => { try { return fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).length; } catch { return null; } };
const indexSize = (src) => wcl(path.join(raw, src, 'product-index.jsonl'));
const rowsWritten = (src) => {
  const root = path.join(raw, src);
  if (!fs.existsSync(root)) return null;
  let n = 0;
  for (const d of fs.readdirSync(root)) { const k = wcl(path.join(root, d, 'normalized.jsonl')); if (k) n += k; }
  return n || null;
};
const cap = (envName, def) => Number(process.env[envName] ?? def);

const onemg = readState('onemg');
const apollo = readState('apollo');
const pharmeasy = readState('pharmeasy');
const netmeds = readState('netmeds');

const crawlers = [
  { name: '1mg', today: onemg.count ?? null, cap: cap('AUSHADHI_DAILY_CAP', 20000), cursor: null, total: null, rows: rowsWritten('onemg') },
  { name: 'apollo', today: apollo.count ?? null, cap: cap('AUSHADHI_APOLLO_CAP', 10000), cursor: apollo.apollo?.saltCursor ?? null, total: 3930, rows: rowsWritten('apollo') },
  { name: 'pharmeasy', today: pharmeasy.count ?? null, cap: cap('AUSHADHI_PHARMEASY_CAP', 20000), cursor: pharmeasy.pharmeasy?.cursor ?? null, total: indexSize('pharmeasy'), rows: rowsWritten('pharmeasy') },
  { name: 'netmeds', today: netmeds.count ?? null, cap: cap('AUSHADHI_NETMEDS_CAP', 20000), cursor: netmeds.netmeds?.cursor ?? null, total: indexSize('netmeds'), rows: rowsWritten('netmeds') },
];

const dates = [onemg, apollo, pharmeasy, netmeds].map((s) => s.date).filter(Boolean);
console.log(`aushadhi fleet — state dates: ${[...new Set(dates)].join(', ') || 'n/a'}  (1mg total is exhaustive; apollo progress is salt-cursor)\n`);
console.log(renderFleet(crawlers));
