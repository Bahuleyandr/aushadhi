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
// Most combinations below are TEST fixtures. The committed manifest contains only
// the independently reviewable, internal-evaluation co-trimoxazole identity.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBINATION_IDENTITY_SCHEMA_VERSION,
  COMPILED_KINDS,
  assertRuntimeCombinationResult,
  auditCombinationIdentityAcrossProfiles,
  compileCombinationIdentityManifest,
  resolveCombinationIdentity,
  validateCombinationIdentityManifest,
} from '../src/lib/interaction-combination-identity.mjs';
import {
  verifyCombinationManifestEvidence,
} from '../src/lib/combination-rxnorm-evidence.mjs';
import { ingredientIdForName } from '../src/lib/ingredient-identity.mjs';
import { validateIngredientMappingManifest } from '../src/lib/interaction-mapping.mjs';
import {
  productAssertionForRow,
  productAssertionHashForRow,
  productIdForRow,
} from '../src/lib/product-resolver.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const INTEGRATION_BUNDLE = readJson(
  'data-static/combination-rxnorm-evidence/integration-fixture/'
  + 'combination_co-trimoxazole_rxnorm-10831.json',
);
const RX_HASHES = INTEGRATION_BUNDLE.response_hashes;

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
    {
      component_rxcui: '10180', ingredient_rxcui_field: 'baseRxcui',
      numerator_value: smxStrength, numerator_unit: 'MG',
      denominator_value: '1', denominator_unit: 'EACH',
    },
    {
      component_rxcui: '10829', ingredient_rxcui_field: 'baseRxcui',
      numerator_value: tmpStrength, numerator_unit: 'MG',
      denominator_value: '1', denominator_unit: 'EACH',
    },
  ],
  dose_form: 'Oral Tablet',
  version: '06-Jul-2026',
  properties_response_sha256: RX_HASHES[`rxcui/${rxcui}/properties`],
  historystatus_response_sha256: RX_HASHES[`rxcui/${rxcui}/historystatus`],
  min_relation_response_sha256: RX_HASHES[`rxcui/${rxcui}/related?rela=has_ingredients`],
});

const presentationFor = (row, route, formulation, code, scdObject) => ({
  source_identity: { namespace: 'presentation:pmbjp', code },
  product_id: productIdForRow(row),
  product_assertion_sha256: productAssertionHashForRow(row),
  product_assertion: productAssertionForRow(row),
  route,
  formulation,
  rxnorm_scd: scdObject,
});

