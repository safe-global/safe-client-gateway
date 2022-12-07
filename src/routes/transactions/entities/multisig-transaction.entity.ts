import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExecutionInfo {
  @ApiProperty()
  type: string;
  @ApiProperty()
  nonce: number;
  @ApiProperty()
  confirmationsRequired: number;
  @ApiProperty()
  confirmationsSubmitted: number;
  @ApiPropertyOptional()
  missingSigners?: string[];
}

export class TransactionInfo {
  @ApiProperty()
  type: string;
}

export class TransactionSummary {
  @ApiProperty()
  id: string;
  @ApiPropertyOptional()
  timestamp?: number;
  @ApiProperty()
  txStatus: string;
  @ApiProperty()
  txInfo: TransactionInfo;
  @ApiProperty()
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
