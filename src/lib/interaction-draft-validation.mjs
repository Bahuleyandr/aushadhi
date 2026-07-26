const SEVERITIES = new Set(['minor', 'moderate', 'major', 'contraindicated']);
const SEVERITY_RANK = { minor: 1, moderate: 2, major: 3, contraindicated: 4 };
const DISPENSE_ACTIONS = new Set([
  'supply_with_counselling',
  'space_doses',
  'confirm_and_monitor',
  'withhold_and_clarify',
]);
const ACTION_RANK = {
  supply_with_counselling: 1,
  space_doses: 2,
  confirm_and_monitor: 3,
  withhold_and_clarify: 4,
};
const FACTORS = new Set(['renal', 'hepatic']);
const PREDICATES = new Set([
  'egfr_lt_15',
  'egfr_lt_30',
  'egfr_lt_60',
  'egfr_ge_60',
  'crcl_lt_15',
  'crcl_lt_30',
  'crcl_lt_50',
  'crcl_lt_60',
  'crcl_30_to_50',
  'hepatic_impaired',
  'child_pugh_b',
  'child_pugh_c',
]);
const ON_UNKNOWN = new Set(['base', 'escalate']);
const JURISDICTIONS = new Set(['IN', 'US', 'UK', 'EU']);
const ROUTE_ALIASES = new Map([
  ['im', 'intramuscular'],
  ['iv', 'intravenous'],
]);
const FORMULATION_ALIASES = new Map([
  ['fixed_combination', 'fixed_dose_combination'],
]);
const ABSTRACT_RUNTIME_ROUTES = new Set(['parenteral', 'systemic']);
const ABSTRACT_RUNTIME_FORMULATIONS = new Set([
  'delayed_release',
  'extended_release',
  'fixed_dose_combination',
  'immediate_release',
  'oral',
  'solid_modified_release',
  'solid_oral',
]);
const COMPOSITE_FORMULATIONS = new Map([
  ['ibuprofen_injection', {
    formulation: 'injection',
    route: 'intravenous',
    drug: 'ibuprofen',
  }],
  ['oral_gel', { formulation: 'gel', route: 'oral' }],
  ['oral_liquid', { formulation: 'liquid', route: 'oral' }],
  ['oral_powder', { formulation: 'powder', route: 'oral' }],
  ['oral_solution', { formulation: 'solution', route: 'oral' }],
  ['oral_suspension', { formulation: 'suspension', route: 'oral' }],
  ['oral_tablet', { formulation: 'tablet', route: 'oral' }],
  ['oromucosal_gel', { formulation: 'gel', route: 'oromucosal' }],
]);
const ROUTES = new Set([
  'im',
  'intra_arterial',
  'inhaled',
  'intramuscular',
  'intravenous',
  'iv',
  'nasal',
  'ophthalmic',
  'oral',
  'oromucosal',
  'otic',
  'parenteral',
  'rectal',
  'subcutaneous',
  'subdermal',
  'sublingual',
  'systemic',
  'topical',
  'transdermal',
  'vaginal',
]);
const FORMULATIONS = new Set([
  'capsule',
  'delayed_release',
  'delayed_release_tablet',
  'extended_release',
  'fixed_combination',
  'fixed_dose_combination',
  'gel',
  'herbal_supplement',
  'ibuprofen_injection',
  'immediate_release',
  'immediate_release_tablet',
  'implant',
  'injection',
  'juice',
  'liquid',
  'oral',
  'oral_gel',
  'oral_liquid',
  'oral_powder',
  'oral_solution',
  'oral_suspension',
  'oral_tablet',
  'oromucosal_gel',
  'powder',
  'solution',
  'solid_modified_release',
  'solid_oral',
  'suppository',
  'suspension',
  'tablet',
  'wax_matrix_tablet',
  'whole_fruit',
]);
const RUNTIME_STATUS_KEYS = new Set([
  'pair_matcher_executable',
  'clinical_context_complete',
  'runtime_enabled',
  'promotion_eligible',
]);
const SUBJECT_IDENTITY_KEYS = new Set(['drug', 'substance', 'class', 'combination']);
const SUBJECT_KEYS = new Set([
  ...SUBJECT_IDENTITY_KEYS,
  'route',
  'formulation',
  'strength',
  'members',
  'member_exceptions',
  'members_source',
  'member_notes',
  'members_note',
  '_members_note',
  'note',
  'description',
  'match_semantics',
  'member_tiers',
  'dose',
  'dose_note',
  'dosing_pattern',
  'formulation_exclusions',
  'scope',
]);
const UNMODELED_CONTEXT_KEYS = new Set([
  'dose',
  'dose_note',
  'dosing_pattern',
  'formulation_exclusions',
  'member_tiers',
  'scope',
]);
const SPECIFICITY = {
  egfr_lt_15: 4,
  crcl_lt_15: 4,
  egfr_lt_30: 3,
  crcl_lt_30: 3,
  crcl_30_to_50: 3,
  egfr_lt_60: 2,
  crcl_lt_50: 2,
  crcl_lt_60: 2,
  egfr_ge_60: 2,
  child_pugh_c: 3,
  child_pugh_b: 2,
  hepatic_impaired: 1,
};
const NUMERIC_PREDICATES = {
  egfr_lt_15: ['egfr', Number.NEGATIVE_INFINITY, 15],
  egfr_lt_30: ['egfr', Number.NEGATIVE_INFINITY, 30],
  egfr_lt_60: ['egfr', Number.NEGATIVE_INFINITY, 60],
  egfr_ge_60: ['egfr', 60, Number.POSITIVE_INFINITY],
  crcl_lt_15: ['crcl', Number.NEGATIVE_INFINITY, 15],
  crcl_lt_30: ['crcl', Number.NEGATIVE_INFINITY, 30],
  crcl_lt_50: ['crcl', Number.NEGATIVE_INFINITY, 50],
  crcl_lt_60: ['crcl', Number.NEGATIVE_INFINITY, 60],
  crcl_30_to_50: ['crcl', 30, 50],
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(ruleId, message) {
  throw new TypeError(`draft interaction rule "${ruleId}": ${message}`);
}

function requireBoolean(value, ruleId, label) {
  if (typeof value !== 'boolean') fail(ruleId, `${label} must be a boolean`);
}

function requireNonEmptyString(value, ruleId, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(ruleId, `${label} must be a non-empty string`);
  }
}

