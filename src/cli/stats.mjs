import fs from 'node:fs';

const s = JSON.parse(fs.readFileSync('dist/latest/summary.json', 'utf8'));
console.table({
  date: s.date,
  rows: s.total_rows,
  compositions: s.unique_compositions,
  ...s.composition_status,
  conflicts: s.conflicts,
  errors: s.errors,
});
