// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { TransactionItem } from '#/modules/transactions/routes/entities/transaction-item.entity';
import { Page } from '#/routes/common/entities/page.entity';

export class TransferTransactionItemPage extends Page<TransactionItem> {
  @ApiProperty({ type: TransactionItem, isArray: true })
  results!: Array<TransactionItem>;
}
