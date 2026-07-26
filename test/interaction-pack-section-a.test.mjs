import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkInteractions,
  checkRuntimeInteractions,
} from '../src/lib/interaction-engine.mjs';
import {
  assertEvidenceAllowed,
  loadSourceManifest,
} from '../src/lib/interaction-source-policy.mjs';
import { validateDraftRules } from '../src/lib/interaction-draft-validation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sectionPath = path.join(
  root,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'sections',
  'A.verified.jsonl',
);
const rules = fs.readFileSync(sectionPath, 'utf8')
  .trim()
  .split(/\r?\n/u)
  .map(JSON.parse);
const sourceManifest = loadSourceManifest();
const sourcePayloadDirectory = process.env.AUSHADHI_OPENFDA_PAYLOAD_DIR;
const memberSets = JSON.parse(fs.readFileSync(
  path.join(root, 'data-static', 'interaction-member-sets.json'),
  'utf8',
)).classes;
const runtimeKeys = [
  'clinical_context_complete',
  'pair_matcher_executable',
  'promotion_eligible',
  'runtime_enabled',
];

function findings(subjects, patientContext = {}) {
  return checkInteractions({
    subjects,
    rules,
    memberSets,
    patientContext: { jurisdiction: 'US', ...patientContext },
  }).findings;
}

function finding(subjects, ruleId, patientContext = {}) {
  return findings(subjects, patientContext).find((item) => item.rule_id === ruleId);
}

function ruleById(ruleId) {
  const rule = rules.find((candidate) => candidate.rule_id === ruleId);
  assert.ok(rule, ruleId);
  return rule;
}

function openFdaEvidenceRecords() {
  return rules.flatMap((rule) => rule.evidence.map((evidence) => ({
    evidence,
    ruleId: rule.rule_id,
  }))).filter(({ evidence }) => evidence.source_policy_id === 'openfda-labels');
}

function openFdaPayload(evidence) {
  const envelope = JSON.parse(fs.readFileSync(
    path.join(
      sourcePayloadDirectory,
      `${evidence.provenance.set_id}.response.json`,
    ),
    'utf8',
  ));
  const matches = envelope.results.filter((payload) =>
    String(payload.set_id).toLowerCase() === evidence.provenance.set_id.toLowerCase()
    && String(payload.version) === evidence.provenance.version
    && String(payload.effective_time) === evidence.provenance.effective_time);
  assert.equal(
    matches.length,
    1,
    `${evidence.source_id} must select exactly one supplied SPL payload`,
  );
  return matches[0];
}

function govUkEvidenceRecords() {
  return rules.flatMap((rule) => rule.evidence.map((evidence) => ({
    evidence,
    ruleId: rule.rule_id,
  }))).filter(
    ({ evidence }) =>
      evidence.source_policy_id === 'mhra-govuk-drug-safety-updates',
  );
}

function govUkPayload(evidence) {
  return {
    content_api: JSON.parse(fs.readFileSync(
      path.join(
        sourcePayloadDirectory,
        `${evidence.document_id}.govuk-content.json`,
      ),
      'utf8',
    )),
    content_api_url: evidence.provenance.payload_url,
    page_html: fs.readFileSync(
      path.join(
        sourcePayloadDirectory,
        `${evidence.document_id}.page.html`,
      ),
      'utf8',
    ),
    page_url: evidence.source_url,
  };
}

test('Section A has explicit four-boolean runtime status, a mirrored top-level gate, and no promotable rules', () => {
  assert.equal(rules.length, 33);
  assert.equal(rules.filter((rule) => rule.runtime_enabled).length, 0);
  assert.doesNotThrow(() => validateDraftRules(rules));
  for (const rule of rules) {
    assert.deepEqual(Object.keys(rule.runtime_status).sort(), runtimeKeys, rule.rule_id);
    assert.ok(
      Object.values(rule.runtime_status).every((value) => typeof value === 'boolean'),
      rule.rule_id,
    );
    assert.equal(rule.runtime_enabled, rule.runtime_status.runtime_enabled, rule.rule_id);
    assert.equal(rule.runtime_status.clinical_context_complete, false, rule.rule_id);
    assert.equal(rule.runtime_status.runtime_enabled, false, rule.rule_id);
    assert.equal(rule.runtime_status.promotion_eligible, false, rule.rule_id);
  }
});

