// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Stable identifiers for attestation failure modes. The controller surfaces
 * these to clients as opaque `{ code: errorId }` envelopes — the strings are
 * part of the public API and must not be renamed without coordinating with
 * wallet clients.
 */
export type PasskeyAttestationErrorId =
  | 'PASSKEY_NOT_CREATE_TYPE'
  | 'PASSKEY_RPID_NOT_ALLOWED'
  | 'PASSKEY_ORIGIN_NOT_ALLOWED'
  | 'PASSKEY_MALFORMED_ATTESTATION'
  | 'PASSKEY_UNSUPPORTED_KEY'
  | 'PASSKEY_RPID_MISMATCH'
  | 'PASSKEY_ATTESTATION_INVALID'
  | 'PASSKEY_VERIFICATION_TIMEOUT'
  | 'PASSKEY_CHALLENGE_INVALID';
