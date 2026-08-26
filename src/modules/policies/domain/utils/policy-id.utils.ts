// SPDX-License-Identifier: FSL-1.1-MIT

import type { Address } from 'viem';
import {
  concat,
  encodeAbiParameters,
  type Hex,
  keccak256,
  pad,
  toHex,
} from 'viem';
import type { PolicyOperation } from '@/modules/policies/domain/entities/policy-operation.entity';
import { operationValue } from '@/modules/policies/domain/entities/policy-operation.entity';
import {
  PolicyEnforcementKind,
  type PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

/**
 * The identifier of a policy on the wire.
 *
 * Opaque to the client, but **stable across requests**: the wallet keys rows,
 * expansion state and pending-supersedes links on it. It is also unique within
 * one response, which matters because the Space-level route mixes Safes and
 * chains in one list - two Safes holding the same kind of policy must not
 * collide onto one row.
 *
 * Each enforcement kind derives it differently, because only guard policies have
 * something on chain to name them by.
 */

const ACCESS_SELECTOR_SIZE = 4;
const ACCESS_OPERATION_SIZE = 1;
const ACCESS_PADDING_SIZE = 7;

/**
 * The `access` word the guard keys a policy by, as built by
 * `AccessSelector.create(target, selector, operation)`:
 *
 * ```
 * byte | 0 1 2 3  | 4         |  5 ... 11 | 12 ............ 31
 * data | selector | operation |  (unused) | target address
 * ```
 *
 * Deterministic, unique per `(target, selector, operation)`, and equal to the
 * on-chain key - so a pending binding and the active policy of the same access
 * carry the same identifier and the wallet can line the two up.
 *
 * @see https://github.com/safe-research/policy-engine
 */
export function guardPolicyId(args: {
  target: Address;
  selector: Hex;
  operation: PolicyOperation;
}): Hex {
  return concat([
    pad(args.selector, { size: ACCESS_SELECTOR_SIZE, dir: 'right' }),
    toHex(operationValue(args.operation), { size: ACCESS_OPERATION_SIZE }),
    pad('0x', { size: ACCESS_PADDING_SIZE }),
    args.target.toLowerCase() as Hex,
  ]);
}

/**
 * A module-enforced policy has no access word, so its identity is what makes it
 * one policy: the type, the module deployment holding its state, and the Safe.
 *
 * The Safe and its chain are part of it deliberately. One allowance-module
 * policy exists per Safe, so a derivation over the type and module alone would
 * be identical for every Safe in a Space - and a Safe held on two chains would
 * collide with itself.
 */
export function modulePolicyId(args: {
  type: PolicyType;
  moduleAddress: Address;
  safe: SafeRef;
}): Hex {
  return derive(PolicyEnforcementKind.Module, {
    type: args.type,
    account: args.moduleAddress,
    safe: args.safe,
  });
}

/**
 * An off-chain grant is identified by the account it was granted to, scoped to
 * the Safe and chain it applies on for the same reason as above.
 */
export function offChainPolicyId(args: {
  type: PolicyType;
  grantee: Address;
  safe: SafeRef;
}): Hex {
  return derive(PolicyEnforcementKind.OffChain, {
    type: args.type,
    account: args.grantee,
    safe: args.safe,
  });
}

/**
 * The shared preimage of the two hashed derivations.
 *
 * The enforcement kind leads it as a domain separator: without it, a module
 * policy and an off-chain grant with the same type, Safe and address hash
 * identically, which would make two different things one row.
 */
function derive(
  via: PolicyEnforcementKind,
  args: { type: PolicyType; account: Address; safe: SafeRef },
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
      ],
      [
        via,
        args.type,
        BigInt(args.safe.chainId),
        args.account,
        args.safe.address,
      ],
    ),
  );
}
