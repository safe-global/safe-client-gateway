import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { TransactionData } from '@/routes/transactions/entities/transaction-data.entity';
import { TransactionInfo } from './transaction-info.entity';
import { getTxInfoSchema } from '../helpers/tx-info-schema';

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
