// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import type {
  Erc20Token as DomainErc20Token,
  Erc721Token as DomainErc721Token,
  NativeToken as DomainNativeToken,
} from '@/modules/tokens/domain/entities/token.entity';

class BaseToken {
  @ApiProperty()
  address!: Address;
  @ApiProperty()
  decimals!: number;
  @ApiProperty()
  logoUri!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  symbol!: string;
  @ApiProperty({
    description:
      'Whether the Transaction Service lists the token in one of its imported token lists',
  })
  trusted!: boolean;
}

export class NativeToken extends BaseToken implements DomainNativeToken {
  @ApiProperty({ enum: ['NATIVE_TOKEN'] })
  type!: 'NATIVE_TOKEN';
}

export class Erc20Token extends BaseToken implements DomainErc20Token {
  @ApiProperty({ enum: ['ERC20'] })
  type!: 'ERC20';
}

export class Erc721Token extends BaseToken implements DomainErc721Token {
  @ApiProperty({ enum: ['ERC721'] })
  type!: 'ERC721';
}
