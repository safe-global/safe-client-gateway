import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  ConfirmationViewDecodedType,
  IBaselineConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  DefiStakingDepositInfo,
  DefiStakingWithdrawInfo,
} from '@/routes/transactions/entities/staking/defi-staking-info.entity';

export class DefiStakingDepositConfirmationView
  implements IBaselineConfirmationView, DefiStakingDepositInfo
{
  @ApiProperty({ enum: [ConfirmationViewDecodedType.KilnDefiStakingDeposit] })
  type = ConfirmationViewDecodedType.KilnDefiStakingDeposit;

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

export class DefiStakingWithdrawConfirmationView
  implements IBaselineConfirmationView, DefiStakingWithdrawInfo
{
  @ApiProperty({ enum: [ConfirmationViewDecodedType.KilnDefiStakingWithdraw] })
  type = ConfirmationViewDecodedType.KilnDefiStakingWithdraw;

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
