# Warfarin-azithromycin and tramadol PMBJP review packet

Date: 2026-07-27

Status: awaiting clinician review

Release profile: proposed for `internal-evaluation` only

Production-open status: disabled

This packet proposes two exact ingredient identities, four exact PMBJP
oral-tablet presentations, and two bounded clinical rules. Nothing in this
packet is a committed mapping or runtime promotion. The machine-readable
bindings are in
`docs/interaction-review/2026-07-27-warfarin-azithromycin-tramadol-review.json`.

## Ingredient identity candidates

| Observed ingredient | RxCUI | Term type | UNII | Local ingredient ID |
|---|---:|---|---|---|
| azithromycin | `18631` | `IN` | `F94OW58Y8V` | `sha256:a11cef0dcf59d647cc50aa3f94174e67599b079a0abc989a22ae61649ca2b783` |
| tramadol | `10689` | `IN` | `39J1LGJ30J` | `sha256:7d4536b14c06903f91096e57cf43df6161f83c9bd2ac24738ca1da7d2d4dafc7` |

Both live exact searches returned one active RxNorm ingredient concept in
release `06-Jul-2026`, API `3.1.354`. These are review candidates only.

## Product-presentation candidates

| PMBJP code | Exact local product assertion | Pack | Product assertion SHA-256 | Proposed presentation |
|---|---|---:|---|---|
| `18` | Azithromycin Tablets IP 250 mg | 6's | `8857d75b73ec7f1e2600928d0d601e8c283dbd177ea8081ec83f7d93f996286d` | oral tablet |
| `72` | Azithromycin Tablets IP 500 mg | 3's | `486892da381243eee3d79a37e4708e2b74e38d9c35ed0fe0fb409f5455fe5db3` | oral tablet |
| `28` | Tramadol Tablets 50mg | 10's | `4e2bfd35afcc31cdb65fadf293c6d5a39e2ecbf5ecf58b428889132cb6816630` | oral tablet |
| `521` | Tramadol Prolonged Release Tablets IP 100 mg | 10's | `ebb760346acbcc1945168a642a25ecb265326476fbd6a723aeb5edba3629b829` | oral tablet |

PMBI tenders `RC-219/2024`, `RC-221/2025`, and `RC-218/2024`
independently identify these exact codes, strengths, tablet forms, and unit
sizes. Live exact RxNorm searches returned active SCD concepts `308460`,
`248656`, `835603`, and `833709`, all explicitly named as oral tablets;
`833709` is the 24-hour extended-release presentation.

## Adversarial exclusions

The preserved catalogue contains twelve PMBJP assertions mentioning
azithromycin or tramadol. Only the four above are proposed.

- Code `48` is specifically excluded. The local assertion says a 10-tablet
  pack, but PMBI Amendment 2 to `RC-221/2025` changed the unit to 3 tablets
  and the pack to 3 x 10. Approving the local row would bind stale bytes.
- Azithromycin suspensions `47` and `1521` are excluded.
- Tramadol injections `26` and `27` are excluded.
- Combination products `510`, `1747`, and `2649` are excluded.
- No unreviewed product inherits an ingredient-level approval.

## Proposed clinical rules

| Rule | Interacting tablets | Warfarin tablets | Exact pairs | Proposed severity/action |
|---|---:|---:|---:|---|
| `warfarin__azithromycin_oral` | 2 | 3 | 6 | moderate / confirm-and-monitor |
| `warfarin__tramadol` | 2 | 3 | 6 | major / confirm-and-monitor |

Both draft rows are narrowed to oral tablets and remain runtime-disabled,
clinical-context-incomplete, and promotion-ineligible. Exact product pairs
would live only in a separate clinician-approved internal-evaluation
promotion.

The azithromycin proposal preserves the U.S. label's uncertainty: spontaneous
postmarketing reports suggest potentiation, while a dedicated
azithromycin-warfarin study did not change prothrombin time. It asks for a
prescriber/anticoagulation-service PT/INR plan during concomitant use and a
clinician-directed decision about follow-up when the course ends. It does not
invent a schedule or fixed post-discontinuation interval.

