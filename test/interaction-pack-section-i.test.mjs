import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkInteractions } from '../src/lib/interaction-engine.mjs';
import { validateDraftRules } from '../src/lib/interaction-draft-validation.mjs';
import {
  assertEvidenceAllowed,
  loadSourceManifest,
} from '../src/lib/interaction-source-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECTION_PATH = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'sections',
  'I.verified.jsonl',
);
const CITATIONS_PATH = path.join(
  ROOT,
  'docs',
  'interaction-review',
  '2026-07-23-section-I-citations.md',
);
const RECONCILED_PATH = path.join(
  ROOT,
  'docs',
  'interaction-review',
  '2026-07-23-section-I-reconciled.md',
);
const RULES = fs.readFileSync(SECTION_PATH, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const MEMBERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data-static', 'interaction-member-sets.json'), 'utf8'),
).classes;
const OPENFDA_CACHE = process.env.AUSHADHI_OPENFDA_CACHE;

function compactLabelText(value) {
  return value.replace(/[\s\u00ad]/gu, '');
}

function payloadValueAtPath(payload, sourcePath) {
  let value = payload;
  for (const match of sourcePath.matchAll(/([a-zA-Z0-9_]+)|\[(\d+)\]/gu)) {
    value = value[match[1] ?? Number(match[2])];
  }
  return value;
}

function fire(subjects, jurisdiction = 'US') {
  return checkInteractions({
    subjects,
    rules: RULES,
    memberSets: MEMBERS,
    patientContext: { jurisdiction },
  }).findings;
}

function concreteFormulation(formulations = []) {
  for (const formulation of formulations) {
    if (formulation === 'immediate_release') return 'immediate_release_tablet';
    if (formulation === 'delayed_release') return 'delayed_release_tablet';
    if (![
      'extended_release',
      'fixed_dose_combination',
      'oral',
      'solid_modified_release',
      'solid_oral',
    ].includes(formulation)) {
      return formulation;
    }
  }
  return undefined;
}

function scopedFire(subjects, ruleId, jurisdiction = 'US') {
  const rule = RULES.find((candidate) => candidate.rule_id === ruleId);
  assert.ok(rule, `${ruleId} missing`);
  const refs = [
    rule.object,
    rule.perpetrator ?? rule.second_subject ?? rule.coadministered_with,
  ];
  const structuredSubjects = subjects.map((drug, index) => {
    const ref = refs[index] ?? {};
    const route = ref.route?.find((candidate) => !['systemic', 'parenteral'].includes(candidate));
    const formulation = concreteFormulation(ref.formulation);
    return {
      drug,
      ...(route === undefined ? {} : { route }),
      ...(formulation === undefined ? {} : { formulation }),
    };
  });
  return checkInteractions({
    subjects: structuredSubjects,
    rules: RULES,
    memberSets: MEMBERS,
    patientContext: {
      ...(rule.applicability.jurisdiction.length === 0 ? {} : { jurisdiction }),
      ...(rule.applicability.indication?.[0] === undefined
        ? {}
        : { indication: rule.applicability.indication[0] }),
    },
  }).findings;
}

function one(subjects, ruleId) {
  const findings = scopedFire(subjects, ruleId)
    .filter((finding) => finding.rule_id === ruleId);
  assert.equal(
    findings.length,
    1,
    `${subjects.join('+')} expected one ${ruleId}, got ${JSON.stringify(findings.map((f) => f.rule_id))}`,
  );
  return findings[0];
}

function ids(subjects) {
  return fire(subjects).map((finding) => finding.rule_id).sort();
}

const EXPECTED_IDS = [
  'ciprofloxacin__polyvalent_cation',
  'levofloxacin__polyvalent_cation',
  'moxifloxacin__polyvalent_cation',
  'doxycycline__polyvalent_cation',
  'levothyroxine__oral_cation_binder',
  'levothyroxine__acid_suppressant',
  'alendronate__oral_cation_food',
  'risedronate_immediate_release__oral_cation_food',
  'risedronate_delayed_release__oral_cation_food',
  'ibandronate__oral_cation_food',
  'atazanavir__proton_pump_inhibitor',
  'atazanavir__h2_receptor_antagonist',
  'atazanavir__antacid_buffered_product',
  'rilpivirine__proton_pump_inhibitor',
  'erlotinib__proton_pump_inhibitor',
  'erlotinib__h2_receptor_antagonist',
  'erlotinib__antacid',
  'dasatinib__proton_pump_inhibitor',
  'dasatinib__h2_receptor_antagonist',
  'dasatinib_sprycel__antacid',
  'dasatinib_phyrago__antacid',
  'ketoconazole_oral__acid_suppressant',
  'itraconazole_capsule__acid_suppressant',
  'itraconazole_tolsura__acid_reducer',
].sort();

const PPI_MEMBERS = [
  'omeprazole',
  'esomeprazole',
  'lansoprazole',
  'pantoprazole',
  'rabeprazole',
  'dexlansoprazole',
];
const H2_MEMBERS = ['famotidine', 'cimetidine', 'ranitidine', 'nizatidine'];
const ANTACID_MEMBERS = [
  'calcium carbonate',
  'magnesium hydroxide',
  'aluminium hydroxide',
  'sodium bicarbonate',
];
const BISPHOSPHONATE_CATION_MEMBERS = [
  'calcium carbonate',
  'calcium',
  'ferrous sulfate',
  'iron',
  'magnesium',
  'magnesium hydroxide',
  'aluminium hydroxide',
];

const EXPECTED_RUNTIME = {
  ciprofloxacin__polyvalent_cation: [true, false, false, false],
  levofloxacin__polyvalent_cation: [true, false, false, false],
  moxifloxacin__polyvalent_cation: [true, false, false, false],
  doxycycline__polyvalent_cation: [true, false, false, false],
  levothyroxine__oral_cation_binder: [true, false, false, false],
  levothyroxine__acid_suppressant: [true, false, false, false],
  alendronate__oral_cation_food: [true, false, false, false],
  risedronate_immediate_release__oral_cation_food: [true, false, false, false],
  risedronate_delayed_release__oral_cation_food: [true, false, false, false],
  ibandronate__oral_cation_food: [true, false, false, false],
  atazanavir__proton_pump_inhibitor: [true, false, false, false],
  atazanavir__h2_receptor_antagonist: [true, false, false, false],
  atazanavir__antacid_buffered_product: [true, false, false, false],
  rilpivirine__proton_pump_inhibitor: [true, false, false, false],
  erlotinib__proton_pump_inhibitor: [true, false, false, false],
  erlotinib__h2_receptor_antagonist: [true, false, false, false],
  erlotinib__antacid: [true, false, false, false],
  dasatinib__proton_pump_inhibitor: [true, false, false, false],
  dasatinib__h2_receptor_antagonist: [true, false, false, false],
  dasatinib_sprycel__antacid: [false, false, false, false],
  dasatinib_phyrago__antacid: [false, false, false, false],
  ketoconazole_oral__acid_suppressant: [true, false, false, false],
  itraconazole_capsule__acid_suppressant: [true, false, false, false],
  itraconazole_tolsura__acid_reducer: [false, false, false, false],
};