test('Section A applicability jurisdictions are bounded by the retained evidence jurisdictions', () => {
  for (const rule of rules) {
    const evidenceJurisdictions = [
      ...new Set(rule.evidence.flatMap((evidence) => evidence.supports.jurisdictions)),
    ];
    assert.deepEqual(
      rule.applicability.jurisdiction,
      evidenceJurisdictions,
      rule.rule_id,
    );
  }
  assert.equal(
    rules.filter((rule) => rule.applicability.jurisdiction.includes('US')).length,
    29,
  );
  assert.deepEqual(
    rules
      .filter((rule) => rule.applicability.jurisdiction.includes('UK'))
      .map((rule) => rule.rule_id),
    ['warfarin__miconazole_oromucosal_gel', 'warfarin__tramadol'],
  );
  assert.equal(
    rules.some((rule) => rule.applicability.jurisdiction.includes('IN')),
    false,
  );
  assert.deepEqual(
    rules
      .filter((rule) => rule.applicability.jurisdiction.length === 0)
      .map((rule) => rule.rule_id)
      .sort(),
    [
      'aspirin__nsaid_additive_gi_bleeding',
      'aspirin_ld_ir__ibuprofen_timing',
    ].sort(),
  );
});

test('Section A draft review enforces source jurisdiction and remains outside the production runtime path', () => {
  assert.deepEqual(
    findings(['warfarin', 'fluconazole']).map((item) => item.rule_id),
    ['warfarin__fluconazole'],
  );
  assert.deepEqual(
    findings(['warfarin', 'fluconazole'], { jurisdiction: 'UK' }),
    [],
  );
  assert.deepEqual(
    findings(['warfarin', 'tramadol'], { jurisdiction: 'UK' })
      .map((item) => item.rule_id),
    ['warfarin__tramadol'],
  );
  const runtime = checkRuntimeInteractions({
      subjects: [
        { drug: 'warfarin', route: 'oral', formulation: 'tablet' },
        { drug: 'fluconazole', route: 'oral', formulation: 'tablet' },
      ],
      rules,
      patientContext: { jurisdiction: 'US' },
    });
  assert.deepEqual(runtime.findings, []);
  assert.equal(runtime.coverage.rules_total, 0);
});

test('Section A schema reconciliation preserves dose scope while normalizing indication and n-ary metadata', () => {
  for (const ruleId of [
    'warfarin__tramadol',
    'edoxaban__pgp_inducer',
    'clopidogrel__cyp2c19_inhibiting_ppi',
  ]) {
    const rule = ruleById(ruleId);
    assert.match(rule.management.action_target, /newly_added/u);
    assert.equal(rule.runtime_status.clinical_context_complete, false, ruleId);
  }

  const apixaban = ruleById('apixaban__strong_cyp3a4_pgp_inhibitor');
  assert.equal(apixaban.applicability.indication, null);
  assert.match(JSON.stringify(apixaban), /2\.5 mg|5 mg|10 mg/u);

  assert.deepEqual(
    ruleById('aspirin_ld_ir__ibuprofen_timing').applicability.indication,
    ['cardioprotective'],
  );

  const tripleTherapy = ruleById(
    'dual_antiplatelet__oral_anticoagulant_triple_therapy',
  );
  assert.ok(Array.isArray(tripleTherapy.object.combination));
  assert.equal(Object.hasOwn(tripleTherapy.object, 'route'), false);
  assert.equal(Object.hasOwn(tripleTherapy.object, 'formulation'), false);
});

