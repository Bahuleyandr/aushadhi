// Guards for the warfarin-co-trimoxazole candidate audit.
//
// This rule is BLOCKED: its perpetrator is a fixed-dose combination, and the
// promotion model maps one catalogue ingredient identity to one runtime drug with
// relationship 'exact', requiring an RxNorm term type of IN or PIN. These tests pin
// the blocker and the two mis-scopes that a workaround would introduce, so nobody
// resolves it by quietly mapping a component.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateIngredientMappingManifest } from '../src/lib/interaction-mapping.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK_PATH = path.join(ROOT, 'docs/interaction-review/batch-01-v2/batch-01-v2.jsonl');
const AUDIT = path.join(ROOT, 'docs/interaction-review/2026-07-27-warfarin-cotrimoxazole-candidate-audit.json');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const audit = readJson(AUDIT);
const draftLines = () => fs.readFileSync(PACK_PATH, 'utf8').split('\n').filter(Boolean);

test('the audited rule is unchanged and still draft-gated', () => {
  const line = draftLines().find((l) => JSON.parse(l).rule_id === 'warfarin__cotrimoxazole');
  assert.ok(line, 'warfarin__cotrimoxazole must exist');
  assert.equal(
    crypto.createHash('sha256').update(line).digest('hex'),
    audit.audited_draft_state.audited_draft_row_sha256,
  );
  const rule = JSON.parse(line);
  assert.equal(rule.runtime_enabled, false);
  assert.equal(rule.runtime_status.promotion_eligible, false);
  assert.equal(audit.authorization_state.draft_pack_modified, false);
});

test('the rule evidence still hashes to its stored fragments', () => {
  const rule = draftLines().map((l) => JSON.parse(l))
    .find((r) => r.rule_id === 'warfarin__cotrimoxazole');
  const evidence = rule.evidence[0];
  assert.equal(evidence.canonical_setid, '7f82e5e0-b627-a3f3-e053-2991aa0abaa5');
  assert.equal(String(evidence.document_version), '6');
  for (const fragment of evidence.fragments) {
    assert.equal(
      crypto.createHash('sha256').update(fragment.text).digest('hex'),
      fragment.text_sha256,
    );
  }
  // the mechanism belongs to the sulfamethoxazole component, not trimethoprim
  assert.ok(evidence.fragments.some((f) => /Sulfamethoxazole is an inhibitor of CYP2C9/u.test(f.text)));
});

// ── B1: the schema itself refuses a combination identity ───────────────────

// Synthetic mapping used only to demonstrate the schema rejection. The sha256 values
// are placeholders, NOT recorded provenance, and this object is never written to disk.
const SYNTHETIC_SHA = crypto.createHash('sha256').update('synthetic-b1-fixture').digest('hex');
const combinationMapping = (tty) => ({
  mapping_id: 'ingredient:co-trimoxazole:rxnorm-10831',
  assertion: {
    ingredient_id: 'sha256:bbcf7b7131929b96ca2bfc22ecea09c36c5263582f8419014e1e5eb82bd14ec4',
    canonical_name: 'co-trimoxazole',
  },
  identity: {
    clinical_ingredient_id: 'sha256:bbcf7b7131929b96ca2bfc22ecea09c36c5263582f8419014e1e5eb82bd14ec4',
    canonical_name: 'co-trimoxazole',
    runtime_drug: 'co-trimoxazole',
    relationship: 'exact',
    rxnorm: {
      rxcui: '10831',
      name: 'sulfamethoxazole / trimethoprim',
      tty,
      version: '06-Jul-2026',
      api_version: '3.1.354',
      response_sha256: SYNTHETIC_SHA,
    },
    unii: null,
  },
  review: {
    status: 'reviewed',
    reviewer_id: 'clinician:subas',
    reviewed_at: '2026-07-27',
    evidence: [{
      source_id: 'rxnorm',
      identifier: 'rxcui:10831',
      source_url: 'https://rxnav.nlm.nih.gov/REST/rxcui/10831/properties.json',
      retrieved_at: '2026-07-27',
      evidence_sha256: SYNTHETIC_SHA,
    }],
  },
});
const withMapping = (mapping) => {
  const manifest = structuredClone(
    readJson(path.join(ROOT, 'data-static/ingredient-mapping-overrides.json')),
  );
  manifest.mappings.push(mapping);
  return manifest;
};

test('B1: an ingredient mapping with a MIN term type is rejected by the manifest schema', () => {
  assert.throws(
    () => validateIngredientMappingManifest(withMapping(combinationMapping('MIN'))),
    /tty must be IN or PIN/u,
  );
  // Control: the SAME mapping validates with an IN term type, so the rejection is
  // attributable to the multi-ingredient term type and nothing else in the fixture.
  assert.equal(validateIngredientMappingManifest(withMapping(combinationMapping('IN'))), true);

  const blocker = audit.findings.find((f) => f.id === 'B1');
  assert.equal(blocker.severity, 'blocking');
  assert.equal(audit.outcome.blocked_on, 'B1');
  assert.equal(audit.outcome.verdict, 'cannot_be_promoted_under_the_current_mapping_model');
});

