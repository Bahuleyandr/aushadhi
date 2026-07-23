import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECTIONS_ROOT = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'sections',
);

function sectionRules(section) {
  return fs.readFileSync(path.join(SECTIONS_ROOT, `${section}.verified.jsonl`), 'utf8')
    .trim()
    .split(/\r?\n/u)
    .map(JSON.parse);
}

function byId(section) {
  return Object.fromEntries(sectionRules(section).map((rule) => [rule.rule_id, rule]));
}

test('review prose remains aligned with retained actions and counterevidence', () => {
  const A = byId('A');
  assert.doesNotMatch(
    A.warfarin__miconazole_oromucosal_gel.management.prescriber_action,
    /mandatory warfarin dose reduction/iu,
  );
  assert.match(
    A.warfarin__miconazole_oromucosal_gel.management.prescriber_action,
    /monitor and titrate the anticoagulant effect carefully/iu,
  );
  assert.equal(
    A.warfarin__tramadol.risk_basis,
    'observed_clinical_multifactorial',
  );
  assert.doesNotMatch(
    A.warfarin__tramadol.management.exceptions,
    /forced-enum|vocabulary limited|clinician to confirm the closest enum/iu,
  );
  assert.match(
    A.apixaban__strong_cyp3a4_pgp_inhibitor.management.exceptions,
    /no dose adjustment is necessary with clarithromycin/iu,
  );
  assert.match(
    A.rivaroxaban__strong_cyp3a4_pgp_inhibitor.management.exceptions,
    /no precautions are necessary with clarithromycin/iu,
  );
  assert.match(
    A.dabigatran_hip_prophylaxis__pgp_inhibitor.management.prescriber_action,
    /separating .* by several hours may help/iu,
  );

  const C = byId('C');
  assert.ok(C.maoi_nonselective__direct_sympathomimetic);
  assert.doesNotMatch(
    C.maoi_nonselective__sympathomimetic.management.exceptions,
    /sibling rule does not yet exist|NO alert in the pack/iu,
  );
  assert.match(
    C.maoi_nonselective__direct_sympathomimetic.mechanism,
    /epinephrine as contraindicated with tranylcypromine/iu,
  );
  assert.match(
    C.maoi_nonselective__direct_sympathomimetic.management.prescriber_action,
    /norepinephrine, dopamine, and other non-selective MAOIs are class-mapped/iu,
  );

  const D = byId('D');
  assert.match(
    D.qt_macrolide__qt_prolonging_drug.management.exceptions,
    /engine does not apply automatic specificity suppression/iu,
  );
  assert.match(
    D.ondansetron__qt_prolonging_drug.management.exceptions,
    /diagnostic contraindicated finding/iu,
  );
  assert.match(
    D.methadone__cyp_inhibitor._runtime_note,
    /structured matcher can enforce the declared oral route/iu,
  );

  const I = byId('I');
  const doxycycline = I.doxycycline__polyvalent_cation;
  assert.equal(doxycycline.management.dispense_action, 'confirm_and_monitor');
  assert.equal(doxycycline.management.action_target, null);
  assert.match(
    doxycycline.management.timing,
    /No separation interval or spacing action is supported/iu,
  );
  assert.doesNotMatch(
    JSON.stringify(doxycycline.management),
    /space_doses|do not take (?:the named products )?together/iu,
  );

  const J = byId('J');
  assert.doesNotMatch(
    J.sulfonylurea__alcohol.management.patient_counselling,
    /avoid drinking/iu,
  );
  for (const ruleId of [
    'theophylline__ciprofloxacin',
    'theophylline__fluvoxamine',
    'theophylline__cimetidine',
    'theophylline__mexiletine',
  ]) {
    assert.equal(
      J[ruleId].source_action_quarantine.evidence_status,
      'official_source_confirmed',
      ruleId,
    );
    assert.doesNotMatch(
      J[ruleId].claims_needing_citation.join(' '),
      /until citation confirmation/iu,
      ruleId,
    );
  }
});

