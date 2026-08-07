import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  SNOMED_FSN_TYPE_ID,
  buildCdciIdentityRecords,
  deriveCdciDependencyPlan,
  parseRf2Record,
  selectLatestRowsAsOf,
  validateCdciReleaseConfig,
} from '../adapters/cdci.mjs';
import {
  assertArtifactProvenance,
  assertSourceAllowed,
  loadSourceManifest,
} from './interaction-source-policy.mjs';
import { streamZipTextEntries } from './zip-entry-stream.mjs';

export const CDCI_INDEX_SUMMARY_SCHEMA_VERSION = 1;

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function addGrouped(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function addUnique(seen, row, member, lineNumber) {
  if (seen.has(row.id)) {
    throw new Error(`${member}:${lineNumber}: duplicate RF2 id ${row.id}`);
  }
  seen.add(row.id);
}

function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function storagePath(...parts) {
  return path.posix.join(...parts.map((part) => part.replaceAll('\\', '/')));
}

function resolveStoragePath(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...relativePath.split('/'));
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`storage path escapes repository root: ${relativePath}`);
  }
  return resolved;
}

function assertPhysicalDirectoryPath(directory, label) {
  const absolute = path.resolve(directory);
  const parsed = path.parse(absolute);
  const relative = path.relative(parsed.root, absolute);
  const segments = relative === '' ? [] : relative.split(path.sep);
  let current = parsed.root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const stats = fs.lstatSync(current);
    if (stats.isSymbolicLink()) {
      throw new Error(`${label} may not contain a symbolic link, junction, or reparse point`);
    }
    if (!stats.isDirectory()) throw new Error(`${label} must contain only physical directories`);
  }
  return fs.realpathSync(absolute);
}

function assertInsidePhysicalRestrictedRoot(file, restrictedRoot, label) {
  const realRoot = assertPhysicalDirectoryPath(restrictedRoot, 'CDCI restricted root');
  assertPhysicalDirectoryPath(path.dirname(file), `${label} parent path`);
  const fileStats = fs.lstatSync(file);
  if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
    throw new Error(`${label} must be a physical regular file`);
  }
  const realFile = fs.realpathSync(file);
  const relative = path.relative(realRoot, realFile);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)) {
    throw new Error(`${label} must remain inside the physical CDCI restricted root`);
  }
}

function assertPhysicalRestrictedOutput(output, restrictedRoot) {
  const realRoot = assertPhysicalDirectoryPath(restrictedRoot, 'CDCI restricted root');
  const realParent = assertPhysicalDirectoryPath(path.dirname(output), 'CDCI output parent path');
  const relative = path.relative(realRoot, realParent);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('CDCI output parent must remain inside the physical CDCI restricted root');
  }
  if (fs.existsSync(output)) assertPhysicalDirectoryPath(output, 'CDCI output path');
}

