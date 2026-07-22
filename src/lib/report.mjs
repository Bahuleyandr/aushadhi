// Human-readable dataset quality report from a build summary.json (+ optional
// conflict-by-kind tally). Pure + deterministic so it is unit-testable; the CLI
// wrapper (src/cli/report.mjs) reads the files and writes dist/latest/REPORT.md.
const fmt = (n) => (n === null || n === undefined ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
const pct = (n, d) => `${d ? ((100 * n) / d).toFixed(1) : '0.0'}%`;

export function renderReport(summary = {}, conflictsByKind = {}) {
  const s = summary;
  const total = s.total_rows ?? 0;
  const L = [];
  L.push(`# aushadhi dataset report — ${s.date ?? 'unknown'}`);
  L.push('');
  L.push(`- **Total brand rows:** ${fmt(total)}`);
  if (s.unique_compositions != null) L.push(`- **Unique compositions:** ${fmt(s.unique_compositions)}`);
  if (s.errors != null) L.push(`- **Build errors:** ${fmt(s.errors)}`);
  if (s.renormalized_rows != null) L.push(`- **Rows re-canonicalized this build:** ${fmt(s.renormalized_rows)}`);
  L.push('');

  const srcEntries = Object.entries(s.sources ?? {}).sort((a, b) => b[1] - a[1]);
  if (srcEntries.length) {
    L.push('## Sources', '', '| source | rows |', '|---|---:|');
    for (const [src, n] of srcEntries) L.push(`| ${src} | ${fmt(n)} |`);
    L.push('');
  }

  if (s.composition_status) {
    L.push('## Composition status', '');
    for (const [k, n] of Object.entries(s.composition_status)) L.push(`- ${k}: ${fmt(n)} (${pct(n, total)})`);
    L.push('');
  }

  if (s.confidence) {
    L.push('## Confidence — cross-source agreement on the molecule set', '', '| tier | rows | share |', '|---|---:|---:|');
    for (const tier of ['multi_source', 'single_source', 'conflict']) {
      if (s.confidence[tier] != null) L.push(`| ${tier} | ${fmt(s.confidence[tier])} | ${pct(s.confidence[tier], total)} |`);
    }
    L.push('', '> `conflict` and `single_source` rows are the review-worthy ones for clinical use.', '');
  }

  if (s.strength_verified_rows != null) {
    const sv = s.strength_verified_rows ?? 0;
    const su = s.strength_unverified_rows ?? 0;
    const sn = s.strength_no_strength_rows ?? 0;
    L.push('## Strength verification — plausibility-based trust signal', '', '| status | rows | share |', '|---|---:|---:|');
    L.push(`| verified | ${fmt(sv)} | ${pct(sv, total)} |`);
    L.push(`| unverified | ${fmt(su)} | ${pct(su, total)} |`);
    L.push(`| no_strength | ${fmt(sn)} | ${pct(sn, total)} |`);
    L.push('');
    if (s.strength_conflict_rows != null) L.push(`- \`strength_conflict\` (sources disagree on strength — review): ${fmt(s.strength_conflict_rows)}`);
    L.push('> `strength_verified` rows are safe to auto-fill; `unverified` / `strength_conflict` need pharmacist or authoritative-reference confirmation.', '');
  }

  if (s.atc_coverage_rows != null) {
    L.push('## ATC classification', '', `- Coverage: **${fmt(s.atc_coverage_rows)} rows (${pct(s.atc_coverage_rows, total)})** via ${s.atc_molecules ?? '?'} molecules`, '');
  }

  if (s.conflicts != null) {
    L.push('## Conflicts — never silently resolved', '', `- Total: ${fmt(s.conflicts)}`);
    for (const [kind, n] of Object.entries(conflictsByKind).sort((a, b) => b[1] - a[1])) L.push(`  - ${kind}: ${fmt(n)}`);
    L.push('');
  }

  if (s.likely_truncated != null) {
    L.push('## Truncation watch', '', `- Rows possibly truncated (2-slot source inside a known 3+ combo): ${fmt(s.likely_truncated)}`, '');
  }

  return L.join('\n');
}
