import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeProductQuery,
  productIdForRow,
  resolveProductQueries,
} from '../src/lib/product-resolver.mjs';

function withArtifact(lines, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-resolver-'));
  const artifact = path.join(dir, 'drugs.jsonl');
  fs.writeFileSync(artifact, `${lines.join('\n')}\n`);
  return Promise.resolve(run(artifact)).finally(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

const product = (over = {}) => ({
  brand_name: 'Same Brand 10 Tablet',
  manufacturer: 'Alpha Pharma Ltd',
  pack_label: 'strip of 10 tablets',
  form_raw: 'tablet',
  ingredients: [{ molecule: 'Example hydrochloride', strength_raw: '10mg' }],
  sources: [{ source: 'github-jr', source_id: '1', seen_at: '2026-07-10' }],
  ...over,
});

test('normalizeProductQuery accepts a brand string and structured disambiguators', () => {
  assert.deepEqual(normalizeProductQuery('  Same Brand 10 Tablet  '), {
    brand_name: 'Same Brand 10 Tablet',
    manufacturer: null,
    pack_label: null,
    form_raw: null,
    strengths: null,
  });
  assert.deepEqual(normalizeProductQuery({
    brand_name: 'Same Brand 10 Tablet',
    manufacturer: 'Alpha Pharma Ltd.',
    pack_label: 'Strip of 10 Tablets.',
    form_raw: 'Tablet',
    strengths: ['10 mg'],
  }), {
    brand_name: 'Same Brand 10 Tablet',
    manufacturer: 'Alpha Pharma Ltd.',
    pack_label: 'Strip of 10 Tablets.',
    form_raw: 'Tablet',
    strengths: ['10 mg'],
  });
  assert.throws(() => normalizeProductQuery({ manufacturer: 'Alpha' }), /brand_name/i);
  assert.throws(
    () => normalizeProductQuery({ brand_name: 'Same Brand 10 Tablet', manufactuer: 'Alpha' }),
    /unknown.*manufactuer/i,
  );
});

test('product IDs are stable across catalogue case and suffix variants', () => {
  assert.equal(
    productIdForRow(product()),
    productIdForRow(product({
      brand_name: 'same brand 10 tablet',
      manufacturer: 'Alpha Pharma',
      pack_label: 'Strip of 10 Tablets.',
    })),
  );
  assert.match(productIdForRow(product()), /^sha256:[a-f0-9]{64}$/u);
});

test('product IDs distinguish products with different ingredient strengths', () => {
  assert.notEqual(
    productIdForRow(product()),
    productIdForRow(product({
      ingredients: [{ molecule: 'Example hydrochloride', strength_raw: '20mg' }],
    })),
  );
});

test('exact brand resolves only when one product matches', async () => {
  await withArtifact([
    JSON.stringify(product()),
    JSON.stringify(product({ brand_name: 'Other Brand' })),
  ], async (artifactPath) => {
    const [result] = await resolveProductQueries({
      artifactPath,
      queries: ['same brand 10 tablet'],
    });
    assert.equal(result.status, 'resolved');
    assert.equal(result.product.product_id, productIdForRow(product()));
    assert.equal(result.product.manufacturer, 'Alpha Pharma Ltd');
    assert.equal(result.product.ingredients[0].molecule, 'Example hydrochloride');
  });
});

test('brand-only collisions are ambiguous and never auto-selected', async () => {
  await withArtifact([
    JSON.stringify(product()),
    JSON.stringify(product({ manufacturer: 'Beta Laboratories' })),
  ], async (artifactPath) => {
    const [result] = await resolveProductQueries({
      artifactPath,
      queries: ['Same Brand 10 Tablet'],
    });
    assert.equal(result.status, 'ambiguous');
    assert.equal(result.candidates.length, 2);
    assert.deepEqual(result.candidates.map((candidate) => candidate.manufacturer), [
      'Alpha Pharma Ltd',
      'Beta Laboratories',
    ]);
    assert.equal('product' in result, false);
  });
});

test('ambiguous candidates have deterministic composition ordering', async () => {
  const ten = product();
  const twenty = product({
    ingredients: [{ molecule: 'Example hydrochloride', strength_raw: '20mg' }],
  });
  const resolveStrengths = (rows) => withArtifact(rows.map(JSON.stringify), async (artifactPath) => {
    const [result] = await resolveProductQueries({
      artifactPath,
      queries: ['Same Brand 10 Tablet'],
    });
    return result.candidates.map((candidate) => candidate.ingredients[0].strength_raw);
  });
  assert.deepEqual(await resolveStrengths([ten, twenty]), ['10mg', '20mg']);
  assert.deepEqual(await resolveStrengths([twenty, ten]), ['10mg', '20mg']);
});

test('manufacturer, pack and form disambiguators are exact normalized filters', async () => {
  await withArtifact([
    JSON.stringify(product()),
    JSON.stringify(product({
      manufacturer: 'Beta Laboratories',
      pack_label: 'bottle of 30 tablets',
    })),
  ], async (artifactPath) => {
    const [result] = await resolveProductQueries({
      artifactPath,
      queries: [{
        brand_name: 'same brand 10 tablet',
        manufacturer: 'alpha pharma',
        pack_label: 'strip of 10 tablets',
        form_raw: 'TABLET',
      }],
    });
    assert.equal(result.status, 'resolved');
    assert.equal(result.product.manufacturer, 'Alpha Pharma Ltd');
  });
});

test('an exact ingredient strength set can disambiguate otherwise identical products', async () => {
  await withArtifact([
    JSON.stringify(product()),
    JSON.stringify(product({
      ingredients: [{ molecule: 'Example hydrochloride', strength_raw: '20mg' }],
    })),
  ], async (artifactPath) => {
    const [result] = await resolveProductQueries({
      artifactPath,
      queries: [{ brand_name: 'Same Brand 10 Tablet', strengths: ['10 mg'] }],
    });
    assert.equal(result.status, 'resolved');
    assert.equal(result.product.ingredients[0].strength_raw, '10mg');
  });
});

test('missing products are explicit unresolved inputs', async () => {
  await withArtifact([JSON.stringify(product())], async (artifactPath) => {
    const [result] = await resolveProductQueries({
      artifactPath,
      queries: ['Not Present'],
    });
    assert.deepEqual(result, {
      input: {
        brand_name: 'Not Present',
        manufacturer: null,
        pack_label: null,
        form_raw: null,
        strengths: null,
      },
      status: 'unresolved',
      reason: 'no_exact_product_match',
    });
  });
});

test('malformed artifact JSON fails loudly with a line number', async () => {
  await withArtifact([
    JSON.stringify(product()),
    '{not-json}',
  ], async (artifactPath) => {
    await assert.rejects(
      resolveProductQueries({ artifactPath, queries: ['Same Brand 10 Tablet'] }),
      /line 2/i,
    );
  });
});
