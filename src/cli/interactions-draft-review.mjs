// Draft-review harness for the context-aware interaction engine.
//
// ⚠ THIS IS NOT A RUNTIME PATH. It loads the *draft* rule pack
// (docs/interaction-review/batch-01-v2/batch-01-v2.jsonl) whose rules are
// `draft_for_review` with varying evidence-verification status, and runs them
// through the context-aware engine so an authoring clinician can try real
// pairs during review. The pharmacist-facing runtime CLI is src/cli/interactions.mjs,
// which loads only the clinician-approved data-static/interaction-rules.json pack.
//
// Nothing here may be surfaced to a pharmacist until Task 7 (author-clinician
// review + independent authorised approval) promotes the rules to the runtime pack.
// The assembly attestation is unsigned drift detection, not authentication of
// the local author or proof against deliberate local forgery.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkInteractions } from '../lib/interaction-engine.mjs';
import {
  assertDraftPackAttestation,
  parseDraftPackAttestation,
} from '../lib/interaction-draft-attestation.mjs';
import { validateDraftRules } from '../lib/interaction-draft-validation.mjs';
import {
  assertEvidenceMetadataAllowed,
  loadSourceManifest,
} from '../lib/interaction-source-policy.mjs';
import { parseInteractionMemberSets } from '../lib/interaction-member-set-validation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_PACK = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'batch-01-v2.jsonl',
);
export const DEFAULT_ATTESTATION = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'batch-01-v2.provenance.json',
);
export const DEFAULT_MEMBER_SETS_PATH = path.join(
  ROOT,
  'data-static',
  'interaction-member-sets.json',
);
const JURISDICTIONS = new Set(['IN', 'US', 'UK', 'EU']);
const EVIDENCE_STORAGE_PATH = 'docs/interaction-review/batch-01-v2/batch-01-v2.jsonl';

export function loadDraftPack(
  packPath = DEFAULT_PACK,
  {
    attestationPath = DEFAULT_ATTESTATION,
    memberSetsBytes,
  } = {},
) {
  const packBytes = fs.readFileSync(packPath);
  const text = packBytes.toString('utf8');
  const rules = text
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
  const validatedRules = validateDraftRules(rules);
  const manifest = loadSourceManifest();
  for (const rule of validatedRules) {
    for (const evidence of rule.evidence ?? []) {
      try {
        assertEvidenceMetadataAllowed(manifest, evidence, {
          profile: 'production-open',
          use: evidence.source_policy_use,
          storagePath: EVIDENCE_STORAGE_PATH,
        });
      } catch (error) {
        throw new Error(
          `draft rule ${JSON.stringify(rule.rule_id)} evidence `
            + `${JSON.stringify(evidence?.source_id)} failed metadata policy: ${error.message}`,
          { cause: error },
        );
      }
    }
  }

  let attestationText;
  try {
    attestationText = fs.readFileSync(attestationPath, 'utf8');
  } catch (error) {
    throw new Error(
      `draft-pack provenance attestation is required at ${attestationPath}: ${error.message}`,
      { cause: error },
    );
  }
  const attestation = parseDraftPackAttestation(attestationText);
  const boundMemberSetsBytes = memberSetsBytes
    ?? fs.readFileSync(DEFAULT_MEMBER_SETS_PATH);
  parseInteractionMemberSets(boundMemberSetsBytes);
  assertDraftPackAttestation(attestation, {
    packBytes,
    memberSetsBytes: boundMemberSetsBytes,
    rules: validatedRules,
  });
  return validatedRules;
}

function readMemberSetsFile(memberSetsPath = DEFAULT_MEMBER_SETS_PATH) {
  const bytes = fs.readFileSync(memberSetsPath);
  return { bytes, classes: parseInteractionMemberSets(bytes).classes };
}

export function loadMemberSets(memberSetsPath = DEFAULT_MEMBER_SETS_PATH) {
  return readMemberSetsFile(memberSetsPath).classes;
}

