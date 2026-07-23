import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertEvidenceAllowed,
  loadSourceManifest,
} from '../src/lib/interaction-source-policy.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const sectionRoot = join(
  repo,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'sections',
);
const manifest = loadSourceManifest();
const sections = Object.fromEntries(
  ['G', 'H', 'J'].map((section) => [
    section,
    readFileSync(join(sectionRoot, `${section}.verified.jsonl`), 'utf8')
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line)),
  ]),
);
const byId = Object.fromEntries(
  Object.entries(sections).map(([section, rules]) => [
    section,
    Object.fromEntries(rules.map((rule) => [rule.rule_id, rule])),
  ]),
);

const expected = {
  G: { rules: 28, evidence: 29, fragments: 51 },
  H: { rules: 19, evidence: 24, fragments: 54 },
  J: { rules: 12, evidence: 21, fragments: 41 },
};
const restrictedDerivedPattern =
  /medicines\.org\.uk|\bemc[-_]|uk-smpc|J-UK|J-ACR|J-FDA03|acr\.org|accessdata\.fda\.gov|ACR manual|electronic Medicines|SmPC|retained UK|current UK|UK source/iu;

test('Sections G, H and J contain only fail-closed openFDA evidence metadata', () => {
  for (const [section, rules] of Object.entries(sections)) {
    const evidence = rules.flatMap((rule) => rule.evidence);
    const fragments = evidence.flatMap((entry) => entry.fragments);

    assert.equal(rules.length, expected[section].rules, `${section} rule count`);
    assert.equal(evidence.length, expected[section].evidence, `${section} evidence count`);
    assert.equal(fragments.length, expected[section].fragments, `${section} fragment count`);

    for (const rule of rules) {
      assert.equal(
        Object.hasOwn(rule, 'manual_references'),
        false,
        `${section}/${rule.rule_id} must not retain manual references`,
      );
      for (const entry of rule.evidence) {
        assert.equal(
          entry.source_policy_id,
          'openfda-labels',
          `${section}/${rule.rule_id}/${entry.source_id} source policy`,
        );
        assert.equal(
          new URL(entry.source_url).hostname,
          'api.fda.gov',
          `${section}/${rule.rule_id}/${entry.source_id} licensed origin`,
        );
        assert.throws(
          () => assertEvidenceAllowed(manifest, entry, {
            profile: 'production-open',
            use: entry.source_policy_use,
            storagePath:
              `docs/interaction-review/batch-01-v2/sections/${section}.verified.jsonl`,
          }),
          /verified source payload is required/i,
          `${section}/${rule.rule_id}/${entry.source_id} must not self-authorize`,
        );
      }
    }
  }
});

test('restricted and rights-unclear material is absent from slices and worksheets', () => {
  for (const section of ['G', 'H', 'J']) {
    const slice = readFileSync(join(sectionRoot, `${section}.verified.jsonl`), 'utf8');
    const worksheet = readFileSync(
      join(repo, 'docs', 'interaction-review', `2026-07-23-section-${section}-citations.md`),
      'utf8',
    );
    assert.doesNotMatch(slice, restrictedDerivedPattern, `${section} slice`);
    assert.doesNotMatch(worksheet, restrictedDerivedPattern, `${section} worksheet`);
    assert.match(
      worksheet,
      /Excluded or rights-unclear sources are not linked, quoted, summarized, or represented as machine evidence\./u,
      `${section} exclusion statement`,
    );
  }
});

