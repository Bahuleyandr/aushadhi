import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SNOMED_FSN_TYPE_ID,
  buildCdciIdentityRecords,
  deriveCdciDependencyPlan,
  parseRf2Record,
  selectLatestRowsAsOf,
  semanticTagFromFsn,
  validateCdciReleaseConfig,
} from '../../src/adapters/cdci.mjs';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function releaseConfig(overrides = {}) {
  return {
    schema_version: 1,
    source_id: 'cdci-snomed-ct',
    profile: 'internal-evaluation',
    extension: {
      storage_path: 'data/restricted/cdci/source/cdci.zip',
      sha256: SHA_A,
      package_effective_time: '20260615',
    },
    international: {
      storage_path: 'data/restricted/cdci/source/international-july.zip',
      sha256: SHA_B,
      package_effective_time: '20260701',
      dependency_view_effective_time: '20260601',
      selection_strategy: 'full_as_of_dependency',
    },
    output: {
      storage_path: 'data/restricted/cdci/index',
    },
    expected_output: {
      active_extension_concept_count: 2,
      identity_count: 1,
      identity_kinds: { branded_medicine: 1 },
      quarantined_concept_count: 1,
      quarantined_concept_ids_sha256:
        '3635bc20e39fe10b0d4aa2b078f6b6c70bba74669e6108e6888a0c312ed04f42',
      artifact_sha256: null,
    },
    ...overrides,
  };
}

test('validateCdciReleaseConfig accepts only a pinned restricted identity release pair', () => {
  const config = validateCdciReleaseConfig(releaseConfig());
  assert.equal(config.profile, 'internal-evaluation');
  assert.equal(config.international.selection_strategy, 'full_as_of_dependency');

  assert.throws(
    () => validateCdciReleaseConfig(releaseConfig({ profile: 'production-open' })),
    /internal-evaluation/i,
  );
  assert.throws(
    () => validateCdciReleaseConfig(releaseConfig({
      extension: { ...releaseConfig().extension, sha256: SHA_A.toUpperCase() },
    })),
    /lowercase SHA-256/i,
  );
  assert.throws(
    () => validateCdciReleaseConfig(releaseConfig({
      international: {
        ...releaseConfig().international,
        selection_strategy: 'use-later-snapshot',
      },
    })),
    /full_as_of_dependency/i,
  );
  assert.throws(
    () => validateCdciReleaseConfig({ ...releaseConfig(), unexpected: true }),
    /unexpected key/i,
  );
  assert.throws(
    () => validateCdciReleaseConfig(releaseConfig({
      output: { storage_path: 'data/restricted/cdci/source' },
    })),
    /overlap.*archive/i,
  );
});

test('the committed CDCI release config pins the supplied June extension and July Full archive', () => {
  const config = validateCdciReleaseConfig(JSON.parse(fs.readFileSync(
    'data-static/cdci-release.internal-evaluation.json',
    'utf8',
  )));
  assert.equal(config.extension.package_effective_time, '20260615');
  assert.equal(
    config.extension.sha256,
    'f6f552485799e155781d4006f6e7803a45b4eccf2064397a577c5c0fd4ea00c5',
  );
  assert.equal(config.international.package_effective_time, '20260701');
  assert.equal(config.international.dependency_view_effective_time, '20260601');
  assert.equal(
    config.international.sha256,
    'f1597cf959fdb1f870a59526a3957cf605181c4a3fd9bc9c20c8a77f7fdfb653',
  );
  assert.equal(config.expected_output.identity_count, 249317);
  assert.equal(config.expected_output.quarantined_concept_count, 6);
  assert.equal(
    config.expected_output.quarantined_concept_ids_sha256,
    '1e5f6802e6e15cd4dc46ede19cf137ef00db5c8fa41d13f022682d7dfeb84ee5',
  );
  assert.equal(
    config.expected_output.artifact_sha256.identities,
    'd2c4850da73b2c7772b747450eb278da411da642544762b40b4a8d2ced64af2b',
  );
});

