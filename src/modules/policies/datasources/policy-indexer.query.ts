// SPDX-License-Identifier: FSL-1.1-MIT
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

/**
 * One filter group per chain, as the indexer's generated `*_bool_exp` types.
 *
 * A flat `chainId: {_in: […]}` combined with `safe: {_in: […]}` is a
 * **cross-product**: it also returns rows for a Safe on a chain it is not held
 * on. Grouping per chain under `_or` is what keeps a Space's pairs exact.
 */
type IndexerPairFilter = {
  chainId: { _eq: number };
  safe: { _in: Array<string> };
};

export type PolicyIndexerVariables = {
  allowances: Array<IndexerPairFilter>;
  delegates: Array<IndexerPairFilter>;
};

/**
 * Current allowance-module state for a set of Safes, in one round-trip.
 *
 * The two row fields take separate variables because each entity has its own
 * generated `*_bool_exp` type, even though both groups hold the same pairs.
 *
 * `SafePolicy` and `ConfigurationRoot` are root fields this document does not
 * pay for: the PRs reporting guard policies and pending configurations add them.
 */
export const POLICY_INDEXER_STATE_QUERY = `query PolicyIndexerState(
  $allowances: [SafeAllowance_bool_exp!]!
  $delegates: [SafeDelegate_bool_exp!]!
) {
  _meta { chainId progressBlock sourceBlock isReady }
  SafeAllowance(
    where: { _or: $allowances }
    order_by: [{ chainId: asc }, { safe: asc }, { delegate: asc }, { token: asc }]
  ) {
    chainId safe module moduleVersion delegate token delegateActive
    amount spent remaining resetTimeMinutes lastResetMin resetPhase nonce updatedAt
  }
  SafeDelegate(
    where: { _or: $delegates }
    order_by: [{ chainId: asc }, { safe: asc }, { delegate: asc }]
  ) {
    chainId safe module moduleVersion delegate active addedAt updatedAt
  }
}`;

/**
 * Groups {@link safes} per chain into the query's filter variables.
 *
 * Addresses are passed through as given, which is why callers hand this
 * checksummed ones: the indexer stores addresses checksummed and a lower-cased
 * address in a filter matches nothing **and returns no error**, so the failure
 * mode is an empty, entirely plausible list.
 */
export function toPolicyIndexerVariables(
  safes: ReadonlyArray<SafeRef>,
): PolicyIndexerVariables {
  const perChain = new Map<string, Array<string>>();

  for (const safe of safes) {
    const addresses = perChain.get(safe.chainId) ?? [];
    if (!addresses.includes(safe.address)) {
      addresses.push(safe.address);
    }
    perChain.set(safe.chainId, addresses);
  }

  const groups = [...perChain.entries()].map(([chainId, addresses]) => ({
    chainId: { _eq: Number(chainId) },
    safe: { _in: addresses },
  }));

  // The same groups for both, since the pairs are the same set.
  return { allowances: groups, delegates: groups };
}
