import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { TXSMultisigTransaction } from '@/routes/transactions/entities/txs-multisig-transaction.entity';

export class TXSMultisigTransactionPage extends Page<TXSMultisigTransaction> {
  @ApiProperty({ type: TXSMultisigTransaction, isArray: true })
  results!: Array<TXSMultisigTransaction>;
}