const evidence = (id) => ({
  evidence_ref: id,
  source_id: 'janaushadhi',
  identifier: id === 'list-89' ? 'pmbjp-product-list:89,90' : `pmbjp-product-list:${id}`,
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
    properties_response_sha256: RX_HASHES['rxcui/10831/properties'],
    component_relation: {
      relationship: 'has_part',
      component_rxcuis: ['10180', '10829'],
      response_sha256: RX_HASHES['rxcui/10831/related?rela=has_part'],
    },
  },
  components: [
    {
      name: 'sulfamethoxazole',
      rxcui: '10180',
      tty: 'IN',
      runtime_ingredient_id: SMX_ID,
      assertion_ingredient_ids: [SMX_ID, SMX_PMBJP_ID],
    },
    {
      name: 'trimethoprim',
      rxcui: '10829',
      tty: 'IN',
      runtime_ingredient_id: TMP_ID,
      assertion_ingredient_ids: [TMP_ID],
    },
  ],
  component_match: 'exact_active_set',
  exposure_scope: 'systemic',
  presentation_scopes: [{ route: 'oral', formulation: 'tablet' }],
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

const authoritativeBundle = (combinationId) => {
  const rawVersion = INTEGRATION_BUNDLE.capture.version_response;
  const versionSha256 = INTEGRATION_BUNDLE.capture.version_before_sha256;
  return {
    ...structuredClone(INTEGRATION_BUNDLE),
    classification: 'combination_identity_evidence',
    promotion_authority: 'identity_only',
    audit_only: false,
    combination_id: combinationId,
    capture: {
      base_url: 'https://rxnav.nlm.nih.gov/REST',
      captured_at: '2026-07-28T06:27:46.630Z',
      version_before_response: rawVersion,
      version_before_sha256: versionSha256,
      version_after_response: rawVersion,
      version_after_sha256: versionSha256,
      version_stable: true,
    },
  };
};

const compiled = (manifest = manifestOf(cotrimoxazole())) => compileCombinationIdentityManifest(
  manifest,
  {
    kind: 'verified_manifest',
    verificationReport: verifyCombinationManifestEvidence(manifest, {
      [manifest.combinations[0].combination_id]: authoritativeBundle(
        manifest.combinations[0].combination_id,
      ),
    }),
  },
);
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

test('each component requires one reviewed runtime identity from its accepted assertion set', () => {
  const missing = cotrimoxazole();
  delete missing.components[0].runtime_ingredient_id;
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(missing)),
    /runtime_ingredient_id/u,
  );

  const unreviewed = cotrimoxazole();
  unreviewed.components[0].runtime_ingredient_id = TMP_ID;
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(unreviewed)),
    /runtime_ingredient_id.*assertion_ingredient_ids/u,
  );

  const mismatchedName = cotrimoxazole();
  mismatchedName.components[0].runtime_ingredient_id = SMX_PMBJP_ID;
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(mismatchedName)),
    /runtime_ingredient_id.*component name/u,
  );
});