const EXPECTED_TIMING = {
  ciprofloxacin__polyvalent_cation:
    'Take oral ciprofloxacin at least 2 hours before or 6 hours after the named multivalent-cation product.',
  levofloxacin__polyvalent_cation:
    'Take oral levofloxacin at least 2 hours before or 2 hours after the named chelation agent.',
  moxifloxacin__polyvalent_cation:
    'Take oral moxifloxacin at least 4 hours before or 8 hours after the named magnesium-, aluminum-, iron-, zinc-, sucralfate-, or multivitamin-containing product.',
  doxycycline__polyvalent_cation:
    'No separation interval or spacing action is supported by the retained evidence.',
  levothyroxine__oral_cation_binder:
    'Use the applicable formulation label: selected labels separate named calcium, iron and phosphate-binder products by at least 4 hours; sucralfate and antacid entries require product-specific review rather than one universal binder interval.',
  levothyroxine__acid_suppressant: null,
  alendronate__oral_cation_food:
    'Take FOSAMAX at least 30 minutes before the first food, beverage, or oral medication with plain water only; wait at least 30 minutes before another oral medicine.',
  risedronate_immediate_release__oral_cation_food:
    'Take ACTONEL at least 30 minutes before first food or drink other than water and before oral medicines; take named cation products at a different time of day.',
  risedronate_delayed_release__oral_cation_food:
    'Take ATELVIA in the morning immediately after breakfast; take named cation products at a different time of day.',
  ibandronate__oral_cation_food:
    'Take oral ibandronate at least 60 minutes before first food or drink other than water and before oral medicines; wait at least 60 minutes after dosing before another oral medicine.',
  atazanavir__proton_pump_inhibitor:
    'Treatment-naive adults taking REYATAZ 300 mg plus ritonavir 100 mg may use no more than an omeprazole-20-mg-equivalent PPI approximately 12 hours before REYATAZ. For treatment-experienced adults, PPI coadministration is not recommended; other branches require the full current label.',
  atazanavir__h2_receptor_antagonist:
    'H2 timing and famotidine-equivalent limits depend on history, ritonavir, pregnancy and regimen. One treatment-naive boosted branch permits simultaneous administration and/or at least 10 hours after the H2 dose; an unboosted treatment-naive branch uses at least 2 hours before and at least 10 hours after. No universal schedule is safe.',
  atazanavir__antacid_buffered_product:
    'Administer REYATAZ 2 hours before or 1 hour after the antacid or buffered medicine.',
  rilpivirine__proton_pump_inhibitor: null,
  erlotinib__proton_pump_inhibitor: null,
  erlotinib__h2_receptor_antagonist:
    'Take erlotinib 10 hours after the H2-receptor-antagonist dose and at least 2 hours before the next H2-receptor-antagonist dose.',
  erlotinib__antacid:
    'Separate antacid and erlotinib by several hours if necessary; the selected label gives no numeric interval.',
  dasatinib__proton_pump_inhibitor: null,
  dasatinib__h2_receptor_antagonist: null,
  dasatinib_sprycel__antacid:
    'For SPRYCEL tablets, administer the antacid at least 2 hours before or 2 hours after SPRYCEL; avoid simultaneous administration.',
  dasatinib_phyrago__antacid:
    'For PHYRAGO, avoid concomitant antacid use. If unavoidable, administer the calcium-carbonate antacid at least 2 hours before or 2 hours after PHYRAGO.',
  ketoconazole_oral__acid_suppressant:
    'For acid-neutralizing medicines, administer at least 1 hour before or 2 hours after ketoconazole tablets. For H2 antagonists or PPIs, use the label-directed acidic-beverage strategy; no clock interval is supplied.',
  itraconazole_capsule__acid_suppressant:
    'For conventional SPORANOX capsules only, administer acid-neutralizing medicines at least 2 hours before or 2 hours after, take with a full meal, and use an acidic beverage under label conditions. Do not apply this schedule to TOLSURA.',
  itraconazole_tolsura__acid_reducer: null,
};

const EXPECTED_MEMBERS = {
  ciprofloxacin__polyvalent_cation: [
    'calcium carbonate',
    'calcium',
    'magnesium hydroxide',
    'aluminium hydroxide',
    'ferrous sulfate',
    'iron',
    'zinc',
    'sucralfate',
    'magnesium',
  ],
  levofloxacin__polyvalent_cation: [
    'magnesium hydroxide',
    'magnesium',
    'aluminium hydroxide',
    'ferrous sulfate',
    'iron',
    'zinc',
    'sucralfate',
  ],
  moxifloxacin__polyvalent_cation: [
    'magnesium hydroxide',
    'magnesium',
    'aluminium hydroxide',
    'ferrous sulfate',
    'iron',
    'zinc',
    'sucralfate',
  ],
  doxycycline__polyvalent_cation: [
    'calcium carbonate',
    'calcium',
    'magnesium hydroxide',
    'magnesium',
    'aluminium hydroxide',
    'ferrous sulfate',
    'iron',
    'bismuth subsalicylate',
  ],
  levothyroxine__oral_cation_binder: [
    'calcium carbonate',
    'calcium',
    'ferrous sulfate',
    'iron',
    'aluminium hydroxide',
    'magnesium hydroxide',
    'magnesium',
    'sevelamer',
    'lanthanum carbonate',
    'sucralfate',
  ],
  levothyroxine__acid_suppressant: PPI_MEMBERS,
  alendronate__oral_cation_food: [...BISPHOSPHONATE_CATION_MEMBERS, 'milk'],
  risedronate_immediate_release__oral_cation_food: [
    ...BISPHOSPHONATE_CATION_MEMBERS,
    'milk',
  ],
  risedronate_delayed_release__oral_cation_food: BISPHOSPHONATE_CATION_MEMBERS,
  ibandronate__oral_cation_food: [...BISPHOSPHONATE_CATION_MEMBERS, 'milk'],
  atazanavir__proton_pump_inhibitor: PPI_MEMBERS,
  atazanavir__h2_receptor_antagonist: H2_MEMBERS,
  atazanavir__antacid_buffered_product: ANTACID_MEMBERS,
  rilpivirine__proton_pump_inhibitor: PPI_MEMBERS,
  erlotinib__proton_pump_inhibitor: PPI_MEMBERS,
  erlotinib__h2_receptor_antagonist: H2_MEMBERS,
  erlotinib__antacid: ANTACID_MEMBERS,
  dasatinib__proton_pump_inhibitor: PPI_MEMBERS,
  dasatinib__h2_receptor_antagonist: H2_MEMBERS,
  dasatinib_sprycel__antacid: [
    'magnesium hydroxide',
    'aluminium hydroxide',
  ],
  dasatinib_phyrago__antacid: ['calcium carbonate'],
  ketoconazole_oral__acid_suppressant: [...PPI_MEMBERS, ...H2_MEMBERS, ...ANTACID_MEMBERS],
  itraconazole_capsule__acid_suppressant: [...PPI_MEMBERS, ...H2_MEMBERS, ...ANTACID_MEMBERS],
  itraconazole_tolsura__acid_reducer: [...PPI_MEMBERS, ...H2_MEMBERS, ...ANTACID_MEMBERS],
};

const EXPECTED_RISK_FACTORS = {
  ciprofloxacin__polyvalent_cation: [
    'oral_route_and_formulation',
    'cation_product_identity',
    'administration_timing_adherence',
    'food_or_enteral_feed_context',
  ],
  levofloxacin__polyvalent_cation: [
    'oral_route_and_formulation',
    'cation_product_identity',
    'administration_timing_adherence',
    'buffered_didanosine_formulation',
  ],
  moxifloxacin__polyvalent_cation: [
    'oral_route_and_formulation',
    'cation_product_identity',
    'administration_timing_adherence',
  ],
  doxycycline__polyvalent_cation: [
    'oral_route_and_formulation',
    'cation_or_bismuth_identity',
    'administration_timing_adherence',
    'food_or_dairy_context',
  ],
  levothyroxine__oral_cation_binder: [
    'levothyroxine_formulation',
    'binder_identity_and_formulation',
    'thyroid_function_and_indication',
    'administration_consistency',
  ],
  levothyroxine__acid_suppressant: [
    'levothyroxine_formulation',
    'ppi_identity_intensity_and_duration',
    'thyroid_function_and_indication',
    'administration_consistency',
  ],
  alendronate__oral_cation_food: [
    'alendronate_formulation',
    'source_product_jurisdiction',
    'food_beverage_and_water_context',
    'upright_and_timing_adherence',
  ],
  risedronate_immediate_release__oral_cation_food: [
    'risedronate_formulation',
    'food_beverage_and_water_context',
    'administration_timing_adherence',
  ],
  risedronate_delayed_release__oral_cation_food: [
    'risedronate_formulation',
    'source_product_jurisdiction',
    'meal_and_cation_schedule',
  ],
  ibandronate__oral_cation_food: [
    'ibandronate_route_and_formulation',
    'food_beverage_and_water_context',
    'upright_and_timing_adherence',
  ],
  atazanavir__proton_pump_inhibitor: [
    'atazanavir_booster',
    'treatment_history',
    'atazanavir_regimen_and_dose',
    'ppi_identity_and_dose',
  ],
  atazanavir__h2_receptor_antagonist: [
    'atazanavir_booster',
    'treatment_history',
    'atazanavir_regimen_and_dose',
    'h2_identity_and_dose',
  ],
  atazanavir__antacid_buffered_product: [
    'antacid_product_identity',
    'atazanavir_regimen',
    'administration_timing_adherence',
  ],
  rilpivirine__proton_pump_inhibitor: [
    'rilpivirine_formulation',
    'hiv_regimen_and_virologic_status',
    'acid_management_alternative',
  ],
  erlotinib__proton_pump_inhibitor: [
    'acid_suppression_intensity',
    'oncology_regimen_and_response',
    'erlotinib_administration',
  ],
  erlotinib__h2_receptor_antagonist: [
    'h2_identity_and_schedule',
    'oncology_regimen_and_response',
    'administration_timing_adherence',
  ],
  erlotinib__antacid: [
    'antacid_identity_and_formulation',
    'administration_timing_adherence',
    'oncology_regimen_and_response',
  ],
  dasatinib__proton_pump_inhibitor: [
    'acid_suppression_intensity_and_duration',
    'oncology_regimen_and_response',
    'dasatinib_product_and_administration',
  ],
  dasatinib__h2_receptor_antagonist: [
    'h2_antagonist_identity_and_exposure',
    'oncology_regimen_and_response',
    'acid_management_alternative',
  ],
  dasatinib_sprycel__antacid: [
    'dasatinib_product_identity',
    'antacid_identity_and_formulation',
    'administration_timing_adherence',
  ],
  dasatinib_phyrago__antacid: [
    'dasatinib_product_identity',
    'antacid_identity_and_formulation',
    'unavoidable_use_plan',
  ],
  ketoconazole_oral__acid_suppressant: [
    'oral_systemic_vs_topical_product',
    'acid_suppressant_subclass_and_schedule',
    'hepatic_safety_and_systemic_indication',
    'food_or_acidic_beverage_plan',
  ],
  itraconazole_capsule__acid_suppressant: [
    'itraconazole_formulation',
    'acid_suppressant_subclass_and_schedule',
    'food_or_acidic_beverage_plan',
    'therapeutic_drug_monitoring',
  ],
  itraconazole_tolsura__acid_reducer: [
    'itraconazole_product_identity',
    'acid_reducer_subclass_and_identity',
    'adverse_reaction_monitoring_and_dose',
  ],
};

