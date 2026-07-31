import { createHash } from 'node:crypto';

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const DATE_PATTERN = /^\d{8}$/u;
const SCTID_PATTERN = /^[1-9]\d{5,17}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RELATIONSHIP_GROUP_PATTERN = /^(?:0|[1-9]\d*)$/u;
const CONCRETE_VALUE_PATTERN = /^(?:#-?(?:0|[1-9]\d*)(?:\.\d+)? *|"(?:[^"\\]|\\.)*")$/u;
const RESTRICTED_ZONE = 'data/restricted/cdci';

export const CDCI_IDENTITY_SCHEMA_VERSION = 1;
export const SNOMED_FSN_TYPE_ID = '900000000000003001';

const IDENTITY_KIND_BY_SEMANTIC_TAG = new Map([
  ['clinical drug', 'generic_medicine'],
  ['product name', 'brand_name'],
  ['real clinical drug', 'branded_medicine'],
  ['real medicinal product', 'branded_product'],
  ['supplier', 'supplier'],
]);
const IDENTITY_KINDS = new Set(IDENTITY_KIND_BY_SEMANTIC_TAG.values());

const RF2_HEADERS = new Map([
  ['concept', ['id', 'effectiveTime', 'active', 'moduleId', 'definitionStatusId']],
  ['description', [
    'id', 'effectiveTime', 'active', 'moduleId', 'conceptId', 'languageCode',
    'typeId', 'term', 'caseSignificanceId',
  ]],
  ['relationship', [
    'id', 'effectiveTime', 'active', 'moduleId', 'sourceId', 'destinationId',
    'relationshipGroup', 'typeId', 'characteristicTypeId', 'modifierId',
  ]],
  ['concreteRelationship', [
    'id', 'effectiveTime', 'active', 'moduleId', 'sourceId', 'value',
    'relationshipGroup', 'typeId', 'characteristicTypeId', 'modifierId',
  ]],
  ['moduleDependency', [
    'id', 'effectiveTime', 'active', 'moduleId', 'refsetId',
    'referencedComponentId', 'sourceEffectiveTime', 'targetEffectiveTime',
  ]],
  ['language', [
    'id', 'effectiveTime', 'active', 'moduleId', 'refsetId',
    'referencedComponentId', 'acceptabilityId',
  ]],
  ['association', [
    'id', 'effectiveTime', 'active', 'moduleId', 'refsetId',
    'referencedComponentId', 'targetComponentId',
  ]],
  ['attributeValue', [
    'id', 'effectiveTime', 'active', 'moduleId', 'refsetId',
    'referencedComponentId', 'valueId',
  ]],
]);

const RF2_SCTID_FIELDS = new Map([
  ['concept', ['id', 'moduleId', 'definitionStatusId']],
  ['description', ['id', 'moduleId', 'conceptId', 'typeId', 'caseSignificanceId']],
  ['relationship', [
    'id', 'moduleId', 'sourceId', 'destinationId', 'typeId',
    'characteristicTypeId', 'modifierId',
  ]],
  ['concreteRelationship', [
    'id', 'moduleId', 'sourceId', 'typeId', 'characteristicTypeId', 'modifierId',
  ]],
  ['moduleDependency', ['moduleId', 'refsetId', 'referencedComponentId']],
  ['language', ['moduleId', 'refsetId', 'referencedComponentId', 'acceptabilityId']],
  ['association', ['moduleId', 'refsetId', 'referencedComponentId', 'targetComponentId']],
  ['attributeValue', ['moduleId', 'refsetId', 'referencedComponentId', 'valueId']],
]);

const RF2_UUID_ID_TABLES = new Set([
  'moduleDependency', 'language', 'association', 'attributeValue',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function requireExactKeys(value, keys, label) {
  if (!isObject(value)) throw new TypeError(`${label} must be an object`);
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label} has unexpected key "${key}"`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) throw new TypeError(`${label} is missing key "${key}"`);
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty trimmed string`);
  }
  return value;
}

function requireDate(value, label) {
  requireString(value, label);
  if (!DATE_PATTERN.test(value)) throw new TypeError(`${label} must use YYYYMMDD`);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new TypeError(`${label} is not a calendar date`);
  }
  return value;
}

