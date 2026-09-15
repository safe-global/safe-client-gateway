// SPDX-License-Identifier: FSL-1.1-MIT
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

/**
 * The operation of a guarded call, as the wire reports it.
 *
 * The guard encodes it as a `uint8` in the access word; the API reports the
 * name, so a client never has to know which number means which.
 */
export const PolicyOperation = {
  Call: 'CALL',
  DelegateCall: 'DELEGATECALL',
};

export type PolicyOperation =
  (typeof PolicyOperation)[keyof typeof PolicyOperation];

/**
 * Numeric value of an operation as encoded in the access word.
 *
 * The guard's byte is the Safe's own operation encoding, so the values come from
 * {@link Operation} rather than from literals repeated here.
 */
export function operationValue(operation: PolicyOperation): Operation {
  return operation === PolicyOperation.DelegateCall
    ? Operation.DELEGATE
    : Operation.CALL;
}

/**
 * Inverse of {@link operationValue}: the operation an on-chain value denotes.
 *
 * Needed wherever CGW holds the numeric form - the guard's encoding, and so the
 * stored configurations - but reports the named one.
 */
export function policyOperationFromValue(value: Operation): PolicyOperation {
  return value === Operation.DELEGATE
    ? PolicyOperation.DelegateCall
    : PolicyOperation.Call;
}
