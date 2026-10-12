// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyIndexerPolicyKind } from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';

/**
 * One filter group per chain, as the indexer's generated `*_bool_exp` types.
 */
type PolicyIndexerPairFilter = {
  chainId: { _eq: number };
  safe: { _in: Array<string> };
};

export type PolicyIndexerVariables = {
  allowances: ReadonlyArray<PolicyIndexerPairFilter>;
  delegates: ReadonlyArray<PolicyIndexerPairFilter>;
  guardPolicyBindings: ReadonlyArray<PolicyIndexerPairFilter>;
  policyKinds: ReadonlyArray<PolicyIndexerPolicyKind>;
};

/**
 * Current allowance-module state for a set of Safes.
 *
 * The indexer calls its `SafePolicyGuard` bindings `SafePolicy`; they are
 * aliased to `GuardPolicyBinding` so the name says what a row is.
 */
export const POLICY_INDEXER_STATE_QUERY = `query PolicyIndexerState(
  $allowances: [SafeAllowance_bool_exp!]!
  $delegates: [SafeDelegate_bool_exp!]!
  $guardPolicyBindings: [SafePolicy_bool_exp!]!
  $policyKinds: [String!]!
) {
  _meta { chainId progressBlock sourceBlock isReady }
  SafeAllowance(
    where: { _or: $allowances }
    order_by: [{ chainId: asc }, { safe: asc }, { delegate: asc }, { token: asc }]
  ) {
    chainId safe module moduleVersion delegate token
    amount spent remaining resetTimeMinutes lastResetMin resetPhase nonce createdAt updatedAt
  }
  SafeDelegate(
    where: { _or: $delegates }
    order_by: [{ chainId: asc }, { safe: asc }, { delegate: asc }]
  ) {
    chainId safe module moduleVersion delegate active addedAt updatedAt
  }
  GuardPolicyBinding: SafePolicy(
    where: { _or: $guardPolicyBindings, active: { _eq: true }, kind: { _in: $policyKinds } }
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
  policyKinds: ReadonlyArray<PolicyIndexerPolicyKind>,
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
  return {
    allowances: groups,
    delegates: groups,
    guardPolicyBindings: groups,
    policyKinds: policyKinds,
  };
}
