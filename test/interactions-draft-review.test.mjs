import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseArgs,
  formatReport,
  loadDraftPack,
  runDraftReview,
} from '../src/cli/interactions-draft-review.mjs';
import {
  buildDraftPack,
  DEFAULT_MEMBER_SETS_PATH,
} from '../src/cli/assemble-interaction-draft-pack.mjs';
import {
  createDraftPackAttestation,
  serializeDraftPackAttestation,
} from '../src/lib/interaction-draft-attestation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'src', 'cli', 'interactions-draft-review.mjs');
const UNIT_VERIFIED_AT = '2026-07-23T00:00:00.000Z';
const DEFAULT_MEMBER_SETS_BYTES = fs.readFileSync(DEFAULT_MEMBER_SETS_PATH);

function writeUnitPack(t, {
  rules,
  packBytes,
  memberSetsBytes = DEFAULT_MEMBER_SETS_BYTES,
  attestation = createDraftPackAttestation({
    packBytes,
    memberSetsBytes,
    rules,
    verifiedAt: UNIT_VERIFIED_AT,
  }),
  writeAttestation = true,
} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-draft-review-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const packPath = path.join(dir, 'pack.jsonl');
  const attestationPath = path.join(dir, 'pack.provenance.json');
  fs.writeFileSync(packPath, packBytes);
  if (writeAttestation) {
    fs.writeFileSync(
      attestationPath,
      serializeDraftPackAttestation(attestation),
      'utf8',
    );
  }
  return { packPath, attestationPath };
}

const RESULT_ONE = {
  findings: [{
    subjects: ['warfarin', 'ibuprofen'],
    rule_id: 'warfarin__nsaid_systemic',
    severity: 'major',
    dispense_action: 'supply_with_counselling',
    management: { prescriber_action: 'Prefer paracetamol.', monitoring: 'Check INR.' },
    basis: 'base',
  }],
  pairs_checked: 1,
  coverage: { rules_total: 158, classes_referenced: 92, classes_missing_members: ['other_class', 'some_class'] },
};

const RESULT_NONE = {
  findings: [],
  pairs_checked: 1,
  coverage: { rules_total: 158, classes_referenced: 92, classes_missing_members: [] },
};

// ── parseArgs ───────────────────────────────────────────────────────────────

test('parseArgs collects drug names and renal/hepatic flags', () => {
  const a = parseArgs([
    'warfarin',
    'ibuprofen',
    '--renal-egfr=22',
    '--hepatic=B',
    '--jurisdiction=us',
  ]);
  assert.deepEqual(a.subjects, ['warfarin', 'ibuprofen']);
  assert.equal(a.patientContext.renal.egfr, 22);
  assert.equal(a.patientContext.hepatic.child_pugh, 'B');
  assert.equal(a.patientContext.jurisdiction, 'US');
});

test('parseArgs captures --indication into patientContext', () => {
  const a = parseArgs([
    'dabigatran',
    'ketoconazole',
    '--indication=non_valvular_atrial_fibrillation',
    '--jurisdiction=US',
  ]);
  assert.equal(a.patientContext.indication, 'non_valvular_atrial_fibrillation');
});

test('report shows the indication scope of an indication-constrained finding', () => {
  const res = {
    findings: [{
      subjects: ['dabigatran', 'ketoconazole'], rule_id: 'r', severity: 'major', dispense_action: 'confirm_and_monitor',
      indication_scope: ['non_valvular_atrial_fibrillation'], management: {}, basis: 'base',
    }],
    pairs_checked: 1,
    coverage: { rules_total: 158, classes_referenced: 92, classes_missing_members: [] },
  };
  const out = formatReport({ subjects: ['dabigatran', 'ketoconazole'], patientContext: {}, result: res });
  assert.match(out, /non_valvular_atrial_fibrillation/);
});

test('parseArgs accepts CrCl and a free-text hepatic "impaired" flag', () => {
  const a = parseArgs(['a', 'b', '--renal-crcl=40', '--hepatic=impaired', '--jurisdiction=IN']);
  assert.equal(a.patientContext.renal.crcl, 40);
  assert.equal(a.patientContext.hepatic.flag, 'impaired');
});

test('parseArgs lowercases and trims drug names so matching is case-insensitive', () => {
  const a = parseArgs(['  Warfarin ', 'IBUPROFEN', '--jurisdiction=UK']);
  assert.deepEqual(a.subjects, ['warfarin', 'ibuprofen']);
});

test('parseArgs rejects fewer than two drugs', () => {
  assert.throws(() => parseArgs(['warfarin']), /at least two/i);
});

test('parseArgs rejects a non-numeric renal value rather than silently coercing', () => {
  assert.throws(() => parseArgs(['a', 'b', '--renal-egfr=lots']), /egfr/i);
});

