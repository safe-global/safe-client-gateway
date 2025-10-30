import { ApiProperty } from '@nestjs/swagger';
import { TokenBalance } from '@/routes/portfolio/entities/token-balance.entity';
import { AppBalance } from '@/routes/portfolio/entities/app-balance.entity';

export class Portfolio {
  @ApiProperty({
    type: 'string',
    description:
      'Total balance in fiat currency across all tokens and positions. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '954181237.094243',
  })
  totalBalanceFiat!: string;

  @ApiProperty({
    type: 'string',
    description:
      'Total balance in fiat currency for all token holdings. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '935542322.9685864',
  })
  totalTokenBalanceFiat!: string;

  @ApiProperty({
    type: 'string',
    description:
      'Total balance in fiat currency for all app positions. Decimal string without exponent notation or thousand separators.',
    pattern: '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$',
    example: '18638914.125656575',
  })
  totalPositionsBalanceFiat!: string;

  @ApiProperty({
    description: 'List of token balances',
    type: [TokenBalance],
  })
  tokenBalances!: Array<TokenBalance>;

  @ApiProperty({
    description: 'List of app balances',
    type: [AppBalance],
  })
  positionBalances!: Array<AppBalance>;
}
