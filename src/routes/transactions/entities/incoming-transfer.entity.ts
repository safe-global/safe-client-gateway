import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';
import { ConflictType } from '@/routes/transactions/entities/conflict-type.entity';

export class IncomingTransfer {
  @ApiProperty({ enum: ['TRANSACTION'] })
  type: string;
  @ApiProperty()
  transaction: Transaction;
  @ApiProperty({ enum: [ConflictType.None] })
  conflictType: string;

  constructor(transaction: Transaction) {
    this.type = 'TRANSACTION';
    this.transaction = transaction;
    this.conflictType = ConflictType.None;
  }
}
