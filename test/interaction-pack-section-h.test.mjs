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
  'H.verified.jsonl',
);
const SECTION_RAW = fs.readFileSync(SECTION_PATH, 'utf8');
const RULES = SECTION_RAW.trim().split(/\r?\n/u).map(JSON.parse);
const BY_ID = Object.fromEntries(RULES.map((rule) => [rule.rule_id, rule]));
const MEMBERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data-static', 'interaction-member-sets.json'), 'utf8'),
).classes;

const EXPECTED_SHA256 = '0daf3e31f9fbb296266f47662f0351e08c2b0aa74af86e46a1fec443e02c49b6';
const EXPECTED_IDS = [
  'rifampicin__hormonal_contraceptive',
  'rifabutin__etonogestrel_implant',
  'enzyme_inducing_antiepileptic__hormonal_contraceptive',
  'phenytoin__etonogestrel_implant',
  'rifampicin__calcineurin_inhibitor',
  'rifampicin__verapamil',
  'rifampicin__systemic_corticosteroid',
  'rifampicin__sulfonylurea',
  'rifampicin__antiretroviral',
  'carbamazepine__calcineurin_inhibitor',
  'carbamazepine__warfarin',
  'carbamazepine__verapamil',
  'carbamazepine__systemic_corticosteroid',
  'carbamazepine__sulfonylurea',
  'carbamazepine__antiretroviral',
  'carbamazepine__valproate',
  'carbamazepine__lamotrigine',
  'st_johns_wort__cyp3a4_pgp_substrate',
  'st_johns_wort__calcineurin_inhibitor',
];
const ENABLED_IDS = [];
const RUNTIME_KEYS = [
  'clinical_context_complete',
  'pair_matcher_executable',
  'promotion_eligible',
  'runtime_enabled',
];

const oral = (drug) => ({ drug, route: 'oral' });
const parenteral = (drug) => ({ drug, route: 'parenteral' });
const implant = (drug) => ({ drug, route: 'subdermal', formulation: 'implant' });

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function draftReview(subjects, jurisdiction) {
  return checkInteractions({
    subjects,
    rules: RULES,
    memberSets: MEMBERS,
    patientContext: { jurisdiction },
    includeDiagnostic: true,
  }).findings;
}

function one(subjects, ruleId) {
  const findings = draftReview(subjects, 'US')
    .filter((finding) => finding.rule_id === ruleId);
  assert.equal(
    findings.length,
    1,
    `${subjects.map((subject) => subject.drug).join(' + ')} expected one ${ruleId}`,
  );
  return findings[0];
}

function has(subjects, ruleId) {
  return draftReview(subjects, 'US').some((finding) => finding.rule_id === ruleId);
}

test('Section H is the frozen 19-rule, runtime-disabled, 24-evidence slice', () => {
  assert.doesNotThrow(() => validateDraftRules(RULES));
  assert.equal(sha256(SECTION_RAW), EXPECTED_SHA256);
  assert.deepEqual(RULES.map((rule) => rule.rule_id), EXPECTED_IDS);
  assert.equal(new Set(EXPECTED_IDS).size, 19);
  assert.deepEqual(
    RULES.filter((rule) => rule.runtime_enabled).map((rule) => rule.rule_id),
    ENABLED_IDS,
  );
  assert.equal(RULES.flatMap((rule) => rule.evidence).length, 24);
  assert.equal(
    RULES.filter((rule) => rule.runtime_status.pair_matcher_executable).length,
    9,
  );

  for (const rule of RULES) {
    assert.equal(rule._section, 'H', rule.rule_id);
    assert.equal(rule.proposed_status, 'draft_for_review', rule.rule_id);
    assert.deepEqual(Object.keys(rule.runtime_status).sort(), RUNTIME_KEYS, rule.rule_id);
    assert.equal(rule.runtime_enabled, rule.runtime_status.runtime_enabled, rule.rule_id);
    assert.equal(rule.runtime_status.promotion_eligible, false, rule.rule_id);
    assert.ok(
      Object.values(rule.runtime_status).every((value) => typeof value === 'boolean'),
      rule.rule_id,
    );
    assert.ok(Array.isArray(rule.risk_factors) && rule.risk_factors.length > 0, rule.rule_id);
    assert.ok(rule.risk_factors.every((factor) => factor.gateable === false), rule.rule_id);
    assert.equal(rule.applicability.indication, null, rule.rule_id);
    assert.equal(Object.hasOwn(rule, 'manual_references'), false, rule.rule_id);
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

    const expectedJurisdiction = rule.rule_id === 'st_johns_wort__cyp3a4_pgp_substrate'
      ? []
      : ['US'];
    assert.deepEqual(rule.applicability.jurisdiction, expectedJurisdiction, rule.rule_id);
  }
});

