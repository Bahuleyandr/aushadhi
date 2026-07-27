import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkInteractions } from '../src/lib/interaction-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK_PATH = path.join(ROOT, 'docs/interaction-review/batch-01-v2/batch-01-v2.jsonl');
const AUDIT_JSON = path.join(
  ROOT,
  'docs/interaction-review/2026-07-27-warfarin-clarithromycin-candidate-audit.json',
);

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const draftRules = () => fs.readFileSync(PACK_PATH, 'utf8')
  .split('\n').filter(Boolean).map((line) => JSON.parse(line));

const audit = readJson(AUDIT_JSON);
const memberSets = readJson(path.join(ROOT, 'data-static/interaction-member-sets.json')).classes;

// ── A3: the exact child exists and is scoped to clarithromycin alone ────────

test('A3: warfarin__clarithromycin_oral exists, exact-scoped and draft-gated', () => {
  const rule = draftRules().find((r) => r.rule_id === 'warfarin__clarithromycin_oral');
  assert.ok(rule, 'the approved exact child must exist');
  assert.equal(rule.perpetrator.drug, 'clarithromycin');
  assert.deepEqual(rule.perpetrator.route, ['oral']);
  assert.deepEqual(rule.perpetrator.formulation, ['tablet']);
  assert.equal(rule.severity, 'major');
  assert.equal(rule.management.dispense_action, 'confirm_and_monitor');
  assert.equal(rule.risk_basis, 'pk_perpetrator');

  // a draft row can never authorize itself
  assert.equal(rule.runtime_enabled, false);
  assert.equal(rule.runtime_status.runtime_enabled, false);
  assert.equal(rule.runtime_status.promotion_eligible, false);
  assert.equal(rule.proposed_status, 'draft_for_review');

  // the evidence is no longer a class extrapolation
  const { scope } = rule.evidence[0].supports;
  assert.equal(scope.scope_type, 'exact_members');
  assert.deepEqual(scope.runtime_members, ['clarithromycin']);
  assert.equal(scope.requires_clinician_class_mapping, false);
});

test('A3: the clarithromycin evidence still verifies against its stored fragment hash', () => {
  const rule = draftRules().find((r) => r.rule_id === 'warfarin__clarithromycin_oral');
  const evidence = rule.evidence[0];
  assert.equal(evidence.canonical_setid, 'b98b02bb-2609-49a0-b29f-e5911aa0cbc1');
  assert.equal(String(evidence.document_version), '23');
  const fragment = evidence.fragments[0];
  assert.equal(
    crypto.createHash('sha256').update(fragment.text).digest('hex'),
    fragment.text_sha256,
  );
});

// ── A4: the residual class row is retained, erythromycin-only, gap-marked ───

test('A4: the unevidenced macrolide class row is retired, not left asserting a borrowed label', () => {
  const rules = draftRules();
  assert.equal(
    rules.some((r) => r.rule_id === 'warfarin__macrolide_cyp_inhibitor'),
    false,
    'a row whose only member had zero evidence must not remain in an evidence-attested pack',
  );

  // the clarithromycin fragment must now exist in exactly one place
  const fragmentHash = '81311cfe10ec4333bcc636eedccba36e6a060d84a9b726864bfe463da1338ed2';
  const carriers = rules.filter((r) => (r.evidence ?? [])
    .some((e) => (e.fragments ?? []).some((f) => f.text_sha256 === fragmentHash)));
  assert.deepEqual(carriers.map((r) => r.rule_id), ['warfarin__clarithromycin_oral']);

  // erythromycin is deliberately uncovered and recorded as outstanding work
  const f1 = audit.new_findings_not_in_handover.find((f) => f.id === 'F1');
  assert.ok(f1, 'the erythromycin evidence gap must stay on record');
  assert.equal(audit.execution_status.executed.some((e) => e.item === 'A4'), true);
});

// ── the split actually removes the duplicate alert ──────────────────────────

test('the exact child eliminates the duplicate clarithromycin alert', () => {
  const rules = draftRules();
  const fire = (subjects) => checkInteractions({ subjects, rules, memberSets, patientContext: {} })
    .findings.map((f) => f.rule_id);

  assert.deepEqual(fire(['warfarin', 'clarithromycin']), ['warfarin__clarithromycin_oral']);
  assert.deepEqual(fire(['warfarin', 'erythromycin']), []); // uncovered pending evidence
  assert.deepEqual(fire(['warfarin', 'azithromycin']), ['warfarin__azithromycin_oral']);
});

