import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  createDraftPackAttestation,
  serializeDraftPackAttestation,
} from '../lib/interaction-draft-attestation.mjs';
import { validateDraftRules } from '../lib/interaction-draft-validation.mjs';
import { verifyInteractionEvidenceRecords } from '../lib/interaction-evidence-live-verifier.mjs';
import {
  assertEvidenceMetadataAllowed,
  loadSourceManifest,
} from '../lib/interaction-source-policy.mjs';
import { parseInteractionMemberSets } from '../lib/interaction-member-set-validation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DRAFT_SECTIONS = [...'ABCDEFGHIJ'];
export const DEFAULT_SECTIONS_DIR = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'sections',
);
export const DEFAULT_OUTPUT_PATH = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'batch-01-v2.jsonl',
);
export const DEFAULT_REVIEW_INDEX_PATH = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'review-index.md',
);
export const DEFAULT_ATTESTATION_PATH = path.join(
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
const EVIDENCE_PROFILE = 'production-open';
const SECTION_TITLES = {
  A: 'Anticoagulant/antiplatelet',
  B: 'Statins',
  C: 'Serotonin/CNS',
  D: 'QT/arrhythmia',
  E: 'Bradycardia/AV',
  F: 'Hyperkalaemia/renal',
  G: 'CYP3A4/P-gp',
  H: 'Enzyme induction',
  I: 'Absorption/GI',
  J: 'Endocrine/misc',
};

function readSection(section, sectionsDir) {
  const sectionPath = path.join(sectionsDir, `${section}.verified.jsonl`);
  const bytes = fs.readFileSync(sectionPath);
  if (bytes.length === 0) throw new Error(`Section ${section} is empty`);
  if (bytes.includes(13)) throw new Error(`Section ${section} must use LF line endings`);

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`Section ${section} is not valid UTF-8: ${error.message}`);
  }
  if (!text.endsWith('\n')) {
    throw new Error(`Section ${section} must end with exactly one LF`);
  }

  const lines = text.slice(0, -1).split('\n');
  if (lines.some((line) => line.length === 0)) {
    throw new Error(`Section ${section} contains a blank JSONL line`);
  }

  const rules = lines.map((line, index) => {
    let rule;
    try {
      rule = JSON.parse(line);
    } catch (error) {
      throw new Error(`Section ${section} line ${index + 1} is not valid JSON: ${error.message}`);
    }
    if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) {
      throw new Error(`Section ${section} line ${index + 1} must contain a JSON object`);
    }
    if (rule._section !== section) {
      throw new Error(
        `Section ${section} line ${index + 1} has _section ${JSON.stringify(rule._section)}`,
      );
    }
    return rule;
  });

  return { bytes, rules };
}

function evidenceStoragePath(section) {
  return path.posix.join(
    'docs',
    'interaction-review',
    'batch-01-v2',
    'sections',
    `${section}.verified.jsonl`,
  );
}

function collectEvidenceRecords(rules) {
  return rules.flatMap((rule) => (rule.evidence ?? []).map((evidence) => ({
    section: rule._section,
    rule_id: rule.rule_id,
    evidence,
    storagePath: evidenceStoragePath(rule._section),
  })));
}

function assertDraftEvidenceMetadata(records) {
  const manifest = loadSourceManifest();
  for (const record of records) {
    try {
      assertEvidenceMetadataAllowed(manifest, record.evidence, {
        profile: EVIDENCE_PROFILE,
        use: record.evidence.source_policy_use,
        storagePath: record.storagePath,
      });
    } catch (error) {
      throw new Error(
        `Section ${record.section} rule ${JSON.stringify(record.rule_id)} evidence `
          + `${JSON.stringify(record.evidence?.source_id)} failed metadata policy: ${error.message}`,
        { cause: error },
      );
    }
  }
}

function readMemberSetsBytes(memberSetsPath) {
  const bytes = fs.readFileSync(memberSetsPath);
  parseInteractionMemberSets(bytes);
  return bytes;
}

