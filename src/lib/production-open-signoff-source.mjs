const reviewStatus = 'proposed_for_clinician_signature';
const presentation = Object.freeze({ route: 'oral', formulation: 'tablet' });

function product({
  sourceId,
  productId,
  assertionHash,
  brand,
  manufacturer,
  pack,
  drug,
  strength,
}) {
  return {
    mapping_id: `presentation:github-jr:${sourceId}:oral-tablet`,
    source_identity: { namespace: 'presentation:github-jr', code: sourceId },
    product_id: productId,
    product_assertion_sha256: assertionHash,
    product_assertion: {
      brand_name: brand,
      manufacturer,
      pack_label: pack,
      form_raw: null,
      ingredients: [{
        observed_name: drug,
        source_field: 'molecule',
        strength_raw: `${strength}mg`,
        strength_value: strength,
        strength_unit: 'mg',
      }],
    },
    presentation,
    review_status: reviewStatus,
  };
}

const warfarin = Object.freeze([
  product({
    sourceId: '241490',
    productId: 'sha256:75ff289ed3f39da43c77f97e8ff24ebc8f36636bad7879c25bad180cca8bd3e5',
    assertionHash: '8085504e2d8f147581025560310a71b943a33f792ed8d56dac1f71043326f34c',
    brand: 'Warf 1 Tablet',
    manufacturer: 'Cipla Ltd',
    pack: 'strip of 30 tablets',
    drug: 'warfarin',
    strength: 1,
  }),
  product({
    sourceId: '241458',
    productId: 'sha256:2c013c09d6880da492e3faefa06db996f9fc7bf9920751009b261f95c9ad3445',
    assertionHash: 'c1dcadfbfabb21f57e8deface7a90323f15b0e7946fe2265de245f7efdab0469',
    brand: 'Warf 2 Tablet',
    manufacturer: 'Cipla Ltd',
    pack: 'strip of 30 tablets',
    drug: 'warfarin',
    strength: 2,
  }),
  product({
    sourceId: '241434',
    productId: 'sha256:47bd772d5427882a321df9cc9f1cb5187c4b7e5476ea8cd6b4267bdc5f9d2c61',
    assertionHash: 'a8877c57f2158b4c40fa19a69aeab393bb4fb3d0cb9b699a83d70454d0820d26',
    brand: 'Warf 5 Tablet',
    manufacturer: 'Cipla Ltd',
    pack: 'strip of 30 tablets',
    drug: 'warfarin',
    strength: 5,
  }),
]);

