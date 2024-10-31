import {
  StakingStatus,
  StakingTimeInfo,
  StakingFinancialInfo,
} from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type NativeStakingDepositInfo = StakingTimeInfo & StakingFinancialInfo;

export class NativeStakingDepositTransactionInfo
  extends TransactionInfo
  implements NativeStakingDepositInfo
{
  @ApiProperty({ enum: [TransactionInfoType.NativeStakingDeposit] })
  override type = TransactionInfoType.NativeStakingDeposit;

  @ApiProperty({ enum: StakingStatus })
  status: StakingStatus;

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
  value: string;

  @ApiProperty()
  numValidators: number;

  @ApiProperty()
  expectedAnnualReward: string;

  @ApiProperty()
  expectedMonthlyReward: string;

  @ApiProperty()
  expectedFiatAnnualReward: number;

  @ApiProperty()
  expectedFiatMonthlyReward: number;

  @ApiProperty()
  tokenInfo: TokenInfo;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    nullable: true,
    description: 'Populated after transaction has been executed',
  })
  validators: Array<`0x${string}`> | null;

  constructor(args: {
    status: StakingStatus;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
    value: string;
    numValidators: number;
    expectedAnnualReward: string;
    expectedMonthlyReward: string;
    expectedFiatAnnualReward: number;
    expectedFiatMonthlyReward: number;
    tokenInfo: TokenInfo;
    validators: Array<`0x${string}`> | null;
  }) {
    super(TransactionInfoType.NativeStakingDeposit, null);
    this.status = args.status;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
    this.value = args.value;
    this.numValidators = args.numValidators;
    this.expectedAnnualReward = args.expectedAnnualReward;
    this.expectedMonthlyReward = args.expectedMonthlyReward;
    this.expectedFiatAnnualReward = args.expectedFiatAnnualReward;
    this.expectedFiatMonthlyReward = args.expectedFiatMonthlyReward;
    this.tokenInfo = args.tokenInfo;
    this.validators = args.validators;
  }
}
