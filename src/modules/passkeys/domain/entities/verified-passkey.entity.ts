// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Result of a successful attestation verification. All byte fields are raw —
 * encoding to base64url / 0x-hex happens at the controller boundary.
 */
export interface VerifiedPasskey {
  /** 32-byte big-endian P-256 X coordinate. */
  x: Buffer;
  /** 32-byte big-endian P-256 Y coordinate. */
  y: Buffer;
  /** Raw credentialId bytes recovered from the verified attestation. */
  credentialId: Buffer;
  /** RP ID confirmed by the library against authData.rpIdHash. */
  rpId: string;
  alg: number;
}