test('every committed ingredient mapping is still a single-ingredient IN identity', () => {
  const manifest = readJson(path.join(ROOT, 'data-static/ingredient-mapping-overrides.json'));
  assert.equal(validateIngredientMappingManifest(manifest), true);
  for (const mapping of manifest.mappings) {
    assert.equal(mapping.identity.relationship, 'exact', mapping.mapping_id);
    assert.equal(mapping.identity.rxnorm.tty, 'IN', mapping.mapping_id);
  }
});

// ── B2/B3: neither component may stand in for the combination ──────────────

test('B2/B3: no component of co-trimoxazole is mapped as a runtime drug', () => {
  const manifest = readJson(path.join(ROOT, 'data-static/ingredient-mapping-overrides.json'));
  const drugs = manifest.mappings.map((m) => m.identity.runtime_drug);
  for (const forbidden of ['co-trimoxazole', 'trimethoprim', 'sulfamethoxazole']) {
    assert.equal(drugs.includes(forbidden), false, `${forbidden} must not be mapped`);
  }
  const b2 = audit.findings.find((f) => f.id === 'B2');
  const b3 = audit.findings.find((f) => f.id === 'B3');
  assert.match(b2.detail, /six SINGLE-INGREDIENT trimethoprim products/u);
  assert.match(b3.detail, /158 combination products/u);
});

test('nothing is mapped or promoted for co-trimoxazole', () => {
  const presentations = readJson(path.join(ROOT, 'data-static/product-presentation-overrides.json'));
  const codes = presentations.mappings.map((m) => m.mapping_id.split(':')[2]);
  for (const code of ['88', '89', '90']) {
    assert.equal(codes.includes(code), false, `pmbjp:${code} must not be mapped`);
  }
  const promotions = readJson(
    path.join(ROOT, 'data-static/interaction-promotions.internal-evaluation.json'),
  );
  assert.equal(
    promotions.promotions.some((p) => /cotrimoxazole|co-trimoxazole|trimethoprim/iu.test(p.rule_id)),
    false,
  );
  assert.equal(audit.authorization_state.mappings_recorded, false);
  assert.equal(audit.authorization_state.promotions_recorded, false);
});

test('the suspension and the systemic/IV route stay excluded', () => {
  const exclusions = audit.excluded_catalogue_assertions.map((e) => e.exclusion);
  assert.ok(exclusions.includes('pmbjp:88'));
  assert.ok(exclusions.some((e) => /intravenous/iu.test(e)));
  assert.ok(exclusions.some((e) => /single-ingredient trimethoprim/iu.test(e)));
  // the draft selector really is broader than any promotable scope
  const rule = draftLines().map((l) => JSON.parse(l))
    .find((r) => r.rule_id === 'warfarin__cotrimoxazole');
  assert.ok(rule.perpetrator.route.includes('systemic'));
});

test('the PMBJP codes are recorded as drug codes, not serial numbers', () => {
  const list = audit.evidence_reverification.pmbjp_product_list;
  assert.equal(list.extraction_mode, 'table');
  assert.match(list.column_note, /'S\. No\.' then 'Drug Code'/u);
  // the pairing is what disambiguates the two number columns
  assert.deepEqual(
    Object.entries(list.rows).map(([code, row]) => [code, row.serial_no]),
    [['88', 83], ['89', 84], ['90', 85]],
  );
  assert.match(list.rows['88'].text, /Oral Suspension/u);
  for (const code of ['89', '90']) {
    assert.match(list.rows[code].text, /Tablets IP/u);
    const candidate = audit.candidate_products_if_the_model_gap_is_closed
      .find((p) => p.pmbjp_code === code);
    assert.equal(candidate.eligibility, 'blocked_by_B1_only');
  }
});

test('production-open remains empty and the packet declares itself non-authorizing', () => {
  const pack = readJson(path.join(ROOT, 'data-static/interaction-rules.json'));
  assert.equal(pack.rules.length, 0);
  assert.equal(pack.declared_coverage, 'unknown');
  assert.equal(audit.production_open_enabled, false);
  assert.equal(audit.review_status, 'candidate_audit_blocked_pending_clinician');
  assert.equal(audit.decisions_required.reviewer_id, 'clinician:subas');
  assert.equal(audit.decisions_required.status, 'not_yet_requested');
  assert.ok(audit.decisions_required.explicitly_not_authorized_by_this_packet.length >= 5);
});
