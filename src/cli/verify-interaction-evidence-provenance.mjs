import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyInteractionEvidenceRecords } from '../lib/interaction-evidence-live-verifier.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SECTION_ROOT = path.join(
  ROOT,
  'docs',
  'interaction-review',
  'batch-01-v2',
  'sections',
);
const ALL_SECTIONS = [...'ABCDEFGHIJ'];

function selectedSections(argv) {
  const argument = argv.find((value) => value.startsWith('--sections='));
  if (!argument) return ALL_SECTIONS;
  const sections = [
    ...new Set(
      argument
        .slice('--sections='.length)
        .toUpperCase()
        .split(/[^A-J]+/u)
        .flatMap((value) => [...value])
        .filter(Boolean),
    ),
  ];
  if (sections.length === 0 || sections.some((section) => !ALL_SECTIONS.includes(section))) {
    throw new Error('--sections must select one or more letters from A through J');
  }
  return sections;
}

function loadRecords(sections) {
  return sections.flatMap((section) => {
    const storagePath =
      `docs/interaction-review/batch-01-v2/sections/${section}.verified.jsonl`;
    const absolutePath = path.join(SECTION_ROOT, `${section}.verified.jsonl`);
    const rules = fs.readFileSync(absolutePath, 'utf8')
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    return rules.flatMap((rule) => (rule.evidence ?? []).map((evidence) => ({
      section,
      rule_id: rule.rule_id,
      evidence,
      storagePath,
    })));
  });
}

try {
  const sections = selectedSections(process.argv.slice(2));
  const records = loadRecords(sections);
  const summary = await verifyInteractionEvidenceRecords({
    records,
    concurrency: process.env.AUSHADHI_EVIDENCE_VERIFY_CONCURRENCY,
    retries: process.env.AUSHADHI_EVIDENCE_VERIFY_RETRIES,
  });
  process.stdout.write(`${JSON.stringify({
    sections,
    ...summary,
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  for (const failure of error.errors ?? []) {
    process.stderr.write(`- ${failure.message}\n`);
  }
  process.exitCode = 1;
}
