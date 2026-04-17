import { ApiProperty } from '@nestjs/swagger';
import { ModuleTransaction } from '@/modules/transactions/routes/entities/module-transaction.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class ModuleTransactionPage extends Page<ModuleTransaction> {
  @ApiProperty({ type: ModuleTransaction, isArray: true })
  results!: Array<ModuleTransaction>;
}
