import { ApiProperty } from '@nestjs/swagger';
import { TokenInfo } from '@/modules/transactions/routes/entities/swaps/token-info.entity';

export class VaultExtraReward {
  @ApiProperty()
  tokenInfo: TokenInfo;

  @ApiProperty()
  nrr: number;

  @ApiProperty()
  claimable: string;

  @ApiProperty()
  claimableNext: string;

  constructor(args: {
    tokenInfo: TokenInfo;
    nrr: number;
    claimable: string;
    claimableNext: string;
  }) {
    this.tokenInfo = args.tokenInfo;
    this.nrr = args.nrr;
    this.claimable = args.claimable;
    this.claimableNext = args.claimableNext;
  }
}
