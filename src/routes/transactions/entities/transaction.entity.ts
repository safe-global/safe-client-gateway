import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExecutionInfo } from './execution-info.entity';
import { SafeAppInfo } from './safe-app-info.entity';
import { TransactionInfo } from './transaction-info.entity';

export class Transaction {
  @ApiProperty()
  id: string;
  @ApiPropertyOptional()
  timestamp?: number;
  @ApiProperty()
  txStatus: string;
  @ApiProperty()
  txInfo: TransactionInfo;
  @ApiPropertyOptional() // TODO: null OpenApi
  executionInfo?: ExecutionInfo; // TODO: null OpenApi
  @ApiPropertyOptional()
  safeAppInfo?: SafeAppInfo;
}
