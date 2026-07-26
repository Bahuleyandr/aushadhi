import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkInteractions } from '../src/lib/interaction-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES = fs
  .readFileSync(
    path.join(
      ROOT,
      'docs',
      'interaction-review',
      'batch-01-v2',
      'sections',
      'D.verified.jsonl',
    ),
    'utf8',
  )
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const MEMBERS = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'data-static', 'interaction-member-sets.json'),
    'utf8',
  ),
).classes;
const REVIEW_INDEX = fs.readFileSync(
  path.join(
    ROOT,
    'docs',
    'interaction-review',
    'batch-01-v2',
    'review-index.md',
  ),
  'utf8',
);

function memberSetMembers(className) {
  return Object.values(MEMBERS[className]).flat();
}

function findings(subjects, patientContext = {}) {
  return checkInteractions({
    subjects,
    rules: RULES,
    memberSets: MEMBERS,
    patientContext,
  }).findings;
}

function byId(subjects, ruleId, patientContext = {}) {
  return findings(subjects, patientContext).filter(
    (finding) => finding.rule_id === ruleId,
  );
}

function one(subjects, ruleId, patientContext = {}) {
  const matches = byId(subjects, ruleId, patientContext);
  assert.equal(
    matches.length,
    1,
    `${subjects.join('+')} expected one ${ruleId}; got ${JSON.stringify(
      findings(subjects, patientContext).map((finding) => finding.rule_id),
    )}`,
  );
  return matches[0];
}

function reviewIndexRows(section, nextSection) {
  const start = REVIEW_INDEX.indexOf(`## ${section}.`);
  const end = REVIEW_INDEX.indexOf(`## ${nextSection}.`, start);
  assert.notEqual(start, -1, `review-index section ${section}`);
  assert.notEqual(end, -1, `review-index section ${nextSection}`);
  const lines = REVIEW_INDEX.slice(start, end).split(/\r?\n/u);
  const header = lines.find((line) => line.startsWith('| id |'));
  assert.ok(header, `review-index section ${section} header`);
  const columns = header
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  return lines
    .filter((line) => line.startsWith('| `'))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      assert.equal(cells.length, columns.length);
      return Object.fromEntries(
        columns.map((column, index) => [column, cells[index]]),
      );
    });
}

test('Section D has the reconciled rule count and explicit four-boolean runtime status', () => {
  assert.equal(RULES.length, 14);
  assert.equal(RULES.filter((rule) => rule.runtime_enabled).length, 0);
  for (const rule of RULES) {
    assert.deepEqual(
      Object.keys(rule.runtime_status).sort(),
      [
        'clinical_context_complete',
        'pair_matcher_executable',
        'promotion_eligible',
        'runtime_enabled',
      ],
      `${rule.rule_id} runtime_status fields`,
    );
    for (const value of Object.values(rule.runtime_status)) {
      assert.equal(typeof value, 'boolean', `${rule.rule_id} runtime_status type`);
    }
    assert.equal(rule.runtime_status.runtime_enabled, rule.runtime_enabled);
    assert.equal(rule.runtime_status.promotion_eligible, false);
    if (!rule.runtime_status.clinical_context_complete) {
      assert.equal(rule.runtime_enabled, false, rule.rule_id);
    }
  }
});

test('Section D review-index rows exactly match the slice order, runtime status, and jurisdiction', () => {
  const rows = reviewIndexRows('D', 'E');
  assert.deepEqual(
    rows.map((row) => row.id.slice(1, -1)),
    RULES.map((rule) => rule.rule_id),
  );
  for (const [index, rule] of RULES.entries()) {
    assert.equal(rows[index].runtime, rule.runtime_enabled ? 'on' : 'off');
    assert.equal(
      rows[index].jurisdiction,
      rule.applicability.jurisdiction.join('/'),
    );
  }
});

