import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyInteractionEvidenceRecords } from '../src/lib/interaction-evidence-live-verifier.mjs';

const SET_ID = 'b389b1a3-672f-47e3-916c-4a9c044b211b';
const OPENFDA_URL =
  `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(`set_id:"${SET_ID}"`)}&limit=100`;
const DAILYMED_URL =
  `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${SET_ID}.xml`;
const GOV_PAGE_URL = 'https://www.gov.uk/drug-safety-update/fixture';
const GOV_API_URL = 'https://www.gov.uk/api/content/drug-safety-update/fixture';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function openFdaFixture() {
  const text = 'The label states an exact interaction proposition.';
  const payload = {
    set_id: SET_ID,
    version: '1',
    effective_time: '20241010',
    drug_interactions: [text],
  };
  const evidence = {
    source_id: 'fixture-openfda-label',
    source_policy_id: 'openfda-labels',
    source_policy_use: 'interaction-evidence',
    licence: 'CC0-1.0',
    source_url: OPENFDA_URL,
    reference_url:
      `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${SET_ID}`,
    source_host: 'api.fda.gov',
    canonical_setid: SET_ID,
    spl_version: 1,
    source_date: '2024-10-10',
    document_id: SET_ID,
    document_version: '1',
    retrieved_at: '2026-07-23',
    jurisdiction: 'US',
    review_status: 'review_candidate',
    fragments: [{
      section: 'Drug Interactions',
      text,
      text_sha256: sha256(text),
      source_path: 'drug_interactions[0]',
    }],
    provenance: {
      set_id: SET_ID,
      version: '1',
      effective_time: '20241010',
      payload_sha256: sha256(JSON.stringify(canonicalize(payload))),
      payload_canonicalization: 'sorted-json-keys-v1',
      normalization_version: 'openfda-spl-text-v1',
      source_paths: ['drug_interactions[0]'],
    },
    supports: {
      interaction_exists: true,
      source_effect: ['fixture_effect'],
      label_action: [],
      jurisdictions: ['US'],
    },
  };
  return { evidence, payload };
}

function openFdaCounterevidenceFixture() {
  const fixture = openFdaFixture();
  const text = 'No clinically meaningful effect on exposure was observed.';
  fixture.payload.drug_interactions = [text];
  fixture.evidence.source_id = 'fixture-openfda-counterevidence';
  fixture.evidence.source_policy_use = 'interaction-counterevidence';
  fixture.evidence.fragments = [{
    section: 'Drug Interactions',
    text,
    text_sha256: sha256(text),
    source_path: 'drug_interactions[0]',
  }];
  fixture.evidence.provenance = {
    ...fixture.evidence.provenance,
    payload_sha256: sha256(JSON.stringify(canonicalize(fixture.payload))),
    source_paths: ['drug_interactions[0]'],
  };
  fixture.evidence.supports = {
    interaction_exists: false,
    source_effect: ['no_clinically_meaningful_effect'],
    label_action: [],
    jurisdictions: ['US'],
  };
  return fixture;
}

function govUkFixture() {
  const text = 'The safety update states an exact interaction proposition.';
  const contentApi = {
    base_path: '/drug-safety-update/fixture',
    document_type: 'drug_safety_update',
    details: { body: text },
  };
  const evidence = {
    source_id: 'fixture-govuk',
    source_policy_id: 'mhra-govuk-drug-safety-updates',
    source_policy_use: 'interaction-evidence',
    licence: 'OGL-3.0',
    source_url: GOV_PAGE_URL,
    source_host: 'gov.uk',
    document_id: 'fixture',
    document_version: '2026-07-23',
    retrieved_at: '2026-07-23',
    jurisdiction: 'UK',
    review_status: 'review_candidate',
    attribution:
      'Contains public sector information licensed under the Open Government Licence v3.0.',
    fragments: [{
      section: 'Drug Safety Update',
      text,
      text_sha256: sha256(text),
      source_path: 'details.body',
    }],
    provenance: {
      page_licence: 'OGL-3.0',
      document_sha256: sha256(JSON.stringify(canonicalize(contentApi))),
      payload_url: GOV_API_URL,
    },
    supports: {
      interaction_exists: true,
      source_effect: ['fixture_effect'],
      label_action: [],
      jurisdictions: ['UK'],
    },
  };
  return { evidence, contentApi };
}

function fakeResponse(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => body,
  };
}

