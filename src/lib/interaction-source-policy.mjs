import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_MANIFEST_PATH = fileURLToPath(
  new URL('../../data-static/interaction-sources.json', import.meta.url),
);

const PROFILE_IDS = new Set(['production-open', 'internal-evaluation']);
const LICENCE_CLASSES = new Set([
  'open',
  'open-sharealike',
  'public-domain',
  'restricted',
  'non-commercial',
  'user-supplied',
  'unknown',
]);
const VERIFICATION_STATUSES = new Set(['verified', 'unknown']);
const LICENCE_ID_CLASSES = new Map([
  ['MIT', new Set(['open'])],
  ['CC0-1.0', new Set(['open', 'public-domain'])],
  ['US-PUBLIC-DOMAIN', new Set(['public-domain'])],
  ['WHO-INN-PUBLIC-NAME', new Set(['open'])],
  ['NLM-RXNORM-TERMS', new Set(['open'])],
  ['CC-BY-4.0', new Set(['open'])],
  ['CC-BY-SA-4.0', new Set(['open-sharealike'])],
  ['SNOMED-CT-AFFILIATE', new Set(['user-supplied'])],
  ['NOT-CLEARED-FOR-REDISTRIBUTION', new Set(['restricted'])],
  ['REUSE-PERMISSION-REQUIRED', new Set(['restricted'])],
  ['PROPRIETARY', new Set(['restricted'])],
  ['CC-BY-NC-SA-4.0', new Set(['non-commercial'])],
  ['PROPRIETARY-WEB', new Set(['restricted'])],
  ['UNKNOWN', new Set(['unknown'])],
]);
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fail(message) {
  throw new Error(`invalid source manifest: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean`);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    fail(`${label} must be a non-empty trimmed string`);
  }
}

function requireUniqueStringArray(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
  }
  const seen = new Set();
  for (const item of value) {
    requireNonEmptyString(item, `${label} entry`);
    if (seen.has(item)) fail(`${label} contains duplicate value "${item}"`);
    seen.add(item);
  }
  return seen;
}

