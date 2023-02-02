import { ApiProperty } from '@nestjs/swagger';
import { Page } from '../../common/entities/page.entity';
import { TransactionHistory } from './transaction-history.entity';

export class TransactionHistoryPage extends Page<TransactionHistory> {
  @ApiProperty({ type: TransactionHistory })
  results: TransactionHistory[];
}
