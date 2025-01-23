import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { TransactionData } from '@/routes/transactions/entities/transaction-data.entity';
import { getTxInfoSchema, TransactionInfo } from './transaction-info.entity';

@ApiExtraModels(TransactionInfo)
export class TransactionPreview {
  @ApiProperty(getTxInfoSchema())
  txInfo: TransactionInfo;
  @ApiProperty()
  txData: TransactionData;

  constructor(txInfo: TransactionInfo, txData: TransactionData) {
    this.txInfo = txInfo;
    this.txData = txData;
  }
}
