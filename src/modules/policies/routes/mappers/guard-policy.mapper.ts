// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import { z } from 'zod';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import {
  type ActivePolicy,
  type ActivePolicyData,
  PolicyPermissionSchema,
} from '#/modules/policies/domain/entities/active-policy.entity';
import type {
  PolicyIndexerGuardPolicyBinding,
  PolicyIndexerGuardPolicyKind,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type {
  GuardSlots,
  PolicyContracts,
} from '#/modules/policies/domain/entities/policy-enforcement.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '#/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';

const Erc20TransferStateSchema = z.object({
  recipients: z.array(
    z.object({
      account: AddressSchema,
      permission: PolicyPermissionSchema,
    }),
  ),
});

const CosignerStateSchema = z.object({
  cosigner: AddressSchema,
});

const PAYLOADS: ReadonlyArray<{
  kind: PolicyIndexerGuardPolicyKind;
  type: PolicyType;
  data: (binding: PolicyIndexerGuardPolicyBinding) => ActivePolicyData | null;
}> = [
  {
    kind: 'ERC20_TRANSFER',
    type: PolicyType.Erc20Transfer,
    data: (binding) => {
      const state = Erc20TransferStateSchema.safeParse(binding.state);
      if (!state.success) {
        return null;
      }
      // The policy keys its recipients by token, and the access target is the
      // token.
      return {
        allowlist: [
          {
            token_address: binding.target,
            recipients: state.data.recipients,
          },
        ],
      };
    },
  },
  {
    kind: 'COSIGNER',
    type: PolicyType.Cosigner,
    data: (binding) => {
      const state = CosignerStateSchema.safeParse(binding.state);
      return state.success ? { cosigner_address: state.data.cosigner } : null;
    },
  },
  { kind: 'ALLOW', type: PolicyType.Allow, data: () => ({}) },
  { kind: 'DENY', type: PolicyType.Deny, data: () => ({}) },
  {
    kind: 'NATIVE_TRANSFER',
    type: PolicyType.NativeTransfer,
    data: () => ({}),
  },
];

export const GUARD_POLICY_TYPES: ReadonlyArray<PolicyType> = PAYLOADS.map(
  (payload) => payload.type,
);

export function guardPolicyKindsOf(
  types: ReadonlyArray<PolicyType>,
): Array<PolicyIndexerGuardPolicyKind> {
  return PAYLOADS.filter((payload) => types.includes(payload.type)).map(
    (payload) => payload.kind,
  );
}

@Injectable()
export class GuardPolicyMapper {
  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public map(args: {
    safe: SafeRef;
    bindings: ReadonlyArray<PolicyIndexerGuardPolicyBinding>;
    /** The guard in the Safe's transaction-guard slot. */
    transactionGuard: Address | null;
    /** The guard in the Safe's module-guard slot. */
    moduleGuard: Address | null;
  }): Array<ActivePolicy> {
    const guardPolicies: Array<ActivePolicy> = [];

    for (const binding of args.bindings) {
      const policy = this.toPolicy(binding, args);

      if (policy) {
        guardPolicies.push(policy);
      }
    }

    return guardPolicies;
  }

  private toPolicy(
    binding: PolicyIndexerGuardPolicyBinding,
    args: {
      safe: SafeRef;
      transactionGuard: Address | null;
      moduleGuard: Address | null;
    },
  ): ActivePolicy | null {
    const payload = PAYLOADS.find(({ kind }) => kind === binding.kind);

    if (!payload) {
      this.loggingService.warn({
        message: 'Skipping a policy kind CGW does not render',
        chainId: binding.chainId,
        safe: binding.safe,
        policy: binding.policy,
        kind: binding.kind,
      });
      return null;
    }

    const data = payload.data(binding);

    if (!data) {
      // The kind is known but its state is not the shape that kind implies,
      // which means the indexer's registry and CGW disagree about the address.
      this.loggingService.warn({
        message: 'Could not read the state of a policy',
        chainId: binding.chainId,
        safe: binding.safe,
        policy: binding.policy,
        kind: binding.kind,
      });
      return null;
    }

    const contracts: PolicyContracts = {
      policyContract: binding.policy,
      safePolicyGuard: binding.guard,
    };
    const guards: GuardSlots = {
      ...(isGuardSet(args.transactionGuard, binding.guard) && {
        transactionGuard: contracts,
      }),
      ...(isGuardSet(args.moduleGuard, binding.guard) && {
        moduleGuard: contracts,
      }),
    };

    return {
      type: payload.type,
      enforcement: { via: PolicyEnforcementKind.Guard, guards },
      // Configured on the guard, but only enforced while the Safe has that
      // guard set in a slot - a policy configured through configureImmediately
      // before setGuard is reported, with no slot, rather than hidden.
      enabled: Object.keys(guards).length > 0,
      data,
      safe: args.safe,
    };
  }
}

function isGuardSet(slot: Address | null, guard: Address): boolean {
  return slot !== null && isAddressEqual(slot, guard);
}
