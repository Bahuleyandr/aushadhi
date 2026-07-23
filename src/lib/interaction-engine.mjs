// Context-aware interaction rule engine.
//
// Evaluates a rich interaction rule (optional renal/hepatic context modifiers) and
// enforces the clinician-mandated safety invariants. Resolution order:
//   1. per measurement PRESENT: take the MOST-SPECIFIC matching predicate (its severity
//      + impairment-specific management_override). Different measurements (for example,
//      eGFR and CrCl) remain independent confirmed candidates. This is the ONLY thing
//      that raises clinical severity — a contraindication is a property of a CONFIRMED state.
//   2. per factor ABSENT with `on_unknown: escalate`: does NOT change clinical severity;
//      instead it makes the OPERATIONAL dispense_action more restrictive and records a
//      `data_required` entry (what to obtain, and what the severity WOULD be if confirmed).
//   3. clinical severity = highest among base + present-matched (spec breaks ties);
//      operational dispense_action = most restrictive of the winner + any absent-data action.
//   4. invariant: a CONFIRMED `contraindicated` severity ALWAYS yields
//      `withhold_and_clarify`, computed here — never inherited from the row.
//   Output also carries `action_target` + `do_not_interrupt` (which medicine to withhold /
//   never interrupt) and `data_required` (missing renal/hepatic data to obtain).

const SEV_RANK = { minor: 1, moderate: 2, major: 3, contraindicated: 4 };
const ACT_RANK = {
  supply_with_counselling: 1, space_doses: 2, confirm_and_monitor: 3, withhold_and_clarify: 4,
};
const SEVERITIES = new Set(Object.keys(SEV_RANK));
const DISPENSE_ACTIONS = new Set(Object.keys(ACT_RANK));
const FACTORS = new Set(['renal', 'hepatic']);
const JURISDICTIONS = new Set(['IN', 'US', 'UK', 'EU']);
const ROUTE_ALIASES = {
  im: 'intramuscular',
  iv: 'intravenous',
};
const FORMULATION_ALIASES = {
  fixed_combination: 'fixed_dose_combination',
};
const COMPOSITE_FORMULATIONS = {
  ibuprofen_injection: {
    formulation: 'injection',
    route: 'intravenous',
    drug: 'ibuprofen',
  },
  oral_gel: { formulation: 'gel', route: 'oral' },
  oral_liquid: { formulation: 'liquid', route: 'oral' },
  oral_powder: { formulation: 'powder', route: 'oral' },
  oral_solution: { formulation: 'solution', route: 'oral' },
  oral_suspension: { formulation: 'suspension', route: 'oral' },
  oral_tablet: { formulation: 'tablet', route: 'oral' },
  oromucosal_gel: { formulation: 'gel', route: 'oromucosal' },
};
const ROUTES = new Set([
  'intra_arterial',
  'intramuscular',
  'intravenous',
  'inhaled',
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
const RUNTIME_SELECTOR_KEYS = new Set([
  'drug',
  'substance',
  'class',
  'combination',
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
]);
const RUNTIME_SELECTOR_IDENTITIES = new Set(['drug', 'substance', 'class', 'combination']);
const RUNTIME_ACTION_ROLES = new Set(['object_drug', 'perpetrator_drug']);
// Narrower predicate = more specific (wins within a factor).
const SPECIFICITY = {
  egfr_lt_15: 4, crcl_lt_15: 4, egfr_lt_30: 3, crcl_lt_30: 3, crcl_30_to_50: 3, egfr_lt_60: 2,
  crcl_lt_50: 2, crcl_lt_60: 2, egfr_ge_60: 2, child_pugh_c: 3, child_pugh_b: 2, hepatic_impaired: 1,
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function predicateRequirement(when) {
  if (when.startsWith('egfr_')) return { key: 'renal:egfr', factor: 'renal', metric: 'eGFR' };
  if (when.startsWith('crcl_')) return { key: 'renal:crcl', factor: 'renal', metric: 'CrCl' };
  if (when.startsWith('child_pugh_')) {
    return { key: 'hepatic:child_pugh', factor: 'hepatic', metric: 'Child-Pugh' };
  }
  return { key: 'hepatic:impairment', factor: 'hepatic', metric: 'hepatic impairment status' };
}

function predicateDataPresent(when, ctx) {
  const renal = ctx?.renal || {};
  const hepatic = ctx?.hepatic || {};
  if (when.startsWith('egfr_')) return renal.egfr != null;
  if (when.startsWith('crcl_')) return renal.crcl != null;
  if (when.startsWith('child_pugh_')) return hepatic.child_pugh != null;
  if (when === 'hepatic_impaired') return hepatic.flag != null || hepatic.child_pugh != null;
  return false;
}

function validatePatientContext(ctx) {
  if (!isObject(ctx)) throw new TypeError('patientContext must be an object');
  for (const factor of ['renal', 'hepatic']) {
    if (ctx[factor] !== undefined && ctx[factor] !== null && !isObject(ctx[factor])) {
      throw new TypeError(`patientContext.${factor} must be an object`);
    }
  }
  for (const metric of ['egfr', 'crcl']) {
    const value = ctx.renal?.[metric];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new TypeError(`patientContext.renal.${metric} must be a non-negative finite number`);
    }
  }
  const childPugh = ctx.hepatic?.child_pugh;
  if (childPugh !== undefined && !['A', 'B', 'C'].includes(childPugh)) {
    throw new TypeError('patientContext.hepatic.child_pugh must be A, B, or C');
  }
  const hepaticFlag = ctx.hepatic?.flag;
  if (hepaticFlag !== undefined && !['normal', 'impaired'].includes(hepaticFlag)) {
    throw new TypeError('patientContext.hepatic.flag must be normal or impaired');
  }
  if (ctx.indication !== undefined && (typeof ctx.indication !== 'string' || ctx.indication.trim() === '')) {
    throw new TypeError('patientContext.indication must be a non-empty string');
  }
  if (ctx.jurisdiction !== undefined) {
    if (typeof ctx.jurisdiction !== 'string' || !JURISDICTIONS.has(ctx.jurisdiction.trim().toUpperCase())) {
      throw new TypeError('patientContext.jurisdiction must be IN, US, UK, or EU');
    }
  }
}

function modifierAction(modifier, base) {
  return modifier.management_override?.dispense_action
    ?? modifier.dispense_action
    ?? base.dispense_action
    ?? null;
}

function compareModifiers(left, right, rule) {
  const base = rule.management || {};
  return ((SPECIFICITY[right.when] || 0) - (SPECIFICITY[left.when] || 0))
    || ((SEV_RANK[right.severity ?? rule.severity] || 0)
      - (SEV_RANK[left.severity ?? rule.severity] || 0))
    || ((ACT_RANK[modifierAction(right, base)] || 0) - (ACT_RANK[modifierAction(left, base)] || 0))
    || String(left.when).localeCompare(String(right.when));
}

function validateRuleForEvaluation(rule) {
  if (!isObject(rule)) throw new TypeError('interaction rule must be an object');
  if (typeof rule.rule_id !== 'string' || rule.rule_id.trim() === '') {
    throw new TypeError('interaction rule must have a non-empty rule_id');
  }
  if (!SEVERITIES.has(rule.severity)) {
    throw new TypeError(`interaction rule "${rule.rule_id}" has invalid severity "${String(rule.severity)}"`);
  }
  if (rule.management !== undefined && !isObject(rule.management)) {
    throw new TypeError(`interaction rule "${rule.rule_id}" management must be an object`);
  }
  const baseAction = rule.management?.dispense_action;
  if (baseAction != null && !DISPENSE_ACTIONS.has(baseAction)) {
    throw new TypeError(`interaction rule "${rule.rule_id}" has invalid dispense_action "${baseAction}"`);
  }
  if (!Array.isArray(rule.context_modifiers ?? [])) {
    throw new TypeError(`interaction rule "${rule.rule_id}" context_modifiers must be an array`);
  }
  const jurisdictions = rule.applicability?.jurisdiction;
  if (jurisdictions !== undefined) {
    if (!Array.isArray(jurisdictions)) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" applicability.jurisdiction must be an array`,
      );
    }
    for (const jurisdiction of jurisdictions) {
      if (typeof jurisdiction !== 'string' || !JURISDICTIONS.has(jurisdiction.trim().toUpperCase())) {
        throw new TypeError(
          `interaction rule "${rule.rule_id}" has invalid applicability jurisdiction "${String(jurisdiction)}"`,
        );
      }
    }
  }
  for (const modifier of rule.context_modifiers ?? []) {
    if (!isObject(modifier) || !FACTORS.has(modifier.factor)) {
      throw new TypeError(`interaction rule "${rule.rule_id}" has an invalid context factor`);
    }
    if (!Object.hasOwn(SPECIFICITY, modifier.when)) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" has invalid context predicate "${String(modifier.when)}"`,
      );
    }
    if (predicateRequirement(modifier.when).factor !== modifier.factor) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" predicate ${modifier.when} does not belong to ${modifier.factor}`,
      );
    }
    if (!['base', 'escalate'].includes(modifier.on_unknown)) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" has invalid on_unknown "${String(modifier.on_unknown)}"`,
      );
    }
    if (modifier.severity !== undefined && !SEVERITIES.has(modifier.severity)) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" has invalid modifier severity "${modifier.severity}"`,
      );
    }
    for (const action of [modifier.dispense_action, modifier.management_override?.dispense_action]) {
      if (action !== undefined && !DISPENSE_ACTIONS.has(action)) {
        throw new TypeError(
          `interaction rule "${rule.rule_id}" has invalid modifier dispense_action "${action}"`,
        );
      }
    }
  }
}

