import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  assembleDraftArtifacts,
  buildReviewIndex,
  buildDraftPack,
  DEFAULT_ATTESTATION_PATH,
  DEFAULT_MEMBER_SETS_PATH,
  DEFAULT_OUTPUT_PATH,
  DEFAULT_REVIEW_INDEX_PATH,
  DEFAULT_SECTIONS_DIR,
  DRAFT_SECTIONS,
} from '../src/cli/assemble-interaction-draft-pack.mjs';
import {
  assertDraftPackAttestation,
  parseDraftPackAttestation,
} from '../src/lib/interaction-draft-attestation.mjs';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function syntheticSections(root, { forgedPayloadHash = false, restrictedSource = false } = {}) {
  const template = fs.readFileSync(
    path.join(DEFAULT_SECTIONS_DIR, 'A.verified.jsonl'),
    'utf8',
  )
    .trim()
    .split('\n')
    .map(JSON.parse)
    .find((rule) => rule.rule_id === 'warfarin__nsaid_systemic');
  assert.ok(template);

  const evidence = structuredClone(template.evidence[0]);
  evidence.fragments = [structuredClone(evidence.fragments[0])];
  evidence.provenance.source_paths = [evidence.fragments[0].source_path];
  const payload = {
    set_id: evidence.provenance.set_id,
    version: evidence.provenance.version,
    effective_time: evidence.provenance.effective_time,
    precautions: [evidence.fragments[0].text],
  };
  evidence.provenance.payload_sha256 = forgedPayloadHash
    ? '0'.repeat(64)
    : sha256(JSON.stringify(canonicalize(payload)));
  if (restrictedSource) evidence.source_policy_id = 'onemg-live';

  fs.mkdirSync(root, { recursive: true });
  for (const section of DRAFT_SECTIONS) {
    const rule = structuredClone(template);
    rule.rule_id = `synthetic_${section.toLowerCase()}`;
    rule._section = section;
    rule.evidence = [structuredClone(evidence)];
    fs.writeFileSync(
      path.join(root, `${section}.verified.jsonl`),
      `${JSON.stringify(rule)}\n`,
      'utf8',
    );
  }
  return { evidence, payload };
}

function liveFetchFor(evidence, payload) {
  return async (url) => {
    if (url === evidence.source_url) {
      return new Response(JSON.stringify({ results: [payload] }), { status: 200 });
    }
    if (url === `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/`
      + `${evidence.provenance.set_id.toLowerCase()}.xml`) {
      return new Response(
        `<document><setId root="${evidence.provenance.set_id}"/>`
          + `<versionNumber value="${evidence.provenance.version}"/>`
          + `<effectiveTime value="${evidence.provenance.effective_time}"/></document>`,
        { status: 200 },
      );
    }
    return new Response('not found', { status: 404 });
  };
}

test('draft assembler is the exact byte-and-order concatenation of A-J slices', () => {
  const pack = buildDraftPack();
  const expected = Buffer.concat(DRAFT_SECTIONS.map(
    (section) => fs.readFileSync(
      path.join(DEFAULT_SECTIONS_DIR, `${section}.verified.jsonl`),
    ),
  ));

  assert.equal(pack.bytes.equals(expected), true);
  assert.equal(pack.bytes.includes(13), false);
  assert.equal(pack.bytes.at(-1), 10);
  assert.equal(
    pack.rules.length,
    Object.values(pack.sectionCounts).reduce((total, count) => total + count, 0),
  );
  assert.deepEqual(
    pack.ruleIds,
    pack.rules.map((rule) => rule.rule_id),
  );
});

test('review-index rendering preserves slice order, statuses, jurisdictions, and actions', () => {
  const pack = buildDraftPack();
  const index = buildReviewIndex(pack.rules);
  assert.equal(index.endsWith('\n'), true);
  assert.equal(index.endsWith('\n\n'), false);
  const rows = index
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));

  assert.equal(rows.length, pack.rules.length);
  assert.deepEqual(
    rows.map((row) => row[0].slice(1, -1)),
    pack.ruleIds,
  );
  for (const [position, rule] of pack.rules.entries()) {
    const row = rows[position];
    assert.equal(row[5], rule.management.dispense_action, rule.rule_id);
    assert.equal(row[6], rule.runtime_enabled ? 'on' : 'off', rule.rule_id);
    assert.equal(
      row[7],
      rule.runtime_status.pair_matcher_executable ? 'yes' : 'no',
      rule.rule_id,
    );
    assert.equal(
      row[8],
      rule.applicability.jurisdiction.length > 0
        ? rule.applicability.jurisdiction.join('/')
        : 'unresolved',
      rule.rule_id,
    );
  }
});

