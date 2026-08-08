# Six warfarin production-open clinician sign-off subjects

Status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

This package replaces the six placeholder approval drafts dated 2026-08-07. It contains six exact, hash-bound clinical subjects, six template-only approval-event schemas, and a pinned SSH signing profile for `clinician:subas`. It creates no approval or runtime authority by itself.

| Rule | Exact pairs | Approval subject JCS SHA-256 |
|---|---:|---|
| `warfarin__amiodarone` | 6 | `7d09dd9e4c16518720ff782659bca39ec60caa49959f00ed97a6c3b6bb367a19` |
| `warfarin__clarithromycin_oral` | 3 | `138451759519a69975dd4d27d56ea0745d43cdeb322f821cffd984a8f40c3427` |
| `warfarin__fluconazole` | 9 | `0969a4685bcf2f26b206264df4e1baee16c5f6c2d5378259f096b392b701f8e6` |
| `warfarin__ketoconazole_oral` | 3 | `1cd31c8f9d658db48bcee9d9ff2ddf98166d126d5b7dfeb1fc468240f743f193` |
| `warfarin__metronidazole` | 6 | `191f2e13142af1c1a0de3fcd9fcdcb1d8cbc06805a6191fc3640356b34052eb3` |
| `warfarin__voriconazole` | 3 | `f923218ff498b0079761c88a41a1401fbfc409f253c91644f1a01142d36066e9` |

The shared scope uses three exact Warf oral-tablet products and 10 exact perpetrator products, for 13 unique products and 30 explicitly enumerated pairs. Product identifiers and assertion hashes are re-derived from a committed 13-row byte-exact source-binding capture. In the signing environment, the pre-signature verifier additionally rehashes the complete bound production-open catalogue and proves that every captured row occurs exactly at its recorded source line. Every product records normalized ingredient, strength, route, formulation, and an explicit release-profile boundary. The selected identities were independently cross-checked against the private June 2026 India Drug Extension; licensed terminology identifiers or descriptions are deliberately not copied into this open package.

This is revision 2. Do not sign or reuse any revision 1 subject hash. Revision 2 excludes the fluconazole dispersible tablet, records evidence-to-product extrapolations, binds exact-product and checker-workflow boundaries, and gives every authenticated approval a non-extendable 180-day validity period.

## Important separation of decisions

A clinician signature approves only the clinical content and exact proposed product scope in that subject. It does not authorize runtime loading, publication, production, deployment, or clinical use. The `github-jr` catalogue source-rights decision remains separate and unresolved, so even six valid signatures cannot release the package publicly.

The `clinical_content_base` field records the inherited rule/evidence baseline. The immutable approval event must separately record the exact repository HEAD reviewed at signature time; this avoids misrepresenting the baseline commit as the signed implementation commit.

The repository records an authenticated decision with `npm run approvals:record-production-open`. That command signs the canonical event with the pinned clinician SSH key, verifies the detached signature before writing, and creates new files exclusively under `approval-events/`; it never mutates a template or an earlier event.

Follow [SIGN-OFF-CHECKLIST.md](SIGN-OFF-CHECKLIST.md) exactly. Do not modify a canonical subject after review; any material change creates a new revision and requires a new signature.