test('SCD denominator value and unit are both required or both absent', () => {
  for (const [denominator_value, denominator_unit] of [
    [null, 'EACH'],
    ['1', null],
  ]) {
    const combination = cotrimoxazole();
    Object.assign(
      combination.presentations[0].rxnorm_scd.ingredients_and_strengths[0],
      { denominator_value, denominator_unit },
    );
    assert.throws(
      () => validateCombinationIdentityManifest(manifestOf(combination)),
      /denominator_value.*denominator_unit|denominator_unit.*denominator_value/u,
    );
  }
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

test('BLOCKER 1: an audit result is a DISTINCT type a runtime consumer cannot use', () => {
  const result = auditCombinationIdentityAcrossProfiles({ product: PMBJP_89, manifest: compiled() });
  // not merely a flag on an otherwise runtime-shaped result: a different status,
  // no runtime_subject at all, and the match reported under a different key
  assert.equal(result.status, 'audit_match');
  assert.equal(result.audit_only, true);
  assert.equal(result.runtime_subject, null);
  assert.deepEqual(result.candidate_subject,
    { drug: 'co-trimoxazole', route: 'oral', formulation: 'tablet' });
  assert.deepEqual(result.authored_profiles, ['internal-evaluation']);

  // and a runtime consumer must reject it even if it is passed in by mistake
  assert.throws(
    () => assertRuntimeCombinationResult(result),
    /audit result may not be used on a runtime path/u,
  );
  const runtimeResult = resolve(PMBJP_89);
  assert.strictEqual(assertRuntimeCombinationResult(runtimeResult), runtimeResult);
  assert.equal(runtimeResult.status, 'reviewed_override');
  assert.ok(Object.isFrozen(runtimeResult));
  assert.ok(Object.isFrozen(runtimeResult.components));
  assert.ok(Object.isFrozen(runtimeResult.runtime_subject));
  assert.throws(
    () => assertRuntimeCombinationResult(structuredClone(runtimeResult)),
    /not an authentic verified resolver result/u,
  );
});

// ── 2. declared scope must EQUAL reviewed presentation scope ─────────────────

const SCOPE_MISMATCH = /presentation_scopes must exactly equal the reviewed presentation route and formulation pairs/u;

test('BLOCKER 2: a declared scope with no reviewed presentation is rejected', () => {
  rejects({
    presentation_scopes: [
      { route: 'oral', formulation: 'tablet' },
      { route: 'intravenous', formulation: 'injection' },
    ],
  }, SCOPE_MISMATCH);
});

test('BLOCKER 2: an out-of-scope presentation is still rejected', () => {
  rejects({
    presentations: [presentationFor(PMBJP_89, 'intravenous', 'injection', '89',
      scd('198335', 'x', '800', '160'))],
  }, SCOPE_MISMATCH);
});

test('BLOCKER 2: scope is validated as route/formulation PAIRS, not independent sets', () => {
  // independent set equality cannot tell {oral+tablet, iv+injection} from the invalid
  // cross products {oral+injection, iv+tablet}
  const combination = cotrimoxazole();
  assert.deepEqual(combination.presentation_scopes, [{ route: 'oral', formulation: 'tablet' }]);
  rejects({ presentation_scopes: [{ route: 'oral', formulation: 'injection' }] }, SCOPE_MISMATCH);
});

test('BLOCKER 2: declared scope values must be canonical and unique', () => {
  rejects({
    presentation_scopes: [
      { route: 'oral', formulation: 'tablet' }, { route: 'oral', formulation: 'tablet' },
    ],
  }, /contains duplicate scope oral\/tablet/u);
  rejects({ presentation_scopes: [{ route: 'Oral', formulation: 'tablet' }] },
    /must be a canonical route/u);
  rejects({ presentation_scopes: [{ route: 'oral', formulation: 'Tablet' }] },
    /must be a canonical formulation/u);
});

// ── 3. RxNorm structure cross-validated ──────────────────────────────────────

test('BLOCKER 3: an SCD ingredient entry names its component and compared field', () => {
  const combination = cotrimoxazole();
  assert.deepEqual(combination.presentations[0].rxnorm_scd.ingredients_and_strengths[0], {
    component_rxcui: '10180', ingredient_rxcui_field: 'baseRxcui',
    numerator_value: '800', numerator_unit: 'MG',
    denominator_value: '1', denominator_unit: 'EACH',
  });
  const broken = structuredClone(combination.presentations);
  broken[0].rxnorm_scd.ingredients_and_strengths[0].ingredient_rxcui_field = 'guessed';
  rejects({ presentations: broken },
    /ingredient_rxcui_field must name a supported RxNorm ingredient field/u);
});

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
      {
        name: 'sulfamethoxazole', rxcui: '10180', tty: 'IN',
        runtime_ingredient_id: SMX_ID, assertion_ingredient_ids: [SMX_ID],
      },
      {
        name: 'trimethoprim', rxcui: '10180', tty: 'IN',
        runtime_ingredient_id: TMP_ID, assertion_ingredient_ids: [TMP_ID],
      },
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
            {
              component_rxcui: '10180', ingredient_rxcui_field: 'baseRxcui',
              numerator_value: '800', numerator_unit: 'MG',
              denominator_value: null, denominator_unit: null,
            },
            {
              component_rxcui: '99999', ingredient_rxcui_field: 'baseRxcui',
              numerator_value: '160', numerator_unit: 'MG',
              denominator_value: null, denominator_unit: null,
            },
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
      {
        name: 'sulfamethoxazole', rxcui: '10180', tty: 'MIN',
        runtime_ingredient_id: SMX_ID, assertion_ingredient_ids: [SMX_ID],
      },
      {
        name: 'trimethoprim', rxcui: '10829', tty: 'IN',
        runtime_ingredient_id: TMP_ID, assertion_ingredient_ids: [TMP_ID],
      },
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

test('BLOCKER 4: an incoherent reviewed assertion hash is rejected before compilation', () => {
  const manifest = manifestOf(cotrimoxazole({
    presentations: [
      { ...cotrimoxazole().presentations[0], product_assertion_sha256: 'b'.repeat(64) },
      cotrimoxazole().presentations[1],
    ],
  }));
  const report = verifyCombinationManifestEvidence(manifest, {
    [manifest.combinations[0].combination_id]: authoritativeBundle(
      manifest.combinations[0].combination_id,
    ),
  });
  assert.equal(report.verified, false);
  assert.ok(report.reports[0].findings.some(
    (finding) => finding.code === 'product_assertion_hash_mismatch',
  ));
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
    /could both match the same product active set|overlapping/u,
  );
});

// A generic two-component combination, so overlap can be reasoned about
// independently of co-trimoxazole's specifics.
const alias = (n) => `sha256:${String(n).repeat(64).slice(0, 64)}`;
const pairCombination = (id, drug, [rxcuiA, aliasesA], [rxcuiB, aliasesB], row) => ({
  ...cotrimoxazole(),
  combination_id: id,
  runtime_drug: drug,
  rxnorm: {
    ...cotrimoxazole().rxnorm,
    component_relation: {
      relationship: 'has_part', component_rxcuis: [rxcuiA, rxcuiB], response_sha256: SHA,
    },
  },
  components: [
    {
      name: `${drug}-a`, rxcui: rxcuiA, tty: 'IN',
      runtime_ingredient_id: ingredientIdForName(`${drug}-a`),
      assertion_ingredient_ids: [
        ingredientIdForName(`${drug}-a`),
        ...aliasesA,
      ],
    },
    {
      name: `${drug}-b`, rxcui: rxcuiB, tty: 'IN',
      runtime_ingredient_id: ingredientIdForName(`${drug}-b`),
      assertion_ingredient_ids: [
        ingredientIdForName(`${drug}-b`),
        ...aliasesB,
      ],
    },
  ],
  presentations: [{
    source_identity: { namespace: 'presentation:pmbjp', code: `${id}-code` },
    product_id: productIdForRow(row),
    product_assertion_sha256: productAssertionHashForRow(row),
    route: 'oral',
    formulation: 'tablet',
    rxnorm_scd: {
      rxcui: '198335',
      tty: 'SCD',
      name: 'fixture',
      ingredients_and_strengths: [
        {
          component_rxcui: rxcuiA, ingredient_rxcui_field: 'baseRxcui',
          numerator_value: '1', numerator_unit: 'MG',
          denominator_value: null, denominator_unit: null,
        },
        {
          component_rxcui: rxcuiB, ingredient_rxcui_field: 'baseRxcui',
          numerator_value: '1', numerator_unit: 'MG',
          denominator_value: null, denominator_unit: null,
        },
      ],
      dose_form: 'Oral Tablet',
      version: '06-Jul-2026',
      properties_response_sha256: SHA,
      historystatus_response_sha256: SHA,
      min_relation_response_sha256: SHA,
    },
  }],
});

test('HARDENING: overlap is judged by alias intersection, not textual identity', () => {
  // A accepts {x},{y}; B accepts {x},{y,z}. The product active set {x,y} would match
  // BOTH, so this must fail at authoring rather than become a runtime ambiguity.
  const a = pairCombination('combination:a', 'drug-a', ['5001', [alias(1)]], ['5002', [alias(2)]], PMBJP_89);
  const b = pairCombination('combination:b', 'drug-b', ['5003', [alias(1)]], ['5004', [alias(2), alias(3)]], PMBJP_90);
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(a, b)),
    /could both match the same product active set/u,
  );
});

