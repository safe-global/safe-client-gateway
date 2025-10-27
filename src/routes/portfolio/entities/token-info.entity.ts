import { ApiProperty } from '@nestjs/swagger';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';

export class PortfolioTokenInfo extends TokenInfo {
  @ApiProperty({ description: 'The chain ID' })
  chainId!: string;

  @ApiProperty({
    enum: ['ERC20', 'NATIVE_TOKEN'],
    description: 'Token type',
  })
  type!: 'ERC20' | 'NATIVE_TOKEN';
}
