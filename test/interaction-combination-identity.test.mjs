// Fixed-dose combination identity path.
//
// Clinician decision C1 (2026-07-27) approved combinations WITH AN ARCHITECTURAL
// CONDITION: a separate identity path, leaving the single-ingredient IN/PIN model
// untouched. Independent review (2026-07-28) then WITHHELD approval pending seven
// corrections, all of which this suite pins:
//
//   1. release profile must be explicit and fail closed
//   2. declared scope must EQUAL the reviewed presentation scope, not merely contain it
//   3. RxNorm MIN/component/SCD structure must be cross-validated, not just stored
//   4. drift on a reviewed product must surface as stale, never as a quiet non-match
//   5. PMBJP provenance vocabulary must be consistent and evidence-linked
//   6. (gate greenness -- see test/cache-retention.test.mjs)
//   7. production-open may not be self-declared in a source manifest
//
// Every combination below is a TEST fixture. The committed manifest is empty.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBINATION_IDENTITY_SCHEMA_VERSION,
  auditCombinationIdentityAcrossProfiles,
  compileCombinationIdentityManifest,
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

// ── product fixtures: real catalogue rows, asserted below to hash to the real ids
const pmbjpRow = (brand, ingredients, { packLabel = "10's", code } = {}) => ({
  brand_name: brand,
  manufacturer: 'PMBJP (Jan Aushadhi)',
  pack_label: packLabel,
  form_raw: null,
  ingredients: ingredients.map(([molecule, raw, value]) => ({
    molecule, strength_raw: raw, strength_value: value, strength_unit: 'mg',
  })),
  sources: code === undefined
    ? []
    : [{ source: 'janaushadhi', source_id: code, seen_at: '2026-07-07' }],
});

const PMBJP_89 = pmbjpRow(
  'Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg) Tablets IP',
  [['co-trimoxazole sulphamethoxazole', '800mg', 800], ['trimethoprim', '160mg', 160]],
  { code: '89' },
);
const PMBJP_90 = pmbjpRow(
  'Co-trimoxazole (Sulphamethoxazole 100mg and Trimethoprim 20mg) Tablets IP',
  [['co-trimoxazole sulphamethoxazole', '100mg', 100], ['trimethoprim', '20mg', 20]],
  { code: '90' },
);
const PMBJP_88_SUSPENSION = pmbjpRow(
  'Co-trimoxazole (Sulphamethoxazole 200mg and Trimethoprim 40mg per 5ml) Oral Suspension IP',
  [['co-trimoxazole sulphamethoxazole', '200mg', 200], ['trimethoprim', '40mg', 40]],
  { packLabel: '50 ml', code: '88' },
);
const TRIMETHOPRIM_ONLY = {
  brand_name: 'Bacstol Tablet',
  manufacturer: 'Ind Swift Laboratories Ltd',
  pack_label: 'strip of 10 tablets',
  form_raw: null,
  ingredients: [{
    molecule: 'trimethoprim', strength_raw: '100mg', strength_value: 100, strength_unit: 'mg',
  }],
  sources: [],
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
  sources: [],
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
  sources: [],
};
const PAIR_PLUS_EXTRA = {
  brand_name: 'Synthetic Co-trimoxazole plus Lactobacillus Tablet',
  manufacturer: 'Synthetic Fixture Ltd',
  pack_label: 'strip of 10 tablets',
  form_raw: null,
  ingredients: [
    { molecule: 'sulfamethoxazole', strength_raw: '800mg', strength_value: 800, strength_unit: 'mg' },
    { molecule: 'trimethoprim', strength_raw: '160mg', strength_value: 160, strength_unit: 'mg' },
    { molecule: 'lactobacillus', strength_raw: '60msp', strength_value: 60, strength_unit: 'msp' },
  ],
  sources: [],
};

