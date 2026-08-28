// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { PolicyEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import type { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * `spending-limit`: what each spender may still withdraw, and on what schedule.
 *
 * One policy per `(safe, module deployment)`. The allowance module is not a
 * same-address singleton and a chain can run more than one version at once with
 * independent storage, so a Safe holding limits on both holds two policies.
 */
export type SpendingLimitPolicyData = {
  module: Address;
  spenders: Array<{
    spender: Address;
    /**
     * `false` when the delegate is disabled: nothing is spendable now, but
     * the allowances survive and return to effect if it is re-enabled.
     */
    isActive: boolean;
    allowances: Array<SpendingLimitAllowance>;
  }>;
};

export type SpendingLimitAllowance = {
  /** The zero address is the native currency. */
  token_address: Address;
  /** Per-window ceiling, in base units. */
  amount: string;
  /** Spent in the window that began at the last reset, in base units. */
  spent: string;
  /** `0` never resets. */
  resetPeriodSeconds: number;
  /** Unix seconds of the next reset; `null` when it never resets. */
  resetsAt: number | null;
  /**
   * `false` when the reset boundary could not be recovered from the configuring
   * call, so `resetsAt` may be up to one period out.
   */
  resetBoundaryIsExact: boolean;
};

/**
 * The configuration a policy reports, discriminated by the item's `type`.
 *
 * Only the allowance module's spending limits are reported today; the remaining
 * policy types join the union as the code reading them lands.
 */
export type ActivePolicyData = SpendingLimitPolicyData;

/**
 * A policy in effect on a Safe.
 *
 * `enabled` is `false` when the policy is configured but not enforced - for a
 * module type, the module is not enabled on the Safe. The wallet uses it to
 * render a policy as configured-but-unenforced rather than hiding it.
 */
export type ActivePolicy = {
  /** Opaque and stable; see `policy-id.utils.ts` for the derivation per kind. */
  id: Hex;
  type: PolicyType;
  enforcement: PolicyEnforcement;
  enabled: boolean;
  data: ActivePolicyData;
};
