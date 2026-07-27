// Fixed-dose combination identity path (clinician decision C1, 2026-07-27).
//
// C1 was approved WITH AN ARCHITECTURAL CONDITION: combinations get a separate
// identity path. The single-ingredient IN/PIN model must remain unchanged, and a
// MIN term type is admissible ONLY inside a combination identity carrying a
// verified component list. Matching either component on its own is prohibited.
//
// Every combination fixture below is a TEST fixture. The committed manifest is
// deliberately empty: no combination may be recorded until the schema, validator,
// tests and provenance are independently approved.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBINATION_IDENTITY_SCHEMA_VERSION,
  resolveCombinationIdentity,
  validateCombinationIdentityManifest,
} from '../src/lib/interaction-combination-identity.mjs';
import { validateIngredientMappingManifest } from '../src/lib/interaction-mapping.mjs';
import { productAssertionHashForRow, productIdForRow } from '../src/lib/product-resolver.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const SMX_ID = 'sha256:5b15ba7515bffc9682ddd1092973725241a66fd6bba12fda69d7fd8c8712a2bf';
const SMX_PMBJP_ID = 'sha256:f68344038f9f9bb5eb6194c285d27716c812b8f670ba1a156b89051f68eeaeaa';
const TMP_ID = 'sha256:ec4b38e63e65a622534beabc5d428b52dacbc2f805a000615cc4c90b27d41fa9';
const SHA = 'a'.repeat(64);

// ── product fixtures: reconstructed from dist/latest/drugs.jsonl, and asserted
// below to hash to the real catalogue product ids ─────────────────────────────
const pmbjpRow = (brand, ingredients, packLabel = "10's") => ({
  brand_name: brand,
  manufacturer: 'PMBJP (Jan Aushadhi)',
  pack_label: packLabel,
  form_raw: null,
  ingredients: ingredients.map(([molecule, raw, value]) => ({
    molecule, strength_raw: raw, strength_value: value, strength_unit: 'mg',
  })),
});

const PMBJP_89 = pmbjpRow(
  'Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg) Tablets IP',
  [['co-trimoxazole sulphamethoxazole', '800mg', 800], ['trimethoprim', '160mg', 160]],
);
const PMBJP_90 = pmbjpRow(
  'Co-trimoxazole (Sulphamethoxazole 100mg and Trimethoprim 20mg) Tablets IP',
  [['co-trimoxazole sulphamethoxazole', '100mg', 100], ['trimethoprim', '20mg', 20]],
);
const PMBJP_88_SUSPENSION = pmbjpRow(
  'Co-trimoxazole (Sulphamethoxazole 200mg and Trimethoprim 40mg per 5ml) Oral Suspension IP',
  [['co-trimoxazole sulphamethoxazole', '200mg', 200], ['trimethoprim', '40mg', 40]],
  '50 ml',
);
// real catalogue negatives, taken verbatim from dist/latest/drugs.jsonl
const TRIMETHOPRIM_ONLY = {
  brand_name: 'Bacstol Tablet',
  manufacturer: 'Ind Swift Laboratories Ltd',
  pack_label: 'strip of 10 tablets',
  form_raw: null,
  ingredients: [{
    molecule: 'trimethoprim', strength_raw: '100mg', strength_value: 100, strength_unit: 'mg',
  }],
};
const SMX_PLUS_PYRIMETHAMINE = {
  brand_name: 'Malin 25 mg/500 mg Tablet',
  manufacturer: 'Ind Swift Laboratories Ltd',
  pack_label: 'strip of 10 tablets',
  form_raw: null,
  ingredients: [
    { molecule: 'pyrimethamine', strength_raw: '25mg', strength_value: 25, strength_unit: 'mg' },
    { molecule: 'sulfamethoxazole', strength_raw: '500mg', strength_value: 500, strength_unit: 'mg' },
  ],
};
const SULFAMETHOPYRAZINE_PLUS_TMP = {
  brand_name: 'Stanrox DS 800mg/160mg Tablet',
  manufacturer: 'Stanmac Pharmaceuticals',
  pack_label: 'strip of 10 tablets',
  form_raw: null,
  ingredients: [
    { molecule: 'sulfamethopyrazine', strength_raw: '800mg', strength_value: 800, strength_unit: 'mg' },
    { molecule: 'trimethoprim', strength_raw: '160mg', strength_value: 160, strength_unit: 'mg' },
  ],
};
const PAIR_PLUS_EXTRA = {
  brand_name: 'Synthetic Co-trimoxazole plus Lactobacillus Tablet',
  manufacturer: 'Synthetic Fixture Ltd',
  pack_label: 'strip of 10 tablets',
  form_raw: null,
  ingredients: [
    { molecule: 'sulfamethoxazole', strength_raw: '800mg', strength_value: 800, strength_unit: 'mg' },
    { molecule: 'trimethoprim', strength_raw: '160mg', strength_value: 160, strength_unit: 'mg' },
    { molecule: 'lactobacillus', strength_raw: '60m spores', strength_value: 60, strength_unit: 'm spores' },
  ],
};

