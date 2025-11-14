import { TokenInfo } from '@/modules/transactions/routes/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/modules/transactions/routes/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export class NativeStakingWithdrawTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.NativeStakingWithdraw] })
  override type = TransactionInfoType.NativeStakingWithdraw;

  @ApiProperty()
  value: string;

  @ApiProperty()
  tokenInfo: TokenInfo;

  @ApiProperty()
  validators: Array<Address>;

  constructor(args: {
    value: string;
    tokenInfo: TokenInfo;
    validators: Array<Address>;
  }) {
    super(TransactionInfoType.NativeStakingWithdraw, null);
    this.value = args.value;
    this.tokenInfo = args.tokenInfo;
    this.validators = args.validators;
  }
}
