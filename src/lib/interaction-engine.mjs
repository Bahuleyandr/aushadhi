// Context-aware interaction rule engine.
//
// Evaluates a rich interaction rule (optional renal/hepatic context modifiers) and
// enforces the clinician-mandated safety invariants. Resolution order:
//   1. per factor: if the factor's value is present, take the MOST-SPECIFIC matching
//      predicate (its severity + impairment-specific management_override); if the
//      factor is absent, an `on_unknown: escalate` modifier contributes its severity +
//      action but with the NEUTRAL base management (never a "go find a lab" caveat).
//   2. across factors + base: HIGHEST severity wins, then MOST-RESTRICTIVE action.
//   3. invariant: a resolved `contraindicated` severity ALWAYS yields
//      `withhold_and_clarify`, computed here — never inherited from the row.

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
  const candidates = [{
    severity: rule.severity, action: base.dispense_action ?? null, management: base, source: 'base',
  }];

  const byFactor = {};
  for (const mod of rule.context_modifiers || []) (byFactor[mod.factor] ||= []).push(mod);

  for (const [factor, mods] of Object.entries(byFactor)) {
    if (factorPresent(factor, patientContext)) {
      const matching = mods
        .filter((m) => predicateMatches(m.when, patientContext))
        .sort((a, b) => (SPECIFICITY[b.when] || 0) - (SPECIFICITY[a.when] || 0));
      if (matching.length) {
        const m = matching[0];
        candidates.push({
          severity: m.severity ?? rule.severity,
          action: m.management_override?.dispense_action ?? m.dispense_action ?? base.dispense_action ?? null,
          management: { ...base, ...(m.management_override || {}) },
          source: `present:${m.when}`,
        });
      }
      // present but no predicate matches => reassuring => no candidate; base stands.
    } else {
      // factor absent: worst escalate modifier contributes severity+action with NEUTRAL base management.
      const esc = mods
        .filter((m) => m.on_unknown === 'escalate')
        .sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0));
      if (esc.length) {
        const m = esc[0];
        candidates.push({
          severity: m.severity ?? rule.severity,
          action: m.dispense_action ?? base.dispense_action ?? null,
          management: base, // neutral — no impairment/lab caveat when escalating on absence
          source: `escalate-absent:${factor}`,
        });
      }
    }
  }

  candidates.sort((a, b) =>
    ((SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0)) ||
    ((ACT_RANK[b.action] || 0) - (ACT_RANK[a.action] || 0)));

  const win = candidates[0];
  let dispense_action = win.action;
  if (win.severity === 'contraindicated') dispense_action = 'withhold_and_clarify'; // invariant

  return { severity: win.severity, dispense_action, management: win.management, basis: win.source };
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
