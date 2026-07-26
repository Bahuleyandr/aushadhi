# Section H — licence-safe citation worksheet

Machine evidence: **24** records across **19** rules.

- JSONL SHA-256: `0daf3e31f9fbb296266f47662f0351e08c2b0aa74af86e46a1fec443e02c49b6`
- Schema validation: `validateDraftRules` passes; evidence and member
  allowlists remain frozen and every rule remains `promotion_eligible:false`.

Excluded or rights-unclear sources are not linked, quoted, summarized, or represented as machine evidence.

## rifampicin__hormonal_contraceptive

- runtime_enabled: `false`
- machine_evidence: `2`
- evidence `dailymed-rifampin-b389b1a3-v1-contraception`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`b389b1a3-672f-47e3-916c-4a9c044b211b@1`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22b389b1a3-672f-47e3-916c-4a9c044b211b%22&limit=100
- evidence `openfda-nexplanon-487f8a62-v13-rifamycin`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`487f8a62-e142-457c-97cc-2e398fde7594@13`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22487f8a62-e142-457c-97cc-2e398fde7594%22&limit=100

## rifabutin__etonogestrel_implant

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `openfda-nexplanon-487f8a62-v13-rifamycin`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`487f8a62-e142-457c-97cc-2e398fde7594@13`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22487f8a62-e142-457c-97cc-2e398fde7594%22&limit=100

## enzyme_inducing_antiepileptic__hormonal_contraceptive

- runtime_enabled: `false`
- machine_evidence: `2`
- evidence `dailymed-tegretol-8d409411-v37-contraception`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`8d409411-aa9f-4f3a-a52c-fbcb0c3ec053@37`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%228d409411-aa9f-4f3a-a52c-fbcb0c3ec053%22&limit=100
- evidence `openfda-nexplanon-487f8a62-v13-antiepileptics`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`487f8a62-e142-457c-97cc-2e398fde7594@13`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22487f8a62-e142-457c-97cc-2e398fde7594%22&limit=100

## phenytoin__etonogestrel_implant

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `openfda-nexplanon-487f8a62-v13-antiepileptics`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`487f8a62-e142-457c-97cc-2e398fde7594@13`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22487f8a62-e142-457c-97cc-2e398fde7594%22&limit=100

## rifampicin__calcineurin_inhibitor

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `dailymed-prograf-7f667de1-v30-rifampin`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`7f667de1-9dfa-4bd6-8ba0-15ee2d78873b@30`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%227f667de1-9dfa-4bd6-8ba0-15ee2d78873b%22&limit=100
- gap: Open-evidence gap: ciclosporin and mTOR-inhibitor branches require separate licence-cleared evidence.

## rifampicin__verapamil

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `dailymed-verapamil-e36e485f-v6-rifampin`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`e36e485f-fbed-4e30-9a63-984931f2e54e@6`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22e36e485f-fbed-4e30-9a63-984931f2e54e%22&limit=100

## rifampicin__systemic_corticosteroid

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `dailymed-solu-medrol-7271310c-v12-rifampin`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`7271310c-7764-4812-aa30-a5e90987c7a9@12`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%227271310c-7764-4812-aa30-a5e90987c7a9%22&limit=100
- gap: Open-evidence gap: no other corticosteroid or formulation is represented.

## rifampicin__sulfonylurea

- runtime_enabled: `false`
- machine_evidence: `2`
- evidence `dailymed-rifampin-b389b1a3-v1-sulfonylureas`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`b389b1a3-672f-47e3-916c-4a9c044b211b@1`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22b389b1a3-672f-47e3-916c-4a9c044b211b%22&limit=100
- evidence `dailymed-glimepiride-fc9d8495-v2-rifampin`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`fc9d8495-184c-3af1-e053-6394a90a5e29@2`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22fc9d8495-184c-3af1-e053-6394a90a5e29%22&limit=100
- gap: Open-evidence gap: no additional sulfonylurea member is represented.

## rifampicin__antiretroviral

