import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { checkInteractions } from '../src/lib/interaction-engine.mjs';
import { validateDraftRules } from '../src/lib/interaction-draft-validation.mjs';
import {
  assertEvidenceAllowed,
  loadSourceManifest,
} from '../src/lib/interaction-source-policy.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repository = join(here, '..');
const sectionPath = join(
  repository,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'sections',
  'F.verified.jsonl',
);
const sectionRaw = readFileSync(sectionPath, 'utf8');
const sourceManifest = loadSourceManifest();
const sectionStoragePath =
  'docs/interaction-review/batch-01-v2/sections/F.verified.jsonl';
const memberSets = JSON.parse(
  readFileSync(join(repository, 'data-static', 'interaction-member-sets.json'), 'utf8'),
).classes;
const severities = new Set(['minor', 'moderate', 'major', 'contraindicated']);
const runtimeKeys = [
  'clinical_context_complete',
  'pair_matcher_executable',
  'promotion_eligible',
  'runtime_enabled',
];
const quarantinedRuleIds = new Set([
  'acei_arb_diuretic__nsaid_triple_whammy',
  'cotrimoxazole__ace_inhibitor',
  'cotrimoxazole__other_potassium_raising_agent',
  'methotrexate_high_dose__nsaid_systemic',
  'methotrexate_lower_dose__nsaid_systemic',
  'methotrexate__cotrimoxazole',
]);
const captureArtifactPattern = /(?:^|\r?\n)(?:Exit code:|Wall time:|Total output lines:|Output:)(?:\s|$)|(?:tokens truncated|…\d+\s+tokens truncated…)/i;
const unresolvedMarkerPattern = /<verify>|\b(?:todo|tbd|tbc|fixme|placeholder|provisional)\b/i;

function parseAndValidateSection(raw) {
  if (captureArtifactPattern.test(raw)) {
    throw new Error('Section F contains a command-output wrapper or truncation sentinel');
  }
  const parsed = raw
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  for (const rule of parsed) {
    if (!severities.has(rule.severity)) {
      throw new Error(`${rule.rule_id} has invalid base severity ${String(rule.severity)}`);
    }
    for (const modifier of rule.context_modifiers || []) {
      if (modifier.severity !== undefined && !severities.has(modifier.severity)) {
        throw new Error(`${rule.rule_id} has invalid context modifier severity ${String(modifier.severity)}`);
      }
    }
    assert.deepEqual(
      Object.keys(rule.runtime_status).sort(),
      runtimeKeys,
      `${rule.rule_id} runtime_status must contain exactly four fields`,
    );
    assert.ok(
      Object.values(rule.runtime_status).every((value) => typeof value === 'boolean'),
      `${rule.rule_id} runtime_status must be boolean-only`,
    );
  }
  if (unresolvedMarkerPattern.test(raw)) {
    throw new Error('Section F contains an unresolved marker');
  }
  return parsed;
}

const rules = parseAndValidateSection(sectionRaw);
const byId = Object.fromEntries(rules.map((rule) => [rule.rule_id, rule]));

function fire(subjects, patientContext = {}) {
  return checkInteractions({
    subjects,
    rules,
    memberSets,
    patientContext: { jurisdiction: 'US', ...patientContext },
  }).findings;
}

function one(subjects, ruleId, patientContext = {}) {
  return fire(subjects, patientContext).filter((finding) => finding.rule_id === ruleId);
}

function has(subjects, ruleId, patientContext = {}) {
  return one(subjects, ruleId, patientContext).length > 0;
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
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
  evidence.provenance.payload_sha256 = sha256(JSON.stringify(canonicalize(payload)));
  return { evidence, payload };
}

test('Section F is capture-safe and its validator rejects an invalid severity literal', () => {
  assert.doesNotMatch(sectionRaw, captureArtifactPattern);
  assert.doesNotMatch(sectionRaw, unresolvedMarkerPattern);

  const mutated = structuredClone(rules);
  mutated[0].context_modifiers = [{
    factor: 'renal',
    when: 'egfr_lt_30',
    severity: '<verify>',
  }];
  assert.throws(
    () => parseAndValidateSection(mutated.map((rule) => JSON.stringify(rule)).join('\n')),
    /invalid context modifier severity <verify>/,
  );
});

