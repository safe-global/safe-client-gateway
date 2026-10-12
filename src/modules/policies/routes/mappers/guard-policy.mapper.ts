// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import type {
  ActivePolicy,
  ActivePolicyData,
} from '#/modules/policies/domain/entities/active-policy.entity';
import type {
  PolicyIndexerGuardPolicyBinding,
  PolicyIndexerGuardPolicyKind,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import {
  type GuardSlots,
  guardEnforcement,
} from '#/modules/policies/domain/entities/policy-enforcement.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';

const POLICY_TYPE_BY_KIND = new Map<PolicyIndexerGuardPolicyKind, PolicyType>([
  ['ERC20_TRANSFER', PolicyType.Erc20Transfer],
  ['COSIGNER', PolicyType.Cosigner],
  ['ALLOW', PolicyType.Allow],
  ['DENY', PolicyType.Deny],
  ['NATIVE_TRANSFER', PolicyType.NativeTransfer],
  ['MULTISEND', PolicyType.MultiSend],
]);

export const GUARD_POLICY_TYPES: ReadonlyArray<PolicyType> = [
  ...POLICY_TYPE_BY_KIND.values(),
];

export function guardPolicyKindsOf(
  types: ReadonlyArray<PolicyType>,
): Array<PolicyIndexerGuardPolicyKind> {
  return [...POLICY_TYPE_BY_KIND]
    .filter(([, type]) => types.includes(type))
    .map(([kind]) => kind);
}

@Injectable()
export class GuardPolicyMapper {
  public map(args: {
    safe: SafeRef;
    bindings: ReadonlyArray<PolicyIndexerGuardPolicyBinding>;
    transactionGuard: Address | null;
    moduleGuard: Address | null;
  }): Array<ActivePolicy> {
    const guardPolicies: Array<ActivePolicy> = [];

    for (const binding of args.bindings) {
      const type = POLICY_TYPE_BY_KIND.get(binding.kind);

      // Only rendered kinds are requested, so this is a kind asked for by
      // mistake rather than one the indexer volunteered.
      if (!type) {
        continue;
      }

      const guards = this.toGuardSlots(binding, args);

      guardPolicies.push({
        type,
        enforcement: guardEnforcement(guards),
        // Configured on the guard, but only enforced while the Safe has that
        // guard set - a policy configured before setGuard is reported, with no
        // slot, rather than hidden.
        enabled: Object.keys(guards).length > 0,
        data: this.toData(binding),
        safe: args.safe,
      });
    }

    return guardPolicies;
  }

  /**
   * The payload of a policy.
   */
  private toData(binding: PolicyIndexerGuardPolicyBinding): ActivePolicyData {
    switch (binding.kind) {
      case 'ERC20_TRANSFER':
        // The policy keys its recipients by token, and the access target is
        // the token.
        return {
          allowlist: [
            {
              token_address: binding.target,
              recipients: binding.state.recipients,
            },
          ],
        };
      case 'COSIGNER':
        return { cosigner_address: binding.state.cosigner };
      default:
        // Allow, deny, native transfer and multisend carry no configuration.
        return {};
    }
  }

  /**
   * The Safe's guard slots that hold the binding's guard. The transaction
   * guard checks owner transactions, the module guard module transactions.
   */
  private toGuardSlots(
    binding: PolicyIndexerGuardPolicyBinding,
    slots: { transactionGuard: Address | null; moduleGuard: Address | null },
  ): GuardSlots {
    const contracts = {
      policyContract: binding.policy,
      safePolicyGuard: binding.guard,
    };
    const holdsGuard = (slot: Address | null): boolean =>
      slot !== null && isAddressEqual(slot, binding.guard);

    return {
      ...(holdsGuard(slots.transactionGuard) && {
        transactionGuard: contracts,
      }),
      ...(holdsGuard(slots.moduleGuard) && { moduleGuard: contracts }),
    };
  }
}