test('HARDENING: a Hall-deficient three-component pair does NOT overlap', () => {
  // every component has an intersecting counterpart, yet no perfect matching exists:
  // A1 and A2 can both pair only with B1. This exercises the distinct-representatives
  // search rather than a simple "do any aliases intersect" test.
  const triple = (id, drug, specs, row) => ({
    ...cotrimoxazole(),
    combination_id: id,
    runtime_drug: drug,
    rxnorm: {
      ...cotrimoxazole().rxnorm,
      component_relation: {
        relationship: 'has_part',
        component_rxcuis: specs.map(([rxcui]) => rxcui),
        response_sha256: SHA,
      },
    },
    components: specs.map(([rxcui, aliases], index) => ({
      name: `${drug}-${index}`,
      rxcui,
      tty: 'IN',
      runtime_ingredient_id: ingredientIdForName(`${drug}-${index}`),
      assertion_ingredient_ids: [
        ingredientIdForName(`${drug}-${index}`),
        ...aliases,
      ],
    })),
    presentations: [{
      source_identity: { namespace: 'presentation:pmbjp', code: `${id}-code` },
      product_id: productIdForRow(row),
      product_assertion_sha256: productAssertionHashForRow(row),
      route: 'oral',
      formulation: 'tablet',
      rxnorm_scd: {
        rxcui: '198335', tty: 'SCD', name: 'fixture',
        ingredients_and_strengths: specs.map(([rxcui]) => ({
          component_rxcui: rxcui, ingredient_rxcui_field: 'baseRxcui',
          numerator_value: '1', numerator_unit: 'MG',
          denominator_value: null, denominator_unit: null,
        })),
        dose_form: 'Oral Tablet', version: '06-Jul-2026',
        properties_response_sha256: SHA, historystatus_response_sha256: SHA, min_relation_response_sha256: SHA,
      },
    }],
  });
  const a = triple('combination:hall-a', 'drug-a', [
    ['8001', [alias(1)]], ['8002', [alias(2)]], ['8003', [alias(3), alias(4)]],
  ], PMBJP_89);
  const b = triple('combination:hall-b', 'drug-b', [
    ['8004', [alias(1), alias(2)]], ['8005', [alias(3)]], ['8006', [alias(4)]],
  ], PMBJP_90);
  assert.equal(validateCombinationIdentityManifest(manifestOf(a, b)), true);
});

