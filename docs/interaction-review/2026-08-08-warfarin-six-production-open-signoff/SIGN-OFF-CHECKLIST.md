# Sign-off checklist

This checklist is mandatory for each of the six subjects.

1. Confirm `git status --short` is clean and record `git rev-parse HEAD`.
2. Run `npm run verify:production-open-signoff` and require exit 0.
3. Immediately before signing, run the exact scoped live evidence gate and require exit 0:

   `npm run verify:interaction-evidence -- --sections=A --rule-id=warfarin__amiodarone --rule-id=warfarin__clarithromycin_oral --rule-id=warfarin__fluconazole --rule-id=warfarin__ketoconazole_oral --rule-id=warfarin__metronidazole --rule-id=warfarin__voriconazole`

4. Confirm `data-static/interaction-rules.json` still contains zero rules.
5. Review the clinician record and adjacent canonical JSON; confirm the displayed JCS SHA-256 equals `package-status.json`.
6. Record the exact approval statement without editing or shortening it.
7. Record the decision with the pinned clinician SSH key (substitute the exact rule ID):

   `npm run approvals:record-production-open -- --rule-id=warfarin__amiodarone --decision=APPROVED --key-path=C:\Users\subas\.ssh\id_ed25519`

8. Run `npm run verify:production-open-approval-events` and require the new event and detached signature to pass.
9. Commit and push both new files from `approval-events/`. Do not mutate a template or an earlier event. A correction requires `--supersedes-event-id=<prior-event-id>` and a new signed event.

## Still required after all signatures and before promotion

- Validate every signed event and reviewer authorization.
- Resolve `github-jr` source rights for publication through a separate owner/legal decision.
- Author production-open ingredient and product-presentation mappings from redistributable evidence only; never copy restricted internal-evaluation mappings.
- Pin the signed subject hashes and exact mappings in new production-open promotion manifests.
- Run the compiler, package, source-leakage, full test, and deterministic regeneration gates.
- Keep declared coverage `partial` and preserve fail-closed unresolved results.

Passing this checklist does not deploy or authorize clinical use.
