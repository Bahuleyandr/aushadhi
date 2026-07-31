import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import { buildCdciIdentityIndex } from '../src/lib/cdci-index.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSION_ARCHIVE =
  'SnomedCT_IndiaDrugExtensionRF2_PRODUCTION_IN1000189_20260615T120000Z.zip';
const INTERNATIONAL_ARCHIVE =
  'SnomedCT_InternationalRF2_PRODUCTION_20260701T120000Z.zip';
const EXTENSION_ROOT = EXTENSION_ARCHIVE.slice(0, -4);
const INTERNATIONAL_ROOT = INTERNATIONAL_ARCHIVE.slice(0, -4);
const EXTENSION_SUFFIX = 'IN1000189_20260615T120000Z';

const HEADERS = {
  concept: 'id\teffectiveTime\tactive\tmoduleId\tdefinitionStatusId',
  description:
    'id\teffectiveTime\tactive\tmoduleId\tconceptId\tlanguageCode\ttypeId\tterm\tcaseSignificanceId',
  relationship:
    'id\teffectiveTime\tactive\tmoduleId\tsourceId\tdestinationId\trelationshipGroup\ttypeId\tcharacteristicTypeId\tmodifierId',
  concreteRelationship:
    'id\teffectiveTime\tactive\tmoduleId\tsourceId\tvalue\trelationshipGroup\ttypeId\tcharacteristicTypeId\tmodifierId',
  moduleDependency:
    'id\teffectiveTime\tactive\tmoduleId\trefsetId\treferencedComponentId\tsourceEffectiveTime\ttargetEffectiveTime',
  language:
    'id\teffectiveTime\tactive\tmoduleId\trefsetId\treferencedComponentId\tacceptabilityId',
  association:
    'id\teffectiveTime\tactive\tmoduleId\trefsetId\treferencedComponentId\ttargetComponentId',
  attributeValue:
    'id\teffectiveTime\tactive\tmoduleId\trefsetId\treferencedComponentId\tvalueId',
};

const EXTENSION_MEMBERS = {
  concept:
    `${EXTENSION_ROOT}/Snapshot/Terminology/sct2_Concept_Snapshot_${EXTENSION_SUFFIX}.txt`,
  description:
    `${EXTENSION_ROOT}/Snapshot/Terminology/sct2_Description_Snapshot-en_${EXTENSION_SUFFIX}.txt`,
  concreteRelationship:
    `${EXTENSION_ROOT}/Snapshot/Terminology/sct2_RelationshipConcreteValues_Snapshot_${EXTENSION_SUFFIX}.txt`,
  relationship:
    `${EXTENSION_ROOT}/Snapshot/Terminology/sct2_Relationship_Snapshot_${EXTENSION_SUFFIX}.txt`,
  association:
    `${EXTENSION_ROOT}/Snapshot/Refset/Content/der2_cRefset_AssociationSnapshot_${EXTENSION_SUFFIX}.txt`,
  attributeValue:
    `${EXTENSION_ROOT}/Snapshot/Refset/Content/der2_cRefset_AttributeValueSnapshot_${EXTENSION_SUFFIX}.txt`,
  language:
    `${EXTENSION_ROOT}/Snapshot/Refset/Language/der2_cRefset_LanguageSnapshot-en_${EXTENSION_SUFFIX}.txt`,
  moduleDependency:
    `${EXTENSION_ROOT}/Snapshot/Refset/Metadata/der2_ssRefset_ModuleDependencySnapshot_${EXTENSION_SUFFIX}.txt`,
};

const INTERNATIONAL_MEMBERS = {
  releaseInformation: `${INTERNATIONAL_ROOT}/release_package_information.json`,
  concept:
    `${INTERNATIONAL_ROOT}/Full/Terminology/sct2_Concept_Full_INT_20260701.txt`,
  description:
    `${INTERNATIONAL_ROOT}/Full/Terminology/sct2_Description_Full-en_INT_20260701.txt`,
};

function table(header, rows = []) {
  return `${[header, ...rows].join('\n')}\n`;
}

