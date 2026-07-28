// D2 — source-bound presentation mappings.
//
// `productIdForRow()` is content-derived, so when a reviewed product's content
// drifts its id changes too and an id-keyed mapping quietly stops matching. A stable
// source identity is therefore bound ALONGSIDE the content id and assertion hash:
//
//   source_identity          which catalogue/source product was reviewed
//   product_id               content-derived product identity
//   product_assertion_sha256 integrity of the reviewed product assertion
//
// A source-bound mapping NEVER falls back to content-only resolution: if the product
// does not present the reviewed source identity, the mapping does not apply, however
// well the content matches.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapResolvedProducts,
  validateProductPresentationManifest,
} from '../src/lib/interaction-mapping.mjs';
import { productAssertionHashForRow, productIdForRow } from '../src/lib/product-resolver.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SHA = 'a'.repeat(64);

const row = (code, { brand = 'Warfarin Tablets IP 1mg', strength = '1mg' } = {}) => ({
  brand_name: brand,
  manufacturer: 'PMBJP (Jan Aushadhi)',
  pack_label: "10's",
  form_raw: null,
  ingredients: [{
    molecule: 'warfarin', strength_raw: strength, strength_value: Number.parseFloat(strength),
    strength_unit: 'mg',
  }],
  sources: code === null ? [] : [{ source: 'janaushadhi', source_id: code, seen_at: '2026-07-07' }],
});

const REVIEWED = row('2141');

const ingredientManifest = () => ({
  schema_version: 1,
  identity_namespace: 'aushadhi:ingredient-identity:v1',
  notices: ['fixture'],
  mappings: [{
    mapping_id: 'ingredient:warfarin',
    assertion: {
      ingredient_id: 'sha256:2ec225c652eabf57f4297ab503a1aee5d450c03f721033270bd09c1290a0cd06',
      canonical_name: 'warfarin',
    },
    identity: {
      clinical_ingredient_id: 'sha256:2ec225c652eabf57f4297ab503a1aee5d450c03f721033270bd09c1290a0cd06',
      canonical_name: 'warfarin',
      runtime_drug: 'warfarin',
      relationship: 'exact',
      rxnorm: {
        rxcui: '11289', name: 'warfarin', tty: 'IN', version: '06-Jul-2026',
        api_version: '3.1.354', response_sha256: SHA,
      },
      unii: null,
    },
    review: {
      status: 'reviewed', reviewer_id: 'clinician:subas', reviewed_at: '2026-07-27',
      evidence: [{
        source_id: 'rxnorm', identifier: 'rxcui:11289',
        source_url: 'https://rxnav.nlm.nih.gov/REST/rxcui/11289/properties.json',
        retrieved_at: '2026-07-27', evidence_sha256: SHA,
      }],
    },
  }],
});

const presentationManifest = (overrides = {}) => ({
  schema_version: 1,
  product_id_namespace: 'aushadhi:product:v1',
  product_assertion_namespace: 'aushadhi:product-assertion:v1',
  mappings: [{
    mapping_id: 'presentation:pmbjp:2141:oral-tablet',
    source_identity: { namespace: 'presentation:pmbjp', code: '2141' },
    product_id: productIdForRow(REVIEWED),
    product_assertion_sha256: productAssertionHashForRow(REVIEWED),
    allowed_profiles: ['internal-evaluation'],
    presentation: { route: 'oral', formulation: 'tablet' },
    review: {
      status: 'reviewed', reviewer_id: 'clinician:subas', reviewed_at: '2026-07-27',
      evidence: [{
        source_id: 'janaushadhi', identifier: 'pmbjp-product-list:2141',
        source_url: 'https://static.pib.gov.in/example.pdf',
        retrieved_at: '2026-07-27', evidence_sha256: SHA,
      }],
    },
    ...overrides,
  }],
});

const resolve = (product, manifest = presentationManifest()) => mapResolvedProducts({
  records: [{ status: 'resolved', product: { ...product, product_id: productIdForRow(product) } }],
  ingredientManifest: ingredientManifest(),
  presentationManifest: manifest,
  profile: 'internal-evaluation',
})[0].product.presentation;

// ── the binding resolves ─────────────────────────────────────────────────────

test('a reviewed product resolves through its source identity', () => {
  const presentation = resolve(REVIEWED);
  assert.equal(presentation.status, 'reviewed_override');
  assert.equal(presentation.route, 'oral');
  assert.deepEqual(presentation.source_identity, {
    namespace: 'presentation:pmbjp', code: '2141',
  });
});

// ── the six regression cases the review required ─────────────────────────────

test('same product content under another source code does not match', () => {
  const presentation = resolve(row('9999'));
  assert.notEqual(presentation.status, 'reviewed_override');
  assert.equal(presentation.route, null);
  assert.equal(presentation.error, 'source_identity_mismatch');
});

test('the reviewed code attached to changed product content is stale', () => {
  const drifted = row('2141', { strength: '2mg' });
  const presentation = resolve(drifted);
  assert.equal(presentation.status, 'stale');
  assert.equal(presentation.route, null);
  assert.equal(presentation.error, 'product_content_changed_since_review');
});

