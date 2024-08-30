import { StakingValidatorsExitStatus } from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';

export class NativeStakingValidatorsExitTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.NativeStakingValidatorsExit] })
  override type = TransactionInfoType.NativeStakingValidatorsExit;

  @ApiProperty({ enum: StakingValidatorsExitStatus })
  status: StakingValidatorsExitStatus;

  @ApiProperty()
  estimatedExitTime: number;

  @ApiProperty()
  estimatedWithdrawalTime: number;

  @ApiProperty()
  value: string;

  @ApiProperty()
  numValidators: number;

  @ApiProperty()
  tokenInfo: TokenInfo;

  constructor(args: {
    status: StakingValidatorsExitStatus;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    value: string;
    numValidators: number;
    tokenInfo: TokenInfo;
  }) {
    super(TransactionInfoType.NativeStakingValidatorsExit, null, null);
    this.status = args.status;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.value = args.value;
    this.numValidators = args.numValidators;
    this.tokenInfo = args.tokenInfo;
  }
}