test('evidence gaps fail closed and disabled rules cannot suppress enabled rules', () => {
  const allRules = Object.values(sections).flat();
  const enabled = new Set(
    allRules.filter((rule) => rule.runtime_enabled).map((rule) => rule.rule_id),
  );

  for (const rule of allRules) {
    assert.equal(
      rule.runtime_enabled,
      rule.runtime_status.runtime_enabled,
      `${rule.rule_id} runtime mirror`,
    );
    if (rule.evidence.length === 0) {
      assert.equal(rule.runtime_enabled, false, `${rule.rule_id} empty evidence must fail closed`);
      assert.equal(
        rule.runtime_status.pair_matcher_executable,
        false,
        `${rule.rule_id} empty evidence matcher must fail closed`,
      );
      assert.ok(
        rule.claims_needing_citation.some((claim) => /Open-evidence gap:/u.test(claim)),
        `${rule.rule_id} missing explicit open-evidence gap`,
      );
    }
    if (!rule.runtime_enabled) {
      for (const target of rule.suppresses ?? []) {
        assert.equal(
          enabled.has(target),
          false,
          `${rule.rule_id} disabled rule suppresses enabled ${target}`,
        );
      }
    }
  }
});

test('unsupported class and product scopes are empty non-executable placeholders', () => {
  assert.deepEqual(
    byId.G.dihydropyridine_ccb__strong_cyp3a4_inhibitor.object.members,
    [],
  );
  assert.deepEqual(
    byId.G.apixaban__pgp_moderate_cyp3a4_inhibitor.perpetrator.members,
    [],
  );
  assert.deepEqual(
    byId.H.st_johns_wort__cyp3a4_pgp_substrate.object.members,
    [],
  );
  const miconazole = byId.J.sulfonylurea__miconazole_candidate;
  assert.deepEqual(miconazole.object.members, []);
  assert.deepEqual(miconazole.perpetrator.route, []);
  assert.deepEqual(miconazole.perpetrator.formulation, []);
  assert.deepEqual(miconazole.applicability.routes, []);
  assert.deepEqual(miconazole.applicability.formulations, []);
  assert.equal(
    Object.values(byId.J)
      .filter((rule) => /miconazole/u.test(rule.rule_id))
      .length,
    1,
  );
  for (const rule of [
    byId.G.dihydropyridine_ccb__strong_cyp3a4_inhibitor,
    byId.G.apixaban__pgp_moderate_cyp3a4_inhibitor,
    byId.H.st_johns_wort__cyp3a4_pgp_substrate,
    miconazole,
  ]) {
    assert.equal(rule.risk_basis, 'unresolved_no_licence_cleared_evidence');
    assert.equal(rule.severity, 'minor');
    assert.deepEqual(rule._non_runtime_placeholder, {
      severity: 'schema_placeholder_not_a_source_claim',
      dispense_action: 'local_fail_closed_placeholder_not_a_source_claim',
    });
  }
});

test('source-named exact children close label-list gaps without cross-product expansion', () => {
  assert.deepEqual(
    byId.G.ergotamine__label_contraindicated_cyp3a4_inhibitor.perpetrator.members,
    ['indinavir', 'erythromycin', 'troleandomycin'],
  );
  assert.deepEqual(
    byId.G.sirolimus__label_avoid_cyp3a4_pgp_inhibitor.perpetrator.members,
    ['voriconazole', 'telithromycin'],
  );

  const rifabutin = byId.H.rifabutin__etonogestrel_implant;
  assert.equal(rifabutin.object.drug, 'etonogestrel implant');
  assert.equal(rifabutin.perpetrator.drug, 'rifabutin');
  assert.deepEqual(rifabutin.applicability.formulations, ['implant']);
  assert.equal(rifabutin.evidence.length, 1);

  const phenytoin = byId.H.phenytoin__etonogestrel_implant;
  assert.equal(phenytoin.object.drug, 'etonogestrel implant');
  assert.equal(phenytoin.perpetrator.drug, 'phenytoin');
  assert.deepEqual(phenytoin.applicability.formulations, ['implant']);
  assert.equal(phenytoin.evidence.length, 1);

  assert.deepEqual(
    byId.H.rifampicin__hormonal_contraceptive.perpetrator.members,
    ['rifampicin'],
  );
  assert.deepEqual(
    byId.H.enzyme_inducing_antiepileptic__hormonal_contraceptive.perpetrator.members,
    ['carbamazepine'],
  );
});

