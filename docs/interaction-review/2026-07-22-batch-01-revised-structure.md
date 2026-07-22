# Batch 1 — Revised Rule Structure (post clinician review)

Encodes the review's 6 cross-cutting promotion blockers. **Confirm this structure before I apply it to the full revised batch** (~110 rules — 88/89/71 expand into explicit victim pairs).

## Design decisions from the review

1. **Class refs carry modifiers.** A perpetrator/object is a structured ref with `strength`, `route`, `formulation`, and a versioned member-source — never a bare "CYP3A4 inhibitors" string. Expansion happens at promotion, preserving those modifiers.
2. **`risk_basis` separates absolute contraindication from additive PD risk** (`contraindication` | `pk_perpetrator` | `additive_pd`), so a QT/bleeding/hyperkalaemia *additive* pair is not conflated with an explicit *contraindication*.
3. **`dispense_action` distinguishes withhold-and-clarify from confirm-and-monitor** — never implies the pharmacist unilaterally stops established specialist-directed therapy.
4. **Full source metadata per evidence item** (regulator, product, label section, revision + accessed dates, exact excerpt `<verify>`, normalized proposition).
5. **Dedup/replace applied**: 42 removed (→ food-counsel + merge into 41), 66 merged into 65, 71/88/89 replaced by explicit pairs.
6. **Structured management fields** (machine-testable), not free text.

## Rule shape (draft artifact — not runtime until approved)

```jsonc
{
  "rule_id": "warfarin__nsaid_systemic",
  "risk_basis": "additive_pd",              // contraindication | pk_perpetrator | additive_pd
  "severity": "major",                       // worst-case tier
  "conditional": true,                        // action/severity varies by patient factors (carried in management)
  "object":     { "drug": "warfarin" },
  "perpetrator":{ "class": "nsaid", "route": ["systemic"], "members_source": "curated@2026-07" },
  "applicability": { "routes": ["systemic"], "formulations": [], "renal": null,
                     "indication": null, "jurisdiction": ["US","UK","IN"] },
  "mechanism": "Additive bleeding: NSAID antiplatelet effect + GI mucosal injury on anticoagulation.",
  "management": {
    "dispense_action": "supply_with_counselling",   // withhold_and_clarify | confirm_and_monitor | supply_with_counselling | space_doses
    "prescriber_action": "Prefer paracetamol; if NSAID intended, lowest dose/shortest course, review gastroprotection.",
    "monitoring": "Check INR after starting and after stopping the NSAID.",
    "patient_counselling": "Urgent bleeding signs (melaena, haematemesis, unusual bruising).",
    "timing": null, "duration": null,
    "exceptions": "A PPI reduces upper-GI injury but does NOT remove systemic bleeding risk."
  },
  "evidence": [{
    "source_id": "fda-label-warfarin", "regulator": "FDA", "product": "warfarin sodium",
    "label_section": "Drug Interactions", "revision_date": "<verify>", "accessed_at": "<verify>",
    "excerpt": "<verify — NSAIDs increase bleeding risk>",
    "normalized_proposition": "NSAIDs increase bleeding risk with warfarin."
  }],
  "proposed_status": "draft_for_review",
  "review": { "author": null, "approver": null, "conf": "H" }
}
```

## Hardest cases, worked in the new shape (your edits applied)

**#13 DOAC split — perpetrator-specific dose actions (not "avoid").**
- `apixaban__strong_cyp3a4_pgp_inhibitor`: severity major, conditional. management.prescriber_action = "On 5/10 mg BID: reduce dose 50%. On 2.5 mg BID: avoid." (US label). dispense_action = withhold_and_clarify.
- `rivaroxaban__strong_cyp3a4_pgp_inhibitor`: separate rule, avoid per label; renal-function modifier noted.

**#46 QT — risk-tier, not a blanket "2 QT drugs = Major".**
- `risk_basis: additive_pd`, `conditional: true`. management surfaces the risk factors the pharmacist weighs (explicit contraindicated pair? drug-specific TdP risk? baseline QTc, K⁺/Mg²⁺, bradycardia, HF, renal/hepatic accumulation, number of agents). Explicitly-contraindicated members (e.g. domperidone + potent CYP3A4/QT; ondansetron + apomorphine) become their **own** `contraindication` rules, not part of the additive tier.

