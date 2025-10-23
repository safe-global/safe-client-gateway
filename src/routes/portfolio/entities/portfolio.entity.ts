import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TokenBalance } from '@/routes/portfolio/entities/token-balance.entity';
import { AppBalance } from '@/routes/portfolio/entities/app-balance.entity';
import { PnL } from '@/routes/portfolio/entities/pnl.entity';

export class Portfolio {
  @ApiProperty({
    type: 'number',
    description: 'Total balance in fiat currency across all tokens and positions',
    example: 50000.00,
  })
  totalBalanceFiat!: number;

  @ApiProperty({
    type: 'number',
    description: 'Total balance in fiat currency for all token holdings',
    example: 30000.00,
  })
  totalTokenBalanceFiat!: number;

  @ApiProperty({
    type: 'number',
    description: 'Total balance in fiat currency for all app positions',
    example: 20000.00,
  })
  totalPositionsBalanceFiat!: number;

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

  @ApiPropertyOptional({
    description: 'Profit and Loss metrics (null if unavailable)',
    type: PnL,
    nullable: true,
  })
  pnl!: PnL | null;
}