function requireHttpsUrl(value, label) {
  requireNonEmptyString(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} must be a valid URL`);
  }
  if (parsed.protocol !== 'https:') fail(`${label} must use HTTPS`);
}

function normalizeRelativePath(value, label) {
  requireNonEmptyString(value, label);
  if (value.includes('\0')) throw new Error(`${label} contains a null byte`);
  const portable = value.replaceAll('\\', '/');
  if (portable.startsWith('/') || /^[a-zA-Z]:\//.test(portable)) {
    throw new Error(`${label} must be repository-relative`);
  }
  const normalized = path.posix.normalize(portable.replace(/^\.\//, ''));
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return normalized.replace(/\/$/, '');
}

function validateManifest(manifest) {
  requireRecord(manifest, 'manifest');
  if (manifest.schema_version !== 1) fail('schema_version must equal 1');
  if (!DATE_PATTERN.test(manifest.policy_reviewed_at ?? '')) {
    fail('policy_reviewed_at must be an ISO calendar date');
  }

  const declaredUses = requireUniqueStringArray(manifest.uses, 'uses');
  for (const use of declaredUses) {
    if (!ID_PATTERN.test(use)) fail(`use "${use}" is not a valid identifier`);
  }

  requireRecord(manifest.profiles, 'profiles');
  const profileIds = Object.keys(manifest.profiles);
  if (profileIds.length !== PROFILE_IDS.size
    || profileIds.some((profileId) => !PROFILE_IDS.has(profileId))) {
    fail('profiles must contain exactly production-open and internal-evaluation');
  }

  for (const [profileId, profile] of Object.entries(manifest.profiles)) {
    requireRecord(profile, `profile "${profileId}"`);
    requireBoolean(profile.redistributable, `profile "${profileId}" redistributable`);
    const licenceClasses = requireUniqueStringArray(
      profile.allowed_licence_classes,
      `profile "${profileId}" allowed_licence_classes`,
    );
    for (const licenceClass of licenceClasses) {
      if (!LICENCE_CLASSES.has(licenceClass) || licenceClass === 'unknown') {
        fail(`profile "${profileId}" has invalid allowed licence class "${licenceClass}"`);
      }
    }
    const uses = requireUniqueStringArray(profile.allowed_uses, `profile "${profileId}" allowed_uses`);
    for (const use of uses) {
      if (!declaredUses.has(use)) fail(`profile "${profileId}" declares unknown use "${use}"`);
    }
    try {
      normalizeRelativePath(profile.default_storage_zone, `profile "${profileId}" default_storage_zone`);
    } catch (error) {
      fail(error.message);
    }
  }

  requireRecord(manifest.sources, 'sources');
  if (Object.keys(manifest.sources).length === 0) fail('sources must not be empty');

  for (const [sourceId, source] of Object.entries(manifest.sources)) {
    if (!ID_PATTERN.test(sourceId)) fail(`source id "${sourceId}" is invalid`);
    requireRecord(source, `source "${sourceId}"`);
    requireNonEmptyString(source.name, `source "${sourceId}" name`);
    requireHttpsUrl(source.homepage, `source "${sourceId}" homepage`);
    requireBoolean(source.enabled, `source "${sourceId}" enabled`);
    requireBoolean(source.ingestion_forbidden, `source "${sourceId}" ingestion_forbidden`);
    requireBoolean(source.redistributable, `source "${sourceId}" redistributable`);
    requireNonEmptyString(source.artifact_pack, `source "${sourceId}" artifact_pack`);
    if (!ID_PATTERN.test(source.artifact_pack)) {
      fail(`source "${sourceId}" artifact_pack is not a valid identifier`);
    }

    requireRecord(source.licence, `source "${sourceId}" licence`);
    requireNonEmptyString(source.licence.id, `source "${sourceId}" licence id`);
    const licenceClassesForId = LICENCE_ID_CLASSES.get(source.licence.id);
    if (!licenceClassesForId) {
      fail(`source "${sourceId}" has unknown licence id "${source.licence.id}"`);
    }
    if (!LICENCE_CLASSES.has(source.licence.class)) {
      fail(`source "${sourceId}" has unsupported licence class "${source.licence.class}"`);
    }
    if (!licenceClassesForId.has(source.licence.class)) {
      fail(
        `source "${sourceId}" licence id "${source.licence.id}" is incompatible with class "${source.licence.class}"`,
      );
    }
    if (!VERIFICATION_STATUSES.has(source.licence.verification_status)) {
      fail(`source "${sourceId}" has unsupported licence verification status`);
    }
    requireHttpsUrl(source.licence.terms_url, `source "${sourceId}" licence terms_url`);
    if (source.licence.verification_status === 'verified') {
      if (!DATE_PATTERN.test(source.licence.verified_at ?? '')) {
        fail(`source "${sourceId}" verified licence requires verified_at`);
      }
      if (source.licence.class === 'unknown' || source.licence.id === 'UNKNOWN') {
        fail(`source "${sourceId}" has an unknown licence marked verified`);
      }
    } else {
      if (source.licence.verified_at !== null) {
        fail(`source "${sourceId}" unknown licence must have verified_at null`);
      }
      if (source.enabled) fail(`source "${sourceId}" has unknown licence verification status`);
    }

    const allowedProfiles = requireUniqueStringArray(
      source.allowed_profiles,
      `source "${sourceId}" allowed_profiles`,
      { allowEmpty: true },
    );
    for (const profileId of allowedProfiles) {
      if (!PROFILE_IDS.has(profileId)) {
        fail(`source "${sourceId}" declares unknown profile "${profileId}"`);
      }
    }
    const allowedUses = requireUniqueStringArray(
      source.allowed_uses,
      `source "${sourceId}" allowed_uses`,
      { allowEmpty: true },
    );
    for (const use of allowedUses) {
      if (!declaredUses.has(use)) fail(`source "${sourceId}" declares unknown use "${use}"`);
    }

    requireRecord(source.required_storage_zones, `source "${sourceId}" required_storage_zones`);
    const storageProfileIds = Object.keys(source.required_storage_zones);
    if (storageProfileIds.length !== allowedProfiles.size
      || storageProfileIds.some((profileId) => !allowedProfiles.has(profileId))) {
      fail(`source "${sourceId}" storage zones must match allowed_profiles`);
    }
    for (const [profileId, zones] of Object.entries(source.required_storage_zones)) {
      const uniqueZones = requireUniqueStringArray(
        zones,
        `source "${sourceId}" storage zones for "${profileId}"`,
      );
      for (const zone of uniqueZones) {
        try {
          normalizeRelativePath(zone, `source "${sourceId}" storage zone`);
        } catch (error) {
          fail(error.message);
        }
      }
    }

    if (allowedUses.has('product-resolution')) {
      requireRecord(source.read_only_input_zones, `source "${sourceId}" read_only_input_zones`);
      const readOnlyProfileIds = Object.keys(source.read_only_input_zones);
      if (readOnlyProfileIds.length === 0) {
        fail(`source "${sourceId}" read_only_input_zones must not be empty`);
      }
      for (const [profileId, zones] of Object.entries(source.read_only_input_zones)) {
        if (!allowedProfiles.has(profileId)) {
          fail(`source "${sourceId}" read-only zone declares disallowed profile "${profileId}"`);
        }
        const uniqueZones = requireUniqueStringArray(
          zones,
          `source "${sourceId}" read-only zones for "${profileId}"`,
        );
        for (const zone of uniqueZones) {
          try {
            normalizeRelativePath(zone, `source "${sourceId}" read-only zone`);
          } catch (error) {
            fail(error.message);
          }
        }
      }
    } else if (source.read_only_input_zones !== undefined) {
      fail(`source "${sourceId}" has read-only input zones without product-resolution use`);
    }

    requireUniqueStringArray(
      source.disabled_reasons,
      `source "${sourceId}" disabled_reasons`,
      { allowEmpty: source.enabled },
    );
    if (source.enabled && source.disabled_reasons.length > 0) {
      fail(`enabled source "${sourceId}" cannot have disabled_reasons`);
    }
    if (source.ingestion_forbidden && source.enabled) {
      fail(`source "${sourceId}" cannot enable ingestion while ingestion_forbidden is true`);
    }
  }

  return manifest;
}

function readManifest(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`cannot read interaction source manifest at ${String(file)}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid source manifest JSON at ${String(file)}: ${error.message}`);
  }
}

function validateRequest(manifest, { profile, use, storagePath }) {
  const profilePolicy = manifest.profiles[profile];
  if (!profilePolicy) throw new Error(`unknown interaction source profile "${String(profile)}"`);
  if (typeof use !== 'string' || !manifest.uses.includes(use)) {
    throw new Error(`unknown interaction source use "${String(use)}"`);
  }
  if (!profilePolicy.allowed_uses.includes(use)) {
    throw new Error(`interaction source use "${use}" is not allowed in profile "${profile}"`);
  }
  let normalizedStoragePath;
  try {
    normalizedStoragePath = normalizeRelativePath(storagePath, 'artifact storage path');
  } catch (error) {
    throw new Error(`invalid artifact storage path: ${error.message}`);
  }
  return { profilePolicy, normalizedStoragePath };
}

function pathIsInZone(storagePath, zone) {
  const normalizedZone = normalizeRelativePath(zone, 'source storage zone');
  return storagePath === normalizedZone || storagePath.startsWith(`${normalizedZone}/`);
}

function sourceIdFromEntry(entry) {
  if (typeof entry === 'string') return entry;
  if (isRecord(entry) && typeof entry.source === 'string') return entry.source;
  return null;
}

function sourceAllowed(manifest, { sourceId, profile, use, storagePath }) {
  const { profilePolicy, normalizedStoragePath } = validateRequest(
    manifest,
    { profile, use, storagePath },
  );
  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    throw new Error('interaction source id must be a non-empty string');
  }
  const source = manifest.sources[sourceId];
  if (!source) throw new Error(`unknown interaction source "${sourceId}"`);
  if (source.ingestion_forbidden) {
    throw new Error(`interaction source "${sourceId}": ingestion forbidden`);
  }
  if (source.licence.verification_status !== 'verified'
    || source.licence.class === 'unknown'
    || source.licence.id === 'UNKNOWN') {
    throw new Error(`interaction source "${sourceId}" has an unknown or unverified licence`);
  }
  if (!source.enabled) {
    throw new Error(
      `interaction source "${sourceId}" is disabled: ${source.disabled_reasons.join('; ')}`,
    );
  }
  if (!source.allowed_profiles.includes(profile)) {
    throw new Error(`interaction source "${sourceId}" is not allowed in profile "${profile}"`);
  }
  if (!profilePolicy.allowed_licence_classes.includes(source.licence.class)) {
    throw new Error(
      `interaction source "${sourceId}" licence class "${source.licence.class}" is not allowed in profile "${profile}"`,
    );
  }
  if (profilePolicy.redistributable && !source.redistributable) {
    throw new Error(`interaction source "${sourceId}" is not redistributable in profile "${profile}"`);
  }
  if (!source.allowed_uses.includes(use)) {
    throw new Error(`interaction source "${sourceId}" does not allow use "${use}"`);
  }
  const zones = [
    ...(source.required_storage_zones[profile] ?? []),
    ...(use === 'product-resolution' ? (source.read_only_input_zones?.[profile] ?? []) : []),
  ];
  if (!Array.isArray(zones) || !zones.some((zone) => pathIsInZone(normalizedStoragePath, zone))) {
    throw new Error(
      `interaction source "${sourceId}" is outside its required storage zone for profile "${profile}"`,
    );
  }
  return { id: sourceId, ...source };
}

export function loadSourceManifest(file = DEFAULT_MANIFEST_PATH) {
  return validateManifest(readManifest(file));
}

export function assertSourceAllowed(manifest, options) {
  validateManifest(manifest);
  if (!isRecord(options)) throw new TypeError('source policy options must be an object');
  return sourceAllowed(manifest, options);
}

export function assertSourcesAllowed(manifest, options) {
  validateManifest(manifest);
  if (!isRecord(options)) throw new TypeError('source policy options must be an object');
  const { sourceIds, ...request } = options;
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    throw new Error('source policy requires at least one source');
  }
  return sourceIds.map((entry) => {
    const sourceId = sourceIdFromEntry(entry);
    if (!sourceId) throw new Error('interaction source id must be a non-empty string');
    return sourceAllowed(manifest, { ...request, sourceId });
  });
}

export function assertArtifactProvenance(manifest, options) {
  validateManifest(manifest);
  if (!isRecord(options)) throw new TypeError('artifact provenance options must be an object');
  const { sourceIds, profile, use, storagePath } = options;
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    throw new Error('artifact provenance requires at least one source');
  }

  const normalizedIds = sourceIds.map((entry) => {
    const sourceId = sourceIdFromEntry(entry);
    if (!sourceId) throw new Error('artifact provenance source id must be a non-empty string');
    return sourceId;
  });
  const seen = new Set();
  for (const sourceId of normalizedIds) {
    if (seen.has(sourceId)) throw new Error(`artifact provenance has duplicate source "${sourceId}"`);
    seen.add(sourceId);
  }

  const sources = normalizedIds.map((sourceId) => sourceAllowed(manifest, {
    sourceId,
    profile,
    use,
    storagePath,
  }));
  const constrainedPacks = new Set(
    sources.map((source) => source.artifact_pack).filter((pack) => pack !== 'open-core'),
  );
  if (constrainedPacks.size > 1) {
    throw new Error(
      `mixed artifact provenance requires incompatible packs: ${[...constrainedPacks].join(', ')}`,
    );
  }
  const artifactPack = constrainedPacks.size === 1 ? [...constrainedPacks][0] : 'open-core';
  const redistributable = manifest.profiles[profile].redistributable
    && sources.every((source) => source.redistributable);

  return {
    profile,
    use,
    storage_path: normalizeRelativePath(storagePath, 'artifact storage path'),
    source_ids: normalizedIds,
    artifact_pack: artifactPack,
    redistributable,
  };
}