function requireSha256(value, label) {
  if (!SHA256_PATTERN.test(value ?? '')) {
    throw new TypeError(`${label} must be a lowercase SHA-256`);
  }
  return value;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function invalidRf2Field(member, lineNumber, field, requirement) {
  throw new Error(`${member}:${lineNumber}: ${field} ${requirement}`);
}

function validateRf2TypedFields(table, row, member, lineNumber) {
  requireDate(row.effectiveTime, `${member}:${lineNumber}: effectiveTime`);
  if (RF2_UUID_ID_TABLES.has(table) && !UUID_PATTERN.test(row.id)) {
    invalidRf2Field(member, lineNumber, 'id', 'must be an RF2 UUID');
  }
  for (const field of RF2_SCTID_FIELDS.get(table) ?? []) {
    if (!SCTID_PATTERN.test(row[field])) {
      invalidRf2Field(member, lineNumber, field, 'must be a numeric SCTID');
    }
  }
  if (table === 'description') {
    if (!/^[a-z]{2}$/u.test(row.languageCode)) {
      invalidRf2Field(member, lineNumber, 'languageCode', 'must be a two-letter code');
    }
    if (row.term.length === 0) invalidRf2Field(member, lineNumber, 'term', 'must not be empty');
  }
  if (table === 'relationship' || table === 'concreteRelationship') {
    if (!RELATIONSHIP_GROUP_PATTERN.test(row.relationshipGroup)
      || !Number.isSafeInteger(Number(row.relationshipGroup))) {
      invalidRf2Field(
        member,
        lineNumber,
        'relationshipGroup',
        'must be a non-negative safe integer',
      );
    }
  }
  if (table === 'concreteRelationship' && !CONCRETE_VALUE_PATTERN.test(row.value)) {
    invalidRf2Field(member, lineNumber, 'value', 'must be a valid RF2 concrete value');
  }
  if (table === 'moduleDependency') {
    requireDate(row.sourceEffectiveTime, `${member}:${lineNumber}: sourceEffectiveTime`);
    requireDate(row.targetEffectiveTime, `${member}:${lineNumber}: targetEffectiveTime`);
  }
}

function requireRestrictedPath(value, label) {
  requireString(value, label);
  if (value.includes('\\') || value.includes('\0') || value.startsWith('/')) {
    throw new TypeError(`${label} must be a repository-relative POSIX path`);
  }
  const parts = value.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new TypeError(`${label} must be a normalized repository-relative path`);
  }
  if (value !== RESTRICTED_ZONE && !value.startsWith(`${RESTRICTED_ZONE}/`)) {
    throw new TypeError(`${label} must stay inside ${RESTRICTED_ZONE}`);
  }
  return value;
}

function pathsOverlap(left, right) {
  return left === right
    || left.startsWith(`${right}/`)
    || right.startsWith(`${left}/`);
}