export function buildDraftPack({ sectionsDir = DEFAULT_SECTIONS_DIR } = {}) {
  const chunks = [];
  const sectionBytes = {};
  const rules = [];
  const sectionCounts = {};
  const seenRuleIds = new Set();

  for (const section of DRAFT_SECTIONS) {
    const parsed = readSection(section, sectionsDir);
    chunks.push(parsed.bytes);
    sectionBytes[section] = parsed.bytes;
    sectionCounts[section] = parsed.rules.length;
    for (const rule of parsed.rules) {
      if (seenRuleIds.has(rule.rule_id)) {
        throw new Error(`Duplicate rule_id ${JSON.stringify(rule.rule_id)} across section slices`);
      }
      seenRuleIds.add(rule.rule_id);
      rules.push(rule);
    }
  }

  validateDraftRules(rules);
  const evidenceRecords = collectEvidenceRecords(rules);
  assertDraftEvidenceMetadata(evidenceRecords);
  const bytes = Buffer.concat(chunks);
  return {
    bytes,
    sectionBytes,
    rules,
    ruleIds: rules.map((rule) => rule.rule_id),
    sectionCounts,
    evidenceRecords,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function assertAssemblyInputsUnchanged({
  sectionsDir,
  sectionBytes,
  memberSetsPath,
  memberSetsBytes,
}) {
  for (const section of DRAFT_SECTIONS) {
    const sectionPath = path.join(sectionsDir, `${section}.verified.jsonl`);
    const currentBytes = fs.readFileSync(sectionPath);
    if (!currentBytes.equals(sectionBytes[section])) {
      throw new Error(`Section ${section} changed during live evidence verification`);
    }
  }
  if (!fs.readFileSync(memberSetsPath).equals(memberSetsBytes)) {
    throw new Error('Interaction member-set file changed during live evidence verification');
  }
}

function markdownCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ');
}

function describeRef(ref) {
  if (!ref) return 'condition only';
  let label;
  if (ref.drug) label = ref.drug;
  else if (ref.substance) label = ref.substance;
  else if (ref.class) label = ref.class;
  else if (Array.isArray(ref.combination)) {
    label = ref.combination.map((member) => describeRef(member)).join(' + ');
  } else label = 'unresolved selector';

  const strength = Array.isArray(ref.strength) && ref.strength.length > 0
    ? ` [${ref.strength.join('/')}]`
    : '';
  return `${label}${strength}`;
}

function describePair(rule) {
  const second = rule.perpetrator ?? rule.second_subject ?? rule.coadministered_with;
  return `${describeRef(rule.object)} <-> ${describeRef(second)}`;
}

function describeContext(rule) {
  if (!Array.isArray(rule.context_modifiers) || rule.context_modifiers.length === 0) return '-';
  return rule.context_modifiers.map((modifier) => {
    const action = modifier.management_override?.dispense_action
      ?? modifier.dispense_action
      ?? '-';
    return `${modifier.factor}:${modifier.when}->${modifier.severity ?? rule.severity}`
      + `/${action}(${modifier.on_unknown})`;
  }).join('; ');
}

export function buildReviewIndex(rules) {
  validateDraftRules(rules);
  const enabledCount = rules.filter((rule) => rule.runtime_enabled).length;
  const matcherInertCount = rules.filter(
    (rule) => !rule.runtime_status.pair_matcher_executable,
  ).length;
  const lines = [
    '# Batch 1 v2 - Review Index',
    '',
    `${rules.length} draft rules; ${enabledCount} runtime-enabled; `
      + `${matcherInertCount} matcher-inert. Every rule remains promotion-ineligible.`,
    '',
    'Runtime `off` rows are diagnostic-only. A `pair matcher` value of `no` means the rule '
      + 'cannot emit even in draft review.',
    '',
  ];

  for (const section of DRAFT_SECTIONS) {
    lines.push(`## ${section}. ${SECTION_TITLES[section]}`);
    lines.push('');
    lines.push('| id | <-> | basis | sev | context | dispense | runtime | pair matcher | jurisdiction | conf |');
    lines.push('|--|--|--|--|--|--|--|--|--|--|');
    for (const rule of rules.filter((candidate) => candidate._section === section)) {
      const jurisdiction = Array.isArray(rule.applicability?.jurisdiction)
        && rule.applicability.jurisdiction.length > 0
        ? rule.applicability.jurisdiction.join('/')
        : 'unresolved';
      const cells = [
        `\`${rule.rule_id}\``,
        describePair(rule),
        rule.risk_basis,
        rule.severity,
        describeContext(rule),
        rule.management.dispense_action,
        rule.runtime_enabled ? 'on' : 'off',
        rule.runtime_status.pair_matcher_executable ? 'yes' : 'no',
        jurisdiction,
        rule.review?.conf ?? '-',
      ].map(markdownCell);
      lines.push(`| ${cells.join(' | ')} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function stageArtifact(targetPath, contents) {
  const bytes = ArrayBuffer.isView(contents)
    ? Buffer.from(contents.buffer, contents.byteOffset, contents.byteLength)
    : Buffer.from(contents, 'utf8');
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporaryPath, bytes, { flag: 'wx' });
  if (!fs.readFileSync(temporaryPath).equals(bytes)) {
    fs.rmSync(temporaryPath, { force: true });
    throw new Error(`Staged artifact verification failed for ${targetPath}`);
  }
  return { targetPath, temporaryPath, bytes };
}

function stageArtifacts(artifacts) {
  const targets = artifacts.map((artifact) => path.resolve(artifact.targetPath));
  if (new Set(targets).size !== targets.length) {
    throw new Error('Draft artifact output paths must be distinct');
  }
  const staged = [];
  try {
    for (const artifact of artifacts) {
      staged.push(stageArtifact(artifact.targetPath, artifact.contents));
    }
    return staged;
  } catch (error) {
    for (const artifact of staged) {
      fs.rmSync(artifact.temporaryPath, { force: true });
    }
    throw error;
  }
}

function replaceStagedArtifacts(stagedArtifacts) {
  for (const artifact of stagedArtifacts) {
    artifact.backupPath = `${artifact.targetPath}.${process.pid}.${randomUUID()}.bak`;
    artifact.originalMoved = false;
    artifact.installed = false;
  }
  try {
    for (const artifact of stagedArtifacts) {
      if (fs.existsSync(artifact.targetPath)) {
        fs.renameSync(artifact.targetPath, artifact.backupPath);
        artifact.originalMoved = true;
      }
    }
    for (const artifact of stagedArtifacts) {
      fs.renameSync(artifact.temporaryPath, artifact.targetPath);
      artifact.installed = true;
    }
    for (const artifact of stagedArtifacts) {
      if (!fs.readFileSync(artifact.targetPath).equals(artifact.bytes)) {
        throw new Error(`Artifact verification failed after writing ${artifact.targetPath}`);
      }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const artifact of [...stagedArtifacts].reverse()) {
      if (!artifact.installed) continue;
      try {
        fs.rmSync(artifact.targetPath, { force: true });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const artifact of [...stagedArtifacts].reverse()) {
      if (!artifact.originalMoved) continue;
      try {
        fs.renameSync(artifact.backupPath, artifact.targetPath);
        artifact.originalMoved = false;
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const artifact of stagedArtifacts) {
      fs.rmSync(artifact.temporaryPath, { force: true });
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Draft artifact replacement failed and rollback was incomplete',
      );
    }
    throw error;
  }
  for (const artifact of stagedArtifacts) {
    if (artifact.originalMoved) fs.rmSync(artifact.backupPath, { force: true });
    fs.rmSync(artifact.temporaryPath, { force: true });
  }
}

export async function assembleDraftArtifacts({
  sectionsDir = DEFAULT_SECTIONS_DIR,
  outputPath = DEFAULT_OUTPUT_PATH,
  reviewIndexPath = DEFAULT_REVIEW_INDEX_PATH,
  attestationPath = DEFAULT_ATTESTATION_PATH,
  memberSetsPath = DEFAULT_MEMBER_SETS_PATH,
  concurrency,
  retries,
  fetchImpl,
} = {}) {
  const memberSetsBytes = readMemberSetsBytes(memberSetsPath);
  const pack = buildDraftPack({ sectionsDir });
  const reviewIndex = buildReviewIndex(pack.rules);
  const verifierOptions = {
    records: pack.evidenceRecords,
    concurrency,
    retries,
  };
  if (fetchImpl !== undefined) verifierOptions.fetchImpl = fetchImpl;
  const verification = await verifyInteractionEvidenceRecords(verifierOptions);
  if (verification.records_verified !== pack.evidenceRecords.length) {
    throw new Error(
      `Live verifier confirmed ${verification.records_verified} of `
        + `${pack.evidenceRecords.length} evidence records`,
    );
  }

  const attestation = createDraftPackAttestation({
    packBytes: pack.bytes,
    memberSetsBytes,
    rules: pack.rules,
    verifiedAt: new Date().toISOString(),
  });
  const attestationText = serializeDraftPackAttestation(attestation);
  assertAssemblyInputsUnchanged({
    sectionsDir,
    sectionBytes: pack.sectionBytes,
    memberSetsPath,
    memberSetsBytes,
  });
  const stagedArtifacts = stageArtifacts([
    { targetPath: reviewIndexPath, contents: reviewIndex },
    { targetPath: outputPath, contents: pack.bytes },
    { targetPath: attestationPath, contents: attestationText },
  ]);
  replaceStagedArtifacts(stagedArtifacts);

  return {
    ...pack,
    outputPath,
    reviewIndex,
    reviewIndexPath,
    attestation,
    attestationPath,
    memberSetsPath,
    verification,
  };
}

export async function main() {
  const result = await assembleDraftArtifacts({
    concurrency: process.env.AUSHADHI_EVIDENCE_VERIFY_CONCURRENCY,
    retries: process.env.AUSHADHI_EVIDENCE_VERIFY_RETRIES,
  });
  process.stdout.write(
    `Assembled ${result.rules.length} rules into ${result.outputPath}\n`
      + `Synchronized review index at ${result.reviewIndexPath}\n`
      + `Wrote live-verification attestation at ${result.attestationPath}\n`
      + `Verified ${result.verification.records_verified} evidence records\n`
      + `Pack SHA-256 ${result.sha256}\n`
      + `Member sets SHA-256 ${result.attestation.member_sets_sha256}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    for (const failure of error.errors ?? []) {
      process.stderr.write(`- ${failure.message}\n`);
    }
    process.exitCode = 1;
  });
}
