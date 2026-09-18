// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import { z } from 'zod';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  type ActivePolicy,
  type ActivePolicyData,
  PolicyPermission,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type {
  PolicyIndexerPolicyKind,
  PolicyIndexerSafePolicy,
} from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * The accumulated configuration of the two policies that hold any, as the
 * indexer stores it in `SafePolicy.state`.
 *
 * The policy contracts' `configure` is an upsert of deltas, so only the folded
 * sequence describes the state - which the indexer has already folded. CGW
 * parses the result rather than replaying anything.
 *
 * An allowlist entry is an address plus how far its grant reaches. `permission`
 * lives inside the indexer's `jsonb` rather than in a column, so it carries no
 * schema signal and CGW validates the value set itself - rejecting rather than
 * defaulting, since guessing between a single-use and an open-ended grant is the
 * wrong way to be wrong about a permission.
 */
const Erc20TransferStateSchema = z.object({
  recipients: z.array(
    z.object({
      account: AddressSchema,
      permission: z.enum(PolicyPermission),
    }),
  ),
});

const CosignerStateSchema = z.object({
  cosigner: AddressSchema,
});

/**
 * Turns one `SafePolicy` row into the payload its kind implies.
 *
 * A kind absent from this map is one CGW does not render - `ERC20_APPROVE`,
 * `ALLOWED_MODULE`, `MULTISEND`, and the `NONE`/`UNKNOWN` the indexer reports
 * for an unbound or unregistered policy. Skipping them is deliberate: rendering
 * an unknown restriction is worse than omitting it.
 */
const PAYLOADS: Partial<
  Record<
    PolicyIndexerPolicyKind,
    {
      type: PolicyType;
      /** `null` when the state is not the shape the kind implies. */
      data: (binding: PolicyIndexerSafePolicy) => ActivePolicyData | null;
    }
  >
> = {
  ERC20_TRANSFER: {
    type: PolicyType.Erc20Transfer,
    data: (binding) => {
      const state = Erc20TransferStateSchema.safeParse(binding.state);
      if (!state.success) {
        return null;
      }
      // The policy keys its recipients by token, and the access target *is* the
      // token - so the binding names the token its list applies to.
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
  COSIGNER: {
    type: PolicyType.Cosigner,
    data: (binding) => {
      const state = CosignerStateSchema.safeParse(binding.state);
      return state.success ? { cosigner_address: state.data.cosigner } : null;
    },
  },
  ALLOW: { type: PolicyType.Allow, data: () => ({}) },
  DENY: { type: PolicyType.Deny, data: () => ({}) },
  NATIVE_TRANSFER: { type: PolicyType.NativeTransfer, data: () => ({}) },
};

/**
 * Builds the guard-enforced policies of one Safe from the `SafePolicyGuard`
 * bindings the indexer serves.
 *
 * One item per binding. Rows that share a storage key already carry the same
 * accumulated `state` - the indexer writes it to all of them - so the "fold
 * `transfer` and `transferFrom` into one entry" step that event aggregation
 * needed does not exist here.
 */
@Injectable()
export class GuardPolicyMapper {
  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public map(args: {
    safe: SafeRef;
    /** Already scoped to {@link args.safe} by the caller. */
    policies: ReadonlyArray<PolicyIndexerSafePolicy>;
    /**
     * The guard set on the Safe, which is what makes a guard policy enforced.
     *
     * Only the transaction guard slot: the module guard cannot be read from the
     * Transaction Service's single-Safe endpoint yet (WA-2914).
     */
    transactionGuard: Address | null;
  }): Array<ActivePolicy> {
    const guardPolicies: Array<ActivePolicy> = [];

    for (const binding of args.policies) {
      const policy = this.toPolicy(binding, args);

      if (policy) {
        guardPolicies.push(policy);
      }
    }

    return guardPolicies;
  }

  private toPolicy(
    binding: PolicyIndexerSafePolicy,
    args: { safe: SafeRef; transactionGuard: Address | null },
  ): ActivePolicy | null {
    const payload = PAYLOADS[binding.kind];

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

    return {
      type: payload.type,
      enforcement: {
        via: PolicyEnforcementKind.Guard,
        guards: {
          transactionGuard: {
            policyContract: binding.policy,
            safePolicyGuard: binding.guard,
          },
        },
      },
      // Configured on the guard, but only enforced while the Safe has that
      // guard set - a policy configured through configureImmediately before
      // setGuard is reported rather than hidden.
      enabled:
        args.transactionGuard !== null &&
        isAddressEqual(args.transactionGuard, binding.guard),
      data,
      safe: args.safe,
    };
  }
}
