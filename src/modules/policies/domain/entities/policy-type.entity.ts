// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * The policy types CGW reports.
 *
 * The values are the wire format shared with the wallet and double as the
 * discriminator of the active-policy union. Module-enforced and off-chain types
 * are named for what the product calls them; guard-enforced ones carry the
 * policy contract's own name, which is also the name the indexer's registry
 * resolves a policy address to.
 */
export const PolicyType = {
  /** Allowance module. */
  SpendingLimit: 'spending-limit',
  /** Delay module. */
  Recovery: 'recovery',
  /** A delegate of the Transaction Service; enforced by no contract. */
  Proposer: 'proposer',
  Erc20Transfer: 'ERC20TransferPolicy',
  Cosigner: 'cosigner',
  AllowPolicy: 'AllowPolicy',
  NativeTransfer: 'NativeTransferPolicy',
  Deny: 'DenyPolicy',
} as const;

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
} as const;

export type PolicyEnforcementKind =
  (typeof PolicyEnforcementKind)[keyof typeof PolicyEnforcementKind];
