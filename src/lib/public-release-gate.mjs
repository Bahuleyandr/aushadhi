// Fail-closed public-release licensing gate.
//
// A public release may contain a row only when every source that contributed
// to it is explicitly cleared for the production-open profile by the
// interaction source manifest. Anything else — restricted, unverified,
// disabled, non-redistributable, or simply unlisted — is excluded, and the
// exclusion is recorded with a reason. See docs/PUBLIC_RELEASE_GATE.md and
// docs/LICENSING_REPORT.md.

import {
  assertArtifactProvenance,
  loadSourceManifest,
} from './interaction-source-policy.mjs';

export { loadSourceManifest };

export const PUBLIC_RELEASE_PROFILE = 'production-open';
export const UNLISTED_SOURCE_REASON = 'no manifest entry; unlisted sources fail closed';
const PUBLIC_RELEASE_USE = 'catalogue';
const PUBLIC_RELEASE_STORAGE_PATH = 'data/interaction/production-open';
const PUBLIC_RELEASE_ARTIFACT_PACK = 'open-core';

function fail(message) {
  throw new Error(`public release gate: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clearanceFailures(manifest, sourceId, source, allowedLicenceClasses) {
  const failures = [];
  if (source.licence.verification_status !== 'verified') {
    failures.push(`licence verification status is "${source.licence.verification_status}"`);
  }
  if (source.enabled !== true) {
    failures.push(`source is disabled: ${source.disabled_reasons.join('; ')}`);
  }
  if (source.ingestion_forbidden === true) {
    failures.push('ingestion is forbidden for this source');
  }
  if (source.redistributable !== true) {
    failures.push('source is not marked redistributable');
  }
  if (!source.allowed_profiles.includes(PUBLIC_RELEASE_PROFILE)) {
    failures.push(`source is not allowed in profile "${PUBLIC_RELEASE_PROFILE}"`);
  }
  if (!allowedLicenceClasses.has(source.licence.class)) {
    failures.push(
      `licence class "${source.licence.class}" is not allowed in profile "${PUBLIC_RELEASE_PROFILE}"`,
    );
  }
  if (failures.length === 0) {
    try {
      const provenance = assertArtifactProvenance(manifest, {
        sourceIds: [sourceId],
        profile: PUBLIC_RELEASE_PROFILE,
        use: PUBLIC_RELEASE_USE,
        storagePath: PUBLIC_RELEASE_STORAGE_PATH,
        licenceNotices: {},
      });
      if (provenance.artifact_pack !== PUBLIC_RELEASE_ARTIFACT_PACK) {
        failures.push(
          `artifact pack "${provenance.artifact_pack}" cannot enter the public catalogue pack`,
        );
      }
      if (provenance.licence_obligations.length > 0) {
        failures.push('source requires licence notices not carried by the public catalogue pack');
      }
    } catch (error) {
      failures.push(error.message);
    }
  }
  return failures;
}

// Classifies every source in a validated manifest for public release.
// Returns { cleared: Map, excluded: Map } keyed by source id. A source is
// cleared only when every clearance condition holds; otherwise its excluded
// entry records every failed condition in one reason string.
export function classifyPublicReleaseSources(manifest) {
  if (!isRecord(manifest) || !isRecord(manifest.profiles) || !isRecord(manifest.sources)) {
    fail('a validated source manifest is required');
  }
  const profile = manifest.profiles[PUBLIC_RELEASE_PROFILE];
  if (!isRecord(profile) || !Array.isArray(profile.allowed_licence_classes)) {
    fail(`manifest does not define the "${PUBLIC_RELEASE_PROFILE}" profile`);
  }
  const allowedLicenceClasses = new Set(profile.allowed_licence_classes);

  const cleared = new Map();
  const excluded = new Map();
  for (const [sourceId, source] of Object.entries(manifest.sources)) {
    const failures = clearanceFailures(manifest, sourceId, source, allowedLicenceClasses);
    if (failures.length === 0) {
      cleared.set(sourceId, {
        licence_id: source.licence.id,
        licence_class: source.licence.class,
        redistributable: true,
        artifact_pack: PUBLIC_RELEASE_ARTIFACT_PACK,
        ...(source.attribution === undefined ? {} : { attribution: source.attribution }),
        ...(source.redistribution_obligations === undefined
          ? {}
          : { redistribution_obligations: source.redistribution_obligations }),
      });
    } else {
      excluded.set(sourceId, {
        reason: failures.join('; '),
        licence_id: source.licence.id,
        licence_class: source.licence.class,
        redistributable: source.redistributable,
      });
    }
  }
  return { cleared, excluded };
}

// Evaluates one parsed release row against the cleared-source set.
//
// A missing, empty, or malformed `sources` array — or an element without a
// non-empty string `.source` — is a hard failure: it means the export itself
// is corrupt, not merely restricted. A source id absent from the manifest is
// NOT a hard failure; unlisted sources fail closed, so the row is excluded
// and the id is reported for the exclusion record.
export function evaluateRowSources(row, cleared) {
  if (!(cleared instanceof Map) && !(cleared instanceof Set)) {
    fail('cleared sources must be a Map or Set of source ids');
  }
  if (!isRecord(row)) {
    fail('row is not an object; the export is corrupt');
  }
  if (!Array.isArray(row.sources) || row.sources.length === 0) {
    fail('row has a missing or empty sources array; the export is corrupt');
  }
  let primarySourceId = null;
  if (row.source !== undefined || row.source_policy_id !== undefined) {
    if (row.source !== undefined
      && (typeof row.source !== 'string' || row.source.length === 0)) {
      fail('row primary source must be a non-empty string; the export is corrupt');
    }
    if (row.source_policy_id !== undefined
      && (typeof row.source_policy_id !== 'string' || row.source_policy_id.length === 0)) {
      fail('row primary source policy id must be a non-empty string; the export is corrupt');
    }
    if (row.source !== undefined
      && row.source_policy_id !== undefined
      && row.source !== row.source_policy_id) {
      fail(`row has conflicting primary source ids "${row.source}" and "${row.source_policy_id}"`);
    }
    primarySourceId = row.source_policy_id ?? row.source;
  }
  const excludedSourceIds = new Set();
  const observedSourceIds = new Set();
  for (const entry of row.sources) {
    if (!isRecord(entry) || typeof entry.source !== 'string' || entry.source.length === 0) {
      fail('row has a sources entry without a source id; the export is corrupt');
    }
    if (entry.source_policy_id !== undefined
      && (typeof entry.source_policy_id !== 'string' || entry.source_policy_id.length === 0)) {
      fail('row has a sources entry with an invalid source policy id; the export is corrupt');
    }
    if (entry.source_policy_id !== undefined && entry.source_policy_id !== entry.source) {
      fail(`row has conflicting source ids "${entry.source}" and "${entry.source_policy_id}"`);
    }
    const sourceId = entry.source_policy_id ?? entry.source;
    observedSourceIds.add(sourceId);
    if (!cleared.has(sourceId)) excludedSourceIds.add(sourceId);
  }
  if (primarySourceId !== null && !observedSourceIds.has(primarySourceId)) {
    fail(`row primary source "${primarySourceId}" is absent from sources; the export is corrupt`);
  }
  return {
    include: excludedSourceIds.size === 0,
    excluded_source_ids: [...excludedSourceIds],
  };
}
