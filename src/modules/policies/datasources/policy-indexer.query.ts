// SPDX-License-Identifier: FSL-1.1-MIT
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

/**
 * One filter group per chain, as the indexer's generated `*_bool_exp` types.
 */
type PolicyIndexerPairFilter = {
  chainId: { _eq: number };
  safe: { _in: Array<string> };
};

export type PolicyIndexerVariables = {
  allowances: Array<PolicyIndexerPairFilter>;
  delegates: Array<PolicyIndexerPairFilter>;
  policies: Array<PolicyIndexerPairFilter>;
};

/**
 * Current allowance-module state for a set of Safes.
 */
export const POLICY_INDEXER_STATE_QUERY = `query PolicyIndexerState(
  $allowances: [SafeAllowance_bool_exp!]!
  $delegates: [SafeDelegate_bool_exp!]!
  $policies: [SafePolicy_bool_exp!]!
) {
  _meta { chainId progressBlock sourceBlock isReady }
  SafeAllowance(
    where: { _or: $allowances }
    order_by: [{ chainId: asc }, { safe: asc }, { delegate: asc }, { token: asc }]
  ) {
    chainId safe module moduleVersion delegate token
    amount spent remaining resetTimeMinutes lastResetMin resetPhase nonce updatedAt
  }
  SafeDelegate(
    where: { _or: $delegates }
    order_by: [{ chainId: asc }, { safe: asc }, { delegate: asc }]
  ) {
    chainId safe module moduleVersion delegate active addedAt updatedAt
  }
  SafePolicy(
    where: { _or: $policies, active: { _eq: true } }
    order_by: [{ chainId: asc }, { safe: asc }, { target: asc }, { selector: asc }]
  ) {
    chainId safe guard target selector operation kind policy active isFallback state
  }
}`;

/**
 * Groups {@link safes} per chain into the query's filter variables.
 */
export function toPolicyIndexerVariables(
  safes: ReadonlyArray<SafeRef>,
): PolicyIndexerVariables {
  const safesPerChain = new Map<string, Array<string>>();

  for (const safe of safes) {
    const addresses = safesPerChain.get(safe.chainId) ?? [];
    if (!addresses.includes(safe.address)) {
      addresses.push(safe.address);
    }
    safesPerChain.set(safe.chainId, addresses);
  }

  const groups = [...safesPerChain.entries()].map(([chainId, addresses]) => ({
    chainId: { _eq: Number(chainId) },
    safe: { _in: addresses },
  }));

  // The same groups for each, since the pairs are the same set.
  return { allowances: groups, delegates: groups, policies: groups };
}