test('parseArgs rejects negative renal values', () => {
  assert.throws(() => parseArgs(['a', 'b', '--renal-crcl=-1']), /non-negative/i);
});

test('parseArgs rejects a missing eGFR value instead of coercing it to zero', () => {
  assert.throws(
    () => parseArgs(['a', 'b', '--renal-egfr']),
    /--renal-egfr requires a non-negative number/i,
  );
});

test('parseArgs rejects a blank CrCl value instead of coercing it to zero', () => {
  assert.throws(
    () => parseArgs(['a', 'b', '--renal-crcl=   ']),
    /--renal-crcl requires a non-negative number/i,
  );
});

test('parseArgs rejects trailing flag payloads, duplicate context flags, and blank indications', () => {
  assert.throws(
    () => parseArgs(['a', 'b', '--renal-egfr=30=garbage', '--jurisdiction=US']),
    /egfr/i,
  );
  assert.throws(
    () => parseArgs(['a', 'b', '--renal-egfr=30', '--renal-egfr=40', '--jurisdiction=US']),
    /--renal-egfr must be provided at most once/i,
  );
  assert.throws(
    () => parseArgs(['a', 'b', '--indication=  ', '--jurisdiction=US']),
    /--indication requires a non-empty value/i,
  );
  assert.throws(
    () => parseArgs(['a', 'b', '--jurisdiction=US=IN']),
    /must be IN, US, UK, or EU/i,
  );
});

test('parseArgs requires exactly one supported jurisdiction', () => {
  assert.throws(
    () => parseArgs(['a', 'b']),
    /--jurisdiction is required/i,
  );
  assert.throws(
    () => parseArgs(['a', 'b', '--jurisdiction=CA']),
    /must be IN, US, UK, or EU/i,
  );
  assert.throws(
    () => parseArgs(['a', 'b', '--jurisdiction=US', '--jurisdiction=IN']),
    /exactly once/i,
  );
});

// ── formatReport ─────────────────────────────────────────────────────────────

test('report renders each finding with severity, both drugs, and the dispense action', () => {
  const out = formatReport({ subjects: ['warfarin', 'ibuprofen'], patientContext: {}, result: RESULT_ONE });
  assert.match(out, /MAJOR/);
  assert.match(out, /warfarin/);
  assert.match(out, /ibuprofen/);
  assert.match(out, /supply_with_counselling/);
  assert.match(out, /Prefer paracetamol\./);
});

test('report renders unresolved applicability requirements without undefined severity text', () => {
  const result = {
    findings: [{
      subjects: ['a', 'b'],
      rule_id: 'scoped',
      severity: 'major',
      dispense_action: 'withhold_and_clarify',
      management: {},
      basis: 'base',
      data_required: [{
        factor: 'jurisdiction',
        metric: 'regulatory jurisdiction',
        reason: 'rule has no accepted jurisdiction scope',
        options: [],
      }],
    }],
    pairs_checked: 1,
    coverage: { rules_total: 1, classes_referenced: 0, classes_missing_members: [] },
  };
  const out = formatReport({
    subjects: ['a', 'b'],
    patientContext: { jurisdiction: 'US' },
    result,
  });
  assert.match(out, /regulatory jurisdiction \(rule has no accepted jurisdiction scope\)/i);
  assert.doesNotMatch(out, /undefined/i);
});

test('report renders ALL agents of an n-ary (3-drug) finding, not just the first two', () => {
  const res = {
    findings: [{
      subjects: ['aspirin', 'clopidogrel', 'warfarin'], rule_id: 'triple', severity: 'major',
      dispense_action: 'confirm_and_monitor', management: {}, basis: 'base',
    }],
    pairs_checked: 3,
    coverage: { rules_total: 158, classes_referenced: 92, classes_missing_members: [] },
  };
  const out = formatReport({ subjects: ['aspirin', 'clopidogrel', 'warfarin'], patientContext: {}, result: res });
  assert.match(out, /aspirin \+ clopidogrel \+ warfarin/);
});

test('report surfaces action_target, do_not_interrupt, and data_required when present', () => {
  const res = {
    findings: [{
      subjects: ['warfarin', 'ibuprofen'], rule_id: 'r', severity: 'major', dispense_action: 'withhold_and_clarify',
      action_target: 'newly_added_perpetrator', do_not_interrupt: ['warfarin'],
      data_required: [{ factor: 'renal', metric: 'CrCl', would_be_severity: 'contraindicated' }],
      management: {}, basis: 'base',
    }],
    pairs_checked: 1,
    coverage: { rules_total: 158, classes_referenced: 92, classes_missing_members: [] },
  };
  const out = formatReport({ subjects: ['warfarin', 'ibuprofen'], patientContext: {}, result: res });
  assert.match(out, /newly_added_perpetrator/);
  assert.match(out, /do NOT interrupt.*warfarin/i);
  assert.match(out, /CrCl/);
  assert.match(out, /would be contraindicated/i);
});

