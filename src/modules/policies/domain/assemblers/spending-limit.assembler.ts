// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type {
  PolicyAssembler,
  PolicyAssemblerContext,
} from '@/modules/policies/domain/assemblers/policy-assembler.interface';
import type {
  ActivePolicy,
  SpendingLimitAllowance,
  SpendingLimitPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type {
  IndexerSafeAllowance,
  IndexerSafeDelegate,
} from '@/modules/policies/domain/entities/indexer/safe-allowance.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';

const SECONDS_IN_MINUTE = 60;

/**
 * Builds the spending limits of a Safe from the allowance module's aggregated
 * rows.
 *
 * One policy per `(safe, module deployment)`, with every spender and every token
 * nested inside it - which is what the create flow produces in one run, and what
 * the Policies page renders as one row.
 *
 * `SafeDelegate` supplies nothing but the registration flag: a delegate with no
 * allowance is not a spending limit, so the rows are read for `isActive` and
 * never to add a spender.
 */
@Injectable()
export class SpendingLimitAssembler implements PolicyAssembler {
  private readonly type = PolicyType.SpendingLimit;

  public assemble(context: PolicyAssemblerContext): Array<ActivePolicy> {
    const spendable = context.state.allowances.filter(isConfigured);
    const perModule = groupBy(spendable, (allowance) => allowance.module);

    return [...perModule.entries()].map(([module, allowances]) => ({
      type: this.type,
      enforcement: {
        via: PolicyEnforcementKind.Module,
        moduleAddress: module,
      },
      // Configured on the module, but only enforced while the Safe has it
      // enabled - a limit on a disabled module is not a limit.
      enabled: context.enabledModules.some(
        (enabled) => enabled.toLowerCase() === module.toLowerCase(),
      ),
      data: this.toData({
        module,
        allowances,
        delegates: context.state.delegates,
      }),
    }));
  }

  private toData(args: {
    module: Address;
    allowances: Array<IndexerSafeAllowance>;
    delegates: ReadonlyArray<IndexerSafeDelegate>;
  }): SpendingLimitPolicyData {
    const perSpender = groupBy(
      args.allowances,
      (allowance) => allowance.delegate,
    );

    return {
      module: args.module,
      spenders: [...perSpender.entries()].map(([spender, allowances]) => ({
        spender,
        isActive: this.isRegistered({
          delegates: args.delegates,
          module: args.module,
          spender,
        }),
        allowances: allowances.map((allowance) => this.toAllowance(allowance)),
      })),
    };
  }

  /**
   * Whether the spender may spend right now.
   *
   * The allowance row no longer carries this, so it comes from the delegate
   * registration of the same `(module, delegate)`. A spender with no row at all
   * is one whose registration was removed: `RemoveDelegate` unlinks a list node
   * and leaves the allowances behind, so the limits are reported as
   * present-but-unspendable rather than dropped.
   */
  private isRegistered(args: {
    delegates: ReadonlyArray<IndexerSafeDelegate>;
    module: Address;
    spender: Address;
  }): boolean {
    return args.delegates.some(
      (delegate) =>
        delegate.module === args.module &&
        delegate.delegate === args.spender &&
        delegate.active,
    );
  }

  private toAllowance(allowance: IndexerSafeAllowance): SpendingLimitAllowance {
    const resets = allowance.resetTimeMinutes > 0;

    return {
      token_address: allowance.token,
      amount: allowance.amount,
      spent: allowance.spent,
      resetPeriodSeconds: allowance.resetTimeMinutes * SECONDS_IN_MINUTE,
      // The indexer serves the window start, not the boundary: a never-resetting
      // allowance has no next reset to report.
      resetsAt: resets
        ? (allowance.lastResetMin + allowance.resetTimeMinutes) *
          SECONDS_IN_MINUTE
        : null,
      resetBoundaryIsExact: allowance.resetPhase === 'EXACT',
    };
  }
}

/**
 * `resetAllowance` and `deleteAllowance` have no registered-delegate check, so
 * an all-zero row can exist for a pair that was never configured.
 */
function isConfigured(allowance: IndexerSafeAllowance): boolean {
  return BigInt(allowance.amount) > 0n;
}

/**
 * Groups by a checksummed address key, preserving first-seen order so the
 * indexer's ordering survives into the response.
 */
function groupBy<T>(
  items: ReadonlyArray<T>,
  key: (item: T) => Address,
): Map<Address, Array<T>> {
  const grouped = new Map<Address, Array<T>>();

  for (const item of items) {
    const group = grouped.get(key(item)) ?? [];
    group.push(item);
    grouped.set(key(item), group);
  }

  return grouped;
}