test('Section F has 16 fail-closed draft rules and bound openFDA provenance', () => {
  assert.doesNotThrow(() => validateDraftRules(rules));
  assert.equal(rules.length, 16);
  assert.equal(new Set(rules.map((rule) => rule.rule_id)).size, 16);
  assert.equal(rules.filter((rule) => rule.runtime_enabled).length, 0);
  assert.deepEqual(
    rules.filter((rule) => rule.runtime_enabled).map((rule) => rule.rule_id),
    [],
  );
  const reviewDocs = [
    readFileSync(
      join(repository, 'docs', 'interaction-review', '2026-07-23-section-F-citations.md'),
      'utf8',
    ),
    readFileSync(
      join(repository, 'docs', 'interaction-review', '2026-07-23-section-F-reconciled.md'),
      'utf8',
    ),
  ].join('\n');
  assert.ok(reviewDocs.includes(sha256(sectionRaw)), 'review documents must pin the Section F hash');

  const hashOwners = new Map();
  let evidenceCount = 0;
  let fragmentCount = 0;
  for (const rule of rules) {
    const actionJurisdictions = [
      ...new Set(
        rule.evidence
          .filter((evidence) => (
            evidence.supports.interaction_exists === true
            && evidence.supports.label_action.length > 0
          ))
          .flatMap((evidence) => evidence.supports.jurisdictions),
      ),
    ];
    if (rule.rule_id === 'acei_arb_diuretic__nsaid_triple_whammy') {
      assert.deepEqual(rule.applicability.jurisdiction, []);
    } else {
      assert.deepEqual(
        rule.applicability.jurisdiction,
        actionJurisdictions,
        `${rule.rule_id} action-bearing jurisdiction scope`,
      );
    }
    assert.equal(rule.applicability.jurisdiction.includes('IN'), false);
    assert.equal(rule.applicability.jurisdiction.includes('UK'), false);
    assert.equal(rule._section, 'F');
    assert.equal(rule.proposed_status, 'draft_for_review');
    assert.deepEqual(rule.review.author, null);
    assert.deepEqual(rule.review.approver, null);
    assert.equal(rule.runtime_enabled, rule.runtime_status.runtime_enabled);
    assert.equal(
      rule.runtime_status.pair_matcher_executable,
      !quarantinedRuleIds.has(rule.rule_id),
      `${rule.rule_id} exact matcher state`,
    );
    assert.equal(rule.runtime_status.clinical_context_complete, false);
    assert.equal(rule.runtime_status.promotion_eligible, false);
    assert.equal(rule.runtime_enabled, false);
    assert.deepEqual(rule.context_modifiers, [], `${rule.rule_id} must not retain an unsourced context branch`);
    assert.ok(Array.isArray(rule.risk_factors) && rule.risk_factors.length > 0);
    assert.ok(rule.risk_factors.every((factor) => typeof factor.gateable === 'boolean'));
    assert.ok(Array.isArray(rule.claims_needing_citation) && rule.claims_needing_citation.length > 0);

    for (const evidence of rule.evidence) {
      evidenceCount += 1;
      assert.equal(Object.hasOwn(evidence, 'excerpt'), false);
      assert.equal(Object.hasOwn(evidence, 'source_policy'), false);
      assert.equal(evidence.source_policy_id, 'openfda-labels');
      assert.equal(evidence.source_policy_use, 'interaction-evidence');
      assert.equal(evidence.licence, 'CC0-1.0');
      assert.equal(new URL(evidence.source_url).hostname, 'api.fda.gov');
      assert.equal(
        new URL(evidence.source_url).searchParams.get('search'),
        `set_id:"${evidence.provenance.set_id}"`,
      );
      assert.equal(new URL(evidence.source_url).searchParams.get('limit'), '100');
      assert.equal(new URL(evidence.reference_url).hostname, 'dailymed.nlm.nih.gov');
      assert.equal(
        new URL(evidence.reference_url).searchParams.get('setid'),
        evidence.provenance.set_id,
      );
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
        () => assertEvidenceAllowed(sourceManifest, evidence, {
          profile: 'production-open',
          use: evidence.source_policy_use,
          storagePath: sectionStoragePath,
        }),
        /verified source payload is required/u,
        `${rule.rule_id}/${evidence.source_id} must fail closed without its bound payload`,
      );
      assert.deepEqual(evidence.supports.jurisdictions, ['US']);
      assert.ok(evidence.does_not_by_itself_support.length > 0);

      const effects = new Set(evidence.supports.source_effect.map((value) => value.toLowerCase()));
      for (const action of evidence.supports.label_action) {
        assert.equal(effects.has(action.toLowerCase()), false, `${rule.rule_id}/${evidence.source_id} mixes effect and action`);
      }
      for (const fragment of evidence.fragments) {
        fragmentCount += 1;
        assert.equal(fragment.text_sha256, sha256(fragment.text));
        assert.match(fragment.source_path, /^[a-zA-Z0-9_]+\[\d+\]$/u);
        assert.equal(hashOwners.has(fragment.text_sha256), false, `${rule.rule_id}/${evidence.source_id} duplicates a fragment`);
        hashOwners.set(fragment.text_sha256, `${rule.rule_id}/${evidence.source_id}`);
      }
    }
  }
  assert.equal(evidenceCount, 17);
  assert.equal(fragmentCount, 42);
  assert.equal(hashOwners.size, 42);
  assert.equal(
    rules.filter((rule) => rule.applicability.jurisdiction.includes('US')).length,
    13,
  );
  assert.deepEqual(
    rules
      .filter((rule) => rule.applicability.jurisdiction.length === 0)
      .map((rule) => rule.rule_id),
    [
      'acei_arb_diuretic__nsaid_triple_whammy',
      'methotrexate_high_dose__nsaid_systemic',
      'methotrexate__cotrimoxazole',
    ],
  );
});

