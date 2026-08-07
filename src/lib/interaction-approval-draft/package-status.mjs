// Draft approval package status validation. The package status must declare
// itself draft_non_authorizing with no clinical-use, production, or
// deployment authority, and separate implemented controls from the exact
// sign-off and promotion checklists still required.
import {
  fail,
  immutableValidatedSnapshot,
  requireExactKeys,
  requireExactObject,
  requireFalse,
  requireStringArray,
} from './validation-primitives.mjs';

const STATUS_KEYS = new Set([
  'schema_id',
  'schema_version',
  'package_id',
  'prepared_at',
  'package_status',
  'clinician_review_sha256_profile',
  'clinician_review_sha256',
  'policy_signoff_ready',
  'rule_signoff_ready',
  'promotion_ready',
  'authority',
  'implemented_controls',
  'required_before_policy_signoff',
  'required_before_rule_signoff',
  'required_before_promotion',
  'required_before_production',
]);

const PACKAGE_AUTHORITY_KEYS = new Set([
  'clinical_use',
  'production',
  'deployment',
]);

const EXPECTED_PACKAGE_STATUS = {
  schema_id: 'aushadhi.interaction-approval-draft-package-status',
  schema_version: '1.0.0',
  package_id: 'warfarin-cotrimoxazole-vnext-2026-07-29',
  prepared_at: '2026-07-29',
  package_status: 'draft_non_authorizing',
  clinician_review_sha256_profile: 'UTF-8-NFC-LF-no-trailing-LF',
  clinician_review_sha256:
    '58e83f86cfd16a633f4ba7f4fd72f9e6e7a75f0fca8031b24471ff4b9f332a9b',
  policy_signoff_ready: false,
  rule_signoff_ready: false,
  promotion_ready: false,
  authority: {
    clinical_use: 'none',
    production: 'none',
    deployment: 'none',
  },
  implemented_controls: [
    'repository-native draft artifacts with exact non-authorizing value validation',
    'exact current-check-only temporal scope',
    'no age-derived population branch',
    'six explicitly enumerated PMBJP oral-tablet product pairs',
    'rehashed committed RxNorm and combination-identity objects plus current-manifest product and assertion bindings, draft-row hash, and repository-base relationship',
    'default-deny audience allowlists with explicit intersection-only composition and precedence, distinct unreviewed or identity-unresolved and exposure-unresolved rendering, per-state evidence plus exposure and confirmation-method compatibility, and trusted order-event and authorized-actor correction-path and terminal evidence requirements',
    'complete clinician-rendering equivalence checks plus a normalized whole-document SHA-256 binding for canonical clinical text, all workflow mappings, optional audit fields, change control, and all requested sign-off items',
    'duplicate-member-rejecting raw JSON parsing, exact schema discriminators, and deeply immutable validated snapshots',
    'detached event, signature-envelope, receipt, and checkpoint templates',
    'implemented-versus-required status separation',
    'production-open remains empty',
  ],
  required_before_policy_signoff: [
    'approve a bootstrap governance policy and governance approver quorum',
    'pin a conformant RFC 8785 implementation and conformance vectors',
    'pin signature, signer-registry, authorization-registry, and event-store trust profiles',
    'approve the exact approval-record container and approval-statement hash-normalization profile',
    'define reviewer credential validity, revocation, replay, and trusted-time controls',
    'define append-only retention and externally retained signed checkpoints',
  ],
  required_before_rule_signoff: [
    'complete and approve the governance policy',
    'replace the draft policy binding with the final policy JCS SHA-256',
    'clinically approve or reject PMBJP 90 strength extrapolation explicitly',
    'clinically approve the exact classification, scope, text, and workflow boundary',
    'finalize the exact approval statement without placeholders',
    'commit the final policy and subject before creating any approval event',
    'reverify the captured openFDA payload and fragment hashes against the retained source objects',
  ],
  required_before_promotion: [
    'create a new immutable authenticated approval event; do not mutate this template',
    'verify the detached signature against pinned trust and authorization records',
    'append the record to the approved store and retain a valid signed checkpoint',
    'reconcile the non-authorizing JSONL row and pin its new hash',
    'implement a medication-status or intended-use input contract before claiming temporal enforcement',
    'implement structured audience rendering with distinct unreviewed or identity-unresolved and exposure-unresolved behavior without flattening clinical authority',
    'implement per-state exposure and confirmation-method compatibility plus trusted order-event and authorized-actor validation for cancellation or correction terminal states',
    'implement the evaluation watermark and exact draft-package gate runner',
    'run source, identity, six-pair, negative-case, supersession, and full regression gates',
    'confirm data-static/interaction-rules.json remains empty',
  ],
  required_before_production: [
    'obtain separate India-specific clinical, regulatory, pharmacy, antimicrobial-stewardship, privacy, and security governance review',
    'complete shadow-mode, human-factors, alert-burden, rollback, kill-switch, and drift-monitoring validation',
    'define numerical production acceptance criteria and accountable owners',
    'obtain separate production and deployment authorization',
  ],
};

