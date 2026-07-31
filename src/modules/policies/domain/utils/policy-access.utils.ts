// SPDX-License-Identifier: FSL-1.1-MIT
import { concat, type Hex, keccak256, pad, toHex } from 'viem';
import {
  type PolicyConfirmation,
  PolicyOperation,
} from '@/modules/policies/domain/entities/policy-confirmation.entity';

/**
 * The `access` word a policy is keyed by on-chain, as built by
 * `AccessSelector.create(target, selector, operation)`:
 *
 * ```
 * byte | 0 1 2 3  | 4         |  5 ... 11 | 12 ............ 31
 * data | selector | operation |  (unused) | target address
 * ```
 *
 * Used as the stable, opaque `id` of a policy in the API: it is deterministic,
 * unique per `(target, selector, operation)` and equal to the on-chain key.
 *
 * @see https://github.com/safe-research/policy-engine
 */
export function accessSelector(
  args: Pick<PolicyConfirmation, 'target' | 'selector' | 'operation'>,
): Hex {
  return concat([
    pad(args.selector, { size: 4, dir: 'right' }),
    toHex(operationValue(args.operation), { size: 1 }),
    pad('0x', { size: 7 }),
    args.target.toLowerCase() as Hex,
  ]);
}

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

/**
 * Identifier of a policy item, opaque to the wallet but stable across requests.
 *
 * An item covering a single access is identified by its access word. One covering
 * several (e.g. an allowlist spanning more than one selector of a token) is
 * identified by the hash of the sorted words, so the identifier does not depend
 * on the order the groups came in.
 */
export function policyId(accesses: ReadonlyArray<Hex>): Hex {
  const sorted = [...new Set(accesses)].sort();

  if (sorted.length === 1) {
    return sorted[0];
  }

  return keccak256(concat(sorted));
}
