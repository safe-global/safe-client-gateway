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
  AllowPolicy: 'AllowPolicy',
  NativeTransfer: 'NativeTransferPolicy',
  Deny: 'DenyPolicy',
} as const;

export type PolicyType = (typeof PolicyType)[keyof typeof PolicyType];

/**
 * The types the `SafePolicyGuard` enforces, i.e. those backed by a policy
 * contract. The complement is module-enforced and has no such address.
 *
 * Kept in step with the `policyContracts` keys of `PolicyDeploymentSchema`, which
 * enumerates the same set - the schema needs the keys statically to type the
 * configuration.
 */
export const GUARD_POLICY_TYPES = [
  PolicyType.Erc20Transfer,
  PolicyType.Cosigner,
  PolicyType.AllowPolicy,
  PolicyType.NativeTransfer,
  PolicyType.Deny,
] as const;

export type GuardPolicyType = (typeof GUARD_POLICY_TYPES)[number];

export function isGuardPolicyType(type: PolicyType): type is GuardPolicyType {
  return (GUARD_POLICY_TYPES as ReadonlyArray<PolicyType>).includes(type);
}

/**
 * The Transaction Service's `policyType` (the policy contract name from its
 * `PolicyContract` registry) for the guard-enforced types CGW models.
 *
 * Only the two guard-enforced types appear: `spending-limit` and `recovery` are
 * module-enforced and never carried by a `PolicyConfirmed` event.
 */
const POLICY_TYPE_BY_CONTRACT_NAME: Readonly<Record<string, PolicyType>> = {
  ERC20TransferPolicy: PolicyType.Erc20Transfer,
  CoSignerPolicy: PolicyType.Cosigner,
  AllowPolicy: PolicyType.AllowPolicy,
};

/**
 * Maps a Transaction Service `policyType` to the type CGW renders.
 *
 * `null` for an absent name, and for the policies the registry knows but CGW
 * cannot resolve into an active policy (`DenyPolicy`, `NativeTransferPolicy`,
 * `MultiSendPolicy`, …) - those are skipped rather than rendered as an unknown
 * restriction. The catalogue may still advertise such a type: naming the
 * contract that would enforce it needs no resolver.
 */
export function policyTypeFromContractName(
  name: string | null | undefined,
): PolicyType | null {
  if (!name) {
    return null;
  }
  return POLICY_TYPE_BY_CONTRACT_NAME[name] ?? null;
}

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