const scd = (rxcui, name, smxStrength, tmpStrength) => ({
  rxcui,
  tty: 'SCD',
  name,
  ingredients_and_strengths: [
    { ingredient_rxcui: '10180', numerator_value: smxStrength, numerator_unit: 'MG' },
    { ingredient_rxcui: '10829', numerator_value: tmpStrength, numerator_unit: 'MG' },
  ],
  dose_form: 'Oral Tablet',
  version: '06-Jul-2026',
  response_sha256: SHA,
});

const presentationFor = (row, route, formulation, code, scdObject) => ({
  source_identity: { namespace: 'presentation:pmbjp', code },
  product_id: productIdForRow(row),
  product_assertion_sha256: productAssertionHashForRow(row),
  route,
  formulation,
  rxnorm_scd: scdObject,
});

const evidence = (id) => ({
  evidence_ref: id,
  source_id: 'janaushadhi',
  identifier: `pmbjp-product-list:${id}`,
  source_url: 'https://static.pib.gov.in/example.pdf',
  retrieved_at: '2026-07-27',
  evidence_sha256: SHA,
});

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
    properties_response_sha256: SHA,
    component_relation: {
      relationship: 'has_part',
      component_rxcuis: ['10180', '10829'],
      response_sha256: SHA,
    },
  },
  components: [
    { name: 'sulfamethoxazole', rxcui: '10180', tty: 'IN', assertion_ingredient_ids: [SMX_ID, SMX_PMBJP_ID] },
    { name: 'trimethoprim', rxcui: '10829', tty: 'IN', assertion_ingredient_ids: [TMP_ID] },
  ],
  component_match: 'exact_active_set',
  exposure_scope: 'systemic',
  routes: ['oral'],
  dose_forms: ['tablet'],
  presentations: [
    presentationFor(PMBJP_89, 'oral', 'tablet', '89',
      scd('198335', 'sulfamethoxazole 800 MG / trimethoprim 160 MG Oral Tablet', '800', '160')),
    presentationFor(PMBJP_90, 'oral', 'tablet', '90',
      scd('142118', 'sulfamethoxazole 100 MG / trimethoprim 20 MG Oral Tablet', '100', '20')),
  ],
  provenance: {
    identity_sources: [{ kind: 'official_product_list', evidence_ref: 'list-89' }],
    tender_check: { status: 'not_present', document_id: 'RC-222/2025', evidence_ref: 'tender-negative' },
  },
  allowed_profiles: ['internal-evaluation'],
  review: {
    status: 'reviewed',
    reviewer_id: 'clinician:subas',
    reviewed_at: '2026-07-27',
    evidence: [evidence('list-89'), evidence('tender-negative')],
  },
  ...overrides,
});

const manifestOf = (...combinations) => ({
  schema_version: COMBINATION_IDENTITY_SCHEMA_VERSION,
  identity_namespace: 'aushadhi:ingredient-identity:v1',
  notices: ['Test fixture. Not a committed clinical assertion.'],
  combinations,
});

const compiled = (manifest = manifestOf(cotrimoxazole())) => compileCombinationIdentityManifest(manifest);
const resolve = (product, manifest = manifestOf(cotrimoxazole()), profile = 'internal-evaluation') => (
  resolveCombinationIdentity({ product, manifest: compiled(manifest), profile })
);
const rejects = (overrides, pattern) => assert.throws(
  () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole(overrides))),
  pattern,
);

test('the product fixtures hash to the real catalogue product ids', () => {
  assert.equal(productIdForRow(PMBJP_89),
    'sha256:f3835b624129e57ede72edc56a6106782aa9df2e6f5491ebd09bd0ac9656e03a');
  assert.equal(productIdForRow(PMBJP_90),
    'sha256:1b8857c5423094122e608d865db146fa2ffc7e434df540a2b0cf8bd821d33521');
});

test('a well-formed fixed-dose combination validates', () => {
  assert.equal(validateCombinationIdentityManifest(manifestOf(cotrimoxazole())), true);
});

// ── 1. release profile fails closed ──────────────────────────────────────────

