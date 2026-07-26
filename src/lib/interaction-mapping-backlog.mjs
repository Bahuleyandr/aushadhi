import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  INGREDIENT_IDENTITY_NAMESPACE,
  canonicalIngredientKey,
  normalizeObservedIngredientName,
} from './ingredient-identity.mjs';
import { readStrictJsonl } from './ingredient-index.mjs';
import { validateDraftRules } from './interaction-draft-validation.mjs';
import {
  createIngredientMappingCandidate,
  createProductPresentationCandidate,
} from './interaction-mapping.mjs';
import {
  PRODUCT_ASSERTION_NAMESPACE,
  PRODUCT_ID_NAMESPACE,
} from './product-resolver.mjs';
import {
  assertArtifactProvenance,
  loadSourceManifest,
} from './interaction-source-policy.mjs';

export const INTERACTION_MAPPING_BACKLOG_SCHEMA_VERSION = 1;
export const RULE_MAPPING_REQUIREMENT_NAMESPACE =
  'aushadhi:interaction-rule-mapping-requirement:v1';

const RUNTIME_STATUS_KEYS = [
  'pair_matcher_executable',
  'clinical_context_complete',
  'runtime_enabled',
  'promotion_eligible',
];

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sortedUnique(values) {
  return [...new Set(values)].sort(compareCodePoint);
}