test('Section A fails closed while preserving source-bounded diagnostic matchers', () => {
  assert.deepEqual(
    rules.filter((rule) => rule.runtime_enabled).map((rule) => rule.rule_id),
    [],
  );
  assert.equal(
    rules.filter((rule) => rule.runtime_status.pair_matcher_executable).length,
    27,
  );
});

test('the corrected macrolide strength selector fires diagnostically for both curated members', () => {
  const ruleId = 'warfarin__macrolide_cyp_inhibitor';
  for (const macrolide of ['clarithromycin', 'erythromycin']) {
    const match = finding(['warfarin', macrolide], ruleId);
    assert.ok(match, macrolide);
    assert.equal(match.runtime_enabled, false, macrolide);
  }
});

test('evidence-declared Section A class rosters are pinned and do not drift through shared member sets', () => {
  const ssriSnri = ruleById('warfarin__ssri_snri');
  assert.deepEqual(ssriSnri.perpetrator.members, [
    'fluoxetine',
    'sertraline',
    'paroxetine',
    'citalopram',
    'escitalopram',
    'venlafaxine',
    'duloxetine',
  ]);
  assert.equal(finding(['warfarin', 'fluvoxamine'], ssriSnri.rule_id), undefined);
  assert.ok(finding(['warfarin', 'sertraline'], ssriSnri.rule_id));

  const heparin = ruleById('heparin_lmwh__nsaid_or_antiplatelet_bleeding');
  assert.deepEqual(heparin.object.members, [
    'unfractionated heparin',
    'enoxaparin',
    'dalteparin',
    'tinzaparin',
  ]);
  assert.equal(
    finding(['nadroparin', 'aspirin'], heparin.rule_id),
    undefined,
  );
  assert.ok(finding(['enoxaparin', 'aspirin'], heparin.rule_id));
});

test('rivaroxaban and clarithromycin is typed counterevidence without a bleeding-risk claim', () => {
  const rule = ruleById('rivaroxaban__strong_cyp3a4_pgp_inhibitor');
  const counterevidence = rule.evidence.find(
    (entry) => entry.source_id === 'fda-label-rivaroxaban-clarithromycin-exception',
  );
  assert.ok(counterevidence);
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
  assert.doesNotMatch(JSON.stringify(counterevidence), /increased_bleeding_risk/u);
  assert.equal(finding(['rivaroxaban', 'clarithromycin'], rule.rule_id), undefined);
});

test('dabigatran avoid actions map conservatively to major and unsupported renal logic is absent', () => {
  for (const [ruleId, predicate] of [
    ['dabigatran_nvaf__dronedarone_or_ketoconazole', 'crcl_lt_30'],
    ['dabigatran_vte__pgp_inhibitor', 'crcl_lt_50'],
    ['dabigatran_hip_prophylaxis__pgp_inhibitor', 'crcl_lt_50'],
  ]) {
    const rule = ruleById(ruleId);
    const modifiers = Array.isArray(rule.context_modifiers)
      ? rule.context_modifiers
      : [rule.context_modifiers];
    const modifier = modifiers.find((entry) => entry.when === predicate);
    assert.ok(modifier, `${ruleId}/${predicate}`);
    assert.equal(modifier.severity, 'major', `${ruleId}/${predicate}`);
    assert.notEqual(modifier.severity, 'contraindicated', `${ruleId}/${predicate}`);
  }

  const noAdjustment = ruleById(
    'dabigatran_nvaf__no_dose_adjustment_pgp_inhibitor',
  );
  assert.deepEqual(noAdjustment.context_modifiers, []);
  assert.doesNotMatch(
    JSON.stringify(noAdjustment.management),
    /avoid all P-gp inhibitors|context_modifier crcl_lt_30/iu,
  );
});

