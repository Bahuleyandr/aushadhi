import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import {
  assertArtifactProvenance,
  assertEvidenceAllowed,
  assertEvidenceMetadataAllowed,
  assertEvidenceMatchesPayload,
  assertSourceAllowed,
  assertSourcesAllowed,
  loadSourceManifest,
} from '../src/lib/interaction-source-policy.mjs';

const PRODUCTION_PATH = 'data/interaction/production-open/evidence-candidates.jsonl';
const INTERNAL_PATH = 'data/interaction/internal-evaluation/ingredient-index.jsonl';
const REVIEW_PATH = 'docs/interaction-review/batch-01-v2/sections/G.verified.jsonl';

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
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

function openFdaPayload(overrides = {}) {
  return {
    set_id: 'b389b1a3-672f-47e3-916c-4a9c044b211b',
    version: '1',
    effective_time: '20241010',
    drug_interactions: ['The label states an exact interaction proposition.'],
    ...overrides,
  };
}

function openFdaEvidence(overrides = {}) {
  const text = 'The label states an exact interaction proposition.';
  const setId = 'b389b1a3-672f-47e3-916c-4a9c044b211b';
  const payload = openFdaPayload();
  return {
    source_id: 'fixture-openfda-label',
    source_policy_id: 'openfda-labels',
    source_policy_use: 'interaction-evidence',
    licence: 'CC0-1.0',
    source_url: `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(`set_id:"${setId}"`)}&limit=100`,
    reference_url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}`,
    source_host: 'api.fda.gov',
    canonical_setid: setId,
    spl_version: 1,
    source_date: '2024-10-10',
    document_id: setId,
    document_version: '1',
    retrieved_at: '2026-07-23',
    jurisdiction: 'US',
    review_status: 'review_candidate',
    fragments: [
      {
        section: 'Drug Interactions',
        text,
        text_sha256: sha256(text),
        source_path: 'drug_interactions[0]',
      },
    ],
    provenance: {
      set_id: setId,
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
    ...overrides,
  };
}

function openFdaCounterevidence() {
  const text = 'No clinically meaningful effect on exposure was observed.';
  const payload = openFdaPayload({ drug_interactions: [text] });
  const evidence = openFdaEvidence({
    source_id: 'fixture-openfda-counterevidence',
    source_policy_use: 'interaction-counterevidence',
    supports: {
      interaction_exists: false,
      source_effect: ['no_clinically_meaningful_effect'],
      label_action: [],
      jurisdictions: ['US'],
    },
  });
  evidence.fragments = [{
    section: 'Drug Interactions',
    text,
    text_sha256: sha256(text),
    source_path: 'drug_interactions[0]',
  }];
  evidence.provenance = {
    ...evidence.provenance,
    payload_sha256: sha256(JSON.stringify(canonicalize(payload))),
    source_paths: ['drug_interactions[0]'],
  };
  return { evidence, payload };
}

function allowed(manifest, sourceId, overrides = {}) {
  return assertSourceAllowed(manifest, {
    sourceId,
    profile: 'production-open',
    use: 'interaction-evidence',
    storagePath: PRODUCTION_PATH,
    ...overrides,
  });
}

test('loads and validates the committed source manifest', () => {
  const manifest = loadSourceManifest();
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.policy_reviewed_at, '2026-07-28');
  assert.deepEqual(Object.keys(manifest.profiles).sort(), [
    'internal-evaluation',
    'production-open',
  ]);
  assert.ok(manifest.sources['openfda-labels']);
  assert.ok(manifest.sources['onemg-live']);
  assert.ok(manifest.sources['ddinter-2']);
  assert.equal(manifest.sources['ddinter-2'].enabled, false);
  assert.equal(manifest.sources['openfda-labels'].requires_document_reconciliation, true);
  assert.ok(manifest.uses.includes('interaction-counterevidence'));
  assert.ok(
    manifest.profiles['production-open'].allowed_uses
      .includes('interaction-counterevidence'),
  );
  assert.deepEqual(
    manifest.sources['openfda-labels'].allowed_uses,
    ['interaction-evidence', 'interaction-counterevidence'],
  );
  assert.throws(
    () => assertSourceAllowed(manifest, {
      sourceId: 'fda-cyp-transporter',
      profile: 'production-open',
      use: 'interaction-counterevidence',
      storagePath: PRODUCTION_PATH,
    }),
    /does not allow use "interaction-counterevidence"/i,
  );
  assert.equal(manifest.sources['fda-gsrs-unii'].allowed_uses[0], 'identity');
  for (const sourceId of [
    'dailymed-label-reference',
    'fda-accessdata-label-reference',
    'emc-manual-reference',
    'acr-manual-reference',
  ]) {
    assert.equal(manifest.sources[sourceId].enabled, false);
    assert.equal(manifest.sources[sourceId].ingestion_forbidden, true);
  }
});

test('accepts exact openFDA evidence with canonical policy and reconciliation fields', () => {
  const manifest = loadSourceManifest();
  const result = assertEvidenceAllowed(manifest, openFdaEvidence(), {
    profile: 'production-open',
    storagePath: REVIEW_PATH,
    payload: openFdaPayload(),
  });
  assert.equal(result.source.id, 'openfda-labels');
});

test('accepts typed openFDA interaction counterevidence only with full payload binding', () => {
  const manifest = loadSourceManifest();
  const { evidence, payload } = openFdaCounterevidence();
  const request = {
    profile: 'production-open',
    storagePath: REVIEW_PATH,
  };

  assert.equal(
    assertEvidenceMetadataAllowed(manifest, evidence, request).payload_binding,
    'pending',
  );
  assert.throws(
    () => assertEvidenceAllowed(manifest, evidence, request),
    /verified source payload is required/i,
  );
  const result = assertEvidenceAllowed(manifest, evidence, {
    ...request,
    payload,
  });
  assert.equal(result.source.id, 'openfda-labels');
  assert.equal(result.payload_binding, 'verified');
  assert.equal(result.evidence.supports.interaction_exists, false);
  assert.deepEqual(result.evidence.supports.label_action, []);
});

test('counterevidence cannot masquerade as positive interaction evidence', () => {
  const manifest = loadSourceManifest();
  const fixture = openFdaCounterevidence();
  const request = {
    profile: 'production-open',
    storagePath: REVIEW_PATH,
    payload: fixture.payload,
  };

  const positiveFlag = structuredClone(fixture.evidence);
  positiveFlag.supports.interaction_exists = true;
  assert.throws(
    () => assertEvidenceAllowed(manifest, positiveFlag, request),
    /counterevidence must set supports\.interaction_exists to false/i,
  );

  const positiveAction = structuredClone(fixture.evidence);
  positiveAction.supports.label_action = ['monitor_concentrations'];
  assert.throws(
    () => assertEvidenceAllowed(manifest, positiveAction, request),
    /counterevidence cannot assert label actions/i,
  );

  const missingEffect = structuredClone(fixture.evidence);
  missingEffect.supports.source_effect = [];
  assert.throws(
    () => assertEvidenceAllowed(manifest, missingEffect, request),
    /counterevidence requires a typed supports\.source_effect/i,
  );

  const untypedEffect = structuredClone(fixture.evidence);
  untypedEffect.supports.source_effect = ['reduced_exposure'];
  assert.throws(
    () => assertEvidenceAllowed(manifest, untypedEffect, request),
    /counterevidence has unsupported source_effect "reduced_exposure"/i,
  );

  const crossJurisdiction = structuredClone(fixture.evidence);
  crossJurisdiction.supports.jurisdictions = ['UK'];
  assert.throws(
    () => assertEvidenceAllowed(manifest, crossJurisdiction, request),
    /supports\.jurisdictions must exactly match evidence jurisdiction/i,
  );

  const relabelledPositive = structuredClone(fixture.evidence);
  relabelledPositive.source_policy_use = 'interaction-evidence';
  relabelledPositive.supports.interaction_exists = true;
  assert.throws(
    () => assertEvidenceAllowed(manifest, relabelledPositive, {
      ...request,
      use: 'interaction-evidence',
    }),
    /interaction evidence cannot use a counterevidence source_effect/i,
  );

  const positiveEvidenceWithFalseFlag = openFdaEvidence();
  positiveEvidenceWithFalseFlag.supports.interaction_exists = false;
  assert.throws(
    () => assertEvidenceAllowed(manifest, positiveEvidenceWithFalseFlag, {
      ...request,
      payload: openFdaPayload(),
    }),
    /interaction evidence must set supports\.interaction_exists to true/i,
  );
});

test('binds openFDA evidence to the supplied licensed payload', () => {
  const manifest = loadSourceManifest();
  const evidence = openFdaEvidence();
  const request = {
    profile: 'production-open',
    storagePath: REVIEW_PATH,
  };
  assert.throws(
    () => assertEvidenceAllowed(manifest, evidence, request),
    /verified source payload is required/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(manifest, evidence, {
      ...request,
      payload: openFdaPayload({
        drug_interactions: ['Different text from an unverified payload.'],
      }),
    }),
    /payload SHA-256 does not match|fragment is absent/i,
  );
  assert.doesNotThrow(() => assertEvidenceMatchesPayload(
    evidence,
    openFdaPayload(),
  ));

  const zeroWidth = openFdaEvidence();
  zeroWidth.fragments[0].text = '\u200b';
  zeroWidth.fragments[0].text_sha256 = sha256('\u200b');
  assert.throws(
    () => assertEvidenceAllowed(manifest, zeroWidth, {
      ...request,
      payload: openFdaPayload(),
    }),
    /non-empty trimmed string|not meaningful after normalization/i,
  );
});

test('metadata-only evidence validation is explicit and never claims payload verification', () => {
  const manifest = loadSourceManifest();
  const evidence = openFdaEvidence();
  const result = assertEvidenceMetadataAllowed(manifest, evidence, {
    profile: 'production-open',
    storagePath: REVIEW_PATH,
  });
  assert.equal(result.payload_binding, 'pending');
  assert.throws(
    () => assertEvidenceMetadataAllowed(
      manifest,
      {
        ...evidence,
        source_policy_id: 'onemg-live',
        source_policy_use: 'ingredient-index',
        licence: 'PROPRIETARY-WEB',
      },
      {
        profile: 'production-open',
        use: 'ingredient-index',
        storagePath: REVIEW_PATH,
      },
    ),
    /onemg-live.*production-open/i,
  );
});

test('rejects missing policy ids and mismatched evidence licences', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({ source_policy_id: undefined }),
      { profile: 'production-open', storagePath: REVIEW_PATH },
    ),
    /source_policy_id.*non-empty/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({ licence: 'US-PUBLIC-DOMAIN' }),
      { profile: 'production-open', storagePath: REVIEW_PATH },
    ),
    /licence.*does not match/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({ source: 'onemg-live' }),
      {
        profile: 'production-open',
        storagePath: REVIEW_PATH,
        payload: openFdaPayload(),
      },
    ),
    /legacy source is not allowed/i,
  );
});

test('rejects Unicode-empty evidence identifiers and fragment sections', () => {
  const manifest = loadSourceManifest();
  const request = {
    profile: 'production-open',
    storagePath: REVIEW_PATH,
    payload: openFdaPayload(),
  };
  for (const field of ['source_id', 'document_id', 'document_version']) {
    assert.throws(
      () => assertEvidenceAllowed(
        manifest,
        openFdaEvidence({ [field]: '\u200b' }),
        request,
      ),
      new RegExp(`${field} must be a non-empty trimmed string`, 'i'),
    );
  }
  const emptySection = openFdaEvidence();
  emptySection.fragments[0].section = '\u200b';
  assert.throws(
    () => assertEvidenceAllowed(manifest, emptySection, request),
    /fragments\[0\]\.section must be a non-empty trimmed string/i,
  );
});

test('rejects a DailyMed reference masquerading as the licensed openFDA origin', () => {
  const manifest = loadSourceManifest();
  const evidence = openFdaEvidence({
    source_url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b389b1a3-672f-47e3-916c-4a9c044b211b',
    source_host: 'dailymed.nlm.nih.gov',
  });
  assert.throws(
    () => assertEvidenceAllowed(manifest, evidence, {
      profile: 'production-open',
      storagePath: REVIEW_PATH,
    }),
    /not a licensed origin/i,
  );
});

test('rejects openFDA version, payload, path, and fragment hash mismatches', () => {
  const manifest = loadSourceManifest();
  const request = { profile: 'production-open', storagePath: REVIEW_PATH };
  const wrongVersion = openFdaEvidence({
    document_version: '2',
  });
  assert.throws(
    () => assertEvidenceAllowed(manifest, wrongVersion, request),
    /document_version.*provenance.version/i,
  );

  const wrongPayloadHash = openFdaEvidence();
  wrongPayloadHash.provenance.payload_sha256 = 'not-a-hash';
  assert.throws(
    () => assertEvidenceAllowed(manifest, wrongPayloadHash, request),
    /payload_sha256/i,
  );

  const wrongPath = openFdaEvidence();
  wrongPath.provenance.source_paths = ['warnings[0]'];
  assert.throws(
    () => assertEvidenceAllowed(manifest, wrongPath, request),
    /source_paths.*source_path/i,
  );

  const wrongFragmentHash = openFdaEvidence();
  wrongFragmentHash.fragments[0].text_sha256 = 'b'.repeat(64);
  assert.throws(
    () => assertEvidenceAllowed(manifest, wrongFragmentHash, request),
    /text_sha256 does not match/i,
  );

  const wrongReference = openFdaEvidence({
    reference_url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=11111111-1111-1111-1111-111111111111',
  });
  assert.throws(
    () => assertEvidenceAllowed(manifest, wrongReference, {
      ...request,
      payload: openFdaPayload(),
    }),
    /reference_url.*matching canonical setid/i,
  );

  const extraReferenceQuery = openFdaEvidence({
    reference_url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b389b1a3-672f-47e3-916c-4a9c044b211b&utm_source=fixture',
  });
  assert.throws(
    () => assertEvidenceAllowed(manifest, extraReferenceQuery, {
      ...request,
      payload: openFdaPayload(),
    }),
    /reference_url.*only the matching canonical setid/i,
  );
});

test('requires a typed claim boundary with matching evidence jurisdiction', () => {
  const manifest = loadSourceManifest();
  const request = {
    profile: 'production-open',
    storagePath: REVIEW_PATH,
    payload: openFdaPayload(),
  };
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({ supports: undefined }),
      request,
    ),
    /supports must be an object/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({
        supports: {
          interaction_exists: true,
          source_effect: ['fixture_effect'],
          label_action: [],
          jurisdictions: [],
        },
      }),
      request,
    ),
    /supports\.jurisdictions must be a non-empty array/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({
        jurisdiction: 'UK',
        supports: {
          interaction_exists: true,
          source_effect: ['fixture_effect'],
          label_action: [],
          jurisdictions: ['US'],
        },
      }),
      request,
    ),
    /supports\.jurisdictions must exactly match evidence jurisdiction/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({
        supports: {
          interaction_exists: false,
          source_effect: [],
          label_action: [],
          jurisdictions: ['US'],
        },
      }),
      request,
    ),
    /interaction evidence must set supports\.interaction_exists to true/i,
  );
});

test('rejects restricted reference policies in every profile', () => {
  const manifest = loadSourceManifest();
  for (const sourcePolicyId of [
    'dailymed-label-reference',
    'fda-accessdata-label-reference',
    'emc-manual-reference',
    'acr-manual-reference',
  ]) {
    const evidence = openFdaEvidence({
      source_policy_id: sourcePolicyId,
      source_url: manifest.sources[sourcePolicyId].homepage,
      licence: manifest.sources[sourcePolicyId].licence.id,
    });
    for (const profile of ['production-open', 'internal-evaluation']) {
      assert.throws(
        () => assertEvidenceAllowed(manifest, evidence, {
          profile,
          storagePath: REVIEW_PATH,
        }),
        new RegExp(`${sourcePolicyId}.*ingestion forbidden`, 'i'),
      );
    }
  }
});

test('enforces evidence use, repository zone, and source-origin path', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => assertEvidenceAllowed(manifest, openFdaEvidence(), {
      profile: 'production-open',
      use: 'identity',
      storagePath: REVIEW_PATH,
    }),
    /requested use.*source_policy_use/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(manifest, openFdaEvidence(), {
      profile: 'production-open',
      storagePath: 'dist/latest/evidence.jsonl',
    }),
    /storage zone/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({
        source_url: 'https://api.fda.gov/drug/event.json?search=set_id%3A%22b389b1a3-672f-47e3-916c-4a9c044b211b%22&limit=100',
      }),
      { profile: 'production-open', storagePath: REVIEW_PATH },
    ),
    /licensed origin path/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({
        source_url: 'https://api.fda.gov/drug/label.json/not-the-endpoint?search=set_id%3A%22b389b1a3-672f-47e3-916c-4a9c044b211b%22&limit=100',
      }),
      {
        profile: 'production-open',
        storagePath: REVIEW_PATH,
        payload: openFdaPayload(),
      },
    ),
    /licensed origin path/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({
        source_url: 'https://api.fda.gov/drug/label.json?search=set_id%3A%22b389b1a3-672f-47e3-916c-4a9c044b211b%22&limit=100&api_key=not-allowed',
      }),
      {
        profile: 'production-open',
        storagePath: REVIEW_PATH,
        payload: openFdaPayload(),
      },
    ),
    /may contain only one search and one limit/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({
        source_url: 'https://api.fda.gov:8443/drug/label.json?search=set_id%3A%22b389b1a3-672f-47e3-916c-4a9c044b211b%22&limit=100',
      }),
      {
        profile: 'production-open',
        storagePath: REVIEW_PATH,
        payload: openFdaPayload(),
      },
    ),
    /custom port/i,
  );
});

test('rejects invalid evidence dates before payload validation', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({ retrieved_at: '2026-02-30' }),
      {
        profile: 'production-open',
        storagePath: REVIEW_PATH,
        payload: openFdaPayload(),
      },
    ),
    /retrieved_at.*YYYY-MM-DD/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      openFdaEvidence({ source_date: '2024-02-30' }),
      {
        profile: 'production-open',
        storagePath: REVIEW_PATH,
        payload: openFdaPayload(),
      },
    ),
    /source_date.*valid YYYY-MM-DD/i,
  );
});

test('keeps GSRS evidence identity-only', () => {
  const manifest = loadSourceManifest();
  const text = '{"substance_name":"GLYBURIDE","unii":"SX6K58TVWC"}';
  const sourcePayload = {
    results: Array.from({ length: 3 }, (_, index) => (
      index === 2
        ? { substance_name: 'GLYBURIDE', unii: 'SX6K58TVWC' }
        : { substance_name: `FIXTURE-${index}`, unii: `FIXTURE-${index}` }
    )),
  };
  const sourceDocument = zipSync({
    'other-unii-0001-of-0001.json': strToU8(JSON.stringify(sourcePayload)),
  });
  const payload = {
    source_policy_id: 'fda-gsrs-unii',
    source_url: 'https://download.open.fda.gov/other/unii/other-unii-0001-of-0001.json.zip',
    document_id: 'SX6K58TVWC',
    document_version: 'openfda-unii-2026-07-23',
    source_document: sourceDocument,
    source_path: 'results[2]',
    payload: {
      substance_name: 'GLYBURIDE',
      unii: 'SX6K58TVWC',
    },
  };
  const evidence = {
    source_id: 'fixture-unii',
    source_policy_id: 'fda-gsrs-unii',
    source_policy_use: 'identity',
    licence: 'CC0-1.0',
    source_url: payload.source_url,
    reference_url: 'https://precision.fda.gov/uniisearch/srs/unii/SX6K58TVWC',
    source_host: 'download.open.fda.gov',
    document_id: 'SX6K58TVWC',
    document_version: payload.document_version,
    source_date: '2026-07-23',
    retrieved_at: '2026-07-23',
    jurisdiction: 'US',
    review_status: 'review_candidate',
    fragments: [{
      section: 'UNII export record',
      text,
      text_sha256: sha256(text),
      source_path: payload.source_path,
    }],
    provenance: {
      document_sha256: sha256Bytes(sourceDocument),
      export_date: '2026-07-23',
      source_path: payload.source_path,
      rendering_version: 'sorted-json-keys-v1',
    },
    supports: {
      interaction_exists: false,
      source_effect: [],
      label_action: [],
      jurisdictions: ['US'],
      identity_assertions: ['glyburide_has_unii_SX6K58TVWC'],
    },
  };
  assert.doesNotThrow(() => assertEvidenceAllowed(manifest, evidence, {
    profile: 'production-open',
    storagePath: REVIEW_PATH,
    payload,
  }));

  evidence.supports.interaction_exists = true;
  assert.throws(
    () => assertEvidenceAllowed(manifest, evidence, {
      profile: 'production-open',
      storagePath: REVIEW_PATH,
      payload,
    }),
    /identity evidence.*interaction_exists/i,
  );

  evidence.supports.interaction_exists = false;
  const alteredArchive = structuredClone(payload);
  alteredArchive.source_document = zipSync({
    'other-unii-0001-of-0001.json': strToU8(JSON.stringify({
      ...sourcePayload,
      results: sourcePayload.results.map((entry, index) => (
        index === 2 ? { substance_name: 'GLIBENCLAMIDE', unii: entry.unii } : entry
      )),
    })),
  });
  assert.throws(
    () => assertEvidenceAllowed(manifest, evidence, {
      profile: 'production-open',
      storagePath: REVIEW_PATH,
      payload: alteredArchive,
    }),
    /source document SHA-256 does not match|payload record does not match/i,
  );
});

test('keeps the dead FDA document source disabled and binds GOV.UK page rights', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'fda-authored-web-content'),
    /fda-authored-web-content.*disabled.*Not found/i,
  );

  const govText = 'MHRA Drug Safety Update fragment.';
  const sourceUrl = 'https://www.gov.uk/drug-safety-update/example';
  const contentApiUrl = 'https://www.gov.uk/api/content/drug-safety-update/example';
  const contentApi = {
    base_path: '/drug-safety-update/example',
    document_type: 'drug_safety_update',
    details: { body: govText },
  };
  const govPayload = {
    content_api: contentApi,
    content_api_url: contentApiUrl,
    page_html: '<footer>Open Government Licence v3.0 https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/</footer>',
    page_url: sourceUrl,
  };
  const attribution = manifest.sources['mhra-govuk-drug-safety-updates'].attribution;
  const govEvidence = {
    source_id: 'fixture-govuk',
    source_policy_id: 'mhra-govuk-drug-safety-updates',
    source_policy_use: 'interaction-evidence',
    licence: 'OGL-3.0',
    source_url: sourceUrl,
    source_host: 'gov.uk',
    document_id: 'example',
    document_version: '2026-07-23',
    retrieved_at: '2026-07-23',
    jurisdiction: 'UK',
    review_status: 'review_candidate',
    attribution,
    fragments: [{
      section: 'Drug Safety Update',
      text: govText,
      text_sha256: sha256(govText),
      source_path: 'details.body',
    }],
    provenance: {
      page_licence: 'OGL-3.0',
      document_sha256: sha256(JSON.stringify(canonicalize(contentApi))),
      payload_url: contentApiUrl,
    },
    supports: {
      interaction_exists: true,
      source_effect: [],
      label_action: [],
      jurisdictions: ['UK'],
    },
  };
  assert.doesNotThrow(() => assertEvidenceAllowed(manifest, govEvidence, {
    profile: 'production-open',
    storagePath: REVIEW_PATH,
    payload: govPayload,
  }));
  assert.throws(
    () => assertEvidenceAllowed(manifest, govEvidence, {
      profile: 'production-open',
      storagePath: REVIEW_PATH,
      payload: {
        ...govPayload,
        content_api_url: 'https://www.gov.uk/api/content/drug-safety-update/other',
      },
    }),
    /Content API URL does not match/i,
  );
  assert.throws(
    () => assertEvidenceAllowed(manifest, govEvidence, {
      profile: 'production-open',
      storagePath: REVIEW_PATH,
      payload: {
        ...govPayload,
        page_html: '<p>This page is not covered by the Open Government Licence v3.0. Permission is required.</p><a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">OGL</a>',
      },
    }),
    /page-specific copyright or reuse exception/i,
  );
  delete govEvidence.attribution;
  assert.throws(
    () => assertEvidenceAllowed(manifest, govEvidence, {
      profile: 'production-open',
      storagePath: REVIEW_PATH,
      payload: govPayload,
    }),
    /attribution/i,
  );
});

test('allows verified open evidence sources in production-open', () => {
  const manifest = loadSourceManifest();
  const source = allowed(manifest, 'openfda-labels');
  assert.equal(source.licence.id, 'CC0-1.0');

  assert.doesNotThrow(() => allowed(manifest, 'rxnorm', { use: 'identity' }));
  assert.doesNotThrow(() => allowed(manifest, 'fda-gsrs-unii', { use: 'identity' }));
  assert.doesNotThrow(() => allowed(manifest, 'aushadhi-open-clinician-rules', {
    use: 'interaction-rules',
    storagePath: 'data-static/interaction-rules.json',
  }));
});

test('binds RxNorm identity evidence to an allowed NLM origin and payload', () => {
  const manifest = loadSourceManifest();
  const payload = 'RxNorm identity fixture';
  const evidence = {
    source_id: 'fixture-rxnorm',
    source_policy_id: 'rxnorm',
    source_policy_use: 'identity',
    licence: 'NLM-RXNORM-TERMS',
    source_url: 'https://www.nlm.nih.gov/research/umls/rxnorm/docs/fixture.html',
    source_host: 'nlm.nih.gov',
    document_id: 'fixture-rxnorm',
    document_version: '2026-07-23',
    retrieved_at: '2026-07-23',
    jurisdiction: 'US',
    review_status: 'review_candidate',
    fragments: [{
      section: 'RxNorm fixture',
      text: payload,
      text_sha256: sha256(payload),
      source_path: '$',
    }],
    provenance: {
      document_sha256: sha256(payload),
    },
    supports: {
      interaction_exists: false,
      source_effect: [],
      label_action: [],
      jurisdictions: ['US'],
      identity_assertions: ['fixture_identity'],
    },
  };
  assert.doesNotThrow(() => assertEvidenceAllowed(manifest, evidence, {
    profile: 'production-open',
    storagePath: 'data/interaction/production-open/rxnorm.jsonl',
    payload,
  }));
  assert.throws(
    () => assertEvidenceAllowed(
      manifest,
      { ...evidence, source_url: 'https://example.com/research/umls/rxnorm/docs/fixture.html' },
      {
        profile: 'production-open',
        storagePath: 'data/interaction/production-open/rxnorm.jsonl',
        payload,
      },
    ),
    /not a licensed origin/i,
  );
});

test('allows the current catalogue provenance only in internal-evaluation', () => {
  const manifest = loadSourceManifest();
  const sources = [
    'github-jr',
    'janaushadhi',
    'onemg-live',
  ];

  const resolved = assertSourcesAllowed(manifest, {
    sourceIds: sources,
    profile: 'internal-evaluation',
    use: 'ingredient-index',
    storagePath: INTERNAL_PATH,
  });

  assert.deepEqual(resolved.map((source) => source.id), sources);
});

test('fails closed for an unknown profile', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'openfda-labels', { profile: 'staging' }),
    /unknown interaction source profile.*staging/i,
  );
});

test('fails closed for an unknown source', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'not-in-the-manifest'),
    /unknown interaction source.*not-in-the-manifest/i,
  );
});

test('fails closed for an unknown or unverified licence', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'unknown-source-example'),
    /licen[cs]e.*unknown|unknown.*licen[cs]e/i,
  );

  const changed = structuredClone(manifest);
  changed.sources['openfda-labels'].licence.verification_status = 'unknown';
  changed.sources['openfda-labels'].licence.verified_at = null;
  assert.throws(
    () => allowed(changed, 'openfda-labels'),
    /licen[cs]e.*unknown|unknown.*licen[cs]e/i,
  );
  assert.throws(
    () => allowed(manifest, 'kaggle-2025', {
      profile: 'internal-evaluation',
      use: 'ingredient-index',
      storagePath: INTERNAL_PATH,
    }),
    /licen[cs]e.*unknown|unknown.*licen[cs]e/i,
  );
});

test('rejects malformed manifests before evaluating policy', () => {
  const manifest = loadSourceManifest();
  const malformed = structuredClone(manifest);
  malformed.sources['openfda-labels'].licence.class = 'probably-open';
  const unknownLicence = structuredClone(manifest);
  unknownLicence.sources['openfda-labels'].licence.id = 'MADE-UP-LICENCE';
  const missingReconciliation = structuredClone(manifest);
  delete missingReconciliation.sources['openfda-labels'].requires_document_reconciliation;
  const missingPayloadValidation = structuredClone(manifest);
  delete missingPayloadValidation.sources.rxnorm.requires_evidence_payload_validation;
  const traversalZone = structuredClone(manifest);
  traversalZone.sources['openfda-labels'].required_storage_zones['production-open'][0] =
    'data/interaction/production-open/../internal-evaluation';
  const invalidDate = structuredClone(manifest);
  invalidDate.policy_reviewed_at = '2026-02-30';
  const disabledChangesNotice = structuredClone(manifest);
  disabledChangesNotice.sources.drugcentral
    .redistribution_obligations.changes_notice_required = false;
  const incompatibleManifestAdapter = structuredClone(manifest);
  incompatibleManifestAdapter.sources.drugcentral
    .redistribution_obligations.compatible_adapter_licences = ['MIT'];

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-source-policy-'));
  const file = path.join(dir, 'manifest.json');
  try {
    fs.writeFileSync(file, JSON.stringify(malformed));
    assert.throws(() => loadSourceManifest(file), /invalid source manifest.*licen[cs]e class/i);
    fs.writeFileSync(file, JSON.stringify(unknownLicence));
    assert.throws(() => loadSourceManifest(file), /invalid source manifest.*unknown licen[cs]e id/i);
    fs.writeFileSync(file, JSON.stringify(missingReconciliation));
    assert.throws(() => loadSourceManifest(file), /openfda-labels.*document reconciliation/i);
    fs.writeFileSync(file, JSON.stringify(missingPayloadValidation));
    assert.throws(() => loadSourceManifest(file), /rxnorm.*requires payload validation/i);
    fs.writeFileSync(file, JSON.stringify(traversalZone));
    assert.throws(() => loadSourceManifest(file), /storage zone.*canonical|stay inside/i);
    fs.writeFileSync(file, JSON.stringify(invalidDate));
    assert.throws(() => loadSourceManifest(file), /policy_reviewed_at.*ISO calendar date/i);
    fs.writeFileSync(file, JSON.stringify(disabledChangesNotice));
    assert.throws(() => loadSourceManifest(file), /must require a changes notice/i);
    fs.writeFileSync(file, JSON.stringify(incompatibleManifestAdapter));
    assert.throws(() => loadSourceManifest(file), /unsupported compatible adapter licence/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects conflicting legacy and canonical source ids', () => {
  const manifest = loadSourceManifest();
  const sourceIds = [{
    source_policy_id: 'rxnorm',
    source: 'onemg-live',
  }];
  assert.throws(
    () => assertSourcesAllowed(manifest, {
      sourceIds,
      profile: 'production-open',
      use: 'identity',
      storagePath: 'data/interaction/production-open/identity.jsonl',
    }),
    /conflicting interaction source ids/i,
  );
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      sourceIds,
      profile: 'production-open',
      use: 'identity',
      storagePath: 'data/interaction/production-open/identity.jsonl',
    }),
    /conflicting interaction source ids/i,
  );
});

test('forbids restricted sources in production-open', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'onemg-live', { use: 'ingredient-index' }),
    /onemg-live.*production-open/i,
  );
  assert.throws(
    () => allowed(manifest, 'janaushadhi', { use: 'ingredient-index' }),
    /janaushadhi.*production-open/i,
  );
});

test('requires restricted internal sources to stay in their storage zone', () => {
  const manifest = loadSourceManifest();
  assert.doesNotThrow(() => allowed(manifest, 'onemg-live', {
    profile: 'internal-evaluation',
    use: 'ingredient-index',
    storagePath: INTERNAL_PATH,
  }));
  assert.throws(
    () => allowed(manifest, 'onemg-live', {
      profile: 'internal-evaluation',
      use: 'ingredient-index',
      storagePath: 'data/interaction/production-open/ingredient-index.jsonl',
    }),
    /onemg-live.*storage zone/i,
  );
  assert.throws(
    () => allowed(manifest, 'onemg-live', {
      profile: 'internal-evaluation',
      use: 'ingredient-index',
      storagePath: 'data/interaction/internal-evaluation/../production-open/leak.jsonl',
    }),
    /onemg-live.*storage zone/i,
  );
});

test('enforces source-specific allowed uses', () => {
  const manifest = loadSourceManifest();
  assert.doesNotThrow(() => allowed(manifest, 'janaushadhi', {
    profile: 'internal-evaluation',
    use: 'identity',
    storagePath: 'data/interaction/internal-evaluation/pmbjp-product-list/source.pdf',
  }));
  assert.throws(
    () => allowed(manifest, 'janaushadhi', {
      profile: 'production-open',
      use: 'identity',
      storagePath: 'data/interaction/production-open/source.pdf',
    }),
    /janaushadhi.*production-open/i,
  );
  assert.doesNotThrow(() => allowed(manifest, 'drugcentral', {
    use: 'identity',
    storagePath: 'data/interaction/production-open/drugcentral-sharealike/mappings.jsonl',
  }));
  assert.throws(
    () => allowed(manifest, 'drugcentral', {
      use: 'interaction-evidence',
      storagePath: 'data/interaction/production-open/drugcentral-sharealike/evidence.jsonl',
    }),
    /drugcentral.*interaction-evidence/i,
  );
});

test('keeps conditional CDCI/SNOMED data user-supplied and out of open artifacts', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'cdci-snomed-ct', { use: 'identity' }),
    /cdci-snomed-ct.*production-open/i,
  );
  assert.doesNotThrow(() => allowed(manifest, 'cdci-snomed-ct', {
    profile: 'internal-evaluation',
    use: 'identity',
    storagePath: 'data/restricted/cdci/mappings.jsonl',
  }));
});

test('keeps DDInter disabled even for internal evaluation', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'ddinter-2', {
      profile: 'internal-evaluation',
      storagePath: 'data/restricted/ddinter/snapshot.csv',
    }),
    /ddinter-2.*disabled.*tls.*sha-256/i,
  );
});

test('forbids ingestion from manual checker websites in every profile', () => {
  const manifest = loadSourceManifest();
  for (const sourceId of [
    'drugs-com-manual',
    'medscape-manual',
    'webmd-manual',
    'drugbank-web-manual',
  ]) {
    assert.throws(
      () => allowed(manifest, sourceId),
      new RegExp(`${sourceId}.*ingestion forbidden`, 'i'),
    );
  }
});

test('rejects mixed production provenance containing a restricted source', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      sourceIds: ['openfda-labels', 'onemg-live'],
      profile: 'production-open',
      use: 'interaction-evidence',
      storagePath: PRODUCTION_PATH,
    }),
    /onemg-live.*production-open/i,
  );
});

test('validates a mixed internal artifact and marks it non-redistributable', () => {
  const manifest = loadSourceManifest();
  const result = assertArtifactProvenance(manifest, {
    sourceIds: ['github-jr', 'onemg-live'],
    profile: 'internal-evaluation',
    use: 'ingredient-index',
    storagePath: INTERNAL_PATH,
  });

  assert.deepEqual(result.source_ids, ['github-jr', 'onemg-live']);
  assert.equal(result.redistributable, false);
  assert.equal(result.artifact_pack, 'internal-restricted');
});

test('allows the current dist product artifact only as internal provenance', () => {
  const manifest = loadSourceManifest();
  const sourceIds = [
    'github-jr',
    'janaushadhi',
    'onemg-live',
  ];
  const result = assertArtifactProvenance(manifest, {
    sourceIds,
    profile: 'internal-evaluation',
    use: 'product-resolution',
    storagePath: 'dist/latest/drugs.jsonl',
  });
  assert.equal(result.redistributable, false);
  assert.equal(result.artifact_pack, 'internal-restricted');

  assert.throws(
    () => assertArtifactProvenance(manifest, {
      sourceIds,
      profile: 'internal-evaluation',
      use: 'ingredient-index',
      storagePath: 'dist/latest/ingredient-index.jsonl',
    }),
    /storage zone/i,
  );

  assert.throws(
    () => assertArtifactProvenance(manifest, {
      sourceIds,
      profile: 'production-open',
      use: 'product-resolution',
      storagePath: 'dist/latest/drugs.jsonl',
    }),
    /storage zone|production-open/i,
  );
});

test('requires the separate share-alike zone for DrugCentral-derived artifacts', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      sourceIds: ['rxnorm', 'drugcentral'],
      profile: 'production-open',
      use: 'identity',
      storagePath: 'data/interaction/production-open/mappings.jsonl',
    }),
    /drugcentral.*storage zone/i,
  );

  const result = assertArtifactProvenance(manifest, {
    sourceIds: ['rxnorm', 'drugcentral'],
    profile: 'production-open',
    use: 'identity',
    storagePath: 'data/interaction/production-open/drugcentral-sharealike/mappings.jsonl',
    licenceNotices: {
      drugcentral: {
        attribution: 'DrugCentral',
        licence_notice: 'Creative Commons Attribution-ShareAlike 4.0 International',
        licence_id: 'CC-BY-SA-4.0',
        licence_url: 'https://drugcentral.org/download',
        source_url: 'https://drugcentral.org/',
        changes: 'Normalized identifiers for the Aushadhi mapping artifact.',
        adapter_licence: 'CC-BY-SA-4.0',
      },
    },
  });
  assert.equal(result.artifact_pack, 'drugcentral-sharealike');
  assert.equal(result.redistributable, true);
  assert.equal(result.licence_obligations.length, 1);

  const request = {
    sourceIds: ['drugcentral'],
    profile: 'production-open',
    use: 'identity',
    storagePath: 'data/interaction/production-open/drugcentral-sharealike/mappings.jsonl',
  };
  assert.throws(
    () => assertArtifactProvenance(manifest, request),
    /missing licence notice.*drugcentral/i,
  );
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      ...request,
      licenceNotices: {
        drugcentral: {
          attribution: 'DrugCentral',
          licence_notice: 'Creative Commons Attribution-ShareAlike 4.0 International',
          licence_id: 'CC-BY-SA-4.0',
          licence_url: 'https://drugcentral.org/download',
          source_url: 'https://drugcentral.org/',
          changes: 'Normalized identifiers.',
          adapter_licence: 'MIT',
        },
      },
    }),
    /incompatible adapter licence/i,
  );
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      ...request,
      licenceNotices: {
        drugcentral: {
          attribution: 'DrugCentral',
          licence_notice: 'Incorrect licence notice',
          licence_id: 'CC-BY-SA-4.0',
          licence_url: 'https://drugcentral.org/download',
          source_url: 'https://drugcentral.org/',
          changes: 'Normalized identifiers.',
          adapter_licence: 'CC-BY-SA-4.0',
        },
      },
    }),
    /invalid licence_notice/i,
  );
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      ...request,
      licenceNotices: {
        drugcentral: {
          attribution: 'DrugCentral',
          licence_notice: 'Creative Commons Attribution-ShareAlike 4.0 International',
          licence_id: 'CC-BY-SA-4.0',
          licence_url: 'https://drugcentral.org/download',
          source_url: 'https://drugcentral.org/',
          changes: '',
          adapter_licence: 'CC-BY-SA-4.0',
        },
      },
    }),
    /requires a changes notice/i,
  );
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      ...request,
      licenceNotices: {
        drugcentral: {
          attribution: 'DrugCentral',
          licence_notice: 'Creative Commons Attribution-ShareAlike 4.0 International',
          licence_id: 'CC-BY-SA-4.0',
          licence_url: 'https://drugcentral.org/download',
          source_url: 'https://drugcentral.org/',
          changes: '\u200b',
          adapter_licence: 'CC-BY-SA-4.0',
        },
      },
    }),
    /requires a changes notice/i,
  );
});

test('rejects empty, duplicate, and malformed artifact provenance', () => {
  const manifest = loadSourceManifest();
  const options = {
    profile: 'production-open',
    use: 'identity',
    storagePath: 'data/interaction/production-open/ingredient-index.jsonl',
  };

  assert.throws(
    () => assertArtifactProvenance(manifest, { ...options, sourceIds: [] }),
    /at least one source/i,
  );
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      ...options,
      sourceIds: ['rxnorm', 'rxnorm'],
    }),
    /duplicate source.*rxnorm/i,
  );
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      ...options,
      sourceIds: ['rxnorm', { source: '' }],
    }),
    /source id/i,
  );
});
