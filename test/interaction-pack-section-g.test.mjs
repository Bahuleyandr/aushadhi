import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkInteractions } from '../src/lib/interaction-engine.mjs';
import { validateDraftRules } from '../src/lib/interaction-draft-validation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECTION_PATH = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'sections',
  'G.verified.jsonl',
);
const SECTION_RAW = fs.readFileSync(SECTION_PATH, 'utf8');
const RULES = SECTION_RAW.trim().split(/\r?\n/u).map(JSON.parse);
const BY_ID = Object.fromEntries(RULES.map((rule) => [rule.rule_id, rule]));
const MEMBERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data-static', 'interaction-member-sets.json'), 'utf8'),
).classes;
const RUNTIME_KEYS = [
  'clinical_context_complete',
  'pair_matcher_executable',
  'promotion_eligible',
  'runtime_enabled',
];
const EXPECTED_IDS = [
  'colchicine__strong_cyp3a4_pgp_inhibitor',
  'ergotamine_dihydroergotamine__strong_cyp3a4_inhibitor',
  'ergotamine__label_contraindicated_cyp3a4_inhibitor',
  'methylergonovine__strong_cyp3a4_inhibitor',
  'methylergonovine__moderate_cyp3a4_inhibitor',
  'pimozide__cyp3a4_inhibitor',
  'pimozide__label_avoid_inhibitor',
  'tacrolimus__cyp3a4_inhibitor',
  'ciclosporin__cyp3a4_inhibitor',
  'sirolimus__strong_cyp3a4_pgp_inhibitor',
  'sirolimus__label_avoid_cyp3a4_pgp_inhibitor',
  'sirolimus__erythromycin',
  'sirolimus__moderate_cyp3a4_pgp_inhibitor',
  'calcineurin_inhibitor__other_cyp3a4_inducer',
  'sildenafil_pah__strong_cyp3a4_inhibitor',
  'tadalafil_pah__strong_cyp3a4_inhibitor',
  'tadalafil_pah__ritonavir_sequence',
  'triazolam__potent_cyp3a4_inhibitor',
  'oral_midazolam__potent_cyp3a4_inhibitor',
  'parenteral_midazolam__potent_cyp3a4_inhibitor',
  'dihydropyridine_ccb__strong_cyp3a4_inhibitor',
  'apixaban__pgp_moderate_cyp3a4_inhibitor',
  'rivaroxaban__pgp_moderate_cyp3a4_inhibitor',
  'grapefruit__sensitive_cyp3a4_substrate',
  'ivabradine__strong_cyp3a4_inhibitor',
  'ivabradine__moderate_cyp3a4_inhibitor',
  'ranolazine__strong_cyp3a4_inhibitor',
  'ranolazine__moderate_cyp3a4_inhibitor',
];

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function valuesFor(ref) {
  if (ref?.drug) return [ref.drug];
  if (ref?.substance) return [ref.substance];
  if (Array.isArray(ref?.members)) return ref.members;
  if (!ref?.class) return [];
  const memberSet = MEMBERS[ref.class] ?? {};
  const strengths = ref.strength?.length ? ref.strength : Object.keys(memberSet);
  return strengths.flatMap((strength) => memberSet[strength] ?? []);
}

function pairFor(rule) {
  const subjectFor = (ref) => {
    const drug = valuesFor(ref)[0];
    if (!drug) return null;
    const subject = { drug };
    if (ref.route?.length) subject.route = ref.route[0];
    if (ref.formulation?.length) subject.formulation = ref.formulation[0];
    return subject;
  };
  const object = subjectFor(rule.object);
  const perpetrator = subjectFor(
    rule.perpetrator ?? rule.second_subject ?? rule.coadministered_with,
  );
  return object && perpetrator ? [object, perpetrator] : null;
}

function fire(subjects, patientContext = {}, rules = RULES) {
  return checkInteractions({
    subjects,
    rules,
    memberSets: MEMBERS,
    patientContext: { jurisdiction: 'US', ...patientContext },
  }).findings;
}

