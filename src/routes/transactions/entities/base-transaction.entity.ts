import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { CreationTransactionInfo } from '@/routes/transactions/entities/creation-transaction-info.entity';
import { CustomTransactionInfo } from '@/routes/transactions/entities/custom-transaction.entity';
import { SettingsChangeTransaction } from '@/routes/transactions/entities/settings-change-transaction.entity';
import { NativeStakingDepositTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-deposit-info.entity';
import { NativeStakingValidatorsExitTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-validators-exit-info.entity';
import { NativeStakingWithdrawTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-withdraw-info.entity';
import { SwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/swap-order-info.entity';
import { TwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/twap-order-info.entity';
import { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';
import { TransferTransactionInfo } from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { SwapTransferTransactionInfo } from '@/routes/transactions/swap-transfer-transaction-info.entity';
import {
  VaultDepositTransactionInfo,
  VaultRedeemTransactionInfo,
} from '@/routes/transactions/entities/vaults/vault-transaction-info.entity';

@ApiExtraModels(
  TransactionInfo,
  CreationTransactionInfo,
  CustomTransactionInfo,
  SettingsChangeTransaction,
  TransferTransactionInfo,
  SwapOrderTransactionInfo,
  SwapTransferTransactionInfo,
  TwapOrderTransactionInfo,
  NativeStakingDepositTransactionInfo,
  NativeStakingValidatorsExitTransactionInfo,
  NativeStakingWithdrawTransactionInfo,
  VaultDepositTransactionInfo,
  VaultRedeemTransactionInfo,
)
export class BaseTransaction {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(CreationTransactionInfo) },
      { $ref: getSchemaPath(CustomTransactionInfo) },
      { $ref: getSchemaPath(SettingsChangeTransaction) },
      { $ref: getSchemaPath(TransferTransactionInfo) },
      { $ref: getSchemaPath(SwapOrderTransactionInfo) },
      { $ref: getSchemaPath(SwapTransferTransactionInfo) },
      { $ref: getSchemaPath(TwapOrderTransactionInfo) },
      { $ref: getSchemaPath(NativeStakingDepositTransactionInfo) },
      { $ref: getSchemaPath(NativeStakingValidatorsExitTransactionInfo) },
      { $ref: getSchemaPath(NativeStakingWithdrawTransactionInfo) },
      { $ref: getSchemaPath(VaultDepositTransactionInfo) },
      { $ref: getSchemaPath(VaultRedeemTransactionInfo) },
    ],
  })
  txInfo: TransactionInfo;

  constructor(txInfo: TransactionInfo) {
    this.txInfo = txInfo;
  }
}
