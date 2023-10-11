import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';

export class IncomingTransfer {
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
