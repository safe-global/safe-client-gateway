import { ApiProperty } from '@nestjs/swagger';
import { ConflictType } from '@/modules/transactions/routes/entities/conflict-type.entity';
import { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';

export class ModuleTransaction {
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
