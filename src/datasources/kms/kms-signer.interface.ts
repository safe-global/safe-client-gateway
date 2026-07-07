// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Signs messages with, and exposes the public key of, an asymmetric KMS key.
 */
export interface IKmsSigner {
  /**
   * Signs `message` with the KMS key (ECDSA P-256 / SHA-256) and returns the
   * DER-encoded signature KMS produces. Convert to JOSE (`R||S`) for JWS.
   */
  sign(message: Buffer): Promise<Buffer>;

  /** Returns the SPKI DER-encoded public key of the KMS key. */
  getPublicKey(): Promise<Buffer>;
}
