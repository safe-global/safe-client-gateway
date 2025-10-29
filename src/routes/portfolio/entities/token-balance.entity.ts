import { ApiProperty } from '@nestjs/swagger';
import { PortfolioTokenInfo } from '@/routes/portfolio/entities/token-info.entity';

export class TokenBalance {
  @ApiProperty({
    description: 'Token information',
    type: PortfolioTokenInfo,
  })
  tokenInfo!: PortfolioTokenInfo;

  @ApiProperty({
    description: 'Token balance (as string to avoid precision loss)',
  })
  balance!: string;

  @ApiProperty({
    type: 'number',
    description: 'Balance in requested fiat currency',
    nullable: true,
  })
  balanceFiat: number | null = null;

  @ApiProperty({
    type: 'number',
    description: 'Token price in requested fiat currency',
    nullable: true,
  })
  price: number | null = null;

  @ApiProperty({
    type: 'number',
    description: 'Price change as decimal (e.g., -0.0431 for -4.31%)',
    nullable: true,
  })
  priceChangePercentage1d: number | null = null;
}