test('unsupported CYP claims stay absent while the approved amiodarone persistence is retained', () => {
  const fluconazole = ruleById('warfarin__fluconazole');
  assert.doesNotMatch(
    fluconazole.mechanism,
    /S-warfarin|dose-dependent/iu,
  );
  assert.deepEqual(fluconazole.object.formulation, ['tablet']);
  assert.deepEqual(fluconazole.perpetrator.route, ['oral']);
  assert.deepEqual(fluconazole.perpetrator.formulation, ['tablet']);
  assert.deepEqual(fluconazole.context_modifiers, []);
  assert.match(fluconazole.management.duration, /4 to 5 days after discontinuation/iu);
  assert.match(fluconazole.management.prescriber_action, /do not independently stop/iu);
  assert.equal(fluconazole.evidence.length, 2);
  assert.ok(
    fluconazole.evidence.every((evidence) =>
      evidence.does_not_by_itself_support.includes(
        'An exact Child-Pugh B interaction modifier.',
      )),
  );
  assert.doesNotMatch(
    ruleById('warfarin__ketoconazole_systemic').mechanism,
    /R-warfarin|CYP3A4/iu,
  );
  assert.doesNotMatch(
    ruleById('warfarin__amiodarone').mechanism,
    /CYP2C9|CYP3A|long half-life/iu,
  );
  assert.match(
    ruleById('warfarin__amiodarone').management.duration,
    /weeks to months after amiodarone discontinuation/iu,
  );
  assert.deepEqual(ruleById('warfarin__amiodarone').context_modifiers, []);
  assert.doesNotMatch(
    ruleById('warfarin__fluoroquinolone').mechanism,
    /CYP-mediated|gut-flora|vitamin-K/iu,
  );
  for (const ruleId of [
    'warfarin__rifampicin',
    'apixaban__strong_cyp3a4_pgp_inducer',
    'rivaroxaban__strong_cyp3a4_pgp_inducer',
    'dabigatran__pgp_inducer',
    'edoxaban__pgp_inducer',
  ]) {
    assert.equal(ruleById(ruleId).management.duration, null, ruleId);
  }
});

test('apixaban combined-strong inhibitor matching is pinned to label-named members and excludes unsupported extrapolations', () => {
  const ruleId = 'apixaban__strong_cyp3a4_pgp_inhibitor';
  for (const inhibitor of ['ketoconazole', 'itraconazole', 'ritonavir']) {
    assert.ok(finding(['apixaban', inhibitor], ruleId), inhibitor);
  }
  for (const excluded of ['clarithromycin', 'cobicistat', 'posaconazole', 'voriconazole']) {
    assert.equal(finding(['apixaban', excluded], ruleId), undefined, excluded);
  }
});

test('route- and formulation-dependent A rules remain diagnostic for every executable pair probe', () => {
  const probes = [
    {
      ruleId: 'rivaroxaban__strong_cyp3a4_pgp_inhibitor',
      subjects: ['rivaroxaban', 'ketoconazole'],
    },
    {
      ruleId: 'dabigatran_nvaf__dronedarone_or_ketoconazole',
      subjects: ['dabigatran', 'ketoconazole'],
      patientContext: {
        indication: 'non_valvular_atrial_fibrillation',
        renal: { crcl: 40 },
      },
    },
    {
      ruleId: 'dabigatran_vte__pgp_inhibitor',
      subjects: ['dabigatran', 'verapamil'],
      patientContext: {
        indication: 'venous_thromboembolism_treatment',
        renal: { crcl: 40 },
      },
    },
    {
      ruleId: 'dabigatran_hip_prophylaxis__pgp_inhibitor',
      subjects: ['dabigatran', 'verapamil'],
      patientContext: {
        indication: 'hip_replacement_prophylaxis',
        renal: { crcl: 40 },
      },
    },
  ];

  for (const { ruleId, subjects, patientContext = {} } of probes) {
    const rule = ruleById(ruleId);
    assert.equal(rule.runtime_status.pair_matcher_executable, true, ruleId);
    assert.equal(rule.runtime_status.clinical_context_complete, false, ruleId);
    assert.equal(rule.runtime_status.runtime_enabled, false, ruleId);
    assert.equal(rule.runtime_status.promotion_eligible, false, ruleId);

    const match = finding(subjects, ruleId, patientContext);
    assert.ok(match, ruleId);
    assert.equal(match.runtime_enabled, false, ruleId);
    assert.equal(
      findings(subjects, patientContext)
        .filter((item) => item.runtime_enabled)
        .some((item) => item.rule_id === ruleId),
      false,
      ruleId,
    );
  }
});