function predicateMatches(when, ctx) {
  const r = ctx?.renal || {}, h = ctx?.hepatic || {};
  const { egfr, crcl } = r;
  switch (when) {
    case 'egfr_lt_15': return egfr != null && egfr < 15;
    case 'egfr_lt_30': return egfr != null && egfr < 30;
    case 'egfr_lt_60': return egfr != null && egfr < 60;
    case 'egfr_ge_60': return egfr != null && egfr >= 60;
    case 'crcl_lt_15': return crcl != null && crcl < 15;
    case 'crcl_lt_30': return crcl != null && crcl < 30;
    case 'crcl_lt_50': return crcl != null && crcl < 50;
    case 'crcl_lt_60': return crcl != null && crcl < 60;
    case 'crcl_30_to_50': return crcl != null && crcl >= 30 && crcl < 50;
    case 'hepatic_impaired': return h.flag === 'impaired' || h.child_pugh === 'B' || h.child_pugh === 'C';
    case 'child_pugh_b': return h.child_pugh === 'B';
    case 'child_pugh_c': return h.child_pugh === 'C';
    default: return false;
  }
}

/**
 * Resolve a rule's effective severity + action + management for a patient context.
 * @param {object} rule
 * @param {object} [patientContext] e.g. { renal: { egfr }, hepatic: { child_pugh } }
 * @returns {{ severity: string, dispense_action: string|null, management: object, basis: string }}
 */
export function resolveRule(rule, patientContext = {}) {
  validateRuleForEvaluation(rule);
  validatePatientContext(patientContext);
  const base = rule.management || {};
  // CLINICAL candidates only (base + present-matched). A confirmed present factor is the
  // only thing that can raise clinical severity. spec breaks severity+action ties: a
  // present+matched factor (2) is strictly more specific than base (0).
  const clinical = [{
    severity: rule.severity, action: base.dispense_action ?? null, management: base, source: 'base', spec: 0,
  }];
  // Missing data does NOT change clinical severity — it drives a restrictive OPERATIONAL
  // action and records what to obtain. (A contraindication is a property of a confirmed
  // state, never of absent information.)
  const dataRequired = [];
  const absentActions = [];
  const matchingByRequirement = [];

  const byRequirement = {};
  for (const mod of rule.context_modifiers || []) {
    const key = predicateRequirement(mod.when).key;
    (byRequirement[key] ||= []).push(mod);
  }

  for (const mods of Object.values(byRequirement)) {
    const requirement = predicateRequirement(mods[0].when);
    if (predicateDataPresent(mods[0].when, patientContext)) {
      const matching = mods
        .filter((m) => predicateMatches(m.when, patientContext))
        .sort((a, b) => compareModifiers(a, b, rule));
      if (matching.length) {
        matchingByRequirement.push(matching[0]);
      }
      // present but no predicate matches => reassuring => no candidate; base stands.
    } else {
      // factor absent: an escalate modifier makes the operational action more restrictive and
      // records data_required, but never raises the clinical severity.
      const esc = mods
        .filter((m) => m.on_unknown === 'escalate')
        .sort((a, b) => (
          ((SEV_RANK[b.severity ?? rule.severity] || 0)
            - (SEV_RANK[a.severity ?? rule.severity] || 0))
          || ((ACT_RANK[modifierAction(b, base)] || 0) - (ACT_RANK[modifierAction(a, base)] || 0))
          || ((SPECIFICITY[b.when] || 0) - (SPECIFICITY[a.when] || 0))
          || String(a.when).localeCompare(String(b.when))
      ));
      if (esc.length) {
        const m = esc[0];
        const escAction = m.dispense_action
          ?? m.management_override?.dispense_action
          ?? (m.severity === 'contraindicated' ? 'withhold_and_clarify' : (base.dispense_action ?? null));
        absentActions.push(escAction);
        dataRequired.push({
          factor: requirement.factor,
          metric: requirement.metric,
          would_be_severity: m.severity ?? rule.severity,
          when: m.when,
        });
      }
    }
  }

  for (const modifier of matchingByRequirement) {
    clinical.push({
      severity: modifier.severity ?? rule.severity,
      action: modifierAction(modifier, base),
      management: { ...base, ...(modifier.management_override || {}) },
      source: `present:${modifier.when}`,
      spec: 2,
    });
  }

  clinical.sort((a, b) =>
    ((SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0)) ||
    ((ACT_RANK[b.action] || 0) - (ACT_RANK[a.action] || 0)) ||
    ((b.spec || 0) - (a.spec || 0)) ||
    String(a.source).localeCompare(String(b.source)));

  const win = clinical[0];
  // operational action = most restrictive of the clinical winner and any missing-data escalation.
  let dispense_action = win.action;
  for (const a of absentActions) if ((ACT_RANK[a] || 0) > (ACT_RANK[dispense_action] || 0)) dispense_action = a;
  if (win.severity === 'contraindicated') dispense_action = 'withhold_and_clarify'; // confirmed-state invariant

  const mgmt = win.management;
  return {
    severity: win.severity,
    dispense_action,
    management: mgmt,
    basis: win.source,
    action_target: mgmt.action_target ?? base.action_target ?? null,
    do_not_interrupt: mgmt.do_not_interrupt ?? base.do_not_interrupt ?? [],
    data_required: dataRequired,
  };
}

// ── Matching + collision suppression (#4, #6) ──────────────────────────────

// Cross-jurisdiction INN/USAN synonym normalization so a pharmacist entering either
// spelling matches the same rule/member.
const SYNONYMS = {
  epinephrine: 'adrenaline', norepinephrine: 'noradrenaline', levarterenol: 'noradrenaline',
  meperidine: 'pethidine', cyclosporine: 'ciclosporin', ciclosporine: 'ciclosporin',
  rifampin: 'rifampicin', acetaminophen: 'paracetamol', salbutamol: 'albuterol',
  norethindrone: 'norethisterone', phenobarbitone: 'phenobarbital',
  'dolasetron mesylate': 'dolasetron',
};
export function canonicalDrug(name) {
  const n = String(name).trim().toLowerCase();
  return SYNONYMS[n] || n;
}