test('ziprasidone contraindication includes every source-named drug and mapped Class Ia/III member', () => {
  const rule = RULES.find(
    (candidate) => candidate.rule_id === 'ziprasidone__qt_prolonging_drug',
  );
  const expected = [
    'dofetilide',
    'sotalol',
    'quinidine',
    'hydroquinidine',
    'procainamide',
    'disopyramide',
    'amiodarone',
    'dronedarone',
    'ibutilide',
    'mesoridazine',
    'thioridazine',
    'chlorpromazine',
    'droperidol',
    'pimozide',
    'sparfloxacin',
    'gatifloxacin',
    'moxifloxacin',
    'halofantrine',
    'mefloquine',
    'pentamidine',
    'arsenic trioxide',
    'levomethadyl acetate',
    'dolasetron',
    'probucol',
    'tacrolimus',
  ];
  assert.deepEqual(rule.perpetrator.members, expected);
  assert.equal('second_subject' in rule, false);
  assert.equal('contraindicated_perpetrator_members' in rule, false);
  assert.deepEqual(rule.evidence[0].supports.scope.runtime_members, expected);
  for (const drug of expected) {
    const finding = one(
      ['ziprasidone', drug],
      'ziprasidone__qt_prolonging_drug',
    );
    assert.equal(finding.severity, 'contraindicated');
    assert.equal(finding.runtime_enabled, false);
  }
  assert.equal(
    one(
      ['ziprasidone', 'dolasetron mesylate'],
      'ziprasidone__qt_prolonging_drug',
    ).severity,
    'contraindicated',
  );
  assert.deepEqual(
    findings(['ziprasidone', 'dolasetron', 'dolasetron mesylate'])
      .filter((finding) => finding.rule_id === rule.rule_id)
      .map((finding) => finding.rule_id),
    [rule.rule_id],
    'canonical and salt spellings must not emit duplicate findings',
  );
  const serializedManagement = JSON.stringify({
    management: rule.management,
    runtime_note: rule._runtime_note,
  });
  assert.doesNotMatch(
    serializedManagement,
    /second_subject|four label|four members|full label list.+not encoded/iu,
  );
});

test('domperidone QT roster includes the prior omissions and excludes apomorphine and clarithromycin', () => {
  for (const drug of ['dofetilide', 'quinidine', 'ibutilide', 'moxifloxacin']) {
    const finding = one(
      ['domperidone', drug],
      'domperidone__qt_prolonging_drug',
    );
    assert.equal(finding.severity, 'contraindicated');
    assert.equal(finding.runtime_enabled, false);
  }
  assert.equal(
    byId(['domperidone', 'apomorphine'], 'domperidone__qt_prolonging_drug')
      .length,
    0,
  );
  assert.equal(
    byId(
      ['domperidone', 'clarithromycin'],
      'domperidone__qt_prolonging_drug',
    ).length,
    0,
  );
});

test('domperidone moderate CYP3A4 tier covers diltiazem and verapamil diagnostically', () => {
  for (const inhibitor of ['diltiazem', 'verapamil']) {
    const finding = one(
      [
        { drug: 'domperidone', route: 'oral' },
        { drug: inhibitor, route: 'systemic' },
      ],
      'domperidone__moderate_cyp3a4_inhibitor',
      { jurisdiction: 'UK' },
    );
    assert.equal(finding.severity, 'major');
    assert.equal(finding.dispense_action, 'confirm_and_monitor');
    assert.equal(finding.runtime_enabled, false);
    assert.equal(
      findings(['domperidone', inhibitor], { jurisdiction: 'UK' }).filter(
        (candidate) => candidate.runtime_enabled,
      ).length,
      0,
    );
  }
});

test('domperidone clarithromycin retains one pair-specific diagnostic contraindication and no QT duplicate', () => {
  const pairFindings = findings(['domperidone', 'clarithromycin']);
  const pairSpecific = pairFindings.filter(
    (finding) =>
      finding.rule_id === 'domperidone__potent_cyp3a4_inhibitor',
  );
  assert.equal(pairSpecific.length, 1);
  assert.equal(pairSpecific[0].severity, 'contraindicated');
  assert.equal(pairSpecific[0].runtime_enabled, false);
  assert.equal(
    pairFindings.filter((finding) => finding.runtime_enabled).length,
    0,
  );
  assert.equal(
    pairFindings.filter(
      (finding) => finding.rule_id === 'domperidone__qt_prolonging_drug',
    ).length,
    0,
  );
});