function validateAction(value, ruleId, label) {
  if (!DISPENSE_ACTIONS.has(value)) {
    fail(ruleId, `${label} has invalid dispense action "${String(value)}"`);
  }
}

function validateSeverity(value, ruleId, label) {
  if (!SEVERITIES.has(value)) {
    fail(ruleId, `${label} has invalid severity "${String(value)}"`);
  }
}

function validateScopeList(value, allowed, ruleId, label) {
  if (value === undefined) return;
  if (!Array.isArray(value)) fail(ruleId, `${label} must be an array`);
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== 'string' || !allowed.has(entry)) {
      fail(ruleId, `${label} contains invalid value "${String(entry)}"`);
    }
    if (seen.has(entry)) fail(ruleId, `${label} contains duplicate ${entry}`);
    seen.add(entry);
  }
}

function validateStringList(value, ruleId, label, { nonEmpty = false } = {}) {
  if (!Array.isArray(value)) fail(ruleId, `${label} must be an array`);
  if (nonEmpty && value.length === 0) fail(ruleId, `${label} must be a non-empty array`);
  const seen = new Set();
  for (const entry of value) {
    requireNonEmptyString(entry, ruleId, `${label} entry`);
    if (seen.has(entry)) fail(ruleId, `${label} contains duplicate ${entry}`);
    seen.add(entry);
  }
}

