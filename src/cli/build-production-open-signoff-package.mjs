import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  approvalStatementSha256,
  approvalSubjectSha256,
  validateProductionOpenSignoffPackage,
} from '../lib/production-open-signoff-package.mjs';
import { productionOpenSignoffSource } from '../lib/production-open-signoff-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE_DIR = path.join(
  ROOT,
  'docs',
  'interaction-review',
  '2026-08-08-warfarin-six-production-open-signoff',
);
const SECTION_A_PATH = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'sections',
  'A.verified.jsonl',
);
const PRODUCTION_RULES_PATH = path.join(ROOT, 'data-static', 'interaction-rules.json');
const AUTHORITY = Object.freeze({
  runtime: 'none',
  publication: 'none',
  production: 'none',
  deployment: 'none',
  clinical_use: 'none',
});
const INVALIDATION_CONDITIONS = [
  'approval subject hash mismatch',
  'draft rule hash mismatch',
  'product identity or assertion drift',
  'source evidence withdrawal or drift',
  'source-rights gate not cleared',
  'signature or authorization failure',
  'compiler or package gate failure',
];
const RULE_ARGUMENTS = productionOpenSignoffSource.rules
  .map(({ ruleId }) => `--rule-id=${ruleId}`)
  .join(' ');

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function slugForRule(ruleId) {
  return ruleId.replaceAll('__', '-').replace(/_oral$/u, '-oral').replaceAll('_', '-');
}

function loadDraftRules() {
  const requested = new Set(productionOpenSignoffSource.rules.map(({ ruleId }) => ruleId));
  return new Map(
    fs.readFileSync(SECTION_A_PATH, 'utf8')
      .trim()
      .split(/\r?\n/u)
      .map(JSON.parse)
      .filter((row) => requested.has(row.rule_id))
      .map((row) => [row.rule_id, row]),
  );
}

function evidenceBindings(rule) {
  return rule.evidence.map((evidence) => ({
    source_policy_id: evidence.source_policy_id,
    document_id: evidence.document_id,
    document_version: evidence.document_version,
    payload_sha256: evidence.provenance.payload_sha256,
    jurisdiction: evidence.jurisdiction,
  }));
}

function exactPairs(objectProducts, perpetratorProducts) {
  return objectProducts.flatMap((objectProduct) => perpetratorProducts.map(
    (perpetratorProduct) => ({
      object_product_id: objectProduct.product_id,
      perpetrator_product_id: perpetratorProduct.product_id,
    }),
  ));
}

function buildSubject(source, draftRule) {
  const objectProducts = productionOpenSignoffSource.products.warfarin;
  const perpetratorProducts = productionOpenSignoffSource.products[source.perpetrator];
  const productPairs = exactPairs(objectProducts, perpetratorProducts);
  return {
    schema_version: 1,
    subject_id: `production-open:${source.ruleId}:r1`,
    subject_status: 'pending_clinician_signature',
    release_profile: 'production-open',
    reviewer_id: productionOpenSignoffSource.reviewerId,
    repository_provenance: {
      clinical_content_base: productionOpenSignoffSource.clinicalContentBase,
      signature_event_must_record_repository_head: true,
    },
    rule: {
      rule_id: source.ruleId,
      draft_rule_sha256: source.draftRuleSha256,
      severity: draftRule.severity,
      mechanism: draftRule.mechanism,
      management: draftRule.management,
    },
    clinical_scope: {
      route: 'oral',
      formulation: 'tablet',
      expected_product_pair_count: productPairs.length,
      object: {
        drug: 'warfarin',
        rxnorm_rxcui: productionOpenSignoffSource.rxnorm.warfarin,
        rxnorm_tty: 'IN',
        products: objectProducts,
      },
      perpetrator: {
        drug: source.perpetrator,
        rxnorm_rxcui: productionOpenSignoffSource.rxnorm[source.perpetrator],
        rxnorm_tty: 'IN',
        products: perpetratorProducts,
      },
    },
    product_pairs: productPairs,
    evidence_bindings: evidenceBindings(draftRule),
    source_rights: {
      catalogue_source_policy_id: 'github-jr',
      status: 'pending_separate_owner_legal_release_decision',
      clinical_signature_clears_source_rights: false,
    },
    declared_coverage: 'partial',
    authority: AUTHORITY,
    approval_statement: source.approvalStatement,
    invalidation_conditions: INVALIDATION_CONDITIONS,
  };
}

