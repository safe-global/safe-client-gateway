// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { BaseTransaction } from '@/modules/transactions/routes/entities/base-transaction.entity';
import type { TransactionData } from '@/modules/transactions/routes/entities/transaction-data.entity';
import type { TransactionInfo } from '@/modules/transactions/routes/entities/transaction-info.entity';

export class TransactionPreview extends BaseTransaction {
  @ApiProperty()
  txData: TransactionData;

  constructor(txInfo: TransactionInfo, txData: TransactionData) {
    super(txInfo);
    this.txData = txData;
  }
}