const presentationFor = (row, route, formulation) => ({
  product_id: productIdForRow(row),
  product_assertion_sha256: productAssertionHashForRow(row),
  route,
  formulation,
});

const review = {
  status: 'reviewed',
  reviewer_id: 'clinician:subas',
  reviewed_at: '2026-07-27',
  evidence: [{
    source_id: 'rxnorm',
    identifier: 'rxcui:10831',
    source_url: 'https://rxnav.nlm.nih.gov/REST/rxcui/10831/properties.json',
    retrieved_at: '2026-07-27',
    evidence_sha256: SHA,
  }],
};

const cotrimoxazole = (overrides = {}) => ({
  combination_id: 'combination:co-trimoxazole:rxnorm-10831',
  identity_kind: 'fixed_dose_combination',
  runtime_drug: 'co-trimoxazole',
  rxnorm: {
    rxcui: '10831',
    name: 'sulfamethoxazole / trimethoprim',
    tty: 'MIN',
    version: '06-Jul-2026',
    api_version: '3.1.354',
    response_sha256: SHA,
  },
  components: [
    {
      name: 'sulfamethoxazole',
      rxcui: '10180',
      tty: 'IN',
      assertion_ingredient_ids: [SMX_ID, SMX_PMBJP_ID],
    },
    {
      name: 'trimethoprim',
      rxcui: '10829',
      tty: 'IN',
      assertion_ingredient_ids: [TMP_ID],
    },
  ],
  component_match: 'exact_active_set',
  exposure_scope: 'systemic',
  routes: ['oral'],
  dose_forms: ['tablet'],
  presentations: [
    { ...presentationFor(PMBJP_89, 'oral', 'tablet'), rxnorm_scd: '198335', pmbjp_code: '89' },
    { ...presentationFor(PMBJP_90, 'oral', 'tablet'), rxnorm_scd: '142118', pmbjp_code: '90' },
  ],
  provenance: {
    pmbjp_product_source: 'official_product_list',
    pmbjp_tender_source: null,
    pmbjp_tender_status: 'not_present',
    tender_document: 'RC-222/2025',
  },
  allowed_profiles: ['internal-evaluation'],
  review,
  ...overrides,
});

const manifestOf = (...combinations) => ({
  schema_version: COMBINATION_IDENTITY_SCHEMA_VERSION,
  identity_namespace: 'aushadhi:ingredient-identity:v1',
  notices: ['Test fixture. Not a committed clinical assertion.'],
  combinations,
});

const resolve = (product, manifest = manifestOf(cotrimoxazole()), profile = 'internal-evaluation') => (
  resolveCombinationIdentity({ product, manifest, profile })
);

// ── the fixtures must be the real products, not invented ones ────────────────

test('the product fixtures hash to the real catalogue product ids', () => {
  assert.equal(
    productIdForRow(PMBJP_89),
    'sha256:f3835b624129e57ede72edc56a6106782aa9df2e6f5491ebd09bd0ac9656e03a',
  );
  assert.equal(
    productIdForRow(PMBJP_90),
    'sha256:1b8857c5423094122e608d865db146fa2ffc7e434df540a2b0cf8bd821d33521',
  );
});

// ── validator ────────────────────────────────────────────────────────────────

test('a well-formed fixed-dose combination validates', () => {
  assert.equal(validateCombinationIdentityManifest(manifestOf(cotrimoxazole())), true);
});

