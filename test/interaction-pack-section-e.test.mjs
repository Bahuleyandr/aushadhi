import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkInteractions,
  resolveRule,
} from '../src/lib/interaction-engine.mjs';
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
  'E.verified.jsonl',
);
const SECTION_DIRECTORY = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'sections',
);
const MEMBERS = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'data-static', 'interaction-member-sets.json'),
    'utf8',
  ),
).classes;
const E_RULES = fs.readFileSync(SECTION_PATH, 'utf8')
  .trim()
  .split(/\r?\n/)
  .map(JSON.parse);
const OTHER_RULES = 'ABCDFGHIJ'.split('').flatMap((section) => (
  fs.readFileSync(
    path.join(SECTION_DIRECTORY, `${section}.verified.jsonl`),
    'utf8',
  )
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse)
));
const FULL_RULES = [...OTHER_RULES, ...E_RULES];
const E_RULE_IDS = new Set(E_RULES.map((candidate) => candidate.rule_id));
const SOURCE_MANIFEST = loadSourceManifest();
const SECTION_STORAGE_PATH =
  'docs/interaction-review/batch-01-v2/sections/E.verified.jsonl';

const RUNTIME_KEYS = [
  'clinical_context_complete',
  'pair_matcher_executable',
  'promotion_eligible',
  'runtime_enabled',
];
const SOURCE_ROWS = new Map([
  ['beta_blocker__non_dihydropyridine_ccb', [54]],
  ['beta_blocker__clonidine', [55]],
  ['digoxin__verapamil', [56]],
  ['digoxin__amiodarone', [56]],
  ['digoxin__dronedarone', [56]],
  ['digoxin__clarithromycin', [57]],
  ['digoxin__diltiazem', [56]],
  ['digoxin__renal_impairment_accumulation', [56]],
  ['digoxin__potassium_wasting_diuretic', [58]],
  ['ivabradine__ordinary_negative_chronotrope', [59]],
  ['ivabradine__qt_active_antiarrhythmic', [59]],
  ['adenosine__dipyridamole', [60]],
]);
const EXPECTED_BETA_BLOCKERS = [
  'metoprolol',
  'atenolol',
  'propranolol',
  'bisoprolol',
  'carvedilol',
  'nebivolol',
  'labetalol',
  'sotalol',
  'nadolol',
  'timolol',
  'acebutolol',
  'betaxolol',
  'celiprolol',
  'esmolol',
  'pindolol',
];
const ORDINARY_IVABRADINE_MEMBERS = [
  'digoxin',
  'clonidine',
  'metoprolol',
  'atenolol',
  'propranolol',
  'bisoprolol',
  'carvedilol',
  'nebivolol',
  'labetalol',
  'nadolol',
  'timolol',
  'acebutolol',
  'betaxolol',
  'celiprolol',
  'esmolol',
  'pindolol',
];
const QT_IVABRADINE_MEMBERS = ['amiodarone', 'sotalol'];
const POTASSIUM_WASTING_DIURETICS = [
  'furosemide',
  'torsemide',
  'bumetanide',
  'hydrochlorothiazide',
  'chlorthalidone',
  'indapamide',
  'metolazone',
];

function rule(ruleId) {
  const found = E_RULES.find((candidate) => candidate.rule_id === ruleId);
  assert.ok(found, `${ruleId} missing`);
  return found;
}

function fire(subjects, patientContext = {}, rules = E_RULES) {
  return checkInteractions({
    subjects,
    rules,
    memberSets: MEMBERS,
    patientContext: { jurisdiction: 'US', ...patientContext },
  }).findings;
}

function fullFire(subjects, patientContext = {}) {
  return fire(subjects, patientContext, FULL_RULES);
}

function findingsFor(findings, ruleId) {
  return findings.filter((finding) => finding.rule_id === ruleId);
}

function one(subjects, ruleId, patientContext = {}, rules = E_RULES) {
  const findings = findingsFor(
    fire(subjects, patientContext, rules),
    ruleId,
  );
  assert.equal(
    findings.length,
    1,
    `${subjects.join(' + ')} expected one ${ruleId}, got ${findings.length}`,
  );
  return findings[0];
}