test('bare aspirin and ibuprofen fail closed when analgesic aspirin dose is unavailable', () => {
  const diagnostic = findings(['aspirin', 'ibuprofen']);
  assert.deepEqual(diagnostic, []);
  assert.equal(
    diagnostic.some((item) => item.rule_id === 'aspirin__nsaid_additive_gi_bleeding'),
    false,
  );
  assert.equal(
    diagnostic.some((item) => item.rule_id === 'aspirin_ld_ir__ibuprofen_timing'),
    false,
  );

  assert.equal(
    diagnostic.some(
      (item) => item.rule_id === 'aspirin__ibuprofen_additive_gi_bleeding',
    ),
    false,
  );
});

test('the generic aspirin and NSAID rule fails closed when its current SPL fragment cannot be reconciled', () => {
  const rule = ruleById('aspirin__nsaid_additive_gi_bleeding');
  assert.deepEqual(rule.evidence, []);
  assert.deepEqual(rule.applicability.jurisdiction, []);
  assert.equal(rule.severity, 'minor');
  assert.match(rule.mechanism, /no current licence-cleared machine evidence/iu);
  assert.deepEqual(rule.context_modifiers, []);
  assert.deepEqual(rule.runtime_status, {
    pair_matcher_executable: false,
    clinical_context_complete: false,
    runtime_enabled: false,
    promotion_eligible: false,
  });
  assert.equal(rule.runtime_enabled, false);
  assert.match(
    rule.claims_needing_citation.join(' '),
    /8bff5df5-d856-4237-b6a8-ae445b454844.*version 13.*effective 20250922.*no replacement text was inferred or fuzzy-matched/iu,
  );
  assert.match(rule.management.prescriber_action, /No runtime action is authorized/u);
  assert.equal(
    finding(['aspirin', 'naproxen'], rule.rule_id),
    undefined,
  );
});

test('the aspirin timing rule fails closed because its FDA source policy remains disabled', () => {
  const rule = ruleById('aspirin_ld_ir__ibuprofen_timing');
  assert.deepEqual(rule.evidence, []);
  assert.deepEqual(rule.applicability.jurisdiction, []);
  assert.equal(rule.severity, 'minor');
  assert.equal(rule.runtime_enabled, false);
  assert.equal(rule.runtime_status.pair_matcher_executable, false);
  assert.equal(rule.runtime_status.clinical_context_complete, false);
  assert.equal(
    rule._selector_executability.status,
    'non_executable_missing_current_evidence',
  );
  assert.equal(Object.hasOwn(rule, 'co_surface'), false);
  assert.equal(rule.management.timing, null);
  assert.equal(rule.management.patient_counselling, null);
  assert.match(
    rule.claims_needing_citation.join(' '),
    /media\/76636\/download on 2026-07-24 were inconsistent.*fda-authored-web-content source policy remains disabled.*no mirror was substituted/iu,
  );
  assert.equal(finding(['aspirin', 'ibuprofen'], rule.rule_id), undefined);
});

