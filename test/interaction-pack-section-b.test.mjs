import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkInteractions } from '../src/lib/interaction-engine.mjs';
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
  'B.verified.jsonl',
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

function findings(subjects, includeDiagnostic = true, jurisdiction = 'US') {
  const options = {
    subjects,
    rules,
    memberSets,
    patientContext: { jurisdiction },
  };
  const reviewFindings = checkInteractions(options).findings;
  return includeDiagnostic
    ? reviewFindings
    : reviewFindings.filter((candidate) => candidate.runtime_enabled);
}

function finding(subjects, ruleId, includeDiagnostic = true) {
  return findings(subjects, includeDiagnostic)
    .find((candidate) => candidate.rule_id === ruleId);
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
  })));
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

test('Section B has the four-boolean runtime contract and no unscoped runtime rows enabled', () => {
  assert.equal(rules.length, 20);
  assert.doesNotThrow(() => validateDraftRules(rules));
  assert.deepEqual(
    rules.filter((rule) => rule.runtime_enabled).map((rule) => rule.rule_id).sort(),
    [],
  );

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
  assert.equal(
    rules.filter((rule) => rule.runtime_status.pair_matcher_executable).length,
    15,
  );
  for (const ruleId of ['simvastatin__gemfibrozil', 'lovastatin__gemfibrozil']) {
    assert.equal(
      ruleById(ruleId).runtime_status.clinical_context_complete,
      false,
      ruleId,
    );
  }
});

test('Section B applicability is bounded to the retained U.S. evidence', () => {
  for (const rule of rules) {
    const evidenceJurisdictions = [
      ...new Set(rule.evidence.flatMap((evidence) => evidence.supports.jurisdictions)),
    ];
    assert.deepEqual(rule.applicability.jurisdiction, ['US'], rule.rule_id);
    assert.deepEqual(rule.applicability.jurisdiction, evidenceJurisdictions, rule.rule_id);
  }
});

test('the exact gemfibrozil actions preserve the source distinction and target the unordered newly added agent', () => {
  const cases = [
    {
      ruleId: 'simvastatin__gemfibrozil',
      subjects: ['simvastatin', 'gemfibrozil'],
      severity: 'contraindicated',
      labelAction: ['contraindicated_concomitant_use'],
    },
    {
      ruleId: 'lovastatin__gemfibrozil',
      subjects: ['lovastatin', 'gemfibrozil'],
      severity: 'major',
      labelAction: ['avoid_concomitant_use'],
    },
  ];

  for (const {
    ruleId, subjects, severity, labelAction,
  } of cases) {
    const rule = ruleById(ruleId);
    assert.equal(rule.severity, severity, ruleId);
    assert.equal(rule.management.dispense_action, 'withhold_and_clarify', ruleId);
    assert.equal(rule.management.action_target, 'newly_added_agent', ruleId);
    assert.deepEqual(
      rule.management.do_not_interrupt,
      ['object_drug', 'perpetrator_drug'],
      ruleId,
    );
    assert.deepEqual(rule.evidence[0].supports.label_action, labelAction, ruleId);

    for (const orderedSubjects of [subjects, [...subjects].reverse()]) {
      const match = finding(orderedSubjects, ruleId);
      assert.ok(match, `${ruleId}/${orderedSubjects.join('+')}`);
      assert.equal(match.runtime_enabled, false, ruleId);
      assert.equal(match.dispense_action, 'withhold_and_clarify', ruleId);
      assert.equal(match.action_target, 'newly_added_agent', ruleId);
      assert.deepEqual(
        match.do_not_interrupt,
        ['object_drug', 'perpetrator_drug'],
        ruleId,
      );
      assert.equal(finding(orderedSubjects, ruleId, false), undefined, ruleId);
    }
  }
  assert.deepEqual(findings(['simvastatin', 'gemfibrozil'], false, 'UK'), []);
});

