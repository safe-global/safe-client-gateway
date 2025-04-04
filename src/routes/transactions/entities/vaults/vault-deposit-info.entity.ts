import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { ApiProperty } from '@nestjs/swagger';

export class VaultDepositTransactionInfo extends TransactionInfo {
  @ApiProperty({ enum: [TransactionInfoType.VaultDeposit] })
  override type = TransactionInfoType.VaultDeposit;

  @ApiProperty()
  chainId: string;

  @ApiProperty()
  expectedMonthlyReward: number;

  @ApiProperty()
  expectedAnnualReward: number;

  @ApiProperty()
  tokenInfo: TokenInfo;

  @ApiProperty()
  returnRate: number;

  @ApiProperty()
  vaultAddress: `0x${string}`;

  @ApiProperty()
  vaultName: string;

  @ApiProperty()
  vaultDisplayName: string;

  @ApiProperty()
  vaultDescription: string;

  @ApiProperty({ type: String, nullable: true })
  vaultDashboardURL: string | null;

  @ApiProperty()
  vaultTVL: number;

  constructor(args: {
    chainId: string;
    expectedAnnualReward: number;
    expectedMonthlyReward: number;
    returnRate: number;
    tokenInfo: TokenInfo;
    vaultAddress: `0x${string}`;
    vaultDashboardURL: string | null;
    vaultDescription: string;
    vaultDisplayName: string;
    vaultName: string;
    vaultTVL: number;
  }) {
    super(TransactionInfoType.VaultDeposit, null);
    this.chainId = args.chainId;
    this.expectedAnnualReward = args.expectedAnnualReward;
    this.expectedMonthlyReward = args.expectedMonthlyReward;
    this.returnRate = args.returnRate;
    this.tokenInfo = args.tokenInfo;
    this.vaultAddress = args.vaultAddress;
    this.vaultDashboardURL = args.vaultDashboardURL;
    this.vaultDescription = args.vaultDescription;
    this.vaultDisplayName = args.vaultDisplayName;
    this.vaultName = args.vaultName;
    this.vaultTVL = args.vaultTVL;
  }
}
