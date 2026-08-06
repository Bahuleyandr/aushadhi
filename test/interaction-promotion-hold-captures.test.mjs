import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertEvidenceMatchesPayload } from '../src/lib/interaction-source-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURE_ROOT = path.join(
  ROOT,
  'docs/interaction-review/evidence-drift/2026-08-06',
);

function sha256(value) {
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

function canonicalSha256(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readCapturedFile(record) {
  assert.match(record.filename, /^[a-z0-9][a-z0-9._-]+$/u);
  const file = path.join(CAPTURE_ROOT, record.filename);
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.length, record.size_bytes);
  assert.equal(sha256(bytes), record.file_sha256);
  return bytes;
}

function draftEvidenceByRule() {
  return new Map(fs.readFileSync(
    path.join(
      ROOT,
      'docs/interaction-review/batch-01-v2/sections/A.verified.jsonl',
    ),
    'utf8',
  ).trim().split(/\r?\n/u).map((line) => {
    const rule = JSON.parse(line);
    return [rule.rule_id, rule.evidence[0]];
  }));
}

test('retained public payloads reproduce both exact live-provenance holds offline', () => {
  const manifest = readJson(path.join(CAPTURE_ROOT, 'capture-manifest.json'));
  const holds = readJson(
    path.join(
      ROOT,
      'data-static/interaction-promotion-holds.internal-evaluation.json',
    ),
  ).holds;
  const holdsByRule = new Map(holds.map((hold) => [hold.rule_id, hold]));
  const evidenceByRule = draftEvidenceByRule();

  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.promotion_authority, 'none');
  assert.equal(manifest.deployment_authority, 'none');
  assert.deepEqual(Object.keys(manifest.captures).sort(), [
    'warfarin__azithromycin_oral',
    'warfarin__tramadol',
  ]);

  const azithromycinCapture = manifest.captures.warfarin__azithromycin_oral;
  const azithromycinHold = holdsByRule.get('warfarin__azithromycin_oral');
  const azithromycinEvidence = structuredClone(
    evidenceByRule.get('warfarin__azithromycin_oral'),
  );
  const openFdaRecord = JSON.parse(
    readCapturedFile(azithromycinCapture.record).toString('utf8'),
  );
  assert.equal(azithromycinCapture.source_url, azithromycinEvidence.source_url);
  assert.equal(
    canonicalSha256(openFdaRecord),
    azithromycinCapture.record.canonical_payload_sha256,
  );
  assert.equal(
    azithromycinCapture.record.canonical_payload_sha256,
    azithromycinHold.observed_payload_sha256,
  );
  assert.equal(
    `openfda-labels:${azithromycinCapture.record.set_id}:`
      + azithromycinCapture.record.version,
    azithromycinHold.observed_source_version,
  );
  assert.equal(String(openFdaRecord.version), azithromycinCapture.record.version);
  assert.equal(
    String(openFdaRecord.effective_time),
    azithromycinCapture.record.effective_time,
  );
  assert.deepEqual(
    {
      set_id: azithromycinCapture.independent_reference.set_id,
      version: azithromycinCapture.independent_reference.version,
      effective_time: azithromycinCapture.independent_reference.effective_time,
    },
    {
      set_id: azithromycinCapture.record.set_id,
      version: azithromycinCapture.record.version,
      effective_time: azithromycinCapture.record.effective_time,
    },
  );
  azithromycinEvidence.provenance.version = azithromycinCapture.record.version;
  azithromycinEvidence.provenance.effective_time =
    azithromycinCapture.record.effective_time;
  azithromycinEvidence.provenance.payload_sha256 =
    azithromycinCapture.record.canonical_payload_sha256;
  assert.deepEqual(
    assertEvidenceMatchesPayload(azithromycinEvidence, openFdaRecord),
    { payload_sha256: azithromycinHold.observed_payload_sha256 },
  );

  const tramadolCapture = manifest.captures.warfarin__tramadol;
  const tramadolHold = holdsByRule.get('warfarin__tramadol');
  const tramadolEvidence = structuredClone(evidenceByRule.get('warfarin__tramadol'));
  const govUkContent = JSON.parse(
    readCapturedFile(tramadolCapture.content_api).toString('utf8'),
  );
  const govUkPage = readCapturedFile(tramadolCapture.page_html).toString('utf8');
  assert.equal(tramadolCapture.source_url, tramadolEvidence.source_url);
  assert.equal(
    canonicalSha256(govUkContent),
    tramadolCapture.content_api.canonical_payload_sha256,
  );
  assert.equal(
    tramadolCapture.content_api.canonical_payload_sha256,
    tramadolHold.observed_payload_sha256,
  );
  assert.equal(
    `mhra-govuk-drug-safety-updates:${tramadolEvidence.document_id}:`
      + tramadolCapture.content_api.public_updated_at,
    tramadolHold.observed_source_version,
  );
  tramadolEvidence.provenance.document_sha256 =
    tramadolCapture.content_api.canonical_payload_sha256;
  assert.deepEqual(
    assertEvidenceMatchesPayload(tramadolEvidence, {
      content_api_url: tramadolCapture.content_api_url,
      page_url: tramadolCapture.source_url,
      content_api: govUkContent,
      page_html: govUkPage,
    }),
    { payload_sha256: tramadolHold.observed_payload_sha256 },
  );
});
