import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Page } from '../../common/entities/page.entity';
import { DateLabel } from '../../common/entities/date-label.entity';
import { TransactionItem } from './transaction-item.entity';

@ApiExtraModels(TransactionItem, DateLabel)
export class TransactionItemPage extends Page<TransactionItem | DateLabel> {
  @ApiProperty({
    isArray: true,
    oneOf: [
      { $ref: getSchemaPath(TransactionItem) },
      { $ref: getSchemaPath(DateLabel) },
    ],
  })
  results: (TransactionItem | DateLabel)[];
}
