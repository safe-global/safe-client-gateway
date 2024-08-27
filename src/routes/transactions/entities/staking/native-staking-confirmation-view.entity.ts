import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  Baseline,
  DecodedType,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { NativeStakingDepositInfo } from '@/routes/transactions/entities/staking/native-staking-info.entity';
import { StakingStatus } from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NativeStakingDepositConfirmationView
  implements Baseline, NativeStakingDepositInfo
{
  @ApiProperty({
    enum: [DecodedType.KilnNativeStakingDeposit],
  })
  type = DecodedType.KilnNativeStakingDeposit;

  @ApiProperty({
    enum: StakingStatus,
  })
  status: StakingStatus;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  @ApiProperty()
  estimatedEntryTime: number;

  @ApiProperty()
  estimatedExitTime: number;

  @ApiProperty()
  estimatedWithdrawalTime: number;

  @ApiProperty()
  fee: number;

  @ApiProperty()
  monthlyNrr: number;

  @ApiProperty()
  annualNrr: number;

  @ApiProperty()
  value: number;

  @ApiProperty()
  expectedAnnualReward: number;

  @ApiProperty()
  expectedMonthlyReward: number;

  @ApiProperty()
  expectedFiatAnnualReward: number;

  @ApiProperty()
  expectedFiatMonthlyReward: number;

  @ApiProperty()
  tokenInfo: TokenInfo;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
    status: StakingStatus;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
    value: number;
    expectedAnnualReward: number;
    expectedMonthlyReward: number;
    expectedFiatAnnualReward: number;
    expectedFiatMonthlyReward: number;
    tokenInfo: TokenInfo;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.status = args.status;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
    this.value = args.value;
    this.expectedAnnualReward = args.expectedAnnualReward;
    this.expectedMonthlyReward = args.expectedMonthlyReward;
    this.expectedFiatAnnualReward = args.expectedFiatAnnualReward;
    this.expectedFiatMonthlyReward = args.expectedFiatMonthlyReward;
    this.tokenInfo = args.tokenInfo;
  }
}
