// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import type {
  PolicyAssembler,
  PolicyAssemblerContext,
} from '@/modules/policies/domain/assemblers/policy-assembler.interface';
import type {
  ActivePolicy,
  SpendingLimitAllowance,
  SpendingLimitPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';

const MILLISECONDS_IN_MINUTE = 60_000;

/**
 * Builds the spending limits of a Safe from the allowance module's aggregated
 * rows.
 *
 * One policy per `(safe, module deployment)`, with every spender and every token
 * nested inside it - which is what the create flow produces in one run, and what
 * the Policies page renders as one row.
 */
@Injectable()
export class SpendingLimitAssembler implements PolicyAssembler {
  private readonly type = PolicyType.SpendingLimit;

  public assemble(context: PolicyAssemblerContext): Array<ActivePolicy> {
    const spendable = context.state.allowances.filter(this.isConfigured);
    const perModule = this.groupBy(spendable, (allowance) => allowance.module);

    return [...perModule.entries()].map(([module, allowances]) => ({
      type: this.type,
      enforcement: {
        via: PolicyEnforcementKind.Module,
        moduleAddress: module,
      },
      // Configured on the module, but only enforced while the Safe has it
      // enabled - a limit on a disabled module is not a limit.
      enabled: context.enabledModules.some((enabled) =>
        isAddressEqual(enabled, module),
      ),
      data: this.toData({ module, allowances }),
    }));
  }

  private toData(args: {
    module: Address;
    allowances: Array<PolicyIndexerSafeAllowance>;
  }): SpendingLimitPolicyData {
    const perSpender = this.groupBy(
      args.allowances,
      (allowance) => allowance.delegate,
    );

    return {
      module: args.module,
      spenders: [...perSpender.entries()].map(([spender, allowances]) => ({
        spender,
        // Every row of one `(module, delegate)` carries the same registration.
        isActive: allowances[0].isDelegateActive,
        allowances: allowances.map((allowance) => this.toAllowance(allowance)),
      })),
    };
  }

  private toAllowance(
    allowance: PolicyIndexerSafeAllowance,
  ): SpendingLimitAllowance {
    const resets = allowance.resetTimeMinutes > 0;

    return {
      tokenAddress: allowance.token,
      amount: allowance.amount,
      spent: allowance.spent,
      resetPeriodMinutes: allowance.resetTimeMinutes,
      // The indexer serves the window start, not the boundary: a never-resetting
      // allowance has no next reset to report.
      resetsAtMinute: resets ? this.nextResetMinute(allowance) : null,
      resetBoundaryIsExact: allowance.resetPhase === 'EXACT',
      isDelegateActive: allowance.isDelegateActive,
    };
  }

  /**
   * The minute the window next rolls over.
   *
   * `lastResetMin` is only rewritten by a transfer: the AllowanceModule updates the
   * value lazily, inside `_updateAllowance`.
   */
  private nextResetMinute(allowance: PolicyIndexerSafeAllowance): number {
    const nowMinutes = Math.floor(Date.now() / MILLISECONDS_IN_MINUTE);
    const elapsed = nowMinutes - allowance.lastResetMin;
    const periods = Math.floor(elapsed / allowance.resetTimeMinutes) + 1;

    return allowance.lastResetMin + periods * allowance.resetTimeMinutes;
  }

  /**
   * `resetAllowance` and `deleteAllowance` have no registered-delegate check, so
   * an all-zero row can exist for a pair that was never configured.
   */
  private isConfigured(allowance: PolicyIndexerSafeAllowance): boolean {
    return BigInt(allowance.amount) > 0n;
  }

  /**
   * Groups by a checksummed address key, preserving first-seen order so the
   * indexer's ordering survives into the response.
   */
  private groupBy<T>(
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
}