test('Section I expands 15 source rows into 24 unique, product-safe decomposed rules', () => {
  assert.equal(RULES.length, 24);
  assert.deepEqual(RULES.map((rule) => rule.rule_id).sort(), EXPECTED_IDS);
  assert.equal(new Set(RULES.map((rule) => rule.rule_id)).size, RULES.length);
  assert.doesNotMatch(fs.readFileSync(SECTION_PATH, 'utf8'), /tokens truncated/i);

  for (const removedBlanketId of [
    'risedronate__oral_cation_food',
    'atazanavir__acid_suppressant',
    'erlotinib__acid_suppressant',
    'dasatinib__acid_suppressant',
  ]) {
    assert.ok(!RULES.some((rule) => rule.rule_id === removedBlanketId), `${removedBlanketId} survived`);
  }
});

test('every Section I child retains its exact conceptual source-row lineage', () => {
  const expected = {
    ciprofloxacin__polyvalent_cation: 91,
    levofloxacin__polyvalent_cation: 91,
    moxifloxacin__polyvalent_cation: 91,
    doxycycline__polyvalent_cation: 91,
    levothyroxine__oral_cation_binder: 92,
    levothyroxine__acid_suppressant: 92,
    alendronate__oral_cation_food: 93,
    risedronate_immediate_release__oral_cation_food: 93,
    risedronate_delayed_release__oral_cation_food: 93,
    ibandronate__oral_cation_food: 93,
    atazanavir__proton_pump_inhibitor: 94,
    atazanavir__h2_receptor_antagonist: 94,
    atazanavir__antacid_buffered_product: 94,
    rilpivirine__proton_pump_inhibitor: 94,
    erlotinib__proton_pump_inhibitor: 94,
    erlotinib__h2_receptor_antagonist: 94,
    erlotinib__antacid: 94,
    dasatinib__proton_pump_inhibitor: 94,
    dasatinib__h2_receptor_antagonist: 94,
    dasatinib_sprycel__antacid: 94,
    dasatinib_phyrago__antacid: 94,
    ketoconazole_oral__acid_suppressant: 95,
    itraconazole_capsule__acid_suppressant: 95,
    itraconazole_tolsura__acid_reducer: 95,
  };

  for (const rule of RULES) {
    assert.deepEqual(rule.source_rows, [expected[rule.rule_id]], `${rule.rule_id} source_rows`);
  }
});

test('every Section I row has the four-boolean runtime contract mirrored at top level', () => {
  for (const rule of RULES) {
    assert.equal(rule._section, 'I', `${rule.rule_id} section`);
    assert.ok(rule.runtime_status, `${rule.rule_id} missing runtime_status`);
    assert.deepEqual(
      Object.keys(rule.runtime_status).sort(),
      [
        'clinical_context_complete',
        'pair_matcher_executable',
        'promotion_eligible',
        'runtime_enabled',
      ],
      `${rule.rule_id} runtime_status shape`,
    );
    for (const key of [
      'pair_matcher_executable',
      'clinical_context_complete',
      'runtime_enabled',
      'promotion_eligible',
    ]) {
      assert.equal(typeof rule.runtime_status[key], 'boolean', `${rule.rule_id}.${key}`);
    }
    assert.equal(rule.runtime_enabled, rule.runtime_status.runtime_enabled, `${rule.rule_id} mirror`);
    assert.deepEqual(
      [
        rule.runtime_status.pair_matcher_executable,
        rule.runtime_status.clinical_context_complete,
        rule.runtime_status.runtime_enabled,
        rule.runtime_status.promotion_eligible,
      ],
      EXPECTED_RUNTIME[rule.rule_id],
      `${rule.rule_id} exact runtime tuple`,
    );
  }
  assert.deepEqual(
    RULES.filter((rule) => rule.runtime_enabled).map((rule) => rule.rule_id),
    [],
    'Section I runtime projection fails closed until clinical context is complete',
  );
});

test('every Section I row carries non-gateable risk factors and unambiguous action ownership', () => {
  for (const rule of RULES) {
    assert.ok(Array.isArray(rule.risk_factors) && rule.risk_factors.length > 0, `${rule.rule_id} risk factors`);
    assert.deepEqual(
      rule.risk_factors.map((factor) => factor.factor),
      EXPECTED_RISK_FACTORS[rule.rule_id],
      `${rule.rule_id} risk-factor identities`,
    );
    assert.ok(rule.risk_factors.every((factor) => factor.gateable === false), `${rule.rule_id} gateability`);
    if (rule.rule_id === 'doxycycline__polyvalent_cation') {
      assert.equal(rule.management.action_target, null, `${rule.rule_id} action_target`);
    } else {
      assert.ok(rule.management.action_target, `${rule.rule_id} action_target`);
    }
    assert.deepEqual(rule.management.do_not_interrupt, ['object_drug'], `${rule.rule_id} do_not_interrupt`);
    assert.deepEqual(rule.context_modifiers, [], `${rule.rule_id} must not encode non-gateable factors as modifiers`);
  }
});

test('inline class members are exact tokens rather than inert category labels', () => {
  const banned = new Set([
    'calcium salts',
    'magnesium/aluminium antacids',
    'iron salts',
    'dairy calcium',
    'calcium-rich foods',
    'proton pump inhibitors',
    'H2-receptor antagonists',
    'antacids/buffered products',
    'food',
    'other oral medicines',
  ]);

  for (const rule of RULES) {
    for (const ref of [rule.object, rule.perpetrator, rule.second_subject]) {
      if (!ref?.class) continue;
      assert.ok(Array.isArray(ref.members) && ref.members.length > 0, `${rule.rule_id} class members`);
      assert.deepEqual(ref.members, EXPECTED_MEMBERS[rule.rule_id], `${rule.rule_id} exact members`);
      for (const member of ref.members) {
        assert.ok(!banned.has(member), `${rule.rule_id} retains synthetic member ${member}`);
      }
    }
  }
});

test('applicability indications are null or non-empty arrays', () => {
  for (const rule of RULES) {
    const indication = rule.applicability.indication;
    assert.ok(
      indication === null
      || (
        Array.isArray(indication)
        && indication.length > 0
        && indication.every((value) => typeof value === 'string' && value.length > 0)
      ),
      `${rule.rule_id} indication`,
    );
  }
});

test('unverified antacid identities remain excluded behind explicit fail-closed claims', () => {
  const omitted = [
    'magaldrate',
    'magnesium trisilicate',
    'dried aluminium hydroxide',
    'hydrotalcite',
  ];
  for (const ruleId of [
    'erlotinib__antacid',
    'dasatinib_sprycel__antacid',
    'dasatinib_phyrago__antacid',
  ]) {
    const rule = RULES.find((candidate) => candidate.rule_id === ruleId);
    assert.ok(rule);
    for (const member of omitted) {
      assert.ok(!rule.perpetrator.members.includes(member), `${ruleId} admitted ${member}`);
      assert.match(rule.claims_needing_citation.join(' '), new RegExp(member, 'i'));
    }
    assert.equal(rule.runtime_enabled, false);
  }
  assert.deepEqual(
    RULES.find((rule) => rule.rule_id === 'dasatinib_sprycel__antacid')
      .perpetrator.members,
    ['magnesium hydroxide', 'aluminium hydroxide'],
  );
  assert.deepEqual(
    RULES.find((rule) => rule.rule_id === 'dasatinib_phyrago__antacid')
      .perpetrator.members,
    ['calcium carbonate'],
  );
});