test('route-blind or incomplete selectors remain non-executable', () => {
  for (const ruleId of [
    'colchicine__strong_cyp3a4_pgp_inhibitor',
    'tacrolimus__cyp3a4_inhibitor',
    'ciclosporin__cyp3a4_inhibitor',
  ]) {
    assert.equal(byId.G[ruleId].runtime_enabled, false, ruleId);
    assert.equal(byId.G[ruleId].runtime_status.pair_matcher_executable, false, ruleId);
  }
  for (const ruleId of [
    'rifampicin__calcineurin_inhibitor',
    'carbamazepine__calcineurin_inhibitor',
    'rifampicin__systemic_corticosteroid',
    'carbamazepine__systemic_corticosteroid',
    'st_johns_wort__calcineurin_inhibitor',
  ]) {
    assert.equal(byId.H[ruleId].runtime_enabled, false, ruleId);
    assert.equal(byId.H[ruleId].runtime_status.pair_matcher_executable, false, ruleId);
  }
});

test('evidence runtime-member scopes do not exceed rewritten object scopes', () => {
  for (const [section, rules] of Object.entries(sections)) {
    for (const rule of rules) {
      const objectMembers = new Set(
        rule.object?.drug === undefined
          ? (rule.object?.members ?? [])
          : [rule.object.drug],
      );
      for (const evidence of rule.evidence) {
        const runtimeMembers = evidence.supports?.scope?.runtime_object_members;
        if (!Array.isArray(runtimeMembers)) continue;
        for (const member of runtimeMembers) {
          assert.ok(
            objectMembers.has(member),
            `${section}/${rule.rule_id}/${evidence.source_id} unsupported object member ${member}`,
          );
        }
      }
    }
  }
});

test('per-evidence runtime scopes stay within each exact retained source record', () => {
  const rifSulfonylurea = byId.H.rifampicin__sulfonylurea.evidence;
  assert.deepEqual(
    rifSulfonylurea
      .find((entry) => entry.source_id === 'dailymed-rifampin-b389b1a3-v1-sulfonylureas')
      .supports.scope.runtime_object_members,
    ['glyburide', 'glipizide'],
  );
  assert.deepEqual(
    rifSulfonylurea
      .find((entry) => entry.source_id === 'dailymed-glimepiride-fc9d8495-v2-rifampin')
      .supports.scope.runtime_object_members,
    ['glimepiride'],
  );

  const rifAntiretroviral = byId.H.rifampicin__antiretroviral;
  assert.deepEqual(
    rifAntiretroviral.object.members,
    ['atazanavir', 'darunavir', 'dolutegravir'],
  );
  assert.deepEqual(
    rifAntiretroviral.evidence.map(
      (entry) => entry.supports.scope.runtime_object_members,
    ),
    [['atazanavir', 'darunavir'], ['dolutegravir']],
  );

  const carbamazepineAntiretroviral = byId.H.carbamazepine__antiretroviral;
  assert.deepEqual(carbamazepineAntiretroviral.object.members, ['dolutegravir']);
  assert.deepEqual(
    carbamazepineAntiretroviral.evidence[0].supports.scope.runtime_object_members,
    ['dolutegravir'],
  );

  const fluconazole = byId.J.sulfonylurea__fluconazole;
  assert.deepEqual(fluconazole.object.members, ['tolbutamide', 'glipizide', 'glyburide']);
  assert.deepEqual(
    fluconazole.evidence[0].supports.scope.runtime_object_members,
    ['tolbutamide', 'glipizide', 'glyburide'],
  );
});

test('gemfibrozil is glyburide-only and retains no synthesized identity evidence', () => {
  const rule = byId.J.sulfonylurea__gemfibrozil;
  assert.deepEqual(rule.object.members, ['glyburide']);
  assert.deepEqual(
    rule.evidence.map((entry) => entry.source_policy_id),
    ['openfda-labels'],
  );
  assert.equal(
    sections.J.flatMap((entry) => entry.evidence)
      .some((entry) => entry.source_policy_id === 'fda-gsrs-unii'),
    false,
  );
});