test('route, formulation, dose, roster, and regimen dependent B rules stay diagnostic-only', () => {
  const probes = [
    ['simvastatin_lovastatin__strong_cyp3a4_inhibitor', ['simvastatin', 'clarithromycin']],
    ['statin__fenofibrate', ['simvastatin', 'fenofibrate']],
    ['simvastatin__amiodarone', ['simvastatin', 'amiodarone']],
    ['simvastatin__verapamil_diltiazem', ['simvastatin', 'verapamil']],
    ['simvastatin__amlodipine', ['simvastatin', 'amlodipine']],
    ['atorvastatin__strong_cyp3a4_inhibitor', ['atorvastatin', 'clarithromycin']],
    ['simvastatin__ciclosporin', ['simvastatin', 'ciclosporin']],
    ['lovastatin__ciclosporin', ['lovastatin', 'ciclosporin']],
    ['atorvastatin__ciclosporin', ['atorvastatin', 'ciclosporin']],
    ['pitavastatin__ciclosporin', ['pitavastatin', 'ciclosporin']],
    ['pravastatin__ciclosporin', ['pravastatin', 'ciclosporin']],
    ['fluvastatin__ciclosporin', ['fluvastatin', 'ciclosporin']],
    ['rosuvastatin__ciclosporin', ['rosuvastatin', 'ciclosporin']],
  ];

  for (const [ruleId, subjects] of probes) {
    const rule = ruleById(ruleId);
    assert.deepEqual(rule.runtime_status, {
      pair_matcher_executable: true,
      clinical_context_complete: false,
      runtime_enabled: false,
      promotion_eligible: false,
    }, ruleId);

    const diagnostic = finding(subjects, ruleId);
    assert.ok(diagnostic, `${ruleId}/${subjects.join('+')}`);
    assert.equal(diagnostic.runtime_enabled, false, ruleId);
    assert.equal(finding(subjects, ruleId, false), undefined, ruleId);
  }
});

test('the strong-inhibitor roster includes source-named erythromycin without global class drift', () => {
  const rule = ruleById('simvastatin_lovastatin__strong_cyp3a4_inhibitor');
  assert.ok(rule.perpetrator.members.includes('erythromycin'));
  assert.match(
    rule.perpetrator.member_notes.erythromycin,
    /lovastatin contraindications fragment explicitly names erythromycin/iu,
  );
  assert.ok(finding(['lovastatin', 'erythromycin'], rule.rule_id));
  assert.equal(finding(['lovastatin', 'azithromycin'], rule.rule_id), undefined);
});

test('statin and antiretroviral regimen templates fail closed on bare ingredients', () => {
  const templates = [
    ['simvastatin_lovastatin__hiv_pi_cobicistat', ['simvastatin', 'lovastatin']],
    ['atorvastatin__hiv_pi_cobicistat', ['atorvastatin']],
    ['rosuvastatin__hiv_pi_cobicistat', ['rosuvastatin']],
    ['pravastatin__hiv_pi_cobicistat', ['pravastatin']],
    ['pitavastatin__hiv_pi_cobicistat', ['pitavastatin']],
  ];
  const members = ['ritonavir', 'cobicistat', 'lopinavir', 'atazanavir', 'darunavir'];

  for (const [ruleId, statins] of templates) {
    const rule = ruleById(ruleId);
    assert.deepEqual(rule.runtime_status, {
      pair_matcher_executable: false,
      clinical_context_complete: false,
      runtime_enabled: false,
      promotion_eligible: false,
    }, ruleId);
    assert.equal(
      rule.perpetrator.scope,
      'complete_antiretroviral_regimen_required',
      ruleId,
    );
    for (const statin of statins) {
      for (const member of members) {
        assert.equal(
          finding([statin, member], ruleId),
          undefined,
          `${ruleId}/${statin}+${member}`,
        );
      }
    }
  }
});

test('ciclosporin spelling normalization does not promote route-dependent findings', () => {
  for (const spelling of ['ciclosporin', 'cyclosporine']) {
    const diagnostic = finding(
      ['simvastatin', spelling],
      'simvastatin__ciclosporin',
    );
    assert.ok(diagnostic, spelling);
    assert.equal(diagnostic.runtime_enabled, false, spelling);
    assert.deepEqual(findings(['simvastatin', spelling], false), [], spelling);
  }
});