test('methadone CYP inhibitor interaction remains visible but diagnostic-only', () => {
  for (const inhibitor of ['fluvoxamine', 'clarithromycin']) {
    const finding = one(
      ['methadone', inhibitor],
      'methadone__cyp_inhibitor',
    );
    assert.equal(finding.severity, 'major');
    assert.equal(finding.runtime_enabled, false);
  }
  const rule = RULES.find(
    (candidate) => candidate.rule_id === 'methadone__cyp_inhibitor',
  );
  assert.match(
    rule.management.exceptions,
    /structured matcher can enforce the declared oral route/iu,
  );
  assert.match(
    rule._runtime_note,
    /production inputs do not reliably bind a reviewed product route/iu,
  );
  assert.doesNotMatch(rule.management.exceptions, /parenteral.+NOT matched/iu);
});

test('generic additive-QT rules remain diagnostic after the member-set expansion', () => {
  for (const [drug, coagent, ruleId] of [
    ['ondansetron', 'dofetilide', 'ondansetron__qt_prolonging_drug'],
    ['citalopram', 'quinidine', 'citalopram__qt_prolonging_drug'],
    ['hydroxychloroquine', 'ibutilide', 'hydroxychloroquine__qt_prolonging_drug'],
  ]) {
    const finding = one([drug, coagent], ruleId);
    assert.equal(finding.runtime_enabled, false);
  }

  const expected = memberSetMembers('qt_prolonging_drug');
  const diagnosticRuleIds = new Set([
    'qt_macrolide__qt_prolonging_drug',
    'citalopram__qt_prolonging_drug',
    'escitalopram__qt_prolonging_drug',
    'ondansetron__qt_prolonging_drug',
    'haloperidol_iv_or_above_recommended_dose__qt_prolonging_drug',
    'haloperidol_oral__qt_prolonging_drug',
    'methadone__qt_prolonging_drug',
    'hydroxychloroquine__qt_prolonging_drug',
  ]);
  for (const rule of RULES.filter((candidate) =>
    diagnosticRuleIds.has(candidate.rule_id))) {
    assert.equal(rule.runtime_enabled, false, rule.rule_id);
    for (const evidence of rule.evidence) {
      assert.deepEqual(
        evidence.supports.scope.runtime_members,
        expected,
        `${rule.rule_id} runtime scope`,
      );
      assert.deepEqual(
        evidence.supports.scope.perpetrator_members,
        expected,
        `${rule.rule_id} perpetrator scope`,
      );
      assert.equal(
        evidence.supports.scope.requires_clinician_class_mapping,
        true,
      );
      assert.equal(
        evidence.supports.scope.source_scope_is_not_runtime_roster,
        true,
      );
      assert.equal(
        evidence.supports.scope.runtime_scope_status,
        'diagnostic_only_local_mapping',
      );
    }
  }
});

test('ondansetron-apomorphine binds the exact contraindication and source route', () => {
  const rule = RULES.find(
    (candidate) => candidate.rule_id === 'ondansetron__apomorphine',
  );
  const finding = one(
    [
      { drug: 'ondansetron', route: 'oral' },
      {
        drug: 'apomorphine',
        route: 'subcutaneous',
        formulation: 'injection',
      },
    ],
    rule.rule_id,
    { jurisdiction: 'US' },
  );
  assert.equal(rule.risk_basis, 'contraindication');
  assert.equal(finding.severity, 'contraindicated');
  assert.equal(finding.dispense_action, 'withhold_and_clarify');
  assert.equal(finding.runtime_enabled, false);
  assert.equal(rule.runtime_status.clinical_context_complete, false);
  assert.deepEqual(rule.perpetrator.route, ['subcutaneous']);
  assert.deepEqual(rule.perpetrator.formulation, ['injection']);
  assert.deepEqual(rule.evidence[0].supports.label_action, ['contraindicated']);
  assert.match(
    rule.evidence[0].fragments.at(-1).text,
    /concomitant use.+ondansetron.+is contraindicated/iu,
  );
  assert.equal(
    byId(
      [
        { drug: 'ondansetron', route: 'oral' },
        {
          drug: 'apomorphine',
          route: 'sublingual',
          formulation: 'tablet',
        },
      ],
      rule.rule_id,
      { jurisdiction: 'US' },
    ).length,
    0,
  );
});

