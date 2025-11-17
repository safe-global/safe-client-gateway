import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { MultisigTransaction } from '@/modules/transactions/routes/entities/multisig-transaction.entity';

export class MultisigTransactionPage extends Page<MultisigTransaction> {
  @ApiProperty({ type: MultisigTransaction, isArray: true })
  results!: Array<MultisigTransaction>;
}