test('report ALWAYS carries the blank-is-not-safe disclaimer, even with findings', () => {
  const out = formatReport({ subjects: ['warfarin', 'ibuprofen'], patientContext: {}, result: RESULT_ONE });
  assert.match(out, /does not establish that a combination is safe/);
  assert.match(out, /158 draft candidate interaction rules/);
  assert.doesNotMatch(out, /clinician-reviewed interaction rules/);
});

test('report announces DRAFT status and that it is not a runtime path', () => {
  const out = formatReport({ subjects: ['warfarin', 'ibuprofen'], patientContext: {}, result: RESULT_ONE });
  assert.match(out, /DRAFT/);
  assert.match(out, /not (a )?runtime|not.*approv/i);
  assert.match(out, /metadata passed the offline production-open source-policy check/i);
  assert.match(out, /live payload verification happened at assembly time/i);
  assert.match(out, /this invocation did not refetch/i);
  assert.match(out, /unsigned local attestation binds rule-pack and member-set bytes/i);
  assert.match(out, /detects drift/i);
  assert.match(out, /not source authentication/i);
  assert.doesNotMatch(out, /unverified citations/i);
});

test('a blank result still emits the disclaimer and does NOT claim safety', () => {
  const out = formatReport({ subjects: ['a', 'b'], patientContext: {}, result: RESULT_NONE });
  assert.match(out, /No .*rule matched/i);
  assert.match(out, /does not establish that a combination is safe/);
  assert.doesNotMatch(out, /\bsafe to (use|combine)\b/i);
});

test('report discloses classes with no member data as inert coverage gaps', () => {
  const out = formatReport({ subjects: ['warfarin', 'ibuprofen'], patientContext: {}, result: RESULT_ONE });
  assert.match(out, /2 class/i);
  assert.match(out, /some_class/);
});

test('report identifies the affected rule and strength for a member-data gap', () => {
  const result = {
    ...RESULT_NONE,
    coverage: {
      ...RESULT_NONE.coverage,
      classes_missing_members: ['inhibitor'],
      member_gaps: [{
        rule_id: 'victim__inhibitor',
        class: 'inhibitor',
        strength: 'strong',
        reason: 'missing_strength_bucket',
      }],
    },
  };
  const out = formatReport({ subjects: ['a', 'b'], patientContext: {}, result });
  assert.match(out, /victim__inhibitor/);
  assert.match(out, /inhibitor \/ strong/);
  assert.match(out, /missing_strength_bucket/);
});

test('report echoes provided renal/hepatic context, and marks absent context as not provided', () => {
  const withCtx = formatReport({
    subjects: ['a', 'b'],
    patientContext: { renal: { egfr: 22 }, jurisdiction: 'US' },
    result: RESULT_NONE,
  });
  assert.match(withCtx, /eGFR.*22/);
  assert.match(withCtx, /jurisdiction:\s+US/i);
  const noCtx = formatReport({ subjects: ['a', 'b'], patientContext: {}, result: RESULT_NONE });
  assert.match(noCtx, /renal.*not provided/i);
  assert.match(noCtx, /jurisdiction.*not provided/i);
});

// ── loadDraftPack ────────────────────────────────────────────────────────────

test('loadDraftPack reads an attested JSONL draft pack into an array of rules', (t) => {
  const pack = buildDraftPack();
  const { packPath, attestationPath } = writeUnitPack(t, {
    rules: pack.rules,
    packBytes: pack.bytes,
  });
  const rules = loadDraftPack(packPath, { attestationPath });
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length >= 100, `expected the full draft pack, got ${rules.length}`);
  assert.ok(rules.every((r) => typeof r.rule_id === 'string'));
});

test('loadDraftPack fails closed when runtime status is missing', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-draft-pack-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const pack = path.join(dir, 'invalid.jsonl');
  fs.writeFileSync(pack, `${JSON.stringify({
    rule_id: 'invalid',
    severity: 'major',
    management: { dispense_action: 'confirm_and_monitor' },
    context_modifiers: [],
    proposed_status: 'draft_for_review',
  })}\n`);
  assert.throws(() => loadDraftPack(pack), /runtime_enabled must be a boolean/i);
});

test('loadDraftPack rejects restricted evidence even with a matching forged attestation', (t) => {
  const pack = buildDraftPack();
  const rules = structuredClone(pack.rules);
  const evidence = rules.find((rule) => rule.evidence?.length > 0).evidence[0];
  evidence.source_policy_id = 'onemg-live';
  const packBytes = Buffer.from(`${rules.map((rule) => JSON.stringify(rule)).join('\n')}\n`);
  const { packPath, attestationPath } = writeUnitPack(t, { rules, packBytes });

  assert.throws(
    () => loadDraftPack(packPath, { attestationPath }),
    /onemg-live|production-open|interaction-evidence/i,
  );
});