const products = Object.freeze({
  warfarin,
  amiodarone: Object.freeze([
    product({
      sourceId: '215526',
      productId: 'sha256:996500ee7b3ed804cedc85d6c91add1f32724927c129113b83dcd1b857c7850d',
      assertionHash: 'e714fd7ca1fa36c08dc1c3b4514a6c9d4f222a5e053766ed71e0c728736f91c9',
      brand: 'Tachyra 100 Tablet',
      manufacturer: 'Cipla Ltd',
      pack: 'strip of 10 tablets',
      drug: 'amiodarone',
      strength: 100,
    }),
    product({
      sourceId: '215566',
      productId: 'sha256:4aa0b05104cde787b3fb864b024224e8827df25a6058c50863aaa25ef7270fff',
      assertionHash: '7e16ec6ba5a9563f9b0d562fba22debd0f7d8b867f2655a4c9faa74cfd2de9d4',
      brand: 'Tachyra 200 Tablet',
      manufacturer: 'Cipla Ltd',
      pack: 'strip of 10 tablets',
      drug: 'amiodarone',
      strength: 200,
    }),
  ]),
  clarithromycin: Object.freeze([
    product({
      sourceId: '34020',
      productId: 'sha256:7946bbb13a9d266e6e49ab1f14ecbeb729c27a460a213abc5d63fd6e4c0e1215',
      assertionHash: '3959539d3d591878278179c26c673333a98d56c7cf64b3d9d447254bd5705994',
      brand: 'Claribid 250 Tablet',
      manufacturer: 'Abbott',
      pack: 'strip of 10 tablets',
      drug: 'clarithromycin',
      strength: 250,
    }),
  ]),
  fluconazole: Object.freeze([
    product({
      sourceId: '85808',
      productId: 'sha256:2477c63ab7660346267abca33ba26fc4c72957e856fed56c7696193e4f5c6a31',
      assertionHash: 'e1128e2da73efefb283a21628393ee8802736bfc3af6ba5b1df363be6619eae7',
      brand: 'Faze 50mg Tablet DT',
      manufacturer: 'Megha Healthcare Pvt Ltd',
      pack: 'strip of 10 tablet dt',
      drug: 'fluconazole',
      strength: 50,
    }),
    product({
      sourceId: '84732',
      productId: 'sha256:7443b4093ef29b4b6f621780c7cd43be46506e5632b6d0ae28fc03fc5bdeae98',
      assertionHash: '9f186a8cad46b5dc934f3d9c54dacefcbab5d7e58bf623a2c3484090512e12dc',
      brand: 'Faze 150 Tablet',
      manufacturer: 'Megha Healthcare Pvt Ltd',
      pack: 'strip of 1 Tablet',
      drug: 'fluconazole',
      strength: 150,
    }),
    product({
      sourceId: '84894',
      productId: 'sha256:9a1c4698258e377490593db50e2abecaee7c9f29a4b9645500b182cc336dc9ae',
      assertionHash: '0bf426a31998bb880ab162a5c46dc9d5e78af61df615c341ce859f271e7443f1',
      brand: 'Faze 200mg Tablet',
      manufacturer: 'Megha Healthcare Pvt Ltd',
      pack: 'strip of 1 Tablet',
      drug: 'fluconazole',
      strength: 200,
    }),
    product({
      sourceId: '85708',
      productId: 'sha256:33820ca70d3fb5c81f60242e3f1c9263400827af9056e394a917e7473046c81a',
      assertionHash: '56e8f6931e21ff4b7644916225f54fd54a33fd7590ab9bd4e74a89dcd8367356',
      brand: 'Faze 400mg Tablet',
      manufacturer: 'Megha Healthcare Pvt Ltd',
      pack: 'strip of 1 Tablet',
      drug: 'fluconazole',
      strength: 400,
    }),
  ]),
  ketoconazole: Object.freeze([
    product({
      sourceId: '115796',
      productId: 'sha256:71be56f2af9d66533522960676a5f6a49ddcce720ef97885a069d5657a479ff7',
      assertionHash: '12068c30186fb59b795b2e198952466c4031a15dfe08636866460421d889453d',
      brand: 'Kenz Tablet',
      manufacturer: 'KLM Laboratories Pvt Ltd',
      pack: 'strip of 10 tablets',
      drug: 'ketoconazole',
      strength: 200,
    }),
  ]),
  metronidazole: Object.freeze([
    product({
      sourceId: '84136',
      productId: 'sha256:de1e08a2d44ccaa84c91a694d3c6b3cc87de519b06023855b6a20ff3b0618735',
      assertionHash: '834194c3b239c39f41c7f82ccc540bce874a07e0936595acb1f5f3d95daefdce',
      brand: 'Flagyl 200 Tablet',
      manufacturer: 'Abbott',
      pack: 'strip of 15 tablets',
      drug: 'metronidazole',
      strength: 200,
    }),
    product({
      sourceId: '84039',
      productId: 'sha256:471be4a70c9c0f503d78816031b1b8c4e71c0fe15a28d320dbc8375e557ee259',
      assertionHash: '43877d54c0d5d5838bdc9154ac9e7e8cd9ed1f210aa0a8900be218e6cc2ff1f9',
      brand: 'Flagyl 400 Tablet',
      manufacturer: 'Abbott',
      pack: 'strip of 15 tablets',
      drug: 'metronidazole',
      strength: 400,
    }),
  ]),
  voriconazole: Object.freeze([
    product({
      sourceId: '233405',
      productId: 'sha256:78f18feac48fff42940859159f17552a27e53129ab8e853206d8ae8bdb5fb808',
      assertionHash: 'd6c903e8c531bf2b3b6e0ef39a2b1c436bed6aa5c21db056bc6f1f82bedace45',
      brand: 'Voritek 200 Tablet',
      manufacturer: 'Cipla Ltd',
      pack: 'strip of 4 tablets',
      drug: 'voriconazole',
      strength: 200,
    }),
  ]),
});

const commonAuthorityBoundary = 'This clinical signature does not clear the pending github-jr source-rights gate and grants no runtime, publication, production, deployment, or clinical-use authority.';

