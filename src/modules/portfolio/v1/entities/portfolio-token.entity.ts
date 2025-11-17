import { ApiProperty } from '@nestjs/swagger';
import {
  NativeToken,
  Erc20Token,
  Erc721Token,
} from '@/modules/balances/routes/entities/token.entity';

export class PortfolioNativeToken extends NativeToken {
  @ApiProperty({ description: 'The chain ID' })
  public readonly chainId!: string;

  @ApiProperty({
    description: 'Whether the token is trusted (spam filter)',
  })
  public readonly trusted!: boolean;
}

export class PortfolioErc20Token extends Erc20Token {
  @ApiProperty({ description: 'The chain ID' })
  public readonly chainId!: string;

  @ApiProperty({
    description: 'Whether the token is trusted (spam filter)',
  })
  public readonly trusted!: boolean;
}

export class PortfolioErc721Token extends Erc721Token {
  @ApiProperty({ description: 'The chain ID' })
  public readonly chainId!: string;

  @ApiProperty({
    description: 'Whether the token is trusted (spam filter)',
  })
  public readonly trusted!: boolean;
}
