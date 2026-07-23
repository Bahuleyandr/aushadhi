import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateDraftRules } from '../src/lib/interaction-draft-validation.mjs';

function validRule(ruleId = 'rule', overrides = {}) {
  return {
    rule_id: ruleId,
    object: { drug: 'a', route: ['oral'], formulation: ['tablet'] },
    perpetrator: { drug: 'b', route: ['oral'], formulation: ['tablet'] },
    severity: 'major',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
    proposed_status: 'draft_for_review',
    applicability: { routes: ['oral'], formulations: ['tablet'], jurisdiction: ['US'] },
    review: { author: null, approver: null, conf: 'H' },
    evidence: [{
      supports: {
        interaction_exists: true,
        label_action: ['confirm_and_monitor'],
        jurisdictions: ['US'],
      },
    }],
    runtime_status: {
      pair_matcher_executable: true,
      clinical_context_complete: true,
      runtime_enabled: true,
      promotion_eligible: false,
    },
    runtime_enabled: true,
    ...overrides,
  };
}

test('a complete draft rule passes closed validation', () => {
  const rules = [validRule()];
  assert.equal(validateDraftRules(rules), rules);
});

test('runtime status requires exactly four booleans and a mirrored top-level flag', () => {
  const missingTopLevel = validRule();
  delete missingTopLevel.runtime_enabled;
  assert.throws(() => validateDraftRules([missingTopLevel]), /runtime_enabled must be a boolean/i);

  const missingStatusField = validRule();
  delete missingStatusField.runtime_status.clinical_context_complete;
  assert.throws(
    () => validateDraftRules([missingStatusField]),
    /runtime_status\.clinical_context_complete must be a boolean/i,
  );

  const extraStatusField = validRule('extra', {
    runtime_status: {
      ...validRule().runtime_status,
      runtime_executable: true,
    },
  });
  assert.throws(() => validateDraftRules([extraStatusField]), /unknown property runtime_executable/i);

  const mismatch = validRule('mismatch', { runtime_enabled: false });
  assert.throws(() => validateDraftRules([mismatch]), /must mirror/i);

  const promotionEligible = validRule('promotion', {
    runtime_status: {
      ...validRule().runtime_status,
      promotion_eligible: true,
    },
  });
  assert.throws(() => validateDraftRules([promotionEligible]), /promotion_eligible=false/i);

  const nonExecutable = validRule('non-executable', {
    runtime_status: {
      ...validRule().runtime_status,
      pair_matcher_executable: false,
    },
  });
  assert.throws(
    () => validateDraftRules([nonExecutable]),
    /runtime_enabled=true requires.*pair_matcher_executable=true/i,
  );

  const diagnosticNonExecutable = validRule('diagnostic-non-executable', {
    runtime_enabled: false,
    runtime_status: {
      ...validRule().runtime_status,
      pair_matcher_executable: false,
      clinical_context_complete: false,
      runtime_enabled: false,
    },
  });
  assert.equal(validateDraftRules([diagnosticNonExecutable])[0], diagnosticNonExecutable);

  const incompleteRuntime = validRule('incomplete-runtime', {
    runtime_status: {
      ...validRule().runtime_status,
      clinical_context_complete: false,
    },
  });
  assert.throws(
    () => validateDraftRules([incompleteRuntime]),
    /runtime_enabled=true requires runtime_status\.clinical_context_complete=true/i,
  );
});

