import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { Token } from '@/domain/bridge/entities/token.entity';

export function tokenBuilder(): IBuilder<Token> {
  return new Builder<Token>()
    .with('chainId', faker.string.numeric())
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('symbol', faker.finance.currencyCode())
    .with('decimals', faker.number.int({ min: 1, max: 18 }))
    .with('name', faker.word.words())
    .with('coinKey', faker.word.sample())
    .with('logoURI', faker.internet.url({ appendSlash: false }))
    .with('priceUSD', faker.number.float({ min: 0, max: 1_000 }).toString());
}
