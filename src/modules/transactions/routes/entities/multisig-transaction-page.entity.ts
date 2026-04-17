import { ApiProperty } from '@nestjs/swagger';
import { MultisigTransaction } from '@/modules/transactions/routes/entities/multisig-transaction.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class MultisigTransactionPage extends Page<MultisigTransaction> {
  @ApiProperty({ type: MultisigTransaction, isArray: true })
  results!: Array<MultisigTransaction>;
}
