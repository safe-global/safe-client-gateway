// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import { PolicyEnforcementKind } from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * The contract pair backing one guard-enforced policy: the `SafePolicyGuard`
 * the Safe delegates to, and the policy implementation the guard delegates to.
 */
export type PolicyContracts = {
  policyContract: Address;
  safePolicyGuard: Address;
};

/**
 * Which guard slot(s) of the Safe enforce a policy. A `SafePolicyGuard` can be
 * set as the transaction guard, the module guard, or both.
 */
export type GuardSlots = {
  transactionGuard?: PolicyContracts;
  moduleGuard?: PolicyContracts;
};

export type ModuleEnforcement = {
  via: typeof PolicyEnforcementKind.Module;
  moduleAddress: Address;
};

export type GuardEnforcement = {
  via: typeof PolicyEnforcementKind.Guard;
  guards: GuardSlots;
};

/**
 * Where an off-chain policy data is held.
 */
export const OffChainSource = {
  /** A delegate of the Transaction Service. */
  Delegates: 'delegates',
} as const;

export type OffChainSource =
  (typeof OffChainSource)[keyof typeof OffChainSource];

/** A proposer grant, and the store it is held in. */
export type OffChainEnforcement = {
  via: typeof PolicyEnforcementKind.OffChain;
  source: OffChainSource;
};

export type PolicyEnforcement =
  | ModuleEnforcement
  | GuardEnforcement
  | OffChainEnforcement;

export function moduleEnforcement(moduleAddress: Address): ModuleEnforcement {
  return { via: PolicyEnforcementKind.Module, moduleAddress };
}

export function guardEnforcement(guards: GuardSlots): GuardEnforcement {
  return { via: PolicyEnforcementKind.Guard, guards };
}

export function offChainEnforcement(
  source: OffChainSource,
): OffChainEnforcement {
  return { via: PolicyEnforcementKind.OffChain, source };
}
