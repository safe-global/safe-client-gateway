// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type {
  ActivePolicyData,
  NamedAddress,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import type { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * Address book names of a space, keyed by lower-cased address.
 */
export type AddressNames = ReadonlyMap<string, string>;

/**
 * A policy shaped for the wallet, before the Safe-level facts (which guard slot
 * enforces it, and whether that guard is enabled) are attached.
 *
 * `sources` are the confirmations the item was built from; the caller derives
 * `enforcement` and `enabled` from them, since only it knows the Safe.
 */
export type ResolvedPolicy = {
  id: Hex;
  type: PolicyType;
  data: ActivePolicyData;
  sources: Array<PolicyConfirmation>;
};

export type PolicyResolverContext = {
  chainId: string;
  /** Only the confirmations whose policy address implements `type`. */
  confirmations: Array<PolicyConfirmation>;
  names: AddressNames;
};

/**
 * Turns the indexed confirmations of one policy type into wallet-facing
 * policies.
 *
 * One implementation per guard-enforced policy type: each owns the schema of
 * its `data` payload and how several confirmations combine into one item.
 * Adding a policy type means adding a resolver, not changing the service.
 */
export interface PolicyResolver {
  readonly type: PolicyType;

  resolve(context: PolicyResolverContext): Promise<Array<ResolvedPolicy>>;
}

/**
 * Builds a {@link NamedAddress} from the space address book.
 *
 * An address the book does not name yields no `name` key at all, rather than a
 * null one.
 */
export function namedAddress(
  address: Address,
  names: AddressNames,
): NamedAddress {
  const name = names.get(address.toLowerCase());
  return name === undefined ? { address } : { address, name };
}