test('Section H evidence is licence-cleared openFDA material with reproducible fragments', () => {
  const evidenceRecords = RULES.flatMap((rule) => (
    rule.evidence.map((evidence) => ({ rule_id: rule.rule_id, ...evidence }))
  ));
  const fragments = evidenceRecords.flatMap((evidence) => evidence.fragments);

  assert.equal(evidenceRecords.length, 24);
  assert.equal(fragments.length, 54);
  assert.deepEqual(
    RULES.filter((rule) => rule.evidence.length === 0).map((rule) => rule.rule_id),
    ['st_johns_wort__cyp3a4_pgp_substrate'],
  );

  for (const evidence of evidenceRecords) {
    assert.equal(evidence.source_policy_id, 'openfda-labels', evidence.source_id);
    assert.equal(evidence.source_policy_use, 'interaction-evidence', evidence.source_id);
    assert.equal(evidence.licence, 'CC0-1.0', evidence.source_id);
    assert.equal(evidence.jurisdiction, 'US', evidence.source_id);
    assert.deepEqual(evidence.supports.jurisdictions, ['US'], evidence.source_id);
    assert.equal(new URL(evidence.source_url).hostname, 'api.fda.gov', evidence.source_id);
    assert.equal(evidence.source_host, 'api.fda.gov', evidence.source_id);
    assert.match(evidence.source_id, /^(?:dailymed|openfda)-/u);
    assert.doesNotMatch(
      evidence.source_id,
      /(?:\bemc\b|medicines\.org\.uk|uk-smpc|janaushadhi|onemg)/iu,
    );
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
    assert.equal(evidence.accessed_at, '2026-07-23', evidence.source_id);
    assert.equal(evidence.currentness_checked_at, '2026-07-23', evidence.source_id);
    assert.match(evidence.currentness_status, /^checked_current_openfda$/u, evidence.source_id);
    assert.match(
      evidence.citation_status,
      /^machine_confirmed_openfda_reconciled_pending_clinician$/u,
      evidence.source_id,
    );
    assert.equal(evidence.supports.interaction_exists, true, evidence.source_id);
    assert.equal(evidence.supports.runtime_severity_is_local_mapping, true, evidence.source_id);
    assert.ok(evidence.fragments.length > 0, evidence.source_id);
    assert.equal(
      evidence.quote_integrity,
      evidence.fragments.length === 1 ? 'single_verbatim' : 'multi_fragment_verbatim',
      evidence.source_id,
    );

    for (const fragment of evidence.fragments) {
      assert.equal(fragment.text, fragment.text.trim(), evidence.source_id);
      assert.match(fragment.text_sha256, /^[0-9a-f]{64}$/u, evidence.source_id);
      assert.equal(sha256(fragment.text), fragment.text_sha256, evidence.source_id);
    }
  }

  const repeatedSources = [...new Set(
    evidenceRecords
      .filter((evidence, index, all) => (
        all.findIndex((candidate) => candidate.source_id === evidence.source_id) !== index
      ))
      .map((evidence) => evidence.source_id),
  )].sort();
  assert.deepEqual(repeatedSources, [
    'openfda-nexplanon-487f8a62-v13-antiepileptics',
    'openfda-nexplanon-487f8a62-v13-rifamycin',
  ]);
});

test('draft-review mode emits the four non-composite source-bounded diagnostic candidates', () => {
  const cases = [
    {
      id: 'rifampicin__sulfonylurea',
      subjects: [oral('rifampicin'), oral('glimepiride')],
      severity: 'moderate',
      action: 'confirm_and_monitor',
    },
    {
      id: 'carbamazepine__warfarin',
      subjects: [oral('carbamazepine'), oral('warfarin')],
      severity: 'major',
      action: 'confirm_and_monitor',
    },
    {
      id: 'carbamazepine__valproate',
      subjects: [oral('carbamazepine'), oral('valproate')],
      severity: 'major',
      action: 'confirm_and_monitor',
    },
    {
      id: 'carbamazepine__lamotrigine',
      subjects: [oral('carbamazepine'), oral('lamotrigine')],
      severity: 'major',
      action: 'confirm_and_monitor',
    },
  ];

  for (const expected of cases) {
    const findings = draftReview(expected.subjects, 'US');
    assert.deepEqual(findings.map((finding) => finding.rule_id), [expected.id], expected.id);
    assert.equal(findings[0].runtime_enabled, false, expected.id);
    assert.equal(findings[0].severity, expected.severity, expected.id);
    assert.equal(findings[0].dispense_action, expected.action, expected.id);
    assert.deepEqual(findings[0].data_required, [], expected.id);
    assert.notEqual(
      findings[0].clinical_action_status,
      'unresolved_pending_jurisdiction',
      expected.id,
    );
  }
});