test('haloperidol IV branch excludes ordinary IM and retains only exact IV action', () => {
  const rule = RULES.find(
    (candidate) =>
      candidate.rule_id ===
      'haloperidol_iv_or_above_recommended_dose__qt_prolonging_drug',
  );
  assert.deepEqual(rule.object.route, ['iv']);
  assert.deepEqual(rule.object.formulation, ['injection']);
  assert.deepEqual(rule.applicability.routes, ['iv']);
  assert.deepEqual(rule.evidence[0].supports.label_action, [
    'ecg_monitoring_if_administered_intravenously',
  ]);
  const unresolved = findings(
    ['haloperidol', 'amiodarone'],
    { jurisdiction: 'US' },
  ).filter((finding) =>
    finding.rule_id.startsWith('haloperidol_'));
  assert.deepEqual(
    unresolved.map((finding) => finding.rule_id),
    [
      'haloperidol_iv_or_above_recommended_dose__qt_prolonging_drug',
      'haloperidol_oral__qt_prolonging_drug',
    ],
  );
  for (const finding of unresolved) {
    assert.equal(
      finding.clinical_action_status,
      'unresolved_pending_route_or_formulation',
    );
    assert.equal(finding.dispense_action, 'withhold_and_clarify');
  }
  assert.equal(
    one(
      [
        {
          drug: 'haloperidol',
          route: 'intravenous',
          formulation: 'injection',
        },
        { drug: 'amiodarone', route: 'systemic' },
      ],
      rule.rule_id,
      { jurisdiction: 'US' },
    ).runtime_enabled,
    false,
  );
  assert.equal(
    byId(
      [
        {
          drug: 'haloperidol',
          route: 'intramuscular',
          formulation: 'injection',
        },
        { drug: 'amiodarone', route: 'systemic' },
      ],
      rule.rule_id,
      { jurisdiction: 'US' },
    ).length,
    0,
  );
});

test('Section D propositions and actions stay within retained exact fragments', () => {
  const macrolide = RULES.find(
    (candidate) =>
      candidate.rule_id === 'qt_macrolide__qt_prolonging_drug',
  );
  assert.equal(macrolide.claims_needing_citation.length, 2);
  assert.ok(
    macrolide.claims_needing_citation.every(
      (claim) => !/full source metadata/iu.test(claim.claim),
    ),
  );
  assert.doesNotMatch(
    macrolide.evidence[2].normalized_proposition,
    /lower|comparative/iu,
  );

  const citalopram = RULES.find(
    (candidate) => candidate.rule_id === 'citalopram__qt_prolonging_drug',
  );
  assert.deepEqual(citalopram.context_modifiers, []);
  assert.deepEqual(citalopram.evidence[0].supports.label_action, [
    'dose_ceiling_40mg',
    'dose_ceiling_20mg_cyp2c19_higher_exposure',
  ]);
  assert.doesNotMatch(
    citalopram.evidence[0].normalized_proposition,
    /avoid.+other QT/iu,
  );

  const escitalopram = RULES.find(
    (candidate) => candidate.rule_id === 'escitalopram__qt_prolonging_drug',
  );
  assert.deepEqual(escitalopram.context_modifiers, []);
  assert.deepEqual(escitalopram.evidence[0].supports.label_action, []);
  assert.doesNotMatch(
    escitalopram.evidence[0].normalized_proposition,
    /avoid.+other QT/iu,
  );

  const hydroxychloroquine = RULES.find(
    (candidate) =>
      candidate.rule_id === 'hydroxychloroquine__qt_prolonging_drug',
  );
  assert.deepEqual(hydroxychloroquine.context_modifiers, []);
  assert.deepEqual(
    hydroxychloroquine.evidence[0].supports.label_action,
    [
      'coadministration_not_recommended',
      'correct_electrolyte_imbalances_prior_to_use',
      'monitor_cardiac_function_as_clinically_indicated',
    ],
  );
  assert.deepEqual(
    hydroxychloroquine.evidence[0].supports.source_effect,
    [
      'qt_prolongation',
      'torsades_reported',
      'increased_ventricular_arrhythmia_risk_with_qt_prolonging_agents',
    ],
  );
  assert.match(
    hydroxychloroquine.evidence[0].normalized_proposition,
    /not recommended.+electrolyte.+cardiac function/iu,
  );
});