test('MIN is admissible only inside a fixed_dose_combination identity', () => {
  assert.throws(
    () => validateCombinationIdentityManifest(
      manifestOf(cotrimoxazole({ identity_kind: 'single_ingredient' })),
    ),
    /identity_kind must be fixed_dose_combination/u,
  );
});

test('the single-ingredient model is left untouched and still refuses MIN', () => {
  const manifest = structuredClone(readJson('data-static/ingredient-mapping-overrides.json'));
  assert.equal(validateIngredientMappingManifest(manifest), true);
  for (const mapping of manifest.mappings) {
    assert.equal(mapping.identity.rxnorm.tty, 'IN', mapping.mapping_id);
  }
  manifest.mappings[0].identity.rxnorm.tty = 'MIN';
  assert.throws(() => validateIngredientMappingManifest(manifest), /tty must be IN or PIN/u);
});

test('a combination needs at least two components', () => {
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole({
      components: [{
        name: 'trimethoprim', rxcui: '10829', tty: 'IN', assertion_ingredient_ids: [TMP_ID],
      }],
    }))),
    /requires at least two components/u,
  );
});

test('components themselves must be single ingredients', () => {
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole({
      components: [
        { name: 'sulfamethoxazole', rxcui: '10180', tty: 'MIN', assertion_ingredient_ids: [SMX_ID] },
        { name: 'trimethoprim', rxcui: '10829', tty: 'IN', assertion_ingredient_ids: [TMP_ID] },
      ],
    }))),
    /components\[\d+\] tty must be IN or PIN/u,
  );
});

test('a component may not claim an assertion identity another component claims', () => {
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole({
      components: [
        { name: 'sulfamethoxazole', rxcui: '10180', tty: 'IN', assertion_ingredient_ids: [SMX_ID] },
        { name: 'trimethoprim', rxcui: '10829', tty: 'IN', assertion_ingredient_ids: [SMX_ID] },
      ],
    }))),
    /claimed by more than one component/u,
  );
});

test('unknown properties and unsupported match modes are rejected', () => {
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole({ note: 'smuggled' }))),
    /unknown property note/u,
  );
  assert.throws(
    () => validateCombinationIdentityManifest(
      manifestOf(cotrimoxazole({ component_match: 'contains_any' })),
    ),
    /component_match/u,
  );
});

test('the runtime drug must already be canonical and route/dose form constrained', () => {
  assert.throws(
    () => validateCombinationIdentityManifest(
      manifestOf(cotrimoxazole({ runtime_drug: 'Co-Trimoxazole' })),
    ),
    /runtime_drug must already be canonical/u,
  );
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole({ routes: [] }))),
    /routes must be a non-empty array/u,
  );
});

test('C4: an authoritative PMBJP product-identity source is required', () => {
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole({
      provenance: {
        pmbjp_product_source: null,
        pmbjp_tender_source: null,
        pmbjp_tender_status: 'not_present',
        tender_document: 'RC-222/2025',
      },
    }))),
    /pmbjp_product_source/u,
  );
});

test('C4: a missing tender must be recorded explicitly, not left silent', () => {
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole({
      provenance: {
        pmbjp_product_source: 'official_product_list',
        pmbjp_tender_source: null,
        pmbjp_tender_status: 'present',
        tender_document: 'RC-222/2025',
      },
    }))),
    /pmbjp_tender_status/u,
  );
  // and absence, once declared, is accepted without a tender citation
  assert.equal(validateCombinationIdentityManifest(manifestOf(cotrimoxazole())), true);
});

test('duplicate combination ids are rejected', () => {
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole(), cotrimoxazole())),
    /duplicate combination_id/u,
  );
});

// ── resolution: positives (C2 — both tablet strengths) ───────────────────────

test('PMBJP 89 resolves to a co-trimoxazole oral-tablet subject', () => {
  const result = resolve(PMBJP_89);
  assert.equal(result.status, 'reviewed_override');
  assert.equal(result.combination_id, 'combination:co-trimoxazole:rxnorm-10831');
  assert.deepEqual(result.runtime_subject, {
    drug: 'co-trimoxazole', route: 'oral', formulation: 'tablet',
  });
});

test('C2: the paediatric 100/20 tablet resolves too', () => {
  const result = resolve(PMBJP_90);
  assert.equal(result.status, 'reviewed_override');
  assert.deepEqual(result.runtime_subject, {
    drug: 'co-trimoxazole', route: 'oral', formulation: 'tablet',
  });
});

