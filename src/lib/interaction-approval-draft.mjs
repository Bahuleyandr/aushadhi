// Interaction approval draft package validation — public entry point.
//
// The implementation is decomposed under src/lib/interaction-approval-draft/:
//   raw-json.mjs                  duplicate-member-rejecting JSON parsing
//   validation-primitives.mjs     generic fail-closed validation helpers
//   authority-ceiling.mjs         shared no-authority ceiling check
//   clinician-review-rendering.mjs  normalized whole-document SHA-256 binding
//   governance-policy.mjs         draft governance policy boundary
//   clinical-rule-subject.mjs     reviewed clinical rule subject boundary
//   approval-event-template.mjs   template-only approval event boundary
//   package-status.mjs            draft_non_authorizing package status
//
// This module keeps the original import path and public surface, and wires
// the per-artifact validators into whole-package validation.
import {
  assertClinicianReviewRendering,
} from './interaction-approval-draft/clinician-review-rendering.mjs';
import {
  assertDraftGovernancePolicy,
} from './interaction-approval-draft/governance-policy.mjs';
import {
  assertDraftClinicalRuleSubject,
} from './interaction-approval-draft/clinical-rule-subject.mjs';
import {
  assertApprovalEventTemplate,
} from './interaction-approval-draft/approval-event-template.mjs';
import {
  assertPackageStatus,
} from './interaction-approval-draft/package-status.mjs';
import { fail } from './interaction-approval-draft/validation-primitives.mjs';

export { parseDraftApprovalJson } from './interaction-approval-draft/raw-json.mjs';
export { assertClinicianReviewRendering };
export { assertDraftGovernancePolicy };
export { assertDraftClinicalRuleSubject };
export { assertApprovalEventTemplate };

export function validateDraftApprovalPackage({
  policy,
  subject,
  eventTemplate,
  status,
  clinicianReviewText,
}) {
  assertDraftGovernancePolicy(policy);
  assertDraftClinicalRuleSubject(subject);
  assertApprovalEventTemplate(eventTemplate);
  const validatedStatus = assertPackageStatus(status);
  const validatedRendering = assertClinicianReviewRendering(clinicianReviewText);
  if (
    validatedStatus.clinician_review_sha256_profile
      !== validatedRendering.sha256_profile
    || validatedStatus.clinician_review_sha256 !== validatedRendering.sha256
  ) {
    fail(
      'draft approval package',
      'clinician review rendering binding does not match package status',
    );
  }
  return Object.freeze({
    package_status: validatedStatus.package_status,
    structurally_valid: true,
    policy_signoff_ready: false,
    rule_signoff_ready: false,
    promotion_ready: false,
    clinical_use_authority: 'none',
    production_authority: 'none',
    deployment_authority: 'none',
  });
}
