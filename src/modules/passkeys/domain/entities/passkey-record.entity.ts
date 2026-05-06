// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Canonical byte representation of a stored passkey coordinate record.
 * Wire encodings (base64url for credentialId, 0x-hex for byte fields) are
 * applied at the controller boundary, not here.
 */
export interface PasskeyRecord {
  credentialId: Buffer;
  x: Buffer;
  y: Buffer;
  verifiers: Buffer;
  rpId: string;
  createdAt: Date;
}

/**
 * Input shape for write operations. `createdAt` is server-assigned by the DB
 * (`DEFAULT now()`), so callers don't supply it.
 */
export type PasskeyRecordInput = Omit<PasskeyRecord, 'createdAt'>;

export type WriteOutcome =
  | { status: 'created'; record: PasskeyRecord }
  | { status: 'identical'; record: PasskeyRecord }
  | { status: 'conflict' }
  | { status: 'cross_rp_conflict' };