function validateSubjectRef(ref, rule, label, unmodeledContexts) {
  const ruleId = rule.rule_id;
  if (!isObject(ref)) fail(ruleId, `${label} must be an object`);
  for (const key of Object.keys(ref)) {
    if (!SUBJECT_KEYS.has(key)) fail(ruleId, `${label} contains unknown property ${key}`);
    if (UNMODELED_CONTEXT_KEYS.has(key)) unmodeledContexts.push(`${label}.${key}`);
  }
  const identities = [...SUBJECT_IDENTITY_KEYS].filter((key) => ref[key] !== undefined);
  if (identities.length !== 1 && rule.runtime_status.pair_matcher_executable) {
    fail(
      ruleId,
      `${label} must contain exactly one identity selector; found ${identities.join(', ') || 'none'}`,
    );
  }
  for (const identity of identities.filter((key) => key !== 'combination')) {
    requireNonEmptyString(ref[identity], ruleId, `${label}.${identity}`);
  }
  validateScopeList(ref.route, ROUTES, ruleId, `${label}.route`);
  validateScopeList(ref.formulation, FORMULATIONS, ruleId, `${label}.formulation`);
  for (const key of ['members', 'member_exceptions']) {
    if (ref[key] !== undefined) validateStringList(ref[key], ruleId, `${label}.${key}`);
  }
  if (ref.strength !== undefined && ref.strength !== null) {
    validateStringList(ref.strength, ruleId, `${label}.strength`);
  }
  if (ref.combination !== undefined) {
    if (!Array.isArray(ref.combination) || ref.combination.length < 2) {
      fail(ruleId, `${label}.combination must contain at least two selectors`);
    }
    if (ref.match_semantics !== undefined && ref.match_semantics !== 'all_of_present') {
      fail(ruleId, `${label}.match_semantics must be all_of_present`);
    }
    ref.combination.forEach((member, index) => {
      validateSubjectRef(member, rule, `${label}.combination[${index}]`, unmodeledContexts);
    });
  }
}

function canonicalRoute(value) {
  const normalized = value.trim().toLowerCase();
  return ROUTE_ALIASES.get(normalized) ?? normalized;
}

function canonicalFormulation(value) {
  const normalized = value.trim().toLowerCase();
  const aliased = FORMULATION_ALIASES.get(normalized) ?? normalized;
  return COMPOSITE_FORMULATIONS.get(aliased)?.formulation ?? aliased;
}

function validateRuntimeDraftSubjectRef(ref, ruleId, label) {
  if (!isObject(ref)) {
    fail(ruleId, `clinical_context_complete=true requires ${label}`);
  }
  if (ref.combination !== undefined) {
    fail(
      ruleId,
      `${label}.combination is manual-review only and cannot be clinical_context_complete`,
    );
  }
  validateStringList(ref.route, ruleId, `${label}.route`, { nonEmpty: true });
  validateStringList(ref.formulation, ruleId, `${label}.formulation`, { nonEmpty: true });
  const routes = ref.route.map(canonicalRoute);
  const formulations = ref.formulation.map(canonicalFormulation);
  if (new Set(routes).size !== routes.length) {
    fail(ruleId, `${label}.route contains duplicate canonical routes`);
  }
  if (new Set(formulations).size !== formulations.length) {
    fail(ruleId, `${label}.formulation contains duplicate canonical formulations`);
  }
  if (routes.some((route) => ABSTRACT_RUNTIME_ROUTES.has(route))) {
    fail(ruleId, `${label}.route contains an abstract runtime scope`);
  }
  if (formulations.some((formulation) => ABSTRACT_RUNTIME_FORMULATIONS.has(formulation))) {
    fail(ruleId, `${label}.formulation contains an abstract runtime scope`);
  }
  const routeSet = new Set(routes);
  for (const rawFormulation of ref.formulation) {
    const normalized = FORMULATION_ALIASES.get(rawFormulation) ?? rawFormulation;
    const composite = COMPOSITE_FORMULATIONS.get(normalized);
    if (composite === undefined) continue;
    if (!routeSet.has(composite.route)) {
      fail(
        ruleId,
        `${label}.formulation "${rawFormulation}" requires route "${composite.route}"`,
      );
    }
    const identity = ref.drug ?? ref.substance;
    if (composite.drug !== undefined
      && (typeof identity !== 'string' || identity.trim().toLowerCase() !== composite.drug)) {
      fail(
        ruleId,
        `${label}.formulation "${rawFormulation}" requires drug "${composite.drug}"`,
      );
    }
  }
  if (ref.class !== undefined
    && (!Array.isArray(ref.members) || ref.members.length === 0)) {
    fail(ruleId, `${label}.class requires an inline pinned members roster`);
  }
}

