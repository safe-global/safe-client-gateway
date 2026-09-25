// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { type Address, type Hex, isAddressEqual } from 'viem';
import { getAllowanceModuleDeployments } from '@/domain/common/utils/deployments';
import { AllowanceModuleDecoder } from '@/modules/contracts/domain/decoders/allowance-module-decoder.helper';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import {
  type PendingQueuedPolicy,
  type PendingSpendingLimitChange,
  PendingSpendingLimitChangeKind,
} from '@/modules/policies/domain/entities/pending-policy.entity';
import { moduleEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

type ModuleChange = { module: Address; change: PendingSpendingLimitChange };

/**
 * Finds spending-limit changes in a Safe's queued transactions: direct calls to a
 * known Allowance Module deployment, an `enableModule` call for one, and either
 * one level inside a MultiSend batch.
 *
 * See the `pending` endpoint's documented limitations for what this does not
 * detect (a nested MultiSend, an unofficial module fork, a module-executed
 * change bypassing the queue, a delegatecall dressed up as a module call).
 */
@Injectable()
export class PendingSpendingLimitMapper {
  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly allowanceModuleDecoder: AllowanceModuleDecoder,
  ) {}

  public map(args: {
    safe: SafeRef;
    transactions: ReadonlyArray<MultisigTransaction>;
  }): Array<PendingQueuedPolicy> {
    const knownModules = getAllowanceModuleDeployments({
      chainId: args.safe.chainId,
    });
    if (knownModules.length === 0) {
      return [];
    }

    return args.transactions.flatMap((transaction) =>
      this.mapTransaction({ safe: args.safe, transaction, knownModules }),
    );
  }

  /**
   * One `PendingQueuedPolicy` per Allowance Module deployment this transaction
   * touches - a single transaction bundling changes to two deployments (an
   * edge case) reports one item per deployment, all sharing the same
   * `safeTxHash`.
   */
  private mapTransaction(args: {
    safe: SafeRef;
    transaction: MultisigTransaction;
    knownModules: ReadonlyArray<Address>;
  }): Array<PendingQueuedPolicy> {
    const matches = this.candidates(args.transaction).flatMap((candidate) =>
      this.classify({
        candidate,
        safeAddress: args.safe.address,
        knownModules: args.knownModules,
      }),
    );

    const changesByModule = this.groupByModule(matches);

    return Array.from(changesByModule.entries()).map(([module, changes]) => ({
      kind: 'queued-transaction',
      type: PolicyType.SpendingLimit,
      enforcement: moduleEnforcement(module),
      safeTxHash: args.transaction.safeTxHash,
      nonce: args.transaction.nonce,
      confirmations: args.transaction.confirmations?.length ?? 0,
      confirmationsRequired: args.transaction.confirmationsRequired,
      proposedAt: Math.floor(args.transaction.submissionDate.getTime() / 1000),
      data: { module, changes },
      safe: args.safe,
    }));
  }

  /**
   * The transaction itself, plus - one level only, no recursion - every
   * sub-transaction of a MultiSend batch.
   *
   * `Operation.DELEGATE` candidates are dropped: a delegatecall to an
   * Allowance Module selector runs against the Safe's own storage, not the
   * module's, so it cannot be a real allowance change - treating it as one
   * would be actively misleading (it is also a known way to disguise an
   * unrelated malicious call as an innocuous module call).
   */
  private candidates(
    transaction: MultisigTransaction,
  ): Array<{ to: Address; data: Hex }> {
    if (!transaction.data) {
      return [];
    }

    const all = [
      {
        to: transaction.to,
        data: transaction.data,
        operation: transaction.operation,
      },
      ...(this.multiSendDecoder.helpers.isMultiSend(transaction.data)
        ? this.multiSendDecoder.mapMultiSendTransactions(transaction.data)
        : []),
    ];

    return all
      .filter((candidate) => candidate.operation === Operation.CALL)
      .map(({ to, data }) => ({ to, data }));
  }

  private classify(args: {
    candidate: { to: Address; data: Hex };
    safeAddress: Address;
    knownModules: ReadonlyArray<Address>;
  }): Array<ModuleChange> {
    if (isAddressEqual(args.candidate.to, args.safeAddress)) {
      return this.classifyEnableModule({
        data: args.candidate.data,
        knownModules: args.knownModules,
      });
    }

    const module = args.knownModules.find((known) =>
      isAddressEqual(known, args.candidate.to),
    );
    if (!module) {
      return [];
    }

    const change = this.classifyAllowanceModuleCall(args.candidate.data);
    return change ? [{ module, change }] : [];
  }

  private classifyEnableModule(args: {
    data: Hex;
    knownModules: ReadonlyArray<Address>;
  }): Array<ModuleChange> {
    try {
      const decoded = this.safeDecoder.decodeFunctionData({ data: args.data });
      if (decoded.functionName !== 'enableModule') {
        return [];
      }

      const [enabledModule] = decoded.args;
      const module = args.knownModules.find((known) =>
        isAddressEqual(known, enabledModule),
      );
      return module
        ? [
            {
              module,
              change: {
                kind: PendingSpendingLimitChangeKind.EnableModule,
                operation: 'create',
              },
            },
          ]
        : [];
    } catch {
      // Not an enableModule call - or not a Safe function call at all.
      return [];
    }
  }

  private classifyAllowanceModuleCall(
    data: Hex,
  ): PendingSpendingLimitChange | null {
    try {
      const decoded = this.allowanceModuleDecoder.decodeFunctionData({ data });

      switch (decoded.functionName) {
        case 'addDelegate':
          return {
            kind: PendingSpendingLimitChangeKind.AddDelegate,
            operation: 'create',
            delegate: decoded.args[0],
          };
        case 'removeDelegate':
          return {
            kind: PendingSpendingLimitChangeKind.RemoveDelegate,
            operation: 'remove',
            delegate: decoded.args[0],
            removeAllowances: decoded.args[1],
          };
        case 'setAllowance':
          return {
            kind: PendingSpendingLimitChangeKind.SetAllowance,
            operation: 'update',
            delegate: decoded.args[0],
            token: decoded.args[1],
            amount: decoded.args[2].toString(),
            resetPeriodMinutes: decoded.args[3],
          };
        case 'resetAllowance':
          return {
            kind: PendingSpendingLimitChangeKind.ResetAllowance,
            operation: 'update',
            delegate: decoded.args[0],
            token: decoded.args[1],
          };
        case 'deleteAllowance':
          return {
            kind: PendingSpendingLimitChangeKind.DeleteAllowance,
            operation: 'remove',
            delegate: decoded.args[0],
            token: decoded.args[1],
          };
      }
    } catch {
      // A call to a known module that isn't one of the five we track, e.g.
      // `executeAllowanceTransfer` - not a policy change, just not one of ours.
      return null;
    }
  }

  private groupByModule(
    matches: ReadonlyArray<ModuleChange>,
  ): Map<Address, Array<PendingSpendingLimitChange>> {
    const grouped = new Map<Address, Array<PendingSpendingLimitChange>>();

    for (const { module, change } of matches) {
      const group = grouped.get(module) ?? [];
      group.push(change);
      grouped.set(module, group);
    }

    return grouped;
  }
}
