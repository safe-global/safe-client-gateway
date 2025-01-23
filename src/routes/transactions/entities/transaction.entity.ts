import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { ExecutionInfo } from '@/routes/transactions/entities/execution-info.entity';
import { ModuleExecutionInfo } from '@/routes/transactions/entities/module-execution-info.entity';
import { MultisigExecutionInfo } from '@/routes/transactions/entities/multisig-execution-info.entity';
import { SafeAppInfo } from '@/routes/transactions/entities/safe-app-info.entity';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { getTxInfoSchema, TransactionInfo } from './transaction-info.entity';

@ApiExtraModels(TransactionInfo)
export class Transaction {
  @ApiProperty()
  id: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  txHash: `0x${string}` | null;
  @ApiProperty()
  timestamp: number;
  @ApiProperty({ enum: TransactionStatus })
  txStatus: string;
  @ApiProperty(getTxInfoSchema())
  txInfo: TransactionInfo;
  @ApiPropertyOptional({
    oneOf: [
      { $ref: getSchemaPath(MultisigExecutionInfo) },
      { $ref: getSchemaPath(ModuleExecutionInfo) },
    ],
    nullable: true,
  })
  executionInfo: ExecutionInfo | null;
  @ApiPropertyOptional({ type: SafeAppInfo, nullable: true })
  safeAppInfo: SafeAppInfo | null;

  constructor(
    id: string,
    timestamp: number,
    txStatus: TransactionStatus,
    txInfo: TransactionInfo,
    executionInfo: ExecutionInfo | null = null,
    safeAppInfo: SafeAppInfo | null = null,
    txHash: `0x${string}` | null = null,
  ) {
    this.id = id;
    this.timestamp = timestamp;
    this.txStatus = txStatus;
    this.txInfo = txInfo;
    this.executionInfo = executionInfo;
    this.safeAppInfo = safeAppInfo;
    this.txHash = txHash;
  }
}