test('live-label scope keeps levofloxacin, moxifloxacin, doxycycline and delayed-release risedronate members exact', () => {
  const members = (ruleId) => {
    const rule = RULES.find((candidate) => candidate.rule_id === ruleId);
    return (rule.perpetrator ?? rule.second_subject).members;
  };
  const fluoroquinoloneMembers = [
    'magnesium hydroxide',
    'magnesium',
    'aluminium hydroxide',
    'ferrous sulfate',
    'iron',
    'zinc',
    'sucralfate',
  ];

  assert.deepEqual(members('levofloxacin__polyvalent_cation'), fluoroquinoloneMembers);
  assert.deepEqual(members('moxifloxacin__polyvalent_cation'), fluoroquinoloneMembers);
  assert.deepEqual(members('doxycycline__polyvalent_cation'), [
    'calcium carbonate',
    'calcium',
    'magnesium hydroxide',
    'magnesium',
    'aluminium hydroxide',
    'ferrous sulfate',
    'iron',
    'bismuth subsalicylate',
  ]);
  assert.deepEqual(members('risedronate_delayed_release__oral_cation_food'), [
    'calcium carbonate',
    'calcium',
    'ferrous sulfate',
    'iron',
    'magnesium',
    'magnesium hydroxide',
    'aluminium hydroxide',
  ]);
});

test('every Section I rule has a representative related non-member that does not enter that rule', () => {
  const nonMembers = [
    ['ciprofloxacin', 'bismuth subsalicylate', 'ciprofloxacin__polyvalent_cation'],
    ['levofloxacin', 'calcium carbonate', 'levofloxacin__polyvalent_cation'],
    ['moxifloxacin', 'calcium carbonate', 'moxifloxacin__polyvalent_cation'],
    ['doxycycline', 'zinc', 'doxycycline__polyvalent_cation'],
    ['levothyroxine', 'omeprazole', 'levothyroxine__oral_cation_binder'],
    ['levothyroxine', 'famotidine', 'levothyroxine__acid_suppressant'],
    ['alendronate', 'zinc', 'alendronate__oral_cation_food'],
    ['risedronate', 'zinc', 'risedronate_immediate_release__oral_cation_food'],
    ['risedronate', 'milk', 'risedronate_delayed_release__oral_cation_food'],
    ['ibandronate', 'zinc', 'ibandronate__oral_cation_food'],
    ['atazanavir', 'famotidine', 'atazanavir__proton_pump_inhibitor'],
    ['atazanavir', 'omeprazole', 'atazanavir__h2_receptor_antagonist'],
    ['atazanavir', 'famotidine', 'atazanavir__antacid_buffered_product'],
    ['rilpivirine', 'famotidine', 'rilpivirine__proton_pump_inhibitor'],
    ['erlotinib', 'famotidine', 'erlotinib__proton_pump_inhibitor'],
    ['erlotinib', 'omeprazole', 'erlotinib__h2_receptor_antagonist'],
    ['erlotinib', 'omeprazole', 'erlotinib__antacid'],
    ['dasatinib', 'famotidine', 'dasatinib__proton_pump_inhibitor'],
    ['dasatinib', 'omeprazole', 'dasatinib__h2_receptor_antagonist'],
    ['dasatinib', 'omeprazole', 'dasatinib_sprycel__antacid'],
    ['dasatinib', 'magnesium hydroxide', 'dasatinib_phyrago__antacid'],
    ['ketoconazole', 'sucralfate', 'ketoconazole_oral__acid_suppressant'],
    ['itraconazole', 'sucralfate', 'itraconazole_capsule__acid_suppressant'],
    ['itraconazole', 'sucralfate', 'itraconazole_tolsura__acid_reducer'],
  ];

  for (const [objectDrug, nonMember, ruleId] of nonMembers) {
    assert.ok(
      !ids([objectDrug, nonMember]).includes(ruleId),
      `${ruleId} incorrectly admitted ${nonMember}`,
    );
  }
});

test('levothyroxine acid suppression is limited to source-supported tablet/capsule PPI scope', () => {
  const rule = RULES.find((candidate) => candidate.rule_id === 'levothyroxine__acid_suppressant');
  assert.deepEqual(rule.object.formulation, ['tablet', 'capsule']);
  assert.deepEqual(rule.applicability.formulations, ['tablet', 'capsule']);
  assert.deepEqual(rule.applicability.jurisdiction, ['US']);
  assert.equal(rule.perpetrator.class, 'proton_pump_inhibitor');
  assert.deepEqual(rule.perpetrator.members, [
    'omeprazole',
    'esomeprazole',
    'lansoprazole',
    'pantoprazole',
    'rabeprazole',
    'dexlansoprazole',
  ]);
  assert.match(rule.management.exceptions, /TIROSINT-SOL oral solution is excluded/);
  assert.match(rule.management.exceptions, /H2-receptor antagonists are excluded/);
  const solutionCounterevidence = rule.evidence.find(
    (evidence) => evidence.source_id === 'fda-label-tirosint-sol-omeprazole-2026',
  );
  assert.ok(solutionCounterevidence);
  assert.equal(
    solutionCounterevidence.fragments[0].text,
    'No clinically significant differences in TIROSINT-SOL pharmacokinetics were observed when orally coadministered with omeprazole.',
  );
  assert.equal(solutionCounterevidence.source_policy_use, 'interaction-counterevidence');
  assert.equal(solutionCounterevidence.supports.interaction_exists, false);
  assert.deepEqual(
    solutionCounterevidence.supports.source_effect,
    ['no_clinically_meaningful_effect'],
  );
  assert.equal(
    solutionCounterevidence.supports.scope.evidence_role,
    'product_specific_interaction_counterevidence',
  );
  assert.deepEqual(solutionCounterevidence.supports.label_action, []);
  assert.ok(
    solutionCounterevidence.does_not_by_itself_support.some((limitation) =>
      /supplies no management action/i.test(limitation),
    ),
  );
  const capsuleEvidence = rule.evidence.find(
    (evidence) => evidence.source_id === 'fda-label-tirosint-capsules-2026',
  );
  assert.ok(
    capsuleEvidence.fragments.some(
      (fragment) =>
        fragment.text ===
        'Sucralfate, antacids and proton pump inhibitors may cause hypochlorhydria, affect intragastric pH, and reduce levothyroxine absorption. Monitor patients appropriately',
    ),
  );
  assert.equal(rule.runtime_enabled, false);
  assert.deepEqual(ids(['levothyroxine', 'famotidine']), []);
});

test('fluoroquinolone chelation actions are source-backed while doxycycline fails closed', () => {
  const cases = [
    ['ciprofloxacin', 'calcium carbonate', 'ciprofloxacin__polyvalent_cation'],
    ['levofloxacin', 'ferrous sulfate', 'levofloxacin__polyvalent_cation'],
    ['moxifloxacin', 'sucralfate', 'moxifloxacin__polyvalent_cation'],
  ];
  const timings = new Set();

  for (const [drug, cation, ruleId] of cases) {
    const finding = one([drug, cation], ruleId);
    assert.equal(finding.dispense_action, 'space_doses');
    const rule = RULES.find((candidate) => candidate.rule_id === ruleId);
    assert.equal(rule.management.timing, EXPECTED_TIMING[ruleId]);
    assert.doesNotMatch(rule.management.timing, /<verify/i);
    timings.add(rule.management.timing);
  }
  assert.equal(timings.size, cases.length, 'source-backed schedules must not collapse to one generic interval');
  const doxycycline = one(
    ['doxycycline', 'bismuth subsalicylate'],
    'doxycycline__polyvalent_cation',
  );
  assert.equal(doxycycline.clinical_action_status, 'unresolved_pending_jurisdiction');
  assert.equal(doxycycline.dispense_action, 'withhold_and_clarify');
  assert.deepEqual(doxycycline.management, {});
  assert.deepEqual(doxycycline.jurisdiction_scope, []);
  const doxycyclineRule = RULES.find(
    (rule) => rule.rule_id === 'doxycycline__polyvalent_cation',
  );
  assert.deepEqual(doxycyclineRule.applicability.jurisdiction, []);
  assert.equal(doxycyclineRule.management.dispense_action, 'confirm_and_monitor');
  assert.equal(doxycyclineRule.management.action_target, null);
  assert.doesNotMatch(
    JSON.stringify(doxycyclineRule.management),
    /space_doses|do not take (?:the named products )?together/iu,
  );
  assert.ok(
    doxycyclineRule.claims_needing_citation.some((claim) =>
      /no retained evidence record contains a label action/i.test(claim),
    ),
  );
  const cipro = RULES.find((rule) => rule.rule_id === 'ciprofloxacin__polyvalent_cation');
  assert.ok(
    cipro.evidence[0].fragments.some(
      (fragment) =>
        fragment.section === '2.4 Administration Instructions With Multivalent Cations' &&
        fragment.text.startsWith(
          'Administer CIPRO at least 2 hours before or 6 hours after magnesium/aluminum antacids;',
        ),
    ),
  );
  assert.equal(
    cipro.evidence[0].source_discrepancies[0].disposition,
    'quarantined_from_timing_support',
  );
  assert.match(cipro.evidence[0].source_discrepancies[0].text, /should be taken at least two hours before/);
  assert.ok(
    !cipro.evidence[0].fragments.some((fragment) =>
      fragment.text.startsWith('Inform patients that antacids containing magnesium'),
    ),
    'the inverted counseling sentence must not support timing',
  );
  for (const [drug, ruleId] of [
    ['levofloxacin', 'levofloxacin__polyvalent_cation'],
    ['moxifloxacin', 'moxifloxacin__polyvalent_cation'],
    ['doxycycline', 'doxycycline__polyvalent_cation'],
  ]) {
    assert.equal(one([drug, 'magnesium'], ruleId).runtime_enabled, false);
  }
  assert.deepEqual(ids(['ciprofloxacin', 'calcium salts']), [], 'old synthetic class token must not be required');
  assert.deepEqual(ids(['levofloxacin', 'calcium carbonate']), [], 'levofloxacin label scope excludes calcium');
  assert.deepEqual(ids(['moxifloxacin', 'calcium carbonate']), [], 'moxifloxacin calcium non-effect must not alert');
  assert.deepEqual(ids(['doxycycline', 'zinc']), [], 'Doryx-scoped rule does not include zinc');
  assert.deepEqual(ids(['doxycycline', 'sucralfate']), [], 'Doryx-scoped rule does not include sucralfate');
});