The tramadol proposal treats the MHRA Drug Safety Update as UK evidence. It
asks the prescriber/anticoagulation service to review whether warfarin dose
adjustment is needed and arrange additional PT/INR monitoring when tramadol is
started, with clinician-directed review when it is stopped. The pharmacy is
not directed to change a dose or stop either medicine independently.

## Evidence verification

- The Section A live verifier passed on 2026-07-27: 39/39 records, including
  37 openFDA records and both GOV.UK OGL records.
- The full assembler subsequently verified all 244 evidence records and
  rebuilt the 199-rule attested draft pack at SHA-256
  `42b50292f7bfc03398f4ac8c2916c77816cfe458e7a0c12c4ff8a89140df974a`.
- The azithromycin label binding remains set ID
  `db52b91e-79f7-4cc1-9564-f2eee8e31c45`, version 48.
- The tramadol binding remains the MHRA Drug Safety Update published
  2024-06-20 and versioned
  `2024-06-20T11:11:09+01:00`.
- PMBI evidence establishes product presentations only. It does not turn the
  U.S. azithromycin label or UK tramadol safety update into an Indian
  regulatory-label claim.

## Approval statements

Each statement is deliberately separate. Promotion remains blocked until all
four decisions are explicitly recorded with a reviewer ID.

### Ingredient identities

> I approve both ingredient identity mappings as exact: observed azithromycin to RxNorm ingredient RxCUI 18631, UNII F94OW58Y8V; and observed tramadol to RxNorm ingredient RxCUI 10689, UNII 39J1LGJ30J. Reviewer ID: clinician:subas

### Product presentations

> I approve all four product-presentation mappings as oral tablet for the exact PMBJP assertions in the 2026-07-27 warfarin-azithromycin-tramadol review packet: codes 18, 72, 28, and 521. This approval excludes stale azithromycin dispersible-tablet assertion code 48, azithromycin suspensions codes 47 and 1521, tramadol injections codes 26 and 27, tramadol combination products codes 510, 1747, and 2649, and every other unreviewed presentation. Reviewer ID: clinician:subas

### Warfarin-azithromycin clinical rule

> I approve the warfarin-azithromycin clinical rule for internal evaluation only, limited to the five reviewed PMBJP oral-tablet assertions (six cross-product combinations), as moderate severity with confirm-and-monitor management. The alert must require a prescriber/anticoagulation-service PT/INR monitoring plan during concomitant oral azithromycin use and a clinician-directed decision about follow-up when the course ends; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling; disclose that the U.S. label's signal is based on spontaneous postmarketing reports and that its dedicated azithromycin-warfarin study did not affect prothrombin time; exclude stale code 48, suspensions, dispersible tablets, and every other unreviewed or non-tablet presentation; do not invent a universal PT/INR schedule or fixed post-discontinuation interval; treat the evidence as U.S.-label support rather than an Indian regulatory-label claim; and keep production-open disabled. Reviewer ID: clinician:subas

### Warfarin-tramadol clinical rule

> I approve the warfarin-tramadol clinical rule for internal evaluation only, limited to the five reviewed PMBJP oral-tablet assertions (six cross-product combinations), as major severity with confirm-and-monitor management. The alert must require prescriber/anticoagulation-service review of whether warfarin dose adjustment is needed and additional PT/INR monitoring when oral tramadol is started, with a clinician-directed follow-up decision when tramadol is stopped; it must not direct the pharmacy to change a dose or stop either medicine independently. Include bleeding-symptom counselling and advice not to stop warfarin without consulting a healthcare professional; exclude injections, combination products, and every other unreviewed or non-tablet presentation; do not invent a universal PT/INR schedule or fixed post-discontinuation interval; treat the evidence as a UK MHRA safety update rather than a U.S. or Indian regulatory claim; and keep production-open disabled. Reviewer ID: clinician:subas