export const productionOpenSignoffSource = Object.freeze({
  clinicalContentBase: '32726b8a54bc29e50d51021910c856b3a408cdf1',
  reviewerId: 'clinician:subas',
  rxnorm: Object.freeze({
    warfarin: '11289',
    amiodarone: '703',
    clarithromycin: '21212',
    fluconazole: '4450',
    ketoconazole: '6135',
    metronidazole: '6922',
    voriconazole: '121243',
  }),
  products,
  rules: Object.freeze([
    {
      ruleId: 'warfarin__amiodarone',
      perpetrator: 'amiodarone',
      draftRuleSha256: 'da731112748d90f672439d290b079f7ee2a90bb00c8b05c67110ec12509f485d',
      approvalStatement: `I approve the warfarin-amiodarone clinical rule content and exact product scope for production-open review, limited to the five enumerated open-catalogue oral-tablet assertions and 6 exact product pairs (Warf 1 mg, 2 mg, and 5 mg crossed with Tachyra 100 mg and 200 mg), as major severity with confirm-and-monitor management. The alert must require prescriber or anticoagulation-service warfarin dose review and PT/INR monitoring; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling and persistence for weeks to months after amiodarone discontinuation; keep the unsupported Child-Pugh modifier removed; treat the evidence as U.S.-label support rather than an Indian regulatory-label claim; and keep declared coverage partial. ${commonAuthorityBoundary} Reviewer ID: clinician:subas`,
    },
    {
      ruleId: 'warfarin__clarithromycin_oral',
      perpetrator: 'clarithromycin',
      draftRuleSha256: '33a01de9d7f556241de4be8fd9fcb76def45d51f7fa05c730bb7f2431b163499',
      approvalStatement: `I approve the warfarin-clarithromycin clinical rule content and exact product scope for production-open review, limited to the four enumerated open-catalogue oral-tablet assertions and 3 exact product pairs (Claribid 250 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. The prescriber or anticoagulation service must direct whether warfarin dose adjustment is needed and arrange PT/INR monitoring during concomitant use, with a clinician-directed follow-up decision when the course ends; the pharmacy must not change a dose or stop either medicine independently. Include bleeding-symptom counselling. Exclude 500 mg clarithromycin, erythromycin and other macrolides, combipacks, suspensions, injections, and all unreviewed presentations. Do not invent a universal monitoring schedule or fixed post-discontinuation interval. Treat the evidence as a U.S.-label statement rather than an Indian regulatory claim, and keep declared coverage partial. ${commonAuthorityBoundary} Reviewer ID: clinician:subas`,
    },
    {
      ruleId: 'warfarin__fluconazole',
      perpetrator: 'fluconazole',
      draftRuleSha256: '088bd06e472723bce36527b67d1c2b0d7c24694842c5929c25c1c4e693952f84',
      approvalStatement: `I approve the warfarin-fluconazole clinical rule content and exact product scope for production-open review, limited to the seven enumerated open-catalogue oral-tablet assertions and 12 exact product pairs (Faze 50 mg dispersible, 150 mg, 200 mg, and 400 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. The alert must require prescriber or anticoagulation-service warfarin dose review and PT/INR monitoring when fluconazole is started or stopped; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling and state that enzyme inhibition can persist 4 to 5 days after discontinuation without inventing a universal PT/INR schedule or a single-dose exception. Keep the unsupported Child-Pugh modifier removed, treat the evidence as U.S.-label support rather than an Indian regulatory-label claim, and keep declared coverage partial. ${commonAuthorityBoundary} Reviewer ID: clinician:subas`,
    },
    {
      ruleId: 'warfarin__ketoconazole_oral',
      perpetrator: 'ketoconazole',
      draftRuleSha256: '1657195ba626a2337c8b390679e64f32006c26fd758948560a4faf97875d8a3e',
      approvalStatement: `I approve the warfarin-ketoconazole clinical rule content and exact product scope for production-open review, limited to the four enumerated open-catalogue oral-tablet assertions and 3 exact product pairs (Kenz 200 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. The alert must require prescriber or anticoagulation-service warfarin dose review and PT/INR monitoring when oral ketoconazole is started or stopped; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling; exclude ketoconazole soap, lotion, shampoo, cream, and every other topical or unreviewed presentation; keep the unsupported Child-Pugh modifier removed; and do not invent a universal PT/INR schedule or fixed post-discontinuation interval. Treat the evidence as U.S.-label support rather than an Indian regulatory-label claim, and keep declared coverage partial. ${commonAuthorityBoundary} Reviewer ID: clinician:subas`,
    },
    {
      ruleId: 'warfarin__metronidazole',
      perpetrator: 'metronidazole',
      draftRuleSha256: '2f6e13a141107149c32c82df764a0710a423265e5600b35155ece4d53222df3f',
      approvalStatement: `I approve the warfarin-metronidazole clinical rule content and exact product scope for production-open review, limited to the five enumerated open-catalogue oral-tablet assertions and 6 exact product pairs (Flagyl 200 mg and 400 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. The alert must require prescriber or anticoagulation-service warfarin dose review and PT/INR monitoring when oral metronidazole is started or stopped; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling; exclude tinidazole, topical metronidazole, combination suspensions, and every other unreviewed presentation; keep the unsupported Child-Pugh modifier removed; and do not invent a universal PT/INR schedule or fixed post-discontinuation interval. Treat the evidence as U.S.-label support rather than an Indian regulatory-label claim, and keep declared coverage partial. ${commonAuthorityBoundary} Reviewer ID: clinician:subas`,
    },
    {
      ruleId: 'warfarin__voriconazole',
      perpetrator: 'voriconazole',
      draftRuleSha256: 'b8e0d94d6a94d2a765ff8690d9a9b4bff66c333747eeb2cc0bb57e2c95997cf8',
      approvalStatement: `I approve the warfarin-voriconazole clinical rule content and exact product scope for production-open review, limited to the four enumerated open-catalogue oral-tablet assertions and 3 exact product pairs (Voritek 200 mg crossed with Warf 1 mg, 2 mg, and 5 mg), as major severity with confirm-and-monitor management. The alert must require prescriber or anticoagulation-service warfarin dose review and prescriber-directed PT/INR monitoring when voriconazole is started or stopped; it must not direct the pharmacy to change a dose, stop either medicine independently, or mandate substitution to another antifungal. Include bleeding-symptom counselling; exclude intravenous and every other unreviewed presentation; keep the unsupported Child-Pugh modifier removed; and do not invent a universal PT/INR schedule or fixed post-discontinuation interval. Treat the evidence as U.S.-label support rather than an Indian regulatory-label claim, and keep declared coverage partial. ${commonAuthorityBoundary} Reviewer ID: clinician:subas`,
    },
  ]),
});
