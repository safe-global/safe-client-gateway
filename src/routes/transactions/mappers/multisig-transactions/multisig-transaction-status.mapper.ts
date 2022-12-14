import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { TransactionStatus } from '../../entities/transaction-status.entity';

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