test('a changed source code with unchanged content does not resolve the old mapping', () => {
  // identical content, relabelled: content-only resolution would have matched
  const relabelled = row('2145');
  assert.equal(productIdForRow(relabelled), productIdForRow(REVIEWED));
  const presentation = resolve(relabelled);
  assert.notEqual(presentation.status, 'reviewed_override');
  assert.equal(presentation.route, null);
});

test('the same source identity on two catalogue rows is an error, not a guess', () => {
  const duplicate = row('2141', { brand: 'Warfarin Tablets IP 1mg (repack)' });
  assert.throws(
    () => mapResolvedProducts({
      records: [REVIEWED, duplicate].map((product) => ({
        status: 'resolved',
        product: { ...product, product_id: productIdForRow(product) },
      })),
      ingredientManifest: ingredientManifest(),
      presentationManifest: presentationManifest(),
      profile: 'internal-evaluation',
    }),
    /duplicate source identity presentation:pmbjp:2141/u,
  );
});

test('a removed source identity leaves the reviewed source missing', () => {
  const stripped = row(null);
  assert.equal(productIdForRow(stripped), productIdForRow(REVIEWED));
  const presentation = resolve(stripped);
  assert.notEqual(presentation.status, 'reviewed_override');
  assert.equal(presentation.route, null);
  assert.equal(presentation.error, 'reviewed_source_identity_absent');
});

test('a wrong PMBJP code with a matching product id does not match', () => {
  // content-only resolution WOULD have matched here; source binding refuses it
  const wrongCode = row('740');
  assert.equal(productIdForRow(wrongCode), productIdForRow(REVIEWED));
  const presentation = resolve(wrongCode);
  assert.notEqual(presentation.status, 'reviewed_override');
  assert.equal(presentation.error, 'source_identity_mismatch');
});

// ── schema ───────────────────────────────────────────────────────────────────

test('a PMBJP mapping must declare a source identity matching its mapping id', () => {
  const manifest = presentationManifest();
  delete manifest.mappings[0].source_identity;
  assert.throws(
    () => validateProductPresentationManifest(manifest),
    /requires a source_identity/u,
  );

  assert.throws(
    () => validateProductPresentationManifest(presentationManifest({
      source_identity: { namespace: 'presentation:pmbjp', code: '9999' },
    })),
    /source_identity code 9999 does not match its mapping_id/u,
  );
});

test('two mappings may not claim one source identity', () => {
  const manifest = presentationManifest();
  manifest.mappings.push({
    ...manifest.mappings[0],
    mapping_id: 'presentation:pmbjp:2141:oral-capsule',
    presentation: { route: 'oral', formulation: 'capsule' },
    product_id: `sha256:${'d'.repeat(64)}`,
  });
  assert.throws(
    () => validateProductPresentationManifest(manifest),
    /duplicate presentation source identity/u,
  );
});

// ── the committed 18, migrated and re-attested ───────────────────────────────

test('all eighteen committed mappings are now source-bound', () => {
  const manifest = readJson('data-static/product-presentation-overrides.json');
  assert.equal(validateProductPresentationManifest(manifest), true);
  assert.equal(manifest.mappings.length, 18);
  for (const mapping of manifest.mappings) {
    assert.deepEqual(
      mapping.source_identity,
      { namespace: 'presentation:pmbjp', code: mapping.mapping_id.split(':')[2] },
      mapping.mapping_id,
    );
  }
  // every code is distinct, so no reviewed product is ambiguous
  const codes = manifest.mappings.map((m) => m.source_identity.code);
  assert.equal(new Set(codes).size, 18);
});

// ── D1: the combination resolver is wired, and supplements rather than replaces ──

test('the combination resolver is wired and inert with the committed empty manifest', () => {
  const combinationManifest = readJson('data-static/combination-identity-overrides.json');
  assert.deepEqual(combinationManifest.combinations, []);
  const mapped = mapResolvedProducts({
    records: [{
      status: 'resolved',
      product: { ...REVIEWED, product_id: productIdForRow(REVIEWED) },
    }],
    ingredientManifest: ingredientManifest(),
    presentationManifest: presentationManifest(),
    combinationManifest,
    profile: 'internal-evaluation',
  })[0].product;

  // the combination path ran and found nothing, while the per-ingredient subjects
  // are untouched: a combination SUPPLEMENTS components, it never replaces them
  assert.equal(mapped.combination.status, 'no_combination');
  assert.equal(mapped.combination.runtime_subject, null);
  assert.deepEqual(mapped.ingredients[0].runtime_subject, {
    drug: 'warfarin', route: 'oral', formulation: 'tablet',
  });
});

test('omitting the combination manifest leaves resolution exactly as before', () => {
  const mapped = mapResolvedProducts({
    records: [{
      status: 'resolved',
      product: { ...REVIEWED, product_id: productIdForRow(REVIEWED) },
    }],
    ingredientManifest: ingredientManifest(),
    presentationManifest: presentationManifest(),
    profile: 'internal-evaluation',
  })[0].product;
  assert.equal(mapped.combination, undefined);
  assert.deepEqual(mapped.ingredients[0].runtime_subject, {
    drug: 'warfarin', route: 'oral', formulation: 'tablet',
  });
});