test('complete/runtime draft scopes require concrete presentations and pinned role rosters', () => {
  for (const [label, object, pattern] of [
    [
      'abstract-route',
      { drug: 'a', route: ['systemic'], formulation: ['tablet'] },
      /object\.route contains an abstract runtime scope/i,
    ],
    [
      'abstract-form',
      { drug: 'a', route: ['oral'], formulation: ['immediate_release'] },
      /object\.formulation contains an abstract runtime scope/i,
    ],
    [
      'empty-route',
      { drug: 'a', route: [], formulation: ['tablet'] },
      /object\.route must be a non-empty array/i,
    ],
    [
      'unpinned-class',
      { class: 'victim', route: ['oral'], formulation: ['tablet'] },
      /object\.class requires an inline pinned members roster/i,
    ],
    [
      'manual-combination',
      {
        combination: [{ drug: 'a' }, { drug: 'c' }],
        route: ['oral'],
        formulation: ['tablet'],
        match_semantics: 'all_of_present',
      },
      /manual-review only and cannot be clinical_context_complete/i,
    ],
  ]) {
    assert.throws(
      () => validateDraftRules([validRule(label, { object })]),
      pattern,
      label,
    );
  }

  assert.throws(
    () => validateDraftRules([validRule('overlap', {
      object: {
        class: 'left',
        members: ['a', 'b'],
        route: ['oral'],
        formulation: ['tablet'],
      },
      perpetrator: {
        class: 'right',
        members: ['a', 'b'],
        route: ['oral'],
        formulation: ['tablet'],
      },
    })]),
    /runtime role selectors overlap/i,
  );

  const disabledAbstract = validRule('disabled-abstract', {
    object: { drug: 'a', route: ['systemic'], formulation: ['solid_oral'] },
    runtime_enabled: false,
    runtime_status: {
      ...validRule().runtime_status,
      clinical_context_complete: false,
      runtime_enabled: false,
    },
  });
  assert.equal(validateDraftRules([disabledAbstract])[0], disabledAbstract);
});

test('draft review metadata cannot self-authorize runtime promotion', () => {
  for (const review of [
    {
      author: null,
      approver: null,
      status: 'clinician_reviewed',
    },
    {
      author: 'clinician:author',
      approver: null,
    },
    {
      author: null,
      approver: 'clinician:approver',
    },
    {
      author: null,
      approver: null,
      reviewed_at: '2026-07-24',
    },
  ]) {
    assert.throws(
      () => validateDraftRules([validRule('self-authorized', { review })]),
      /draft rules must not claim review\.(?:status=clinician_reviewed|author|approver|reviewed_at)/i,
    );
  }
});

test('route and formulation selectors are closed typed lists', () => {
  assert.throws(
    () => validateDraftRules([validRule('bad-object-route', {
      object: { drug: 'a', route: ['intraocular_typo'], formulation: ['tablet'] },
    })]),
    /object\.route contains invalid value "intraocular_typo"/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('bad-combination-form', {
      object: {
        combination: [
          { drug: 'a', route: ['oral'], formulation: ['tablet'] },
          { drug: 'c', route: ['oral'], formulation: ['mystery_form'] },
        ],
      },
    })]),
    /object\.combination\[1\]\.formulation contains invalid value/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('bad-app-route', {
      applicability: {
        routes: ['oral', 'oral'],
        formulations: ['tablet'],
        jurisdiction: ['US'],
      },
    })]),
    /applicability\.routes contains duplicate oral/i,
  );
});

test('subject selectors are closed and executable rules require exactly one identity per side', () => {
  assert.throws(
    () => validateDraftRules([validRule('dual-identity', {
      perpetrator: {
        drug: 'b',
        class: 'some_class',
        route: ['oral'],
        formulation: ['tablet'],
      },
    })]),
    /perpetrator must contain exactly one identity selector/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('unknown-selector-key', {
      perpetrator: {
        drug: 'b',
        route: ['oral'],
        formulation: ['tablet'],
        route_hint: 'oral',
      },
    })]),
    /perpetrator contains unknown property route_hint/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('missing-side', { perpetrator: undefined })]),
    /executable rules require a perpetrator/i,
  );

  const inertUnary = validRule('inert-unary', {
    perpetrator: undefined,
    runtime_enabled: false,
    runtime_status: {
      ...validRule().runtime_status,
      pair_matcher_executable: false,
      clinical_context_complete: false,
      runtime_enabled: false,
    },
  });
  assert.equal(validateDraftRules([inertUnary])[0], inertUnary);
});