// Governance policy v1.1 (owner-approved 2026-08-07) rewords exactly two
// checklist strings: production-open is no longer required to remain empty
// as policy, so the implemented control and the pre-promotion confirmation
// pin the replacement invariant — deterministic recompilation from
// owner-approved, digest-bound production-open manifests. The 1.0.0-draft
// strings stay frozen so the committed 2026-07-29 package keeps validating
// byte-identically. A future v1.1 approval package must also resolve its own
// package identity fields in its own reviewed change; only the two
// production-open strings are keyed here.
const PACKAGE_STATUS_STRINGS_BY_POLICY_VERSION = new Map([
  ['1.0.0-draft', {
    implementedControl: 'production-open remains empty',
    promotionConfirmation: 'confirm data-static/interaction-rules.json remains empty',
  }],
  ['1.1.0-draft', {
    implementedControl:
      'production-open contains only owner-approved, digest-bound promotions',
    promotionConfirmation:
      'confirm data-static/interaction-rules.json equals its deterministic '
        + 'recompilation from the owner-approved production-open promotions '
        + 'manifest (interactions:promote:check)',
  }],
]);

function expectedPackageStatusForPolicyVersion(policyVersion, kind) {
  const strings = PACKAGE_STATUS_STRINGS_BY_POLICY_VERSION.get(policyVersion);
  if (strings === undefined) {
    fail(kind, 'policy_version is not a reviewed package-status boundary version');
  }
  return {
    ...EXPECTED_PACKAGE_STATUS,
    implemented_controls: EXPECTED_PACKAGE_STATUS.implemented_controls.map((entry) => (
      entry === 'production-open remains empty' ? strings.implementedControl : entry
    )),
    required_before_promotion: EXPECTED_PACKAGE_STATUS.required_before_promotion.map(
      (entry) => (
        entry === 'confirm data-static/interaction-rules.json remains empty'
          ? strings.promotionConfirmation
          : entry
      ),
    ),
  };
}

export function assertPackageStatus(status, { policyVersion = '1.0.0-draft' } = {}) {
  const kind = 'draft approval package status';
  status = immutableValidatedSnapshot(status);
  requireExactObject(
    status,
    expectedPackageStatusForPolicyVersion(policyVersion, kind),
    kind,
    'status',
  );
  if (status.package_status !== 'draft_non_authorizing') {
    fail(kind, 'package_status must be draft_non_authorizing');
  }
  for (const key of ['policy_signoff_ready', 'rule_signoff_ready', 'promotion_ready']) {
    requireFalse(status[key], kind, key);
  }
  requireExactKeys(status.authority, PACKAGE_AUTHORITY_KEYS, kind, 'authority');
  for (const key of ['clinical_use', 'production', 'deployment']) {
    if (status.authority[key] !== 'none') {
      fail(kind, `${key} authority must be none`);
    }
  }
  for (const key of [
    'implemented_controls',
    'required_before_policy_signoff',
    'required_before_rule_signoff',
    'required_before_promotion',
    'required_before_production',
  ]) {
    requireStringArray(status[key], kind, key);
  }
  return status;
}

// STATUS_KEYS hand-encodes the frozen package-status shape and is not (yet)
// referenced by an assertion (requireExactObject derives its key set from the
// expected value); it is exported as policy-encoding data so deleting it is a
// visible interface change rather than a silent cleanup.
export { STATUS_KEYS };