test('HARDENING: combinations that merely SHARE a component are legitimate', () => {
  // paracetamol+codeine and paracetamol+ibuprofen share paracetamol but no active
  // set matches both. Rejecting these would make the model useless for real FDCs.
  const a = pairCombination('combination:para-codeine', 'drug-a', ['161', [alias(1)]], ['2670', [alias(2)]], PMBJP_89);
  const b = pairCombination('combination:para-ibuprofen', 'drug-b', ['161', [alias(1)]], ['5640', [alias(3)]], PMBJP_90);
  assert.equal(validateCombinationIdentityManifest(manifestOf(a, b)), true);
});

test('HARDENING: one reviewed product may not belong to two combinations', () => {
  // deliberately NON-overlapping component sets, so this isolates the reviewed-product
  // clash rather than re-testing active-set overlap
  const a = pairCombination('combination:x', 'drug-a', ['7001', [alias(4)]], ['7002', [alias(5)]], PMBJP_89);
  const b = pairCombination('combination:y', 'drug-b', ['7003', [alias(6)]], ['7004', [alias(7)]], PMBJP_90);
  b.presentations[0].source_identity = { ...a.presentations[0].source_identity };
  assert.throws(
    () => validateCombinationIdentityManifest(manifestOf(a, b)),
    /appears in more than one combination/u,
  );
});

test('HARDENING: component count is bounded', () => {
  const many = Array.from({ length: 9 }, (_, index) => ({
    name: `ingredient-${index}`,
    rxcui: `${1000 + index}`,
    tty: 'IN',
    runtime_ingredient_id: `sha256:${String(index).repeat(64).slice(0, 64)}`,
    assertion_ingredient_ids: [`sha256:${String(index).repeat(64).slice(0, 64)}`],
  }));
  rejects({ components: many }, /at most \d+ components/u);
});

