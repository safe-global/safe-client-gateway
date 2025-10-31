import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import {
  NativeToken,
  Erc20Token,
  Erc721Token,
} from '@/routes/balances/entities/token.entity';

@ApiExtraModels(NativeToken, Erc20Token, Erc721Token)
export class PortfolioNativeToken extends NativeToken {
  @ApiProperty({ description: 'The chain ID' })
  chainId!: string;

  @ApiProperty({
    description: 'Whether the token is trusted (spam filter)',
  })
  trusted!: boolean;
}

@ApiExtraModels(NativeToken, Erc20Token, Erc721Token)
export class PortfolioErc20Token extends Erc20Token {
  @ApiProperty({ description: 'The chain ID' })
  chainId!: string;

  @ApiProperty({
    description: 'Whether the token is trusted (spam filter)',
  })
  trusted!: boolean;
}

@ApiExtraModels(NativeToken, Erc20Token, Erc721Token)
export class PortfolioErc721Token extends Erc721Token {
  @ApiProperty({ description: 'The chain ID' })
  chainId!: string;

  @ApiProperty({
    description: 'Whether the token is trusted (spam filter)',
  })
  trusted!: boolean;
}
