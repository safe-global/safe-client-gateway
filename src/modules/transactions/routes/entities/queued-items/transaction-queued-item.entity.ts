import { ApiProperty } from '@nestjs/swagger';
import { ConflictType } from '@/modules/transactions/routes/entities/conflict-type.entity';
import {
  QueuedItem,
  QueuedItemType,
} from '@/modules/transactions/routes/entities/queued-item.entity';
import { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';

export class TransactionQueuedItem extends QueuedItem {
  @ApiProperty({ enum: [QueuedItemType.Transaction] })
  override type = QueuedItemType.Transaction;
  @ApiProperty()
  transaction: Transaction;
  @ApiProperty({ enum: ConflictType })
  conflictType: string;

  constructor(transaction: Transaction, conflictType: ConflictType) {
    super(QueuedItemType.Transaction);
    this.transaction = transaction;
    this.conflictType = conflictType;
  }
}
