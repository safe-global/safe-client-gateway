// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import type {
  ActivePolicy,
  SpendingLimitAllowance,
  SpendingLimitPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import { moduleEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

const MILLISECONDS_IN_MINUTE = 60_000;

/**
 * Builds the `spending-limit` policies of one Safe from the allowance module's
 * aggregated indexer rows.
 *
 * The indexer serves one flat row per `(module, delegate, token)`.
 */
@Injectable()
export class SpendingLimitMapper {
  /**
   * One policy per module the Safe holds limits on.
   *
   * A chain can have more than one deployment of the allowance module at once,
   * each with its own storage, so two deployments are two policies and are
   * never merged.
   */
  public map(args: {
    safe: SafeRef;
    /** Already scoped to {@link args.safe} by the caller. */
    allowances: ReadonlyArray<PolicyIndexerSafeAllowance>;
    enabledModules: ReadonlyArray<Address>;
  }): Array<ActivePolicy> {
    const nonZeroAllowances = args.allowances.filter(
      (allowance) => BigInt(allowance.amount) > 0n,
    );
    const allowancesByModule = this.groupByModule(nonZeroAllowances);

    const spendingLimitPolicies: Array<ActivePolicy> = [];

    for (const [module, limits] of allowancesByModule) {
      spendingLimitPolicies.push({
        type: PolicyType.SpendingLimit,
        enforcement: moduleEnforcement(module),
        // Configured on the module, but only enforced while the Safe has it
        // enabled - a limit on a disabled module is not a limit.
        enabled: args.enabledModules.some((enabled) =>
          isAddressEqual(enabled, module),
        ),
        data: { module, spenders: this.toSpenders(limits) },
        safe: args.safe,
      });
    }

    return spendingLimitPolicies;
  }

  /**
   * One entry per delegate allowed to spend on the module, with every token
   * that delegate has a limit for nested inside it.
   */
  private toSpenders(
    allowances: ReadonlyArray<PolicyIndexerSafeAllowance>,
  ): SpendingLimitPolicyData['spenders'] {
    const limitsBySpender = this.groupByDelegate(allowances);

    const spenders: SpendingLimitPolicyData['spenders'] = [];

    for (const [spender, spenderLimits] of limitsBySpender) {
      spenders.push({
        spender,
        // Every row of one `(module, delegate)` carries the same registration.
        isActive: spenderLimits[0].isDelegateActive,
        allowances: spenderLimits.map((limit) => this.toAllowance(limit)),
      });
    }

    return spenders;
  }

  /**
   * One token's ceiling, what has been spent against it, and when the window
   * rolls over.
   */
  private toAllowance(
    allowance: PolicyIndexerSafeAllowance,
  ): SpendingLimitAllowance {
    const resetsPeriodically = allowance.resetTimeMinutes > 0;

    return {
      tokenAddress: allowance.token,
      amount: allowance.amount,
      spent: allowance.spent,
      resetPeriodMinutes: allowance.resetTimeMinutes,
      // The indexer serves the window start, not the boundary: a never-resetting
      // allowance has no next reset to report.
      resetsAtMinute: resetsPeriodically
        ? this.nextResetMinute(allowance)
        : null,
      resetBoundaryIsExact: allowance.resetPhase === 'EXACT',
      isDelegateActive: allowance.isDelegateActive,
    };
  }

  /**
   * The minute the window next rolls over.
   *
   * `lastResetMin` is only rewritten by a transfer: the AllowanceModule updates the
   * value lazily, inside `_updateAllowance`.
   * @see https://github.com/safe-fndn/safe-modules/blob/8076191f93e88eefaae3508efa8b12a091158c68/modules/allowances/contracts/AllowanceModule.sol#L93
   */
  private nextResetMinute(allowance: PolicyIndexerSafeAllowance): number {
    const nowMinutes = Math.floor(Date.now() / MILLISECONDS_IN_MINUTE);
    const elapsedMinutes = nowMinutes - allowance.lastResetMin;
    const periodsToNextReset =
      Math.floor(elapsedMinutes / allowance.resetTimeMinutes) + 1;

    return (
      allowance.lastResetMin + periodsToNextReset * allowance.resetTimeMinutes
    );
  }

  /**
   * The allowance rows of each module the Safe holds limits on.
   */
  private groupByModule(
    allowances: ReadonlyArray<PolicyIndexerSafeAllowance>,
  ): Map<Address, Array<PolicyIndexerSafeAllowance>> {
    return this.groupByAddress(allowances, (allowance) => allowance.module);
  }

  /**
   * The allowance rows of each delegate allowed to spend on one module.
   */
  private groupByDelegate(
    allowances: ReadonlyArray<PolicyIndexerSafeAllowance>,
  ): Map<Address, Array<PolicyIndexerSafeAllowance>> {
    return this.groupByAddress(allowances, (allowance) => allowance.delegate);
  }

  /**
   * Groups allowance rows under the address {@link address} reads off each one.
   *
   * Only {@link groupByModule} and {@link groupByDelegate} call this - they name
   * which address is being grouped on, so no caller passes a selector inline.
   *
   * Keys are checksummed, as the indexer serves them. First-seen order is
   * preserved so the indexer's ordering survives into the response.
   */
  private groupByAddress(
    allowances: ReadonlyArray<PolicyIndexerSafeAllowance>,
    address: (allowance: PolicyIndexerSafeAllowance) => Address,
  ): Map<Address, Array<PolicyIndexerSafeAllowance>> {
    const grouped = new Map<Address, Array<PolicyIndexerSafeAllowance>>();

    for (const allowance of allowances) {
      const group = grouped.get(address(allowance)) ?? [];
      group.push(allowance);
      grouped.set(address(allowance), group);
    }

    return grouped;
  }
}
