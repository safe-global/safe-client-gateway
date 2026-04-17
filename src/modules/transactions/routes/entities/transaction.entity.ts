// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Hash } from 'viem';
import { BaseTransaction } from '@/modules/transactions/routes/entities/base-transaction.entity';
import type { ExecutionInfo } from '@/modules/transactions/routes/entities/execution-info.entity';
import { ModuleExecutionInfo } from '@/modules/transactions/routes/entities/module-execution-info.entity';
import { MultisigExecutionInfo } from '@/modules/transactions/routes/entities/multisig-execution-info.entity';
import { SafeAppInfo } from '@/modules/transactions/routes/entities/safe-app-info.entity';
import type { TransactionInfo } from '@/modules/transactions/routes/entities/transaction-info.entity';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';

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
