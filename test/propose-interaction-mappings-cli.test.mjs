import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMappingCandidates,
  parseArgs,
} from '../src/cli/propose-interaction-mappings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoots = new Set();

function tempOutput() {
  const root = path.join(
    ROOT,
    'data',
    'interaction',
    'internal-evaluation',
    `.tmp-rxnorm-proposals-${randomUUID()}`,
  );
  tempRoots.add(root);
  return path.join(root, 'rxnorm-mappings.jsonl');
}

test.after(async () => {
  await Promise.all([...tempRoots].map((root) => fs.rm(root, { recursive: true, force: true })));
});

function fixtureClient() {
  return {
    async requestJson(url) {
      const parsed = new URL(url);
      if (parsed.pathname === '/REST/version.json') {
        return {
          url,
          payload: { version: '06-Jul-2026', apiVersion: '3.1.353' },
          response_sha256: 'd'.repeat(64),
          cache_status: 'miss',
        };
      }
      if (parsed.pathname === '/REST/rxcui.json') {
        return {
          url,
          payload: { idGroup: { rxnormId: ['123'] } },
          response_sha256: 'a'.repeat(64),
          cache_status: 'miss',
        };
      }
      if (parsed.pathname === '/REST/rxcui/123/properties.json') {
        return {
          url,
          payload: {
            properties: {
              rxcui: '123',
              name: parsed.searchParams.get('name') ?? 'Warfarin',
              synonym: '',
              tty: 'IN',
            },
          },
          response_sha256: 'b'.repeat(64),
          cache_status: 'miss',
        };
      }
      if (parsed.pathname === '/REST/Prescribe/rxcui/123/property.json') {
        return {
          url,
          payload: {
            propConceptGroup: {
              propConcept: [{ propName: 'UNII_CODE', propValue: '5Q7ZVV76EI' }],
            },
          },
          response_sha256: 'c'.repeat(64),
          cache_status: 'miss',
        };
      }
      throw new Error(`unexpected URL ${url}`);
    },
  };
}

test('proposal CLI requires explicit profile and a bounded input source', () => {
  assert.throws(() => parseArgs(['--ingredient', 'warfarin']), /--profile/i);
  assert.throws(
    () => parseArgs(['--profile', 'internal-evaluation']),
    /at least one --ingredient or --ingredient-index/i,
  );
  assert.throws(
    () => parseArgs([
      '--profile', 'internal-evaluation',
      '--ingredient-index', 'ingredient-index.jsonl',
    ]),
    /requires an explicit --limit/i,
  );
  assert.throws(
    () => parseArgs([
      '--profile', 'internal-evaluation',
      '--ingredient-index', 'ingredient-index.jsonl',
      '--limit', '101',
    ]),
    /between 1 and 100/i,
  );
  assert.throws(
    () => parseArgs([
      '--profile', 'internal-evaluation',
      '--ingredient', 'warfarin',
      '--ingredient-index', 'ingredient-index.jsonl',
      '--limit', '1',
    ]),
    /either --ingredient inputs or --ingredient-index/i,
  );
});

test('proposal CLI writes review candidates atomically and accepts none', async () => {
  const outputPath = tempOutput();
  const options = parseArgs([
    '--profile', 'internal-evaluation',
    '--ingredient', 'Warfarin',
    '--output', path.relative(ROOT, outputPath),
    '--cache', path.relative(ROOT, path.join(path.dirname(outputPath), 'cache')),
  ]);
  const result = await buildMappingCandidates(options, {
    client: fixtureClient(),
    retrievedAt: '2026-07-26',
  });

  assert.deepEqual(result, {
    output_path: outputPath,
    candidate_count: 1,
    exact_single_candidate_count: 1,
    accepted_mapping_count: 0,
  });
  const lines = (await fs.readFile(outputPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].review_status, 'review_candidate');
  assert.equal(lines[0].accepted_mapping, null);
  assert.equal(lines[0].search.source_id, 'rxnorm');
});

