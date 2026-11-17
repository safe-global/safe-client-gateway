// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';

export const PortfolioSummarySources = ['zerion', 'tx_service'] as const;

export type PortfolioSummarySource = (typeof PortfolioSummarySources)[number];

export class PortfolioSummarySnapshot {
  @ApiProperty({
    description:
      'Total across every chain of this address in this environment (mainnets or testnets). Decimal string.',
  })
  readonly fiatTotal: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description:
      'Total per chain, keyed by chainId. Adds up to fiatTotal. Decimal strings.',
  })
  readonly fiatTotalByChain: Record<string, string>;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description:
      'Total per Zerion position type (wallet, deposit, loan, staked, locked, reward, ...) across every chain of this address in this environment. Loans are negative. Adds up to fiatTotal. Decimal strings.',
  })
  readonly fiatTotalByType: Record<string, string>;
  @ApiProperty({
    type: Date,
    description: 'When the snapshot was fetched from Zerion.',
  })
  readonly updatedAt: Date;
  @ApiProperty({
    type: Date,
    description:
      'Approximately when the cached snapshot expires: the cache adds jitter to its lifetime, and a transaction or a manual refresh can clear it earlier.',
  })
  readonly expiresAt: Date;

  constructor(args: {
    fiatTotal: string;
    fiatTotalByChain: Record<string, string>;
    fiatTotalByType: Record<string, string>;
    updatedAt: Date;
    expiresAt: Date;
  }) {
    this.fiatTotal = args.fiatTotal;
    this.fiatTotalByChain = args.fiatTotalByChain;
    this.fiatTotalByType = args.fiatTotalByType;
    this.updatedAt = args.updatedAt;
    this.expiresAt = args.expiresAt;
  }
}

export class PortfolioSummary {
  @ApiProperty()
  readonly chainId: string;
  @ApiProperty()
  readonly address: string;
  @ApiProperty({
    description: 'Value of this Safe on this chain. Decimal string.',
  })
  readonly fiatTotal: string;
  @ApiProperty({
    enum: PortfolioSummarySources,
    description:
      'zerion: summed from the Zerion snapshot the Assets page reads. tx_service: the chain is not on Zerion, or the snapshot is unavailable.',
  })
  readonly source: PortfolioSummarySource;
  @ApiProperty({
    type: PortfolioSummarySnapshot,
    nullable: true,
    description:
      'The Zerion snapshot the value was summed from, null for tx_service.',
  })
  readonly snapshot: PortfolioSummarySnapshot | null;

  constructor(args: {
    chainId: string;
    address: string;
    fiatTotal: string;
    source: PortfolioSummarySource;
    snapshot: PortfolioSummarySnapshot | null;
  }) {
    this.chainId = args.chainId;
    this.address = args.address;
    this.fiatTotal = args.fiatTotal;
    this.source = args.source;
    this.snapshot = args.snapshot;
  }
}