test('BLOCKER 1: the release profile must be explicit', () => {
  const manifest = compiled();
  for (const profile of [undefined, null, '', 'internal', 'PRODUCTION-OPEN']) {
    assert.throws(
      () => resolveCombinationIdentity({ product: PMBJP_89, manifest, profile }),
      /profile must be explicitly set to one of/u,
      `profile ${JSON.stringify(profile)} must be refused`,
    );
  }
  assert.throws(
    () => resolveCombinationIdentity({ product: PMBJP_89, manifest }),
    /profile must be explicitly set to one of/u,
  );
});

test('BLOCKER 1: an internal-only combination never resolves for production-open', () => {
  assert.equal(resolve(PMBJP_89, manifestOf(cotrimoxazole()), 'production-open').status,
    'no_combination');
  assert.equal(resolve(PMBJP_89, manifestOf(cotrimoxazole()), 'internal-evaluation').status,
    'reviewed_override');
});

test('BLOCKER 1: profile-blind auditing is a separate, explicitly named function', () => {
  const result = auditCombinationIdentityAcrossProfiles({ product: PMBJP_89, manifest: compiled() });
  assert.equal(result.status, 'reviewed_override');
  assert.deepEqual(result.allowed_profiles, ['internal-evaluation']);
  assert.equal(result.audit_only, true);
});

// ── 2. declared scope must EQUAL reviewed presentation scope ─────────────────

test('BLOCKER 2: a declared route with no reviewed presentation is rejected', () => {
  rejects({ routes: ['oral', 'intravenous'] },
    /routes must exactly equal the reviewed presentation routes/u);
  rejects({ dose_forms: ['tablet', 'injection'] },
    /dose_forms must exactly equal the reviewed presentation formulations/u);
});

test('BLOCKER 2: an out-of-scope presentation is still rejected', () => {
  rejects({
    presentations: [presentationFor(PMBJP_89, 'intravenous', 'injection', '89',
      scd('198335', 'x', '800', '160'))],
  }, /routes must exactly equal the reviewed presentation routes/u);
});

test('BLOCKER 2: declared route and dose-form values must be canonical and unique', () => {
  rejects({ routes: ['oral', 'oral'] }, /routes contains duplicate/u);
  rejects({ routes: ['Oral'] }, /routes\[0\] must be a canonical route/u);
  rejects({ dose_forms: ['Tablet'] }, /dose_forms\[0\] must be a canonical formulation/u);
});

// ── 3. RxNorm structure cross-validated ──────────────────────────────────────

test('BLOCKER 3: the MIN component relation must match the declared components', () => {
  rejects({
    rxnorm: {
      ...cotrimoxazole().rxnorm,
      component_relation: {
        relationship: 'has_part', component_rxcuis: ['10180', '99999'], response_sha256: SHA,
      },
    },
  }, /component_relation component_rxcuis must equal the declared component rxcuis/u);
});

test('BLOCKER 3: two components may not reuse one RxCUI', () => {
  rejects({
    components: [
      { name: 'sulfamethoxazole', rxcui: '10180', tty: 'IN', assertion_ingredient_ids: [SMX_ID] },
      { name: 'trimethoprim', rxcui: '10180', tty: 'IN', assertion_ingredient_ids: [TMP_ID] },
    ],
  }, /rxcui 10180 is used by more than one component/u);
});

test('BLOCKER 3: an SCD must be an SCD and must carry the declared ingredients', () => {
  rejects({
    presentations: [
      { ...cotrimoxazole().presentations[0], rxnorm_scd: { ...scd('198335', 'x', '800', '160'), tty: 'SBD' } },
      cotrimoxazole().presentations[1],
    ],
  }, /rxnorm_scd\.tty must be SCD/u);
  rejects({
    presentations: [
      {
        ...cotrimoxazole().presentations[0],
        rxnorm_scd: {
          ...scd('198335', 'x', '800', '160'),
          ingredients_and_strengths: [
            { ingredient_rxcui: '10180', numerator_value: '800', numerator_unit: 'MG' },
            { ingredient_rxcui: '99999', numerator_value: '160', numerator_unit: 'MG' },
          ],
        },
      },
      cotrimoxazole().presentations[1],
    ],
  }, /rxnorm_scd ingredients must equal the declared component rxcuis/u);
});

