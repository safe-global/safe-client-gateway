// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';

// Grace period to account for Transaction Service indexing lag.
// During this window, a fully-confirmed transaction whose nonce has been
// consumed on-chain but whose isExecuted flag has not yet been indexed
// will show as AwaitingExecution instead of the incorrect Cancelled.
const INDEXING_GRACE_PERIOD_MS = 3 * 60 * 1000;

@Injectable()
export class MultisigTransactionStatusMapper {
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
        INDEXING_GRACE_PERIOD_MS;

    return hasEnoughConfirmations && recentlyModified;
  }
}