test('parseRf2Record requires the exact RF2 header and field count', () => {
  const header = 'id\teffectiveTime\tactive\tmoduleId\tdefinitionStatusId';
  assert.deepEqual(
    parseRf2Record({
      table: 'concept',
      member: 'Concept_Snapshot.txt',
      lineNumber: 2,
      header,
      line: '100001\t20260615\t1\t600000\t900000000000074008',
    }),
    {
      id: '100001',
      effectiveTime: '20260615',
      active: '1',
      moduleId: '600000',
      definitionStatusId: '900000000000074008',
    },
  );
  assert.throws(
    () => parseRf2Record({
      table: 'concept',
      member: 'Concept_Snapshot.txt',
      lineNumber: 2,
      header: 'id\tactive\teffectiveTime\tmoduleId\tdefinitionStatusId',
      line: '100001\t1\t20260615\t600000\t900000000000074008',
    }),
    /Concept_Snapshot\.txt.*header/i,
  );
  assert.throws(
    () => parseRf2Record({
      table: 'concept',
      member: 'Concept_Snapshot.txt',
      lineNumber: 9,
      header,
      line: '100001\t20260615\t1',
    }),
    /Concept_Snapshot\.txt:9.*5 fields.*3/i,
  );
  assert.throws(
    () => parseRf2Record({
      table: 'concept',
      member: 'Concept_Snapshot.txt',
      lineNumber: 10,
      header,
      line: '100001\t20260230\t1\t600000\t900000000000074008',
    }),
    /Concept_Snapshot\.txt:10.*effectiveTime.*calendar date/i,
  );
  assert.throws(
    () => parseRf2Record({
      table: 'concept',
      member: 'Concept_Snapshot.txt',
      lineNumber: 11,
      header,
      line: '\t20260615\t1\t600000\t900000000000074008',
    }),
    /Concept_Snapshot\.txt:11.*id.*SCTID/i,
  );
});

test('parseRf2Record accepts numeric right-padding without broad whitespace coercion', () => {
  const header = [
    'id', 'effectiveTime', 'active', 'moduleId', 'sourceId', 'value',
    'relationshipGroup', 'typeId', 'characteristicTypeId', 'modifierId',
  ].join('\t');
  const baseFields = [
    '100001', '20260615', '1', '100002', '100003',
    '#200 ', '2', '100004', '100005', '100006',
  ];

  assert.equal(parseRf2Record({
    table: 'concreteRelationship',
    member: 'RelationshipConcreteValues_Snapshot.txt',
    lineNumber: 2,
    header,
    line: baseFields.join('\t'),
  }).value, '#200 ');

  assert.throws(
    () => parseRf2Record({
      table: 'concreteRelationship',
      member: 'RelationshipConcreteValues_Snapshot.txt',
      lineNumber: 2,
      header,
      line: baseFields.with(5, ' #200').join('\t'),
    }),
    /value must be a valid RF2 concrete value/i,
  );
});

test('deriveCdciDependencyPlan requires one exact active source/target release pair', () => {
  const rows = [
    {
      id: 'dep-1', active: '1', sourceEffectiveTime: '20260615',
      targetEffectiveTime: '20260601', referencedComponentId: '900000000000012004',
    },
    {
      id: 'dep-2', active: '1', sourceEffectiveTime: '20260615',
      targetEffectiveTime: '20260601', referencedComponentId: '900000000000207008',
    },
  ];
  assert.deepEqual(deriveCdciDependencyPlan(rows), {
    source_effective_time: '20260615',
    target_effective_time: '20260601',
    target_module_ids: ['900000000000012004', '900000000000207008'],
  });
  assert.throws(
    () => deriveCdciDependencyPlan([
      ...rows,
      { ...rows[0], id: 'dep-3', targetEffectiveTime: '20260701' },
    ]),
    /conflicting target effective times/i,
  );
  assert.throws(() => deriveCdciDependencyPlan([]), /active module dependency/i);
});

test('selectLatestRowsAsOf reconstructs the declared dependency view from Full history', () => {
  const rows = [
    { id: '100', effectiveTime: '20240101', active: '1', term: 'old' },
    { id: '100', effectiveTime: '20260601', active: '1', term: 'dependency' },
    { id: '100', effectiveTime: '20260701', active: '1', term: 'later' },
    { id: '200', effectiveTime: '20260501', active: '1', term: 'active before' },
    { id: '200', effectiveTime: '20260601', active: '0', term: 'inactive at dependency' },
    { id: '300', effectiveTime: '20260701', active: '1', term: 'post-target only' },
  ];
  const selected = selectLatestRowsAsOf(rows, {
    targetEffectiveTime: '20260601',
    label: 'International Concept Full',
  });
  assert.equal(selected.get('100').term, 'dependency');
  assert.equal(selected.get('200').active, '0');
  assert.equal(selected.has('300'), false);
  assert.throws(
    () => selectLatestRowsAsOf([
      { id: '100', effectiveTime: '', active: '1' },
    ], { targetEffectiveTime: '20260601', label: 'International Concept Full' }),
    /blank effectiveTime/i,
  );
});

test('semanticTagFromFsn extracts only a terminal SNOMED semantic tag', () => {
  assert.equal(
    semanticTagFromFsn('Example 10 mg oral tablet Acme (real clinical drug)'),
    'real clinical drug',
  );
  assert.equal(semanticTagFromFsn('Example (extra) text'), null);
  assert.equal(semanticTagFromFsn('No tag'), null);
});

