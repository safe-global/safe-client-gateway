import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  StakingTimeInfo,
  StakingFinancialInfo,
} from '@/routes/transactions/entities/staking/staking-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';

type PooledStaking = {
  pool: AddressInfo;
  exchangeRate: string;
  poolToken: TokenInfo;
};

export type PooledStakingDepositInfo = PooledStaking &
  StakingTimeInfo &
  StakingFinancialInfo;

export type PooledStakingRequestExitInfo = PooledStaking & StakingTimeInfo;

export type PooledStakingWithdrawInfo = PooledStaking & StakingTimeInfo;

export class PooledStakingDepositTransactionInfo
  extends TransactionInfo
  implements PooledStakingDepositInfo
{
  @ApiProperty({ enum: [TransactionInfoType.PooledStakingDeposit] })
  override type = TransactionInfoType.PooledStakingDeposit;

  @ApiProperty()
  pool: AddressInfo;

  @ApiProperty()
  exchangeRate: string;

  @ApiProperty()
  poolToken: TokenInfo;

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

  constructor(args: {
    pool: AddressInfo;
    exchangeRate: string;
    poolToken: TokenInfo;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
  }) {
    super(TransactionInfoType.PooledStakingDeposit, null, null);
    this.pool = args.pool;
    this.exchangeRate = args.exchangeRate;
    this.poolToken = args.poolToken;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
  }
}

export class PooledStakingRequestExitTransactionInfo
  extends TransactionInfo
  implements PooledStakingRequestExitInfo
{
  @ApiProperty({ enum: [TransactionInfoType.PooledStakingRequestExit] })
  override type = TransactionInfoType.PooledStakingRequestExit;

  @ApiProperty()
  estimatedEntryTime: number;

  @ApiProperty()
  estimatedExitTime: number;

  @ApiProperty()
  estimatedWithdrawalTime: number;

  @ApiProperty()
  pool: AddressInfo;

  @ApiProperty()
  exchangeRate: string;

  @ApiProperty()
  poolToken: TokenInfo;

  constructor(args: {
    pool: AddressInfo;
    exchangeRate: string;
    poolToken: TokenInfo;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
  }) {
    super(TransactionInfoType.PooledStakingRequestExit, null, null);
    this.pool = args.pool;
    this.exchangeRate = args.exchangeRate;
    this.poolToken = args.poolToken;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
  }
}

export class PooledStakingWithdrawTransactionInfo
  extends TransactionInfo
  implements PooledStakingWithdrawInfo
{
  @ApiProperty({ enum: [TransactionInfoType.PooledStakingWithdraw] })
  override type = TransactionInfoType.PooledStakingWithdraw;
  @ApiProperty()
  estimatedEntryTime: number;

  @ApiProperty()
  estimatedExitTime: number;

  @ApiProperty()
  estimatedWithdrawalTime: number;

  @ApiProperty()
  pool: AddressInfo;

  @ApiProperty()
  exchangeRate: string;

  @ApiProperty()
  poolToken: TokenInfo;

  constructor(args: {
    pool: AddressInfo;
    exchangeRate: string;
    poolToken: TokenInfo;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
  }) {
    super(TransactionInfoType.PooledStakingWithdraw, null, null);
    this.pool = args.pool;
    this.exchangeRate = args.exchangeRate;
    this.poolToken = args.poolToken;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
  }
}
