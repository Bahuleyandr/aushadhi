import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  parseInteractionMemberSets,
  validateInteractionMemberSets,
} from '../src/lib/interaction-member-set-validation.mjs';
import { DEFAULT_MEMBER_SETS_PATH } from '../src/cli/assemble-interaction-draft-pack.mjs';

test('the checked-in member-set file has 80 strictly valid classes', () => {
  const { classes } = parseInteractionMemberSets(fs.readFileSync(DEFAULT_MEMBER_SETS_PATH));
  assert.equal(Object.keys(classes).length, 80);
  assert.deepEqual(classes.nsaid.any.slice(0, 3), ['ibuprofen', 'diclofenac', 'naproxen']);
});

test('member-set validation rejects scalar buckets and malformed member values', () => {
  const invalidCases = [
    [
      { classes: { nsaid: { any: 'ibuprofen' } } },
      /classes\.nsaid\.any must be a non-empty array/i,
    ],
    [
      { classes: { nsaid: { any: [] } } },
      /classes\.nsaid\.any must be a non-empty array/i,
    ],
    [
      { classes: { nsaid: { any: [''] } } },
      /classes\.nsaid\.any\[0\] must be a nonblank string/i,
    ],
    [
      { classes: { nsaid: { any: [42] } } },
      /classes\.nsaid\.any\[0\] must be a nonblank string/i,
    ],
    [
      { classes: { nsaid: { any: [' ibuprofen'] } } },
      /must not contain leading or trailing whitespace/i,
    ],
    [
      { classes: { nsaid: { any: ['ibuprofen', 'IBUPROFEN'] } } },
      /contains duplicate member/i,
    ],
    [
      { classes: { inducer: { any: ['rifampin', 'rifampicin'] } } },
      /contains duplicate member/i,
    ],
    [
      { classes: { nsaid: { any: ['ibuprofen', 'ibuprofen'] } } },
      /contains duplicate member/i,
    ],
  ];

  for (const [memberSets, expected] of invalidCases) {
    assert.throws(() => validateInteractionMemberSets(memberSets), expected);
  }
});

test('member-set validation rejects unknown or malformed structures fail-closed', () => {
  const invalidCases = [
    [{ classes: { nsaid: ['ibuprofen'] } }, /classes\.nsaid must be a non-empty object/i],
    [{ classes: { nsaid: {} } }, /classes\.nsaid must be a non-empty object/i],
    [
      { classes: { nsaid: { unexpected: ['ibuprofen'] } } },
      /unknown strength bucket unexpected/i,
    ],
    [{ classes: {} }, /classes must contain at least one class/i],
    [{ classes: { 'not valid': { any: ['ibuprofen'] } } }, /must be lower snake_case/i],
    [{ _meta: [], classes: { nsaid: { any: ['ibuprofen'] } } }, /_meta must be an object/i],
    [
      { classes: { nsaid: { any: ['ibuprofen'] } }, unexpected: true },
      /root contains unknown property unexpected/i,
    ],
  ];

  for (const [memberSets, expected] of invalidCases) {
    assert.throws(() => validateInteractionMemberSets(memberSets), expected);
  }
});

test('semantic duplicates are scoped to a bucket, preserving intentional strength overlap', () => {
  const classes = validateInteractionMemberSets({
    classes: {
      variable_inhibitor: {
        strong: ['example drug'],
        moderate: ['example drug'],
      },
    },
  });
  assert.deepEqual(classes.variable_inhibitor, {
    strong: ['example drug'],
    moderate: ['example drug'],
  });
});
