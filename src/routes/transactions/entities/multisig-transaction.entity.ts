import { ApiProperty } from '@nestjs/swagger';

export class TransactionSummary {
  id: string;
  timestamp?: number;
  txStatus: string;
}

export class MultisigTransaction {
  @ApiProperty()
  type: string;
  @ApiProperty()
  transaction: TransactionSummary;
  @ApiProperty()
  conflictType: string;
}
