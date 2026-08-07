// Clinician review rendering binding. The reviewed CLINICIAN-REVIEW.md
// document is bound by a normalized whole-document SHA-256 (profile
// UTF-8-NFC-LF-no-trailing-LF); any byte-level drift from the reviewed
// rendering is rejected.
import crypto from 'node:crypto';

import { fail } from './validation-primitives.mjs';

function normalizedTextSha256(text) {
  if (typeof text !== 'string') {
    throw new TypeError('clinician review rendering: source must be a string');
  }
  const normalized = text
    .normalize('NFC')
    .replace(/\r\n?/gu, '\n')
    .replace(/\n+$/gu, '');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function assertClinicianReviewRendering(text) {
  const expected =
    '58e83f86cfd16a633f4ba7f4fd72f9e6e7a75f0fca8031b24471ff4b9f332a9b';
  if (normalizedTextSha256(text) !== expected) {
    fail(
      'clinician review rendering',
      'normalized whole-document SHA-256 does not match the reviewed rendering',
    );
  }
  return Object.freeze({
    sha256_profile: 'UTF-8-NFC-LF-no-trailing-LF',
    sha256: expected,
  });
}