test('draft-review mode exposes disabled executable diagnostics but not matcher-incomplete templates', () => {
  const diagnosticCases = [
    ['rifampicin__verapamil', [oral('rifampicin'), oral('verapamil')]],
    ['rifampicin__antiretroviral', [oral('rifampicin'), oral('atazanavir')]],
    [
      'carbamazepine__verapamil',
      [oral('carbamazepine'), { drug: 'verapamil', route: 'oral', formulation: 'extended_release' }],
    ],
    ['carbamazepine__sulfonylurea', [oral('carbamazepine'), oral('glimepiride')]],
    ['carbamazepine__antiretroviral', [oral('carbamazepine'), oral('dolutegravir')]],
  ];
  for (const [ruleId, subjects] of diagnosticCases) {
    const finding = one(subjects, ruleId);
    assert.equal(finding.runtime_enabled, false, ruleId);
    assert.deepEqual(finding.data_required, [], ruleId);
  }

  const matcherIncompleteCases = [
    ['rifampicin__hormonal_contraceptive', [oral('rifampicin'), oral('ethinylestradiol')]],
    ['rifabutin__etonogestrel_implant', [oral('rifabutin'), implant('etonogestrel implant')]],
    [
      'enzyme_inducing_antiepileptic__hormonal_contraceptive',
      [oral('carbamazepine'), oral('progestogen-only pill')],
    ],
    ['phenytoin__etonogestrel_implant', [oral('phenytoin'), implant('etonogestrel implant')]],
    ['rifampicin__calcineurin_inhibitor', [oral('rifampicin'), oral('tacrolimus')]],
    [
      'rifampicin__systemic_corticosteroid',
      [oral('rifampicin'), parenteral('methylprednisolone')],
    ],
    ['carbamazepine__calcineurin_inhibitor', [oral('carbamazepine'), oral('tacrolimus')]],
    [
      'carbamazepine__systemic_corticosteroid',
      [oral('carbamazepine'), parenteral('methylprednisolone')],
    ],
    [
      'st_johns_wort__calcineurin_inhibitor',
      [
        { drug: "st john's wort", route: 'oral', formulation: 'herbal_supplement' },
        oral('ciclosporin'),
      ],
    ],
  ];
  for (const [ruleId, subjects] of matcherIncompleteCases) {
    assert.equal(BY_ID[ruleId].runtime_status.pair_matcher_executable, false, ruleId);
    assert.equal(has(subjects, ruleId), false, ruleId);
  }
});

test('contraceptive aliases are canonicalized without broadening the retained perpetrator scope', () => {
  const rifampicinRule = BY_ID.rifampicin__hormonal_contraceptive;
  const antiepilepticRule = BY_ID.enzyme_inducing_antiepileptic__hormonal_contraceptive;

  assert.deepEqual(rifampicinRule.perpetrator.members, ['rifampicin']);
  assert.deepEqual(antiepilepticRule.perpetrator.members, ['carbamazepine']);
  assert.deepEqual(rifampicinRule.applicability.jurisdiction, ['US']);
  assert.deepEqual(antiepilepticRule.applicability.jurisdiction, ['US']);

  assert.equal(
    has(
      [oral('rifampin'), oral('norethindrone')],
      'rifampicin__hormonal_contraceptive',
    ),
    false,
  );
  assert.equal(
    draftReview(
      [oral('rifampicin'), oral('norethindrone'), oral('norethisterone')],
      'US',
    ).filter((finding) => finding.rule_id === 'rifampicin__hormonal_contraceptive').length,
    0,
  );

  assert.equal(
    has(
      [oral('rifabutin'), implant('etonogestrel implant')],
      'rifabutin__etonogestrel_implant',
    ),
    false,
  );
  assert.equal(
    has(
      [oral('phenytoin'), implant('etonogestrel implant')],
      'phenytoin__etonogestrel_implant',
    ),
    false,
  );
  assert.equal(has([oral('rifabutin'), oral('desogestrel')], rifampicinRule.rule_id), false);
  assert.equal(has([oral('phenytoin'), oral('ethinylestradiol')], antiepilepticRule.rule_id), false);

  for (const excluded of ['phenobarbital', 'phenobarbitone']) {
    assert.equal(
      has([oral(excluded), implant('etonogestrel implant')], antiepilepticRule.rule_id),
      false,
      excluded,
    );
  }

  assert.doesNotMatch(rifampicinRule.management.duration, /\b28\s+days?\b/iu);
  assert.doesNotMatch(antiepilepticRule.management.duration, /\b28\s+days?\b/iu);
  assert.match(
    BY_ID.rifabutin__etonogestrel_implant.management.duration,
    /\b28\s+days?\b/iu,
  );
  assert.match(
    BY_ID.phenytoin__etonogestrel_implant.management.duration,
    /\b28\s+days?\b/iu,
  );
});

