import { ApiProperty } from '@nestjs/swagger';

export class ExecutionInfo {
  type: string;
  nonce: number;
  confirmationsRequired: number;
  confirmationsSubmitted: number;
  missingSigners?: string[];
}

export class TransactionInfo {
  type: string;
}

export class TransactionSummary {
  id: string;
  timestamp?: number;
  txStatus: string;
  txInfo: TransactionInfo;
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