test('complete contexts cannot rely on unmodeled dose, exclusion, or initiation direction', () => {
  for (const object of [
    {
      drug: 'a',
      route: ['oral'],
      formulation: ['tablet'],
      dose: 'low_dose',
    },
    {
      drug: 'a',
      route: ['oral'],
      formulation: ['tablet'],
      formulation_exclusions: ['enteric_coated'],
    },
    {
      drug: 'a',
      route: ['oral'],
      formulation: ['tablet'],
      dose_note: 'only at low dose',
    },
    {
      drug: 'a',
      route: ['oral'],
      formulation: ['tablet'],
      member_tiers: { strong: ['a'] },
    },
  ]) {
    assert.throws(
      () => validateDraftRules([validRule('unmodeled', { object })]),
      /clinical_context_complete=true cannot depend on unmodeled selector context/i,
    );
  }
  assert.throws(
    () => validateDraftRules([validRule('direction', {
      management: {
        dispense_action: 'withhold_and_clarify',
        action_target: 'newly_added_perpetrator',
      },
    })]),
    /cannot use newly_added action_target without initiation direction/i,
  );

  const diagnostic = validRule('unmodeled-diagnostic', {
    object: {
      drug: 'a',
      route: ['oral'],
      formulation: ['tablet'],
      dose: 'low_dose',
    },
    runtime_enabled: false,
    runtime_status: {
      ...validRule().runtime_status,
      clinical_context_complete: false,
      runtime_enabled: false,
    },
  });
  assert.equal(validateDraftRules([diagnostic])[0], diagnostic);
});

test('indication applicability is null or a closed string array', () => {
  assert.throws(
    () => validateDraftRules([validRule('string-indication', {
      applicability: {
        routes: ['oral'],
        formulations: ['tablet'],
        indication: 'oncology',
        jurisdiction: ['US'],
      },
    })]),
    /applicability\.indication must be an array/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('duplicate-indication', {
      applicability: {
        routes: ['oral'],
        formulations: ['tablet'],
        indication: ['oncology', 'oncology'],
        jurisdiction: ['US'],
      },
    })]),
    /applicability\.indication contains duplicate oncology/i,
  );
});

test('runtime-enabled jurisdiction scope requires same-jurisdiction interaction and action evidence', () => {
  assert.throws(
    () => validateDraftRules([validRule('missing-scope', { applicability: {} })]),
    /at least one applicability jurisdiction/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('empty-scope', {
      applicability: { jurisdiction: [] },
    })]),
    /at least one applicability jurisdiction/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('invalid-scope', {
      applicability: { jurisdiction: ['CA'] },
    })]),
    /invalid jurisdiction/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('duplicate-scope', {
      applicability: { jurisdiction: ['US', 'US'] },
    })]),
    /contains duplicate US/i,
  );

  const crossJurisdiction = validRule('cross-jurisdiction', {
    applicability: { jurisdiction: ['US', 'IN'] },
    jurisdiction_transfer: {
      from: 'US',
      to: 'IN',
      rationale: 'unapproved transfer metadata must not bypass evidence',
    },
  });
  assert.throws(
    () => validateDraftRules([crossJurisdiction]),
    /jurisdiction IN requires same-jurisdiction/i,
  );

  const effectOnly = validRule('effect-only', {
    applicability: { jurisdiction: ['US', 'UK'] },
    evidence: [
      ...validRule().evidence,
      {
        supports: {
          interaction_exists: true,
          label_action: [],
          jurisdictions: ['UK'],
        },
      },
    ],
  });
  assert.throws(
    () => validateDraftRules([effectOnly]),
    /jurisdiction UK requires same-jurisdiction/i,
  );

  const blankAction = validRule('blank-action', {
    evidence: [{
      supports: {
        interaction_exists: true,
        label_action: ['  ', null],
        jurisdictions: ['US'],
      },
    }],
  });
  assert.throws(
    () => validateDraftRules([blankAction]),
    /jurisdiction US requires same-jurisdiction/i,
  );

  const fullyBacked = validRule('fully-backed', {
    applicability: { jurisdiction: ['US', 'UK'] },
    evidence: [
      ...validRule().evidence,
      {
        supports: {
          interaction_exists: true,
          label_action: ['withhold_and_clarify'],
          jurisdictions: ['UK'],
        },
      },
    ],
  });
  assert.equal(validateDraftRules([fullyBacked])[0], fullyBacked);

  const diagnosticTransfer = validRule('diagnostic-transfer', {
    runtime_enabled: false,
    runtime_status: {
      ...validRule().runtime_status,
      runtime_enabled: false,
    },
    applicability: { jurisdiction: ['IN'] },
  });
  assert.equal(validateDraftRules([diagnosticTransfer])[0], diagnosticTransfer);
});