test('buildCdciIdentityRecords emits deterministic identity-only rows and quarantines inactive references', () => {
  const concepts = new Map([
    ['1001', { id: '1001', effectiveTime: '20260615', active: '1', moduleId: '600000', definitionStatusId: '900000000000074008' }],
    ['1002', { id: '1002', effectiveTime: '20260615', active: '1', moduleId: '600000', definitionStatusId: '900000000000074008' }],
    ['1003', { id: '1003', effectiveTime: '20260615', active: '1', moduleId: '600000', definitionStatusId: '900000000000074008' }],
  ]);
  const descriptions = new Map([
    ['1001', [{
      id: 'd-1001', effectiveTime: '20260615', active: '1', moduleId: '600000',
      typeId: '900000000000003001', term: 'Example (product name)',
      caseSignificanceId: '900000000000448009',
    }]],
    ['1002', [{
      id: 'd-1002', effectiveTime: '20260615', active: '1', moduleId: '600000',
      typeId: '900000000000003001',
      term: 'Example 10 milligram oral tablet Acme (real clinical drug)',
      caseSignificanceId: '900000000000448009',
    }, {
      id: 'd-1002-s', effectiveTime: '20260615', active: '1', moduleId: '600000',
      typeId: '900000000000013009', term: 'Example 10 mg tablet',
      caseSignificanceId: '900000000000448009',
    }]],
    ['1003', [{
      id: 'd-1003', effectiveTime: '20260615', active: '1', moduleId: '600000',
      typeId: '900000000000003001',
      term: 'Broken 10 milligram oral tablet Acme (real clinical drug)',
      caseSignificanceId: '900000000000448009',
    }]],
  ]);
  const relationships = new Map([
    ['1002', [
      {
        id: 'r2', effectiveTime: '20260615', active: '1', moduleId: '600000', sourceId: '1002',
        destinationId: '2002', relationshipGroup: '0', typeId: '411116001',
        characteristicTypeId: '900000000000011006', modifierId: '900000000000451002',
      },
      {
        id: 'r1', effectiveTime: '20260615', active: '1', moduleId: '600000', sourceId: '1002',
        destinationId: '2001', relationshipGroup: '1', typeId: '127489000',
        characteristicTypeId: '900000000000011006', modifierId: '900000000000451002',
      },
    ]],
    ['1003', [{
      id: 'r3', effectiveTime: '20260615', active: '1', moduleId: '600000', sourceId: '1003',
      destinationId: '2999', relationshipGroup: '1', typeId: '127489000',
      characteristicTypeId: '900000000000011006', modifierId: '900000000000451002',
    }]],
  ]);
  const internationalConcepts = new Map([
    ['600000', { id: '600000', active: '1' }],
    ['127489000', { id: '127489000', active: '1' }],
    ['411116001', { id: '411116001', active: '1' }],
    ['900000000000011006', { id: '900000000000011006', active: '1' }],
    ['900000000000451002', { id: '900000000000451002', active: '1' }],
    ['900000000000003001', { id: '900000000000003001', active: '1' }],
    ['900000000000013009', { id: '900000000000013009', active: '1' }],
    ['900000000000448009', { id: '900000000000448009', active: '1' }],
    ['900000000000074008', { id: '900000000000074008', active: '1' }],
    ['2001', { id: '2001', active: '1' }],
    ['2002', { id: '2002', active: '1' }],
    ['2999', { id: '2999', active: '0' }],
  ]);
  const internationalFsns = new Map([
    ['127489000', 'Has active ingredient (attribute)'],
    ['411116001', 'Has manufactured dose form (attribute)'],
    ['2001', 'Example substance (substance)'],
    ['2002', 'Conventional release oral tablet (dose form)'],
    ['2999', 'Inactive example substance (substance)'],
  ]);

  const result = buildCdciIdentityRecords({
    concepts,
    descriptions,
    relationships,
    concreteRelationships: new Map(),
    languageAcceptability: new Map(),
    internationalConcepts,
    internationalFsns,
  });

  assert.deepEqual(result.records.map((row) => row.concept_id), ['1001', '1002']);
  assert.equal(result.records[0].identity_kind, 'brand_name');
  assert.equal(result.records[1].identity_kind, 'branded_medicine');
  assert.equal(result.records[1].review_status, 'review_candidate');
  assert.equal(result.records[1].runtime_authority, 'none');
  assert.match(result.records[1].assertion_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.records[1].relationships[0].type_fsn, 'Has manufactured dose form (attribute)');
  assert.equal(result.records[1].relationships[1].destination_fsn, 'Example substance (substance)');
  assert.deepEqual(result.quarantined.map((row) => row.concept_id), ['1003']);
  assert.deepEqual(result.quarantined[0].reasons, [{
    code: 'inactive_international_reference',
    concept_id: '2999',
  }]);
});