test('BLOCKER 3: the combination term type must still be MIN, and components IN or PIN', () => {
  rejects({ rxnorm: { ...cotrimoxazole().rxnorm, tty: 'IN' } }, /tty must be MIN/u);
  rejects({
    components: [
      { name: 'sulfamethoxazole', rxcui: '10180', tty: 'MIN', assertion_ingredient_ids: [SMX_ID] },
      { name: 'trimethoprim', rxcui: '10829', tty: 'IN', assertion_ingredient_ids: [TMP_ID] },
    ],
  }, /components\[\d+\] tty must be IN or PIN/u);
});

// ── 4. drift on a reviewed product is loud ───────────────────────────────────

test('BLOCKER 4: an ingredient change on a reviewed product yields stale, not a quiet miss', () => {
  // the drifted row no longer matches the active set AND its product_id changes,
  // so only the stable source identity can still recognise it as reviewed
  const drifted = {
    ...PMBJP_89,
    ingredients: [
      { molecule: 'sulfamethoxazole', strength_raw: '800mg', strength_value: 800, strength_unit: 'mg' },
      { molecule: 'trimethoprim', strength_raw: '160mg', strength_value: 160, strength_unit: 'mg' },
      { molecule: 'lactobacillus', strength_raw: '60msp', strength_value: 60, strength_unit: 'msp' },
    ],
  };
  const result = resolve(drifted);
  assert.equal(result.status, 'stale');
  assert.equal(result.runtime_subject, null);
  assert.equal(result.error, 'product_assertion_changed_since_review');
  assert.equal(result.source_identity.code, '89');
});

test('BLOCKER 4: a reviewed product whose assertion hash drifts is stale', () => {
  const manifest = manifestOf(cotrimoxazole({
    presentations: [
      { ...cotrimoxazole().presentations[0], product_assertion_sha256: 'b'.repeat(64) },
      cotrimoxazole().presentations[1],
    ],
  }));
  const result = resolve(PMBJP_89, manifest);
  assert.equal(result.status, 'stale');
  assert.equal(result.runtime_subject, null);
});

test('BLOCKER 4: an unusable ingredient identity is reported, not silently dropped', () => {
  const broken = { ...PMBJP_89, ingredients: [{ strength_raw: '800mg', strength_value: 800 }] };
  const result = resolve(broken);
  assert.equal(result.status, 'invalid_product_assertion');
  assert.equal(result.runtime_subject, null);
  assert.equal(result.error, 'ingredient_identity_generation_failed');
});

// ── 5. provenance is consistent and evidence-linked ──────────────────────────

test('BLOCKER 5: a tender qualifies as an identity source, matching the shared policy', () => {
  assert.equal(
    validateCombinationIdentityManifest(manifestOf(cotrimoxazole({
      provenance: {
        identity_sources: [{ kind: 'pmbjp_tender', evidence_ref: 'list-89' }],
        tender_check: { status: 'present', document_id: 'RC-222/2025', evidence_ref: 'tender-negative' },
      },
    }))),
    true,
  );
});

test('BLOCKER 5: every evidence_ref must resolve to a hashed review record', () => {
  rejects({
    provenance: {
      identity_sources: [{ kind: 'official_product_list', evidence_ref: 'nonexistent' }],
      tender_check: { status: 'not_present', document_id: 'RC-222/2025', evidence_ref: 'tender-negative' },
    },
  }, /evidence_ref nonexistent does not resolve/u);
});

test('BLOCKER 5: a tender declared not_present must name the document that was checked', () => {
  rejects({
    provenance: {
      identity_sources: [{ kind: 'official_product_list', evidence_ref: 'list-89' }],
      tender_check: { status: 'not_present', document_id: null, evidence_ref: 'tender-negative' },
    },
  }, /tender_check\.document_id is required/u);
  rejects({
    provenance: {
      identity_sources: [{ kind: 'official_product_list', evidence_ref: 'list-89' }],
      tender_check: { status: 'not_present', document_id: 'RC-222/2025', evidence_ref: null },
    },
  }, /tender_check\.evidence_ref is required/u);
});