function draftSelectorMembers(ref) {
  if (ref.drug !== undefined) return new Set([ref.drug.trim().toLowerCase()]);
  if (ref.substance !== undefined) return new Set([ref.substance.trim().toLowerCase()]);
  if (ref.class !== undefined && Array.isArray(ref.members)) {
    const exceptions = new Set(
      (ref.member_exceptions ?? []).map((member) => member.trim().toLowerCase()),
    );
    return new Set(
      ref.members
        .map((member) => member.trim().toLowerCase())
        .filter((member) => !exceptions.has(member)),
    );
  }
  return new Set();
}

function validateRuntimeDraftRoleDisjoint(rule, otherSide) {
  const objectMembers = draftSelectorMembers(rule.object);
  const otherMembers = draftSelectorMembers(otherSide);
  const overlap = [...objectMembers].filter((member) => otherMembers.has(member));
  if (overlap.length > 0) {
    fail(rule.rule_id, `runtime role selectors overlap: ${overlap.join(', ')}`);
  }
}

function validateDraftReview(rule) {
  if (!isObject(rule.review)) fail(rule.rule_id, 'review must be an object');
  if (rule.review.status === 'clinician_reviewed') {
    fail(rule.rule_id, 'draft rules must not claim review.status=clinician_reviewed');
  }
  for (const role of ['author', 'approver']) {
    if (rule.review[role] !== undefined && rule.review[role] !== null) {
      fail(rule.rule_id, `draft rules must not claim review.${role}`);
    }
  }
  if (rule.review.reviewed_at !== undefined && rule.review.reviewed_at !== null) {
    fail(rule.rule_id, 'draft rules must not claim review.reviewed_at');
  }
}

function predicateFactor(when) {
  if (when.startsWith('egfr_') || when.startsWith('crcl_')) return 'renal';
  return 'hepatic';
}

function predicatesOverlap(left, right) {
  const leftNumeric = NUMERIC_PREDICATES[left];
  const rightNumeric = NUMERIC_PREDICATES[right];
  if (leftNumeric && rightNumeric) {
    if (leftNumeric[0] !== rightNumeric[0]) return true;
    return Math.max(leftNumeric[1], rightNumeric[1]) < Math.min(leftNumeric[2], rightNumeric[2]);
  }
  if (leftNumeric || rightNumeric) return false;
  if (left === right) return true;
  return left === 'hepatic_impaired' || right === 'hepatic_impaired';
}

function modifierOutcome(rule, modifier) {
  return JSON.stringify({
    severity: modifier.severity ?? rule.severity,
    dispense_action: modifier.management_override?.dispense_action
      ?? modifier.dispense_action
      ?? rule.management.dispense_action,
    management_override: modifier.management_override ?? null,
  });
}

