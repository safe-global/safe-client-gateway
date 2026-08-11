// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type {
  ActivePolicyData,
  NamedAddress,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyGroup } from '@/modules/policies/domain/entities/policy-group.entity';
import type { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * Address book names of a space, keyed by lower-cased address.
 */
export type AddressNames = ReadonlyMap<string, string>;

/**
 * A policy shaped for the wallet, before the Safe-level facts (which guard slot
 * enforces it, and whether that guard is enabled) are attached.
 *
 * `groups` are the accesses the item covers; the caller reads their newest event
 * for those facts, since only it knows the Safe.
 */
export type ResolvedPolicy = {
  id: Hex;
  type: PolicyType;
  data: ActivePolicyData;
  groups: Array<PolicyGroup>;
};

export type PolicyResolverContext = {
  chainId: string;
  /** Only the groups whose bound policy is of the resolver's type. */
  groups: Array<PolicyGroup>;
  names: AddressNames;
};

/**
 * Aggregates the groups of one policy type into wallet-facing policies.
 *
 * Grouping the events by access and picking the bound policy is done once, for
 * every type, by `policyGroups`. A resolver only decides what its type's events
 * mean: whether the payloads accumulate or the newest replaces the rest, and
 * whether several accesses fold into one item.
 *
 * One implementation per policy type; adding a type means adding a resolver, not
 * changing the service.
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
