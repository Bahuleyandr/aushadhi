// Integration coverage for compile-time class-rule expansion (Option B):
// expansion promotions compile through the real attested draft pack, the
// digest-pinned member sets, and the unchanged exact-rule binding; every
// refusal mode fails the compile with a precise error; and the legacy
// exact-promotion path stays byte-identical.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  compileInteractionRuntimeArtifacts,
  compileInteractionRuntimePack,
  serializeInteractionRuntimePack,
  validatePromotionManifest,
} from '../src/lib/interaction-promotion.mjs';
import { technicalHoldsSha256 } from '../src/lib/interaction-checker.mjs';
import { ingredientIdForName } from '../src/lib/ingredient-identity.mjs';
import {
  expandDraftRulesDryRun,
} from '../src/cli/expand-interaction-draft-rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BATCH_1_RULE_IDS = [
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor',
  'atorvastatin__strong_cyp3a4_inhibitor',
  'simvastatin__gemfibrozil',
  'simvastatin__amiodarone',
  'simvastatin__verapamil_diltiazem',
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function inputs() {
  return {
    promotionManifest: readJson(
      'data-static/interaction-promotions.internal-evaluation.json',
    ),
    promotionHoldManifest: readJson(
      'data-static/interaction-promotion-holds.internal-evaluation.json',
    ),
    sourcePolicyBytes: fs.readFileSync(
      path.join(ROOT, 'data-static/interaction-sources.json'),
    ),
    draftPackBytes: fs.readFileSync(
      path.join(ROOT, 'docs/interaction-review/batch-01-v2/batch-01-v2.jsonl'),
    ),
    attestation: readJson(
      'docs/interaction-review/batch-01-v2/batch-01-v2.provenance.json',
    ),
    memberSetsBytes: fs.readFileSync(
      path.join(ROOT, 'data-static/interaction-member-sets.json'),
    ),
    ingredientManifest: readJson('data-static/ingredient-mapping-overrides.json'),
    presentationManifest: readJson('data-static/product-presentation-overrides.json'),
  };
}

function draftLine(source, ruleId) {
  const line = Buffer.from(source.draftPackBytes)
    .toString('utf8')
    .trimEnd()
    .split('\n')
    .find((entry) => JSON.parse(entry).rule_id === ruleId);
  assert.ok(line, `draft rule ${ruleId} must exist in the committed pack`);
  return line;
}

// The committed manifest (upgraded to schema_version 2) with the legacy
// warfarin__amiodarone entry swapped for an expansion promotion of the same
// exact draft rule: the expansion path must reproduce the legacy compiled
// rule exactly, under the expanded rule id, from the same reviewed mappings.
// The other committed promotions and both committed drift holds stay in
// place (the committed internal pack family pins its held scope, and the
// runtime pack validator rejects duplicate ingredient pairs, so the
// expansion replaces its legacy sibling rather than coexisting with it).
function warfarinExpansionInputs() {
  const source = inputs();
  const legacy = source.promotionManifest.promotions.find(
    (promotion) => promotion.rule_id === 'warfarin__amiodarone',
  );
  const expandedRuleId = 'warfarin__amiodarone::warfarin__amiodarone';
  source.promotionManifest.schema_version = 2;
  source.promotionManifest.promotions = source.promotionManifest.promotions.filter(
    (promotion) => promotion.rule_id !== 'warfarin__amiodarone',
  );
  source.promotionManifest.promotions.push({
    rule_id: expandedRuleId,
    draft_rule_sha256: legacy.draft_rule_sha256,
    expansion: {
      parent_rule_id: 'warfarin__amiodarone',
      object_member: 'warfarin',
      perpetrator_member: 'amiodarone',
    },
    approval: {
      ...structuredClone(legacy.approval),
      approved_rule_id: expandedRuleId,
      approval_text: `${legacy.approval.approval_text} This approval covers `
        + `the expanded exact rule ${expandedRuleId}.`,
    },
    scope: structuredClone(legacy.scope),
  });
  return source;
}

test('an expansion promotion of an exact draft rule compiles identically to the legacy path', () => {
  const source = warfarinExpansionInputs();
  assert.equal(validatePromotionManifest(source.promotionManifest), true);
  const compiled = compileInteractionRuntimeArtifacts(source);
  assert.equal(compiled.rulePack.rules.length, 6);
  const rule = compiled.rulePack.rules.find(
    (entry) => entry.rule_id === 'warfarin__amiodarone::warfarin__amiodarone',
  );

  const committed = readJson('data-static/interaction-rules.internal-evaluation.json');
  const legacyRule = committed.rules.find(
    (entry) => entry.rule_id === 'warfarin__amiodarone',
  );
  const expected = {
    ...structuredClone(legacyRule),
    rule_id: 'warfarin__amiodarone::warfarin__amiodarone',
  };
  assert.deepEqual(rule, expected);
  // Every other committed rule compiles untouched alongside the expansion.
  for (const committedRule of committed.rules) {
    if (committedRule.rule_id === 'warfarin__amiodarone') continue;
    assert.deepEqual(
      compiled.rulePack.rules.find(
        (entry) => entry.rule_id === committedRule.rule_id,
      ),
      committedRule,
    );
  }
  assert.equal(compiled.technicalHoldPack.holds.length, 2);
});

test('expansion compilation is deterministic across repeated runs', () => {
  const first = serializeInteractionRuntimePack(
    compileInteractionRuntimePack(warfarinExpansionInputs()),
  );
  const second = serializeInteractionRuntimePack(
    compileInteractionRuntimePack(warfarinExpansionInputs()),
  );
  assert.equal(first, second);
});

