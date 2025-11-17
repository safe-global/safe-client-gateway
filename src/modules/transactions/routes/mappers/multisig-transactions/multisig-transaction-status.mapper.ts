import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Safe } from '@/modules/safe/domain/entities/safe.entity';
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
