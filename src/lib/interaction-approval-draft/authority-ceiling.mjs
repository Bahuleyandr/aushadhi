// Shared authority-ceiling boundary. Both the draft governance policy and
// the draft clinical rule subject must pin clinical-use, production, and
// deployment authority to false — a draft package can never grant authority.
import {
  fail,
  requireExactKeys,
  requireFalse,
} from './validation-primitives.mjs';

const AUTHORITY_CEILING_KEYS = new Set([
  'clinical_use',
  'production',
  'deployment',
]);

export function assertAuthorityCeiling(authority, kind) {
  requireExactKeys(
    authority,
    AUTHORITY_CEILING_KEYS,
    kind,
    'authority_ceiling',
  );
  requireFalse(authority.clinical_use, kind, 'clinical-use authority');
  if (authority.production !== false) {
    fail(kind, 'production authority must be false');
  }
  requireFalse(authority.deployment, kind, 'deployment authority');
}
