# Six warfarin production-open clinician sign-off subjects

Status: **CLINICIAN SIGN-OFF READY — NOT SIGNED**

This package replaces the six placeholder approval drafts dated 2026-08-07. It contains six exact, hash-bound clinical subjects and six template-only approval-event schemas. It creates no approval or runtime authority by itself.

| Rule | Exact pairs | Approval subject JCS SHA-256 |
|---|---:|---|
| `warfarin__amiodarone` | 6 | `a8a2cd70061088590c6f5e1abb0d9c61d83ef5b166318534fcfdfef3a2b48c4d` |
| `warfarin__clarithromycin_oral` | 3 | `c923a892b79246cb022f47fdbaa78312b6bf0c0985a97cdeb232b0604becee60` |
| `warfarin__fluconazole` | 12 | `76db6061b232779da3a9af1a29619a895a4002c7a4d936a6605b6f3503e04f2b` |
| `warfarin__ketoconazole_oral` | 3 | `4d6db2035d5f6d1eca4d5a81c4118c826e590b88a4603f11cffa39b842e3a82f` |
| `warfarin__metronidazole` | 6 | `510b333396b09d12ead2af307494f1e818a8b3c95a066a7ac04fcf20d49665fd` |
| `warfarin__voriconazole` | 3 | `53d5a45c3c1127f0b9788885e8ef9c8240020ce059a902e4ea25e509c8f409cf` |

The shared scope uses three exact Warf oral-tablet products and 11 exact perpetrator products, for 14 unique products and 33 explicitly enumerated pairs. Product identifiers and assertion hashes are re-derived by the package validator. The selected brand, ingredient, strength, route, formulation, and supplier identities were independently cross-checked against the private June 2026 India Drug Extension; licensed terminology identifiers or descriptions are deliberately not copied into this open package.

## Important separation of decisions

A clinician signature approves only the clinical content and exact proposed product scope in that subject. It does not authorize runtime loading, publication, production, deployment, or clinical use. The `github-jr` catalogue source-rights decision remains separate and unresolved, so even six valid signatures cannot release the package publicly.

The `clinical_content_base` field records the inherited rule/evidence baseline. The immutable approval event must separately record the exact repository HEAD reviewed at signature time; this avoids misrepresenting the baseline commit as the signed implementation commit.

Follow [SIGN-OFF-CHECKLIST.md](SIGN-OFF-CHECKLIST.md) exactly. Do not modify a canonical subject after review; any material change creates a new revision and requires a new signature.