// ── resolution: negatives ────────────────────────────────────────────────────

test('B2: a single-ingredient trimethoprim product never inherits the combination', () => {
  const result = resolve(TRIMETHOPRIM_ONLY);
  assert.equal(result.status, 'no_combination');
  assert.equal(result.runtime_subject, null);
});

test('B3: sulfamethoxazole in a different combination never inherits it either', () => {
  const result = resolve(SMX_PLUS_PYRIMETHAMINE);
  assert.equal(result.status, 'no_combination');
  assert.equal(result.runtime_subject, null);
});

test('a different sulfonamide paired with trimethoprim is not co-trimoxazole', () => {
  const result = resolve(SULFAMETHOPYRAZINE_PLUS_TMP);
  assert.equal(result.status, 'no_combination');
  assert.equal(result.runtime_subject, null);
});

test('exact_active_set means an extra active ingredient breaks the match', () => {
  const result = resolve(PAIR_PLUS_EXTRA);
  assert.equal(result.status, 'no_combination');
  assert.equal(result.runtime_subject, null);
});

test('C3: the 50 ml oral suspension is out of scope', () => {
  const result = resolve(PMBJP_88_SUSPENSION);
  assert.equal(result.status, 'no_combination');
  assert.equal(result.runtime_subject, null);
});

test('C3: an intravenous presentation cannot even be authored under an oral-tablet scope', () => {
  // Stronger than refusing it at resolution: the declared scope and the reviewed
  // presentation list must agree, so an out-of-scope product is caught at authoring.
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole({
      presentations: [{
        ...presentationFor(PMBJP_89, 'intravenous', 'injection'),
        rxnorm_scd: '198335',
        pmbjp_code: '89',
      }],
    }))),
    /presentation route intravenous is outside the declared routes/u,
  );
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole({
      presentations: [{
        ...presentationFor(PMBJP_88_SUSPENSION, 'oral', 'suspension'),
        rxnorm_scd: '198335',
        pmbjp_code: '88',
      }],
    }))),
    /presentation formulation suspension is outside the declared dose_forms/u,
  );
});

test('a drifted product assertion fails closed as stale', () => {
  const manifest = manifestOf(cotrimoxazole({
    presentations: [{
      ...presentationFor(PMBJP_89, 'oral', 'tablet'),
      product_assertion_sha256: 'b'.repeat(64),
      rxnorm_scd: '198335',
      pmbjp_code: '89',
    }],
  }));
  const result = resolve(PMBJP_89, manifest);
  assert.equal(result.status, 'stale');
  assert.equal(result.runtime_subject, null);
});

test('a product outside the reviewed presentation list does not resolve', () => {
  const unlisted = pmbjpRow(
    'Co-trimoxazole (Sulphamethoxazole 400mg and Trimethoprim 80mg) Tablets IP',
    [['co-trimoxazole sulphamethoxazole', '400mg', 400], ['trimethoprim', '80mg', 80]],
  );
  const result = resolve(unlisted);
  assert.equal(result.status, 'no_combination');
});

test('the profile gate still applies', () => {
  const result = resolve(PMBJP_89, manifestOf(cotrimoxazole()), 'production-open');
  assert.equal(result.status, 'no_combination');
  assert.equal(result.runtime_subject, null);
});

// ── committed state: still blocked ───────────────────────────────────────────

test('the committed combination manifest is empty pending independent approval', () => {
  const manifest = readJson('data-static/combination-identity-overrides.json');
  assert.equal(validateCombinationIdentityManifest(manifest), true);
  assert.deepEqual(manifest.combinations, []);
  const open = readJson('data-static/interaction-rules.json');
  assert.equal(open.rules.length, 0);
});

test('no component of co-trimoxazole is mapped in the single-ingredient manifest', () => {
  const manifest = readJson('data-static/ingredient-mapping-overrides.json');
  const drugs = manifest.mappings.map((m) => m.identity.runtime_drug);
  for (const forbidden of ['co-trimoxazole', 'trimethoprim', 'sulfamethoxazole']) {
    assert.equal(drugs.includes(forbidden), false, `${forbidden} must not be mapped`);
  }
});