test('the committed legacy manifest still compiles byte-identically after the expansion capability', () => {
  const compiled = compileInteractionRuntimePack(inputs());
  const checkedIn = fs.readFileSync(
    path.join(ROOT, 'data-static/interaction-rules.internal-evaluation.json'),
    'utf8',
  );
  assert.equal(serializeInteractionRuntimePack(compiled), checkedIn);
});

// A class-side expansion compiled end-to-end: simvastatin × verapamil out of
// the class-perpetrator rule simvastatin__verapamil_diltiazem, using
// synthetic reviewed mappings for the two ingredients.
function syntheticReview(identifier) {
  return {
    status: 'reviewed',
    reviewer_id: 'clinician:test',
    reviewed_at: '2026-08-07',
    evidence: [{
      source_id: 'test-fixture',
      identifier,
      source_url: 'https://example.invalid/fixture',
      retrieved_at: '2026-08-07',
      evidence_sha256: sha256(`evidence:${identifier}`),
    }],
  };
}

function syntheticIngredientMapping(name, rxcui) {
  return {
    mapping_id: `ingredient:${name}:rxnorm-${rxcui}`,
    assertion: {
      ingredient_id: ingredientIdForName(name),
      canonical_name: name,
    },
    identity: {
      clinical_ingredient_id: ingredientIdForName(name),
      canonical_name: name,
      runtime_drug: name,
      relationship: 'exact',
      rxnorm: {
        rxcui,
        name,
        tty: 'IN',
        version: '06-Jul-2026',
        api_version: '3.1.354',
        response_sha256: sha256(`rxnorm:${name}`),
      },
      unii: null,
    },
    review: syntheticReview(`rxcui:${rxcui}`),
  };
}

function syntheticPresentationMapping(code, productSeed) {
  return {
    mapping_id: `presentation:testcat:${code}:oral-tablet`,
    product_id: `sha256:${sha256(`product:${productSeed}`)}`,
    product_assertion_sha256: sha256(`assertion:${productSeed}`),
    allowed_profiles: ['internal-evaluation'],
    presentation: { route: 'oral', formulation: 'tablet' },
    review: syntheticReview(`testcat:${code}`),
  };
}

function classExpansionInputs() {
  const source = inputs();
  const parentRuleId = 'simvastatin__verapamil_diltiazem';
  const expandedRuleId = `${parentRuleId}::simvastatin__verapamil`;
  source.ingredientManifest.mappings.push(
    syntheticIngredientMapping('simvastatin', '36567'),
    syntheticIngredientMapping('verapamil', '11170'),
  );
  source.presentationManifest.mappings.push(
    syntheticPresentationMapping('900001', 'simvastatin-tablet'),
    syntheticPresentationMapping('900002', 'verapamil-tablet'),
  );
  source.promotionManifest.schema_version = 2;
  source.promotionManifest.promotions.push({
    rule_id: expandedRuleId,
    draft_rule_sha256: sha256(draftLine(source, parentRuleId)),
    expansion: {
      parent_rule_id: parentRuleId,
      object_member: 'simvastatin',
      perpetrator_member: 'verapamil',
    },
    approval: {
      status: 'clinician_reviewed',
      reviewer_id: 'clinician:test',
      reviewed_at: '2026-08-07',
      approved_rule_id: expandedRuleId,
      approval_text: `I approve the expanded exact rule ${expandedRuleId} `
        + '(simvastatin with verapamil, oral tablets) for internal '
        + 'evaluation, as major severity with confirm-and-monitor '
        + 'management.',
      source_versions: [
        'openfda-labels:4724dbb4-3613-4e6a-948f-a43d34f97f06:29',
      ],
    },
    scope: {
      route: 'oral',
      formulation: 'tablet',
      expected_product_pair_count: 1,
      sides: [
        {
          draft_role: 'object',
          ingredient_mapping_id: 'ingredient:simvastatin:rxnorm-36567',
          presentation_mapping_ids: ['presentation:testcat:900001:oral-tablet'],
        },
        {
          draft_role: 'perpetrator',
          ingredient_mapping_id: 'ingredient:verapamil:rxnorm-11170',
          presentation_mapping_ids: ['presentation:testcat:900002:oral-tablet'],
        },
      ],
    },
  });
  return source;
}

test('a class-perpetrator draft rule compiles through expansion into an exact runtime rule', () => {
  const source = classExpansionInputs();
  assert.equal(validatePromotionManifest(source.promotionManifest), true);
  const compiled = compileInteractionRuntimePack(source);
  assert.equal(compiled.rules.length, 7);
  const rule = compiled.rules.find(
    (entry) => entry.rule_id === 'simvastatin__verapamil_diltiazem::simvastatin__verapamil',
  );
  assert.ok(rule, 'the expanded class rule must compile');
  assert.deepEqual(
    rule.pair,
    [ingredientIdForName('simvastatin'), ingredientIdForName('verapamil')].sort(),
  );
  assert.equal(rule.product_pairs.length, 1);
  assert.equal(rule.severity, 'major');
  assert.equal(rule.dispense_action, 'confirm_and_monitor');
  assert.deepEqual(rule.applicability.routes, [
    'oral tablet for both exact reviewed product assertions',
  ]);
  assert.equal(rule.evidence.length, 1);
  assert.equal(rule.evidence[0].source, 'openFDA drug label: simvastatin tablets');
  assert.equal(rule.evidence[0].document_id, '4724dbb4-3613-4e6a-948f-a43d34f97f06');
  assert.equal(rule.review.reviewer_id, 'clinician:test');
});

