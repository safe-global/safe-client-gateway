import { ApiProperty } from '@nestjs/swagger';
import { TXSMultisigTransaction } from '@/modules/transactions/routes/entities/txs-multisig-transaction.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class TXSMultisigTransactionPage extends Page<TXSMultisigTransaction> {
  @ApiProperty({ type: TXSMultisigTransaction, isArray: true })
  results!: Array<TXSMultisigTransaction>;
}