test('an audit fixture cannot produce a runtime-acceptable result', () => {
  const source = manifestOf(cotrimoxazole());
  const fixture = compileCombinationIdentityManifest(source, { kind: 'audit_fixture' });
  assert.equal(fixture.compiled_kind, 'audit_fixture');

  // the runtime resolver refuses the fixture outright
  assert.throws(
    () => resolveCombinationIdentity({
      product: PMBJP_89, manifest: fixture, profile: 'internal-evaluation',
    }),
    /a audit_fixture manifest may not be used here/u,
  );
  // the audit path accepts it, but its result is not runtime-usable
  const audited = auditCombinationIdentityAcrossProfiles({ product: PMBJP_89, manifest: fixture });
  assert.equal(audited.status, 'audit_match');
  assert.equal(audited.compiled_kind, 'audit_fixture');
  assert.throws(
    () => assertRuntimeCombinationResult(audited),
    /audit result may not be used on a runtime path/u,
  );
  assert.throws(
    () => assertRuntimeCombinationResult({ status: 'reviewed_override', compiled_kind: 'audit_fixture' }),
    /derived from an audit fixture may not be used on a runtime path/u,
  );
  assert.deepEqual([...COMPILED_KINDS].sort(), ['audit_fixture', 'verified_manifest']);
});

test('a non-empty manifest cannot compile as verified without evidence verification', () => {
  const source = manifestOf(cotrimoxazole());
  assert.throws(
    () => compileCombinationIdentityManifest(source, { kind: 'verified_manifest' }),
    /not an authentic verifier result/u,
  );
  assert.throws(
    () => compileCombinationIdentityManifest(source, {
      kind: 'verified_manifest',
      evidenceVerified: true,
    }),
    /not an authentic verifier result/u,
  );
  assert.throws(
    () => compileCombinationIdentityManifest(source, {
      kind: 'verified_manifest',
      verificationReport: { verified: true, combinations_checked: 1, reports: [] },
    }),
    /not an authentic verifier result/u,
  );

  const report = verifyCombinationManifestEvidence(source, {
    [source.combinations[0].combination_id]: authoritativeBundle(
      source.combinations[0].combination_id,
    ),
  });
  assert.throws(
    () => compileCombinationIdentityManifest(structuredClone(source), {
      kind: 'verified_manifest',
      verificationReport: report,
    }),
    /not bound to this exact manifest object/u,
  );
  source.notices.push('changed after verification');
  assert.throws(
    () => compileCombinationIdentityManifest(source, {
      kind: 'verified_manifest',
      verificationReport: report,
    }),
    /manifest changed since evidence verification/u,
  );
  // an EMPTY manifest compiles freely: there is nothing to verify
  const empty = manifestOf();
  assert.equal(
    compileCombinationIdentityManifest(empty, { kind: 'verified_manifest' }).compiled_kind,
    'verified_manifest',
  );
});

