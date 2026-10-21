// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import type { ModuleEnforcement } from '#/modules/policies/domain/entities/policy-enforcement.entity';
import type { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import type { Token } from '#/modules/policies/domain/entities/token.entity';

export type PendingPolicy =
  | PendingQueuedPolicy
  | PendingGuardInstallation
  | PendingImmediateGuardPolicies
  | PendingDelayedGuardPolicies;

/**
 * The queued Safe transaction a pending policy change was found in.
 */
export type PendingTransaction = {
  safeTxHash: Hex;
  nonce: number;
  confirmations: number;
  confirmationsRequired: number;
  /** Unix seconds; the transaction's `submissionDate`. */
  proposedAt: number;
  /** The owner or delegate who proposed the transaction, if known. */
  proposer: Address | null;
};

export const PendingGuardInstallationStatus = {
  /** Fewer confirmations than the threshold. */
  InSigning: 'in-signing',
  /** Every confirmation is in; the transaction is not executed yet. */
  Ready: 'ready',
};

export type PendingGuardInstallationStatus =
  (typeof PendingGuardInstallationStatus)[keyof typeof PendingGuardInstallationStatus];

export const PendingGuardInstallationChangeKind = {
  SetGuard: 'set-guard',
  SetModuleGuard: 'set-module-guard',
};

/**
 * One guard setter call found in a queued transaction. `null` stands for the
 * zero address - no guard in that slot.
 */
export type PendingGuardInstallationChange =
  | {
      kind: typeof PendingGuardInstallationChangeKind.SetGuard;
      from: Address | null;
      to: Address | null;
    }
  | {
      kind: typeof PendingGuardInstallationChangeKind.SetModuleGuard;
      from: Address | null;
      to: Address | null;
    };

/**
 * A queued transaction that installs, replaces or removes the
 * `SafePolicyGuard` of a Safe.
 */
export type PendingGuardInstallation = {
  kind: 'guard-installation';
  status: PendingGuardInstallationStatus;
  safe: SafeRef;
  /** The guard setter calls of the transaction, in calldata order. */
  changes: Array<PendingGuardInstallationChange>;
  transaction: PendingTransaction;
};

export const PendingImmediateGuardPoliciesStatus = {
  /** Fewer confirmations than the threshold. */
  InSigning: 'in-signing',
  /** Every confirmation is in; the transaction is not executed yet. */
  Ready: 'ready',
};

export type PendingImmediateGuardPoliciesStatus =
  (typeof PendingImmediateGuardPoliciesStatus)[keyof typeof PendingImmediateGuardPoliciesStatus];

/**
 * A queued `configureImmediately` call: policies bound on a `SafePolicyGuard`
 * without a delay, before the guard is enabled on the Safe.
 */
export type PendingImmediateGuardPolicies = {
  kind: 'immediate-guard-policies';
  status: PendingImmediateGuardPoliciesStatus;
  safe: SafeRef;
  guard: Address;
  configurations: Array<PolicyConfiguration>;
  transaction: PendingTransaction;
};

export const PendingDelayedGuardPoliciesStatus = {
  /** Stored in CGW; `requestConfiguration` is not queued or executed. */
  Draft: 'draft',
  /**
   * A queued transaction calls `requestConfiguration(root)`, with any number of
   * confirmations and whatever the on-chain state.
   */
  ConfigurationInSigning: 'configuration-in-signing',
  /**
   * Requested on-chain and not expired, with no queued apply or a fully
   * signed one before `readyAt`.
   */
  PendingApplication: 'pending-application',
  /** A queued `applyConfiguration` with fewer confirmations than required. */
  ApplicationInSigning: 'application-in-signing',
  /** A queued `applyConfiguration` with every confirmation in, from `readyAt`. */
  ApplicationReady: 'application-ready',
  /** Requested on-chain and `now >= expiresAt`. */
  Expired: 'expired',
};

export type PendingDelayedGuardPoliciesStatus =
  (typeof PendingDelayedGuardPoliciesStatus)[keyof typeof PendingDelayedGuardPoliciesStatus];

/**
 * A delayed configuration change of the `SafePolicyGuard`, one per root.
 */
export type PendingDelayedGuardPolicies = {
  kind: 'delayed-guard-policies';
  status: PendingDelayedGuardPoliciesStatus;
  safe: SafeRef;
  /** The guard the root belongs to; `null` for a draft, which has none yet. */
  guard: Address | null;
  /** `keccak256(abi.encode(Configuration[]))`. */
  root: Hex;
  /** `null` when CGW does not know the configurations behind the root. */
  configurations: Array<PolicyConfiguration> | null;
  /** Unix seconds `applyConfiguration` is valid from; `null` until requested. */
  readyAt: number | null;
  /** Unix seconds the application window closes; `null` until requested. */
  expiresAt: number | null;
  /** The queued request or apply transaction, if one is queued. */
  transaction: PendingTransaction | null;
  /**
   * Unix seconds the change was first seen: when CGW stored its
   * configurations, else when its queued transaction was proposed. `null` for a
   * root requested outside the wallet, which CGW has no record of.
   */
  createdAt: number | null;
};

/**
 * A spending-limit change in the transaction queue.
 */
export type PendingQueuedPolicy = {
  kind: 'queued-transaction';
  type: PolicyType;
  enforcement: ModuleEnforcement;
  safeTxHash: Hex;
  nonce: number;
  confirmations: number;
  confirmationsRequired: number;
  /** Unix seconds; the transaction's `submissionDate`. */
  proposedAt: number;
  /** The owner or delegate who proposed the transaction, if known. */
  proposer: Address | null;
  data: PendingSpendingLimitData;
  safe: SafeRef;
};

export type PendingSpendingLimitData = {
  module: Address;
  changes: Array<PendingSpendingLimitChange>;
};

export const PendingSpendingLimitChangeKind = {
  EnableModule: 'enable-module',
  AddDelegate: 'add-delegate',
  RemoveDelegate: 'remove-delegate',
  SetAllowance: 'set-allowance',
  ResetAllowance: 'reset-allowance',
  DeleteAllowance: 'delete-allowance',
};

/**
 * One decoded AllowanceModule call found in a queued transaction (directly, or as
 * a batched transaction using MultiSend contract).
 */
export type PendingSpendingLimitChange =
  | {
      kind: typeof PendingSpendingLimitChangeKind.EnableModule;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.AddDelegate;
      delegate: Address;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.RemoveDelegate;
      delegate: Address;
      removeAllowances: boolean;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.SetAllowance;
      delegate: Address;
      token: Address;
      tokenMetadata: Token | null;
      amount: string;
      resetPeriodMinutes: number;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.ResetAllowance;
      delegate: Address;
      token: Address;
      tokenMetadata: Token | null;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.DeleteAllowance;
      delegate: Address;
      token: Address;
      tokenMetadata: Token | null;
    };
