import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PACK_PATH = path.join(ROOT, 'docs/interaction-review/batch-01-v2/batch-01-v2.jsonl');
const AUDIT_JSON = path.join(
  ROOT,
  'docs/interaction-review/2026-07-27-warfarin-clarithromycin-candidate-audit.json',
);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function draftRules() {
  return fs.readFileSync(PACK_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function draftLines() {
  return fs.readFileSync(PACK_PATH, 'utf8').split('\n').filter(Boolean);
}

const audit = readJson(AUDIT_JSON);

// ── the audit must remain read-only ─────────────────────────────────────────

test('warfarin-clarithromycin audit did not modify the attested draft pack', () => {
  const actual = crypto.createHash('sha256')
    .update(fs.readFileSync(PACK_PATH))
    .digest('hex');
  assert.equal(actual, audit.audited_draft_state.pack_sha256);
  assert.equal(draftRules().length, audit.audited_draft_state.rule_count);
  assert.equal(audit.authorization_state.draft_pack_modified, false);
});

test('the proposed exact child rule does not exist in the draft yet', () => {
  const ids = new Set(draftRules().map((rule) => rule.rule_id));
  assert.equal(ids.has('warfarin__clarithromycin_oral'), false);
  assert.equal(audit.proposed_rule_if_approved.exists_in_draft, false);
  assert.equal(audit.proposed_rule_if_approved.requires_new_draft_row, true);
});

test('the audited class row is unchanged and still draft-gated', () => {
  const line = draftLines()
    .find((candidate) => JSON.parse(candidate).rule_id === 'warfarin__macrolide_cyp_inhibitor');
  assert.ok(line, 'warfarin__macrolide_cyp_inhibitor must exist');
  const rowSha = crypto.createHash('sha256').update(line).digest('hex');
  assert.equal(rowSha, audit.audited_draft_state.audited_draft_row_sha256);

  const rule = JSON.parse(line);
  assert.equal(rule.runtime_enabled, false);
  assert.equal(rule.runtime_status.runtime_enabled, false);
  assert.equal(rule.runtime_status.promotion_eligible, false);
});

// ── the class row must not be promotable as written ─────────────────────────

test('the macrolide class row carries clarithromycin-only evidence for a two-member roster', () => {
  const rule = draftRules().find((r) => r.rule_id === 'warfarin__macrolide_cyp_inhibitor');
  const members = rule.perpetrator.members;
  assert.deepEqual(members, ['clarithromycin', 'erythromycin']);

  assert.equal(rule.evidence.length, 1);
  const [evidence] = rule.evidence;
  assert.equal(evidence.product, 'clarithromycin');
  assert.match(evidence.normalized_proposition, /Supports CLARITHROMYCIN only/u);

  const { scope } = evidence.supports;
  assert.deepEqual(scope.directly_supported_members, ['clarithromycin']);
  assert.equal(scope.requires_clinician_class_mapping, true);

  // finding F1: zero erythromycin evidence backs the second member
  const erythromycinEvidence = rule.evidence
    .filter((record) => /erythromycin/iu.test(record.product ?? ''));
  assert.equal(erythromycinEvidence.length, 0);
  assert.equal(audit.architecture_finding.class_row_promotable, false);
});

// ── nothing is authorized until clinician:subas approves ────────────────────

test('no clarithromycin ingredient mapping is recorded', () => {
  const manifest = readJson(path.join(ROOT, 'data-static/ingredient-mapping-overrides.json'));
  const ids = manifest.mappings.map((mapping) => mapping.mapping_id ?? '');
  assert.equal(ids.some((id) => /clarithromycin/iu.test(id)), false);
  assert.equal(audit.ingredient_identity_candidate.currently_recorded, false);
});

test('no clarithromycin product-presentation mapping is recorded', () => {
  const manifest = readJson(path.join(ROOT, 'data-static/product-presentation-overrides.json'));
  const codes = manifest.mappings.map((mapping) => mapping.mapping_id.split(':')[2]);
  for (const blocked of ['380', '740', '2097']) {
    assert.equal(codes.includes(blocked), false, `pmbjp:${blocked} must not be mapped`);
  }
  for (const candidate of audit.product_presentation_candidates) {
    assert.equal(candidate.currently_recorded, false);
  }
});

test('no clarithromycin promotion exists in the internal-evaluation pack', () => {
  const promotions = readJson(
    path.join(ROOT, 'data-static/interaction-promotions.internal-evaluation.json'),
  );
  const ids = promotions.promotions.map((promotion) => promotion.rule_id);
  assert.equal(ids.some((id) => /clarithromycin|macrolide/iu.test(id)), false);
  assert.equal(audit.authorization_state.promotions_recorded, false);
});

test('production-open remains empty and coverage stays unknown', () => {
  const pack = readJson(path.join(ROOT, 'data-static/interaction-rules.json'));
  assert.equal(pack.rules.length, 0);
  assert.equal(pack.declared_coverage, 'unknown');
  assert.equal(audit.production_open_enabled, false);
});

// ── the mandatory exclusions must stay distinct ─────────────────────────────

test('the H. pylori combipack resolves to a distinct ingredient identity', () => {
  const combipack = audit.ingredient_identity_candidate.must_not_absorb
    .find((entry) => entry.canonical_name === 'combipack of clarithromycin');
  assert.ok(combipack, 'combipack identity must be recorded as non-absorbable');
  assert.notEqual(
    combipack.ingredient_id,
    audit.ingredient_identity_candidate.assertion.ingredient_id,
  );
});

test('every required exclusion is enumerated in the audit packet', () => {
  const exclusions = audit.excluded_catalogue_assertions.map((entry) => entry.exclusion);
  for (const required of ['erythromycin', 'azithromycin', 'pmbjp:2097', 'pmbjp:380']) {
    assert.ok(exclusions.includes(required), `missing exclusion: ${required}`);
  }
  assert.ok(exclusions.some((entry) => /suspension/iu.test(entry)));
  assert.ok(exclusions.some((entry) => /injection/iu.test(entry)));
  assert.ok(exclusions.some((entry) => /Extended Release/iu.test(entry)));
});

test('the blocked 500 mg product records both independent blockers', () => {
  const blocked = audit.product_presentation_candidates
    .find((candidate) => candidate.pmbjp_code === '380');
  assert.equal(blocked.eligibility, 'blocked');
  assert.deepEqual(blocked.blocking_findings, ['F2', 'F3']);

  const tender = audit.evidence_reverification.pmbjp_tender;
  assert.equal(tender.code_380_binding.bound, false);
  assert.equal(tender.code_740_binding.bound, true);
  assert.equal(tender.code_740_binding.drug_code, '740');
  assert.equal(tender.code_740_binding.page, 64);
});

// ── proposed scope must stay exact ──────────────────────────────────────────

test('the proposed rule is limited to three exact reviewed product pairs', () => {
  const proposed = audit.proposed_rule_if_approved;
  assert.equal(proposed.expected_product_pair_count, 3);
  assert.equal(proposed.pairs.length, 3);
  for (const pair of proposed.pairs) {
    assert.equal(pair.clarithromycin_code, '740');
    assert.ok(['2141', '2142', '452'].includes(pair.warfarin_code));
  }
  assert.equal(proposed.jurisdiction_of_evidence, 'US');
});

test('live reverification recorded matching label version, effective time and fragment', () => {
  const label = audit.evidence_reverification.openfda_clarithromycin_label;
  assert.equal(label.version_matches, true);
  assert.equal(label.effective_time_matches, true);
  assert.equal(label.fragment_hash_stable, true);
  assert.equal(label.fragment_found_verbatim_in_live_label, true);
  assert.deepEqual(label.supports_members, ['clarithromycin']);
  assert.deepEqual(label.does_not_support_members, ['erythromycin', 'azithromycin']);

  // the stored fragment hash must still be the hash of the stored fragment text
  const rule = draftRules().find((r) => r.rule_id === 'warfarin__macrolide_cyp_inhibitor');
  const fragment = rule.evidence[0].fragments[0];
  const recomputed = crypto.createHash('sha256').update(fragment.text).digest('hex');
  assert.equal(recomputed, fragment.text_sha256);
  assert.equal(recomputed, label.stored_fragment_sha256);
});

test('the audit packet declares itself unapproved and non-authorizing', () => {
  assert.equal(audit.review_status, 'candidate_audit_pending_clinician');
  assert.equal(audit.release_profile, 'internal-evaluation');
  assert.equal(audit.authorization_state.mappings_recorded, false);
  assert.equal(audit.approval_required.reviewer_id, 'clinician:subas');
  assert.equal(audit.approval_required.status, 'not_yet_requested');
  assert.ok(audit.approval_required.explicitly_not_authorized_by_this_packet.length >= 5);
});