test('Section G is a 28-rule, openFDA-only, licensing-safe slice', () => {
  assert.doesNotThrow(() => validateDraftRules(RULES));
  assert.equal(RULES.length, 28);
  assert.deepEqual(RULES.map((rule) => rule.rule_id), EXPECTED_IDS);
  assert.equal(new Set(EXPECTED_IDS).size, 28);
  assert.equal(RULES.filter((rule) => rule.runtime_enabled).length, 0);
  assert.equal(RULES.flatMap((rule) => rule.evidence).length, 29);
  assert.equal(
    RULES.flatMap((rule) => rule.evidence).flatMap((evidence) => evidence.fragments).length,
    51,
  );
  assert.doesNotMatch(
    SECTION_RAW,
    /medicines\.org\.uk|\bemc[-_]|uk-smpc|accessdata\.fda\.gov|acr\.org/iu,
  );

  for (const rule of RULES) {
    assert.equal(rule._section, 'G', rule.rule_id);
    assert.equal(rule.proposed_status, 'draft_for_review', rule.rule_id);
    assert.deepEqual(Object.keys(rule.runtime_status).sort(), RUNTIME_KEYS, rule.rule_id);
    assert.equal(rule.runtime_enabled, rule.runtime_status.runtime_enabled, rule.rule_id);
    assert.equal(rule.runtime_status.promotion_eligible, false, rule.rule_id);
    assert.ok(
      Object.values(rule.runtime_status).every((value) => typeof value === 'boolean'),
      rule.rule_id,
    );
    assert.equal(Object.hasOwn(rule, 'manual_references'), false, rule.rule_id);

    for (const evidence of rule.evidence) {
      assert.equal(evidence.source_policy_id, 'openfda-labels', evidence.source_id);
      assert.equal(evidence.source_policy_use, 'interaction-evidence', evidence.source_id);
      assert.equal(evidence.licence, 'CC0-1.0', evidence.source_id);
      assert.equal(new URL(evidence.source_url).hostname, 'api.fda.gov', evidence.source_id);
      assert.equal(evidence.document_id, evidence.provenance.set_id, evidence.source_id);
      assert.equal(evidence.document_version, evidence.provenance.version, evidence.source_id);
      assert.equal(
        evidence.source_date.replaceAll('-', ''),
        evidence.provenance.effective_time,
        evidence.source_id,
      );
      assert.deepEqual(
        evidence.fragments.map((fragment) => fragment.source_path),
        evidence.provenance.source_paths,
        evidence.source_id,
      );
      for (const fragment of evidence.fragments) {
        assert.equal(sha256(fragment.text), fragment.text_sha256, evidence.source_id);
      }
    }
  }

  assert.equal(
    BY_ID.pimozide__cyp3a4_inhibitor.runtime_status.clinical_context_complete,
    false,
  );
  assert.equal(
    Object.hasOwn(
      BY_ID.tadalafil_pah__ritonavir_sequence.perpetrator,
      'class',
    ),
    false,
  );
});

test('every executable G rule produces its own source-bounded canonical diagnostic', () => {
  for (const rule of RULES.filter(
    (candidate) => candidate.runtime_status.pair_matcher_executable,
  )) {
    const subjects = pairFor(rule);
    assert.ok(subjects, `${rule.rule_id} canonical pair`);
    const patientContext = rule.applicability.indication
      ? { indication: rule.applicability.indication[0] }
      : {};
    const findings = fire(subjects, patientContext, [rule]);
    assert.equal(findings.length, 1, rule.rule_id);
    assert.equal(findings[0].rule_id, rule.rule_id);
    assert.equal(findings[0].severity, rule.severity, rule.rule_id);
    assert.equal(findings[0].dispense_action, rule.management.dispense_action, rule.rule_id);
    assert.equal(findings[0].runtime_enabled, false, rule.rule_id);
  }
});

test('disabled and matcher-incomplete G rules cannot emit a pharmacist-facing finding', () => {
  for (const rule of RULES.filter((candidate) => !candidate.runtime_enabled)) {
    const subjects = pairFor(rule);
    if (subjects) {
      assert.deepEqual(
        fire(subjects, {}, [rule]).filter((finding) => finding.runtime_enabled),
        [],
        rule.rule_id,
      );
    }
  }
  for (const ruleId of [
    'colchicine__strong_cyp3a4_pgp_inhibitor',
    'tacrolimus__cyp3a4_inhibitor',
    'ciclosporin__cyp3a4_inhibitor',
    'dihydropyridine_ccb__strong_cyp3a4_inhibitor',
    'apixaban__pgp_moderate_cyp3a4_inhibitor',
  ]) {
    assert.equal(BY_ID[ruleId].runtime_status.pair_matcher_executable, false, ruleId);
  }
  assert.deepEqual(
    BY_ID.dihydropyridine_ccb__strong_cyp3a4_inhibitor.object.members,
    [],
  );
  assert.deepEqual(
    BY_ID.apixaban__pgp_moderate_cyp3a4_inhibitor.perpetrator.members,
    [],
  );
});

