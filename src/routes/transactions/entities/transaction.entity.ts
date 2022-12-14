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

  constructor(
    id: string,
    timestamp: number,
    txStatus: string,
    txInfo: TransactionInfo,
    executionInfo: ExecutionInfo | null = null,
    safeAppInfo: SafeAppInfo | null = null,
  ) {
    this.id = id;
    this.timestamp = timestamp;
    this.txStatus = txStatus;
    this.txInfo = txInfo;
    this.executionInfo = executionInfo;
    this.safeAppInfo = safeAppInfo;
  }
}