function fixtureFetch(openFdaPayload, govContentApi, calls) {
  return async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === DAILYMED_URL) {
      return fakeResponse(
        `<document><setId root="${SET_ID}"/><versionNumber value="1"/><effectiveTime value="20241010"/></document>`,
      );
    }
    if (url === OPENFDA_URL) {
      return fakeResponse(JSON.stringify({ results: [openFdaPayload] }));
    }
    if (url === GOV_API_URL) {
      return fakeResponse(JSON.stringify(govContentApi));
    }
    if (url === GOV_PAGE_URL) {
      return fakeResponse(
        '<footer>Open Government Licence v3.0 https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/</footer>',
      );
    }
    throw new Error(`unexpected URL ${url}`);
  };
}

function rolloverFetch(openFdaPayload, calls) {
  let dailyMedCalls = 0;
  return async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === DAILYMED_URL) {
      dailyMedCalls += 1;
      const version = dailyMedCalls === 1 ? '1' : '2';
      const effectiveTime = dailyMedCalls === 1 ? '20241010' : '20250701';
      return fakeResponse(
        `<document><setId root="${SET_ID}"/><versionNumber value="${version}"/><effectiveTime value="${effectiveTime}"/></document>`,
      );
    }
    if (url === OPENFDA_URL) {
      return fakeResponse(JSON.stringify({ results: [openFdaPayload] }));
    }
    throw new Error(`unexpected URL ${url}`);
  };
}

test('live verifier brackets a stable DailyMed version, deduplicates fetches, and binds every supplied record', async () => {
  const openFda = openFdaFixture();
  const govUk = govUkFixture();
  const calls = [];
  const openRecord = {
    section: 'G',
    rule_id: 'fixture-openfda',
    evidence: openFda.evidence,
    storagePath:
      'docs/interaction-review/batch-01-v2/sections/G.verified.jsonl',
  };
  const result = await verifyInteractionEvidenceRecords({
    records: [
      openRecord,
      { ...openRecord, rule_id: 'fixture-openfda-duplicate' },
      {
        section: 'D',
        rule_id: 'fixture-govuk',
        evidence: govUk.evidence,
        storagePath:
          'docs/interaction-review/batch-01-v2/sections/D.verified.jsonl',
      },
    ],
    concurrency: 2,
    retries: 0,
    fetchImpl: fixtureFetch(openFda.payload, govUk.contentApi, calls),
  });

  assert.deepEqual(result, {
    profile: 'production-open',
    records_verified: 3,
    openfda_records_verified: 2,
    govuk_records_verified: 1,
    unique_openfda_set_ids: 1,
    unique_openfda_urls: 1,
    unique_govuk_pages: 1,
  });
  assert.equal(calls.filter((url) => url === DAILYMED_URL).length, 2);
  assert.equal(calls.filter((url) => url === OPENFDA_URL).length, 1);
  assert.equal(calls.filter((url) => url === GOV_API_URL).length, 1);
  assert.equal(calls.filter((url) => url === GOV_PAGE_URL).length, 1);
});

test('live verifier fully binds typed openFDA counterevidence', async () => {
  const openFda = openFdaCounterevidenceFixture();
  const calls = [];
  const result = await verifyInteractionEvidenceRecords({
    records: [{
      section: 'I',
      rule_id: 'fixture-counterevidence',
      evidence: openFda.evidence,
      storagePath:
        'docs/interaction-review/batch-01-v2/sections/I.verified.jsonl',
    }],
    retries: 0,
    fetchImpl: fixtureFetch(openFda.payload, null, calls),
  });

  assert.equal(result.records_verified, 1);
  assert.equal(result.openfda_records_verified, 1);
  assert.equal(calls.filter((url) => url === DAILYMED_URL).length, 2);
  assert.equal(calls.filter((url) => url === OPENFDA_URL).length, 1);
});

test('live verifier rejects a DailyMed current-version rollover during openFDA verification', async () => {
  const openFda = openFdaFixture();
  const calls = [];

  await assert.rejects(
    () => verifyInteractionEvidenceRecords({
      records: [{
        section: 'G',
        rule_id: 'fixture-openfda-rollover',
        evidence: openFda.evidence,
        storagePath:
          'docs/interaction-review/batch-01-v2/sections/G.verified.jsonl',
      }],
      retries: 0,
      fetchImpl: rolloverFetch(openFda.payload, calls),
    }),
    (error) => error instanceof AggregateError
      && error.errors.some(
        (failure) => /current SPL changed during openFDA verification.*\/1\/20241010 to .*\/2\/20250701/i.test(
          failure.message,
        ),
      ),
  );

  assert.deepEqual(calls, [DAILYMED_URL, OPENFDA_URL, DAILYMED_URL]);
});

