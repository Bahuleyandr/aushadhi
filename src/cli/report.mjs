import fs from 'node:fs';
import path from 'node:path';
import { renderReport } from '../lib/report.mjs';
import { ctx } from '../lib/context.mjs';

// Render dist/latest/summary.json (+ conflicts.jsonl by-kind tally) to a
// human-readable REPORT.md and print it. Run after `npm run build`.
const c = ctx();
const latest = path.join(c.distRoot, 'latest');
const summary = JSON.parse(fs.readFileSync(path.join(latest, 'summary.json'), 'utf8'));

const byKind = {};
const cj = path.join(latest, 'conflicts.jsonl');
if (fs.existsSync(cj)) {
  for (const line of fs.readFileSync(cj, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { const o = JSON.parse(line); byKind[o.kind] = (byKind[o.kind] ?? 0) + 1; } catch { /* skip */ }
  }
}

const md = renderReport(summary, byKind);
fs.writeFileSync(path.join(latest, 'REPORT.md'), `${md}\n`);
console.log(md);