test('Section F source policy accepts a fixture only when payload identity and fragments bind', () => {
  const { evidence, payload } = evidenceFixture(rules[0].evidence[0]);
  assert.doesNotThrow(() => assertEvidenceAllowed(sourceManifest, evidence, {
    profile: 'production-open',
    use: evidence.source_policy_use,
    storagePath: sectionStoragePath,
    payload,
  }));

  const tampered = structuredClone(payload);
  tampered[evidence.fragments[0].source_path.split('[')[0]][0] =
    'payload no longer contains the retained fragment';
  assert.throws(
    () => assertEvidenceAllowed(sourceManifest, evidence, {
      profile: 'production-open',
      use: evidence.source_policy_use,
      storagePath: sectionStoragePath,
      payload: tampered,
    }),
    /payload SHA-256 does not match provenance|fragment is absent/u,
  );
});

test('Section F pins XML-backed replacements for the two orphaned DailyMed set IDs', () => {
  const potassium = byId.acei_arb__potassium_supplement_salt_substitute.evidence[0];
  const methotrexatePpi = byId.methotrexate_high_dose__ppi.evidence[0];

  assert.doesNotMatch(
    sectionRaw,
    /43328c3a-5f78-44b8-ad3d-35b50788eab2|7dcd02d7-1ce0-43fc-8f25-2f0bb0caba2f/u,
  );
  assert.deepEqual(
    {
      setId: potassium.provenance.set_id,
      version: potassium.provenance.version,
      effectiveTime: potassium.provenance.effective_time,
      payloadSha256: potassium.provenance.payload_sha256,
      currentness: potassium.currentness_status,
    },
    {
      setId: '838c2d78-d2d8-4981-9ec9-e50ef9e1a5d8',
      version: '2',
      effectiveTime: '20250102',
      payloadSha256: 'f003b80436f1469921fb898e272444b61f754376f4f7c12b396e485f5f2b6a2f',
      currentness: 'checked_current_openfda_and_dailymed_xml',
    },
  );
  assert.deepEqual(
    {
      setId: methotrexatePpi.provenance.set_id,
      version: methotrexatePpi.provenance.version,
      effectiveTime: methotrexatePpi.provenance.effective_time,
      payloadSha256: methotrexatePpi.provenance.payload_sha256,
      currentness: methotrexatePpi.currentness_status,
    },
    {
      setId: 'd0075461-0e7e-4967-9c9b-d6440e912c0e',
      version: '10',
      effectiveTime: '20251215',
      payloadSha256: '2de8a93d0f570a118ce6cb599194747a2131fed2bcc4a3fbab5df596db6941d6',
      currentness: 'checked_current_openfda_and_dailymed_xml',
    },
  );
});

