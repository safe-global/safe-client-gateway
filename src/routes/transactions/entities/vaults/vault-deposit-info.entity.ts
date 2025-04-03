import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';

export class VaultDepositTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.VaultDeposit] })
  override type = TransactionInfoType.VaultDeposit;

  @ApiProperty()
  chainId: string;

  @ApiProperty()
  to: `0x${string}`;

  @ApiProperty()
  value: string;

  @ApiProperty()
  data: `0x${string}`;

  constructor(args: {
    chainId: string;
    to: `0x${string}`;
    value: string;
    data: `0x${string}`;
  }) {
    super(TransactionInfoType.VaultDeposit, null);
    this.chainId = args.chainId;
    this.to = args.to;
    this.value = args.value;
    this.data = args.data;
  }
}
