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
      'C.verified.jsonl',
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

function findings(subjects) {
  return checkInteractions({
    subjects,
    rules: RULES,
    memberSets: MEMBERS,
  }).findings;
}

function byId(subjects, ruleId) {
  return findings(subjects).filter((finding) => finding.rule_id === ruleId);
}

function one(subjects, ruleId) {
  const matches = byId(subjects, ruleId);
  assert.equal(
    matches.length,
    1,
    `${subjects.join('+')} expected one ${ruleId}; got ${JSON.stringify(
      findings(subjects).map((finding) => finding.rule_id),
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

test('Section C has the reconciled rule count and explicit four-boolean runtime status', () => {
  assert.equal(RULES.length, 21);
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

test('Section C review-index rows exactly match the slice order, runtime status, and jurisdiction', () => {
  const rows = reviewIndexRows('C', 'D');
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

test('tramadol serotonergic-antidepressant roster includes the three prior omissions', () => {
  for (const antidepressant of [
    'fluvoxamine',
    'desvenlafaxine',
    'vortioxetine',
  ]) {
    const finding = one(
      ['tramadol', antidepressant],
      'tramadol__serotonergic_antidepressant',
    );
    assert.equal(finding.severity, 'major');
    assert.equal(finding.runtime_enabled, false);
  }
});

test('tramadol seizure evidence is split into an SSRI/TCA-only diagnostic rule', () => {
  const rule = RULES.find(
    (candidate) => candidate.rule_id === 'tramadol__ssri_tca_seizure_risk',
  );
  assert.deepEqual(rule.perpetrator.members, [
    'fluoxetine',
    'sertraline',
    'paroxetine',
    'citalopram',
    'escitalopram',
    'fluvoxamine',
    'amitriptyline',
    'clomipramine',
    'imipramine',
    'nortriptyline',
  ]);
  assert.equal(rule.runtime_enabled, false);
  assert.equal(rule.runtime_status.promotion_eligible, false);
  assert.deepEqual(rule.evidence[0].supports.source_effect, [
    'seizures_reported_at_recommended_doses',
    'increased_seizure_risk_with_ssri_or_tca',
  ]);
  assert.deepEqual(rule.evidence[0].supports.label_action, []);
  for (const antidepressant of ['fluoxetine', 'amitriptyline']) {
    assert.equal(
      one(['tramadol', antidepressant], rule.rule_id).runtime_enabled,
      false,
    );
  }
  for (const unsupported of [
    'venlafaxine',
    'desvenlafaxine',
    'duloxetine',
    'vortioxetine',
  ]) {
    assert.equal(
      byId(['tramadol', unsupported], rule.rule_id).length,
      0,
      `${unsupported} must remain outside the source-named seizure scope`,
    );
  }
});

test('current ZYVOX coverage includes the omitted antidepressants, buspirone, triptans, and opioids', () => {
  for (const serotonergicAgent of [
    'fluvoxamine',
    'desvenlafaxine',
    'imipramine',
    'buspirone',
    'frovatriptan',
    'morphine',
  ]) {
    const finding = one(
      ['linezolid', serotonergicAgent],
      'linezolid__serotonergic_agent',
    );
    assert.equal(finding.severity, 'major');
    assert.equal(finding.runtime_enabled, false);
  }
});

test('current ZYVOX management has no obsolete washout, withholding branch, or protected side', () => {
  const rule = RULES.find(
    (candidate) => candidate.rule_id === 'linezolid__serotonergic_agent',
  );
  assert.equal(rule.management.dispense_action, 'confirm_and_monitor');
  assert.equal(rule.management.timing, null);
  assert.equal(rule.management.action_target, null);
  assert.deepEqual(rule.management.do_not_interrupt, []);
  assert.equal('therapy_status_branches' in rule, false);
  assert.match(
    rule.management.prescriber_action,
    /monitor concomitant.+if signs or symptoms occur.+discontinuing linezolid and\/or the serotonergic agent/iu,
  );
  assert.doesNotMatch(JSON.stringify(rule.management), />=24|withhold/iu);
});

test('tramadol and pethidine linezolid overrides remain exact diagnostic contraindications', () => {
  for (const [opioid, ruleId] of [
    ['tramadol', 'tramadol__linezolid'],
    ['pethidine', 'pethidine__linezolid'],
  ]) {
    const pairFindings = findings([opioid, 'linezolid']);
    const exact = pairFindings.filter((finding) => finding.rule_id === ruleId);
    assert.equal(exact.length, 1, `${opioid}+linezolid must retain one exact finding`);
    assert.equal(exact[0].severity, 'contraindicated');
    assert.equal(exact[0].dispense_action, 'withhold_and_clarify');
    assert.equal(exact[0].runtime_enabled, false);
    assert.equal(
      pairFindings.filter((finding) => finding.runtime_enabled).length,
      0,
    );
  }
  assert.equal(
    one(['meperidine', 'linezolid'], 'pethidine__linezolid').severity,
    'contraindicated',
  );
});

test('bupropion linezolid remains directional and diagnostic-only', () => {
  const finding = one(
    ['bupropion', 'linezolid'],
    'bupropion__linezolid_directional',
  );
  assert.equal(finding.severity, 'contraindicated');
  assert.equal(finding.runtime_enabled, false);
  assert.equal(
    byId(['bupropion', 'linezolid'], 'linezolid__serotonergic_agent').length,
    0,
  );
});

test('linezolid triptan pairs use current ZYVOX monitoring, not the MAO-A triptan contraindication', () => {
  for (const triptan of ['sumatriptan', 'frovatriptan']) {
    const pairFindings = findings([triptan, 'linezolid']);
    assert.equal(
      pairFindings.filter(
        (finding) => finding.rule_id === 'linezolid__serotonergic_agent',
      ).length,
      1,
    );
    assert.equal(
      pairFindings.filter(
        (finding) =>
          finding.rule_id === 'triptan_mao_metabolized__maoi_mao_a',
      ).length,
      0,
    );
  }
});

test('expanded benzodiazepine and Z-drug roster closes the opioid false negatives', () => {
  const expectedOpioids = memberSetMembers('opioid');
  const expectedSedatives = memberSetMembers('benzodiazepine_or_z_drug');
  const rule = RULES.find(
    (candidate) =>
      candidate.rule_id === 'opioid__benzodiazepine_cns_depressant',
  );
  assert.deepEqual(rule.object.members, expectedOpioids);
  assert.deepEqual(rule.perpetrator.members, expectedSedatives);
  assert.equal(rule.runtime_status.clinical_context_complete, false);
  assert.deepEqual(
    rule.evidence[0].supports.scope.runtime_object_members,
    expectedOpioids,
  );
  assert.deepEqual(
    rule.evidence[0].supports.scope.runtime_perpetrator_members,
    expectedSedatives,
  );
  assert.equal(
    rule.evidence[0].supports.scope.requires_clinician_class_mapping,
    true,
  );
  assert.equal(
    rule.evidence[0].supports.scope.source_scope_is_not_runtime_roster,
    true,
  );
  for (const sedative of expectedSedatives) {
    const finding = one(
      ['morphine', sedative],
      'opioid__benzodiazepine_cns_depressant',
    );
    assert.equal(finding.severity, 'major');
    assert.equal(finding.runtime_enabled, false);
  }
});

test('route-sensitive sympathomimetic and antihistamine rules are diagnostic-only', () => {
  const decongestant = one(
    ['phenelzine', 'phenylephrine'],
    'maoi_nonselective__sympathomimetic',
  );
  assert.equal(decongestant.severity, 'contraindicated');
  assert.equal(decongestant.runtime_enabled, false);

  const antihistamine = one(
    ['diphenhydramine', 'morphine'],
    'sedating_antihistamine__cns_depressant',
  );
  assert.equal(antihistamine.severity, 'moderate');
  assert.equal(antihistamine.runtime_enabled, false);

  const rule = RULES.find(
    (candidate) =>
      candidate.rule_id === 'sedating_antihistamine__cns_depressant',
  );
  const expectedAntihistamines =
    memberSetMembers('sedating_antihistamine');
  const expectedDepressants = memberSetMembers('cns_depressant');
  assert.deepEqual(rule.object.members, expectedAntihistamines);
  assert.deepEqual(rule.perpetrator.members, expectedDepressants);
  for (const evidence of rule.evidence) {
    assert.deepEqual(
      evidence.supports.scope.runtime_object_members,
      expectedAntihistamines,
    );
    assert.deepEqual(
      evidence.supports.scope.runtime_perpetrator_members,
      expectedDepressants,
    );
    assert.equal(
      evidence.supports.scope.runtime_scope_status,
      'diagnostic_only_local_mapping',
    );
  }
  for (const depressant of expectedDepressants) {
    assert.equal(
      one(
        ['diphenhydramine', depressant],
        'sedating_antihistamine__cns_depressant',
      ).runtime_enabled,
      false,
    );
  }
});

test('dextromethorphan MAOI rule states the exact directional two-week restriction', () => {
  const rule = RULES.find(
    (candidate) =>
      candidate.rule_id === 'dextromethorphan__maoi_nonselective',
  );
  assert.match(rule.management.prescriber_action, /for two weeks after stopping/iu);
  assert.match(rule.management.timing, /for two weeks after stopping/iu);
  assert.doesNotMatch(
    JSON.stringify(rule),
    /VERIFY|not encoded in this draft|within not encoded|until not encoded/u,
  );
  assert.equal(rule.runtime_status.clinical_context_complete, false);
});

test('fixed-combination dextromethorphan SSRI/SNRI extrapolation is diagnostic-only', () => {
  for (const antidepressant of ['fluoxetine', 'venlafaxine']) {
    const finding = one(
      ['dextromethorphan', antidepressant],
      'dextromethorphan__ssri_snri',
    );
    assert.equal(finding.runtime_enabled, false);
  }
});

test('source-supported MAOI timing is exact, directional, and product-scoped', () => {
  const fluoxetine = RULES.find(
    (candidate) => candidate.rule_id === 'ssri_snri__maoi_nonselective',
  );
  assert.deepEqual(fluoxetine.object.members, ['fluoxetine']);
  assert.match(fluoxetine.management.timing, /within 5 weeks after stopping fluoxetine/iu);
  assert.match(fluoxetine.management.timing, /does not establish the reverse/iu);
  assert.equal(
    byId(['sertraline', 'phenelzine'], fluoxetine.rule_id).length,
    0,
  );

  const opioid = RULES.find(
    (candidate) =>
      candidate.rule_id === 'pethidine_tramadol__maoi_nonselective',
  );
  assert.match(opioid.management.timing, /within 14 days after stopping the MAOI/iu);
  assert.match(opioid.management.timing, /reverse.+not established/iu);

  const triptan = RULES.find(
    (candidate) =>
      candidate.rule_id === 'triptan_mao_metabolized__maoi_mao_a',
  );
  assert.deepEqual(triptan.object.members, ['sumatriptan']);
  assert.match(triptan.management.timing, /within 2 weeks after stopping/iu);
  assert.equal(
    one(
      ['sumatriptan', 'phenelzine'],
      'triptan_mao_metabolized__maoi_mao_a',
    ).runtime_enabled,
    false,
  );
  for (const unsupported of ['rizatriptan', 'zolmitriptan']) {
    assert.equal(
      byId(
        [unsupported, 'phenelzine'],
        'triptan_mao_metabolized__maoi_mao_a',
      ).length,
      0,
      `${unsupported} must remain outside the sumatriptan-only evidence gate`,
    );
  }

  const bupropion = RULES.find(
    (candidate) => candidate.rule_id === 'bupropion__maoi_nonselective',
  );
  assert.match(bupropion.management.timing, /at least 14 days in both directions/iu);
  assert.doesNotMatch(JSON.stringify(bupropion), /interval not encoded/iu);
});

test('direction-incomplete rules fail closed and emit no side-specific interruption target', () => {
  for (const ruleId of [
    'ssri_snri__maoi_nonselective',
    'pethidine_tramadol__maoi_nonselective',
    'tramadol__linezolid',
    'pethidine__linezolid',
    'triptan_mao_metabolized__maoi_mao_a',
    'dextromethorphan__maoi_nonselective',
    'opioid__gabapentinoid',
    'bupropion__maoi_nonselective',
  ]) {
    const rule = RULES.find((candidate) => candidate.rule_id === ruleId);
    assert.equal(rule.runtime_enabled, false, ruleId);
    assert.equal(rule.runtime_status.clinical_context_complete, false, ruleId);
    assert.equal(rule.management.action_target, null, ruleId);
    assert.deepEqual(rule.management.do_not_interrupt, [], ruleId);
  }
});

test('Section C contains no retired runtime schema prose or unsupported jurisdiction scope', () => {
  assert.doesNotMatch(JSON.stringify(RULES), /runtime_executable/iu);
  assert.doesNotMatch(
    JSON.stringify(RULES),
    /not encoded in this draft|confirm against the cited current product label/iu,
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

test('representative-product CNS rules do not silently widen their runtime gates', () => {
  const alcohol = RULES.find(
    (candidate) => candidate.rule_id === 'benzodiazepine_zdrug__alcohol',
  );
  assert.deepEqual(alcohol.object.members, ['diazepam']);
  assert.equal(
    one(['diazepam', 'alcohol'], alcohol.rule_id).runtime_enabled,
    false,
  );
  assert.equal(byId(['zolpidem', 'alcohol'], alcohol.rule_id).length, 0);

  const tramadol = RULES.find(
    (candidate) =>
      candidate.rule_id === 'tramadol__serotonergic_antidepressant',
  );
  assert.deepEqual(tramadol.context_modifiers, []);
  assert.doesNotMatch(
    JSON.stringify({
      mechanism: tramadol.mechanism,
      management: tramadol.management,
    }),
    /seizure|renal|hepatic/iu,
  );

  const gabapentinoid = RULES.find(
    (candidate) => candidate.rule_id === 'opioid__gabapentinoid',
  );
  assert.deepEqual(gabapentinoid.context_modifiers, []);
  assert.doesNotMatch(
    gabapentinoid.management.exceptions,
    /not encoded in this draft/iu,
  );
});

test('Section C evidence uses unique exact-text hashes and no legacy excerpts', () => {
  const seen = new Set();
  for (const rule of RULES) {
    assert.ok(rule.evidence.length > 0, `${rule.rule_id} evidence`);
    for (const evidence of rule.evidence) {
      assert.equal(evidence.source_policy_id, 'openfda-labels');
      assert.equal(evidence.source_policy_use, 'interaction-evidence');
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
      assert.equal(
        new URL(evidence.reference_url).hostname,
        'dailymed.nlm.nih.gov',
      );
      assert.equal('excerpt' in evidence, false, `${rule.rule_id} legacy excerpt`);
      assert.match(
        evidence.citation_status,
        /^machine_confirmed(?:_[a-z0-9]+)*_pending_clinician$/u,
      );
      assert.deepEqual(
        evidence.provenance.source_paths,
        evidence.fragments.map((fragment) => fragment.source_path),
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