function archiveBytes(entries) {
  return zipSync(Object.fromEntries(
    Object.entries(entries).map(([name, value]) => [name, strToU8(value)]),
  ), { level: 1 });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function extensionEntries({ omit = null } = {}) {
  const entries = {
    [EXTENSION_MEMBERS.concept]: table(HEADERS.concept, [
      '600001\t20260615\t1\t600001\t900000000000074008',
      '10000189100\t20260615\t1\t600001\t900000000000074008',
      '10001189109\t20260615\t1\t600001\t900000000000074008',
    ]),
    [EXTENSION_MEMBERS.description]: table(HEADERS.description, [
      '600002\t20260615\t1\t600001\t600001\ten\t900000000000003001\tSynthetic extension module (core metadata concept)\t900000000000448009',
      '20000189101\t20260615\t1\t600001\t10000189100\ten\t900000000000003001\tExample tablet Acme (real clinical drug)\t900000000000448009',
      '20001189107\t20260615\t1\t600001\t10000189100\ten\t900000000000013009\tExample tablet\t900000000000448009',
      '20002189102\t20260615\t1\t600001\t10001189109\ten\t900000000000003001\tBroken tablet Acme (real clinical drug)\t900000000000448009',
    ]),
    [EXTENSION_MEMBERS.concreteRelationship]: table(HEADERS.concreteRelationship),
    [EXTENSION_MEMBERS.relationship]: table(HEADERS.relationship, [
      '30000189105\t20260615\t1\t600001\t10000189100\t387517004\t1\t127489000\t900000000000011006\t900000000000451002',
      '30001189104\t20260615\t1\t600001\t10001189109\t999999991\t1\t127489000\t900000000000011006\t900000000000451002',
    ]),
    [EXTENSION_MEMBERS.association]: table(HEADERS.association),
    [EXTENSION_MEMBERS.attributeValue]: table(HEADERS.attributeValue),
    [EXTENSION_MEMBERS.language]: table(HEADERS.language, [
      '00000000-0000-4000-8000-000000000001\t20260615\t1\t600001\t900000000000509007\t20000189101\t900000000000548007',
      '00000000-0000-4000-8000-000000000002\t20260615\t1\t600001\t900000000000509007\t20001189107\t900000000000549004',
    ]),
    [EXTENSION_MEMBERS.moduleDependency]: table(HEADERS.moduleDependency, [
      '00000000-0000-4000-8000-000000000003\t20260615\t1\t600001\t900000000000534007\t900000000000012004\t20260615\t20260601',
      '00000000-0000-4000-8000-000000000004\t20260615\t1\t600001\t900000000000534007\t900000000000207008\t20260615\t20260601',
    ]),
  };
  if (omit !== null) delete entries[EXTENSION_MEMBERS[omit]];
  return entries;
}

function internationalEntries() {
  const concepts = [
    '900000000000012004',
    '900000000000207008',
    '900000000000003001',
    '900000000000013009',
    '900000000000074008',
    '900000000000448009',
    '900000000000509007',
    '900000000000534007',
    '900000000000548007',
    '900000000000549004',
    '127489000',
    '900000000000011006',
    '900000000000451002',
  ].map((id) => `${id}\t20250131\t1\t900000000000207008\t900000000000074008`);
  concepts.push(
    '387517004\t20260601\t1\t900000000000207008\t900000000000074008',
    '387517004\t20260701\t0\t900000000000207008\t900000000000074008',
    '888888881\t20260701\t1\t900000000000207008\t900000000000074008',
  );
  return {
    [INTERNATIONAL_MEMBERS.releaseInformation]: `${JSON.stringify({
      effectiveTime: '20260701',
      previousPublishedPackage:
        'SnomedCT_InternationalRF2_PRODUCTION_20260601T120000Z.zip',
      ignoredMetadata: true,
    }, null, 2)}\n`,
    // Malformed July Snapshots precede Full history and must never be selected.
    [`${INTERNATIONAL_ROOT}/Snapshot/Terminology/sct2_Concept_Snapshot_INT_20260701.txt`]:
      'this\tis\tnot\tthe\tdeclared\tbase\n',
    [`${INTERNATIONAL_ROOT}/Snapshot/Terminology/sct2_Description_Snapshot-en_INT_20260701.txt`]:
      'this\tis\nalso\tnot\tthe\tdeclared\tbase\n',
    [INTERNATIONAL_MEMBERS.concept]: table(HEADERS.concept, concepts),
    [INTERNATIONAL_MEMBERS.description]: table(HEADERS.description, [
      '400000000001\t20250131\t1\t900000000000207008\t127489000\ten\t900000000000003001\tHas active ingredient (attribute)\t900000000000448009',
      '400000000004\t20250131\t1\t900000000000207008\t387517004\ten\t900000000000003001\tObsolete FSN role (substance)\t900000000000448009',
      '400000000004\t20250501\t1\t900000000000207008\t387517004\ten\t900000000000013009\tObsolete FSN role\t900000000000448009',
      '400000000002\t20260601\t1\t900000000000207008\t387517004\ten\t900000000000003001\tJune dependency substance (substance)\t900000000000448009',
      '400000000002\t20260701\t1\t900000000000207008\t387517004\ten\t900000000000003001\tJuly substance must not be used (substance)\t900000000000448009',
      '400000000003\t20260701\t1\t900000000000207008\t888888881\ten\t900000000000003001\tUnreferenced July concept (finding)\t900000000000448009',
    ]),
  };
}

function writeFixture({ omitExtensionMember = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-cdci-index-'));
  const sourceDir = path.join(root, 'data', 'restricted', 'cdci', 'source');
  const dataStaticDir = path.join(root, 'data-static');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(dataStaticDir, { recursive: true });
  fs.copyFileSync(
    path.join(REPOSITORY_ROOT, 'data-static', 'interaction-sources.json'),
    path.join(dataStaticDir, 'interaction-sources.json'),
  );

  const extension = archiveBytes(extensionEntries({ omit: omitExtensionMember }));
  const international = archiveBytes(internationalEntries());
  fs.writeFileSync(path.join(sourceDir, EXTENSION_ARCHIVE), extension);
  fs.writeFileSync(path.join(sourceDir, INTERNATIONAL_ARCHIVE), international);

  const config = {
    schema_version: 1,
    source_id: 'cdci-snomed-ct',
    profile: 'internal-evaluation',
    extension: {
      storage_path: `data/restricted/cdci/source/${EXTENSION_ARCHIVE}`,
      sha256: sha256(extension),
      package_effective_time: '20260615',
    },
    international: {
      storage_path: `data/restricted/cdci/source/${INTERNATIONAL_ARCHIVE}`,
      sha256: sha256(international),
      package_effective_time: '20260701',
      dependency_view_effective_time: '20260601',
      selection_strategy: 'full_as_of_dependency',
    },
    output: { storage_path: 'data/restricted/cdci/index' },
    expected_output: {
      active_extension_concept_count: 3,
      identity_count: 1,
      identity_kinds: { branded_medicine: 1 },
      quarantined_concept_count: 1,
      quarantined_concept_ids_sha256:
        '3635bc20e39fe10b0d4aa2b078f6b6c70bba74669e6108e6888a0c312ed04f42',
      artifact_sha256: null,
    },
  };
  const configPath = path.join(dataStaticDir, 'cdci-release.internal-evaluation.json');
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return { root, configPath, config };
}

function readJsonLines(file) {
  const value = fs.readFileSync(file, 'utf8');
  return value === '' ? [] : value.trimEnd().split('\n').map((line) => JSON.parse(line));
}

test('buildCdciIdentityIndex reconstructs the declared June base from July Full deterministically', async (t) => {
  const fixture = writeFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const output = path.join(fixture.root, 'data', 'restricted', 'cdci', 'index');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'old-marker.txt'), 'previous output', 'utf8');

  const first = await buildCdciIdentityIndex({
    root: fixture.root,
    configPath: fixture.configPath,
    expectedProfile: 'internal-evaluation',
  });
  const firstSummaryText = fs.readFileSync(first.summary_output_path, 'utf8');
  const identities = readJsonLines(first.identity_output_path);
  const quarantine = readJsonLines(first.quarantine_output_path);

  assert.equal(fs.existsSync(path.join(output, 'old-marker.txt')), false);
  assert.equal(identities.length, 1);
  assert.equal(quarantine.length, 1);
  assert.equal(
    identities[0].relationships[0].destination_fsn,
    'June dependency substance (substance)',
  );
  assert.deepEqual(quarantine[0].reasons, [
    { code: 'missing_reference', concept_id: '999999991' },
    { code: 'missing_reference_fsn', concept_id: '999999991' },
  ]);
  assert.equal(first.summary.runtime_authority, 'none');
  assert.equal(first.summary.source_policy.redistributable, false);
  assert.equal(
    first.summary.international_full_reconstruction_source.archive_role,
    'later_full_reconstruction_source',
  );
  assert.equal(
    first.summary.dependency_base.declared_package,
    'SnomedCT_InternationalRF2_PRODUCTION_20260601T120000Z.zip',
  );
  assert.equal(first.summary.dependency_base.package_effective_time, '20260601');
  assert.equal(first.summary.counts.identity_count, 1);
  assert.equal(first.summary.counts.quarantined_count, 1);
  assert.deepEqual(first.summary.reference_validation.missing_concept_ids, ['999999991']);
  assert.equal(
    first.summary.outputs.identities.sha256,
    sha256(fs.readFileSync(first.identity_output_path)),
  );
  assert.equal(
    first.summary.outputs.quarantine.sha256,
    sha256(fs.readFileSync(first.quarantine_output_path)),
  );

  fs.writeFileSync(
    fixture.configPath,
    `${JSON.stringify(fixture.config, null, 2)}\n`.replaceAll('\n', '\r\n'),
    'utf8',
  );
  const second = await buildCdciIdentityIndex({
    root: fixture.root,
    configPath: fixture.configPath,
    expectedProfile: 'internal-evaluation',
  });
  assert.deepEqual(second.summary, first.summary);
  assert.equal(fs.readFileSync(second.summary_output_path, 'utf8'), firstSummaryText);
});