function sortedCountObject(counts) {
  return Object.fromEntries(
    [...counts.entries()]
      .filter(([, count]) => count > 0)
      .sort(([left], [right]) => compareCodePoint(left, right)),
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareCodePoint)
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function requirementId(requirement) {
  return `sha256:${createHash('sha256')
    .update(RULE_MAPPING_REQUIREMENT_NAMESPACE, 'utf8')
    .update('\0', 'utf8')
    .update(stableJson(requirement), 'utf8')
    .digest('hex')}`;
}

function copyList(value) {
  return Array.isArray(value) ? [...value] : [];
}

function runtimeStatusSnapshot(rule) {
  return Object.fromEntries(
    RUNTIME_STATUS_KEYS.map((key) => [key, rule.runtime_status?.[key] ?? false]),
  );
}

function riskContextSnapshot(rule) {
  return {
    risk_basis: rule.risk_basis ?? null,
    context_modifiers: (rule.context_modifiers ?? []).map((modifier) => ({
      factor: modifier.factor ?? null,
      when: modifier.when ?? null,
      severity: modifier.severity ?? null,
      on_unknown: modifier.on_unknown ?? null,
    })),
  };
}

function applicabilitySnapshot(rule) {
  return {
    routes: copyList(rule.applicability?.routes),
    formulations: copyList(rule.applicability?.formulations),
    renal: rule.applicability?.renal ?? null,
    indication: rule.applicability?.indication ?? null,
    jurisdiction: copyList(rule.applicability?.jurisdiction),
  };
}

function addGap(gaps, rule, role, selectorPath, reason, details = {}) {
  gaps.push({
    rule_id: rule.rule_id,
    section: rule._section ?? null,
    role,
    selector_path: selectorPath,
    reason,
    ...details,
  });
}

function globalClassMembers(ref, memberSets, rule, role, selectorPath, gaps) {
  const classes = memberSets?.classes ?? memberSets ?? {};
  const classSet = classes[ref.class];
  if (!isObject(classSet)) {
    addGap(gaps, rule, role, selectorPath, 'missing_class_member_set', {
      class_name: ref.class,
    });
    return [];
  }

  const requestedBuckets = Array.isArray(ref.strength) && ref.strength.length > 0
    ? ref.strength
    : Object.keys(classSet).sort(compareCodePoint);
  if (requestedBuckets.length === 0) {
    addGap(gaps, rule, role, selectorPath, 'empty_class_member_set', {
      class_name: ref.class,
    });
    return [];
  }

  const members = new Map();
  for (const bucket of requestedBuckets) {
    if (!Array.isArray(classSet[bucket])) {
      addGap(gaps, rule, role, selectorPath, 'missing_class_strength_bucket', {
        class_name: ref.class,
        strength_bucket: bucket,
      });
      continue;
    }
    if (classSet[bucket].length === 0) {
      addGap(gaps, rule, role, selectorPath, 'empty_class_strength_bucket', {
        class_name: ref.class,
        strength_bucket: bucket,
      });
    }
    for (const name of classSet[bucket]) {
      const canonicalName = canonicalIngredientKey(name);
      if (!canonicalName) continue;
      const buckets = members.get(canonicalName) ?? new Set();
      buckets.add(bucket);
      members.set(canonicalName, buckets);
    }
  }
  return [...members.entries()].map(([name, buckets]) => ({
    name,
    strength_buckets: [...buckets].sort(compareCodePoint),
  }));
}

function inlineClassMembers(ref) {
  const excluded = new Set(
    (ref.member_exceptions ?? []).map(canonicalIngredientKey).filter(Boolean),
  );
  const members = new Map();
  for (const name of ref.members ?? []) {
    const canonicalName = canonicalIngredientKey(name);
    if (!canonicalName || excluded.has(canonicalName)) continue;
    members.set(canonicalName, {
      name: canonicalName,
      strength_buckets: copyList(ref.strength).sort(compareCodePoint),
    });
  }
  return [...members.values()].sort((left, right) => compareCodePoint(left.name, right.name));
}

function baseRequirement(rule, {
  role,
  selectorPath,
  selectorKind,
  className = null,
  memberOrigin,
  memberStrengthBuckets = [],
  selector,
}) {
  return {
    rule_id: rule.rule_id,
    section: rule._section ?? null,
    role,
    selector_path: selectorPath,
    selector_kind: selectorKind,
    class_name: className,
    member_origin: memberOrigin,
    selector_members_source: selector.members_source ?? null,
    member_strength_buckets: [...memberStrengthBuckets],
    selector_scope: {
      routes: copyList(selector.route),
      formulations: copyList(selector.formulation),
      strength: selector.strength ?? null,
    },
    applicability: applicabilitySnapshot(rule),
    risk_context: riskContextSnapshot(rule),
    runtime_status: runtimeStatusSnapshot(rule),
  };
}

function collectSelectorRequirements({
  rule,
  selector,
  role,
  selectorPath,
  memberSets,
  requirements,
  gaps,
}) {
  if (!isObject(selector)) {
    addGap(gaps, rule, role, selectorPath, 'missing_subject_selector');
    return;
  }
  if (Array.isArray(selector.combination)) {
    selector.combination.forEach((member, index) => {
      collectSelectorRequirements({
        rule,
        selector: member,
        role,
        selectorPath: `${selectorPath}.combination[${index}]`,
        memberSets,
        requirements,
        gaps,
      });
    });
    return;
  }

  const directKind = selector.drug !== undefined
    ? 'drug'
    : selector.substance !== undefined
      ? 'substance'
      : null;
  if (directKind !== null) {
    const canonicalName = canonicalIngredientKey(selector[directKind]);
    if (!canonicalName) {
      addGap(gaps, rule, role, selectorPath, 'empty_identity_selector');
      return;
    }
    requirements.push({
      canonical_name: canonicalName,
      requirement: baseRequirement(rule, {
        role,
        selectorPath,
        selectorKind: directKind,
        memberOrigin: 'direct_selector',
        selector,
      }),
    });
    return;
  }

  if (selector.class !== undefined) {
    const inline = Array.isArray(selector.members);
    const members = inline
      ? inlineClassMembers(selector)
      : globalClassMembers(selector, memberSets, rule, role, selectorPath, gaps);
    if (members.length === 0) {
      addGap(gaps, rule, role, selectorPath, 'class_selector_has_no_members', {
        class_name: selector.class,
      });
    }
    for (const member of members) {
      requirements.push({
        canonical_name: member.name,
        requirement: baseRequirement(rule, {
          role,
          selectorPath,
          selectorKind: 'class_member',
          className: selector.class,
          memberOrigin: inline ? 'inline_pinned_roster' : 'global_member_set_fallback',
          memberStrengthBuckets: member.strength_buckets,
          selector,
        }),
      });
    }
    return;
  }

  addGap(gaps, rule, role, selectorPath, 'missing_identity_selector');
}

function requirementSort(left, right) {
  return compareCodePoint(left.requirement_id, right.requirement_id);
}

export function extractRuleMappingAssertions({ rules, memberSets }) {
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');
  if (!isObject(memberSets)) throw new TypeError('memberSets must be an object');

  const collected = [];
  const gaps = [];
  for (const rule of rules) {
    if (!isObject(rule) || typeof rule.rule_id !== 'string' || !rule.rule_id) {
      throw new TypeError('every rule must have a non-empty rule_id');
    }
    collectSelectorRequirements({
      rule,
      selector: rule.object,
      role: 'object',
      selectorPath: 'object',
      memberSets,
      requirements: collected,
      gaps,
    });
    const otherRole = rule.perpetrator !== undefined
      ? 'perpetrator'
      : rule.second_subject !== undefined
        ? 'second_subject'
        : 'coadministered_with';
    collectSelectorRequirements({
      rule,
      selector: rule[otherRole],
      role: otherRole,
      selectorPath: otherRole,
      memberSets,
      requirements: collected,
      gaps,
    });
  }

  const byIngredient = new Map();
  for (const entry of collected) {
    const material = {
      ...entry.requirement,
      assertion_canonical_name: entry.canonical_name,
    };
    const requirement = {
      requirement_id: requirementId(material),
      ...entry.requirement,
    };
    const bucket = byIngredient.get(entry.canonical_name) ?? new Map();
    bucket.set(requirement.requirement_id, requirement);
    byIngredient.set(entry.canonical_name, bucket);
  }

  const rows = [...byIngredient.entries()]
    .sort(([left], [right]) => compareCodePoint(left, right))
    .map(([canonicalName, requirements]) => ({
      schema_version: INTERACTION_MAPPING_BACKLOG_SCHEMA_VERSION,
      ...createIngredientMappingCandidate({ observed_name: canonicalName }),
      selector_requirements: [...requirements.values()].sort(requirementSort),
      catalog_match: null,
    }));
  return {
    rows,
    gaps: gaps.sort((left, right) => compareCodePoint(stableJson(left), stableJson(right))),
    requirement_count: rows.reduce(
      (total, row) => total + row.selector_requirements.length,
      0,
    ),
  };
}

function sourceIdsForRow(row, lineNumber) {
  if (!Array.isArray(row.sources) || row.sources.length === 0) {
    throw new TypeError(`product record at line ${lineNumber} requires source provenance`);
  }
  const sourceIds = new Set();
  for (const source of row.sources) {
    const sourceId = typeof source === 'string' ? source : source?.source;
    if (typeof sourceId !== 'string' || sourceId.trim() === '') {
      throw new TypeError(`invalid source provenance at line ${lineNumber}`);
    }
    sourceIds.add(sourceId);
  }
  return [...sourceIds].sort(compareCodePoint);
}

function strengthMaterial(ingredient) {
  return {
    strength_raw: normalizeObservedIngredientName(ingredient.strength_raw) || null,
    strength_value: ingredient.strength_value ?? null,
    strength_unit: normalizeObservedIngredientName(ingredient.strength_unit) || null,
  };
}

function createOccurrenceStats() {
  return {
    occurrenceCount: 0,
    observedNames: new Set(),
    sourceFields: new Set(),
    precisionCounts: new Map(),
    strengths: new Map(),
  };
}

function addOccurrence(stats, identity, ingredient) {
  stats.occurrenceCount += 1;
  stats.observedNames.add(identity.observed_name);
  stats.sourceFields.add(identity.source_field);
  stats.precisionCounts.set(
    identity.precision,
    (stats.precisionCounts.get(identity.precision) ?? 0) + 1,
  );
  const material = strengthMaterial(ingredient);
  const key = stableJson(material);
  const value = stats.strengths.get(key) ?? { ...material, occurrence_count: 0 };
  value.occurrence_count += 1;
  stats.strengths.set(key, value);
}

function finalizeOccurrenceStats(stats) {
  return {
    occurrence_count: stats.occurrenceCount,
    observed_names: [...stats.observedNames].sort(compareCodePoint),
    source_fields: [...stats.sourceFields].sort(compareCodePoint),
    precision_counts: sortedCountObject(stats.precisionCounts),
    strength_assertions: [...stats.strengths.entries()]
      .sort(([left], [right]) => compareCodePoint(left, right))
      .map(([, value]) => value),
  };
}

function addCounts(counts, keys) {
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
}

function newIngredientCatalogStats() {
  return {
    rowCount: 0,
    productKeys: new Set(),
    occurrences: createOccurrenceStats(),
  };
}

function newProductRecord(candidate) {
  return {
    ...candidate,
    catalog: {
      row_count: 0,
      source_counts: new Map(),
    },
    matchedIngredients: new Map(),
  };
}

function addMatchedIngredient(productRecord, ingredientRow, identity, ingredient) {
  const ingredientId = ingredientRow.assertion.ingredient_id;
  let matched = productRecord.matchedIngredients.get(ingredientId);
  if (matched === undefined) {
    matched = {
      ingredient_id: ingredientId,
      canonical_name: ingredientRow.assertion.canonical_name,
      requirement_ids: ingredientRow.selector_requirements
        .map((requirement) => requirement.requirement_id)
        .sort(compareCodePoint),
      occurrences: createOccurrenceStats(),
    };
    productRecord.matchedIngredients.set(ingredientId, matched);
  }
  addOccurrence(matched.occurrences, identity, ingredient);
}

function finalizeProductRecord(record, assertionCount) {
  return {
    schema_version: INTERACTION_MAPPING_BACKLOG_SCHEMA_VERSION,
    review_status: record.review_status,
    product_id: record.product_id,
    product_assertion_sha256: record.product_assertion_sha256,
    product_assertion: record.product_assertion,
    product_id_assertion_count: assertionCount,
    product_id_collision: assertionCount > 1,
    catalog: {
      row_count: record.catalog.row_count,
      source_counts: sortedCountObject(record.catalog.source_counts),
    },
    matched_ingredients: [...record.matchedIngredients.values()]
      .sort((left, right) => compareCodePoint(left.canonical_name, right.canonical_name))
      .map((matched) => ({
        ingredient_id: matched.ingredient_id,
        canonical_name: matched.canonical_name,
        requirement_ids: matched.requirement_ids,
        catalog_occurrences: finalizeOccurrenceStats(matched.occurrences),
      })),
    proposed_presentation: record.proposed_presentation,
  };
}

function finalizeIngredientRow(row, stats) {
  return {
    ...row,
    catalog_match: {
      matched: stats.rowCount > 0,
      catalog_row_count: stats.rowCount,
      product_assertion_count: stats.productKeys.size,
      ...finalizeOccurrenceStats(stats.occurrences),
    },
  };
}

export async function buildInteractionMappingBacklog({ rules, memberSets, products }) {
  const extracted = extractRuleMappingAssertions({ rules, memberSets });
  const ingredientById = new Map(
    extracted.rows.map((row) => [row.assertion.ingredient_id, row]),
  );
  const ingredientStats = new Map(
    extracted.rows.map((row) => [row.assertion.ingredient_id, newIngredientCatalogStats()]),
  );
  const productRecords = new Map();
  const assertionsByProductId = new Map();
  const sourceCounts = new Map();
  let rowCount = 0;

  for await (const product of products) {
    rowCount += 1;
    const sourceIds = sourceIdsForRow(product, rowCount);
    addCounts(sourceCounts, sourceIds);
    if (!Array.isArray(product.ingredients) || product.ingredients.length === 0) continue;

    const matchedOccurrences = [];
    for (const ingredient of product.ingredients) {
      const candidate = createIngredientMappingCandidate(ingredient);
      const ingredientRow = ingredientById.get(candidate.assertion.ingredient_id);
      if (ingredientRow === undefined) continue;
      matchedOccurrences.push({
        ingredient,
        ingredientRow,
        identity: candidate.assertion,
      });
    }
    if (matchedOccurrences.length === 0) continue;

    const candidate = createProductPresentationCandidate(product);
    const productKey = `${candidate.product_id}\0${candidate.product_assertion_sha256}`;
    let productRecord = productRecords.get(productKey);
    if (productRecord === undefined) {
      productRecord = newProductRecord(candidate);
      productRecords.set(productKey, productRecord);
    }
    productRecord.catalog.row_count += 1;
    addCounts(productRecord.catalog.source_counts, sourceIds);
    const assertionHashes = assertionsByProductId.get(candidate.product_id) ?? new Set();
    assertionHashes.add(candidate.product_assertion_sha256);
    assertionsByProductId.set(candidate.product_id, assertionHashes);

    const matchedInRow = new Set();
    for (const matched of matchedOccurrences) {
      const ingredientId = matched.ingredientRow.assertion.ingredient_id;
      const stats = ingredientStats.get(ingredientId);
      addOccurrence(stats.occurrences, matched.identity, matched.ingredient);
      stats.productKeys.add(productKey);
      matchedInRow.add(ingredientId);
      addMatchedIngredient(
        productRecord,
        matched.ingredientRow,
        matched.identity,
        matched.ingredient,
      );
    }
    for (const ingredientId of matchedInRow) ingredientStats.get(ingredientId).rowCount += 1;
  }

  const ingredientRows = extracted.rows.map((row) => (
    finalizeIngredientRow(row, ingredientStats.get(row.assertion.ingredient_id))
  ));
  const productRows = [...productRecords.values()]
    .map((record) => finalizeProductRecord(
      record,
      assertionsByProductId.get(record.product_id).size,
    ))
    .sort((left, right) => (
      compareCodePoint(left.product_id, right.product_id)
      || compareCodePoint(left.product_assertion_sha256, right.product_assertion_sha256)
    ));
  const collisionIds = [...assertionsByProductId.entries()]
    .filter(([, hashes]) => hashes.size > 1)
    .map(([productId]) => productId)
    .sort(compareCodePoint);

  return {
    ingredient_rows: ingredientRows,
    product_rows: productRows,
    selector_gaps: extracted.gaps,
    observed_provenance: {
      row_count: rowCount,
      source_counts: sortedCountObject(sourceCounts),
    },
    counts: {
      rule_count: rules.length,
      selector_requirement_count: extracted.requirement_count,
      rule_ingredient_assertion_count: ingredientRows.length,
      catalog_matched_ingredient_assertion_count: ingredientRows.filter(
        (row) => row.catalog_match.matched,
      ).length,
      catalog_unmatched_ingredient_assertion_count: ingredientRows.filter(
        (row) => !row.catalog_match.matched,
      ).length,
      product_assertion_candidate_count: productRows.length,
      product_id_count: assertionsByProductId.size,
      product_id_collision_count: collisionIds.length,
      product_assertions_in_collision_count: productRows.filter(
        (row) => row.product_id_collision,
      ).length,
      selector_gap_count: extracted.gaps.length,
      accepted_ingredient_mapping_count: 0,
      accepted_product_presentation_count: 0,
    },
    product_id_collisions: collisionIds,
  };
}

function validateSummary(summary) {
  if (!isObject(summary)) throw new Error('artifact summary must be an object');
  if (!Number.isSafeInteger(summary.total_rows) || summary.total_rows < 0) {
    throw new Error('artifact summary total_rows must be a non-negative integer');
  }
  if (!isObject(summary.sources)) throw new Error('artifact summary requires source provenance');
  const sourceCounts = {};
  for (const [sourceId, count] of Object.entries(summary.sources)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(
        `artifact summary source count for ${sourceId} must be a non-negative integer`,
      );
    }
    if (count > 0) sourceCounts[sourceId] = count;
  }
  const sourceIds = Object.keys(sourceCounts).sort(compareCodePoint);
  if (sourceIds.length === 0) throw new Error('artifact summary has no non-empty sources');
  return { rowCount: summary.total_rows, sourceCounts, sourceIds };
}

