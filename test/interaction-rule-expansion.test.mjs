import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  expandDraftRuleClassMembers,
  expandedMemberSlug,
  expandedRuleId,
  instantiateExpandedDraftRule,
} from '../src/lib/interaction-rule-expansion.mjs';

const MEMBER_SET_CLASSES = Object.freeze({
  test_inhibitor: { strong: ['alphacillin', 'betacillin', 'gammacillin'] },
  multi_bucket_inhibitor: {
    strong: ['alphacillin'],
    moderate: ['deltacillin'],
  },
  noncanonical_set: { strong: ['rifampin'] },
});

function classRule(overrides = {}) {
  return {
    rule_id: 'victimol__test_inhibitor',
    severity: 'major',
    object: { drug: 'victimol', route: ['oral'] },
    perpetrator: {
      class: 'test_inhibitor',
      strength: ['strong'],
      route: ['systemic'],
      formulation: [],
    },
    applicability: {
      routes: ['oral'],
      formulations: [],
      jurisdiction: ['US'],
    },
    mechanism: 'Test mechanism.',
    management: {
      dispense_action: 'confirm_and_monitor',
      prescriber_action: 'Confirm the pair.',
    },
    evidence: [
      {
        source_id: 'test-victim-label',
        product: 'VICTIMOL tablets',
        fragments: [
          {
            text: 'Concomitant use of victimol with alphacillin, betacillin, '
              + 'or gammacillin increases exposure.',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function expand(rule, memberSetClasses = MEMBER_SET_CLASSES) {
  return expandDraftRuleClassMembers({ rule, memberSetClasses });
}

test('a class rule expands to every pinned, evidence-named member', () => {
  const report = expand(classRule());
  assert.equal(report.expandable, true);
  assert.deepEqual(report.refusals, []);
  assert.deepEqual(
    report.expansions.map((entry) => entry.expanded_rule_id),
    [
      'victimol__test_inhibitor::victimol__alphacillin',
      'victimol__test_inhibitor::victimol__betacillin',
      'victimol__test_inhibitor::victimol__gammacillin',
    ],
  );
  const [first] = report.expansions;
  assert.equal(first.object_member, 'victimol');
  assert.equal(first.perpetrator_member, 'alphacillin');
  assert.deepEqual(first.object_routes, ['oral']);
  assert.deepEqual(first.perpetrator_routes, ['systemic']);
  assert.deepEqual(first.object_named_by, ['test-victim-label']);
  assert.deepEqual(first.perpetrator_named_by, ['test-victim-label']);
});

test('expansion output is deterministic and byte-stable across runs', () => {
  const left = JSON.stringify(expand(classRule()), null, 2);
  const right = JSON.stringify(expand(classRule()), null, 2);
  assert.equal(left, right);
});

test('an exact pair rule expands to its own singleton instantiation', () => {
  const rule = classRule({
    rule_id: 'victimol__alphacillin',
    perpetrator: { drug: 'alphacillin', route: ['oral'] },
  });
  const report = expand(rule);
  assert.deepEqual(report.refusals, []);
  assert.deepEqual(
    report.expansions.map((entry) => entry.expanded_rule_id),
    ['victimol__alphacillin::victimol__alphacillin'],
  );
});

test('an unknown member-set class refuses the whole side', () => {
  const rule = classRule();
  rule.perpetrator.class = 'unlisted_class';
  const report = expand(rule);
  assert.equal(report.expandable, false);
  assert.deepEqual(report.expansions, []);
  assert.equal(report.refusals.length, 1);
  assert.equal(report.refusals[0].reason, 'unknown_member_set');
  assert.match(
    report.refusals[0].message,
    /class "unlisted_class" is not defined in the pinned member sets/u,
  );
});

test('an unknown strength bucket refuses the side', () => {
  const rule = classRule();
  rule.perpetrator.strength = ['moderate'];
  const report = expand(rule);
  assert.deepEqual(report.expansions, []);
  assert.equal(report.refusals[0].reason, 'unknown_member_set');
  assert.match(report.refusals[0].message, /strength "moderate"/u);
});

test('a class with several buckets and no declared strength is ambiguous', () => {
  const rule = classRule();
  rule.perpetrator = { class: 'multi_bucket_inhibitor', route: ['systemic'] };
  const report = expand(rule);
  assert.deepEqual(report.expansions, []);
  assert.equal(report.refusals[0].reason, 'ambiguous_member_set_strength');
});

test('a multi-valued strength array refuses instead of unioning buckets', () => {
  const rule = classRule();
  rule.perpetrator = {
    class: 'multi_bucket_inhibitor',
    strength: ['strong', 'moderate'],
    route: ['systemic'],
  };
  const report = expand(rule);
  assert.deepEqual(report.expansions, []);
  assert.equal(report.refusals[0].reason, 'ambiguous_member_set_strength');
  assert.match(report.refusals[0].message, /must pin exactly one strength bucket/u);
});

test('a roster member absent from the pinned member set is a hard error, not a drop', () => {
  const rule = classRule();
  rule.perpetrator.members = ['alphacillin', 'betacillin', 'gammacillin', 'roguecillin'];
  rule.evidence[0].fragments[0].text += ' Also roguecillin.';
  const report = expand(rule);
  const refusal = report.refusals.find((entry) => entry.member === 'roguecillin');
  assert.equal(refusal.reason, 'member_not_in_pinned_member_set');
  assert.match(
    refusal.message,
    /absent from pinned member set test_inhibitor\[strong\]/u,
  );
  assert.match(refusal.message, /through the draft flow/u);
  assert.equal(report.expansions.length, 3);
});

test('a pinned member the roster neither lists nor excepts is refused, never silently dropped', () => {
  const rule = classRule();
  rule.perpetrator.members = ['alphacillin'];
  const report = expand(rule);
  const unaccounted = report.refusals
    .filter((entry) => entry.reason === 'pinned_member_unaccounted')
    .map((entry) => entry.member);
  assert.deepEqual(unaccounted, ['betacillin', 'gammacillin']);
  assert.deepEqual(
    report.expansions.map((entry) => entry.perpetrator_member),
    ['alphacillin'],
  );
});

test('member exceptions narrow the pinned roster and must exist in it', () => {
  const rule = classRule();
  rule.perpetrator.member_exceptions = ['betacillin'];
  const narrowed = expand(rule);
  assert.deepEqual(narrowed.refusals, []);
  assert.deepEqual(
    narrowed.expansions.map((entry) => entry.perpetrator_member),
    ['alphacillin', 'gammacillin'],
  );

  const unknown = classRule();
  unknown.perpetrator.member_exceptions = ['notacillin'];
  const report = expand(unknown);
  const refusal = report.refusals.find((entry) => entry.member === 'notacillin');
  assert.equal(refusal.reason, 'member_exception_not_in_pinned_member_set');
});

test('an explicit empty roster refuses instead of inheriting the pinned members', () => {
  const rule = classRule();
  rule.perpetrator.members = [];
  const report = expand(rule);
  assert.equal(report.expandable, false);
  assert.deepEqual(report.expansions, []);
  assert.deepEqual(
    report.refusals.map((entry) => entry.reason),
    ['empty_roster_after_exceptions'],
  );
});

test('a malformed explicit roster also refuses instead of inheriting pinned members', () => {
  const rule = classRule();
  rule.perpetrator.members = ['alphacillin', ''];
  const report = expand(rule);
  assert.equal(report.expandable, false);
  assert.deepEqual(report.expansions, []);
  assert.deepEqual(
    report.refusals.map((entry) => entry.reason),
    ['empty_roster_after_exceptions'],
  );
});

test('exceptions that empty the roster refuse explicitly instead of yielding a silent non-expansion', () => {
  // PR #14 Finding 2: pre-fix, a side whose member_exceptions removed every
  // pinned member reported expandable:false with ZERO refusals — nothing
  // expanded and nothing explained why.
  const allExcepted = classRule();
  allExcepted.perpetrator.member_exceptions = [
    'alphacillin', 'betacillin', 'gammacillin',
  ];
  const report = expand(allExcepted);
  assert.equal(report.expandable, false);
  assert.deepEqual(report.expansions, []);
  assert.equal(report.refusals.length, 1);
  assert.equal(report.refusals[0].reason, 'empty_roster_after_exceptions');
  assert.equal(report.refusals[0].side, 'perpetrator');
  assert.match(
    report.refusals[0].message,
    /no expandable member of pinned member set test_inhibitor\[strong\] remains/u,
  );
  assert.match(report.refusals[0].message, /through the draft flow/u);

  // Same silent case with an embedded roster fully intersected away by the
  // exceptions.
  const embeddedExcepted = classRule();
  embeddedExcepted.perpetrator.members = ['alphacillin', 'betacillin', 'gammacillin'];
  embeddedExcepted.perpetrator.member_exceptions = [
    'alphacillin', 'betacillin', 'gammacillin',
  ];
  const embeddedReport = expand(embeddedExcepted);
  assert.equal(embeddedReport.expandable, false);
  assert.deepEqual(
    embeddedReport.refusals.map((entry) => entry.reason),
    ['empty_roster_after_exceptions'],
  );
});

test('non-canonical identities are refused, never renamed', () => {
  const pinnedBad = classRule();
  pinnedBad.perpetrator = {
    class: 'noncanonical_set',
    strength: ['strong'],
    route: ['systemic'],
  };
  const report = expand(pinnedBad);
  const refusal = report.refusals.find((entry) => entry.member === 'rifampin');
  assert.equal(refusal.reason, 'member_identity_not_canonical');
  assert.match(refusal.message, /canonical form is "rifampicin"/u);
  assert.match(refusal.message, /never renames members/u);

  const embeddedBad = classRule();
  embeddedBad.perpetrator.members = ['alphacillin', 'betacillin', 'gammacillin'];
  embeddedBad.object = { drug: 'Cyclosporine', route: ['oral'] };
  const objectReport = expand(embeddedBad);
  const objectRefusal = objectReport.refusals.find(
    (entry) => entry.side === 'object',
  );
  assert.equal(objectRefusal.reason, 'member_identity_not_canonical');
  assert.deepEqual(objectReport.expansions, []);
});

test('a side with no reviewed route data refuses with missing_route_data', () => {
  const rule = classRule({
    object: { drug: 'victimol' },
    applicability: { routes: [], formulations: [] },
  });
  const report = expand(rule);
  assert.equal(report.expandable, false);
  const refusal = report.refusals.find((entry) => entry.side === 'object');
  assert.equal(refusal.reason, 'missing_route_data');
  assert.match(refusal.message, /no reviewed route data/u);
});

test('applicability routes back a side that omits its own route array', () => {
  const rule = classRule({ object: { drug: 'victimol' } });
  const report = expand(rule);
  assert.deepEqual(report.refusals, []);
  assert.deepEqual(report.expansions[0].object_routes, ['oral']);
});

test('a member no evidence fragment or product names is refused', () => {
  const rule = classRule();
  rule.evidence[0].fragments[0].text =
    'Concomitant use of victimol with alphacillin or betacillin increases exposure.';
  const report = expand(rule);
  const refusal = report.refusals.find((entry) => entry.member === 'gammacillin');
  assert.equal(refusal.reason, 'evidence_does_not_name_member');
  assert.match(refusal.message, /evidence does not name member/u);
  assert.deepEqual(
    report.expansions.map((entry) => entry.perpetrator_member),
    ['alphacillin', 'betacillin'],
  );
});

test('evidence naming requires standalone words, not substrings', () => {
  const rule = classRule();
  // "cillin" alone must not match inside "alphacillin".
  rule.evidence[0].fragments[0].text =
    'Concomitant use of victimol with superalphacillin, betacillin, or '
    + 'gammacillin increases exposure.';
  const report = expand(rule);
  const refusal = report.refusals.find((entry) => entry.member === 'alphacillin');
  assert.equal(refusal.reason, 'evidence_does_not_name_member');
});

test('the evidence product identity names the label subject', () => {
  const rule = classRule();
  // The fragment no longer names victimol; the record's product does.
  rule.evidence[0].fragments[0].text =
    'Concomitant use with alphacillin, betacillin, or gammacillin increases exposure.';
  const report = expand(rule);
  assert.deepEqual(report.refusals, []);
  assert.deepEqual(report.expansions[0].object_named_by, ['test-victim-label']);
});

test('self-pairs are refused instead of instantiated', () => {
  const rule = classRule({
    object: { drug: 'alphacillin', route: ['oral'] },
  });
  rule.evidence[0].product = 'ALPHACILLIN tablets';
  const report = expand(rule);
  const refusal = report.refusals.find((entry) => entry.reason === 'self_pair');
  assert.equal(refusal.member, 'alphacillin');
  assert.deepEqual(
    report.expansions.map((entry) => entry.perpetrator_member),
    ['betacillin', 'gammacillin'],
  );
});

test('a selector carrying both drug and class refuses as ambiguous', () => {
  // PR #14 Finding 3: pre-fix, a dual-identity selector expanded on `drug`
  // and silently dropped the class roster the author embedded.
  const rule = classRule();
  rule.perpetrator = {
    drug: 'alphacillin',
    class: 'test_inhibitor',
    strength: ['strong'],
    route: ['systemic'],
  };
  const report = expand(rule);
  assert.equal(report.expandable, false);
  assert.deepEqual(report.expansions, []);
  assert.equal(report.refusals.length, 1);
  assert.equal(report.refusals[0].reason, 'ambiguous_selector_identity');
  assert.equal(report.refusals[0].side, 'perpetrator');
  assert.match(
    report.refusals[0].message,
    /carries both a drug selector and a class selector/u,
  );
  assert.match(report.refusals[0].message, /through the draft flow/u);

  // Even a null placeholder under the second identity key is ambiguous —
  // the selector's intent is unreadable, so it refuses.
  const nullClass = classRule();
  nullClass.perpetrator = { drug: 'alphacillin', class: null, route: ['systemic'] };
  const nullReport = expand(nullClass);
  assert.deepEqual(
    nullReport.refusals.map((entry) => entry.reason),
    ['ambiguous_selector_identity'],
  );
});

test('combination and substance selectors are not expandable', () => {
  const rule = classRule();
  rule.perpetrator = {
    combination: [{ drug: 'alphacillin' }, { drug: 'betacillin' }],
    route: ['oral'],
  };
  const report = expand(rule);
  assert.equal(report.refusals[0].reason, 'unsupported_selector');
  assert.deepEqual(report.expansions, []);
});

test('expanded rule ids are deterministic slugs of the member pair', () => {
  assert.equal(
    expandedRuleId('parent__rule', 'simvastatin', 'clarithromycin'),
    'parent__rule::simvastatin__clarithromycin',
  );
  assert.equal(expandedMemberSlug("st john's wort"), 'st_john_s_wort');
  assert.equal(
    expandedRuleId('r', "st john's wort", 'grapefruit juice'),
    'r::st_john_s_wort__grapefruit_juice',
  );
  assert.throws(() => expandedMemberSlug('---'), /no expandable slug/u);
});

test('instantiation produces an exact-selector rule pinned to the approved scope', () => {
  const parent = classRule();
  const rule = instantiateExpandedDraftRule({
    parentRule: parent,
    memberSetClasses: MEMBER_SET_CLASSES,
    objectMember: 'victimol',
    perpetratorMember: 'betacillin',
    route: 'oral',
    formulation: 'tablet',
    expectedRuleId: 'victimol__test_inhibitor::victimol__betacillin',
  });
  assert.equal(rule.rule_id, 'victimol__test_inhibitor::victimol__betacillin');
  assert.deepEqual(rule.object, {
    drug: 'victimol',
    route: ['oral'],
    formulation: ['tablet'],
  });
  assert.deepEqual(rule.perpetrator, {
    drug: 'betacillin',
    route: ['oral'],
    formulation: ['tablet'],
  });
  assert.deepEqual(rule.applicability.routes, ['oral']);
  assert.deepEqual(rule.applicability.formulations, ['tablet']);
  assert.deepEqual(rule.applicability.jurisdiction, ['US']);
  assert.equal(rule.severity, 'major');
  assert.deepEqual(rule.expanded_from, {
    parent_rule_id: 'victimol__test_inhibitor',
    object_member: 'victimol',
    perpetrator_member: 'betacillin',
  });
  // Management and evidence are carried from the parent by value, not by
  // reference.
  rule.management.prescriber_action = 'mutated';
  rule.evidence[0].product = 'mutated';
  assert.equal(parent.management.prescriber_action, 'Confirm the pair.');
  assert.equal(parent.evidence[0].product, 'VICTIMOL tablets');
});

test('instantiation rejects a mismatched expected rule id', () => {
  assert.throws(
    () => instantiateExpandedDraftRule({
      parentRule: classRule(),
      memberSetClasses: MEMBER_SET_CLASSES,
      objectMember: 'victimol',
      perpetratorMember: 'betacillin',
      route: 'oral',
      formulation: 'tablet',
      expectedRuleId: 'victimol__test_inhibitor::victimol__alphacillin',
    }),
    /does not match the deterministic expansion id/u,
  );
});

test('instantiation refuses members the expansion validator refused', () => {
  const parent = classRule();
  parent.perpetrator.members = ['alphacillin', 'betacillin', 'gammacillin', 'roguecillin'];
  parent.evidence[0].fragments[0].text += ' Also roguecillin.';
  assert.throws(
    () => instantiateExpandedDraftRule({
      parentRule: parent,
      memberSetClasses: MEMBER_SET_CLASSES,
      objectMember: 'victimol',
      perpetratorMember: 'roguecillin',
      route: 'oral',
      formulation: 'tablet',
    }),
    /refuses to expand victimol × roguecillin.*absent from pinned member set/u,
  );

  const unnamed = classRule();
  unnamed.evidence[0].fragments[0].text =
    'Concomitant use of victimol with alphacillin or betacillin increases exposure.';
  assert.throws(
    () => instantiateExpandedDraftRule({
      parentRule: unnamed,
      memberSetClasses: MEMBER_SET_CLASSES,
      objectMember: 'victimol',
      perpetratorMember: 'gammacillin',
      route: 'oral',
      formulation: 'tablet',
    }),
    /evidence does not name member/u,
  );
});

test('instantiation rejects a member outside the roster entirely', () => {
  assert.throws(
    () => instantiateExpandedDraftRule({
      parentRule: classRule(),
      memberSetClasses: MEMBER_SET_CLASSES,
      objectMember: 'victimol',
      perpetratorMember: 'paracetamol',
      route: 'oral',
      formulation: 'tablet',
    }),
    /does not expand to member pair victimol × paracetamol/u,
  );
});

test('the approved route must be inside the reviewed route scope', () => {
  assert.throws(
    () => instantiateExpandedDraftRule({
      parentRule: classRule(),
      memberSetClasses: MEMBER_SET_CLASSES,
      objectMember: 'victimol',
      perpetratorMember: 'betacillin',
      route: 'intravenous',
      formulation: 'injection',
    }),
    /route "intravenous" is outside the reviewed object route scope \[oral\]/u,
  );
});

test('abstract systemic scope narrows to oral; parenteral does not', () => {
  const systemic = instantiateExpandedDraftRule({
    parentRule: classRule(),
    memberSetClasses: MEMBER_SET_CLASSES,
    objectMember: 'victimol',
    perpetratorMember: 'alphacillin',
    route: 'oral',
    formulation: 'tablet',
  });
  assert.deepEqual(systemic.perpetrator.route, ['oral']);

  const parenteralParent = classRule();
  parenteralParent.perpetrator.route = ['parenteral'];
  assert.throws(
    () => instantiateExpandedDraftRule({
      parentRule: parenteralParent,
      memberSetClasses: MEMBER_SET_CLASSES,
      objectMember: 'victimol',
      perpetratorMember: 'alphacillin',
      route: 'oral',
      formulation: 'tablet',
    }),
    /route "oral" is outside the reviewed perpetrator route scope \[parenteral\]/u,
  );
});

test('a reviewed formulation constraint binds the approved formulation', () => {
  const parent = classRule();
  parent.object.formulation = ['tablet'];
  assert.throws(
    () => instantiateExpandedDraftRule({
      parentRule: parent,
      memberSetClasses: MEMBER_SET_CLASSES,
      objectMember: 'victimol',
      perpetratorMember: 'alphacillin',
      route: 'oral',
      formulation: 'capsule',
    }),
    /formulation "capsule" is outside the reviewed object formulation scope \[tablet\]/u,
  );
  const allowed = instantiateExpandedDraftRule({
    parentRule: parent,
    memberSetClasses: MEMBER_SET_CLASSES,
    objectMember: 'victimol',
    perpetratorMember: 'alphacillin',
    route: 'oral',
    formulation: 'tablet',
  });
  assert.deepEqual(allowed.object.formulation, ['tablet']);
});