test('pair-matchable source scopes remain diagnostic and runtime-disabled', () => {
  for (const [subjects, ruleId] of [
    [['ramipril', 'spironolactone'], 'acei_arb__mra_spironolactone_eplerenone'],
    [['telmisartan', 'eplerenone'], 'acei_arb__mra_spironolactone_eplerenone'],
    [['telmisartan', 'amiloride'], 'acei_arb__amiloride'],
    [['ramipril', 'telmisartan'], 'acei__arb_dual_raas_blockade'],
    [['lithium', 'fosinopril'], 'lithium__acei_arb'],
    [['lithium', 'chlorthalidone'], 'lithium__thiazide_diuretic'],
  ]) {
    const finding = one(subjects, ruleId)[0];
    assert.ok(finding, `${ruleId} must match ${subjects.join(' + ')}`);
    assert.equal(finding.runtime_enabled, false);
  }
});

test('member narrowing removes triamterene, standalone trimethoprim, and class overexpansion', () => {
  assert.equal(has(['telmisartan', 'triamterene'], 'acei_arb__amiloride'), false);
  assert.equal(has(['trimethoprim', 'ramipril'], 'cotrimoxazole__ace_inhibitor'), false);
  assert.equal(has(['co-trimoxazole', 'losartan'], 'cotrimoxazole__ace_inhibitor'), false);
  assert.equal(has(['amikacin', 'furosemide'], 'gentamicin__furosemide'), false);
  assert.equal(has(['gentamicin', 'bumetanide'], 'gentamicin__furosemide'), false);
  assert.equal(has(['methotrexate', 'trimethoprim'], 'methotrexate__cotrimoxazole'), false);
  assert.equal(has(['methotrexate', 'lansoprazole'], 'methotrexate_high_dose__ppi'), false);

  assert.equal(has(['methotrexate', 'co-trimoxazole'], 'methotrexate__cotrimoxazole'), false);
  assert.equal(one(['gentamicin', 'furosemide'], 'gentamicin__furosemide')[0].runtime_enabled, false);
  assert.equal(one(['methotrexate', 'omeprazole'], 'methotrexate_high_dose__ppi')[0].runtime_enabled, false);
});

test('route- and formulation-unresolved pair matches remain diagnostic only', () => {
  for (const [subjects, ruleId] of [
    [['ramipril', 'ibuprofen'], 'acei_arb__nsaid_systemic'],
    [['lithium', 'diclofenac'], 'lithium__nsaid_systemic'],
    [['gentamicin', 'furosemide'], 'gentamicin__furosemide'],
    [['methotrexate', 'omeprazole'], 'methotrexate_high_dose__ppi'],
  ]) {
    const finding = one(subjects, ruleId)[0];
    assert.ok(finding, `${ruleId} must remain visible for diagnostic testing`);
    assert.equal(finding.runtime_enabled, false, `${ruleId} must not be pharmacist-facing`);
  }

  for (const ruleId of [
    'acei_arb__nsaid_systemic',
    'lithium__nsaid_systemic',
    'gentamicin__furosemide',
  ]) {
    assert.ok(
      byId[ruleId].risk_factors.some((factor) => /route|formulation|product/.test(factor.factor) && factor.gateable === false),
      `${ruleId} must disclose its non-gateable product scope`,
    );
  }
  assert.ok(byId.methotrexate_high_dose__ppi.risk_factors.some((factor) => factor.factor === 'high_dose_regimen' && factor.gateable === false));

  for (const ruleId of [
    'methotrexate_high_dose__nsaid_systemic',
    'methotrexate_lower_dose__nsaid_systemic',
    'methotrexate__cotrimoxazole',
  ]) {
    assert.equal(
      has(['methotrexate', 'ibuprofen'], ruleId),
      false,
      `${ruleId} must not emit without executable regimen or product identity`,
    );
  }
});

