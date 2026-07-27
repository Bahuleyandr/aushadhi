// PMBJP product-identity provenance policy (clinician decision C4, 2026-07-27).
//
// The policy changed from "a specific tender citation is required" to "an
// authoritative PMBJP product-identity source is required; a tender citation is
// required only when applicable or available". A procurement tender is not the
// canonical inventory of every valid PMBJP product, so its absence must not block
// a product whose identity is confirmed by the official product list.
//
// The change is global, not a one-rule exception: it is enforced by the shared
// presentation-mapping validator, so it governs every PMBJP mapping.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PMBJP_PRODUCT_IDENTITY_PREFIXES,
  validateProductPresentationManifest,
} from '../src/lib/interaction-mapping.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SHA = 'a'.repeat(64);

const evidence = (sourceId, identifier) => ({
  source_id: sourceId,
  identifier,
  source_url: 'https://static.pib.gov.in/example.pdf',
  retrieved_at: '2026-07-27',
  evidence_sha256: SHA,
});

const manifestWith = (evidenceRecords, mappingId = 'presentation:pmbjp:9999:oral-tablet') => ({
  schema_version: 1,
  product_id_namespace: readJson('data-static/product-presentation-overrides.json')
    .product_id_namespace,
  product_assertion_namespace: readJson('data-static/product-presentation-overrides.json')
    .product_assertion_namespace,
  mappings: [{
    mapping_id: mappingId,
    product_id: `sha256:${'b'.repeat(64)}`,
    product_assertion_sha256: 'c'.repeat(64),
    allowed_profiles: ['internal-evaluation'],
    presentation: { route: 'oral', formulation: 'tablet' },
    review: {
      status: 'reviewed',
      reviewer_id: 'clinician:subas',
      reviewed_at: '2026-07-27',
      evidence: evidenceRecords,
    },
  }],
});

test('a PMBJP mapping with no product-identity source at all is rejected', () => {
  assert.throws(
    () => validateProductPresentationManifest(manifestWith([
      evidence('rxnorm', 'rxcui:197516'),
    ])),
    /requires an authoritative PMBJP product-identity source/u,
  );
});

test('C4: the official product list alone is sufficient — no tender required', () => {
  assert.equal(
    validateProductPresentationManifest(manifestWith([
      evidence('janaushadhi', 'pmbjp-product-list:89'),
      evidence('rxnorm', 'rxcui:198335'),
    ])),
    true,
  );
});

test('C4: a tender alone still qualifies, so approved mappings stay valid', () => {
  assert.equal(
    validateProductPresentationManifest(manifestWith([
      evidence('janaushadhi', 'pmbjp-tender:RC-222/2025:740:page-64'),
      evidence('rxnorm', 'rxcui:197516'),
    ])),
    true,
  );
});

test('the policy is scoped to PMBJP mappings and leaves other provenance alone', () => {
  // A non-PMBJP presentation mapping answers a different provenance question and is
  // deliberately outside C4. Widening the rule to every mapping would impose a PMBJP
  // requirement on products that have nothing to do with PMBJP.
  assert.equal(
    validateProductPresentationManifest(manifestWith(
      [evidence('product-label', 'product-label:fixture')],
      'presentation:mapped-duo',
    )),
    true,
  );
});

test('the qualifying prefixes are the PMBJP identity sources, and nothing wider', () => {
  assert.deepEqual([...PMBJP_PRODUCT_IDENTITY_PREFIXES].sort(), [
    'pmbjp-live-product:',
    'pmbjp-product-list:',
    'pmbjp-tender:',
  ]);
});

test('every committed mapping satisfies the policy, and 12 rest on a tender alone', () => {
  const manifest = readJson('data-static/product-presentation-overrides.json');
  assert.equal(validateProductPresentationManifest(manifest), true);
  assert.equal(manifest.mappings.length, 18);

  const tenderOnly = manifest.mappings.filter((mapping) => {
    const identifiers = mapping.review.evidence.map((e) => e.identifier);
    return identifiers.some((i) => i.startsWith('pmbjp-tender:'))
      && !identifiers.some((i) => i.startsWith('pmbjp-product-list:')
        || i.startsWith('pmbjp-live-product:'));
  });
  // Recorded deliberately: requiring the product list SPECIFICALLY would invalidate
  // these twelve clinician-approved mappings. The policy accepts a tender as an
  // identity source; it simply stops requiring one.
  assert.equal(tenderOnly.length, 12);
});
