// Compile-time expansion of class-level draft interaction rules into exact
// member instantiations (owner-approved Option B, 2026-08-07 — see
// docs/plans/2026-08-07-class-rule-compile-expansion.md).
//
// A class-level draft rule (an `object` or `perpetrator` selector carrying
// `class` instead of an exact `drug`) never reaches the runtime directly.
// Expansion enumerates each (object member × perpetrator member) pair as an
// exact instantiation candidate, and every candidate either resolves — with
// the reviewed route scope and the evidence records that name each member —
// or is refused with a precise, member-naming reason. Nothing is dropped
// silently and nothing is guessed:
//
//   - member rosters are validated ONLY against the digest-pinned member
//     sets attested alongside the draft pack (`member_sets_sha256`); an
//     unknown class/strength bucket, a roster member absent from the pinned
//     set, or a pinned member the rule neither lists nor excepts is refused;
//   - a member is instantiable only when at least one cited evidence record
//     names it verbatim (fragment text or the record's product identity);
//     otherwise the candidate is refused with "evidence does not name
//     member" and the owner resolves it through the draft flow;
//   - a side with no reviewed route data is refused; abstract reviewed
//     route scopes (`systemic`, `parenteral`) may only narrow to the
//     concrete routes listed in ABSTRACT_ROUTE_COVERAGE.
//
// Instantiated rules remain owner-gated exactly like exact draft rules:
// every expanded rule id needs its own signed approval, reviewed mappings,
// and promotion entry before it can compile into a runtime artifact. The
// runtime checker is not involved and is unchanged — expansion output is an
// ordinary exact-selector rule shape.

import { canonicalDrug } from './interaction-engine.mjs';

const ROLES = ['object', 'perpetrator'];
const SIDE_ORDER = new Map([['rule', 0], ['object', 1], ['perpetrator', 2]]);

// Abstract reviewed route scopes and the exact concrete routes each may
// narrow to at promotion time. This is a deliberate, code-reviewed
// vocabulary decision (not data): a draft side reviewed as `systemic`
// exposure covers the systemic administration routes below and nothing
// else; any other combination refuses. Extending this table is a reviewed
// code change, never a runtime inference.
const ABSTRACT_ROUTE_COVERAGE = new Map([
  ['parenteral', new Set(['intramuscular', 'intravenous', 'subcutaneous'])],
  ['systemic', new Set(['intramuscular', 'intravenous', 'oral', 'subcutaneous'])],
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function nonEmptyStringArray(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) return null;
  return [...value];
}

export function expandedMemberSlug(member) {
  const slug = String(member)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  if (slug === '') {
    throw new TypeError(`member ${JSON.stringify(member)} has no expandable slug`);
  }
  return slug;
}

export function expandedRuleId(parentRuleId, objectMember, perpetratorMember) {
  requireString(parentRuleId, 'parentRuleId');
  return `${parentRuleId}::${expandedMemberSlug(objectMember)}__${
    expandedMemberSlug(perpetratorMember)}`;
}

function memberNamePattern(member) {
  const escaped = member
    .trim()
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  // A member is "named" only as a standalone word sequence: letters or
  // digits directly adjacent on either side reject the match, so `statin`
  // never matches inside `simvastatin`.
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'u');
}

// Evidence records that name the member verbatim — in an attested fragment's
// text or in the record's product identity (the cited label's own subject).
// Structured curation annotations (`supports.scope` etc.) are deliberately
// NOT consulted: only attested verbatim text can admit a member.
function evidenceSourcesNamingMember(rule, member) {
  const pattern = memberNamePattern(member);
  const sources = new Set();
  for (const evidence of rule.evidence ?? []) {
    if (!isObject(evidence)) continue;
    const texts = [];
    if (typeof evidence.product === 'string') texts.push(evidence.product);
    for (const fragment of evidence.fragments ?? []) {
      if (isObject(fragment) && typeof fragment.text === 'string') {
        texts.push(fragment.text);
      }
    }
    if (texts.some((text) => pattern.test(text.toLowerCase()))) {
      sources.add(String(evidence.source_id));
    }
  }
  return [...sources].sort(compareStrings);
}

