import { ApiProperty } from '@nestjs/swagger';
import { BaseTransaction } from '@/modules/transactions/routes/entities/base-transaction.entity';
import { TransactionData } from '@/modules/transactions/routes/entities/transaction-data.entity';
import { TransactionInfo } from '@/modules/transactions/routes/entities/transaction-info.entity';

export class TransactionPreview extends BaseTransaction {
  @ApiProperty()
  txData: TransactionData;

  constructor(txInfo: TransactionInfo, txData: TransactionData) {
    super(txInfo);
    this.txData = txData;
  }
}
