import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertArtifactProvenance,
  assertSourceAllowed,
  assertSourcesAllowed,
  loadSourceManifest,
} from '../src/lib/interaction-source-policy.mjs';

const PRODUCTION_PATH = 'data/interaction/production-open/evidence-candidates.jsonl';
const INTERNAL_PATH = 'data/interaction/internal-evaluation/ingredient-index.jsonl';

function allowed(manifest, sourceId, overrides = {}) {
  return assertSourceAllowed(manifest, {
    sourceId,
    profile: 'production-open',
    use: 'interaction-evidence',
    storagePath: PRODUCTION_PATH,
    ...overrides,
  });
}

test('loads and validates the committed source manifest', () => {
  const manifest = loadSourceManifest();
  assert.equal(manifest.schema_version, 1);
  assert.deepEqual(Object.keys(manifest.profiles).sort(), [
    'internal-evaluation',
    'production-open',
  ]);
  assert.ok(manifest.sources['openfda-labels']);
  assert.ok(manifest.sources['onemg-live']);
  assert.ok(manifest.sources['ddinter-2']);
  assert.equal(manifest.sources['ddinter-2'].enabled, false);
});

test('allows verified open evidence sources in production-open', () => {
  const manifest = loadSourceManifest();
  const source = allowed(manifest, 'openfda-labels');
  assert.equal(source.licence.id, 'CC0-1.0');

  assert.doesNotThrow(() => allowed(manifest, 'rxnorm', { use: 'identity' }));
  assert.doesNotThrow(() => allowed(manifest, 'fda-gsrs-unii', { use: 'identity' }));
  assert.doesNotThrow(() => allowed(manifest, 'aushadhi-open-clinician-rules', {
    use: 'interaction-rules',
    storagePath: 'data-static/interaction-rules.json',
  }));
});

test('allows the current catalogue provenance only in internal-evaluation', () => {
  const manifest = loadSourceManifest();
  const sources = [
    'github-jr',
    'janaushadhi',
    'onemg-live',
  ];

  const resolved = assertSourcesAllowed(manifest, {
    sourceIds: sources,
    profile: 'internal-evaluation',
    use: 'ingredient-index',
    storagePath: INTERNAL_PATH,
  });

  assert.deepEqual(resolved.map((source) => source.id), sources);
});

test('fails closed for an unknown profile', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'openfda-labels', { profile: 'staging' }),
    /unknown interaction source profile.*staging/i,
  );
});

test('fails closed for an unknown source', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'not-in-the-manifest'),
    /unknown interaction source.*not-in-the-manifest/i,
  );
});

test('fails closed for an unknown or unverified licence', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'unknown-source-example'),
    /licen[cs]e.*unknown|unknown.*licen[cs]e/i,
  );

  const changed = structuredClone(manifest);
  changed.sources['openfda-labels'].licence.verification_status = 'unknown';
  changed.sources['openfda-labels'].licence.verified_at = null;
  assert.throws(
    () => allowed(changed, 'openfda-labels'),
    /licen[cs]e.*unknown|unknown.*licen[cs]e/i,
  );
  assert.throws(
    () => allowed(manifest, 'kaggle-2025', {
      profile: 'internal-evaluation',
      use: 'ingredient-index',
      storagePath: INTERNAL_PATH,
    }),
    /licen[cs]e.*unknown|unknown.*licen[cs]e/i,
  );
});

test('rejects malformed manifests before evaluating policy', () => {
  const manifest = loadSourceManifest();
  const malformed = structuredClone(manifest);
  malformed.sources['openfda-labels'].licence.class = 'probably-open';
  const unknownLicence = structuredClone(manifest);
  unknownLicence.sources['openfda-labels'].licence.id = 'MADE-UP-LICENCE';

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-source-policy-'));
  const file = path.join(dir, 'manifest.json');
  try {
    fs.writeFileSync(file, JSON.stringify(malformed));
    assert.throws(() => loadSourceManifest(file), /invalid source manifest.*licen[cs]e class/i);
    fs.writeFileSync(file, JSON.stringify(unknownLicence));
    assert.throws(() => loadSourceManifest(file), /invalid source manifest.*unknown licen[cs]e id/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('forbids restricted sources in production-open', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'onemg-live', { use: 'ingredient-index' }),
    /onemg-live.*production-open/i,
  );
  assert.throws(
    () => allowed(manifest, 'janaushadhi', { use: 'ingredient-index' }),
    /janaushadhi.*production-open/i,
  );
});

test('requires restricted internal sources to stay in their storage zone', () => {
  const manifest = loadSourceManifest();
  assert.doesNotThrow(() => allowed(manifest, 'onemg-live', {
    profile: 'internal-evaluation',
    use: 'ingredient-index',
    storagePath: INTERNAL_PATH,
  }));
  assert.throws(
    () => allowed(manifest, 'onemg-live', {
      profile: 'internal-evaluation',
      use: 'ingredient-index',
      storagePath: 'data/interaction/production-open/ingredient-index.jsonl',
    }),
    /onemg-live.*storage zone/i,
  );
  assert.throws(
    () => allowed(manifest, 'onemg-live', {
      profile: 'internal-evaluation',
      use: 'ingredient-index',
      storagePath: 'data/interaction/internal-evaluation/../production-open/leak.jsonl',
    }),
    /onemg-live.*storage zone/i,
  );
});

test('enforces source-specific allowed uses', () => {
  const manifest = loadSourceManifest();
  assert.doesNotThrow(() => allowed(manifest, 'drugcentral', {
    use: 'identity',
    storagePath: 'data/interaction/production-open/drugcentral-sharealike/mappings.jsonl',
  }));
  assert.throws(
    () => allowed(manifest, 'drugcentral', {
      use: 'interaction-evidence',
      storagePath: 'data/interaction/production-open/drugcentral-sharealike/evidence.jsonl',
    }),
    /drugcentral.*interaction-evidence/i,
  );
});

test('keeps conditional CDCI/SNOMED data user-supplied and out of open artifacts', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'cdci-snomed-ct', { use: 'identity' }),
    /cdci-snomed-ct.*production-open/i,
  );
  assert.doesNotThrow(() => allowed(manifest, 'cdci-snomed-ct', {
    profile: 'internal-evaluation',
    use: 'identity',
    storagePath: 'data/restricted/cdci/mappings.jsonl',
  }));
});

