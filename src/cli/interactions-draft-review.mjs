// Draft-review harness for the context-aware interaction engine.
//
// ⚠ THIS IS NOT A RUNTIME PATH. It loads the *draft* rule pack
// (docs/interaction-review/batch-01-v2/batch-01-v2.jsonl) whose rules are
// `draft_for_review` with unverified (<verify>) citations, and runs them
// through the context-aware engine so an authoring clinician can try real
// pairs during review. The pharmacist-facing runtime CLI is src/cli/interactions.mjs,
// which loads only the clinician-approved data-static/interaction-rules.json pack.
//
// Nothing here may be surfaced to a pharmacist until Task 7 (author-clinician
// review + independent authorised approval) promotes the rules to the runtime pack.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkInteractions } from '../lib/interaction-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_PACK = path.join(ROOT, 'docs', 'interaction-review', 'batch-01-v2', 'batch-01-v2.jsonl');
const DEFAULT_MEMBER_SETS = path.join(ROOT, 'data-static', 'interaction-member-sets.json');

export function loadDraftPack(packPath = DEFAULT_PACK) {
  const text = fs.readFileSync(packPath, 'utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`draft pack line ${index + 1} is not valid JSON: ${error.message}`);
      }
    });
}

export function loadMemberSets(memberSetsPath = DEFAULT_MEMBER_SETS) {
  const data = JSON.parse(fs.readFileSync(memberSetsPath, 'utf8'));
  return data.classes || {};
}

function parseNumericFlag(raw, label) {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number, got "${raw}"`);
  return n;
}

export function parseArgs(argv) {
  const subjects = [];
  const patientContext = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [flag, rawValue] = arg.slice(2).split('=');
      const value = rawValue ?? '';
      if (flag === 'renal-egfr') {
        (patientContext.renal ||= {}).egfr = parseNumericFlag(value, '--renal-egfr');
      } else if (flag === 'renal-crcl') {
        (patientContext.renal ||= {}).crcl = parseNumericFlag(value, '--renal-crcl');
      } else if (flag === 'hepatic') {
        const v = value.trim().toLowerCase();
        if (v === 'b' || v === 'c') (patientContext.hepatic ||= {}).child_pugh = v.toUpperCase();
        else if (v === 'impaired') (patientContext.hepatic ||= {}).flag = 'impaired';
        else throw new Error(`--hepatic must be B, C, or impaired, got "${value}"`);
      } else {
        throw new Error(`unknown argument --${flag}`);
      }
    } else {
      const name = arg.trim().toLowerCase();
      if (name) subjects.push(name);
    }
  }
  if (subjects.length < 2) throw new Error('at least two drug names are required');
  return { subjects, patientContext };
}

function describeContext(patientContext) {
  const renal = patientContext.renal || {};
  let renalStr = 'not provided';
  if (renal.egfr != null) renalStr = `eGFR ${renal.egfr} mL/min/1.73m²`;
  else if (renal.crcl != null) renalStr = `CrCl ${renal.crcl} mL/min`;
  const hep = patientContext.hepatic || {};
  let hepStr = 'not provided';
  if (hep.child_pugh) hepStr = `Child-Pugh ${hep.child_pugh}`;
  else if (hep.flag === 'impaired') hepStr = 'impaired (grade unspecified)';
  return [`  renal:   ${renalStr}`, `  hepatic: ${hepStr}`];
}

export function formatReport({ subjects, patientContext = {}, result }) {
  const { findings, coverage } = result;
  const rulesTotal = coverage.rules_total;
  const lines = [];

  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('  DRAFT interaction review — NOT a runtime path, NOT clinician-approved');
  lines.push('  Draft rules with unverified citations; pending Task 7 approval.');
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Drugs entered: ${subjects.join(', ')}`);
  lines.push('Patient context:');
  lines.push(...describeContext(patientContext));
  lines.push('');

  if (findings.length === 0) {
    lines.push('No reviewed draft interaction rule matched this combination.');
  } else {
    lines.push(`${findings.length} draft rule(s) flagged:`);
    lines.push('');
    findings.forEach((f, i) => {
      lines.push(`${i + 1}. [${f.severity.toUpperCase()}] ${f.subjects.join(' + ')}`);
      lines.push(`      dispense action : ${f.dispense_action ?? '(none)'}`);
      const m = f.management || {};
      if (m.prescriber_action) lines.push(`      prescriber      : ${m.prescriber_action}`);
      if (m.monitoring) lines.push(`      monitoring      : ${m.monitoring}`);
      lines.push(`      rule_id         : ${f.rule_id}  (basis: ${f.basis})`);
      lines.push('');
    });
  }

  const missing = coverage.classes_missing_members || [];
  if (missing.length) {
    lines.push(`Coverage gap: ${missing.length} class(es) referenced by rules have no member data,`);
    lines.push('so rules relying on them cannot match (never treated as "no interaction"):');
    lines.push(`  ${missing.join(', ')}`);
    lines.push('');
  }

  lines.push('────────────────────────────────────────────────────────────────');
  lines.push(`This checker covers only these ${rulesTotal} clinician-reviewed interaction rules.`);
  lines.push('No alert — or a blank result — does not establish that a combination is safe.');
  lines.push('────────────────────────────────────────────────────────────────');

  return lines.join('\n');
}

export function runDraftReview(argv, { packPath, memberSetsPath } = {}) {
  const { subjects, patientContext } = parseArgs(argv);
  const rules = loadDraftPack(packPath);
  const memberSets = loadMemberSets(memberSetsPath);
  const result = checkInteractions({ subjects, rules, memberSets, patientContext });
  return formatReport({ subjects, patientContext, result });
}

export function main(argv = process.argv.slice(2)) {
  process.stdout.write(`${runDraftReview(argv)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
