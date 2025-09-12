import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { BaseTransaction } from '@/routes/transactions/entities/base-transaction.entity';
import { ExecutionInfo } from '@/routes/transactions/entities/execution-info.entity';
import { ModuleExecutionInfo } from '@/routes/transactions/entities/module-execution-info.entity';
import { MultisigExecutionInfo } from '@/routes/transactions/entities/multisig-execution-info.entity';
import { SafeAppInfo } from '@/routes/transactions/entities/safe-app-info.entity';
import { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import type { Hash } from 'viem';

@ApiExtraModels(ModuleExecutionInfo, MultisigExecutionInfo)
export class Transaction extends BaseTransaction {
  @ApiProperty()
  id: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  txHash: Hash | null;
  @ApiProperty()
  timestamp: number;
  @ApiProperty({ enum: TransactionStatus })
  txStatus: string;
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
  @ApiPropertyOptional({ type: String, nullable: true })
  note: string | null;

  constructor(
    id: string,
    timestamp: number,
    txStatus: TransactionStatus,
    txInfo: TransactionInfo,
    executionInfo: ExecutionInfo | null = null,
    safeAppInfo: SafeAppInfo | null = null,
    note: string | null = null,
    txHash: Hash | null = null,
  ) {
    super(txInfo);
    this.id = id;
    this.timestamp = timestamp;
    this.txStatus = txStatus;
    this.txInfo = txInfo;
    this.executionInfo = executionInfo;
    this.safeAppInfo = safeAppInfo;
    this.note = note;
    this.txHash = txHash;
  }
}