- runtime_enabled: `false`
- machine_evidence: `2`
- evidence `dailymed-rifampin-b389b1a3-v1-antiretrovirals`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`b389b1a3-672f-47e3-916c-4a9c044b211b@1`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22b389b1a3-672f-47e3-916c-4a9c044b211b%22&limit=100
- evidence `dailymed-tivicay-63df5af3-v31-rifampin`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`63df5af3-b8ac-4e76-9830-2dbb340af922@31`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%2263df5af3-b8ac-4e76-9830-2dbb340af922%22&limit=100
- gap: Open-evidence gap: no other antiretroviral member is represented by retained evidence.

## carbamazepine__calcineurin_inhibitor

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `dailymed-prograf-7f667de1-v30-carbamazepine`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`7f667de1-9dfa-4bd6-8ba0-15ee2d78873b@30`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%227f667de1-9dfa-4bd6-8ba0-15ee2d78873b%22&limit=100
- gap: Open-evidence gap: ciclosporin and mTOR-inhibitor branches require separate licence-cleared evidence.

## carbamazepine__warfarin

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `dailymed-warfarin-724b0061-v19-carbamazepine`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`724b0061-f42a-4008-a078-09c800ee9785@19`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22724b0061-f42a-4008-a078-09c800ee9785%22&limit=100

## carbamazepine__verapamil

- runtime_enabled: `false`
- machine_evidence: `2`
- evidence `dailymed-verapamil-e36e485f-v6-carbamazepine`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`e36e485f-fbed-4e30-9a63-984931f2e54e@6`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22e36e485f-fbed-4e30-9a63-984931f2e54e%22&limit=100
- evidence `dailymed-tegretol-8d409411-v37-verapamil`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`8d409411-aa9f-4f3a-a52c-fbcb0c3ec053@37`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%228d409411-aa9f-4f3a-a52c-fbcb0c3ec053%22&limit=100

## carbamazepine__systemic_corticosteroid

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `dailymed-solu-medrol-7271310c-v12-carbamazepine`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`7271310c-7764-4812-aa30-a5e90987c7a9@12`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%227271310c-7764-4812-aa30-a5e90987c7a9%22&limit=100
- gap: Open-evidence gap: no other corticosteroid or formulation is represented.

## carbamazepine__sulfonylurea

- runtime_enabled: `false`
- machine_evidence: `2`
- evidence `dailymed-tegretol-8d409411-v37-negative-sulfonylurea-boundary`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`8d409411-aa9f-4f3a-a52c-fbcb0c3ec053@37`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%228d409411-aa9f-4f3a-a52c-fbcb0c3ec053%22&limit=100
- evidence `dailymed-glimepiride-fc9d8495-v2-negative-carbamazepine-boundary`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`fc9d8495-184c-3af1-e053-6394a90a5e29@2`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22fc9d8495-184c-3af1-e053-6394a90a5e29%22&limit=100

## carbamazepine__antiretroviral

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `dailymed-tivicay-63df5af3-v31-carbamazepine`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`63df5af3-b8ac-4e76-9830-2dbb340af922@31`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%2263df5af3-b8ac-4e76-9830-2dbb340af922%22&limit=100
- gap: Open-evidence gap: no other antiretroviral member is represented by retained evidence.

## carbamazepine__valproate

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `dailymed-tegretol-8d409411-v37-valproate`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`8d409411-aa9f-4f3a-a52c-fbcb0c3ec053@37`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%228d409411-aa9f-4f3a-a52c-fbcb0c3ec053%22&limit=100

## carbamazepine__lamotrigine

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `dailymed-lamictal-d7e3572d-v44-carbamazepine`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`d7e3572d-56fe-4727-2bb4-013ccca22678@44`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22d7e3572d-56fe-4727-2bb4-013ccca22678%22&limit=100

## st_johns_wort__cyp3a4_pgp_substrate

- runtime_enabled: `false`
- machine_evidence: `0`
- gap: Open-evidence gap: obtain a licence-cleared authoritative source before runtime enablement.

## st_johns_wort__calcineurin_inhibitor

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `dailymed-neoral-94461af3-v29-st-johns-wort`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`94461af3-11f1-4670-95d4-2965b9538ae3@29`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%2294461af3-11f1-4670-95d4-2965b9538ae3%22&limit=100
- gap: Open-evidence gap: tacrolimus requires separate licence-cleared evidence.
