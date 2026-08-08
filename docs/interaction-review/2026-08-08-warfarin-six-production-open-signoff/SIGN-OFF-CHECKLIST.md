# Sign-off checklist

This checklist is mandatory for each of the six subjects.

1. Confirm `git status --short` is clean and record `git rev-parse HEAD`.
2. Run `npm run verify:production-open-signoff` and require exit 0.
3. Immediately before signing, run the exact scoped live evidence gate and require exit 0:

   `npm run verify:interaction-evidence -- --sections=A --rule-id=warfarin__amiodarone --rule-id=warfarin__clarithromycin_oral --rule-id=warfarin__fluconazole --rule-id=warfarin__ketoconazole_oral --rule-id=warfarin__metronidazole --rule-id=warfarin__voriconazole`

4. Confirm `data-static/interaction-rules.json` still contains zero rules.
5. Review the clinician record and adjacent canonical JSON; confirm the displayed JCS SHA-256 equals `package-status.json`.
6. Record the exact approval statement without editing or shortening it.
7. Create a new immutable approval event from the adjacent template. Do not mutate the template.
8. Populate the decision, UTC time, reviewed repository HEAD, authentication method, and authenticated event ID through the authorized clinician workflow.
9. Preserve the completed event append-only. A correction requires a later superseding event.

## Still required after all signatures and before promotion

- Validate every signed event and reviewer authorization.
- Resolve `github-jr` source rights for publication through a separate owner/legal decision.
- Author production-open ingredient and product-presentation mappings from redistributable evidence only; never copy restricted internal-evaluation mappings.
- Pin the signed subject hashes and exact mappings in new production-open promotion manifests.
- Run the compiler, package, source-leakage, full test, and deterministic regeneration gates.
- Keep declared coverage `partial` and preserve fail-closed unresolved results.

Passing this checklist does not deploy or authorize clinical use.
