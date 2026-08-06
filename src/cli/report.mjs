import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { renderReport } from '../lib/report.mjs';
import { ctx } from '../lib/context.mjs';
import { resolvePublishedCohort } from '../lib/build-cohort.mjs';

// Render a staged or atomically published cohort summary (+ conflicts by-kind)
// to a human-readable REPORT.md and print it. Run after `npm run build`.
export async function main(log = console.log, options = {}) {
  const c = ctx();
  const selectedOutput = options.outputDir ?? process.env.AUSHADHI_COHORT_DIR;
  const outputDir = selectedOutput
    ? path.resolve(selectedOutput)
    : (await resolvePublishedCohort({
      distRoot: path.resolve(c.distRoot),
      verifyFiles: ['REPORT.md'],
    })).dir;
  const manifestFile = path.join(outputDir, 'cohort-manifest.json');
  if (fs.existsSync(manifestFile)) {
    const report = fs.readFileSync(path.join(outputDir, 'REPORT.md'), 'utf8').trimEnd();
    log(report);
    return report;
  }
  const summary = JSON.parse(fs.readFileSync(path.join(outputDir, 'summary.json'), 'utf8'));

  const byKind = {};
  const conflicts = path.join(outputDir, 'conflicts.jsonl');
  if (fs.existsSync(conflicts)) {
    const lines = readline.createInterface({
      input: fs.createReadStream(conflicts, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      if (!line.trim()) continue;
      try { const value = JSON.parse(line); byKind[value.kind] = (byKind[value.kind] ?? 0) + 1; } catch { /* skip */ }
    }
  }

  const md = renderReport(summary, byKind);
  fs.writeFileSync(path.join(outputDir, 'REPORT.md'), `${md}\n`);
  log(md);
  return md;
}

const invokedDirectly = process.argv[1]
  && import.meta.url.toLowerCase() === pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase();
if (invokedDirectly) await main();
