import { ApiProperty } from '@nestjs/swagger';
import { Page } from '../../common/entities/page.entity';
import { ModuleTransaction } from './module-transaction.entity';

export class ModuleTransactionPage extends Page<ModuleTransaction> {
  @ApiProperty({ type: ModuleTransaction })
  results: ModuleTransaction[];
}