function canonicalScopeValue(value, aliases) {
  const normalized = String(value).trim().toLowerCase();
  return aliases[normalized] || normalized;
}

function canonicalRoute(value) {
  return canonicalScopeValue(value, ROUTE_ALIASES);
}

function canonicalFormulation(value) {
  const normalized = canonicalScopeValue(value, FORMULATION_ALIASES);
  return COMPOSITE_FORMULATIONS[normalized]?.formulation ?? normalized;
}

function compositeFormulation(value) {
  const normalized = canonicalScopeValue(value, FORMULATION_ALIASES);
  return COMPOSITE_FORMULATIONS[normalized] ?? null;
}

function assertPresentationCoherence({
  drug,
  route,
  formulation,
  label = 'structured interaction subject',
}) {
  const composite = formulation == null ? null : compositeFormulation(formulation);
  if (composite === null) return;
  if (route !== null && canonicalRoute(route) !== composite.route) {
    throw new TypeError(
      `${label} formulation "${formulation}" requires route "${composite.route}"`,
    );
  }
  if (composite.drug !== undefined && canonicalDrug(drug) !== composite.drug) {
    throw new TypeError(
      `${label} formulation "${formulation}" requires drug "${composite.drug}"`,
    );
  }
}

function normalizeSubject(subject) {
  if (typeof subject === 'string') {
    if (subject.trim() === '') throw new TypeError('interaction subject must be a non-empty string');
    return {
      drug: canonicalDrug(subject),
      route: null,
      formulation: null,
      structured: false,
    };
  }
  if (!isObject(subject)) {
    throw new TypeError('interaction subject must be a drug string or an object');
  }
  for (const key of Object.keys(subject)) {
    if (!['drug', 'route', 'formulation'].includes(key)) {
      throw new TypeError(`structured interaction subject has unknown property ${key}`);
    }
  }
  if (typeof subject.drug !== 'string' || subject.drug.trim() === '') {
    throw new TypeError('structured interaction subject requires a non-empty drug');
  }
  for (const field of ['route', 'formulation']) {
    if (subject[field] !== undefined
      && subject[field] !== null
      && (typeof subject[field] !== 'string' || subject[field].trim() === '')) {
      throw new TypeError(`structured interaction subject ${field} must be a non-empty string`);
    }
  }
  const route = subject.route == null ? null : canonicalRoute(subject.route);
  assertPresentationCoherence({
    drug: subject.drug,
    route,
    formulation: subject.formulation,
  });
  const formulation = subject.formulation == null
    ? null
    : canonicalFormulation(subject.formulation);
  if (route !== null && !ROUTES.has(route)) {
    throw new TypeError(`structured interaction subject has unsupported route "${subject.route}"`);
  }
  if (formulation !== null && !FORMULATIONS.has(formulation)) {
    throw new TypeError(
      `structured interaction subject has unsupported formulation "${subject.formulation}"`,
    );
  }
  return {
    drug: canonicalDrug(subject.drug),
    route,
    formulation,
    structured: true,
  };
}

function subjectKey(subject) {
  return JSON.stringify([subject.drug, subject.route, subject.formulation]);
}

function subjectOutput(subject) {
  if (subject === null) return null;
  if (!subject.structured) return subject.drug;
  return {
    drug: subject.drug,
    ...(subject.route === null ? {} : { route: subject.route }),
    ...(subject.formulation === null ? {} : { formulation: subject.formulation }),
  };
}

function classMembers(ref, memberSets) {
  const excluded = new Set((ref.member_exceptions || []).map(canonicalDrug));
  // An inline members[] allowlist pins matching to exactly those drugs (still minus
  // member_exceptions), letting a rule scope a class without editing the global set.
  let names;
  if (Array.isArray(ref.members)) {
    names = ref.members;
  } else {
    const set = memberSets[ref.class] || {};
    const strengths = ref.strength && ref.strength.length ? ref.strength : Object.keys(set);
    names = strengths.flatMap((s) => set[s] || []);
  }
  return new Set(names.map(canonicalDrug).filter((n) => !excluded.has(n)));
}

function satisfiesIdentity(subject, ref, memberSets) {
  if (!ref) return false;
  if (ref.drug) return subject.drug === canonicalDrug(ref.drug);
  if (ref.substance) return subject.drug === canonicalDrug(ref.substance);
  if (ref.combination) {
    return ref.combination.every((candidate) => canonicalDrug(candidate.drug) === subject.drug);
  }
  if (ref.class) return classMembers(ref, memberSets).has(subject.drug);
  return false;
}

function routeScopeIsAmbiguous(actual, allowed) {
  return ['systemic', 'parenteral'].includes(actual)
    || allowed.some((value) => ['systemic', 'parenteral'].includes(value));
}

function formulationScopeIsAmbiguous(actual, allowed) {
  const releaseProfile = (value) => {
    if (value.startsWith('immediate_release')) return 'immediate';
    if (value.startsWith('delayed_release')) return 'delayed';
    if (value.startsWith('extended_release') || value === 'wax_matrix_tablet') return 'extended';
    return null;
  };
  const actualRelease = releaseProfile(actual);
  if (actualRelease !== null && allowed.some((value) => {
    const allowedRelease = releaseProfile(value);
    return allowedRelease !== null && allowedRelease !== actualRelease;
  })) {
    return false;
  }
  const family = (value) => {
    if (value === 'tablet' || value.endsWith('_tablet')) return 'tablet';
    if (releaseProfile(value) !== null) return `release_${releaseProfile(value)}`;
    if (['oral', 'solid_oral', 'solid_modified_release'].includes(value)) return 'broad_oral';
    if (value === 'injection' || value.endsWith('_injection')) return 'injection';
    return value;
  };
  return allowed.some((value) => family(value) === family(actual)
    || family(value) === 'broad_oral'
    || family(actual) === 'broad_oral'
    || (family(value).startsWith('release_') && family(actual) === 'tablet')
    || (family(actual).startsWith('release_') && family(value) === 'tablet'));
}

function scopeDisposition(actual, allowed, canonicalize, isAmbiguous) {
  if (!Array.isArray(allowed) || allowed.length === 0) return 'matched';
  if (actual === null) return 'unknown';
  const normalizedAllowed = allowed.map(canonicalize);
  if (normalizedAllowed.includes(actual)) return 'matched';
  return isAmbiguous(actual, normalizedAllowed) ? 'unknown' : 'mismatch';
}

function effectiveSelectorRoutes(ref) {
  if (Array.isArray(ref.route) && ref.route.length > 0) return ref.route;
  if (!Array.isArray(ref.formulation) || ref.formulation.length === 0) return ref.route;
  const composites = ref.formulation.map(compositeFormulation);
  if (composites.some((composite) => composite === null)) return ref.route;
  const implied = [...new Set(composites.map((composite) => composite.route))];
  return implied.length === 1 ? implied : ref.route;
}