test('the exact aspirin and ibuprofen GI child is source-scoped and fails closed', () => {
  const rule = ruleById('aspirin__ibuprofen_additive_gi_bleeding');
  assert.deepEqual(rule.object, {
    drug: 'aspirin',
    route: ['oral'],
    dose: 'analgesic_dose',
  });
  assert.deepEqual(rule.perpetrator, {
    drug: 'ibuprofen',
    route: ['intravenous'],
    formulation: ['injection'],
  });
  assert.deepEqual(rule.runtime_status, {
    pair_matcher_executable: false,
    clinical_context_complete: false,
    runtime_enabled: false,
    promotion_eligible: false,
  });
  assert.equal(rule.management.dispense_action, 'withhold_and_clarify');
  assert.equal(rule.management.action_target, 'newly_added_perpetrator');
  assert.deepEqual(rule.management.do_not_interrupt, ['aspirin']);
  assert.match(
    rule.management.prescriber_action,
    /not generally recommended.*Withhold the newly presented intravenous ibuprofen order/iu,
  );
  assert.equal(rule._selector_executability.status, 'non_executable_unmodeled_dose');

  const match = finding(['aspirin', 'ibuprofen'], rule.rule_id);
  assert.equal(match, undefined);

  const [evidence] = rule.evidence;
  assert.equal(evidence.source_type, 'US_FDA_SPL');
  assert.equal(evidence.regulatory_approval, 'FDA');
  assert.equal(evidence.source_host, 'api.fda.gov');
  assert.deepEqual(evidence.supports.jurisdictions, ['US']);
  assert.deepEqual(evidence.supports.label_action, ['not_generally_recommended']);
  assert.deepEqual(
    evidence.supports.source_effect,
    ['increased_bleeding_risk', 'increased_gi_adverse_reactions'],
  );
  assert.match(
    evidence.fragments.map((fragment) => fragment.text).join(' '),
    /significantly increased incidence of GI adverse reactions.*not generally recommended.*increased risk of bleeding/iu,
  );
  assert.match(
    evidence.does_not_by_itself_support.join(' '),
    /intravenous CALDOLOR and analgesic-dose aspirin.*oral ibuprofen or low-dose aspirin/iu,
  );
});

test('Section A contains no stale specificity or triple-therapy engine-gap claims', () => {
  const timing = ruleById('aspirin_ld_ir__ibuprofen_timing');
  assert.doesNotMatch(JSON.stringify(timing), /PENDING_ENGINE_WORK|specificity.{0,30}pending/iu);

  const triple = ruleById('dual_antiplatelet__oral_anticoagulant_triple_therapy');
  for (const member of triple.object.combination) {
    assert.equal(Object.hasOwn(member, 'note'), false);
  }
  assert.equal(Object.hasOwn(triple.perpetrator, 'note'), false);
  assert.doesNotMatch(
    JSON.stringify(triple),
    /ENGINE GAP|Class NOT yet present|must be added at promotion/iu,
  );
});

test('the sertraline warning is recorded as a US FDA SPL source', () => {
  const rule = ruleById('ssri_snri__nsaid_additive_gi_bleeding');
  const [evidence] = rule.evidence;
  assert.equal(evidence.source_type, 'US_FDA_SPL');
  assert.equal(evidence.regulatory_approval, 'FDA');
  assert.equal(evidence.source_host, 'api.fda.gov');
  assert.deepEqual(evidence.supports.jurisdictions, ['US']);
});

test('the standalone rivaroxaban hepatic restriction is not exposed as a pair matcher', () => {
  const rule = ruleById('rivaroxaban__hepatic_impairment_child_pugh_b_c');
  assert.equal(rule.rule_type, 'drug_condition_restriction');
  assert.equal(rule.runtime_status.pair_matcher_executable, false);
  assert.equal(
    finding(
      ['rivaroxaban', 'ketoconazole'],
      'rivaroxaban__hepatic_impairment_child_pugh_b_c',
      { hepatic: { child_pugh: 'C' } },
    ),
    undefined,
  );
});

