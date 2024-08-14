import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  ConfirmationViewDecodedType,
  IBaselineConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';

// Included in dedicated `stake` and pooled `deposit` calls
interface IStakingTimes {
  estimatedEntryTime: number;
  estimatedExitTime: number;
  estimatedWithdrawalTime: number;
}

// Included in dedicated `stake`, pooled `deposit`, and DeFi `deposit` calls
interface IFeeAndRevenue {
  fee: number;
  monthlyNrr: number;
  annualNrr: number;
}

// Included in every pooled call
interface IPooled {
  pool: AddressInfo;
  exchangeRate: string;
  poolToken: TokenInfo;
}

// Included in every DeFi call
interface IDefiVault {
  vault: AddressInfo;
  exchangeRate: string;
  vaultToken: TokenInfo;
}

export class DedicatedDepositConfirmationView
  implements IBaselineConfirmationView, IStakingTimes, IFeeAndRevenue
{
  @ApiProperty({ enum: [ConfirmationViewDecodedType.KilnDedicatedStake] })
  type = ConfirmationViewDecodedType.KilnDedicatedStake;

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

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
  }
}

export class PooledDepositConfirmationView
  implements IBaselineConfirmationView, IStakingTimes, IFeeAndRevenue, IPooled
{
  @ApiProperty({ enum: [ConfirmationViewDecodedType.KilnPooledDeposit] })
  type = ConfirmationViewDecodedType.KilnPooledDeposit;

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

export class PooledRequestExitConfirmationView
  implements IBaselineConfirmationView, IStakingTimes, IPooled
{
  @ApiProperty({ enum: [ConfirmationViewDecodedType.KilnPooledRequestExist] })
  type = ConfirmationViewDecodedType.KilnPooledRequestExist;

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

export class PooledWithdrawConfirmationView
  implements IBaselineConfirmationView, IStakingTimes, IPooled
{
  @ApiProperty({ enum: [ConfirmationViewDecodedType.KilnPooledWithdraw] })
  type = ConfirmationViewDecodedType.KilnPooledWithdraw;

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

export class DefiDepositConfirmationView
  implements IBaselineConfirmationView, IFeeAndRevenue, IDefiVault
{
  @ApiProperty({ enum: [ConfirmationViewDecodedType.KilnDefiDeposit] })
  type = ConfirmationViewDecodedType.KilnDefiDeposit;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  @ApiProperty()
  fee: number;

  @ApiProperty()
  monthlyNrr: number;

  @ApiProperty()
  annualNrr: number;

  @ApiProperty()
  vault: AddressInfo;

  @ApiProperty()
  exchangeRate: string;

  @ApiProperty()
  vaultToken: TokenInfo;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
    vault: AddressInfo;
    exchangeRate: string;
    vaultToken: TokenInfo;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
    this.vault = args.vault;
    this.exchangeRate = args.exchangeRate;
    this.vaultToken = args.vaultToken;
  }
}

export class DefiWithdrawConfirmationView
  implements IBaselineConfirmationView, IDefiVault
{
  @ApiProperty({ enum: [ConfirmationViewDecodedType.KilnDefiWithdraw] })
  type = ConfirmationViewDecodedType.KilnDefiWithdraw;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({ type: [DataDecodedParameter], nullable: true })
  parameters: DataDecodedParameter[] | null;

  @ApiProperty()
  vault: AddressInfo;

  @ApiProperty()
  exchangeRate: string;

  @ApiProperty()
  vaultToken: TokenInfo;

  constructor(args: {
    method: string;
    parameters: DataDecodedParameter[] | null;
    vault: AddressInfo;
    exchangeRate: string;
    vaultToken: TokenInfo;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.vault = args.vault;
    this.exchangeRate = args.exchangeRate;
    this.vaultToken = args.vaultToken;
  }
}
