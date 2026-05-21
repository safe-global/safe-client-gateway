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

export enum WriteOutcomeStatus {
  CREATED = 'created',
  IDENTICAL = 'identical',
  CONFLICT = 'conflict',
  CROSS_RP_CONFLICT = 'cross_rp_conflict',
}

export type WriteOutcome =
  | { status: WriteOutcomeStatus.CREATED; record: PasskeyRecord }
  | { status: WriteOutcomeStatus.IDENTICAL; record: PasskeyRecord }
  | { status: WriteOutcomeStatus.CONFLICT }
  | { status: WriteOutcomeStatus.CROSS_RP_CONFLICT };