test('methadone indication scope is explicit and free text remains unresolved', () => {
  for (const ruleId of [
    'methadone__qt_prolonging_drug',
    'methadone__cyp_inhibitor',
  ]) {
    const rule = RULES.find((candidate) => candidate.rule_id === ruleId);
    assert.deepEqual(rule.applicability.indication, [
      'opioid_use_disorder',
      'analgesia',
    ]);
  }
  const subjects = [
    { drug: 'methadone', route: 'oral' },
    { drug: 'amiodarone', route: 'systemic' },
  ];
  const unresolved = one(
    subjects,
    'methadone__qt_prolonging_drug',
    { jurisdiction: 'US' },
  );
  assert.equal(
    unresolved.clinical_action_status,
    'unresolved_pending_indication',
  );
  assert.ok(
    unresolved.data_required.some(({ factor }) => factor === 'indication'),
  );
  for (const indication of ['opioid_use_disorder', 'analgesia']) {
    const finding = one(
      subjects,
      'methadone__qt_prolonging_drug',
      { jurisdiction: 'US', indication },
    );
    assert.equal(
      finding.clinical_action_status,
      'unresolved_pending_indication',
    );
    assert.ok(
      finding.data_required.some(({ factor }) => factor === 'indication'),
    );
  }
  const unrelated = one(
    subjects,
    'methadone__qt_prolonging_drug',
    { jurisdiction: 'US', indication: 'unrelated' },
  );
  assert.equal(
    unrelated.clinical_action_status,
    'unresolved_pending_indication',
  );
});

test('direction-incomplete D contraindications fail closed and emit no side-specific target', () => {
  for (const ruleId of [
    'domperidone__potent_cyp3a4_inhibitor',
    'domperidone__qt_prolonging_drug',
    'ondansetron__apomorphine',
    'ziprasidone__qt_prolonging_drug',
  ]) {
    const rule = RULES.find((candidate) => candidate.rule_id === ruleId);
    assert.equal(rule.runtime_enabled, false, ruleId);
    assert.equal(rule.runtime_status.clinical_context_complete, false, ruleId);
    assert.equal(rule.management.action_target, null, ruleId);
    assert.deepEqual(rule.management.do_not_interrupt, [], ruleId);
  }
});

test('domperidone rules retain only the supported UK action and no unsupported numeric regimen', () => {
  for (const ruleId of [
    'domperidone__potent_cyp3a4_inhibitor',
    'domperidone__qt_prolonging_drug',
  ]) {
    const rule = RULES.find((candidate) => candidate.rule_id === ruleId);
    assert.deepEqual(rule.applicability.jurisdiction, ['UK']);
    assert.doesNotMatch(
      JSON.stringify(rule.management),
      /\b10 mg\b|\b30 mg\b|\b7 days?\b/iu,
    );
  }
  const qtRule = RULES.find(
    (candidate) => candidate.rule_id === 'domperidone__qt_prolonging_drug',
  );
  assert.ok(
    qtRule.claims_needing_citation.every(
      (claim) => claim.status === 'unresolved_not_used_by_rule',
    ),
  );
  assert.deepEqual(qtRule.context_modifiers, []);
});

