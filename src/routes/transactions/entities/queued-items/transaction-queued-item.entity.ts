import { ApiProperty } from '@nestjs/swagger';
import { ConflictType } from '../conflict-type.entity';
import { QueuedItem } from '../queued-item.entity';
import { Transaction } from '../transaction.entity';

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