test('compiling the diltiazem member requires its own promotion entry', () => {
  // The verapamil promotion must not smuggle the sibling member in: the
  // expanded pair is bound to the entry's expansion block and mappings.
  const source = classExpansionInputs();
  source.promotionManifest.promotions.at(-1).expansion.perpetrator_member = 'diltiazem';
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /does not match the deterministic expansion id/u,
  );
});

function refusalInputs(parentRuleId, expansion, sourceVersions) {
  const source = inputs();
  const expandedRuleId = `${parentRuleId}::${expansion.object_member}__${
    expansion.perpetrator_member}`;
  source.promotionManifest.schema_version = 2;
  source.promotionManifest.promotions.push({
    rule_id: expandedRuleId,
    draft_rule_sha256: sha256(draftLine(source, parentRuleId)),
    expansion: { parent_rule_id: parentRuleId, ...expansion },
    approval: {
      status: 'clinician_reviewed',
      reviewer_id: 'clinician:test',
      reviewed_at: '2026-08-07',
      approved_rule_id: expandedRuleId,
      approval_text: `I approve the expanded exact rule ${expandedRuleId} `
        + 'for internal evaluation.',
      source_versions: sourceVersions,
    },
    scope: {
      route: 'oral',
      formulation: 'tablet',
      expected_product_pair_count: 1,
      sides: [
        {
          draft_role: 'object',
          ingredient_mapping_id: 'ingredient:placeholder:object',
          presentation_mapping_ids: ['presentation:placeholder:object'],
        },
        {
          draft_role: 'perpetrator',
          ingredient_mapping_id: 'ingredient:placeholder:perpetrator',
          presentation_mapping_ids: ['presentation:placeholder:perpetrator'],
        },
      ],
    },
  });
  return source;
}

const STATIN_CLASS_RULE_SOURCE_VERSIONS = [
  'openfda-labels:8f55d5de-5a4f-4a39-8c84-c53976dd6af9:11',
  'openfda-labels:df7ddf4f-d569-431e-81f1-9129d7043150:17',
  'openfda-labels:4724dbb4-3613-4e6a-948f-a43d34f97f06:29',
];

test('the erythromycin member-set divergence fails an expansion compile as a hard error', () => {
  const source = refusalInputs(
    'simvastatin_lovastatin__strong_cyp3a4_inhibitor',
    { object_member: 'simvastatin', perpetrator_member: 'erythromycin' },
    STATIN_CLASS_RULE_SOURCE_VERSIONS,
  );
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /refuses to expand simvastatin × erythromycin.*"erythromycin" is embedded in the rule roster but absent from pinned member set cyp3a4_inhibitor\[strong\]/u,
  );
});

test('an atorvastatin member the cited fragment does not name fails an expansion compile', () => {
  const source = refusalInputs(
    'atorvastatin__strong_cyp3a4_inhibitor',
    { object_member: 'atorvastatin', perpetrator_member: 'ketoconazole' },
    ['openfda-labels:40e6b63f-0a20-404a-8915-2f698877a96b:35'],
  );
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /refuses to expand atorvastatin × ketoconazole.*evidence does not name member/u,
  );
});

test('a draft rule with no reviewed route data cannot compile through expansion', () => {
  const source = refusalInputs(
    'simvastatin__gemfibrozil',
    { object_member: 'simvastatin', perpetrator_member: 'gemfibrozil' },
    ['openfda-labels:5c1c694c-4b08-469e-b538-08e69df06146:90400'],
  );
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /refuses to expand simvastatin × gemfibrozil.*no reviewed route data/u,
  );
});

test('an expansion of a drift-held parent rule cannot bypass the required promotion hold', () => {
  const source = inputs();
  const legacyTramadol = source.promotionManifest.promotions.find(
    (promotion) => promotion.rule_id === 'warfarin__tramadol',
  );
  const legacyAzithromycin = source.promotionManifest.promotions.find(
    (promotion) => promotion.rule_id === 'warfarin__azithromycin_oral',
  );
  const expandedRuleId = 'warfarin__azithromycin_oral::warfarin__azithromycin';
  source.promotionManifest = {
    schema_version: 2,
    profile: 'internal-evaluation',
    output_pack: source.promotionManifest.output_pack,
    promotions: [
      legacyTramadol,
      {
        rule_id: expandedRuleId,
        draft_rule_sha256: legacyAzithromycin.draft_rule_sha256,
        expansion: {
          parent_rule_id: 'warfarin__azithromycin_oral',
          object_member: 'warfarin',
          perpetrator_member: 'azithromycin',
        },
        approval: {
          ...legacyAzithromycin.approval,
          approved_rule_id: expandedRuleId,
          approval_text: `${legacyAzithromycin.approval.approval_text} This `
            + `approval covers the expanded exact rule ${expandedRuleId}.`,
        },
        scope: legacyAzithromycin.scope,
      },
    ],
  };
  const runtimeHolds = readJson(
    'data-static/interaction-promotion-holds.runtime.internal-evaluation.json',
  );
  const tramadolTechnicalHold = runtimeHolds.holds.find(
    (hold) => hold.rule_id === 'warfarin__tramadol',
  );
  source.promotionHoldManifest = {
    ...source.promotionHoldManifest,
    runtime_hold_scope_sha256: technicalHoldsSha256([tramadolTechnicalHold]),
    holds: source.promotionHoldManifest.holds.filter(
      (hold) => hold.rule_id === 'warfarin__tramadol',
    ),
  };
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /required promotion hold is missing or changed: warfarin__azithromycin_oral/u,
  );
});