function subjectRefMatch(subject, ref, role) {
  if (!satisfiesIdentity(subject, ref, role.memberSets)) return null;
  const constraints = [
    {
      factor: 'route',
      actual: subject.route,
      allowed: effectiveSelectorRoutes(ref),
      canonicalize: canonicalRoute,
      isAmbiguous: routeScopeIsAmbiguous,
    },
    {
      factor: 'formulation',
      actual: subject.formulation,
      allowed: ref.formulation,
      canonicalize: canonicalFormulation,
      isAmbiguous: formulationScopeIsAmbiguous,
    },
  ];
  const requirements = [];
  for (const constraint of constraints) {
    const disposition = scopeDisposition(
      constraint.actual,
      constraint.allowed,
      constraint.canonicalize,
      constraint.isAmbiguous,
    );
    if (disposition === 'mismatch') return { disposition, requirements: [] };
    if (disposition === 'unknown') {
      requirements.push({
        factor: constraint.factor,
        metric: `${constraint.factor} for ${subject.drug}`,
        reason: `${role.label} requires a supported ${constraint.factor}`,
        options: [...new Set(constraint.allowed.map(constraint.canonicalize))],
      });
    }
  }
  return {
    disposition: requirements.length === 0 ? 'matched' : 'unknown',
    requirements,
  };
}

function ruleSides(rule) {
  return [rule.object, rule.perpetrator ?? rule.second_subject ?? rule.coadministered_with];
}

function ruleMatchesPair(rule, a, b, memberSets) {
  const [o, p] = ruleSides(rule);
  const candidates = [
    {
      subjects: { object: a, perpetrator: b },
      matches: [
        subjectRefMatch(a, o, { label: 'object', memberSets }),
        subjectRefMatch(b, p, { label: 'perpetrator', memberSets }),
      ],
    },
    {
      subjects: { object: b, perpetrator: a },
      matches: [
        subjectRefMatch(b, o, { label: 'object', memberSets }),
        subjectRefMatch(a, p, { label: 'perpetrator', memberSets }),
      ],
    },
  ]
    .filter(({ matches }) => matches.every((match) => (
      match !== null && match.disposition !== 'mismatch'
    )))
    .map(({ subjects, matches }) => ({
      subjects,
      requirements: matches.flatMap((match) => match.requirements),
    }))
    .sort((left, right) => (
      left.requirements.length - right.requirements.length
      || subjectKey(left.subjects.object).localeCompare(subjectKey(right.subjects.object))
      || subjectKey(left.subjects.perpetrator).localeCompare(subjectKey(right.subjects.perpetrator))
    ));
  if (candidates.length === 0) return null;
  const selected = candidates[0];
  const competing = candidates.find((candidate, index) => (
    index > 0
    && candidate.requirements.length === selected.requirements.length
    && (
      subjectKey(candidate.subjects.object) !== subjectKey(selected.subjects.object)
      || subjectKey(candidate.subjects.perpetrator) !== subjectKey(selected.subjects.perpetrator)
    )
  ));
  if (competing !== undefined) {
    selected.requirements.push({
      factor: 'subject_role',
      metric: 'object/perpetrator role assignment',
      reason: 'both unordered subject orientations satisfy the rule selectors',
      options: ['confirm reviewed object and perpetrator roles'],
    });
  }
  return selected;
}

function mergeRequirements(requirements) {
  const merged = new Map();
  for (const requirement of requirements) {
    const key = JSON.stringify([
      requirement.factor,
      requirement.metric,
      requirement.reason,
    ]);
    const prior = merged.get(key);
    if (prior === undefined) {
      merged.set(key, { ...requirement, options: [...requirement.options] });
    } else {
      prior.options = [...new Set([...prior.options, ...requirement.options])];
    }
  }
  return [...merged.values()];
}

// Free-text indication values are not a reviewed terminology mapping. Until the
// runtime model carries a bound code-system mapping, they must never exclude a rule.
function indicationMatches() {
  return true;
}

function indicationScope(rule) {
  const ind = rule.applicability?.indication;
  return Array.isArray(ind) && ind.length ? { indication_scope: ind } : {};
}

function ruleJurisdictions(rule) {
  const jurisdictions = rule.applicability?.jurisdiction;
  if (!Array.isArray(jurisdictions)) return null;
  return jurisdictions.map((jurisdiction) => jurisdiction.trim().toUpperCase());
}

function jurisdictionDisposition(rule, patientContext) {
  const jurisdictions = ruleJurisdictions(rule);
  if (jurisdictions === null) return 'unscoped';
  if (jurisdictions.length === 0) return 'unresolved_rule_scope';
  if (patientContext?.jurisdiction == null) return 'unknown_context';
  const jurisdiction = patientContext.jurisdiction.trim().toUpperCase();
  return jurisdictions.includes(jurisdiction) ? 'matched' : 'mismatch';
}

function jurisdictionMatches(rule, patientContext) {
  return jurisdictionDisposition(rule, patientContext) !== 'mismatch';
}

function jurisdictionScope(rule) {
  const jurisdictions = ruleJurisdictions(rule);
  return jurisdictions === null ? {} : { jurisdiction_scope: jurisdictions };
}

// When a rule's label action DIFFERS by indication and the patient indication is UNKNOWN,
// the engine must not assert an indication-specific action. Instead it returns a
// clarify-indication posture (withhold_and_clarify + data_required: indication) so the
// pharmacist obtains the indication rather than being shown one arbitrary pathway.
function applyIndicationUnknown(rule, finding, patientContext) {
  const ind = rule.applicability?.indication;
  if (Array.isArray(ind) && ind.length) {
    return {
      ...finding,
      dispense_action: 'withhold_and_clarify',
      clinical_action_status: 'unresolved_pending_indication',
      management: {},
      action_target: null,
      do_not_interrupt: [],
      data_required: [...(finding.data_required || []), { factor: 'indication', reason: `label action differs by indication (${ind.join(' / ')})`, options: ind }],
    };
  }
  return finding;
}

function applyJurisdictionUnknown(rule, finding, patientContext) {
  const disposition = jurisdictionDisposition(rule, patientContext);
  if (disposition === 'matched' || disposition === 'unscoped') return finding;
  const jurisdictions = ruleJurisdictions(rule) ?? [];
  const reason = disposition === 'unresolved_rule_scope'
    ? 'rule has no accepted jurisdiction scope'
    : `jurisdiction-specific action requires one of: ${jurisdictions.join(' / ')}`;
  return {
    ...finding,
    clinical_action_status: 'unresolved_pending_jurisdiction',
    dispense_action: 'withhold_and_clarify',
    management: {},
    action_target: null,
    do_not_interrupt: [],
    data_required: [
      ...(finding.data_required || []),
      {
        factor: 'jurisdiction',
        metric: 'regulatory jurisdiction',
        reason,
        options: jurisdictions,
      },
    ],
  };
}

function applySubjectScopeUnknown(finding, requirements) {
  if (!Array.isArray(requirements) || requirements.length === 0) return finding;
  const alreadyUnresolved = typeof finding.clinical_action_status === 'string'
    && finding.clinical_action_status.startsWith('unresolved_pending_');
  const factors = new Set(requirements.map((requirement) => requirement.factor));
  const subjectStatus = factors.size === 1 && factors.has('subject_role')
    ? 'unresolved_pending_subject_role'
    : 'unresolved_pending_route_or_formulation';
  return {
    ...finding,
    clinical_action_status: alreadyUnresolved
      ? 'unresolved_pending_applicability'
      : subjectStatus,
    dispense_action: 'withhold_and_clarify',
    management: {},
    action_target: null,
    do_not_interrupt: [],
    data_required: [...(finding.data_required || []), ...requirements],
  };
}

function applyApplicabilityUnknown(rule, finding, patientContext, subjectRequirements = []) {
  return applySubjectScopeUnknown(applyJurisdictionUnknown(
    rule,
    applyIndicationUnknown(rule, finding, patientContext),
    patientContext,
  ), subjectRequirements);
}

function isUnresolvedFinding(finding) {
  return typeof finding.clinical_action_status === 'string'
    && finding.clinical_action_status.startsWith('unresolved_pending_');
}