function parseNumericFlag(raw, label) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`${label} requires a non-negative number`);
  }
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number, got "${raw}"`);
  }
  return n;
}

export function parseArgs(argv) {
  const subjects = [];
  const patientContext = {};
  const seenFlags = new Set();
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const rawFlag = arg.slice(2);
      const separatorIndex = rawFlag.indexOf('=');
      const flag = separatorIndex === -1 ? rawFlag : rawFlag.slice(0, separatorIndex);
      const value = separatorIndex === -1 ? '' : rawFlag.slice(separatorIndex + 1);
      if (seenFlags.has(flag)) {
        const frequency = flag === 'jurisdiction' ? 'exactly once' : 'at most once';
        throw new Error(`--${flag} must be provided ${frequency}`);
      }
      seenFlags.add(flag);
      if (flag === 'renal-egfr') {
        (patientContext.renal ||= {}).egfr = parseNumericFlag(value, '--renal-egfr');
      } else if (flag === 'renal-crcl') {
        (patientContext.renal ||= {}).crcl = parseNumericFlag(value, '--renal-crcl');
      } else if (flag === 'hepatic') {
        const v = value.trim().toLowerCase();
        if (v === 'b' || v === 'c') (patientContext.hepatic ||= {}).child_pugh = v.toUpperCase();
        else if (v === 'impaired') (patientContext.hepatic ||= {}).flag = 'impaired';
        else throw new Error(`--hepatic must be B, C, or impaired, got "${value}"`);
      } else if (flag === 'indication') {
        const indication = value.trim();
        if (!indication) throw new Error('--indication requires a non-empty value');
        patientContext.indication = indication;
      } else if (flag === 'jurisdiction') {
        const jurisdiction = value.trim().toUpperCase();
        if (!JURISDICTIONS.has(jurisdiction)) {
          throw new Error(`--jurisdiction must be IN, US, UK, or EU, got "${value}"`);
        }
        patientContext.jurisdiction = jurisdiction;
      } else {
        throw new Error(`unknown argument --${flag}`);
      }
    } else {
      const name = arg.trim().toLowerCase();
      if (name) subjects.push(name);
    }
  }
  if (subjects.length < 2) throw new Error('at least two drug names are required');
  if (!seenFlags.has('jurisdiction')) throw new Error('--jurisdiction is required');
  return { subjects, patientContext };
}

function describeContext(patientContext) {
  const renal = patientContext.renal || {};
  let renalStr = 'not provided';
  if (renal.egfr != null && renal.crcl != null) {
    renalStr = `eGFR ${renal.egfr} mL/min/1.73m²; CrCl ${renal.crcl} mL/min`;
  } else if (renal.egfr != null) renalStr = `eGFR ${renal.egfr} mL/min/1.73m²`;
  else if (renal.crcl != null) renalStr = `CrCl ${renal.crcl} mL/min`;
  const hep = patientContext.hepatic || {};
  let hepStr = 'not provided';
  if (hep.child_pugh) hepStr = `Child-Pugh ${hep.child_pugh}`;
  else if (hep.flag === 'impaired') hepStr = 'impaired (grade unspecified)';
  const indStr = patientContext.indication || 'not provided';
  const jurisdictionStr = patientContext.jurisdiction || 'not provided';
  return [
    `  renal:        ${renalStr}`,
    `  hepatic:      ${hepStr}`,
    `  indication:   ${indStr}`,
    `  jurisdiction: ${jurisdictionStr}`,
  ];
}

export function formatReport({ subjects, patientContext = {}, result }) {
  const { findings, coverage } = result;
  const rulesTotal = coverage.rules_total;
  const lines = [];

  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('  DRAFT interaction review — NOT a runtime path, NOT clinician-approved');
  lines.push('  Evidence metadata passed the offline production-open source-policy check.');
  lines.push('  Live payload verification happened at assembly time; this invocation did not refetch.');
  lines.push('  The unsigned local attestation binds rule-pack and member-set bytes;');
  lines.push('  it detects drift but is not source authentication.');
  lines.push('  Every rule remains pending clinician approval.');
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Drugs entered: ${subjects.join(', ')}`);
  lines.push('Patient context:');
  lines.push(...describeContext(patientContext));
  lines.push('');

  if (findings.length === 0) {
    lines.push('No draft candidate interaction rule matched this combination.');
  } else {
    lines.push(`${findings.length} draft rule(s) flagged:`);
    lines.push('');
    findings.forEach((f, i) => {
      const diagTag = f.runtime_enabled === false ? '  ⟨DIAGNOSTIC ONLY — not pharmacist-facing⟩' : '';
      lines.push(`${i + 1}. [${f.severity.toUpperCase()}] ${f.subjects.join(' + ')}${diagTag}`);
      if (Array.isArray(f.indication_scope)) {
        lines.push(`      indication scope: ${f.indication_scope.join(', ')}`);
      }
      const targetSuffix = f.action_target ? `  (withhold/clarify the: ${f.action_target})` : '';
      lines.push(`      dispense action : ${f.dispense_action ?? '(none)'}${targetSuffix}`);
      if (Array.isArray(f.do_not_interrupt) && f.do_not_interrupt.length) {
        lines.push(`      do NOT interrupt: ${f.do_not_interrupt.join(', ')}`);
      }
      if (Array.isArray(f.data_required) && f.data_required.length) {
        for (const d of f.data_required) {
          const detail = d.would_be_severity
            ? `would be ${d.would_be_severity} if confirmed impaired`
            : d.reason;
          lines.push(`      data needed     : ${d.metric || d.factor}${detail ? ` (${detail})` : ''}`);
        }
      }
      const m = f.management || {};
      if (m.prescriber_action) lines.push(`      prescriber      : ${m.prescriber_action}`);
      if (m.monitoring) lines.push(`      monitoring      : ${m.monitoring}`);
      lines.push(`      rule_id         : ${f.rule_id}  (basis: ${f.basis})`);
      lines.push('');
    });
  }

  const missing = coverage.classes_missing_members || [];
  if (missing.length) {
    lines.push(`Coverage gap: ${missing.length} class(es) referenced by rules have incomplete member data,`);
    lines.push('so affected rules may not match (never treated as "no interaction"):');
    lines.push(`  ${missing.join(', ')}`);
    for (const gap of coverage.member_gaps || []) {
      const strength = gap.strength ? ` / ${gap.strength}` : '';
      lines.push(`  ${gap.rule_id}: ${gap.class}${strength} (${gap.reason})`);
    }
    lines.push('');
  }

  lines.push('────────────────────────────────────────────────────────────────');
  lines.push(`This draft checker covers only these ${rulesTotal} draft candidate interaction rules.`);
  lines.push('No alert — or a blank result — does not establish that a combination is safe.');
  lines.push('────────────────────────────────────────────────────────────────');

  return lines.join('\n');
}

export function runDraftReview(argv, { packPath, attestationPath, memberSetsPath } = {}) {
  const { subjects, patientContext } = parseArgs(argv);
  const memberSetSource = readMemberSetsFile(memberSetsPath);
  const rules = loadDraftPack(packPath, {
    attestationPath,
    memberSetsBytes: memberSetSource.bytes,
  });
  const result = checkInteractions({
    subjects,
    rules,
    memberSets: memberSetSource.classes,
    patientContext,
    includeDiagnostic: true,
  });
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
