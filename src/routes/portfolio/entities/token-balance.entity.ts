import { ApiProperty } from '@nestjs/swagger';
import { PortfolioTokenInfo } from '@/routes/portfolio/entities/token-info.entity';

export class TokenBalance {
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
    example: '4801.653401839',
    nullable: true,
  })
  balanceFiat: string | null = null;

  @ApiProperty({
    type: 'string',
    description:
      'Token price in requested fiat currency. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '3890.12',
    nullable: true,
  })
  price: string | null = null;

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
