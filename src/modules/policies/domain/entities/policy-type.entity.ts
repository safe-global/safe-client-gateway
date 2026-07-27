// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * The policy types the wallet can render.
 *
 * The values are the wire format shared with the wallet and double as the
 * discriminator of the active/pending policy unions.
 *
 * TODO(WA-2914): the front-end mock names the token allowlist member
 * `PolicyType.TokenWithdraw` while the agreed wire value is
 * `ERC20TransferPolicy`. The documented wire values are used here; confirm the
 * serialized enum values with the wallet before release.
 */
export const PolicyType = {
  SpendingLimit: 'spending-limit',
  Recovery: 'recovery',
  Erc20Transfer: 'ERC20TransferPolicy',
  Cosigner: 'cosigner',
} as const;

export type PolicyType = (typeof PolicyType)[keyof typeof PolicyType];

/**
 * How a policy is enforced on a Safe.
 *
 * - `module`: an enabled Safe module enforces it (e.g. AllowanceModule).
 * - `guard`: the `SafePolicyGuard` enforces it by delegating to a policy
 *   contract, in the transaction guard and/or the module guard slot.
 */
export const PolicyEnforcementKind = {
  Module: 'module',
  Guard: 'guard',
} as const;

export type PolicyEnforcementKind =
  (typeof PolicyEnforcementKind)[keyof typeof PolicyEnforcementKind];
