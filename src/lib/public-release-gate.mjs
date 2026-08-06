// Fail-closed public-release licensing gate.
//
// A public release may contain a row only when every source that contributed
// to it is explicitly cleared for the production-open profile by the
// interaction source manifest. Anything else — restricted, unverified,
// disabled, non-redistributable, or simply unlisted — is excluded, and the
// exclusion is recorded with a reason. See docs/PUBLIC_RELEASE_GATE.md and
// docs/LICENSING_REPORT.md.

export { loadSourceManifest } from './interaction-source-policy.mjs';

export const PUBLIC_RELEASE_PROFILE = 'production-open';
export const UNLISTED_SOURCE_REASON = 'no manifest entry; unlisted sources fail closed';

function fail(message) {
  throw new Error(`public release gate: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clearanceFailures(source, allowedLicenceClasses) {
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
    const failures = clearanceFailures(source, allowedLicenceClasses);
    if (failures.length === 0) {
      cleared.set(sourceId, {
        licence_id: source.licence.id,
        licence_class: source.licence.class,
        redistributable: true,
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
  const excludedSourceIds = new Set();
  for (const entry of row.sources) {
    if (!isRecord(entry) || typeof entry.source !== 'string' || entry.source.length === 0) {
      fail('row has a sources entry without a source id; the export is corrupt');
    }
    if (!cleared.has(entry.source)) excludedSourceIds.add(entry.source);
  }
  return {
    include: excludedSourceIds.size === 0,
    excluded_source_ids: [...excludedSourceIds],
  };
}
