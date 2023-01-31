import { ApiProperty } from '@nestjs/swagger';
import { ConflictType } from './conflict-type.entity';
import { Transaction } from './transaction.entity';

export class TransactionItem {
  @ApiProperty()
  type: string;
  @ApiProperty()
  transaction: Transaction;
  @ApiProperty()
  conflictType: string;

  constructor(transaction: Transaction) {
    this.type = 'TRANSACTION';
    this.transaction = transaction;
    this.conflictType = ConflictType.None;
  }
}
