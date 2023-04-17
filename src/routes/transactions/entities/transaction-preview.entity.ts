import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { CreationTransactionInfo } from './creation-transaction-info.entity';
import { CustomTransactionInfo } from './custom-transaction.entity';
import { SettingsChangeTransaction } from './settings-change-transaction.entity';
import { TransactionData } from './transaction-data.entity';
import { TransactionInfo } from './transaction-info.entity';
import { TransferTransactionInfo } from './transfer-transaction-info.entity';

@ApiExtraModels(
  CreationTransactionInfo,
  CustomTransactionInfo,
  SettingsChangeTransaction,
  TransferTransactionInfo,
)
export class TransactionPreview {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(CreationTransactionInfo) },
      { $ref: getSchemaPath(CustomTransactionInfo) },
      { $ref: getSchemaPath(SettingsChangeTransaction) },
      { $ref: getSchemaPath(TransferTransactionInfo) },
    ],
  })
  txInfo: TransactionInfo;
  @ApiProperty()
  txData: TransactionData;

  constructor(txInfo: TransactionInfo, txData: TransactionData) {
    this.txInfo = txInfo;
    this.txData = txData;
  }
}
