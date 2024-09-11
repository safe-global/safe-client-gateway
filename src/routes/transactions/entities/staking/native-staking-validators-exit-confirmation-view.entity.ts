import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  Baseline,
  DecodedType,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import {
  StakingValidatorsExitInfo,
  StakingValidatorsExitStatus,
} from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NativeStakingValidatorsExitConfirmationView
  implements Baseline, StakingValidatorsExitInfo
{
  @ApiProperty({
    enum: [DecodedType.KilnNativeStakingValidatorsExit],
  })
  type = DecodedType.KilnNativeStakingValidatorsExit;

  @ApiProperty({
    enum: StakingValidatorsExitStatus,
  })
  status: StakingValidatorsExitStatus;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  @ApiProperty()
  estimatedExitTime: number;

  @ApiProperty()
  estimatedWithdrawalTime: number;

  @ApiProperty()
  value: string;

  @ApiProperty()
  numValidators: number;

  @ApiProperty()
  rewards: string;

  @ApiProperty()
  tokenInfo: TokenInfo;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
    status: StakingValidatorsExitStatus;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    value: string;
    numValidators: number;
    rewards: string;
    tokenInfo: TokenInfo;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.status = args.status;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.value = args.value;
    this.numValidators = args.numValidators;
    this.rewards = args.rewards;
    this.tokenInfo = args.tokenInfo;
  }
}
