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
export class TokenBalance {
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
    example: '4801.653401839',
  })
  public readonly balanceFiat?: string;

  @ApiPropertyOptional({
    type: 'string',
    description:
      'Token price in requested fiat currency. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '3890.12',
  })
  public readonly price?: string;

  @ApiPropertyOptional({
    type: 'string',
    description:
      'Price change as decimal (e.g., "-0.0431" for -4.31%). Decimal string without exponent notation.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '-0.0431',
  })
  public readonly priceChangePercentage1d?: string;
}
