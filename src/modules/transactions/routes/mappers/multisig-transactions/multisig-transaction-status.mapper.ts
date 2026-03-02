// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';

// Grace period for Transaction Service indexing lag (config: transactions.statusIndexingGracePeriodMs, default 1 min).
@Injectable()
export class MultisigTransactionStatusMapper {
  private readonly indexingGracePeriodMs: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.indexingGracePeriodMs = this.configurationService.getOrThrow<number>(
      'transactions.statusIndexingGracePeriodMs',
    );
  }

  mapTransactionStatus(
    transaction: MultisigTransaction,
    safe: Safe,
  ): TransactionStatus {
    if (transaction.isExecuted) {
      return transaction.isSuccessful
        ? TransactionStatus.Success
        : TransactionStatus.Failed;
    }
    if (safe.nonce > transaction.nonce) {
      if (this.isLikelyPendingIndexing(transaction)) {
        return TransactionStatus.AwaitingExecution;
      }
      return TransactionStatus.Cancelled;
    }
    if (
      (transaction.confirmations?.length || 0) <
      transaction.confirmationsRequired
    ) {
      return TransactionStatus.AwaitingConfirmations;
    }
    return TransactionStatus.AwaitingExecution;
  }

  /**
   * Detects the race condition where the Safe nonce has advanced on-chain
   * but the Transaction Service has not yet indexed isExecuted for this tx.
   *
   * A transaction is likely pending indexing (not truly cancelled) when:
   * 1. It already gathered enough confirmations to be executed, AND
   * 2. It was modified recently (within the indexing grace period)
   */
  private isLikelyPendingIndexing(transaction: MultisigTransaction): boolean {
    const hasEnoughConfirmations =
      (transaction.confirmations?.length ?? 0) >=
      transaction.confirmationsRequired;

    const recentlyModified =
      transaction.modified != null &&
      Date.now() - new Date(transaction.modified).getTime() <
        this.indexingGracePeriodMs;

    return hasEnoughConfirmations && recentlyModified;
  }
}