test('Section A openFDA evidence carries the complete reconciled provenance contract', () => {
  const records = openFdaEvidenceRecords();
  assert.equal(records.length, 34);

  for (const { evidence, ruleId } of records) {
    const label = `${ruleId}/${evidence.source_id}`;
    assert.equal(evidence.source_policy_id, 'openfda-labels', label);
    assert.ok(
      ['interaction-evidence', 'interaction-counterevidence']
        .includes(evidence.source_policy_use),
      label,
    );
    assert.equal(evidence.licence, 'CC0-1.0', label);
    assert.equal(evidence.source_host, 'api.fda.gov', label);
    assert.equal(evidence.document_id, evidence.provenance.set_id, label);
    assert.equal(evidence.document_version, evidence.provenance.version, label);
    assert.equal(String(evidence.spl_version), evidence.provenance.version, label);
    assert.equal(
      evidence.retrieved_at,
      ['warfarin__amiodarone', 'warfarin__fluconazole'].includes(ruleId)
        ? '2026-07-26'
        : '2026-07-24',
      label,
    );
    assert.equal(evidence.jurisdiction, 'US', label);
    assert.equal(evidence.review_status, 'review_candidate', label);
    assert.equal(evidence.source_date_type, 'openFDA SPL effective_time', label);
    assert.equal(
      evidence.source_date.replaceAll('-', ''),
      evidence.provenance.effective_time,
      label,
    );
    assert.equal(
      evidence.reference_url,
      `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${evidence.provenance.set_id}`,
      label,
    );
    const url = new URL(evidence.source_url);
    assert.equal(url.hostname, 'api.fda.gov', label);
    assert.equal(url.pathname, '/drug/label.json', label);
    assert.equal(
      url.searchParams.get('search'),
      `set_id:"${evidence.provenance.set_id}"`,
      label,
    );
    assert.equal(url.searchParams.get('limit'), '100', label);
    assert.equal(
      evidence.provenance.payload_canonicalization,
      'sorted-json-keys-v1',
      label,
    );
    assert.equal(
      evidence.provenance.normalization_version,
      'openfda-spl-text-v1',
      label,
    );
    assert.match(evidence.provenance.payload_sha256, /^[0-9a-f]{64}$/u, label);
    assert.deepEqual(
      evidence.provenance.source_paths,
      evidence.fragments.map((fragment) => fragment.source_path),
      label,
    );
    assert.ok(
      evidence.fragments.every((fragment) =>
        typeof fragment.source_path === 'string' && fragment.source_path.length > 0),
      label,
    );
  }
});

test('Section A GOV.UK evidence pins the exact Content API document and page licence', () => {
  const records = govUkEvidenceRecords();
  assert.equal(records.length, 2);

  for (const { evidence, ruleId } of records) {
    const label = `${ruleId}/${evidence.source_id}`;
    const sourceUrl = new URL(evidence.source_url);
    assert.equal(evidence.source_policy_use, 'interaction-evidence', label);
    assert.equal(evidence.licence, 'OGL-3.0', label);
    assert.equal(evidence.source_host, 'gov.uk', label);
    assert.equal(evidence.retrieved_at, '2026-07-24', label);
    assert.equal(evidence.jurisdiction, 'UK', label);
    assert.equal(evidence.review_status, 'review_candidate', label);
    assert.equal(
      evidence.provenance.payload_url,
      `https://www.gov.uk/api/content${sourceUrl.pathname}`,
      label,
    );
    assert.equal(evidence.provenance.page_licence, 'OGL-3.0', label);
    assert.match(evidence.provenance.document_sha256, /^[0-9a-f]{64}$/u, label);
    assert.match(evidence.document_version, /^\d{4}-\d{2}-\d{2}T/u, label);
    assert.equal(
      evidence.attribution,
      'Contains public sector information licensed under the Open Government Licence v3.0.',
      label,
    );
    assert.ok(
      evidence.fragments.every((fragment) => fragment.source_path === 'details.body'),
      label,
    );
  }
});