function validateContextModifiers(rule) {
  const ruleId = rule.rule_id;
  if (!Array.isArray(rule.context_modifiers)) {
    fail(ruleId, 'context_modifiers must be an array');
  }
  for (let index = 0; index < rule.context_modifiers.length; index += 1) {
    const modifier = rule.context_modifiers[index];
    const label = `context_modifiers[${index}]`;
    if (!isObject(modifier)) fail(ruleId, `${label} must be an object`);
    if (!FACTORS.has(modifier.factor)) {
      fail(ruleId, `${label} has invalid factor "${String(modifier.factor)}"`);
    }
    if (!PREDICATES.has(modifier.when)) {
      fail(ruleId, `${label} has invalid predicate "${String(modifier.when)}"`);
    }
    if (predicateFactor(modifier.when) !== modifier.factor) {
      fail(ruleId, `${label} predicate ${modifier.when} does not belong to factor ${modifier.factor}`);
    }
    if (!ON_UNKNOWN.has(modifier.on_unknown)) {
      fail(ruleId, `${label} has invalid on_unknown "${String(modifier.on_unknown)}"`);
    }
    if (modifier.severity !== undefined) {
      validateSeverity(modifier.severity, ruleId, `${label}.severity`);
    }
    if (modifier.dispense_action !== undefined) {
      validateAction(modifier.dispense_action, ruleId, `${label}.dispense_action`);
    }
    if (modifier.management_override !== undefined) {
      if (!isObject(modifier.management_override)) {
        fail(ruleId, `${label}.management_override must be an object`);
      }
      if (modifier.management_override.dispense_action !== undefined) {
        validateAction(
          modifier.management_override.dispense_action,
          ruleId,
          `${label}.management_override.dispense_action`,
        );
      }
    }
    if (modifier.on_unknown === 'escalate' && modifier.dispense_action === undefined) {
      fail(ruleId, `${label} on_unknown=escalate requires an explicit dispense_action`);
    }
  }

  for (let leftIndex = 0; leftIndex < rule.context_modifiers.length; leftIndex += 1) {
    const left = rule.context_modifiers[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < rule.context_modifiers.length; rightIndex += 1) {
      const right = rule.context_modifiers[rightIndex];
      if (left.factor !== right.factor) continue;
      if (SPECIFICITY[left.when] !== SPECIFICITY[right.when]) continue;
      if (!predicatesOverlap(left.when, right.when)) continue;
      if (modifierOutcome(rule, left) === modifierOutcome(rule, right)) continue;
      fail(
        ruleId,
        `ambiguous equal-specificity modifiers ${left.when} and ${right.when} can both match`,
      );
    }
  }
}

function validateRuntimeStatus(rule) {
  const ruleId = rule.rule_id;
  requireBoolean(rule.runtime_enabled, ruleId, 'runtime_enabled');
  if (!isObject(rule.runtime_status)) fail(ruleId, 'runtime_status must be an object');
  for (const key of Object.keys(rule.runtime_status)) {
    if (!RUNTIME_STATUS_KEYS.has(key)) fail(ruleId, `runtime_status contains unknown property ${key}`);
  }
  for (const key of RUNTIME_STATUS_KEYS) {
    requireBoolean(rule.runtime_status[key], ruleId, `runtime_status.${key}`);
  }
  if (rule.runtime_enabled !== rule.runtime_status.runtime_enabled) {
    fail(ruleId, 'runtime_enabled must mirror runtime_status.runtime_enabled');
  }
  if (rule.runtime_enabled && !rule.runtime_status.pair_matcher_executable) {
    fail(ruleId, 'runtime_enabled=true requires runtime_status.pair_matcher_executable=true');
  }
  if (rule.runtime_enabled && !rule.runtime_status.clinical_context_complete) {
    fail(ruleId, 'runtime_enabled=true requires runtime_status.clinical_context_complete=true');
  }
  if (rule.runtime_status.promotion_eligible !== false) {
    fail(ruleId, 'draft rules must have runtime_status.promotion_eligible=false');
  }
}

