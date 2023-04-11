import { ApiProperty } from '@nestjs/swagger';
import { TransactionData } from './transaction-data.entity';
import { TransactionInfo } from './transaction-info.entity';

export class TransactionPreview {
  @ApiProperty()
  txInfo: TransactionInfo;
  @ApiProperty()
  txData: TransactionData;

  constructor(txInfo: TransactionInfo, txData: TransactionData) {
    this.txInfo = txInfo;
    this.txData = txData;
  }
}