test('live verifier rejects counterevidence masquerading as positive before network', async () => {
  const openFda = openFdaCounterevidenceFixture();
  openFda.evidence.source_policy_use = 'interaction-evidence';
  openFda.evidence.supports.interaction_exists = true;
  const calls = [];

  await assert.rejects(
    () => verifyInteractionEvidenceRecords({
      records: [{
        section: 'I',
        rule_id: 'counterevidence-masquerade',
        evidence: openFda.evidence,
        storagePath:
          'docs/interaction-review/batch-01-v2/sections/I.verified.jsonl',
      }],
      retries: 0,
      fetchImpl: fixtureFetch(openFda.payload, null, calls),
    }),
    (error) => error instanceof AggregateError
      && error.errors.some(
        (failure) => /cannot use a counterevidence source_effect/i.test(failure.message),
      ),
  );
  assert.deepEqual(calls, []);
});

test('live verifier rejects a forged openFDA hash against the fetched payload', async () => {
  const openFda = openFdaFixture();
  openFda.evidence.provenance.payload_sha256 = '0'.repeat(64);
  const calls = [];
  await assert.rejects(
    () => verifyInteractionEvidenceRecords({
      records: [{
        section: 'G',
        rule_id: 'forged-openfda',
        evidence: openFda.evidence,
        storagePath:
          'docs/interaction-review/batch-01-v2/sections/G.verified.jsonl',
      }],
      retries: 0,
      fetchImpl: fixtureFetch(openFda.payload, null, calls),
    }),
    (error) => error instanceof AggregateError
      && error.errors.some((failure) => /payload SHA-256 does not match/i.test(failure.message)),
  );
});

test('live verifier bounds a hung request with a deadline that keeps the event loop alive', async () => {
  // Regression guard for the Node 22 drained-event-loop hang: the request
  // deadline must be driven by a ref'd timer, so a fetch that never settles
  // on its own is aborted with a TimeoutError instead of the awaited promise
  // pending forever. With an unref'd AbortSignal.timeout() deadline this test
  // never settles and the runner reports the promise as still pending.
  const openFda = openFdaFixture();
  const abortReasons = [];
  const hangingFetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      abortReasons.push(options.signal.reason);
      reject(options.signal.reason);
    }, { once: true });
  });

  await assert.rejects(
    () => verifyInteractionEvidenceRecords({
      records: [{
        section: 'G',
        rule_id: 'hung-request',
        evidence: openFda.evidence,
        storagePath:
          'docs/interaction-review/batch-01-v2/sections/G.verified.jsonl',
      }],
      retries: 0,
      requestTimeoutMs: 50,
      fetchImpl: hangingFetch,
    }),
    (error) => error instanceof AggregateError
      && error.errors.some(
        (failure) => failure.cause?.name === 'TimeoutError'
          && /request timed out after 50ms/.test(failure.cause.message),
      ),
  );
  assert.ok(abortReasons.length >= 1, 'the hung request must have been aborted');
  assert.ok(abortReasons.every((reason) => reason?.name === 'TimeoutError'));
});

test('live verifier validates requestTimeoutMs before any network request', async () => {
  const openFda = openFdaFixture();
  const calls = [];
  for (const invalid of [0, -1, 1.5, 'soon']) {
    await assert.rejects(
      () => verifyInteractionEvidenceRecords({
        records: [{
          section: 'G',
          rule_id: 'fixture-openfda',
          evidence: openFda.evidence,
          storagePath:
            'docs/interaction-review/batch-01-v2/sections/G.verified.jsonl',
        }],
        requestTimeoutMs: invalid,
        fetchImpl: fixtureFetch(openFda.payload, null, calls),
      }),
      (error) => error instanceof TypeError
        && /requestTimeoutMs must be a positive integer/.test(error.message),
    );
  }
  assert.deepEqual(calls, []);
});

test('live verifier rejects restricted metadata before any network request', async () => {
  const openFda = openFdaFixture();
  openFda.evidence.source_policy_id = 'onemg-live';
  openFda.evidence.source_policy_use = 'ingredient-index';
  openFda.evidence.licence = 'PROPRIETARY-WEB';
  const calls = [];
  await assert.rejects(
    () => verifyInteractionEvidenceRecords({
      records: [{
        section: 'G',
        rule_id: 'restricted-evidence',
        evidence: openFda.evidence,
        storagePath:
          'docs/interaction-review/batch-01-v2/sections/G.verified.jsonl',
      }],
      retries: 0,
      fetchImpl: fixtureFetch(openFda.payload, null, calls),
    }),
    (error) => error instanceof AggregateError
      && error.errors.some((failure) => /onemg-live.*production-open/i.test(failure.message)),
  );
  assert.deepEqual(calls, []);
});
