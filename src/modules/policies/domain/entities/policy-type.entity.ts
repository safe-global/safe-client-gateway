// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * The policy types CGW reports.
 */
export const PolicyType = {
  /** Allowance module. */
  SpendingLimit: 'spending-limit',
  /** Delay module. */
  Recovery: 'recovery',
  /** A delegate of the Transaction Service; enforced by no contract. */
  Proposer: 'proposer',
  Erc20Transfer: 'erc20-transfer',
  Cosigner: 'cosigner',
  Allow: 'allow',
  NativeTransfer: 'native-transfer',
  Deny: 'deny',
};

export type PolicyType = (typeof PolicyType)[keyof typeof PolicyType];

/**
 * How a policy is enforced.
 *
 * - `module`: an enabled Safe module enforces it.
 * - `guard`: the `SafePolicyGuard` enforces it by delegating to a policy
 *   contract, in the transaction guard and/or the module guard slot.
 * - `offchain`: nothing on chain enforces it. A proposer may only *propose*
 *   transactions, so the wallet has to render it as access rather than as an
 *   audited on-chain policy - which is a data distinction only if `via` carries
 *   it, and a hardcoded type check in every render path if it does not.
 *
 * `offchain` names the mechanism rather than the one type using it today, so a
 * second off-chain type needs no new variant.
 */
export const PolicyEnforcementKind = {
  Module: 'module',
  Guard: 'guard',
  OffChain: 'offchain',
};

export type PolicyEnforcementKind =
  (typeof PolicyEnforcementKind)[keyof typeof PolicyEnforcementKind];