test('BLOCKER 5: at least one identity source is required', () => {
  rejects({
    provenance: {
      identity_sources: [],
      tender_check: { status: 'not_checked', document_id: null, evidence_ref: null },
    },
  }, /identity_sources must be a non-empty array/u);
});

// ── 7. production-open cannot be self-declared ───────────────────────────────

test('BLOCKER 7: a source manifest may not self-declare production-open', () => {
  rejects({ allowed_profiles: ['production-open'] },
    /allowed_profiles may only contain internal-evaluation/u);
  rejects({ allowed_profiles: ['internal-evaluation', 'production-open'] },
    /allowed_profiles may only contain internal-evaluation/u);
});

// ── hardening ────────────────────────────────────────────────────────────────

test('HARDENING: overlapping combinations are rejected at authoring, not at runtime', () => {
  const other = cotrimoxazole({ combination_id: 'combination:duplicate-active-set' });
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole(), other)),
    /overlapping component assertion identities/u,
  );
});

test('HARDENING: one reviewed product may not belong to two combinations', () => {
  const other = cotrimoxazole({
    combination_id: 'combination:other',
    components: [
      { name: 'sulfamethoxazole', rxcui: '10180', tty: 'IN', assertion_ingredient_ids: [SMX_PMBJP_ID] },
      { name: 'trimethoprim', rxcui: '10829', tty: 'IN', assertion_ingredient_ids: [TMP_ID] },
    ],
    rxnorm: {
      ...cotrimoxazole().rxnorm,
      component_relation: {
        relationship: 'has_part', component_rxcuis: ['10180', '10829'], response_sha256: SHA,
      },
    },
  });
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole(), other)),
    /overlapping component assertion identities|reviewed product .* in more than one combination/u,
  );
});

test('HARDENING: component count is bounded', () => {
  const many = Array.from({ length: 9 }, (_, index) => ({
    name: `ingredient-${index}`,
    rxcui: `${1000 + index}`,
    tty: 'IN',
    assertion_ingredient_ids: [`sha256:${String(index).repeat(64).slice(0, 64)}`],
  }));
  rejects({ components: many }, /at most \d+ components/u);
});

test('HARDENING: the manifest is compiled once, not revalidated per product', () => {
  const compiledManifest = compiled();
  assert.equal(compiledManifest.compiled, true);
  assert.equal(Object.isFrozen(compiledManifest), true);
  // an uncompiled manifest is refused rather than silently revalidated
  assert.throws(
    () => resolveCombinationIdentity({
      product: PMBJP_89, manifest: manifestOf(cotrimoxazole()), profile: 'internal-evaluation',
    }),
    /manifest must be compiled/u,
  );
});

test('HARDENING: presentation identity is source-agnostic', () => {
  const combination = cotrimoxazole();
  assert.deepEqual(combination.presentations[0].source_identity,
    { namespace: 'presentation:pmbjp', code: '89' });
  rejects({
    presentations: [
      { ...cotrimoxazole().presentations[0], source_identity: { namespace: 'presentation:pmbjp', code: '89' } },
      { ...cotrimoxazole().presentations[1], source_identity: { namespace: 'presentation:pmbjp', code: '89' } },
    ],
  }, /duplicate presentation source identity/u);
});

// ── structural rules retained from the first implementation ──────────────────

test('the single-ingredient model is left untouched and still refuses MIN', () => {
  const manifest = structuredClone(readJson('data-static/ingredient-mapping-overrides.json'));
  assert.equal(validateIngredientMappingManifest(manifest), true);
  manifest.mappings[0].identity.rxnorm.tty = 'MIN';
  assert.throws(() => validateIngredientMappingManifest(manifest), /tty must be IN or PIN/u);
});