function refusal(refusals, ruleId, side, member, reason, message) {
  refusals.push({
    rule_id: ruleId,
    side,
    member,
    reason,
    message,
  });
}

function resolveSideSelector(rule, role) {
  if (role === 'object') return rule.object;
  return rule.perpetrator ?? rule.second_subject ?? rule.coadministered_with;
}

// Resolves one side of a draft rule to its expandable member roster.
// Returns null when the side cannot be expanded; every failure is recorded
// as a refusal first.
function resolveSideRoster({ rule, role, memberSetClasses, refusals }) {
  const ruleId = rule.rule_id;
  const selector = resolveSideSelector(rule, role);
  if (!isObject(selector)) {
    refusal(
      refusals, ruleId, role, null, 'unsupported_selector',
      `rule "${ruleId}" ${role} is not an expandable selector object`,
    );
    return null;
  }
  if (selector.combination !== undefined || selector.substance !== undefined) {
    refusal(
      refusals, ruleId, role, null, 'unsupported_selector',
      `rule "${ruleId}" ${role} uses a combination or substance selector, `
        + 'which expansion does not support; only exact drug and class '
        + 'selectors are expandable',
    );
    return null;
  }

  // A selector must carry exactly one identity. `drug` and `class` together
  // are ambiguous — expansion refuses rather than silently preferring one
  // and dropping the roster the author embedded under the other.
  if (Object.hasOwn(selector, 'drug') && Object.hasOwn(selector, 'class')) {
    refusal(
      refusals, ruleId, role, null, 'ambiguous_selector_identity',
      `rule "${ruleId}" ${role} carries both a drug selector and a class `
        + 'selector; expansion refuses dual-identity selectors — pin exactly '
        + 'one identity through the draft flow',
    );
    return null;
  }

  let baseMembers;
  if (typeof selector.drug === 'string' && selector.drug.trim() !== '') {
    baseMembers = [selector.drug.trim().toLowerCase()];
  } else if (typeof selector.class === 'string' && selector.class.trim() !== '') {
    baseMembers = resolveClassRoster({ rule, role, selector, memberSetClasses, refusals });
    if (baseMembers === null) return null;
  } else {
    refusal(
      refusals, ruleId, role, null, 'unsupported_selector',
      `rule "${ruleId}" ${role} carries neither an exact drug selector nor a `
        + 'class selector',
    );
    return null;
  }

  const routes = nonEmptyStringArray(selector.route)
    ?? nonEmptyStringArray(rule.applicability?.routes);
  if (routes === null) {
    refusal(
      refusals, ruleId, role, null, 'missing_route_data',
      `rule "${ruleId}" ${role} has no reviewed route data (the side and `
        + 'applicability route arrays are both empty); pin the reviewed '
        + 'route through the draft flow before this side can compile',
    );
    return null;
  }
  const formulations = nonEmptyStringArray(selector.formulation)
    ?? nonEmptyStringArray(rule.applicability?.formulations)
    ?? [];

  const members = [];
  const slugs = new Map();
  for (const member of [...new Set(baseMembers)].sort(compareStrings)) {
    if (canonicalDrug(member) !== member) {
      refusal(
        refusals, ruleId, role, member, 'member_identity_not_canonical',
        `rule "${ruleId}" ${role} member "${member}" is not a canonical drug `
          + `identity (canonical form is "${canonicalDrug(member)}"); `
          + 'expansion never renames members — fix the roster through the '
          + 'draft flow',
      );
      continue;
    }
    const namedBy = evidenceSourcesNamingMember(rule, member);
    if (namedBy.length === 0) {
      refusal(
        refusals, ruleId, role, member, 'evidence_does_not_name_member',
        `rule "${ruleId}" ${role} member "${member}": evidence does not name `
          + 'member — no cited evidence fragment or product identity names '
          + 'it verbatim; add member-naming evidence through the draft flow '
          + 'or exclude the member',
      );
      continue;
    }
    const slug = expandedMemberSlug(member);
    if (slugs.has(slug)) {
      refusal(
        refusals, ruleId, role, member, 'member_slug_collision',
        `rule "${ruleId}" ${role} members "${slugs.get(slug)}" and `
          + `"${member}" collide on expanded id slug "${slug}"`,
      );
      continue;
    }
    slugs.set(slug, member);
    members.push({ member, named_by: namedBy });
  }
  return { members, routes, formulations };
}

