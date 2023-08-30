import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { TransactionStatus } from '../../entities/transaction-status.entity';

@Injectable()
export class ModuleTransactionStatusMapper {
  mapTransactionStatus(transaction: ModuleTransaction): TransactionStatus {
    return transaction.isSuccessful
      ? TransactionStatus.Success
      : TransactionStatus.Failed;
  }
}
