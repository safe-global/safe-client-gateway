import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';

export class VaultWithdrawTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.VaultDeposit] })
  override type = TransactionInfoType.VaultDeposit;

  constructor() {
    super(TransactionInfoType.VaultDeposit, null);
  }
}