test('buildCdciIdentityRecords never silently drops an active concept with no unique FSN', () => {
  const result = buildCdciIdentityRecords({
    concepts: new Map([[
      '1001',
      { id: '1001', effectiveTime: '20260615', active: '1', moduleId: '600000', definitionStatusId: '900000000000074008' },
    ]]),
    descriptions: new Map(),
    relationships: new Map(),
    concreteRelationships: new Map(),
    languageAcceptability: new Map(),
    internationalConcepts: new Map(),
    internationalFsns: new Map(),
  });
  assert.deepEqual(result.records, []);
  assert.equal(result.quarantined.length, 1);
  assert.equal(result.quarantined[0].concept_id, '1001');
  assert.deepEqual(result.quarantined[0].reasons, [{ code: 'missing_fsn' }]);
});

test('buildCdciIdentityRecords quarantines missing definition and language references', () => {
  const result = buildCdciIdentityRecords({
    concepts: new Map([['1001', {
      id: '1001', effectiveTime: '20260615', active: '1',
      moduleId: '600000', definitionStatusId: '999999',
    }]]),
    descriptions: new Map([['1001', [{
      id: 'd-1001', effectiveTime: '20260615', active: '1', moduleId: '600000',
      typeId: '900000000000003001', term: 'Example (product name)',
      caseSignificanceId: '900000000000448009',
    }]]]),
    relationships: new Map(),
    concreteRelationships: new Map(),
    languageAcceptability: new Map([['d-1001', [{
      active: '1', moduleId: '600000',
      refsetId: '888888', acceptabilityId: '777777',
    }]]]),
    internationalConcepts: new Map([
      ['600000', { id: '600000', active: '1' }],
      ['900000000000003001', { id: '900000000000003001', active: '1' }],
      ['900000000000448009', { id: '900000000000448009', active: '1' }],
    ]),
    internationalFsns: new Map(),
  });
  assert.deepEqual(result.records, []);
  assert.deepEqual(result.quarantined[0].reasons, [
    { code: 'missing_reference', concept_id: '777777' },
    { code: 'missing_reference', concept_id: '888888' },
    { code: 'missing_reference', concept_id: '999999' },
  ]);
});

test('buildCdciIdentityRecords fails closed on every module reference used by an identity', () => {
  const activeReferenceIds = [
    '700001', '700003', '700004', '700005', '700006', '700007', '700008',
    '700009', '700010', SNOMED_FSN_TYPE_ID,
  ];
  const result = buildCdciIdentityRecords({
    concepts: new Map([['100001', {
      id: '100001', effectiveTime: '20260615', active: '1',
      moduleId: '600001', definitionStatusId: '700001',
    }]]),
    descriptions: new Map([['100001', [{
      id: '200001', effectiveTime: '20260615', active: '1', moduleId: '600002',
      typeId: SNOMED_FSN_TYPE_ID, term: 'Synthetic medicine (product name)',
      caseSignificanceId: '700003',
    }]]]),
    relationships: new Map([['100001', [{
      id: '300001', effectiveTime: '20260615', active: '1', moduleId: '600003',
      sourceId: '100001', destinationId: '700004', relationshipGroup: '1',
      typeId: '700005', characteristicTypeId: '700006', modifierId: '700007',
    }]]]),
    concreteRelationships: new Map([['100001', [{
      id: '400001', effectiveTime: '20260615', active: '1', moduleId: '600004',
      sourceId: '100001', value: '#1', relationshipGroup: '1',
      typeId: '700008', characteristicTypeId: '700006', modifierId: '700007',
    }]]]),
    languageAcceptability: new Map([['200001', [{
      active: '1', moduleId: '600005', refsetId: '700009', acceptabilityId: '700010',
    }]]]),
    internationalConcepts: new Map(activeReferenceIds.map((id) => [id, { id, active: '1' }])),
    internationalFsns: new Map([
      ['700004', 'Synthetic destination (substance)'],
      ['700005', 'Synthetic relationship type (attribute)'],
      ['700008', 'Synthetic concrete type (attribute)'],
    ]),
  });

  assert.deepEqual(result.records, []);
  assert.deepEqual(result.quarantined[0].reasons, [
    { code: 'missing_reference', concept_id: '600001' },
    { code: 'missing_reference', concept_id: '600002' },
    { code: 'missing_reference', concept_id: '600003' },
    { code: 'missing_reference', concept_id: '600004' },
    { code: 'missing_reference', concept_id: '600005' },
  ]);
});
