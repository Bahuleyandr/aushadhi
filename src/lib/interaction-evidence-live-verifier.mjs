import {
  assertEvidenceAllowed,
  assertEvidenceMetadataAllowed,
  loadSourceManifest,
} from './interaction-source-policy.mjs';

const OPENFDA_POLICY = 'openfda-labels';
const GOVUK_POLICY = 'mhra-govuk-drug-safety-updates';
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_RETRIES = 2;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

function positiveInteger(value, fallback, label) {
  const candidate = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(candidate) || candidate < 1) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return candidate;
}

function nonNegativeInteger(value, fallback, label) {
  const candidate = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(candidate) || candidate < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return candidate;
}

function recordLabel(record, index) {
  const section = record?.section ?? '?';
  const ruleId = record?.rule_id ?? record?.ruleId ?? '?';
  const sourceId = record?.evidence?.source_id ?? '?';
  return `[${index}] ${section}/${ruleId}/${sourceId}`;
}

function taggedError(record, index, error) {
  return new Error(`${recordLabel(record, index)}: ${error.message}`, { cause: error });
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function fetchTextWithRetry(url, {
  fetchImpl,
  retries,
  requestTimeoutMs,
}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    // Uses an explicit ref'd timer instead of AbortSignal.timeout(): the
    // latter's internal timer is unref'd on some Node lines (observed on
    // 22.x), so when the in-flight request is the only pending work the event
    // loop drains before the deadline can fire and the awaited promise never
    // settles. Aborting with a TimeoutError DOMException keeps the observable
    // error contract identical to AbortSignal.timeout().
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new DOMException(
        `${url}: request timed out after ${requestTimeoutMs}ms`,
        'TimeoutError',
      ));
    }, requestTimeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/json, application/xml, text/html;q=0.9, */*;q=0.5',
          'user-agent': 'aushadhi-interaction-evidence-verifier/1.0',
        },
        signal: controller.signal,
      });
      const contentLength = Number(response.headers?.get?.('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw new Error(`${url}: response exceeds ${MAX_RESPONSE_BYTES} bytes`);
      }
      const body = await response.text();
      if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
        throw new Error(`${url}: response exceeds ${MAX_RESPONSE_BYTES} bytes`);
      }
      if (!response.ok) {
        const error = new Error(`${url}: HTTP ${response.status}: ${body.slice(0, 240)}`);
        error.retryable = response.status === 408
          || response.status === 425
          || response.status === 429
          || response.status >= 500;
        throw error;
      }
      return body;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt === retries || error.retryable === false) break;
      await wait(300 * (2 ** attempt));
    } finally {
      // Also covers the success path; double-clearing after a caught error
      // is a no-op. No stray ref'd timer outlives its request.
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

function parseJson(text, url) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${url}: invalid JSON: ${error.message}`);
  }
}

function parseCurrentSplXml(xml, expectedSetId, url) {
  const setId = xml.match(/<setId\s+root="([^"]+)"/u)?.[1]?.toLowerCase();
  const version = xml.match(/<versionNumber\s+value="(\d+)"/u)?.[1];
  const effectiveTime = xml.match(/<effectiveTime\s+value="(\d{8})"/u)?.[1];
  if (setId !== expectedSetId.toLowerCase() || !version || !effectiveTime) {
    throw new Error(`${url}: current SPL metadata is missing or mismatched`);
  }
  return { set_id: setId, version, effective_time: effectiveTime };
}

function exactCurrentOpenFdaRecord(response, current, url) {
  if (!Array.isArray(response.results)) {
    throw new Error(`${url}: response.results must be an array`);
  }
  const matches = response.results.filter(
    (record) => String(record.set_id ?? '').toLowerCase() === current.set_id
      && String(record.version ?? '') === current.version
      && String(record.effective_time ?? '') === current.effective_time,
  );
  if (matches.length !== 1) {
    throw new Error(
      `${url}: current DailyMed ${current.version}/${current.effective_time} matched ${matches.length} openFDA records`,
    );
  }
  return matches[0];
}

function sameCurrentSpl(left, right) {
  return left.set_id === right.set_id
    && left.version === right.version
    && left.effective_time === right.effective_time;
}

function currentSplLabel(current) {
  return `${current.set_id}/${current.version}/${current.effective_time}`;
}

function addFailure(failures, failedIndexes, records, index, error) {
  if (failedIndexes.has(index)) return;
  failedIndexes.add(index);
  failures.push(taggedError(records[index], index, error));
}

export async function verifyInteractionEvidenceRecords({
  records,
  manifest = loadSourceManifest(),
  profile = 'production-open',
  concurrency,
  retries,
  requestTimeoutMs,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new TypeError('records must be a non-empty array');
  }
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function');
  }
  const workerCount = positiveInteger(
    concurrency,
    DEFAULT_CONCURRENCY,
    'concurrency',
  );
  const retryCount = nonNegativeInteger(
    retries,
    DEFAULT_RETRIES,
    'retries',
  );
  const timeoutMs = positiveInteger(
    requestTimeoutMs,
    DEFAULT_REQUEST_TIMEOUT_MS,
    'requestTimeoutMs',
  );
  const failures = [];
  const failedIndexes = new Set();

  for (const [index, record] of records.entries()) {
    try {
      if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        throw new TypeError('record must be an object');
      }
      if (typeof record.storagePath !== 'string' || record.storagePath.length === 0) {
        throw new TypeError('storagePath must be a non-empty string');
      }
      assertEvidenceMetadataAllowed(manifest, record.evidence, {
        profile,
        use: record.evidence?.source_policy_use,
        storagePath: record.storagePath,
      });
    } catch (error) {
      addFailure(failures, failedIndexes, records, index, error);
    }
  }

  const openFdaIndexes = records
    .map((record, index) => ({ record, index }))
    .filter(({ record, index }) => !failedIndexes.has(index)
      && record.evidence.source_policy_id === OPENFDA_POLICY);
  const govUkIndexes = records
    .map((record, index) => ({ record, index }))
    .filter(({ record, index }) => !failedIndexes.has(index)
      && record.evidence.source_policy_id === GOVUK_POLICY);
  for (const { record, index } of records.map((candidate, candidateIndex) => ({
    record: candidate,
    index: candidateIndex,
  }))) {
    if (!failedIndexes.has(index)
      && ![OPENFDA_POLICY, GOVUK_POLICY].includes(record.evidence.source_policy_id)) {
      addFailure(
        failures,
        failedIndexes,
        records,
        index,
        new Error(`live payload resolver does not support "${record.evidence.source_policy_id}"`),
      );
    }
  }

  const indexesBySetId = new Map();
  for (const { record, index } of openFdaIndexes) {
    const setId = record.evidence.provenance.set_id.toLowerCase();
    const indexes = indexesBySetId.get(setId) ?? [];
    indexes.push(index);
    indexesBySetId.set(setId, indexes);
  }
  const currentBySetId = new Map();
  await runPool([...indexesBySetId.keys()], workerCount, async (setId) => {
    const url =
      `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setId}.xml`;
    try {
      const xml = await fetchTextWithRetry(url, {
        fetchImpl,
        retries: retryCount,
        requestTimeoutMs: timeoutMs,
      });
      currentBySetId.set(setId, parseCurrentSplXml(xml, setId, url));
    } catch (error) {
      for (const index of indexesBySetId.get(setId)) {
        addFailure(failures, failedIndexes, records, index, error);
      }
    }
  });

  const indexesByOpenFdaUrl = new Map();
  for (const { record, index } of openFdaIndexes) {
    if (failedIndexes.has(index)) continue;
    const url = record.evidence.source_url;
    const indexes = indexesByOpenFdaUrl.get(url) ?? [];
    indexes.push(index);
    indexesByOpenFdaUrl.set(url, indexes);
  }
  const openFdaPayloadByUrl = new Map();
  await runPool([...indexesByOpenFdaUrl.keys()], workerCount, async (url) => {
    const indexes = indexesByOpenFdaUrl.get(url);
    const setIds = new Set(
      indexes.map((index) => records[index].evidence.provenance.set_id.toLowerCase()),
    );
    try {
      if (setIds.size !== 1) {
        throw new Error(`${url}: one source URL maps to multiple set IDs`);
      }
      const setId = [...setIds][0];
      const body = await fetchTextWithRetry(url, {
        fetchImpl,
        retries: retryCount,
        requestTimeoutMs: timeoutMs,
      });
      const response = parseJson(body, url);
      openFdaPayloadByUrl.set(
        url,
        exactCurrentOpenFdaRecord(response, currentBySetId.get(setId), url),
      );
    } catch (error) {
      for (const index of indexes) {
        addFailure(failures, failedIndexes, records, index, error);
      }
    }
  });

  await runPool([...indexesBySetId.keys()], workerCount, async (setId) => {
    const indexes = indexesBySetId.get(setId);
    if (indexes.every((index) => failedIndexes.has(index))) return;
    const url =
      `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setId}.xml`;
    try {
      const xml = await fetchTextWithRetry(url, {
        fetchImpl,
        retries: retryCount,
        requestTimeoutMs: timeoutMs,
      });
      const currentAfterOpenFda = parseCurrentSplXml(xml, setId, url);
      const currentBeforeOpenFda = currentBySetId.get(setId);
      if (!sameCurrentSpl(currentBeforeOpenFda, currentAfterOpenFda)) {
        throw new Error(
          `${url}: current SPL changed during openFDA verification `
          + `(${currentSplLabel(currentBeforeOpenFda)} to ${currentSplLabel(currentAfterOpenFda)})`,
        );
      }
    } catch (error) {
      for (const index of indexes) {
        addFailure(failures, failedIndexes, records, index, error);
      }
    }
  });

  const indexesByGovUrl = new Map();
  for (const { record, index } of govUkIndexes) {
    if (failedIndexes.has(index)) continue;
    const url = record.evidence.source_url;
    const indexes = indexesByGovUrl.get(url) ?? [];
    indexes.push(index);
    indexesByGovUrl.set(url, indexes);
  }
  const govPayloadByUrl = new Map();
  await runPool([...indexesByGovUrl.keys()], workerCount, async (pageUrl) => {
    const indexes = indexesByGovUrl.get(pageUrl);
    try {
      const pathname = new URL(pageUrl).pathname;
      const contentApiUrl = `https://www.gov.uk/api/content${pathname}`;
      const [contentApiText, pageHtml] = await Promise.all([
        fetchTextWithRetry(contentApiUrl, {
          fetchImpl,
          retries: retryCount,
          requestTimeoutMs: timeoutMs,
        }),
        fetchTextWithRetry(pageUrl, {
          fetchImpl,
          retries: retryCount,
          requestTimeoutMs: timeoutMs,
        }),
      ]);
      govPayloadByUrl.set(pageUrl, {
        content_api: parseJson(contentApiText, contentApiUrl),
        content_api_url: contentApiUrl,
        page_html: pageHtml,
        page_url: pageUrl,
      });
    } catch (error) {
      for (const index of indexes) {
        addFailure(failures, failedIndexes, records, index, error);
      }
    }
  });

  let verified = 0;
  for (const [index, record] of records.entries()) {
    if (failedIndexes.has(index)) continue;
    const evidence = record.evidence;
    const payload = evidence.source_policy_id === OPENFDA_POLICY
      ? openFdaPayloadByUrl.get(evidence.source_url)
      : govPayloadByUrl.get(evidence.source_url);
    try {
      const result = assertEvidenceAllowed(manifest, evidence, {
        profile,
        use: evidence.source_policy_use,
        storagePath: record.storagePath,
        payload,
      });
      if (result.payload_binding !== 'verified') {
        throw new Error(`payload binding returned "${result.payload_binding}"`);
      }
      verified += 1;
    } catch (error) {
      addFailure(failures, failedIndexes, records, index, error);
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `${failures.length} of ${records.length} interaction evidence records failed live provenance verification`,
    );
  }

  return {
    profile,
    records_verified: verified,
    openfda_records_verified: openFdaIndexes.length,
    govuk_records_verified: govUkIndexes.length,
    unique_openfda_set_ids: indexesBySetId.size,
    unique_openfda_urls: indexesByOpenFdaUrl.size,
    unique_govuk_pages: indexesByGovUrl.size,
  };
}
