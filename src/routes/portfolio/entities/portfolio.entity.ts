import { ApiProperty } from '@nestjs/swagger';
import { TokenBalance } from '@/routes/portfolio/entities/token-balance.entity';
import { AppBalance } from '@/routes/portfolio/entities/app-balance.entity';

export class Portfolio {
  @ApiProperty({
    description: 'Total balance in fiat currency across all tokens and positions',
    example: '50000.00',
  })
  totalBalanceFiat!: string;

  @ApiProperty({
    description: 'Total balance in fiat currency for all token holdings',
    example: '30000.00',
  })
  totalTokenBalanceFiat!: string;

  @ApiProperty({
    description: 'Total balance in fiat currency for all app positions',
    example: '20000.00',
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
