import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { Token, TokenType } from '@/domain/tokens/entities/token.entity';
import { getAddress } from 'viem';

export function tokenBuilder(): IBuilder<Token> {
  return (
    new Builder<Token>()
      .with('address', getAddress(faker.finance.ethereumAddress()))
      // min/max boundaries are set here in order to prevent overflows on balances calculation.
      // See: https://github.com/safe-global/safe-client-gateway/blob/65364f9ad31fc9832b32248f74356c4f6660787e/src/datasources/balances-api/safe-balances-api.service.ts#L173
      .with('decimals', faker.number.int({ min: 0, max: 32 }))
      .with('logoUri', faker.internet.url({ appendSlash: false }))
      .with('name', faker.word.sample())
      .with('symbol', faker.finance.currencySymbol())
      .with('type', faker.helpers.arrayElement(Object.values(TokenType)))
      .with('trusted', faker.datatype.boolean())
  );
}