export function validateCdciReleaseConfig(value) {
  requireExactKeys(
    value,
    [
      'schema_version', 'source_id', 'profile', 'extension', 'international',
      'output', 'expected_output',
    ],
    'CDCI release config',
  );
  if (value.schema_version !== 1) throw new TypeError('CDCI release config schema_version must be 1');
  if (value.source_id !== 'cdci-snomed-ct') {
    throw new TypeError('CDCI release config source_id must be cdci-snomed-ct');
  }
  if (value.profile !== 'internal-evaluation') {
    throw new TypeError('CDCI release config profile must be internal-evaluation');
  }

  requireExactKeys(
    value.extension,
    ['storage_path', 'sha256', 'package_effective_time'],
    'CDCI release config extension',
  );
  requireRestrictedPath(value.extension.storage_path, 'extension.storage_path');
  requireSha256(value.extension.sha256, 'extension.sha256');
  requireDate(value.extension.package_effective_time, 'extension.package_effective_time');

  requireExactKeys(
    value.international,
    [
      'storage_path', 'sha256', 'package_effective_time',
      'dependency_view_effective_time', 'selection_strategy',
    ],
    'CDCI release config international',
  );
  requireRestrictedPath(value.international.storage_path, 'international.storage_path');
  requireSha256(value.international.sha256, 'international.sha256');
  requireDate(value.international.package_effective_time, 'international.package_effective_time');
  requireDate(
    value.international.dependency_view_effective_time,
    'international.dependency_view_effective_time',
  );
  if (value.international.selection_strategy !== 'full_as_of_dependency') {
    throw new TypeError('international.selection_strategy must be full_as_of_dependency');
  }
  if (
    value.international.package_effective_time
    < value.international.dependency_view_effective_time
  ) {
    throw new TypeError('International package cannot predate the dependency view');
  }

  requireExactKeys(value.output, ['storage_path'], 'CDCI release config output');
  requireRestrictedPath(value.output.storage_path, 'output.storage_path');
  if ([value.extension.storage_path, value.international.storage_path].some(
    (archivePath) => pathsOverlap(value.output.storage_path, archivePath),
  )) {
    throw new TypeError('CDCI output path must not overlap an input archive path');
  }

  requireExactKeys(
    value.expected_output,
    [
      'active_extension_concept_count', 'identity_count',
      'identity_kinds', 'quarantined_concept_count',
      'quarantined_concept_ids_sha256', 'artifact_sha256',
    ],
    'CDCI release config expected_output',
  );
  requireNonNegativeInteger(
    value.expected_output.active_extension_concept_count,
    'expected_output.active_extension_concept_count',
  );
  requireNonNegativeInteger(value.expected_output.identity_count, 'expected_output.identity_count');
  if (!isObject(value.expected_output.identity_kinds)) {
    throw new TypeError('expected_output.identity_kinds must be an object');
  }
  const identityKinds = {};
  for (const kind of Object.keys(value.expected_output.identity_kinds).sort(compareCodePoint)) {
    if (!IDENTITY_KINDS.has(kind)) {
      throw new TypeError(`expected_output.identity_kinds has unknown kind "${kind}"`);
    }
    identityKinds[kind] = requireNonNegativeInteger(
      value.expected_output.identity_kinds[kind],
      `expected_output.identity_kinds.${kind}`,
    );
  }
  if (Object.keys(identityKinds).length === 0) {
    throw new TypeError('expected_output.identity_kinds must not be empty');
  }
  if (Object.values(identityKinds).reduce((sum, count) => sum + count, 0)
    !== value.expected_output.identity_count) {
    throw new TypeError('expected_output.identity_kinds must sum to identity_count');
  }
  requireNonNegativeInteger(
    value.expected_output.quarantined_concept_count,
    'expected_output.quarantined_concept_count',
  );
  requireSha256(
    value.expected_output.quarantined_concept_ids_sha256,
    'expected_output.quarantined_concept_ids_sha256',
  );
  let artifactSha256 = null;
  if (value.expected_output.artifact_sha256 !== null) {
    requireExactKeys(
      value.expected_output.artifact_sha256,
      ['identities', 'quarantine'],
      'expected_output.artifact_sha256',
    );
    artifactSha256 = Object.freeze({
      identities: requireSha256(
        value.expected_output.artifact_sha256.identities,
        'expected_output.artifact_sha256.identities',
      ),
      quarantine: requireSha256(
        value.expected_output.artifact_sha256.quarantine,
        'expected_output.artifact_sha256.quarantine',
      ),
    });
  }

  return Object.freeze({
    schema_version: value.schema_version,
    source_id: value.source_id,
    profile: value.profile,
    extension: Object.freeze({
      storage_path: value.extension.storage_path,
      sha256: value.extension.sha256,
      package_effective_time: value.extension.package_effective_time,
    }),
    international: Object.freeze({
      storage_path: value.international.storage_path,
      sha256: value.international.sha256,
      package_effective_time: value.international.package_effective_time,
      dependency_view_effective_time: value.international.dependency_view_effective_time,
      selection_strategy: value.international.selection_strategy,
    }),
    output: Object.freeze({ storage_path: value.output.storage_path }),
    expected_output: Object.freeze({
      active_extension_concept_count: value.expected_output.active_extension_concept_count,
      identity_count: value.expected_output.identity_count,
      identity_kinds: Object.freeze(identityKinds),
      quarantined_concept_count: value.expected_output.quarantined_concept_count,
      quarantined_concept_ids_sha256:
        value.expected_output.quarantined_concept_ids_sha256,
      artifact_sha256: artifactSha256,
    }),
  });
}

