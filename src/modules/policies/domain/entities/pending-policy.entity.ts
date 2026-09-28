// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { ModuleEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import type { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

export type PendingPolicy = PendingQueuedPolicy;

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
 * One decoded Allowance Module call found in a queued transaction (directly, or as
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
