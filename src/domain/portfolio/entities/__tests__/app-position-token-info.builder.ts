import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AppPositionTokenInfo } from '@/domain/portfolio/entities/app-position.entity';
import { getAddress } from 'viem';

export function appPositionTokenInfoBuilder(): IBuilder<AppPositionTokenInfo> {
  return new Builder<AppPositionTokenInfo>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('decimals', faker.number.int({ min: 0, max: 18 }))
    .with('symbol', faker.finance.currencyCode())
    .with('name', faker.finance.currencyName())
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('chainId', faker.string.numeric())
    .with('trusted', faker.datatype.boolean())
    .with('assetId', faker.lorem.word().toLowerCase())
    .with('type', 'ERC20' as const);
}