test('an expansion sibling of a promoted-and-held parent rule is hard-refused', () => {
  // Adversarial-review probe (PR #14 Finding 1): the committed manifest
  // promotes warfarin__azithromycin_oral exactly, and its committed drift
  // hold attaches to that exact promotion — so the required-hold check is
  // satisfied and the hold-exclusion filter (keyed on compiled rule_id)
  // never reaches an expansion sibling's distinct expanded id. With a
  // synthetic reviewed azithromycin presentation carrying a different
  // product_id, the sibling's product pairs also escape the historically
  // held scope leaves. Pre-fix this compiled the expanded rule as ACTIVE,
  // citing the very evidence whose provenance drift the hold records. It
  // must hard-refuse instead: a held draft rule blocks all expansion
  // promotions of it.
  const source = inputs();
  const legacy = source.promotionManifest.promotions.find(
    (promotion) => promotion.rule_id === 'warfarin__azithromycin_oral',
  );
  const expandedRuleId = 'warfarin__azithromycin_oral::warfarin__azithromycin';
  source.presentationManifest.mappings.push(
    syntheticPresentationMapping('990001', 'probe-azithromycin-tablet'),
  );
  source.promotionManifest.schema_version = 2;
  source.promotionManifest.promotions.push({
    rule_id: expandedRuleId,
    draft_rule_sha256: legacy.draft_rule_sha256,
    expansion: {
      parent_rule_id: 'warfarin__azithromycin_oral',
      object_member: 'warfarin',
      perpetrator_member: 'azithromycin',
    },
    approval: {
      ...structuredClone(legacy.approval),
      approved_rule_id: expandedRuleId,
      approval_text: `${legacy.approval.approval_text} This approval covers `
        + `the expanded exact rule ${expandedRuleId}.`,
    },
    scope: {
      route: 'oral',
      formulation: 'tablet',
      expected_product_pair_count: 3,
      sides: [
        structuredClone(legacy.scope.sides[0]),
        {
          draft_role: 'perpetrator',
          ingredient_mapping_id: 'ingredient:azithromycin:rxnorm-18631',
          presentation_mapping_ids: ['presentation:testcat:990001:oral-tablet'],
        },
      ],
    },
  });
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /warfarin__azithromycin_oral::warfarin__azithromycin expands drift-held draft rule warfarin__azithromycin_oral/u,
  );
});

test('a schema_version 1 manifest rejects expansion entries', () => {
  const source = warfarinExpansionInputs();
  source.promotionManifest.schema_version = 1;
  assert.throws(
    () => validatePromotionManifest(source.promotionManifest),
    /contains unknown property expansion/u,
  );
});

test('an expansion approval must reference the expanded rule id', () => {
  const source = warfarinExpansionInputs();
  const promotion = source.promotionManifest.promotions.at(-1);
  promotion.approval.approval_text = promotion.approval.approval_text.replaceAll(
    promotion.rule_id,
    'warfarin__amiodarone',
  );
  assert.throws(
    () => validatePromotionManifest(source.promotionManifest),
    /expansion approval text must reference the expanded rule id/u,
  );
});

test('an expansion approval must not satisfy a shorter sibling by prefix', () => {
  const source = warfarinExpansionInputs();
  const promotion = source.promotionManifest.promotions.at(-1);
  promotion.approval.approval_text = `I approve the expanded exact rule ${
    promotion.rule_id
  }_extra only.`;
  assert.throws(
    () => validatePromotionManifest(source.promotionManifest),
    /expansion approval text must reference the expanded rule id/u,
  );
});

test('an expansion approval subject must exactly equal the expanded rule id', () => {
  const source = warfarinExpansionInputs();
  const promotion = source.promotionManifest.promotions.at(-1);
  promotion.approval.approved_rule_id = `${promotion.rule_id}_extra`;
  assert.throws(
    () => validatePromotionManifest(source.promotionManifest),
    /approved_rule_id must exactly match expanded rule_id/u,
  );
});

test('an expansion must not shadow a draft rule that already exists in the pack', () => {
  const source = warfarinExpansionInputs();
  const promotion = source.promotionManifest.promotions.at(-1);
  // Repoint the expanded id at a real (unpromoted) pack rule id while
  // keeping the expansion block: the compiler must refuse the shadowing.
  promotion.rule_id = 'simvastatin__gemfibrozil';
  promotion.approval.approved_rule_id = promotion.rule_id;
  promotion.approval.approval_text = `${promotion.approval.approval_text} `
    + 'This approval covers the expanded exact rule simvastatin__gemfibrozil.';
  assert.throws(
    () => compileInteractionRuntimePack(source),
    /expansion must not shadow a draft rule with the same rule_id/u,
  );
});

// ── Batch-1 dry-run integration against the real attested pack ────────────

function batch1DryRun() {
  return expandDraftRulesDryRun({
    packPath: path.join(
      ROOT, 'docs/interaction-review/batch-01-v2/batch-01-v2.jsonl',
    ),
    memberSetsPath: path.join(ROOT, 'data-static/interaction-member-sets.json'),
    attestationPath: path.join(
      ROOT, 'docs/interaction-review/batch-01-v2/batch-01-v2.provenance.json',
    ),
    ruleIds: BATCH_1_RULE_IDS,
  });
}