async function readConfig(configPath) {
  let text;
  try {
    text = await fsp.readFile(configPath, 'utf8');
  } catch (error) {
    throw new Error(`cannot read CDCI release config at ${configPath}: ${error.message}`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid CDCI release config JSON at ${configPath}: ${error.message}`);
  }
  return validateCdciReleaseConfig(value);
}

function packageNames(config) {
  const extensionArchive = path.posix.basename(config.extension.storage_path);
  const internationalArchive = path.posix.basename(config.international.storage_path);
  const expectedExtension = `SnomedCT_IndiaDrugExtensionRF2_PRODUCTION_IN1000189_${config.extension.package_effective_time}T120000Z.zip`;
  const expectedInternational = `SnomedCT_InternationalRF2_PRODUCTION_${config.international.package_effective_time}T120000Z.zip`;
  if (extensionArchive !== expectedExtension) {
    throw new Error(`CDCI extension archive role mismatch: expected ${expectedExtension}`);
  }
  if (internationalArchive !== expectedInternational) {
    throw new Error(`SNOMED International archive role mismatch: expected ${expectedInternational}`);
  }
  return {
    extensionArchive,
    extensionRoot: extensionArchive.slice(0, -4),
    internationalArchive,
    internationalRoot: internationalArchive.slice(0, -4),
  };
}

function extensionMembers(config, names) {
  const suffix = `IN1000189_${config.extension.package_effective_time}T120000Z`;
  const root = names.extensionRoot;
  return {
    concept: `${root}/Snapshot/Terminology/sct2_Concept_Snapshot_${suffix}.txt`,
    description: `${root}/Snapshot/Terminology/sct2_Description_Snapshot-en_${suffix}.txt`,
    concreteRelationship:
      `${root}/Snapshot/Terminology/sct2_RelationshipConcreteValues_Snapshot_${suffix}.txt`,
    relationship: `${root}/Snapshot/Terminology/sct2_Relationship_Snapshot_${suffix}.txt`,
    association:
      `${root}/Snapshot/Refset/Content/der2_cRefset_AssociationSnapshot_${suffix}.txt`,
    attributeValue:
      `${root}/Snapshot/Refset/Content/der2_cRefset_AttributeValueSnapshot_${suffix}.txt`,
    language:
      `${root}/Snapshot/Refset/Language/der2_cRefset_LanguageSnapshot-en_${suffix}.txt`,
    moduleDependency:
      `${root}/Snapshot/Refset/Metadata/der2_ssRefset_ModuleDependencySnapshot_${suffix}.txt`,
  };
}

function internationalMembers(config, names) {
  const date = config.international.package_effective_time;
  const root = names.internationalRoot;
  return {
    releaseInformation: `${root}/release_package_information.json`,
    concept: `${root}/Full/Terminology/sct2_Concept_Full_INT_${date}.txt`,
    description: `${root}/Full/Terminology/sct2_Description_Full-en_INT_${date}.txt`,
  };
}

function validateExtensionReferences(data) {
  const descriptionIds = new Set();
  for (const values of data.descriptions.values()) {
    for (const value of values) descriptionIds.add(value.id);
  }
  for (const [conceptId, descriptions] of data.descriptions) {
    if (!data.concepts.has(conceptId)) {
      throw new Error(
        `CDCI description ${descriptions[0]?.id ?? '<unknown>'} references missing concept ${conceptId}`,
      );
    }
  }
  for (const [sourceId, relationships] of data.relationships) {
    if (!data.concepts.has(sourceId)) {
      throw new Error(
        `CDCI relationship ${relationships[0]?.id ?? '<unknown>'} has missing source ${sourceId}`,
      );
    }
  }
  for (const [sourceId, relationships] of data.concreteRelationships) {
    if (!data.concepts.has(sourceId)) {
      throw new Error(
        `CDCI concrete relationship ${relationships[0]?.id ?? '<unknown>'} has missing source ${sourceId}`,
      );
    }
  }
  for (const [descriptionId] of data.languageAcceptability) {
    if (!descriptionIds.has(descriptionId)) {
      throw new Error(`CDCI language refset references missing description ${descriptionId}`);
    }
  }
}

function collectRequiredInternationalIds(data, dependencyPlan) {
  const ids = new Set(dependencyPlan.target_module_ids);
  for (const concept of data.concepts.values()) {
    if (concept.active !== '1') continue;
    ids.add(concept.moduleId);
    ids.add(concept.definitionStatusId);
  }
  for (const values of data.descriptions.values()) {
    for (const description of values) {
      if (description.active !== '1') continue;
      ids.add(description.moduleId);
      ids.add(description.typeId);
      ids.add(description.caseSignificanceId);
    }
  }
  for (const values of data.relationships.values()) {
    for (const relationship of values) {
      if (relationship.active !== '1') continue;
      ids.add(relationship.moduleId);
      ids.add(relationship.destinationId);
      ids.add(relationship.typeId);
      ids.add(relationship.characteristicTypeId);
      ids.add(relationship.modifierId);
    }
  }
  for (const values of data.concreteRelationships.values()) {
    for (const relationship of values) {
      if (relationship.active !== '1') continue;
      ids.add(relationship.moduleId);
      ids.add(relationship.typeId);
      ids.add(relationship.characteristicTypeId);
      ids.add(relationship.modifierId);
    }
  }
  for (const values of data.languageAcceptability.values()) {
    for (const entry of values) {
      if (entry.active !== '1') continue;
      ids.add(entry.moduleId);
      ids.add(entry.refsetId);
      ids.add(entry.acceptabilityId);
    }
  }
  for (const row of data.moduleDependencies) {
    if (row.active !== '1') continue;
    ids.add(row.moduleId);
    ids.add(row.refsetId);
    ids.add(row.referencedComponentId);
  }
  for (const row of data.associations) {
    if (row.active !== '1') continue;
    ids.add(row.moduleId);
    ids.add(row.refsetId);
    ids.add(row.targetComponentId);
  }
  for (const row of data.attributeValues) {
    if (row.active !== '1') continue;
    ids.add(row.moduleId);
    ids.add(row.refsetId);
    ids.add(row.valueId);
  }
  for (const conceptId of data.concepts.keys()) ids.delete(conceptId);
  return ids;
}

async function readExtensionArchive(file, config, members) {
  const tableByMember = new Map(Object.entries(members).map(([table, member]) => [member, table]));
  const headers = new Map();
  const seen = new Map([...tableByMember.keys()].map((member) => [member, new Set()]));
  const concepts = new Map();
  const descriptions = new Map();
  const relationships = new Map();
  const concreteRelationships = new Map();
  const languageAcceptability = new Map();
  const moduleDependencies = [];
  const associations = [];
  const attributeValues = [];

  const archive = await streamZipTextEntries(file, {
    selectEntry: (name) => tableByMember.has(name),
    requiredEntries: [...tableByMember.keys()],
    stopAfterRequired: true,
    expectedSha256: config.extension.sha256,
    onLine: ({ entryName, lineNumber, text }) => {
      const table = tableByMember.get(entryName);
      if (lineNumber === 1) {
        headers.set(entryName, text);
        return;
      }
      const row = parseRf2Record({
        table,
        member: entryName,
        lineNumber,
        header: headers.get(entryName),
        line: text,
      });
      addUnique(seen.get(entryName), row, entryName, lineNumber);
      if (table === 'concept') concepts.set(row.id, row);
      else if (table === 'description') addGrouped(descriptions, row.conceptId, row);
      else if (table === 'relationship') addGrouped(relationships, row.sourceId, row);
      else if (table === 'concreteRelationship') {
        addGrouped(concreteRelationships, row.sourceId, row);
      } else if (table === 'language') {
        addGrouped(languageAcceptability, row.referencedComponentId, row);
      } else if (table === 'moduleDependency') moduleDependencies.push(row);
      else if (table === 'association') associations.push(row);
      else if (table === 'attributeValue') attributeValues.push(row);
    },
  });

  const data = {
    concepts,
    descriptions,
    relationships,
    concreteRelationships,
    languageAcceptability,
    moduleDependencies,
    associations,
    attributeValues,
  };
  validateExtensionReferences(data);
  const dependencyPlan = deriveCdciDependencyPlan(moduleDependencies);
  if (dependencyPlan.source_effective_time !== config.extension.package_effective_time) {
    throw new Error(
      `CDCI module dependency source ${dependencyPlan.source_effective_time} does not match extension package ${config.extension.package_effective_time}`,
    );
  }
  if (
    dependencyPlan.target_effective_time
    !== config.international.dependency_view_effective_time
  ) {
    throw new Error(
      `CDCI module dependency target ${dependencyPlan.target_effective_time} does not match configured dependency view ${config.international.dependency_view_effective_time}`,
    );
  }
  return { data, dependencyPlan, archive };
}

function parseReleaseInformation(text, config, dependencyPlan) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid SNOMED International release_package_information.json: ${error.message}`);
  }
  if (value?.effectiveTime !== config.international.package_effective_time) {
    throw new Error(
      `SNOMED International effectiveTime ${value?.effectiveTime ?? '<missing>'} does not match configured package ${config.international.package_effective_time}`,
    );
  }
  const declaredPackage =
    `SnomedCT_InternationalRF2_PRODUCTION_${dependencyPlan.target_effective_time}T120000Z.zip`;
  if (value.previousPublishedPackage !== declaredPackage) {
    throw new Error(
      `SNOMED International package is not the pinned direct successor of ${declaredPackage}`,
    );
  }
  return { value, declaredPackage };
}