test('HARDENING: no reachable value in the compiled form is a Map or a Set', () => {
  const compiledManifest = compiled();
  const seen = new Set();
  const offenders = [];
  const walk = (value, path) => {
    if (value === null || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    if (value instanceof Map) offenders.push(`${path} is a Map`);
    if (value instanceof Set) offenders.push(`${path} is a Set`);
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    for (const [key, entry] of Object.entries(value)) walk(entry, `${path}.${key}`);
  };
  walk(compiledManifest, 'compiled');
  assert.deepEqual(offenders, []);
  // the reviewed-product lookup must be prototype-safe
  assert.equal(Object.getPrototypeOf(compiledManifest.reviewed_products), null);
  assert.equal(Object.getPrototypeOf(compiledManifest), null);
  assert.equal(compiledManifest.reviewed_products.get('__proto__'), null);
  assert.equal(compiledManifest.reviewed_products.get('constructor'), null);
});

test('HARDENING: the compiled form is DEEPLY immutable and detached from its source', () => {
  const source = manifestOf(cotrimoxazole());
  const compiledManifest = compiled(source);

  // mutating the source after compilation must not reach the compiled form
  source.combinations[0].components[0].assertion_ingredient_ids.push(alias(7));
  source.combinations[0].presentations.pop();
  assert.equal(
    compiledManifest.combinations[0].components[0].assertion_ingredient_ids.length, 2,
  );
  assert.equal(compiledManifest.combinations[0].presentations.length, 2);

  // nested compiled structures must themselves be frozen
  assert.throws(() => {
    compiledManifest.combinations[0].components[0].assertion_ingredient_ids.push(alias(8));
  }, /read only|not extensible|object is not extensible/iu);
  assert.throws(() => { compiledManifest.combinations.push({}); }, /read only|not extensible/iu);
  assert.equal(Object.isFrozen(compiledManifest.combinations[0].presentations[0]), true);
  assert.equal(
    Object.isFrozen(compiledManifest.combinations[0].presentations[0].rxnorm_scd
      .ingredients_and_strengths[0]),
    true,
  );
  assert.equal(Object.isFrozen(compiledManifest.combinations[0].presentation_scopes[0]), true);
  assert.equal(Object.isFrozen(compiledManifest.combinations[0].rxnorm.component_relation), true);

  // the reviewed-product index must not be a mutable Map handed to callers
  assert.throws(
    () => compiledManifest.reviewed_products.set('presentation:pmbjp:99', {}),
    /not a function|read only|frozen/iu,
  );
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
    components: [{
      name: 'trimethoprim',
      rxcui: '10829',
      tty: 'IN',
      runtime_ingredient_id: TMP_ID,
      assertion_ingredient_ids: [TMP_ID],
    }],
  }, /requires at least two components/u);
});

test('a component may not claim an assertion identity another component claims', () => {
  rejects({
    components: [
      {
        name: 'sulfamethoxazole', rxcui: '10180', tty: 'IN',
        runtime_ingredient_id: SMX_ID, assertion_ingredient_ids: [SMX_ID],
      },
      {
        name: 'trimethoprim', rxcui: '10829', tty: 'IN',
        runtime_ingredient_id: SMX_ID, assertion_ingredient_ids: [SMX_ID],
      },
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

test('multiple reviewed source identities fail closed independent of source order', () => {
  for (const sources of [
    [
      { source: 'janaushadhi', source_id: '89', seen_at: '2026-07-07' },
      { source: 'janaushadhi', source_id: '90', seen_at: '2026-07-07' },
    ],
    [
      { source: 'janaushadhi', source_id: '90', seen_at: '2026-07-07' },
      { source: 'janaushadhi', source_id: '89', seen_at: '2026-07-07' },
    ],
  ]) {
    const result = resolve({ ...PMBJP_89, sources });
    assert.equal(result.status, 'ambiguous');
    assert.equal(result.runtime_subject, null);
    assert.equal(result.error, 'multiple_reviewed_combination_source_identities');
  }
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

test('the committed manifest records only the reviewed co-trimoxazole tablet identity', () => {
  const manifest = readJson('data-static/combination-identity-overrides.json');
  assert.equal(validateCombinationIdentityManifest(manifest), true);
  assert.equal(manifest.combinations.length, 1);
  const [combination] = manifest.combinations;
  assert.equal(
    combination.combination_id,
    'combination:co-trimoxazole:rxnorm-10831',
  );
  assert.deepEqual(
    combination.presentations.map((presentation) => presentation.source_identity.code),
    ['89', '90'],
  );
  assert.deepEqual(combination.allowed_profiles, ['internal-evaluation']);
  assert.equal(readJson('data-static/interaction-rules.json').rules.length, 0);
});

test('no component of co-trimoxazole is mapped in the single-ingredient manifest', () => {
  const drugs = readJson('data-static/ingredient-mapping-overrides.json')
    .mappings.map((m) => m.identity.runtime_drug);
  for (const forbidden of ['co-trimoxazole', 'trimethoprim', 'sulfamethoxazole']) {
    assert.equal(drugs.includes(forbidden), false, `${forbidden} must not be mapped`);
  }
});
