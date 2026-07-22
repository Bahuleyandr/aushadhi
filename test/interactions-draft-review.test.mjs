import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs, formatReport, loadDraftPack } from '../src/cli/interactions-draft-review.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'src', 'cli', 'interactions-draft-review.mjs');

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
  const a = parseArgs(['warfarin', 'ibuprofen', '--renal-egfr=22', '--hepatic=B']);
  assert.deepEqual(a.subjects, ['warfarin', 'ibuprofen']);
  assert.equal(a.patientContext.renal.egfr, 22);
  assert.equal(a.patientContext.hepatic.child_pugh, 'B');
});

test('parseArgs captures --indication into patientContext', () => {
  const a = parseArgs(['dabigatran', 'ketoconazole', '--indication=non_valvular_atrial_fibrillation']);
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
  const a = parseArgs(['a', 'b', '--renal-crcl=40', '--hepatic=impaired']);
  assert.equal(a.patientContext.renal.crcl, 40);
  assert.equal(a.patientContext.hepatic.flag, 'impaired');
});

test('parseArgs lowercases and trims drug names so matching is case-insensitive', () => {
  const a = parseArgs(['  Warfarin ', 'IBUPROFEN']);
  assert.deepEqual(a.subjects, ['warfarin', 'ibuprofen']);
});

test('parseArgs rejects fewer than two drugs', () => {
  assert.throws(() => parseArgs(['warfarin']), /at least two/i);
});

test('parseArgs rejects a non-numeric renal value rather than silently coercing', () => {
  assert.throws(() => parseArgs(['a', 'b', '--renal-egfr=lots']), /egfr/i);
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
  assert.match(out, /158 clinician-reviewed/);
});

test('report announces DRAFT status and that it is not a runtime path', () => {
  const out = formatReport({ subjects: ['warfarin', 'ibuprofen'], patientContext: {}, result: RESULT_ONE });
  assert.match(out, /DRAFT/);
  assert.match(out, /not (a )?runtime|not.*approv/i);
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

test('report echoes provided renal/hepatic context, and marks absent context as not provided', () => {
  const withCtx = formatReport({
    subjects: ['a', 'b'], patientContext: { renal: { egfr: 22 } }, result: RESULT_NONE,
  });
  assert.match(withCtx, /eGFR.*22/);
  const noCtx = formatReport({ subjects: ['a', 'b'], patientContext: {}, result: RESULT_NONE });
  assert.match(noCtx, /renal.*not provided/i);
});

// ── loadDraftPack ────────────────────────────────────────────────────────────

test('loadDraftPack reads the JSONL draft pack into an array of rules', () => {
  const rules = loadDraftPack();
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length >= 100, `expected the full draft pack, got ${rules.length}`);
  assert.ok(rules.every((r) => typeof r.rule_id === 'string'));
});

// ── end-to-end smoke ─────────────────────────────────────────────────────────

test('CLI runs end-to-end on a real reviewed pair and prints a finding + disclaimer', () => {
  const res = spawnSync(process.execPath, [CLI, 'digoxin', 'verapamil'], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /digoxin/);
  assert.match(res.stdout, /verapamil/);
  assert.match(res.stdout, /does not establish that a combination is safe/);
  assert.match(res.stdout, /DRAFT/);
});

test('CLI escalates a context-sensitive pair when renal function is unknown vs. normal', () => {
  const unknown = spawnSync(process.execPath, [CLI, 'digoxin', 'verapamil'], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
  });
  const normal = spawnSync(process.execPath, [CLI, 'digoxin', 'verapamil', '--renal-egfr=90'], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
  });
  assert.equal(unknown.status, 0, unknown.stderr);
  assert.equal(normal.status, 0, normal.stderr);
  // unknown renal should not be milder than known-normal renal
  assert.notEqual(unknown.stdout, normal.stdout);
});