**#75 colchicine — conditional branches, not universal Contra.**
- object colchicine; perpetrator {class: cyp3a4_pgp_inhibitor, strength:[strong]}. severity contraindicated (worst-case), conditional true. management: "Renal or hepatic impairment → do not co-supply (contraindicated). Normal function → prescriber must interrupt or dose-reduce colchicine per the specific inhibitor's label; refer." dispense_action withhold_and_clarify.

**#38 opioid + benzodiazepine — boxed-warning language, no unilateral stop.**
- `risk_basis: additive_pd`, severity major, dispense_action confirm_and_monitor. prescriber_action = "Reserve concomitant use for inadequate alternatives; lowest effective doses, shortest duration." patient_counselling = profound sedation/respiratory depression. **Not** "avoid co-dispensing."

**#88/#89 replaced by explicit victim pairs (examples).**
- `rifampicin__hormonal_contraceptive` (already #86/87), `rifampicin__tacrolimus` (#79), `rifampicin__verapamil`, `rifampicin__sulfonylurea`, `rifampicin__corticosteroid`, `rifampicin__antiretroviral` … each victim-specific severity + onset/offset. Same pattern for carbamazepine. The bare "many CYP3A substrates" row is deleted.

**#42 removed / #66 merged.**
- 42: dropped from the DDI pack; tyramine kept as a food-counselling item; the indirect-sympathomimetic drug examples fold into #41 (MAOI + sympathomimetics).
- 66: dropped; spironolactone+trimethoprim becomes a named high-risk member under #65 (trimethoprim/co-trimoxazole + K⁺-raising drugs).

## What I'll do on your OK

Apply this shape to all rows: keep the 35 A (metadata/structure only), rewrite the 60 E per your notes, delete/merge/replace the 5 R, and enumerate 88/89/71 into explicit pairs — producing a revised Batch-1 artifact (~110 rules) plus a short diff of exactly what changed per row so your re-review is fast.

---

## Context-awareness (added per clinician request)

The checker gains an **optional** patient context; rules evaluate against it when present and stay silent about it when absent.

**Checker input (all optional, pass only what's known):**
```jsonc
"patient_context": {
  "renal":   { "egfr": 42, "creatinine_umol_l": 150, "crcl": 40 },   // any subset
  "hepatic": { "child_pugh": "B", "ast": 90, "alt": 120, "bilirubin_umol_l": 40, "flag": "impaired" }
}
```

**Rule gains `context_modifiers`:**
```jsonc
"severity": "major",                       // BASE tier (used when the relevant factor is unknown AND on_unknown="base")
"context_modifiers": [
  { "factor": "renal", "when": "egfr_lt_30",  "severity": "contraindicated",
    "management_override": { "dispense_action": "withhold_and_clarify", "prescriber_action": "..." },
    "on_unknown": "escalate" },
  { "factor": "renal", "when": "egfr_ge_60",  "severity": "major", "on_unknown": null }   // reassuring value relaxes
]
```

**Evaluation:**
1. Factor **present** in context → match the `when` predicate → apply that modifier's severity/management. (A reassuring value, e.g. normal eGFR, can *downgrade* from a cautious base.)
2. Factor **present but no `when` matches** → base severity/management.
3. Factor **absent** →
   - if any modifier for that factor has `on_unknown:"escalate"` → present the **escalated** severity (worst such modifier), **with no renal/hepatic caveat text** (the pharmacist isn't told to go find a lab);
   - else → base severity, factor **not mentioned at all**.

`on_unknown` is a **clinician-set, per-rule** field — the safety-vs-noise call. Default I'll draft: `escalate` where the missing factor can make the pair genuinely dangerous (colchicine, methotrexate, DOACs, digoxin, metformin/contrast, NSAID+ACEi/diuretic), `base` otherwise.

**Worked (context-aware):**
- `colchicine__strong_cyp3a4_pgp_inhibitor`: base `major`; modifier {renal `egfr_lt_30` or hepatic impaired → `contraindicated`, `on_unknown:escalate`}. Renal unknown → shows *contraindicated*, no caveat text. eGFR 80 supplied → *major* + "interrupt/dose-reduce per inhibitor label."
- `nsaid__acei_arb` (+diuretic = triple whammy): base `moderate`; modifier {renal impaired → `major`, `on_unknown:base` (escalate only if impairment reported)}. Renal unknown → *moderate*, clean. eGFR 35 supplied → *major* + AKI monitoring.
- Predicates use a fixed vocabulary: `egfr_lt_15|lt_30|lt_60|ge_60`, `crcl_lt_30|...`, `hepatic_impaired|child_pugh_b|child_pugh_c`.