function actionSnapshot(finding) {
  return {
    severity: finding.severity,
    dispense_action: finding.dispense_action,
    action_target: finding.action_target,
    do_not_interrupt: finding.do_not_interrupt,
    runtime_enabled: finding.runtime_enabled,
    data_required: finding.data_required,
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function evidenceFixture(entry) {
  const payload = {
    set_id: entry.provenance.set_id,
    version: entry.provenance.version,
    effective_time: entry.provenance.effective_time,
  };
  for (const fragment of entry.fragments) {
    const match = /^([a-zA-Z0-9_]+)\[(\d+)\]$/u.exec(fragment.source_path);
    assert.ok(match, `unsupported fixture path ${fragment.source_path}`);
    const [, field, indexRaw] = match;
    const index = Number(indexRaw);
    payload[field] ??= [];
    payload[field][index] = [payload[field][index], fragment.text]
      .filter(Boolean)
      .join(' ');
  }
  const evidence = structuredClone(entry);
  evidence.provenance.payload_sha256 = createHash('sha256')
    .update(JSON.stringify(canonicalize(payload)), 'utf8')
    .digest('hex');
  return { evidence, payload };
}

test('Section E is hardened 12-row JSONL with exact runtime, source, risk and hash contracts', () => {
  const raw = fs.readFileSync(SECTION_PATH, 'utf8');
  const reviewDocs = [
    fs.readFileSync(
      path.join(ROOT, 'docs', 'interaction-review', '2026-07-23-section-E-citations.md'),
      'utf8',
    ),
    fs.readFileSync(
      path.join(ROOT, 'docs', 'interaction-review', '2026-07-23-section-E-reconciled.md'),
      'utf8',
    ),
    fs.readFileSync(
      path.join(ROOT, 'docs', 'interaction-review', 'batch-01-v2', 'review-index.md'),
      'utf8',
    ).match(/^## E\.[\s\S]*?(?=^## F\.)/mu)?.[0] ?? '',
  ].join('\n');
  const sectionHash = createHash('sha256').update(raw, 'utf8').digest('hex');
  const fragmentHashes = new Set();
  let evidenceCount = 0;
  let fragmentCount = 0;

  assert.equal(E_RULES.length, 12);
  assert.equal(new Set(E_RULES.map((candidate) => candidate.rule_id)).size, 12);
  assert.equal(SOURCE_ROWS.size, 12);
  assert.doesNotMatch(
    raw,
    /<(?:verify|placeholder|todo|tbd|tbc|fill|source|citation)(?::[^>]*)?>/iu,
  );
  assert.doesNotMatch(raw, /tokens truncated|…\d+ tokens/iu);
  assert.doesNotMatch(
    `${raw}\n${reviewDocs}`,
    /medicines\.org\.uk|\bemc\b|restricted (?:uk|united kingdom)|united kingdom locator|mhra/iu,
  );
  assert.doesNotThrow(() => validateDraftRules(E_RULES));
  assert.ok(reviewDocs.includes(sectionHash), 'review documents must pin the Section E hash');

  for (const candidate of E_RULES) {
    const actionJurisdictions = [
      ...new Set(
        candidate.evidence
          .filter((evidence) => (
            evidence.supports.interaction_exists === true
            && evidence.supports.label_action.length > 0
          ))
          .flatMap((evidence) => evidence.supports.jurisdictions),
      ),
    ];
    assert.deepEqual(
      candidate.applicability.jurisdiction,
      actionJurisdictions,
      `${candidate.rule_id} action-bearing jurisdiction scope`,
    );
    assert.equal(
      candidate.applicability.jurisdiction.includes('IN'),
      false,
      `${candidate.rule_id} must not infer Indian applicability`,
    );
    assert.equal(
      candidate.applicability.jurisdiction.includes('UK'),
      false,
      `${candidate.rule_id} must not infer United Kingdom applicability`,
    );
    assert.deepEqual(
      candidate.source_rows,
      SOURCE_ROWS.get(candidate.rule_id),
      `${candidate.rule_id} source_rows`,
    );
    assert.deepEqual(
      Object.keys(candidate.runtime_status).sort(),
      RUNTIME_KEYS,
      `${candidate.rule_id} runtime_status keys`,
    );
    for (const key of RUNTIME_KEYS) {
      assert.equal(
        typeof candidate.runtime_status[key],
        'boolean',
        `${candidate.rule_id}.runtime_status.${key}`,
      );
    }
    assert.equal(
      candidate.runtime_enabled,
      candidate.runtime_status.runtime_enabled,
      `${candidate.rule_id} runtime mirror`,
    );
    assert.equal(
      candidate.runtime_status.promotion_eligible,
      false,
      `${candidate.rule_id} promotion`,
    );
    assert.equal(
      candidate.runtime_status.clinical_context_complete,
      false,
      `${candidate.rule_id} clinical context must remain incomplete`,
    );
    assert.equal(
      candidate.runtime_enabled,
      false,
      `${candidate.rule_id} must fail closed`,
    );
    assert.deepEqual(
      candidate.context_modifiers,
      [],
      `${candidate.rule_id} must not hide an unsourced context action`,
    );
    assert.ok(
      Array.isArray(candidate.management?.risk_factors)
        && candidate.management.risk_factors.length > 0,
      `${candidate.rule_id} risk factors`,
    );
    assert.ok(
      candidate.management.risk_factors.every(
        (factor) => factor.gateable === false,
      ),
      `${candidate.rule_id} risk factors must remain advisory`,
    );
    assert.ok(
      Array.isArray(candidate.evidence) && candidate.evidence.length > 0,
      `${candidate.rule_id} evidence`,
    );

    for (const [evidenceIndex, evidence] of candidate.evidence.entries()) {
      evidenceCount += 1;
      const at = `${candidate.rule_id}.evidence[${evidenceIndex}]`;
      for (const field of [
        'source_id',
        'regulator',
        'product',
        'publisher',
        'label_section',
        'normalized_proposition',
        'source_url',
        'source_host',
        'source_date',
        'source_date_type',
        'quote_integrity',
        'currentness_status',
        'citation_status',
      ]) {
        assert.ok(
          typeof evidence[field] === 'string' && evidence[field].trim(),
          `${at}.${field}`,
        );
      }
      assert.equal(evidence.source_host, 'api.fda.gov', `${at} licensed source host`);
      assert.equal(new URL(evidence.source_url).protocol, 'https:');
      assert.equal(
        new URL(evidence.source_url).searchParams.get('search'),
        `set_id:"${evidence.canonical_setid}"`,
        `${at} exact set-ID query`,
      );
      assert.equal(new URL(evidence.source_url).searchParams.get('limit'), '100');
      assert.equal(new URL(evidence.reference_url).hostname, 'dailymed.nlm.nih.gov');
      assert.equal(
        new URL(evidence.reference_url).searchParams.get('setid'),
        evidence.canonical_setid,
      );
      assert.equal(evidence.source_policy_id, 'openfda-labels');
      assert.equal(evidence.source_policy_use, 'interaction-evidence');
      assert.equal(evidence.licence, 'CC0-1.0');
      assert.equal(evidence.document_id, evidence.provenance.set_id);
      assert.equal(evidence.document_version, evidence.provenance.version);
      assert.equal(String(evidence.spl_version), evidence.provenance.version);
      assert.equal(
        evidence.source_date.replaceAll('-', ''),
        evidence.provenance.effective_time,
      );
      assert.equal(evidence.jurisdiction, 'US');
      assert.equal(evidence.review_status, 'review_candidate');
      assert.match(evidence.provenance.payload_sha256, /^[a-f0-9]{64}$/u);
      assert.equal(
        evidence.provenance.payload_canonicalization,
        'sorted-json-keys-v1',
      );
      assert.equal(
        evidence.provenance.normalization_version,
        'openfda-spl-text-v1',
      );
      assert.deepEqual(
        evidence.provenance.source_paths,
        evidence.fragments.map((fragment) => fragment.source_path),
      );
      assert.throws(
        () => assertEvidenceAllowed(SOURCE_MANIFEST, evidence, {
          profile: 'production-open',
          use: evidence.source_policy_use,
          storagePath: SECTION_STORAGE_PATH,
        }),
        /verified source payload is required/u,
        `${at} must fail closed without its bound payload`,
      );
      assert.equal(evidence.accessed_at, '2026-07-23');
      assert.equal(evidence.currentness_checked_at, '2026-07-23');
      assert.match(evidence.currentness_status, /^checked_current/);
      assert.match(
        evidence.citation_status,
        /^machine_confirmed[a-z0-9_]*_pending_clinician$/,
      );
      assert.equal(Object.hasOwn(evidence, 'excerpt'), false, `${at} excerpt`);
      assert.ok(evidence.fragments.length > 0, `${at} fragments`);
      assert.equal(
        evidence.quote_integrity,
        evidence.fragments.length === 1
          ? 'single_verbatim'
          : 'multi_fragment_verbatim',
      );
      for (const [fragmentIndex, item] of evidence.fragments.entries()) {
        fragmentCount += 1;
        const fragmentAt = `${at}.fragments[${fragmentIndex}]`;
        assert.equal(item.text, item.text.trim(), `${fragmentAt} whitespace`);
        const actual = createHash('sha256')
          .update(item.text, 'utf8')
          .digest('hex');
        assert.equal(item.text_sha256, actual, `${fragmentAt} hash`);
        assert.match(item.source_path, /^[a-zA-Z0-9_]+\[\d+\]$/u);
        assert.equal(
          fragmentHashes.has(actual),
          false,
          `${fragmentAt} duplicate hash`,
        );
        fragmentHashes.add(actual);
      }
      assert.equal(evidence.supports.interaction_exists, true, at);
      assert.equal(
        evidence.supports.runtime_severity_is_local_mapping,
        true,
        at,
      );
      assert.ok(evidence.supports.source_effect.length > 0, at);
      assert.ok(Array.isArray(evidence.supports.label_action), at);
      assert.ok(evidence.supports.jurisdictions.length > 0, at);
      assert.ok(evidence.supports.scope?.scope_type, at);
      assert.ok(evidence.does_not_by_itself_support.length > 0, at);
    }
  }

  assert.equal(evidenceCount, 13);
  assert.equal(fragmentCount, 27);
  assert.equal(fragmentHashes.size, 27);
  assert.equal(E_RULES.filter((candidate) => candidate.runtime_enabled).length, 0);
  assert.deepEqual(
    E_RULES
      .filter((candidate) => !candidate.runtime_status.pair_matcher_executable)
      .map((candidate) => candidate.rule_id),
    [
      'digoxin__renal_impairment_accumulation',
      'ivabradine__qt_active_antiarrhythmic',
    ],
  );

  const qt = rule('ivabradine__qt_active_antiarrhythmic');
  assert.deepEqual(qt.applicability.jurisdiction, []);
  assert.equal(qt.management.dispense_action, 'confirm_and_monitor');
  assert.equal(qt.management.action_target, null);
  assert.deepEqual(qt.management.do_not_interrupt, []);
  assert.equal(Object.hasOwn(qt, 'manual_reference'), false);
  assert.match(
    qt.second_subject.members_note,
    /no reusable jurisdiction-backed action evidence is accepted/u,
  );
  assert.deepEqual(qt.evidence[0].supports.label_action, []);
});

test('expanded beta-blocker scope fires once for both non-DHP CCBs and clonidine', () => {
  assert.deepEqual(MEMBERS.beta_blocker.any, EXPECTED_BETA_BLOCKERS);

  for (const betaBlocker of EXPECTED_BETA_BLOCKERS) {
    for (const ccb of ['verapamil', 'diltiazem']) {
      const finding = one(
        [betaBlocker, ccb],
        'beta_blocker__non_dihydropyridine_ccb',
      );
      assert.equal(finding.severity, 'major', `${betaBlocker} + ${ccb}`);
      assert.equal(finding.runtime_enabled, false, `${betaBlocker} + ${ccb}`);
      assert.equal(
        finding.clinical_action_status,
        'unresolved_pending_route_or_formulation',
        `${betaBlocker} + ${ccb}`,
      );
      assert.equal(
        rule('beta_blocker__non_dihydropyridine_ccb').management.dispense_action,
        'confirm_and_monitor',
      );
      assert.equal(
        findingsFor(
          fire([ccb, betaBlocker]),
          'beta_blocker__non_dihydropyridine_ccb',
        ).length,
        1,
      );
    }

    const clonidine = one(
      [betaBlocker, 'clonidine'],
      'beta_blocker__clonidine',
    );
    assert.equal(clonidine.severity, 'major');
    assert.equal(clonidine.runtime_enabled, false);
    assert.equal(
      clonidine.clinical_action_status,
      'unresolved_pending_route_or_formulation',
    );
    assert.equal(rule('beta_blocker__clonidine').management.dispense_action, 'confirm_and_monitor');
  }

  assert.deepEqual(
    fire(['amlodipine', 'metoprolol']).filter(
      (finding) => finding.rule_id
        === 'beta_blocker__non_dihydropyridine_ccb',
    ),
    [],
  );
  assert.deepEqual(
    fire(['ivabradine', 'verapamil']).filter(
      (finding) => finding.rule_id
        === 'beta_blocker__non_dihydropyridine_ccb',
    ),
    [],
  );
});

test('Section E source policy accepts a fixture only when payload identity and fragments bind', () => {
  const { evidence, payload } = evidenceFixture(E_RULES[0].evidence[0]);
  assert.doesNotThrow(() => assertEvidenceAllowed(SOURCE_MANIFEST, evidence, {
    profile: 'production-open',
    use: evidence.source_policy_use,
    storagePath: SECTION_STORAGE_PATH,
    payload,
  }));

  const tampered = structuredClone(payload);
  tampered[evidence.fragments[0].source_path.split('[')[0]][0] =
    'payload no longer contains the retained fragment';
  assert.throws(
    () => assertEvidenceAllowed(SOURCE_MANIFEST, evidence, {
      profile: 'production-open',
      use: evidence.source_policy_use,
      storagePath: SECTION_STORAGE_PATH,
      payload: tampered,
    }),
    /payload SHA-256 does not match provenance|fragment is absent/u,
  );
});

test('Section E mechanisms and monitoring do not outrun the retained fragments', () => {
  const betaCcb = rule('beta_blocker__non_dihydropyridine_ccb');
  assert.doesNotMatch(
    `${betaCcb.mechanism} ${betaCcb.management.monitoring}`,
    /hypotension|heart[- ]failure|ventricular function/i,
  );

  const clonidine = rule('beta_blocker__clonidine');
  assert.match(
    clonidine.evidence[0].fragments[0].text,
    /^Sudden cessation of clonidine treatment/u,
  );
  assert.equal(
    clonidine.evidence[0].fragments[0].text_sha256,
    '3cd7ca7d07a1c2f5e43da00d6cd3ac2ed8888a072f43e64c38cb51a918790f68',
  );
  assert.equal(
    clonidine.management.monitoring,
    'Heart rate during concomitant clonidine and beta-blocker treatment.',
  );

  for (const ruleId of [
    'digoxin__verapamil',
    'digoxin__amiodarone',
    'digoxin__dronedarone',
    'digoxin__clarithromycin',
    'digoxin__diltiazem',
  ]) {
    const candidate = rule(ruleId);
    assert.doesNotMatch(
      candidate.management.monitoring,
      /renal|electrolyte|AV conduction|heart rate|rhythm/i,
      ruleId,
    );
  }
  assert.doesNotMatch(rule('digoxin__clarithromycin').mechanism, /P-glycoprotein/i);
  assert.equal(
    rule('digoxin__potassium_wasting_diuretic').management.monitoring,
    'Serum potassium and magnesium.',
  );
  assert.equal(
    rule('ivabradine__ordinary_negative_chronotrope').management.monitoring,
    'Heart rate.',
  );
  assert.match(
    rule('adenosine__dipyridamole').management.monitoring,
    /no monitoring instruction/i,
  );
});

test('all digoxin pair findings are exact, protected and invariant to renal context', () => {
  const exactPairs = [
    ['verapamil', 'digoxin__verapamil', 'major'],
    ['amiodarone', 'digoxin__amiodarone', 'major'],
    ['dronedarone', 'digoxin__dronedarone', 'major'],
    ['clarithromycin', 'digoxin__clarithromycin', 'major'],
    ['diltiazem', 'digoxin__diltiazem', 'moderate'],
  ];

  for (const [drug, ruleId, severity] of exactPairs) {
    const unknown = one(['digoxin', drug], ruleId);
    const low = one(
      ['digoxin', drug],
      ruleId,
      { renal: { egfr: 20 } },
    );
    const high = one(
      ['digoxin', drug],
      ruleId,
      { renal: { egfr: 80 } },
    );
    assert.equal(unknown.severity, severity, ruleId);
    assert.equal(unknown.runtime_enabled, false, ruleId);
    assert.equal(
      unknown.clinical_action_status,
      'unresolved_pending_route_or_formulation',
      ruleId,
    );
    assert.equal(rule(ruleId).management.dispense_action, 'confirm_and_monitor');
    assert.deepEqual(actionSnapshot(low), actionSnapshot(unknown), ruleId);
    assert.deepEqual(actionSnapshot(high), actionSnapshot(unknown), ruleId);
    assert.equal(findingsFor(fire([drug, 'digoxin']), ruleId).length, 1);
  }

  const diltiazem = rule('digoxin__diltiazem');
  assert.doesNotMatch(JSON.stringify(diltiazem), /verapamil/i);
  assert.deepEqual(
    diltiazem.management.do_not_interrupt,
    ['object_drug', 'perpetrator_drug'],
  );

  const potassiumWasting = rule('digoxin__potassium_wasting_diuretic');
  assert.doesNotMatch(
    potassiumWasting.mechanism,
    /\bUK\b|SmPC|loop diuretics or hydrochlorothiazide/i,
  );
  assert.match(
    potassiumWasting.mechanism,
    /U\.S\..*diuretics only as a broad possible cause/i,
  );
  assert.deepEqual(
    potassiumWasting.evidence[0].supports.jurisdictions,
    ['US'],
  );
  assert.deepEqual(
    potassiumWasting.evidence[0].supports.label_action,
    ['maintain_normal_serum_potassium_and_magnesium'],
  );
  assert.equal(
    Object.hasOwn(potassiumWasting, 'manual_reference'),
    false,
  );
  assert.deepEqual(
    potassiumWasting.second_subject.members,
    POTASSIUM_WASTING_DIURETICS,
  );
  for (const diuretic of POTASSIUM_WASTING_DIURETICS) {
    const unknown = one(
      ['digoxin', diuretic],
      'digoxin__potassium_wasting_diuretic',
    );
    const low = one(
      ['digoxin', diuretic],
      'digoxin__potassium_wasting_diuretic',
      { renal: { egfr: 20 } },
    );
    assert.equal(unknown.severity, 'moderate', diuretic);
    assert.equal(unknown.runtime_enabled, false, diuretic);
    assert.equal(
      unknown.clinical_action_status,
      'unresolved_pending_route_or_formulation',
      diuretic,
    );
    assert.deepEqual(actionSnapshot(low), actionSnapshot(unknown), diuretic);
  }

  for (const negative of ['spironolactone', 'amiloride', 'random medicine']) {
    assert.equal(
      findingsFor(
        fire(['digoxin', negative]),
        'digoxin__potassium_wasting_diuretic',
      ).length,
      0,
      negative,
    );
  }
});

test('renal accumulation remains a threshold-free unary diagnostic that protects digoxin', () => {
  const renal = rule('digoxin__renal_impairment_accumulation');
  assert.equal(renal.risk_basis, 'condition_only');
  assert.equal(renal.rule_type, 'drug_condition_reference');
  assert.equal(Object.hasOwn(renal, 'perpetrator'), false);
  assert.deepEqual(renal.context_modifiers, []);
  assert.deepEqual(renal.management.do_not_interrupt, ['digoxin']);
  assert.equal(renal.runtime_enabled, false);
  assert.equal(renal.runtime_status.pair_matcher_executable, false);
  assert.equal(renal.runtime_status.clinical_context_complete, false);
  assert.deepEqual(fire(['digoxin']), []);
  assert.deepEqual(
    actionSnapshot(resolveRule(renal)),
    actionSnapshot(resolveRule(renal, { renal: { egfr: 20 } })),
  );
  assert.deepEqual(
    actionSnapshot(resolveRule(renal)),
    actionSnapshot(resolveRule(renal, { renal: { egfr: 80 } })),
  );
  assert.equal(resolveRule(renal).dispense_action, 'confirm_and_monitor');
  assert.deepEqual(resolveRule(renal).do_not_interrupt, ['digoxin']);
  assert.doesNotMatch(JSON.stringify(renal.context_modifiers), /egfr/i);
});

test('ivabradine monitor and QT manual-review tiers are exact, disjoint and duplicate-free', () => {
  const ordinaryRule = rule('ivabradine__ordinary_negative_chronotrope');
  const qtRule = rule('ivabradine__qt_active_antiarrhythmic');
  assert.deepEqual(
    ordinaryRule.second_subject.members,
    ORDINARY_IVABRADINE_MEMBERS,
  );
  assert.deepEqual(qtRule.second_subject.members, QT_IVABRADINE_MEMBERS);
  assert.deepEqual(
    ORDINARY_IVABRADINE_MEMBERS.filter(
      (member) => QT_IVABRADINE_MEMBERS.includes(member),
    ),
    [],
  );

  for (const member of ORDINARY_IVABRADINE_MEMBERS) {
    const findings = fire(['ivabradine', member]);
    const ordinary = findingsFor(
      findings,
      'ivabradine__ordinary_negative_chronotrope',
    );
    assert.equal(ordinary.length, 1, member);
    assert.equal(ordinary[0].severity, 'moderate', member);
    assert.equal(ordinary[0].runtime_enabled, false, member);
    assert.equal(
      ordinary[0].clinical_action_status,
      'unresolved_pending_route_or_formulation',
      member,
    );
    assert.equal(
      findingsFor(
        findings,
        'ivabradine__qt_active_antiarrhythmic',
      ).length,
      0,
      member,
    );
  }

  for (const member of QT_IVABRADINE_MEMBERS) {
    const findings = fire(['ivabradine', member]);
    assert.equal(
      findingsFor(findings, 'ivabradine__qt_active_antiarrhythmic').length,
      0,
      member,
    );
    assert.equal(
      findingsFor(
        findings,
        'ivabradine__ordinary_negative_chronotrope',
      ).length,
      0,
      member,
    );
  }

  for (const cypOwned of ['verapamil', 'diltiazem']) {
    const sectionFindings = fire(['ivabradine', cypOwned]);
    assert.equal(
      sectionFindings.filter((finding) => finding.rule_id.startsWith('ivabradine__')).length,
      0,
      cypOwned,
    );
    const full = fullFire(['ivabradine', cypOwned]);
    assert.equal(
      findingsFor(full, 'ivabradine__moderate_cyp3a4_inhibitor').length,
      1,
      cypOwned,
    );
  }

  for (const member of [...ORDINARY_IVABRADINE_MEMBERS, ...QT_IVABRADINE_MEMBERS]) {
    const unknown = fire(['ivabradine', member]);
    const low = fire(
      ['ivabradine', member],
      { renal: { egfr: 20 }, hepatic: { child_pugh: 'C' } },
    );
    assert.deepEqual(
      low.map(actionSnapshot),
      unknown.map(actionSnapshot),
      member,
    );
  }

  assert.deepEqual(fire(['ivabradine', 'ivabradine']), []);
  assert.deepEqual(
    fire(['ivabradine', 'random medicine']).filter(
      (finding) => finding.rule_id.startsWith('ivabradine__'),
    ),
    [],
  );
});

test('Section E actions are unavailable outside their retained U.S. jurisdiction', () => {
  assert.equal(
    findingsFor(
      fire(['digoxin', 'verapamil'], { jurisdiction: 'IN' }),
      'digoxin__verapamil',
    ).length,
    0,
  );
  assert.equal(
    findingsFor(
      fire(['metoprolol', 'clonidine'], { jurisdiction: 'UK' }),
      'beta_blocker__clonidine',
    ).length,
    0,
  );

  assert.equal(
    findingsFor(
      fire(['ivabradine', 'amiodarone'], { jurisdiction: 'IN' }),
      'ivabradine__qt_active_antiarrhythmic',
    ).length,
    0,
  );
});

test('adenosine and dipyridamole remains an exact procedural diagnostic without a duration claim', () => {
  const subjects = [
    { drug: 'adenosine', route: 'iv', formulation: 'injection' },
    { drug: 'dipyridamole', route: 'systemic', formulation: 'tablet' },
  ];
  const finding = one(
    subjects,
    'adenosine__dipyridamole',
  );
  assert.equal(finding.severity, 'major');
  assert.equal(finding.dispense_action, 'confirm_and_monitor');
  assert.equal(finding.runtime_enabled, false);
  assert.deepEqual(finding.do_not_interrupt, []);
  assert.equal(
    findingsFor(
      fire([...subjects].reverse()),
      'adenosine__dipyridamole',
    ).length,
    1,
  );
  assert.doesNotMatch(
    JSON.stringify(rule('adenosine__dipyridamole')),
    /\bprolong(?:s|ed|ing)?\b/i,
  );
  assert.equal(
    findingsFor(
      fire(['adenosine', 'theophylline']),
      'adenosine__dipyridamole',
    ).length,
    0,
  );
});

test('declared Section E member matrix has one owned finding and no cross-pack duplicate', () => {
  const cases = [];
  for (const betaBlocker of EXPECTED_BETA_BLOCKERS) {
    for (const ccb of ['verapamil', 'diltiazem']) {
      cases.push([
        [betaBlocker, ccb],
        'beta_blocker__non_dihydropyridine_ccb',
      ]);
    }
    cases.push([[betaBlocker, 'clonidine'], 'beta_blocker__clonidine']);
  }
  for (const [drug, id] of [
    ['verapamil', 'digoxin__verapamil'],
    ['amiodarone', 'digoxin__amiodarone'],
    ['dronedarone', 'digoxin__dronedarone'],
    ['clarithromycin', 'digoxin__clarithromycin'],
    ['diltiazem', 'digoxin__diltiazem'],
  ]) {
    cases.push([['digoxin', drug], id]);
  }
  for (const member of POTASSIUM_WASTING_DIURETICS) {
    cases.push([
      ['digoxin', member],
      'digoxin__potassium_wasting_diuretic',
    ]);
  }
  for (const member of ORDINARY_IVABRADINE_MEMBERS) {
    cases.push([
      ['ivabradine', member],
      'ivabradine__ordinary_negative_chronotrope',
    ]);
  }
  cases.push([
    [
      { drug: 'adenosine', route: 'iv', formulation: 'injection' },
      { drug: 'dipyridamole', route: 'systemic', formulation: 'tablet' },
    ],
    'adenosine__dipyridamole',
  ]);

  for (const [subjects, expectedRule] of cases) {
    const full = fullFire(subjects);
    assert.equal(
      findingsFor(full, expectedRule).length,
      1,
      `${subjects.map((subject) => subject.drug ?? subject).join(' + ')} owned rule`,
    );
    const sameSection = full.filter((finding) => E_RULE_IDS.has(finding.rule_id));
    assert.equal(
      sameSection.length,
      1,
      `${subjects.map((subject) => subject.drug ?? subject).join(' + ')} Section E duplicate`,
    );
  }

  for (const member of QT_IVABRADINE_MEMBERS) {
    assert.equal(
      findingsFor(
        fullFire(['ivabradine', member]),
        'ivabradine__qt_active_antiarrhythmic',
      ).length,
      0,
      `${member} QT record must remain quarantined`,
    );
  }
});
