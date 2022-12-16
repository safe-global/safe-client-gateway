import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from './transaction.entity';

export class IncomingTransfer {
  @ApiProperty()
  type: string;
  @ApiProperty()
  transaction: Transaction;
  @ApiProperty()
  conflictType: string;
}
