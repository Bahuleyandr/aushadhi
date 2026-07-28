import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = join(dirname(fileURLToPath(import.meta.url)), '..');
const verifiedAt = '2026-07-28';
const expected = new Map([
  [
    'C/dextromethorphan__ssri_snri/fda-label-auvelity-serotonergic-current',
    'a517f95ace4958a4f87bb18f225318743ec589f729069f42036459f1dfcdae09',
  ],
  [
    'C/opioid__gabapentinoid/fda-label-gabapentin-opioid-respiratory-depression',
    '157540f5a0b51e7361d8ca530b0c07a706c72bd4dbc6c7e65bdd4de06597d77f',
  ],
  [
    'F/cotrimoxazole__ace_inhibitor/fda-label-bactrim-ace-inhibitor',
    'f9757c9b56b5e32938b0c9976f669d8539247d0230b471e348d1aa998f583d18',
  ],
  [
    'F/cotrimoxazole__other_potassium_raising_agent/fda-label-bactrim-potassium-raising-drugs',
    'f9757c9b56b5e32938b0c9976f669d8539247d0230b471e348d1aa998f583d18',
  ],
  [
    'H/enzyme_inducing_antiepileptic__hormonal_contraceptive/dailymed-tegretol-8d409411-v38-contraception',
    '4db3d833a8073218010440d21355612fc75742fa22e1b328f4cedbc72db29467',
  ],
  [
    'H/carbamazepine__verapamil/dailymed-tegretol-8d409411-v38-verapamil',
    '4db3d833a8073218010440d21355612fc75742fa22e1b328f4cedbc72db29467',
  ],
  [
    'H/carbamazepine__sulfonylurea/dailymed-tegretol-8d409411-v38-negative-sulfonylurea-boundary',
    '4db3d833a8073218010440d21355612fc75742fa22e1b328f4cedbc72db29467',
  ],
  [
    'H/carbamazepine__valproate/dailymed-tegretol-8d409411-v38-valproate',
    '4db3d833a8073218010440d21355612fc75742fa22e1b328f4cedbc72db29467',
  ],
  [
    'J/sulfonylurea__co_trimoxazole/J-US02',
    '254015707829f4bb483857f676250dd424877fad067b55d76fcf5f2b84dd1cbd',
  ],
]);

function loadSection(section) {
  return readFileSync(
    join(
      repository,
      'docs',
      'interaction-review',
      'batch-01-v2',
      'sections',
      `${section}.verified.jsonl`,
    ),
    'utf8',
  )
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
}

test('the nine 2026-07-28 draft evidence rechecks pin current payloads and dates', () => {
  const found = [];
  for (const section of ['C', 'F', 'H', 'J']) {
    for (const rule of loadSection(section)) {
      for (const evidence of rule.evidence) {
        const key = `${section}/${rule.rule_id}/${evidence.source_id}`;
        if (!expected.has(key)) continue;
        found.push(key);
        assert.equal(
          evidence.provenance.payload_sha256,
          expected.get(key),
          `${key} payload SHA-256`,
        );
        assert.equal(evidence.accessed_at, verifiedAt, `${key} accessed_at`);
        assert.equal(
          evidence.currentness_checked_at,
          verifiedAt,
          `${key} currentness_checked_at`,
        );
        assert.equal(evidence.retrieved_at, verifiedAt, `${key} retrieved_at`);
      }
    }
  }
  assert.deepEqual(found.sort(), [...expected.keys()].sort());
});