// ── attestation must track the changed pack ────────────────────────────────

test('the refreshed attestation binds the current pack bytes', () => {
  const attestation = readJson(
    path.join(ROOT, 'docs/interaction-review/batch-01-v2/batch-01-v2.provenance.json'),
  );
  const actual = crypto.createHash('sha256').update(fs.readFileSync(PACK_PATH)).digest('hex');
  assert.equal(attestation.pack_sha256, actual);
  assert.equal(attestation.rule_count, draftRules().length);
  assert.equal(actual, audit.execution_status.post_change_pack.pack_sha256);
});

test('every rule in the pack is still draft-gated', () => {
  for (const rule of draftRules()) {
    assert.equal(rule.runtime_enabled, false, `${rule.rule_id} must not be runtime-enabled`);
    assert.equal(rule.runtime_status.promotion_eligible, false, `${rule.rule_id} promotion_eligible`);
  }
});

// ── F5 halt: nothing may be mapped or promoted while codes are unresolved ───

test('F5 is recorded and the code-740 tender binding is retracted', () => {
  const f5 = audit.new_findings_not_in_handover.find((f) => f.id === 'F5');
  assert.ok(f5, 'the PMBJP code-identity finding must be recorded');
  assert.match(f5.severity, /blocking/u);

  const binding = audit.evidence_reverification.pmbjp_tender.code_740_binding;
  assert.equal(binding.bound, false);
  assert.equal(binding.superseded_claim.retracted, true);
});

test('A1, A2 and A5 are halted and nothing is mapped or promoted', () => {
  const halted = audit.execution_status.halted[0];
  assert.deepEqual(halted.items, ['A1', 'A2', 'A5']);
  assert.equal(halted.blocked_by, 'F5');

  const ingredients = readJson(path.join(ROOT, 'data-static/ingredient-mapping-overrides.json'));
  assert.equal(
    ingredients.mappings.some((m) => /clarithromycin/iu.test(m.mapping_id ?? '')),
    false,
  );

  const presentations = readJson(path.join(ROOT, 'data-static/product-presentation-overrides.json'));
  const codes = presentations.mappings.map((m) => m.mapping_id.split(':')[2]);
  for (const blocked of ['380', '739', '740', '2097']) {
    assert.equal(codes.includes(blocked), false, `pmbjp:${blocked} must not be mapped`);
  }

  const promotions = readJson(
    path.join(ROOT, 'data-static/interaction-promotions.internal-evaluation.json'),
  );
  assert.equal(
    promotions.promotions.some((p) => /clarithromycin|macrolide/iu.test(p.rule_id)),
    false,
  );
  assert.equal(audit.authorization_state.mappings_recorded, false);
  assert.equal(audit.authorization_state.promotions_recorded, false);
});

test('production-open remains empty and coverage stays unknown', () => {
  const pack = readJson(path.join(ROOT, 'data-static/interaction-rules.json'));
  assert.equal(pack.rules.length, 0);
  assert.equal(pack.declared_coverage, 'unknown');
  assert.equal(audit.production_open_enabled, false);
});

// ── exclusions must stay enumerated ────────────────────────────────────────

test('every required exclusion is still enumerated', () => {
  const exclusions = audit.excluded_catalogue_assertions.map((e) => e.exclusion);
  for (const required of ['erythromycin', 'azithromycin', 'pmbjp:2097', 'pmbjp:380']) {
    assert.ok(exclusions.includes(required), `missing exclusion: ${required}`);
  }
  assert.ok(exclusions.some((e) => /suspension/iu.test(e)));
  assert.ok(exclusions.some((e) => /injection/iu.test(e)));
  assert.ok(exclusions.some((e) => /Extended Release/iu.test(e)));
});

test('the combipack keeps a distinct ingredient identity', () => {
  const combipack = audit.ingredient_identity_candidate.must_not_absorb
    .find((e) => e.canonical_name === 'combipack of clarithromycin');
  assert.ok(combipack);
  assert.notEqual(
    combipack.ingredient_id,
    audit.ingredient_identity_candidate.assertion.ingredient_id,
  );
});
