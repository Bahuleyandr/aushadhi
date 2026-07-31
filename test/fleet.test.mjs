import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFleet } from '../src/lib/fleet.mjs';

test('renderFleet: progress %, thousands, and ETA from remaining/cap', () => {
  const md = renderFleet([
    { name: 'netmeds', today: 574, cap: 20000, cursor: 574, total: 230784, rows: 974 },
    { name: 'pharmeasy', today: 3956, cap: 20000, cursor: 3956, total: 179623, rows: 4082 },
  ]);
  assert.match(md, /netmeds/);
  assert.match(md, /230,784/);
  assert.match(md, /0\.2%/);          // 574/230784
  assert.match(md, /~12d/);           // ceil((230784-574)/20000)=12
  assert.match(md, /~9d/);            // ceil((179623-3956)/20000)=9
});

test('renderFleet: missing total/cursor -> no % or ETA, still lists the crawler', () => {
  const md = renderFleet([{ name: '1mg', today: 2935, cap: 20000, cursor: null, total: null, rows: 145793 }]);
  assert.match(md, /1mg/);
  assert.match(md, /145,793/);
  assert.doesNotMatch(md, /NaN/);
});

test('renderFleet: unresolved quarantine remains visible at 100% cursor progress', () => {
  const md = renderFleet([{
    name: 'apollo',
    today: 56,
    cap: 10000,
    cursor: 3931,
    total: 3931,
    rows: 14835,
    quarantined: 1,
    tombstones: 0,
  }]);
  assert.match(md, /100\.0%/);
  assert.match(md, /quarantine/i);
  assert.match(md, /\|\s*1\s*\|/);
});