test('proposal CLI rejects an input set that is empty after normalization', async () => {
  const outputPath = tempOutput();
  const options = parseArgs([
    '--profile', 'internal-evaluation',
    '--ingredient', '   ',
    '--output', path.relative(ROOT, outputPath),
  ]);
  await assert.rejects(
    buildMappingCandidates(options, {
      client: fixtureClient(),
      retrievedAt: '2026-07-26',
    }),
    /ingredient input is empty/i,
  );
  await assert.rejects(fs.access(outputPath), /ENOENT/i);
});

test('proposal CLI does not replace the output after an operational failure', async () => {
  const outputPath = tempOutput();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, 'previous\n', 'utf8');
  const options = parseArgs([
    '--profile', 'internal-evaluation',
    '--ingredient', 'Warfarin',
    '--ingredient', 'Ketoconazole',
    '--output', path.relative(ROOT, outputPath),
  ]);
  let searches = 0;
  const client = {
    async requestJson(url) {
      if (new URL(url).pathname === '/REST/rxcui.json') {
        searches += 1;
        if (searches === 2) throw new Error('temporary upstream failure');
      }
      return fixtureClient().requestJson(url);
    },
  };
  await assert.rejects(
    buildMappingCandidates(options, { client, retrievedAt: '2026-07-26' }),
    /temporary upstream failure/i,
  );
  assert.equal(await fs.readFile(outputPath, 'utf8'), 'previous\n');
});

test('index-driven proposals require matching metadata and verify the full row count', async () => {
  const outputPath = tempOutput();
  const root = path.dirname(outputPath);
  const indexPath = path.join(root, 'ingredient-index.jsonl');
  const metadataPath = path.join(root, 'ingredient-index.meta.json');
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(indexPath, [
    JSON.stringify({ canonical_name: 'ketoconazole' }),
    JSON.stringify({ canonical_name: 'warfarin' }),
    '',
  ].join('\n'), 'utf8');
  await fs.writeFile(metadataPath, JSON.stringify({
    profile: 'internal-evaluation',
    ingredient_count: 2,
    source_counts: { 'github-jr': 2 },
  }), 'utf8');
  const options = parseArgs([
    '--profile', 'internal-evaluation',
    '--ingredient-index', path.relative(ROOT, indexPath),
    '--limit', '1',
    '--output', path.relative(ROOT, outputPath),
  ]);
  const result = await buildMappingCandidates(options, {
    client: fixtureClient(),
    retrievedAt: '2026-07-26',
  });
  assert.equal(result.candidate_count, 1);
  const [candidate] = (await fs.readFile(outputPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(candidate.assertion.canonical_name, 'ketoconazole');

  await fs.writeFile(metadataPath, JSON.stringify({
    profile: 'internal-evaluation',
    ingredient_count: 3,
    source_counts: { 'github-jr': 2 },
  }), 'utf8');
  await assert.rejects(
    buildMappingCandidates(options, {
      client: fixtureClient(),
      retrievedAt: '2026-07-26',
    }),
    /row count does not match metadata/i,
  );
});

test('index-driven proposals reject a profile mismatch before network access', async () => {
  const outputPath = tempOutput();
  const root = path.dirname(outputPath);
  const indexPath = path.join(root, 'ingredient-index.jsonl');
  const metadataPath = path.join(root, 'ingredient-index.meta.json');
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(indexPath, `${JSON.stringify({ canonical_name: 'warfarin' })}\n`, 'utf8');
  await fs.writeFile(metadataPath, JSON.stringify({
    profile: 'internal-evaluation',
    ingredient_count: 1,
    source_counts: { 'github-jr': 1 },
  }), 'utf8');
  const options = parseArgs([
    '--profile', 'production-open',
    '--ingredient-index', path.relative(ROOT, indexPath),
    '--limit', '1',
    '--output', 'data/interaction/production-open/rxnorm-mappings.jsonl',
  ]);
  let networkCalls = 0;
  await assert.rejects(
    buildMappingCandidates(options, {
      client: {
        async requestJson() {
          networkCalls += 1;
          throw new Error('network should not run');
        },
      },
      retrievedAt: '2026-07-26',
    }),
    /profile internal-evaluation does not match production-open/i,
  );
  assert.equal(networkCalls, 0);
});
