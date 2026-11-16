// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { PolicyIndexerConfigurationRoot } from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type {
  PendingDelayedGuardPolicies,
  PendingTransaction,
} from '#/modules/policies/domain/entities/pending-policy.entity';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import type { SafePolicyGuardConfiguration } from '#/modules/policies/domain/entities/safe-policy-guard-configuration.entity';

/** A `requestConfiguration(root)` waiting in the queue. */
export type QueuedConfigurationRequest = {
  kind: 'request';
  root: Hex;
  guard: Address;
  transaction: PendingTransaction;
};

/** An `applyConfiguration(configurations)` waiting in the queue. */
export type QueuedApplyConfiguration = {
  kind: 'apply';
  /** The hash of `configurations`: the root the call applies. */
  root: Hex;
  guard: Address;
  configurations: Array<PolicyConfiguration>;
  transaction: PendingTransaction;
};

export type QueuedPolicyChangeConfigurationCall =
  | QueuedConfigurationRequest
  | QueuedApplyConfiguration;

/**
 * One delayed configuration change of the Safe, identified by its guard and
 * root, as each source sees it. A field is `null` when its source has no record
 * of the change.
 *
 * The root alone is not enough: it hashes only the configurations, so the same
 * configurations requested on two guards share a root but have separate
 * windows.
 */
export type DelayedPolicyChange = {
  /** The guard the change is requested on; `null` for a draft. */
  guard: Address | null;
  root: Hex;
  /** The root on chain, with its status and application window. */
  onChain: PolicyIndexerConfigurationRoot | null;
  /** The configurations CGW stored when the wallet drafted the change. */
  stored: SafePolicyGuardConfiguration | null;
  /** The first queued request of the root, in nonce order. */
  queuedRequest: QueuedConfigurationRequest | null;
  /** The first queued apply of the root, in nonce order. */
  queuedApply: QueuedApplyConfiguration | null;
};

/** When a pending root can be applied, and on which guard. */
export type ApplicationWindow = {
  guard: Address;
  readyAt: number;
  expiresAt: number;
};

/**
 * The status of a change, together with the guard, window and transaction it
 * was resolved from.
 */
export type ResolvedStatus = Pick<
  PendingDelayedGuardPolicies,
  'status' | 'guard' | 'readyAt' | 'expiresAt' | 'transaction'
>;
