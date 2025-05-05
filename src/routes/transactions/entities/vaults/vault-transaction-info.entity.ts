import { ApiProperty } from '@nestjs/swagger';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { VaultInfo } from '@/routes/transactions/entities/vaults/vault-info.entity';
import { VaultExtraReward } from '@/routes/transactions/entities/vaults/vault-extra-reward.entity';

export class VaultRedeemTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.VaultRedeem] })
  override type = TransactionInfoType.VaultRedeem;

  @ApiProperty()
  value: string;

  @ApiProperty()
  baseNrr: number;

  @ApiProperty()
  fee: number;

  @ApiProperty()
  tokenInfo: TokenInfo;

  @ApiProperty({ type: VaultInfo })
  vaultInfo: VaultInfo;

  @ApiProperty()
  currentReward: string;

  @ApiProperty()
  additionalRewardsNrr: number;

  @ApiProperty({ type: VaultExtraReward, isArray: true })
  additionalRewards: Array<VaultExtraReward>;

  constructor(args: {
    value: string;
    baseNrr: number;
    fee: number;
    tokenInfo: TokenInfo;
    vaultInfo: VaultInfo;
    currentReward: string;
    additionalRewardsNrr: number;
    additionalRewards: Array<VaultExtraReward>;
  }) {
    super(TransactionInfoType.VaultRedeem, null);
    this.value = args.value;
    this.baseNrr = args.baseNrr;
    this.fee = args.fee;
    this.tokenInfo = args.tokenInfo;
    this.vaultInfo = args.vaultInfo;
    this.currentReward = args.currentReward;
    this.additionalRewardsNrr = args.additionalRewardsNrr;
    this.additionalRewards = args.additionalRewards;
  }
}

export class VaultDepositTransactionInfo extends VaultRedeemTransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.VaultDeposit] })
  override type = TransactionInfoType.VaultDeposit;

  @ApiProperty()
  expectedMonthlyReward: string;

  @ApiProperty()
  expectedAnnualReward: string;

  constructor(args: {
    value: string;
    baseNrr: number;
    fee: number;
    tokenInfo: TokenInfo;
    vaultInfo: VaultInfo;
    currentReward: string;
    expectedMonthlyReward: string;
    expectedAnnualReward: string;
    additionalRewardsNrr: number;
    additionalRewards: Array<VaultExtraReward>;
  }) {
    super(args);
    this.expectedMonthlyReward = args.expectedMonthlyReward;
    this.expectedAnnualReward = args.expectedAnnualReward;
  }
}
