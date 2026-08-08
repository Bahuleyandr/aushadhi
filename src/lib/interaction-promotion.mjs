import { createHash } from 'node:crypto';

import {
  pairKey,
  technicalHoldsSha256,
  validateRulePack,
  validateTechnicalHoldPack,
} from './interaction-checker.mjs';
import {
  mappingAllowedForProfile,
  validateIngredientMappingManifest,
  validateProductPresentationManifest,
} from './interaction-mapping.mjs';
import {
  validateCombinationIdentityManifest,
} from './interaction-combination-identity.mjs';
import {
  verifiedCombinationManifestSnapshot,
} from './combination-rxnorm-evidence.mjs';
import {
  assertDraftPackAttestation,
  parseDraftPackAttestation,
} from './interaction-draft-attestation.mjs';
import { validateDraftRules } from './interaction-draft-validation.mjs';
import {
  parseInteractionMemberSets,
} from './interaction-member-set-validation.mjs';
import {
  instantiateExpandedDraftRule,
} from './interaction-rule-expansion.mjs';
import { strictPlainDataSnapshot } from './strict-plain-data.mjs';

const SHA256 = /^[0-9a-f]{64}$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ROLES = ['object', 'perpetrator'];
// Governance policy v1.1 (owner-approved 2026-08-07): promotion and hold
// manifests may declare either release profile. Per-mapping, per-source, and
// per-approval profile gates still apply — a production-open manifest compiles
// only over mappings whose allowed_profiles include production-open.
const RELEASE_PROFILES = ['internal-evaluation', 'production-open'];
const COMBINATION_BINDING_KIND = 'combination_identity';
const SUBJECT_SPECIFICITIES = new Set([
  'exact_member',
  'exact_fixed_dose_combination',
]);
const PROMOTABLE_EVIDENCE = new Map([
  ['openfda-labels', new Set([
    'machine_confirmed_openfda_reconciled_pending_clinician',
    'machine_confirmed_openfda_reconciled_clinician_approved_for_internal_product_scope',
  ])],
  ['mhra-govuk-drug-safety-updates', new Set([
    'machine_confirmed_govuk_ogl_bound_pending_clinician',
  ])],
]);
const PROMOTION_HOLD_STATUS = 'held';
const PROMOTION_HOLD_REASON = 'live_provenance_drift';
const REQUIRED_PROMOTION_HOLDS = Object.freeze([
  Object.freeze({
    rule_id: 'warfarin__azithromycin_oral',
    evidence_source_id: 'fda-label-azithromycin',
    status: PROMOTION_HOLD_STATUS,
    reason: PROMOTION_HOLD_REASON,
    detected_at: '2026-08-06',
    approved_source_version:
      'openfda-labels:db52b91e-79f7-4cc1-9564-f2eee8e31c45:48',
    observed_source_version:
      'openfda-labels:db52b91e-79f7-4cc1-9564-f2eee8e31c45:49',
    approved_payload_sha256:
      'c2685e743c2b1fca5c3862fb87a4a452c366876d280ef0f18e31eae9a4e109f1',
    observed_payload_sha256:
      '4cdab603d1ce790a38fee1969df01bca4338b283109b4d742a131d532d34204c',
  }),
  Object.freeze({
    rule_id: 'warfarin__tramadol',
    evidence_source_id: 'mhra-dsu-tramadol-warfarin',
    status: PROMOTION_HOLD_STATUS,
    reason: PROMOTION_HOLD_REASON,
    detected_at: '2026-08-06',
    approved_source_version:
      'mhra-govuk-drug-safety-updates:warfarin-be-alert-to-the-risk-of-drug-interactions-with-tramadol:2024-06-20T11:11:09+01:00',
    observed_source_version:
      'mhra-govuk-drug-safety-updates:warfarin-be-alert-to-the-risk-of-drug-interactions-with-tramadol:2024-06-20T11:11:09+01:00',
    approved_payload_sha256:
      '2f7e923cbd5447e3df760ac9f5c7b55d064f3adb5bf681fe3d1fd24643331f22',
    observed_payload_sha256:
      'b9d638afd2b21893f9222da1767b87e509e88de414aa6fac27e01b1ea5ec2f9f',
  }),
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function requireExactKeys(value, keys, label) {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new TypeError(`${label} contains unknown property ${key}`);
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) throw new TypeError(`${label} is missing property ${key}`);
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function requireIsoDate(value, label) {
  requireString(value, label);
  if (!ISO_DATE.test(value)
      || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${label} must be a valid ISO calendar date`);
  }
  return value;
}

function requireStringArray(value, label, { minItems = 0 } = {}) {
  if (!Array.isArray(value) || value.length < minItems) {
    throw new TypeError(`${label} must contain at least ${minItems} item(s)`);
  }
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const item = requireString(value[index], `${label}[${index}]`);
    if (seen.has(item)) throw new TypeError(`${label} must contain unique values`);
    seen.add(item);
  }
  return value;
}

function requireSortedStringArray(value, label) {
  requireStringArray(value, label);
  const sorted = [...value].sort(compareStrings);
  if (JSON.stringify(value) !== JSON.stringify(sorted)) {
    throw new TypeError(`${label} must use deterministic sorted order`);
  }
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort(compareStrings).map((key) => [
        key,
        canonicalJsonValue(value[key]),
      ]),
    );
  }
  return value;
}

export function promotionHoldManifestSha256(manifest) {
  validatePromotionHoldManifest(manifest);
  return sha256(JSON.stringify(canonicalJsonValue(manifest)));
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

// Exported for the expansion dry-run CLI, which must parse the attested
// draft pack with exactly the compiler's canonical-JSONL discipline.
export function parseDraftPack(packBytes) {
  if (!ArrayBuffer.isView(packBytes) || packBytes.byteLength === 0) {
    throw new TypeError('draft pack bytes must be a non-empty Uint8Array');
  }
  const bytes = Buffer.from(packBytes.buffer, packBytes.byteOffset, packBytes.byteLength);
  if (bytes.includes(13)) throw new TypeError('draft pack must use LF line endings');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new TypeError(`draft pack must be valid UTF-8: ${error.message}`);
  }
  if (!text.endsWith('\n')) throw new TypeError('draft pack must end with LF');
  const lines = text.slice(0, -1).split('\n');
  if (lines.some((line) => line.length === 0)) {
    throw new TypeError('draft pack must not contain blank JSONL lines');
  }
  const rules = lines.map((line, index) => {
    let rule;
    try {
      rule = JSON.parse(line);
    } catch (error) {
      throw new TypeError(`draft pack line ${index + 1} is invalid JSON: ${error.message}`);
    }
    if (JSON.stringify(rule) !== line) {
      throw new TypeError(`draft pack line ${index + 1} is not canonical JSONL`);
    }
    return rule;
  });
  validateDraftRules(rules);
  return { rules, lines };
}

function parseAttestation(attestation) {
  if (typeof attestation === 'string') return parseDraftPackAttestation(attestation);
  return structuredClone(attestation);
}

function validateOutputPack(value) {
  requireObject(value, 'promotion manifest output_pack');
  requireExactKeys(value, [
    'schema_version',
    'pack_id',
    'pack_version',
    'licence',
    'source_ids',
    'licence_notices',
    'declared_coverage',
  ], 'promotion manifest output_pack');
  requireString(value.schema_version, 'promotion manifest output_pack.schema_version');
  requireString(value.pack_id, 'promotion manifest output_pack.pack_id');
  requireString(value.pack_version, 'promotion manifest output_pack.pack_version');
  requireString(value.licence, 'promotion manifest output_pack.licence');
  requireStringArray(value.source_ids, 'promotion manifest output_pack.source_ids', {
    minItems: 1,
  });
  requireObject(value.licence_notices, 'promotion manifest output_pack.licence_notices');
  requireString(value.declared_coverage, 'promotion manifest output_pack.declared_coverage');
}

function validateApproval(value, label, profile, approvedRuleId = null) {
  requireObject(value, label);
  if (profile === 'production-open'
      && value.authorized_profile !== 'production-open') {
    throw new TypeError(
      'production-open approval must explicitly authorize the production-open profile',
    );
  }
  const keys = [
    'status',
    'reviewer_id',
    'reviewed_at',
    'approval_text',
    'source_versions',
  ];
  if (approvedRuleId !== null) keys.push('approved_rule_id');
  if (profile === 'production-open') keys.push('authorized_profile');
  requireExactKeys(value, keys, label);
  if (value.status !== 'clinician_reviewed') {
    throw new TypeError(`${label}.status must be clinician_reviewed`);
  }
  requireString(value.reviewer_id, `${label}.reviewer_id`);
  requireIsoDate(value.reviewed_at, `${label}.reviewed_at`);
  requireString(value.approval_text, `${label}.approval_text`);
  requireStringArray(value.source_versions, `${label}.source_versions`, { minItems: 1 });
  if (approvedRuleId !== null) {
    requireString(value.approved_rule_id, `${label}.approved_rule_id`);
    if (value.approved_rule_id !== approvedRuleId) {
      throw new TypeError(
        `${label}.approved_rule_id must exactly match expanded rule_id ${approvedRuleId}`,
      );
    }
  }
  if (profile === 'production-open') {
    if (/\binternal evaluation only\b|\bkeep production-open disabled\b/iu.test(
      value.approval_text,
    )) {
      throw new TypeError(
        'production-open approval text contradicts its authorized profile',
      );
    }
    if (!/\bproduction-open\b/iu.test(value.approval_text)) {
      throw new TypeError(
        'production-open approval text must explicitly name the production-open profile',
      );
    }
  }
}

function approvalTextNamesExactRuleId(approvalText, ruleId) {
  return (approvalText.match(/[a-z0-9_:-]+/giu) ?? []).includes(ruleId);
}

function validateDraftRole(value, label) {
  if (!ROLES.includes(value)) {
    throw new TypeError(`${label} must be object or perpetrator`);
  }
}

function validateIngredientSide(value, label) {
  requireObject(value, label);
  requireExactKeys(value, [
    'draft_role',
    'ingredient_mapping_id',
    'presentation_mapping_ids',
  ], label);
  validateDraftRole(value.draft_role, `${label}.draft_role`);
  requireString(value.ingredient_mapping_id, `${label}.ingredient_mapping_id`);
  requireStringArray(
    value.presentation_mapping_ids,
    `${label}.presentation_mapping_ids`,
    { minItems: 1 },
  );
}

function validateCombinationSide(value, label) {
  requireObject(value, label);
  requireExactKeys(value, [
    'draft_role',
    'binding_kind',
    'combination_id',
    'presentation_product_ids',
  ], label);
  validateDraftRole(value.draft_role, `${label}.draft_role`);
  if (value.binding_kind !== COMBINATION_BINDING_KIND) {
    throw new TypeError(
      `${label}.binding_kind must be ${COMBINATION_BINDING_KIND}`,
    );
  }
  requireString(value.combination_id, `${label}.combination_id`);
  requireStringArray(
    value.presentation_product_ids,
    `${label}.presentation_product_ids`,
    { minItems: 1 },
  );
}

function validateSide(value, label, schemaVersion) {
  if (schemaVersion === 2 && Object.hasOwn(requireObject(value, label), 'binding_kind')) {
    validateCombinationSide(value, label);
    return;
  }
  validateIngredientSide(value, label);
}

function validateScope(value, label, schemaVersion) {
  requireObject(value, label);
  requireExactKeys(value, [
    'route',
    'formulation',
    'expected_product_pair_count',
    'sides',
  ], label);
  requireString(value.route, `${label}.route`);
  requireString(value.formulation, `${label}.formulation`);
  if (!Number.isSafeInteger(value.expected_product_pair_count)
      || value.expected_product_pair_count < 1) {
    throw new TypeError(`${label}.expected_product_pair_count must be a positive integer`);
  }
  if (!Array.isArray(value.sides) || value.sides.length !== 2) {
    throw new TypeError(`${label}.sides must contain exactly object and perpetrator`);
  }
  for (let index = 0; index < value.sides.length; index += 1) {
    validateSide(value.sides[index], `${label}.sides[${index}]`, schemaVersion);
  }
  if (value.sides.map((side) => side.draft_role).join(',') !== ROLES.join(',')) {
    throw new TypeError(`${label}.sides must use deterministic object, perpetrator order`);
  }
}

// Compile-time class expansion (owner-approved Option B, 2026-08-07): a
// promotion entry may target one exact member instantiation of a class-level
// draft rule. The entry's rule_id is the deterministic expanded id, its
// draft_rule_sha256 binds the PARENT draft rule's canonical JSONL line, and
// the expanded pair is re-validated against the digest-pinned member sets at
// compile time (see src/lib/interaction-rule-expansion.mjs). Every expanded
// rule still needs its own signed approval naming the expanded rule id.
function validateExpansion(value, label, ruleId) {
  requireObject(value, label);
  requireExactKeys(value, [
    'parent_rule_id',
    'object_member',
    'perpetrator_member',
  ], label);
  requireString(value.parent_rule_id, `${label}.parent_rule_id`);
  requireString(value.object_member, `${label}.object_member`);
  requireString(value.perpetrator_member, `${label}.perpetrator_member`);
  if (value.parent_rule_id === ruleId) {
    throw new TypeError(`${label}.parent_rule_id must differ from the expanded rule_id`);
  }
}

function validateSupersession(value, label) {
  requireObject(value, label);
  requireExactKeys(value, [
    'interaction_family_id',
    'subject_specificity',
    'supersedes_rule_ids',
  ], label);
  requireString(value.interaction_family_id, `${label}.interaction_family_id`);
  if (!SUBJECT_SPECIFICITIES.has(value.subject_specificity)) {
    throw new TypeError(
      `${label}.subject_specificity must be exact_member `
        + 'or exact_fixed_dose_combination',
    );
  }
  requireSortedStringArray(
    value.supersedes_rule_ids,
    `${label}.supersedes_rule_ids`,
  );
}

function validatePromotion(value, index, schemaVersion, profile) {
  const label = `promotion manifest promotions[${index}]`;
  requireObject(value, label);
  const keys = [
    'rule_id',
    'draft_rule_sha256',
    'approval',
    'scope',
  ];
  const hasSupersession = (
    schemaVersion === 2 && Object.hasOwn(value, 'supersession')
  );
  if (hasSupersession) keys.push('supersession');
  const hasExpansion = (
    schemaVersion === 2 && Object.hasOwn(value, 'expansion')
  );
  if (hasExpansion) keys.push('expansion');
  requireExactKeys(value, keys, label);
  requireString(value.rule_id, `${label}.rule_id`);
  if (!SHA256.test(value.draft_rule_sha256 ?? '')) {
    throw new TypeError(`${label}.draft_rule_sha256 must be a lowercase SHA-256`);
  }
  validateApproval(
    value.approval,
    `${label}.approval`,
    profile,
    hasExpansion ? value.rule_id : null,
  );
  validateScope(value.scope, `${label}.scope`, schemaVersion);
  const combinationSides = value.scope.sides.filter(
    (side) => side.binding_kind === COMBINATION_BINDING_KIND,
  );
  if (combinationSides.length > 1) {
    throw new TypeError(`${label}.scope supports at most one combination-bound side`);
  }
  if (hasExpansion) {
    validateExpansion(value.expansion, `${label}.expansion`, value.rule_id);
    if (hasSupersession) {
      throw new TypeError(`${label} expansion cannot carry supersession metadata`);
    }
    if (combinationSides.length > 0) {
      throw new TypeError(
        `${label} expansion supports only exact ingredient-bound sides`,
      );
    }
    if (!approvalTextNamesExactRuleId(value.approval.approval_text, value.rule_id)) {
      throw new TypeError(
        `${label} expansion approval text must reference the expanded rule id `
          + value.rule_id,
      );
    }
  }
  if (combinationSides.length === 1 && !hasSupersession) {
    throw new TypeError(`${label} combination-bound promotion requires supersession metadata`);
  }
  if (hasSupersession) {
    validateSupersession(value.supersession, `${label}.supersession`);
    const expectedSpecificity = combinationSides.length === 1
      ? 'exact_fixed_dose_combination'
      : 'exact_member';
    if (value.supersession.subject_specificity !== expectedSpecificity) {
      throw new TypeError(
        `${label}.supersession.subject_specificity must be ${expectedSpecificity} `
          + 'for its bound subject type',
      );
    }
  }
}

export function validatePromotionManifest(manifest) {
  requireObject(manifest, 'promotion manifest');
  manifest = strictPlainDataSnapshot(manifest, 'promotion manifest');
  requireExactKeys(manifest, [
    'schema_version',
    'profile',
    'output_pack',
    'promotions',
  ], 'promotion manifest');
  if (manifest.schema_version !== 1 && manifest.schema_version !== 2) {
    throw new TypeError('promotion manifest schema_version must equal 1 or 2');
  }
  if (!RELEASE_PROFILES.includes(manifest.profile)) {
    throw new TypeError(
      'promotion manifest profile must be internal-evaluation or production-open',
    );
  }
  validateOutputPack(manifest.output_pack);
  if (!Array.isArray(manifest.promotions) || manifest.promotions.length === 0) {
    throw new TypeError('promotion manifest promotions must be non-empty');
  }
  const ruleIds = new Set();
  for (let index = 0; index < manifest.promotions.length; index += 1) {
    const promotion = manifest.promotions[index];
    validatePromotion(promotion, index, manifest.schema_version, manifest.profile);
    if (ruleIds.has(promotion.rule_id)) {
      throw new TypeError(`promotion manifest contains duplicate rule_id ${promotion.rule_id}`);
    }
    ruleIds.add(promotion.rule_id);
  }
  if (manifest.promotions.some((promotion) => Object.hasOwn(promotion, 'supersession'))
      && manifest.output_pack.schema_version !== '1.1.0') {
    throw new TypeError(
      'promotion manifest output_pack.schema_version must be 1.1.0 '
        + 'when supersession metadata is present',
    );
  }
  return true;
}

function validatePromotionHold(value, index) {
  const label = `promotion hold manifest holds[${index}]`;
  requireObject(value, label);
  requireExactKeys(value, [
    'rule_id',
    'evidence_source_id',
    'status',
    'reason',
    'detected_at',
    'approved_source_version',
    'observed_source_version',
    'approved_payload_sha256',
    'observed_payload_sha256',
  ], label);
  requireString(value.rule_id, `${label}.rule_id`);
  requireString(value.evidence_source_id, `${label}.evidence_source_id`);
  if (value.status !== PROMOTION_HOLD_STATUS) {
    throw new TypeError(`${label}.status must equal ${PROMOTION_HOLD_STATUS}`);
  }
  if (value.reason !== PROMOTION_HOLD_REASON) {
    throw new TypeError(`${label}.reason must equal ${PROMOTION_HOLD_REASON}`);
  }
  requireIsoDate(value.detected_at, `${label}.detected_at`);
  requireString(value.approved_source_version, `${label}.approved_source_version`);
  requireString(value.observed_source_version, `${label}.observed_source_version`);
  for (const field of ['approved_payload_sha256', 'observed_payload_sha256']) {
    if (!SHA256.test(value[field] ?? '')) {
      throw new TypeError(`${label}.${field} must be a lowercase SHA-256`);
    }
  }
  if (value.approved_source_version === value.observed_source_version
      && value.approved_payload_sha256 === value.observed_payload_sha256) {
    throw new TypeError(`${label} does not record source-version or payload drift`);
  }
}

export function validatePromotionHoldManifest(manifest) {
  requireObject(manifest, 'promotion hold manifest');
  manifest = strictPlainDataSnapshot(manifest, 'promotion hold manifest');
  requireExactKeys(manifest, [
    'schema_version',
    'pack_id',
    'profile',
    'draft_pack_sha256',
    'evidence_digest_sha256',
    'source_policy_sha256',
    'runtime_hold_scope_sha256',
    'holds',
  ], 'promotion hold manifest');
  if (manifest.schema_version !== 3) {
    throw new TypeError('promotion hold manifest schema_version must equal 3');
  }
  requireString(manifest.pack_id, 'promotion hold manifest pack_id');
  if (!RELEASE_PROFILES.includes(manifest.profile)) {
    throw new TypeError(
      'promotion hold manifest profile must be internal-evaluation or production-open',
    );
  }
  for (const field of [
    'draft_pack_sha256',
    'evidence_digest_sha256',
    'source_policy_sha256',
    'runtime_hold_scope_sha256',
  ]) {
    if (!SHA256.test(manifest[field] ?? '')) {
      throw new TypeError(`promotion hold manifest ${field} must be a lowercase SHA-256`);
    }
  }
  if (!Array.isArray(manifest.holds)) {
    throw new TypeError('promotion hold manifest holds must be an array');
  }
  const ruleIds = [];
  for (let index = 0; index < manifest.holds.length; index += 1) {
    const hold = manifest.holds[index];
    validatePromotionHold(hold, index);
    if (ruleIds.includes(hold.rule_id)) {
      throw new TypeError(
        `promotion hold manifest contains duplicate rule_id ${hold.rule_id}`,
      );
    }
    ruleIds.push(hold.rule_id);
  }
  const sortedRuleIds = [...ruleIds].sort(compareStrings);
  if (JSON.stringify(ruleIds) !== JSON.stringify(sortedRuleIds)) {
    throw new TypeError('promotion hold manifest holds must be sorted by rule_id');
  }
  return true;
}

function requireDraftBoundary(rule) {
  if (rule.runtime_enabled !== false
      || rule.runtime_status?.runtime_enabled !== false
      || rule.runtime_status?.promotion_eligible !== false) {
    throw new TypeError(`draft rule ${rule.rule_id} must remain runtime-disabled and ineligible`);
  }
  if (rule.review?.author !== null || rule.review?.approver !== null) {
    throw new TypeError(`draft rule ${rule.rule_id} cannot self-authorize promotion`);
  }
}

function sourceVersionForEvidence(evidence, ruleId) {
    const setId = evidence.provenance?.set_id;
    const version = evidence.provenance?.version;
    if (typeof setId === 'string' && typeof version === 'string') {
      return `${evidence.source_policy_id}:${setId}:${version}`;
    }
    if (typeof evidence.document_id === 'string'
        && typeof evidence.document_version === 'string') {
      return (
        `${evidence.source_policy_id}:${evidence.document_id}:${evidence.document_version}`
      );
    }
    throw new TypeError(
      `${ruleId} evidence ${evidence.source_id} lacks a promotable source version`,
    );
}

function expectedSourceVersions(rule) {
  return rule.evidence.map((evidence) => sourceVersionForEvidence(evidence, rule.rule_id));
}

function evidencePayloadSha256(evidence, ruleId) {
  const hash = evidence.provenance?.payload_sha256
    ?? evidence.provenance?.document_sha256;
  if (!SHA256.test(hash ?? '')) {
    throw new TypeError(
      `${ruleId} evidence ${evidence.source_id} lacks a bound payload SHA-256`,
    );
  }
  return hash;
}

function assertExactArray(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(`${label} does not match the exact draft evidence source versions`);
  }
}

function bindScope({
  promotion,
  rule,
  profile,
  ingredientById,
  presentationById,
  combinationById,
}) {
  const productsByRole = new Map();
  const subjectsByRole = new Map();
  const seenPresentationIds = new Set();

  for (const side of promotion.scope.sides) {
    const draftSubject = rule[side.draft_role];
    if (!isObject(draftSubject) || typeof draftSubject.drug !== 'string') {
      throw new TypeError(
        `${promotion.rule_id} ${side.draft_role} must be an exact draft drug selector`,
      );
    }
    if (JSON.stringify(draftSubject.route) !== JSON.stringify([promotion.scope.route])
        || JSON.stringify(draftSubject.formulation)
          !== JSON.stringify([promotion.scope.formulation])) {
      throw new TypeError(
        `${promotion.rule_id} ${side.draft_role} route/formulation differs from approved scope`,
      );
    }

    const productIds = [];
    if (side.binding_kind === COMBINATION_BINDING_KIND) {
      const combination = combinationById.get(side.combination_id);
      if (!combination) {
        throw new TypeError(
          `${promotion.rule_id} is missing reviewed combination identity ${side.combination_id}`,
        );
      }
      if (combination.identity_kind !== 'fixed_dose_combination'
          || combination.review.status !== 'reviewed') {
        throw new TypeError(
          `${side.combination_id} must be an exact reviewed fixed-dose combination identity`,
        );
      }
      if (!combination.allowed_profiles.includes(profile)) {
        throw new TypeError(`${side.combination_id} is not allowed for profile ${profile}`);
      }
      if (combination.runtime_drug !== draftSubject.drug) {
        throw new TypeError(
          `${side.combination_id} does not match ${promotion.rule_id} ${side.draft_role}`,
        );
      }

      const reviewedPresentations = new Map(
        combination.presentations.map((presentation) => [
          presentation.product_id,
          presentation,
        ]),
      );
      for (const productId of side.presentation_product_ids) {
        const presentation = reviewedPresentations.get(productId);
        if (!presentation) {
          throw new TypeError(
            `${promotion.rule_id} is missing reviewed combination presentation ${productId}`,
          );
        }
        if (presentation.route !== promotion.scope.route
            || presentation.formulation !== promotion.scope.formulation) {
          throw new TypeError(`${productId} differs from the approved presentation scope`);
        }
        productIds.push(productId);
      }
      subjectsByRole.set(side.draft_role, combination.combination_id);
    } else {
      const ingredientMapping = ingredientById.get(side.ingredient_mapping_id);
      if (!ingredientMapping) {
        throw new TypeError(
          `${promotion.rule_id} is missing ingredient mapping ${side.ingredient_mapping_id}`,
        );
      }
      if (ingredientMapping.review.status !== 'reviewed') {
        throw new TypeError(`${side.ingredient_mapping_id} is not reviewed`);
      }
      if (ingredientMapping.identity.relationship !== 'exact') {
        throw new TypeError(`${side.ingredient_mapping_id} must be an exact identity mapping`);
      }
      if (ingredientMapping.identity.runtime_drug !== draftSubject.drug
          || ingredientMapping.identity.canonical_name !== draftSubject.drug) {
        throw new TypeError(
          `${side.ingredient_mapping_id} does not match ${promotion.rule_id} ${side.draft_role}`,
        );
      }
      subjectsByRole.set(
        side.draft_role,
        ingredientMapping.identity.clinical_ingredient_id,
      );

      for (const presentationId of side.presentation_mapping_ids) {
        if (seenPresentationIds.has(presentationId)) {
          throw new TypeError(`${promotion.rule_id} reuses presentation mapping ${presentationId}`);
        }
        seenPresentationIds.add(presentationId);
        const presentation = presentationById.get(presentationId);
        if (!presentation) {
          throw new TypeError(
            `${promotion.rule_id} is missing presentation mapping ${presentationId}`,
          );
        }
        if (presentation.review.status !== 'reviewed') {
          throw new TypeError(`${presentationId} is not reviewed`);
        }
        if (!mappingAllowedForProfile(presentation, profile)) {
          throw new TypeError(`${presentationId} is not allowed for profile ${profile}`);
        }
        if (presentation.presentation.route !== promotion.scope.route
            || presentation.presentation.formulation !== promotion.scope.formulation) {
          throw new TypeError(`${presentationId} differs from the approved presentation scope`);
        }
        productIds.push(presentation.product_id);
      }
    }
    productsByRole.set(side.draft_role, productIds);
  }

  if (JSON.stringify(rule.applicability.routes) !== JSON.stringify([promotion.scope.route])
      || JSON.stringify(rule.applicability.formulations)
        !== JSON.stringify([promotion.scope.formulation])) {
    throw new TypeError(`${promotion.rule_id} applicability differs from approved scope`);
  }

  const productPairs = [];
  for (const objectProduct of productsByRole.get('object')) {
    for (const perpetratorProduct of productsByRole.get('perpetrator')) {
      productPairs.push([objectProduct, perpetratorProduct].sort(compareStrings));
    }
  }
  productPairs.sort((left, right) => compareStrings(JSON.stringify(left), JSON.stringify(right)));
  if (productPairs.length !== promotion.scope.expected_product_pair_count) {
    throw new TypeError(
      `${promotion.rule_id} expected ${promotion.scope.expected_product_pair_count} `
        + `product pairs but derived ${productPairs.length}`,
    );
  }
  const subjectRoles = {
    object: subjectsByRole.get('object'),
    perpetrator: subjectsByRole.get('perpetrator'),
  };
  return {
    pair: Object.values(subjectRoles).sort(compareStrings),
    productPairs,
    subjectRoles,
  };
}

function runtimeManagement(management, approval) {
  const text = [
    management.prescriber_action,
    management.monitoring,
    management.duration,
    management.patient_counselling,
    management.timing,
    management.exceptions,
  ].filter((value) => typeof value === 'string' && value.trim() !== '').join(' ');
  if (approval.status !== 'clinician_reviewed') return text;
  return text.replace(
    /\blocal mapping pending clinician approval\b/giu,
    'clinician-approved local mapping for internal evaluation',
  );
}

function runtimeEvidence(evidence) {
  let source;
  if (evidence.source_policy_id === 'openfda-labels') {
    source = `openFDA drug label: ${evidence.product}`;
  } else if (evidence.source_policy_id === 'mhra-govuk-drug-safety-updates') {
    source = `MHRA Drug Safety Update: ${evidence.product}`;
  } else {
    throw new TypeError(`unsupported promoted evidence source ${evidence.source_policy_id}`);
  }
  return {
    source,
    source_url: evidence.source_url,
    document_id: evidence.document_id,
    document_version: evidence.document_version,
    retrieved_at: evidence.retrieved_at,
    jurisdiction: evidence.jurisdiction,
    excerpt: evidence.normalized_proposition,
    licence: evidence.licence,
    review_status: 'clinician_reviewed',
  };
}

export function compileInteractionRuntimeArtifacts({
  promotionManifest,
  promotionHoldManifest,
  sourcePolicyBytes,
  draftPackBytes,
  attestation,
  memberSetsBytes,
  ingredientManifest,
  presentationManifest,
  combinationManifest,
  combinationEvidenceReport,
}) {
  promotionManifest = strictPlainDataSnapshot(
    promotionManifest,
    'promotion manifest',
  );
  requireObject(promotionHoldManifest, 'promotion hold manifest');
  promotionHoldManifest = strictPlainDataSnapshot(
    promotionHoldManifest,
    'promotion hold manifest',
  );
  ingredientManifest = strictPlainDataSnapshot(
    ingredientManifest,
    'ingredient mapping manifest',
  );
  presentationManifest = strictPlainDataSnapshot(
    presentationManifest,
    'product presentation manifest',
  );
  validatePromotionManifest(promotionManifest);
  validatePromotionHoldManifest(promotionHoldManifest);
  if (promotionHoldManifest.pack_id !== promotionManifest.output_pack.pack_id) {
    throw new TypeError('promotion hold manifest pack_id must match the output pack');
  }
  if (promotionHoldManifest.profile !== promotionManifest.profile) {
    throw new TypeError('promotion hold manifest profile must match the promotion manifest');
  }
  if (!ArrayBuffer.isView(sourcePolicyBytes) || sourcePolicyBytes.byteLength === 0) {
    throw new TypeError('source policy bytes must be a non-empty Uint8Array');
  }
  const policyBytes = Buffer.from(
    sourcePolicyBytes.buffer,
    sourcePolicyBytes.byteOffset,
    sourcePolicyBytes.byteLength,
  );
  if (sha256(policyBytes) !== promotionHoldManifest.source_policy_sha256) {
    throw new TypeError('promotion hold manifest source policy SHA-256 does not match');
  }
  validateIngredientMappingManifest(ingredientManifest);
  validateProductPresentationManifest(presentationManifest);
  const hasCombinationSide = promotionManifest.promotions.some((promotion) => (
    promotion.scope.sides.some(
      (side) => side.binding_kind === COMBINATION_BINDING_KIND,
    )
  ));
  let combinationById = new Map();
  if (hasCombinationSide) {
    combinationManifest = verifiedCombinationManifestSnapshot(
      combinationEvidenceReport,
      combinationManifest,
    );
    validateCombinationIdentityManifest(combinationManifest);
    combinationById = new Map(
      combinationManifest.combinations.map((combination) => [
        combination.combination_id,
        combination,
      ]),
    );
  }
  const parsed = parseDraftPack(draftPackBytes);
  const parsedAttestation = parseAttestation(attestation);
  assertDraftPackAttestation(
    parsedAttestation,
    {
      packBytes: draftPackBytes,
      memberSetsBytes,
      rules: parsed.rules,
    },
  );

  const rulesById = new Map(parsed.rules.map((rule, index) => [
    rule.rule_id,
    { rule, line: parsed.lines[index] },
  ]));
  const promotionsById = new Map(
    promotionManifest.promotions.map((promotion) => [promotion.rule_id, promotion]),
  );
  // Class-expansion promotions re-validate their member pair against the
  // member sets whose digest the draft-pack attestation pins
  // (assertDraftPackAttestation above verified member_sets_sha256 against
  // these exact bytes). Parsed lazily: legacy exact promotions never touch
  // the member sets.
  const memberSetClasses = promotionManifest.promotions.some(
    (promotion) => Object.hasOwn(promotion, 'expansion'),
  ) ? parseInteractionMemberSets(memberSetsBytes).classes : null;
  if (promotionHoldManifest.draft_pack_sha256 !== parsedAttestation.pack_sha256) {
    throw new TypeError('promotion hold manifest draft pack SHA-256 does not match');
  }
  if (promotionHoldManifest.evidence_digest_sha256
      !== parsedAttestation.evidence_digest_sha256) {
    throw new TypeError('promotion hold manifest evidence digest SHA-256 does not match');
  }
  const heldRuleIds = new Set();
  for (const hold of promotionHoldManifest.holds) {
    const promotion = promotionsById.get(hold.rule_id);
    if (!promotion) {
      throw new TypeError(`promotion hold ${hold.rule_id} does not identify a promotion`);
    }
    const draft = rulesById.get(
      promotion.expansion?.parent_rule_id ?? hold.rule_id,
    );
    const matchingEvidence = draft?.rule.evidence.filter(
      (evidence) => evidence.source_id === hold.evidence_source_id,
    ) ?? [];
    if (matchingEvidence.length !== 1) {
      throw new TypeError(
        `promotion hold ${hold.rule_id}/${hold.evidence_source_id} `
          + 'does not identify exact draft evidence',
      );
    }
    const [evidence] = matchingEvidence;
    const approvedSourceVersion = sourceVersionForEvidence(evidence, hold.rule_id);
    if (hold.approved_source_version !== approvedSourceVersion
        || !promotion.approval.source_versions.includes(approvedSourceVersion)) {
      throw new TypeError(
        `promotion hold ${hold.rule_id} approved source version does not match`,
      );
    }
    if (hold.approved_payload_sha256 !== evidencePayloadSha256(evidence, hold.rule_id)) {
      throw new TypeError(
        `promotion hold ${hold.rule_id} approved payload SHA-256 does not match`,
      );
    }
    heldRuleIds.add(hold.rule_id);
  }
  // A required drift hold covers the DRAFT rule, so an expansion promotion
  // resolves to its parent id here: promoting an expanded member of a held
  // parent without the exact required hold fails closed below.
  const promotedDraftRuleIds = new Set(
    promotionManifest.promotions.map((promotion) => (
      promotion.expansion?.parent_rule_id ?? promotion.rule_id
    )),
  );
  const holdsByRule = new Map(
    promotionHoldManifest.holds.map((hold) => [hold.rule_id, hold]),
  );
  for (const required of REQUIRED_PROMOTION_HOLDS) {
    if (!promotedDraftRuleIds.has(required.rule_id)) continue;
    const actual = holdsByRule.get(required.rule_id);
    if (!actual || Object.keys(required).some((key) => actual[key] !== required[key])) {
      throw new TypeError(
        `required promotion hold is missing or changed: ${required.rule_id}`,
      );
    }
  }
  // A drift hold covers the DRAFT rule, not just one promotion of it. When
  // the held parent is itself promoted exactly, its hold attaches to that
  // exact promotion and satisfies the required-hold check above — but the
  // hold-exclusion filter below keys on the compiled rule_id, so it would
  // never reach an expansion sibling's distinct expanded id. A held draft
  // rule therefore hard-refuses EVERY expansion promotion of it — whether
  // the hold is code-pinned (REQUIRED_PROMOTION_HOLDS) or attaches through
  // the manifest, and independent of whether the parent is also promoted
  // exactly — until the owner resolves the hold.
  const heldDraftRuleIds = new Set(
    REQUIRED_PROMOTION_HOLDS.map((required) => required.rule_id),
  );
  for (const hold of promotionHoldManifest.holds) {
    const held = promotionsById.get(hold.rule_id);
    heldDraftRuleIds.add(held.expansion?.parent_rule_id ?? held.rule_id);
  }
  for (const promotion of promotionManifest.promotions) {
    if (promotion.expansion
        && heldDraftRuleIds.has(promotion.expansion.parent_rule_id)) {
      throw new TypeError(
        `${promotion.rule_id} expands drift-held draft rule `
          + `${promotion.expansion.parent_rule_id}; a held draft rule cannot `
          + 'be promoted through expansion until the hold is resolved',
      );
    }
  }
  const ingredientById = new Map(
    ingredientManifest.mappings.map((mapping) => [mapping.mapping_id, mapping]),
  );
  const presentationById = new Map(
    presentationManifest.mappings.map((mapping) => [mapping.mapping_id, mapping]),
  );

  const compiledRules = promotionManifest.promotions.map((promotion) => {
    const { expansion } = promotion;
    const draftRuleId = expansion?.parent_rule_id ?? promotion.rule_id;
    const draft = rulesById.get(draftRuleId);
    if (!draft) throw new TypeError(`draft rule ${draftRuleId} does not exist`);
    if (expansion && rulesById.has(promotion.rule_id)) {
      throw new TypeError(
        `${promotion.rule_id} expansion must not shadow a draft rule with the same rule_id`,
      );
    }
    if (sha256(draft.line) !== promotion.draft_rule_sha256) {
      throw new TypeError(`${promotion.rule_id} draft rule SHA-256 does not match`);
    }
    requireDraftBoundary(draft.rule);
    const sourceVersions = expectedSourceVersions(draft.rule);
    assertExactArray(
      promotion.approval.source_versions,
      sourceVersions,
      `${promotion.rule_id} approval.source_versions`,
    );
    if (draft.rule.evidence.some((evidence) => {
      const statuses = PROMOTABLE_EVIDENCE.get(evidence.source_policy_id);
      return (
        evidence.review_status !== 'review_candidate'
        || !statuses?.has(evidence.citation_status)
      );
    })) {
      throw new TypeError(
        `${promotion.rule_id} evidence is not eligible for clinician-gated internal promotion`,
      );
    }
    // An expansion promotion compiles an exact member instantiation of its
    // class-level parent: the instantiation re-runs every expansion refusal
    // gate (pinned member sets, evidence naming, reviewed route scope) and
    // yields an exact-selector rule pinned to the approved scope, which then
    // flows through the unchanged exact-rule binding below.
    const rule = expansion
      ? instantiateExpandedDraftRule({
        parentRule: draft.rule,
        memberSetClasses,
        objectMember: expansion.object_member,
        perpetratorMember: expansion.perpetrator_member,
        route: promotion.scope.route,
        formulation: promotion.scope.formulation,
        expectedRuleId: promotion.rule_id,
      })
      : draft.rule;
    const scope = bindScope({
      promotion,
      rule,
      profile: promotionManifest.profile,
      ingredientById,
      presentationById,
      combinationById,
    });
    pairKey(scope.pair);
    return {
      rule_id: promotion.rule_id,
      pair: scope.pair,
      product_pairs: scope.productPairs,
      ...(promotion.supersession ? {
        interaction_family_id: promotion.supersession.interaction_family_id,
        subject_specificity: promotion.supersession.subject_specificity,
        subject_roles: scope.subjectRoles,
        supersedes_rule_ids: structuredClone(
          promotion.supersession.supersedes_rule_ids,
        ),
      } : {}),
      applicability: {
        routes: [
          `${promotion.scope.route} ${promotion.scope.formulation} `
            + 'for both exact reviewed product assertions',
        ],
        dose_conditions: [],
        population_conditions: [],
      },
      severity: rule.severity,
      dispense_action: rule.management.dispense_action,
      mechanism: rule.mechanism,
      management: runtimeManagement(rule.management, promotion.approval),
      evidence: rule.evidence.map(runtimeEvidence),
      review: {
        status: promotion.approval.status,
        reviewer_id: promotion.approval.reviewer_id,
        reviewed_at: promotion.approval.reviewed_at,
        source_versions: promotion.approval.source_versions,
      },
    };
  });
  const rules = compiledRules
    .filter((rule) => !heldRuleIds.has(rule.rule_id))
    .sort((left, right) => compareStrings(left.rule_id, right.rule_id));

  const rulePack = {
    ...structuredClone(promotionManifest.output_pack),
    profile: promotionManifest.profile,
    rules,
  };
  validateRulePack(rulePack);
  const compiledById = new Map(compiledRules.map((rule) => [rule.rule_id, rule]));
  const technicalHolds = promotionHoldManifest.holds.map((hold) => {
    const rule = compiledById.get(hold.rule_id);
    return {
      rule_id: hold.rule_id,
      pair: structuredClone(rule.pair),
      product_pairs: structuredClone(rule.product_pairs),
      evidence_source_id: hold.evidence_source_id,
      status: hold.status,
      reason: hold.reason,
      detected_at: hold.detected_at,
      approved_source_version: hold.approved_source_version,
      observed_source_version: hold.observed_source_version,
      approved_payload_sha256: hold.approved_payload_sha256,
      observed_payload_sha256: hold.observed_payload_sha256,
    };
  });
  const runtimeHoldScopeSha256 = technicalHoldsSha256(technicalHolds);
  if (promotionHoldManifest.runtime_hold_scope_sha256 !== runtimeHoldScopeSha256) {
    throw new TypeError('promotion hold manifest runtime hold scope SHA-256 does not match');
  }
  const technicalHoldPack = {
    schema_version: 2,
    profile: promotionManifest.profile,
    rule_pack_id: rulePack.pack_id,
    rule_pack_version: rulePack.pack_version,
    rule_pack_sha256: sha256(`${JSON.stringify(rulePack, null, 2)}\n`),
    promotion_hold_manifest_sha256: promotionHoldManifestSha256(
      promotionHoldManifest,
    ),
    holds_sha256: runtimeHoldScopeSha256,
    holds: technicalHolds,
  };
  validateTechnicalHoldPack(technicalHoldPack, {
    rulePack,
    promotionHoldManifestSha256: promotionHoldManifestSha256(
      promotionHoldManifest,
    ),
    runtimeHoldScopeSha256: promotionHoldManifest.runtime_hold_scope_sha256,
  });
  return { rulePack, technicalHoldPack };
}

export function compileInteractionRuntimePack(inputs) {
  return compileInteractionRuntimeArtifacts(inputs).rulePack;
}

export function serializeInteractionRuntimePack(rulePack) {
  rulePack = strictPlainDataSnapshot(rulePack, 'rule pack');
  validateRulePack(rulePack);
  return `${JSON.stringify(rulePack, null, 2)}\n`;
}

export function serializeInteractionTechnicalHoldPack(technicalHoldPack) {
  technicalHoldPack = strictPlainDataSnapshot(
    technicalHoldPack,
    'technical hold pack',
  );
  validateTechnicalHoldPack(technicalHoldPack);
  return `${JSON.stringify(technicalHoldPack, null, 2)}\n`;
}
