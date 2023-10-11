import { ApiProperty } from '@nestjs/swagger';
import { ConflictType } from '@/routes/transactions/entities/conflict-type.entity';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';

export class MultisigTransaction {
  @ApiProperty()
  type: string;
  @ApiProperty()
  transaction: Transaction;
  @ApiProperty()
  conflictType: string;

  constructor(transaction: Transaction, conflictType: ConflictType) {
    this.type = 'TRANSACTION';
    this.transaction = transaction;
    this.conflictType = conflictType;
  }
}
