import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateIngredientMappingManifest,
  validateProductPresentationManifest,
} from '../src/lib/interaction-mapping.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readManifest(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data-static', name), 'utf8'));
}

test('committed ingredient mappings contain only the two approved exact identities', () => {
  const manifest = readManifest('ingredient-mapping-overrides.json');
  assert.equal(validateIngredientMappingManifest(manifest), true);
  assert.deepEqual(
    manifest.mappings.map((mapping) => ({
      mapping_id: mapping.mapping_id,
      assertion_id: mapping.assertion.ingredient_id,
      assertion_name: mapping.assertion.canonical_name,
      clinical_ingredient_id: mapping.identity.clinical_ingredient_id,
      clinical_name: mapping.identity.canonical_name,
      runtime_drug: mapping.identity.runtime_drug,
      relationship: mapping.identity.relationship,
      rxnorm: mapping.identity.rxnorm,
      unii: mapping.identity.unii,
      review_status: mapping.review.status,
      reviewer_id: mapping.review.reviewer_id,
      reviewed_at: mapping.review.reviewed_at,
      evidence: mapping.review.evidence,
    })),
    [
      {
        mapping_id: 'ingredient:amiodarone:rxnorm-703',
        assertion_id: 'sha256:817ad85b37a6bcf67237e7936edbefb6cde6363267e6fa378a1089048f596b8a',
        assertion_name: 'amiodarone',
        clinical_ingredient_id: 'sha256:817ad85b37a6bcf67237e7936edbefb6cde6363267e6fa378a1089048f596b8a',
        clinical_name: 'amiodarone',
        runtime_drug: 'amiodarone',
        relationship: 'exact',
        rxnorm: {
          rxcui: '703',
          name: 'amiodarone',
          tty: 'IN',
          version: '06-Jul-2026',
          api_version: '3.1.354',
          response_sha256: 'ce4700b8786fca189454d731b761a21194bc53f1fd7ccde1dd6764147ce6ad15',
        },
        unii: {
          code: 'N3RQ532IUT',
          preferred_name: 'amiodarone',
          response_sha256: '39a640945784dcae592a68bddbb8f9cbfec716f3ef10f5d5299dce4fd115a408',
        },
        review_status: 'reviewed',
        reviewer_id: 'clinician:subas',
        reviewed_at: '2026-07-26',
        evidence: [
          {
            source_id: 'rxnorm',
            identifier: 'rxnorm-version:06-Jul-2026',
            source_url: 'https://rxnav.nlm.nih.gov/REST/version.json',
            retrieved_at: '2026-07-26',
            evidence_sha256: 'ec49ea5916116a33b6a443dcb80a7980d8049271e8dc96b4a2600efeb26811dd',
          },
          {
            source_id: 'rxnorm',
            identifier: 'rxnorm-search:amiodarone',
            source_url: 'https://rxnav.nlm.nih.gov/REST/rxcui.json?name=amiodarone&allsrc=0&search=0',
            retrieved_at: '2026-07-26',
            evidence_sha256: '3ceaabd9af02155d7037adf298f94300406ed27df3042f57362082dc2f2d11ea',
          },
          {
            source_id: 'rxnorm',
            identifier: 'rxcui:703',
            source_url: 'https://rxnav.nlm.nih.gov/REST/rxcui/703/properties.json',
            retrieved_at: '2026-07-26',
            evidence_sha256: 'ce4700b8786fca189454d731b761a21194bc53f1fd7ccde1dd6764147ce6ad15',
          },
          {
            source_id: 'rxnorm',
            identifier: 'unii:N3RQ532IUT',
            source_url: 'https://rxnav.nlm.nih.gov/REST/Prescribe/rxcui/703/property.json?propName=UNII_CODE',
            retrieved_at: '2026-07-26',
            evidence_sha256: '39a640945784dcae592a68bddbb8f9cbfec716f3ef10f5d5299dce4fd115a408',
          },
        ],
      },
      {
        mapping_id: 'ingredient:warfarin:rxnorm-11289',
        assertion_id: 'sha256:2ec225c652eabf57f4297ab503a1aee5d450c03f721033270bd09c1290a0cd06',
        assertion_name: 'warfarin',
        clinical_ingredient_id: 'sha256:2ec225c652eabf57f4297ab503a1aee5d450c03f721033270bd09c1290a0cd06',
        clinical_name: 'warfarin',
        runtime_drug: 'warfarin',
        relationship: 'exact',
        rxnorm: {
          rxcui: '11289',
          name: 'warfarin',
          tty: 'IN',
          version: '06-Jul-2026',
          api_version: '3.1.354',
          response_sha256: '95cb01ad34d80ee4a0acd53df8c357f6441ff3462694009be068f5a0fb3f8ab2',
        },
        unii: {
          code: '5Q7ZVV76EI',
          preferred_name: 'warfarin',
          response_sha256: '4fb3ba52b164a889b5b6da6513dd1b30c538c369c8765da502115f356c350e64',
        },
        review_status: 'reviewed',
        reviewer_id: 'clinician:subas',
        reviewed_at: '2026-07-26',
        evidence: [
          {
            source_id: 'rxnorm',
            identifier: 'rxnorm-version:06-Jul-2026',
            source_url: 'https://rxnav.nlm.nih.gov/REST/version.json',
            retrieved_at: '2026-07-26',
            evidence_sha256: 'ec49ea5916116a33b6a443dcb80a7980d8049271e8dc96b4a2600efeb26811dd',
          },
          {
            source_id: 'rxnorm',
            identifier: 'rxnorm-search:warfarin',
            source_url: 'https://rxnav.nlm.nih.gov/REST/rxcui.json?name=warfarin&allsrc=0&search=0',
            retrieved_at: '2026-07-26',
            evidence_sha256: 'b4898af7cfcebcfb69ce54469b5c30bec0cd98676598cc4e53db773fe92f4f9e',
          },
          {
            source_id: 'rxnorm',
            identifier: 'rxcui:11289',
            source_url: 'https://rxnav.nlm.nih.gov/REST/rxcui/11289/properties.json',
            retrieved_at: '2026-07-26',
            evidence_sha256: '95cb01ad34d80ee4a0acd53df8c357f6441ff3462694009be068f5a0fb3f8ab2',
          },
          {
            source_id: 'rxnorm',
            identifier: 'unii:5Q7ZVV76EI',
            source_url: 'https://rxnav.nlm.nih.gov/REST/Prescribe/rxcui/11289/property.json?propName=UNII_CODE',
            retrieved_at: '2026-07-26',
            evidence_sha256: '4fb3ba52b164a889b5b6da6513dd1b30c538c369c8765da502115f356c350e64',
          },
        ],
      },
    ],
  );
  assert.ok(manifest.mappings.every((mapping) => (
    mapping.review.status === 'reviewed'
    && mapping.review.evidence.length === 4
    && mapping.review.evidence.every((evidence) => evidence.source_id === 'rxnorm')
  )));
});

test('committed product presentation mappings remain empty pending evidence review', () => {
  const manifest = readManifest('product-presentation-overrides.json');
  assert.equal(validateProductPresentationManifest(manifest), true);
  assert.deepEqual(manifest.mappings, []);
});