test('Section D has evidence-bounded jurisdiction and no stale schema or rule-ID prose', () => {
  assert.doesNotMatch(
    JSON.stringify(RULES),
    /runtime_executable|not encoded in this draft|confirm against the cited current product label|haloperidol_parenteral_or_high_dose/iu,
  );
  assert.doesNotMatch(
    JSON.stringify(RULES),
    /_label_action_note|ondansetron \+ apomorphine is a separate contraindication|ondansetron\+apomorphine, which are their own contraindication/iu,
  );
  for (const rule of RULES) {
    const supported = [
      ...new Set(
        rule.evidence.flatMap(
          (evidence) => evidence.supports.jurisdictions,
        ),
      ),
    ];
    assert.deepEqual(
      rule.applicability.jurisdiction,
      supported,
      `${rule.rule_id} jurisdiction must be evidence-bounded`,
    );
  }
});

test('Section D evidence uses unique exact-text hashes and no legacy excerpts', () => {
  const seen = new Set();
  for (const rule of RULES) {
    assert.ok(rule.evidence.length > 0, `${rule.rule_id} evidence`);
    for (const evidence of rule.evidence) {
      assert.equal(evidence.source_policy_use, 'interaction-evidence');
      assert.equal('licence_id' in evidence, false);
      assert.equal('licence_url' in evidence, false);
      if (evidence.source_host === 'gov.uk') {
        assert.equal(
          evidence.source_policy_id,
          'mhra-govuk-drug-safety-updates',
        );
        assert.equal(evidence.licence, 'OGL-3.0');
        assert.equal(evidence.provenance.page_licence, 'OGL-3.0');
        assert.match(evidence.provenance.document_sha256, /^[0-9a-f]{64}$/u);
        assert.equal(
          evidence.attribution,
          'Contains public sector information licensed under the Open Government Licence v3.0.',
        );
        assert.ok(
          evidence.fragments.every(
            (fragment) => fragment.source_path === 'details.body',
          ),
        );
        assert.equal(
          evidence.provenance.payload_url,
          `https://www.gov.uk/api/content${
            new URL(evidence.source_url).pathname
          }`,
        );
        assert.equal(
          evidence.document_id,
          new URL(evidence.source_url).pathname.split('/').at(-1),
        );
      } else {
        assert.equal(evidence.source_policy_id, 'openfda-labels');
        assert.equal(evidence.licence, 'CC0-1.0');
        assert.equal(evidence.source_host, 'api.fda.gov');
        assert.equal(evidence.document_id, evidence.provenance.set_id);
        assert.equal(evidence.document_version, evidence.provenance.version);
        assert.equal(
          String(evidence.spl_version),
          evidence.provenance.version,
        );
        assert.equal(
          evidence.source_date.replaceAll('-', ''),
          evidence.provenance.effective_time,
        );
        assert.equal(
          new URL(evidence.source_url).searchParams.get('search'),
          `set_id:"${evidence.provenance.set_id}"`,
        );
        assert.deepEqual(
          evidence.provenance.source_paths,
          evidence.fragments.map((fragment) => fragment.source_path),
        );
      }
      assert.equal('excerpt' in evidence, false, `${rule.rule_id} legacy excerpt`);
      assert.match(
        evidence.citation_status,
        /^machine_confirmed(?:_[a-z0-9]+)*_pending_clinician$/u,
      );
      for (const fragment of evidence.fragments) {
        assert.equal(
          fragment.text_sha256,
          createHash('sha256').update(fragment.text, 'utf8').digest('hex'),
          `${rule.rule_id} fragment hash`,
        );
        assert.equal(
          seen.has(fragment.text_sha256),
          false,
          `${rule.rule_id} duplicate fragment hash`,
        );
        seen.add(fragment.text_sha256);
      }
    }
  }
});