test('runtime-review prose describes structured matching and production-input limits accurately', () => {
  const F = byId('F');
  for (const ruleId of [
    'acei_arb__nsaid_systemic',
    'acei_arb_diuretic__nsaid_triple_whammy',
    'lithium__nsaid_systemic',
    'methotrexate_high_dose__nsaid_systemic',
    'methotrexate_lower_dose__nsaid_systemic',
  ]) {
    const reviewText = JSON.stringify({
      risk_factors: F[ruleId].risk_factors,
      claims: F[ruleId].claims_needing_citation,
    });
    assert.match(reviewText, /structured matcher|production inputs/iu, ruleId);
    assert.doesNotMatch(
      reviewText,
      /engine (?:matches ingredient names only and )?cannot distinguish|matcher cannot prove systemic exposure/iu,
      ruleId,
    );
  }

  const G = byId('G');
  for (const ruleId of [
    'tacrolimus__cyp3a4_inhibitor',
    'ciclosporin__cyp3a4_inhibitor',
    'calcineurin_inhibitor__other_cyp3a4_inducer',
    'oral_midazolam__potent_cyp3a4_inhibitor',
    'parenteral_midazolam__potent_cyp3a4_inhibitor',
  ]) {
    assert.match(
      JSON.stringify(G[ruleId]),
      /structured matcher/iu,
      ruleId,
    );
  }
  assert.match(
    G.tadalafil_pah__strong_cyp3a4_inhibitor.management.exceptions,
    /matcher-executable, runtime-disabled/iu,
  );
  for (const ruleId of [
    'ciclosporin__cyp3a4_inhibitor',
    'grapefruit__sensitive_cyp3a4_substrate',
    'ivabradine__moderate_cyp3a4_inhibitor',
  ]) {
    assert.doesNotMatch(
      G[ruleId].management.exceptions,
      /\bwins over\b|\bretain precedence\b|\boutranks\b/iu,
      ruleId,
    );
    assert.match(
      G[ruleId].management.exceptions,
      /co-surface/iu,
      ruleId,
    );
  }

  const H = byId('H');
  for (const ruleId of [
    'rifabutin__etonogestrel_implant',
    'phenytoin__etonogestrel_implant',
  ]) {
    assert.equal(
      H[ruleId].management.risk_factors[0].gateable,
      false,
      ruleId,
    );
  }
  assert.doesNotMatch(
    H.carbamazepine__antiretroviral.mechanism,
    /bidirectional|ritonavir|cobicistat|carbamazepine exposure/iu,
  );
  assert.match(
    H.carbamazepine__antiretroviral.management.monitoring,
    /supplies no carbamazepine concentration or neurological-toxicity action/iu,
  );
  assert.deepEqual(
    H.st_johns_wort__calcineurin_inhibitor.applicability.routes,
    ['oral'],
  );
});

test('presentation annotations distinguish matcher capability from production data availability', () => {
  const allRules = [...'ABCDEFGHIJ'].flatMap(sectionRules);
  const reviewText = JSON.stringify(allRules);
  assert.doesNotMatch(
    reviewText,
    /engine cannot distinguish|current matcher cannot distinguish|ingredient-only matcher cannot/iu,
  );
  assert.doesNotMatch(
    reviewText,
    /(?:route|formulation)[^"]{0,80}(?:not matcher-gateable|not matcher inputs?)/iu,
  );

  const H = byId('H');
  for (const ruleId of [
    'rifampicin__calcineurin_inhibitor',
    'carbamazepine__calcineurin_inhibitor',
    'rifampicin__systemic_corticosteroid',
    'carbamazepine__systemic_corticosteroid',
  ]) {
    assert.match(H[ruleId]._runtime_note, /matcher-enforceable/iu, ruleId);
    assert.match(H[ruleId]._runtime_note, /production inputs/iu, ruleId);
  }

  const I = byId('I');
  for (const ruleId of [
    'alendronate__oral_cation_food',
    'risedronate_immediate_release__oral_cation_food',
    'ketoconazole_oral__acid_suppressant',
  ]) {
    assert.match(JSON.stringify(I[ruleId]), /matcher-enforceable/iu, ruleId);
    assert.match(JSON.stringify(I[ruleId]), /production inputs/iu, ruleId);
  }

  const A = byId('A');
  assert.equal(
    A.rivaroxaban__strong_cyp3a4_pgp_inhibitor._residual_note
      .match(/Hepatic severity set to MAJOR/gu)?.length,
    1,
  );
});
