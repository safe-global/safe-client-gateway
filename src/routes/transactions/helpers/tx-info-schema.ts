import { type ApiPropertyOptions, getSchemaPath } from '@nestjs/swagger';

import { CreationTransactionInfo } from '@/routes/transactions/entities/creation-transaction-info.entity';
import { CustomTransactionInfo } from '@/routes/transactions/entities/custom-transaction.entity';
import { SettingsChangeTransaction } from '@/routes/transactions/entities/settings-change-transaction.entity';
import { TransferTransactionInfo } from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { SwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/swap-order-info.entity';
import { SwapTransferTransactionInfo } from '@/routes/transactions/swap-transfer-transaction-info.entity';
import { TwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/twap-order-info.entity';
import { NativeStakingDepositTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-deposit-info.entity';
import { NativeStakingValidatorsExitTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-validators-exit-info.entity';
import { NativeStakingWithdrawTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-withdraw-info.entity';

export function getTxInfoSchema(): ApiPropertyOptions {
  return {
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
    ],
  };
}