test('every Section I timing value matches its source-backed or explicitly unresolved instruction', () => {
  for (const rule of RULES) {
    assert.equal(rule.management.timing, EXPECTED_TIMING[rule.rule_id], rule.rule_id);
  }
  assert.match(
    EXPECTED_TIMING.doxycycline__polyvalent_cation,
    /No separation interval or spacing action is supported/iu,
  );
  assert.match(EXPECTED_TIMING.erlotinib__antacid, /gives no numeric interval/);
  assert.match(EXPECTED_TIMING.atazanavir__h2_receptor_antagonist, /No universal schedule is safe/);
});

test('levothyroxine cation spacing and acid-suppression monitoring are separate actions', () => {
  const cation = one(['levothyroxine', 'calcium carbonate'], 'levothyroxine__oral_cation_binder');
  assert.equal(cation.dispense_action, 'space_doses');
  const acid = one(['levothyroxine', 'omeprazole'], 'levothyroxine__acid_suppressant');
  assert.equal(acid.dispense_action, 'supply_with_counselling');
  assert.deepEqual(ids(['levothyroxine', 'warfarin']), []);
});

test('oral bisphosphonate cation matching is executable while unselectable formulations stay diagnostic-only', () => {
  const alendronateRule = RULES.find(
    (rule) => rule.rule_id === 'alendronate__oral_cation_food',
  );
  assert.deepEqual(alendronateRule.object.formulation, ['tablet', 'oral_solution']);
  assert.deepEqual(alendronateRule.applicability.formulations, ['tablet', 'oral_solution']);
  assert.deepEqual(alendronateRule.applicability.jurisdiction, ['US']);
  assert.ok(!alendronateRule.object.formulation.includes('effervescent_tablet'));
  assert.match(alendronateRule.management.exceptions, /Effervescent alendronate formulations are outside/);
  assert.equal(
    one(['alendronate', 'calcium carbonate'], 'alendronate__oral_cation_food').runtime_enabled,
    false,
    'ingredient-only matching cannot exclude the unsupported effervescent formulation',
  );

  const risedronate = fire(['risedronate', 'calcium carbonate']);
  assert.deepEqual(
    risedronate.map((finding) => finding.rule_id).sort(),
    [
      'risedronate_delayed_release__oral_cation_food',
      'risedronate_immediate_release__oral_cation_food',
    ],
  );
  assert.ok(risedronate.every((finding) => finding.runtime_enabled === false));
  assert.deepEqual(
    ids(['risedronate', 'milk']),
    ['risedronate_immediate_release__oral_cation_food'],
    'delayed-release risedronate is taken after breakfast and must not treat milk as a spacing member',
  );

  assert.equal(one(['ibandronate', 'calcium carbonate'], 'ibandronate__oral_cation_food').runtime_enabled, false);
});

test('atazanavir PPI, H2-antagonist and antacid branches are disjoint and diagnostic-only', () => {
  const cases = [
    ['omeprazole', 'atazanavir__proton_pump_inhibitor', 'withhold_and_clarify'],
    ['famotidine', 'atazanavir__h2_receptor_antagonist', 'withhold_and_clarify'],
    ['aluminium hydroxide', 'atazanavir__antacid_buffered_product', 'space_doses'],
  ];
  for (const [acidAgent, ruleId, action] of cases) {
    const findings = scopedFire(['atazanavir', acidAgent], ruleId);
    assert.deepEqual(findings.map((finding) => finding.rule_id), [ruleId]);
    assert.equal(findings[0].dispense_action, 'withhold_and_clarify');
    assert.equal(findings[0].clinical_action_status, 'unresolved_pending_indication');
    assert.equal(findings[0].runtime_enabled, false);
    assert.equal(
      RULES.find((rule) => rule.rule_id === ruleId).management.dispense_action,
      action,
    );
    assert.equal(findings[0].runtime_enabled, false);
  }
  const h2 = RULES.find((rule) => rule.rule_id === 'atazanavir__h2_receptor_antagonist');
  const h2Fragments = h2.evidence[0].fragments.map((fragment) => fragment.text);
  assert.ok(
    h2Fragments.includes(
      'For patients unable to tolerate ritonavir, REYATAZ 400 mg once daily with food should be administered at least 2 hours before and at least 10 hours after a dose of the H2RA. No single dose of the H2RA should exceed a dose comparable to famotidine 20 mg, and the total daily dose should not exceed a dose comparable to famotidine 40 mg.',
    ),
  );
  assert.ok(
    h2Fragments.includes(
      'Whenever an H2RA is given to a patient receiving REYATAZ with ritonavir, the H2RA dose should not exceed a dose comparable to famotidine 20 mg twice daily, and the REYATAZ with ritonavir doses should be administered simultaneously with, and/or at least 10 hours after, the dose of the H2RA.',
    ),
  );
});

test('oral rilpivirine plus a PPI is explicitly contraindicated; H2 agents do not enter the PPI rule', () => {
  const finding = one(['rilpivirine', 'omeprazole'], 'rilpivirine__proton_pump_inhibitor');
  assert.equal(finding.severity, 'contraindicated');
  assert.equal(finding.dispense_action, 'withhold_and_clarify');
  assert.equal(finding.runtime_enabled, false);
  assert.deepEqual(ids(['rilpivirine', 'famotidine']), []);
});

test('erlotinib acid-suppressant branches fire exactly once with class-specific actions', () => {
  const cases = [
    ['omeprazole', 'erlotinib__proton_pump_inhibitor', 'withhold_and_clarify'],
    ['famotidine', 'erlotinib__h2_receptor_antagonist', 'space_doses'],
    ['aluminium hydroxide', 'erlotinib__antacid', 'space_doses'],
  ];
  for (const [acidAgent, ruleId, action] of cases) {
    const findings = scopedFire(['erlotinib', acidAgent], ruleId);
    assert.deepEqual(findings.map((finding) => finding.rule_id), [ruleId]);
    assert.equal(findings[0].dispense_action, 'withhold_and_clarify');
    assert.equal(findings[0].clinical_action_status, 'unresolved_pending_indication');
    assert.equal(
      RULES.find((rule) => rule.rule_id === ruleId).management.dispense_action,
      action,
    );
  }

  const antacid = RULES.find((rule) => rule.rule_id === 'erlotinib__antacid');
  assert.match(antacid.management.timing, /several hours/i);
  assert.doesNotMatch(antacid.management.timing, /\b\d+\s*(?:hours?|hrs?|hr|h)\b/i);
  assert.match(antacid.mechanism, /pharmacokinetics has not been evaluated/i);
  assert.doesNotMatch(antacid.mechanism, /reduce(?:s|d)? erlotinib absorption/i);
  assert.match(antacid.evidence[0].normalized_proposition, /pharmacokinetics were not evaluated/i);
  const ppi = RULES.find((rule) => rule.rule_id === 'erlotinib__proton_pump_inhibitor');
  assert.ok(
    ppi.evidence[0].fragments.some(
      (fragment) =>
        fragment.text ===
        'Separation of doses may not eliminate the interaction since proton pump inhibitors affect the pH of the upper GI tract for an extended period',
    ),
  );
});

