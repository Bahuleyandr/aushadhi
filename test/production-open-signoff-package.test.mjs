import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  approvalSubjectSha256,
  canonicalizeApprovalSubject,
  validateProductionOpenApprovalSubject,
  validateProductionOpenSignoffPackage,
} from '../src/lib/production-open-signoff-package.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_DIR = path.join(
  ROOT,
  'docs',
  'interaction-review',
  '2026-08-08-warfarin-six-production-open-signoff',
);

function readSubject(slug) {
  return JSON.parse(fs.readFileSync(path.join(
    PACKAGE_DIR,
    `${slug}.approval-subject.json`,
  ), 'utf8'));
}

test('approval subject canonicalization is deterministic and RFC 8785 compatible for JSON values', () => {
  const left = { z: [3, { b: true, a: 'é' }], a: -0, n: null };
  const right = { n: null, a: 0, z: [3, { a: 'é', b: true }] };
  assert.equal(
    canonicalizeApprovalSubject(left),
    '{"a":0,"n":null,"z":[3,{"a":"é","b":true}]}',
  );
  assert.equal(approvalSubjectSha256(left), approvalSubjectSha256(right));
  assert.throws(
    () => canonicalizeApprovalSubject({ bad: '\ud800' }),
    /unpaired Unicode surrogate/u,
  );
});

test('the committed six-rule package is structurally sign-off ready but non-authorizing', () => {
  const result = validateProductionOpenSignoffPackage({
    packageDir: PACKAGE_DIR,
    productionRulesPath: path.join(ROOT, 'data-static', 'interaction-rules.json'),
  });
  assert.deepEqual(result, {
    package_status: 'clinician_signoff_ready',
    subject_count: 6,
    exact_product_count: 13,
    exact_product_pair_count: 30,
    signed_event_count: 0,
    runtime_authority: 'none',
    publication_authority: 'none',
    production_authority: 'none',
    deployment_authority: 'none',
  });
});

test('a subject cannot grant authority or drift an exact product assertion', () => {
  const subject = readSubject('warfarin-amiodarone');
  assert.doesNotThrow(() => validateProductionOpenApprovalSubject(subject));

  const authorityDrift = structuredClone(subject);
  authorityDrift.authority.runtime = 'approved';
  assert.throws(
    () => validateProductionOpenApprovalSubject(authorityDrift),
    /authority does not match the sign-off boundary/u,
  );

  const productDrift = structuredClone(subject);
  productDrift.clinical_scope.perpetrator.products[0]
    .product_assertion.ingredients[0].strength_value = 101;
  assert.throws(
    () => validateProductionOpenApprovalSubject(productDrift),
    /product_(?:id|assertion_sha256) does not match the sign-off boundary/u,
  );

  const pairDrift = structuredClone(subject);
  pairDrift.product_pairs.pop();
  assert.throws(
    () => validateProductionOpenApprovalSubject(pairDrift),
    /product_pairs does not match the sign-off boundary/u,
  );
});

