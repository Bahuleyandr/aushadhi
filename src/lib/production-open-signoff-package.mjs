import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { parseDraftApprovalJson } from './interaction-approval-draft.mjs';
import {
  PRODUCT_ASSERTION_NAMESPACE,
  productAssertionForRow,
  productAssertionHashForRow,
  productIdForRow,
} from './product-resolver.mjs';

const REQUIRED_RULES = new Map([
  ['warfarin__amiodarone', ['da731112748d90f672439d290b079f7ee2a90bb00c8b05c67110ec12509f485d', 6]],
  ['warfarin__clarithromycin_oral', ['33a01de9d7f556241de4be8fd9fcb76def45d51f7fa05c730bb7f2431b163499', 3]],
  ['warfarin__fluconazole', ['088bd06e472723bce36527b67d1c2b0d7c24694842c5929c25c1c4e693952f84', 9]],
  ['warfarin__ketoconazole_oral', ['1657195ba626a2337c8b390679e64f32006c26fd758948560a4faf97875d8a3e', 3]],
  ['warfarin__metronidazole', ['2f6e13a141107149c32c82df764a0710a423265e5600b35155ece4d53222df3f', 6]],
  ['warfarin__voriconazole', ['b8e0d94d6a94d2a765ff8690d9a9b4bff66c333747eeb2cc0bb57e2c95997cf8', 3]],
]);
const NONE_AUTHORITY = Object.freeze({
  runtime: 'none',
  publication: 'none',
  production: 'none',
  deployment: 'none',
  clinical_use: 'none',
});
const SUBJECT_KEYS = [
  'schema_version',
  'subject_id',
  'subject_status',
  'release_profile',
  'reviewer_id',
  'repository_provenance',
  'catalogue_binding',
  'rule',
  'clinical_scope',
  'product_pairs',
  'evidence_bindings',
  'evidence_boundary',
  'source_rights',
  'declared_coverage',
  'matching_boundary',
  'workflow_boundary',
  'approval_validity',
  'authority',
  'approval_statement',
  'invalidation_conditions',
];
const PRODUCT_KEYS = [
  'mapping_id',
  'source_identity',
  'product_id',
  'product_assertion_sha256',
  'product_assertion',
  'presentation',
  'review_status',
];
const TEMPLATE_KEYS = [
  'schema_version',
  'template_only',
  'subject_id',
  'approval_subject_jcs_sha256',
  'authority',
  'event_body_template',
];
const EVENT_BODY_KEYS = [
  'schema_version',
  'event_id',
  'decision',
  'reviewer_id',
  'reviewed_at_utc',
  'valid_until_utc',
  'repository_head',
  'approval_subject_jcs_sha256',
  'approval_statement_sha256',
  'authentication_method',
  'authenticated_event_id',
  'supersedes_event_id',
];
const INVALIDATION_CONDITIONS = [
  '180-day approval validity expired',
  'approval subject hash mismatch',
  'draft rule hash mismatch',
  'product identity or assertion drift',
  'source evidence withdrawal or drift',
  'source-rights gate not cleared',
  'signature or authorization failure',
  'reviewer revocation or superseding rejection',
  'approval schema, validity policy, workflow boundary, or matching boundary drift',
  'compiler or package gate failure',
];
const APPROVAL_VALIDITY = Object.freeze({
  policy_id: 'clinical-approval-ttl-180d-v1',
  ttl_days: 180,
  begins_at: 'reviewed_at_utc',
  early_invalidation: true,
});
const WORKFLOW_BOUNDARY = Object.freeze({
  checker_trigger_support: Object.freeze(['current_or_intended_concurrent_exposure']),
  unsupported_automatic_triggers: Object.freeze([
    'discontinuation',
    'dose_change',
    'recent_exposure',
  ]),
  medication_lifecycle_follow_up_owner: 'prescriber_or_anticoagulation_service',
});
const MATCHING_BOUNDARY = Object.freeze({
  product_matching: 'exact_enumerated_pairs_only',
  ingredient_wide_matching: false,
  fuzzy_matching: false,
  brand_derived_presentation: false,
  excluded_product_result: 'not_evaluated_or_unresolved',
});

function fail(message) {
  throw new TypeError(`production-open sign-off package: ${message}`);
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
}

function assertKeys(value, allowed, label) {
  assertObject(value, label);
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) fail(`${label} contains unknown ${key}`);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) fail(`${label} is missing ${key}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label} does not match the sign-off boundary`);
}

