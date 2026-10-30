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
    type: String,
    nullable: true,
    description:
      'Absolute change of the total over 1 day. Decimal string, null when Zerion has no history.',
  })
  readonly fiatChange1d: string | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Percentage change of the total over 1 day, null when Zerion has no history.',
  })
  readonly percentChange1d: number | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description:
      'Total per chain, keyed by chainId. Only chains whose Zerion network maps to a chainId are listed, so the values may not add up to fiatTotal.',
  })
  readonly fiatTotalByChain: Record<string, string>;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description:
      'Total per position type as returned by Zerion (e.g. wallet, deposited, borrowed, locked, staked).',
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
      'When the cached snapshot expires. A transaction or a manual refresh can clear it earlier.',
  })
  readonly expiresAt: Date;

  constructor(args: {
    fiatTotal: string;
    fiatChange1d: string | null;
    percentChange1d: number | null;
    fiatTotalByChain: Record<string, string>;
    fiatTotalByType: Record<string, string>;
    updatedAt: Date;
    expiresAt: Date;
  }) {
    this.fiatTotal = args.fiatTotal;
    this.fiatChange1d = args.fiatChange1d;
    this.percentChange1d = args.percentChange1d;
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
      'zerion: read from the Zerion snapshot. tx_service: the chain is not on Zerion, or the snapshot is unavailable.',
  })
  readonly source: PortfolioSummarySource;
  @ApiProperty({
    type: PortfolioSummarySnapshot,
    nullable: true,
    description:
      'The Zerion snapshot the value was read from, null for tx_service.',
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