test('the batch-1 dry run expands the statin rules to the expected exact set', () => {
  const report = batch1DryRun();
  assert.deepEqual(report.totals, { rules: 5, expansions: 23, refusals: 19 });

  const byId = new Map(report.rules.map((entry) => [entry.rule_id, entry]));

  const statins = byId.get('simvastatin_lovastatin__strong_cyp3a4_inhibitor');
  const namedPerpetrators = [
    'boceprevir', 'clarithromycin', 'itraconazole', 'ketoconazole',
    'nefazodone', 'posaconazole', 'telaprevir', 'telithromycin',
    'voriconazole',
  ];
  assert.deepEqual(
    statins.expansions.map((entry) => entry.expanded_rule_id),
    ['lovastatin', 'simvastatin'].flatMap((objectMember) => (
      namedPerpetrators.map((perpetrator) => (
        `simvastatin_lovastatin__strong_cyp3a4_inhibitor::${objectMember}__${perpetrator}`
      ))
    )),
  );
  const unnamed = statins.refusals
    .filter((entry) => entry.reason === 'evidence_does_not_name_member')
    .map((entry) => entry.member);
  assert.deepEqual(unnamed, [
    'conivaptan', 'idelalisib', 'indinavir', 'nelfinavir', 'saquinavir',
    'troleandomycin',
  ]);

  const atorvastatin = byId.get('atorvastatin__strong_cyp3a4_inhibitor');
  assert.deepEqual(
    atorvastatin.expansions.map((entry) => entry.expanded_rule_id),
    [
      'atorvastatin__strong_cyp3a4_inhibitor::atorvastatin__clarithromycin',
      'atorvastatin__strong_cyp3a4_inhibitor::atorvastatin__itraconazole',
    ],
  );
  assert.equal(atorvastatin.refusals.length, 10);
  assert.ok(atorvastatin.refusals.every(
    (entry) => entry.reason === 'evidence_does_not_name_member',
  ));

  const amiodarone = byId.get('simvastatin__amiodarone');
  assert.deepEqual(amiodarone.refusals, []);
  assert.deepEqual(
    amiodarone.expansions.map((entry) => entry.expanded_rule_id),
    ['simvastatin__amiodarone::simvastatin__amiodarone'],
  );

  const nonDhpCcb = byId.get('simvastatin__verapamil_diltiazem');
  assert.deepEqual(nonDhpCcb.refusals, []);
  assert.deepEqual(
    nonDhpCcb.expansions.map((entry) => entry.expanded_rule_id),
    [
      'simvastatin__verapamil_diltiazem::simvastatin__diltiazem',
      'simvastatin__verapamil_diltiazem::simvastatin__verapamil',
    ],
  );
});

test('the batch-1 dry run surfaces the two flagged refusals as precise hard errors', () => {
  const report = batch1DryRun();
  const byId = new Map(report.rules.map((entry) => [entry.rule_id, entry]));

  const erythromycin = byId
    .get('simvastatin_lovastatin__strong_cyp3a4_inhibitor')
    .refusals
    .find((entry) => entry.member === 'erythromycin');
  assert.equal(erythromycin.reason, 'member_not_in_pinned_member_set');
  assert.equal(erythromycin.side, 'perpetrator');
  assert.match(
    erythromycin.message,
    /"erythromycin" is embedded in the rule roster but absent from pinned member set cyp3a4_inhibitor\[strong\]/u,
  );
  assert.match(erythromycin.message, /through the draft flow/u);

  const ketoconazole = byId
    .get('atorvastatin__strong_cyp3a4_inhibitor')
    .refusals
    .find((entry) => entry.member === 'ketoconazole');
  assert.equal(ketoconazole.reason, 'evidence_does_not_name_member');
  assert.match(ketoconazole.message, /evidence does not name member/u);
  assert.match(ketoconazole.message, /"ketoconazole"/u);
});

test('the batch-1 dry run refuses the route-less exact rows instead of guessing scope', () => {
  const report = batch1DryRun();
  const gemfibrozil = report.rules.find(
    (entry) => entry.rule_id === 'simvastatin__gemfibrozil',
  );
  assert.equal(gemfibrozil.expandable, false);
  assert.deepEqual(gemfibrozil.expansions, []);
  assert.deepEqual(
    gemfibrozil.refusals.map((entry) => [entry.side, entry.reason]),
    [
      ['object', 'missing_route_data'],
      ['perpetrator', 'missing_route_data'],
    ],
  );
});