test('colchicine fails closed because its label union exceeds the executable intersection', () => {
  const rule = BY_ID.colchicine__strong_cyp3a4_pgp_inhibitor;
  assert.equal(rule.runtime_enabled, false);
  assert.equal(rule.runtime_status.pair_matcher_executable, false);
  assert.match(rule.management.exceptions, /P-gp inhibitors or strong CYP3A4 inhibitors/iu);
  assert.match(rule._runtime_note, /union.*intersection/iu);
  assert.deepEqual(fire(['colchicine', 'clarithromycin'], {
    hepatic: { flag: 'impaired' },
  }, [rule]), []);
});

test('ergot and sirolimus label-list children are exact and disjoint from strength tiers', () => {
  assert.deepEqual(
    BY_ID.ergotamine__label_contraindicated_cyp3a4_inhibitor.perpetrator.members,
    ['indinavir', 'erythromycin', 'troleandomycin'],
  );
  assert.deepEqual(
    BY_ID.sirolimus__label_avoid_cyp3a4_pgp_inhibitor.perpetrator.members,
    ['voriconazole', 'telithromycin'],
  );
  assert.equal(
    fire(['ergotamine', 'indinavir']).map((finding) => finding.rule_id).join(','),
    'ergotamine__label_contraindicated_cyp3a4_inhibitor',
  );
  assert.equal(
    fire(['sirolimus', 'voriconazole']).map((finding) => finding.rule_id).join(','),
    'sirolimus__label_avoid_cyp3a4_pgp_inhibitor',
  );
  assert.equal(
    fire(['sirolimus', 'erythromycin']).map((finding) => finding.rule_id).join(','),
    'sirolimus__erythromycin',
  );
});

test('methylergonovine replaces the broader legacy victim identities and remains diagnostic', () => {
  assert.equal(
    Object.hasOwn(BY_ID, 'methylergometrine_ergometrine__strong_cyp3a4_inhibitor'),
    false,
  );
  assert.equal(
    Object.hasOwn(BY_ID, 'methylergometrine__moderate_cyp3a4_inhibitor'),
    false,
  );
  for (const ruleId of [
    'methylergonovine__strong_cyp3a4_inhibitor',
    'methylergonovine__moderate_cyp3a4_inhibitor',
  ]) {
    assert.equal(BY_ID[ruleId].object.drug, 'methylergonovine');
    assert.deepEqual(BY_ID[ruleId].object.route, ['oral']);
    assert.equal(BY_ID[ruleId].runtime_enabled, false);
  }
});

test('PAH indication and exact inhibitor tiers do not cross-expand', () => {
  assert.equal(
    fire(['sildenafil', 'ketoconazole'], {
      indication: 'pulmonary_arterial_hypertension',
    }).some((finding) => finding.rule_id === 'sildenafil_pah__strong_cyp3a4_inhibitor'),
    true,
  );
  const unresolvedIndication = fire(['sildenafil', 'ketoconazole'], {
    indication: 'erectile_dysfunction',
  }).find(
    (finding) =>
      finding.rule_id === 'sildenafil_pah__strong_cyp3a4_inhibitor',
  );
  assert.ok(unresolvedIndication);
  assert.equal(
    unresolvedIndication.clinical_action_status,
    'unresolved_pending_applicability',
  );
  assert.deepEqual(unresolvedIndication.management, {});
  assert.equal(unresolvedIndication.action_target, null);
  const tadalafilRitonavir = fire(['tadalafil', 'ritonavir'], {
    indication: 'pulmonary_arterial_hypertension',
  });
  assert.equal(
    tadalafilRitonavir.some(
      (finding) => finding.rule_id === 'tadalafil_pah__strong_cyp3a4_inhibitor',
    ),
    false,
  );
  assert.deepEqual(
    tadalafilRitonavir.map((finding) => [finding.rule_id, finding.runtime_enabled]),
    [['tadalafil_pah__ritonavir_sequence', false]],
  );
  assert.equal(
    fire(['ranolazine', 'ketoconazole'])
      .filter((finding) => finding.rule_id.startsWith('ranolazine__')).length,
    1,
  );
  assert.equal(
    fire(['ivabradine', 'diltiazem'])
      .filter((finding) => finding.rule_id.startsWith('ivabradine__')).length,
    1,
  );
});

test('Section G citation and reconciliation documents are pinned to the frozen slice', () => {
  const digest = sha256(SECTION_RAW);
  for (const file of [
    '2026-07-23-section-G-citations.md',
    '2026-07-23-section-G-reconciled.md',
  ]) {
    const body = fs.readFileSync(
      path.join(ROOT, 'docs', 'interaction-review', file),
      'utf8',
    );
    assert.match(body, new RegExp(`JSONL SHA-256: \`${digest}\``, 'u'), file);
  }
});