// Resolves a class selector's roster strictly against the digest-pinned
// member sets. The pinned set is the only authority: an embedded rule roster
// may narrow it (with member_exceptions accounting for every omission) but
// can never add to it.
function resolveClassRoster({ rule, role, selector, memberSetClasses, refusals }) {
  const ruleId = rule.rule_id;
  const className = selector.class.trim();
  const strengthBuckets = memberSetClasses[className];
  if (!isObject(strengthBuckets)) {
    refusal(
      refusals, ruleId, role, null, 'unknown_member_set',
      `rule "${ruleId}" ${role} class "${className}" is not defined in the `
        + 'pinned member sets',
    );
    return null;
  }
  let bucketName;
  if (selector.strength === undefined || selector.strength === null) {
    const bucketNames = Object.keys(strengthBuckets);
    if (bucketNames.length !== 1) {
      refusal(
        refusals, ruleId, role, null, 'ambiguous_member_set_strength',
        `rule "${ruleId}" ${role} class "${className}" declares no strength `
          + `but the pinned member sets define ${bucketNames.length} strength `
          + `buckets (${bucketNames.sort(compareStrings).join(', ')})`,
      );
      return null;
    }
    [bucketName] = bucketNames;
  } else if (Array.isArray(selector.strength) && selector.strength.length === 1
      && typeof selector.strength[0] === 'string') {
    [bucketName] = selector.strength;
  } else {
    refusal(
      refusals, ruleId, role, null, 'ambiguous_member_set_strength',
      `rule "${ruleId}" ${role} class "${className}" strength must pin `
        + 'exactly one strength bucket',
    );
    return null;
  }
  const pinnedRaw = strengthBuckets[bucketName];
  if (!Array.isArray(pinnedRaw) || pinnedRaw.length === 0) {
    refusal(
      refusals, ruleId, role, null, 'unknown_member_set',
      `rule "${ruleId}" ${role} class "${className}" has no pinned member `
        + `set for strength "${bucketName}"`,
    );
    return null;
  }
  // Expansion never renames a member: a pinned entry, a rule roster entry,
  // or an exception that is not already in canonical form is refused rather
  // than canonicalized on its behalf.
  const requireCanonical = (member, detail) => {
    const raw = String(member).trim().toLowerCase();
    if (canonicalDrug(raw) !== raw) {
      refusal(
        refusals, ruleId, role, raw, 'member_identity_not_canonical',
        `rule "${ruleId}" ${role} ${detail} "${raw}" is not a canonical drug `
          + `identity (canonical form is "${canonicalDrug(raw)}"); expansion `
          + 'never renames members — fix it through the draft flow',
      );
      return null;
    }
    return raw;
  };
  const pinned = new Set();
  for (const member of pinnedRaw) {
    const canonical = requireCanonical(member, `pinned member set ${className}[${bucketName}] entry`);
    if (canonical !== null) pinned.add(canonical);
  }

  const exceptions = new Set();
  for (const exception of selector.member_exceptions ?? []) {
    const canonical = requireCanonical(exception, 'member exception');
    if (canonical === null) continue;
    if (!pinned.has(canonical)) {
      refusal(
        refusals, ruleId, role, canonical, 'member_exception_not_in_pinned_member_set',
        `rule "${ruleId}" ${role} member exception "${canonical}" is not in `
          + `pinned member set ${className}[${bucketName}]`,
      );
      continue;
    }
    exceptions.add(canonical);
  }

  // An emptied-out side is refused explicitly, never reported as a bare
  // non-expansion: an operator reading the dry run must see that the side
  // yielded nothing because member_exceptions (alone, or intersected with
  // the embedded roster) removed every member — not wonder why a rule
  // neither expanded nor refused.
  const refuseEmptyRoster = (roster) => {
    if (roster.length > 0) return roster;
    refusal(
      refusals, ruleId, role, null, 'empty_roster_after_exceptions',
      `rule "${ruleId}" ${role} class "${className}" resolves to an empty `
        + 'roster after applying member_exceptions and the embedded roster '
        + '(if any): no expandable member of pinned member set '
        + `${className}[${bucketName}] remains; a side that excepts every `
        + 'member must be resolved through the draft flow',
    );
    return null;
  };

  const embedded = nonEmptyStringArray(selector.members);
  if (embedded === null) {
    return refuseEmptyRoster(
      [...pinned].filter((member) => !exceptions.has(member)),
    );
  }

  const roster = [];
  const accounted = new Set(exceptions);
  for (const member of embedded) {
    const canonical = requireCanonical(member, 'roster member');
    if (canonical === null) continue;
    accounted.add(canonical);
    if (!pinned.has(canonical)) {
      refusal(
        refusals, ruleId, role, canonical, 'member_not_in_pinned_member_set',
        `rule "${ruleId}" ${role} member "${canonical}" is embedded in the `
          + `rule roster but absent from pinned member set `
          + `${className}[${bucketName}]; the divergence must be resolved `
          + 'through the draft flow (member sets or the rule roster), never '
          + 'by the compiler',
      );
      continue;
    }
    if (exceptions.has(canonical)) continue;
    roster.push(canonical);
  }
  for (const member of pinned) {
    if (!accounted.has(member)) {
      refusal(
        refusals, ruleId, role, member, 'pinned_member_unaccounted',
        `rule "${ruleId}" ${role} pinned member set `
          + `${className}[${bucketName}] contains "${member}" which the rule `
          + 'roster neither lists nor excepts; expansion refuses to drop it '
          + 'silently — account for it through the draft flow',
      );
    }
  }
  return refuseEmptyRoster(roster);
}

