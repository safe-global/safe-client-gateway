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
import { SwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/swap-order-info.entity';
import { SwapTransferTransactionInfo } from '@/routes/transactions/swap-transfer-transaction-info.entity';
import { TwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/twap-order-info.entity';
import { NativeStakingDepositTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-deposit-info.entity';
import { NativeStakingValidatorsExitTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-validators-exit-info.entity';
import { NativeStakingWithdrawTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-withdraw-info.entity';

@ApiExtraModels(
  CreationTransactionInfo,
  CustomTransactionInfo,
  SettingsChangeTransaction,
  TransferTransactionInfo,
  ModuleExecutionInfo,
  MultisigExecutionInfo,
  SwapOrderTransactionInfo,
  SwapTransferTransactionInfo,
  TwapOrderTransactionInfo,
  NativeStakingDepositTransactionInfo,
  NativeStakingValidatorsExitTransactionInfo,
  NativeStakingWithdrawTransactionInfo,
)
export class Transaction {
  @ApiProperty()
  id: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  txHash: `0x${string}` | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  timestamp: number | null;
  @ApiProperty()
  txStatus: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(CreationTransactionInfo) },
      { $ref: getSchemaPath(CustomTransactionInfo) },
      { $ref: getSchemaPath(SettingsChangeTransaction) },
      { $ref: getSchemaPath(SwapOrderTransactionInfo) },
      { $ref: getSchemaPath(SwapTransferTransactionInfo) },
      { $ref: getSchemaPath(TwapOrderTransactionInfo) },
      { $ref: getSchemaPath(TransferTransactionInfo) },
      { $ref: getSchemaPath(NativeStakingDepositTransactionInfo) },
      { $ref: getSchemaPath(NativeStakingValidatorsExitTransactionInfo) },
      { $ref: getSchemaPath(NativeStakingWithdrawTransactionInfo) },
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