function canExplicitlySuppress(suppressor, candidate, rulesById) {
  const suppresses = rulesById[suppressor.rule_id]?.suppresses;
  return Array.isArray(suppresses)
    && suppresses.includes(candidate.rule_id)
    && suppressor.runtime_enabled === candidate.runtime_enabled
    && !isUnresolvedFinding(suppressor)
    && !isUnresolvedFinding(candidate)
    && (SEV_RANK[suppressor.severity] ?? 0) >= (SEV_RANK[candidate.severity] ?? 0)
    && (ACT_RANK[suppressor.dispense_action] ?? 0)
      >= (ACT_RANK[candidate.dispense_action] ?? 0);
}

function runtimeEnabled(rule) {
  return rule.runtime_enabled === true;
}

function pairMatcherExecutable(rule) {
  return rule.runtime_status?.pair_matcher_executable !== false;
}

function maximumRuleSeverityRank(rule) {
  return Math.max(
    SEV_RANK[rule.severity] ?? 0,
    ...(rule.context_modifiers ?? []).map((modifier) => (
      SEV_RANK[modifier.severity ?? rule.severity] ?? 0
    )),
  );
}

function maximumRuleActionRank(rule) {
  const actions = [
    rule.management?.dispense_action,
    ...(rule.context_modifiers ?? []).flatMap((modifier) => [
      modifier.dispense_action,
      modifier.management_override?.dispense_action,
    ]),
  ];
  if (maximumRuleSeverityRank(rule) === SEV_RANK.contraindicated) {
    actions.push('withhold_and_clarify');
  }
  return Math.max(0, ...actions.map((action) => ACT_RANK[action] ?? 0));
}

function validateRuntimeEnabledMirror(rule, index) {
  const label = typeof rule?.rule_id === 'string' && rule.rule_id.trim() !== ''
    ? `interaction rule "${rule.rule_id}"`
    : `interaction rule at index ${index}`;
  if (typeof rule?.runtime_enabled !== 'boolean') {
    throw new TypeError(`${label} runtime_enabled must be a boolean`);
  }
  if (!isObject(rule.runtime_status)
    || typeof rule.runtime_status.runtime_enabled !== 'boolean'
    || rule.runtime_status.runtime_enabled !== rule.runtime_enabled) {
    throw new TypeError(
      `${label} runtime_enabled must mirror runtime_status.runtime_enabled and both must be boolean`,
    );
  }
}

function validateRuntimeActionOwnership(rule) {
  if (maximumRuleActionRank(rule) < ACT_RANK.withhold_and_clarify) return;

  const validateOwnership = (management, label) => {
    const actionTarget = management?.action_target;
    if (!RUNTIME_ACTION_ROLES.has(actionTarget)) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" ${label}.action_target must be object_drug or perpetrator_drug`,
      );
    }
    const doNotInterrupt = management?.do_not_interrupt;
    if (!Array.isArray(doNotInterrupt)
      || doNotInterrupt.length !== 1
      || !RUNTIME_ACTION_ROLES.has(doNotInterrupt[0])) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" ${label}.do_not_interrupt must contain exactly one role-bound object_drug or perpetrator_drug`,
      );
    }
    if (doNotInterrupt[0] === actionTarget) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" ${label} cannot both target and protect ${actionTarget}`,
      );
    }
  };

  validateOwnership(rule.management, 'management');
  for (const modifier of rule.context_modifiers ?? []) {
    const branchSeverity = modifier.severity ?? rule.severity;
    const branchAction = branchSeverity === 'contraindicated'
      ? 'withhold_and_clarify'
      : modifierAction(modifier, rule.management);
    if (branchAction !== 'withhold_and_clarify') continue;
    validateOwnership(
      { ...rule.management, ...(modifier.management_override ?? {}) },
      `context modifier ${modifier.when}`,
    );
  }
}