test('dasatinib product conflicts fail-close PPI/H2 and split antacid actions by exact product', () => {
  const cases = [
    ['omeprazole', 'dasatinib__proton_pump_inhibitor', 'withhold_and_clarify', false],
    ['famotidine', 'dasatinib__h2_receptor_antagonist', 'withhold_and_clarify', false],
  ];
  for (const [acidAgent, ruleId, action, runtimeEnabled] of cases) {
    const findings = scopedFire(['dasatinib', acidAgent], ruleId);
    assert.deepEqual(findings.map((finding) => finding.rule_id), [ruleId]);
    assert.equal(findings[0].dispense_action, action);
    assert.equal(findings[0].runtime_enabled, runtimeEnabled);
  }

  const ppi = RULES.find((rule) => rule.rule_id === 'dasatinib__proton_pump_inhibitor');
  const h2 = RULES.find((rule) => rule.rule_id === 'dasatinib__h2_receptor_antagonist');
  const sprycel = RULES.find((rule) => rule.rule_id === 'dasatinib_sprycel__antacid');
  const phyrago = RULES.find((rule) => rule.rule_id === 'dasatinib_phyrago__antacid');
  const ppiPhyrago = ppi.evidence.find(
    (evidence) => evidence.source_id === 'fda-label-phyrago-2026',
  );
  const h2Phyrago = h2.evidence.find(
    (evidence) => evidence.source_id === 'fda-label-phyrago-2026',
  );

  assert.match(ppi.mechanism, /Ingredient-only matching cannot select the dasatinib product/);
  assert.match(h2.mechanism, /Ingredient-only matching cannot select the dasatinib product/);
  assert.match(ppiPhyrago.fragments[0].text, /no clinically significant differences.*omeprazole/is);
  assert.match(h2Phyrago.fragments[0].text, /no clinically significant differences.*famotidine/is);
  for (const counterevidence of [ppiPhyrago, h2Phyrago]) {
    assert.equal(counterevidence.source_policy_use, 'interaction-counterevidence');
    assert.equal(counterevidence.supports.interaction_exists, false);
    assert.deepEqual(
      counterevidence.supports.source_effect,
      ['no_clinically_meaningful_effect'],
    );
    assert.deepEqual(counterevidence.supports.label_action, []);
    assert.equal(
      counterevidence.supports.scope.evidence_role,
      'product_specific_interaction_counterevidence',
    );
  }
  assert.deepEqual(ppiPhyrago.supports.label_action, []);
  assert.deepEqual(h2Phyrago.supports.label_action, []);
  assert.ok(
    ppiPhyrago.does_not_by_itself_support.some((limitation) =>
      /no PPI management action/i.test(limitation),
    ),
  );
  assert.ok(
    h2Phyrago.does_not_by_itself_support.some((limitation) =>
      /no H2-antagonist management action/i.test(limitation),
    ),
  );
  assert.ok(
    h2.evidence[0].fragments.some(
      (fragment) =>
        compactLabelText(fragment.text) === compactLabelText(
          'The coadministration of SPRYCEL with a gastric acid reducing agent may decrease the concentrations of dasatinib. Decreased dasatinib concentrations may reduce efficacy. Do not administer H2 antagonists or proton pump inhibitors with SPRYCEL.',
      ),
    ),
  );
  assert.ok(!RULES.some((rule) => rule.rule_id === 'dasatinib__antacid'));
  assert.equal(sprycel.object.scope, 'SPRYCEL tablets only');
  assert.equal(sprycel.management.dispense_action, 'space_doses');
  assert.deepEqual(sprycel.perpetrator.members, [
    'magnesium hydroxide',
    'aluminium hydroxide',
  ]);
  assert.match(sprycel.management.timing, /at least 2 hours before or 2 hours after SPRYCEL/);
  assert.equal(sprycel.runtime_status.pair_matcher_executable, false);
  assert.equal(sprycel.runtime_enabled, false);
  assert.equal(sprycel.evidence.length, 1);
  assert.equal(sprycel.evidence[0].supports.scope.source_product, 'SPRYCEL tablets');

  assert.equal(phyrago.object.scope, 'PHYRAGO immediate-release tablets only');
  assert.equal(phyrago.management.dispense_action, 'withhold_and_clarify');
  assert.deepEqual(phyrago.perpetrator.members, ['calcium carbonate']);
  assert.match(phyrago.management.timing, /^For PHYRAGO, avoid concomitant antacid use/);
  assert.match(phyrago.management.timing, /If unavoidable/);
  assert.equal(phyrago.runtime_status.pair_matcher_executable, false);
  assert.equal(phyrago.runtime_enabled, false);
  assert.equal(phyrago.evidence.length, 1);
  assert.equal(
    phyrago.evidence[0].supports.scope.source_product,
    'PHYRAGO immediate-release tablets',
  );
  assert.ok(
    phyrago.evidence[0].fragments.some((fragment) =>
      fragment.text.startsWith('Avoid concomitant use of PHYRAGO with antacids.'),
    ),
  );
  assert.deepEqual(ids(['dasatinib', 'calcium carbonate']), []);
  assert.deepEqual(ids(['dasatinib', 'aluminium hydroxide']), []);
});

test('oral ketoconazole preserves the exact acidic-beverage and neutralizer schedule', () => {
  const ketoconazole = one(['ketoconazole', 'omeprazole'], 'ketoconazole_oral__acid_suppressant');
  assert.equal(ketoconazole.runtime_enabled, false);
  assert.equal(ketoconazole.dispense_action, 'withhold_and_clarify');
  const ketoconazoleRule = RULES.find(
    (rule) => rule.rule_id === 'ketoconazole_oral__acid_suppressant',
  );
  assert.ok(
    ketoconazoleRule.evidence[0].fragments.some(
      (fragment) =>
        fragment.text ===
        'Upon coadministration, the antifungal activity should be monitored and the ketoconazole tablets dose increased as deemed necessary.',
    ),
  );
  assert.ok(
    ketoconazoleRule.evidence[0].fragments.some(
      (fragment) =>
        fragment.text ===
        'After pretreatment with omeprazole, a proton pump inhibitor, the bioavailability of a single 200 mg dose of ketoconazole under fasted conditions was decreased to 17% of the bioavailability of ketoconazole administered alone.',
    ),
  );
  assert.ok(
    ketoconazoleRule.evidence[0].fragments.some(
      (fragment) =>
        fragment.text
        === 'Ketoconazole tablets should be administered with an acidic beverage (such as non-diet cola) upon co-treatment with drugs reducing gastric acidity.',
    ),
  );
  assert.ok(
    ketoconazoleRule.evidence[0].fragments.some(
      (fragment) =>
        fragment.text
        === 'Acid neutralizing medicines (e.g., aluminum hydroxide) should be administered at least 1 hour before or 2 hours after the intake of ketoconazole tablets.',
    ),
  );
  assert.match(ketoconazoleRule.management.timing, /acid-neutralizing medicines/);
  assert.match(ketoconazoleRule.management.timing, /acidic-beverage strategy/);
  assert.match(
    ketoconazoleRule.evidence[0].does_not_by_itself_support[0],
    /numeric interval is only for acid neutralizers/i,
  );
});

