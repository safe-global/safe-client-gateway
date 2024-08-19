import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { StakingFinancialInfo } from '@/routes/transactions/entities/staking/staking-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';

type DefiStaking = {
  vault: AddressInfo;
  exchangeRate: string;
  vaultToken: TokenInfo;
};

export type DefiStakingDepositInfo = StakingFinancialInfo & DefiStaking;

export type DefiStakingWithdrawInfo = DefiStaking;

export class DefiDepositTransactionInfo
  extends TransactionInfo
  implements DefiStakingDepositInfo
{
  @ApiProperty({ enum: [TransactionInfoType.DefiStakingDeposit] })
  override type = TransactionInfoType.DefiStakingDeposit;

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
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
    vault: AddressInfo;
    exchangeRate: string;
    vaultToken: TokenInfo;
  }) {
    super(TransactionInfoType.DefiStakingDeposit, null, null);
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
    this.vault = args.vault;
    this.exchangeRate = args.exchangeRate;
    this.vaultToken = args.vaultToken;
  }
}

export class DefiStakingWithdrawTransactionInfo
  extends TransactionInfo
  implements DefiStakingWithdrawInfo
{
  @ApiProperty({ enum: [TransactionInfoType.DefiStakingWithdraw] })
  override type = TransactionInfoType.DefiStakingWithdraw;

  @ApiProperty()
  vault: AddressInfo;

  @ApiProperty()
  exchangeRate: string;

  @ApiProperty()
  vaultToken: TokenInfo;

  constructor(args: {
    vault: AddressInfo;
    exchangeRate: string;
    vaultToken: TokenInfo;
  }) {
    super(TransactionInfoType.DefiStakingWithdraw, null, null);
    this.vault = args.vault;
    this.exchangeRate = args.exchangeRate;
    this.vaultToken = args.vaultToken;
  }
}
