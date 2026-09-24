// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { ModuleEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import type { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

/**
 * A configuration change on its way to being applied.
 *
 * Only one mechanism is implemented today - a module-enforced policy pending via
 * an unexecuted Safe transaction in the queue. `PendingPolicy` stays a separate
 * alias from `PendingQueuedPolicy` for when a guard-enforced, delay-gated-root kind
 * joins it as a second member of the union.
 */
export type PendingPolicy = PendingQueuedPolicy;

/**
 * A spending-limit change spotted in a Safe's transaction queue: the transaction
 * has not executed yet, so nothing it proposes is in effect.
 *
 * `data` carries the decoded change as-is, not a projection of what the active
 * policy will look like afterwards - that requires comparing against the current
 * Allowance Module state, which needs a stable `ActivePolicy.id` to key on.
 *
 * TODO(policies): once `ActivePolicy` gets a stable `id` (RFC §3), add
 * `supersedesId` here and replace `data` with a projection of the resulting active
 * state, the same shape `ActivePolicyData` already uses (RFC §6).
 */
export type PendingQueuedPolicy = {
  kind: 'queued-transaction';
  /** Always `PolicyType.SpendingLimit` - the only pending type detected today. */
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

/**
 * The Allowance Module functions {@link PendingSpendingLimitMapper} decodes.
 * Shared by the domain type below, its DTO, and the mapper, so a function
 * added to one is a compile error in the other two rather than a silent gap.
 */
export const PendingSpendingLimitChangeKind = {
  EnableModule: 'enable-module',
  AddDelegate: 'add-delegate',
  RemoveDelegate: 'remove-delegate',
  SetAllowance: 'set-allowance',
  ResetAllowance: 'reset-allowance',
  DeleteAllowance: 'delete-allowance',
} as const;

/**
 * One decoded Allowance Module call found in a queued transaction (directly, or as
 * a MultiSend sub-transaction). `operation` is derived from which function was
 * called, not from comparing against the module's current storage - see
 * `PendingSpendingLimitMapper`.
 */
export type PendingSpendingLimitChange =
  | {
      kind: typeof PendingSpendingLimitChangeKind.EnableModule;
      operation: 'create';
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.AddDelegate;
      operation: 'create';
      delegate: Address;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.RemoveDelegate;
      operation: 'remove';
      delegate: Address;
      removeAllowances: boolean;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.SetAllowance;
      operation: 'update';
      delegate: Address;
      token: Address;
      amount: string;
      resetPeriodMinutes: number;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.ResetAllowance;
      operation: 'update';
      delegate: Address;
      token: Address;
    }
  | {
      kind: typeof PendingSpendingLimitChangeKind.DeleteAllowance;
      operation: 'remove';
      delegate: Address;
      token: Address;
    };