function assertSummaryMatchesRows(summary, observed) {
  if (summary.rowCount !== observed.row_count) {
    throw new Error(
      `artifact row count does not match summary total_rows: expected ${summary.rowCount}, observed ${observed.row_count}`,
    );
  }
  for (const [sourceId, count] of Object.entries(observed.source_counts)) {
    if (summary.sourceCounts[sourceId] === undefined) {
      throw new Error(`artifact row provenance source ${sourceId} is absent from summary`);
    }
    if (count > summary.sourceCounts[sourceId]) {
      throw new Error(`artifact row provenance count for ${sourceId} exceeds summary count`);
    }
  }
  for (const sourceId of summary.sourceIds) {
    if (observed.source_counts[sourceId] === undefined) {
      throw new Error(`artifact summary source ${sourceId} is absent from row provenance`);
    }
  }
}

async function readJson(file, label) {
  let text;
  try {
    text = await fsp.readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${label} at ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid ${label} JSON at ${file}: ${error.message}`);
  }
}

async function readRules(file) {
  const rules = [];
  for await (const rule of readStrictJsonl(file)) rules.push(rule);
  validateDraftRules(rules);
  return rules;
}

async function sha256File(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(file);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('error', reject);
    input.on('end', resolve);
  });
  return hash.digest('hex');
}

function rowsSha256(rows) {
  const hash = createHash('sha256');
  for (const row of rows) hash.update(`${JSON.stringify(row)}\n`, 'utf8');
  return hash.digest('hex');
}

async function writeTemporary(file, write) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.tmp-${process.pid}-${randomUUID()}`,
  );
  const handle = await fsp.open(temporary, 'wx');
  try {
    await write(handle);
    await handle.sync();
    await handle.close();
    return temporary;
  } catch (error) {
    await handle.close().catch(() => {});
    await fsp.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function stageJsonl(file, rows) {
  return writeTemporary(file, async (handle) => {
    for (const row of rows) await handle.write(`${JSON.stringify(row)}\n`, null, 'utf8');
  });
}

async function stageJson(file, value) {
  return writeTemporary(
    file,
    (handle) => handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8'),
  );
}

async function commitStagedFiles(staged) {
  try {
    for (const { temporary, destination } of staged) {
      await fsp.rename(temporary, destination);
    }
  } finally {
    await Promise.all(
      staged.map(({ temporary }) => fsp.rm(temporary, { force: true }).catch(() => {})),
    );
  }
}

function requireDistinctPaths(paths) {
  const resolved = paths.map((file) => path.resolve(file));
  if (new Set(resolved).size !== resolved.length) {
    throw new TypeError('input and output paths must all be distinct');
  }
}

export async function buildInteractionMappingBacklogFromFiles({
  profile,
  rulesPath,
  rulesStoragePath = rulesPath,
  memberSetsPath,
  memberSetsStoragePath = memberSetsPath,
  artifactPath,
  artifactSummaryPath,
  artifactSummaryStoragePath = artifactSummaryPath,
  artifactStoragePath,
  ingredientOutputPath,
  productOutputPath,
  summaryOutputPath,
  outputStoragePath,
  sourceManifestPath,
}) {
  if (!['production-open', 'internal-evaluation'].includes(profile)) {
    throw new TypeError('profile must be production-open or internal-evaluation');
  }
  for (const [label, value] of Object.entries({
    rulesPath,
    memberSetsPath,
    artifactPath,
    artifactSummaryPath,
    artifactStoragePath,
    ingredientOutputPath,
    productOutputPath,
    summaryOutputPath,
    outputStoragePath,
  })) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new TypeError(`${label} is required`);
    }
  }
  requireDistinctPaths([
    rulesPath,
    memberSetsPath,
    artifactPath,
    artifactSummaryPath,
    ingredientOutputPath,
    productOutputPath,
    summaryOutputPath,
  ]);

  const [rules, memberSets, artifactSummary] = await Promise.all([
    readRules(rulesPath),
    readJson(memberSetsPath, 'interaction member sets'),
    readJson(artifactSummaryPath, 'artifact summary'),
  ]);
  const declaredProvenance = validateSummary(artifactSummary);
  const sourceManifest = loadSourceManifest(sourceManifestPath);
  const inputPolicy = assertArtifactProvenance(sourceManifest, {
    sourceIds: declaredProvenance.sourceIds,
    profile,
    use: 'product-resolution',
    storagePath: artifactStoragePath,
  });
  const outputPolicy = assertArtifactProvenance(sourceManifest, {
    sourceIds: declaredProvenance.sourceIds,
    profile,
    use: 'product-resolution',
    storagePath: outputStoragePath,
  });

  const [backlog, inputHashes] = await Promise.all([
    buildInteractionMappingBacklog({
      rules,
      memberSets,
      products: readStrictJsonl(artifactPath),
    }),
    Promise.all([
      sha256File(rulesPath),
      sha256File(memberSetsPath),
      sha256File(artifactPath),
      sha256File(artifactSummaryPath),
    ]),
  ]);
  assertSummaryMatchesRows(declaredProvenance, backlog.observed_provenance);

  const ingredientRowsSha256 = rowsSha256(backlog.ingredient_rows);
  const productRowsSha256 = rowsSha256(backlog.product_rows);
  const unmatched = backlog.ingredient_rows
    .filter((row) => !row.catalog_match.matched)
    .map((row) => ({
      ingredient_id: row.assertion.ingredient_id,
      canonical_name: row.assertion.canonical_name,
      requirement_count: row.selector_requirements.length,
    }));
  const summary = {
    schema_version: INTERACTION_MAPPING_BACKLOG_SCHEMA_VERSION,
    profile,
    identity_namespace: INGREDIENT_IDENTITY_NAMESPACE,
    product_id_namespace: PRODUCT_ID_NAMESPACE,
    product_assertion_namespace: PRODUCT_ASSERTION_NAMESPACE,
    requirement_namespace: RULE_MAPPING_REQUIREMENT_NAMESPACE,
    inputs: {
      rules: {
        storage_path: rulesStoragePath,
        sha256: inputHashes[0],
        rule_count: rules.length,
        sections: sortedUnique(rules.map((rule) => rule._section).filter(Boolean)),
      },
      member_sets: {
        storage_path: memberSetsStoragePath,
        sha256: inputHashes[1],
      },
      product_artifact: {
        storage_path: artifactStoragePath,
        sha256: inputHashes[2],
        summary_storage_path: artifactSummaryStoragePath,
        summary_sha256: inputHashes[3],
        row_count: backlog.observed_provenance.row_count,
        source_counts: backlog.observed_provenance.source_counts,
      },
    },
    source_policy: {
      input: inputPolicy,
      output: outputPolicy,
    },
    outputs: {
      ingredient_assertions: {
        storage_path: path.posix.join(outputStoragePath, path.basename(ingredientOutputPath)),
        sha256: ingredientRowsSha256,
      },
      product_presentations: {
        storage_path: path.posix.join(outputStoragePath, path.basename(productOutputPath)),
        sha256: productRowsSha256,
      },
    },
    counts: backlog.counts,
    selector_gaps: backlog.selector_gaps,
    unmatched_ingredient_assertions: unmatched,
    product_id_collisions: backlog.product_id_collisions,
    review_boundary: {
      review_status: 'review_candidate',
      accepted_mapping_count: 0,
      route_or_formulation_inference_permitted: false,
      runtime_promotion_permitted: false,
    },
  };

  const ingredientTemporary = await stageJsonl(
    ingredientOutputPath,
    backlog.ingredient_rows,
  );
  let productTemporary;
  let summaryTemporary;
  try {
    productTemporary = await stageJsonl(productOutputPath, backlog.product_rows);
    summaryTemporary = await stageJson(summaryOutputPath, summary);
  } catch (error) {
    await Promise.all([
      fsp.rm(ingredientTemporary, { force: true }).catch(() => {}),
      productTemporary
        ? fsp.rm(productTemporary, { force: true }).catch(() => {})
        : Promise.resolve(),
    ]);
    throw error;
  }
  await commitStagedFiles([
    { temporary: ingredientTemporary, destination: ingredientOutputPath },
    { temporary: productTemporary, destination: productOutputPath },
    { temporary: summaryTemporary, destination: summaryOutputPath },
  ]);

  return {
    summary,
    ingredient_output_path: ingredientOutputPath,
    product_output_path: productOutputPath,
    summary_output_path: summaryOutputPath,
  };
}