test(
  'Section A reconciled evidence validates against supplied exact source payload fixtures',
  { skip: !sourcePayloadDirectory },
  () => {
    for (const { evidence, ruleId } of openFdaEvidenceRecords()) {
      assertEvidenceAllowed(sourceManifest, evidence, {
        profile: 'production-open',
        use: evidence.source_policy_use,
        storagePath: 'docs/interaction-review/batch-01-v2/sections/A.verified.jsonl',
        payload: openFdaPayload(evidence),
      });
      assert.equal(
        evidence.currentness_status,
        'checked_current_openfda',
        `${ruleId}/${evidence.source_id}`,
      );
    }
    for (const { evidence, ruleId } of govUkEvidenceRecords()) {
      assertEvidenceAllowed(sourceManifest, evidence, {
        profile: 'production-open',
        use: evidence.source_policy_use,
        storagePath: 'docs/interaction-review/batch-01-v2/sections/A.verified.jsonl',
        payload: govUkPayload(evidence),
      });
      assert.equal(
        evidence.currentness_status,
        'checked_current_govuk_ogl',
        `${ruleId}/${evidence.source_id}`,
      );
    }
  },
);

test('Section A citations use exact unique hashes and the strict v2 effect/action split', () => {
  const hashes = new Set();
  let evidenceCount = 0;
  let fragmentCount = 0;
  for (const rule of rules) {
    for (const evidence of rule.evidence) {
      evidenceCount += 1;
      assert.ok(evidence.fragments.length > 0, `${rule.rule_id}/${evidence.source_id}`);
      assert.ok(evidence.supports.source_effect.length > 0, rule.rule_id);
      assert.ok(Array.isArray(evidence.supports.label_action), rule.rule_id);
      assert.notDeepEqual(
        evidence.supports.source_effect,
        evidence.supports.label_action,
        rule.rule_id,
      );
      assert.ok(evidence.does_not_by_itself_support.length > 0, rule.rule_id);
      for (const fragment of evidence.fragments) {
        fragmentCount += 1;
        const digest = createHash('sha256').update(fragment.text, 'utf8').digest('hex');
        assert.equal(fragment.text_sha256, digest, `${rule.rule_id}/${evidence.source_id}`);
        assert.equal(hashes.has(digest), false, `${rule.rule_id}/${evidence.source_id}`);
        hashes.add(digest);
      }
    }
  }
  assert.equal(evidenceCount, 36);
  assert.equal(fragmentCount, 64);
});

test('Section A machine evidence excludes restricted eMC/ACR text and identifies GOV.UK OGL records', () => {
  for (const rule of rules) {
    for (const evidence of rule.evidence) {
      assert.doesNotMatch(
        evidence.source_url,
        /(?:medicines\.org\.uk|acr\.org)/iu,
        `${rule.rule_id}/${evidence.source_id}`,
      );
      if (new URL(evidence.source_url).hostname.endsWith('gov.uk')) {
        assert.equal(evidence.licence, 'OGL-3.0', evidence.source_id);
        assert.equal(
          evidence.source_policy_id,
          'mhra-govuk-drug-safety-updates',
          evidence.source_id,
        );
        assert.match(
          evidence.provenance.payload_url,
          /^https:\/\/www\.gov\.uk\/api\/content\/drug-safety-update\//u,
        );
      }
    }
  }
});

test('Section A worksheets are pinned to the current slice', () => {
  const digest = createHash('sha256')
    .update(fs.readFileSync(sectionPath))
    .digest('hex');
  for (const file of [
    '2026-07-22-section-A-citations.md',
    '2026-07-22-section-A-reconciled.md',
  ]) {
    const body = fs.readFileSync(
      path.join(root, 'docs', 'interaction-review', file),
      'utf8',
    );
    assert.match(body, new RegExp(`JSONL SHA-256: \`${digest}\``, 'u'), file);
  }
});
