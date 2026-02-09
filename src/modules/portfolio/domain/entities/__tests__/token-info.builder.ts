import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { TokenInfo } from '@/modules/portfolio/domain/entities/token-info.entity';
import { getAddress } from 'viem';

export function tokenInfoBuilder(): IBuilder<TokenInfo> {
  return new Builder<TokenInfo>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('decimals', faker.number.int({ min: 0, max: 18 }))
    .with('symbol', faker.finance.currencyCode())
    .with('name', faker.finance.currencyName())
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('chainId', faker.string.numeric())
    .with('trusted', faker.datatype.boolean())
    .with('type', 'ERC20' as const);
}
