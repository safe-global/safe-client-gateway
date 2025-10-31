import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  PortfolioNativeToken,
  PortfolioErc20Token,
  PortfolioErc721Token,
} from '@/routes/portfolio/entities/portfolio-token.entity';

@ApiExtraModels(PortfolioNativeToken, PortfolioErc20Token, PortfolioErc721Token)
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
    description: 'Group ID for grouping related positions together',
    type: 'string',
    nullable: true,
  })
  groupId!: string | null;

  @ApiProperty({
    description: 'Token information',
    oneOf: [
      { $ref: getSchemaPath(PortfolioNativeToken) },
      { $ref: getSchemaPath(PortfolioErc20Token) },
      { $ref: getSchemaPath(PortfolioErc721Token) },
    ],
  })
  tokenInfo!: PortfolioNativeToken | PortfolioErc20Token | PortfolioErc721Token;

  @ApiProperty({
    description:
      'Receipt token address (pool address) representing this position. This is the contract address for the position token (LP token, staking receipt, etc.), not the underlying token.',
    type: 'string',
    nullable: true,
    example: '0x6da7b0d8464c4eeab6023d891db267a045fc978f',
  })
  receiptTokenAddress: string | null = null;

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
