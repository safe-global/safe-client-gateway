import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from './transaction.entity';

export class ModuleTransaction {
  @ApiProperty()
  type: string;
  @ApiProperty()
  transaction: Transaction;
  @ApiProperty()
  conflictType: string;

  constructor(transaction: Transaction) {
    this.type = 'TRANSACTION';
    this.transaction = transaction;
    this.conflictType = 'None';
  }
}
