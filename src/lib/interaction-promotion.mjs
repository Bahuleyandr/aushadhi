import { createHash } from 'node:crypto';

import {
  pairKey,
  validateRulePack,
} from './interaction-checker.mjs';
import {
  mappingAllowedForProfile,
  validateIngredientMappingManifest,
  validateProductPresentationManifest,
} from './interaction-mapping.mjs';
import {
  assertDraftPackAttestation,
  parseDraftPackAttestation,
} from './interaction-draft-attestation.mjs';
import { validateDraftRules } from './interaction-draft-validation.mjs';

const SHA256 = /^[0-9a-f]{64}$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ROLES = ['object', 'perpetrator'];
const PROMOTABLE_OPENFDA_CITATION_STATUSES = new Set([
  'machine_confirmed_openfda_reconciled_pending_clinician',
  'machine_confirmed_openfda_reconciled_clinician_approved_for_internal_product_scope',
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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseDraftPack(packBytes) {
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

function validateApproval(value, label) {
  requireObject(value, label);
  requireExactKeys(value, [
    'status',
    'reviewer_id',
    'reviewed_at',
    'approval_text',
    'source_versions',
  ], label);
  if (value.status !== 'clinician_reviewed') {
    throw new TypeError(`${label}.status must be clinician_reviewed`);
  }
  requireString(value.reviewer_id, `${label}.reviewer_id`);
  requireIsoDate(value.reviewed_at, `${label}.reviewed_at`);
  requireString(value.approval_text, `${label}.approval_text`);
  requireStringArray(value.source_versions, `${label}.source_versions`, { minItems: 1 });
}

function validateSide(value, label) {
  requireObject(value, label);
  requireExactKeys(value, [
    'draft_role',
    'ingredient_mapping_id',
    'presentation_mapping_ids',
  ], label);
  if (!ROLES.includes(value.draft_role)) {
    throw new TypeError(`${label}.draft_role must be object or perpetrator`);
  }
  requireString(value.ingredient_mapping_id, `${label}.ingredient_mapping_id`);
  requireStringArray(
    value.presentation_mapping_ids,
    `${label}.presentation_mapping_ids`,
    { minItems: 1 },
  );
}

function validateScope(value, label) {
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
    validateSide(value.sides[index], `${label}.sides[${index}]`);
  }
  if (value.sides.map((side) => side.draft_role).join(',') !== ROLES.join(',')) {
    throw new TypeError(`${label}.sides must use deterministic object, perpetrator order`);
  }
}

function validatePromotion(value, index) {
  const label = `promotion manifest promotions[${index}]`;
  requireObject(value, label);
  requireExactKeys(value, [
    'rule_id',
    'draft_rule_sha256',
    'approval',
    'scope',
  ], label);
  requireString(value.rule_id, `${label}.rule_id`);
  if (!SHA256.test(value.draft_rule_sha256 ?? '')) {
    throw new TypeError(`${label}.draft_rule_sha256 must be a lowercase SHA-256`);
  }
  validateApproval(value.approval, `${label}.approval`);
  validateScope(value.scope, `${label}.scope`);
}

export function validatePromotionManifest(manifest) {
  requireObject(manifest, 'promotion manifest');
  requireExactKeys(manifest, [
    'schema_version',
    'profile',
    'output_pack',
    'promotions',
  ], 'promotion manifest');
  if (manifest.schema_version !== 1) {
    throw new TypeError('promotion manifest schema_version must equal 1');
  }
  if (manifest.profile !== 'internal-evaluation') {
    throw new TypeError('promotion manifest profile must be internal-evaluation');
  }
  validateOutputPack(manifest.output_pack);
  if (!Array.isArray(manifest.promotions) || manifest.promotions.length === 0) {
    throw new TypeError('promotion manifest promotions must be non-empty');
  }
  const ruleIds = new Set();
  for (let index = 0; index < manifest.promotions.length; index += 1) {
    const promotion = manifest.promotions[index];
    validatePromotion(promotion, index);
    if (ruleIds.has(promotion.rule_id)) {
      throw new TypeError(`promotion manifest contains duplicate rule_id ${promotion.rule_id}`);
    }
    ruleIds.add(promotion.rule_id);
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

function expectedSourceVersions(rule) {
  return rule.evidence.map((evidence) => (
    `${evidence.source_policy_id}:${evidence.provenance.set_id}:${evidence.provenance.version}`
  ));
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
}) {
  const productsByRole = new Map();
  const ingredients = [];
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
    ingredients.push(ingredientMapping.identity.clinical_ingredient_id);

    const productIds = [];
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
  return {
    pair: ingredients.sort(compareStrings),
    productPairs,
  };
}

function runtimeManagement(management) {
  return [
    management.prescriber_action,
    management.monitoring,
    management.duration,
    management.patient_counselling,
    management.timing,
    management.exceptions,
  ].filter((value) => typeof value === 'string' && value.trim() !== '').join(' ');
}

function runtimeEvidence(evidence) {
  return {
    source: `openFDA drug label: ${evidence.product}`,
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

export function compileInteractionRuntimePack({
  promotionManifest,
  draftPackBytes,
  attestation,
  memberSetsBytes,
  ingredientManifest,
  presentationManifest,
}) {
  validatePromotionManifest(promotionManifest);
  validateIngredientMappingManifest(ingredientManifest);
  validateProductPresentationManifest(presentationManifest);
  const parsed = parseDraftPack(draftPackBytes);
  assertDraftPackAttestation(
    parseAttestation(attestation),
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
  const ingredientById = new Map(
    ingredientManifest.mappings.map((mapping) => [mapping.mapping_id, mapping]),
  );
  const presentationById = new Map(
    presentationManifest.mappings.map((mapping) => [mapping.mapping_id, mapping]),
  );

  const rules = promotionManifest.promotions.map((promotion) => {
    const draft = rulesById.get(promotion.rule_id);
    if (!draft) throw new TypeError(`draft rule ${promotion.rule_id} does not exist`);
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
    if (draft.rule.evidence.some((evidence) => (
      evidence.review_status !== 'review_candidate'
      || !PROMOTABLE_OPENFDA_CITATION_STATUSES.has(evidence.citation_status)
    ))) {
      throw new TypeError(
        `${promotion.rule_id} evidence is not eligible for clinician-gated internal promotion`,
      );
    }
    const scope = bindScope({
      promotion,
      rule: draft.rule,
      profile: promotionManifest.profile,
      ingredientById,
      presentationById,
    });
    pairKey(scope.pair);
    return {
      rule_id: promotion.rule_id,
      pair: scope.pair,
      product_pairs: scope.productPairs,
      applicability: {
        routes: [
          `${promotion.scope.route} ${promotion.scope.formulation} `
            + 'for both exact reviewed product assertions',
        ],
        dose_conditions: [],
        population_conditions: [],
      },
      severity: draft.rule.severity,
      dispense_action: draft.rule.management.dispense_action,
      mechanism: draft.rule.mechanism,
      management: runtimeManagement(draft.rule.management),
      evidence: draft.rule.evidence.map(runtimeEvidence),
      review: {
        status: promotion.approval.status,
        reviewer_id: promotion.approval.reviewer_id,
        reviewed_at: promotion.approval.reviewed_at,
        source_versions: promotion.approval.source_versions,
      },
    };
  }).sort((left, right) => compareStrings(left.rule_id, right.rule_id));

  const rulePack = {
    ...structuredClone(promotionManifest.output_pack),
    profile: promotionManifest.profile,
    rules,
  };
  validateRulePack(rulePack);
  return rulePack;
}

export function serializeInteractionRuntimePack(rulePack) {
  validateRulePack(rulePack);
  return `${JSON.stringify(rulePack, null, 2)}\n`;
}
