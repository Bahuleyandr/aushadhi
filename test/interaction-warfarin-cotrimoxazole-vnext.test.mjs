import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  parseDraftApprovalJson,
} from '../src/lib/interaction-approval-draft.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_DIR = path.join(
  ROOT,
  'docs',
  'interaction-review',
  '2026-07-29-warfarin-cotrimoxazole-vnext',
);
const EXPECTED_FILES = [
  'README.md',
  'CLINICIAN-REVIEW.md',
  'IMPLEMENTATION-STATUS.md',
  'approval-event.template.draft.json',
  'governance-policy.internal-evaluation.v1.draft.json',
  'package-status.json',
  'warfarin-cotrimoxazole.rule-subject.v1.draft.json',
];
const PACKAGE_PRESENT = EXPECTED_FILES.every(
  (name) => fs.existsSync(path.join(PACKAGE_DIR, name)),
);
const VALIDATOR_PATH = path.join(ROOT, 'src', 'lib', 'interaction-approval-draft.mjs');
const VALIDATOR_PRESENT = fs.existsSync(VALIDATOR_PATH);

function readJson(name) {
  return parseDraftApprovalJson(
    fs.readFileSync(path.join(PACKAGE_DIR, name), 'utf8'),
    name,
  );
}

function readJsonlRule(ruleId) {
  const rows = fs.readFileSync(
    path.join(ROOT, 'docs', 'interaction-review', 'batch-01-v2', 'batch-01-v2.jsonl'),
    'utf8',
  ).trimEnd().split('\n').map((line) => JSON.parse(line));
  return rows.find((row) => row.rule_id === ruleId);
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

function markedSection(text, marker) {
  const start = `<!-- ${marker}:start -->`;
  const end = `<!-- ${marker}:end -->`;
  const startAt = text.indexOf(start);
  const endAt = text.indexOf(end);
  assert.notEqual(startAt, -1, `missing ${start}`);
  assert.notEqual(endAt, -1, `missing ${end}`);
  assert.ok(endAt > startAt, `${marker} markers are out of order`);
  assert.equal(text.indexOf(start, startAt + start.length), -1, `duplicate ${start}`);
  assert.equal(text.indexOf(end, endAt + end.length), -1, `duplicate ${end}`);
  return text.slice(startAt + start.length, endAt).trim();
}

function unquoteMarkdownParagraph(text) {
  return text
    .split(/\r?\n/u)
    .map((line) => line.replace(/^>\s?/u, '').trim())
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function codeCellValues(cell) {
  if (cell.trim() === 'none') return [];
  return cell.split('<br>').map(
    (value) => value.trim().replace(/^`|`$/gu, ''),
  );
}

function normalizedTextSha256(text) {
  const normalized = text
    .normalize('NFC')
    .replace(/\r\n?/gu, '\n')
    .replace(/\n+$/gu, '');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

test('vNext draft package is present as a complete repository-native review set', () => {
  for (const name of EXPECTED_FILES) {
    assert.equal(
      fs.existsSync(path.join(PACKAGE_DIR, name)),
      true,
      `missing ${name}`,
    );
  }
  assert.equal(VALIDATOR_PRESENT, true, 'missing interaction approval draft validator');
});

test('draft package validates but confers no signature, promotion, production, or deployment authority', {
  skip: !PACKAGE_PRESENT || !VALIDATOR_PRESENT,
}, async () => {
  const {
    validateDraftApprovalPackage,
  } = await import(pathToFileURL(VALIDATOR_PATH));
  const clinicianReviewText = fs.readFileSync(
    path.join(PACKAGE_DIR, 'CLINICIAN-REVIEW.md'),
    'utf8',
  );
  const status = readJson('package-status.json');
  const result = validateDraftApprovalPackage({
    policy: readJson('governance-policy.internal-evaluation.v1.draft.json'),
    subject: readJson('warfarin-cotrimoxazole.rule-subject.v1.draft.json'),
    eventTemplate: readJson('approval-event.template.draft.json'),
    status,
    clinicianReviewText,
  });

  assert.deepEqual(result, {
    package_status: 'draft_non_authorizing',
    structurally_valid: true,
    policy_signoff_ready: false,
    rule_signoff_ready: false,
    promotion_ready: false,
    clinical_use_authority: 'none',
    production_authority: 'none',
    deployment_authority: 'none',
  });
  assert.equal(
    status.clinician_review_sha256_profile,
    'UTF-8-NFC-LF-no-trailing-LF',
  );
  assert.equal(
    status.clinician_review_sha256,
    normalizedTextSha256(clinicianReviewText),
  );
  assert.throws(
    () => validateDraftApprovalPackage({
      policy: readJson('governance-policy.internal-evaluation.v1.draft.json'),
      subject: readJson('warfarin-cotrimoxazole.rule-subject.v1.draft.json'),
      eventTemplate: readJson('approval-event.template.draft.json'),
      status,
      clinicianReviewText:
        `${clinicianReviewText}\nThe pharmacy may independently stop warfarin.`,
    }),
    /clinician.*rendering.*sha-256/iu,
  );
});

test('governance policy separates historical approval from current promotion eligibility', {
  skip: !PACKAGE_PRESENT || !VALIDATOR_PRESENT,
}, async () => {
  const {
    assertDraftGovernancePolicy,
  } = await import(pathToFileURL(VALIDATOR_PATH));
  const policy = readJson('governance-policy.internal-evaluation.v1.draft.json');
  const validatedPolicy = assertDraftGovernancePolicy(policy);
  assert.notEqual(validatedPolicy, policy);
  assert.deepEqual(validatedPolicy, policy);
  assertDeepFrozen(validatedPolicy);
  assert.equal(policy.operational_profile, 'internal-evaluation');
  assert.deepEqual(policy.authority_ceiling, {
    clinical_use: false,
    production: false,
    deployment: false,
  });
  assert.equal(
    policy.failure_semantics.technical_gate_failure,
    'block_promotion_only',
  );
  assert.equal(
    policy.failure_semantics.invalid_signature_or_subject_binding,
    'event_has_no_approval_effect',
  );
  assert.equal(
    policy.profile_requirements.evaluation_watermark,
    'INTERNAL EVALUATION — NOT FOR CLINICAL USE',
  );
  assert.equal(policy.profile_requirements.production_open_required_empty, true);
  assert.equal(policy.workflow_contract.urgent_supply_escalated_is_terminal, false);
  assert.equal(policy.workflow_contract.free_text_only_resolution_allowed, false);
  assert.equal(
    policy.workflow_contract.state_specific_exposure_compatibility_required,
    true,
  );
  assert.equal(
    policy.workflow_contract.pending_state_requirements_required,
    true,
  );
  assert.equal(
    policy.workflow_contract.state_specific_confirmation_method_compatibility_required,
    true,
  );
  assert.equal(
    policy.workflow_contract
      .terminal_order_state_requires_trusted_event_and_authorized_actor,
    true,
  );
  assert.equal(
    policy.workflow_contract
      .pharmacy_self_attestation_can_satisfy_terminal_order_state,
    false,
  );
  assert.equal(Object.hasOwn(policy, 'policy_jcs_sha256'), false);
  assert.equal(Object.hasOwn(policy, 'approval_status'), false);
  assert.equal(Object.hasOwn(policy, 'approval_artifact_commit'), false);
});

test('clinical subject binds the exact six reviewed oral-tablet product pairs', {
  skip: !PACKAGE_PRESENT || !VALIDATOR_PRESENT,
}, async () => {
  const {
    assertDraftClinicalRuleSubject,
  } = await import(pathToFileURL(VALIDATOR_PATH));
  const subject = readJson('warfarin-cotrimoxazole.rule-subject.v1.draft.json');
  const validatedSubject = assertDraftClinicalRuleSubject(subject);
  assert.notEqual(validatedSubject, subject);
  assert.deepEqual(validatedSubject, subject);
  assertDeepFrozen(validatedSubject);

  assert.equal(subject.requested_profile, 'internal-evaluation');
  assert.equal(subject.identity_scope.expected_exact_product_pair_count, 6);
  assert.equal(subject.product_pairs.length, 6);
  assert.equal(
    new Set(subject.product_pairs.map((pair) => JSON.stringify(pair))).size,
    6,
  );
  assert.deepEqual(
    subject.identity_scope.object.presentation_mapping_ids,
    [
      'presentation:pmbjp:2141:oral-tablet',
      'presentation:pmbjp:2142:oral-tablet',
      'presentation:pmbjp:452:oral-tablet',
    ],
  );
  assert.equal(
    subject.identity_scope.perpetrator.combination_id,
    'combination:co-trimoxazole:rxnorm-10831',
  );
  assert.equal(subject.identity_scope.perpetrator.match_mode, 'exact_active_set');
  assert.equal(subject.identity_scope.route, 'oral');
  assert.equal(subject.identity_scope.formulation, 'tablet');
  assert.deepEqual(subject.audience_bindings.render_allowlist, {
    pharmacy: [
      'mechanism',
      'pharmacy_management_current_check',
      'pharmacy_escalation_context',
      'patient_counselling',
    ],
    prescriber_or_anticoagulation_service: [
      'mechanism',
      'prescriber_information',
      'patient_counselling',
    ],
    patient: [
      'patient_counselling',
    ],
  });
  assert.equal(
    subject.audience_bindings.fields_not_in_audience_allowlist,
    'prohibited',
  );
  assert.deepEqual(subject.audience_bindings.conditional_render_allowlist, {
    unreviewed_subject_or_identity_unresolved: {
      pharmacy: [],
      prescriber_or_anticoagulation_service: [],
      patient: [],
    },
    reviewed_subject_with_resolved_identity_and_unresolved_exposure: {
      pharmacy: [
        'pharmacy_escalation_context',
      ],
      prescriber_or_anticoagulation_service: [],
      patient: [],
    },
  });
  assert.deepEqual(subject.audience_bindings.render_composition, {
    condition_precedence: [
      'unreviewed_subject_or_identity_unresolved',
      'reviewed_subject_with_resolved_identity_and_unresolved_exposure',
      'reviewed_subject_with_resolved_identity_and_resolved_exposure',
    ],
    conditional_with_general_operator: 'intersection',
    general_allowlist_fallback_condition:
      'reviewed_subject_with_resolved_identity_and_resolved_exposure',
    unknown_or_conflicting_condition: 'render_no_clinical_content',
    union_allowed: false,
  });

  const pmbjp89 = subject.identity_scope.perpetrator.product_assertions
    .find((product) => product.pmbjp_code === '89');
  const pmbjp90 = subject.identity_scope.perpetrator.product_assertions
    .find((product) => product.pmbjp_code === '90');
  assert.equal(pmbjp89.evidence_alignment, 'direct_strength_and_dose_form_alignment');
  assert.equal(pmbjp89.direct_strength_and_dose_form_alignment, true);
  assert.equal(pmbjp89.direct_pmbjp_product_label_evidence, false);
  assert.equal(pmbjp89.requires_strength_extrapolation_approval, false);
  assert.equal(pmbjp89.requires_explicit_clinician_approval, true);
  assert.equal(pmbjp90.evidence_alignment, 'strength_extrapolation');
  assert.equal(pmbjp90.direct_strength_and_dose_form_alignment, false);
  assert.equal(pmbjp90.direct_pmbjp_product_label_evidence, false);
  assert.equal(pmbjp90.requires_strength_extrapolation_approval, true);
  assert.equal(pmbjp90.requires_explicit_clinician_approval, true);
  assert.doesNotMatch(JSON.stringify(subject), /clinician_authorized/iu);
});

test('subject remains current-check-only and contains no inferred population or post-course rule', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const subject = readJson('warfarin-cotrimoxazole.rule-subject.v1.draft.json');
  assert.deepEqual(subject.temporal_scope, {
    mode: 'current_check_only',
    recent_exposure_trigger_enabled: false,
    lookback_days: 0,
    course_end_inference: 'prohibited',
    operational_definition: 'both exact products are represented in the same current interaction check',
    missing_or_conflicting_status: 'unresolved',
  });
  assert.deepEqual(subject.population_scope, {
    mode: 'not_parameterized',
    age_filter: null,
    age_inference: 'prohibited',
    meaning: 'this subject authorizes no adult-only, paediatric-only, or age-derived branch',
  });
  assert.equal(subject.workflow_requirements.urgent_supply_pathway.authority, 'none');
  assert.equal(
    subject.workflow_requirements.urgent_supply_pathway.can_resolve_clinical_review,
    false,
  );
  assert.deepEqual(subject.workflow_requirements.terminal_states, [
    'review_confirmed',
    'no_concurrent_exposure_verified',
    'order_cancelled',
    'order_corrected_pair_absent_after_recheck',
  ]);
  assert.equal(
    Object.hasOwn(
      subject.workflow_requirements.terminal_state_requirements,
      'order_cancelled_or_corrected',
    ),
    false,
  );
  assert.deepEqual(
    subject.workflow_requirements.state_exposure_status_compatibility
      .order_corrected_pair_absent_after_recheck,
    ['corrected_order_pair_absent_after_recheck'],
  );
  assert.deepEqual(
    subject.workflow_requirements.state_exposure_status_compatibility,
    {
      manual_review_required: [
        'unresolved',
      ],
      clinician_confirmation_pending: [
        'current_or_intended_overlap_confirmed',
      ],
      urgent_supply_escalated: [
        'current_or_intended_overlap_confirmed',
        'unresolved',
      ],
      correction_recheck_pending: [
        'unresolved',
      ],
      review_confirmed: [
        'current_or_intended_overlap_confirmed',
      ],
      no_concurrent_exposure_verified: [
        'no_current_or_intended_overlap_verified',
      ],
      order_cancelled: [
        'order_cancelled_before_overlap',
      ],
      order_corrected_pair_absent_after_recheck: [
        'corrected_order_pair_absent_after_recheck',
      ],
    },
  );
  assert.deepEqual(
    subject.workflow_requirements.state_confirmation_method_compatibility,
    {
      manual_review_required: [],
      clinician_confirmation_pending: [
        'verified_current_order_or_medication_record',
      ],
      urgent_supply_escalated: [
        'responsible_clinician_or_service_confirmation',
        'verified_current_order_or_medication_record',
      ],
      correction_recheck_pending: [
        'trusted_order_correction_event',
      ],
      review_confirmed: [
        'responsible_clinician_or_service_confirmation',
      ],
      no_concurrent_exposure_verified: [
        'responsible_clinician_or_service_confirmation',
        'verified_current_order_or_medication_record',
      ],
      order_cancelled: [
        'trusted_order_cancellation_event',
      ],
      order_corrected_pair_absent_after_recheck: [
        'trusted_order_correction_event',
      ],
    },
  );
  assert.deepEqual(subject.workflow_requirements.pending_state_requirements, {
    manual_review_required: [
      'concomitant_exposure_status',
    ],
    clinician_confirmation_pending: [
      'confirmation_method',
      'concomitant_exposure_status',
    ],
    urgent_supply_escalated: [
      'concomitant_exposure_status',
      'escalation_reference',
    ],
    correction_recheck_pending: [
      'confirmation_method',
      'concomitant_exposure_status',
      'authorized_order_actor_id',
      'authorized_order_actor_role',
      'trusted_order_event_id',
      'trusted_order_event_store_id',
      'order_correction_reference',
    ],
  });
  assert.deepEqual(
    subject.workflow_requirements.order_event_authorization,
    {
      actor_authorization_source: 'trusted_authorization_registry_required',
      event_source: 'trusted_order_system_required',
      pharmacy_self_attestation_satisfies_terminal_state: false,
    },
  );
  for (const terminalState of [
    'order_cancelled',
    'order_corrected_pair_absent_after_recheck',
  ]) {
    const requirements = subject.workflow_requirements
      .terminal_state_requirements[terminalState];
    for (const field of [
      'authorized_order_actor_id',
      'authorized_order_actor_role',
      'trusted_order_event_id',
      'trusted_order_event_store_id',
    ]) {
      assert.ok(
        requirements.includes(field),
        `${terminalState} must require ${field}`,
      );
    }
  }
  assert.equal(Object.hasOwn(subject, 'interaction_episode_id'), false);
  assert.equal(Object.hasOwn(subject, 'approval_artifact_commit'), false);
  assert.equal(Object.hasOwn(subject, 'subject_jcs_sha256'), false);
});

test('clinical text preserves the bounded evidence and clinical authority boundary', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const subject = readJson('warfarin-cotrimoxazole.rule-subject.v1.draft.json');
  const text = Object.values(subject.clinical_text).join('\n');
  assert.match(text, /sulfamethoxazole inhibits CYP2C9/iu);
  assert.match(text, /may prolong prothrombin time/iu);
  assert.match(text, /coagulation time.*reassessed/iu);
  assert.match(text, /prescriber or anticoagulation service/iu);
  assert.match(text, /patient-specific PT\/INR/iu);
  assert.match(text, /pharmacy must not change a dose or stop either medicine independently/iu);
  assert.match(text, /not to stop warfarin without clinical advice/iu);
  assert.match(text, /no universal monitoring schedule/iu);
  assert.match(text, /verify whether.*current or intended concurrent use/iu);
  assert.doesNotMatch(text, /before dispensing|concomitant oral co-trimoxazole course/iu);
  assert.doesNotMatch(
    text,
    /raises? warfarin exposure|high bleeding risk especially|choose an alternative|intensive INR|after start and after stop|Child-Pugh|14[- ]day/iu,
  );
});

test('subject evidence and identity bindings rehash against the committed reviewed objects', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const subject = readJson('warfarin-cotrimoxazole.rule-subject.v1.draft.json');
  const combinationManifest = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data-static', 'combination-identity-overrides.json'),
    'utf8',
  ));
  const presentationManifest = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data-static', 'product-presentation-overrides.json'),
    'utf8',
  ));
  const combination = combinationManifest.combinations.find(
    (entry) => entry.combination_id === 'combination:co-trimoxazole:rxnorm-10831',
  );
  const subjectCombinationProducts = new Map(
    subject.identity_scope.perpetrator.product_assertions.map(
      (product) => [product.pmbjp_code, product],
    ),
  );
  for (const product of combination.presentations) {
    const bound = subjectCombinationProducts.get(product.source_identity.code);
    assert.equal(bound.product_id, product.product_id);
    assert.equal(bound.product_assertion_sha256, product.product_assertion_sha256);
    assert.equal(bound.rxnorm_scd_rxcui, product.rxnorm_scd.rxcui);
  }

  const subjectWarfarinProducts = new Map(
    subject.identity_scope.object.product_assertions.map(
      (product) => [product.pmbjp_code, product],
    ),
  );
  for (const mappingId of subject.identity_scope.object.presentation_mapping_ids) {
    const mapping = presentationManifest.mappings.find(
      (entry) => entry.mapping_id === mappingId,
    );
    const bound = subjectWarfarinProducts.get(mapping.source_identity.code);
    assert.equal(bound.product_id, mapping.product_id);
    assert.equal(bound.product_assertion_sha256, mapping.product_assertion_sha256);
  }

  assert.deepEqual(subject.evidence_boundary, {
    evidence_jurisdiction: 'US',
    product_catalogue: 'PMBJP',
    product_market: 'India',
    deployment_jurisdiction: 'none',
    source_policy_id: 'openfda-labels',
    set_id: '7f82e5e0-b627-a3f3-e053-2991aa0abaa5',
    spl_version: 6,
    effective_time: '20260209',
    source_version: 'openfda-labels:7f82e5e0-b627-a3f3-e053-2991aa0abaa5:6',
    payload_sha256: '63dfc42563d6fb406df816f4d801878e9a33bae39cdae3abb01ffe0e0dbb706e',
    fragment_sha256: [
      'c0fb47f494a1a43f71d48d9298a92854e3e9c0de8ec40cd99e032dd3e23b3d02',
      'ab592d24f03eaccf6fcc91f344da320fa27b38226884ae501853bbcd07b62a25',
    ],
  });
  assert.equal(
    subject.identity_evidence_bindings.rxnorm_combination_bundle
      .committed_blob_content_sha256,
    'be734f07cceffad4f8309008a9d4df994f8141cef24b842b8d3797dea0758cbb',
  );
  assert.equal(
    subject.identity_evidence_bindings.combination_identity_manifest
      .committed_blob_content_sha256,
    'a0813b2a4d80198c6793d6e576b41847da31415f51a68ee75c744a8656223466',
  );
  assert.equal(
    Object.hasOwn(
      subject.identity_evidence_bindings.rxnorm_combination_bundle,
      'git_blob_sha256',
    ),
    false,
  );

  const committedBindings = [
    [
      'data-static/combination-rxnorm-evidence/combination_co-trimoxazole_rxnorm-10831.json',
      subject.identity_evidence_bindings.rxnorm_combination_bundle,
    ],
    [
      'data-static/combination-identity-overrides.json',
      subject.identity_evidence_bindings.combination_identity_manifest,
    ],
  ];
  for (const [repoPath, binding] of committedBindings) {
    const content = execFileSync('git', ['show', `HEAD:${repoPath}`], {
      cwd: ROOT,
      windowsHide: true,
    });
    assert.equal(
      crypto.createHash('sha256').update(content).digest('hex'),
      binding.committed_blob_content_sha256,
    );
    assert.equal(
      execFileSync('git', ['rev-parse', `HEAD:${repoPath}`], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
      }).trim(),
      binding.git_blob_oid_sha1,
    );
  }

  const draftLine = fs.readFileSync(
    path.join(ROOT, 'docs', 'interaction-review', 'batch-01-v2', 'batch-01-v2.jsonl'),
    'utf8',
  ).split('\n').find((line) => (
    line !== '' && JSON.parse(line).rule_id === 'warfarin__cotrimoxazole'
  ));
  assert.equal(
    crypto.createHash('sha256').update(draftLine).digest('hex'),
    subject.repository_provenance.current_non_authorizing_draft_row_sha256,
  );

  const originalBase = subject.repository_provenance.original_review_base;
  const verifiedBase = subject.repository_provenance.verified_source_repository_base;
  assert.doesNotThrow(() => execFileSync(
    'git',
    ['merge-base', '--is-ancestor', originalBase, verifiedBase],
    { cwd: ROOT, windowsHide: true },
  ));
  assert.equal(
    execFileSync('git', ['diff', '--name-only', `${originalBase}..${verifiedBase}`], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    }).trim(),
    'docs/interaction-review/2026-07-29-warfarin-cotrimoxazole-clinician-approval.md',
  );
});