function assertDeepEqual(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) {
    fail(`${label} does not match the sign-off boundary`);
  }
}

function assertHex(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    fail(`${label} must be a lowercase SHA-256 digest`);
  }
}

function assertGitCommit(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) {
    fail(`${label} must be a lowercase Git commit ID`);
  }
}

function assertionHash(productAssertion) {
  return createHash('sha256')
    .update(PRODUCT_ASSERTION_NAMESPACE, 'utf8')
    .update('\u0000', 'utf8')
    .update(JSON.stringify(productAssertion), 'utf8')
    .digest('hex');
}

function assertValidUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError('approval subject canonicalization: unpaired Unicode surrogate');
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError('approval subject canonicalization: unpaired Unicode surrogate');
    }
  }
}

export function canonicalizeApprovalSubject(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('approval subject canonicalization: non-finite number');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    assertValidUnicode(value);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeApprovalSubject).join(',')}]`;
  }
  if (!value || typeof value !== 'object') {
    throw new TypeError('approval subject canonicalization: value is not valid JSON');
  }
  const entries = Object.keys(value).sort().map((key) => {
    assertValidUnicode(key);
    return `${JSON.stringify(key)}:${canonicalizeApprovalSubject(value[key])}`;
  });
  return `{${entries.join(',')}}`;
}

export function approvalSubjectSha256(subject) {
  return createHash('sha256')
    .update(canonicalizeApprovalSubject(subject), 'utf8')
    .digest('hex');
}

export function approvalStatementSha256(statement) {
  if (typeof statement !== 'string' || statement.trim() === '') {
    fail('approval_statement must be a non-empty string');
  }
  return createHash('sha256').update(statement.normalize('NFC'), 'utf8').digest('hex');
}

function validateProduct(product, drug) {
  assertKeys(product, PRODUCT_KEYS, `${drug} product`);
  assertEqual(product.review_status, 'proposed_for_clinician_signature', `${drug} review_status`);
  assertDeepEqual(product.presentation, {
    route: 'oral',
    formulation: 'tablet',
    release_profile: 'not_asserted',
  }, `${drug} presentation`);
  assertKeys(product.source_identity, ['namespace', 'code'], `${drug} source_identity`);
  assertEqual(product.source_identity.namespace, 'presentation:github-jr', `${drug} source namespace`);
  if (!/^\d+$/u.test(product.source_identity.code)) fail(`${drug} source code must be numeric`);
  assertEqual(
    product.mapping_id,
    `presentation:github-jr:${product.source_identity.code}:oral-tablet`,
    `${drug} mapping_id`,
  );
  assertEqual(product.product_id, productIdForRow(product.product_assertion), `${drug} product_id`);
  assertEqual(
    product.product_assertion_sha256,
    assertionHash(product.product_assertion),
    `${drug} product_assertion_sha256`,
  );
  const ingredients = product.product_assertion.ingredients;
  if (!Array.isArray(ingredients) || ingredients.length !== 1) {
    fail(`${drug} product must have one exact ingredient assertion`);
  }
  assertEqual(ingredients[0].observed_name, drug, `${drug} observed ingredient`);
}

function expectedPairs(objectProducts, perpetratorProducts) {
  const pairs = [];
  for (const objectProduct of objectProducts) {
    for (const perpetratorProduct of perpetratorProducts) {
      pairs.push({
        object_product_id: objectProduct.product_id,
        perpetrator_product_id: perpetratorProduct.product_id,
      });
    }
  }
  return pairs;
}

function validateSubject(subject) {
  assertKeys(subject, SUBJECT_KEYS, 'approval subject');
  assertEqual(subject.schema_version, 2, 'schema_version');
  const required = REQUIRED_RULES.get(subject.rule?.rule_id);
  if (!required) fail(`unexpected rule_id ${subject.rule?.rule_id}`);
  const [draftHash, expectedPairCount] = required;
  assertEqual(subject.subject_id, `production-open:${subject.rule.rule_id}:r2`, 'subject_id');
  assertEqual(subject.subject_status, 'pending_clinician_signature', 'subject_status');
  assertEqual(subject.release_profile, 'production-open', 'release_profile');
  assertEqual(subject.reviewer_id, 'clinician:subas', 'reviewer_id');
  assertKeys(
    subject.repository_provenance,
    ['clinical_content_base', 'signature_event_must_record_repository_head'],
    'repository_provenance',
  );
  assertGitCommit(subject.repository_provenance.clinical_content_base, 'clinical_content_base');
  assertEqual(
    subject.repository_provenance.signature_event_must_record_repository_head,
    true,
    'signature-event repository binding',
  );
  assertKeys(subject.catalogue_binding, [
    'profile',
    'storage_path',
    'artifact_sha256',
    'source_namespace',
    'source_identity_key',
    'evidence_capture_path',
    'evidence_capture_sha256',
    'source_catalogue_reverification',
  ], 'catalogue_binding');
  assertEqual(subject.catalogue_binding.profile, 'production-open', 'catalogue profile');
  assertEqual(
    subject.catalogue_binding.storage_path,
    'data/interaction/production-open/product-catalogue/drugs.jsonl',
    'catalogue storage_path',
  );
  assertHex(subject.catalogue_binding.artifact_sha256, 'catalogue artifact_sha256');
  assertEqual(subject.catalogue_binding.source_namespace, 'github-jr', 'catalogue source_namespace');
  assertEqual(subject.catalogue_binding.source_identity_key, 'source_id', 'catalogue source_identity_key');
  assertEqual(
    subject.catalogue_binding.evidence_capture_path,
    'docs/interaction-review/2026-08-08-warfarin-six-production-open-signoff/product-catalogue-binding-evidence.jsonl',
    'catalogue evidence_capture_path',
  );
  assertHex(subject.catalogue_binding.evidence_capture_sha256, 'catalogue evidence_capture_sha256');
  assertEqual(
    subject.catalogue_binding.source_catalogue_reverification,
    'mandatory_before_signature',
    'catalogue source_catalogue_reverification',
  );
  assertKeys(
    subject.rule,
    ['rule_id', 'draft_rule_sha256', 'severity', 'mechanism', 'management'],
    'rule',
  );
  assertEqual(subject.rule.draft_rule_sha256, draftHash, 'draft_rule_sha256');
  assertEqual(subject.rule.severity, 'major', 'severity');
  if (typeof subject.rule.mechanism !== 'string' || subject.rule.mechanism.trim() === '') {
    fail('rule.mechanism must be a non-empty string');
  }
  assertObject(subject.rule.management, 'rule.management');
  assertEqual(subject.rule.management.dispense_action, 'confirm_and_monitor', 'dispense_action');
  if (JSON.stringify(subject.rule.management).match(/pharmacy (may|must|should) (stop|change)/iu)) {
    fail('management grants autonomous pharmacy action');
  }
  assertKeys(subject.clinical_scope, ['route', 'formulation', 'expected_product_pair_count', 'object', 'perpetrator'], 'clinical_scope');
  assertEqual(subject.clinical_scope.route, 'oral', 'clinical_scope.route');
  assertEqual(subject.clinical_scope.formulation, 'tablet', 'clinical_scope.formulation');
  assertEqual(subject.clinical_scope.expected_product_pair_count, expectedPairCount, 'expected_product_pair_count');
  const objectSide = subject.clinical_scope.object;
  const perpetratorSide = subject.clinical_scope.perpetrator;
  for (const [side, expectedDrug, label] of [
    [objectSide, 'warfarin', 'object'],
    [perpetratorSide, subject.rule.rule_id.split('__')[1].replace(/_oral$/u, ''), 'perpetrator'],
  ]) {
    assertKeys(side, ['drug', 'rxnorm_rxcui', 'rxnorm_tty', 'products'], `clinical_scope.${label}`);
    assertEqual(side.drug, expectedDrug, `${label}.drug`);
    assertEqual(side.rxnorm_tty, 'IN', `${label}.rxnorm_tty`);
    if (!/^\d+$/u.test(side.rxnorm_rxcui)) fail(`${label}.rxnorm_rxcui must be numeric`);
    if (!Array.isArray(side.products) || side.products.length === 0) fail(`${label}.products must not be empty`);
    for (const product of side.products) validateProduct(product, expectedDrug);
  }
  const pairs = expectedPairs(objectSide.products, perpetratorSide.products);
  assertDeepEqual(subject.product_pairs, pairs, 'product_pairs');
  assertEqual(pairs.length, expectedPairCount, 'product_pairs.length');
  if (!Array.isArray(subject.evidence_bindings) || subject.evidence_bindings.length === 0) {
    fail('evidence_bindings must not be empty');
  }
  for (const evidence of subject.evidence_bindings) {
    assertKeys(
      evidence,
      ['source_policy_id', 'document_id', 'document_version', 'payload_sha256', 'jurisdiction'],
      'evidence binding',
    );
    assertEqual(evidence.source_policy_id, 'openfda-labels', 'evidence source_policy_id');
    assertEqual(evidence.jurisdiction, 'US', 'evidence jurisdiction');
    assertHex(evidence.payload_sha256, 'evidence payload_sha256');
  }
  assertKeys(subject.evidence_boundary, [
    'evidence_jurisdiction',
    'product_catalogue',
    'product_market',
    'deployment_jurisdiction',
    'scope_note',
  ], 'evidence_boundary');
  assertEqual(subject.evidence_boundary.evidence_jurisdiction, 'US', 'evidence_jurisdiction');
  assertEqual(subject.evidence_boundary.product_catalogue, 'github-jr', 'product_catalogue');
  assertEqual(subject.evidence_boundary.product_market, 'India', 'product_market');
  assertEqual(subject.evidence_boundary.deployment_jurisdiction, 'none', 'deployment_jurisdiction');
  if (typeof subject.evidence_boundary.scope_note !== 'string'
      || subject.evidence_boundary.scope_note.trim() === '') {
    fail('evidence_boundary.scope_note must be a non-empty string');
  }
  assertDeepEqual(subject.source_rights, {
    catalogue_source_policy_id: 'github-jr',
    status: 'pending_separate_owner_legal_release_decision',
    clinical_signature_clears_source_rights: false,
  }, 'source_rights');
  assertEqual(subject.declared_coverage, 'partial', 'declared_coverage');
  assertDeepEqual(subject.matching_boundary, MATCHING_BOUNDARY, 'matching_boundary');
  assertDeepEqual(subject.workflow_boundary, WORKFLOW_BOUNDARY, 'workflow_boundary');
  assertDeepEqual(subject.approval_validity, APPROVAL_VALIDITY, 'approval_validity');
  assertDeepEqual(subject.authority, NONE_AUTHORITY, 'authority');
  if (subject.approval_statement.includes('<') || subject.approval_statement.includes('AWAITING')) {
    fail('approval_statement contains a placeholder');
  }
  if (!subject.approval_statement.includes('Reviewer ID: clinician:subas')) {
    fail('approval_statement does not bind clinician:subas');
  }
  if (!subject.approval_statement.includes(String(expectedPairCount))) {
    fail('approval_statement does not state the exact pair count');
  }
  if (!subject.approval_statement.includes('expires 180 days')) {
    fail('approval_statement does not state the approval validity');
  }
  if (!subject.approval_statement.includes('current or intended concurrent exposure')) {
    fail('approval_statement does not state the checker workflow boundary');
  }
  assertDeepEqual(subject.invalidation_conditions, INVALIDATION_CONDITIONS, 'invalidation_conditions');
  return subject;
}

export function validateProductionOpenApprovalSubject(subject) {
  return validateSubject(subject);
}

function validateTemplate(template, subject, subjectHash) {
  assertKeys(template, TEMPLATE_KEYS, 'approval-event template');
  assertEqual(template.schema_version, 2, 'template schema_version');
  assertEqual(template.template_only, true, 'template_only');
  assertEqual(template.subject_id, subject.subject_id, 'template subject_id');
  assertEqual(template.approval_subject_jcs_sha256, subjectHash, 'template subject hash');
  assertDeepEqual(template.authority, NONE_AUTHORITY, 'template authority');
  assertKeys(template.event_body_template, EVENT_BODY_KEYS, 'event_body_template');
  assertDeepEqual(template.event_body_template, {
    schema_version: 2,
    event_id: null,
    decision: null,
    reviewer_id: 'clinician:subas',
    reviewed_at_utc: null,
    valid_until_utc: null,
    repository_head: null,
    approval_subject_jcs_sha256: subjectHash,
    approval_statement_sha256: approvalStatementSha256(subject.approval_statement),
    authentication_method: null,
    authenticated_event_id: null,
    supersedes_event_id: null,
  }, 'event_body_template');
}

function readJson(filePath) {
  return parseDraftApprovalJson(fs.readFileSync(filePath, 'utf8'), path.basename(filePath));
}

function assertCatalogueBindings(subjects, packageDir, requireSourceCatalogue) {
  const repositoryRoot = path.resolve(packageDir, '../../..');
  const metadata = readJson(path.join(packageDir, 'product-catalogue-binding-evidence.meta.json'));
  assertKeys(metadata, [
    'schema_version',
    'classification',
    'promotion_authority',
    'source_catalogue',
    'capture',
    'limitations',
  ], 'catalogue evidence metadata');
  assertEqual(metadata.schema_version, 1, 'catalogue evidence schema_version');
  assertEqual(
    metadata.classification,
    'source_binding_evidence_capture',
    'catalogue evidence classification',
  );
  assertEqual(metadata.promotion_authority, 'none', 'catalogue evidence promotion_authority');
  assertKeys(metadata.source_catalogue, [
    'profile',
    'storage_path',
    'artifact_sha256',
    'total_rows',
    'source_namespace',
    'source_identity_key',
  ], 'catalogue evidence source_catalogue');
  assertEqual(metadata.source_catalogue.profile, 'production-open', 'product catalogue profile');
  assertEqual(
    metadata.source_catalogue.storage_path,
    'data/interaction/production-open/product-catalogue/drugs.jsonl',
    'product catalogue storage path',
  );
  assertHex(metadata.source_catalogue.artifact_sha256, 'product catalogue SHA-256');
  if (!Number.isInteger(metadata.source_catalogue.total_rows)
      || metadata.source_catalogue.total_rows < 1) {
    fail('product catalogue total_rows must be a positive integer');
  }
  assertEqual(metadata.source_catalogue.source_namespace, 'github-jr', 'product catalogue source');
  assertEqual(metadata.source_catalogue.source_identity_key, 'source_id', 'product catalogue identity key');
  assertKeys(metadata.capture, [
    'storage_path',
    'artifact_sha256',
    'row_count',
    'method',
    'source_rows',
  ], 'catalogue evidence capture');
  assertEqual(
    metadata.capture.storage_path,
    'docs/interaction-review/2026-08-08-warfarin-six-production-open-signoff/product-catalogue-binding-evidence.jsonl',
    'catalogue evidence capture path',
  );
  assertHex(metadata.capture.artifact_sha256, 'catalogue evidence capture SHA-256');
  assertEqual(
    metadata.capture.method,
    'byte_exact_complete_jsonl_rows_selected_by_source_identity',
    'catalogue evidence capture method',
  );
  if (typeof metadata.limitations !== 'string'
      || !metadata.limitations.includes('mandatory immediately before clinician signature')) {
    fail('catalogue evidence limitations must require source reverification before signature');
  }
  const expectedBinding = {
    profile: metadata.source_catalogue.profile,
    storage_path: metadata.source_catalogue.storage_path,
    artifact_sha256: metadata.source_catalogue.artifact_sha256,
    source_namespace: metadata.source_catalogue.source_namespace,
    source_identity_key: metadata.source_catalogue.source_identity_key,
    evidence_capture_path: metadata.capture.storage_path,
    evidence_capture_sha256: metadata.capture.artifact_sha256,
    source_catalogue_reverification: 'mandatory_before_signature',
  };
  for (const subject of subjects) {
    assertDeepEqual(
      subject.catalogue_binding,
      expectedBinding,
      `${subject.rule.rule_id} catalogue_binding`,
    );
  }

  const expectedByCode = new Map();
  for (const subject of subjects) {
    for (const side of [subject.clinical_scope.object, subject.clinical_scope.perpetrator]) {
      for (const product of side.products) {
        const code = product.source_identity.code;
        const existing = expectedByCode.get(code);
        if (existing) {
          assertDeepEqual(existing, product, `catalogue source identity ${code}`);
        } else {
          expectedByCode.set(code, product);
        }
      }
    }
  }

  if (!Array.isArray(metadata.capture.source_rows)
      || metadata.capture.source_rows.length !== metadata.capture.row_count) {
    fail('catalogue evidence source_rows do not match row_count');
  }
  const capturePath = path.join(repositoryRoot, ...expectedBinding.evidence_capture_path.split('/'));
  const captureBytes = fs.readFileSync(capturePath);
  assertEqual(
    createHash('sha256').update(captureBytes).digest('hex'),
    expectedBinding.evidence_capture_sha256,
    'catalogue evidence capture SHA-256',
  );
  const captureLines = captureBytes.toString('utf8').trimEnd().split(/\r?\n/u);
  assertEqual(captureLines.length, metadata.capture.row_count, 'catalogue evidence capture row count');
  const captureLineByCode = new Map();
  const sourceLineByCode = new Map();
  for (const [index, sourceRow] of metadata.capture.source_rows.entries()) {
    assertKeys(sourceRow, ['source_id', 'line_number'], `catalogue evidence source_rows[${index}]`);
    if (typeof sourceRow.source_id !== 'string' || !/^\d+$/u.test(sourceRow.source_id)) {
      fail(`catalogue evidence source_rows[${index}].source_id must be numeric`);
    }
    if (!Number.isInteger(sourceRow.line_number) || sourceRow.line_number < 1) {
      fail(`catalogue evidence source_rows[${index}].line_number must be a positive integer`);
    }
    if (captureLineByCode.has(sourceRow.source_id)) {
      fail(`catalogue evidence source identity ${sourceRow.source_id} is duplicated`);
    }
    const row = parseDraftApprovalJson(
      captureLines[index],
      `${path.basename(capturePath)}:${index + 1}`,
    );
    const sources = row.sources?.filter(
      (source) => source?.source === 'github-jr' && source?.source_id === sourceRow.source_id,
    ) ?? [];
    if (sources.length !== 1) {
      fail(`catalogue evidence source identity ${sourceRow.source_id} is ambiguous`);
    }
    const expected = expectedByCode.get(sourceRow.source_id);
    if (!expected) fail(`catalogue evidence contains unexpected source identity ${sourceRow.source_id}`);
    assertDeepEqual(
      productAssertionForRow(row),
      expected.product_assertion,
      `catalogue source identity ${sourceRow.source_id} product assertion`,
    );
    assertEqual(
      productIdForRow(row),
      expected.product_id,
      `catalogue source identity ${sourceRow.source_id} product_id`,
    );
    assertEqual(
      productAssertionHashForRow(row),
      expected.product_assertion_sha256,
      `catalogue source identity ${sourceRow.source_id} assertion hash`,
    );
    captureLineByCode.set(sourceRow.source_id, captureLines[index]);
    sourceLineByCode.set(sourceRow.source_id, sourceRow.line_number);
  }
  const missingCapture = [...expectedByCode.keys()].filter((code) => !captureLineByCode.has(code));
  if (missingCapture.length > 0) {
    fail(`catalogue evidence source identities are missing: ${missingCapture.join(', ')}`);
  }

  const cataloguePath = path.join(repositoryRoot, ...expectedBinding.storage_path.split('/'));
  if (!requireSourceCatalogue) return false;
  if (!fs.existsSync(cataloguePath)) {
    fail(`source catalogue is required for pre-signature reverification: ${expectedBinding.storage_path}`);
  }
  const file = fs.openSync(cataloguePath, 'r');
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const found = new Set();
  let carry = '';
  let rowCount = 0;
  const inspectLine = (rawLine) => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') return;
    rowCount += 1;
    const matches = [...line.matchAll(/"source"\s*:\s*"github-jr"\s*,\s*"source_id"\s*:\s*"(\d+)"/gu)]
      .map((match) => match[1])
      .filter((code) => expectedByCode.has(code));
    if (matches.length === 0) return;
    const row = parseDraftApprovalJson(line, `${path.basename(cataloguePath)}:${rowCount}`);
    for (const code of new Set(matches)) {
      if (found.has(code)) fail(`catalogue source identity ${code} is claimed by several rows`);
      const sourceMatches = row.sources?.filter(
        (source) => source?.source === 'github-jr' && source?.source_id === code,
      ) ?? [];
      if (sourceMatches.length !== 1) fail(`catalogue source identity ${code} is ambiguous`);
      assertEqual(rowCount, sourceLineByCode.get(code), `catalogue source identity ${code} line number`);
      assertEqual(line, captureLineByCode.get(code), `catalogue source identity ${code} captured bytes`);
      found.add(code);
    }
  };
  try {
    for (;;) {
      const bytesRead = fs.readSync(file, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      const chunk = buffer.subarray(0, bytesRead);
      hash.update(chunk);
      const lines = `${carry}${decoder.decode(chunk, { stream: true })}`.split('\n');
      carry = lines.pop();
      for (const line of lines) inspectLine(line);
    }
    carry += decoder.decode();
    inspectLine(carry);
  } finally {
    fs.closeSync(file);
  }
  assertEqual(hash.digest('hex'), expectedBinding.artifact_sha256, 'product catalogue artifact SHA-256');
  assertEqual(rowCount, metadata.source_catalogue.total_rows, 'product catalogue row count');
  const missing = [...expectedByCode.keys()].filter((code) => !found.has(code));
  if (missing.length > 0) fail(`catalogue source identities are missing: ${missing.join(', ')}`);
  return true;
}

function assertEvidenceBindings(subjects, packageDir) {
  const repositoryRoot = path.resolve(packageDir, '../../..');
  const sectionPath = path.join(
    repositoryRoot,
    'docs',
    'interaction-review',
    'batch-01-v2',
    'sections',
    'A.verified.jsonl',
  );
  const rows = fs.readFileSync(sectionPath, 'utf8').trim().split(/\r?\n/u).map(JSON.parse);
  const byRule = new Map(rows.map((row) => [row.rule_id, row]));
  for (const subject of subjects) {
    const row = byRule.get(subject.rule.rule_id);
    if (!row) fail(`draft evidence row is missing ${subject.rule.rule_id}`);
    const expected = row.evidence.map((evidence) => ({
      source_policy_id: evidence.source_policy_id,
      document_id: evidence.document_id,
      document_version: evidence.document_version,
      payload_sha256: evidence.provenance.payload_sha256,
      jurisdiction: evidence.jurisdiction,
    }));
    assertDeepEqual(subject.evidence_bindings, expected, `${subject.rule.rule_id} evidence_bindings`);
  }
}

function assertHashManifest(packageDir, expectedFiles) {
  const lines = fs.readFileSync(path.join(packageDir, 'HASHES.txt'), 'utf8')
    .trim()
    .split(/\r?\n/u);
  const declared = new Map(lines.map((line) => {
    const match = /^([0-9a-f]{64})[ ]{2}(.+)$/u.exec(line);
    if (!match) fail('HASHES.txt contains an invalid line');
    return [match[2], match[1]];
  }));
  assertDeepEqual([...declared.keys()].sort(), [...expectedFiles].sort(), 'HASHES.txt file list');
  for (const fileName of expectedFiles) {
    const actual = createHash('sha256')
      .update(fs.readFileSync(path.join(packageDir, fileName)))
      .digest('hex');
    assertEqual(declared.get(fileName), actual, `HASHES.txt digest for ${fileName}`);
  }
}

function validateSigningProfile(packageDir) {
  const profile = readJson(path.join(packageDir, 'SIGNING-PROFILE.json'));
  assertKeys(profile, [
    'schema_version',
    'profile_id',
    'profile_status',
    'reviewer_id',
    'algorithm',
    'namespace',
    'public_key',
    'public_key_fingerprint',
    'allowed_signers_file',
    'authority_scope',
  ], 'signing profile');
  assertEqual(profile.schema_version, 1, 'signing profile schema_version');
  assertEqual(profile.profile_id, 'clinician-subas-ssh-ed25519-v1', 'signing profile_id');
  assertEqual(profile.profile_status, 'pinned_for_clinician_signoff', 'signing profile_status');
  assertEqual(profile.reviewer_id, 'clinician:subas', 'signing profile reviewer_id');
  assertEqual(profile.algorithm, 'ssh-ed25519', 'signing profile algorithm');
  assertEqual(profile.namespace, 'aushadhi-approval-event', 'signing profile namespace');
  assertEqual(profile.allowed_signers_file, 'clinician-subas.allowed_signers', 'allowed signers file');
  if (typeof profile.authority_scope !== 'string'
      || !profile.authority_scope.includes('grants no runtime, publication, production, deployment, or clinical-use authority')) {
    fail('signing profile authority_scope is not fail-closed');
  }
  const fields = profile.public_key.trim().split(/\s+/u);
  if (fields.length < 2 || fields[0] !== 'ssh-ed25519') {
    fail('signing profile public_key is not ssh-ed25519');
  }
  const fingerprint = createHash('sha256')
    .update(Buffer.from(fields[1], 'base64'))
    .digest('base64')
    .replace(/=+$/u, '');
  assertEqual(
    profile.public_key_fingerprint,
    `SHA256:${fingerprint}`,
    'signing profile public_key_fingerprint',
  );
  const allowedSigners = fs.readFileSync(
    path.join(packageDir, profile.allowed_signers_file),
    'utf8',
  );
  assertEqual(
    allowedSigners,
    `${profile.reviewer_id} ${profile.public_key}\n`,
    'allowed signers content',
  );
  return profile;
}

export function validateProductionOpenSignoffPackage({
  packageDir,
  productionRulesPath,
  requireSourceCatalogue = false,
}) {
  const status = readJson(path.join(packageDir, 'package-status.json'));
  assertKeys(status, [
    'schema_version',
    'package_status',
    'signing_profile_id',
    'subject_hashes',
    'signed_event_count',
    'authority',
    'required_before_promotion',
  ], 'package-status');
  assertEqual(status.schema_version, 2, 'package-status schema_version');
  assertEqual(status.package_status, 'clinician_signoff_ready', 'package_status');
  const signingProfile = validateSigningProfile(packageDir);
  assertEqual(status.signing_profile_id, signingProfile.profile_id, 'package signing_profile_id');
  assertEqual(status.signed_event_count, 0, 'signed_event_count');
  assertDeepEqual(status.authority, NONE_AUTHORITY, 'package-status authority');
  if (!Array.isArray(status.required_before_promotion)
      || !status.required_before_promotion.includes('obtain authenticated clinician signatures for all six subjects')
      || !status.required_before_promotion.includes('resolve github-jr source rights for publication')) {
    fail('required_before_promotion is incomplete');
  }

  const subjectFiles = fs.readdirSync(packageDir)
    .filter((fileName) => fileName.endsWith('.approval-subject.json'))
    .sort();
  if (subjectFiles.length !== REQUIRED_RULES.size) fail('package must contain exactly six approval subjects');
  const subjects = subjectFiles.map((fileName) => validateSubject(readJson(path.join(packageDir, fileName))));
  const foundRules = [...new Set(subjects.map((subject) => subject.rule.rule_id))].sort();
  assertDeepEqual(foundRules, [...REQUIRED_RULES.keys()].sort(), 'approval subject rule set');
  assertEvidenceBindings(subjects, packageDir);
  assertCatalogueBindings(subjects, packageDir, requireSourceCatalogue);

  const expectedFiles = new Set([
    'README.md',
    'SIGN-OFF-CHECKLIST.md',
    'SIGNING-PROFILE.json',
    'clinician-subas.allowed_signers',
    'package-status.json',
    'product-catalogue-binding-evidence.jsonl',
    'product-catalogue-binding-evidence.meta.json',
  ]);
  const productIds = new Set();
  let pairCount = 0;
  for (const [index, subject] of subjects.entries()) {
    const subjectFile = subjectFiles[index];
    const prefix = subjectFile.slice(0, -'.approval-subject.json'.length);
    const templateFile = `${prefix}.approval-event.template.json`;
    const recordFile = `${prefix}.clinician-approval-record.md`;
    expectedFiles.add(subjectFile);
    expectedFiles.add(templateFile);
    expectedFiles.add(recordFile);
    const subjectHash = approvalSubjectSha256(subject);
    assertEqual(status.subject_hashes[subject.rule.rule_id], subjectHash, `${subject.rule.rule_id} status hash`);
    validateTemplate(readJson(path.join(packageDir, templateFile)), subject, subjectHash);
    const record = fs.readFileSync(path.join(packageDir, recordFile), 'utf8');
    if (record.includes('AWAITING') || record.includes('<TO BE')) {
      fail(`${recordFile} contains an unresolved placeholder`);
    }
    if (!record.includes(`Approval subject JCS SHA-256: \`${subjectHash}\``)) {
      fail(`${recordFile} does not display its canonical subject hash`);
    }
    if (!record.includes(subject.approval_statement)) {
      fail(`${recordFile} does not contain the exact approval statement`);
    }
    for (const side of [subject.clinical_scope.object, subject.clinical_scope.perpetrator]) {
      for (const product of side.products) productIds.add(product.product_id);
    }
    pairCount += subject.product_pairs.length;
  }
  assertDeepEqual(Object.keys(status.subject_hashes).sort(), foundRules, 'package-status subject_hashes');
  assertHashManifest(packageDir, expectedFiles);

  const productionPack = readJson(productionRulesPath);
  if (!Array.isArray(productionPack.rules) || productionPack.rules.length !== 0) {
    fail('data-static/interaction-rules.json must remain empty before signatures');
  }

  return {
    package_status: 'clinician_signoff_ready',
    subject_count: subjects.length,
    exact_product_count: productIds.size,
    exact_product_pair_count: pairCount,
    signed_event_count: 0,
    runtime_authority: 'none',
    publication_authority: 'none',
    production_authority: 'none',
    deployment_authority: 'none',
  };
}

export const productionOpenSignoffBoundary = Object.freeze({
  requiredRuleIds: Object.freeze([...REQUIRED_RULES.keys()]),
  invalidationConditions: Object.freeze([...INVALIDATION_CONDITIONS]),
  approvalValidity: APPROVAL_VALIDITY,
  workflowBoundary: WORKFLOW_BOUNDARY,
  matchingBoundary: MATCHING_BOUNDARY,
  authority: NONE_AUTHORITY,
});