test('potassium-product evidence is narrowed to lisinopril and remains diagnostic', () => {
  const id = 'acei_arb__potassium_supplement_salt_substitute';
  const subjects = [
    { drug: 'lisinopril', route: 'oral' },
    { drug: 'potassium chloride', route: 'oral' },
  ];
  const unknown = one(subjects, id)[0];
  const replacement = one(
    subjects,
    id,
    { indication: 'documented_potassium_deficit' },
  )[0];
  const unrelated = one(
    subjects,
    id,
    { indication: 'hypertension' },
  )[0];
  assert.ok(unknown && replacement && unrelated);
  assert.equal(unknown.runtime_enabled, false);
  assert.equal(unknown.clinical_action_status, undefined);
  assert.equal(unknown.dispense_action, 'confirm_and_monitor');
  assert.equal(replacement.dispense_action, 'confirm_and_monitor');
  assert.equal(unrelated.dispense_action, 'confirm_and_monitor');
  assert.equal(byId[id].applicability.indication, null);
  assert.equal(has(['ramipril', 'potassium chloride'], id), false);
  assert.equal(byId[id].object.drug, 'lisinopril');
});

test('amiloride demonstrated-hypokalaemia indication is explicit and non-executable', () => {
  const rule = byId.acei_arb__amiloride;
  assert.deepEqual(rule.applicability.indication, ['demonstrated_hypokalemia']);
  assert.equal(rule.runtime_enabled, false);
  assert.equal(rule.runtime_status.clinical_context_complete, false);
  assert.ok(
    rule.risk_factors.some(
      (factor) =>
        factor.factor === 'demonstrated_hypokalemia_indication'
        && factor.gateable === false,
    ),
  );
  assert.match(rule.management.prescriber_action, /matcher cannot establish/i);
});

test('the heterogeneous co-trimoxazole rule is split without mortality or older-adult action claims', () => {
  const acei = byId.cotrimoxazole__ace_inhibitor;
  const other = byId.cotrimoxazole__other_potassium_raising_agent;
  assert.deepEqual(acei.object.members, ['co-trimoxazole', 'sulfamethoxazole-trimethoprim']);
  assert.equal(acei.management.dispense_action, 'withhold_and_clarify');
  assert.equal(acei.runtime_enabled, false);
  assert.equal(acei.runtime_status.pair_matcher_executable, false);
  assert.equal(other.management.dispense_action, 'confirm_and_monitor');
  assert.equal(other.runtime_enabled, false);
  assert.equal(other.runtime_status.pair_matcher_executable, false);
  assert.equal(has(['co-trimoxazole', 'spironolactone'], acei.rule_id), false);
  assert.equal(has(['co-trimoxazole', 'spironolactone'], other.rule_id), false);

  for (const rule of [acei, other]) {
    const asserted = JSON.stringify({
      mechanism: rule.mechanism,
      management: rule.management,
      risk_factors: rule.risk_factors,
    });
    assert.doesNotMatch(asserted, /mortality|sudden death|older adult|elderly/i);
  }
});

test('triple-whammy is a quarantined non-action review hypothesis', () => {
  const id = 'acei_arb_diuretic__nsaid_triple_whammy';
  const ramipril = { drug: 'ramipril', route: 'systemic' };
  const furosemide = { drug: 'furosemide', route: 'systemic' };
  const ibuprofen = { drug: 'ibuprofen', route: 'systemic' };
  assert.equal(has([ramipril, furosemide], id), false);
  assert.equal(has([ramipril, ibuprofen], id), false);
  assert.equal(has([furosemide, ibuprofen], id), false);

  const triple = one([ramipril, furosemide, ibuprofen], id);
  assert.equal(triple.length, 0);
  const rule = byId[id];
  assert.equal(rule.risk_basis, 'contextual_review_hypothesis');
  assert.equal(rule.runtime_status.pair_matcher_executable, false);
  assert.deepEqual(rule.applicability.jurisdiction, []);
  assert.equal(rule.management.action_target, null);
  assert.deepEqual(rule.management.do_not_interrupt, []);
  assert.equal(Object.hasOwn(rule, 'suppresses'), false);
  assert.match(rule.mechanism, /does not establish incremental/i);
  assert.ok(
    rule.evidence[0].does_not_by_itself_support.some(
      (boundary) => /incremental or synergistic risk/i.test(boundary),
    ),
  );
});