test('Section B evidence carries the complete reconciled openFDA provenance contract', () => {
  const records = openFdaEvidenceRecords();
  assert.equal(records.length, 28);

  for (const { evidence: record, ruleId } of records) {
    const label = `${ruleId}/${record.source_id}`;
    assert.equal(record.source_policy_id, 'openfda-labels', label);
    assert.equal(record.source_policy_use, 'interaction-evidence', label);
    assert.equal(record.licence, 'CC0-1.0', label);
    assert.equal(record.source_host, 'api.fda.gov', label);
    assert.equal(record.document_id, record.provenance.set_id, label);
    assert.equal(record.document_version, record.provenance.version, label);
    assert.equal(String(record.spl_version), record.provenance.version, label);
    assert.equal(record.retrieved_at, '2026-07-24', label);
    assert.equal(record.jurisdiction, 'US', label);
    assert.equal(record.review_status, 'review_candidate', label);
    assert.equal(record.source_date_type, 'openFDA SPL effective_time', label);
    assert.equal(
      record.source_date.replaceAll('-', ''),
      record.provenance.effective_time,
      label,
    );
    assert.equal(
      record.reference_url,
      `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${record.provenance.set_id}`,
      label,
    );
    const url = new URL(record.source_url);
    assert.equal(url.hostname, 'api.fda.gov', label);
    assert.equal(url.pathname, '/drug/label.json', label);
    assert.equal(
      url.searchParams.get('search'),
      `set_id:"${record.provenance.set_id}"`,
      label,
    );
    assert.equal(url.searchParams.get('limit'), '100', label);
    assert.equal(
      record.provenance.payload_canonicalization,
      'sorted-json-keys-v1',
      label,
    );
    assert.equal(
      record.provenance.normalization_version,
      'openfda-spl-text-v1',
      label,
    );
    assert.match(record.provenance.payload_sha256, /^[0-9a-f]{64}$/u, label);
    assert.deepEqual(
      record.provenance.source_paths,
      record.fragments.map((fragment) => fragment.source_path),
      label,
    );
  }
});

test(
  'Section B reconciled evidence validates against supplied exact openFDA payload fixtures',
  { skip: !sourcePayloadDirectory },
  () => {
    for (const { evidence, ruleId } of openFdaEvidenceRecords()) {
      assertEvidenceAllowed(sourceManifest, evidence, {
        profile: 'production-open',
        use: evidence.source_policy_use,
        storagePath: 'docs/interaction-review/batch-01-v2/sections/B.verified.jsonl',
        payload: openFdaPayload(evidence),
      });
      assert.equal(
        evidence.currentness_status,
        'checked_current_openfda',
        `${ruleId}/${evidence.source_id}`,
      );
    }
  },
);

test('Section B evidence uses exact unique hashes and the hardened effect/action split', () => {
  const evidence = rules.flatMap((rule) => rule.evidence);
  const hashes = new Set();
  let fragmentCount = 0;

  assert.equal(evidence.length, 28);
  for (const record of evidence) {
    assert.match(record.source_url, /^https:\/\//u);
    assert.equal(record.currentness_status, 'checked_current_openfda');
    assert.equal(record.currentness_checked_at, '2026-07-24');
    assert.ok(record.supports.source_effect.length > 0);
    assert.ok(Array.isArray(record.supports.label_action));
    assert.ok(record.does_not_by_itself_support.length > 0);

    for (const fragment of record.fragments) {
      fragmentCount += 1;
      const digest = createHash('sha256').update(fragment.text, 'utf8').digest('hex');
      assert.equal(fragment.text_sha256, digest, record.source_id);
      assert.equal(hashes.has(digest), false, record.source_id);
      hashes.add(digest);
    }
  }
  assert.equal(fragmentCount, 35);
});

test('Section B contains no placeholders, legacy excerpts, or restricted machine evidence', () => {
  const raw = fs.readFileSync(sectionPath, 'utf8');
  assert.doesNotMatch(raw, /<verify|<placeholder|\b(?:todo|tbd|tbc|fixme)\b/iu);

  for (const rule of rules) {
    for (const evidence of rule.evidence) {
      assert.equal(Object.hasOwn(evidence, 'excerpt'), false, evidence.source_id);
      assert.doesNotMatch(
        evidence.source_url,
        /(?:medicines\.org\.uk|acr\.org)/iu,
        evidence.source_id,
      );
    }
  }
});

test('Section B worksheets are pinned to the current slice', () => {
  const digest = createHash('sha256')
    .update(fs.readFileSync(sectionPath))
    .digest('hex');
  for (const file of [
    '2026-07-22-section-B-citations.md',
    '2026-07-22-section-B-reconciled.md',
  ]) {
    const body = fs.readFileSync(
      path.join(root, 'docs', 'interaction-review', file),
      'utf8',
    );
    assert.match(body, new RegExp(`JSONL SHA-256: \`${digest}\``, 'u'), file);
  }
});
