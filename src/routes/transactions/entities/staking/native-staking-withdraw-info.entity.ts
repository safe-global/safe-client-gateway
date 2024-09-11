import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';

export class NativeStakingWithdrawTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.NativeStakingWithdraw] })
  override type = TransactionInfoType.NativeStakingWithdraw;

  @ApiProperty()
  value: string;

  @ApiProperty()
  rewards: string;

  @ApiProperty()
  tokenInfo: TokenInfo;

  constructor(args: { value: string; rewards: string; tokenInfo: TokenInfo }) {
    super(TransactionInfoType.NativeStakingWithdraw, null, null);
    this.value = args.value;
    this.rewards = args.rewards;
    this.tokenInfo = args.tokenInfo;
  }
}
