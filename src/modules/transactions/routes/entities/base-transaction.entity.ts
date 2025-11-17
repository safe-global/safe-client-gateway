import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { CreationTransactionInfo } from '@/modules/transactions/routes/entities/creation-transaction-info.entity';
import {
  CustomTransactionInfo,
  MultiSendTransactionInfo,
} from '@/modules/transactions/routes/entities/custom-transaction.entity';
import { SettingsChangeTransaction } from '@/modules/transactions/routes/entities/settings-change-transaction.entity';
import { NativeStakingDepositTransactionInfo } from '@/modules/transactions/routes/entities/staking/native-staking-deposit-info.entity';
import { NativeStakingValidatorsExitTransactionInfo } from '@/modules/transactions/routes/entities/staking/native-staking-validators-exit-info.entity';
import { NativeStakingWithdrawTransactionInfo } from '@/modules/transactions/routes/entities/staking/native-staking-withdraw-info.entity';
import { SwapOrderTransactionInfo } from '@/modules/transactions/routes/entities/swaps/swap-order-info.entity';
import { TwapOrderTransactionInfo } from '@/modules/transactions/routes/entities/swaps/twap-order-info.entity';
import { TransactionInfo } from '@/modules/transactions/routes/entities/transaction-info.entity';
import { TransferTransactionInfo } from '@/modules/transactions/routes/entities/transfer-transaction-info.entity';
import { SwapTransferTransactionInfo } from '@/modules/transactions/routes/swap-transfer-transaction-info.entity';
import {
  VaultDepositTransactionInfo,
  VaultRedeemTransactionInfo,
} from '@/modules/transactions/routes/entities/vaults/vault-transaction-info.entity';
import {
  BridgeAndSwapTransactionInfo,
  SwapTransactionInfo,
} from '@/modules/transactions/routes/entities/bridge/bridge-info.entity';

@ApiExtraModels(
  TransactionInfo,
  CreationTransactionInfo,
  CustomTransactionInfo,
  MultiSendTransactionInfo,
  SettingsChangeTransaction,
  TransferTransactionInfo,
  BridgeAndSwapTransactionInfo,
  SwapOrderTransactionInfo,
  SwapTransactionInfo,
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
      { $ref: getSchemaPath(MultiSendTransactionInfo) },
      { $ref: getSchemaPath(SettingsChangeTransaction) },
      { $ref: getSchemaPath(TransferTransactionInfo) },
      { $ref: getSchemaPath(SwapOrderTransactionInfo) },
      { $ref: getSchemaPath(BridgeAndSwapTransactionInfo) },
      { $ref: getSchemaPath(SwapTransactionInfo) },
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