function validateJurisdictionEvidence(rule) {
  const ruleId = rule.rule_id;
  const jurisdictions = rule.applicability?.jurisdiction;
  if (jurisdictions !== undefined && !Array.isArray(jurisdictions)) {
    fail(ruleId, 'applicability.jurisdiction must be an array');
  }
  if (Array.isArray(jurisdictions)) {
    const seen = new Set();
    for (const jurisdiction of jurisdictions) {
      if (!JURISDICTIONS.has(jurisdiction)) {
        fail(
          ruleId,
          `applicability.jurisdiction has invalid jurisdiction "${String(jurisdiction)}"`,
        );
      }
      if (seen.has(jurisdiction)) {
        fail(ruleId, `applicability.jurisdiction contains duplicate ${jurisdiction}`);
      }
      seen.add(jurisdiction);
    }
  }

  if (!rule.runtime_enabled) return;
  if (!Array.isArray(jurisdictions) || jurisdictions.length === 0) {
    fail(ruleId, 'runtime-enabled rules require at least one applicability jurisdiction');
  }
  if (!Array.isArray(rule.evidence) || rule.evidence.length === 0) {
    fail(ruleId, 'runtime-enabled rules require jurisdiction-backed evidence');
  }

  for (const jurisdiction of jurisdictions) {
    const supportingEvidence = rule.evidence.some((evidence) => (
      Array.isArray(evidence?.supports?.jurisdictions)
      && evidence.supports.jurisdictions.includes(jurisdiction)
      && evidence.supports.interaction_exists === true
      && Array.isArray(evidence.supports.label_action)
      && evidence.supports.label_action.some(
        (action) => typeof action === 'string' && action.trim() !== '',
      )
    ));
    if (!supportingEvidence) {
      fail(
        ruleId,
        `runtime-enabled jurisdiction ${jurisdiction} requires same-jurisdiction interaction and label-action evidence`,
      );
    }
  }
}

function validateRule(rule, index) {
  if (!isObject(rule)) throw new TypeError(`draft interaction rule at index ${index} must be an object`);
  requireNonEmptyString(rule.rule_id, `<index:${index}>`, 'rule_id');
  validateSeverity(rule.severity, rule.rule_id, 'severity');
  if (!isObject(rule.management)) fail(rule.rule_id, 'management must be an object');
  validateAction(rule.management.dispense_action, rule.rule_id, 'management.dispense_action');
  validateContextModifiers(rule);
  validateRuntimeStatus(rule);
  validateJurisdictionEvidence(rule);
  const unmodeledContexts = [];
  validateSubjectRef(rule.object, rule, 'object', unmodeledContexts);
  const otherSide = rule.perpetrator ?? rule.second_subject ?? rule.coadministered_with;
  if (otherSide === undefined) {
    if (rule.runtime_status.pair_matcher_executable
      || rule.runtime_enabled
      || rule.runtime_status.promotion_eligible) {
      fail(rule.rule_id, 'executable rules require a perpetrator or second subject');
    }
  } else {
    validateSubjectRef(otherSide, rule, 'perpetrator', unmodeledContexts);
  }
  if (rule.runtime_status.clinical_context_complete) {
    validateRuntimeDraftSubjectRef(rule.object, rule.rule_id, 'object');
    validateRuntimeDraftSubjectRef(otherSide, rule.rule_id, 'perpetrator');
    validateRuntimeDraftRoleDisjoint(rule, otherSide);
  }
  if (rule.applicability !== undefined) {
    if (!isObject(rule.applicability)) fail(rule.rule_id, 'applicability must be an object');
    validateScopeList(
      rule.applicability.routes,
      ROUTES,
      rule.rule_id,
      'applicability.routes',
    );
    validateScopeList(
      rule.applicability.formulations,
      FORMULATIONS,
      rule.rule_id,
      'applicability.formulations',
    );
    if (rule.applicability.indication !== undefined
      && rule.applicability.indication !== null) {
      validateStringList(
        rule.applicability.indication,
        rule.rule_id,
        'applicability.indication',
        { nonEmpty: true },
      );
    }
  }
  if (rule.runtime_status.clinical_context_complete && unmodeledContexts.length > 0) {
    fail(
      rule.rule_id,
      `clinical_context_complete=true cannot depend on unmodeled selector context: ${unmodeledContexts.join(', ')}`,
    );
  }
  if (rule.runtime_status.clinical_context_complete
    && String(rule.management.action_target ?? '').includes('newly_added')) {
    fail(
      rule.rule_id,
      'clinical_context_complete=true cannot use newly_added action_target without initiation direction',
    );
  }
  validateDraftReview(rule);
  if (rule.proposed_status !== 'draft_for_review') {
    fail(rule.rule_id, 'proposed_status must be draft_for_review');
  }
  if (rule.suppresses !== undefined) {
    if (!Array.isArray(rule.suppresses)) fail(rule.rule_id, 'suppresses must be an array');
    const targets = new Set();
    for (const target of rule.suppresses) {
      requireNonEmptyString(target, rule.rule_id, 'suppresses entry');
      if (target === rule.rule_id) fail(rule.rule_id, 'must not suppress itself');
      if (targets.has(target)) fail(rule.rule_id, `suppresses contains duplicate target ${target}`);
      targets.add(target);
    }
  }
}

