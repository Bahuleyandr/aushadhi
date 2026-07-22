// Context-aware interaction rule engine.
//
// Evaluates a rich interaction rule (optional renal/hepatic context modifiers) and
// enforces the clinician-mandated safety invariants. Resolution order:
//   1. per factor PRESENT: take the MOST-SPECIFIC matching predicate (its severity +
//      impairment-specific management_override). This is the ONLY thing that raises
//      clinical severity — a contraindication is a property of a CONFIRMED state.
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
// Narrower predicate = more specific (wins within a factor).
const SPECIFICITY = {
  egfr_lt_15: 4, crcl_lt_15: 4, egfr_lt_30: 3, crcl_lt_30: 3, egfr_lt_60: 2, crcl_lt_60: 2,
  egfr_ge_60: 2, child_pugh_c: 3, child_pugh_b: 2, hepatic_impaired: 1,
};

function factorPresent(factor, ctx) {
  if (factor === 'renal') { const r = ctx?.renal || {}; return r.egfr != null || r.crcl != null; }
  if (factor === 'hepatic') return ctx?.hepatic != null;
  return false;
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
    case 'crcl_lt_60': return crcl != null && crcl < 60;
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

  const byFactor = {};
  for (const mod of rule.context_modifiers || []) (byFactor[mod.factor] ||= []).push(mod);

  for (const [factor, mods] of Object.entries(byFactor)) {
    if (factorPresent(factor, patientContext)) {
      const matching = mods
        .filter((m) => predicateMatches(m.when, patientContext))
        .sort((a, b) => (SPECIFICITY[b.when] || 0) - (SPECIFICITY[a.when] || 0));
      if (matching.length) {
        const m = matching[0];
        clinical.push({
          severity: m.severity ?? rule.severity,
          action: m.management_override?.dispense_action ?? m.dispense_action ?? base.dispense_action ?? null,
          management: { ...base, ...(m.management_override || {}) },
          source: `present:${m.when}`,
          spec: 2,
        });
      }
      // present but no predicate matches => reassuring => no candidate; base stands.
    } else {
      // factor absent: an escalate modifier makes the operational action more restrictive and
      // records data_required, but never raises the clinical severity.
      const esc = mods
        .filter((m) => m.on_unknown === 'escalate')
        .sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0));
      if (esc.length) {
        const m = esc[0];
        const escAction = m.dispense_action
          ?? (m.severity === 'contraindicated' ? 'withhold_and_clarify' : (base.dispense_action ?? null));
        absentActions.push(escAction);
        const metric = factor === 'renal' ? (String(m.when).startsWith('crcl') ? 'CrCl' : 'eGFR') : 'Child-Pugh';
        dataRequired.push({
          factor, metric, would_be_severity: m.severity ?? rule.severity, when: m.when,
        });
      }
    }
  }

  clinical.sort((a, b) =>
    ((SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0)) ||
    ((ACT_RANK[b.action] || 0) - (ACT_RANK[a.action] || 0)) ||
    ((b.spec || 0) - (a.spec || 0)));

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

function classMembers(ref, memberSets) {
  const set = memberSets[ref.class] || {};
  const strengths = ref.strength && ref.strength.length ? ref.strength : Object.keys(set);
  const names = strengths.flatMap((s) => set[s] || []);
  const excluded = new Set(ref.member_exceptions || []);
  return new Set(names.filter((n) => !excluded.has(n)));
}

function satisfies(subject, ref, memberSets) {
  if (!ref) return false;
  if (ref.drug) return subject === ref.drug;
  if (ref.substance) return subject === ref.substance;
  if (ref.combination) return ref.combination.every((c) => c.drug === subject); // single subject can't satisfy a combo
  if (ref.class) return classMembers(ref, memberSets).has(subject);
  return false;
}

function ruleSides(rule) {
  return [rule.object, rule.perpetrator ?? rule.second_subject ?? rule.coadministered_with];
}

