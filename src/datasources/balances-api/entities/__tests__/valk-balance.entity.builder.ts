import { Builder, IBuilder } from '@/__tests__/builder';
import { ValkBalance } from '@/datasources/balances-api/entities/valk-balance.entity';
import { faker } from '@faker-js/faker';

export function valkBalanceBuilder(): IBuilder<ValkBalance> {
  return new Builder<ValkBalance>()
    .with('token_address', faker.finance.ethereumAddress())
    .with('name', faker.finance.currencyName())
    .with('symbol', faker.finance.currencySymbol())
    .with('logo', faker.internet.url({ appendSlash: false }))
    .with('thumbnail', faker.internet.url({ appendSlash: false }))
    .with('decimals', faker.number.int({ min: 10, max: 20 }))
    .with('balance', faker.number.int())
    .with(
      'prices',
      Array.from({ length: faker.number.int({ min: 1, max: 10 }) }, () =>
        faker.finance.currencyCode(),
      ).reduce(
        (prices, currencyCode) => ({
          ...prices,
          [currencyCode]: faker.number.float({ min: 0.01, precision: 0.0001 }),
        }),
        {},
      ),
    );
}