export function parseRf2Record({ table, member, lineNumber, header, line }) {
  const columns = RF2_HEADERS.get(table);
  if (!columns) throw new TypeError(`unsupported RF2 table ${table}`);
  requireString(member, 'RF2 member');
  if (!Number.isSafeInteger(lineNumber) || lineNumber < 2) {
    throw new TypeError('RF2 lineNumber must be an integer greater than 1');
  }
  const expectedHeader = columns.join('\t');
  if (header !== expectedHeader) {
    throw new Error(`${member}: invalid ${table} RF2 header`);
  }
  if (typeof line !== 'string') throw new TypeError(`${member}:${lineNumber} must be text`);
  const fields = line.split('\t');
  if (fields.length !== columns.length) {
    throw new Error(
      `${member}:${lineNumber}: expected ${columns.length} fields but observed ${fields.length}`,
    );
  }
  const row = Object.fromEntries(columns.map((column, index) => [column, fields[index]]));
  if (!['0', '1'].includes(row.active)) {
    throw new Error(`${member}:${lineNumber}: active must be 0 or 1`);
  }
  validateRf2TypedFields(table, row, member, lineNumber);
  return row;
}

export function deriveCdciDependencyPlan(rows) {
  if (!Array.isArray(rows)) throw new TypeError('module dependency rows must be an array');
  const active = rows.filter((row) => row?.active === '1');
  if (active.length === 0) throw new Error('CDCI requires at least one active module dependency');
  const sourceTimes = new Set();
  const targetTimes = new Set();
  const targetModuleIds = new Set();
  for (const row of active) {
    sourceTimes.add(requireDate(row.sourceEffectiveTime, 'module dependency sourceEffectiveTime'));
    targetTimes.add(requireDate(row.targetEffectiveTime, 'module dependency targetEffectiveTime'));
    targetModuleIds.add(requireString(
      row.referencedComponentId,
      'module dependency referencedComponentId',
    ));
  }
  if (sourceTimes.size !== 1) throw new Error('CDCI has conflicting source effective times');
  if (targetTimes.size !== 1) throw new Error('CDCI has conflicting target effective times');
  return {
    source_effective_time: [...sourceTimes][0],
    target_effective_time: [...targetTimes][0],
    target_module_ids: [...targetModuleIds].sort(compareCodePoint),
  };
}

export function selectLatestRowsAsOf(rows, {
  targetEffectiveTime,
  idField = 'id',
  label = 'RF2 Full table',
} = {}) {
  if (!Array.isArray(rows)) throw new TypeError(`${label} rows must be an array`);
  requireDate(targetEffectiveTime, 'targetEffectiveTime');
  const selected = new Map();
  for (const row of rows) {
    const id = requireString(row?.[idField], `${label} ${idField}`);
    if (row.effectiveTime === '') throw new Error(`${label} row ${id} has blank effectiveTime`);
    requireDate(row.effectiveTime, `${label} row ${id} effectiveTime`);
    if (row.effectiveTime > targetEffectiveTime) continue;
    const previous = selected.get(id);
    if (!previous || previous.effectiveTime < row.effectiveTime) {
      selected.set(id, row);
    } else if (previous.effectiveTime === row.effectiveTime) {
      throw new Error(`${label} contains duplicate ${idField} ${id} at ${row.effectiveTime}`);
    }
  }
  return selected;
}

export function semanticTagFromFsn(term) {
  if (typeof term !== 'string') return null;
  const match = term.match(/\(([^()]+)\)$/u);
  return match?.[1] ?? null;
}

function activeFsnsByConcept(descriptions) {
  const fsns = new Map();
  for (const [conceptId, values] of descriptions) {
    const matches = values.filter(
      (description) => description.active === '1' && description.typeId === SNOMED_FSN_TYPE_ID,
    );
    if (matches.length === 1) fsns.set(conceptId, matches[0].term);
  }
  return fsns;
}