test('conventional SPORANOX and TOLSURA are separate opposite-direction product branches', () => {
  const itraconazole = one(['itraconazole', 'omeprazole'], 'itraconazole_capsule__acid_suppressant');
  assert.equal(itraconazole.runtime_enabled, false);
  assert.equal(itraconazole.dispense_action, 'withhold_and_clarify');
  const itraconazoleRule = RULES.find(
    (rule) => rule.rule_id === 'itraconazole_capsule__acid_suppressant',
  );
  assert.equal(
    itraconazoleRule.object.scope,
    'SPORANOX conventional capsules only; TOLSURA capsules excluded',
  );
  assert.equal(itraconazoleRule.evidence.length, 1);
  assert.match(itraconazoleRule.management.exceptions, /TOLSURA capsules.*excluded/);
  assert.ok(
    itraconazoleRule.evidence[0].fragments.some(
      (fragment) =>
        compactLabelText(fragment.text) === compactLabelText(
          'Absorption of itraconazole under fasted conditions in these subjects is increased when SPORANOX® Capsules are administered with an acidic beverage (such as a non-diet cola).',
      ),
    ),
  );
  const tolsuraRule = RULES.find(
    (rule) => rule.rule_id === 'itraconazole_tolsura__acid_reducer',
  );
  assert.ok(tolsuraRule);
  assert.equal(tolsuraRule.object.scope, 'TOLSURA capsules only');
  assert.equal(tolsuraRule.management.dispense_action, 'confirm_and_monitor');
  assert.match(tolsuraRule.management.prescriber_action, /Monitor for itraconazole adverse reactions/);
  assert.match(tolsuraRule.management.prescriber_action, /dose reduction may be necessary/);
  assert.equal(tolsuraRule.runtime_status.pair_matcher_executable, false);
  assert.equal(tolsuraRule.runtime_enabled, false);
  const tolsura = tolsuraRule.evidence[0];
  assert.equal(tolsura.source_id, 'fda-label-tolsura-2025');
  assert.equal(tolsura.source_policy_use, 'interaction-evidence');
  assert.equal(tolsura.supports.interaction_exists, true);
  assert.ok(
    tolsura.fragments.some(
      (fragment) =>
        fragment.text
        === 'Drugs that reduce gastric acidity e.g. acid neutralizing medicines such as aluminum hydroxide, or acid secretion suppressors such as H 2 - receptor antagonists and proton pump inhibitors (e.g., omeprazole).',
    ),
  );
  assert.ok(
    tolsura.fragments.some(
      (fragment) =>
        fragment.text
        === 'Co-administration of these drugs, including omeprazole, with TOLSURA increases the systemic exposure to itraconazole. Monitor for adverse reactions. TOLSURA dose reduction may be necessary [see Clinical Pharmacology (12.3) ].',
    ),
  );
  assert.equal(
    compactLabelText(tolsura.fragments[2].text),
    compactLabelText(
      'As illustrated in Table 8 below, the mean itraconazole AUC∞ was 22% higher and mean Cmax 31% higher when TOLSURA was co-administered with omeprazole.',
    ),
  );
  assert.deepEqual(tolsura.supports.label_action, [
    'monitor_for_adverse_reactions',
    'tolsura_dose_reduction_may_be_necessary',
  ]);
});