test('invalid severity, action, factor, predicate, and unknown-data policy are rejected', () => {
  assert.throws(
    () => validateDraftRules([validRule('severity', { severity: 'critical' })]),
    /invalid severity/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('action', {
      management: { dispense_action: 'continue' },
    })]),
    /invalid dispense action/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('factor', {
      context_modifiers: [{
        factor: 'cardiac',
        when: 'egfr_lt_30',
        severity: 'major',
        on_unknown: 'base',
      }],
    })]),
    /invalid factor/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('predicate', {
      context_modifiers: [{
        factor: 'renal',
        when: 'egfr_near_30',
        severity: 'major',
        on_unknown: 'base',
      }],
    })]),
    /invalid predicate/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('unknown', {
      context_modifiers: [{
        factor: 'renal',
        when: 'egfr_lt_30',
        severity: 'major',
        on_unknown: 'ignore',
      }],
    })]),
    /invalid on_unknown/i,
  );
});

test('unknown-data escalation requires an explicit operational action', () => {
  const rule = validRule('escalate', {
    context_modifiers: [{
      factor: 'renal',
      when: 'crcl_lt_30',
      severity: 'contraindicated',
      on_unknown: 'escalate',
    }],
  });
  assert.throws(() => validateDraftRules([rule]), /requires an explicit dispense_action/i);
});

test('duplicate IDs and invalid suppression references are rejected', () => {
  assert.throws(
    () => validateDraftRules([validRule('duplicate'), validRule('duplicate')]),
    /duplicate rule_id/i,
  );
  assert.throws(
    () => validateDraftRules([validRule('unknown-target', { suppresses: ['missing'] })]),
    /suppresses unknown rule/i,
  );

  const enabled = validRule('enabled');
  const diagnostic = validRule('diagnostic', {
    runtime_enabled: false,
    runtime_status: {
      ...validRule().runtime_status,
      runtime_enabled: false,
    },
    suppresses: ['enabled'],
  });
  assert.throws(
    () => validateDraftRules([enabled, diagnostic]),
    /across runtime status/i,
  );

  assert.throws(
    () => validateDraftRules([validRule('self', { suppresses: ['self'] })]),
    /must not suppress itself/i,
  );
  assert.throws(
    () => validateDraftRules([
      validRule('weak', {
        severity: 'minor',
        management: { dispense_action: 'supply_with_counselling' },
        suppresses: ['strong'],
      }),
      validRule('strong', {
        severity: 'contraindicated',
        management: { dispense_action: 'withhold_and_clarify' },
      }),
    ]),
    /must not suppress stronger rule strong/i,
  );
});

test('suppression cycles of any length are rejected without blocking acyclic chains', () => {
  assert.throws(
    () => validateDraftRules([
      validRule('a', { suppresses: ['b'] }),
      validRule('b', { suppresses: ['a'] }),
    ]),
    /suppression cycle detected: a -> b -> a/i,
  );

  assert.throws(
    () => validateDraftRules([
      validRule('a', { suppresses: ['b'] }),
      validRule('b', { suppresses: ['c'] }),
      validRule('c', { suppresses: ['a'] }),
    ]),
    /suppression cycle detected: a -> b -> c -> a/i,
  );

  const acyclic = [
    validRule('a', { suppresses: ['b'] }),
    validRule('b', { suppresses: ['c'] }),
    validRule('c'),
  ];
  assert.equal(validateDraftRules(acyclic), acyclic);
});

test('ambiguous equal-specificity modifiers that can co-match are rejected', () => {
  const ambiguous = validRule('ambiguous', {
    context_modifiers: [
      {
        factor: 'renal',
        when: 'egfr_lt_30',
        severity: 'major',
        dispense_action: 'confirm_and_monitor',
        on_unknown: 'base',
      },
      {
        factor: 'renal',
        when: 'crcl_lt_30',
        severity: 'contraindicated',
        dispense_action: 'withhold_and_clarify',
        on_unknown: 'base',
      },
    ],
  });
  assert.throws(
    () => validateDraftRules([ambiguous]),
    /ambiguous equal-specificity modifiers/i,
  );

  const disjoint = validRule('disjoint', {
    context_modifiers: [
      {
        factor: 'renal',
        when: 'crcl_lt_30',
        severity: 'contraindicated',
        dispense_action: 'withhold_and_clarify',
        on_unknown: 'base',
      },
      {
        factor: 'renal',
        when: 'crcl_30_to_50',
        severity: 'major',
        dispense_action: 'confirm_and_monitor',
        on_unknown: 'base',
      },
    ],
  });
  assert.equal(validateDraftRules([disjoint])[0], disjoint);
});