function validateSuppressionGraph(rules, byId) {
  for (const rule of rules) {
    if (rule.suppresses === undefined) continue;
    if (!Array.isArray(rule.suppresses)) {
      throw new TypeError(`interaction rule "${rule.rule_id}" suppresses must be an array`);
    }
    const targets = new Set();
    for (const targetId of rule.suppresses) {
      if (typeof targetId !== 'string' || targetId.trim() === '') {
        throw new TypeError(
          `interaction rule "${rule.rule_id}" suppresses must contain non-empty rule IDs`,
        );
      }
      if (targets.has(targetId)) {
        throw new TypeError(
          `interaction rule "${rule.rule_id}" suppresses contains duplicate target "${targetId}"`,
        );
      }
      targets.add(targetId);
      if (targetId === rule.rule_id) {
        throw new TypeError(`interaction rule "${rule.rule_id}" must not suppress itself`);
      }
      const target = byId.get(targetId);
      if (target === undefined) {
        throw new TypeError(
          `interaction rule "${rule.rule_id}" suppresses unknown rule "${targetId}"`,
        );
      }
      if (runtimeEnabled(target) !== runtimeEnabled(rule)) {
        throw new TypeError(
          `interaction rule "${rule.rule_id}" must not suppress "${targetId}" across runtime status`,
        );
      }
      if (maximumRuleSeverityRank(rule) < maximumRuleSeverityRank(target)
        || maximumRuleActionRank(rule) < maximumRuleActionRank(target)) {
        throw new TypeError(
          `interaction rule "${rule.rule_id}" must not suppress stronger rule "${targetId}"`,
        );
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (rule) => {
    if (visiting.has(rule.rule_id)) {
      throw new TypeError(
        `interaction rule pack contains a suppression cycle at "${rule.rule_id}"`,
      );
    }
    if (visited.has(rule.rule_id)) return;
    visiting.add(rule.rule_id);
    for (const targetId of rule.suppresses ?? []) visit(byId.get(targetId));
    visiting.delete(rule.rule_id);
    visited.add(rule.rule_id);
  };
  for (const rule of rules) visit(rule);
}

function validateRuleSet(rules) {
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');
  const byId = new Map();
  for (const rule of rules) {
    validateRuleForEvaluation(rule);
    if (byId.has(rule.rule_id)) {
      throw new TypeError(`interaction rule pack has duplicate rule_id "${rule.rule_id}"`);
    }
    byId.set(rule.rule_id, rule);
  }
  validateSuppressionGraph(rules, byId);
}

function validateRuntimeStringList(
  value,
  ruleId,
  label,
  {
    allowed = null,
    canonicalize = (entry) => entry,
    nonEmpty = false,
  } = {},
) {
  if (!Array.isArray(value)) {
    throw new TypeError(`interaction rule "${ruleId}" ${label} must be an array`);
  }
  if (nonEmpty && value.length === 0) {
    throw new TypeError(`interaction rule "${ruleId}" ${label} must be a non-empty array`);
  }
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new TypeError(
        `interaction rule "${ruleId}" ${label} must contain non-empty strings`,
      );
    }
    const canonical = canonicalize(entry);
    if (allowed !== null && !allowed.has(canonical)) {
      throw new TypeError(
        `interaction rule "${ruleId}" ${label} has unsupported value "${entry}"`,
      );
    }
    if (seen.has(canonical)) {
      throw new TypeError(`interaction rule "${ruleId}" ${label} contains duplicate ${entry}`);
    }
    seen.add(canonical);
  }
}

function validateRuntimeSubjectRef(ref, ruleId, label) {
  if (!isObject(ref)) {
    throw new TypeError(`interaction rule "${ruleId}" requires ${label}`);
  }
  for (const key of Object.keys(ref)) {
    if (!RUNTIME_SELECTOR_KEYS.has(key)) {
      throw new TypeError(
        `interaction rule "${ruleId}" ${label} contains unsupported selector context ${key}`,
      );
    }
  }
  const identities = [...RUNTIME_SELECTOR_IDENTITIES].filter((key) => ref[key] !== undefined);
  if (identities.length !== 1) {
    throw new TypeError(
      `interaction rule "${ruleId}" ${label} requires exactly one identity selector`,
    );
  }
  for (const identity of identities.filter((key) => key !== 'combination')) {
    if (typeof ref[identity] !== 'string' || ref[identity].trim() === '') {
      throw new TypeError(
        `interaction rule "${ruleId}" ${label}.${identity} must be a non-empty string`,
      );
    }
  }
  if (ref.combination !== undefined) {
    throw new TypeError(
      `interaction rule "${ruleId}" ${label}.combination is manual-review only and cannot be runtime promoted`,
    );
  }
  validateRuntimeStringList(ref.route, ruleId, `${label}.route`, {
    allowed: ROUTES,
    canonicalize: canonicalRoute,
    nonEmpty: true,
  });
  if (ref.route.some((route) => ABSTRACT_RUNTIME_ROUTES.has(canonicalRoute(route)))) {
    throw new TypeError(
      `interaction rule "${ruleId}" ${label}.route contains an abstract runtime scope`,
    );
  }
  if (ref.route.length !== 1) {
    throw new TypeError(
      `interaction rule "${ruleId}" ${label}.route must select exactly one concrete route`,
    );
  }
  validateRuntimeStringList(ref.formulation, ruleId, `${label}.formulation`, {
    allowed: FORMULATIONS,
    canonicalize: canonicalFormulation,
    nonEmpty: true,
  });
  if (ref.formulation.some(
    (formulation) => ABSTRACT_RUNTIME_FORMULATIONS.has(canonicalFormulation(formulation)),
  )) {
    throw new TypeError(
      `interaction rule "${ruleId}" ${label}.formulation contains an abstract runtime scope`,
    );
  }
  if (ref.formulation.length !== 1) {
    throw new TypeError(
      `interaction rule "${ruleId}" ${label}.formulation must select exactly one concrete formulation`,
    );
  }
  const canonicalRoutes = new Set(ref.route.map(canonicalRoute));
  for (const formulation of ref.formulation) {
    const composite = compositeFormulation(formulation);
    if (composite === null) continue;
    if (!canonicalRoutes.has(composite.route)) {
      throw new TypeError(
        `interaction rule "${ruleId}" ${label}.formulation "${formulation}" requires route "${composite.route}"`,
      );
    }
    const identity = ref.drug ?? ref.substance;
    if (composite.drug !== undefined
      && (typeof identity !== 'string' || canonicalDrug(identity) !== composite.drug)) {
      throw new TypeError(
        `interaction rule "${ruleId}" ${label}.formulation "${formulation}" requires drug "${composite.drug}"`,
      );
    }
  }
  for (const field of ['members', 'member_exceptions', 'strength']) {
    if (ref[field] !== undefined && ref[field] !== null) {
      validateRuntimeStringList(ref[field], ruleId, `${label}.${field}`);
    }
  }
  if (ref.class !== undefined
    && (!Array.isArray(ref.members) || ref.members.length === 0)) {
    throw new TypeError(
      `interaction rule "${ruleId}" ${label}.class requires an inline pinned members roster`,
    );
  }
  if (ref.class !== undefined && runtimeSelectorMembers(ref).size === 0) {
    throw new TypeError(
      `interaction rule "${ruleId}" ${label}.class has an empty effective canonical roster after member_exceptions`,
    );
  }
  if (ref.match_semantics !== undefined) {
    throw new TypeError(
      `interaction rule "${ruleId}" ${label}.match_semantics is unsupported at runtime`,
    );
  }
}

function runtimeSelectorMembers(ref) {
  if (ref.drug !== undefined) return new Set([canonicalDrug(ref.drug)]);
  if (ref.substance !== undefined) return new Set([canonicalDrug(ref.substance)]);
  if (ref.class !== undefined) {
    const exceptions = new Set((ref.member_exceptions ?? []).map(canonicalDrug));
    return new Set(ref.members.map(canonicalDrug).filter((member) => !exceptions.has(member)));
  }
  return new Set();
}

function validateRuntimeRoleDisjoint(rule, otherSide) {
  const objectMembers = runtimeSelectorMembers(rule.object);
  const otherMembers = runtimeSelectorMembers(otherSide);
  const overlap = [...objectMembers].filter((member) => otherMembers.has(member));
  if (overlap.length > 0) {
    throw new TypeError(
      `interaction rule "${rule.rule_id}" has overlapping runtime role selectors: ${overlap.join(', ')}`,
    );
  }
}

function runtimeEvidenceVersion(evidence, ruleId, index) {
  const fields = [
    evidence?.source_policy_id,
    evidence?.document_id,
    evidence?.document_version,
  ];
  if (fields.some((value) => (
    (typeof value !== 'string' && typeof value !== 'number')
    || String(value).trim() === ''
  ))) {
    throw new TypeError(
      `interaction rule "${ruleId}" evidence[${index}] cannot bind a source version`,
    );
  }
  return fields.map((value) => String(value).trim()).join(':');
}

function validateRuntimeEvidence(rule) {
  if (!Array.isArray(rule.evidence) || rule.evidence.length === 0) {
    throw new TypeError(`interaction rule "${rule.rule_id}" requires reviewed evidence`);
  }
  const expectedVersions = rule.evidence.map((evidence, index) => {
    if (evidence?.review_status !== 'clinician_reviewed') {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" evidence[${index}] requires review_status=clinician_reviewed`,
      );
    }
    const evidenceDate = evidence.retrieved_at ?? evidence.source_date;
    if (evidenceDate !== undefined) {
      if (!isIsoReviewDate(evidenceDate)) {
        throw new TypeError(
          `interaction rule "${rule.rule_id}" evidence[${index}] has an invalid evidence date`,
        );
      }
      if (Date.parse(`${evidenceDate.slice(0, 10)}T23:59:59.999Z`)
          > Date.parse(`${rule.review.reviewed_at.slice(0, 10)}T23:59:59.999Z`)) {
        throw new TypeError(
          `interaction rule "${rule.rule_id}" review predates evidence[${index}]`,
        );
      }
    }
    return runtimeEvidenceVersion(evidence, rule.rule_id, index);
  }).sort();
  const declaredVersions = [...rule.review.source_versions].sort();
  if (JSON.stringify(declaredVersions) !== JSON.stringify(expectedVersions)) {
    throw new TypeError(
      `interaction rule "${rule.rule_id}" review.source_versions must exactly bind evidence as source_policy_id:document_id:document_version`,
    );
  }
}

/**
 * Check one drug pair against a rule pack. Applies generic-vs-specific collision
 * suppression (most-specific matching rule wins) and resolves each survivor's
 * context. Returns one finding per surviving rule.
 */
export function checkPair({
  subjects,
  rules,
  memberSets = {},
  patientContext = {},
  includeDiagnostic = true,
}) {
  validateRuleSet(rules);
  validatePatientContext(patientContext);
  if (!Array.isArray(subjects) || subjects.length !== 2) {
    throw new TypeError('subjects must contain exactly two interaction subjects');
  }
  const normalizedSubjects = subjects.map(normalizeSubject);
  return checkNormalizedPair({
    subjects: normalizedSubjects,
    rules,
    memberSets,
    patientContext,
    includeDiagnostic,
  });
}