test('clinician rendering contains the exact safety-critical canonical subject text', {
  skip: !PACKAGE_PRESENT,
}, () => {
  const subject = readJson('warfarin-cotrimoxazole.rule-subject.v1.draft.json');
  const rawRendering = fs.readFileSync(
    path.join(PACKAGE_DIR, 'CLINICIAN-REVIEW.md'),
    'utf8',
  );
  const exactClinicalText = markedSection(rawRendering, 'canonical-clinical-text');
  const renderedClinicalText = Object.fromEntries(
    [...exactClinicalText.matchAll(
      /^### ([^\r\n]+)\r?\n\r?\n((?:>[^\r\n]*(?:\r?\n|$))+)/gmu,
    )].map((match) => [
      match[1],
      unquoteMarkdownParagraph(match[2]),
    ]),
  );
  assert.deepEqual(renderedClinicalText, {
    Mechanism: subject.clinical_text.mechanism,
    'Pharmacy management for the current check':
      subject.clinical_text.pharmacy_management_current_check,
    'Pharmacy escalation context':
      subject.clinical_text.pharmacy_escalation_context,
    'Prescriber information': subject.clinical_text.prescriber_information,
    'Patient counselling': subject.clinical_text.patient_counselling,
  });
  assert.match(rawRendering, /\*\*Decision:\*\* no decision recorded/u);
  assert.match(
    rawRendering,
    /\*\*Clinical-use, production, and deployment authority:\*\* none/u,
  );
  assert.equal((rawRendering.match(/\*\*Decision:\*\*/gu) ?? []).length, 1);
  assert.equal(
    (
      rawRendering.match(
        /\*\*Clinical-use, production, and deployment authority:\*\*/gu,
      ) ?? []
    ).length,
    1,
  );
  assert.doesNotMatch(rawRendering, /\*\*Decision:\*\*\s*APPROVED/iu);
  const rendering = rawRendering
    .replace(/[`>*_#|]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  for (const value of Object.values(subject.clinical_text)) {
    assert.match(rendering, new RegExp(
      value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/\s+/gu, '\\s+'),
      'u',
    ));
  }
  assert.match(rendering, /severity\s+major/iu);
  assert.match(rendering, /dispense action\s+confirm\s+and\s+monitor/iu);
  assert.match(rendering, /temporal scope\s+current interaction check only/iu);
  for (const pair of subject.product_pairs) {
    assert.match(rawRendering, new RegExp(
      `PMBJP ${pair.perpetrator_pmbjp_code}[^\\r\\n]*`
      + `PMBJP ${pair.object_pmbjp_code}`,
      'u',
    ));
  }
  for (const strength of [
    'sulfamethoxazole 800 mg / trimethoprim 160 mg',
    'sulfamethoxazole 100 mg / trimethoprim 20 mg',
    'warfarin 1 mg',
    'warfarin 2 mg',
    'warfarin 5 mg',
  ]) {
    assert.match(rawRendering, new RegExp(
      strength.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
      'iu',
    ));
  }
  for (const state of [
    ...subject.workflow_requirements.pending_states,
    ...subject.workflow_requirements.terminal_states,
  ]) {
    assert.match(rawRendering, new RegExp(state.replaceAll('_', '[-_ ]'), 'u'));
  }
  for (const exclusion of subject.exclusions) {
    assert.match(rendering, new RegExp(
      exclusion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/\s+/gu, '\\s+'),
      'iu',
    ));
  }
  assert.match(rendering, /evidence jurisdiction\s+US/iu);
  assert.match(rendering, /product market\s+India/iu);
  assert.match(rendering, /deployment jurisdiction\s+none/iu);
  assert.match(rendering, /supplements component subjects/iu);
  assert.match(rendering, /supersedes no current rule/iu);
  assert.match(rendering, /PMBJP 89.*not.*product-specific PMBJP 89 label/iu);
  assert.match(rendering, /PMBJP 90.*strength extrapolation/iu);
  assert.match(
    rendering,
    /unreviewed subject or identity-unresolved.*no clinical content/iu,
  );
  assert.match(
    rendering,
    /resolved identity.*exposure-unresolved.*pharmacy\s+escalation\s+context/iu,
  );
  assert.match(
    rendering,
    /trusted order event.*authorized order actor/iu,
  );

  const workflowTable = markedSection(rawRendering, 'workflow-compatibility-table');
  const workflowRows = workflowTable
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*`/u.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  assert.equal(workflowRows.length, 8);
  const renderedWorkflow = Object.fromEntries(workflowRows.map((cells) => [
    cells[0].replaceAll('`', ''),
    {
      kind: cells[1],
      exposure_statuses: codeCellValues(cells[2]),
      confirmation_methods: codeCellValues(cells[3]),
      required_evidence: codeCellValues(cells[4]),
    },
  ]));
  const expectedWorkflow = {};
  for (const kind of ['pending', 'terminal']) {
    for (const state of subject.workflow_requirements[`${kind}_states`]) {
      expectedWorkflow[state] = {
        kind,
        exposure_statuses:
          subject.workflow_requirements.state_exposure_status_compatibility[state],
        confirmation_methods:
          subject.workflow_requirements.state_confirmation_method_compatibility[state],
        required_evidence: kind === 'pending'
          ? subject.workflow_requirements.pending_state_requirements[state]
          : subject.workflow_requirements.terminal_state_requirements[state],
      };
    }
  }
  assert.deepEqual(renderedWorkflow, expectedWorkflow);
  for (const field of subject.workflow_requirements.optional_audit_fields) {
    assert.equal(
      rawRendering.includes(`\`${field}\``),
      true,
      `clinician rendering is missing optional audit field ${field}`,
    );
  }
  for (const decision of subject.change_control.new_approval_required_for) {
    assert.match(rawRendering, new RegExp(
      decision.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
      'iu',
    ));
  }
  assert.match(
    rawRendering,
    new RegExp(subject.supersession.interaction_family_id, 'u'),
  );
  assert.match(
    rawRendering,
    new RegExp(subject.supersession.subject_specificity, 'u'),
  );
  const signoffList = markedSection(rawRendering, 'signoff-decision-list');
  const signoffItems = signoffList
    .split(/\r?\n/u)
    .filter((line) => /^\d+\.\s/u.test(line));
  assert.equal(signoffItems.length, 13);
  assert.deepEqual(
    signoffItems.map((line) => Number.parseInt(line, 10)),
    Array.from({ length: 13 }, (_, index) => index + 1),
  );
  assert.doesNotMatch(
    rawRendering,
    /correction.*must transition exclusively/iu,
  );
});

test('approval-event template cannot be mistaken for an authenticated approval event', {
  skip: !PACKAGE_PRESENT || !VALIDATOR_PRESENT,
}, async () => {
  const {
    assertApprovalEventTemplate,
  } = await import(pathToFileURL(VALIDATOR_PATH));
  const template = readJson('approval-event.template.draft.json');
  const validatedTemplate = assertApprovalEventTemplate(template);
  assert.notEqual(validatedTemplate, template);
  assert.deepEqual(validatedTemplate, template);
  assertDeepFrozen(validatedTemplate);
  assert.equal(template.template_only, true);
  assert.equal(template.event_body_template.decision, null);
  assert.equal(template.event_body_template.event_id, null);
  assert.equal(template.event_body_template.approval_artifact_commit, null);
  assert.equal(template.approval_record_template.event_body, null);
  assert.equal(template.approval_record_template.detached_signature_envelope, null);
  assert.equal(
    template.approval_record_template.canonicalization,
    'RFC8785-JCS',
  );
  assert.equal(
    Object.hasOwn(template.event_body_template, 'signature'),
    false,
  );
  assert.equal(
    Object.hasOwn(template.event_body_template, 'key_status_at_signing'),
    false,
  );
  assert.equal(
    Object.hasOwn(template.event_body_template, 'previous_event_hash'),
    false,
  );
  assert.equal(
    Object.hasOwn(template.event_body_template, 'promotion_eligible'),
    false,
  );
  assert.equal(
    template.detached_signature_envelope_template.event_body_jcs_sha256,
    null,
  );
  assert.equal(
    template.append_only_store_receipt_template.receipt_body_template.sequence,
    null,
  );
  assert.equal(
    template.append_only_store_receipt_template
      .receipt_body_template.approval_record_jcs_sha256,
    null,
  );
  assert.equal(
    template.signed_checkpoint_template.checkpoint_body_template.through_sequence,
    null,
  );
});

test('raw draft JSON parsing rejects duplicate members before object validation', {
  skip: !VALIDATOR_PRESENT,
}, async () => {
  const {
    parseDraftApprovalJson,
  } = await import(pathToFileURL(VALIDATOR_PATH));
  assert.equal(typeof parseDraftApprovalJson, 'function');
  assert.throws(
    () => parseDraftApprovalJson(
      '{"event":{"decision":"APPROVED","decision":null}}',
      'hostile duplicate fixture',
    ),
    /duplicate.*decision/iu,
  );
  assert.deepEqual(
    parseDraftApprovalJson(
      '{"event":{"decision":null},"values":[true,false,null,1.5e2]}',
      'valid fixture',
    ),
    {
      event: {
        decision: null,
      },
      values: [
        true,
        false,
        null,
        150,
      ],
    },
  );
  assert.throws(
    () => parseDraftApprovalJson(
      '{"\\u0064ecision":null,"decision":"APPROVED"}',
      'escaped duplicate fixture',
    ),
    /duplicate.*decision/iu,
  );
});

test('hostile authority mutations are rejected by the draft validator', {
  skip: !PACKAGE_PRESENT || !VALIDATOR_PRESENT,
}, async () => {
  const {
    assertApprovalEventTemplate,
    assertDraftClinicalRuleSubject,
    assertDraftGovernancePolicy,
    validateDraftApprovalPackage,
  } = await import(pathToFileURL(VALIDATOR_PATH));
  const policy = readJson('governance-policy.internal-evaluation.v1.draft.json');
  const subject = readJson('warfarin-cotrimoxazole.rule-subject.v1.draft.json');
  const template = readJson('approval-event.template.draft.json');
  const status = readJson('package-status.json');
  const statefulPolicy = structuredClone(policy);
  let productionReads = 0;
  Object.defineProperty(statefulPolicy.authority_ceiling, 'production', {
    enumerable: true,
    configurable: true,
    get() {
      productionReads += 1;
      return productionReads === 1 ? false : true;
    },
  });
  const statefulPolicySnapshot = assertDraftGovernancePolicy(statefulPolicy);
  assert.equal(statefulPolicySnapshot.authority_ceiling.production, false);
  assert.equal(productionReads, 1);
  assertDeepFrozen(statefulPolicySnapshot);

  assert.throws(
    () => assertDraftGovernancePolicy({
      ...policy,
      authority_ceiling: { ...policy.authority_ceiling, production: true },
    }),
    /production authority/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      temporal_scope: { ...subject.temporal_scope, lookback_days: 14 },
    }),
    /lookback_days/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      product_pairs: subject.product_pairs.slice(0, 5),
    }),
    /six exact product pairs/iu,
  );
  assert.throws(
    () => assertApprovalEventTemplate({
      ...template,
      event_body_template: {
        ...template.event_body_template,
        decision: 'APPROVED',
      },
    }),
    /template decision/iu,
  );
  assert.throws(
    () => assertDraftGovernancePolicy({
      ...policy,
      schema_version: '9.9.9',
    }),
    /schema_version/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      schema_id: 'attacker.rule-subject',
    }),
    /schema_id/iu,
  );
  assert.throws(
    () => assertApprovalEventTemplate({
      ...template,
      schema_version: null,
    }),
    /schema_version/iu,
  );
  assert.throws(
    () => assertDraftGovernancePolicy({
      ...policy,
      runtime_safety: {
        ...policy.runtime_safety,
        unknown_authority_switch: true,
      },
    }),
    /unknown.*unknown_authority_switch/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      identity_scope: {
        ...subject.identity_scope,
        component_matching_allowed: true,
      },
    }),
    /unknown.*component_matching_allowed/iu,
  );
  assert.throws(
    () => assertApprovalEventTemplate({
      ...template,
      detached_signature_envelope_template: {
        ...template.detached_signature_envelope_template,
        key_status_at_signing: 'valid',
      },
    }),
    /key_status_at_signing/iu,
  );
  assert.throws(
    () => assertDraftGovernancePolicy({
      ...policy,
      runtime_safety: {
        ...policy.runtime_safety,
        blank_result_means_safe: true,
      },
    }),
    /blank_result_means_safe/iu,
  );
  assert.throws(
    () => assertDraftGovernancePolicy({
      ...policy,
      workflow_contract: {
        ...policy.workflow_contract,
        pharmacy_can_change_or_stop_medicine_independently: true,
      },
    }),
    /pharmacy_can_change_or_stop_medicine_independently/iu,
  );
  assert.throws(
    () => assertDraftGovernancePolicy({
      ...policy,
      canonicalization_profile: {
        ...policy.canonicalization_profile,
        method: 'none',
      },
    }),
    /canonicalization_profile/iu,
  );
  assert.throws(
    () => assertDraftGovernancePolicy({
      ...policy,
      gate_policy: {
        ...policy.gate_policy,
        failed_or_stale_gate_invalidates_historical_approval: true,
      },
    }),
    /gate_policy/iu,
  );
  assert.throws(
    () => assertDraftGovernancePolicy({
      ...policy,
      trust_profile_bindings: {
        ...policy.trust_profile_bindings,
        signature_profile_id: 'self-asserted',
      },
    }),
    /trust_profile_bindings/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      clinical_classification: {
        ...subject.clinical_classification,
        severity: 'contraindicated',
      },
    }),
    /clinical_classification/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      clinical_text: {
        ...subject.clinical_text,
        pharmacy_management_current_check:
          `${subject.clinical_text.pharmacy_management_current_check} Reduce warfarin by 50%.`,
      },
    }),
    /clinical_text/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      workflow_requirements: {
        ...subject.workflow_requirements,
        free_text_only_resolution_allowed: true,
      },
    }),
    /workflow_requirements/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      audience_bindings: {
        ...subject.audience_bindings,
        conditional_render_allowlist: {
          ...subject.audience_bindings.conditional_render_allowlist,
          reviewed_subject_with_resolved_identity_and_unresolved_exposure: {
            pharmacy: [
              'pharmacy_escalation_context',
            ],
            prescriber_or_anticoagulation_service: [],
            patient: [
              'mechanism',
            ],
          },
        },
      },
    }),
    /audience_bindings/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      audience_bindings: {
        ...subject.audience_bindings,
        render_composition: {
          ...subject.audience_bindings.render_composition,
          conditional_with_general_operator: 'union',
          union_allowed: true,
        },
      },
    }),
    /audience_bindings/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      workflow_requirements: {
        ...subject.workflow_requirements,
        state_exposure_status_compatibility: {
          ...subject.workflow_requirements.state_exposure_status_compatibility,
          clinician_confirmation_pending: [
            'unresolved',
          ],
        },
      },
    }),
    /workflow_requirements/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      workflow_requirements: {
        ...subject.workflow_requirements,
        order_event_authorization: {
          ...subject.workflow_requirements.order_event_authorization,
          pharmacy_self_attestation_satisfies_terminal_state: true,
        },
      },
    }),
    /workflow_requirements/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      supersession: {
        ...subject.supersession,
        supersedes_rule_ids: ['methotrexate__trimethoprim'],
      },
    }),
    /supersession/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      governance_policy_binding: {
        ...subject.governance_policy_binding,
        policy_jcs_sha256: '0'.repeat(64),
      },
    }),
    /governance_policy_binding/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      identity_scope: {
        ...subject.identity_scope,
        perpetrator: {
          ...subject.identity_scope.perpetrator,
          rxnorm_min_rxcui: '99999',
        },
      },
    }),
    /perpetrator/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      exclusions: ['nothing'],
    }),
    /exclusions/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      product_pairs: [...subject.product_pairs].reverse(),
    }),
    /product_pairs.*order/iu,
  );
  assert.throws(
    () => assertDraftClinicalRuleSubject({
      ...subject,
      identity_scope: {
        ...subject.identity_scope,
        perpetrator: {
          ...subject.identity_scope.perpetrator,
          product_assertions: [
            ...subject.identity_scope.perpetrator.product_assertions,
          ].reverse(),
        },
      },
    }),
    /product_assertions.*order/iu,
  );
  assert.throws(
    () => assertApprovalEventTemplate({
      ...template,
      detached_signature_envelope_template: {
        ...template.detached_signature_envelope_template,
        signature_algorithm: 'none',
        signature_base64: 'forged',
      },
    }),
    /detached_signature_envelope_template/iu,
  );
  assert.throws(
    () => assertApprovalEventTemplate({
      ...template,
      append_only_store_receipt_template: {
        ...template.append_only_store_receipt_template,
        receipt_body_template: {
          ...template.append_only_store_receipt_template.receipt_body_template,
          verification: { event_signature: 'valid' },
        },
      },
    }),
    /append_only_store_receipt_template/iu,
  );
  assert.throws(
    () => assertApprovalEventTemplate({
      ...template,
      signed_checkpoint_template: {
        ...template.signed_checkpoint_template,
        detached_store_signature_template: {
          ...template.signed_checkpoint_template.detached_store_signature_template,
          signature_base64: 'forged',
        },
      },
    }),
    /signed_checkpoint_template/iu,
  );
  assert.throws(
    () => validateDraftApprovalPackage({
      policy,
      subject,
      eventTemplate: template,
      clinicianReviewText: fs.readFileSync(
        path.join(PACKAGE_DIR, 'CLINICIAN-REVIEW.md'),
        'utf8',
      ),
      status: {
        ...status,
        implemented_controls: [
          'authenticated clinician signature implemented',
          'production gate implemented',
        ],
        required_before_promotion: ['nothing'],
      },
    }),
    /implemented_controls/iu,
  );
});

test('historical draft and production-open remain non-authorizing', () => {
  const draft = readJsonlRule('warfarin__cotrimoxazole');
  assert.equal(draft.runtime_enabled, false);
  assert.equal(draft.runtime_status.runtime_enabled, false);
  assert.equal(draft.runtime_status.promotion_eligible, false);

  const productionPack = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data-static', 'interaction-rules.json'),
    'utf8',
  ));
  assert.equal(productionPack.profile, 'production-open');
  assert.equal(productionPack.declared_coverage, 'unknown');
  assert.deepEqual(productionPack.rules, []);
});
