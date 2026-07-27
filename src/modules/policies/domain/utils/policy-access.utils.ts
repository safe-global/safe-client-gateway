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
 * Numeric value of an operation as encoded in the access word.
 */
export function operationValue(operation: PolicyOperation): number {
  return operation === PolicyOperation.DelegateCall ? 1 : 0;
}

/**
 * Identifier of a policy item, opaque to the wallet but stable across requests.
 *
 * A single access is identified by its access word. An item combining several
 * accesses (e.g. an allowlist covering more than one selector of a token) is
 * identified by the hash of its sorted access words, so the identifier does not
 * depend on the order the events came back in.
 */
export function policyId(
  confirmations: ReadonlyArray<
    Pick<PolicyConfirmation, 'target' | 'selector' | 'operation'>
  >,
): Hex {
  const accesses = confirmations.map(accessSelector).sort();

  if (accesses.length === 1) {
    return accesses[0];
  }

  return keccak256(concat(accesses));
}
