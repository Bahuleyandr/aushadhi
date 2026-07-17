// Render a one-glance progress table for the crawler fleet. Pure so it is
// unit-testable; the CLI wrapper (src/cli/fleet-status.mjs) reads each crawler's
// state.json + product index on DD and feeds the rows in. ETA is remaining/cap
// in whole days — a rough indicator, not a contract (per-request 2.5s spacing
// and daily caps are the real bounds).
const fmt = (n) => (n === null || n === undefined ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','));

export function renderFleet(crawlers = []) {
  const L = ['| crawler | today | cap | progress | rows | ETA |', '|---|---:|---:|---|---:|---:|'];
  for (const c of crawlers) {
    const hasProg = c.total != null && c.cursor != null && c.total > 0;
    const progress = hasProg ? `${fmt(c.cursor)}/${fmt(c.total)} (${((100 * c.cursor) / c.total).toFixed(1)}%)` : '—';
    const eta = hasProg && c.cap ? `~${Math.ceil((c.total - c.cursor) / c.cap)}d` : '—';
    L.push(`| ${c.name} | ${fmt(c.today)} | ${fmt(c.cap)} | ${progress} | ${fmt(c.rows)} | ${eta} |`);
  }
  return L.join('\n');
}
