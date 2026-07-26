# Curated High-Risk Interaction Rules — Approach + Draft Packet

- **Date:** 2026-07-22
- **Status:** Draft for review — supersedes the FDA-role "coverage layer" as the *first pharmacist-facing* deliverable (that work is deferred to an internal infrastructure spike per the second cross-review's NO-GO).
- **Branch:** `feat/interaction-evidence-coverage`

## 0. Honesty framing (non-negotiable)

- These rules are a **research-assisted DRAFT**, not clinical authority. An AI drafted them; **each must be verified, edited, and approved by clinicians** under the parent plan's **Task 7** (one clinician authors/curates, a second authorised clinician approves) before it is anything.
- Draft rules live in a **separate reviewable artifact** (`data/interaction/internal-evaluation/proposed-rules-for-review.jsonl`), **not** in the runtime `interaction-rules.json` and **not** shown to pharmacists, until approved. Approval converts a proposed rule into a `clinician_reviewed` entry in the shipped pack.
- Scope is deliberately **small and high-consequence** — a first batch of ~18–20 well-established, pair-specific, actionable interactions, not broad coverage.

## 1. Why this shape (vs the FDA-role layer)

The second cross-review's core point: a dispensing pharmacist needs *"drug A + drug B → this severity, do this"*, with pair-specific evidence — not an unknown-severity, null-management mechanistic hypothesis. So:

- **Rules are pair-specific and evidence-graded**, each citing current approved labeling or a major guideline (not FDA CYP-role class inference).
- They carry a real `severity` and **actionable `management`** (the field the hypothesis approach could not fill).
- The FDA role table + identity work become **curation aids** (e.g. to enumerate which strong CYP3A/P-gp inhibitors to list against colchicine) — not shipped artifacts.

## 2. Selection criteria for the first batch

Include a pair only if **all** hold: (a) consequence is serious/life-threatening or therapy-failing; (b) it is well-established in current approved labeling or a major guideline; (c) it is realistically encountered in Indian outpatient/community dispensing; (d) there is an actionable pharmacist step (avoid / space / monitor / refer). Prefer interactions where a **same-formulation substitution** (the dispensing context this project already serves) could introduce or resolve the interaction.

## 3. Proposed first batch (for clinician prioritisation — names + why, NOT final severities)

| # | Interaction | Consequence | Evidence anchor |
|---|---|---|---|
| 1 | Warfarin + NSAIDs (incl. COX-2) | GI/serious bleeding | Warfarin label; anticoagulation guidelines |
| 2 | Warfarin + azole antifungals (fluconazole, etc.) | Bleeding (↑INR) | Warfarin label |
| 3 | Warfarin + macrolides / metronidazole / co-trimoxazole | Bleeding (↑INR) | Warfarin label |
| 4 | Colchicine + strong CYP3A4/P-gp inhibitors (clarithromycin, ketoconazole, ...) | Fatal colchicine toxicity | Colchicine label boxed guidance |
| 5 | Simvastatin/lovastatin + strong CYP3A4 inhibitors | Rhabdomyolysis | Statin labels |
| 6 | Statins + fibrates (esp. gemfibrozil) | Myopathy/rhabdomyolysis | Statin/gemfibrozil labels |
| 7 | SSRIs/SNRIs + MAOIs (incl. linezolid) | Serotonin syndrome | SSRI/MAOI labels |
| 8 | Tramadol / pethidine + MAOIs or serotonergics | Serotonin syndrome / seizures | Opioid labels |
| 9 | PDE5 inhibitors (sildenafil, ...) + nitrates | Life-threatening hypotension | Sildenafil label (contraindication) |
| 10 | ACEi/ARB + potassium-sparing diuretics / K+ supplements | Hyperkalaemia | Product labels |
| 11 | Methotrexate + NSAIDs / co-trimoxazole | MTX toxicity (marrow) | MTX label |
| 12 | Digoxin + amiodarone / verapamil / clarithromycin | Digoxin toxicity | Digoxin label |
| 13 | Clarithromycin/erythromycin + QT-prolonging drugs | Torsades/QT | Macrolide labels |
| 14 | Clopidogrel + omeprazole/esomeprazole | ↓ antiplatelet effect | Clopidogrel label |
| 15 | Metformin + iodinated contrast (peri-procedural) | Lactic acidosis (renal) | Metformin label |
| 16 | Allopurinol + azathioprine/6-MP | Marrow suppression | Azathioprine label |
| 17 | Calcium/antacids/iron + fluoroquinolones/tetracyclines | Chelation → antibiotic failure | Antibiotic labels |
| 18 | Rifampicin + oral contraceptives / warfarin / many PK victims | ↓ efficacy (strong inducer) | Rifampicin label |
| 19 | Spironolactone + ACEi/ARB | Hyperkalaemia | Product labels |
| 20 | Verapamil/diltiazem + beta-blockers | Bradycardia/AV block | Product labels |

## 4. Exemplar DRAFT rules (illustrative structure — clinician to verify each)

These show the target shape (`clinician_reviewed`-schema-shaped, but marked `proposed` until approved). Severities/management here are **drafts for review**, not settled.

```jsonl
{"proposed_status":"draft_for_review","pair_names":["colchicine","clarithromycin"],"severity":"contraindicated","mechanism":"Clarithromycin strongly inhibits CYP3A4 and P-gp, sharply raising colchicine exposure; fatal toxicity reported.","management":"Do not co-dispense in patients on colchicine; if antibiotic essential, prescriber must hold colchicine and choose a non-interacting agent (e.g. amoxicillin) — refer to prescriber.","evidence":[{"source":"fda-label-colchicine","excerpt":"...concomitant use with strong CYP3A4/P-gp inhibitors is contraindicated in renal or hepatic impairment; fatal toxicity reported...","jurisdiction":"US-label"}],"applicability":{"routes":["systemic"]}}
{"proposed_status":"draft_for_review","pair_names":["sildenafil","glyceryl trinitrate"],"severity":"contraindicated","mechanism":"Additive cGMP-mediated vasodilation → profound hypotension.","management":"Do not dispense together; nitrates are contraindicated within 24h of sildenafil (48h tadalafil). Refer to prescriber.","evidence":[{"source":"fda-label-sildenafil","excerpt":"...contraindicated in patients using nitrates in any form...","jurisdiction":"US-label"}],"applicability":{"routes":["systemic"]}}
{"proposed_status":"draft_for_review","pair_names":["warfarin","diclofenac"],"severity":"major","mechanism":"Additive bleeding risk (antiplatelet + GI mucosal injury) on anticoagulation.","management":"Avoid; if analgesia needed prefer paracetamol. If NSAID unavoidable, prescriber to add GI protection and increase INR monitoring — refer.","evidence":[{"source":"fda-label-warfarin","excerpt":"...NSAIDs increase the risk of bleeding...","jurisdiction":"US-label"}],"applicability":{"routes":["systemic"]}}
{"proposed_status":"draft_for_review","pair_names":["ciprofloxacin","calcium carbonate"],"severity":"moderate","mechanism":"Polyvalent cation chelation reduces fluoroquinolone absorption → treatment failure.","management":"Space doses: fluoroquinolone 2h before or 6h after calcium/antacid/iron. Counsel patient at dispensing.","evidence":[{"source":"fda-label-ciprofloxacin","excerpt":"...absorption is reduced by concomitant... antacids containing... calcium...","jurisdiction":"US-label"}],"applicability":{"routes":["oral"]}}
```

## 5. What I would build (minimal, honest)

1. **`proposed-rules-for-review.jsonl`** — the drafted first batch (structure above), each with citations, marked `draft_for_review`. Not runtime-loaded.
2. **A review packet** (per-rule: pair, proposed severity/management, the exact label/guideline excerpt + link) so two clinicians can approve/edit efficiently (Task 7).
3. **A promotion step** — on clinician approval, convert approved drafts into a `clinician_reviewed` `interaction-rules.json` pack (schema-valid), wire the CLI to load it, and add the honest scoped-coverage output ("this checker knows only these N reviewed interactions; a blank result is not proof of safety").
4. Identity/name resolution reuses the parent plan's existing `ingredient-mapping-overrides.json` — no new identity source.

## 6. Open items to confirm

- **Reviewers:** who are the two authorised clinicians (Task 7), and is that available now or later? (Gates any pharmacist-facing release.)
- **Batch size/scope:** is ~18–20 right for a first review round? Any India-specific must-includes (e.g. common local co-prescriptions)?
- **Formulary gating:** restrict the first batch to drugs actually in a target dispensing formulary, or keep it drug-class general?