function ruleMatchesPair(rule, a, b, memberSets) {
  const [o, p] = ruleSides(rule);
  return (satisfies(a, o, memberSets) && satisfies(b, p, memberSets))
      || (satisfies(b, o, memberSets) && satisfies(a, p, memberSets));
}

// exact drug/substance sides make a rule more specific than class-based ones.
function ruleSpecificity(rule) {
  return ruleSides(rule).reduce((n, ref) => n + (ref && (ref.drug || ref.substance) ? 1 : 0), 0);
}

/**
 * Check one drug pair against a rule pack. Applies generic-vs-specific collision
 * suppression (most-specific matching rule wins) and resolves each survivor's
 * context. Returns one finding per surviving rule.
 */
export function checkPair({ subjects, rules, memberSets = {}, patientContext = {} }) {
  const [a, b] = subjects;
  const matched = rules.filter((r) => ruleMatchesPair(r, a, b, memberSets));
  if (!matched.length) return [];
  const maxSpec = Math.max(...matched.map(ruleSpecificity));
  return matched
    .filter((r) => ruleSpecificity(r) === maxSpec)
    .map((r) => ({ rule_id: r.rule_id, ...resolveRule(r, patientContext) }));
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

function refClasses(ref, out) {
  if (!ref) return;
  if (ref.class) out.add(ref.class);
  if (Array.isArray(ref.combination)) for (const m of ref.combination) refClasses(m, out);
}

// Assign a distinct subject to each ref (backtracking); returns the assignment or null.
function assignDistinct(refs, subjects, memberSets) {
  const chosen = new Array(refs.length).fill(null);
  const used = new Set();
  const backtrack = (i) => {
    if (i === refs.length) return true;
    for (let s = 0; s < subjects.length; s += 1) {
      if (used.has(s)) continue;
      if (satisfies(subjects[s], refs[i], memberSets)) {
        used.add(s);
        chosen[i] = subjects[s];
        if (backtrack(i + 1)) return true;
        used.delete(s);
        chosen[i] = null;
      }
    }
    return false;
  };
  return backtrack(0) ? chosen : null;
}

function matchNaryRule(rule, subjects, memberSets) {
  const comboSide = [rule.object, rule.perpetrator].find(
    (s) => s && Array.isArray(s.combination) && s.combination.length > 1,
  );
  const otherSide = comboSide === rule.object ? rule.perpetrator : rule.object;
  const refs = [...comboSide.combination];
  if (otherSide) refs.push(otherSide);
  return assignDistinct(refs, subjects, memberSets);
}

/**
 * Evaluate the entered drugs against the rule pack: every unordered pair against the
 * pairwise rules, plus each n-ary (all_of_present combination) rule against the whole
 * set. Reports honest coverage — including rule classes with no member data (which can
 * therefore never match), recursing into combination members, so callers never present
 * a gap as "no interaction".
 */
export function checkInteractions({ subjects, rules, memberSets = {}, patientContext = {} }) {
  const naryRules = rules.filter(isNaryRule);
  const pairwiseRules = rules.filter((r) => !isNaryRule(r));
  const findings = [];
  let pairs_checked = 0;
  for (let i = 0; i < subjects.length; i += 1) {
    for (let j = i + 1; j < subjects.length; j += 1) {
      pairs_checked += 1;
      const pair = [subjects[i], subjects[j]];
      for (const f of checkPair({ subjects: pair, rules: pairwiseRules, memberSets, patientContext })) {
        findings.push({ subjects: pair, ...f });
      }
    }
  }
  for (const rule of naryRules) {
    const matched = matchNaryRule(rule, subjects, memberSets);
    if (matched) findings.push({ subjects: matched, rule_id: rule.rule_id, ...resolveRule(rule, patientContext) });
  }
  const referenced = new Set();
  for (const r of rules) for (const ref of ruleSides(r)) refClasses(ref, referenced);
  const classes_missing_members = [...referenced].filter((c) => !memberSets[c]).sort();
  return {
    findings,
    pairs_checked,
    coverage: { rules_total: rules.length, classes_referenced: referenced.size, classes_missing_members },
  };
}