function validateSuppressionGraph(byId) {
  const state = new Map();
  const stack = [];

  const visit = (rule) => {
    state.set(rule.rule_id, 'visiting');
    stack.push(rule.rule_id);
    for (const targetId of rule.suppresses ?? []) {
      if (state.get(targetId) === 'visiting') {
        const cycleStart = stack.indexOf(targetId);
        const cycle = [...stack.slice(cycleStart), targetId];
        fail(rule.rule_id, `suppression cycle detected: ${cycle.join(' -> ')}`);
      }
      if (state.get(targetId) !== 'visited') visit(byId.get(targetId));
    }
    stack.pop();
    state.set(rule.rule_id, 'visited');
  };

  for (const rule of byId.values()) {
    if (!state.has(rule.rule_id)) visit(rule);
  }
}

function maximumRuleSeverityRank(rule) {
  return Math.max(
    SEVERITY_RANK[rule.severity] ?? 0,
    ...rule.context_modifiers.map((modifier) => (
      SEVERITY_RANK[modifier.severity ?? rule.severity] ?? 0
    )),
  );
}

function maximumRuleActionRank(rule) {
  const actions = [
    rule.management.dispense_action,
    ...rule.context_modifiers.flatMap((modifier) => [
      modifier.dispense_action,
      modifier.management_override?.dispense_action,
    ]),
  ];
  if (maximumRuleSeverityRank(rule) === SEVERITY_RANK.contraindicated) {
    actions.push('withhold_and_clarify');
  }
  return Math.max(0, ...actions.map((action) => ACTION_RANK[action] ?? 0));
}

export function validateDraftRules(rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new TypeError('draft interaction pack must contain at least one rule');
  }
  const byId = new Map();
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    validateRule(rule, index);
    if (byId.has(rule.rule_id)) {
      throw new TypeError(`draft interaction pack has duplicate rule_id "${rule.rule_id}"`);
    }
    byId.set(rule.rule_id, rule);
  }
  for (const rule of rules) {
    for (const targetId of rule.suppresses ?? []) {
      const target = byId.get(targetId);
      if (!target) fail(rule.rule_id, `suppresses unknown rule "${targetId}"`);
      if (target.runtime_enabled !== rule.runtime_enabled) {
        fail(rule.rule_id, `must not suppress ${targetId} across runtime status`);
      }
      if (maximumRuleSeverityRank(rule) < maximumRuleSeverityRank(target)
        || maximumRuleActionRank(rule) < maximumRuleActionRank(target)) {
        fail(rule.rule_id, `must not suppress stronger rule ${targetId}`);
      }
    }
  }
  validateSuppressionGraph(byId);
  return rules;
}
