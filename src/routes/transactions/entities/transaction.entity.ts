import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { CustomTransactionInfo } from './custom-transaction.entity';
import { ExecutionInfo } from './execution-info.entity';
import { ModuleExecutionInfo } from './module-execution-info.entity';
import { MultisigExecutionInfo } from './multisig-execution-info.entity';
import { SafeAppInfo } from './safe-app-info.entity';
import { SettingsChangeTransaction } from './settings-change-transaction.entity';
import { TransactionInfo } from './transaction-info.entity';
import { TransferTransactionInfo } from './transfer-transaction-info.entity';

@ApiExtraModels(
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
  timestamp: number;
  @ApiProperty()
  txStatus: string;
  @ApiProperty({
    oneOf: [
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
