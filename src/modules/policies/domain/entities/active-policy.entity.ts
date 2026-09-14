// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
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
  /**
   * `false` when the spender's delegate registration was removed: nothing is
   * spendable now, but the allowance survives and returns to effect if the
   * delegate is re-added.
   */
  isDelegateActive: boolean;
};

/**
 * How far a guard-enforced grant reaches.
 *
 * The policy contract carries it per entry rather than per policy, so one
 * allowlist can hold a single-use grant beside an open-ended one. Only `ALWAYS`
 * occurs in the dev indexer's data today.
 */
export const PolicyPermission = {
  /** Spent by the first matching call. */
  Once: 'ONCE',
  /** Applies to every matching call. */
  Always: 'ALWAYS',
} as const;

export type PolicyPermission =
  (typeof PolicyPermission)[keyof typeof PolicyPermission];

/** One entry of an ERC-20 allowlist: who, and for how long. */
export type Erc20TransferRecipient = {
  account: Address;
  permission: PolicyPermission;
};

/**
 * `ERC20TransferPolicy`: per token, the recipients the Safe may send to.
 *
 * Addresses only, on both sides: the client resolves token metadata and display
 * names itself. The recipient list is the indexer's accumulated one - the policy
 * contract's `configure` is an upsert of deltas, so only the folded sequence
 * describes the allowlist.
 */
export type Erc20TransferPolicyData = {
  allowlist: Array<{
    token_address: Address;
    recipients: Array<Erc20TransferRecipient>;
  }>;
};

/**
 * `CoSignerPolicy`: the cosigner the policy requires.
 *
 * The whole payload, since that is all the state encodes - no threshold is
 * derivable from it.
 */
export type CosignerPolicyData = {
  cosigner_address: Address;
};

/**
 * The stateless policies - allow, deny and native transfer.
 *
 * Which calls they cover is already carried by the item's `enforcement`, and the
 * policy contract holds no configuration, so there is nothing left to report.
 */
export type StatelessPolicyData = Record<string, never>;

/**
 * The configuration a policy reports, discriminated by the item's `type`.
 */
export type ActivePolicyData =
  | SpendingLimitPolicyData
  | Erc20TransferPolicyData
  | CosignerPolicyData
  | StatelessPolicyData;

/**
 * A policy in effect on a Safe.
 *
 * `enabled` is `false` when the policy is configured but not enforced - for a
 * module type, the module is not enabled on the Safe. The wallet uses it to
 * render a policy as configured-but-unenforced rather than hiding it.
 */
export type ActivePolicy = {
  type: PolicyType;
  enforcement: PolicyEnforcement;
  enabled: boolean;
  data: ActivePolicyData;
};