function buildTemplate(subject, subjectHash) {
  return {
    schema_version: 1,
    template_only: true,
    subject_id: subject.subject_id,
    approval_subject_jcs_sha256: subjectHash,
    authority: AUTHORITY,
    event_body_template: {
      event_id: null,
      decision: null,
      reviewer_id: productionOpenSignoffSource.reviewerId,
      reviewed_at_utc: null,
      repository_head: null,
      approval_subject_jcs_sha256: subjectHash,
      approval_statement_sha256: approvalStatementSha256(subject.approval_statement),
      authentication_method: null,
      authenticated_event_id: null,
      supersedes_event_id: null,
    },
  };
}

function productTable(subject) {
  const rows = [
    '| Role | Product | Manufacturer | Pack | Source identity | Product ID | Assertion SHA-256 |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const [role, side] of [
    ['Object', subject.clinical_scope.object],
    ['Perpetrator', subject.clinical_scope.perpetrator],
  ]) {
    for (const product of side.products) {
      rows.push(`| ${role} | ${product.product_assertion.brand_name} | ${product.product_assertion.manufacturer} | ${product.product_assertion.pack_label} | \`${product.source_identity.namespace}:${product.source_identity.code}\` | \`${product.product_id}\` | \`${product.product_assertion_sha256}\` |`);
    }
  }
  return rows.join('\n');
}

function evidenceTable(subject) {
  return [
    '| Jurisdiction | Document | Version | Payload SHA-256 |',
    '|---|---|---|---|',
    ...subject.evidence_bindings.map((evidence) => (
      `| ${evidence.jurisdiction} | \`${evidence.source_policy_id}:${evidence.document_id}\` | \`${evidence.document_version}\` | \`${evidence.payload_sha256}\` |`
    )),
  ].join('\n');
}

function clinicianRecord(subject, subjectHash) {
  const title = subject.rule.rule_id.replaceAll('__', ' × ').replaceAll('_', ' ');
  return `# ${title} — clinician approval record

Package status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

Approval status: **PENDING — no authenticated approval event exists**

Reviewer identity: \`${subject.reviewer_id}\`

Approval subject JCS SHA-256: \`${subjectHash}\`

The canonical authority subject is the adjacent \`${slugForRule(subject.rule.rule_id)}.approval-subject.json\`. This Markdown is its human-readable review record. A signature applies only to the exact canonical subject hash above.

## Exact approval statement

${subject.approval_statement}

## Exact product scope

Route: \`oral\`

Formulation: \`tablet\`

Exact product assertions: \`${subject.clinical_scope.object.products.length + subject.clinical_scope.perpetrator.products.length}\`

Exact product pairs: \`${subject.product_pairs.length}\`

${productTable(subject)}

Every pair is explicitly enumerated in the canonical JSON. No ingredient-wide, fuzzy, brand-derived, component-only, suspension, injection, topical, combination, or other unlisted product match is approved.

## Clinical content

Severity: \`${subject.rule.severity}\` — clinically important and requiring timely clinician review; not a contraindication, automatic stop, automatic refusal to dispense, or instruction never to co-prescribe.

Mechanism: ${subject.rule.mechanism}

Dispensing action: \`${subject.rule.management.dispense_action}\`

Prescriber action: ${subject.rule.management.prescriber_action}

Monitoring: ${subject.rule.management.monitoring}

Patient counselling: ${subject.rule.management.patient_counselling}

${subject.rule.management.duration ? `Duration boundary: ${subject.rule.management.duration}\n\n` : ''}Exclusions and exceptions: ${subject.rule.management.exceptions}

## Evidence boundary

${evidenceTable(subject)}

The evidence jurisdiction is the United States. It is not an Indian regulatory-label claim. Run the rule-scoped live verification command in the sign-off checklist immediately before signing; drift in a cited document blocks that subject.

## Authority boundary

This pending record grants no runtime, publication, production, deployment, or clinical-use authority. The catalogue source-rights status remains \`pending_separate_owner_legal_release_decision\`; clinical signature does not clear it. Production-open remains empty until separate post-signature mapping, promotion, source-rights, compiler, and release gates pass.

## How to sign

Do not edit the canonical subject or this statement. Create a new immutable event from the adjacent template, record \`APPROVED\` or \`REJECTED\`, the UTC review time, the repository HEAD reviewed, and authenticated event evidence, then sign that new event through the authorized workflow. Never turn the template itself into an event.
`;
}

