import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW_ROOT = join(ROOT, 'docs', 'interaction-review', 'batch-01-v2');
const SECTIONS = [...'ABCDEFGHIJ'];
const TARGETS = [
  {
    path: join(REVIEW_ROOT, 'batch-01-v2.jsonl'),
    expectedSection: null,
  },
  ...SECTIONS.map((section) => ({
    path: join(REVIEW_ROOT, 'sections', `${section}.verified.jsonl`),
    expectedSection: section,
  })),
];

const CAPTURED_OUTPUT_MARKERS = [
  'Exit code:',
  'Wall time:',
  'Total output lines:',
  'Output:',
];
const TRUNCATION_MARKERS = [
  {
    name: 'Unicode replacement character',
    pattern: /\uFFFD/u,
  },
  {
    name: 'Unicode ellipsis truncation marker',
    pattern: /\u2026\s*\d+\s+(?:characters?|chars?|tokens?|lines?)\s+truncated\s*\u2026/iu,
  },
  {
    name: 'bracketed truncation marker',
    pattern: /\[(?:[^\]\r\n]*\s)?truncated(?:\s+[^\]\r\n]*)?\]/iu,
  },
  {
    name: 'angle-bracketed truncation marker',
    pattern: /<(?:[^\r\n>]*\s)?truncated(?:\s+[^\r\n>]*)?>/iu,
  },
  {
    name: 'ASCII ellipsis truncation marker',
    pattern: /\.{3}\s*(?:\d+\s+)?(?:characters?|chars?|tokens?|lines?)?\s*truncated\s*\.{3}/iu,
  },
];

function displayPath(path) {
  return relative(ROOT, path).replaceAll('\\', '/');
}

function readJsonl(path) {
  const label = displayPath(path);
  const text = readFileSync(path, 'utf8');

  for (const marker of CAPTURED_OUTPUT_MARKERS) {
    assert.equal(
      text.includes(marker),
      false,
      `${label} contains captured tool output marker ${JSON.stringify(marker)}`,
    );
  }
  for (const { name, pattern } of TRUNCATION_MARKERS) {
    assert.doesNotMatch(text, pattern, `${label} contains a ${name}`);
  }

  const lines = text.split(/\r?\n/);
  let lastContentLine = lines.length - 1;
  while (lastContentLine >= 0 && lines[lastContentLine].trim() === '') {
    lastContentLine -= 1;
  }
  assert.ok(lastContentLine >= 0, `${label} is empty`);

  const records = [];
  for (let index = 0; index <= lastContentLine; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    assert.notEqual(line.trim(), '', `${label}:${lineNumber} is a blank line inside the JSONL stream`);

    try {
      records.push({
        lineNumber,
        value: JSON.parse(line),
      });
    } catch (error) {
      assert.fail(`${label}:${lineNumber} is malformed JSON: ${error.message}`);
    }
  }

  return records;
}

function assertRuleIntegrity(path, records, expectedSection) {
  const label = displayPath(path);
  const firstLineByRuleId = new Map();

  for (const { lineNumber, value } of records) {
    assert.ok(
      value !== null && typeof value === 'object' && !Array.isArray(value),
      `${label}:${lineNumber} must contain a JSON object`,
    );
    assert.ok(
      typeof value.rule_id === 'string' && value.rule_id.trim() !== '',
      `${label}:${lineNumber} is missing rule_id`,
    );
    assert.ok(
      typeof value._section === 'string' && value._section.trim() !== '',
      `${label}:${lineNumber} (${value.rule_id}) is missing _section`,
    );

    if (expectedSection !== null) {
      assert.equal(
        value._section,
        expectedSection,
        `${label}:${lineNumber} (${value.rule_id}) belongs to section ${value._section}, expected ${expectedSection}`,
      );
    }

    const firstLine = firstLineByRuleId.get(value.rule_id);
    assert.equal(
      firstLine,
      undefined,
      `${label}:${lineNumber} duplicates rule_id ${JSON.stringify(value.rule_id)} from line ${firstLine}`,
    );
    firstLineByRuleId.set(value.rule_id, lineNumber);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function contentHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

for (const target of TARGETS) {
  test(`${displayPath(target.path)} is intact JSONL`, () => {
    const records = readJsonl(target.path);
    assertRuleIntegrity(target.path, records, target.expectedSection);

    if (target.expectedSection === null) {
      const sectionRuns = records
        .map(({ value }) => value._section)
        .filter((section, index, all) => index === 0 || section !== all[index - 1]);
      assert.deepEqual(
        sectionRuns,
        SECTIONS,
        'aggregate sections must each form one contiguous block in A-J order',
      );
    }
  });
}

for (const section of SECTIONS) {
  test(`aggregate Section ${section} exactly matches ${section}.verified.jsonl`, () => {
    const aggregateRecords = readJsonl(TARGETS[0].path)
      .filter(({ value }) => value._section === section);
    const sectionTarget = TARGETS.find((target) => target.expectedSection === section);
    const sectionRecords = readJsonl(sectionTarget.path);
    const aggregateRuleIds = aggregateRecords.map(({ value }) => value.rule_id);
    const sectionRuleIds = sectionRecords.map(({ value }) => value.rule_id);

    assert.deepEqual(
      aggregateRuleIds,
      sectionRuleIds,
      `Section ${section} aggregate rule IDs must match ${section}.verified.jsonl in order`,
    );

    const mismatches = aggregateRecords.flatMap(({ value }, index) => {
      const aggregateContent = canonicalJson(value);
      const sectionContent = canonicalJson(sectionRecords[index].value);
      if (aggregateContent === sectionContent) return [];
      return [
        `${value.rule_id} at position ${index + 1}: aggregate ${contentHash(aggregateContent)}, `
          + `section ${contentHash(sectionContent)}`,
      ];
    });
    assert.deepEqual(
      mismatches,
      [],
      `Section ${section} canonical JSON must match ${section}.verified.jsonl`,
    );
  });
}
