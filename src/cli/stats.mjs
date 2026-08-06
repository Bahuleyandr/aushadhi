import fs from 'node:fs';
import path from 'node:path';
import { ctx } from '../lib/context.mjs';
import { resolvePublishedCohort } from '../lib/build-cohort.mjs';

const published = await resolvePublishedCohort({
  distRoot: path.resolve(ctx().distRoot),
  verifyFiles: ['summary.json'],
});
const s = JSON.parse(fs.readFileSync(path.join(published.dir, 'summary.json'), 'utf8'));
console.table({
  date: s.date,
  rows: s.total_rows,
  compositions: s.unique_compositions,
  ...s.composition_status,
  conflicts: s.conflicts,
  errors: s.errors,
});
