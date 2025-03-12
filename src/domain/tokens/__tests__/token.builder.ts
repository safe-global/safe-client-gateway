import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  Erc20Token,
  Erc721Token,
  NativeToken,
  Token,
} from '@/domain/tokens/entities/token.entity';
import { getAddress } from 'viem';

export function nativeTokenBuilder(): IBuilder<NativeToken> {
  return new Builder<NativeToken>()
    .with('type', 'NATIVE_TOKEN')
    .with('decimals', faker.number.int({ min: 0, max: 18 }))
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('name', faker.word.sample())
    .with('symbol', faker.finance.currencySymbol())
    .with('trusted', faker.datatype.boolean());
}

export function erc20TokenBuilder(): IBuilder<Erc20Token> {
  return new Builder<Erc20Token>()
    .with('type', 'ERC20')
    .with('decimals', faker.number.int({ min: 0, max: 18 }))
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('name', faker.word.sample())
    .with('symbol', faker.finance.currencySymbol())
    .with('trusted', faker.datatype.boolean());
}

export function erc721TokenBuilder(): IBuilder<Erc721Token> {
  return new Builder<Erc721Token>()
    .with('type', 'ERC721')
    .with('decimals', 0)
    .with('trusted', true)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('name', faker.word.sample())
    .with('symbol', faker.finance.currencySymbol())
    .with('trusted', faker.datatype.boolean());
}

export function tokenBuilder(): IBuilder<Token> {
  return faker.helpers.arrayElement([
    nativeTokenBuilder,
    erc20TokenBuilder,
    erc721TokenBuilder,
  ])();
}