function checkNormalizedPair({
  subjects,
  rules,
  memberSets,
  patientContext,
  includeDiagnostic,
}) {
  const [a, b] = subjects;
  const statusEligibleRules = includeDiagnostic ? rules : rules.filter(runtimeEnabled);
  const evaluatedRules = statusEligibleRules.filter(pairMatcherExecutable);
  const matched = evaluatedRules
    .map((rule) => ({ rule, match: ruleMatchesPair(rule, a, b, memberSets) }))
    .filter(({ match }) => match !== null)
    .filter(({ rule }) => indicationMatches(rule, patientContext))
    .filter(({ rule }) => jurisdictionMatches(rule, patientContext));
  if (!matched.length) return [];
  const findings = matched
    .map(({ rule, match }) => applyApplicabilityUnknown(rule, {
      rule_id: rule.rule_id,
      runtime_enabled: runtimeEnabled(rule),
      subject_roles: {
        object: subjectOutput(match.subjects.object),
        perpetrator: subjectOutput(match.subjects.perpetrator),
      },
      ...indicationScope(rule),
      ...jurisdictionScope(rule),
      ...resolveRule(rule, patientContext),
    }, patientContext, match.requirements));
  const rulesById = Object.fromEntries(evaluatedRules.map((rule) => [rule.rule_id, rule]));
  return findings.filter((candidate) => !findings.some((suppressor) => (
    canExplicitlySuppress(suppressor, candidate, rulesById)
  )));
}

// ── n-ary (all_of_present combination) matching ────────────────────────────
// Some rules require N>2 agents present at once (e.g. triple antithrombotic therapy:
// aspirin AND a P2Y12 inhibitor AND an oral anticoagulant). These cannot be expressed
// as unordered pairs; they are matched against the whole subject set, requiring a
// DISTINCT subject for each combination member and for the other side.

function isNaryRule(rule) {
  return [rule.object, rule.perpetrator].some(
    (s) => s && Array.isArray(s.combination) && s.combination.length > 1,
  );
}

function collectMemberCoverage(ruleId, ref, memberSets, referenced, gaps) {
  if (!ref) return;
  if (ref.class) {
    referenced.add(ref.class);
    if (Array.isArray(ref.members)) {
      if (ref.members.length === 0) {
        gaps.push({ rule_id: ruleId, class: ref.class, reason: 'empty_inline_members' });
      }
    } else {
      const classSet = memberSets[ref.class];
      if (!isObject(classSet)) {
        gaps.push({ rule_id: ruleId, class: ref.class, reason: 'missing_class' });
      } else {
        const strengths = Array.isArray(ref.strength) && ref.strength.length
          ? ref.strength
          : Object.keys(classSet);
        if (strengths.length === 0) {
          gaps.push({ rule_id: ruleId, class: ref.class, reason: 'empty_class' });
        }
        for (const strength of strengths) {
          if (!Object.hasOwn(classSet, strength)) {
            gaps.push({
              rule_id: ruleId,
              class: ref.class,
              strength,
              reason: 'missing_strength_bucket',
            });
          } else if (!Array.isArray(classSet[strength]) || classSet[strength].length === 0) {
            gaps.push({
              rule_id: ruleId,
              class: ref.class,
              strength,
              reason: 'empty_strength_bucket',
            });
          }
        }
      }
    }
  }
  if (Array.isArray(ref.combination)) {
    for (const member of ref.combination) {
      collectMemberCoverage(ruleId, member, memberSets, referenced, gaps);
    }
  }
}

// Assign a distinct subject to each ref (backtracking); returns the assignment or null.
function assignDistinct(refs, subjects, memberSets) {
  const chosen = new Array(refs.length).fill(null);
  const used = new Set();
  let best = null;
  const backtrack = (i) => {
    if (i === refs.length) {
      const matches = chosen.map((subject, index) => (
        subjectRefMatch(subject, refs[index], {
          label: `combination member ${index + 1}`,
          memberSets,
        })
      ));
      const candidate = {
        subjects: [...chosen],
        requirements: matches.flatMap((match) => match.requirements),
      };
      if (best === null || candidate.requirements.length < best.requirements.length) {
        best = candidate;
      }
      return;
    }
    for (let s = 0; s < subjects.length; s += 1) {
      if (used.has(s)) continue;
      const match = subjectRefMatch(subjects[s], refs[i], {
        label: `combination member ${i + 1}`,
        memberSets,
      });
      if (match !== null && match.disposition !== 'mismatch') {
        used.add(s);
        chosen[i] = subjects[s];
        backtrack(i + 1);
        used.delete(s);
        chosen[i] = null;
      }
    }
  };
  backtrack(0);
  return best;
}

function matchNaryRule(rule, subjects, memberSets) {
  const comboSide = [rule.object, rule.perpetrator].find(
    (s) => s && Array.isArray(s.combination) && s.combination.length > 1,
  );
  const otherSide = comboSide === rule.object ? rule.perpetrator : rule.object;
  const refs = [...comboSide.combination];
  if (otherSide) refs.push(otherSide);
  const match = assignDistinct(refs, subjects, memberSets);
  if (match === null) return null;
  const combinationSubjects = match.subjects.slice(0, comboSide.combination.length);
  for (let index = 0; index < combinationSubjects.length; index += 1) {
    const subject = combinationSubjects[index];
    const outerMatch = subjectRefMatch(
      subject,
      {
        drug: subject.drug,
        route: comboSide.route,
        formulation: comboSide.formulation,
      },
      {
        label: `combination outer scope member ${index + 1}`,
        memberSets,
      },
    );
    if (outerMatch.disposition === 'mismatch') return null;
    match.requirements.push(...outerMatch.requirements);
  }
  match.requirements = mergeRequirements(match.requirements);
  const otherSubject = match.subjects[comboSide.combination.length] ?? null;
  match.subjectRoles = comboSide === rule.object
    ? { object: combinationSubjects, perpetrator: otherSubject }
    : { object: otherSubject, perpetrator: combinationSubjects };
  return match;
}

/**
 * Evaluate the entered drugs against the rule pack: every unordered pair against the
 * pairwise rules, plus each n-ary (all_of_present combination) rule against the whole
 * set. Reports honest coverage — including rule classes with no member data (which can
 * therefore never match), recursing into combination members, so callers never present
 * a gap as "no interaction".
 */