function sortRefusals(refusals) {
  refusals.sort((left, right) => (
    (SIDE_ORDER.get(left.side) ?? 9) - (SIDE_ORDER.get(right.side) ?? 9)
    || compareStrings(left.member ?? '', right.member ?? '')
    || compareStrings(left.reason, right.reason)
  ));
  return refusals;
}

// Expands one draft rule into its exact instantiation candidates.
//
// `memberSetClasses` MUST be the parsed `classes` object of the member-set
// bytes that the draft pack's attestation digest-pins (`member_sets_sha256`)
// — callers are responsible for verifying that binding (the promotion
// compiler and the dry-run CLI both assert the attestation before calling).
//
// Returns a deterministic report:
//   { rule_id, expandable, expansions: [...], refusals: [...] }
// Expansions are sorted by expanded_rule_id; refusals by (side, member,
// reason). The same inputs always serialize to the same bytes.
export function expandDraftRuleClassMembers({ rule, memberSetClasses }) {
  requireObject(rule, 'draft rule');
  requireString(rule.rule_id, 'draft rule rule_id');
  requireObject(memberSetClasses, 'pinned member set classes');

  const refusals = [];
  const sides = {};
  for (const role of ROLES) {
    sides[role] = resolveSideRoster({ rule, role, memberSetClasses, refusals });
  }

  const expansions = [];
  if (sides.object !== null && sides.perpetrator !== null) {
    for (const objectEntry of sides.object.members) {
      for (const perpetratorEntry of sides.perpetrator.members) {
        if (objectEntry.member === perpetratorEntry.member) {
          refusal(
            refusals, rule.rule_id, 'rule', objectEntry.member, 'self_pair',
            `rule "${rule.rule_id}" would expand "${objectEntry.member}" `
              + 'against itself; self-pairs are never instantiated',
          );
          continue;
        }
        expansions.push({
          expanded_rule_id: expandedRuleId(
            rule.rule_id,
            objectEntry.member,
            perpetratorEntry.member,
          ),
          object_member: objectEntry.member,
          perpetrator_member: perpetratorEntry.member,
          object_routes: [...sides.object.routes],
          perpetrator_routes: [...sides.perpetrator.routes],
          object_formulations: [...sides.object.formulations],
          perpetrator_formulations: [...sides.perpetrator.formulations],
          object_named_by: [...objectEntry.named_by],
          perpetrator_named_by: [...perpetratorEntry.named_by],
        });
      }
    }
  }
  expansions.sort((left, right) => (
    compareStrings(left.expanded_rule_id, right.expanded_rule_id)
  ));

  return {
    rule_id: rule.rule_id,
    expandable: expansions.length > 0,
    expansions,
    refusals: sortRefusals(refusals),
  };
}