function readme(subjects) {
  const rows = subjects.map(({ subject, hash }) => (
    `| \`${subject.rule.rule_id}\` | ${subject.product_pairs.length} | \`${hash}\` |`
  ));
  return `# Six warfarin production-open clinician sign-off subjects

Status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

This package replaces the six placeholder approval drafts dated 2026-08-07. It contains six exact, hash-bound clinical subjects and six template-only approval-event schemas. It creates no approval or runtime authority by itself.

| Rule | Exact pairs | Approval subject JCS SHA-256 |
|---|---:|---|
${rows.join('\n')}

The shared scope uses three exact Warf oral-tablet products and 11 exact perpetrator products, for 14 unique products and 33 explicitly enumerated pairs. Product identifiers and assertion hashes are re-derived by the package validator. The selected brand, ingredient, strength, route, formulation, and supplier identities were independently cross-checked against the private June 2026 India Drug Extension; licensed terminology identifiers or descriptions are deliberately not copied into this open package.

## Important separation of decisions

A clinician signature approves only the clinical content and exact proposed product scope in that subject. It does not authorize runtime loading, publication, production, deployment, or clinical use. The \`github-jr\` catalogue source-rights decision remains separate and unresolved, so even six valid signatures cannot release the package publicly.

The \`clinical_content_base\` field records the inherited rule/evidence baseline. The immutable approval event must separately record the exact repository HEAD reviewed at signature time; this avoids misrepresenting the baseline commit as the signed implementation commit.

Follow [SIGN-OFF-CHECKLIST.md](SIGN-OFF-CHECKLIST.md) exactly. Do not modify a canonical subject after review; any material change creates a new revision and requires a new signature.
`;
}

function checklist() {
  return `# Sign-off checklist

This checklist is mandatory for each of the six subjects.

1. Confirm \`git status --short\` is clean and record \`git rev-parse HEAD\`.
2. Run \`npm run verify:production-open-signoff\` and require exit 0.
3. Immediately before signing, run the exact scoped live evidence gate and require exit 0:

   \`npm run verify:interaction-evidence -- --sections=A ${RULE_ARGUMENTS}\`

4. Confirm \`data-static/interaction-rules.json\` still contains zero rules.
5. Review the clinician record and adjacent canonical JSON; confirm the displayed JCS SHA-256 equals \`package-status.json\`.
6. Record the exact approval statement without editing or shortening it.
7. Create a new immutable approval event from the adjacent template. Do not mutate the template.
8. Populate the decision, UTC time, reviewed repository HEAD, authentication method, and authenticated event ID through the authorized clinician workflow.
9. Preserve the completed event append-only. A correction requires a later superseding event.

## Still required after all signatures and before promotion

- Validate every signed event and reviewer authorization.
- Resolve \`github-jr\` source rights for publication through a separate owner/legal decision.
- Author production-open ingredient and product-presentation mappings from redistributable evidence only; never copy restricted internal-evaluation mappings.
- Pin the signed subject hashes and exact mappings in new production-open promotion manifests.
- Run the compiler, package, source-leakage, full test, and deterministic regeneration gates.
- Keep declared coverage \`partial\` and preserve fail-closed unresolved results.

Passing this checklist does not deploy or authorize clinical use.
`;
}

