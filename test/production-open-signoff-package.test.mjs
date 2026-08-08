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
    exact_product_count: 14,
    exact_product_pair_count: 33,
    signed_event_count: 0,
    runtime_authority: 'none',
    publication_authority: 'none',
    production_authority: 'none',
    deployment_authority: 'none',
  });
});

test('a subject cannot grant authority or drift an exact product assertion', () => {
  const subject = JSON.parse(fs.readFileSync(path.join(
    PACKAGE_DIR,
    'warfarin-amiodarone.approval-subject.json',
  ), 'utf8'));
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

test('production-open remains empty before clinician signatures', () => {
  const pack = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data-static', 'interaction-rules.json'), 'utf8'),
  );
  assert.deepEqual(pack.rules, []);
});
