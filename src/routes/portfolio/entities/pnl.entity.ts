import { ApiProperty } from '@nestjs/swagger';
import type { PnL as DomainPnL } from '@/domain/portfolio/entities/pnl.entity';

export class PnL {
  @ApiProperty({
    description:
      'Realized Gain. The gain (or loss) realized from the sale of fungible assets, calculated using the FIFO (First In, First Out) method. The cost basis of the oldest assets is subtracted from the sale proceeds.',
    example: 127718.31,
    type: 'number',
  })
  realizedGain!: number;

  @ApiProperty({
    description:
      'Unrealized Gain. The potential gain (or loss) on unsold fungible assets, calculated as the difference between their current market value and cost basis using the FIFO method.',
    example: 21364.69,
    type: 'number',
  })
  unrealizedGain!: number;

  @ApiProperty({
    description:
      'Total Fees Paid. The sum of all transaction fees associated with asset trades.',
    example: 0,
    type: 'number',
  })
  totalFee!: number;

  @ApiProperty({
    description:
      'Net Invested Amount. The total amount invested in fungible assets that have not been sold, calculated using the FIFO method.',
    example: 312120.03,
    type: 'number',
  })
  netInvested!: number;

  @ApiProperty({
    description:
      'Received Amount from Other Wallets. The cumulative value of all fungible assets received from other wallets. Note: This value does not include amounts traded internally within the wallet but does include received_for_nfts.',
    example: 3042647.83,
    type: 'number',
  })
  receivedExternal!: number;

  @ApiProperty({
    description:
      'Sent Amount to Other Wallets. The cumulative value of all fungible assets sent to other wallets. Note: This value does not include amounts traded internally within the wallet but does include sent_for_nfts.',
    example: 2855624.03,
    type: 'number',
  })
  sentExternal!: number;

  @ApiProperty({
    description:
      'Sent Amount for NFTs. The cumulative value of all fungible assets sent in transactions where the wallet receives NFTs.',
    example: 25059.56,
    type: 'number',
  })
  sentForNfts!: number;

  @ApiProperty({
    description:
      'Received Amount for NFTs. The cumulative value of all fungible assets received in transactions where the wallet sends NFTs.',
    example: 24517.18,
    type: 'number',
  })
  receivedForNfts!: number;

  constructor(pnl: Exclude<DomainPnL, null>) {
    this.realizedGain = pnl.realizedGain;
    this.unrealizedGain = pnl.unrealizedGain;
    this.totalFee = pnl.totalFee;
    this.netInvested = pnl.netInvested;
    this.receivedExternal = pnl.receivedExternal;
    this.sentExternal = pnl.sentExternal;
    this.sentForNfts = pnl.sentForNfts;
    this.receivedForNfts = pnl.receivedForNfts;
  }
}