function sortedReasons(reasons) {
  const unique = new Map();
  for (const reason of reasons) unique.set(`${reason.code}\0${reason.concept_id ?? ''}`, reason);
  return [...unique.values()].sort((left, right) => (
    compareCodePoint(left.code, right.code)
    || compareCodePoint(left.concept_id ?? '', right.concept_id ?? '')
  ));
}

function relationshipSort(left, right) {
  return Number(left.relationshipGroup) - Number(right.relationshipGroup)
    || compareCodePoint(left.typeId, right.typeId)
    || compareCodePoint(left.destinationId ?? left.value, right.destinationId ?? right.value)
    || compareCodePoint(left.id, right.id);
}

export function buildCdciIdentityRecords({
  concepts,
  descriptions,
  relationships,
  concreteRelationships,
  languageAcceptability,
  internationalConcepts,
  internationalFsns,
}) {
  for (const [label, value] of Object.entries({
    concepts,
    descriptions,
    relationships,
    concreteRelationships,
    languageAcceptability,
    internationalConcepts,
    internationalFsns,
  })) {
    if (!(value instanceof Map)) throw new TypeError(`${label} must be a Map`);
  }

  const extensionFsns = activeFsnsByConcept(descriptions);
  const records = [];
  const quarantined = [];

  function referenceStatus(conceptId) {
    const extension = concepts.get(conceptId);
    if (extension) {
      return extension.active === '1'
        ? null
        : { code: 'inactive_extension_reference', concept_id: conceptId };
    }
    const international = internationalConcepts.get(conceptId);
    if (!international) return { code: 'missing_reference', concept_id: conceptId };
    return international.active === '1'
      ? null
      : { code: 'inactive_international_reference', concept_id: conceptId };
  }

  function referenceFsn(conceptId) {
    return extensionFsns.get(conceptId) ?? internationalFsns.get(conceptId) ?? null;
  }

  for (const conceptId of [...concepts.keys()].sort(compareCodePoint)) {
    const concept = concepts.get(conceptId);
    if (concept.active !== '1') continue;
    const activeDescriptions = (descriptions.get(conceptId) ?? [])
      .filter((description) => description.active === '1')
      .sort((left, right) => compareCodePoint(left.id, right.id));
    const fsnDescriptions = activeDescriptions.filter(
      (description) => description.typeId === SNOMED_FSN_TYPE_ID,
    );
    const fsn = fsnDescriptions.length === 1 ? fsnDescriptions[0].term : null;
    if (fsnDescriptions.length !== 1) {
      quarantined.push({
        schema_version: CDCI_IDENTITY_SCHEMA_VERSION,
        source_policy_id: 'cdci-snomed-ct',
        profile: 'internal-evaluation',
        concept_id: conceptId,
        fsn,
        semantic_tag: null,
        review_status: 'quarantined',
        runtime_authority: 'none',
        reasons: [{ code: fsnDescriptions.length === 0 ? 'missing_fsn' : 'ambiguous_fsn' }],
      });
      continue;
    }

    const tag = semanticTagFromFsn(fsn);
    const identityKind = IDENTITY_KIND_BY_SEMANTIC_TAG.get(tag);
    if (!identityKind) continue;

    const reasons = [];
    const conceptModule = referenceStatus(concept.moduleId);
    if (conceptModule) reasons.push(conceptModule);
    const definitionStatus = referenceStatus(concept.definitionStatusId);
    if (definitionStatus) reasons.push(definitionStatus);
    for (const description of activeDescriptions) {
      for (const referencedId of [
        description.moduleId,
        description.typeId,
        description.caseSignificanceId,
      ]) {
        const status = referenceStatus(referencedId);
        if (status) reasons.push(status);
      }
      for (const entry of languageAcceptability.get(description.id) ?? []) {
        if (entry.active !== undefined && entry.active !== '1') continue;
        for (const referencedId of [entry.moduleId, entry.refsetId, entry.acceptabilityId]) {
          const status = referenceStatus(referencedId);
          if (status) reasons.push(status);
        }
      }
    }

    const activeRelationships = (relationships.get(conceptId) ?? [])
      .filter((relationship) => relationship.active === '1')
      .sort(relationshipSort);
    for (const relationship of activeRelationships) {
      for (const referencedId of [
        relationship.moduleId,
        relationship.destinationId,
        relationship.typeId,
        relationship.characteristicTypeId,
        relationship.modifierId,
      ]) {
        const status = referenceStatus(referencedId);
        if (status) reasons.push(status);
      }
      for (const referencedId of [relationship.destinationId, relationship.typeId]) {
        if (!referenceFsn(referencedId)) {
          reasons.push({ code: 'missing_reference_fsn', concept_id: referencedId });
        }
      }
    }

    const activeConcreteRelationships = (concreteRelationships.get(conceptId) ?? [])
      .filter((relationship) => relationship.active === '1')
      .sort(relationshipSort);
    for (const relationship of activeConcreteRelationships) {
      for (const referencedId of [
        relationship.moduleId,
        relationship.typeId,
        relationship.characteristicTypeId,
        relationship.modifierId,
      ]) {
        const status = referenceStatus(referencedId);
        if (status) reasons.push(status);
      }
      if (!referenceFsn(relationship.typeId)) {
        reasons.push({ code: 'missing_reference_fsn', concept_id: relationship.typeId });
      }
    }

    const finalReasons = sortedReasons(reasons);
    if (finalReasons.length > 0) {
      quarantined.push({
        schema_version: CDCI_IDENTITY_SCHEMA_VERSION,
        source_policy_id: 'cdci-snomed-ct',
        profile: 'internal-evaluation',
        concept_id: conceptId,
        fsn,
        semantic_tag: tag,
        review_status: 'quarantined',
        runtime_authority: 'none',
        reasons: finalReasons,
      });
      continue;
    }

    const assertion = {
      source_policy_id: 'cdci-snomed-ct',
      concept_id: conceptId,
      effective_time: concept.effectiveTime,
      module_id: concept.moduleId,
      active: true,
      identity_kind: identityKind,
      semantic_tag: tag,
      fsn,
      descriptions: activeDescriptions.map((description) => ({
        description_id: description.id,
        effective_time: description.effectiveTime,
        type_id: description.typeId,
        term: description.term,
        case_significance_id: description.caseSignificanceId,
        acceptability: [...(languageAcceptability.get(description.id) ?? [])]
          .filter((entry) => entry.active === undefined || entry.active === '1')
          .map((entry) => ({
            refset_id: entry.refsetId,
            acceptability_id: entry.acceptabilityId,
          }))
          .sort((left, right) => (
            compareCodePoint(left.refset_id, right.refset_id)
            || compareCodePoint(left.acceptability_id, right.acceptability_id)
          )),
      })),
      relationships: activeRelationships.map((relationship) => ({
        relationship_id: relationship.id,
        effective_time: relationship.effectiveTime,
        relationship_group: Number(relationship.relationshipGroup),
        type_id: relationship.typeId,
        type_fsn: referenceFsn(relationship.typeId),
        destination_id: relationship.destinationId,
        destination_fsn: referenceFsn(relationship.destinationId),
        characteristic_type_id: relationship.characteristicTypeId,
        modifier_id: relationship.modifierId,
      })),
      concrete_relationships: activeConcreteRelationships.map((relationship) => ({
        relationship_id: relationship.id,
        effective_time: relationship.effectiveTime,
        relationship_group: Number(relationship.relationshipGroup),
        type_id: relationship.typeId,
        type_fsn: referenceFsn(relationship.typeId),
        value: relationship.value,
        characteristic_type_id: relationship.characteristicTypeId,
        modifier_id: relationship.modifierId,
      })),
    };
    records.push({
      schema_version: CDCI_IDENTITY_SCHEMA_VERSION,
      profile: 'internal-evaluation',
      ...assertion,
      assertion_sha256: sha256(JSON.stringify(assertion)),
      review_status: 'review_candidate',
      runtime_authority: 'none',
    });
  }

  return { records, quarantined };
}