test('the dry-run report is deterministic and byte-stable', () => {
  const first = JSON.stringify(batch1DryRun(), null, 2);
  const second = JSON.stringify(batch1DryRun(), null, 2);
  assert.equal(first, second);
  assert.match(first, /"authority": "none — dry-run report only/u);
});

// ── Full-pack blast-radius expectation ─────────────────────────────────────
//
// Runs the expansion dry run over EVERY rule in the attested pack and pins
// three things: the exact totals, the complete refusal-reason histogram, and
// the exact sorted identity of every expanded candidate id. Any change to
// expansion normalization (or to the pack/member sets) that adds, removes,
// or SWAPS even one expansion candidate anywhere in the pack fails this
// test, as does any shift in the refusal totals or per-reason counts — so
// the full blast radius of such a change must be read, disclosed, and
// re-pinned here. Precise limit of the pin: refusal identities are pinned
// only at reason-histogram granularity, so a refusal trading places with
// another refusal of the same reason is not caught; candidate identities
// are pinned exactly.
//
// The identity pin exists because the count-only version of this test was
// demonstrated (PR #15 follow-up review) to stay green under a naming-gate
// tweak that swapped one candidate for another (warfarin__fluoroquinolone:
// ciprofloxacin out, levofloxacin in) while totals, histogram, and id
// uniqueness all held.
//
// Verified full-pack delta of the strength:[] normalization (PR #15), base
// 32726b8 → this revision: 20 rules change behaviorally, 166 → 185
// expansions (19 new candidates across 10 rules, including warfarin,
// dabigatran, clopidogrel, and enoxaparin pairs), 1589 → 1736 refusals;
// every removed refusal was an ambiguous_member_set_strength entry.
// Candidates counted here have NO authority: each still requires reviewed
// mappings and a signed approved_rule_id approval before promotion.
//
// The dry-run report is deterministic and byte-stable (pinned above), so
// this literal id list is stable across runs; when it legitimately moves,
// the diff of this array IS the reviewable candidate-level blast radius.
const PINNED_EXPANDED_RULE_IDS = [
  'acei__arb_dual_raas_blockade::ramipril__telmisartan',
  'adenosine__dipyridamole::adenosine__dipyridamole',
  'apixaban__strong_cyp3a4_pgp_inducer::apixaban__carbamazepine',
  'apixaban__strong_cyp3a4_pgp_inducer::apixaban__phenytoin',
  'apixaban__strong_cyp3a4_pgp_inhibitor::apixaban__itraconazole',
  'apixaban__strong_cyp3a4_pgp_inhibitor::apixaban__ketoconazole',
  'apixaban__strong_cyp3a4_pgp_inhibitor::apixaban__ritonavir',
  'aspirin__ibuprofen_additive_gi_bleeding::aspirin__ibuprofen',
  'atazanavir__h2_receptor_antagonist::atazanavir__famotidine',
  'atorvastatin__strong_cyp3a4_inhibitor::atorvastatin__clarithromycin',
  'atorvastatin__strong_cyp3a4_inhibitor::atorvastatin__itraconazole',
  'bupropion__linezolid_directional::bupropion__linezolid',
  'carbamazepine__calcineurin_inhibitor::tacrolimus__carbamazepine',
  'carbamazepine__lamotrigine::lamotrigine__carbamazepine',
  'carbamazepine__sulfonylurea::glimepiride__carbamazepine',
  'carbamazepine__verapamil::carbamazepine__verapamil',
  'carbamazepine__warfarin::warfarin__carbamazepine',
  'clopidogrel__cyp2c19_inhibiting_ppi::clopidogrel__esomeprazole',
  'clopidogrel__cyp2c19_inhibiting_ppi::clopidogrel__omeprazole',
  'dabigatran_nvaf__dronedarone_or_ketoconazole::dabigatran__dronedarone',
  'dabigatran_nvaf__dronedarone_or_ketoconazole::dabigatran__ketoconazole',
  'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor::dabigatran__amiodarone',
  'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor::dabigatran__clarithromycin',
  'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor::dabigatran__quinidine',
  'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor::dabigatran__verapamil',
  'dasatinib__h2_receptor_antagonist::dasatinib__famotidine',
  'dasatinib__proton_pump_inhibitor::dasatinib__omeprazole',
  'digoxin__amiodarone::digoxin__amiodarone',
  'digoxin__clarithromycin::digoxin__clarithromycin',
  'digoxin__diltiazem::digoxin__diltiazem',
  'digoxin__dronedarone::digoxin__dronedarone',
  'digoxin__verapamil::digoxin__verapamil',
  'doxycycline__polyvalent_cation::doxycycline__calcium',
  'doxycycline__polyvalent_cation::doxycycline__iron',
  'doxycycline__polyvalent_cation::doxycycline__magnesium',
  'enzyme_inducing_antiepileptic__hormonal_contraceptive::etonogestrel_implant__carbamazepine',
  'erlotinib__h2_receptor_antagonist::erlotinib__ranitidine',
  'erlotinib__proton_pump_inhibitor::erlotinib__omeprazole',
  'gentamicin__furosemide::gentamicin__furosemide',
  'heparin_lmwh__nsaid_or_antiplatelet_bleeding::enoxaparin__ketorolac',
  'ibandronate__oral_cation_food::ibandronate__calcium',
  'ibandronate__oral_cation_food::ibandronate__iron',
  'ibandronate__oral_cation_food::ibandronate__magnesium',
  'itraconazole_tolsura__acid_reducer::itraconazole__omeprazole',
  'ivabradine__moderate_cyp3a4_inhibitor::ivabradine__diltiazem',
  'ivabradine__moderate_cyp3a4_inhibitor::ivabradine__grapefruit_juice',
  'ivabradine__moderate_cyp3a4_inhibitor::ivabradine__verapamil',
  'ketoconazole_oral__acid_suppressant::ketoconazole__omeprazole',
  'levofloxacin__polyvalent_cation::levofloxacin__iron',
  'levofloxacin__polyvalent_cation::levofloxacin__magnesium',
  'levofloxacin__polyvalent_cation::levofloxacin__sucralfate',
  'levofloxacin__polyvalent_cation::levofloxacin__zinc',
  'levothyroxine__acid_suppressant::levothyroxine__omeprazole',
  'levothyroxine__oral_cation_binder::levothyroxine__calcium',
  'levothyroxine__oral_cation_binder::levothyroxine__calcium_carbonate',
  'levothyroxine__oral_cation_binder::levothyroxine__ferrous_sulfate',
  'levothyroxine__oral_cation_binder::levothyroxine__sevelamer',
  'linezolid__serotonergic_agent::linezolid__buspirone',
  'lithium__acei_arb::lithium__captopril',
  'lithium__acei_arb::lithium__enalapril',
  'lithium__acei_arb::lithium__losartan',
  'lithium__nsaid_systemic::lithium__celecoxib',
  'lithium__nsaid_systemic::lithium__indomethacin',
  'lithium__nsaid_systemic::lithium__piroxicam',
  'lithium__thiazide_diuretic::lithium__hydrochlorothiazide',
  'methotrexate_high_dose__ppi::methotrexate__esomeprazole',
  'methotrexate_high_dose__ppi::methotrexate__omeprazole',
  'methotrexate_high_dose__ppi::methotrexate__pantoprazole',
  'methylergonovine__moderate_cyp3a4_inhibitor::methylergonovine__fluconazole',
  'moxifloxacin__polyvalent_cation::moxifloxacin__iron',
  'moxifloxacin__polyvalent_cation::moxifloxacin__magnesium',
  'moxifloxacin__polyvalent_cation::moxifloxacin__sucralfate',
  'moxifloxacin__polyvalent_cation::moxifloxacin__zinc',
  'ondansetron__apomorphine::ondansetron__apomorphine',
  'oral_midazolam__potent_cyp3a4_inhibitor::midazolam__itraconazole',
  'oral_midazolam__potent_cyp3a4_inhibitor::midazolam__ketoconazole',
  'parenteral_midazolam__potent_cyp3a4_inhibitor::midazolam__itraconazole',
  'parenteral_midazolam__potent_cyp3a4_inhibitor::midazolam__ketoconazole',
  'phenytoin__etonogestrel_implant::etonogestrel_implant__phenytoin',
  'potassium_chloride_solid_oral__gi_transit_slowing::potassium_chloride__atropine',
  'potassium_chloride_solid_oral__gi_transit_slowing::potassium_chloride__oxybutynin',
  'qt_macrolide__qt_prolonging_drug::azithromycin__amiodarone',
  'qt_macrolide__qt_prolonging_drug::azithromycin__clarithromycin',
  'qt_macrolide__qt_prolonging_drug::azithromycin__dofetilide',
  'qt_macrolide__qt_prolonging_drug::azithromycin__erythromycin',
  'qt_macrolide__qt_prolonging_drug::azithromycin__procainamide',
  'qt_macrolide__qt_prolonging_drug::azithromycin__quinidine',
  'qt_macrolide__qt_prolonging_drug::azithromycin__sotalol',
  'qt_macrolide__qt_prolonging_drug::clarithromycin__amiodarone',
  'qt_macrolide__qt_prolonging_drug::clarithromycin__dofetilide',
  'qt_macrolide__qt_prolonging_drug::clarithromycin__erythromycin',
  'qt_macrolide__qt_prolonging_drug::clarithromycin__procainamide',
  'qt_macrolide__qt_prolonging_drug::clarithromycin__quinidine',
  'qt_macrolide__qt_prolonging_drug::clarithromycin__sotalol',
  'qt_macrolide__qt_prolonging_drug::erythromycin__amiodarone',
  'qt_macrolide__qt_prolonging_drug::erythromycin__clarithromycin',
  'qt_macrolide__qt_prolonging_drug::erythromycin__dofetilide',
  'qt_macrolide__qt_prolonging_drug::erythromycin__procainamide',
  'qt_macrolide__qt_prolonging_drug::erythromycin__quinidine',
  'qt_macrolide__qt_prolonging_drug::erythromycin__sotalol',
  'ranolazine__moderate_cyp3a4_inhibitor::ranolazine__diltiazem',
  'ranolazine__moderate_cyp3a4_inhibitor::ranolazine__erythromycin',
  'ranolazine__moderate_cyp3a4_inhibitor::ranolazine__fluconazole',
  'ranolazine__moderate_cyp3a4_inhibitor::ranolazine__grapefruit_juice',
  'ranolazine__moderate_cyp3a4_inhibitor::ranolazine__verapamil',
  'rifabutin__etonogestrel_implant::etonogestrel_implant__rifabutin',
  'rifampicin__hormonal_contraceptive::etonogestrel_implant__rifampicin',
  'rilpivirine__proton_pump_inhibitor::rilpivirine__esomeprazole',
  'rilpivirine__proton_pump_inhibitor::rilpivirine__lansoprazole',
  'rilpivirine__proton_pump_inhibitor::rilpivirine__omeprazole',
  'rilpivirine__proton_pump_inhibitor::rilpivirine__pantoprazole',
  'rilpivirine__proton_pump_inhibitor::rilpivirine__rabeprazole',
  'rivaroxaban__strong_cyp3a4_pgp_inducer::rivaroxaban__carbamazepine',
  'rivaroxaban__strong_cyp3a4_pgp_inducer::rivaroxaban__phenytoin',
  'rivaroxaban__strong_cyp3a4_pgp_inhibitor::rivaroxaban__ketoconazole',
  'rivaroxaban__strong_cyp3a4_pgp_inhibitor::rivaroxaban__ritonavir',
  'sedating_antihistamine__cns_depressant::diphenhydramine__alcohol',
  'sedating_antihistamine__cns_depressant::promethazine__alcohol',
  'simvastatin__amiodarone::simvastatin__amiodarone',
  'simvastatin__amlodipine::simvastatin__amlodipine',
  'simvastatin__verapamil_diltiazem::simvastatin__diltiazem',
  'simvastatin__verapamil_diltiazem::simvastatin__verapamil',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::lovastatin__boceprevir',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::lovastatin__clarithromycin',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::lovastatin__itraconazole',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::lovastatin__ketoconazole',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::lovastatin__nefazodone',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::lovastatin__posaconazole',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::lovastatin__telaprevir',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::lovastatin__telithromycin',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::lovastatin__voriconazole',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::simvastatin__boceprevir',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::simvastatin__clarithromycin',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::simvastatin__itraconazole',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::simvastatin__ketoconazole',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::simvastatin__nefazodone',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::simvastatin__posaconazole',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::simvastatin__telaprevir',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::simvastatin__telithromycin',
  'simvastatin_lovastatin__strong_cyp3a4_inhibitor::simvastatin__voriconazole',
  'sirolimus__erythromycin::sirolimus__erythromycin',
  'sulfonylurea__fluconazole::glipizide__fluconazole',
  'sulfonylurea__fluconazole::glyburide__fluconazole',
  'sulfonylurea__fluconazole::tolbutamide__fluconazole',
  'sulfonylurea__gemfibrozil::glyburide__gemfibrozil',
  'tadalafil_pah__ritonavir_sequence::tadalafil__ritonavir',
  'tadalafil_pah__strong_cyp3a4_inhibitor::tadalafil__itraconazole',
  'tadalafil_pah__strong_cyp3a4_inhibitor::tadalafil__ketoconazole',
  'theophylline__cimetidine::theophylline__cimetidine',
  'theophylline__ciprofloxacin::theophylline__ciprofloxacin',
  'theophylline__fluvoxamine::theophylline__fluvoxamine',
  'theophylline__mexiletine::theophylline__mexiletine',
  'thiopurine__allopurinol::azathioprine__allopurinol',
  'thiopurine__allopurinol::mercaptopurine__allopurinol',
  'tramadol__linezolid::tramadol__linezolid',
  'warfarin__amiodarone::warfarin__amiodarone',
  'warfarin__aspirin_analgesic_antiplatelet::warfarin__aspirin',
  'warfarin__azithromycin_oral::warfarin__azithromycin',
  'warfarin__fluconazole::warfarin__fluconazole',
  'warfarin__fluoroquinolone::warfarin__ciprofloxacin',
  'warfarin__ketoconazole_oral::warfarin__ketoconazole',
  'warfarin__metronidazole::warfarin__metronidazole',
  'warfarin__miconazole_oromucosal_gel::warfarin__miconazole',
  'warfarin__ssri_snri::warfarin__sertraline',
  'warfarin__tramadol::warfarin__tramadol',
  'warfarin__voriconazole::warfarin__voriconazole',
  'ziprasidone__qt_prolonging_drug::ziprasidone__arsenic_trioxide',
  'ziprasidone__qt_prolonging_drug::ziprasidone__chlorpromazine',
  'ziprasidone__qt_prolonging_drug::ziprasidone__dofetilide',
  'ziprasidone__qt_prolonging_drug::ziprasidone__dolasetron',
  'ziprasidone__qt_prolonging_drug::ziprasidone__droperidol',
  'ziprasidone__qt_prolonging_drug::ziprasidone__gatifloxacin',
  'ziprasidone__qt_prolonging_drug::ziprasidone__halofantrine',
  'ziprasidone__qt_prolonging_drug::ziprasidone__levomethadyl_acetate',
  'ziprasidone__qt_prolonging_drug::ziprasidone__mefloquine',
  'ziprasidone__qt_prolonging_drug::ziprasidone__mesoridazine',
  'ziprasidone__qt_prolonging_drug::ziprasidone__moxifloxacin',
  'ziprasidone__qt_prolonging_drug::ziprasidone__pentamidine',
  'ziprasidone__qt_prolonging_drug::ziprasidone__pimozide',
  'ziprasidone__qt_prolonging_drug::ziprasidone__probucol',
  'ziprasidone__qt_prolonging_drug::ziprasidone__quinidine',
  'ziprasidone__qt_prolonging_drug::ziprasidone__sotalol',
  'ziprasidone__qt_prolonging_drug::ziprasidone__sparfloxacin',
  'ziprasidone__qt_prolonging_drug::ziprasidone__tacrolimus',
  'ziprasidone__qt_prolonging_drug::ziprasidone__thioridazine',
];

test('the full-pack dry run matches the pinned expansion blast radius', () => {
  const packPath = path.join(
    ROOT, 'docs/interaction-review/batch-01-v2/batch-01-v2.jsonl',
  );
  const allRuleIds = fs.readFileSync(packPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line).rule_id);
  assert.equal(allRuleIds.length, new Set(allRuleIds).size);

  const report = expandDraftRulesDryRun({
    packPath,
    memberSetsPath: path.join(ROOT, 'data-static/interaction-member-sets.json'),
    attestationPath: path.join(
      ROOT, 'docs/interaction-review/batch-01-v2/batch-01-v2.provenance.json',
    ),
    ruleIds: allRuleIds,
  });

  assert.deepEqual(report.totals, {
    rules: 199,
    expansions: 185,
    refusals: 1736,
  });

  const reasonCounts = {};
  for (const rule of report.rules) {
    for (const refusal of rule.refusals) {
      reasonCounts[refusal.reason] = (reasonCounts[refusal.reason] ?? 0) + 1;
    }
  }
  assert.deepEqual(reasonCounts, {
    ambiguous_member_set_strength: 8,
    empty_roster_after_exceptions: 7,
    evidence_does_not_name_member: 1313,
    member_exception_not_in_pinned_member_set: 4,
    member_identity_not_canonical: 2,
    member_not_in_pinned_member_set: 55,
    missing_route_data: 5,
    pinned_member_unaccounted: 304,
    self_pair: 9,
    unknown_member_set: 23,
    unsupported_selector: 6,
  });

  const expandedIds = report.rules.flatMap(
    (rule) => rule.expansions.map((entry) => entry.expanded_rule_id),
  );
  assert.equal(expandedIds.length, 185);
  assert.equal(new Set(expandedIds).size, 185);
  assert.deepEqual([...expandedIds].sort(), PINNED_EXPANDED_RULE_IDS);
});
