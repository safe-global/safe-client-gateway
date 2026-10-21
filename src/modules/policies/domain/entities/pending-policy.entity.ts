// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import type { ModuleEnforcement } from '#/modules/policies/domain/entities/policy-enforcement.entity';
import type { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import type { Token } from '#/modules/policies/domain/entities/token.entity';

export type PendingPolicy = PendingQueuedPolicy;

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
