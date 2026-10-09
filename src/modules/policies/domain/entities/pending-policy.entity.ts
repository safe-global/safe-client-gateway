// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';
import type { ModuleEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import type { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

export type PendingPolicy =
  | PendingQueuedPolicy
  | PendingGuardSetup
  | PendingGuardConfiguration;

/**
 * The queued Safe transaction a pending item was found in.
 */
export type PendingTransaction = {
  safeTxHash: Hex;
  nonce: number;
  confirmations: number;
  confirmationsRequired: number;
  /** Unix seconds; the transaction's `submissionDate`. */
  proposedAt: number;
};

export const PendingGuardSetupStatus = {
  /** Fewer confirmations than the threshold. */
  InSigning: 'setup-in-signing',
  /** Every confirmation is in; the transaction is not executed yet. */
  Ready: 'setup-ready',
} as const;

export type PendingGuardSetupStatus =
  (typeof PendingGuardSetupStatus)[keyof typeof PendingGuardSetupStatus];

export const PendingGuardSetupChangeKind = {
  ConfigureImmediately: 'configure-immediately',
  SetGuard: 'set-guard',
  SetModuleGuard: 'set-module-guard',
} as const;

/**
 * One guard setup call found in a queued transaction.
 *
 * For `set-guard` and `set-module-guard`, `null` stands for the zero address -
 * no guard in that slot.
 */
export type PendingGuardSetupChange =
  | {
      kind: typeof PendingGuardSetupChangeKind.ConfigureImmediately;
      guard: Address;
      configurations: Array<PolicyConfiguration>;
      /**
       * `true` when the guard already sits in the Safe's guard or module guard
       * slot by the time this call runs - `configureImmediately` then reverts
       * with `GuardAlreadyEnabled`.
       */
      willRevert: boolean;
    }
  | {
      kind: typeof PendingGuardSetupChangeKind.SetGuard;
      from: Address | null;
      to: Address | null;
    }
  | {
      kind: typeof PendingGuardSetupChangeKind.SetModuleGuard;
      from: Address | null;
      to: Address | null;
    };

/**
 * A queued transaction that sets up the `SafePolicyGuard`: binds policies with
 * `configureImmediately`, or installs or removes the guard.
 */
export type PendingGuardSetup = {
  kind: 'guard-setup';
  status: PendingGuardSetupStatus;
  safe: SafeRef;
  /** The setup calls of the transaction, in calldata order. */
  changes: Array<PendingGuardSetupChange>;
  transaction: PendingTransaction;
};

export const PendingGuardConfigurationStatus = {
  /** Stored in CGW; `requestConfiguration` is not queued or executed. */
  Draft: 'draft',
  /** A queued transaction calls `requestConfiguration(root)`. */
  ConfigurationInSigning: 'configuration-in-signing',
  /** Requested on-chain, inside its application window, nothing queued. */
  PendingApplication: 'pending-application',
  /** A queued `applyConfiguration` with fewer confirmations than needed. */
  ApplicationInSigning: 'application-in-signing',
  /** A queued `applyConfiguration` with every confirmation in. */
  ApplicationReady: 'application-ready',
  /** Requested on-chain, but the application window has closed. */
  Expired: 'expired',
} as const;

export type PendingGuardConfigurationStatus =
  (typeof PendingGuardConfigurationStatus)[keyof typeof PendingGuardConfigurationStatus];

/**
 * A delayed configuration change of the `SafePolicyGuard`, one per root.
 */
export type PendingGuardConfiguration = {
  kind: 'guard-configuration';
  status: PendingGuardConfigurationStatus;
  safe: SafeRef;
  /** The guard the root belongs to; `null` for a draft, which has none yet. */
  guard: Address | null;
  /** `keccak256(abi.encode(Configuration[]))`. */
  configureRoot: Hex;
  /** `null` when CGW does not know the configurations behind the root. */
  configurations: Array<PolicyConfiguration> | null;
  /** Unix seconds `applyConfiguration` is valid from; `null` until requested. */
  readyAt: number | null;
  /** Unix seconds the application window closes; `readyAt + EXPIRY`. */
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
      amount: string;
      resetPeriodMinutes: number;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.ResetAllowance;
      delegate: Address;
      token: Address;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.DeleteAllowance;
      delegate: Address;
      token: Address;
    };