test('canonical assembly verifies live payloads before atomically writing all artifacts', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-draft-artifacts-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sectionsDir = path.join(dir, 'sections');
  const { evidence, payload } = syntheticSections(sectionsDir);
  const outputPath = path.join(dir, 'pack.jsonl');
  const reviewIndexPath = path.join(dir, 'review-index.md');
  const attestationPath = path.join(dir, 'pack.provenance.json');
  const memberSetsPath = path.join(dir, 'interaction-member-sets.json');
  const memberSetsBytes = Buffer.from(
    '{\n  "classes": {\n    "nsaid": { "any": ["ibuprofen"] }\n  }\n}\n',
  );
  fs.writeFileSync(memberSetsPath, memberSetsBytes);
  const result = await assembleDraftArtifacts({
    sectionsDir,
    outputPath,
    reviewIndexPath,
    attestationPath,
    memberSetsPath,
    fetchImpl: liveFetchFor(evidence, payload),
    retries: 0,
  });

  assert.equal(fs.readFileSync(outputPath).equals(result.bytes), true);
  assert.equal(fs.readFileSync(reviewIndexPath, 'utf8'), result.reviewIndex);
  assert.equal(result.verification.records_verified, DRAFT_SECTIONS.length);
  const attestation = parseDraftPackAttestation(
    fs.readFileSync(attestationPath, 'utf8'),
  );
  assertDraftPackAttestation(attestation, {
    packBytes: result.bytes,
    memberSetsBytes,
    rules: result.rules,
  });
  assert.equal(attestation.member_sets_sha256, sha256(memberSetsBytes));
  assert.equal(attestation.member_sets_byte_count, memberSetsBytes.length);
  assert.equal(
    attestation.trust_boundary,
    'unsigned_local_drift_detection_not_authentication',
  );
});

test('canonical assembly rejects malformed member sets before verification or writes', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-draft-member-sets-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sectionsDir = path.join(dir, 'sections');
  syntheticSections(sectionsDir);
  const outputPath = path.join(dir, 'pack.jsonl');
  const reviewIndexPath = path.join(dir, 'review-index.md');
  const attestationPath = path.join(dir, 'pack.provenance.json');
  const memberSetsPath = path.join(dir, 'interaction-member-sets.json');
  fs.writeFileSync(
    memberSetsPath,
    '{"classes":{"nsaid":{"any":"ibuprofen"}}}\n',
  );
  let fetchReached = false;

  await assert.rejects(
    assembleDraftArtifacts({
      sectionsDir,
      outputPath,
      reviewIndexPath,
      attestationPath,
      memberSetsPath,
      fetchImpl: async () => {
        fetchReached = true;
        return new Response('{}', { status: 200 });
      },
      retries: 0,
    }),
    /classes\.nsaid\.any must be a non-empty array/i,
  );
  assert.equal(fetchReached, false);
  for (const artifact of [outputPath, reviewIndexPath, attestationPath]) {
    assert.equal(fs.existsSync(artifact), false, artifact);
  }
});

for (const mutation of ['section slice', 'member sets']) {
  test(`canonical assembly rejects ${mutation} drift during live verification without replacing artifacts`, async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-draft-input-drift-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const sectionsDir = path.join(dir, 'sections');
    const { evidence, payload } = syntheticSections(sectionsDir);
    const outputPath = path.join(dir, 'pack.jsonl');
    const reviewIndexPath = path.join(dir, 'review-index.md');
    const attestationPath = path.join(dir, 'pack.provenance.json');
    const memberSetsPath = path.join(dir, 'interaction-member-sets.json');
    fs.writeFileSync(
      memberSetsPath,
      '{"classes":{"nsaid":{"any":["ibuprofen"]}}}\n',
    );
    const prior = new Map([
      [outputPath, Buffer.from('prior pack\n')],
      [reviewIndexPath, Buffer.from('prior index\n')],
      [attestationPath, Buffer.from('prior attestation\n')],
    ]);
    for (const [artifactPath, contents] of prior) fs.writeFileSync(artifactPath, contents);

    const stableFetch = liveFetchFor(evidence, payload);
    let mutated = false;
    const fetchImpl = async (url) => {
      if (!mutated) {
        mutated = true;
        if (mutation === 'section slice') {
          fs.appendFileSync(path.join(sectionsDir, 'A.verified.jsonl'), '\n');
        } else {
          fs.writeFileSync(
            memberSetsPath,
            '{"classes":{"nsaid":{"any":["ibuprofen","naproxen"]}}}\n',
          );
        }
      }
      return stableFetch(url);
    };

    await assert.rejects(
      assembleDraftArtifacts({
        sectionsDir,
        outputPath,
        reviewIndexPath,
        attestationPath,
        memberSetsPath,
        fetchImpl,
        retries: 0,
      }),
      mutation === 'section slice'
        ? /Section A changed during live evidence verification/
        : /member-set file changed during live evidence verification/i,
    );
    assert.equal(mutated, true);
    for (const [artifactPath, contents] of prior) {
      assert.equal(fs.readFileSync(artifactPath).equals(contents), true, artifactPath);
    }
  });
}