test('unsupported renal contraindications, methotrexate avoid advice, and aminoglycoside nephrotoxicity are absent', () => {
  assert.ok(rules.every((rule) => rule.context_modifiers.length === 0));
  assert.equal(
    byId.acei_arb_diuretic__nsaid_triple_whammy.management.dispense_action,
    'confirm_and_monitor',
  );
  assert.equal(
    byId.acei__arb_dual_raas_blockade.management.dispense_action,
    'withhold_and_clarify',
  );
  assert.ok(
    byId.acei__arb_dual_raas_blockade.evidence[0].supports.label_action
      .includes('avoid_combined_use_of_RAS_inhibitors'),
  );
  assert.equal(byId.methotrexate__cotrimoxazole.management.dispense_action, 'confirm_and_monitor');
  assert.deepEqual(byId.methotrexate__cotrimoxazole.evidence[0].supports.label_action, []);
  assert.deepEqual(
    byId.methotrexate_high_dose__nsaid_systemic.evidence[0].supports.label_action,
    [],
  );
  assert.deepEqual(
    byId.methotrexate_lower_dose__nsaid_systemic.evidence[0].supports.label_action,
    ['use_with_caution'],
  );
  const highDoseNsaid = byId.methotrexate_high_dose__nsaid_systemic;
  const lowerDoseNsaid = byId.methotrexate_lower_dose__nsaid_systemic;
  assert.equal(highDoseNsaid.evidence[0].fragments.length, 1);
  assert.equal(lowerDoseNsaid.evidence[0].fragments.length, 1);
  assert.match(highDoseNsaid.evidence[0].fragments[0].text, /high dose methotrexate/i);
  assert.doesNotMatch(highDoseNsaid.evidence[0].fragments[0].text, /lower doses/i);
  assert.match(lowerDoseNsaid.evidence[0].fragments[0].text, /lower doses of methotrexate/i);
  assert.doesNotMatch(lowerDoseNsaid.evidence[0].fragments[0].text, /resulting in deaths/i);
  assert.equal(highDoseNsaid.runtime_status.pair_matcher_executable, false);
  assert.equal(lowerDoseNsaid.runtime_status.pair_matcher_executable, false);
  assert.doesNotMatch(byId.gentamicin__furosemide.mechanism, /nephro/i);
  assert.doesNotMatch(
    JSON.stringify(byId.gentamicin__furosemide.evidence[0].supports.source_effect),
    /nephro/i,
  );
  assert.doesNotMatch(
    JSON.stringify({
      mechanism: byId.acei_arb_diuretic__nsaid_triple_whammy.mechanism,
      management: byId.acei_arb_diuretic__nsaid_triple_whammy.management,
    }),
    /contraindicat/i,
  );
});

test('Section F actions are unavailable outside retained U.S. jurisdiction scope', () => {
  assert.equal(
    has(
      ['ramipril', 'spironolactone'],
      'acei_arb__mra_spironolactone_eplerenone',
      { jurisdiction: 'IN' },
    ),
    false,
  );
  assert.equal(
    has(
      ['ramipril', 'telmisartan'],
      'acei__arb_dual_raas_blockade',
      { jurisdiction: 'UK' },
    ),
    false,
  );

  assert.equal(
    one(
    [
      { drug: 'methotrexate', route: 'parenteral', formulation: 'injection' },
      {
        drug: 'co-trimoxazole',
        route: 'systemic',
        formulation: 'fixed_dose_combination',
      },
    ],
    'methotrexate__cotrimoxazole',
    { jurisdiction: 'IN' },
    ).length,
    0,
  );
});

test('catalog-backed review rosters include the newly reconciled members', () => {
  for (const member of [
    'dexketoprofen',
    'etodolac',
    'lornoxicam',
    'nabumetone',
    'parecoxib',
    'tenoxicam',
    'zaltoprofen',
  ]) {
    assert.ok(memberSets.nsaid.any.includes(member), member);
  }
  for (const className of [
    'thiazide_diuretic',
    'diuretic',
    'potassium_wasting_diuretic',
  ]) {
    assert.ok(memberSets[className].any.includes('metolazone'), className);
  }
  for (const member of ['betaxolol', 'celiprolol', 'esmolol', 'pindolol']) {
    assert.ok(memberSets.beta_blocker.any.includes(member), member);
  }
});