async function readInternationalDependencyView(
  file,
  config,
  members,
  requiredConceptIds,
  dependencyPlan,
) {
  const headers = new Map();
  const conceptRows = [];
  const descriptionRows = [];
  const releaseLines = [];
  const tableByMember = new Map([
    [members.concept, 'concept'],
    [members.description, 'description'],
  ]);
  const requiredEntries = Object.values(members);

  const archive = await streamZipTextEntries(file, {
    selectEntry: (name) => requiredEntries.includes(name),
    requiredEntries,
    stopAfterRequired: true,
    expectedSha256: config.international.sha256,
    onLine: ({ entryName, lineNumber, text }) => {
      if (entryName === members.releaseInformation) {
        releaseLines.push(text);
        return;
      }
      const table = tableByMember.get(entryName);
      if (lineNumber === 1) {
        headers.set(entryName, text);
        return;
      }
      const row = parseRf2Record({
        table,
        member: entryName,
        lineNumber,
        header: headers.get(entryName),
        line: text,
      });
      if (table === 'concept' && requiredConceptIds.has(row.id)) conceptRows.push(row);
      if (
        table === 'description'
        && requiredConceptIds.has(row.conceptId)
      ) {
        descriptionRows.push(row);
      }
    },
  });

  const release = parseReleaseInformation(
    `${releaseLines.join('\n')}\n`,
    config,
    dependencyPlan,
  );
  const concepts = selectLatestRowsAsOf(conceptRows, {
    targetEffectiveTime: dependencyPlan.target_effective_time,
    label: 'SNOMED International Concept Full',
  });
  const descriptions = selectLatestRowsAsOf(descriptionRows, {
    targetEffectiveTime: dependencyPlan.target_effective_time,
    label: 'SNOMED International Description Full',
  });
  const fsnLists = new Map();
  for (const description of descriptions.values()) {
    if (description.active !== '1' || description.typeId !== SNOMED_FSN_TYPE_ID) continue;
    addGrouped(fsnLists, description.conceptId, description.term);
  }
  const fsns = new Map();
  for (const [conceptId, terms] of fsnLists) {
    if (terms.length === 1) fsns.set(conceptId, terms[0]);
  }
  for (const moduleId of dependencyPlan.target_module_ids) {
    const module = concepts.get(moduleId);
    if (!module || module.active !== '1') {
      throw new Error(`declared International target module ${moduleId} is unavailable at ${dependencyPlan.target_effective_time}`);
    }
  }
  return {
    concepts,
    fsns,
    archive,
    releaseInformation: release.value,
    declaredPackage: release.declaredPackage,
  };
}