test('multi-artifact replacement restores every prior file when a Windows rename fails', {
  concurrency: false,
}, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-draft-rollback-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sectionsDir = path.join(dir, 'sections');
  const { evidence, payload } = syntheticSections(sectionsDir);
  const outputPath = path.join(dir, 'pack.jsonl');
  const reviewIndexPath = path.join(dir, 'review-index.md');
  const attestationPath = path.join(dir, 'pack.provenance.json');
  const prior = new Map([
    [outputPath, Buffer.from('prior pack\n')],
    [reviewIndexPath, Buffer.from('prior index\n')],
    [attestationPath, Buffer.from('prior attestation\n')],
  ]);
  for (const [artifactPath, contents] of prior) fs.writeFileSync(artifactPath, contents);

  const originalRenameSync = fs.renameSync;
  let renameCount = 0;
  fs.renameSync = (...args) => {
    renameCount += 1;
    if (renameCount === 5) throw new Error('simulated Windows rename failure');
    return originalRenameSync(...args);
  };
  t.after(() => {
    fs.renameSync = originalRenameSync;
  });

  await assert.rejects(
    assembleDraftArtifacts({
      sectionsDir,
      outputPath,
      reviewIndexPath,
      attestationPath,
      fetchImpl: liveFetchFor(evidence, payload),
      retries: 0,
    }),
    /simulated Windows rename failure/i,
  );
  for (const [artifactPath, contents] of prior) {
    assert.equal(fs.readFileSync(artifactPath).equals(contents), true, artifactPath);
  }
  assert.deepEqual(
    fs.readdirSync(dir).filter((name) => /\.(?:tmp|bak)$/u.test(name)),
    [],
  );
});

test('restricted evidence is rejected before canonical assembly writes any artifact', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-draft-restricted-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sectionsDir = path.join(dir, 'sections');
  syntheticSections(sectionsDir, { restrictedSource: true });
  const outputPath = path.join(dir, 'pack.jsonl');
  const reviewIndexPath = path.join(dir, 'review-index.md');
  const attestationPath = path.join(dir, 'pack.provenance.json');

  await assert.rejects(
    assembleDraftArtifacts({
      sectionsDir,
      outputPath,
      reviewIndexPath,
      attestationPath,
      fetchImpl: async () => {
        throw new Error('network must not be reached for restricted metadata');
      },
    }),
    /onemg-live|production-open|interaction-evidence/i,
  );
  for (const artifact of [outputPath, reviewIndexPath, attestationPath]) {
    assert.equal(fs.existsSync(artifact), false, artifact);
  }
});

test('forged openFDA payload hashes fail live binding before any artifact is written', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-draft-forged-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sectionsDir = path.join(dir, 'sections');
  const { evidence, payload } = syntheticSections(sectionsDir, {
    forgedPayloadHash: true,
  });
  const outputPath = path.join(dir, 'pack.jsonl');
  const reviewIndexPath = path.join(dir, 'review-index.md');
  const attestationPath = path.join(dir, 'pack.provenance.json');

  await assert.rejects(
    assembleDraftArtifacts({
      sectionsDir,
      outputPath,
      reviewIndexPath,
      attestationPath,
      fetchImpl: liveFetchFor(evidence, payload),
      retries: 0,
    }),
    (error) => error instanceof AggregateError
      && error.errors.some((failure) => /payload SHA-256 does not match provenance/i.test(
        failure.message,
      )),
  );
  for (const artifact of [outputPath, reviewIndexPath, attestationPath]) {
    assert.equal(fs.existsSync(artifact), false, artifact);
  }
});

test('checked-in aggregate exactly equals the canonical assembled bytes', () => {
  const pack = buildDraftPack();
  const aggregate = fs.readFileSync(DEFAULT_OUTPUT_PATH);
  const aggregateLines = aggregate.toString('utf8').slice(0, -1).split('\n');

  assert.equal(aggregate.includes(13), false);
  assert.equal(aggregate.at(-1), 10);
  assert.equal(aggregateLines.length, pack.rules.length);
  assert.deepEqual(
    aggregateLines.map((line) => JSON.parse(line).rule_id),
    pack.ruleIds,
  );
  assert.equal(
    aggregate.equals(pack.bytes),
    true,
    `run npm run interactions:draft:assemble (expected SHA-256 ${pack.sha256})`,
  );
});

test('checked-in review index exactly equals the canonical slice-derived rendering', () => {
  const pack = buildDraftPack();
  assert.equal(
    fs.readFileSync(DEFAULT_REVIEW_INDEX_PATH, 'utf8'),
    buildReviewIndex(pack.rules),
    'run npm run interactions:draft:assemble',
  );
});

test('checked-in provenance attestation binds the exact canonical aggregate', () => {
  const pack = buildDraftPack();
  const attestation = parseDraftPackAttestation(
    fs.readFileSync(DEFAULT_ATTESTATION_PATH, 'utf8'),
  );
  assertDraftPackAttestation(attestation, {
    packBytes: fs.readFileSync(DEFAULT_OUTPUT_PATH),
    memberSetsBytes: fs.readFileSync(DEFAULT_MEMBER_SETS_PATH),
    rules: pack.rules,
  });
});