test('keeps DDInter disabled even for internal evaluation', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => allowed(manifest, 'ddinter-2', {
      profile: 'internal-evaluation',
      storagePath: 'data/restricted/ddinter/snapshot.csv',
    }),
    /ddinter-2.*disabled.*tls.*sha-256/i,
  );
});

test('forbids ingestion from manual checker websites in every profile', () => {
  const manifest = loadSourceManifest();
  for (const sourceId of [
    'drugs-com-manual',
    'medscape-manual',
    'webmd-manual',
    'drugbank-web-manual',
  ]) {
    assert.throws(
      () => allowed(manifest, sourceId),
      new RegExp(`${sourceId}.*ingestion forbidden`, 'i'),
    );
  }
});

test('rejects mixed production provenance containing a restricted source', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      sourceIds: ['openfda-labels', 'onemg-live'],
      profile: 'production-open',
      use: 'interaction-evidence',
      storagePath: PRODUCTION_PATH,
    }),
    /onemg-live.*production-open/i,
  );
});

test('validates a mixed internal artifact and marks it non-redistributable', () => {
  const manifest = loadSourceManifest();
  const result = assertArtifactProvenance(manifest, {
    sourceIds: ['github-jr', 'onemg-live'],
    profile: 'internal-evaluation',
    use: 'ingredient-index',
    storagePath: INTERNAL_PATH,
  });

  assert.deepEqual(result.source_ids, ['github-jr', 'onemg-live']);
  assert.equal(result.redistributable, false);
  assert.equal(result.artifact_pack, 'internal-restricted');
});

test('allows the current dist product artifact only as internal provenance', () => {
  const manifest = loadSourceManifest();
  const sourceIds = [
    'github-jr',
    'janaushadhi',
    'onemg-live',
  ];
  const result = assertArtifactProvenance(manifest, {
    sourceIds,
    profile: 'internal-evaluation',
    use: 'product-resolution',
    storagePath: 'dist/latest/drugs.jsonl',
  });
  assert.equal(result.redistributable, false);
  assert.equal(result.artifact_pack, 'internal-restricted');

  assert.throws(
    () => assertArtifactProvenance(manifest, {
      sourceIds,
      profile: 'internal-evaluation',
      use: 'ingredient-index',
      storagePath: 'dist/latest/ingredient-index.jsonl',
    }),
    /storage zone/i,
  );

  assert.throws(
    () => assertArtifactProvenance(manifest, {
      sourceIds,
      profile: 'production-open',
      use: 'product-resolution',
      storagePath: 'dist/latest/drugs.jsonl',
    }),
    /storage zone|production-open/i,
  );
});

test('requires the separate share-alike zone for DrugCentral-derived artifacts', () => {
  const manifest = loadSourceManifest();
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      sourceIds: ['rxnorm', 'drugcentral'],
      profile: 'production-open',
      use: 'identity',
      storagePath: 'data/interaction/production-open/mappings.jsonl',
    }),
    /drugcentral.*storage zone/i,
  );

  const result = assertArtifactProvenance(manifest, {
    sourceIds: ['rxnorm', 'drugcentral'],
    profile: 'production-open',
    use: 'identity',
    storagePath: 'data/interaction/production-open/drugcentral-sharealike/mappings.jsonl',
  });
  assert.equal(result.artifact_pack, 'drugcentral-sharealike');
  assert.equal(result.redistributable, true);
});

test('rejects empty, duplicate, and malformed artifact provenance', () => {
  const manifest = loadSourceManifest();
  const options = {
    profile: 'production-open',
    use: 'identity',
    storagePath: 'data/interaction/production-open/ingredient-index.jsonl',
  };

  assert.throws(
    () => assertArtifactProvenance(manifest, { ...options, sourceIds: [] }),
    /at least one source/i,
  );
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      ...options,
      sourceIds: ['rxnorm', 'rxnorm'],
    }),
    /duplicate source.*rxnorm/i,
  );
  assert.throws(
    () => assertArtifactProvenance(manifest, {
      ...options,
      sourceIds: ['rxnorm', { source: '' }],
    }),
    /source id/i,
  );
});
