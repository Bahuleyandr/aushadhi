# Section J — licence-safe citation worksheet

Machine evidence: **21** records across **12** rules.

- JSONL SHA-256: `8a00848ed4985907a350042861f3933a8fdbe352a4460ed1dc7929d7723e628f`
- Schema validation: `validateDraftRules` passes; evidence and member
  allowlists remain frozen and every rule remains `promotion_eligible:false`.

Excluded or rights-unclear sources are not linked, quoted, summarized, or represented as machine evidence.

## sulfonylurea__fluconazole

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `J-US01`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`f694c617-3383-416c-91b6-b94fda371204@57`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22f694c617-3383-416c-91b6-b94fda371204%22&limit=100
- gap: Open-evidence gap: gliclazide, glimepiride, chlorpropamide, and glibenclamide require independently licensed evidence.

## sulfonylurea__co_trimoxazole

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `J-US02`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`f0e73842-6002-43c2-97fc-0cadc1bf6346@12`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22f0e73842-6002-43c2-97fc-0cadc1bf6346%22&limit=100
- 2026-07-28 current payload SHA-256: `254015707829f4bb483857f676250dd424877fad067b55d76fcf5f2b84dd1cbd`; the retained fragment remains exact.
- gap: Open-evidence gap: only glipizide and glyburide are source-named runtime victims.

## sulfonylurea__gemfibrozil

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `J-US03`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`c48855b7-215e-453b-b3b1-a0f9dee7221f@23`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22c48855b7-215e-453b-b3b1-a0f9dee7221f%22&limit=100
- gap: Open-evidence gap: no glibenclamide synonym expansion is retained.

## sulfonylurea__alcohol

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `J-US04`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`bc8df889-25e0-49a0-bbec-a3dfae8bbb8a@1`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22bc8df889-25e0-49a0-bbec-a3dfae8bbb8a%22&limit=100
- gap: Open-evidence gap: no sulfonylurea other than glyburide is represented.

## sulfonylurea__miconazole_candidate

- runtime_enabled: `false`
- machine_evidence: `0`
- gap: Open-evidence gap: obtain a licence-cleared authoritative source before runtime enablement.

## metformin__iodinated_contrast_media

- runtime_enabled: `false`
- machine_evidence: `6`
- evidence `J-US06`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`4ac6d01a-af26-44e7-ae2e-3618de0080aa@17`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%224ac6d01a-af26-44e7-ae2e-3618de0080aa%22&limit=100
- 2026-07-26 current payload SHA-256: `3d254b9a5645496e888077b9b79472ba9f6896c6ec4655e952efa7501d27b4d9`; the qualifying-eGFR fragment is repinned to the current `mL/min/1.73 m 2` rendering.
- evidence `J-US07`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`eee15ebe-d349-4497-acef-6abe7a8247fb@19`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22eee15ebe-d349-4497-acef-6abe7a8247fb%22&limit=100
- evidence `J-US10`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`a216a7d5-3c28-482b-956a-93ae146e3763@3`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22a216a7d5-3c28-482b-956a-93ae146e3763%22&limit=100
- evidence `J-US08`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`ae8c18c9-3e7d-4515-b980-120025a88fc1@22`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22ae8c18c9-3e7d-4515-b980-120025a88fc1%22&limit=100
- evidence `J-US09`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`df917c3a-59a2-4ed1-8470-8a5394c73325@25`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22df917c3a-59a2-4ed1-8470-8a5394c73325%22&limit=100
- evidence `J-US11`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`7496d736-9f7d-4136-ad5d-b24c7803c21b@7`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%227496d736-9f7d-4136-ad5d-b24c7803c21b%22&limit=100

## thiopurine__allopurinol

- runtime_enabled: `false`
- machine_evidence: `2`
- evidence `J-US12`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`606101a0-6244-7eff-e053-2a91aa0acadd@6`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22606101a0-6244-7eff-e053-2a91aa0acadd%22&limit=100
- evidence `J-US13`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`c3b5b8b0-bc5c-4ce9-bbdc-febba60c2658@14`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22c3b5b8b0-bc5c-4ce9-bbdc-febba60c2658%22&limit=100

## theophylline__ciprofloxacin

- runtime_enabled: `false`
- machine_evidence: `2`
- evidence `J-US15`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`888dc7f9-ad9c-4c00-8d50-8ddfd9bd27c0@32`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22888dc7f9-ad9c-4c00-8d50-8ddfd9bd27c0%22&limit=100
- evidence `J-US14`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`b7a90ccf-9c32-40cc-9008-7e55b3da4dfd@5`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22b7a90ccf-9c32-40cc-9008-7e55b3da4dfd%22&limit=100

## theophylline__fluvoxamine

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `J-US16`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`a4e0212a-ce68-4466-a0e4-f87d5d9ff0b3@5`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22a4e0212a-ce68-4466-a0e4-f87d5d9ff0b3%22&limit=100

## theophylline__cimetidine

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `J-US14`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`b7a90ccf-9c32-40cc-9008-7e55b3da4dfd@5`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22b7a90ccf-9c32-40cc-9008-7e55b3da4dfd%22&limit=100

## theophylline__mexiletine

- runtime_enabled: `false`
- machine_evidence: `1`
- evidence `J-US14`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`b7a90ccf-9c32-40cc-9008-7e55b3da4dfd@5`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22b7a90ccf-9c32-40cc-9008-7e55b3da4dfd%22&limit=100

## potassium_chloride_solid_oral__gi_transit_slowing

- runtime_enabled: `false`
- machine_evidence: `4`
- evidence `J-US17`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`b3d4d5b5-2898-ae3d-e053-2a95a90a6d04@8`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22b3d4d5b5-2898-ae3d-e053-2a95a90a6d04%22&limit=100
- evidence `J-US18`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`02707146-331f-4511-a187-0152fc8bca85@7`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%2202707146-331f-4511-a187-0152fc8bca85%22&limit=100
- evidence `J-US20`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`3688227b-7655-40ca-b34b-073a39fd60f4@3`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%223688227b-7655-40ca-b34b-073a39fd60f4%22&limit=100
- evidence `J-US21`: policy=`openfda-labels`; use=`interaction-evidence`; licence=`CC0-1.0`; document=`ad8916e7-206e-409e-2582-30d072845dd4@31`; origin=https://api.fda.gov/drug/label.json?search=set_id%3A%22ad8916e7-206e-409e-2582-30d072845dd4%22&limit=100
