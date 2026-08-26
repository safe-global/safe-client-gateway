// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { PolicyEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import type { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * `spending-limit`: what each spender may still withdraw, and on what schedule.
 *
 * One policy per `(safe, module deployment)`. The allowance module is not a
 * same-address singleton and a chain can run more than one version at once with
 * independent storage, so a Safe holding limits on both holds two policies -
 * merging them would report a ceiling that exists nowhere on chain.
 *
 * Addresses only, no names and no token metadata: names live in the space
 * address book and the client resolves both.
 */
export type SpendingLimitPolicyData = {
  module: Address;
  /** `"0.1.0"` or `"0.1.1"` today. */
  moduleVersion: string;
  spenders: Array<{
    spender: Address;
    /**
     * `false` when the delegate is deregistered: nothing is spendable now, but
     * the allowances survive and return to effect if it is re-added. Reported
     * rather than dropped, so the UI does not say a limit is gone when it will
     * come back.
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
  /** `amount - spent`, clamped at zero. */
  remaining: string;
  /**
   * What can actually be spent now, in base units.
   *
   * The module zeroes `spent` lazily inside `getAllowance` and emits nothing
   * when it does, so no event exists for the indexer to aggregate when a window
   * rolls. This is `remaining` with that pending reset applied - without it a
   * fully-reset allowance reads as spent out.
   */
  available: string;
  /** `0` never resets. */
  resetPeriodSeconds: number;
  /** Unix seconds of the next reset; `null` when it never resets. */
  resetsAt: number | null;
  /**
   * `false` when the reset boundary could not be recovered from the configuring
   * call, so `resetsAt` may be up to one period out. `amount` is unaffected.
   */
  resetBoundaryIsExact: boolean;
  /** Next allowance-transfer nonce. */
  nonce: string;
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
    recipients: Array<Address>;
  }>;
};

/**
 * `CoSignerPolicy`: the cosigner the policy requires.
 *
 * The whole payload, since that is all the event encodes - no threshold is
 * derivable from it. The access it covers is already the item's `id`.
 */
export type CosignerPolicyData = {
  cosigner_address: Address;
};

/**
 * The stateless policies - allow, deny and native transfer.
 *
 * Which calls they cover is already carried by the item's `id` and
 * `enforcement`, and the policy contract holds no configuration, so there is
 * nothing left to report.
 */
export type StatelessPolicyData = Record<string, never>;

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
  /** Opaque and stable; see `policy-id.utils.ts` for the derivation per kind. */
  id: Hex;
  type: PolicyType;
  enforcement: PolicyEnforcement;
  enabled: boolean;
  data: ActivePolicyData;
};
