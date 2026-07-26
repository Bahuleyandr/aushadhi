import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { checkInteractions, resolveRule } from '../src/lib/interaction-engine.mjs';
import { validateDraftRules } from '../src/lib/interaction-draft-validation.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const sectionPath = join(repo, 'docs', 'interaction-review', 'batch-01-v2', 'sections', 'J.verified.jsonl');
const sectionRaw = readFileSync(sectionPath, 'utf8');
const captureArtifactPattern = /(?:^|\r?\n)(?:Exit code:|Wall time:|Total output lines:|Output:)(?:\s|$)|(?:tokens truncated|…\d+\s+tokens truncated…)/i;

function parseSection(raw) {
  if (captureArtifactPattern.test(raw)) {
    throw new Error('Section J contains a command-output wrapper or truncation sentinel');
  }
  return raw
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));
}

const rules = parseSection(sectionRaw);
const byId = Object.fromEntries(rules.map((rule) => [rule.rule_id, rule]));
const evidenceRecords = rules.flatMap((rule) => (
  rule.evidence.map((evidence) => ({ ruleId: rule.rule_id, evidence }))
));
const memberSets = JSON.parse(
  readFileSync(join(repo, 'data-static', 'interaction-member-sets.json'), 'utf8'),
).classes;

function idsFor(subjects, patientContext = {}) {
  return checkInteractions({
    subjects,
    rules,
    memberSets,
    patientContext: { jurisdiction: 'US', ...patientContext },
    includeDiagnostic: true,
  }).findings.map((finding) => finding.rule_id);
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

test('Section J rejects command-output wrappers and truncation sentinels before JSON parsing', () => {
  assert.doesNotMatch(sectionRaw, captureArtifactPattern);
  assert.throws(
    () => parseSection('Exit code: 0\nWall time: 0.5 seconds\nOutput:\n{"rule_id":"bad"}'),
    /command-output wrapper or truncation sentinel/,
  );
  assert.throws(
    () => parseSection('{"rule_id":"bad"}\n…5399 tokens truncated…'),
    /command-output wrapper or truncation sentinel/,
  );
});

test('Section J has 12 source-bounded draft rules with exact lineage and the four-field runtime model', () => {
  assert.doesNotThrow(() => validateDraftRules(rules));
  assert.equal(rules.length, 12);
  assert.equal(new Set(rules.map((rule) => rule.rule_id)).size, 12);
  assert.doesNotMatch(sectionRaw, /<verify>|\b(?:todo|tbd|tbc|fixme)\b/i);

  const sourceLineage = {};
  for (const rule of rules) {
    for (const sourceRow of rule.source_rows) {
      sourceLineage[sourceRow] = (sourceLineage[sourceRow] ?? 0) + 1;
    }
  }
  assert.deepEqual(sourceLineage, { 96: 5, 97: 1, 98: 1, 99: 4, 100: 1 });

  const runtimeKeys = [
    'clinical_context_complete',
    'pair_matcher_executable',
    'promotion_eligible',
    'runtime_enabled',
  ];
  for (const rule of rules) {
    assert.deepEqual(Object.keys(rule.runtime_status).sort(), runtimeKeys, `${rule.rule_id} runtime_status shape`);
    assert.equal(rule.runtime_enabled, rule.runtime_status.runtime_enabled, `${rule.rule_id} runtime mirror`);
    assert.equal(rule.runtime_status.promotion_eligible, false, `${rule.rule_id} must remain non-promotable`);
    assert.ok(Object.hasOwn(rule.management, 'action_target'), `${rule.rule_id} missing action_target`);
    assert.ok(Array.isArray(rule.management.do_not_interrupt), `${rule.rule_id} missing do_not_interrupt`);
    assert.ok(Array.isArray(rule.risk_factors) && rule.risk_factors.length > 0, `${rule.rule_id} missing risk_factors`);
    assert.ok(rule.risk_factors.every((factor) => typeof factor.gateable === 'boolean'), `${rule.rule_id} risk factor gateability`);
    assert.ok(Array.isArray(rule.claims_needing_citation) && rule.claims_needing_citation.length > 0, `${rule.rule_id} missing citation claims`);
    assert.ok(
      rule.claims_needing_citation.every(
        (claim) => !/<verify>|\b(?:todo|tbd|tbc|fixme|provisional)\b/i.test(claim),
      ),
      `${rule.rule_id} has an unresolved citation marker`,
    );
    for (const ref of [
      rule.object,
      rule.perpetrator ?? rule.second_subject ?? rule.coadministered_with,
    ]) {
      assert.equal(
        ref?.drug !== undefined && ref?.class !== undefined,
        false,
        `${rule.rule_id} redundant exact-drug class annotation`,
      );
    }
    if (rule.rule_id === 'sulfonylurea__miconazole_candidate') {
      assert.deepEqual(rule.evidence, []);
      assert.equal(rule.runtime_status.pair_matcher_executable, false);
      assert.deepEqual(rule.applicability.jurisdiction, []);
    } else {
      assert.ok(rule.evidence.length > 0, `${rule.rule_id} missing evidence`);
    }
  }

  assert.equal(rules.filter((rule) => rule.runtime_enabled).length, 0);
  assert.equal(evidenceRecords.length, 21);
  assert.deepEqual(
    rules.filter((rule) => rule.runtime_enabled).map((rule) => rule.rule_id),
    [],
  );

  const fragmentHashes = [];
  for (const { ruleId, evidence } of evidenceRecords) {
    assert.match(evidence.source_id, /^J-US\d{2}$/u, `${ruleId} source_id`);
    assert.equal(evidence.source_policy_id, 'openfda-labels');
    assert.equal(evidence.licence, 'CC0-1.0');
    assert.equal(evidence.jurisdiction, 'US');
    assert.match(evidence.source_url, /^https:\/\//u, `${ruleId}:${evidence.source_id} source_url`);
    assert.equal(new URL(evidence.source_url).hostname.replace(/^www\./u, ''), evidence.source_host, `${ruleId}:${evidence.source_id} source_host`);
    assert.ok(evidence.regulator.length > 0, `${ruleId}:${evidence.source_id} regulator`);
    assert.ok(evidence.product.length > 0, `${ruleId}:${evidence.source_id} product`);
    assert.ok(evidence.publisher.length > 0, `${ruleId}:${evidence.source_id} publisher`);
    assert.ok(evidence.label_section.length > 0, `${ruleId}:${evidence.source_id} label_section`);
    assert.ok(evidence.normalized_proposition.length > 0, `${ruleId}:${evidence.source_id} normalized_proposition`);
    assert.match(evidence.currentness_status, /^checked_current(?:_[a-z0-9]+)*$/u, `${ruleId}:${evidence.source_id} currentness`);
    assert.match(evidence.citation_status, /^machine_confirmed(?:_[a-z0-9]+)*_pending_clinician$/u, `${ruleId}:${evidence.source_id} citation_status`);
    assert.equal(evidence.supports.interaction_exists, true, `${ruleId}:${evidence.source_id} interaction flag`);
    assert.match(evidence.supports.evidence_role, /^(?:direct_interaction|terminology_identity|professional_guidance_landing_scope|product_route_scope_boundary|label_heterogeneity|candidate_effect_boundary)$/u);
    assert.equal(evidence.supports.runtime_severity_is_local_mapping, true, `${ruleId}:${evidence.source_id} severity boundary`);
    assert.ok(evidence.supports.source_effect.length > 0, `${ruleId}:${evidence.source_id} source effect`);
    assert.ok(evidence.supports.scope.scope_type.length > 0, `${ruleId}:${evidence.source_id} scope`);
    assert.ok(evidence.does_not_by_itself_support.length > 0, `${ruleId}:${evidence.source_id} limitations`);
    assert.equal(Object.hasOwn(evidence, 'excerpt'), false, `${ruleId}:${evidence.source_id} legacy excerpt`);
    for (const fragment of evidence.fragments) {
      assert.equal(fragment.text_sha256, sha256(fragment.text), `${ruleId}:${evidence.source_id} fragment hash`);
      fragmentHashes.push(fragment.text_sha256);
    }
  }
  assert.equal(fragmentHashes.length, 41);
  assert.equal(new Set(fragmentHashes).size, 41);
});

test('Section J effect claims have direct source-fragment coverage', () => {
  const evidenceFor = (ruleId, sourceId) => (
    byId[ruleId].evidence.find((evidence) => evidence.source_id === sourceId)
  );
  const fragmentText = (evidence) => evidence.fragments.map((fragment) => fragment.text).join(' ');

  const diflucan = evidenceFor('sulfonylurea__fluconazole', 'J-US01');
  assert.match(fragmentText(diflucan), /clinically significant hypoglycemia/i);
  assert.match(fragmentText(diflucan), /one fatality.*DIFLUCAN and glyburide/i);
  assert.match(fragmentText(diflucan), /increases the plasma concentration of these agents/i);

  for (const [sourceId, product] of [['J-US08', 'ISOVUE'], ['J-US09', 'ULTRAVIST']]) {
    const contrast = evidenceFor('metformin__iodinated_contrast_media', sourceId);
    assert.match(fragmentText(contrast), /increase the risk of metformin-induced lactic acidosis.*worsening renal function/i);
    assert.match(fragmentText(contrast), new RegExp(`prior to, ${product} administration`, 'i'));
  }

  const mercaptopurine = evidenceFor('thiopurine__allopurinol', 'J-US13');
  assert.match(fragmentText(mercaptopurine), /Allopurinol can inhibit.*increased risk of mercaptopurine adverse reactions.*myelosuppression/i);

  const cipro = evidenceFor('theophylline__ciprofloxacin', 'J-US15');
  assert.match(fragmentText(cipro), /Plasma Exposure Likely to be Increased and Prolonged/i);

  const currentKcl = evidenceFor('potassium_chloride_solid_oral__gi_transit_slowing', 'J-US18');
  assert.match(fragmentText(currentKcl), /ulcerative and\/or stenotic lesions.*prolonged period of time/i);

  const historicalKcl = evidenceFor('potassium_chloride_solid_oral__gi_transit_slowing', 'J-US17');
  assert.deepEqual(
    historicalKcl.supports.source_effect,
    ['structural_pathological_or_pharmacologic_cause_for_arrest_or_delay_in_tablet_passage'],
  );
});

test('each executable Section J rule has a canonical unordered pair fixture', () => {
  const fixtures = [
    ['sulfonylurea__fluconazole', ['glyburide', 'fluconazole']],
    ['sulfonylurea__gemfibrozil', ['glyburide', 'gemfibrozil']],
    ['sulfonylurea__alcohol', ['glyburide', 'alcohol']],
    ['metformin__iodinated_contrast_media', ['metformin', 'iohexol']],
    ['thiopurine__allopurinol', ['azathioprine', 'allopurinol']],
    ['theophylline__ciprofloxacin', ['theophylline', 'ciprofloxacin']],
    ['theophylline__fluvoxamine', ['theophylline', 'fluvoxamine']],
    ['theophylline__cimetidine', ['theophylline', 'cimetidine']],
    ['theophylline__mexiletine', ['theophylline', 'mexiletine']],
    ['potassium_chloride_solid_oral__gi_transit_slowing', ['potassium chloride', 'oxybutynin']],
  ];

  assert.deepEqual(
    fixtures.map(([ruleId]) => ruleId),
    rules
      .filter((rule) => rule.runtime_status.pair_matcher_executable)
      .map((rule) => rule.rule_id),
  );
  for (const [expected, subjects] of fixtures) {
    assert.deepEqual(idsFor(subjects), [expected], `${subjects.join(' + ')} canonical pair`);
    assert.deepEqual(idsFor([...subjects].reverse()), [expected], `${subjects.join(' + ')} reverse pair`);
    assert.deepEqual(
      idsFor(subjects, { jurisdiction: 'IN' }),
      [],
      `${subjects.join(' + ')} must not cross its US source jurisdiction`,
    );
  }
});

test('Section J canonical non-pairs do not over-expand member, formulation, procedure, or ingredient scope', () => {
  const nonPairs = [
    ['glimepiride', 'fluconazole'],
    ['gliclazide', 'fluconazole'],
    ['gliclazide', 'gemfibrozil'],
    ['glimepiride', 'gemfibrozil'],
    ['glipizide', 'gemfibrozil'],
    ['tolbutamide', 'gemfibrozil'],
    ['chlorpropamide', 'gemfibrozil'],
    ['repaglinide', 'gemfibrozil'],
    ['glibenclamide', 'gemfibrozil'],
    ['gliclazide', 'sulfamethoxazole'],
    ['gliclazide', 'trimethoprim'],
    ['tolbutamide', 'miconazole'],
    ['chlorpropamide', 'miconazole'],
    ['glyburide', 'miconazole'],
    ['glipizide', 'miconazole'],
    ['glimepiride', 'miconazole'],
    ['glibenclamide', 'miconazole'],
    ['glipizide', 'clotrimazole'],
    ['metformin', 'gadolinium'],
    ['azathioprine', 'febuxostat'],
    ['aminophylline', 'ciprofloxacin'],
    ['aminophylline', 'fluvoxamine'],
    ['aminophylline', 'cimetidine'],
    ['aminophylline', 'mexiletine'],
    ['theophylline', 'levofloxacin'],
    ['theophylline', 'ofloxacin'],
    ['potassium citrate', 'oxybutynin'],
    ['potassium chloride', 'hyoscine'],
    ['potassium chloride', 'loperamide'],
    ['potassium chloride', 'codeine'],
    ['potassium chloride', 'amitriptyline'],
    ['chlorpropamide', 'alcohol'],
  ];
  for (const subjects of nonPairs) {
    assert.deepEqual(idsFor(subjects), [], `${subjects.join(' + ')} must not match`);
  }
});

test('gemfibrozil matches only the source-named glyburide token', () => {
  const rule = byId.sulfonylurea__gemfibrozil;
  assert.deepEqual(rule.object.members, ['glyburide']);
  assert.deepEqual(rule.object.member_exceptions, ['repaglinide']);
  assert.match(rule.object.members_note, /LOPID directly names glyburide/i);
  assert.match(rule.object.members_note, /no synonym expansion/i);
  assert.deepEqual(rule.evidence.map((item) => item.source_id), ['J-US03']);
  assert.equal(rule.runtime_status.pair_matcher_executable, true);
  assert.equal(rule.runtime_enabled, false);
  assert.deepEqual(idsFor(['glyburide', 'gemfibrozil']), ['sulfonylurea__gemfibrozil']);
  assert.deepEqual(idsFor(['glibenclamide', 'gemfibrozil']), []);
});

test('co-trimoxazole retains exact combination aliases but stays non-executable without product binding', () => {
  const rule = byId.sulfonylurea__co_trimoxazole;
  assert.equal(rule.perpetrator.drug, undefined);
  assert.equal(rule.perpetrator.class, 'trimethoprim_or_cotrimoxazole');
  assert.equal(rule.perpetrator.members_source, 'curated@2026-07');
  assert.deepEqual(rule.perpetrator.members, ['co-trimoxazole', 'sulfamethoxazole-trimethoprim']);
  const curatedMembers = Object.values(memberSets[rule.perpetrator.class]).flat();
  assert.ok(rule.perpetrator.members.every((member) => curatedMembers.includes(member)));
  assert.equal(rule.runtime_status.pair_matcher_executable, false);
  assert.equal(rule.runtime_status.clinical_context_complete, false);
  assert.equal(rule.runtime_enabled, false);
  assert.deepEqual(idsFor(['glyburide', 'co-trimoxazole']), []);
  assert.deepEqual(idsFor(['glyburide', 'sulfamethoxazole-trimethoprim']), []);
  assert.deepEqual(idsFor(['glyburide', 'sulfamethoxazole']), []);
  assert.deepEqual(idsFor(['glyburide', 'trimethoprim']), []);
});

test('alcohol is a glyburide-only diagnostic with no invented dose or avoidance action', () => {
  const rule = byId.sulfonylurea__alcohol;
  assert.deepEqual(rule.object.members, ['glyburide']);
  assert.equal(rule.perpetrator.substance, 'alcohol');
  assert.equal(rule.management.dispense_action, 'supply_with_counselling');
  assert.equal(rule.management.action_target, null);
  assert.deepEqual(rule.management.do_not_interrupt, ['object_drug']);
  assert.equal(rule.runtime_status.pair_matcher_executable, true);
  assert.equal(rule.runtime_enabled, false);
  assert.deepEqual(rule.evidence.map((item) => item.source_id), ['J-US04']);
  assert.ok(
    rule.evidence[0].supports.source_effect
      .includes('hypoglycemia_more_likely_when_alcohol_is_ingested'),
  );
  assert.deepEqual(rule.evidence[0].supports.label_action, []);
  assert.match(rule.management.exceptions, /Only glyburide is represented/i);
  assert.deepEqual(idsFor(['glyburide', 'alcohol']), ['sulfonylurea__alcohol']);
  for (const unsupported of ['gliclazide', 'glimepiride', 'glipizide', 'glibenclamide', 'tolbutamide', 'chlorpropamide']) {
    assert.deepEqual(idsFor([unsupported, 'alcohol']), []);
  }
});

test('miconazole remains an evidence-empty non-executable backlog candidate', () => {
  const rule = byId.sulfonylurea__miconazole_candidate;
  assert.deepEqual(rule.object.members, []);
  assert.deepEqual(rule.evidence, []);
  assert.deepEqual(rule.applicability.jurisdiction, []);
  assert.equal(rule.runtime_status.pair_matcher_executable, false);
  assert.equal(rule.runtime_enabled, false);
  assert.equal(
    rule._non_runtime_placeholder.severity,
    'schema_placeholder_not_a_source_claim',
  );
  assert.match(rule.management.prescriber_action, /No runtime action is authorized/i);
  for (const member of ['gliclazide', 'glipizide', 'glimepiride', 'glibenclamide', 'glyburide']) {
    assert.deepEqual(idsFor([member, 'miconazole']), []);
  }
});

test('metformin contrast retains only the openFDA candidate and records ingredient-only route overmatch', () => {
  const rule = byId.metformin__iodinated_contrast_media;

  assert.deepEqual(
    rule.applicability.indication,
    ['peri-procedural imaging with iodinated contrast'],
  );
  assert.equal(rule.runtime_status.pair_matcher_executable, true);
  assert.equal(rule.runtime_enabled, false);
  assert.deepEqual(idsFor(['metformin', 'iohexol']), ['metformin__iodinated_contrast_media']);
  assert.ok(rule.selector_limitations.some((entry) => entry.limitation === 'ingredient_only_route_overmatch'));

  assert.deepEqual(
    rule.policy_branches.map((branch) => branch.policy_id),
    ['fda_metformin_label'],
  );
  const fda = rule.policy_branches.find((branch) => branch.policy_id === 'fda_metformin_label');
  assert.equal(fda.action, 'hold_metformin_and_reassess_before_restart');
  assert.equal(
    rule.policy_reconciliation.status,
    'single_openfda_candidate_not_runtime_executable',
  );

  const lowRisk = resolveRule(rule, { renal: { egfr: 75 } });
  assert.equal(lowRisk.severity, 'moderate');
  assert.equal(lowRisk.dispense_action, 'supply_with_counselling');

  const renalHold = resolveRule(rule, { renal: { egfr: 45 } });
  assert.equal(renalHold.severity, 'major');
  assert.equal(renalHold.dispense_action, 'withhold_and_clarify');
  assert.equal(renalHold.basis, 'present:egfr_lt_60');

  const independentRestriction = resolveRule(rule, { renal: { egfr: 20 } });
  assert.equal(independentRestriction.severity, 'contraindicated');
  assert.equal(independentRestriction.dispense_action, 'withhold_and_clarify');
  assert.equal(independentRestriction.basis, 'present:egfr_lt_30');
  assert.equal(rule.independent_restrictions[0].relationship_to_pair, 'independent_drug_condition_not_caused_by_contrast');

  const hepaticHold = resolveRule(rule, { renal: { egfr: 75 }, hepatic: { flag: 'impaired' } });
  assert.equal(hepaticHold.severity, 'major');
  assert.equal(hepaticHold.dispense_action, 'withhold_and_clarify');
  assert.equal(hepaticHold.basis, 'present:hepatic_impaired');

  assert.equal(rule.context_modifiers.find((modifier) => modifier.when === 'egfr_lt_60').policy_scope, 'fda_label_candidate_only');
  assert.equal(rule.context_modifiers.find((modifier) => modifier.when === 'hepatic_impaired').policy_scope, 'fda_label_candidate_only');
  assert.ok(rule.risk_factors.some((entry) => entry.factor === 'alcoholism_or_heart_failure' && !entry.gateable && entry.drives_tier));
  assert.ok(rule.risk_factors.some((entry) => entry.factor === 'exact_product_presentation_and_route' && !entry.gateable && entry.drives_tier));
  assert.deepEqual(
    rule.evidence.map((item) => item.source_id),
    ['J-US06', 'J-US07', 'J-US10', 'J-US08', 'J-US09', 'J-US11'],
  );
  for (const [sourceId, ingredient] of [
    ['J-US08', 'iopamidol'],
    ['J-US09', 'iopromide'],
    ['J-US11', 'diatrizoate meglumine'],
  ]) {
    const item = rule.evidence.find((entry) => entry.source_id === sourceId);
    assert.ok(item, `${sourceId} evidence record`);
    assert.ok(item.supports.scope.contrast_members.includes(ingredient), `${sourceId} ${ingredient} scope`);
  }
  assert.equal(
    rule.evidence.some((entry) => entry.source_id.startsWith('J-ACR')),
    false,
  );
  assert.ok(rule.selector_limitations.some((entry) => entry.limitation === 'diatrizoate_salt_product_identity_partial'));
});

test('fluconazole diagnostic scope is limited to the three sulfonylureas directly studied in US evidence', () => {
  const rule = byId.sulfonylurea__fluconazole;
  assert.equal(rule.runtime_enabled, false);
  assert.deepEqual(rule.applicability.jurisdiction, ['US']);
  assert.deepEqual(rule.object.members, ['tolbutamide', 'glipizide', 'glyburide']);
  assert.deepEqual(rule.evidence.map((item) => item.source_id), ['J-US01']);
  assert.deepEqual(
    rule.evidence[0].supports.scope.victim_members_directly_studied,
    rule.object.members,
  );
  for (const member of rule.object.members) {
    assert.deepEqual(idsFor([member, 'fluconazole']), ['sulfonylurea__fluconazole']);
  }
  for (const unsupported of ['glimepiride', 'gliclazide', 'glibenclamide']) {
    assert.deepEqual(idsFor([unsupported, 'fluconazole']), []);
  }
});

test('thiopurine scope is exact, source fractions are retained in evidence, and runtime management stays calculation-free', () => {
  const rule = byId.thiopurine__allopurinol;
  assert.deepEqual(rule.object.members, ['azathioprine', 'mercaptopurine']);
  assert.equal(rule.management.specialist_dose_branch.required, true);
  assert.equal(rule.management.specialist_dose_branch.gateable, false);
  assert.doesNotMatch(rule.management.specialist_dose_branch.instruction, /%|\bquarter\b|\bthird\b|\bhalf\b|\b25\b|\b75\b/i);
  assert.equal(rule.source_dose_quarantine.evidence_status, 'official_sources_confirmed');
  assert.equal(rule.source_dose_quarantine.local_mapping_status, 'prescriber_specialist_action_not_runtime_approved');
  assert.equal(rule.source_dose_quarantine.management_value_withheld, true);
  assert.equal(rule.source_dose_quarantine.runtime_use, 'metadata_only_non_executable');
  const azathioprineEvidence = rule.evidence.find((item) => item.source_id === 'J-US12');
  const mercaptopurineEvidence = rule.evidence.find((item) => item.source_id === 'J-US13');
  assert.ok(azathioprineEvidence.supports.label_action.includes('reduce_imuran_to_approximately_one_third_to_one_quarter_of_usual_dose'));
  assert.ok(mercaptopurineEvidence.supports.label_action.includes('reduce_mercaptopurine_to_one_third_to_one_quarter_of_current_dose'));
  assert.match(rule.source_dose_quarantine.source_actions.azathioprine, /one-third to one-quarter of (?:the )?usual dose/i);
  assert.match(rule.source_dose_quarantine.source_actions.mercaptopurine, /one-third to one-quarter of (?:the )?current dose/i);
  assert.deepEqual(idsFor(['mercaptopurine', 'allopurinol']), ['thiopurine__allopurinol']);
});

test('theophylline is decomposed into four exact diagnostic children with source actions quarantined', () => {
  const expected = {
    theophylline__ciprofloxacin: {
      perpetrator: 'ciprofloxacin',
      action: 'withhold_and_clarify',
      sourceAction: 'avoid_concomitant_use',
      quantitativeClaim: null,
    },
    theophylline__fluvoxamine: {
      perpetrator: 'fluvoxamine',
      action: 'withhold_and_clarify',
      sourceAction: 'specialist_theophylline_dose_reduction',
      quantitativeClaim: 'one-third of usual daily maintenance dose',
    },
    theophylline__cimetidine: {
      perpetrator: 'cimetidine',
      action: 'confirm_and_monitor',
      sourceAction: 'theophylline_exposure_increase',
      quantitativeClaim: '+70% average steady-state concentration',
    },
    theophylline__mexiletine: {
      perpetrator: 'mexiletine',
      action: 'confirm_and_monitor',
      sourceAction: 'theophylline_exposure_increase',
      quantitativeClaim: '+80% average steady-state concentration',
    },
  };

  for (const [id, expectation] of Object.entries(expected)) {
    const rule = byId[id];
    assert.equal(rule.object.drug, 'theophylline');
    assert.equal(rule.perpetrator.drug, expectation.perpetrator);
    assert.deepEqual(rule.source_rows, [99]);
    assert.equal(rule.management.dispense_action, expectation.action);
    assert.equal(rule.runtime_status.pair_matcher_executable, true);
    assert.equal(rule.runtime_enabled, false);
    assert.equal(rule.severity_status, 'local_mapping_unapproved_runtime_quarantined');
    assert.equal(rule.source_action_quarantine.source_action, expectation.sourceAction);
    assert.equal(rule.source_action_quarantine.quantitative_claim, expectation.quantitativeClaim);
    assert.equal(rule.source_action_quarantine.evidence_status, 'official_source_confirmed');
    assert.equal(rule.source_action_quarantine.local_mapping_status, 'clinician_approval_required');
    assert.equal(rule.source_action_quarantine.runtime_use, 'metadata_only_non_executable');
  }

  assert.deepEqual(idsFor(['theophylline', 'ofloxacin']), []);
  assert.deepEqual(idsFor(['theophylline', 'levofloxacin']), []);
  assert.match(byId.theophylline__ciprofloxacin.management.exceptions, /Ofloxacin is an old-table negative/);
  assert.match(byId.theophylline__ciprofloxacin.management.exceptions, /levofloxacin is unresolved/i);
  for (const id of ['theophylline__ciprofloxacin', 'theophylline__cimetidine', 'theophylline__mexiletine']) {
    const oldTable = byId[id].evidence.find((item) => item.source_id === 'J-US14');
    assert.deepEqual(oldTable.supports.label_action, [], `${id} old table remains effect-only`);
    assert.ok(oldTable.does_not_by_itself_support.some((limitation) => /1995/.test(limitation)), `${id} old-table provenance`);
  }
});

test('solid oral potassium chloride excludes ambiguous hyoscine and discloses heterogeneous product labels', () => {
  const rule = byId.potassium_chloride_solid_oral__gi_transit_slowing;
  assert.deepEqual(rule.perpetrator.members, ['atropine', 'oxybutynin']);
  assert.ok(rule.object.formulation.includes('solid_oral'));
  assert.deepEqual(rule.scope_exclusions.ambiguous_identity_not_matched, ['hyoscine']);
  assert.deepEqual(
    rule.scope_exclusions.broad_transit_slowing_members_not_matched,
    ['loperamide', 'codeine', 'amitriptyline'],
  );
  assert.equal(rule.label_heterogeneity.status, 'current_product_specific_conflict_confirmed_pending_local_policy');
  assert.deepEqual(rule.label_heterogeneity.supporting_sources, ['J-US17', 'J-US18']);
  assert.deepEqual(
    rule.evidence.find((item) => item.source_id === 'J-US17').supports.label_action,
    ['contraindicated_for_solid_oral_kcl_when_passage_is_delayed'],
  );
  assert.equal(rule.runtime_status.pair_matcher_executable, true);
  assert.equal(rule.runtime_enabled, false);
  assert.deepEqual(idsFor(['potassium chloride', 'hyoscine']), []);
});

test('Section J citation and reconciliation documents are pinned to the frozen slice', () => {
  const digest = sha256(sectionRaw);
  for (const file of [
    '2026-07-23-section-J-citations.md',
    '2026-07-23-section-J-reconciled.md',
  ]) {
    const body = readFileSync(
      join(repo, 'docs', 'interaction-review', file),
      'utf8',
    );
    assert.match(body, new RegExp(`JSONL SHA-256: \`${digest}\``, 'u'), file);
  }
});
