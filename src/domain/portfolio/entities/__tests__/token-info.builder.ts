import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { TokenBalanceTokenInfo } from '@/domain/portfolio/entities/token-balance.entity';
import { getAddress } from 'viem';

export function tokenInfoBuilder(): IBuilder<TokenBalanceTokenInfo> {
  return new Builder<TokenBalanceTokenInfo>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('decimals', faker.number.int({ min: 0, max: 18 }))
    .with('symbol', faker.finance.currencyCode())
    .with('name', faker.finance.currencyName())
    .with('logoUrl', faker.internet.url({ appendSlash: false }))
    .with('chainId', faker.string.numeric())
    .with('trusted', faker.datatype.boolean())
    .with('assetId', faker.lorem.word().toLowerCase());
}
