import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExecutionInfo } from './execution-info.entity';
import { SafeAppInfo } from './safe-app-info.entity';
import { TransactionInfo } from './transaction-info.entity';

export class Transaction {
  @ApiProperty()
  id: string;
  @ApiProperty()
  timestamp: number;
  @ApiProperty()
  txStatus: string;
  @ApiProperty()
  txInfo: TransactionInfo;
  @ApiPropertyOptional({ type: ExecutionInfo, nullable: true })
  executionInfo: ExecutionInfo | null;
  @ApiPropertyOptional({ type: SafeAppInfo, nullable: true })
  safeAppInfo: SafeAppInfo | null;
}
