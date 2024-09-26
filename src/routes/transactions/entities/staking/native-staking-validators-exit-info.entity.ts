import { StakingStatus } from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Compared to {@link NativeStakingValidatorsExitConfirmationView}, this has no value
 * as Kiln's API only returns the current `net_claimable_consensus_rewards`. After
 * withdrawal, `net_claimable_consensus_rewards` resets to 0.
 */
export class NativeStakingValidatorsExitTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.NativeStakingValidatorsExit] })
  override type = TransactionInfoType.NativeStakingValidatorsExit;

  @ApiProperty({ enum: StakingStatus })
  status: StakingStatus;

  @ApiProperty()
  estimatedExitTime: number;

  @ApiProperty()
  estimatedWithdrawalTime: number;

  @ApiProperty()
  numValidators: number;

  @ApiProperty()
  tokenInfo: TokenInfo;

  constructor(args: {
    status: StakingStatus;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    numValidators: number;
    tokenInfo: TokenInfo;
  }) {
    super(TransactionInfoType.NativeStakingValidatorsExit, null, null);
    this.status = args.status;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.numValidators = args.numValidators;
    this.tokenInfo = args.tokenInfo;
  }
}
