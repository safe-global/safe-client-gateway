// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { TransactionItem } from '@/modules/transactions/routes/entities/transaction-item.entity';
import { DateLabel } from '@/routes/common/entities/date-label.entity';
import { Page } from '@/routes/common/entities/page.entity';

@ApiExtraModels(TransactionItem, DateLabel)
export class TransactionItemPage extends Page<TransactionItem | DateLabel> {
  @ApiProperty({
    isArray: true,
    oneOf: [
      { $ref: getSchemaPath(TransactionItem) },
      { $ref: getSchemaPath(DateLabel) },
    ],
  })
  results!: Array<TransactionItem | DateLabel>;
}
