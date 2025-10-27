import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PortfolioTokenInfo } from '@/routes/portfolio/entities/token-info.entity';

export class AppPosition {
  @ApiProperty({
    description: 'Unique position key',
  })
  key!: string;

  @ApiProperty({
    description: 'Position type (e.g., staked, lending, liquidity)',
  })
  type!: string;

  @ApiProperty({
    description: 'Position name',
  })
  name!: string;

  @ApiProperty({
    description: 'Token information',
    type: PortfolioTokenInfo,
  })
  tokenInfo!: PortfolioTokenInfo;

  @ApiProperty({
    description: 'Position balance',
  })
  balance!: string;

  @ApiPropertyOptional({
    type: 'number',
    description: 'Balance in requested fiat currency',
    nullable: true,
  })
  balanceFiat!: number | null;

  @ApiPropertyOptional({
    type: 'number',
    description: 'Price change as decimal (e.g., -0.0431 for -4.31%)',
    nullable: true,
  })
  priceChangePercentage1d!: number | null;
}
