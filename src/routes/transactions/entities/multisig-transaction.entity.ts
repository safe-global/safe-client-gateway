import { ApiProperty } from '@nestjs/swagger';

export class ExecutionInfo {
  type: string;
  nonce: number;
  confirmationsRequired: number;
  confirmationsSubmitted: number;
  missingSigners?: string[];
}

export class TransactionSummary {
  id: string;
  timestamp?: number;
  txStatus: string;
  executionInfo: ExecutionInfo;
}

export class MultisigTransaction {
  @ApiProperty()
  type: string;
  @ApiProperty()
  transaction: TransactionSummary;
  @ApiProperty()
  conflictType: string;
}
