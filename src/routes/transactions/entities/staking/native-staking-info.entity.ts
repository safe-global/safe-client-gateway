import {
  StakingStatus,
  StakingStatusInfo,
  StakingTimeInfo,
  StakingFinancialInfo,
} from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';

export type NativeStakingDepositInfo = StakingStatusInfo &
  StakingTimeInfo &
  StakingFinancialInfo;

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
  tokenInfo: TokenInfo;

  constructor(args: {
    status: StakingStatus;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
    tokenInfo: TokenInfo;
  }) {
    super(TransactionInfoType.NativeStakingDeposit, null, null);
    this.status = args.status;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
    this.tokenInfo = args.tokenInfo;
  }
}