test('all Section I evidence is exactly reconciled to current openFDA SPL records', () => {
  let evidenceCount = 0;
  let fragmentCount = 0;
  let counterevidenceCount = 0;
  for (const rule of RULES) {
    assert.equal(rule.proposed_status, 'draft_for_review', `${rule.rule_id} proposed status`);
    assert.equal(rule.review.author, null, `${rule.rule_id} author`);
    assert.equal(rule.review.approver, null, `${rule.rule_id} approver`);
    assert.ok(Array.isArray(rule.evidence) && rule.evidence.length > 0, `${rule.rule_id} evidence`);
    for (const evidence of rule.evidence) {
      evidenceCount += 1;
      assert.equal(
        evidence.source_type,
        'company_submitted_spl_via_openfda',
        `${rule.rule_id} source type`,
      );
      assert.equal(evidence.source_policy_id, 'openfda-labels');
      assert.ok(
        ['interaction-evidence', 'interaction-counterevidence']
          .includes(evidence.source_policy_use),
      );
      if (evidence.source_policy_use === 'interaction-counterevidence') {
        counterevidenceCount += 1;
        assert.equal(evidence.supports.interaction_exists, false);
        assert.deepEqual(evidence.supports.source_effect, ['no_clinically_meaningful_effect']);
        assert.deepEqual(evidence.supports.label_action, []);
        assert.equal(
          evidence.supports.scope.evidence_role,
          'product_specific_interaction_counterevidence',
        );
      } else {
        assert.equal(evidence.supports.interaction_exists, true);
      }
      assert.equal(evidence.licence, 'CC0-1.0');
      assert.equal(evidence.regulator, 'FDA (United States)');
      assert.match(evidence.publisher, /^openFDA drug-label record \(company-submitted SPL\);/);
      assert.equal(evidence.source_host, 'api.fda.gov', `${rule.rule_id} host`);
      assert.match(evidence.canonical_setid, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
      const sourceUrl = new URL(evidence.source_url);
      assert.equal(sourceUrl.origin, 'https://api.fda.gov');
      assert.equal(sourceUrl.pathname, '/drug/label.json');
      assert.equal(sourceUrl.searchParams.get('search'), `set_id:"${evidence.canonical_setid}"`);
      assert.equal(sourceUrl.searchParams.get('limit'), '100');
      assert.deepEqual([...sourceUrl.searchParams.keys()].sort(), ['limit', 'search']);
      const referenceUrl = new URL(evidence.reference_url);
      assert.equal(referenceUrl.origin, 'https://dailymed.nlm.nih.gov');
      assert.equal(referenceUrl.pathname, '/dailymed/drugInfo.cfm');
      assert.equal(referenceUrl.searchParams.get('setid'), evidence.canonical_setid);
      assert.equal(evidence.document_id, evidence.canonical_setid);
      assert.equal(evidence.document_version, evidence.provenance.version);
      assert.equal(String(evidence.spl_version), evidence.provenance.version);
      assert.ok(Number.isInteger(evidence.spl_version) && evidence.spl_version > 0);
      assert.match(evidence.source_date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(
        evidence.source_date.replaceAll('-', ''),
        evidence.provenance.effective_time,
      );
      assert.equal(evidence.source_date_type, 'openFDA SPL effective_time');
      assert.match(evidence.host_page_updated_at, /^\d{4}-\d{2}-\d{2}$/);
      const expectedReviewDate = evidence.source_id === 'fda-label-sporanox-capsules-2026'
        ? '2026-07-26'
        : '2026-07-23';
      assert.equal(evidence.accessed_at, expectedReviewDate);
      assert.equal(evidence.retrieved_at, expectedReviewDate);
      assert.equal(evidence.jurisdiction, 'US');
      assert.equal(evidence.review_status, 'review_candidate');
      assert.equal(evidence.currentness_status, 'checked_current_openfda');
      assert.equal(evidence.currentness_checked_at, expectedReviewDate);
      assert.equal(
        evidence.citation_status,
        'machine_confirmed_openfda_reconciled_pending_clinician',
      );
      assert.equal(evidence.provenance.set_id, evidence.canonical_setid);
      assert.match(evidence.provenance.version, /^\d+$/);
      assert.match(evidence.provenance.effective_time, /^\d{8}$/);
      assert.match(evidence.provenance.payload_sha256, /^[0-9a-f]{64}$/);
      assert.equal(evidence.provenance.payload_canonicalization, 'sorted-json-keys-v1');
      assert.equal(evidence.provenance.normalization_version, 'openfda-spl-text-v1');
      assert.ok(evidence.supports.source_effect.length > 0);
      assert.ok(Array.isArray(evidence.supports.label_action));
      assert.equal(evidence.supports.runtime_severity_is_local_mapping, true);
      assert.deepEqual(evidence.supports.jurisdictions, ['US']);
      assert.ok(evidence.supports.scope.scope_type);
      assert.ok(evidence.supports.scope.source_product);
      assert.ok(evidence.supports.scope.source_routes.length > 0);
      assert.ok(evidence.supports.scope.source_formulations.length > 0);
      assert.ok(evidence.supports.scope.source_named_members.length > 0);
      assert.ok(evidence.does_not_by_itself_support.length >= 2);
      assert.ok(
        evidence.does_not_by_itself_support.every((item) => !/Indian jurisdiction/.test(item)),
      );
      assert.ok(
        evidence.does_not_by_itself_support.some((item) => /promotion readiness/.test(item)),
      );
      assert.ok(Array.isArray(evidence.fragments) && evidence.fragments.length > 0);
      assert.deepEqual(
        evidence.provenance.source_paths,
        evidence.fragments.map((fragment) => fragment.source_path),
      );
      for (const fragment of evidence.fragments) {
        fragmentCount += 1;
        assert.ok(fragment.section);
        assert.ok(fragment.text);
        assert.match(
          fragment.source_path,
          /^[a-zA-Z0-9_]+(?:(?:\.[a-zA-Z0-9_]+)|(?:\[\d+\]))*$/,
        );
        assert.match(fragment.text_sha256, /^[0-9a-f]{64}$/);
        assert.equal(
          fragment.text_sha256,
          createHash('sha256').update(fragment.text, 'utf8').digest('hex'),
          `${rule.rule_id} exact fragment hash`,
        );
      }
      assert.ok(!Object.hasOwn(evidence, 'excerpt'), `${rule.rule_id} legacy excerpt`);
      assert.ok(!Object.hasOwn(evidence, 'revision_date'), `${rule.rule_id} legacy revision`);
      assert.ok(!Object.hasOwn(evidence, 'source_version'), `${rule.rule_id} legacy source version`);
    }
    assert.equal(rule.runtime_status.promotion_eligible, false, `${rule.rule_id} promotion`);
  }
  assert.equal(evidenceCount, 33);
  assert.equal(counterevidenceCount, 3);
  assert.equal(fragmentCount, 67);
  assert.doesNotMatch(fs.readFileSync(SECTION_PATH, 'utf8'), /<verify\b/i);
});

test(
  'cached live openFDA records uniquely select and exactly contain every Section I fragment',
  { skip: OPENFDA_CACHE === undefined },
  () => {
    const manifest = loadSourceManifest();
    const envelopes = new Map();
    for (const rule of RULES) {
      for (const evidence of rule.evidence) {
        let envelope = envelopes.get(evidence.provenance.set_id);
        if (envelope === undefined) {
          envelope = JSON.parse(
            fs.readFileSync(
              path.join(OPENFDA_CACHE, `${evidence.provenance.set_id}.json`),
              'utf8',
            ),
          );
          envelopes.set(evidence.provenance.set_id, envelope);
        }
        assert.equal(envelope.meta.results.total, 1);
        assert.equal(envelope.results.length, 1);
        const payload = envelope.results[0];
        assertEvidenceAllowed(manifest, evidence, {
          profile: 'production-open',
          use: evidence.source_policy_use,
          storagePath: 'docs/interaction-review/batch-01-v2/sections/I.verified.jsonl',
          payload,
        });
        for (const fragment of evidence.fragments) {
          const sourceValue = payloadValueAtPath(payload, fragment.source_path);
          assert.equal(typeof sourceValue, 'string');
          assert.ok(
            sourceValue.includes(fragment.text),
            `${rule.rule_id} ${evidence.source_id} ${fragment.source_path}`,
          );
        }
      }
    }
    assert.equal(envelopes.size, 22);
  },
);

test('Section I citation and reconciliation documents pin the exact provenance artifact hash', () => {
  const digest = createHash('sha256')
    .update(fs.readFileSync(SECTION_PATH))
    .digest('hex');
  const citations = fs.readFileSync(CITATIONS_PATH, 'utf8');
  const reconciled = fs.readFileSync(RECONCILED_PATH, 'utf8');

  assert.match(citations, new RegExp(`JSONL SHA-256: \`${digest}\``));
  assert.match(reconciled, new RegExp(`Source JSONL SHA-256: \`${digest}\``));
  assert.match(
    citations,
    /"machine_confirmed_openfda_reconciled_pending_clinician":33/,
  );
  assert.match(
    citations,
    /source_policy_use: `\{"interaction-counterevidence":3,"interaction-evidence":30\}`/,
  );
  assert.equal((citations.match(/^### /gmu) ?? []).length, 33);
  for (const rule of RULES) {
    for (const evidence of rule.evidence) {
      assert.match(citations, new RegExp(evidence.provenance.payload_sha256));
    }
  }
  assert.doesNotMatch(
    citations,
    /machine_confirmed_(?:single|multifragment)_pending_clinician/,
  );
});

test('jurisdiction scope is derived from retained action evidence and never inferred for India', () => {
  for (const rule of RULES) {
    const actionJurisdictions = new Set(
      rule.evidence
        .filter((evidence) =>
          evidence.supports.interaction_exists === true
          && evidence.supports.label_action.length > 0,
        )
        .flatMap((evidence) => evidence.supports.jurisdictions),
    );
    const expected = rule.rule_id === 'doxycycline__polyvalent_cation' ? [] : ['US'];
    assert.deepEqual(rule.applicability.jurisdiction, expected, `${rule.rule_id} scope`);
    assert.ok(!rule.applicability.jurisdiction.includes('IN'), `${rule.rule_id} inferred IN`);
    assert.ok(
      rule.claims_needing_citation.every((claim) => !/Indian jurisdiction/.test(claim)),
      `${rule.rule_id} retains stale Indian-jurisdiction prose`,
    );
    if (rule.runtime_enabled) {
      for (const jurisdiction of rule.applicability.jurisdiction) {
        assert.ok(actionJurisdictions.has(jurisdiction), `${rule.rule_id} ${jurisdiction} action`);
      }
    }
  }
});

test('unsupported jurisdictions and actions fail closed', () => {
  const diagnostic = RULES.find(
    (rule) => rule.rule_id === 'erlotinib__proton_pump_inhibitor',
  );
  assert.equal(diagnostic.runtime_enabled, false);
  assert.deepEqual(
    scopedFire(
      ['erlotinib', 'omeprazole'],
      'erlotinib__proton_pump_inhibitor',
      'IN',
    ),
    [],
  );

  const unknown = checkInteractions({
    subjects: [
      { drug: 'erlotinib', route: 'oral', formulation: 'tablet' },
      { drug: 'omeprazole', route: 'oral' },
    ],
    rules: RULES,
    memberSets: MEMBERS,
    patientContext: { indication: 'oncology' },
  }).findings.find((finding) => finding.rule_id === diagnostic.rule_id);
  assert.equal(unknown.clinical_action_status, 'unresolved_pending_jurisdiction');
  assert.deepEqual(unknown.management, {});
  assert.equal(unknown.dispense_action, 'withhold_and_clarify');

  const enabled = structuredClone(diagnostic);
  enabled.runtime_enabled = true;
  enabled.runtime_status.runtime_enabled = true;
  enabled.runtime_status.clinical_context_complete = true;
  enabled.perpetrator.formulation = ['tablet'];

  const unsupportedJurisdiction = structuredClone(enabled);
  unsupportedJurisdiction.applicability.jurisdiction = ['IN'];
  assert.throws(
    () => validateDraftRules([unsupportedJurisdiction]),
    /runtime-enabled jurisdiction IN requires same-jurisdiction interaction and label-action evidence/i,
  );

  const unsupportedAction = structuredClone(enabled);
  for (const evidence of unsupportedAction.evidence) evidence.supports.label_action = [];
  assert.throws(
    () => validateDraftRules([unsupportedAction]),
    /runtime-enabled jurisdiction US requires same-jurisdiction interaction and label-action evidence/i,
  );
});

test('ingredient-only matching cannot prove route or formulation, so affected rows remain diagnostic-only', () => {
  const cases = [
    [['ciprofloxacin', 'calcium carbonate'], 'ciprofloxacin__polyvalent_cation'],
    [['levofloxacin', 'magnesium'], 'levofloxacin__polyvalent_cation'],
    [['moxifloxacin', 'magnesium'], 'moxifloxacin__polyvalent_cation'],
    [['doxycycline', 'magnesium'], 'doxycycline__polyvalent_cation'],
    [['levothyroxine', 'calcium carbonate'], 'levothyroxine__oral_cation_binder'],
    [['levothyroxine', 'omeprazole'], 'levothyroxine__acid_suppressant'],
    [['alendronate', 'calcium carbonate'], 'alendronate__oral_cation_food'],
    [['risedronate', 'calcium carbonate'], 'risedronate_immediate_release__oral_cation_food'],
    [['risedronate', 'calcium carbonate'], 'risedronate_delayed_release__oral_cation_food'],
    [['ibandronate', 'calcium carbonate'], 'ibandronate__oral_cation_food'],
    [['rilpivirine', 'omeprazole'], 'rilpivirine__proton_pump_inhibitor'],
    [['ketoconazole', 'omeprazole'], 'ketoconazole_oral__acid_suppressant'],
    [['itraconazole', 'omeprazole'], 'itraconazole_capsule__acid_suppressant'],
  ];

  for (const [subjects, ruleId] of cases) {
    const rule = RULES.find((candidate) => candidate.rule_id === ruleId);
    assert.ok(rule, `${ruleId} missing`);
    assert.ok(rule.object.route?.length > 0, `${ruleId} route boundary`);
    assert.ok(rule.object.formulation?.length > 0, `${ruleId} formulation boundary`);
    assert.ok(
      rule.risk_factors.some((factor) => /route|formulation|product/.test(factor.factor)),
      `${ruleId} must expose its route/formulation limitation`,
    );
    assert.equal(
      one(subjects, ruleId).runtime_enabled,
      false,
      `${ruleId} ingredient-only match must remain diagnostic`,
    );
  }
});

test('every inline member expansion is explicit-v2 and source-bounded', () => {
  for (const rule of RULES) {
    for (const ref of [rule.object, rule.perpetrator, rule.second_subject]) {
      if (!ref?.class) continue;
      assert.equal(
        ref.members_source,
        'explicit-v2@2026-07-source-bounded',
        `${rule.rule_id} member provenance`,
      );
    }
  }
});
