import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapResolvedProducts,
  validateIngredientMappingManifest,
  validateProductPresentationManifest,
} from '../src/lib/interaction-mapping.mjs';
import {
  checkResolvedProducts,
  validateRulePack,
} from '../src/lib/interaction-checker.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readManifest(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data-static', name), 'utf8'));
}

test('committed ingredient mappings contain only the three approved exact identities', () => {
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
        mapping_id: 'ingredient:fluconazole:rxnorm-4450',
        assertion_id: 'sha256:37cc87b734ee49f5f3ad5773f44aa5089c4bc93ab4fb50bc53048e2b69416bd0',
        assertion_name: 'fluconazole',
        clinical_ingredient_id: 'sha256:37cc87b734ee49f5f3ad5773f44aa5089c4bc93ab4fb50bc53048e2b69416bd0',
        clinical_name: 'fluconazole',
        runtime_drug: 'fluconazole',
        relationship: 'exact',
        rxnorm: {
          rxcui: '4450',
          name: 'fluconazole',
          tty: 'IN',
          version: '06-Jul-2026',
          api_version: '3.1.354',
          response_sha256: '47532ee45ed034f9ef2fdd5ad1619b783a8e7529fe1c2e56e0257fc6eb1d5200',
        },
        unii: {
          code: '8VZV102JFY',
          preferred_name: 'fluconazole',
          response_sha256: '83cd6141875c11974b38feb2110ccb1ec55c5ac6f563c5190679ee3ee2534b9c',
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
            identifier: 'rxnorm-search:fluconazole',
            source_url: 'https://rxnav.nlm.nih.gov/REST/rxcui.json?name=fluconazole&allsrc=0&search=0',
            retrieved_at: '2026-07-26',
            evidence_sha256: '613592116a78cb88eb2c85e7b2aec0f158f71535c5cbbbdeb0b95a0cb3383536',
          },
          {
            source_id: 'rxnorm',
            identifier: 'rxcui:4450',
            source_url: 'https://rxnav.nlm.nih.gov/REST/rxcui/4450/properties.json',
            retrieved_at: '2026-07-26',
            evidence_sha256: '47532ee45ed034f9ef2fdd5ad1619b783a8e7529fe1c2e56e0257fc6eb1d5200',
          },
          {
            source_id: 'rxnorm',
            identifier: 'unii:8VZV102JFY',
            source_url: 'https://rxnav.nlm.nih.gov/REST/Prescribe/rxcui/4450/property.json?propName=UNII_CODE',
            retrieved_at: '2026-07-26',
            evidence_sha256: '83cd6141875c11974b38feb2110ccb1ec55c5ac6f563c5190679ee3ee2534b9c',
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

const approvedProducts = [
  {
    mapping_id: 'presentation:pmbjp:1502:oral-tablet',
    product_id: 'sha256:5eaf19c6b773adf00509d55047b68d226ba2d80f1141402677f5e211b2caf186',
    product_assertion_sha256: 'e3a48df03852887ec4d09d5a7f12cd559aabbd2e2c23dc91388e0acaa0f1a9f5',
    drug: 'amiodarone',
    product: {
      brand_name: 'Amiodarone Tablets IP 100 mg',
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: "10's",
      form_raw: null,
      ingredients: [{
        molecule: 'amiodarone',
        strength_raw: '100 mg',
        strength_value: 100,
        strength_unit: 'mg',
      }],
      sources: [{ source: 'janaushadhi', source_id: '1502' }],
    },
    evidence: [
      ['janaushadhi', 'pmbjp-live-product:1502', 'a3dcb04da9304087eda6d5d7e78c04ca91efe1e8890daad09d1a53b254054bde'],
      ['janaushadhi', 'pmbjp-tender:RC-222/2025:1502:page-69', '47670d2b6f7daaa96afcca49c955a19fb1d3901f51f69c676624dd5b596f53ff'],
      ['rxnorm', 'rxnorm-version:06-Jul-2026', 'ec49ea5916116a33b6a443dcb80a7980d8049271e8dc96b4a2600efeb26811dd'],
      ['rxnorm', 'rxnorm-search:amiodarone-100-mg-oral-tablet', 'e6224b96a3a844b256fc186d0d0d1775a8e0ef8e6a796f4e765b8ae9440e9317'],
      ['rxnorm', 'rxcui:835956', 'f1b639d1d78172ff40f80a65957537cf4d4c5a4ca901c0776a41026d2703e605'],
    ],
  },
  {
    mapping_id: 'presentation:pmbjp:430:oral-tablet',
    product_id: 'sha256:6c6694d33f35f51e843d4aaf3a4914fb738f2baaf7d1f5494f6db6c638536626',
    product_assertion_sha256: 'afb937ecb1feaeaaca3e286233f74ca6d3ccb70e69bdb926152615617252ed0d',
    drug: 'amiodarone',
    product: {
      brand_name: 'Amiodarone Tablets IP 200 mg',
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: "10's",
      form_raw: null,
      ingredients: [{
        molecule: 'amiodarone',
        strength_raw: '200 mg',
        strength_value: 200,
        strength_unit: 'mg',
      }],
      sources: [{ source: 'janaushadhi', source_id: '430' }],
    },
    evidence: [
      ['janaushadhi', 'pmbjp-live-product:430', '40b97388913f33ec04bda7aa454dd020105e84e713b39632062e4950be457d0d'],
      ['janaushadhi', 'pmbjp-tender:RC-221/2025:430:page-62', 'c885a7b5f438678cd25956f16eb070a44880dd7219ad8f0c46319f2b22113f15'],
      ['rxnorm', 'rxnorm-version:06-Jul-2026', 'ec49ea5916116a33b6a443dcb80a7980d8049271e8dc96b4a2600efeb26811dd'],
      ['rxnorm', 'rxnorm-search:amiodarone-200-mg-oral-tablet', '3981ff78bf6c153528d1106f55cbd21841c2d2968c9cdee3ca8be7affb72a4b3'],
      ['rxnorm', 'rxcui:833528', '3d2d73c805085af9398ddb07f1d66d43de77fbc9cd7a822160b4404de12afea5'],
    ],
  },
  {
    mapping_id: 'presentation:pmbjp:2141:oral-tablet',
    product_id: 'sha256:d5c2e164ff5144544a122908b964b144e2132b9ff216a66bb3a57b80b944ffca',
    product_assertion_sha256: 'ed9ac49f1fe53f1f4c720641ad5e1bee54ed362e69e4357f36ffeab9022e76cb',
    drug: 'warfarin',
    product: {
      brand_name: 'Warfarin Tablets IP 1mg',
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: "10's",
      form_raw: null,
      ingredients: [{
        molecule: 'warfarin',
        strength_raw: '1mg',
        strength_value: 1,
        strength_unit: 'mg',
      }],
      sources: [{ source: 'janaushadhi', source_id: '2141' }],
    },
    evidence: [
      ['janaushadhi', 'pmbjp-live-product:2141', 'a64f78f9e2a459e161195ca1bd411dcb343abe224545cad09bb8428896d9798d'],
      ['janaushadhi', 'pmbjp-tender:RC-222/2025:2141:page-75', '47670d2b6f7daaa96afcca49c955a19fb1d3901f51f69c676624dd5b596f53ff'],
      ['rxnorm', 'rxnorm-version:06-Jul-2026', 'ec49ea5916116a33b6a443dcb80a7980d8049271e8dc96b4a2600efeb26811dd'],
      ['rxnorm', 'rxnorm-search:warfarin-sodium-1-mg-oral-tablet', '62e6d118ea7a045b36e29e22dc35d0f6f411714a0d12fd363a0f0101c1af1243'],
      ['rxnorm', 'rxcui:855288', '7dd6469d6c779c1fcdcfe07efd521763b833de34087222831634849545a5caac'],
    ],
  },
  {
    mapping_id: 'presentation:pmbjp:2142:oral-tablet',
    product_id: 'sha256:9570b79daed31dd5271ec2021558be191fddfe4e3d1002e66a3383dc1a309548',
    product_assertion_sha256: '13e88c7899c9974b4fd1378a47b2b09fa3045199460a02f7b7df6a7cb787e6a5',
    drug: 'warfarin',
    product: {
      brand_name: 'Warfarin Tablets IP 2mg',
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: "10's",
      form_raw: null,
      ingredients: [{
        molecule: 'warfarin',
        strength_raw: '2mg',
        strength_value: 2,
        strength_unit: 'mg',
      }],
      sources: [{ source: 'janaushadhi', source_id: '2142' }],
    },
    evidence: [
      ['janaushadhi', 'pmbjp-live-product:2142', '3592b1209ef58fb7ff94b1f8fb3f2f8ddd1d1f401815b5ac571cca37b93936e9'],
      ['janaushadhi', 'pmbjp-tender:RC-208/2023:2142:page-68', '96421b547f246cb43c13608bd9253954a2a4085f81b5927c53dc5ec2c8a49ec9'],
      ['rxnorm', 'rxnorm-version:06-Jul-2026', 'ec49ea5916116a33b6a443dcb80a7980d8049271e8dc96b4a2600efeb26811dd'],
      ['rxnorm', 'rxnorm-search:warfarin-sodium-2-mg-oral-tablet', 'b6c0b19b9eeab72f64a6e244ad492347c5acc086b4a09961f3d96d9cf810cf08'],
      ['rxnorm', 'rxcui:855302', '33f3548cce7ca8d437702f7015d1c5e1a6971d89db9ba538eb4bc4e0f209d214'],
    ],
  },
  {
    mapping_id: 'presentation:pmbjp:452:oral-tablet',
    product_id: 'sha256:a543d303907ce3804debf1784653e97b30ef00f4eebb040d8e89fbfbbfbf4141',
    product_assertion_sha256: '7aaa9f346fd2bb665c97551bcfd57bc6c088b5dcb91019769360364014f48b01',
    drug: 'warfarin',
    product: {
      brand_name: 'Warfarin Tablets IP 5 mg',
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: "10's",
      form_raw: null,
      ingredients: [{
        molecule: 'warfarin',
        strength_raw: '5 mg',
        strength_value: 5,
        strength_unit: 'mg',
      }],
      sources: [{ source: 'janaushadhi', source_id: '452' }],
    },
    evidence: [
      ['janaushadhi', 'pmbjp-live-product:452', '02242bcefd369f6079f9b270cf69ed89983c8c2c5c17111700054a4052d96f4d'],
      ['janaushadhi', 'pmbjp-tender:RC-156/2020:452:page-63', 'ba7e538a03d7fc74901b0871a1091a686fdd2a71f950874221549ba7440a750b'],
      ['rxnorm', 'rxnorm-version:06-Jul-2026', 'ec49ea5916116a33b6a443dcb80a7980d8049271e8dc96b4a2600efeb26811dd'],
      ['rxnorm', 'rxnorm-search:warfarin-sodium-5-mg-oral-tablet', '7d7268f9618bde780dbedc9564a9651c46beb8e2549731bca8956e67fd429879'],
      ['rxnorm', 'rxcui:855332', 'cd3b9c133ea6e273c771ac30790755b07e0d771d642d2b6e214959e0685b3db7'],
    ],
  },
  {
    mapping_id: 'presentation:pmbjp:1246:oral-tablet',
    product_id: 'sha256:36c4c3041de7320c6bab438d11649fbed5c05348f9a821a7b60524a77fe1882e',
    product_assertion_sha256: 'db7af4f8f150ecd174e7e444529d0e3ea166025134b6e68eff7436f4a305296f',
    drug: 'fluconazole',
    product: {
      brand_name: 'Fluconazole Tablets IP 150 mg',
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: "1's",
      form_raw: null,
      ingredients: [{
        molecule: 'fluconazole',
        strength_raw: '150 mg',
        strength_value: 150,
        strength_unit: 'mg',
      }],
      sources: [{ source: 'janaushadhi', source_id: '1246' }],
    },
    evidence: [
      ['janaushadhi', 'pmbjp-tender:RC-222/2025:1246:pdf-page-69', '47670d2b6f7daaa96afcca49c955a19fb1d3901f51f69c676624dd5b596f53ff'],
      ['rxnorm', 'rxnorm-search:fluconazole-150-mg-oral-tablet', 'bcf5693e0b6ae1c6146ec3aee938d0411ae8a97b9fc463eaeb300c8407b648b1'],
      ['rxnorm', 'rxcui:197699', '20d9ae89ab50b86a3e050d3f6584e6269bfafe36e6b0ff934cab0970c8bc67f8'],
    ],
  },
  {
    mapping_id: 'presentation:pmbjp:2771:oral-tablet',
    product_id: 'sha256:7a10b77f1e3fe2826287663ebbaac467e22a2760236e1130d6e24056193ea1e1',
    product_assertion_sha256: '94ecc3673fd6332ae543ff268685b14e847447ddbe2678bc7692e5c11a0f07a0',
    drug: 'fluconazole',
    product: {
      brand_name: 'Fluconazole Tablets IP 50 mg',
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: "4's",
      form_raw: null,
      ingredients: [{
        molecule: 'fluconazole',
        strength_raw: '50 mg',
        strength_value: 50,
        strength_unit: 'mg',
      }],
      sources: [{ source: 'janaushadhi', source_id: '2771' }],
    },
    evidence: [
      ['janaushadhi', 'pmbjp-tender:RC-213/2024:2771:page-95', '9be3607e49a8cf47b6c9d6c54f34a02a38988546b94bdf863b2518150d0a1bda'],
      ['rxnorm', 'rxnorm-search:fluconazole-50-mg-oral-tablet', '69f978c34a7d2d866b503cbe34b70e9de991463815ee908519d2a76eb7409e09'],
      ['rxnorm', 'rxcui:197701', '58fde9055852dce3cf5cfadfb355a4449649f78a3f68544e935dd7da21504836'],
    ],
  },
  {
    mapping_id: 'presentation:pmbjp:2772:oral-tablet',
    product_id: 'sha256:29bb5bbb4f23f5e02f1b3a83555ea3b577de0f5ae1b49ae0b8ba81e62b128381',
    product_assertion_sha256: '7b9fffd9797b6a11c0ec0802a288c32ac95f9b4c854b6d62e0ec470a61fbc793',
    drug: 'fluconazole',
    product: {
      brand_name: 'Fluconazole Tablets IP 200 mg',
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: "4's",
      form_raw: null,
      ingredients: [{
        molecule: 'fluconazole',
        strength_raw: '200 mg',
        strength_value: 200,
        strength_unit: 'mg',
      }],
      sources: [{ source: 'janaushadhi', source_id: '2772' }],
    },
    evidence: [
      ['janaushadhi', 'pmbjp-tender:RC-213/2024:2772:page-95', '9be3607e49a8cf47b6c9d6c54f34a02a38988546b94bdf863b2518150d0a1bda'],
      ['rxnorm', 'rxnorm-search:fluconazole-200-mg-oral-tablet', '8623b49cfe2b3534e15acd62b8135f6e3dd832e01cc7f44499e5ec5cc9c3f43e'],
      ['rxnorm', 'rxcui:197700', '78c0dff0d9af6a18d4f74521f561141a2ecfe3335fa078c23eb021641ff777e1'],
    ],
  },
  {
    mapping_id: 'presentation:pmbjp:2773:oral-tablet',
    product_id: 'sha256:552bfd4142fa6a39f2fd53b7f45ad98c31073250899eb5509e6a4c7962b465c1',
    product_assertion_sha256: 'b43f0509aebac0bc0021079be2e8375735e69feffbd59c76131447bd8f1dad9c',
    drug: 'fluconazole',
    product: {
      brand_name: 'Fluconazole Tablets IP 400 mg',
      manufacturer: 'PMBJP (Jan Aushadhi)',
      pack_label: "1's",
      form_raw: null,
      ingredients: [{
        molecule: 'fluconazole',
        strength_raw: '400 mg',
        strength_value: 400,
        strength_unit: 'mg',
      }],
      sources: [{ source: 'janaushadhi', source_id: '2773' }],
    },
    evidence: [
      ['janaushadhi', 'pmbjp-tender:RC-213/2024:2773:page-95', '9be3607e49a8cf47b6c9d6c54f34a02a38988546b94bdf863b2518150d0a1bda'],
      ['rxnorm', 'rxnorm-exact-search:no-active-concept', '8a2600ea692ce58930504a533e4f62ed942a645d3804eef4013503d9498df6d5'],
    ],
  },
];

function approvedRecords() {
  return approvedProducts.map((entry) => ({
    input: { brand_name: entry.product.brand_name },
    status: 'resolved',
    product: {
      ...structuredClone(entry.product),
      product_id: entry.product_id,
    },
  }));
}

test('committed product presentation mappings contain only the nine approved PMBJP rows', () => {
  const presentationManifest = readManifest('product-presentation-overrides.json');
  const ingredientManifest = readManifest('ingredient-mapping-overrides.json');
  assert.equal(validateProductPresentationManifest(presentationManifest), true);
  assert.deepEqual(
    presentationManifest.mappings.map((mapping) => ({
      mapping_id: mapping.mapping_id,
      product_id: mapping.product_id,
      product_assertion_sha256: mapping.product_assertion_sha256,
      allowed_profiles: mapping.allowed_profiles,
      presentation: mapping.presentation,
      review_status: mapping.review.status,
      reviewer_id: mapping.review.reviewer_id,
      reviewed_at: mapping.review.reviewed_at,
      evidence: mapping.review.evidence.map((evidence) => [
        evidence.source_id,
        evidence.identifier,
        evidence.evidence_sha256,
      ]),
    })),
    approvedProducts.map((entry) => ({
      mapping_id: entry.mapping_id,
      product_id: entry.product_id,
      product_assertion_sha256: entry.product_assertion_sha256,
      allowed_profiles: ['internal-evaluation'],
      presentation: { route: 'oral', formulation: 'tablet' },
      review_status: 'reviewed',
      reviewer_id: 'clinician:subas',
      reviewed_at: '2026-07-26',
      evidence: entry.evidence,
    })),
  );

  const records = approvedRecords();
  const mappedInternal = mapResolvedProducts({
    records,
    ingredientManifest,
    presentationManifest,
    profile: 'internal-evaluation',
  });
  assert.deepEqual(
    mappedInternal.map((record) => ({
      presentation: record.product.presentation,
      runtime_subject: record.product.ingredients[0].runtime_subject,
    })),
    approvedProducts.map((entry) => ({
      presentation: {
        status: 'reviewed_override',
        mapping_id: entry.mapping_id,
        product_assertion_sha256: entry.product_assertion_sha256,
        route: 'oral',
        formulation: 'tablet',
      },
      runtime_subject: {
        drug: entry.drug,
        route: 'oral',
        formulation: 'tablet',
      },
    })),
  );

  const mappedProduction = mapResolvedProducts({
    records,
    ingredientManifest,
    presentationManifest,
    profile: 'production-open',
  });
  assert.ok(mappedProduction.every((record) => (
    record.product.presentation.status === 'unmapped'
    && record.product.ingredients[0].runtime_subject === null
  )));
});

test('the internal warfarin-amiodarone rule fires only for the six approved PMBJP product pairs', () => {
  const ingredientManifest = readManifest('ingredient-mapping-overrides.json');
  const presentationManifest = readManifest('product-presentation-overrides.json');
  const internalPack = readManifest('interaction-rules.internal-evaluation.json');
  const productionPack = readManifest('interaction-rules.json');
  assert.equal(validateRulePack(internalPack), true);
  assert.equal(validateRulePack(productionPack), true);
  assert.equal(internalPack.profile, 'internal-evaluation');
  assert.equal(internalPack.declared_coverage, 'partial');
  assert.equal(internalPack.rules.length, 2);
  assert.deepEqual(productionPack.rules, []);
  assert.equal(productionPack.declared_coverage, 'unknown');

  const approvedRule = internalPack.rules.find(
    (rule) => rule.rule_id === 'warfarin__amiodarone',
  );
  assert.equal(approvedRule.severity, 'major');
  assert.equal(approvedRule.dispense_action, 'confirm_and_monitor');
  assert.equal(approvedRule.review.reviewer_id, 'clinician:subas');
  assert.equal(approvedRule.product_pairs.length, 6);
  assert.match(approvedRule.management, /prescriber or anticoagulation service/i);
  assert.match(approvedRule.management, /PT\/INR monitoring/i);
  assert.match(approvedRule.management, /Do not independently stop either established medicine/i);
  assert.match(approvedRule.management, /weeks to months/i);
  assert.match(approvedRule.management, /bleeding or bruising/i);
  assert.doesNotMatch(JSON.stringify(approvedRule), /Child-Pugh|hepatic impairment/i);
  assert.ok(approvedRule.evidence.every((item) => item.jurisdiction === 'US'));

  const mappedInternal = mapResolvedProducts({
    records: approvedRecords(),
    ingredientManifest,
    presentationManifest,
    profile: 'internal-evaluation',
  });
  const amiodarone = mappedInternal.filter((record) => (
    record.product.ingredients[0].runtime_subject.drug === 'amiodarone'
  ));
  const warfarin = mappedInternal.filter((record) => (
    record.product.ingredients[0].runtime_subject.drug === 'warfarin'
  ));
  const observedProductPairs = [];

  for (const first of amiodarone) {
    for (const second of warfarin) {
      const result = checkResolvedProducts({
        resolvedInputs: [first, second],
        rulePack: internalPack,
      });
      assert.equal(result.reviewed_findings.length, 1);
      assert.equal(result.reviewed_findings[0].rule_id, 'warfarin__amiodarone');
      assert.equal(result.reviewed_findings[0].dispense_action, 'confirm_and_monitor');
      assert.equal(result.checked_pairs.length, 1);
      assert.equal(result.unresolved_inputs.length, 0);
      assert.equal(result.coverage.presentation_mapping, 'complete');
      observedProductPairs.push(result.checked_pairs[0].product_pairs[0]);

      const reversed = checkResolvedProducts({
        resolvedInputs: [second, first],
        rulePack: internalPack,
      });
      assert.deepEqual(reversed.checked_pairs, result.checked_pairs);
      assert.deepEqual(reversed.reviewed_findings, result.reviewed_findings);
    }
  }
  assert.deepEqual(observedProductPairs.sort(), approvedRule.product_pairs);

  const unapprovedProduct = structuredClone(warfarin[0]);
  unapprovedProduct.product.product_id = 'sha256:unapproved-warfarin-product';
  const unapproved = checkResolvedProducts({
    resolvedInputs: [amiodarone[0], unapprovedProduct],
    rulePack: internalPack,
  });
  assert.equal(unapproved.checked_pairs.length, 1);
  assert.deepEqual(unapproved.reviewed_findings, []);

  const stalePresentation = structuredClone(amiodarone[0]);
  stalePresentation.product.presentation.status = 'stale';
  stalePresentation.product.ingredients[0].runtime_subject = null;
  const stale = checkResolvedProducts({
    resolvedInputs: [stalePresentation, warfarin[0]],
    rulePack: internalPack,
  });
  assert.deepEqual(stale.checked_pairs, []);
  assert.deepEqual(stale.reviewed_findings, []);
  assert.equal(stale.unresolved_inputs[0].status, 'stale_presentation');

  const mappedProduction = mapResolvedProducts({
    records: approvedRecords(),
    ingredientManifest,
    presentationManifest,
    profile: 'production-open',
  });
  const productionAttempt = checkResolvedProducts({
    resolvedInputs: [mappedProduction[0], mappedProduction[2]],
    rulePack: internalPack,
  });
  assert.deepEqual(productionAttempt.checked_pairs, []);
  assert.deepEqual(productionAttempt.reviewed_findings, []);
});

test('the internal warfarin-fluconazole rule fires only for the 12 approved PMBJP product pairs', () => {
  const ingredientManifest = readManifest('ingredient-mapping-overrides.json');
  const presentationManifest = readManifest('product-presentation-overrides.json');
  const internalPack = readManifest('interaction-rules.internal-evaluation.json');
  const productionPack = readManifest('interaction-rules.json');
  const approvedRule = internalPack.rules.find(
    (rule) => rule.rule_id === 'warfarin__fluconazole',
  );

  assert.equal(validateRulePack(internalPack), true);
  assert.equal(validateRulePack(productionPack), true);
  assert.equal(approvedRule.severity, 'major');
  assert.equal(approvedRule.dispense_action, 'confirm_and_monitor');
  assert.equal(approvedRule.review.reviewer_id, 'clinician:subas');
  assert.equal(approvedRule.product_pairs.length, 12);
  assert.match(approvedRule.management, /prescriber or anticoagulation service/iu);
  assert.match(approvedRule.management, /PT\/INR monitoring/iu);
  assert.match(approvedRule.management, /started or stopped/iu);
  assert.match(approvedRule.management, /4 to 5 days/iu);
  assert.match(approvedRule.management, /bleeding or bruising/iu);
  assert.match(approvedRule.management, /do not establish a single-dose exception/iu);
  assert.doesNotMatch(
    JSON.stringify(approvedRule),
    /Child-Pugh|Indian regulatory-label claim/iu,
  );
  assert.ok(approvedRule.evidence.every((item) => item.jurisdiction === 'US'));

  const mappedInternal = mapResolvedProducts({
    records: approvedRecords(),
    ingredientManifest,
    presentationManifest,
    profile: 'internal-evaluation',
  });
  const fluconazole = mappedInternal.filter((record) => (
    record.product.ingredients[0].runtime_subject.drug === 'fluconazole'
  ));
  const warfarin = mappedInternal.filter((record) => (
    record.product.ingredients[0].runtime_subject.drug === 'warfarin'
  ));
  const observedProductPairs = [];

  for (const first of fluconazole) {
    for (const second of warfarin) {
      const result = checkResolvedProducts({
        resolvedInputs: [first, second],
        rulePack: internalPack,
      });
      assert.equal(result.reviewed_findings.length, 1);
      assert.equal(result.reviewed_findings[0].rule_id, 'warfarin__fluconazole');
      assert.equal(result.reviewed_findings[0].dispense_action, 'confirm_and_monitor');
      assert.equal(result.checked_pairs.length, 1);
      assert.equal(result.unresolved_inputs.length, 0);
      assert.equal(result.coverage.presentation_mapping, 'complete');
      observedProductPairs.push(result.checked_pairs[0].product_pairs[0]);

      const reversed = checkResolvedProducts({
        resolvedInputs: [second, first],
        rulePack: internalPack,
      });
      assert.deepEqual(reversed.checked_pairs, result.checked_pairs);
      assert.deepEqual(reversed.reviewed_findings, result.reviewed_findings);
    }
  }
  assert.deepEqual(observedProductPairs.sort(), approvedRule.product_pairs);

  const unapprovedProduct = structuredClone(fluconazole[0]);
  unapprovedProduct.product.product_id = 'sha256:unapproved-fluconazole-product';
  const unapproved = checkResolvedProducts({
    resolvedInputs: [unapprovedProduct, warfarin[0]],
    rulePack: internalPack,
  });
  assert.equal(unapproved.checked_pairs.length, 1);
  assert.deepEqual(unapproved.reviewed_findings, []);

  const fourHundred = presentationManifest.mappings.find(
    (mapping) => mapping.mapping_id === 'presentation:pmbjp:2773:oral-tablet',
  );
  assert.ok(fourHundred.review.evidence.some(
    (evidence) => evidence.identifier === 'rxnorm-exact-search:no-active-concept',
  ));

  const mappedProduction = mapResolvedProducts({
    records: approvedRecords(),
    ingredientManifest,
    presentationManifest,
    profile: 'production-open',
  });
  const productionAttempt = checkResolvedProducts({
    resolvedInputs: [mappedProduction[5], mappedProduction[2]],
    rulePack: internalPack,
  });
  assert.deepEqual(productionAttempt.checked_pairs, []);
  assert.deepEqual(productionAttempt.reviewed_findings, []);
});