test('rifampicin sulfonylurea scope is limited to the three openFDA-backed members', () => {
  const rule = BY_ID.rifampicin__sulfonylurea;
  assert.deepEqual(rule.object.members, ['glimepiride', 'glipizide', 'glyburide']);
  assert.deepEqual(
    rule.evidence.map((evidence) => evidence.source_id),
    [
      'dailymed-rifampin-b389b1a3-v1-sulfonylureas',
      'dailymed-glimepiride-fc9d8495-v2-rifampin',
    ],
  );
  assert.match(
    rule.object.note,
    /Glibenclamide remains excluded pending licence-cleared identity and interaction evidence/iu,
  );

  for (const member of rule.object.members) {
    const finding = one([oral('rifampicin'), oral(member)], rule.rule_id);
    assert.equal(finding.runtime_enabled, false, member);
    assert.equal(finding.severity, 'moderate', member);
    assert.equal(finding.dispense_action, 'confirm_and_monitor', member);
  }
  for (const unsupported of ['glibenclamide', 'gliclazide', 'tolbutamide', 'chlorpropamide']) {
    assert.equal(has([oral('rifampicin'), oral(unsupported)], rule.rule_id), false, unsupported);
  }

  const carbamazepineCandidate = BY_ID.carbamazepine__sulfonylurea;
  assert.deepEqual(carbamazepineCandidate.object.members, [
    'glimepiride',
    'glipizide',
    'gliclazide',
    'glibenclamide',
    'glyburide',
    'tolbutamide',
    'chlorpropamide',
  ]);
  assert.equal(carbamazepineCandidate.runtime_enabled, false);
  assert.match(carbamazepineCandidate.mechanism, /research hypothesis only/iu);
  for (const member of carbamazepineCandidate.object.members) {
    assert.equal(
      one([oral('carbamazepine'), oral(member)], carbamazepineCandidate.rule_id)
        .runtime_enabled,
      false,
      member,
    );
  }
});

