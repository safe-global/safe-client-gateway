import { ApiProperty } from '@nestjs/swagger';
import { ConflictType } from '@/routes/transactions/entities/conflict-type.entity';
import { QueuedItem } from '@/routes/transactions/entities/queued-item.entity';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';

export class TransactionQueuedItem extends QueuedItem {
  @ApiProperty()
  transaction: Transaction;
  @ApiProperty()
  conflictType: string;

  constructor(transaction: Transaction, conflictType: ConflictType) {
    super('TRANSACTION');
    this.transaction = transaction;
    this.conflictType = conflictType;
  }
}
