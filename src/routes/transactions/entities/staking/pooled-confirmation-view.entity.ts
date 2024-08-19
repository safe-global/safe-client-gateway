import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  ConfirmationViewDecodedType,
  IBaselineConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  PooledStakingDepositInfo,
  PooledStakingRequestExitInfo,
  PooledStakingWithdrawInfo,
} from '@/routes/transactions/entities/staking/pooled-staking-info.entity';

export class PooledStakingStakeConfirmationView
  implements IBaselineConfirmationView, PooledStakingDepositInfo
{
  @ApiProperty({ enum: [ConfirmationViewDecodedType.KilnPooledStakingDeposit] })
  type = ConfirmationViewDecodedType.KilnPooledStakingDeposit;

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
  pool: AddressInfo;

  @ApiProperty()
  exchangeRate: string;

  @ApiProperty()
  poolToken: TokenInfo;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
    pool: AddressInfo;
    exchangeRate: string;
    poolToken: TokenInfo;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
    this.pool = args.pool;
    this.exchangeRate = args.exchangeRate;
    this.poolToken = args.poolToken;
  }
}

export class PooledStakingRequestExitConfirmationView
  implements IBaselineConfirmationView, PooledStakingRequestExitInfo
{
  @ApiProperty({
    enum: [ConfirmationViewDecodedType.KilnPooledStakingRequestExist],
  })
  type = ConfirmationViewDecodedType.KilnPooledStakingRequestExist;

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
  pool: AddressInfo;

  @ApiProperty()
  exchangeRate: string;

  @ApiProperty()
  poolToken: TokenInfo;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    pool: AddressInfo;
    exchangeRate: string;
    poolToken: TokenInfo;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.pool = args.pool;
    this.exchangeRate = args.exchangeRate;
    this.poolToken = args.poolToken;
  }
}

export class PooledStakingWithdrawConfirmationView
  implements IBaselineConfirmationView, PooledStakingWithdrawInfo
{
  @ApiProperty({
    enum: [ConfirmationViewDecodedType.KilnPooledStakingWithdraw],
  })
  type = ConfirmationViewDecodedType.KilnPooledStakingWithdraw;

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
  pool: AddressInfo;

  @ApiProperty()
  exchangeRate: string;

  @ApiProperty()
  poolToken: TokenInfo;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    pool: AddressInfo;
    exchangeRate: string;
    poolToken: TokenInfo;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.pool = args.pool;
    this.exchangeRate = args.exchangeRate;
    this.poolToken = args.poolToken;
  }
}
