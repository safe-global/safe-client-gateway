import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  PortfolioNativeToken,
  PortfolioErc20Token,
  PortfolioErc721Token,
} from '@/modules/portfolio/v1/entities/portfolio-token.entity';

@ApiExtraModels(PortfolioNativeToken, PortfolioErc20Token, PortfolioErc721Token)
export class AppPosition {
  @ApiProperty({
    description: 'Unique position key',
  })
  public readonly key!: string;

  @ApiProperty({
    description: 'Position type (e.g., staked, lending, liquidity)',
  })
  public readonly type!: string;

  @ApiProperty({
    description: 'Position name',
  })
  public readonly name!: string;

  @ApiPropertyOptional({
    description: 'Group ID for grouping related positions together',
    type: 'string',
  })
  public readonly groupId?: string;

  @ApiProperty({
    description: 'Token information',
    oneOf: [
      { $ref: getSchemaPath(PortfolioNativeToken) },
      { $ref: getSchemaPath(PortfolioErc20Token) },
      { $ref: getSchemaPath(PortfolioErc721Token) },
    ],
  })
  public readonly tokenInfo!:
    | PortfolioNativeToken
    | PortfolioErc20Token
    | PortfolioErc721Token;

  @ApiPropertyOptional({
    description:
      'Receipt token address (pool address) representing this position. This is the contract address for the position token (LP token, staking receipt, etc.), not the underlying token.',
    type: 'string',
  })
  public readonly receiptTokenAddress?: string;

  @ApiProperty({
    description:
      'Balance in smallest unit as string integer. Use decimals to convert.',
  })
  public readonly balance!: string;

  @ApiPropertyOptional({
    type: 'string',
    description:
      'Balance in requested fiat currency. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '18638914.125656575',
  })
  public readonly balanceFiat?: string;

  @ApiPropertyOptional({
    type: 'string',
    description:
      'Price change as decimal (e.g., "-0.0431" for -4.31%). Decimal string without exponent notation.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '-0.0431',
  })
  public readonly priceChangePercentage1d?: string;
}
