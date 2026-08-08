# Sign-off checklist

This checklist is mandatory for each of the six subjects.

1. Confirm `git status --short` is clean and record `git rev-parse HEAD`.
2. Run `npm run verify:production-open-signoff -- --verify-source-catalogue` and require exit 0 with `source_catalogue_reverified: true`. The ordinary clean-checkout gate validates the committed capture; this pre-signature form additionally rehashes the complete parent catalogue and proves every captured row is byte-exact at its recorded line.
3. Immediately before signing, run the exact scoped live evidence gate and require exit 0:

   `npm run verify:interaction-evidence -- --sections=A --rule-id=warfarin__amiodarone --rule-id=warfarin__clarithromycin_oral --rule-id=warfarin__fluconazole --rule-id=warfarin__ketoconazole_oral --rule-id=warfarin__metronidazole --rule-id=warfarin__voriconazole`

4. Confirm `data-static/interaction-rules.json` still contains zero rules.
5. Review the clinician record and adjacent canonical JSON; confirm the displayed JCS SHA-256 equals `package-status.json` and the catalogue artifact hash matches the canonical binding.
6. Confirm the subject is schema revision 2, its identifier ends in `:r2`, and no revision 1 hash is being signed or reused.
7. Confirm every product's normalized ingredient, strength, route, formulation, and release profile, including the explicit exclusion of Faze 50 mg Tablet DT.
8. Confirm the subject evaluates only current or intended concurrent exposure. The checker does not automatically detect discontinuation, dose change, or recent exposure; follow-up remains with the prescriber or anticoagulation service.
9. Confirm the approval event will expire exactly 180 days after `reviewed_at_utc` and may invalidate earlier under the canonical conditions.
10. Record the exact approval statement without editing or shortening it.
11. Record the decision with the pinned clinician SSH key (substitute the exact rule ID):

   `npm run approvals:record-production-open -- --rule-id=warfarin__amiodarone --decision=APPROVED --key-path=C:\Users\subas\.ssh\id_ed25519`

12. Run `npm run verify:production-open-approval-events` and require the new event and detached signature to pass with zero expired subjects.
13. Commit and push both new files from `approval-events/`. Do not mutate a template or an earlier event. A correction requires `--supersedes-event-id=<prior-event-id>` and a new signed event.

## Still required after all signatures and before promotion

- Validate every signed event and reviewer authorization.
- Resolve `github-jr` source rights for publication through a separate owner/legal decision.
- Author production-open ingredient and product-presentation mappings from redistributable evidence only; never copy restricted internal-evaluation mappings.
- Pin the signed subject hashes and exact mappings in new production-open promotion manifests.
- Run the compiler, package, source-leakage, full test, and deterministic regeneration gates.
- Keep declared coverage `partial` and preserve fail-closed unresolved results.

Passing this checklist does not deploy or authorize clinical use.
