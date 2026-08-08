# Six warfarin production-open clinician sign-off subjects

Status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

This package replaces the six placeholder approval drafts dated 2026-08-07. It contains six exact, hash-bound clinical subjects, six template-only approval-event schemas, and a pinned SSH signing profile for `clinician:subas`. It creates no approval or runtime authority by itself.

| Rule | Exact pairs | Approval subject JCS SHA-256 |
|---|---:|---|
| `warfarin__amiodarone` | 6 | `e04f91fc956bd492a722d64c8dd2e3e6a41255617e114bae371b5655bc36a69c` |
| `warfarin__clarithromycin_oral` | 3 | `57b85839df951e2dd365ebd42fc6487dbc333c189e8b7cbca763c37753658490` |
| `warfarin__fluconazole` | 9 | `5e112007e186dc03078c8a5fca1b29ea763c743dea0b8674ac529b0acb82bc09` |
| `warfarin__ketoconazole_oral` | 3 | `a768395d2ecd989b451fc8781653de91437e4b187e7cf00dcc177edbf7e032b0` |
| `warfarin__metronidazole` | 6 | `271a33b8415a70c06697062cfbcfa8d753db72f87c3f067c74dbef817bf570d0` |
| `warfarin__voriconazole` | 3 | `a076564057edbcf96ef2467d2459dcf883ce6f8d86fda09e374aadedcff12bb4` |

The shared scope uses three exact Warf oral-tablet products and 10 exact perpetrator products, for 13 unique products and 30 explicitly enumerated pairs. Product identifiers and assertion hashes are re-derived by the package validator, which also hashes the bound production-open catalogue artifact and proves that every source identity resolves to exactly one matching row. Every product records normalized ingredient, strength, route, formulation, and an explicit release-profile boundary. The selected identities were independently cross-checked against the private June 2026 India Drug Extension; licensed terminology identifiers or descriptions are deliberately not copied into this open package.

This is revision 2. Do not sign or reuse any revision 1 subject hash. Revision 2 excludes the fluconazole dispersible tablet, records evidence-to-product extrapolations, binds exact-product and checker-workflow boundaries, and gives every authenticated approval a non-extendable 180-day validity period.

## Important separation of decisions

A clinician signature approves only the clinical content and exact proposed product scope in that subject. It does not authorize runtime loading, publication, production, deployment, or clinical use. The `github-jr` catalogue source-rights decision remains separate and unresolved, so even six valid signatures cannot release the package publicly.

The `clinical_content_base` field records the inherited rule/evidence baseline. The immutable approval event must separately record the exact repository HEAD reviewed at signature time; this avoids misrepresenting the baseline commit as the signed implementation commit.

The repository records an authenticated decision with `npm run approvals:record-production-open`. That command signs the canonical event with the pinned clinician SSH key, verifies the detached signature before writing, and creates new files exclusively under `approval-events/`; it never mutates a template or an earlier event.

Follow [SIGN-OFF-CHECKLIST.md](SIGN-OFF-CHECKLIST.md) exactly. Do not modify a canonical subject after review; any material change creates a new revision and requires a new signature.
