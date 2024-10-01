import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';

export function nativeCurrencyBuilder(): IBuilder<NativeCurrency> {
  return new Builder<NativeCurrency>()
    .with('name', faker.finance.currencyName())
    .with('symbol', faker.finance.currencySymbol())
    .with('decimals', 18)
    .with('logoUri', faker.image.url());
}