function supersededDraft(subject) {
  const slug = slugForRule(subject.rule.rule_id);
  return `# Superseded unsigned draft

This placeholder draft is superseded by the hash-bound clinician record at [2026-08-08-warfarin-six-production-open-signoff/${slug}.clinician-approval-record.md](2026-08-08-warfarin-six-production-open-signoff/${slug}.clinician-approval-record.md).

Do not sign this file. It grants no authority.
`;
}

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function buildFiles() {
  const draftRules = loadDraftRules();
  const generated = new Map();
  const subjectRecords = [];
  const subjectHashes = {};
  for (const source of productionOpenSignoffSource.rules) {
    const draftRule = draftRules.get(source.ruleId);
    if (!draftRule) throw new Error(`missing Section A draft rule ${source.ruleId}`);
    const subject = buildSubject(source, draftRule);
    const subjectHash = approvalSubjectSha256(subject);
    const slug = slugForRule(source.ruleId);
    subjectRecords.push({ subject, hash: subjectHash });
    subjectHashes[source.ruleId] = subjectHash;
    generated.set(`${slug}.approval-subject.json`, json(subject));
    generated.set(`${slug}.approval-event.template.json`, json(buildTemplate(subject, subjectHash)));
    generated.set(`${slug}.clinician-approval-record.md`, clinicianRecord(subject, subjectHash));
  }
  generated.set('README.md', readme(subjectRecords));
  generated.set('SIGN-OFF-CHECKLIST.md', checklist());
  generated.set('package-status.json', json({
    schema_version: 1,
    package_status: 'clinician_signoff_ready',
    subject_hashes: subjectHashes,
    signed_event_count: 0,
    authority: AUTHORITY,
    required_before_promotion: [
      'obtain authenticated clinician signatures for all six subjects',
      'verify signed events and reviewer authorization',
      'resolve github-jr source rights for publication',
      'author redistributable production-open identity and presentation mappings',
      'pin signed subject hashes and exact mappings in production-open promotion manifests',
      'pass compiler, package, source-leakage, full test, and deterministic regeneration gates',
      'confirm data-static/interaction-rules.json remains empty until all gates pass',
    ],
  }));
  const hashes = [...generated.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([fileName, content]) => `${sha256(content)}  ${fileName}`)
    .join('\n');
  generated.set('HASHES.txt', `${hashes}\n`);
  return { generated, subjectRecords };
}

function applyGeneratedFiles(generated, check) {
  const mismatches = [];
  if (!check) fs.mkdirSync(PACKAGE_DIR, { recursive: true });
  for (const [fileName, expected] of generated) {
    const filePath = path.join(PACKAGE_DIR, fileName);
    const actual = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
    if (actual !== expected) {
      mismatches.push(fileName);
      if (!check) fs.writeFileSync(filePath, expected, 'utf8');
    }
  }
  const expectedNames = new Set(generated.keys());
  if (fs.existsSync(PACKAGE_DIR)) {
    for (const fileName of fs.readdirSync(PACKAGE_DIR)) {
      if (!expectedNames.has(fileName)) mismatches.push(fileName);
    }
  }
  if (check && mismatches.length > 0) {
    throw new Error(`sign-off package is not deterministic: ${[...new Set(mismatches)].join(', ')}`);
  }
}

function applySupersededDrafts(subjectRecords, check) {
  for (const { subject } of subjectRecords) {
    const perpetrator = subject.clinical_scope.perpetrator.drug;
    const filePath = path.join(
      ROOT,
      'docs',
      'interaction-review',
      `2026-08-07-warfarin-${perpetrator}-production-open-clinician-approval.md`,
    );
    const expected = supersededDraft(subject);
    const actual = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
    if (actual !== expected) {
      if (check) throw new Error(`superseded draft pointer is not deterministic: ${path.basename(filePath)}`);
      fs.writeFileSync(filePath, expected, 'utf8');
    }
  }
}

const check = process.argv.slice(2).includes('--check');
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('only --check is supported');
}
const { generated, subjectRecords } = buildFiles();
applyGeneratedFiles(generated, check);
applySupersededDrafts(subjectRecords, check);
const result = validateProductionOpenSignoffPackage({
  packageDir: PACKAGE_DIR,
  productionRulesPath: PRODUCTION_RULES_PATH,
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