test('buildCdciIdentityIndex authenticates the parsed archive stream and preserves previous output', async (t) => {
  const fixture = writeFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  fixture.config.extension.sha256 = '0'.repeat(64);
  fs.writeFileSync(fixture.configPath, `${JSON.stringify(fixture.config, null, 2)}\n`, 'utf8');
  const output = path.join(fixture.root, 'data', 'restricted', 'cdci', 'index');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'old-marker.txt'), 'previous output', 'utf8');

  await assert.rejects(
    buildCdciIdentityIndex({ root: fixture.root, configPath: fixture.configPath }),
    /ZIP archive.*SHA-256 mismatch/i,
  );
  assert.equal(fs.readFileSync(path.join(output, 'old-marker.txt'), 'utf8'), 'previous output');
  assert.deepEqual(fs.readdirSync(output), ['old-marker.txt']);
});

test('buildCdciIdentityIndex fails closed when pinned real-output invariants drift', async (t) => {
  const fixture = writeFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  fixture.config.expected_output.identity_count = 2;
  fixture.config.expected_output.identity_kinds.branded_medicine = 2;
  fs.writeFileSync(fixture.configPath, `${JSON.stringify(fixture.config, null, 2)}\n`, 'utf8');
  const output = path.join(fixture.root, 'data', 'restricted', 'cdci', 'index');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'old-marker.txt'), 'previous output', 'utf8');

  await assert.rejects(
    buildCdciIdentityIndex({ root: fixture.root, configPath: fixture.configPath }),
    /expected-output invariant.*identity_count/i,
  );
  assert.equal(fs.readFileSync(path.join(output, 'old-marker.txt'), 'utf8'), 'previous output');
});

