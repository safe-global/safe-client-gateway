import { ApiProperty } from '@nestjs/swagger';
import { Page } from '../../common/entities/page.entity';
import { TransactionItem } from './transaction-item.entity';

export class TransactionItemPage extends Page<TransactionItem> {
  @ApiProperty({ type: TransactionItem })
  results: TransactionItem[];
}
