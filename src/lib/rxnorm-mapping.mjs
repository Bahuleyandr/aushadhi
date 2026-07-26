import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createIngredientIdentity,
} from './ingredient-identity.mjs';

export const RXNORM_API_ORIGIN = 'https://rxnav.nlm.nih.gov';
export const RXNORM_MAPPING_CANDIDATE_SCHEMA_VERSION = 1;

const CACHE_SCHEMA_VERSION = 1;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const EXPECTED_TERM_TYPES = new Set(['IN', 'PIN']);
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function requireIsoDate(value, label) {
  const normalized = requireNonEmptyString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw new TypeError(`${label} must be an ISO calendar date`);
  }
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new TypeError(`${label} must be a valid ISO calendar date`);
  }
  return normalized;
}

function rxNormUrl(pathname, parameters = {}) {
  const url = new URL(pathname, RXNORM_API_ORIGIN);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

function cachePathForUrl(cacheDir, url) {
  return path.join(cacheDir, `${sha256(url)}.json`);
}

async function readCache(cacheDir, url) {
  if (!cacheDir) return null;
  const file = cachePathForUrl(cacheDir, url);
  let value;
  try {
    value = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`invalid RxNorm cache entry ${file}: ${error.message}`, { cause: error });
  }
  if (!isObject(value)
      || value.schema_version !== CACHE_SCHEMA_VERSION
      || value.url !== url
      || typeof value.body !== 'string'
      || value.response_sha256 !== sha256(value.body)) {
    throw new Error(`invalid RxNorm cache binding for ${url}`);
  }
  let payload;
  try {
    payload = JSON.parse(value.body);
  } catch (error) {
    throw new Error(`invalid cached RxNorm JSON for ${url}: ${error.message}`, { cause: error });
  }
  if (!isObject(payload)) throw new Error(`cached RxNorm payload for ${url} must be an object`);
  return {
    url,
    payload,
    response_sha256: value.response_sha256,
    cache_status: 'hit',
  };
}

