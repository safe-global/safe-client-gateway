import { ApiProperty } from '@nestjs/swagger';
import {
  NativeToken as DomainNativeToken,
  Erc20Token as DomainErc20Token,
  Erc721Token as DomainErc721Token,
} from '@/domain/tokens/entities/token.entity';

class BaseToken {
  @ApiProperty()
  address!: `0x${string}`;
  @ApiProperty()
  decimals!: number;
  @ApiProperty()
  logoUri!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  symbol!: string;
}

export class NativeToken
  extends BaseToken
  implements Omit<DomainNativeToken, 'trusted'>
{
  @ApiProperty({ enum: ['NATIVE_TOKEN'] })
  type!: 'NATIVE_TOKEN';
}

export class Erc20Token
  extends BaseToken
  implements Omit<DomainErc20Token, 'trusted'>
{
  @ApiProperty({ enum: ['ERC20'] })
  type!: 'ERC20';
}

export class Erc721Token
  extends BaseToken
  implements Omit<DomainErc721Token, 'trusted'>
{
  @ApiProperty({ enum: ['ERC721'] })
  type!: 'ERC721';
}
