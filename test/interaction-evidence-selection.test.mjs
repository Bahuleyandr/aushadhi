import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterInteractionEvidenceRecords,
  parseInteractionEvidenceSelectionArgs,
} from '../src/lib/interaction-evidence-selection.mjs';

test('interaction evidence selection accepts repeatable exact rule IDs', () => {
  assert.deepEqual(
    parseInteractionEvidenceSelectionArgs([
      '--sections=A',
      '--rule-id=warfarin__amiodarone',
      '--rule-id',
      'warfarin__fluconazole',
      '--rule-id=warfarin__amiodarone',
    ]),
    {
      sections: ['A'],
      ruleIds: ['warfarin__amiodarone', 'warfarin__fluconazole'],
    },
  );
});

test('interaction evidence selection fails closed on invalid or unknown arguments', () => {
  assert.throws(
    () => parseInteractionEvidenceSelectionArgs(['--rule-id']),
    /--rule-id requires a value/u,
  );
  assert.throws(
    () => parseInteractionEvidenceSelectionArgs(['--sections=Z']),
    /--sections must select one or more letters from A through J/u,
  );
  assert.throws(
    () => parseInteractionEvidenceSelectionArgs(['--wat']),
    /unknown argument --wat/u,
  );
});

test('interaction evidence selection returns only exact requested rules and rejects missing IDs', () => {
  const records = [
    { rule_id: 'warfarin__amiodarone', evidence: { source_id: 'a' } },
    { rule_id: 'warfarin__fluconazole', evidence: { source_id: 'b' } },
    { rule_id: 'warfarin__fluconazole', evidence: { source_id: 'c' } },
    { rule_id: 'warfarin__tramadol', evidence: { source_id: 'd' } },
  ];
  assert.deepEqual(
    filterInteractionEvidenceRecords(records, [
      'warfarin__amiodarone',
      'warfarin__fluconazole',
    ]),
    records.slice(0, 3),
  );
  assert.throws(
    () => filterInteractionEvidenceRecords(records, ['warfarin__missing']),
    /requested rule_id not found: warfarin__missing/u,
  );
});
