// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * The operation of a guarded call, as the wire reports it.
 *
 * The guard encodes it as a `uint8` in the access word; the API reports the
 * name, so a client never has to know which number means which.
 */
export const PolicyOperation = {
  Call: 'CALL',
  DelegateCall: 'DELEGATECALL',
} as const;

export type PolicyOperation =
  (typeof PolicyOperation)[keyof typeof PolicyOperation];

/**
 * Numeric value of an operation as encoded in the access word - one byte, so the
 * return type is narrowed to the two values the guard defines.
 */
export function operationValue(operation: PolicyOperation): 0 | 1 {
  return operation === PolicyOperation.DelegateCall ? 1 : 0;
}

/**
 * Inverse of {@link operationValue}: the operation an on-chain value denotes.
 *
 * Needed wherever CGW holds the numeric form - the guard's encoding, and so the
 * stored configurations - but reports the named one.
 */
export function policyOperationFromValue(value: 0 | 1): PolicyOperation {
  return value === 1 ? PolicyOperation.DelegateCall : PolicyOperation.Call;
}