test('revision 2 closes the clinician-review findings without widening product scope', () => {
  const fluconazole = readSubject('warfarin-fluconazole');
  assert.equal(fluconazole.schema_version, 2);
  assert.equal(fluconazole.subject_id, 'production-open:warfarin__fluconazole:r2');
  assert.equal(fluconazole.approval_validity.ttl_days, 180);
  assert.deepEqual(fluconazole.catalogue_binding, {
    profile: 'production-open',
    storage_path: 'data/interaction/production-open/product-catalogue/drugs.jsonl',
    artifact_sha256: 'b2186efe0c7483a7b10e57f02ec9d555a012bed40d8a26e3ed72c1249a1454e2',
    source_namespace: 'github-jr',
    source_identity_key: 'source_id',
  });
  assert.deepEqual(fluconazole.workflow_boundary.checker_trigger_support, [
    'current_or_intended_concurrent_exposure',
  ]);
  assert.deepEqual(fluconazole.workflow_boundary.unsupported_automatic_triggers, [
    'discontinuation',
    'dose_change',
    'recent_exposure',
  ]);
  assert.equal(fluconazole.product_pairs.length, 9);
  assert.deepEqual(
    fluconazole.clinical_scope.perpetrator.products.map(
      (product) => product.product_assertion.brand_name,
    ),
    ['Faze 150 Tablet', 'Faze 200mg Tablet', 'Faze 400mg Tablet'],
  );
  assert.equal(
    fluconazole.clinical_scope.perpetrator.products.some(
      (product) => product.product_assertion.brand_name.includes('Faze 50'),
    ),
    false,
  );
  assert.match(fluconazole.evidence_boundary.scope_note, /active-ingredient.*systemic-oral/iu);
  assert.match(fluconazole.rule.management.exceptions, /dispersible/iu);

  const clarithromycin = readSubject('warfarin-clarithromycin-oral');
  assert.match(clarithromycin.rule.management.exceptions, /github-jr/iu);
  assert.doesNotMatch(clarithromycin.rule.management.exceptions, /limited to.*PMBJP/iu);
  assert.doesNotMatch(clarithromycin.rule.management.prescriber_action, /course ends/iu);

  const metronidazole = readSubject('warfarin-metronidazole');
  assert.match(metronidazole.evidence_boundary.scope_note, /375 mg oral capsule/iu);
  assert.match(metronidazole.evidence_boundary.scope_note, /200 mg and 400 mg tablet/iu);

  const ketoconazole = readSubject('warfarin-ketoconazole-oral');
  assert.match(ketoconazole.rule.management.exceptions, /does not endorse oral ketoconazole/iu);
  assert.match(ketoconazole.rule.management.exceptions, /restricted-use/iu);

  const amiodarone = readSubject('warfarin-amiodarone');
  assert.match(amiodarone.rule.management.duration, /amiodarone-related drug-interaction effects/iu);
  assert.match(amiodarone.rule.management.duration, /no fixed warfarin-specific duration/iu);
  assert.match(amiodarone.rule.management.exceptions, /intravenous amiodarone/iu);
  assert.match(amiodarone.rule.management.exceptions, /prescriber-facing evidence/iu);

  const voriconazole = readSubject('warfarin-voriconazole');
  assert.match(voriconazole.rule.management.monitoring, /close-interval PT\/INR/iu);

  for (const subject of [
    fluconazole, clarithromycin, metronidazole, ketoconazole, amiodarone, voriconazole,
  ]) {
    assert.deepEqual(subject.matching_boundary, {
      product_matching: 'exact_enumerated_pairs_only',
      ingredient_wide_matching: false,
      fuzzy_matching: false,
      brand_derived_presentation: false,
      excluded_product_result: 'not_evaluated_or_unresolved',
    });
    for (const side of [subject.clinical_scope.object, subject.clinical_scope.perpetrator]) {
      for (const product of side.products) {
        assert.equal(product.presentation.route, 'oral');
        assert.equal(product.presentation.formulation, 'tablet');
        assert.equal(product.presentation.release_profile, 'not_asserted');
      }
    }
  }
});

test('clinician records render normalized scope fields and the R2 workflow boundary', () => {
  const record = fs.readFileSync(path.join(
    PACKAGE_DIR,
    'warfarin-ketoconazole-oral.clinician-approval-record.md',
  ), 'utf8');
  assert.match(
    record,
    /\| Role \| Product \| Normalized ingredient \| Strength \| Route \| Formulation \| Release profile \|/u,
  );
  assert.match(record, /\| Perpetrator \| Kenz Tablet \| ketoconazole \| 200 mg \| oral \| tablet \| not asserted \|/u);
  assert.match(record, /current or intended concurrent exposure/iu);
  assert.match(record, /180 days/iu);
});

test('production-open remains empty before clinician signatures', () => {
  const pack = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data-static', 'interaction-rules.json'), 'utf8'),
  );
  assert.deepEqual(pack.rules, []);
});
