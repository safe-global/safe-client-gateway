import { ApiProperty } from '@nestjs/swagger';
import { BaseTransaction } from '@/routes/transactions/entities/base-transaction.entity';
import { TransactionData } from '@/routes/transactions/entities/transaction-data.entity';
import { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';

export class TransactionPreview extends BaseTransaction {
  @ApiProperty()
  txData: TransactionData;

  constructor(txInfo: TransactionInfo, txData: TransactionData) {
    super(txInfo);
    this.txData = txData;
  }
}
