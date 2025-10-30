import { ApiProperty } from '@nestjs/swagger';
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
    description:
      'Balance in smallest unit as string integer. Use decimals to convert.',
  })
  balance!: string;

  @ApiProperty({
    type: 'string',
    description:
      'Balance in requested fiat currency. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '18638914.125656575',
    nullable: true,
  })
  balanceFiat: string | null = null;

  @ApiProperty({
    type: 'string',
    description:
      'Price change as decimal (e.g., "-0.0431" for -4.31%). Decimal string without exponent notation.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '-0.0431',
    nullable: true,
  })
  priceChangePercentage1d: string | null = null;
}
