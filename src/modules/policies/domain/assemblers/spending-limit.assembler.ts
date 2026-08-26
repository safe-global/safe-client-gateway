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
import type { IndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/safe-allowance.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';
import { modulePolicyId } from '@/modules/policies/domain/utils/policy-id.utils';

const SECONDS_IN_MINUTE = 60;

/**
 * Builds the spending limits of a Safe from the allowance module's aggregated
 * rows.
 *
 * One policy per `(safe, module deployment)`, with every spender and every token
 * nested inside it - which is what the create flow produces in one run, and what
 * the Policies page renders as one row.
 *
 * `SafeDelegate` is not read here: a delegate with no allowance is not a
 * spending limit, and each allowance row already carries the registration flag
 * it needs.
 */
@Injectable()
export class SpendingLimitAssembler implements PolicyAssembler {
  private readonly type = PolicyType.SpendingLimit;

  public assemble(context: PolicyAssemblerContext): Array<ActivePolicy> {
    const spendable = context.state.allowances.filter(isConfigured);
    const perModule = groupBy(spendable, (allowance) => allowance.module);

    return [...perModule.entries()].map(([module, allowances]) => ({
      id: modulePolicyId({
        type: this.type,
        moduleAddress: module,
        safe: context.safe,
      }),
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
      data: this.toData({ module, allowances, now: context.now }),
    }));
  }

  private toData(args: {
    module: Address;
    allowances: Array<IndexerSafeAllowance>;
    now: number;
  }): SpendingLimitPolicyData {
    const perSpender = groupBy(
      args.allowances,
      (allowance) => allowance.delegate,
    );

    return {
      module: args.module,
      // Every row of one deployment reports the same version.
      moduleVersion: args.allowances[0].moduleVersion,
      spenders: [...perSpender.entries()].map(([spender, allowances]) => ({
        spender,
        isActive: allowances.every((allowance) => allowance.delegateActive),
        allowances: allowances.map((allowance) =>
          this.toAllowance(allowance, args.now),
        ),
      })),
    };
  }

  private toAllowance(
    allowance: IndexerSafeAllowance,
    now: number,
  ): SpendingLimitAllowance {
    const resets = allowance.resetTimeMinutes > 0;

    return {
      token_address: allowance.token,
      amount: allowance.amount,
      spent: allowance.spent,
      remaining: allowance.remaining,
      available: this.available(allowance, now),
      resetPeriodSeconds: allowance.resetTimeMinutes * SECONDS_IN_MINUTE,
      resetsAt: resets ? allowance.nextResetAt : null,
      resetBoundaryIsExact: allowance.resetPhase !== 'ASSUMED',
      nonce: allowance.nonce,
    };
  }

  /**
   * The rule the module applies inside `getAllowance` and the indexer leaves to
   * its callers: a window that has rolled since the last event resets `spent`,
   * and no event says so.
   */
  private available(allowance: IndexerSafeAllowance, now: number): string {
    const hasRolled =
      allowance.resetTimeMinutes > 0 && now >= allowance.nextResetAt;

    return hasRolled ? allowance.amount : allowance.remaining;
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
