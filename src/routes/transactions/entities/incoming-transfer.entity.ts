import { ApiProperty } from '@nestjs/swagger';
import { TransactionSummary } from './multisig-transaction.entity';

export class IncomingTransfer {
  @ApiProperty()
  type: string;
  @ApiProperty()
  transaction: TransactionSummary;
  @ApiProperty()
  conflictType: string;
}