test('MIN is admissible only inside a fixed_dose_combination identity', () => {
  rejects({ identity_kind: 'single_ingredient' }, /identity_kind must be fixed_dose_combination/u);
});

test('a combination needs at least two components', () => {
  rejects({
    components: [{ name: 'trimethoprim', rxcui: '10829', tty: 'IN', assertion_ingredient_ids: [TMP_ID] }],
  }, /requires at least two components/u);
});

test('a component may not claim an assertion identity another component claims', () => {
  rejects({
    components: [
      { name: 'sulfamethoxazole', rxcui: '10180', tty: 'IN', assertion_ingredient_ids: [SMX_ID] },
      { name: 'trimethoprim', rxcui: '10829', tty: 'IN', assertion_ingredient_ids: [SMX_ID] },
    ],
  }, /claimed by more than one component/u);
});

test('unknown properties, bad match modes and non-canonical drugs are rejected', () => {
  rejects({ note: 'smuggled' }, /unknown property note/u);
  rejects({ component_match: 'contains_any' }, /component_match/u);
  rejects({ runtime_drug: 'Co-Trimoxazole' }, /runtime_drug must already be canonical/u);
});

test('duplicate combination ids are rejected', () => {
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(cotrimoxazole(), cotrimoxazole())),
    /duplicate combination_id/u,
  );
});

// ── resolution: positives and negatives ──────────────────────────────────────

test('C2: both reviewed tablet strengths resolve', () => {
  for (const row of [PMBJP_89, PMBJP_90]) {
    const result = resolve(row);
    assert.equal(result.status, 'reviewed_override');
    assert.deepEqual(result.runtime_subject,
      { drug: 'co-trimoxazole', route: 'oral', formulation: 'tablet' });
  }
  assert.equal(resolve(PMBJP_89).rxnorm_scd.rxcui, '198335');
  assert.equal(resolve(PMBJP_90).rxnorm_scd.rxcui, '142118');
});

test('no component of a combination ever inherits it', () => {
  for (const [label, row] of [
    ['trimethoprim alone', TRIMETHOPRIM_ONLY],
    ['sulfamethoxazole in a different combination', SMX_PLUS_PYRIMETHAMINE],
    ['a different sulfonamide with trimethoprim', SULFAMETHOPYRAZINE_PLUS_TMP],
    ['the pair plus an extra active ingredient', PAIR_PLUS_EXTRA],
    ['the 50 ml oral suspension', PMBJP_88_SUSPENSION],
  ]) {
    const result = resolve(row);
    assert.equal(result.runtime_subject, null, label);
    assert.ok(['no_combination', 'stale'].includes(result.status), `${label}: ${result.status}`);
  }
});

test('an unreviewed product matching the component set still fails closed', () => {
  const unlisted = pmbjpRow(
    'Co-trimoxazole (Sulphamethoxazole 400mg and Trimethoprim 80mg) Tablets IP',
    [['co-trimoxazole sulphamethoxazole', '400mg', 400], ['trimethoprim', '80mg', 80]],
    { code: '9999' },
  );
  const result = resolve(unlisted);
  assert.equal(result.status, 'no_combination');
  assert.equal(result.runtime_subject, null);
});

// ── committed state ──────────────────────────────────────────────────────────

test('the committed combination manifest is empty pending independent approval', () => {
  const manifest = readJson('data-static/combination-identity-overrides.json');
  assert.equal(validateCombinationIdentityManifest(manifest), true);
  assert.deepEqual(manifest.combinations, []);
  assert.equal(readJson('data-static/interaction-rules.json').rules.length, 0);
});

test('no component of co-trimoxazole is mapped in the single-ingredient manifest', () => {
  const drugs = readJson('data-static/ingredient-mapping-overrides.json')
    .mappings.map((m) => m.identity.runtime_drug);
  for (const forbidden of ['co-trimoxazole', 'trimethoprim', 'sulfamethoxazole']) {
    assert.equal(drugs.includes(forbidden), false, `${forbidden} must not be mapped`);
  }
});
