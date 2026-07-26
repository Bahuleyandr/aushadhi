import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';

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
  ['OGL-3.0', new Set(['open'])],
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
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const OPENFDA_SET_ID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const REVIEW_STATUSES = new Set(['review_candidate', 'clinician_reviewed']);
const EVIDENCE_USES = new Set([
  'identity',
  'interaction-evidence',
  'interaction-counterevidence',
]);
const EVIDENCE_JURISDICTIONS = new Set(['EU', 'IN', 'UK', 'US']);
const COUNTEREVIDENCE_EFFECTS = new Set([
  'no_clinically_meaningful_effect',
]);
const CC_BY_SA_ADAPTER_LICENCES = new Set(['CC-BY-SA-4.0']);

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
  return parsed;
}

function requireHostname(value, label) {
  requireNonEmptyString(value, label);
  if (value !== value.toLowerCase() || value.startsWith('www.')) {
    fail(`${label} must be a lowercase canonical hostname without www`);
  }
  let parsed;
  try {
    parsed = new URL(`https://${value}`);
  } catch {
    fail(`${label} must be a valid hostname`);
  }
  if (parsed.hostname !== value || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    fail(`${label} must contain only a hostname`);
  }
}

function requireUrlPathPrefix(value, label) {
  requireNonEmptyString(value, label);
  if (!value.startsWith('/') || value.includes('\\') || value.includes('\0')) {
    fail(`${label} must be an absolute URL path prefix`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || value.includes('..')) {
    fail(`${label} must be a normalized URL path prefix`);
  }
}

function canonicalHostname(value) {
  return value.toLowerCase().replace(/^www\./u, '');
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isIsoCalendarDate(value) {
  if (!DATE_PATTERN.test(value ?? '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function normalizeOpenFdaText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\u00a0/gu, ' ')
    .replace(/\p{Cf}/gu, '')
    .replace(/[‐‑‒–—―−]/gu, '-')
    .replace(/[“”„‟]/gu, '"')
    .replace(/[‘’‚‛]/gu, "'")
    .replace(/\s+/gu, ' ')
    .replace(/([([])\s+/gu, '$1')
    .replace(/\s+([)\],.;:])/gu, '$1')
    .replace(/\bm\s+([23])\b/gu, 'm$1')
    .trim();
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
  if (!isIsoCalendarDate(manifest.policy_reviewed_at)) {
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
      const normalized = normalizeRelativePath(
        profile.default_storage_zone,
        `profile "${profileId}" default_storage_zone`,
      );
      if (normalized !== profile.default_storage_zone) {
        fail(`profile "${profileId}" default_storage_zone must be canonical`);
      }
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
      if (!isIsoCalendarDate(source.licence.verified_at)) {
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
          const normalized = normalizeRelativePath(zone, `source "${sourceId}" storage zone`);
          if (normalized !== zone) {
            fail(`source "${sourceId}" storage zone must be canonical`);
          }
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
            const normalized = normalizeRelativePath(zone, `source "${sourceId}" read-only zone`);
            if (normalized !== zone) {
              fail(`source "${sourceId}" read-only zone must be canonical`);
            }
          } catch (error) {
            fail(error.message);
          }
        }
      }
    } else if (source.read_only_input_zones !== undefined) {
      fail(`source "${sourceId}" has read-only input zones without product-resolution use`);
    }

    const originHosts = source.allowed_origin_hosts === undefined
      ? new Set()
      : requireUniqueStringArray(
        source.allowed_origin_hosts,
        `source "${sourceId}" allowed_origin_hosts`,
        { allowEmpty: true },
      );
    for (const host of originHosts) {
      requireHostname(host, `source "${sourceId}" allowed origin host`);
    }
    const originPathPrefixes = source.allowed_origin_path_prefixes === undefined
      ? new Set()
      : requireUniqueStringArray(
        source.allowed_origin_path_prefixes,
        `source "${sourceId}" allowed_origin_path_prefixes`,
        { allowEmpty: true },
      );
    for (const prefix of originPathPrefixes) {
      requireUrlPathPrefix(prefix, `source "${sourceId}" allowed origin path prefix`);
      if (!prefix.endsWith('/')) {
        fail(`source "${sourceId}" allowed origin path prefix must end with "/"`);
      }
    }
    const originPaths = source.allowed_origin_paths === undefined
      ? new Set()
      : requireUniqueStringArray(
        source.allowed_origin_paths,
        `source "${sourceId}" allowed_origin_paths`,
        { allowEmpty: true },
      );
    for (const originPath of originPaths) {
      requireUrlPathPrefix(originPath, `source "${sourceId}" allowed origin path`);
    }
    const hasEvidenceUse = [...allowedUses].some((use) => EVIDENCE_USES.has(use));
    if (source.enabled && hasEvidenceUse && source.licence.class !== 'user-supplied') {
      if (originHosts.size === 0
        || (originPaths.size === 0 && originPathPrefixes.size === 0)) {
        fail(`source "${sourceId}" evidence requires origin host and path controls`);
      }
      if (source.requires_evidence_payload_validation !== true) {
        fail(`source "${sourceId}" evidence requires payload validation`);
      }
    }

    if (source.reference_hosts !== undefined) {
      const referenceHosts = requireUniqueStringArray(
        source.reference_hosts,
        `source "${sourceId}" reference_hosts`,
        { allowEmpty: true },
      );
      for (const host of referenceHosts) {
        requireHostname(host, `source "${sourceId}" reference host`);
      }
    }
    if (source.approved_documents !== undefined) {
      if (!Array.isArray(source.approved_documents) || source.approved_documents.length === 0) {
        fail(`source "${sourceId}" approved_documents must be a non-empty array`);
      }
      const approvedUrls = new Set();
      for (const [index, document] of source.approved_documents.entries()) {
        requireRecord(document, `source "${sourceId}" approved_documents[${index}]`);
        const approvedUrl = requireHttpsUrl(
          document.url,
          `source "${sourceId}" approved_documents[${index}].url`,
        );
        if (!originHosts.has(canonicalHostname(approvedUrl.hostname))) {
          fail(`source "${sourceId}" approved document host is not an allowed origin`);
        }
        if (!originPaths.has(approvedUrl.pathname)
          && ![...originPathPrefixes].some(
            (prefix) => approvedUrl.pathname.startsWith(prefix),
          )) {
          fail(`source "${sourceId}" approved document path is not an allowed origin`);
        }
        if (!SHA256_PATTERN.test(document.sha256 ?? '')) {
          fail(`source "${sourceId}" approved_documents[${index}].sha256 is invalid`);
        }
        if (approvedUrls.has(document.url)) {
          fail(`source "${sourceId}" approved_documents contains duplicate URL "${document.url}"`);
        }
        approvedUrls.add(document.url);
      }
    }
    if (source.rights_scope !== undefined) {
      requireNonEmptyString(source.rights_scope, `source "${sourceId}" rights_scope`);
    }
    if (source.attribution !== undefined) {
      requireNonEmptyString(source.attribution, `source "${sourceId}" attribution`);
    }
    for (const property of [
      'requires_document_reconciliation',
      'requires_evidence_payload_validation',
      'requires_page_licence_assertion',
    ]) {
      if (source[property] !== undefined) {
        requireBoolean(source[property], `source "${sourceId}" ${property}`);
      }
    }
    if (sourceId === 'openfda-labels' && source.requires_document_reconciliation !== true) {
      fail('source "openfda-labels" requires document reconciliation');
    }
    if (source.licence.id === 'OGL-3.0') {
      if (source.requires_page_licence_assertion !== true) {
        fail(`source "${sourceId}" requires a page-level licence assertion`);
      }
      requireNonEmptyString(source.attribution, `source "${sourceId}" attribution`);
    }

    if (['CC-BY-4.0', 'CC-BY-SA-4.0'].includes(source.licence.id)) {
      requireRecord(
        source.redistribution_obligations,
        `source "${sourceId}" redistribution_obligations`,
      );
      const obligations = source.redistribution_obligations;
      for (const field of ['attribution', 'licence_notice', 'source_url']) {
        requireNonEmptyString(
          obligations[field],
          `source "${sourceId}" redistribution_obligations.${field}`,
        );
      }
      requireHttpsUrl(
        obligations.source_url,
        `source "${sourceId}" redistribution_obligations.source_url`,
      );
      requireBoolean(
        obligations.changes_notice_required,
        `source "${sourceId}" redistribution_obligations.changes_notice_required`,
      );
      if (obligations.changes_notice_required !== true) {
        fail(`source "${sourceId}" redistribution obligations must require a changes notice`);
      }
      if (source.licence.id === 'CC-BY-SA-4.0') {
        const adapterLicences = requireUniqueStringArray(
          obligations.compatible_adapter_licences,
          `source "${sourceId}" compatible_adapter_licences`,
        );
        for (const licence of adapterLicences) {
          if (!CC_BY_SA_ADAPTER_LICENCES.has(licence)) {
            fail(`source "${sourceId}" has unsupported compatible adapter licence "${licence}"`);
          }
        }
        if (!adapterLicences.has(source.licence.id)) {
          fail(`source "${sourceId}" must allow its own share-alike licence`);
        }
      }
    } else if (source.redistribution_obligations !== undefined) {
      fail(`source "${sourceId}" has redistribution obligations for an unsupported licence`);
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
  if (isRecord(entry)) {
    if (typeof entry.source_policy_id === 'string'
      && typeof entry.source === 'string'
      && entry.source_policy_id !== entry.source) {
      throw new Error(
        `conflicting interaction source ids "${entry.source_policy_id}" and "${entry.source}"`,
      );
    }
    if (typeof entry.source_policy_id === 'string') return entry.source_policy_id;
    if (typeof entry.source === 'string') return entry.source;
  }
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

function evidenceFail(message) {
  throw new Error(`interaction evidence rejected: ${message}`);
}

function requireEvidenceString(value, label) {
  if (typeof value !== 'string'
    || value.trim() !== value
    || value.length === 0
    || !/[\p{L}\p{N}]/u.test(normalizeOpenFdaText(value))) {
    evidenceFail(`${label} must be a non-empty trimmed string`);
  }
}

function parseEvidenceUrl(value, label) {
  requireEvidenceString(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    evidenceFail(`${label} must be a valid URL`);
  }
  if (parsed.protocol !== 'https:') evidenceFail(`${label} must use HTTPS`);
  if (parsed.username || parsed.password || parsed.port || parsed.hash) {
    evidenceFail(`${label} must not contain credentials, a custom port, or a fragment`);
  }
  return parsed;
}

function urlPathMatches(pathname, exactPaths, prefixes) {
  return exactPaths.includes(pathname)
    || prefixes.some((prefix) => pathname.startsWith(prefix));
}

function assertFragments(evidence) {
  if (!Array.isArray(evidence.fragments) || evidence.fragments.length === 0) {
    evidenceFail('fragments must be a non-empty array');
  }
  for (const [index, fragment] of evidence.fragments.entries()) {
    if (!isRecord(fragment)) evidenceFail(`fragments[${index}] must be an object`);
    requireEvidenceString(fragment.text, `fragments[${index}].text`);
    requireEvidenceString(fragment.section, `fragments[${index}].section`);
    if (typeof fragment.source_path !== 'string'
      || fragment.source_path.trim() !== fragment.source_path
      || fragment.source_path.length === 0) {
      evidenceFail(`fragments[${index}].source_path must be a non-empty trimmed string`);
    }
    if (!SHA256_PATTERN.test(fragment.text_sha256 ?? '')) {
      evidenceFail(`fragments[${index}].text_sha256 must be a lowercase SHA-256`);
    }
    if (sha256(fragment.text) !== fragment.text_sha256) {
      evidenceFail(`fragments[${index}].text_sha256 does not match fragment text`);
    }
  }
}

function assertEvidenceSupports(evidence) {
  if (!isRecord(evidence.supports)) evidenceFail('supports must be an object');
  if (typeof evidence.supports.interaction_exists !== 'boolean') {
    evidenceFail('supports.interaction_exists must be a boolean');
  }
  for (const field of ['source_effect', 'label_action', 'jurisdictions']) {
    const value = evidence.supports[field];
    if (!Array.isArray(value) || (field === 'jurisdictions' && value.length === 0)) {
      evidenceFail(
        `supports.${field} must be ${field === 'jurisdictions' ? 'a non-empty' : 'an'} array`,
      );
    }
    for (const [index, item] of value.entries()) {
      requireEvidenceString(item, `supports.${field}[${index}]`);
    }
  }
  if (!EVIDENCE_JURISDICTIONS.has(evidence.jurisdiction)) {
    evidenceFail(`jurisdiction "${evidence.jurisdiction}" is unsupported`);
  }
  if (evidence.supports.jurisdictions.length !== 1
    || evidence.supports.jurisdictions[0] !== evidence.jurisdiction) {
    evidenceFail('supports.jurisdictions must exactly match evidence jurisdiction');
  }
  if (evidence.source_policy_use === 'identity'
    && evidence.supports.interaction_exists !== false) {
    evidenceFail('identity evidence must set supports.interaction_exists to false');
  }
  if (evidence.source_policy_use === 'interaction-evidence'
    && evidence.supports.interaction_exists !== true) {
    evidenceFail('interaction evidence must set supports.interaction_exists to true');
  }
  if (evidence.source_policy_use === 'interaction-evidence'
    && evidence.supports.source_effect.some(
      (effect) => COUNTEREVIDENCE_EFFECTS.has(effect),
    )) {
    evidenceFail(
      'interaction evidence cannot use a counterevidence source_effect',
    );
  }
  if (evidence.source_policy_use === 'interaction-counterevidence') {
    if (evidence.supports.interaction_exists !== false) {
      evidenceFail(
        'interaction counterevidence must set supports.interaction_exists to false',
      );
    }
    if (evidence.supports.source_effect.length === 0) {
      evidenceFail(
        'interaction counterevidence requires a typed supports.source_effect',
      );
    }
    for (const effect of evidence.supports.source_effect) {
      if (!COUNTEREVIDENCE_EFFECTS.has(effect)) {
        evidenceFail(
          `interaction counterevidence has unsupported source_effect "${effect}"`,
        );
      }
    }
    if (evidence.supports.label_action.length > 0) {
      evidenceFail('interaction counterevidence cannot assert label actions');
    }
  }
}

function assertOpenFdaReconciliation(evidence, sourceUrl, referenceUrl) {
  if (!isRecord(evidence.provenance)) evidenceFail('provenance must be an object');
  const provenance = evidence.provenance;
  for (const field of ['set_id', 'version', 'effective_time', 'normalization_version']) {
    requireEvidenceString(provenance[field], `provenance.${field}`);
  }
  if (!OPENFDA_SET_ID_PATTERN.test(provenance.set_id)) {
    evidenceFail('provenance.set_id must be a canonical UUID');
  }
  if (!/^\d+$/u.test(provenance.version)) {
    evidenceFail('provenance.version must be a decimal SPL version');
  }
  if (!/^\d{8}$/u.test(provenance.effective_time)) {
    evidenceFail('provenance.effective_time must use YYYYMMDD');
  }
  if (!SHA256_PATTERN.test(provenance.payload_sha256 ?? '')) {
    evidenceFail('provenance.payload_sha256 must be a lowercase SHA-256');
  }
  if (provenance.normalization_version !== 'openfda-spl-text-v1') {
    evidenceFail('provenance.normalization_version is unsupported');
  }
  if (provenance.payload_canonicalization !== 'sorted-json-keys-v1') {
    evidenceFail('provenance.payload_canonicalization is unsupported');
  }
  if (evidence.document_id !== provenance.set_id) {
    evidenceFail('document_id must equal provenance.set_id');
  }
  if (evidence.document_version !== provenance.version) {
    evidenceFail('document_version must equal provenance.version');
  }
  if (evidence.canonical_setid !== undefined
    && evidence.canonical_setid !== provenance.set_id) {
    evidenceFail('canonical_setid must equal provenance.set_id');
  }
  for (const field of ['spl_version', 'source_version']) {
    if (evidence[field] !== undefined
      && String(evidence[field]) !== provenance.version) {
      evidenceFail(`${field} must equal provenance.version`);
    }
  }
  if (!isIsoCalendarDate(evidence.source_date)) {
    evidenceFail('source_date must use a valid YYYY-MM-DD calendar date');
  }
  if (evidence.source_date.replaceAll('-', '') !== provenance.effective_time) {
    evidenceFail('source_date must equal provenance.effective_time');
  }

  const search = sourceUrl.searchParams.get('search');
  if (search !== `set_id:"${provenance.set_id}"`) {
    evidenceFail('openFDA source_url must query the exact provenance.set_id');
  }
  if (sourceUrl.searchParams.get('limit') !== '100') {
    evidenceFail('openFDA source_url must declare limit=100 for version reconciliation');
  }
  const queryKeys = [...sourceUrl.searchParams.keys()];
  if (queryKeys.length !== 2
    || new Set(queryKeys).size !== 2
    || !queryKeys.includes('search')
    || !queryKeys.includes('limit')) {
    evidenceFail('openFDA source_url may contain only one search and one limit parameter');
  }

  if (!(referenceUrl instanceof URL)
    || canonicalHostname(referenceUrl.hostname) !== 'dailymed.nlm.nih.gov'
    || referenceUrl.pathname !== '/dailymed/drugInfo.cfm') {
    evidenceFail('openFDA reference_url must use the canonical DailyMed drugInfo endpoint');
  }
  const referenceKeys = [...referenceUrl.searchParams.keys()];
  if (referenceKeys.length !== 1
    || referenceKeys[0] !== 'setid'
    || referenceUrl.searchParams.getAll('setid').length !== 1
    || referenceUrl.searchParams.get('setid')?.toLowerCase() !== provenance.set_id.toLowerCase()) {
    evidenceFail('openFDA reference_url must contain only the matching canonical setid');
  }

  if (!Array.isArray(provenance.source_paths)
    || provenance.source_paths.length !== evidence.fragments.length) {
    evidenceFail('provenance.source_paths must match the fragment count');
  }
  const fragmentPaths = evidence.fragments.map((fragment) => fragment.source_path);
  if (provenance.source_paths.some((sourcePath, index) => sourcePath !== fragmentPaths[index])) {
    evidenceFail('provenance.source_paths must match fragment source_path values in order');
  }
}

function payloadValueAtPath(payload, sourcePath) {
  if (sourcePath === '$') return payload;
  if (!/^[a-zA-Z0-9_]+(?:(?:\.[a-zA-Z0-9_]+)|(?:\[\d+\]))*$/u.test(sourcePath)) {
    evidenceFail(`unsupported payload source_path "${sourcePath}"`);
  }
  const tokens = [];
  for (const match of sourcePath.matchAll(/([a-zA-Z0-9_]+)|\[(\d+)\]/gu)) {
    tokens.push(match[1] ?? Number(match[2]));
  }
  let value = payload;
  for (const token of tokens) {
    if (value === null || value === undefined
      || (typeof token === 'number' && !Array.isArray(value))
      || (typeof token === 'string' && !isRecord(value))
      || !Object.hasOwn(value, token)) {
      evidenceFail(`payload does not contain source_path "${sourcePath}"`);
    }
    value = value[token];
  }
  return value;
}

function assertFragmentMatchesValue(fragment, value) {
  const sourceText = typeof value === 'string'
    ? value
    : JSON.stringify(canonicalize(value));
  const normalizedFragment = normalizeOpenFdaText(fragment.text);
  if (normalizedFragment.length < 8 || !/[\p{L}\p{N}]/u.test(normalizedFragment)) {
    evidenceFail(`fragment at source_path "${fragment.source_path}" is not meaningful after normalization`);
  }
  if (!normalizeOpenFdaText(sourceText).includes(normalizedFragment)) {
    evidenceFail(`fragment is absent from payload source_path "${fragment.source_path}"`);
  }
}

export function assertEvidenceMatchesPayload(evidence, payload) {
  if (!isRecord(evidence)) evidenceFail('record must be an object');
  assertFragments(evidence);

  if (evidence.source_policy_id === 'openfda-labels') {
    if (!isRecord(payload)) evidenceFail('openFDA payload must be an object');
    if (!isRecord(evidence.provenance)) evidenceFail('provenance must be an object');
    const provenance = evidence.provenance;
    if (String(payload.set_id ?? '').toLowerCase() !== provenance.set_id.toLowerCase()) {
      evidenceFail('openFDA payload set_id does not match provenance');
    }
    if (String(payload.version ?? '') !== provenance.version) {
      evidenceFail('openFDA payload version does not match provenance');
    }
    if (String(payload.effective_time ?? '') !== provenance.effective_time) {
      evidenceFail('openFDA payload effective_time does not match provenance');
    }
    const payloadHash = sha256(JSON.stringify(canonicalize(payload)));
    if (payloadHash !== provenance.payload_sha256) {
      evidenceFail('openFDA payload SHA-256 does not match provenance');
    }
    for (const fragment of evidence.fragments) {
      assertFragmentMatchesValue(
        fragment,
        payloadValueAtPath(payload, fragment.source_path),
      );
    }
    return { payload_sha256: payloadHash };
  }

  if (evidence.source_policy_id === 'mhra-govuk-drug-safety-updates') {
    if (!isRecord(payload)
      || !isRecord(payload.content_api)
      || typeof payload.page_html !== 'string') {
      evidenceFail('GOV.UK payload must contain content_api and page_html');
    }
    const sourceUrl = parseEvidenceUrl(evidence.source_url, 'source_url');
    const expectedPayloadUrl =
      `https://www.gov.uk/api/content${sourceUrl.pathname}`;
    for (const field of ['content_api_url', 'page_url']) {
      requireEvidenceString(payload[field], `payload.${field}`);
    }
    const contentApiUrl = parseEvidenceUrl(payload.content_api_url, 'payload.content_api_url');
    if (payload.content_api_url !== expectedPayloadUrl
      || contentApiUrl.search
      || contentApiUrl.hash
      || evidence.provenance?.payload_url !== expectedPayloadUrl) {
      evidenceFail('GOV.UK Content API URL does not match the source page');
    }
    if (payload.page_url !== evidence.source_url) {
      evidenceFail('GOV.UK page payload URL does not match source_url');
    }
    if (payload.content_api.base_path !== sourceUrl.pathname) {
      evidenceFail('GOV.UK Content API base_path does not match source_url');
    }
    if (payload.content_api.document_type !== 'drug_safety_update') {
      evidenceFail('GOV.UK Content API document_type must be drug_safety_update');
    }
    if (!/Open Government Licence v3\.0/iu.test(payload.page_html)
      || !/nationalarchives\.gov\.uk\/doc\/open-government-licence\/version\/3\/?/iu
        .test(payload.page_html)) {
      evidenceFail('GOV.UK page does not carry the Open Government Licence v3.0 footer');
    }
    if (/(?:this (?:page|content)|the following content).{0,120}(?:not (?:covered|licensed)|excluded).{0,120}(?:Open Government Licence|OGL)|(?:all rights reserved|permission (?:is )?required)/isu
      .test(payload.page_html)) {
      evidenceFail('GOV.UK page carries a page-specific copyright or reuse exception');
    }
    const payloadHash = sha256(JSON.stringify(canonicalize(payload.content_api)));
    if (payloadHash !== evidence.provenance?.document_sha256) {
      evidenceFail('GOV.UK Content API payload SHA-256 does not match provenance');
    }
    for (const fragment of evidence.fragments) {
      assertFragmentMatchesValue(
        fragment,
        payloadValueAtPath(payload.content_api, fragment.source_path),
      );
    }
    return { payload_sha256: payloadHash };
  }

  if (evidence.source_policy_id === 'fda-gsrs-unii') {
    if (!isRecord(payload)
      || !isRecord(payload.payload)
      || !ArrayBuffer.isView(payload.source_document)) {
      evidenceFail('openFDA UNII payload envelope is invalid');
    }
    for (const field of [
      'source_url',
      'document_id',
      'document_version',
      'source_path',
    ]) {
      requireEvidenceString(payload[field], `payload.${field}`);
    }
    const sourceDocument = new Uint8Array(
      payload.source_document.buffer,
      payload.source_document.byteOffset,
      payload.source_document.byteLength,
    );
    const sourceDocumentSha256 = createHash('sha256')
      .update(sourceDocument)
      .digest('hex');
    if (payload.source_url !== evidence.source_url
      || payload.document_id !== evidence.document_id
      || payload.document_version !== evidence.document_version
      || payload.source_path !== evidence.provenance?.source_path) {
      evidenceFail('openFDA UNII payload envelope does not match evidence provenance');
    }
    if (sourceDocumentSha256 !== evidence.provenance?.document_sha256) {
      evidenceFail('openFDA UNII source document SHA-256 does not match provenance');
    }
    let archive;
    try {
      archive = unzipSync(sourceDocument);
    } catch {
      evidenceFail('openFDA UNII source document must be a valid ZIP archive');
    }
    const jsonEntries = Object.entries(archive)
      .filter(([entryPath]) => entryPath.toLowerCase().endsWith('.json'));
    if (jsonEntries.length !== 1) {
      evidenceFail('openFDA UNII ZIP archive must contain exactly one JSON document');
    }
    let sourcePayload;
    try {
      sourcePayload = JSON.parse(strFromU8(jsonEntries[0][1]));
    } catch {
      evidenceFail('openFDA UNII ZIP archive contains invalid JSON');
    }
    const archiveRecord = payloadValueAtPath(sourcePayload, payload.source_path);
    if (!isRecord(archiveRecord)
      || JSON.stringify(canonicalize(archiveRecord))
        !== JSON.stringify(canonicalize(payload.payload))) {
      evidenceFail('openFDA UNII payload record does not match the downloaded export');
    }
    const canonicalRecord = JSON.stringify(canonicalize(payload.payload));
    for (const fragment of evidence.fragments) {
      if (fragment.source_path !== payload.source_path
        || fragment.text !== canonicalRecord) {
        evidenceFail('openFDA UNII fragment does not match the verified export record');
      }
    }
    return { payload_sha256: sourceDocumentSha256 };
  }

  let payloadHash;
  if (typeof payload === 'string' || ArrayBuffer.isView(payload)) {
    payloadHash = createHash('sha256').update(payload).digest('hex');
  } else if (isRecord(payload) || Array.isArray(payload)) {
    payloadHash = sha256(JSON.stringify(canonicalize(payload)));
  } else {
    evidenceFail('payload must be text, bytes, an object, or an array');
  }
  if (payloadHash !== evidence.provenance?.document_sha256) {
    evidenceFail('payload SHA-256 does not match evidence provenance');
  }
  for (const fragment of evidence.fragments) {
    const value = fragment.source_path === '$'
      ? payload
      : payloadValueAtPath(payload, fragment.source_path);
    assertFragmentMatchesValue(fragment, value);
  }
  return { payload_sha256: payloadHash };
}

function evidenceAllowed(manifest, evidence, {
  profile,
  storagePath,
  use = evidence?.source_policy_use,
  payload,
} = {}, {
  metadataOnly = false,
} = {}) {
  if (!isRecord(evidence)) evidenceFail('record must be an object');
  if (evidence.source !== undefined) {
    evidenceFail('legacy source is not allowed; use source_policy_id only');
  }
  for (const field of [
    'source_id',
    'source_policy_id',
    'source_policy_use',
    'licence',
    'source_url',
    'document_id',
    'document_version',
    'retrieved_at',
    'jurisdiction',
    'review_status',
  ]) {
    requireEvidenceString(evidence[field], field);
  }
  if (!isIsoCalendarDate(evidence.retrieved_at)) {
    evidenceFail('retrieved_at must use YYYY-MM-DD');
  }
  if (evidence.source_date !== undefined && !isIsoCalendarDate(evidence.source_date)) {
    evidenceFail('source_date must use a valid YYYY-MM-DD calendar date');
  }
  if (!REVIEW_STATUSES.has(evidence.review_status)) {
    evidenceFail(`review_status "${evidence.review_status}" is unsupported`);
  }
  if (use !== evidence.source_policy_use) {
    evidenceFail('requested use must equal source_policy_use');
  }
  assertEvidenceSupports(evidence);

  const source = sourceAllowed(manifest, {
    sourceId: evidence.source_policy_id,
    profile,
    use,
    storagePath,
  });
  if (evidence.licence !== source.licence.id) {
    evidenceFail(
      `licence "${evidence.licence}" does not match source policy licence "${source.licence.id}"`,
    );
  }

  const sourceUrl = parseEvidenceUrl(evidence.source_url, 'source_url');
  const sourceHost = canonicalHostname(sourceUrl.hostname);
  const allowedHosts = source.allowed_origin_hosts ?? [];
  const allowedPaths = source.allowed_origin_paths ?? [];
  const allowedPathPrefixes = source.allowed_origin_path_prefixes ?? [];
  if (!allowedHosts.includes(sourceHost)) {
    evidenceFail(`source_url host "${sourceHost}" is not a licensed origin`);
  }
  if (!urlPathMatches(sourceUrl.pathname, allowedPaths, allowedPathPrefixes)) {
    evidenceFail(`source_url path "${sourceUrl.pathname}" is not a licensed origin path`);
  }
  if (evidence.source_host !== undefined) {
    requireEvidenceString(evidence.source_host, 'source_host');
    if (canonicalHostname(evidence.source_host) !== sourceHost) {
      evidenceFail('source_host must match source_url');
    }
  }

  let referenceUrl;
  if (evidence.reference_url !== undefined) {
    referenceUrl = parseEvidenceUrl(evidence.reference_url, 'reference_url');
    const referenceHost = canonicalHostname(referenceUrl.hostname);
    if (!(source.reference_hosts ?? []).includes(referenceHost)) {
      evidenceFail(`reference_url host "${referenceHost}" is not allowed by the source policy`);
    }
  }

  if (source.approved_documents !== undefined) {
    const approved = source.approved_documents.find(
      (document) => document.url === evidence.source_url,
    );
    if (!approved) evidenceFail('source_url is not an approved document');
    if (evidence.provenance?.document_sha256 !== approved.sha256) {
      evidenceFail('provenance.document_sha256 does not match the approved document');
    }
  }
  if (source.requires_page_licence_assertion) {
    if (evidence.provenance?.page_licence !== source.licence.id) {
      evidenceFail('page-level licence assertion is missing or mismatched');
    }
    if (evidence.attribution !== source.attribution) {
      evidenceFail('required source attribution is missing or mismatched');
    }
  }

  assertFragments(evidence);
  if (source.requires_document_reconciliation) {
    assertOpenFdaReconciliation(evidence, sourceUrl, referenceUrl);
  }
  if (source.requires_evidence_payload_validation) {
    if (payload === undefined && !metadataOnly) {
      evidenceFail('verified source payload is required');
    }
    if (!metadataOnly) assertEvidenceMatchesPayload(evidence, payload);
  }

  if (use === 'identity') {
    if (evidence.supports?.interaction_exists !== false) {
      evidenceFail('identity evidence must set supports.interaction_exists to false');
    }
    if ((evidence.supports?.source_effect?.length ?? 0) > 0
      || (evidence.supports?.label_action?.length ?? 0) > 0) {
      evidenceFail('identity evidence cannot assert interaction effects or label actions');
    }
  }

  return {
    source,
    evidence,
    payload_binding: source.requires_evidence_payload_validation
      ? (metadataOnly ? 'pending' : 'verified')
      : 'not_required',
  };
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

export function assertEvidenceAllowed(manifest, evidence, options) {
  validateManifest(manifest);
  if (options !== undefined && !isRecord(options)) {
    throw new TypeError('interaction evidence policy options must be an object');
  }
  return evidenceAllowed(manifest, evidence, options);
}

export function assertEvidenceMetadataAllowed(manifest, evidence, options) {
  validateManifest(manifest);
  if (options !== undefined && !isRecord(options)) {
    throw new TypeError('interaction evidence policy options must be an object');
  }
  return evidenceAllowed(manifest, evidence, options, { metadataOnly: true });
}

export function assertArtifactProvenance(manifest, options) {
  validateManifest(manifest);
  if (!isRecord(options)) throw new TypeError('artifact provenance options must be an object');
  const {
    sourceIds,
    profile,
    use,
    storagePath,
    licenceNotices = {},
  } = options;
  if (!isRecord(licenceNotices)) {
    throw new TypeError('artifact licenceNotices must be an object');
  }
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
  const licenceObligations = [];
  if (redistributable) {
    for (const source of sources) {
      const obligations = source.redistribution_obligations;
      if (!obligations) continue;
      const notice = licenceNotices[source.id];
      if (!isRecord(notice)) {
        throw new Error(`artifact is missing licence notice for source "${source.id}"`);
      }
      const expected = {
        attribution: obligations.attribution,
        licence_notice: obligations.licence_notice,
        licence_id: source.licence.id,
        licence_url: source.licence.terms_url,
        source_url: obligations.source_url,
      };
      for (const [field, value] of Object.entries(expected)) {
        if (notice[field] !== value) {
          throw new Error(
            `artifact licence notice for source "${source.id}" has invalid ${field}`,
          );
        }
      }
      if (obligations.changes_notice_required) {
        if (typeof notice.changes !== 'string'
          || notice.changes.trim() !== notice.changes
          || normalizeOpenFdaText(notice.changes).length < 8
          || !/[\p{L}\p{N}]/u.test(normalizeOpenFdaText(notice.changes))) {
          throw new Error(
            `artifact licence notice for source "${source.id}" requires a changes notice`,
          );
        }
      }
      if (obligations.compatible_adapter_licences !== undefined
        && !obligations.compatible_adapter_licences.includes(notice.adapter_licence)) {
        throw new Error(
          `artifact licence notice for source "${source.id}" has an incompatible adapter licence`,
        );
      }
      licenceObligations.push({
        source_id: source.id,
        ...expected,
        changes: notice.changes,
        ...(notice.adapter_licence === undefined
          ? {}
          : { adapter_licence: notice.adapter_licence }),
      });
    }
  }

  return {
    profile,
    use,
    storage_path: normalizeRelativePath(storagePath, 'artifact storage path'),
    source_ids: normalizedIds,
    artifact_pack: artifactPack,
    redistributable,
    licence_obligations: licenceObligations,
  };
}
