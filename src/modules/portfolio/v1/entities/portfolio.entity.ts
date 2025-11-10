import { ApiProperty } from '@nestjs/swagger';
import { TokenBalance } from '@/modules/portfolio/v1/entities/token-balance.entity';
import { AppBalance } from '@/modules/portfolio/v1/entities/app-balance.entity';

export class Portfolio {
  @ApiProperty({
    type: 'string',
    description:
      'Total balance in fiat currency across all tokens and positions. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '954181237.094243',
  })
  public readonly totalBalanceFiat!: string;

  @ApiProperty({
    type: 'string',
    description:
      'Total balance in fiat currency for all token holdings. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '935542322.9685864',
  })
  public readonly totalTokenBalanceFiat!: string;

  @ApiProperty({
    type: 'string',
    description:
      'Total balance in fiat currency for all app positions. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '18638914.125656575',
  })
  public readonly totalPositionsBalanceFiat!: string;

  @ApiProperty({
    description: 'List of token balances',
    type: [TokenBalance],
  })
  public readonly tokenBalances!: Array<TokenBalance>;

  @ApiProperty({
    description: 'List of app balances',
    type: [AppBalance],
  })
  public readonly positionBalances!: Array<AppBalance>;
}
