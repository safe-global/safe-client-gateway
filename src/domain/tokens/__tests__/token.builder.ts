import { faker } from '@faker-js/faker';
import { Token, TokenType } from '../entities/token.entity';
import { Builder, IBuilder } from '../../../__tests__/builder';

export function tokenBuilder(): IBuilder<Token> {
  return Builder.new<Token>()
    .with('address', faker.finance.ethereumAddress())
    .with('decimals', faker.number.int())
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('name', faker.word.sample())
    .with('symbol', faker.finance.currencySymbol())
    .with('type', faker.helpers.arrayElement(Object.values(TokenType)));
}
