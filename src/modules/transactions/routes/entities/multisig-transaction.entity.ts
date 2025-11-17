import { ApiProperty } from '@nestjs/swagger';
import { ConflictType } from '@/modules/transactions/routes/entities/conflict-type.entity';
import { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';

export class MultisigTransaction {
  @ApiProperty({ enum: ['TRANSACTION'] })
  type: string;
  @ApiProperty()
  transaction: Transaction;
  @ApiProperty({ enum: ConflictType })
  conflictType: string;

  constructor(transaction: Transaction, conflictType: ConflictType) {
    this.type = 'TRANSACTION';
    this.transaction = transaction;
    this.conflictType = conflictType;
  }
}