function countByIdentityKind(records) {
  const counts = new Map();
  for (const record of records) {
    counts.set(record.identity_kind, (counts.get(record.identity_kind) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => (
    compareCodePoint(left, right)
  )));
}

function actualOutputInvariants(extensionData, built) {
  const quarantinedConceptIds = built.quarantined
    .map((record) => record.concept_id)
    .sort(compareCodePoint);
  return {
    active_extension_concept_count: [...extensionData.concepts.values()]
      .filter((concept) => concept.active === '1').length,
    identity_count: built.records.length,
    identity_kinds: countByIdentityKind(built.records),
    quarantined_concept_count: quarantinedConceptIds.length,
    quarantined_concept_ids_sha256:
      sha256Text(`${quarantinedConceptIds.join('\n')}\n`),
    quarantined_concept_ids: quarantinedConceptIds,
  };
}

function assertExpectedOutput(expected, actual) {
  for (const field of [
    'active_extension_concept_count',
    'identity_count',
    'identity_kinds',
    'quarantined_concept_count',
    'quarantined_concept_ids_sha256',
  ]) {
    if (JSON.stringify(actual[field]) !== JSON.stringify(expected[field])) {
      throw new Error(
        `CDCI expected-output invariant mismatch for ${field}: expected ${JSON.stringify(expected[field])}, observed ${JSON.stringify(actual[field])}`,
      );
    }
  }
}

async function writeJsonl(file, rows) {
  const handle = await fsp.open(file, 'wx');
  const hash = createHash('sha256');
  let buffer = '';
  try {
    for (const row of rows) {
      const line = `${JSON.stringify(row)}\n`;
      hash.update(line, 'utf8');
      buffer += line;
      if (Buffer.byteLength(buffer, 'utf8') >= 1024 * 1024) {
        await handle.write(buffer, null, 'utf8');
        buffer = '';
      }
    }
    if (buffer) await handle.write(buffer, null, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

async function writeText(file, text) {
  const handle = await fsp.open(file, 'wx');
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function replaceDirectory(temporary, destination) {
  const backup = `${destination}.backup-${process.pid}-${randomUUID()}`;
  let hadDestination = false;
  try {
    try {
      await fsp.rename(destination, backup);
      hadDestination = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await fsp.rename(temporary, destination);
    } catch (publishError) {
      if (!hadDestination) throw publishError;
      try {
        await fsp.rename(backup, destination);
        hadDestination = false;
      } catch (restoreError) {
        throw new AggregateError(
          [publishError, restoreError],
          `failed to publish CDCI index; previous index remains at ${backup}`,
        );
      }
      throw publishError;
    }
    if (hadDestination) {
      await fsp.rm(backup, { recursive: true, force: true });
      hadDestination = false;
    }
  } finally {
    await fsp.rm(temporary, { recursive: true, force: true }).catch(() => {});
  }
}

export async function buildCdciIdentityIndex({
  root,
  configPath,
  expectedProfile = 'internal-evaluation',
}) {
  if (typeof root !== 'string' || root.trim() === '') throw new TypeError('root is required');
  if (typeof configPath !== 'string' || configPath.trim() === '') {
    throw new TypeError('configPath is required');
  }
  const resolvedRoot = path.resolve(root);
  const resolvedConfigPath = path.resolve(configPath);
  const config = await readConfig(resolvedConfigPath);
  if (config.profile !== expectedProfile) {
    throw new Error(`CDCI config profile ${config.profile} does not match ${expectedProfile}`);
  }

  const names = packageNames(config);
  const extensionPath = resolveStoragePath(resolvedRoot, config.extension.storage_path);
  const internationalPath = resolveStoragePath(resolvedRoot, config.international.storage_path);
  const outputPath = resolveStoragePath(resolvedRoot, config.output.storage_path);
  const restrictedRoot = resolveStoragePath(resolvedRoot, 'data/restricted/cdci');
  assertInsidePhysicalRestrictedRoot(extensionPath, restrictedRoot, 'CDCI extension archive');
  assertInsidePhysicalRestrictedRoot(
    internationalPath,
    restrictedRoot,
    'SNOMED International archive',
  );
  assertPhysicalRestrictedOutput(outputPath, restrictedRoot);
  const sourceManifestPath = path.join(resolvedRoot, 'data-static', 'interaction-sources.json');
  const manifest = loadSourceManifest(sourceManifestPath);
  for (const inputStoragePath of [
    config.extension.storage_path,
    config.international.storage_path,
    config.output.storage_path,
  ]) {
    assertSourceAllowed(manifest, {
      sourceId: config.source_id,
      profile: config.profile,
      use: 'identity',
      storagePath: inputStoragePath,
    });
  }
  const sourcePolicy = assertArtifactProvenance(manifest, {
    sourceIds: [config.source_id],
    profile: config.profile,
    use: 'identity',
    storagePath: config.output.storage_path,
  });

  const extension = await readExtensionArchive(
    extensionPath,
    config,
    extensionMembers(config, names),
  );
  const requiredConceptIds = collectRequiredInternationalIds(
    extension.data,
    extension.dependencyPlan,
  );
  const international = await readInternationalDependencyView(
    internationalPath,
    config,
    internationalMembers(config, names),
    requiredConceptIds,
    extension.dependencyPlan,
  );
  const built = buildCdciIdentityRecords({
    concepts: extension.data.concepts,
    descriptions: extension.data.descriptions,
    relationships: extension.data.relationships,
    concreteRelationships: extension.data.concreteRelationships,
    languageAcceptability: extension.data.languageAcceptability,
    internationalConcepts: international.concepts,
    internationalFsns: international.fsns,
  });
  const outputInvariants = actualOutputInvariants(extension.data, built);
  assertExpectedOutput(config.expected_output, outputInvariants);

  const parent = path.dirname(outputPath);
  await fsp.mkdir(parent, { recursive: true });
  const temporary = path.join(
    parent,
    `.${path.basename(outputPath)}.tmp-${process.pid}-${randomUUID()}`,
  );
  await fsp.mkdir(temporary);
  const identityName = 'identities.jsonl';
  const quarantineName = 'quarantine.jsonl';
  const summaryName = 'summary.json';
  const identityTemporary = path.join(temporary, identityName);
  const quarantineTemporary = path.join(temporary, quarantineName);
  const summaryTemporary = path.join(temporary, summaryName);

  try {
    const identitySha256 = await writeJsonl(identityTemporary, built.records);
    const quarantineSha256 = await writeJsonl(quarantineTemporary, built.quarantined);
    if (config.expected_output.artifact_sha256 !== null) {
      for (const [name, observed] of [
        ['identities', identitySha256],
        ['quarantine', quarantineSha256],
      ]) {
        const expected = config.expected_output.artifact_sha256[name];
        if (observed !== expected) {
          throw new Error(
            `CDCI expected-output invariant mismatch for artifact_sha256.${name}: expected ${expected}, observed ${observed}`,
          );
        }
      }
    }
    const missingReferences = [...requiredConceptIds]
      .filter((conceptId) => !international.concepts.has(conceptId))
      .sort(compareCodePoint);
    const inactiveReferences = [...requiredConceptIds]
      .filter((conceptId) => international.concepts.get(conceptId)?.active === '0')
      .sort(compareCodePoint);
    const summary = {
      schema_version: CDCI_INDEX_SUMMARY_SCHEMA_VERSION,
      source_policy_id: config.source_id,
      profile: config.profile,
      review_status: 'review_candidate',
      runtime_authority: 'none',
      config: {
        storage_path: storagePath(path.relative(resolvedRoot, resolvedConfigPath)),
        sha256: sha256Text(JSON.stringify(config)),
      },
      extension: {
        archive_role: 'declared_extension',
        storage_path: config.extension.storage_path,
        sha256: extension.archive.archiveSha256,
        byte_count: extension.archive.archiveByteCount,
        package_effective_time: config.extension.package_effective_time,
        source_effective_time: extension.dependencyPlan.source_effective_time,
      },
      international_full_reconstruction_source: {
        archive_role: 'later_full_reconstruction_source',
        storage_path: config.international.storage_path,
        sha256: international.archive.archiveSha256,
        byte_count: international.archive.archiveByteCount,
        package_effective_time: config.international.package_effective_time,
        previous_published_package: international.releaseInformation.previousPublishedPackage,
        snapshot_used: false,
      },
      dependency_base: {
        declared_package: international.declaredPackage,
        package_effective_time: extension.dependencyPlan.target_effective_time,
        target_module_ids: extension.dependencyPlan.target_module_ids,
        selection_strategy: config.international.selection_strategy,
      },
      reference_validation: {
        required_international_concept_count: requiredConceptIds.size,
        reconstructed_concept_count: international.concepts.size,
        missing_concept_ids: missingReferences,
        inactive_concept_ids: inactiveReferences,
      },
      counts: {
        active_extension_concept_count: outputInvariants.active_extension_concept_count,
        identity_count: outputInvariants.identity_count,
        identity_kinds: outputInvariants.identity_kinds,
        quarantined_count: outputInvariants.quarantined_concept_count,
        quarantined_concept_ids: outputInvariants.quarantined_concept_ids,
        quarantined_concept_ids_sha256:
          outputInvariants.quarantined_concept_ids_sha256,
        expected_output_verified: true,
        expected_artifact_sha256_verified:
          config.expected_output.artifact_sha256 !== null,
      },
      outputs: {
        identities: {
          storage_path: storagePath(config.output.storage_path, identityName),
          sha256: identitySha256,
          row_count: built.records.length,
        },
        quarantine: {
          storage_path: storagePath(config.output.storage_path, quarantineName),
          sha256: quarantineSha256,
          row_count: built.quarantined.length,
        },
      },
      source_policy: sourcePolicy,
      limitations: [
        'identity-only; no catalogue, availability, interaction, promotion, or runtime authority',
        'licensed CDCI content is restricted and non-redistributable',
      ],
    };
    await writeText(summaryTemporary, `${JSON.stringify(summary, null, 2)}\n`);
    await replaceDirectory(temporary, outputPath);
    return {
      summary,
      identity_output_path: path.join(outputPath, identityName),
      quarantine_output_path: path.join(outputPath, quarantineName),
      summary_output_path: path.join(outputPath, summaryName),
    };
  } catch (error) {
    await fsp.rm(temporary, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export const buildCdciIndex = buildCdciIdentityIndex;