function assertRouteAllowed(ruleId, role, routes, route) {
  const allowed = routes.includes(route)
    || routes.some((entry) => ABSTRACT_ROUTE_COVERAGE.get(entry)?.has(route));
  if (!allowed) {
    throw new TypeError(
      `${ruleId} approved scope route "${route}" is outside the reviewed `
        + `${role} route scope [${routes.join(', ')}]`,
    );
  }
}

function assertFormulationAllowed(ruleId, role, formulations, formulation) {
  if (formulations.length > 0 && !formulations.includes(formulation)) {
    throw new TypeError(
      `${ruleId} approved scope formulation "${formulation}" is outside the `
        + `reviewed ${role} formulation scope [${formulations.join(', ')}]`,
    );
  }
}

// Instantiates one expanded member pair of a class-level (or exact) draft
// rule as an exact-selector rule pinned to the approved route and
// formulation. Throws — with the underlying refusal messages — whenever the
// requested pair is not an expansion candidate, so a promotion can never
// compile a member the expansion validator refused.
export function instantiateExpandedDraftRule({
  parentRule,
  memberSetClasses,
  objectMember,
  perpetratorMember,
  route,
  formulation,
  expectedRuleId,
}) {
  requireObject(parentRule, 'parent draft rule');
  requireString(objectMember, 'objectMember');
  requireString(perpetratorMember, 'perpetratorMember');
  requireString(route, 'route');
  requireString(formulation, 'formulation');

  const report = expandDraftRuleClassMembers({ rule: parentRule, memberSetClasses });
  const ruleId = expandedRuleId(parentRule.rule_id, objectMember, perpetratorMember);
  if (expectedRuleId !== undefined && expectedRuleId !== ruleId) {
    throw new TypeError(
      `expanded rule id ${expectedRuleId} does not match the deterministic `
        + `expansion id ${ruleId}`,
    );
  }
  const match = report.expansions.find((expansion) => (
    expansion.object_member === objectMember
    && expansion.perpetrator_member === perpetratorMember
  ));
  if (!match) {
    const related = report.refusals.filter((entry) => (
      entry.member === null
      || entry.member === objectMember
      || entry.member === perpetratorMember
    ));
    if (related.length > 0) {
      throw new TypeError(
        `draft rule "${parentRule.rule_id}" refuses to expand `
          + `${objectMember} × ${perpetratorMember}: `
          + related.map((entry) => entry.message).join('; '),
      );
    }
    throw new TypeError(
      `draft rule "${parentRule.rule_id}" does not expand to member pair `
        + `${objectMember} × ${perpetratorMember}`,
    );
  }

  assertRouteAllowed(ruleId, 'object', match.object_routes, route);
  assertRouteAllowed(ruleId, 'perpetrator', match.perpetrator_routes, route);
  assertFormulationAllowed(ruleId, 'object', match.object_formulations, formulation);
  assertFormulationAllowed(
    ruleId, 'perpetrator', match.perpetrator_formulations, formulation,
  );

  const applicability = isObject(parentRule.applicability)
    ? structuredClone(parentRule.applicability)
    : {};
  applicability.routes = [route];
  applicability.formulations = [formulation];

  return {
    rule_id: ruleId,
    expanded_from: {
      parent_rule_id: parentRule.rule_id,
      object_member: objectMember,
      perpetrator_member: perpetratorMember,
    },
    object: { drug: objectMember, route: [route], formulation: [formulation] },
    perpetrator: {
      drug: perpetratorMember,
      route: [route],
      formulation: [formulation],
    },
    applicability,
    severity: parentRule.severity,
    mechanism: parentRule.mechanism,
    management: structuredClone(parentRule.management),
    evidence: structuredClone(parentRule.evidence),
  };
}