export function checkInteractions({
  subjects,
  rules,
  memberSets = {},
  patientContext = {},
  includeDiagnostic = true,
}) {
  validateRuleSet(rules);
  validatePatientContext(patientContext);
  if (!Array.isArray(subjects)) throw new TypeError('subjects must be an array');
  const normalizedSubjects = [];
  const seenSubjects = new Set();
  for (const subject of subjects.map(normalizeSubject)) {
    const key = subjectKey(subject);
    if (seenSubjects.has(key)) continue;
    seenSubjects.add(key);
    normalizedSubjects.push(subject);
  }
  const statusEligibleRules = includeDiagnostic ? rules : rules.filter(runtimeEnabled);
  const evaluatedRules = statusEligibleRules.filter(pairMatcherExecutable);
  const naryRules = evaluatedRules.filter(isNaryRule);
  const pairwiseRules = evaluatedRules.filter((r) => !isNaryRule(r));
  const findings = [];
  let pairs_checked = 0;
  for (let i = 0; i < normalizedSubjects.length; i += 1) {
    for (let j = i + 1; j < normalizedSubjects.length; j += 1) {
      pairs_checked += 1;
      const pair = [normalizedSubjects[i], normalizedSubjects[j]];
      for (const f of checkNormalizedPair({
        subjects: pair,
        rules: pairwiseRules,
        memberSets,
        patientContext,
        includeDiagnostic: true,
      })) {
        findings.push({ subjects: pair.map(subjectOutput), ...f });
      }
    }
  }
  for (const rule of naryRules) {
    if (!indicationMatches(rule, patientContext)) continue;
    if (!jurisdictionMatches(rule, patientContext)) continue;
    const matched = matchNaryRule(rule, normalizedSubjects, memberSets);
    if (matched) findings.push(applyApplicabilityUnknown(rule, {
      subjects: matched.subjects.map(subjectOutput),
      rule_id: rule.rule_id,
      runtime_enabled: runtimeEnabled(rule),
      subject_roles: {
        object: Array.isArray(matched.subjectRoles.object)
          ? matched.subjectRoles.object.map(subjectOutput)
          : subjectOutput(matched.subjectRoles.object),
        perpetrator: Array.isArray(matched.subjectRoles.perpetrator)
          ? matched.subjectRoles.perpetrator.map(subjectOutput)
          : subjectOutput(matched.subjectRoles.perpetrator),
      },
      ...indicationScope(rule),
      ...jurisdictionScope(rule),
      ...resolveRule(rule, patientContext),
    }, patientContext, matched.requirements));
  }
  // Suppression (#6 precedence): a matched rule's `suppresses` list removes only
  // findings over the same subjects (or a subset of an n-ary finding's subjects).
  // Scoping by subjects prevents one pair from hiding the same target rule ID when
  // it independently fires for another pair in a larger medication list.
  const rulesById = Object.fromEntries(evaluatedRules.map((r) => [r.rule_id, r]));
  const subjectSubset = (subset, superset) => {
    const remaining = superset.map((subject) => subjectKey(normalizeSubject(subject)));
    for (const subject of subset) {
      const index = remaining.indexOf(subjectKey(normalizeSubject(subject)));
      if (index < 0) return false;
      remaining.splice(index, 1);
    }
    return true;
  };
  const survivingFindings = findings.filter((candidate) => {
    return !findings.some((suppressor) => {
      return canExplicitlySuppress(suppressor, candidate, rulesById)
        && subjectSubset(candidate.subjects, suppressor.subjects);
    });
  });
  const referenced = new Set();
  const member_gaps = [];
  for (const rule of evaluatedRules) {
    for (const ref of ruleSides(rule)) {
      collectMemberCoverage(rule.rule_id, ref, memberSets, referenced, member_gaps);
    }
  }
  const classes_missing_members = [...new Set(member_gaps.map((gap) => gap.class))].sort();
  return {
    findings: survivingFindings,
    pairs_checked,
    coverage: {
      rules_total: evaluatedRules.length,
      classes_referenced: referenced.size,
      classes_missing_members,
      member_gaps,
    },
  };
}

export function checkRuntimeInteractions(options) {
  if (options?.patientContext?.jurisdiction == null) {
    throw new TypeError('patientContext.jurisdiction is required for runtime interaction checks');
  }
  validatePatientContext(options.patientContext);
  if (!Array.isArray(options?.rules)) throw new TypeError('rules must be an array');
  for (let index = 0; index < options.rules.length; index += 1) {
    validateRuntimeEnabledMirror(options.rules[index], index);
  }
  validateRuleSet(options.rules);
  const runtimeRules = options.rules.filter(runtimeEnabled);
  if (isObject(options.memberSets) && Object.keys(options.memberSets).length > 0) {
    throw new TypeError(
      'runtime interaction checks reject external memberSets; class rules require inline pinned members',
    );
  }
  if (!Array.isArray(options?.subjects) || options.subjects.length < 2) {
    throw new TypeError('runtime interaction checks require at least two structured subjects');
  }
  for (const subject of options.subjects) {
    if (!isObject(subject)) {
      throw new TypeError('runtime interaction checks require structured subjects');
    }
    if (typeof subject.route !== 'string' || subject.route.trim() === '') {
      throw new TypeError('runtime interaction subjects require a non-empty route');
    }
    if (typeof subject.formulation !== 'string' || subject.formulation.trim() === '') {
      throw new TypeError('runtime interaction subjects require a non-empty formulation');
    }
    const normalized = normalizeSubject(subject);
    if (ABSTRACT_RUNTIME_ROUTES.has(normalized.route)) {
      throw new TypeError(
        `runtime interaction subject route "${subject.route}" is not a concrete administration route`,
      );
    }
    if (ABSTRACT_RUNTIME_FORMULATIONS.has(normalized.formulation)) {
      throw new TypeError(
        `runtime interaction subject formulation "${subject.formulation}" is not a concrete dose form`,
      );
    }
  }
  for (const rule of runtimeRules) {
    if (rule.runtime_status.pair_matcher_executable !== true) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" requires runtime_status.pair_matcher_executable=true`,
      );
    }
    if (rule.runtime_status.clinical_context_complete !== true) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" requires runtime_status.clinical_context_complete=true`,
      );
    }
    validateRuntimeActionOwnership(rule);
    if (String(rule.management?.action_target ?? '').includes('newly_added')) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" requires medication initiation direction for action_target`,
      );
    }
    if (rule.runtime_status.promotion_eligible !== true) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" requires runtime_status.promotion_eligible=true`,
      );
    }
    if (Object.hasOwn(rule, 'proposed_status')) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" must omit proposed_status after promotion`,
      );
    }
    const otherSide = rule.perpetrator ?? rule.second_subject ?? rule.coadministered_with;
    validateRuntimeSubjectRef(rule.object, rule.rule_id, 'object');
    validateRuntimeSubjectRef(otherSide, rule.rule_id, 'perpetrator');
    validateRuntimeRoleDisjoint(rule, otherSide);
    const indications = rule.applicability?.indication;
    if (indications !== undefined && indications !== null && !Array.isArray(indications)) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" applicability.indication must be an array`,
      );
    }
    if (Array.isArray(indications) && indications.length > 0) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" has an indication scope without a reviewed terminology mapping`,
      );
    }
    const review = rule.review;
    if (!isObject(review) || review.status !== 'clinician_reviewed') {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" requires review.status=clinician_reviewed`,
      );
    }
    for (const role of ['author', 'approver']) {
      if (typeof review[role] !== 'string' || review[role].trim() === '') {
        throw new TypeError(
          `interaction rule "${rule.rule_id}" requires a non-empty review.${role}`,
        );
      }
    }
    if (review.author.trim().toLocaleLowerCase('en-US')
      === review.approver.trim().toLocaleLowerCase('en-US')) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" requires distinct review.author and review.approver`,
      );
    }
    if (!isIsoReviewDate(review.reviewed_at)) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" requires a valid ISO review.reviewed_at`,
      );
    }
    if (Date.parse(`${review.reviewed_at.slice(0, 10)}T00:00:00.000Z`) > Date.now()) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" review.reviewed_at must not be in the future`,
      );
    }
    if (!Array.isArray(review.source_versions)
      || review.source_versions.length === 0
      || review.source_versions.some(
        (version) => typeof version !== 'string' || version.trim() === '',
      )) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" requires non-empty review.source_versions`,
      );
    }
    validateRuntimeEvidence(rule);
    const jurisdictions = ruleJurisdictions(rule);
    if (!Array.isArray(jurisdictions) || jurisdictions.length === 0) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" requires an explicit runtime jurisdiction scope`,
      );
    }
    if (new Set(jurisdictions).size !== jurisdictions.length) {
      throw new TypeError(
        `interaction rule "${rule.rule_id}" has duplicate runtime jurisdiction scope`,
      );
    }
  }
  const result = checkInteractions({
    ...options,
    memberSets: {},
    includeDiagnostic: false,
  });
  const interactionKnowledge = runtimeRules.length === 0 ? 'unknown' : 'partial';
  return {
    ...result,
    coverage: {
      ...result.coverage,
      interaction_knowledge: interactionKnowledge,
      overall: interactionKnowledge,
    },
  };
}

function isIsoReviewDate(value) {
  if (typeof value !== 'string' || value.trim() !== value) return false;
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/u);
  if (dateMatch === null) return false;
  const [, year, month, day] = dateMatch;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() + 1 !== Number(month)
    || date.getUTCDate() !== Number(day)) {
    return false;
  }
  if (value.length === 10) return true;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}
