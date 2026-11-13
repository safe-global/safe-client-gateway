// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyIndexerGuardPolicyKind } from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
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
  guardPolicyKinds: ReadonlyArray<PolicyIndexerGuardPolicyKind>;
  roots: ReadonlyArray<PolicyIndexerPairFilter>;
};

/**
 * Current policy state for a set of Safes.
 *
 * The indexer calls its `SafePolicyGuard` bindings `SafePolicy`; they are
 * aliased to `GuardPolicyBinding` so the name says what a row is.
 *
 * `ConfigurationRoot` is not filtered by status: an applied or invalidated root
 * is not pending, but knowing it was requested at all is what tells it apart
 * from configurations stored in CGW that nobody requested yet - a draft.
 */
export const POLICY_INDEXER_STATE_QUERY = `query PolicyIndexerState(
  $allowances: [SafeAllowance_bool_exp!]!
  $delegates: [SafeDelegate_bool_exp!]!
  $guardPolicyBindings: [SafePolicy_bool_exp!]!
  $guardPolicyKinds: [policykind!]!
  $roots: [ConfigurationRoot_bool_exp!]!
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
    where: { _or: $guardPolicyBindings, active: { _eq: true }, kind: { _in: $guardPolicyKinds } }
    order_by: [{ chainId: asc }, { safe: asc }, { target: asc }, { selector: asc }]
  ) {
    chainId safe guard target selector operation kind policy state
  }
  ConfigurationRoot(
    where: { _or: $roots }
    order_by: [{ chainId: asc }, { safe: asc }, { readyAt: asc }]
  ) {
    chainId safe guard root readyAt expiresAt status
  }
}`;

/**
 * Groups {@link safes} per chain into the query's filter variables.
 */
export function toPolicyIndexerVariables(
  safes: ReadonlyArray<SafeRef>,
  guardPolicyKinds: ReadonlyArray<PolicyIndexerGuardPolicyKind>,
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

  const guardPolicyGroups = guardPolicyKinds.length > 0 ? groups : [];

  // The same groups for each, since the pairs are the same set.
  return {
    allowances: groups,
    delegates: groups,
    guardPolicyBindings: guardPolicyGroups,
    guardPolicyKinds,
    roots: guardPolicyGroups,
  };
}
