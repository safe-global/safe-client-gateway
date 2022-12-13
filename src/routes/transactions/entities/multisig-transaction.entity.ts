import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExecutionInfo } from './execution-info.entity';

export class TransactionInfo {
  @ApiProperty()
  type: string;
}

export class SafeAppInfo {
  @ApiProperty()
  name: string;
  @ApiProperty()
  url: string;
  @ApiProperty()
  logo_uri: string;
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
  @ApiPropertyOptional()
  executionInfo?: ExecutionInfo;
  @ApiPropertyOptional()
  safeAppInfo?: SafeAppInfo;
}

export class MultisigTransaction {
  @ApiProperty()
  type: string;
  @ApiProperty()
  transaction: TransactionSummary;
  @ApiProperty()
  conflictType: string;
}