test('carbamazepine rules retain only supported direction, products, and formulations', () => {
  const verapamilRule = BY_ID.carbamazepine__verapamil;
  assert.equal(verapamilRule.object.drug, 'carbamazepine');
  assert.equal(verapamilRule.perpetrator.drug, 'verapamil');
  assert.deepEqual(verapamilRule.perpetrator.formulation, ['extended_release']);
  assert.match(verapamilRule.mechanism, /Verapamil can inhibit carbamazepine metabolism/iu);
  assert.doesNotMatch(
    verapamilRule.mechanism,
    /interaction is bidirectional|carbamazepine (?:induction )?lowers verapamil/iu,
  );
  assert.equal(
    one(
      [
        { drug: 'verapamil', route: 'oral', formulation: 'extended_release' },
        oral('carbamazepine'),
      ],
      verapamilRule.rule_id,
    ).runtime_enabled,
    false,
  );

  const valproateRule = BY_ID.carbamazepine__valproate;
  assert.deepEqual(valproateRule.object.members, ['valproate', 'valproic acid']);
  assert.match(valproateRule.mechanism, /bidirectional/iu);
  assert.match(valproateRule.mechanism, /epoxide/iu);
  for (const member of valproateRule.object.members) {
    assert.equal(one([oral('carbamazepine'), oral(member)], valproateRule.rule_id).runtime_enabled, false);
  }
  for (const unsupported of ['sodium valproate', 'valproate semisodium', 'divalproex sodium']) {
    assert.equal(has([oral('carbamazepine'), oral(unsupported)], valproateRule.rule_id), false);
  }

  const antiretroviralRule = BY_ID.carbamazepine__antiretroviral;
  assert.deepEqual(antiretroviralRule.object.members, ['dolutegravir']);
  assert.equal(
    one([oral('carbamazepine'), oral('dolutegravir')], antiretroviralRule.rule_id)
      .runtime_enabled,
    false,
  );
  for (const unsupported of ['atazanavir', 'darunavir', 'ritonavir', 'cobicistat']) {
    assert.equal(
      has([oral('carbamazepine'), oral(unsupported)], antiretroviralRule.rule_id),
      false,
      unsupported,
    );
  }

  for (const ruleId of [
    'rifampicin__systemic_corticosteroid',
    'carbamazepine__systemic_corticosteroid',
  ]) {
    assert.deepEqual(BY_ID[ruleId].object.members, ['methylprednisolone'], ruleId);
    assert.equal(BY_ID[ruleId].runtime_status.pair_matcher_executable, false, ruleId);
  }

  const lamotrigineRule = BY_ID.carbamazepine__lamotrigine;
  assert.doesNotMatch(lamotrigineRule.mechanism, /rash/iu);
  assert.doesNotMatch(
    JSON.stringify({
      mechanism: lamotrigineRule.mechanism,
      management: lamotrigineRule.management,
      claims: lamotrigineRule.claims_needing_citation,
    }),
    /(?:stop|stopp|withdraw)[^.]{0,120}rash|rash[^.]{0,120}(?:stop|stopp|withdraw)/iu,
  );
});

test("St John's Wort stays quarantined without a dangling cross-section suppression", () => {
  const umbrella = BY_ID.st_johns_wort__cyp3a4_pgp_substrate;
  assert.equal(umbrella.risk_basis, 'unresolved_no_licence_cleared_evidence');
  assert.deepEqual(umbrella.object.members, []);
  assert.deepEqual(umbrella.applicability.jurisdiction, []);
  assert.deepEqual(umbrella.evidence, []);
  assert.deepEqual(umbrella.suppresses, []);
  assert.equal(umbrella.runtime_enabled, false);
  assert.equal(umbrella.runtime_status.pair_matcher_executable, false);
  assert.match(umbrella._runtime_note, /Non-executable backlog placeholder/iu);

  const child = BY_ID.st_johns_wort__calcineurin_inhibitor;
  assert.deepEqual(child.object.members, ['ciclosporin']);
  assert.deepEqual(child.applicability.jurisdiction, ['US']);
  assert.equal(Object.hasOwn(child, 'suppresses'), false);
  assert.equal(child.runtime_status.pair_matcher_executable, false);
  assert.equal(
    Object.hasOwn(BY_ID, 'calcineurin_inhibitor__other_cyp3a4_inducer'),
    false,
    'the Section G suppression target must not pull the stale aggregate into this suite',
  );
  assert.deepEqual(
    RULES.filter((rule) => rule.suppresses?.length).map((rule) => [
      rule.rule_id,
      rule.suppresses,
    ]),
    [],
  );

  for (const victim of ['warfarin', 'apixaban', 'rivaroxaban', 'digoxin', 'tacrolimus']) {
    assert.equal(
      has(
        [
          { drug: "st john's wort", route: 'oral', formulation: 'herbal_supplement' },
          oral(victim),
        ],
        umbrella.rule_id,
      ),
      false,
      victim,
    );
  }
  for (const ciclosporin of ['ciclosporin', 'cyclosporine']) {
    assert.equal(
      has(
        [
          { drug: "st john's wort", route: 'oral', formulation: 'herbal_supplement' },
          oral(ciclosporin),
        ],
        child.rule_id,
      ),
      false,
      ciclosporin,
    );
  }
});

test('Section H citation and reconciliation documents are pinned to the frozen slice', () => {
  const digest = sha256(SECTION_RAW);
  for (const file of [
    '2026-07-23-section-H-citations.md',
    '2026-07-23-section-H-reconciled.md',
  ]) {
    const body = fs.readFileSync(
      path.join(ROOT, 'docs', 'interaction-review', file),
      'utf8',
    );
    assert.match(body, new RegExp(`JSONL SHA-256: \`${digest}\``, 'u'), file);
  }
});