test('buildCdciIdentityIndex preserves prior output when a pinned artifact hash drifts', async (t) => {
  const fixture = writeFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  fixture.config.expected_output.artifact_sha256 = {
    identities: '0'.repeat(64),
    quarantine: '0'.repeat(64),
  };
  fs.writeFileSync(fixture.configPath, `${JSON.stringify(fixture.config, null, 2)}\n`, 'utf8');
  const output = path.join(fixture.root, 'data', 'restricted', 'cdci', 'index');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'old-marker.txt'), 'previous output', 'utf8');

  await assert.rejects(
    buildCdciIdentityIndex({ root: fixture.root, configPath: fixture.configPath }),
    /expected-output invariant.*artifact_sha256\.identities/i,
  );
  assert.equal(fs.readFileSync(path.join(output, 'old-marker.txt'), 'utf8'), 'previous output');
});

test('buildCdciIdentityIndex treats a missing exact Snapshot member as structural and preserves output', async (t) => {
  const fixture = writeFixture({ omitExtensionMember: 'association' });
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const output = path.join(fixture.root, 'data', 'restricted', 'cdci', 'index');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'old-marker.txt'), 'previous output', 'utf8');

  await assert.rejects(
    buildCdciIdentityIndex({ root: fixture.root, configPath: fixture.configPath }),
    /missing required entries.*AssociationSnapshot/is,
  );
  assert.equal(fs.readFileSync(path.join(output, 'old-marker.txt'), 'utf8'), 'previous output');
});

test('buildCdciIdentityIndex rejects a restricted output redirected through a junction', async (t) => {
  const fixture = writeFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const output = path.join(fixture.root, 'data', 'restricted', 'cdci', 'index');
  const outside = path.join(fixture.root, 'outside-output');
  fs.mkdirSync(outside, { recursive: true });
  fs.symlinkSync(outside, output, process.platform === 'win32' ? 'junction' : 'dir');

  await assert.rejects(
    buildCdciIdentityIndex({ root: fixture.root, configPath: fixture.configPath }),
    /symbolic link|junction|reparse point/i,
  );
  assert.deepEqual(fs.readdirSync(outside), []);
});
