// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { type MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { type Safe } from '@/modules/safe/domain/entities/safe.entity';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';

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
}