test('loadDraftPack requires a provenance attestation', (t) => {
  const pack = buildDraftPack();
  const { packPath, attestationPath } = writeUnitPack(t, {
    rules: pack.rules,
    packBytes: pack.bytes,
    writeAttestation: false,
  });

  assert.throws(
    () => loadDraftPack(packPath, { attestationPath }),
    /provenance attestation is required/i,
  );
});

test('loadDraftPack rejects a tampered provenance attestation', (t) => {
  const pack = buildDraftPack();
  const attestation = createDraftPackAttestation({
    packBytes: pack.bytes,
    memberSetsBytes: DEFAULT_MEMBER_SETS_BYTES,
    rules: pack.rules,
    verifiedAt: UNIT_VERIFIED_AT,
  });
  attestation.pack_sha256 = '0'.repeat(64);
  const { packPath, attestationPath } = writeUnitPack(t, {
    rules: pack.rules,
    packBytes: pack.bytes,
    attestation,
  });

  assert.throws(
    () => loadDraftPack(packPath, { attestationPath }),
    /pack_sha256 does not match the draft pack/i,
  );
});

test('loadDraftPack rejects exact-byte drift after live verification', (t) => {
  const pack = buildDraftPack();
  const attestation = createDraftPackAttestation({
    packBytes: pack.bytes,
    memberSetsBytes: DEFAULT_MEMBER_SETS_BYTES,
    rules: pack.rules,
    verifiedAt: UNIT_VERIFIED_AT,
  });
  const driftedBytes = Buffer.concat([pack.bytes, Buffer.from('\n')]);
  const { packPath, attestationPath } = writeUnitPack(t, {
    rules: pack.rules,
    packBytes: driftedBytes,
    attestation,
  });

  assert.throws(
    () => loadDraftPack(packPath, { attestationPath }),
    /pack_sha256 does not match the draft pack/i,
  );
});

test('loadDraftPack rejects malformed member sets even when their exact bytes are attested', (t) => {
  const pack = buildDraftPack();
  const memberSetsBytes = Buffer.from(
    '{"classes":{"nsaid":{"any":"ibuprofen"}}}\n',
  );
  const { packPath, attestationPath } = writeUnitPack(t, {
    rules: pack.rules,
    packBytes: pack.bytes,
    memberSetsBytes,
  });

  assert.throws(
    () => loadDraftPack(packPath, { attestationPath, memberSetsBytes }),
    /classes\.nsaid\.any must be a non-empty array/i,
  );
});

test('draft review rejects post-attestation member-set broadening', (t) => {
  const pack = buildDraftPack();
  const { packPath, attestationPath } = writeUnitPack(t, {
    rules: pack.rules,
    packBytes: pack.bytes,
  });
  const memberSetsPath = path.join(path.dirname(packPath), 'interaction-member-sets.json');
  const broadenedMemberSets = JSON.parse(DEFAULT_MEMBER_SETS_BYTES.toString('utf8'));
  broadenedMemberSets.classes.nsaid.any.push('post-review-added-nsaid');
  fs.writeFileSync(
    memberSetsPath,
    `${JSON.stringify(broadenedMemberSets, null, 2)}\n`,
  );

  assert.throws(
    () => runDraftReview(
      ['warfarin', 'ibuprofen', '--jurisdiction=US'],
      { packPath, attestationPath, memberSetsPath },
    ),
    /member_sets_sha256 does not match the interaction member sets/i,
  );
});

// ── end-to-end smoke ─────────────────────────────────────────────────────────

test('CLI runs end-to-end on a real reviewed pair and prints a finding + disclaimer', () => {
  const res = spawnSync(process.execPath, [CLI, 'digoxin', 'verapamil', '--jurisdiction=US'], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /digoxin/);
  assert.match(res.stdout, /verapamil/);
  assert.match(res.stdout, /does not establish that a combination is safe/);
  assert.match(res.stdout, /DRAFT/);
});

test('CLI escalates a context-sensitive pair when renal function is unknown vs. normal', () => {
  const unknown = spawnSync(process.execPath, [
    CLI,
    'digoxin',
    'verapamil',
    '--jurisdiction=US',
  ], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
  });
  const normal = spawnSync(process.execPath, [
    CLI,
    'digoxin',
    'verapamil',
    '--renal-egfr=90',
    '--jurisdiction=US',
  ], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
  });
  assert.equal(unknown.status, 0, unknown.stderr);
  assert.equal(normal.status, 0, normal.stderr);
  // unknown renal should not be milder than known-normal renal
  assert.notEqual(unknown.stdout, normal.stdout);
});
