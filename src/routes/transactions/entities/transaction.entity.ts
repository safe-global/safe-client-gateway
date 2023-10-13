import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { CreationTransactionInfo } from '@/routes/transactions/entities/creation-transaction-info.entity';
import { CustomTransactionInfo } from '@/routes/transactions/entities/custom-transaction.entity';
import { ExecutionInfo } from '@/routes/transactions/entities/execution-info.entity';
import { ModuleExecutionInfo } from '@/routes/transactions/entities/module-execution-info.entity';
import { MultisigExecutionInfo } from '@/routes/transactions/entities/multisig-execution-info.entity';
import { SafeAppInfo } from '@/routes/transactions/entities/safe-app-info.entity';
import { SettingsChangeTransaction } from '@/routes/transactions/entities/settings-change-transaction.entity';
import { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';
import { TransferTransactionInfo } from '@/routes/transactions/entities/transfer-transaction-info.entity';

@ApiExtraModels(
  CreationTransactionInfo,
  CustomTransactionInfo,
  SettingsChangeTransaction,
  TransferTransactionInfo,
  ModuleExecutionInfo,
  MultisigExecutionInfo,
)
export class Transaction {
  @ApiProperty()
  id: string;
  @ApiProperty()
  timestamp: number | null;
  @ApiProperty()
  txStatus: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(CreationTransactionInfo) },
      { $ref: getSchemaPath(CustomTransactionInfo) },
      { $ref: getSchemaPath(SettingsChangeTransaction) },
      { $ref: getSchemaPath(TransferTransactionInfo) },
    ],
  })
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
    timestamp: number | null,
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