async function writeCache(cacheDir, url, body) {
  if (!cacheDir) return;
  await fs.mkdir(cacheDir, { recursive: true });
  const file = cachePathForUrl(cacheDir, url);
  const temporary = path.join(
    cacheDir,
    `.${path.basename(file)}.tmp-${process.pid}-${randomUUID()}`,
  );
  const value = {
    schema_version: CACHE_SCHEMA_VERSION,
    url,
    response_sha256: sha256(body),
    body,
  };
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value)}\n`, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function responseOriginAllowed(response, requestUrl) {
  const finalUrl = new URL(response.url || requestUrl);
  return finalUrl.origin === RXNORM_API_ORIGIN && finalUrl.pathname.startsWith('/REST/');
}

async function readBoundedResponseText(response) {
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('RxNorm response exceeded the 2 MiB limit');
  }
  if (!response.body || typeof response.body[Symbol.asyncIterator] !== 'function') {
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new Error('RxNorm response exceeded the 2 MiB limit');
    }
    return body;
  }
  const decoder = new TextDecoder();
  let byteLength = 0;
  let body = '';
  for await (const chunk of response.body) {
    byteLength += chunk.byteLength;
    if (byteLength > MAX_RESPONSE_BYTES) {
      throw new Error('RxNorm response exceeded the 2 MiB limit');
    }
    body += decoder.decode(chunk, { stream: true });
  }
  return body + decoder.decode();
}

async function defaultSleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createRxNormClient({
  fetchImpl = globalThis.fetch,
  cacheDir = null,
  timeoutMs = 10_000,
  maxRetries = 2,
  retryDelayMs = 250,
  sleep = defaultSleep,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new TypeError('timeoutMs must be an integer between 1 and 60000');
  }
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) {
    throw new TypeError('maxRetries must be an integer between 0 and 5');
  }
  if (!Number.isSafeInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 10_000) {
    throw new TypeError('retryDelayMs must be an integer between 0 and 10000');
  }
  if (typeof sleep !== 'function') throw new TypeError('sleep must be a function');

  return {
    async requestJson(url, { refresh = false } = {}) {
      const parsedUrl = new URL(url);
      if (parsedUrl.origin !== RXNORM_API_ORIGIN || !parsedUrl.pathname.startsWith('/REST/')) {
        throw new Error(`RxNorm client rejects non-allowlisted URL ${url}`);
      }
      if (!refresh) {
        const cached = await readCache(cacheDir, parsedUrl.href);
        if (cached) return cached;
      }

      let lastError;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetchImpl(parsedUrl.href, {
            method: 'GET',
            headers: { accept: 'application/json' },
            redirect: 'manual',
            signal: controller.signal,
          });
          if (!responseOriginAllowed(response, parsedUrl.href)) {
            throw new Error(`RxNorm request redirected outside the allowlisted API origin`);
          }
          if (!response.ok) {
            const error = new Error(`RxNorm request failed with HTTP ${response.status}`);
            error.status = response.status;
            throw error;
          }
          const body = await readBoundedResponseText(response);
          let payload;
          try {
            payload = JSON.parse(body);
          } catch (error) {
            throw new Error(`RxNorm returned invalid JSON: ${error.message}`, { cause: error });
          }
          if (!isObject(payload)) throw new Error('RxNorm response must be a JSON object');
          await writeCache(cacheDir, parsedUrl.href, body);
          return {
            url: parsedUrl.href,
            payload,
            response_sha256: sha256(body),
            cache_status: 'miss',
          };
        } catch (error) {
          lastError = error;
          const isTransient = error.name === 'AbortError'
            || error.status === undefined
            || TRANSIENT_STATUSES.has(error.status);
          if (!isTransient || attempt === maxRetries) break;
          await sleep(retryDelayMs * (2 ** attempt));
        } finally {
          clearTimeout(timeout);
        }
      }
      throw new Error(`RxNorm request failed after ${maxRetries + 1} attempt(s): ${lastError.message}`, {
        cause: lastError,
      });
    },
  };
}

function rxNormIds(result, label) {
  const values = result.payload?.idGroup?.rxnormId ?? [];
  if (!Array.isArray(values)) throw new Error(`${label} rxnormId must be an array`);
  const ids = values.map((value, index) => {
    const id = requireNonEmptyString(value, `${label} rxnormId[${index}]`);
    if (!/^[0-9]+$/u.test(id)) throw new Error(`${label} returned an invalid RxCUI`);
    return id;
  });
  return [...new Set(ids)].sort((left, right) => (
    Number(left) - Number(right) || left.localeCompare(right)
  ));
}

function conceptProperties(result, expectedRxcui) {
  const value = result.payload?.properties;
  if (!isObject(value)) throw new Error(`RxNorm returned no active properties for ${expectedRxcui}`);
  const rxcui = requireNonEmptyString(value.rxcui, 'RxNorm properties.rxcui');
  if (rxcui !== expectedRxcui) throw new Error(`RxNorm properties returned the wrong RxCUI`);
  const tty = requireNonEmptyString(value.tty, 'RxNorm properties.tty');
  return {
    rxcui,
    name: requireNonEmptyString(value.name, 'RxNorm properties.name'),
    tty,
    synonym: typeof value.synonym === 'string' && value.synonym.trim()
      ? value.synonym.trim()
      : null,
    response_sha256: result.response_sha256,
    source_url: result.url,
  };
}

function uniiCodes(result) {
  const values = result.payload?.propConceptGroup?.propConcept ?? [];
  if (!Array.isArray(values)) throw new Error('RxNorm UNII properties must be an array');
  return [...new Set(values
    .filter((value) => value?.propName === 'UNII_CODE')
    .map((value) => requireNonEmptyString(value.propValue, 'RxNorm UNII code').toUpperCase())
    .filter((value) => /^[A-Z0-9]{10}$/u.test(value)))]
    .sort();
}

async function lookupProperties(client, ids) {
  const candidates = [];
  for (const rxcui of ids) {
    const properties = await client.requestJson(
      rxNormUrl(`/REST/rxcui/${encodeURIComponent(rxcui)}/properties.json`),
    );
    candidates.push(conceptProperties(properties, rxcui));
  }
  return candidates;
}

async function lookupUnii(client, rxcui) {
  const result = await client.requestJson(
    rxNormUrl(
      `/REST/Prescribe/rxcui/${encodeURIComponent(rxcui)}/property.json`,
      { propName: 'UNII_CODE' },
    ),
  );
  return {
    codes: uniiCodes(result),
    response_sha256: result.response_sha256,
    source_url: result.url,
  };
}

function searchStatus({ matchType, candidates }) {
  if (candidates.length === 0) return 'no_match';
  if (candidates.length !== 1) return 'ambiguous';
  if (!EXPECTED_TERM_TYPES.has(candidates[0].tty)) return 'unexpected_term_type';
  return matchType === 'exact' ? 'exact_single_candidate' : 'normalized_review_candidate';
}

function rxNormVersion(result) {
  const version = requireNonEmptyString(result.payload?.version, 'RxNorm version');
  const apiVersion = requireNonEmptyString(result.payload?.apiVersion, 'RxNorm API version');
  return {
    version,
    api_version: apiVersion,
    response_sha256: result.response_sha256,
    source_url: result.url,
  };
}

export async function proposeRxNormIngredientMapping({
  ingredient,
  client,
  retrievedAt,
}) {
  if (!client || typeof client.requestJson !== 'function') {
    throw new TypeError('client.requestJson is required');
  }
  const retrieved_at = requireIsoDate(retrievedAt, 'retrievedAt');
  const assertion = createIngredientIdentity(ingredient);
  const version = rxNormVersion(await client.requestJson(rxNormUrl('/REST/version.json')));
  const exactSearch = await client.requestJson(rxNormUrl('/REST/rxcui.json', {
    name: assertion.observed_name,
    allsrc: '0',
    search: '0',
  }));
  const exactIds = rxNormIds(exactSearch, 'exact RxNorm search');
  if (exactIds.length > 10) throw new Error('exact RxNorm search returned more than 10 concepts');

  let matchType = 'exact';
  let searchResult = exactSearch;
  let ids = exactIds;
  if (ids.length === 0) {
    matchType = 'normalized';
    searchResult = await client.requestJson(rxNormUrl('/REST/rxcui.json', {
      name: assertion.observed_name,
      allsrc: '0',
      search: '1',
    }));
    ids = rxNormIds(searchResult, 'normalized RxNorm search');
    if (ids.length > 10) throw new Error('normalized RxNorm search returned more than 10 concepts');
  }

  const candidates = await lookupProperties(client, ids);
  const status = searchStatus({ matchType, candidates });
  let unii = null;
  if (status === 'exact_single_candidate') {
    unii = await lookupUnii(client, candidates[0].rxcui);
  }
  return {
    schema_version: RXNORM_MAPPING_CANDIDATE_SCHEMA_VERSION,
    review_status: 'review_candidate',
    assertion: {
      ingredient_id: assertion.ingredient_id,
      canonical_name: assertion.canonical_name,
      observed_name: assertion.observed_name,
      precision: assertion.precision,
      source_field: assertion.source_field,
    },
    search: {
      match_type: matchType,
      status,
      source_id: 'rxnorm',
      retrieved_at,
      rxnorm_version: version.version,
      rxnorm_api_version: version.api_version,
      version_source_url: version.source_url,
      version_response_sha256: version.response_sha256,
      source_url: searchResult.url,
      response_sha256: searchResult.response_sha256,
    },
    candidates,
    unii,
    accepted_mapping: null,
  };
}
